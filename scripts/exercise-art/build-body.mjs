#!/usr/bin/env node
// Builds art/build/body.json from the CC0 MakeHuman-derived data in art/assets:
// applies the shape targets, computes joint positions from the morphed mesh,
// keeps the visible surface only, and reduces the skin weights.
//
// Usage: node build-body.mjs [--muscle 0.6] [--ideal 0.5]
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const A = path.join(HERE, 'assets')
const arg = (k, d) => {
  const i = process.argv.indexOf(k)
  return i > 0 ? Number(process.argv[i + 1]) : d
}
const MUSCLE = arg('--muscle', 0.75)
const MALE = arg('--male', 1)
const REAL_HEAD = process.argv.includes('--real-head') // keep the original head: for the shaded, no-outline look
const OUTFILE = REAL_HEAD ? 'body-real.json' : 'body.json'
const IDEAL = arg('--ideal', 0.5)
const SCALE = 0.1 // OBJ units are decimetres; everything downstream is metres

// ---- OBJ ----------------------------------------------------------------
const verts = []
const faces = [] // {v:[...], g}
const groupVerts = new Map()
let group = null
for (const line of fs.readFileSync(path.join(A, 'base.obj'), 'utf8').split('\n')) {
  if (line.startsWith('v ')) {
    const p = line.trim().split(/\s+/)
    verts.push([+p[1], +p[2], +p[3]])
  } else if (line.startsWith('g ')) {
    group = line.slice(2).trim()
    if (!groupVerts.has(group)) groupVerts.set(group, new Set())
  } else if (line.startsWith('f ')) {
    const idx = line.trim().split(/\s+/).slice(1).map((t) => parseInt(t.split('/')[0], 10) - 1)
    faces.push({ v: idx, g: group })
    for (const i of idx) groupVerts.get(group).add(i)
  }
}

// ---- shape targets ------------------------------------------------------
function applyTarget(file, w) {
  if (!w) return 0
  const raw = zlib.gunzipSync(fs.readFileSync(path.join(A, 'targets', file))).toString('utf8')
  let n = 0
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const p = line.trim().split(/\s+/)
    if (p.length < 4) continue
    const v = verts[+p[0]]
    if (!v) continue
    v[0] += w * +p[1]
    v[1] += w * +p[2]
    v[2] += w * +p[3]
    n++
  }
  return n
}
const applied = {
  // MakeHuman builds a male from a race/gender base; the three are mixed so no one ethnic face or build is implied.
  male: ['caucasian', 'african', 'asian'].map((r) => applyTarget(`${r}-male-young.target.gz`, MALE / 3)),
  muscle: applyTarget('universal-male-young-maxmuscle-averageweight.target.gz', MUSCLE),
  ideal: applyTarget('male-young-maxmuscle-averageweight-idealproportions.target.gz', IDEAL * MUSCLE),
  idealBase: applyTarget('male-young-averagemuscle-averageweight-idealproportions.target.gz', IDEAL * (1 - MUSCLE)),
}

// ---- joints -------------------------------------------------------------
const mean = (ids) => {
  const c = [0, 0, 0]
  let n = 0
  for (const i of ids) {
    c[0] += verts[i][0]
    c[1] += verts[i][1]
    c[2] += verts[i][2]
    n++
  }
  return c.map((x) => x / n)
}
function jointPos(spec) {
  if (spec.strategy === 'CUBE') return mean(groupVerts.get(spec.cube_name))
  if (spec.strategy === 'VERTEX') return verts[spec.vertex_index].slice()
  if (spec.strategy === 'MEAN') return mean(spec.vertex_indices)
  throw new Error('strategy ' + spec.strategy)
}
const rig = JSON.parse(fs.readFileSync(path.join(A, 'rig.default.json'), 'utf8'))
const rawBones = {}
for (const [name, b] of Object.entries(rig)) {
  rawBones[name] = { name, parent: b.parent || null, head: jointPos(b.head), tail: jointPos(b.tail) }
}

// Bones we never pose collapse into the nearest bone we do.
function canonical(name) {
  if (/^(jaw|tongue|oris|levator|special|temporalis|oculi|orbicularis|risorius|eye)/.test(name)) return 'head'
  if (/^breast/.test(name)) return 'spine02'
  let m = name.match(/^toe(\d)-(\d)\.(L|R)$/)
  if (m) return `toe${m[1]}-1.${m[3]}`
  return name
}

// ---- mannequin head -----------------------------------------------------
// A face drawn with outlines looks uncanny at small sizes, and the mouth and eye cavities give stray lines. So the
// original head surface is removed and replaced by a clean closed egg, rigid on the head bone, like an artist's
// mannequin. The open neck stump ends inside it.
const droppedFaces = new Set()
const eggVerts = new Set()
if (!REAL_HEAD) {
  const n3 = rawBones.neck03.head
  const neckFront = n3[2] + 0.52 // decimetres
  const top = Math.max(...faces.filter((f) => f.g === 'body').flatMap((f) => f.v.map((i) => verts[i][1])))
  faces.forEach((f, idx) => {
    if (f.g !== 'body') return
    const allAbove = f.v.every((i) => verts[i][1] > n3[1] - 0.15)
    const jaw = f.v.every((i) => verts[i][1] > n3[1] - 0.75 && verts[i][2] > neckFront)
    if (allAbove || jaw) droppedFaces.add(idx)
  })
  const R = [0.72, 1.06, 0.89]
  const C = [0, top - R[1] - 0.14, rawBones.head.head[2] + 0.1]
  const tilt = (7 * Math.PI) / 180
  const ct = Math.cos(tilt)
  const st = Math.sin(tilt)
  const NU = 56
  const NV = 36
  const start = verts.length
  for (let j = 0; j <= NV; j++) {
    const th = (j / NV) * Math.PI
    for (let i = 0; i < NU; i++) {
      const ph = (i / NU) * 2 * Math.PI
      let x = R[0] * Math.sin(th) * Math.cos(ph)
      const y = R[1] * Math.cos(th)
      let z = R[2] * Math.sin(th) * Math.sin(ph)
      if (y < 0) {
        const u = y / R[1]
        const k = 1 - 0.3 * u * u
        x *= k
        z *= k
      }
      verts.push([C[0] + x, C[1] + ct * y - st * z, C[2] + st * y + ct * z])
      eggVerts.add(verts.length - 1)
    }
  }
  for (let j = 0; j < NV; j++) {
    for (let i = 0; i < NU; i++) {
      const a = start + j * NU + i
      const b = start + j * NU + ((i + 1) % NU)
      const c = start + (j + 1) * NU + ((i + 1) % NU)
      const d = start + (j + 1) * NU + i
      faces.push({ v: [a, b, c, d], g: 'body' })
    }
  }
  // A plug inside the neck stump, so a gap around the cut shows skin instead of the dark inside of the outline.
  const NP = 24
  const plugStart = verts.length
  const PC = [0, n3[1] - 0.3, n3[2] + 0.1]
  const PR = [0.52, 0.9, 0.62]
  for (let j = 0; j <= NP; j++) {
    const th = (j / NP) * Math.PI
    for (let i = 0; i < NP; i++) {
      const ph = (i / NP) * 2 * Math.PI
      verts.push([PC[0] + PR[0] * Math.sin(th) * Math.cos(ph), PC[1] + PR[1] * Math.cos(th), PC[2] + PR[2] * Math.sin(th) * Math.sin(ph)])
      eggVerts.add(verts.length - 1)
    }
  }
  for (let j = 0; j < NP; j++) {
    for (let i = 0; i < NP; i++) {
      const a = plugStart + j * NP + i
      const b = plugStart + j * NP + ((i + 1) % NP)
      const c = plugStart + (j + 1) * NP + ((i + 1) % NP)
      const d = plugStart + (j + 1) * NP + i
      faces.push({ v: [a, b, c, d], g: 'body' })
    }
  }
}

// ---- visible surface ----------------------------------------------------
const KEEP = new Set(REAL_HEAD ? ['body', 'helper-l-eye', 'helper-r-eye'] : ['body'])
const remap = new Map()
const positions = []
const orig = []
const addV = (i) => {
  if (!remap.has(i)) {
    remap.set(i, orig.length)
    orig.push(i)
    positions.push(verts[i][0], verts[i][1], verts[i][2])
  }
  return remap.get(i)
}
const tris = []
faces.forEach((f, idx) => {
  if (!KEEP.has(f.g) || droppedFaces.has(idx)) return
  const a = f.v.map(addV)
  if (a.length === 3) tris.push(a[0], a[1], a[2])
  else if (a.length === 4) tris.push(a[0], a[1], a[2], a[0], a[2], a[3])
})
console.log('head faces replaced', droppedFaces.size)

// ---- weights ------------------------------------------------------------
const wjson = JSON.parse(fs.readFileSync(path.join(A, 'weights.default.json'), 'utf8')).weights
const perVertex = new Map()
for (const [bone, list] of Object.entries(wjson)) {
  const c = canonical(bone)
  for (const [vi, w] of list) {
    if (!remap.has(vi)) continue
    const k = remap.get(vi)
    if (!perVertex.has(k)) perVertex.set(k, new Map())
    const m = perVertex.get(k)
    m.set(c, (m.get(c) || 0) + w)
  }
}
for (const i of eggVerts) {
  perVertex.set(remap.get(i), new Map([['head', 1]]))
}
const usedBones = new Set(['root'])
const MAX_INFLUENCES = 4
const vertexInfluences = new Array(orig.length)
let unweighted = 0
for (let k = 0; k < orig.length; k++) {
  const m = perVertex.get(k)
  if (!m) {
    unweighted++
    vertexInfluences[k] = [['root', 1]]
    continue
  }
  const arr = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_INFLUENCES)
  const s = arr.reduce((t, e) => t + e[1], 0)
  vertexInfluences[k] = arr.map(([b, w]) => [b, w / s])
  for (const [b] of arr) usedBones.add(b)
}

// Bones in topological order, keeping ancestors of used ones.
const keep = new Set()
for (const name of Object.keys(rawBones)) {
  if (canonical(name) !== name) continue
  keep.add(name)
}
const order = []
const seen = new Set()
function visit(n) {
  if (seen.has(n) || !keep.has(n)) return
  seen.add(n)
  const p = rawBones[n].parent
  if (p) visit(p)
  order.push(n)
}
for (const n of keep) visit(n)
const boneIndex = Object.fromEntries(order.map((n, i) => [n, i]))
const bones = order.map((n) => ({
  name: n,
  parent: rawBones[n].parent ? boneIndex[rawBones[n].parent] : -1,
  head: rawBones[n].head.map((x) => x * SCALE),
  tail: rawBones[n].tail.map((x) => x * SCALE),
}))

// Move feet to y = 0 and scale everything to metres.
let minY = Infinity
for (let i = 1; i < positions.length; i += 3) minY = Math.min(minY, positions[i])
const liftM = -minY * SCALE
const P = new Float32Array(positions.length)
for (let i = 0; i < positions.length; i += 3) {
  P[i] = positions[i] * SCALE
  P[i + 1] = positions[i + 1] * SCALE + liftM
  P[i + 2] = positions[i + 2] * SCALE
}
for (const b of bones) {
  b.head[1] += liftM
  b.tail[1] += liftM
}

// Influences as flat arrays.
const skinB = new Int16Array(orig.length * MAX_INFLUENCES).fill(-1)
const skinW = new Float32Array(orig.length * MAX_INFLUENCES)
vertexInfluences.forEach((list, k) => {
  list.forEach(([b, w], j) => {
    skinB[k * MAX_INFLUENCES + j] = boneIndex[b]
    skinW[k * MAX_INFLUENCES + j] = w
  })
})

const out = {
  maxInfluences: MAX_INFLUENCES,
  positions: Array.from(P, (x) => +x.toFixed(5)),
  index: tris,
  skinB: Array.from(skinB),
  skinW: Array.from(skinW, (x) => +x.toFixed(4)),
  bones,
  source: 'MakeHuman base mesh hm08, rig and weights via the CC0 mpfb2 data; see assets/LICENSE.md',
}
fs.mkdirSync(path.join(HERE, 'build'), { recursive: true })
fs.writeFileSync(path.join(HERE, 'build', OUTFILE), JSON.stringify(out))

// ---- diagnostics --------------------------------------------------------
const B = Object.fromEntries(bones.map((b) => [b.name, b]))
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const len = (a) => Math.hypot(...a)
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const fmt = (a) => a.map((x) => x.toFixed(3)).join(', ')
console.log('targets applied (verts):', applied)
console.log('verts', orig.length, 'tris', tris.length / 3, 'bones', bones.length, 'unweighted', unweighted)
let maxY = -Infinity
for (let i = 1; i < P.length; i += 3) maxY = Math.max(maxY, P[i])
console.log('height (m)', maxY.toFixed(3))
for (const s of ['L', 'R']) {
  const S = B[`upperarm01.${s}`].head
  const E = B[`lowerarm01.${s}`].head
  const W = B[`wrist.${s}`].head
  const H = B[`upperleg01.${s}`].head
  const K = B[`lowerleg01.${s}`].head
  const A2 = B[`foot.${s}`].head
  const up = sub(E, S)
  const lo = sub(W, E)
  const th = sub(K, H)
  const sh = sub(A2, K)
  console.log(s, 'shoulder', fmt(S), 'elbow', fmt(E), 'wrist', fmt(W), 'lens', len(up).toFixed(3), len(lo).toFixed(3))
  const ang = (a, b) => (Math.acos((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (len(a) * len(b))) * 180) / Math.PI
  console.log('  arm hinge (u x l)', fmt(cross(up, lo)), 'bend', ang(up, lo).toFixed(1))
  console.log(s, 'hip', fmt(H), 'knee', fmt(K), 'ankle', fmt(A2), 'lens', len(th).toFixed(3), len(sh).toFixed(3))
  console.log('  leg hinge (t x s)', fmt(cross(th, sh)), 'bend', ang(th, sh).toFixed(1))
}
console.log('root', fmt(B.root.head), 'spine05', fmt(B.spine05.head), 'spine01', fmt(B.spine01.head), 'neck01', fmt(B.neck01.head), 'head', fmt(B.head.head))
console.log(OUTFILE, 'MB', (fs.statSync(path.join(HERE, 'build', OUTFILE)).size / 1e6).toFixed(2))
