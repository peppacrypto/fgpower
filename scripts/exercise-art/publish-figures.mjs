#!/usr/bin/env node
// Renders the final pictures of exercises and puts them in the app: public/exercises/<slug>/f3-start.webp, f3-end.webp and
// f3-loop.mp4 (a new prefix for every engine generation: the files are served as immutable for a year, see next.config.ts,
// so a changed picture must get a new name), removes the exercise's old photos and earlier figures, and
// rewrites its media list in prisma/seed-data/exercises.generated.json. Never run build-exercise-catalog.mjs afterwards: it
// would bring the old photos back.
//
//   node publish-figures.mjs --slugs a,b,c | --file slugs.txt | --families id1,id2   [--render-only] [--no-render] [--dry]
//   --render-only renders to out-final/ and stops (to look at the result first); --no-render publishes what is already there.
//
// A spec without an "end" frame is a hold: one still, shown also as the demo. spec.keyFrame:"end" makes the end frame the
// thumbnail (the first media row).
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const PUBLIC = path.join(ROOT, 'public', 'exercises')
const SEED = path.join(ROOT, 'prisma', 'seed-data', 'exercises.generated.json')
const PLAN = path.join(process.env.HOME, 'Downloads', 'fgpower-gym-figures-2026-11-06', 'plan')
const argv = process.argv.slice(2)
const opt = (k) => {
  const i = argv.indexOf(k)
  return i < 0 ? null : argv[i + 1]
}
const NO_RENDER = argv.includes('--no-render')
const DRY = argv.includes('--dry')
const RENDER_ONLY = argv.includes('--render-only')
/** File-name prefix of this engine generation; bump it whenever published pictures change (they are cached as immutable). */
const PREFIX = 'f3'

let slugs = []
if (opt('--slugs')) slugs = opt('--slugs').split(',')
if (opt('--file')) slugs = fs.readFileSync(opt('--file'), 'utf8').split(/\s+/).filter(Boolean)
if (opt('--families')) {
  const fam = JSON.parse(fs.readFileSync(path.join(PLAN, 'families.json'), 'utf8'))
  for (const id of opt('--families').split(',')) slugs.push(...(fam.find((f) => f.id === id)?.slugs ?? []))
}
slugs = [...new Set(slugs)]
const missing = slugs.filter((s) => !fs.existsSync(path.join(HERE, 'specs', `${s}.json`)))
if (!slugs.length || missing.length) {
  console.error(missing.length ? `no spec for: ${missing.join(' ')}` : 'no slugs given')
  process.exit(2)
}

const OUT = path.join(HERE, 'out-final')
const run = (list) =>
  new Promise((resolve) => {
    const p = spawn('node', [path.join(HERE, 'render.mjs'), ...list.map((s) => path.join(HERE, 'specs', `${s}.json`)), '--out', OUT, '--final'], { stdio: ['ignore', 'pipe', 'inherit'] })
    let out = ''
    p.stdout.on('data', (d) => (out += d))
    p.on('close', (code) => resolve({ code, out }))
  })

if (!NO_RENDER) {
  const BATCH = 8
  const batches = []
  for (let i = 0; i < slugs.length; i += BATCH) batches.push(slugs.slice(i, i + BATCH))
  let next = 0
  const failed = []
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < batches.length) {
        const b = batches[next++]
        const { code, out } = await run(b)
        if (code) failed.push(...b)
        process.stdout.write(out.split('\n').filter((l) => /^[^ ].*: final/.test(l)).length + ' ')
      }
    }),
  )
  console.log()
  if (failed.length) {
    console.error('render failed for', failed.join(' '))
    process.exit(1)
  }
}

if (RENDER_ONLY) {
  console.log(`${slugs.length} exercises rendered to ${OUT}`)
  process.exit(0)
}

const catalog = JSON.parse(fs.readFileSync(SEED, 'utf8'))
const by = new Map(catalog.map((e) => [e.slug, e]))
let bytes = 0
let removed = 0
for (const slug of slugs) {
  const ex = by.get(slug)
  if (!ex) {
    console.error('not in the catalog:', slug)
    continue
  }
  const spec = JSON.parse(fs.readFileSync(path.join(HERE, 'specs', `${slug}.json`), 'utf8'))
  const hold = !spec.frames.end
  const r = path.join(OUT, slug)
  const dir = path.join(PUBLIC, slug)
  const files = hold ? ['start.webp'] : ['start.webp', 'end.webp', 'loop.mp4']
  for (const f of files) {
    if (!fs.existsSync(path.join(r, f))) throw new Error(`${slug}: ${f} was not rendered`)
  }
  if (DRY) continue
  fs.mkdirSync(dir, { recursive: true })
  for (const f of fs.readdirSync(dir)) {
    if (/^(\d+\.webp|fig-.*|f\d+-.*)$/.test(f)) {
      fs.rmSync(path.join(dir, f))
      removed++
    }
  }
  for (const f of files) {
    fs.copyFileSync(path.join(r, f), path.join(dir, `${PREFIX}-${f}`))
    bytes += fs.statSync(path.join(dir, `${PREFIX}-${f}`)).size
  }
  const u = (f) => `/exercises/${slug}/${PREFIX}-${f}`
  const endFirst = spec.keyFrame === 'end'
  ex.media = hold
    ? [
        { kind: 'IMAGE_START', url: u('start.webp'), width: 800, height: 600, sortOrder: 0 },
        { kind: 'ILLUSTRATION', url: u('start.webp'), width: 800, height: 600, sortOrder: 1 },
      ]
    : [
        { kind: 'IMAGE_START', url: u('start.webp'), width: 800, height: 600, sortOrder: endFirst ? 1 : 0 },
        { kind: 'IMAGE_END', url: u('end.webp'), width: 800, height: 600, sortOrder: endFirst ? 0 : 1 },
        { kind: 'ILLUSTRATION', url: u('loop.mp4'), width: 800, height: 600, sortOrder: 2 },
      ].sort((a, b) => a.sortOrder - b.sortOrder)
}
if (!DRY) fs.writeFileSync(SEED, JSON.stringify(catalog, null, 1) + '\n')
console.log(`${slugs.length} exercises, ${(bytes / 1e6).toFixed(1)} MB written, ${removed} old files removed${DRY ? ' (dry run: nothing written)' : ''}`)
