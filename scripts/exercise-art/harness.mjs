// The browser side of a render, for tools other than render.mjs (motion-strips.mjs): a static server for this folder and one
// Chromium on software WebGL with render.html loaded. Like render.mjs, a tool should run under one of the render locks
// (runLocked below), so parallel agents queue up instead of each starting a browser.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

export const HERE = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.resolve(HERE, '..', '..', 'package.json'))

/** Re-runs the calling script under one of ART_RENDER_SLOTS flock locks (shared with render.mjs), unless already inside one. */
export function runLocked(scriptUrl) {
  if (process.env.ART_LOCKED) return
  const SLOTS = Number(process.env.ART_RENDER_SLOTS || 4)
  const CONFLICT = 75
  fs.mkdirSync(path.join(HERE, 'build'), { recursive: true })
  for (let turn = 0; ; turn++) {
    const lock = path.join(HERE, 'build', `.render.${turn % SLOTS}.lock`)
    const r = spawnSync('flock', ['-n', '-E', String(CONFLICT), lock, process.execPath, fileURLToPath(scriptUrl), ...process.argv.slice(2)], {
      stdio: 'inherit',
      env: { ...process.env, ART_LOCKED: '1' },
    })
    if (r.status !== CONFLICT) process.exit(r.status ?? 1)
    if (turn % SLOTS === SLOTS - 1) spawnSync('sleep', ['1'])
  }
}

/** Starts the server and the browser, loads render.html. Returns { page, sharp, close }. */
export async function openRenderer() {
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
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] })
  const page = await browser.newPage({ viewport: { width: 1700, height: 1300 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`http://127.0.0.1:${server.address().port}/render.html`)
  await page.waitForFunction(() => window.ready || window.initError, null, { timeout: 120000 })
  const initError = await page.evaluate(() => window.initError)
  if (initError) throw new Error(`render page failed: ${initError}`)
  return {
    page,
    sharp,
    errors,
    close: async () => {
      await browser.close()
      server.close()
    },
  }
}

export const dataUrlBuffer = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64')
