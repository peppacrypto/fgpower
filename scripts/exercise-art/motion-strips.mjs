#!/usr/bin/env node
// A review sheet of the whole rep, one image per exercise: what a coach looks at, not only the start and the end.
//
//   node motion-strips.mjs <slug or specs/x.json> ... [--file list.txt] [--out out-strips] [--count 7]
//
// Top row: `count` moments evenly spread over the loop's time, 0 to 100 % (the loop goes start -> end -> start on the tempo of
// motion.js, so 50 % is about the end and the pauses show as repeated poses), from the spec's camera. Bottom row: a side view
// (from the figure's left, low) of the start and of the deepest moment (the one farthest from the start), then the facts: the
// catalog's movement pattern, which way the lift goes and the timeline, what prep.js changed, and check.mjs's errors and
// warnings (with the range-of-motion standards of MOTION.md). Writes <out>/<slug>.png.
import fs from 'node:fs'
import path from 'node:path'
import { runLocked, openRenderer, dataUrlBuffer, HERE } from './harness.mjs'

runLocked(import.meta.url)

const args = process.argv.slice(2)
const flag = (k, d) => {
  const i = args.indexOf(k)
  if (i < 0) return d
  const v = args[i + 1]
  args.splice(i, 2)
  return v
}
const out = path.resolve(flag('--out', path.join(HERE, 'out-strips')))
const count = Number(flag('--count', 7))
const listFile = flag('--file', '')
const slugs = [...args.filter((a) => !a.startsWith('--')), ...(listFile ? fs.readFileSync(listFile, 'utf8').split(/\s+/).filter(Boolean) : [])].map((a) => path.basename(a, '.json'))
if (!slugs.length) {
  console.error('usage: node motion-strips.mjs <slug> ... [--file list.txt] [--out dir] [--count 7]')
  process.exit(2)
}
fs.mkdirSync(out, { recursive: true })

const { catalogInfo } = await import('./catalog.mjs')
const { createChecker } = await import('./qa-lib.mjs')
const checker = await createChecker()
const { page, sharp, close } = await openRenderer()

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** A block of text as an image: lines of [text, colour, size]. */
const textImage = (w, h, lines) => {
  let y = 6
  const rows = lines.map(([t, c = '#ddd', size = 17]) => {
    y += size + 6
    return `<text x="10" y="${y}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${size}" fill="${c}">${esc(t)}</text>`
  })
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#1b1b1e"/>${rows.join('')}</svg>`)
}
const label = (w, text) => textImage(w, 30, [[text, '#ffb38a', 17]])

const TW = 360
const TH = 270
const SW = 480
const SH = 360
const GAP = 6
let failed = 0
for (const slug of slugs) {
  const file = path.join(HERE, 'specs', `${slug}.json`)
  if (!fs.existsSync(file)) {
    console.error(`${slug}: no spec`)
    failed++
    continue
  }
  const spec = JSON.parse(fs.readFileSync(file, 'utf8'))
  const info = catalogInfo(slug)
  let res
  try {
    res = await page.evaluate(([s, o]) => window.renderStrip(s, o), [spec, { count, info, fps: 20 }])
  } catch (e) {
    console.error(`${slug}: render failed: ${e.message}`)
    failed++
    continue
  }
  const check = checker.check(spec)
  const W = Math.max(count * (TW + GAP) - GAP, 2 * (SW + GAP) + 700)
  const H = 30 + TH + GAP + 30 + SH
  const parts = []
  for (const [i, s] of res.strip.entries()) {
    parts.push({ input: label(TW, s.label), left: i * (TW + GAP), top: 0 })
    parts.push({ input: await sharp(dataUrlBuffer(s.image)).resize(TW, TH, { kernel: 'lanczos3' }).png().toBuffer(), left: i * (TW + GAP), top: 30 })
  }
  const y2 = 30 + TH + GAP
  parts.push({ input: label(SW, 'side: start'), left: 0, top: y2 })
  parts.push({ input: await sharp(dataUrlBuffer(res.side.start)).resize(SW, SH, { kernel: 'lanczos3' }).png().toBuffer(), left: 0, top: y2 + 30 })
  parts.push({ input: label(SW, `side: deepest (t${res.side.deepT.toFixed(2)})`), left: SW + GAP, top: y2 })
  parts.push({ input: await sharp(dataUrlBuffer(res.side.deepest)).resize(SW, SH, { kernel: 'lanczos3' }).png().toBuffer(), left: SW + GAP, top: y2 + 30 })
  const tl = res.timeline
  const prep = res.prep || {}
  const issues = check.issues.filter((x) => !x.allowedBy)
  const lines = [
    [`${slug}`, '#fff', 22],
    [`${info.namePt || ''}${info.nameEn ? `  (${info.nameEn})` : ''}`, '#bbb', 16],
    [`pattern ${info.movementPattern || '-'} · ${info.category || '-'} · muscles ${(spec.muscles || []).join(', ')}`, '#ddd', 16],
    [`lift: ${tl.lift}${tl.inferred ? ' (inferred)' : ' (spec)'} · segments ${tl.dirs.join(' ')} · ${tl.seconds} s, ${tl.frames} frames`, '#9fd', 16],
    [`timeline: ${tl.parts.join(' | ')}`.slice(0, 120), '#9fd', 14],
    [`prep: ${prep.grips?.filter((g) => !g.undone).length || 0} grip snaps, ${prep.free?.length || 0} free grips, ${prep.rest?.length || 0} resting hands${prep.restSkipped?.length ? ` (${prep.restSkipped.length} not laid)` : ''}`, '#ccc', 14],
    [`check: ${check.errors} errors, ${check.warnings} warnings`, check.errors ? '#ff7b6b' : check.warnings ? '#ffd27b' : '#8f8', 18],
    ...issues.slice(0, 11).map((x) => [`${x.level} ${x.key}  ${x.msg}`.slice(0, 165), x.level === 'E' ? '#ff9b8b' : '#ffe0a0', 13]),
  ]
  parts.push({ input: textImage(W - 2 * (SW + GAP), SH + 30, lines), left: 2 * (SW + GAP), top: y2 })
  await sharp({ create: { width: W, height: H, channels: 3, background: '#0f0f10' } }).composite(parts).png().toFile(path.join(out, `${slug}.png`))
  console.log(`${slug}: ${path.join(out, `${slug}.png`)}  lift ${tl.lift}, ${tl.seconds} s, ${check.errors} E / ${check.warnings} W`)
}
await close()
process.exit(failed ? 1 : 0)
