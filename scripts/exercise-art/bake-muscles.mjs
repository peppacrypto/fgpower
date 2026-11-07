#!/usr/bin/env node
// Bakes the anatomical muscle map: build/muscles.json, read by paint.js through page.js.
//
//   node build-body.mjs && node bake-muscles.mjs [--only chest,lats] [--maps out-muscles/maps]
//
// Run it again whenever build/body-real.json changes (paint.js refuses a bake whose vertex count differs).
//
// HOW A MUSCLE IS DEFINED
// Every taxonomy id (paint.js MUSCLE_NAMES) is a list of PARTS, the anatomical heads: the chest has a clavicular and a
// sternal part. A part is an outline drawn in a CHART of the rest pose, on the figure's left side and mirrored to the
// right, with its own fibre direction. Charts (all authored on the left side, x >= 0, +X is the figure's left):
//   F / B   front / back orthographic: [|x|, y]. Only the front (back) half of the body.
//   S       side orthographic: [z, y], the outer half of the body.
//   TC      trunk cylinder: [angle around the trunk, y]. 0 = front midline, 90 = flank, 180 = back midline.
//   ARM     upper arm: [angle, metres from the shoulder joint]. Above the joint the coordinate wraps over the shoulder
//           cap (negative t), so the deltoid is one outline. Angle 0 = biceps side, 90 = outer, 180 = back, -90 = armpit side.
//   FORE    forearm: [angle, metres from the elbow]. At rest: elbow crease -48, olecranon 131, medial epicondyle and palm -140,
//           lateral epicondyle and back of the hand 40, thumb side -51, little finger side 129.
//   THIGH   [angle, metres from the hip joint]. 0 = front, 90 = outer, 180 = back, -90 = inner.
//   SHANK   [angle, metres from the knee]. Same angles.
// To read coordinates off the body, --maps writes each chart as a relief map with a labelled grid and every outline on it.
//
// WHAT IS BAKED, PER VERTEX OF THE RENDER MESH, PER ID
//   sdf     signed distance to the outline, in metres along the surface, + inside. The outline is first found as the zero
//           contour on the mesh, then every vertex measures its true 3D distance to that contour. So edges are equally sharp
//           on any chart and at any foreshortening, and a contour never jumps a gap (armpit, crotch).
//   g0, g1  two channels of signed distance to a separation line between heads, st0 and st1 their strength. They are signed
//           so that interpolation across a triangle keeps a thin line thin: the line is where the value crosses zero.
//   phase   metres across the fibres: the fibres are the level sets of this. along = metres along them. belly = 0 at the
//           tendon ends, 1 mid-muscle. fade = 0 where the winning part changes, because phase jumps there.
// Only vertices within BAND of the muscle are stored, as little-endian Int16 in units of 0.1 mm (or 1/10000), base64.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { Body } from './rig.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const flag = (k, d) => {
  const i = argv.indexOf(k)
  return i < 0 ? d : argv[i + 1]
}
const ONLY = flag('--only', '') ? new Set(flag('--only', '').split(',')) : null
const MAPS = flag('--maps', '')
const OUT = flag('--out', path.join(HERE, 'build', 'muscles.json'))

const BAND = 0.03 // how far outside a muscle values are kept (m)
const FAR = 0.06 // how far the true distance is measured (m)

const body = new Body(JSON.parse(fs.readFileSync(path.join(HERE, 'build', 'body-real.json'), 'utf8')), { render: true })
const surf = body.surface
surf.update(body.ctlRest)
const N = body.n
const P = body.rest
const TRI = body.index

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))

// ---- body regions, from the skin weights --------------------------------------------------------------------------
function weightMask(re) {
  const set = new Set(body.bones.filter((b) => re.test(b.name)).map((b) => b.i))
  const m = new Float32Array(body.ctlN)
  for (let k = 0; k < body.ctlN; k++) {
    for (let j = 0; j < body.maxInf; j++) {
      const bi = body.skinB[k * body.maxInf + j]
      if (bi >= 0 && set.has(bi)) m[k] += body.skinW[k * body.maxInf + j]
    }
  }
  return surf.subdivideAttribute(m)
}
const M = {
  hand: weightMask(/^(wrist|finger|metacarpal)/),
  fore: weightMask(/^(lowerarm|wrist|finger|metacarpal)/),
  upper: weightMask(/^upperarm/),
  shoulder: weightMask(/^shoulder01/),
  head: weightMask(/^(head|neck0[23])/),
  thigh: weightMask(/^upperleg/),
  shin: weightMask(/^lowerleg/),
  foot: weightMask(/^(foot|toe)/),
}

// ---- charts ---------------------------------------------------------------------------------------------------------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const arr = (v) => [v.x, v.y, v.z]
const sL = body.side.L
const [S, E, W, H, K, A] = [sL.S, sL.E, sL.W, sL.H, sL.K, sL.A].map(arr)

const AX = new Float32Array(N)
const Y = new Float32Array(N)
const Z = new Float32Array(N)
for (let k = 0; k < N; k++) {
  AX[k] = Math.abs(P[k * 3])
  Y[k] = P[k * 3 + 1]
  Z[k] = P[k * 3 + 2]
}

/** Cylinder chart around a..b: arrays of t (metres), th (degrees), r (metres). With capR, t wraps over the cap above a. */
function cylinder(a, b, front, capR = 0) {
  const u = unit(sub(b, a))
  const f = unit(sub(front, u.map((x) => x * dot(front, u))))
  const o = cross(f, u)
  const T = new Float32Array(N)
  const TH = new Float32Array(N)
  const R = new Float32Array(N)
  for (let k = 0; k < N; k++) {
    const p = [AX[k] - a[0], Y[k] - a[1], Z[k] - a[2]]
    const al = dot(p, u)
    const x = dot(p, f)
    const y = dot(p, o)
    const r = Math.hypot(x, y)
    T[k] = capR && al < 0 ? -capR * Math.atan2(-al, r) : al
    TH[k] = (Math.atan2(y, x) * 180) / Math.PI
    R[k] = r
  }
  return { T, TH, R }
}
const armCyl = cylinder(S, E, sub(W, E), 0.055)
const foreCyl = cylinder(E, W, [0, 1, 0])
const thighCyl = cylinder(H, K, [0, 0, 1])
const shankCyl = cylinder(K, A, [0, 0, 1])
const TCT = new Float32Array(N)
for (let k = 0; k < N; k++) TCT[k] = (Math.atan2(AX[k], Z[k] - 0.01) * 180) / Math.PI

const DEG = Math.PI / 180
function planar(name, cu, cv, gate) {
  return { name, periodic: 0, ku: 1, u: (k) => cu[k], v: (k) => cv[k], gate }
}
function angular(name, cyl, rbar, gate) {
  return { name, periodic: 360 * DEG * rbar, ku: DEG * rbar, u: (k) => cyl.TH[k] * DEG * rbar, v: (k) => cyl.T[k], gate }
}
// The default gates keep a chart on its own part of the body. They are in fake metres: only their zero matters.
const trunkOnly = (k) => 0.1 * (0.6 - M.upper[k] - M.fore[k]) // the trunk, the shoulder cap still in
const noHead = (k) => 0.1 * (0.5 - M.head[k])
const noLeg = (k) => 0.1 * (0.5 - M.shin[k] - M.foot[k])
const CH = {
  F: planar('F', AX, Y, (k) => Math.min(Z[k] - 0.012, trunkOnly(k), noHead(k), noLeg(k))),
  B: planar('B', AX, Y, (k) => Math.min(0.012 - Z[k], trunkOnly(k), noHead(k), noLeg(k))),
  S: planar('S', Z, Y, (k) => Math.min(AX[k] - 0.035, trunkOnly(k), noHead(k), noLeg(k))),
  TC: { name: 'TC', periodic: 0, ku: DEG * 0.125, u: (k) => TCT[k] * DEG * 0.125, v: (k) => Y[k], gate: (k) => Math.min(trunkOnly(k), noHead(k), noLeg(k)) },
  ARM: angular('ARM', armCyl, 0.052, (k) => Math.min(0.1 * (M.upper[k] + M.fore[k] + M.shoulder[k] - 0.3), 0.1 - armCyl.R[k])),
  FORE: angular('FORE', foreCyl, 0.042, (k) => Math.min(0.1 * (M.fore[k] + M.upper[k] - 0.3), 0.078 - foreCyl.R[k], 0.1 * (0.6 - M.hand[k]))),
  THIGH: angular('THIGH', thighCyl, 0.085, (k) => Math.min(0.1 * (M.thigh[k] + M.shin[k] - 0.25), 0.15 - thighCyl.R[k])),
  SHANK: angular('SHANK', shankCyl, 0.055, (k) => Math.min(0.1 * (M.shin[k] + M.thigh[k] - 0.3), 0.1 * (0.6 - M.foot[k]), 0.1 - shankCyl.R[k])),
}

// ---- outlines --------------------------------------------------------------------------------------------------------
/** Closed Catmull-Rom loop through points; a point with a third element 1 is a sharp corner. Returns [[u, v], ...]. */
function loop(points, samples = 10) {
  const n = points.length
  const corner = points.map((p) => p[2] === 1)
  const out = []
  for (let i = 0; i < n; i++) {
    const p1 = points[i]
    const p2 = points[(i + 1) % n]
    const p0 = corner[i] ? [2 * p1[0] - p2[0], 2 * p1[1] - p2[1]] : points[(i - 1 + n) % n]
    const p3 = corner[(i + 1) % n] ? [2 * p2[0] - p1[0], 2 * p2[1] - p1[1]] : points[(i + 2) % n]
    for (let s = 0; s < samples; s++) {
      const t = s / samples
      const t2 = t * t
      const t3 = t2 * t
      out.push([
        0.5 * (2 * p1[0] + (p2[0] - p0[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (3 * p1[0] - p0[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (p2[1] - p0[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (3 * p1[1] - p0[1] - 3 * p2[1] + p3[1]) * t3),
      ])
    }
  }
  return out
}

/** Open Catmull-Rom curve with its arc length, sampled for lookup by normalised length. */
function curve(points, samples = 12) {
  if (points.length === 1) return { at: () => points[0], len: 0, pts: points }
  const pts = []
  const n = points.length
  for (let i = 0; i < n - 1; i++) {
    const p1 = points[i]
    const p2 = points[i + 1]
    const p0 = i ? points[i - 1] : [2 * p1[0] - p2[0], 2 * p1[1] - p2[1]]
    const p3 = i < n - 2 ? points[i + 2] : [2 * p2[0] - p1[0], 2 * p2[1] - p1[1]]
    for (let s = 0; s < samples; s++) {
      const t = s / samples
      const t2 = t * t
      const t3 = t2 * t
      pts.push([
        0.5 * (2 * p1[0] + (p2[0] - p0[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (3 * p1[0] - p0[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (p2[1] - p0[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (3 * p1[1] - p0[1] - 3 * p2[1] + p3[1]) * t3),
      ])
    }
  }
  pts.push(points[n - 1].slice(0, 2))
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const len = cum[cum.length - 1]
  const at = (v) => {
    // Linear extrapolation past the ends.
    if (v <= 0) {
      const d = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]]
      const l = Math.hypot(d[0], d[1]) || 1
      return [pts[0][0] + (d[0] / l) * v * len, pts[0][1] + (d[1] / l) * v * len]
    }
    if (v >= 1) {
      const m = pts.length - 1
      const d = [pts[m][0] - pts[m - 1][0], pts[m][1] - pts[m - 1][1]]
      const l = Math.hypot(d[0], d[1]) || 1
      return [pts[m][0] + (d[0] / l) * (v - 1) * len, pts[m][1] + (d[1] / l) * (v - 1) * len]
    }
    const target = v * len
    let lo = 0
    let hi = cum.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (cum[mid] <= target) lo = mid
      else hi = mid
    }
    const t = (target - cum[lo]) / (cum[hi] - cum[lo] || 1)
    return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * t, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * t]
  }
  return { at, len, pts }
}

/** A closed outline in a chart. Authoring units: planar charts metres, angular charts [degrees, metres]. */
function outline(chart, points, samples) {
  const pts = points.map((p) => [p[0] * chart.ku, p[1], p[2]])
  const L = loop(pts, samples)
  let minU = Infinity
  let maxU = -Infinity
  let minV = Infinity
  let maxV = -Infinity
  for (const [u, v] of L) {
    minU = Math.min(minU, u)
    maxU = Math.max(maxU, u)
    minV = Math.min(minV, v)
    maxV = Math.max(maxV, v)
  }
  const one = (u, v) => {
    // Quick reject: far outside the box.
    const margin = 0.03
    const bu = Math.max(minU - u, u - maxU)
    const bv = Math.max(minV - v, v - maxV)
    if (bu > margin || bv > margin) return -Math.max(bu, bv)
    let best = Infinity
    let inside = false
    const n = L.length
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [ax, ay] = L[j]
      const [bx, by] = L[i]
      const ex = bx - ax
      const ey = by - ay
      const wx = u - ax
      const wy = v - ay
      const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey || 1e-12), 0, 1)
      const dx = wx - ex * t
      const dy = wy - ey * t
      const d2 = dx * dx + dy * dy
      if (d2 < best) best = d2
      if (ay > v !== by > v && u < ax + ((v - ay) / (by - ay)) * ex) inside = !inside
    }
    const d = Math.sqrt(best)
    return inside ? d : -d
  }
  const evaluate = (k) => {
    const u = chart.u(k)
    const v = chart.v(k)
    let f = one(u, v)
    if (chart.periodic) {
      f = Math.max(f, one(u + chart.periodic, v), one(u - chart.periodic, v))
    }
    return f
  }
  return { chart, L, evaluate, one, box: [minU, maxU, minV, maxV] }
}

// ---- fibres: a stream function in a chart. Returns [phase, along, belly] for a vertex -----------------------------------
const bump = (t, p = 0.7) => Math.pow(Math.max(0, Math.sin(Math.PI * clamp(t, 0, 1))), p)

/** Fibres run from a point of curve A straight to the same fraction of curve B. A one-point B is a fan. */
function ruled(chart, A, B) {
  const conv = (c) => c.map((p) => [p[0] * chart.ku, p[1]])
  const a = curve(conv(A))
  const b = curve(conv(B))
  const width = (a.len + b.len) / 2 || 0.1
  const per = chart.periodic
  return {
    chart,
    width,
    sample(k) {
      let u = chart.u(k)
      const v = chart.v(k)
      if (per) {
        // The copy of the vertex nearest the fibres' area.
        const mid = (a.at(0.5)[0] + b.at(0.5)[0]) / 2
        while (u - mid > per / 2) u -= per
        while (mid - u > per / 2) u += per
      }
      const g = (t) => {
        const pa = a.at(t)
        const pb = b.at(t)
        return (pb[0] - pa[0]) * (v - pa[1]) - (pb[1] - pa[1]) * (u - pa[0])
      }
      let lo = -0.4
      let hi = 1.4
      const gl = g(lo)
      const gh = g(hi)
      let t
      if (gl * gh > 0) t = Math.abs(gl) < Math.abs(gh) ? lo : hi
      else {
        for (let i = 0; i < 26; i++) {
          const mid = (lo + hi) / 2
          if (g(mid) * gl > 0) lo = mid
          else hi = mid
        }
        t = (lo + hi) / 2
      }
      const pa = a.at(t)
      const pb = b.at(t)
      const ex = pb[0] - pa[0]
      const ey = pb[1] - pa[1]
      const l = Math.hypot(ex, ey) || 1e-6
      const tau = ((u - pa[0]) * ex + (v - pa[1]) * ey) / (l * l)
      return [t * width, tau * l, bump(tau)]
    },
  }
}

/**
 * Fibres follow the outline: slices across the chart's v axis (along the limb), each normalised to its own width, so they
 * converge into the tendons like a real spindle. `shape` is the outline they follow.
 */
function spindle(shape) {
  const { L, chart, box } = shape
  const per = chart.periodic
  const minV = box[2]
  const maxV = box[3]
  let widest = 0
  for (let s = 1; s < 40; s++) {
    const v = minV + ((maxV - minV) * s) / 40
    const xs = crossings(L, v)
    for (let i = 0; i + 1 < xs.length; i += 2) widest = Math.max(widest, xs[i + 1] - xs[i])
  }
  return {
    chart,
    width: widest,
    sample(k) {
      let u = chart.u(k)
      const v = chart.v(k)
      if (per) {
        const mid = (box[0] + box[1]) / 2
        while (u - mid > per / 2) u -= per
        while (mid - u > per / 2) u += per
      }
      const xs = crossings(L, clamp(v, minV + 1e-5, maxV - 1e-5))
      let c0 = xs[0] ?? u - 0.01
      let c1 = xs[xs.length - 1] ?? u + 0.01
      for (let i = 0; i + 1 < xs.length; i += 2) {
        if (u >= xs[i] && u <= xs[i + 1]) {
          c0 = xs[i]
          c1 = xs[i + 1]
          break
        }
      }
      return [((u - c0) / Math.max(1e-4, c1 - c0)) * widest, v - minV, bump((v - minV) / (maxV - minV))]
    },
  }
}
function crossings(L, v) {
  const xs = []
  for (let i = 0, j = L.length - 1; i < L.length; j = i++) {
    const [ax, ay] = L[j]
    const [bx, by] = L[i]
    if (ay > v !== by > v) xs.push(ax + ((v - ay) / (by - ay)) * (bx - ax))
  }
  return xs.sort((a, b) => a - b)
}

/** Straight parallel fibres at an angle in the chart (degrees, 0 runs along +u, 90 along +v). */
function parallel(chart, angle) {
  const a = angle * DEG
  const dx = Math.cos(a)
  const dy = Math.sin(a)
  return {
    chart,
    sample(k) {
      const u = chart.u(k)
      const v = chart.v(k)
      return [-u * dy + v * dx, u * dx + v * dy, 1]
    },
  }
}

// ---- the anatomy ------------------------------------------------------------------------------------------------------
// part(name, outline, fibres, { minus: [other outlines], gate: fn(k) -> fake metres, tendon: 0..1 }).
const part = (name, shape, fibre, o = {}) => ({ name, shape, fibre, ...o })
const { F, B, S: SD, TC, ARM, FORE, THIGH, SHANK } = CH
void SD

// The sides of the chest and back wrap the ribs: stop where the front and back meet the armpit.
const zAbove = (z) => (k) => Z[k] - z
const zBelow = (z) => (k) => z - Z[k]

// ---- CHEST
const chestClav = outline(F, [
  [0.009, 1.392, 1], [0.009, 1.416], [0.05, 1.428], [0.09, 1.429], [0.128, 1.424], [0.155, 1.396], [0.18, 1.36], [0.208, 1.334, 1],
  [0.15, 1.35], [0.09, 1.368], [0.04, 1.385],
])
const chestStern = outline(F, [
  [0.009, 1.396, 1], [0.04, 1.389], [0.09, 1.372], [0.15, 1.354], [0.208, 1.334, 1], [0.187, 1.297], [0.17, 1.255], [0.145, 1.222],
  [0.11, 1.205], [0.07, 1.208], [0.03, 1.225], [0.009, 1.245, 1],
])

// ---- ABDOMINALS: the rectus, four pads a side. Crosses the midline so the linea alba is a line, not a gap.
const rectusPad = (y0, y1, x0, x1, slope = 0) =>
  outline(F, [
    [-0.012, y1 + 0.002, 1], [x1 * 0.5, y1 - slope * 0.5], [x1 - 0.006, y1 - slope], [x1, y1 - slope - 0.012], [(x0 + x1) / 2 + 0.003, (y0 + y1) / 2 - slope / 2],
    [x0, y0 + 0.012], [x0 - 0.006, y0 - 0.001], [x0 * 0.5, y0 - 0.002], [-0.012, y0 - 0.002, 1],
  ], 6)
const abs1 = rectusPad(1.172, 1.238, 0.074, 0.07, 0.03)
const abs2 = rectusPad(1.108, 1.178, 0.081, 0.076, 0.004)
const abs3 = rectusPad(1.044, 1.114, 0.078, 0.082, 0.004)
const abs4 = outline(F, [
  [-0.012, 1.052, 1], [0.04, 1.05], [0.074, 1.049], [0.079, 1.035], [0.066, 1.0], [0.05, 0.975], [0.03, 0.95], [-0.012, 0.94, 1],
])

// ---- OBLIQUES: the external oblique, on the flank in the trunk cylinder chart.
const obliqueOut = outline(TC, [
  [44, 1.2, 1], [52, 1.222], [60, 1.205], [68, 1.24], [76, 1.222], [84, 1.262], [92, 1.245], [100, 1.262, 1], [112, 1.16], [116, 1.09], [112, 1.052, 1],
  [90, 1.036], [66, 1.018], [52, 1.0, 1], [48, 1.05], [47, 1.12],
], 8)

// ---- LATS: the wing from the spine and the crest of the hip, converging into the armpit.
const latsBack = outline(B, [
  [0.2, 1.345, 1], [0.165, 1.325], [0.135, 1.292], [0.1, 1.262], [0.065, 1.235], [0.03, 1.21], [0.011, 1.19, 1], [0.011, 1.15], [0.03, 1.115], [0.06, 1.082],
  [0.09, 1.058], [0.125, 1.044, 1], [0.2, 1.05, 1], [0.26, 1.2, 1],
])

// ---- TRAPS: the kite, neck to shoulder blades.
const trapsBack = outline(B, [
  [-0.02, 1.56, 1], [0.022, 1.56], [0.04, 1.525], [0.054, 1.492], [0.078, 1.47], [0.12, 1.453], [0.165, 1.444], [0.205, 1.436, 1],
  [0.19, 1.416], [0.15, 1.398], [0.115, 1.383], [0.088, 1.37, 1], [0.074, 1.34], [0.055, 1.295], [0.038, 1.245], [0.022, 1.2], [0.008, 1.152], [-0.02, 1.14, 1],
])
const trapsFront = outline(F, [
  [0.052, 1.505, 1], [0.08, 1.478], [0.12, 1.466], [0.165, 1.456], [0.205, 1.45, 1], [0.165, 1.442], [0.12, 1.447], [0.085, 1.455], [0.06, 1.47, 1],
], 6)

// ---- RHOMBOIDS and the MIDDLE BACK
const rhomboids = outline(B, [
  [0.01, 1.42, 1], [0.04, 1.402], [0.076, 1.378], [0.08, 1.34], [0.07, 1.295], [0.058, 1.262, 1], [0.03, 1.285], [0.01, 1.305, 1],
])
const midInner = outline(B, [
  [-0.02, 1.41, 1], [0.03, 1.405], [0.08, 1.385], [0.086, 1.345], [0.076, 1.29], [0.062, 1.248], [0.03, 1.232], [-0.02, 1.225, 1],
])
const midBlade = outline(B, [
  [0.09, 1.37, 1], [0.12, 1.38], [0.155, 1.395], [0.192, 1.41, 1], [0.205, 1.36], [0.19, 1.33], [0.165, 1.31], [0.13, 1.28], [0.095, 1.252], [0.07, 1.24, 1], [0.082, 1.29], [0.092, 1.34],
])

// ---- SPINAL ERECTORS: two columns either side of the groove of the spine.
const erectInner = outline(B, [
  [0.01, 1.38, 1], [0.022, 1.34], [0.036, 1.26], [0.044, 1.18], [0.046, 1.1], [0.044, 1.04], [0.034, 0.992], [0.012, 0.975, 1], [0.009, 1.05], [0.009, 1.18],
], 8)
const erectOuter = outline(B, [
  [0.03, 1.33, 1], [0.05, 1.27], [0.066, 1.19], [0.074, 1.12], [0.07, 1.06], [0.056, 1.015], [0.04, 0.99, 1], [0.05, 1.04], [0.05, 1.12], [0.046, 1.2],
], 8)

// ---- GLUTES: the maximus, and the medius above and to the side.
const gluteMax = outline(B, [
  [0.006, 1.015, 1], [0.04, 1.036], [0.078, 1.03], [0.118, 0.985], [0.155, 0.93], [0.178, 0.885, 1], [0.185, 0.84], [0.165, 0.812], [0.12, 0.802], [0.075, 0.806], [0.035, 0.825], [0.012, 0.865], [0.006, 0.93],
])
const gluteMed = outline(B, [
  [0.08, 1.033, 1], [0.12, 1.043], [0.155, 1.03], [0.178, 0.99], [0.19, 0.93], [0.182, 0.887, 1], [0.158, 0.933], [0.12, 0.988],
])

// ---- ABDUCTORS: the side of the hip, gluteus medius and tensor fasciae latae running into the IT band.
const abdMed = outline(CH.S, [
  [-0.082, 1.0, 1], [-0.05, 1.03], [-0.005, 1.04], [0.03, 1.03, 1], [0.026, 0.96], [0.014, 0.905, 1], [-0.012, 0.9], [-0.05, 0.94],
])
const abdTfl = outline(CH.S, [
  [0.036, 1.03, 1], [0.062, 1.0], [0.074, 0.955], [0.066, 0.885], [0.05, 0.815], [0.03, 0.74, 1], [0.012, 0.78], [0.01, 0.84], [0.018, 0.905], [0.03, 0.96],
])

// ---- QUADRICEPS, at the front of the thigh. Above t = 0.12 they run under the shorts.
const quadRF = outline(THIGH, [
  [20, -0.005, 1], [33, 0.06], [33, 0.19], [24, 0.31], [11, 0.385, 1], [-5, 0.385], [-14, 0.32], [-19, 0.2], [-12, 0.08], [5, 0.012],
])
const quadVL = outline(THIGH, [
  [62, 0.02, 1], [37, 0.06], [37, 0.19], [28, 0.31], [15, 0.385, 1], [26, 0.405], [60, 0.385], [92, 0.33], [114, 0.25], [124, 0.14], [106, 0.05],
])
const quadVM = outline(THIGH, [
  [-16, 0.2, 1], [-20, 0.27], [-16, 0.33], [-7, 0.39, 1], [-24, 0.43], [-52, 0.44], [-72, 0.395], [-80, 0.31], [-70, 0.225], [-46, 0.165],
])

// ---- HAMSTRINGS, at the back of the thigh, split into the two tendons behind the knee.
const hamBF = outline(THIGH, [
  [178, 0.115, 1], [145, 0.1], [124, 0.16], [110, 0.27], [97, 0.41, 1], [114, 0.42], [136, 0.34], [163, 0.27], [178, 0.2],
])
const hamSemi = outline(THIGH, [
  [182, 0.115, 1], [222, 0.1], [240, 0.17], [250, 0.29], [264, 0.425, 1], [246, 0.43], [222, 0.35], [197, 0.27], [182, 0.2],
])

// ---- ADDUCTORS, on the inside of the thigh.
const addLong = outline(THIGH, [
  [-34, 0.05, 1], [-60, 0.075], [-92, 0.085], [-100, 0.2], [-104, 0.3], [-100, 0.355, 1], [-82, 0.3], [-62, 0.2], [-46, 0.12],
])
const addMag = outline(THIGH, [
  [-96, 0.085, 1], [-125, 0.075], [-152, 0.09], [-147, 0.19], [-128, 0.3], [-104, 0.375, 1], [-108, 0.3], [-104, 0.2],
])

// ---- CALVES: the two heads of the gastrocnemius over the soleus, into the Achilles tendon.
const gasLat = outline(SHANK, [
  [178, 0.01, 1], [148, 0.005], [118, 0.04], [106, 0.11], [114, 0.17], [140, 0.205], [178, 0.205],
])
const gasMed = outline(SHANK, [
  [182, 0.01, 1], [220, 0.005], [247, 0.04], [262, 0.12], [254, 0.195], [222, 0.235], [182, 0.215],
])
const soleus = outline(SHANK, [
  [92, 0.11, 1], [90, 0.2], [108, 0.285], [150, 0.335], [176, 0.36], [184, 0.36], [212, 0.335], [254, 0.285], [272, 0.2], [270, 0.11, 1], [225, 0.1], [180, 0.1], [135, 0.1],
])

// ---- BICEPS, two heads side by side, the long head outward.
const bicLong = outline(ARM, [
  [1, 0.065, 1], [28, 0.085], [42, 0.14], [38, 0.195], [17, 0.235], [-3, 0.255, 1], [-3, 0.2], [0, 0.13],
])
const bicShort = outline(ARM, [
  [-1, 0.065, 1], [-2, 0.13], [-5, 0.2], [-5, 0.255, 1], [-22, 0.225], [-36, 0.175], [-42, 0.125], [-28, 0.08],
])

// ---- TRICEPS: lateral and long heads make the horseshoe, the tendon plate below.
const triLat = outline(ARM, [
  [96, 0.12, 1], [124, 0.085], [148, 0.05], [172, 0.022, 1], [178, 0.1], [176, 0.175], [160, 0.2], [132, 0.18], [108, 0.15],
])
const triLong = outline(ARM, [
  [183, 0.022, 1], [222, 0.05], [248, 0.09], [256, 0.14], [245, 0.2], [218, 0.22], [190, 0.2], [183, 0.1],
])
const triTendon = outline(ARM, [
  [150, 0.205, 1], [176, 0.18], [190, 0.205], [216, 0.228], [207, 0.262], [186, 0.28], [165, 0.272], [148, 0.24],
])

// ---- DELTOID: three heads capping the shoulder, converging on one point of the arm.
const DELT_APEX = [76, 0.135]
const delt = {
  ant: outline(ARM, [
    [-24, -0.05, 1], [38, -0.055], [52, 0.03], [71, 0.128], DELT_APEX.concat(1), [50, 0.112], [22, 0.085], [-6, 0.05], [-22, 0.005],
  ]),
  lat: outline(ARM, [
    [36, -0.055, 1], [116, -0.055], [100, 0.03], [80, 0.125], DELT_APEX.concat(1), [74, 0.125], [54, 0.03],
  ]),
  post: outline(ARM, [
    [114, -0.055, 1], [186, -0.042], [182, -0.005], [160, 0.05], [126, 0.09], [92, 0.122], DELT_APEX.concat(1), [82, 0.122], [102, 0.03],
  ]),
}
const deltFibres = {
  ant: ruled(ARM, [[-24, -0.05], [38, -0.055]], [[71, 0.13]]),
  lat: ruled(ARM, [[36, -0.055], [116, -0.055]], [[77, 0.13]]),
  post: ruled(ARM, [[114, -0.055], [186, -0.042]], [[80, 0.13]]),
}

// ---- FOREARMS: flexors on the palm side, extensors on the back of the hand, the brachioradialis along the thumb side.
const foreBR = outline(FORE, [
  [-18, -0.035, 1], [-4, 0.03], [-20, 0.1], [-42, 0.178], [-54, 0.215, 1], [-64, 0.17], [-74, 0.09], [-60, 0.03], [-38, -0.01],
])
const foreExt = outline(FORE, [
  [-14, 0.0, 1], [-1, 0.03], [-16, 0.1], [-38, 0.178], [-30, 0.2], [20, 0.222], [62, 0.21], [108, 0.16], [131, 0.09], [134, 0.03], [110, -0.002], [60, -0.012],
])
const foreFlex = outline(FORE, [
  [-74, 0.015, 1], [-78, 0.09], [-68, 0.17], [-78, 0.205], [-120, 0.222], [-165, 0.215], [-205, 0.16], [-224, 0.09], [-226, 0.03], [-195, 0.0], [-140, -0.02], [-100, -0.004],
])

const MUSCLES = {
  chest: {
    parts: [
      part('clav', chestClav, ruled(F, [[0.009, 1.408], [0.05, 1.426], [0.09, 1.429], [0.128, 1.424], [0.155, 1.398]], [[0.195, 1.33], [0.208, 1.337]]), { gate: zAbove(0.045) }),
      part('stern', chestStern, ruled(F, [[0.009, 1.396], [0.009, 1.25], [0.03, 1.222], [0.07, 1.205], [0.11, 1.202], [0.15, 1.222], [0.18, 1.27]], [[0.21, 1.34], [0.2, 1.325], [0.192, 1.305]]), { gate: zAbove(0.045) }),
    ],
    lines: [{ pair: ['clav', 'stern'], ch: 0, strength: 0.75 }],
  },
  abdominals: {
    whole: true,
    parts: [
      part('a1', abs1, parallel(F, 90)),
      part('a2', abs2, parallel(F, 90)),
      part('a3', abs3, parallel(F, 90)),
      part('a4', abs4, parallel(F, 90)),
    ],
    sameFibre: true,
    lines: [{ mid: true, ch: 0, strength: 1 }, { pair: ['a1', 'a2'], ch: 1, strength: 1 }, { pair: ['a2', 'a3'], ch: 1, strength: 1 }, { pair: ['a3', 'a4'], ch: 1, strength: 1 }],
  },
  obliques: { parts: [part('ext', obliqueOut, parallel(TC, 42))] },
  lats: {
    parts: [part('lat', latsBack, ruled(B, [[0.008, 1.2], [0.012, 1.14], [0.06, 1.075], [0.125, 1.04], [0.17, 1.04], [0.2, 1.1]], [[0.2, 1.345], [0.21, 1.31]]), { gate: zBelow(0.02) })],
  },
  traps: {
    parts: [
      part('back', trapsBack, ruled(B, [[0, 1.57], [0, 1.45], [0, 1.3], [0, 1.15]], [[0.21, 1.44], [0.15, 1.4], [0.088, 1.372], [0.06, 1.28]])),
      part('front', trapsFront, ruled(F, [[0.05, 1.51], [0.05, 1.47]], [[0.21, 1.45], [0.12, 1.445]])),
    ],
    sameFibre: true,
  },
  rhomboids: { parts: [part('rh', rhomboids, ruled(B, [[0, 1.44], [0, 1.3]], [[0.078, 1.385], [0.06, 1.26]]))] },
  'middle-back': {
    parts: [
      part('inner', midInner, ruled(B, [[0, 1.42], [0, 1.22]], [[0.082, 1.39], [0.064, 1.25]])),
      part('blade', midBlade, ruled(B, [[0.082, 1.375], [0.07, 1.24]], [[0.21, 1.37], [0.2, 1.335]])),
    ],
    lines: [{ pair: ['inner', 'blade'], ch: 0, strength: 0.8 }],
  },
  'spinal-erectors': {
    parts: [part('inner', erectInner, spindle(erectInner)), part('outer', erectOuter, spindle(erectOuter))],
    lines: [{ pair: ['inner', 'outer'], ch: 0, strength: 0.7 }],
  },
  glutes: {
    parts: [
      part('max', gluteMax, ruled(B, [[0.006, 1.015], [0.006, 0.93], [0.012, 0.865], [0.035, 0.825]], [[0.178, 0.885], [0.185, 0.84], [0.17, 0.815]]), { gate: zBelow(0.0) }),
      part('med', gluteMed, ruled(B, [[0.08, 1.04], [0.155, 1.035], [0.19, 0.99]], [[0.185, 0.885]]), { gate: zBelow(0.02) }),
    ],
    lines: [{ pair: ['max', 'med'], ch: 0, strength: 0.8 }],
  },
  abductors: {
    parts: [
      part('med', abdMed, ruled(CH.S, [[-0.082, 1.0], [-0.005, 1.04], [0.03, 1.03]], [[0.014, 0.9]])),
      part('tfl', abdTfl, spindle(abdTfl)),
    ],
    lines: [{ pair: ['med', 'tfl'], ch: 0, strength: 0.8 }],
  },
  adductors: {
    parts: [part('long', addLong, spindle(addLong)), part('mag', addMag, spindle(addMag))],
    lines: [{ pair: ['long', 'mag'], ch: 0, strength: 0.8 }],
  },
  quadriceps: {
    parts: [part('rf', quadRF, spindle(quadRF)), part('vl', quadVL, spindle(quadVL)), part('vm', quadVM, spindle(quadVM))],
    lines: [{ pair: ['rf', 'vl'], ch: 0, strength: 0.85 }, { pair: ['rf', 'vm'], ch: 1, strength: 0.85 }],
  },
  hamstrings: {
    parts: [part('bf', hamBF, spindle(hamBF)), part('semi', hamSemi, spindle(hamSemi))],
    lines: [{ pair: ['bf', 'semi'], ch: 0, strength: 0.85 }],
  },
  calves: {
    parts: [
      part('lat', gasLat, spindle(gasLat)),
      part('med', gasMed, spindle(gasMed)),
      part('sol', soleus, parallel(SHANK, 90), { minus: [gasLat, gasMed] }),
    ],
    lines: [{ pair: ['lat', 'med'], ch: 0, strength: 0.85 }, { pair: ['lat', 'sol'], ch: 1, strength: 0.75 }, { pair: ['med', 'sol'], ch: 1, strength: 0.75 }],
  },
  biceps: {
    parts: [part('long', bicLong, spindle(bicLong)), part('short', bicShort, spindle(bicShort))],
    lines: [{ pair: ['long', 'short'], ch: 0, strength: 0.7 }],
  },
  triceps: {
    parts: [part('lat', triLat, spindle(triLat)), part('long', triLong, spindle(triLong)), part('ten', triTendon, parallel(ARM, 90), { tendon: 0.55 })],
    lines: [{ pair: ['lat', 'long'], ch: 0, strength: 0.85 }, { pair: ['lat', 'ten'], ch: 1, strength: 0.7 }, { pair: ['long', 'ten'], ch: 1, strength: 0.7 }],
  },
  forearms: {
    parts: [part('br', foreBR, spindle(foreBR)), part('ext', foreExt, spindle(foreExt)), part('flex', foreFlex, spindle(foreFlex))],
    lines: [{ pair: ['br', 'ext'], ch: 0, strength: 0.8 }, { pair: ['br', 'flex'], ch: 1, strength: 0.8 }, { pair: ['ext', 'flex'], ch: 1, strength: 0.6 }],
  },
  'anterior-deltoid': { parts: [part('ant', delt.ant, deltFibres.ant)] },
  'lateral-deltoid': { parts: [part('lat', delt.lat, deltFibres.lat)] },
  'posterior-deltoid': { parts: [part('post', delt.post, deltFibres.post)] },
  shoulders: {
    parts: [part('ant', delt.ant, deltFibres.ant), part('lat', delt.lat, deltFibres.lat), part('post', delt.post, deltFibres.post)],
    lines: [{ pair: ['ant', 'lat'], ch: 0, strength: 0.8 }, { pair: ['lat', 'post'], ch: 1, strength: 0.8 }],
  },
}

// ---- baking -----------------------------------------------------------------------------------------------------------
/** The implicit function of a part on every vertex: > 0 inside. */
function implicit(p) {
  const f = new Float32Array(N)
  const chart = p.shape.chart
  for (let k = 0; k < N; k++) {
    let v = p.shape.evaluate(k)
    if (v > -0.03) v = Math.min(v, chart.gate(k))
    if (p.gate) v = Math.min(v, p.gate(k))
    if (p.minus) for (const m of p.minus) v = Math.min(v, -m.evaluate(k))
    f[k] = v
  }
  return f
}

/** The zero contour of f on the triangles, as 3D segments [x0,y0,z0,x1,y1,z1,...]. */
function contour(f) {
  const seg = []
  const cross = (a, b, out) => {
    const t = f[a] / (f[a] - f[b])
    out[0] = P[a * 3] + (P[b * 3] - P[a * 3]) * t
    out[1] = P[a * 3 + 1] + (P[b * 3 + 1] - P[a * 3 + 1]) * t
    out[2] = P[a * 3 + 2] + (P[b * 3 + 2] - P[a * 3 + 2]) * t
  }
  const c0 = [0, 0, 0]
  const c1 = [0, 0, 0]
  for (let i = 0; i < TRI.length; i += 3) {
    const a = TRI[i]
    const b = TRI[i + 1]
    const c = TRI[i + 2]
    const sa = f[a] >= 0
    const sb = f[b] >= 0
    const sc = f[c] >= 0
    if (sa === sb && sb === sc) continue
    if (sa === sb) {
      cross(a, c, c0)
      cross(b, c, c1)
    } else if (sa === sc) {
      cross(a, b, c0)
      cross(c, b, c1)
    } else {
      cross(b, a, c0)
      cross(c, a, c1)
    }
    seg.push(c0[0], c0[1], c0[2], c1[0], c1[1], c1[2])
  }
  return seg
}

/** Signed distance from the implicit f: true 3D distance to the contour, sign from f. */
function redistance(f) {
  const seg = contour(f)
  const d = new Float32Array(N).fill(-FAR)
  if (!seg.length) {
    for (let k = 0; k < N; k++) if (f[k] > 0) d[k] = FAR
    return { d, segments: 0 }
  }
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
  for (let i = 0; i < seg.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      box[j] = Math.min(box[j], seg[i + j])
      box[j + 3] = Math.max(box[j + 3], seg[i + j])
    }
  }
  const nS = seg.length / 6
  for (let k = 0; k < N; k++) {
    const x = P[k * 3]
    const y = P[k * 3 + 1]
    const z = P[k * 3 + 2]
    const inside = f[k] >= 0
    // Mirrored bodies: the contour exists on both sides, but we measured it on all triangles, so both are in seg.
    if (!inside && (x < box[0] - FAR || x > box[3] + FAR || y < box[1] - FAR || y > box[4] + FAR || z < box[2] - FAR || z > box[5] + FAR)) continue
    let best = FAR * FAR
    if (inside) best = 1
    for (let s = 0; s < nS; s++) {
      const o = s * 6
      const ax = seg[o]
      const ay = seg[o + 1]
      const az = seg[o + 2]
      const ex = seg[o + 3] - ax
      const ey = seg[o + 4] - ay
      const ez = seg[o + 5] - az
      const wx = x - ax
      const wy = y - ay
      const wz = z - az
      const ee = ex * ex + ey * ey + ez * ez
      let t = ee > 0 ? (wx * ex + wy * ey + wz * ez) / ee : 0
      t = t < 0 ? 0 : t > 1 ? 1 : t
      const dx = wx - ex * t
      const dy = wy - ey * t
      const dz = wz - ez * t
      const d2 = dx * dx + dy * dy + dz * dz
      if (d2 < best) best = d2
    }
    const dist = Math.sqrt(best)
    d[k] = inside ? dist : -Math.min(dist, FAR)
  }
  return { d, segments: nS }
}

function bakeId(id, def) {
  const parts = def.parts
  const D = parts.map((p) => redistance(implicit(p)).d)
  const sdf = new Float32Array(N).fill(-FAR)
  const second = new Float32Array(N).fill(-FAR)
  const win = new Int16Array(N).fill(-1)
  for (let i = 0; i < parts.length; i++) {
    const d = D[i]
    for (let k = 0; k < N; k++) {
      if (d[k] > sdf[k]) {
        second[k] = sdf[k]
        sdf[k] = d[k]
        win[k] = i
      } else if (d[k] > second[k]) second[k] = d[k]
    }
  }
  const phase = new Float32Array(N)
  const along = new Float32Array(N)
  const belly = new Float32Array(N)
  const fade = new Float32Array(N).fill(1)
  const tendon = new Float32Array(N)
  for (let k = 0; k < N; k++) {
    if (sdf[k] < -BAND) continue
    const p = parts[win[k]]
    const s = p.fibre.sample(k)
    phase[k] = s[0]
    along[k] = s[1]
    belly[k] = s[2]
    tendon[k] = p.tendon || 0
    if (parts.length > 1 && !def.sameFibre) fade[k] = smooth(0.0, 0.016, (sdf[k] - second[k]) / 2)
  }
  // Separation lines.
  const G = [new Float32Array(N), new Float32Array(N)]
  const ST = [new Float32Array(N), new Float32Array(N)]
  for (const l of def.lines || []) {
    const ch = l.ch
    if (l.mid) {
      for (let k = 0; k < N; k++) {
        const x = P[k * 3]
        const st = l.strength * (1 - smooth(0.012, 0.02, Math.abs(x)))
        if (st > ST[ch][k]) {
          ST[ch][k] = st
          G[ch][k] = x
        }
      }
      continue
    }
    const a = D[parts.findIndex((p) => p.name === l.pair[0])]
    const b = D[parts.findIndex((p) => p.name === l.pair[1])]
    for (let k = 0; k < N; k++) {
      const s = (a[k] - b[k]) / 2
      const st = l.strength * smooth(-0.012, -0.002, Math.min(a[k], b[k])) * (1 - smooth(0.012, 0.02, Math.abs(s)))
      if (st > ST[ch][k]) {
        ST[ch][k] = st
        G[ch][k] = s
      }
    }
  }
  return { sdf, G, ST, phase, along, belly, fade, tendon, whole: !!def.whole, D }
}

function pack(baked) {
  const idx = []
  for (let k = 0; k < N; k++) if (baked.sdf[k] >= -BAND) idx.push(k)
  const q = (a, scale) => {
    const o = new Int16Array(idx.length)
    idx.forEach((k, i) => {
      o[i] = clamp(Math.round(a[k] * scale), -32767, 32767)
    })
    return Buffer.from(o.buffer).toString('base64')
  }
  // Fibre phase and along are only meaningful modulo a short period: wrap them into the Int16 range.
  return {
    whole: baked.whole,
    count: idx.length,
    idx: Buffer.from(Int32Array.from(idx).buffer).toString('base64'),
    sdf: q(baked.sdf, 1e4),
    g0: q(baked.G[0], 1e4),
    g1: q(baked.G[1], 1e4),
    st0: q(baked.ST[0], 1e4),
    st1: q(baked.ST[1], 1e4),
    phase: q(baked.phase, 1e4),
    along: q(baked.along, 1e4),
    belly: q(baked.belly, 1e4),
    fade: q(baked.fade, 1e4),
    tendon: q(baked.tendon, 1e4),
  }
}

const t0 = Date.now()
const results = {}
const ids = {}
for (const [id, def] of Object.entries(MUSCLES)) {
  if (ONLY && !ONLY.has(id)) continue
  const b = bakeId(id, def)
  results[id] = b
  ids[id] = pack(b)
}

if (!MAPS) {
  let prev = {}
  if (ONLY && fs.existsSync(OUT)) prev = JSON.parse(fs.readFileSync(OUT, 'utf8')).ids || {}
  const out = { version: 1, n: N, band: BAND, ids: { ...prev, ...ids } }
  fs.writeFileSync(OUT, JSON.stringify(out))
  const area = (b) => {
    let a = 0
    for (let k = 0; k < N; k++) if (b.sdf[k] > 0) a++
    return a
  }
  console.log(`wrote ${path.relative(HERE, OUT)}: ${(fs.statSync(OUT).size / 1048576).toFixed(2)} MB, ${Object.keys(results).length} ids baked in ${((Date.now() - t0) / 1000).toFixed(1)} s`)
  console.log(Object.entries(results).map(([id, b]) => `${id} ${area(b)}`).join(', '))
}

// ---- authoring maps ----------------------------------------------------------------------------------------------------
if (MAPS) {
  const require = createRequire(path.resolve(HERE, '..', '..', 'package.json'))
  const sharp = require('sharp')
  fs.mkdirSync(MAPS, { recursive: true })
  const q = surf.fineQuads
  const nb = Array.from({ length: N }, () => new Set())
  for (let i = 0; i < surf.nq; i++) {
    for (let j = 0; j < 4; j++) {
      const a = q[i * 4 + j]
      const b = q[i * 4 + (j + 1) % 4]
      nb[a].add(b)
      nb[b].add(a)
    }
  }
  const nbrs = nb.map((s) => Int32Array.from(s))
  const blur = (iter) => {
    let a = Float64Array.from(P)
    let b = new Float64Array(N * 3)
    for (let it = 0; it < iter; it++) {
      for (let v = 0; v < N; v++) {
        let x = 0
        let y = 0
        let z = 0
        const n = nbrs[v]
        for (const u of n) {
          x += a[u * 3]
          y += a[u * 3 + 1]
          z += a[u * 3 + 2]
        }
        const c = 1 / n.length
        b[v * 3] = 0.5 * a[v * 3] + 0.5 * x * c
        b[v * 3 + 1] = 0.5 * a[v * 3 + 1] + 0.5 * y * c
        b[v * 3 + 2] = 0.5 * a[v * 3 + 2] + 0.5 * z * c
      }
      const t = a
      a = b
      b = t
    }
    return a
  }
  const s1 = blur(2)
  const s2 = blur(40)
  const NN = body.normals
  const relief = new Float32Array(N)
  for (let v = 0; v < N; v++) relief[v] = (s1[v * 3] - s2[v * 3]) * NN[v * 3] + (s1[v * 3 + 1] - s2[v * 3 + 1]) * NN[v * 3 + 1] + (s1[v * 3 + 2] - s2[v * 3 + 2]) * NN[v * 3 + 2]

  const COLORS = ['#ff5a1f', '#2fd3ff', '#9dff4a', '#ff4fd8', '#ffe14a', '#7c8cff', '#ff9d7a', '#4affc3']
  const allParts = []
  for (const [id, def] of Object.entries(MUSCLES)) for (const p of def.parts) allParts.push({ id, ...p })
  const VIEWS = [
    { name: 'F', chart: F, keep: (k) => P[k * 3] >= 0 && Z[k] > 0.0, depth: (k) => Z[k], u: [-0.03, 0.34], v: [0.92, 1.58], scale: 1500 },
    { name: 'B', chart: B, keep: (k) => P[k * 3] >= 0 && Z[k] < 0.02, depth: (k) => -Z[k], u: [-0.03, 0.34], v: [0.76, 1.6], scale: 1200 },
    { name: 'S', chart: CH.S, keep: (k) => P[k * 3] >= 0.02 && M.upper[k] + M.fore[k] < 0.5, depth: (k) => AX[k], u: [-0.16, 0.2], v: [0.7, 1.5], scale: 1200 },
    { name: 'TC', chart: TC, keep: (k) => P[k * 3] >= 0 && M.upper[k] + M.fore[k] < 0.5, depth: (k) => AX[k] + Math.abs(Z[k]), u: [0, 180 * TC.ku], v: [0.92, 1.45], scale: 1800 },
    { name: 'ARM', chart: ARM, keep: (k) => P[k * 3] >= 0 && CH.ARM.gate(k) > 0, depth: (k) => armCyl.R[k], u: [-120 * ARM.ku, 270 * ARM.ku], v: [-0.09, 0.3], scale: 2300 },
    { name: 'FORE', chart: FORE, keep: (k) => P[k * 3] >= 0 && CH.FORE.gate(k) > 0, depth: (k) => foreCyl.R[k], u: [-240 * FORE.ku, 150 * FORE.ku], v: [-0.05, 0.25], scale: 3000 },
    { name: 'THIGH', chart: THIGH, keep: (k) => P[k * 3] >= 0 && CH.THIGH.gate(k) > 0, depth: (k) => thighCyl.R[k], u: [-170 * THIGH.ku, 280 * THIGH.ku], v: [-0.05, 0.47], scale: 1600 },
    { name: 'SHANK', chart: SHANK, keep: (k) => P[k * 3] >= 0 && CH.SHANK.gate(k) > 0, depth: (k) => shankCyl.R[k], u: [-100 * SHANK.ku, 280 * SHANK.ku], v: [-0.03, 0.42], scale: 2000 },
  ]
  for (const view of VIEWS) {
    const W_ = Math.round((view.u[1] - view.u[0]) * view.scale)
    const H_ = Math.round((view.v[1] - view.v[0]) * view.scale)
    const toX = (u) => (u - view.u[0]) * view.scale
    const toY = (v) => (view.v[1] - v) * view.scale
    const buf = Buffer.alloc(W_ * H_ * 3, 12)
    const zb = new Float32Array(W_ * H_).fill(-Infinity)
    const per = view.chart.periodic
    for (let i = 0; i < TRI.length; i += 3) {
      const tri = [TRI[i], TRI[i + 1], TRI[i + 2]]
      if (!tri.every(view.keep)) continue
      let pu = tri.map((k) => view.chart.u(k))
      const pv = tri.map((k) => view.chart.v(k))
      if (per) {
        const u0 = pu[0]
        pu = pu.map((u) => (u - u0 > per / 2 ? u - per : u0 - u > per / 2 ? u + per : u))
      }
      for (const shift of per ? [-per, 0, per] : [0]) {
        const X = pu.map((u) => toX(u + shift))
        const Yp = pv.map(toY)
        const x0 = Math.max(0, Math.floor(Math.min(...X)))
        const x1 = Math.min(W_ - 1, Math.ceil(Math.max(...X)))
        const y0 = Math.max(0, Math.floor(Math.min(...Yp)))
        const y1 = Math.min(H_ - 1, Math.ceil(Math.max(...Yp)))
        if (x1 < x0 || y1 < y0) continue
        const det = (Yp[1] - Yp[2]) * (X[0] - X[2]) + (X[2] - X[1]) * (Yp[0] - Yp[2])
        if (Math.abs(det) < 1e-9) continue
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const l0 = ((Yp[1] - Yp[2]) * (x - X[2]) + (X[2] - X[1]) * (y - Yp[2])) / det
            const l1 = ((Yp[2] - Yp[0]) * (x - X[2]) + (X[0] - X[2]) * (y - Yp[2])) / det
            const l2 = 1 - l0 - l1
            if (l0 < -0.01 || l1 < -0.01 || l2 < -0.01) continue
            const dp = l0 * view.depth(tri[0]) + l1 * view.depth(tri[1]) + l2 * view.depth(tri[2])
            if (dp <= zb[y * W_ + x]) continue
            zb[y * W_ + x] = dp
            const g = 0.45 + (l0 * relief[tri[0]] + l1 * relief[tri[1]] + l2 * relief[tri[2]]) * 55
            const c = clamp(g * 255, 0, 255)
            const o = (y * W_ + x) * 3
            buf[o] = c
            buf[o + 1] = c
            buf[o + 2] = c
          }
        }
      }
    }
    let svg = `<svg width="${W_}" height="${H_}" xmlns="http://www.w3.org/2000/svg">`
    const stepU = view.chart.ku === 1 ? 0.02 : 10
    const stepV = 0.02
    const uConv = view.chart.ku
    for (let a = Math.ceil(view.u[0] / uConv / stepU); a * stepU * uConv <= view.u[1]; a++) {
      const major = a % 5 === 0 || (stepU === 10 && a % 3 === 0)
      const X = toX(a * stepU * uConv)
      svg += `<line x1="${X}" x2="${X}" y1="0" y2="${H_}" stroke="#0ff" stroke-width="${major ? 0.8 : 0.3}" stroke-opacity="${major ? 0.55 : 0.28}"/>`
      if (major) svg += `<text x="${X + 2}" y="11" font-size="11" fill="#0ff">${+(a * stepU).toFixed(2)}</text>`
    }
    for (let a = Math.ceil(view.v[0] / stepV); a * stepV <= view.v[1]; a++) {
      const major = a % 5 === 0
      const Yp = toY(a * stepV)
      svg += `<line y1="${Yp}" y2="${Yp}" x1="0" x2="${W_}" stroke="#ff0" stroke-width="${major ? 0.8 : 0.3}" stroke-opacity="${major ? 0.55 : 0.28}"/>`
      if (major) svg += `<text x="2" y="${Yp - 2}" font-size="11" fill="#ff0">${+(a * stepV).toFixed(2)}</text>`
    }
    let c = 0
    const ids_ = [...new Set(allParts.map((p) => p.id))]
    for (const p of allParts) {
      if (p.shape.chart !== view.chart) continue
      if (ONLY && !ONLY.has(p.id)) continue
      const color = COLORS[ids_.indexOf(p.id) % COLORS.length]
      c++
      const pts = p.shape.L.map(([u, v]) => `${toX(u).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')
      svg += `<polygon points="${pts}" fill="none" stroke="${color}" stroke-width="1.4"/>`
      const [mu, mv] = [p.shape.L.reduce((t, a) => t + a[0], 0) / p.shape.L.length, p.shape.L.reduce((t, a) => t + a[1], 0) / p.shape.L.length]
      svg += `<text x="${toX(mu) - 16}" y="${toY(mv)}" font-size="11" fill="${color}">${p.id.slice(0, 6)}.${p.name}</text>`
    }
    svg += '</svg>'
    await sharp(buf, { raw: { width: W_, height: H_, channels: 3 } }).composite([{ input: Buffer.from(svg) }]).png().toFile(path.join(MAPS, `${view.name}.png`))
    console.log(view.name, W_, H_, c, 'parts')
  }
}
