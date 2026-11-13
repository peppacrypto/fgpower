#!/usr/bin/env node
// Where the catalog stands: for each family in plan/families.json (or --families a,b), how many exercises have a spec, how many
// pass check.mjs with no error, and which ones do not (with their error count and the worst kinds).
//   node status.mjs [--families a,b] [--bad] [--out file.json] [--clean-out list.txt]
//   --bad lists only the failing slugs. The failing list goes to plan/bad.json, or to --out (a run from a branch or a worktree
//   should not overwrite the shared one). Warnings (rom:, balance) are counted per kind in the summary.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createChecker } from './qa-lib.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PLAN = path.join(process.env.HOME, 'Downloads', 'fgpower-gym-figures-2026-11-06', 'plan')
const fam = JSON.parse(fs.readFileSync(path.join(PLAN, 'families.json'), 'utf8'))
const argv = process.argv.slice(2)
const only = argv.includes('--families') ? new Set(argv[argv.indexOf('--families') + 1].split(',')) : null
const checker = await createChecker()
let n = 0, ok = 0, missing = 0
const bad = []
const cleanSlugs = []
const errorKinds = {}
const warnKinds = {}
for (const f of fam) {
  if (only && !only.has(f.id)) continue
  let fo = 0, fm = 0
  for (const slug of f.slugs) {
    const file = path.join(HERE, 'specs', `${slug}.json`)
    if (!fs.existsSync(file)) { fm++; missing++; continue }
    n++
    const r = checker.check(JSON.parse(fs.readFileSync(file, 'utf8')))
    for (const k of new Set(r.issues.filter((x) => x.level === 'E' && !x.allowedBy).map((x) => x.key.split(':')[0]))) errorKinds[k] = (errorKinds[k] || 0) + 1
    for (const k of new Set(r.issues.filter((x) => x.level === 'W' && !x.allowedBy).map((x) => x.key.split('.')[0]))) warnKinds[k] = (warnKinds[k] || 0) + 1
    if (!r.errors) { fo++; ok++; cleanSlugs.push(slug) } else {
      const kinds = {}
      for (const i of r.issues.filter((x) => x.level === 'E')) kinds[i.key.split(':')[0]] = (kinds[i.key.split(':')[0]] || 0) + 1
      bad.push({ family: f.id, slug, errors: r.errors, kinds })
    }
  }
  if (!argv.includes('--bad')) console.log(`${f.id.padEnd(40)} ${String(fo).padStart(2)}/${f.slugs.length} clean${fm ? `, ${fm} without spec` : ''}`)
}
console.log(`\n${ok} clean of ${n} with a spec (${missing} without a spec)`)
console.log(`specs with an error of each kind: ${JSON.stringify(errorKinds)}`)
console.log(`specs with a warning of each kind: ${JSON.stringify(warnKinds)}`)
if (argv.includes('--clean-out')) fs.writeFileSync(argv[argv.indexOf('--clean-out') + 1], cleanSlugs.join('\n') + '\n')
if (argv.includes('--bad')) for (const b of bad) console.log(`${b.slug} (${b.family}): ${b.errors} errors ${JSON.stringify(b.kinds)}`)
const outFile = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : argv.includes('--bad') ? null : path.join(PLAN, 'bad.json')
if (outFile) fs.writeFileSync(outFile, JSON.stringify(bad, null, 1))
