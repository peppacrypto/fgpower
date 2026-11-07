#!/usr/bin/env node
// Builds build/body-real.json from the CC0 MakeHuman-derived data in assets/.
//
//   node build-body.mjs [--muscle 1.3] [--lean 0.6] [--ideal 0.5] [--relief 0.6] [--height 0] [--no-sculpt] [--out path]
//
// Steps, in order:
//   1. Shape targets. MakeHuman's macro grid: muscle (average to max, 1.3 extrapolates a little) by weight (average to
//      min). The lean side brings the definition, the muscle side the shape.
//   2. Sculpt. The targets stop at "max muscle, same body weight": slim limbs and a narrow head. Here the arm and leg get
//      natural segment proportions (their totals stay, so straight-limb poses keep their reach), the head a natural width,
//      and the muscles their bulk: soft bumps along the surface normal, on the limbs by position along the bone and angle
//      around it, on the trunk as ellipsoids.
//   3. Relief. A band-pass of the surface deepens the grooves between muscles without amplifying mesh noise.
//   4. Under the shorts the source's recesses are smoothed away: they read as a black V and a knob between the thighs.
//   5. Joints from the shaped mesh, the elbow's axis moved toward the back of the arm.
//   6. Skin weights: the source's, rebalanced where tests showed trouble (see each function): shoulder girdle, armpit,
//      pelvis, even twist along the arm, firm hinges at elbow, knee and wrist.
//   7. Output: control mesh as quads (surface.js subdivides them), up to 6 influences, and the pose-driven muscle
//      swelling (see correctives()).
//
// --real-head is still accepted because older commands pass it; the real head is the only head now.
//
// What this file writes is read by rig.js (new Body(data)): maxInfluences, positions, quads, correctives, skinB, skinW,
// bones. build/ is not in git: run this once after a fresh checkout.
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
const MUSCLE = arg('--muscle', 1.3)
const LEAN = arg('--lean', 0.6)
const IDEAL = arg('--ideal', 0.5)
const HEIGHT = arg('--height', 0)
const RELIEF = arg('--relief', 0.6)
const SCULPT = !process.argv.includes('--no-sculpt')
const OUTPATH = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : path.join(HERE, 'build', 'body-real.json')
const SCALE = 0.1 // OBJ units are decimetres; everything downstream is metres
const MAX_INFLUENCES = 6
const SIDES = ['L', 'R']

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add3 = (a, b, s = 1) => [a[0] + s * b[0], a[1] + s * b[1], a[2] + s * b[2]]
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm3 = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

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
const bodyVerts = [...groupVerts.get('body')]
const bodyFaces = faces.filter((f) => f.g === 'body')
const neighbours = new Map(bodyVerts.map((i) => [i, new Set()]))
for (const f of bodyFaces) {
  f.v.forEach((i, c) => {
    neighbours.get(i).add(f.v[(c + 1) % f.v.length])
    neighbours.get(i).add(f.v[(c + f.v.length - 1) % f.v.length])
  })
}

// ---- shape targets ------------------------------------------------------
function applyTarget(file, w) {
  if (!w) return
  const raw = zlib.gunzipSync(fs.readFileSync(path.join(A, 'targets', file))).toString('utf8')
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const p = line.trim().split(/\s+/)
    if (p.length < 4) continue
    const v = verts[+p[0]]
    if (!v) continue
    v[0] += w * +p[1]
    v[1] += w * +p[2]
    v[2] += w * +p[3]
  }
}
{
  const M = MUSCLE
  const L = LEAN
  // MakeHuman builds a male from a race/gender base; the three are mixed so no one ethnic face or build is implied.
  for (const r of ['caucasian', 'african', 'asian']) applyTarget(`${r}-male-young.target.gz`, 1 / 3)
  applyTarget('universal-male-young-maxmuscle-averageweight.target.gz', M * (1 - L))
  applyTarget('universal-male-young-maxmuscle-minweight.target.gz', M * L)
  applyTarget('universal-male-young-averagemuscle-minweight.target.gz', (1 - M) * L)
  applyTarget('male-young-maxmuscle-averageweight-idealproportions.target.gz', IDEAL * M * (1 - L))
  applyTarget('male-young-maxmuscle-minweight-idealproportions.target.gz', IDEAL * M * L)
  applyTarget('male-young-averagemuscle-averageweight-idealproportions.target.gz', IDEAL * (1 - M) * (1 - L))
  applyTarget('male-young-averagemuscle-minweight-idealproportions.target.gz', IDEAL * (1 - M) * L)
  applyTarget('male-young-maxmuscle-averageweight-maxheight.target.gz', HEIGHT * M * (1 - L))
  applyTarget('male-young-maxmuscle-minweight-maxheight.target.gz', HEIGHT * M * L)
  applyTarget('male-young-averagemuscle-averageweight-maxheight.target.gz', HEIGHT * (1 - M) * (1 - L))
  applyTarget('male-young-averagemuscle-minweight-maxheight.target.gz', HEIGHT * (1 - M) * L)
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
const jointsNow = () => {
  const out = {}
  for (const [name, b] of Object.entries(rig)) out[name] = { name, parent: b.parent || null, head: jointPos(b.head), tail: jointPos(b.tail) }
  return out
}

// Bones we never pose collapse into the nearest bone we do.
function canonical(name) {
  if (/^(jaw|tongue|oris|levator|special|temporalis|oculi|orbicularis|risorius|eye)/.test(name)) return 'head'
  if (/^breast/.test(name)) return 'spine02'
  const m = name.match(/^toe(\d)-(\d)\.(L|R)$/)
  if (m) return `toe${m[1]}-1.${m[3]}`
  return name
}

// ---- weights, by source vertex -------------------------------------------
const srcWeights = new Map() // vertex -> Map(bone -> weight)
for (const [bone, list] of Object.entries(JSON.parse(fs.readFileSync(path.join(A, 'weights.default.json'), 'utf8')).weights)) {
  const c = canonical(bone)
  for (const [vi, w] of list) {
    if (!srcWeights.has(vi)) srcWeights.set(vi, new Map())
    const m = srcWeights.get(vi)
    m.set(c, (m.get(c) || 0) + w)
  }
}
const weightOf = (vi, test) => {
  const m = srcWeights.get(vi)
  if (!m) return 0
  let s = 0
  for (const [b, w] of m) if (test.test(b)) s += w
  return s
}

// ---- helpers on the body surface -------------------------------------------
/** Area-weighted normals of the body, softened along the surface, so a push along them can't amplify small detail. */
function softNormals(iterations = 6) {
  let cur = new Map(bodyVerts.map((i) => [i, [0, 0, 0]]))
  for (const f of bodyFaces) {
    const [a, b, c, d] = f.v.map((i) => verts[i])
    const n = cross3(sub3(c, a), sub3(d, b))
    for (const i of f.v) {
      const o = cur.get(i)
      o[0] += n[0]
      o[1] += n[1]
      o[2] += n[2]
    }
  }
  for (let it = 0; it < iterations; it++) {
    const next = new Map()
    for (const i of bodyVerts) {
      let t = norm3(cur.get(i))
      const nb = neighbours.get(i)
      for (const u of nb) t = add3(t, norm3(cur.get(u)), 1 / nb.size)
      next.set(i, norm3(t))
    }
    cur = next
  }
  return cur
}

/** One Laplacian step of a position map, with an optional per-vertex amount. */
function smoothStep(cur, amount = () => 1) {
  const next = new Map()
  for (const i of bodyVerts) {
    const w = 0.6 * amount(i)
    const c = cur.get(i)
    if (w <= 0) {
      next.set(i, c)
      continue
    }
    const a = [0, 0, 0]
    const nb = neighbours.get(i)
    for (const u of nb) {
      const p = cur.get(u)
      a[0] += p[0]
      a[1] += p[1]
      a[2] += p[2]
    }
    next.set(i, [c[0] + w * (a[0] / nb.size - c[0]), c[1] + w * (a[1] / nb.size - c[1]), c[2] + w * (a[2] / nb.size - c[2])])
  }
  return next
}

// ---- sculpt: the athletic build -------------------------------------------
// Distances in metres, positions in decimetres.

/** Moves the elbow or the knee along the limb: the upper part stretches by `stretch`, the lower shrinks by `shrink`. */
function shiftJoint(s, boneUpper, boneMid, boneEnd, jointTest, lowerTest, stretch, shrink) {
  const J = jointsNow()
  const a = J[`${boneUpper}.${s}`].head
  const b = J[`${boneMid}.${s}`].head
  const c = J[`${boneEnd}.${s}`].head
  const u = norm3(sub3(b, a))
  const lu = Math.hypot(...sub3(b, a))
  const l = norm3(sub3(c, b))
  const ll = Math.hypot(...sub3(c, b))
  const bb = add3(b, u, stretch)
  // Every vertex, not only the body's: the joint cubes that define the skeleton must come along.
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i]
    if (Math.sign(v[0]) !== (s === 'L' ? 1 : -1) && Math.abs(v[0]) > 1e-6) continue
    const m = weightOf(i, jointTest)
    if (m <= 0) continue
    const d = stretch * smoothstep(0.12, 0.85, dot(sub3(v, a), u) / lu) * m
    v[0] += u[0] * d
    v[1] += u[1] * d
    v[2] += u[2] * d
    const e = -shrink * smoothstep(0.08, 0.92, dot(sub3(v, bb), l) / ll) * weightOf(i, lowerTest)
    v[0] += l[0] * e
    v[1] += l[1] * e
    v[2] += l[2] * e
  }
}

function sculpt() {
  for (const s of SIDES) {
    // The source upper arm is shorter than its forearm; a real one is about 1.2 times longer. The sum of the two stays
    // at the source's 0.520 (the elbow's axis, moved below, adds 0.009 of it), so a straight arm keeps its reach and the
    // poses written for it stay right. The same for the leg, whose shin is a little long: 0.860 in total.
    shiftJoint(s, 'upperarm01', 'lowerarm01', 'wrist', /^(upperarm|lowerarm|wrist|finger|metacarpal)/, /^(lowerarm|wrist|finger|metacarpal)/, 0.19, 0.315)
    shiftJoint(s, 'upperleg01', 'lowerleg01', 'foot', /^(upperleg|lowerleg|foot|toe)/, /^(lowerleg|foot|toe)/, 0.1, 0.1)
  }

  // The head: a touch wider and shorter than the source's narrow egg. Everything weighted to it follows, so the joints
  // and the eyes too.
  const hy = jointsNow().head.head[1]
  for (let i = 0; i < verts.length; i++) {
    const m = weightOf(i, /^head$/)
    if (m <= 0) continue
    verts[i][0] *= 1 + 0.05 * m
    verts[i][1] = hy + (verts[i][1] - hy) * (1 - 0.03 * m)
  }

  const J = jointsNow()
  const normals = softNormals()
  const push = new Map(bodyVerts.map((i) => [i, 0]))
  let floorY = Infinity
  for (const i of bodyVerts) floorY = Math.min(floorY, verts[i][1])

  /** A soft ellipsoid of extra muscle, mirrored. Centre and radii in metres, in the rest pose. */
  const blob = (i, c, r, amount) => {
    const v = verts[i]
    const x = (Math.abs(v[0]) * SCALE - c[0]) / r[0]
    const y = ((v[1] - floorY) * SCALE - c[1]) / r[1]
    const z = (v[2] * SCALE - c[2]) / r[2]
    return (amount / SCALE) * Math.exp(-(x * x + y * y + z * z))
  }
  for (const i of bodyVerts) {
    const mT = Math.min(1, weightOf(i, /^(spine|clavicle|shoulder01|root|pelvis)/) + 0.5 * weightOf(i, /^upperarm01/))
    let d = 0
    if (mT > 0) {
      d += mT * blob(i, [0.085, 1.295, 0.12], [0.085, 0.06, 0.07], 0.006) // pectorals
      d += mT * blob(i, [0.155, 1.22, -0.05], [0.045, 0.12, 0.08], 0.006) // latissimus
      d += mT * blob(i, [0.075, 1.46, -0.04], [0.065, 0.045, 0.05], 0.005) // upper trapezius
      d += mT * blob(i, [0.06, 1.3, -0.13], [0.06, 0.08, 0.04], 0.003) // upper back
      d += mT * blob(i, [0.035, 1.06, -0.12], [0.028, 0.12, 0.03], 0.0035) // erectors, leaving the groove of the spine
      d += mT * blob(i, [0.13, 1.07, 0.0], [0.05, 0.11, 0.1], 0.0095) // obliques: a natural waist, not a wasp's
    }
    const mH = Math.min(1, weightOf(i, /^(upperleg|pelvis|root|spine05)/))
    if (mH > 0) d += mH * blob(i, [0.09, 0.87, -0.1], [0.085, 0.085, 0.07], 0.004) // glutes
    const mD = Math.min(1, weightOf(i, /^(upperarm01|shoulder01|upperarm02|clavicle)/))
    if (mD > 0) d += mD * blob(i, [0.235, 1.345, 0.018], [0.06, 0.08, 0.075], 0.0055) // deltoid
    const mN = Math.min(1, weightOf(i, /^neck/))
    if (mN > 0) d += (mN * 0.004) / SCALE
    push.set(i, d)
  }

  /**
   * A soft muscle belly on a limb segment a..b: a bump in the position along it (t, width w) and in the angle around it
   * (ang: 0 = `front`, 180 = the back; omit it for all the way round). `amount` is in metres.
   */
  const belly = (i, a, b, front, { t: t0, w, amount, ang, angW }) => {
    const u = norm3(sub3(b, a))
    const lu = Math.hypot(...sub3(b, a))
    const p = sub3(verts[i], a)
    const t = dot(p, u) / lu
    let around = 1
    if (ang !== undefined) {
      const f = norm3(add3(front, u, -dot(front, u)))
      const r = add3(p, u, -dot(p, u))
      const th = (Math.acos(Math.max(-1, Math.min(1, dot(norm3(r), f)))) * 180) / Math.PI
      around = Math.exp(-(((th - ang) / angW) ** 2))
    }
    return (amount / SCALE) * Math.exp(-(((t - t0) / w) ** 2)) * around
  }
  for (const s of SIDES) {
    const sgn = s === 'L' ? 1 : -1
    const b = (name) => J[`${name}.${s}`].head
    const [Sh, El, Wr, Hp, Kn, An] = ['upperarm01', 'lowerarm01', 'wrist', 'upperleg01', 'lowerleg01', 'foot'].map(b)
    const armFront = sub3(Wr, El) // the biceps side: where the forearm folds
    const legFront = [0, 0, 1]
    for (const i of bodyVerts) {
      if (verts[i][0] * sgn < -1e-6) continue
      let d = 0
      const mUp = Math.min(1, weightOf(i, /^(upperarm|shoulder01)/) + 0.5 * weightOf(i, /^lowerarm01/))
      if (mUp > 0) {
        d += mUp * belly(i, Sh, El, armFront, { t: 0.5, w: 0.42, amount: 0.004 })
        d += mUp * belly(i, Sh, El, armFront, { t: 0.62, w: 0.24, amount: 0.006, ang: 0, angW: 70 }) // biceps
        d += mUp * belly(i, Sh, El, armFront, { t: 0.42, w: 0.3, amount: 0.006, ang: 180, angW: 75 }) // triceps
      }
      const mFo = Math.min(1, weightOf(i, /^(lowerarm|wrist)/) + 0.3 * weightOf(i, /^upperarm02/))
      if (mFo > 0) {
        d += mFo * belly(i, El, Wr, armFront, { t: 0.2, w: 0.34, amount: 0.0065 })
        d += mFo * belly(i, El, Wr, armFront, { t: 0.8, w: 0.3, amount: 0.002 })
      }
      const mTh = Math.min(1, weightOf(i, /^(upperleg|pelvis)/) + 0.4 * weightOf(i, /^lowerleg01/))
      if (mTh > 0) {
        d += mTh * belly(i, Hp, Kn, legFront, { t: 0.42, w: 0.42, amount: 0.006 })
        d += mTh * belly(i, Hp, Kn, legFront, { t: 0.55, w: 0.3, amount: 0.004, ang: 0, angW: 60 }) // quadriceps
        d += mTh * belly(i, Hp, Kn, legFront, { t: 0.5, w: 0.32, amount: 0.003, ang: 180, angW: 60 }) // hamstrings
      }
      const mSh = Math.min(1, weightOf(i, /^lowerleg/) + 0.3 * weightOf(i, /^upperleg02/))
      if (mSh > 0) {
        d += mSh * belly(i, Kn, An, legFront, { t: 0.3, w: 0.26, amount: 0.003 })
        d += mSh * belly(i, Kn, An, legFront, { t: 0.3, w: 0.2, amount: 0.007, ang: 180, angW: 75 }) // gastrocnemius
      }
      push.set(i, push.get(i) + d)
    }
  }
  for (const i of bodyVerts) {
    const d = push.get(i)
    if (d) verts[i] = add3(verts[i], normals.get(i), d)
  }
}

/** A band-pass of the surface added back: see step 3 at the top. The head, neck, hands and feet are left alone. */
function relief(k) {
  if (!k) return
  let cur = new Map(bodyVerts.map((i) => [i, verts[i].slice()]))
  let light = cur
  for (let it = 0; it < 8; it++) {
    cur = smoothStep(cur)
    if (it === 1) light = cur
  }
  // The mask is blurred along the surface, so the boost has no edge.
  let mask = new Map(bodyVerts.map((i) => [i, 1 - Math.min(1, weightOf(i, /^(head|neck|finger|metacarpal|wrist|toe|foot)/))]))
  for (let it = 0; it < 8; it++) {
    const next = new Map()
    for (const i of bodyVerts) {
      let a = 0
      const nb = neighbours.get(i)
      for (const u of nb) a += mask.get(u)
      next.set(i, 0.5 * mask.get(i) + (0.5 * a) / nb.size)
    }
    mask = next
  }
  for (const i of bodyVerts) verts[i] = add3(verts[i], sub3(light.get(i), cur.get(i)), k * mask.get(i))
}

/**
 * Under the shorts. The source has a recessed triangle at the front of the pelvis and a pit at the perineum, where its
 * clothes helpers sit. A cloth would bridge them, so they are smoothed away, with the deepest part of the cleft at the back.
 */
function shortsArea() {
  let lowest = Infinity
  for (const i of bodyVerts) lowest = Math.min(lowest, verts[i][1])
  const mask = new Map()
  for (const i of bodyVerts) {
    const v = verts[i]
    const x = Math.abs(v[0]) * SCALE
    const y = (v[1] - lowest) * SCALE
    const z = v[2] * SCALE
    const front = Math.exp(-((x / 0.095) ** 2 + ((y - 0.875) / 0.075) ** 2)) * smoothstep(0.0, 0.05, z)
    const under = 0.3 * Math.exp(-((x / 0.05) ** 2 + ((y - 0.8) / 0.045) ** 2 + (z / 0.07) ** 2))
    const cleft = 0.5 * Math.exp(-((x / 0.028) ** 2)) * smoothstep(0.76, 0.82, y) * (1 - smoothstep(0.94, 1.0, y)) * (1 - smoothstep(-0.05, 0.0, z))
    mask.set(i, Math.min(1, front + under + cleft))
  }
  let cur = new Map(bodyVerts.map((i) => [i, verts[i]]))
  for (let it = 0; it < 24; it++) cur = smoothStep(cur, (i) => mask.get(i))
  for (const i of bodyVerts) verts[i] = cur.get(i)
}

if (SCULPT) sculpt()
relief(RELIEF)
if (SCULPT) shortsArea()

// ---- the skeleton ----------------------------------------------------------
const rawBones = jointsNow()
for (const s of SIDES) {
  const B = (n) => rawBones[`${n}.${s}`]
  // The elbow's axis lies nearer the back of the arm than its middle. That tightens the outside of the bend into a point
  // instead of the wide arc around the centre of the arm.
  const S = B('upperarm01').head
  const W = B('wrist').head
  const out = norm3(add3(norm3(sub3(B('lowerarm01').head, S)), norm3(sub3(W, B('lowerarm01').head)), -1))
  const E = add3(B('lowerarm01').head, out, 0.012 / SCALE)
  B('lowerarm01').head = E
  B('upperarm02').tail = E
  // The twist bones lie exactly on their limb's axis, so twisting one of them can't move the joints below it.
  const onLine = (P, Q, x) => add3(P, norm3(sub3(Q, P)), dot(sub3(x, P), norm3(sub3(Q, P))))
  for (const [up, lo, P, Q] of [
    ['upperarm01', 'upperarm02', S, E],
    ['lowerarm01', 'lowerarm02', E, W],
    ['upperleg01', 'upperleg02', B('upperleg01').head, B('lowerleg01').head],
    ['lowerleg01', 'lowerleg02', B('lowerleg01').head, B('foot').head],
  ]) {
    const mid = onLine(P, Q, B(lo).head)
    B(lo).head = mid
    B(up).tail = mid
  }
}

// ---- skin weights ---------------------------------------------------------
let restFloor = Infinity
for (const i of bodyVerts) restFloor = Math.min(restFloor, verts[i][1])
/** Rest position of a vertex in metres, |x| so a rule is written once for both sides. */
const restM = (i) => [Math.abs(verts[i][0]) * SCALE, (verts[i][1] - restFloor) * SCALE, verts[i][2] * SCALE]
const sideOf = (i) => (verts[i][0] >= 0 ? 'L' : 'R')
const onSide = (i, s) => verts[i][0] * (s === 'L' ? 1 : -1) > 0

/**
 * The source rig barely weights the shoulder girdle: raise the clavicle and the arm leaves the chest behind, tearing a
 * ridge between them. Here the part of the trunk that really rides on the scapula and clavicle moves to the clavicle bone.
 * Back: the shoulder blade, from its medial border to the armpit. Front: the outer pectoral below the collarbone. Top: the
 * trapezius slope. The spine, the sternum and the lower ribs stay with the trunk.
 */
function girdleWeights() {
  for (const i of bodyVerts) {
    const m = srcWeights.get(i)
    if (!m) continue
    const [ax, y, z] = restM(i)
    const back = smoothstep(0.045, 0.105, ax) * smoothstep(1.21, 1.31, y)
    const fore = smoothstep(0.035, 0.16, ax) * smoothstep(1.27, 1.395, y)
    const g = back + (fore - back) * smoothstep(-0.05, 0.05, z)
    if (g <= 0) continue
    let moved = 0
    for (const b of ['spine01', 'spine02']) {
      const w = m.get(b)
      if (!w) continue
      m.set(b, w * (1 - g))
      moved += w * g
    }
    const c = `clavicle.${sideOf(i)}`
    if (moved > 0) m.set(c, (m.get(c) || 0) + moved)
  }
}

/**
 * The source lets the arm's bones pull on a wide patch of the ribs. Raise the arm and that patch swings out with it, so
 * the chest grows wings. Whatever lies clearly outside the arm's own tube goes back to the trunk, which leaves a band
 * across the armpit to stretch like the real skin does.
 */
function armpitWeights() {
  for (const s of SIDES) {
    const S = rawBones[`upperarm01.${s}`].head
    const E = rawBones[`lowerarm01.${s}`].head
    const u = norm3(sub3(E, S))
    const len = Math.hypot(...sub3(E, S))
    const armBones = [`upperarm01.${s}`, `upperarm02.${s}`]
    const param = (i) => {
      const p = sub3(verts[i], S)
      const a = dot(p, u)
      return { t: a / len, r: Math.hypot(...add3(p, u, -a)) * SCALE, d: Math.hypot(...p) * SCALE }
    }
    // The arm's radius along its length, measured on the vertices that are nothing but arm.
    const BINS = 12
    const radii = Array.from({ length: BINS }, () => [])
    for (const i of bodyVerts) {
      if (!onSide(i, s)) continue
      const m = srcWeights.get(i)
      if (!m) continue
      const w = armBones.reduce((t, b) => t + (m.get(b) || 0), 0) + (m.get(`lowerarm01.${s}`) || 0)
      if (w < 0.97) continue
      const { t, r } = param(i)
      if (t >= 0 && t < 1) radii[Math.floor(t * BINS)].push(r)
    }
    const R = radii.map((a) => (a.length ? a.sort((x, y) => x - y)[Math.floor(a.length * 0.9)] : 0))
    const fallback = Math.max(...R.slice(BINS >> 1))
    for (let b = 0; b < BINS; b++) if (!R[b]) R[b] = fallback
    const radiusAt = (t) => {
      const x = Math.max(0, Math.min(BINS - 1.001, t * BINS - 0.5))
      const k = Math.floor(x)
      return R[k] + (R[Math.min(BINS - 1, k + 1)] - R[k]) * (x - k)
    }
    for (const i of bodyVerts) {
      if (!onSide(i, s)) continue
      const m = srcWeights.get(i)
      if (!m) continue
      const w = armBones.reduce((t, b) => t + (m.get(b) || 0), 0)
      if (w <= 0) continue
      const { t, r, d } = param(i)
      if (t > 1) continue
      const R0 = radiusAt(Math.max(0, t))
      // Above the joint the arm's "tube" is the ball of the shoulder.
      const keep = 1 - smoothstep(R0 * 1.05, R0 * 1.75, t < 0 ? d : r)
      if (keep >= 1) continue
      const moved = w * (1 - keep)
      for (const b of armBones) if (m.has(b)) m.set(b, m.get(b) * keep)
      const trunk = [...m.keys()].filter((b) => /^(spine|clavicle|shoulder01)/.test(b))
      const tw = trunk.reduce((a, b) => a + m.get(b), 0)
      if (tw > 0) for (const b of trunk) m.set(b, m.get(b) * (1 + moved / tw))
      else m.set(`clavicle.${s}`, moved)
    }
  }
}

/** The buttock belongs to the pelvis, not to the lumbar spine: the source hangs it on spine04 and spine05. */
function pelvisWeights() {
  for (const i of bodyVerts) {
    const m = srcWeights.get(i)
    if (!m) continue
    const take = 1 - smoothstep(0.93, 1.02, restM(i)[1])
    if (take <= 0) continue
    let moved = 0
    for (const b of ['spine04', 'spine05']) {
      const w = m.get(b)
      if (!w) continue
      m.set(b, w * (1 - take))
      moved += w * take
    }
    const p = `pelvis.${sideOf(i)}`
    if (moved > 0) m.set(p, (m.get(p) || 0) + moved)
  }
}

/**
 * Twist. Turning the palm or rotating the upper arm must spread evenly along the limb, or it wrings the skin into a spiral
 * where the source's weights change quickly. Each pair of twist bones gets one long, even ramp along its segment.
 */
function twistRamp(s, boneA, boneB, A2, B2, t0, t1) {
  const u = norm3(sub3(B2, A2))
  const len = Math.hypot(...sub3(B2, A2))
  for (const i of bodyVerts) {
    if (!onSide(i, s)) continue
    const m = srcWeights.get(i)
    if (!m) continue
    const T = (m.get(boneA) || 0) + (m.get(boneB) || 0)
    if (T <= 0) continue
    const f = Math.min(1, Math.max(0, (dot(sub3(verts[i], A2), u) / len - t0) / (t1 - t0)))
    m.set(boneB, T * f)
    m.set(boneA, T * (1 - f))
  }
}

/**
 * Elbow and knee: a real hinge, not a hose. The two sides of the joint meet in a band across the plane that halves the
 * rest angle. On the outside of the bend the band is narrow and sits a little above the joint, so the point of the elbow
 * (part of the ulna) and the kneecap ride on the lower bone and stay a point when the joint folds. On the inside it is
 * wider, or it would cut a knife line.
 */
function hinge(s, upperBone, lowerBone, A2, B2, C2, { pointDir, shiftOut, halfOut, halfIn }) {
  const u = norm3(sub3(B2, A2))
  const l = norm3(sub3(C2, B2))
  const n = norm3(add3(u, l)) // along the limb, through the joint
  const out = pointDir ? norm3(add3(pointDir, n, -dot(pointDir, n))) : norm3(add3(u, l, -1))
  for (const i of bodyVerts) {
    if (!onSide(i, s)) continue
    const m = srcWeights.get(i)
    if (!m) continue
    const wu = m.get(upperBone) || 0
    const wl = m.get(lowerBone) || 0
    const T = wu + wl
    if (T <= 0) continue
    const p = sub3(verts[i], B2)
    const along = dot(p, n) * SCALE
    if (Math.abs(along) > 0.09) continue
    const r = add3(p, n, -dot(p, n))
    const outside = 0.5 + (0.5 * dot(r, out)) / (Math.hypot(...r) || 1)
    const half = halfIn + (halfOut - halfIn) * outside
    const f = smoothstep(-half, half, along + shiftOut * smoothstep(0.4, 1, outside))
    // Blend toward the new band only near the joint, so the far ends keep their values exactly.
    const near = 1 - smoothstep(0.05, 0.09, Math.abs(along))
    m.set(lowerBone, (1 - near) * wl + near * T * f)
    m.set(upperBone, (1 - near) * wu + near * T * (1 - f))
  }
}

/** The wrist's band, between the forearm and the hand: only tightened, its place is right. */
function firmPair(boneA, boneB, power) {
  for (const i of bodyVerts) {
    const m = srcWeights.get(i)
    if (!m) continue
    const a = m.get(boneA)
    const b = m.get(boneB)
    if (!a || !b) continue
    const sum = a + b
    const x = (a / sum) ** power
    const y = (b / sum) ** power
    m.set(boneA, (sum * x) / (x + y))
    m.set(boneB, (sum * y) / (x + y))
  }
}

girdleWeights()
armpitWeights()
pelvisWeights()
for (const s of SIDES) {
  const j = (n) => rawBones[`${n}.${s}`].head
  twistRamp(s, `lowerarm01.${s}`, `lowerarm02.${s}`, j('lowerarm01'), j('wrist'), 0.1, 0.85)
  twistRamp(s, `upperarm01.${s}`, `upperarm02.${s}`, j('upperarm01'), j('lowerarm01'), 0.08, 0.7)
  hinge(s, `upperarm02.${s}`, `lowerarm01.${s}`, j('upperarm01'), j('lowerarm01'), j('wrist'), { shiftOut: 0.018, halfOut: 0.02, halfIn: 0.045 })
  hinge(s, `upperleg02.${s}`, `lowerleg01.${s}`, j('upperleg01'), j('lowerleg01'), j('foot'), { pointDir: [0, 0, 1], shiftOut: 0.012, halfOut: 0.025, halfIn: 0.045 })
  firmPair(`lowerarm02.${s}`, `wrist.${s}`, 1.5)
}

// ---- visible surface ----------------------------------------------------
const KEEP = new Set(['body', 'helper-l-eye', 'helper-r-eye'])
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
// Four indices per face, the fourth -1 for a triangle. The surface code subdivides these, so the quads must survive.
const quads = []
for (const f of faces) {
  if (!KEEP.has(f.g)) continue
  const a = f.v.map(addV)
  if (a.length === 3) quads.push(a[0], a[1], a[2], -1)
  else if (a.length === 4) quads.push(a[0], a[1], a[2], a[3])
}

// ---- influences -----------------------------------------------------------
const vertexInfluences = new Array(orig.length)
let unweighted = 0
for (let k = 0; k < orig.length; k++) {
  const m = srcWeights.get(orig[k])
  if (!m) {
    unweighted++
    vertexInfluences[k] = [['root', 1]]
    continue
  }
  const arr = [...m.entries()].filter((e) => e[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, MAX_INFLUENCES)
  const s = arr.reduce((t, e) => t + e[1], 0)
  vertexInfluences[k] = arr.map(([b, w]) => [b, w / s])
}

// Bones in topological order.
const keep = new Set(Object.keys(rawBones).filter((name) => canonical(name) === name))
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

const skinB = new Int16Array(orig.length * MAX_INFLUENCES).fill(-1)
const skinW = new Float32Array(orig.length * MAX_INFLUENCES)
vertexInfluences.forEach((list, k) => {
  list.forEach(([b, w], j) => {
    skinB[k * MAX_INFLUENCES + j] = boneIndex[b]
    skinW[k * MAX_INFLUENCES + j] = w
  })
})

// ---- pose-driven muscle ---------------------------------------------------
// A working muscle swells: the biceps when the elbow closes, the hamstrings when the knee closes, the calf when the heel
// rises, the deltoid and the upper trapezius when the arm goes up. Each entry is a small displacement of the rest shape,
// scaled by how far its driver is between lo and hi (degrees). The driver names are the ones rig.js computes in solve().
function correctives() {
  const list = []
  const J = Object.fromEntries(bones.map((b) => [b.name, b]))
  const N = softNormals()
  const inBody = groupVerts.get('body')
  const add = (driver, lo, hi, fn) => {
    const idx = []
    const dx = []
    for (let k = 0; k < orig.length; k++) {
      if (!inBody.has(orig[k])) continue
      const a = fn(k, orig[k])
      if (Math.abs(a) < 1e-4) continue
      const n = N.get(orig[k])
      idx.push(k)
      dx.push(+(n[0] * a).toFixed(5), +(n[1] * a).toFixed(5), +(n[2] * a).toFixed(5))
    }
    list.push({ driver, lo, hi, idx, dx })
  }
  const bump = (k, A2, B2, front, t0, tw, ang, angW) => {
    const p = [P[k * 3] - A2[0], P[k * 3 + 1] - A2[1], P[k * 3 + 2] - A2[2]]
    const u = norm3(sub3(B2, A2))
    const along = dot(p, u)
    const f = norm3(add3(front, u, -dot(front, u)))
    const th = (Math.acos(Math.max(-1, Math.min(1, dot(norm3(add3(p, u, -along)), f)))) * 180) / Math.PI
    return Math.exp(-(((along / Math.hypot(...sub3(B2, A2)) - t0) / tw) ** 2)) * Math.exp(-(((th - ang) / angW) ** 2))
  }
  for (const s of SIDES) {
    const sgn = s === 'L' ? 1 : -1
    const [Sh, El, Wr, Hp, Kn, An] = ['upperarm01', 'lowerarm01', 'wrist', 'upperleg01', 'lowerleg01', 'foot'].map((n) => J[`${n}.${s}`].head)
    const armFront = sub3(Wr, El)
    const legFront = [0, 0, 1]
    const side = (k) => P[k * 3] * sgn > 0
    add(`elbow${s}`, 35, 130, (k, i) => (side(k) ? 0.011 * Math.min(1, weightOf(i, /^upperarm/) * 1.2) * bump(k, Sh, El, armFront, 0.6, 0.27, 0, 55) : 0))
    add(`knee${s}`, 50, 120, (k, i) => (side(k) ? 0.007 * Math.min(1, weightOf(i, /^upperleg/) * 1.2) * bump(k, Hp, Kn, legFront, 0.62, 0.28, 180, 60) : 0))
    add(`ankle${s}`, 12, 45, (k, i) => (side(k) ? 0.007 * Math.min(1, weightOf(i, /^lowerleg/) * 1.2) * bump(k, Kn, An, legFront, 0.28, 0.2, 180, 70) : 0))
    add(`lift${s}`, 50, 120, (k) => {
      if (!side(k)) return 0
      const d = Math.hypot(P[k * 3] - (Sh[0] + sgn * 0.045), P[k * 3 + 1] - (Sh[1] - 0.04), P[k * 3 + 2] - Sh[2])
      return 0.005 * Math.exp(-((d / 0.065) ** 2))
    })
    add(`elev${s}`, 8, 26, (k) => {
      if (!side(k)) return 0
      const d = Math.hypot((P[k * 3] - sgn * 0.085) / 0.06, (P[k * 3 + 1] - 1.46) / 0.05, (P[k * 3 + 2] + 0.03) / 0.05)
      return 0.006 * Math.exp(-(d * d))
    })
  }
  return list
}

const out = {
  maxInfluences: MAX_INFLUENCES,
  positions: Array.from(P, (x) => +x.toFixed(5)),
  quads,
  correctives: correctives(),
  skinB: Array.from(skinB),
  skinW: Array.from(skinW, (x) => +x.toFixed(4)),
  bones,
  source: 'MakeHuman base mesh hm08, rig and weights via the CC0 mpfb2 data; see assets/LICENSE.md',
}
fs.mkdirSync(path.dirname(OUTPATH), { recursive: true })
const tmp = `${OUTPATH}.tmp`
fs.writeFileSync(tmp, JSON.stringify(out))
fs.renameSync(tmp, OUTPATH)

// ---- diagnostics --------------------------------------------------------
const B = Object.fromEntries(bones.map((b) => [b.name, b]))
const len = (a, b) => Math.hypot(...sub3(a, b)).toFixed(3)
const fmt = (a) => a.map((x) => x.toFixed(3)).join(', ')
let maxY = -Infinity
for (let i = 1; i < P.length; i += 3) maxY = Math.max(maxY, P[i])
console.log('verts', orig.length, 'faces', quads.length / 4, 'bones', bones.length, 'unweighted', unweighted, 'height (m)', maxY.toFixed(3))
{
  const j = (n) => B[`${n}.L`].head
  console.log('L shoulder', fmt(j('upperarm01')), 'elbow', fmt(j('lowerarm01')), 'wrist', fmt(j('wrist')), 'lens', len(j('lowerarm01'), j('upperarm01')), len(j('wrist'), j('lowerarm01')))
  console.log('L hip', fmt(j('upperleg01')), 'knee', fmt(j('lowerleg01')), 'ankle', fmt(j('foot')), 'lens', len(j('lowerleg01'), j('upperleg01')), len(j('foot'), j('lowerleg01')))
}
console.log('root', fmt(B.root.head), 'spine01', fmt(B.spine01.head), 'neck01', fmt(B.neck01.head), 'head', fmt(B.head.head))
console.log(path.basename(OUTPATH), 'MB', (fs.statSync(OUTPATH).size / 1e6).toFixed(2))
