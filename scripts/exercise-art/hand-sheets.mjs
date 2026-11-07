#!/usr/bin/env node
// Contact sheets of the HANDS, for the audit that the full-body sheets cannot do: for each exercise the left and right hand
// at the start and in the middle of the loop, 400x300 each, four exercises to a page.
//
//   node hand-sheets.mjs <slugs.txt> <dest dir> [--per 4]
//
// Renders with render.mjs --closeups-at 0.5 into out-hands/ (several browsers at once), then crops and composes.
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.resolve(HERE, '..', '..', 'package.json'))
const sharp = require('sharp')
const [listFile, dest] = process.argv.slice(2)
const per = process.argv.includes('--per') ? Number(process.argv[process.argv.indexOf('--per') + 1]) : 4
const slugs = fs.readFileSync(listFile, 'utf8').split(/\s+/).filter(Boolean)
const OUT = path.join(HERE, 'out-hands')
fs.mkdirSync(dest, { recursive: true })

const run = (list) =>
  new Promise((resolve) => {
    const p = spawn('node', [path.join(HERE, 'render.mjs'), ...list.map((s) => path.join(HERE, 'specs', `${s}.json`)), '--out', OUT, '--closeups-at', '0.5'], { stdio: 'ignore' })
    p.on('close', resolve)
  })
const batches = []
for (let i = 0; i < slugs.length; i += 8) batches.push(slugs.slice(i, i + 8))
let next = 0
await Promise.all(Array.from({ length: 4 }, async () => { while (next < batches.length) await run(batches[next++]) }))

const CW = 400, CH = 300, G = 4
const cells = []
for (const slug of slugs) {
  const f = path.join(OUT, slug, 'closeups.png')
  if (!fs.existsSync(f)) continue
  const meta = await sharp(f).metadata()
  const rows = Math.round((meta.height + G) / (CH + G))
  const crop = (col, row) => sharp(f).extract({ left: col * (CW + G), top: row * (CH + G), width: CW, height: CH }).png().toBuffer()
  const parts = [[0, 0], [1, 0], [0, rows - 1], [1, rows - 1]]
  const composite = []
  for (const [i, [col, row]] of parts.entries()) composite.push({ input: await crop(col, row), left: (i % 2) * (CW + G), top: Math.floor(i / 2) * (CH + G) })
  const label = Buffer.from(`<svg width="${2 * CW + G}" height="18"><rect width="100%" height="100%" fill="#fff"/><text x="4" y="13" font-size="13" font-family="sans-serif">${slug}   (top: start, bottom: mid-loop; left hand, right hand)</text></svg>`)
  const cell = await sharp({ create: { width: 2 * CW + G, height: 2 * CH + G + 18, channels: 3, background: '#555' } }).composite([{ input: label, left: 0, top: 0 }, ...composite.map((c) => ({ ...c, top: c.top + 18 }))]).png().toBuffer()
  cells.push(cell)
}
const CELL_W = 2 * CW + G, CELL_H = 2 * CH + G + 18
let page = 0
for (let i = 0; i < cells.length; i += per) {
  const chunk = cells.slice(i, i + per)
  const cols = 2, rowsN = Math.ceil(chunk.length / cols)
  await sharp({ create: { width: cols * (CELL_W + G), height: rowsN * (CELL_H + G), channels: 3, background: '#fff' } })
    .composite(chunk.map((c, k) => ({ input: c, left: (k % cols) * (CELL_W + G), top: Math.floor(k / cols) * (CELL_H + G) })))
    .png().toFile(path.join(dest, `hands-${String(++page).padStart(3, '0')}.png`))
}
console.log(`${cells.length} exercises, ${page} pages in ${dest}`)
