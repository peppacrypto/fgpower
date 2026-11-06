#!/usr/bin/env node
// Renders exercise pose specs to images.
//
//   node render.mjs specs/pushups.json [more.json ...] [--out out] [--loop 16] [--quick]
//
// Writes <out>/<slug>/start.png, end.png, sheet.png, report.json, and with --loop loop.webp.
// report.json is the thing to read first: reach errors (non-zero means a hand or foot cannot get there) and the
// lowest point of the body (below about -0.01 means it sinks into the floor).
//
// Runs one Chromium at a time, under a lock, on software WebGL so the GPU is not involved.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const flag = (k, d) => {
  const i = args.indexOf(k)
  if (i < 0) return d
  const val = args[i + 1]
  args.splice(i, 2)
  return val
}
const outRoot = path.resolve(flag('--out', path.join(HERE, 'out')))
const loopN = Number(flag('--loop', 0))
const look = flag('--look', '')
const specs = args.filter((a) => !a.startsWith('--'))
if (!specs.length) {
  console.error('usage: node render.mjs spec.json ... [--out dir] [--loop 16]')
  process.exit(2)
}

// Re-exec under flock so parallel agents queue up instead of starting several browsers.
if (!process.env.ART_LOCKED) {
  const lock = path.join(HERE, 'build', '.render.lock')
  fs.mkdirSync(path.dirname(lock), { recursive: true })
  const r = spawnSync('flock', [lock, process.execPath, fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, ART_LOCKED: '1' },
  })
  process.exit(r.status ?? 1)
}

const require = createRequire(path.resolve(HERE, '..', '..', 'package.json'))
const { chromium } = require('playwright')
const sharp = require('sharp')

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' }
const server = http.createServer((req, res) => {
  const p = path.join(HERE, decodeURIComponent(req.url.split('?')[0]))
  if (!p.startsWith(HERE) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404)
    res.end()
    return
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' })
  fs.createReadStream(p).pipe(res)
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
})
const page = await browser.newPage({ viewport: { width: 1700, height: 1300 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
await page.goto(`http://127.0.0.1:${port}/render.html${look ? `?look=${look}` : ''}`)
await page.waitForFunction(() => window.ready || window.initError, null, { timeout: 120000 })
const initError = await page.evaluate(() => window.initError)
if (initError) {
  console.error('init failed:', initError, errors)
  await browser.close()
  server.close()
  process.exit(1)
}

const buf = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64')
const OUT_W = 800
const OUT_H = 600
let failed = 0

for (const file of specs) {
  const spec = JSON.parse(fs.readFileSync(file, 'utf8'))
  const slug = spec.slug || path.basename(file, '.json')
  const dir = path.join(outRoot, slug)
  fs.mkdirSync(dir, { recursive: true })
  let res
  try {
    res = await page.evaluate(([s, o]) => window.renderSpec(s, o), [spec, { loopFrames: loopN, fps: Number(spec.loopFps || 6) }])
  } catch (e) {
    failed++
    console.error(`${slug}: render failed: ${e.message}`)
    continue
  }
  const shots = []
  for (const [name, data] of Object.entries(res.images)) {
    const png = await sharp(buf(data)).resize(OUT_W, OUT_H, { kernel: 'lanczos3' }).png().toBuffer()
    fs.writeFileSync(path.join(dir, `${name}.png`), png)
    shots.push(png)
  }
  const sheet = sharp({ create: { width: OUT_W * shots.length + 10 * (shots.length - 1), height: OUT_H, channels: 3, background: '#888' } }).composite(shots.map((s, i) => ({ input: s, left: i * (OUT_W + 10), top: 0 })))
  await sheet.png().toFile(path.join(dir, 'sheet.png'))
  if (loopN && res.loop.length) {
    const frames = await Promise.all(res.loop.map((d) => sharp(buf(d)).resize(640, 480, { kernel: 'lanczos3' }).png().toBuffer()))
    fs.writeFileSync(path.join(dir, 'loopmid.png'), frames[Math.floor(frames.length / 4)])
    const framesDir = path.join(dir, '.frames')
    fs.mkdirSync(framesDir, { recursive: true })
    frames.forEach((f, i) => fs.writeFileSync(path.join(framesDir, `${String(i).padStart(3, '0')}.png`), f))
    const fps = Number(spec.loopFps || (spec.timing ? 6 : 9))
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(framesDir, '%03d.png'), '-c:v', 'libwebp_anim', '-lossless', '0', '-quality', '72', '-compression_level', '6', '-loop', '0', path.join(dir, 'loop.webp')])
    fs.rmSync(framesDir, { recursive: true, force: true })
  }
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(res.reports, null, 1))
  const issues = []
  for (const [fname, r] of Object.entries(res.reports)) {
    for (const [limb, miss] of Object.entries(r.reach)) if (miss > 0.005) issues.push(`${fname}.${limb} misses by ${miss} m`)
    if (r.lowestPoint < (/^(finger|toe)/.test(r.lowestPart) ? -0.03 : -0.012)) issues.push(`${fname} sinks ${r.lowestPoint} m into the floor (${r.lowestPart})`)
    if (r.lowestPoint > 0.03 && !spec.floats) issues.push(`${fname} floats ${r.lowestPoint} m above the floor`)
    for (const [k, t] of Object.entries(r.twist)) if (Math.abs(t) > 110) issues.push(`${fname}.${k} twisted ${t} deg, change the pole or the palm`)
  }
  const size = loopN && fs.existsSync(path.join(dir, 'loop.webp')) ? ` loop ${(fs.statSync(path.join(dir, 'loop.webp')).size / 1024).toFixed(0)} KB` : ''
  console.log(`${slug}: ${issues.length ? 'ISSUES: ' + issues.join('; ') : 'ok'}${size}`)
}

if (errors.length) console.error('page errors:', [...new Set(errors)].slice(0, 8))
await browser.close()
server.close()
process.exit(failed ? 1 : 0)
