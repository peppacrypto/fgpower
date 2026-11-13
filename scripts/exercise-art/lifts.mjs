#!/usr/bin/env node
// Which way each spec's lift goes, and its loop's tempo: what motion.js infers (or the spec's tempo field says), for review.
//
//   node lifts.mjs [specs/x.json ...] [--tsv]     no file: every spec. --tsv: one tab-separated line per spec.
//
// lift: there (start -> end is the lift, the concentric), back (end -> start is), even (no lift: stretches, mobility, holds), mixed
// (the segments disagree: each one gets its own speed). (spec) marks a tempo.lift written in the spec, (inferred) one read from
// the lit muscles' lengths at the key frames: the frame where they are shortest is the top of the lift.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
await import('./qa-lib.mjs') // the document shim the props need in Node
const { Body } = await import('./rig.js')
const { prepareSpec } = await import('./prep.js')
const { segmentsOf, tempoFor, timelineOf } = await import('./motion.js')
const { catalogInfo } = await import('./catalog.mjs')

const argv = process.argv.slice(2)
const tsv = argv.includes('--tsv')
let files = argv.filter((a) => !a.startsWith('--'))
if (!files.length) files = fs.readdirSync(path.join(HERE, 'specs')).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(HERE, 'specs', f))
const body = new Body(JSON.parse(fs.readFileSync(path.join(HERE, 'build', 'body-real.json'), 'utf8')))
const tally = {}
for (const file of files) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
  const slug = raw.slug || path.basename(file, '.json')
  const spec = prepareSpec(body, raw, { magnet: false, rest: false, freeGrip: false })
  const fr = spec.frames
  if (!fr.end && !fr.mid) {
    tally.hold = (tally.hold || 0) + 1
    if (tsv) console.log([slug, catalogInfo(slug).movementPattern || '-', 'hold', '-', '-', '-'].join('\t'))
    continue
  }
  const info = catalogInfo(slug)
  const names = ['start', ...['mid', 'mid2', 'mid3', 'mid4', 'mid5'].filter((k) => fr[k]), 'end']
  const frames = names.map((n) => fr[n] || fr.start)
  const reports = frames.map((f) => body.solve(f).report)
  const segs = segmentsOf(spec, info, reports, frames)
  const tl = timelineOf(segs, tempoFor(spec, info), 20, spec.timing || null)
  tally[segs.lift] = (tally[segs.lift] || 0) + 1
  const line = [slug, info.movementPattern || '-', `${segs.lift} (${segs.inferred ? 'inferred' : 'spec'})`, segs.dirs.join(' '), `${tl.seconds}s`, `${tl.frames} frames`]
  console.log(tsv ? line.join('\t') : `${line[0].padEnd(52)} ${line[1].padEnd(19)} ${line[2].padEnd(17)} ${line[3].padEnd(16)} ${line[4]} ${line[5]}`)
}
if (!tsv) console.log(`\n${JSON.stringify(tally)}`)
