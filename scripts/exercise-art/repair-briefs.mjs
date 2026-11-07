#!/usr/bin/env node
// For every family with failing specs, writes plan/repair/<family>.txt: the exact check.mjs output of each failing exercise,
// so a repair agent works from the errors instead of rediscovering them.
//   node repair-briefs.mjs [--families a,b]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createChecker, formatResult } from './qa-lib.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PLAN = path.join(process.env.HOME, 'Downloads', 'fgpower-gym-figures-2026-11-06', 'plan')
const fam = JSON.parse(fs.readFileSync(path.join(PLAN, 'families.json'), 'utf8'))
const argv = process.argv.slice(2)
const only = argv.includes('--families') ? new Set(argv[argv.indexOf('--families') + 1].split(',')) : null
fs.mkdirSync(path.join(PLAN, 'repair'), { recursive: true })
const checker = await createChecker()
const failing = []
for (const f of fam) {
  if (only && !only.has(f.id)) continue
  let text = ''
  let bad = 0
  for (const slug of f.slugs) {
    const file = path.join(HERE, 'specs', `${slug}.json`)
    if (!fs.existsSync(file)) continue
    const r = checker.check(JSON.parse(fs.readFileSync(file, 'utf8')))
    if (!r.errors) continue
    bad++
    text += formatResult(r).split('\n').slice(0, 14).join('\n') + '\n\n'
  }
  const out = path.join(PLAN, 'repair', `${f.id}.txt`)
  if (bad) {
    fs.writeFileSync(out, `FAMILY ${f.id}: ${bad} of ${f.slugs.length} exercises have errors\n\n${text}`)
    failing.push(f.id)
  } else if (fs.existsSync(out)) fs.rmSync(out)
}
console.log(JSON.stringify(failing))
