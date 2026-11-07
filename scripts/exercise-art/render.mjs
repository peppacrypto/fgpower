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
const finalMode = args.includes('--final')
if (finalMode) args.splice(args.indexOf('--final'), 1)
const FINAL_FPS = 20
const loopN = finalMode ? 48 : Number(flag('--loop', 0))
flag('--look', '') // older calls pass --look studio; it is the only look now
const wantCloseups = args.includes('--closeups')
if (wantCloseups) args.splice(args.indexOf('--closeups'), 1)
const specs = args.filter((a) => !a.startsWith('--'))
if (!specs.length) {
  console.error('usage: node render.mjs spec.json ... [--out dir] [--loop 16]')
  process.exit(2)
}

// Re-exec under one of a few locks, so parallel agents queue up instead of starting a browser each.
if (!process.env.ART_LOCKED) {
  const SLOTS = Number(process.env.ART_RENDER_SLOTS || 4)
  const CONFLICT = 75
  fs.mkdirSync(path.join(HERE, 'build'), { recursive: true })
  for (let turn = 0; ; turn++) {
    const lock = path.join(HERE, 'build', `.render.${turn % SLOTS}.lock`)
    const r = spawnSync('flock', ['-n', '-E', String(CONFLICT), lock, process.execPath, fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
      stdio: 'inherit',
      env: { ...process.env, ART_LOCKED: '1' },
    })
    if (r.status !== CONFLICT) process.exit(r.status ?? 1)
    if (turn % SLOTS === SLOTS - 1) spawnSync('sleep', ['1'])
  }
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
await page.goto(`http://127.0.0.1:${port}/render.html`)
await page.waitForFunction(() => window.ready || window.initError, null, { timeout: 120000 })
const initError = await page.evaluate(() => window.initError)
if (initError) {
  console.error('init failed:', initError, errors)
  await browser.close()
  server.close()
  process.exit(1)
}

const moduleErrors = await page.evaluate(() => (window.propErrors || []).filter((e) => !/not loaded/.test(e)))
if (moduleErrors.length) console.error('prop module errors:', moduleErrors)

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
    res = await page.evaluate(([s, o]) => window.renderSpec(s, o), [spec, { loopFrames: loopN, fps: finalMode ? FINAL_FPS : Number(spec.loopFps || 6), closeups: wantCloseups }])
  } catch (e) {
    failed++
    console.error(`${slug}: render failed: ${e.message}`)
    continue
  }
  if (finalMode) {
    // What the app ships: a still per end of the movement and a muted looping video. A hold has one still and no video.
    for (const name of ['start', 'end']) {
      if (res.images[name]) await sharp(buf(res.images[name])).resize(OUT_W, OUT_H, { kernel: 'lanczos3' }).webp({ quality: 78, effort: 6 }).toFile(path.join(dir, `${name}.webp`))
    }
    if (spec.frames.end && res.loop.length) {
      const framesDir = path.join(dir, '.frames')
      fs.mkdirSync(framesDir, { recursive: true })
      await Promise.all(res.loop.map(async (d, i) => sharp(buf(d)).resize(OUT_W, OUT_H, { kernel: 'lanczos3' }).png({ compressionLevel: 1 }).toFile(path.join(framesDir, `${String(i).padStart(3, '0')}.png`))))
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FINAL_FPS), '-i', path.join(framesDir, '%03d.png'), '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '27', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', path.join(dir, 'loop.mp4')])
      fs.rmSync(framesDir, { recursive: true, force: true })
    }
    fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(res.reports, null, 1))
    const kb = (n) => (fs.existsSync(path.join(dir, n)) ? (fs.statSync(path.join(dir, n)).size / 1024).toFixed(0) : '-')
    console.log(`${slug}: final start ${kb('start.webp')} KB, end ${kb('end.webp')} KB, loop ${kb('loop.mp4')} KB`)
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
  if (wantCloseups && Object.keys(res.closeups).length) {
    // One row per frame: left hand, right hand, left foot, right foot, head.
    const entries = Object.entries(res.closeups)
    const frameNames = [...new Set(entries.map(([k]) => k.split('-')[0]))]
    const spots = ['handL', 'handR', 'footL', 'footR', 'head']
    const CW = 400
    const CH = 300
    const parts = []
    for (const [row, f] of frameNames.entries()) {
      for (const [col, spot] of spots.entries()) {
        const data = res.closeups[`${f}-${spot}`]
        if (!data) continue
        parts.push({ input: await sharp(buf(data)).resize(CW, CH, { kernel: 'lanczos3' }).png().toBuffer(), left: col * (CW + 4), top: row * (CH + 4) })
      }
    }
    await sharp({ create: { width: spots.length * (CW + 4) - 4, height: frameNames.length * (CH + 4) - 4, channels: 3, background: '#555' } }).composite(parts).png().toFile(path.join(dir, 'closeups.png'))
  }
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
