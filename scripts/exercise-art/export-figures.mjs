#!/usr/bin/env node
// Turns the finished renders into the app's files.
//
//   node export-figures.mjs <art.json> <public/exercises dir> <manifest.json>
//
// For each exercise in art.json with a spec, renders the frames and the loop, then writes
//   <public>/<slug>/fig-start.webp, fig-end.webp, fig-loop.webp
// and a manifest of {slug, media[]} in the seed's shape. The thumbnail (sortOrder 0) is the design's key frame.
// New file names on purpose: the app caches exercise images for a month, so an image never changes in place.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const [artFile, publicDir, manifestFile] = process.argv.slice(2)
if (!manifestFile) {
  console.error('usage: node export-figures.mjs <art.json> <public/exercises dir> <manifest.json>')
  process.exit(2)
}
const require = createRequire(path.resolve(HERE, '..', '..', 'package.json'))
const sharp = require('sharp')

const art = JSON.parse(fs.readFileSync(artFile, 'utf8'))
const missing = art.filter((a) => !fs.existsSync(path.join(HERE, 'specs', `${a.slug}.json`))).map((a) => a.slug)
if (missing.length) {
  console.error('no spec for:', missing.join(', '))
  process.exit(1)
}

const RENDER_DIR = path.join(HERE, 'out-final')
const BATCH = 10
const specPath = (a) => path.join(HERE, 'specs', `${a.slug}.json`)
const isHold = (a) => a.loop === 'hold' || !JSON.parse(fs.readFileSync(specPath(a), 'utf8')).frames.end
const moving = art.filter((a) => !isHold(a))
const holds = art.filter(isHold)
const run = (list, extra) => {
  for (let i = 0; i < list.length; i += BATCH) {
    const part = list.slice(i, i + BATCH).map(specPath)
    execFileSync('node', [path.join(HERE, 'render.mjs'), ...part, '--out', RENDER_DIR, ...extra], { stdio: 'inherit' })
  }
}
run(moving, ['--loop', '20'])
run(holds, [])

const manifest = []
let bytes = 0
for (const a of art) {
  const dir = path.join(publicDir, a.slug)
  fs.mkdirSync(dir, { recursive: true })
  const r = path.join(RENDER_DIR, a.slug)
  const urlOf = (name) => `/exercises/${a.slug}/${name}`
  const toWebp = async (src, dest) => {
    await sharp(path.join(r, src)).webp({ quality: 80, effort: 6 }).toFile(path.join(dir, dest))
    bytes += fs.statSync(path.join(dir, dest)).size
  }
  await toWebp('start.png', 'fig-start.webp')
  const media = []
  if (isHold(a)) {
    media.push({ kind: 'IMAGE_START', url: urlOf('fig-start.webp'), width: 800, height: 600, sortOrder: 0 })
    media.push({ kind: 'ILLUSTRATION', url: urlOf('fig-start.webp'), width: 800, height: 600, sortOrder: 1 })
  } else {
    await toWebp('end.png', 'fig-end.webp')
    fs.copyFileSync(path.join(r, 'loop.webp'), path.join(dir, 'fig-loop.webp'))
    bytes += fs.statSync(path.join(dir, 'fig-loop.webp')).size
    const endFirst = a.keyFrame === 'end'
    media.push({ kind: 'IMAGE_START', url: urlOf('fig-start.webp'), width: 800, height: 600, sortOrder: endFirst ? 1 : 0 })
    media.push({ kind: 'IMAGE_END', url: urlOf('fig-end.webp'), width: 800, height: 600, sortOrder: endFirst ? 0 : 1 })
    media.push({ kind: 'ILLUSTRATION', url: urlOf('fig-loop.webp'), width: 640, height: 480, sortOrder: 2 })
    media.sort((x, y) => x.sortOrder - y.sortOrder)
  }
  manifest.push({ slug: a.slug, media })
}
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 1))
console.log(`exported ${manifest.length} exercises (${moving.length} loops, ${holds.length} holds), ${(bytes / 1e6).toFixed(1)} MB`)
