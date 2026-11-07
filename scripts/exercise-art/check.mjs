#!/usr/bin/env node
// Solves pose specs without a browser and reports what is wrong: unreachable targets, joint limits, the body through props
// or through itself, a loop that does not move (see qa-lib.mjs). Prints "ok" or the issues; exit code 1 on errors.
//
//   node check.mjs specs/x.json [more.json ...]
//   node check.mjs              prints the figure's landmarks
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Body } from './rig.js'
import { createChecker, formatResult } from './qa-lib.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const files = process.argv.slice(2).filter((a) => !a.startsWith('--'))
if (!files.length) {
  const body = new Body(JSON.parse(fs.readFileSync(path.join(HERE, 'build', 'body-real.json'), 'utf8')))
  const fmt = (x) => [x.x, x.y, x.z].map((n) => n.toFixed(2)).join(',')
  const s = body.side.L
  console.log("Landmarks on the figure's left side, in the rest pose (metres):")
  for (const [k, x] of Object.entries({ shoulder: s.S, elbow: s.E, wrist: s.W, hip: s.H, knee: s.K, ankle: s.A, heel: s.heel, ball: s.ball, sole: s.sole, palm: s.palmCentre })) console.log(`  ${k.padEnd(9)} ${fmt(x)}`)
  console.log(`  upper arm ${s.a.toFixed(3)}  forearm ${s.b.toFixed(3)}  thigh ${s.c.toFixed(3)}  shin ${s.d.toFixed(3)}`)
  console.log(`  pelvis centre ${fmt(body.pelvisCentre)}  spine01 ${fmt(body.by.spine01.head)}  head joint ${fmt(body.by.head.head)}`)
  process.exit(0)
}
const checker = await createChecker()
let bad = 0
for (const file of files) {
  const result = checker.check(JSON.parse(fs.readFileSync(file, 'utf8')))
  console.log(formatResult(result))
  if (result.errors) bad++
}
process.exit(bad ? 1 : 0)
