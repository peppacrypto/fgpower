#!/usr/bin/env node
// The muscle atlas: every muscle alone on the figure, from the front, the back and the side, on one sheet per pose.
//
//   node atlas.mjs [--out out-muscles/atlas] [--ids chest,lats] [--pose stand|rest] [--views front,back,left] [--cell 360x560]
//   node atlas.mjs --shots out-muscles/shots.json     a list of {out, muscles, side, az, el, center, size, W, H, frame|rest, grid}
//
// Uses paint.js and rig.js through the same page as a render, but its own small scene, cheaper than page.js: this is for
// judging shapes. Judge the final look with render.mjs. Runs under the render locks.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const HERE = path.dirname(fileURLToPath(import.meta.url))
if (!process.env.ART_LOCKED) {
  const SLOTS = Number(process.env.ART_RENDER_SLOTS || 4)
  for (let turn = 0; ; turn++) {
    const lock = path.join(HERE, 'build', `.render.${turn % SLOTS}.lock`)
    const r = spawnSync('flock', ['-n', '-E', '75', lock, process.execPath, fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, ART_LOCKED: '1' } })
    if (r.status !== 75) process.exit(r.status ?? 1)
    if (turn % SLOTS === SLOTS - 1) spawnSync('sleep', ['1'])
  }
}
const args = process.argv.slice(2)
const flag = (k, d) => {
  const i = args.indexOf(k)
  return i < 0 ? d : args[i + 1]
}
const OUT = path.resolve(flag('--out', path.join(HERE, 'out-muscles', 'atlas')))
const POSE = flag('--pose', 'stand')
const VIEWS = flag('--views', 'front,back,left').split(',')
const [CW, CH] = flag('--cell', '360x560').split('x').map(Number)
const SHOTS = flag('--shots', '')
// Development: a work-in-progress paint.js and bake, so the shared tree stays untouched while tuning.
const PAINT = flag('--paint', '')
const BAKED = flag('--baked', '')

const require = createRequire(path.resolve(HERE, '..', '..', 'package.json'))
const { chromium } = require('playwright')
const sharp = require('sharp')

const PAGE = `
import * as THREE from './vendor/three.module.js'
import { Body } from './rig.js'
import { makePaint, MUSCLE_NAMES } from './paint.js'
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.outputColorSpace = THREE.SRGBColorSpace
document.body.appendChild(renderer.domElement)
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0b0b0c)
{
  const env = new THREE.Scene()
  env.background = new THREE.Color(0x050506)
  const panel = (w, h, pos, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(i, i, i), side: THREE.DoubleSide }))
    m.position.set(...pos)
    m.lookAt(0, 0, 0)
    env.add(m)
  }
  panel(8, 8, [0, 6, 0], 2.2)
  panel(3, 6, [6, 2, 2], 3.2)
  panel(3, 6, [-6, 2, 2], 1.6)
  panel(6, 3, [0, 2, -6], 1.2)
  panel(6, 3, [0, 2, 6], 0.9)
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(env, 0.03).texture
  scene.environmentIntensity = 0.55
}
scene.add(new THREE.HemisphereLight(0xc8ccd2, 0x141416, 0.75))
const sun = new THREE.DirectionalLight(0xffffff, 3.0)
scene.add(sun)
scene.add(sun.target)
const rim = new THREE.DirectionalLight(0xffffff, 1.6)
scene.add(rim)
scene.add(rim.target)
const data = await (await fetch('./build/body-real.json')).json()
const baked = await (await fetch('./build/muscles.json')).json()
const body = new Body(data, { render: true })
const geom = new THREE.BufferGeometry()
geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(body.n * 3), 3))
geom.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(body.n * 3), 3))
geom.setAttribute('aRest', new THREE.BufferAttribute(body.rest, 3))
geom.setIndex(new THREE.BufferAttribute(body.index, 1))
const STYLE = { skin: new THREE.Color(0xb9b9b9), shorts: new THREE.Color(0x121213), target: new THREE.Color(0xff5a1f), muscleEdge: 0.45, muscleGlow: 0.32, muscleFiber: 0.16, waistY: 0.985, hemY: 0.77 }
const paint = makePaint(THREE, body, STYLE, baked)
paint.attach(geom)
const mesh = new THREE.Mesh(geom, paint.patch(new THREE.MeshStandardMaterial({ roughness: 0.48, metalness: 0.02, envMapIntensity: 0.25 })))
mesh.frustumCulled = false
scene.add(mesh)
let lastPose = null
window.MUSCLE_NAMES = MUSCLE_NAMES
window.shot = (o) => {
  const W = o.W || 1000
  const H = o.H || 1000
  renderer.setSize(W, H)
  const key = o.rest ? 'rest' : JSON.stringify(o.frame || {})
  if (key !== lastPose) {
    let pos
    if (o.rest) {
      body.surface.update(body.ctlRest)
      pos = body.pos
    } else pos = body.solve(o.frame || {}).positions
    geom.attributes.position.array.set(pos)
    geom.attributes.position.needsUpdate = true
    geom.attributes.normal.array.set(body.normals)
    geom.attributes.normal.needsUpdate = true
    lastPose = key
  }
  paint.setMuscles(o.muscles || [], o.side)
  const ca = ((o.az || 0) * Math.PI) / 180
  const ce = ((o.el || 0) * Math.PI) / 180
  const dir = new THREE.Vector3(Math.sin(ca) * Math.cos(ce), Math.sin(ce), Math.cos(ca) * Math.cos(ce))
  const c = new THREE.Vector3(...(o.center || [0, 1, 0]))
  const size = o.size || 2
  const asp = W / H
  const cam = new THREE.OrthographicCamera((-size * asp) / 2, (size * asp) / 2, size / 2, -size / 2, 0.1, 40)
  cam.position.copy(c).addScaledVector(dir, 8)
  cam.up.set(0, 1, 0)
  cam.lookAt(c)
  const l = dir.clone().multiplyScalar(0.55).add(new THREE.Vector3(0.25, 1, 0.2)).normalize()
  sun.position.copy(c).addScaledVector(l, 8)
  sun.target.position.copy(c)
  rim.position.copy(c).addScaledVector(dir, -6).add(new THREE.Vector3(-1.5, 3, 0))
  rim.target.position.copy(c)
  renderer.render(scene, cam)
  return renderer.domElement.toDataURL('image/png')
}
window.ready = true
`
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' }
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0])
  if (u === '/atlas.html') {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end('<!doctype html><body style="margin:0"><script type="module" src="/atlas-page.js"></script>')
    return
  }
  if (u === '/atlas-page.js') {
    res.writeHead(200, { 'content-type': 'text/javascript' })
    res.end(PAGE)
    return
  }
  let p = path.join(HERE, u)
  if (PAINT && u === '/paint.js') p = path.resolve(PAINT)
  if (BAKED && u === '/build/muscles.json') p = path.resolve(BAKED)
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404)
    res.end()
    return
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' })
  fs.createReadStream(p).pipe(res)
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] })
const page = await browser.newPage({ viewport: { width: 1700, height: 1300 } })
page.on('pageerror', (e) => console.error(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') console.error(m.text())
})
await page.goto(`http://127.0.0.1:${server.address().port}/atlas.html`)
await page.waitForFunction(() => window.ready, null, { timeout: 240000 })

const shoot = async (o) => Buffer.from((await page.evaluate((x) => window.shot(x), o)).split(',')[1], 'base64')

async function withGrid(img, o) {
  const W = o.W || 1000
  const H = o.H || 1000
  const size = o.size || 2
  const c = o.center || [0, 1, 0]
  const ca = ((o.az || 0) * Math.PI) / 180
  const rx = Math.cos(ca)
  const rz = -Math.sin(ca)
  const c0 = c[0] * rx + c[2] * rz
  const s = H / size
  const toX = (r) => W / 2 + (r - c0) * s
  const toY = (u) => H / 2 - (u - c[1]) * s
  let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`
  const g = o.grid
  for (let i = Math.floor((c0 - (size * W) / H / 2) / g); i * g < c0 + (size * W) / H / 2; i++) {
    const major = i % 5 === 0
    svg += `<line x1="${toX(i * g)}" x2="${toX(i * g)}" y1="0" y2="${H}" stroke="#0ff" stroke-width="${major ? 0.8 : 0.3}" stroke-opacity="0.5"/>`
    if (major) svg += `<text x="${toX(i * g) + 2}" y="12" font-size="12" fill="#0ff">${(i * g).toFixed(2)}</text>`
  }
  for (let i = Math.floor((c[1] - size / 2) / g); i * g < c[1] + size / 2; i++) {
    const major = i % 5 === 0
    svg += `<line y1="${toY(i * g)}" y2="${toY(i * g)}" x1="0" x2="${W}" stroke="#ff0" stroke-width="${major ? 0.8 : 0.3}" stroke-opacity="0.5"/>`
    if (major) svg += `<text x="2" y="${toY(i * g) - 2}" font-size="12" fill="#ff0">${(i * g).toFixed(2)}</text>`
  }
  svg += '</svg>'
  return sharp(img).composite([{ input: Buffer.from(svg) }]).png().toBuffer()
}

if (SHOTS) {
  for (const o of JSON.parse(fs.readFileSync(SHOTS, 'utf8'))) {
    let img = await shoot(o)
    if (o.grid) img = await withGrid(img, o)
    fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true })
    fs.writeFileSync(o.out, img)
  }
} else {
  // Arms a little away from the body, so the flanks and the armpits show.
  const STAND = { armL: { fk: { flex: 0, abd: 22, elbow: 14 } }, armR: { fk: { flex: 0, abd: 22, elbow: 14 } } }
  const pose = POSE === 'rest' ? { rest: true } : { frame: STAND }
  const AZ = { front: 0, back: 180, left: 90, right: -90, fl: 40, bl: 140 }
  const names = await page.evaluate(() => window.MUSCLE_NAMES)
  const ids = flag('--ids', '') ? flag('--ids', '').split(',') : names
  fs.mkdirSync(OUT, { recursive: true })
  const cells = []
  const LABEL = 22
  for (const [row, id] of ids.entries()) {
    for (const [col, v] of VIEWS.entries()) {
      const img = await shoot({ ...pose, muscles: id === 'none' ? [] : id.split('+'), az: AZ[v] ?? Number(v), el: 4, center: [0, 0.92, 0], size: 1.92, W: CW, H: CH })
      cells.push({ input: img, left: col * (CW + 4), top: row * (CH + LABEL + 4) + LABEL })
    }
    const label = `<svg width="${(CW + 4) * VIEWS.length - 4}" height="${LABEL}" xmlns="http://www.w3.org/2000/svg"><text x="6" y="16" font-size="15" font-family="sans-serif" fill="#fff">${id}</text></svg>`
    cells.push({ input: Buffer.from(label), left: 0, top: row * (CH + LABEL + 4) })
  }
  const sheet = sharp({ create: { width: VIEWS.length * (CW + 4) - 4, height: ids.length * (CH + LABEL + 4) - 4, channels: 3, background: '#333' } }).composite(cells)
  const file = path.join(OUT, `${flag('--name', POSE)}.png`)
  await sheet.png().toFile(file)
  console.log(file)
}
await browser.close()
server.close()
process.exit(0)
