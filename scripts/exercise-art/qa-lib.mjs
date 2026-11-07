// The checks behind check.mjs, review-sheet.mjs and status.mjs: everything that can be found wrong with a pose spec without
// looking at it. No browser, no GPU: the spec is solved with rig.js and its props are built with props/*.js right here in Node.
//
//   import { createChecker } from './qa-lib.mjs'
//   const checker = await createChecker()
//   const result = checker.check(specObject)   // { slug, issues:[{level:'E'|'W', key, msg, frames, value}], errors, warnings, allowed, frames, ms }
//   console.log(formatResult(result))
//
// WHAT IS LOOKED AT. The key frames (start, mid, mid2, mid3, end, plus any other name in spec.frames) and the loop's in-betweens at
// t = 0.25, 0.5, 0.75 and the middle of each segment between key frames. In-betweens print as t.25 and so on.
//
// ISSUES, by key. E is an error (check.mjs exits 1), W a warning. Every message says the frames in brackets, worst value first.
//   reach:<limb>             E  the hand or foot can't get to its target (over 5 mm).
//   twist:<forearm>          E  forearm wrung past 110 degrees. Change the pole or the palm.
//   floor:sink, floor:float  E  under the floor (1.2 cm, fingers and toes 3 cm), or touching nothing and not marked "floats": true.
//   joint:<joint>            E  past what a human joint reaches. LIMITS below has every number, and joint:shoulder.L.rot and
//                               joint:hip.L.rot are what a flipped elbow or a backward knee shows up as.
//   prop:<type>:<body part>  E  control-mesh vertices of that body part over 2 cm inside a solid part of that prop.
//   thru:<type>:<body part>  E  a thin part of that prop (bar, cable, plate) runs over 2 cm under the skin of that body part. A thin part
//                               can't hold a vertex 2 cm deep, so it is measured the other way around, from the part into the body.
//   self:<a>:<b>             E  a vertex of body part a over 2 cm inside body part b (more for tissue that really gives, see SOFT_PAIRS).
//   bar:<type>               E  two hands on one bar whose grip axes disagree with each other or with the line through the hands.
//   grip:<armL|armR>         E  a closed hand on a straight bar, its grip axis across the bar.
//   drift:<limb>             E  a hand or foot resting on the floor or on a still prop moves 1.5 to 12 cm between two key frames, or
//                               strays over 2.5 cm in between while it has no reason to move. Past 12 cm it is taken as a real step.
//   still                    E  the spec has an end frame, yet the loop moves nothing by 1.5 cm. Give a static hold no end frame instead.
//   mode:<limb>, rel:<limb>  E  a limb changes between pos and fk, or changes its `rel`, between frames: the loop jumps there.
//   props:<...>              E  a frame's `props` don't have the same items in every frame: they can't interpolate.
//   towel:length             E  a plain towel rope changes length between frames (over 2 cm).
//   muscle:<id>              E  a muscle id paint.js doesn't know: it would paint nothing, silently.
//   prop-unknown:<type>, prop-error:<type>  E  no such prop, or its builder threw.
//   muscle:none, muscle:many, airborne       W  nothing painted, over 4 ids, or a frame touching nothing though it may be a jump.
//
// THE MEASURE. A depth is a distance along the surface normal. For a box or a cylinder the part's local bounding box or radius, in the
// mesh's own (scaled) frame. For any other geometry, which is most of the machines, the nearest surface sample and its normal: inside
// the local bounding box, a point on the wrong side of the nearest surface is inside. The body uses the same test against its own posed
// control mesh, one body part at a time: a capsule per bone would be off by 2 cm on the trunk and the thigh, which is the whole tolerance.
//
// NOT MEASURED, by design. Vertices of a closed hand against the handle in it (fingers and palm against a thin part within reach of the
// grip centre). Meshes with userData.noCollide (see small-gear.js). Anything on a body by design, WORN below, is not measured at all.
//
// EXCEPTIONS. A spec may carry "qaAllow": { "<key prefix>": "why this is right" }. An issue whose key starts with that prefix is counted
// as allowed instead of failing the check: `"prop:yoke"` allows every body part against the yoke. Say why: a reviewer reads it.
//
// TUNING. Calibrated on specs/*.json, specs/_gallery and specs/_test, then on deliberately broken specs: see LIMITS and the comments.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const HERE = path.dirname(fileURLToPath(import.meta.url))

// Some props draw a label on a canvas: all they need from it in Node is that the calls exist.
if (!globalThis.document) {
  const ctx2d = new Proxy(function () {}, {
    get(_, k) {
      if (k === 'canvas') return {}
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => ({ addColorStop() {} })
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) })
      if (k === 'measureText') return () => ({ width: 0 })
      return () => {}
    },
    set: () => true,
  })
  const canvas = () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d, addEventListener() {}, removeEventListener() {} })
  globalThis.document = { createElement: canvas, createElementNS: canvas }
}

const THREE = await import('./vendor/three.module.js')
const { Body, mixFrames } = await import('./rig.js')
const { PROPS, propErrors } = await import('./props/index.js')
const { MUSCLE_NAMES } = await import('./paint.js')

const { Vector3: V3, Quaternion: Q4 } = THREE
const D = 180 / Math.PI
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const cm = (m) => (m * 100).toFixed(1)
const deg = (x) => Math.round(x)

// ------------------------------------------------------------------------------------------------------------------- thresholds

export const DEPTH_ERROR = 0.02
const REACH_ERROR = 0.005
const DRIFT_MIN = 0.015
const DRIFT_MAX = 0.12
const DRIFT_BETWEEN = 0.025
const STILL = 0.015
const CONTACT_GAP = 0.03

/** Degrees. Measured the way a physiotherapist does, with some room: this catches what no body can do, not what is merely hard. */
export const LIMITS = {
  elbow: 152, // 0 is straight. The rig can't bend one backward.
  knee: 165, // 0 is straight. Heel to buttock.
  wristExt: 100, // A flat hand under a straight arm is 90.
  wristFlex: 95,
  wristUlnar: 50,
  wristRadial: 35,
  forearmTwist: 110,
  neck: { flex: 65, ext: 70, side: 50, twist: 90 },
  spine: { flex: 115, ext: 65, side: 55, twist: 75, segment: 38 }, // whole spine, and the most one of its 5 joints may take
  scap: { elevMax: 50, elevMin: -14, prot: 34 },
  anklePlantar: 80,
  ankleDorsi: 50,
  ankleRoll: 45,
  toeExt: 95,
}

/**
 * Where an upper arm or a thigh can point, seen from the chest or the pelvis. plane: 0 out to the side, 90 forward, 180 across to the
 * other side, -90 straight back. An elevation (0 hanging, 180 overhead) between lo and hi is out of reach in that plane. Linear in between.
 */
const SHOULDER_FORBIDDEN = [
  // plane, lo, hi
  [-180, 62, 140],
  [-135, 70, 158],
  [-90, 88, 165],
  [-60, 112, 160],
  [-35, 150, 165],
  [0, 400, 400],
  [90, 400, 400],
  [125, 400, 400],
  [150, 112, 135],
  [180, 62, 140],
]
const HIP_FORBIDDEN = [
  [-180, 50, 400],
  [-135, 58, 400],
  [-90, 50, 400],
  [-45, 95, 400],
  [0, 112, 400],
  [45, 140, 400],
  [90, 150, 400],
  [135, 132, 400],
  [180, 50, 400],
]
/**
 * How far an upper arm may be turned around its own length, by where it points. The measure is the angle of the bent forearm from the
 * direction it keeps when the arm swings there straight from out to the side with the forearm forward; + is external rotation, forearm
 * toward the ceiling when the arm is out to the side. Below 25 degrees of elbow the forearm says nothing, so nothing is measured.
 *   [lateral, up, forward] of the arm's direction, lowest and highest. In between: weighted by closeness.
 */
const SHOULDER_ROT = [
  [[0, -1, 0], -140, 110], // hanging. 0 is forearm forward, -90 across the belly, past that behind the back; 90 pointing out.
  [[1, 0, 0], -110, 140], // out to the side. 90 forearm up, -90 forearm down.
  [[0, 0, 1], -120, 160], // forward. 0 forearm across the chest, 90 forearm up, -90 forearm down.
  [[0, 1, 0], 25, 250], // overhead. 90 forearm over the head, 180 behind it.
  [[0, -0.6, -0.8], -150, 60], // behind the trunk, as at the top of a row. -90 points the forearm down.
  [[0.7, 0.7, 0], -40, 190],
  [[0, 0.7, 0.7], -60, 215],
]
/** A hip's rotation, by the shin's direction against the one it has with the knee straight ahead; + is external, knee out and foot in. */
const HIP_ROT = { ext: 100, int: 70 }

/** Worn or wrapped around the body: touching it is the point. Nothing of these is measured. */
const WORN = new Set(['harness', 'neck-harness', 'ankle-weight', 'dip-belt', 'knee-pad', 'stretch-strap', 'sled-straps', 'band', 'band-tube', 'bar-bands', 'towel-strip', 'towel', 'jump-rope', 'chains', 'climb-rope', 'battling-ropes'])

/** Tissue that really gives where two parts press together, and how deep it may go. Everything else is DEPTH_ERROR. */
const SOFT_PAIRS = [
  ['thigh', 'abdomen', 0.09],
  ['thigh', 'chest', 0.07],
  ['shin', 'pelvis', 0.04],
  ['foot', 'pelvis', 0.035],
  ['upperarm', 'abdomen', 0.035],
  ['upperarm', 'neck', 0.035],
  ['upperarm', 'head', 0.03],
  ['thigh', 'thigh', 0.03],
  ['shin', 'shin', 0.03],
  ['forearm', 'chest', 0.03],
  ['forearm', 'upperarm', 0.05],
]

const FOLLOW_KEYS = ['hand', 'hands', 'foot', 'feet', 'follow']
const isDynamic = (p) => FOLLOW_KEYS.some((k) => p[k] !== undefined)

// ------------------------------------------------------------------------------------------------------------------- spatial grid

/** A uniform grid over points, for nearest-point queries. */
class Grid {
  constructor(coords, count, cell, ids = null) {
    this.coords = coords
    this.ids = ids
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
    for (let i = 0; i < count; i++) {
      const j = (ids ? ids[i] : i) * 3
      const x = coords[j], y = coords[j + 1], z = coords[j + 2]
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (z < minZ) minZ = z
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
      if (z > maxZ) maxZ = z
    }
    // A long diagonal part must not allocate a huge empty grid.
    let c = cell
    let nx, ny, nz
    for (;;) {
      nx = Math.floor((maxX - minX) / c) + 1
      ny = Math.floor((maxY - minY) / c) + 1
      nz = Math.floor((maxZ - minZ) / c) + 1
      if (nx * ny * nz <= 300000) break
      c *= 1.5
    }
    this.cell = c
    this.minX = minX
    this.minY = minY
    this.minZ = minZ
    this.nx = nx
    this.ny = ny
    this.nz = nz
    this.head = new Int32Array(nx * ny * nz).fill(-1)
    this.next = new Int32Array(count)
    for (let i = 0; i < count; i++) {
      const j = (ids ? ids[i] : i) * 3
      const k = Math.floor((coords[j] - minX) / c) + nx * (Math.floor((coords[j + 1] - minY) / c) + ny * Math.floor((coords[j + 2] - minZ) / c))
      this.next[i] = this.head[k]
      this.head[k] = i
    }
    this.best = -1
    this.bestD2 = Infinity
  }

  /** Sets this.best (the point's index in coords) and this.bestD2. false when nothing lies within maxR. */
  nearest(x, y, z, maxR) {
    const { cell, nx, ny, nz, head, next, coords, ids } = this
    const ix = Math.floor((x - this.minX) / cell)
    const iy = Math.floor((y - this.minY) / cell)
    const iz = Math.floor((z - this.minZ) / cell)
    let best = -1
    let bestD2 = maxR * maxR
    const R = Math.ceil(maxR / cell) + 1
    const visit = (k) => {
      for (let i = head[k]; i >= 0; i = next[i]) {
        const id = ids ? ids[i] : i
        const j = id * 3
        const dx = coords[j] - x, dy = coords[j + 1] - y, dz = coords[j + 2] - z
        const d2 = dx * dx + dy * dy + dz * dz
        if (d2 < bestD2) {
          bestD2 = d2
          best = id
        }
      }
    }
    for (let r = 0; r <= R; r++) {
      const z0 = Math.max(0, iz - r), z1 = Math.min(nz - 1, iz + r)
      const y0 = Math.max(0, iy - r), y1 = Math.min(ny - 1, iy + r)
      for (let cz = z0; cz <= z1; cz++) {
        const edgeZ = cz === iz - r || cz === iz + r
        for (let cy = y0; cy <= y1; cy++) {
          const edgeY = cy === iy - r || cy === iy + r
          const row = nx * (cy + ny * cz)
          if (edgeZ || edgeY) {
            const x0 = Math.max(0, ix - r), x1 = Math.min(nx - 1, ix + r)
            for (let cx = x0; cx <= x1; cx++) visit(row + cx)
          } else {
            if (ix - r >= 0 && ix - r < nx) visit(row + ix - r)
            if (r > 0 && ix + r >= 0 && ix + r < nx) visit(row + ix + r)
          }
        }
      }
      // Whatever lies further out is at least r cells away.
      if (best >= 0 && bestD2 <= r * cell * r * cell) break
    }
    this.best = best
    this.bestD2 = bestD2
    return best >= 0
  }
}

/**
 * How far a point lies under the surface of a set of points with normals. 0 when it is outside, or when its nearest surface point is off
 * to one side, which is what a point past the open end of a limb's segment looks like.
 */
function depthUnder(grid, normals, x, y, z, maxR) {
  if (!grid.nearest(x, y, z, maxR)) return 0
  const j = grid.best * 3
  const c = grid.coords
  const dx = x - c[j], dy = y - c[j + 1], dz = z - c[j + 2]
  const d = dx * normals[j] + dy * normals[j + 1] + dz * normals[j + 2]
  if (d >= 0) return 0
  if (-d < 0.6 * Math.sqrt(grid.bestD2)) return 0
  return -d
}

// ------------------------------------------------------------------------------------------------------------------- prop parts

/** What a mesh's geometry is worth for collisions, cached per geometry and per scale: samples of its surface, normals, a grid. */
const meshShapes = new WeakMap()

function meshShape(geometry, sx, sy, sz) {
  let perScale = meshShapes.get(geometry)
  if (!perScale) meshShapes.set(geometry, (perScale = new Map()))
  const key = `${sx.toFixed(4)},${sy.toFixed(4)},${sz.toFixed(4)}`
  let shape = perScale.get(key)
  if (!shape) perScale.set(key, (shape = new MeshShape(geometry, sx, sy, sz)))
  return shape
}

class MeshShape {
  constructor(geometry, sx, sy, sz) {
    const p = geometry.attributes.position
    if (!geometry.attributes.normal) geometry.computeVertexNormals()
    const n = geometry.attributes.normal
    const index = geometry.index ? geometry.index.array : null
    const triCount = (index ? index.length : p.count) / 3
    const n2 = (x) => x
    // Scaled copies.
    const P = new Float32Array(p.count * 3)
    const N = new Float32Array(p.count * 3)
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) * sx, y = p.getY(i) * sy, z = p.getZ(i) * sz
      P[i * 3] = x
      P[i * 3 + 1] = y
      P[i * 3 + 2] = z
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (z < minZ) minZ = z
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
      if (z > maxZ) maxZ = z
      const nx = n.getX(i) / (sx || 1), ny = n.getY(i) / (sy || 1), nz = n.getZ(i) / (sz || 1)
      const l = Math.hypot(nx, ny, nz) || 1
      N[i * 3] = nx / l
      N[i * 3 + 1] = ny / l
      N[i * 3 + 2] = nz / l
    }
    this.min = [minX, minY, minZ]
    this.max = [maxX, maxY, maxZ]
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2
    // Volume and area: a long bent rod has a big bounding box and no room in it for anything 2 cm deep.
    let vol = 0
    let area = 0
    const big = []
    for (let t = 0; t < triCount; t++) {
      const a = index ? index[t * 3] : t * 3
      const b = index ? index[t * 3 + 1] : t * 3 + 1
      const c = index ? index[t * 3 + 2] : t * 3 + 2
      const ax = P[a * 3] - cx, ay = P[a * 3 + 1] - cy, az = P[a * 3 + 2] - cz
      const bx = P[b * 3] - cx, by = P[b * 3 + 1] - cy, bz = P[b * 3 + 2] - cz
      const ex = P[c * 3] - cx, ey = P[c * 3 + 1] - cy, ez = P[c * 3 + 2] - cz
      vol += (ax * (by * ez - bz * ey) + ay * (bz * ex - bx * ez) + az * (bx * ey - by * ex)) / 6
      const ux = bx - ax, uy = by - ay, uz = bz - az
      const vx = ex - ax, vy = ey - ay, vz = ez - az
      area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2
      const maxEdge = Math.max(ux * ux + uy * uy + uz * uz, vx * vx + vy * vy + vz * vz, (ux - vx) ** 2 + (uy - vy) ** 2 + (uz - vz) ** 2)
      if (maxEdge > 0.03 * 0.03) big.push(a, b, c, Math.sqrt(maxEdge))
    }
    this.volume = Math.abs(vol)
    this.area = area
    const v3 = 3 * this.volume / (area || 1)
    const size = [maxX - minX, maxY - minY, maxZ - minZ]
    const minSize = Math.min(...size)
    /** The deepest anything can be inside it. A convex shape's inscribed radius is at most 3V/A. */
    this.room = Math.min(v3, minSize / 2)
    /** About half its thickness, for a part measured from its surface into the body. */
    this.half = Math.min((2 * this.volume) / (area || 1), minSize / 2)

    // The surface samples: the vertices, thinned out, and points inside the big triangles.
    const longest = Math.max(...size)
    const cell = clamp(longest / 90, 0.009, 0.03)
    const seen = new Set()
    const xs = []
    const ns = []
    const add = (x, y, z, a, b, c) => {
      const k = Math.floor((x - minX) / cell) + 4096 * (Math.floor((y - minY) / cell) + 4096 * Math.floor((z - minZ) / cell))
      if (seen.has(k)) return
      seen.add(k)
      xs.push(x, y, z)
      ns.push(a, b, c)
    }
    for (let i = 0; i < p.count; i++) add(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], N[i * 3], N[i * 3 + 1], N[i * 3 + 2])
    for (let t = 0; t < big.length; t += 4) {
      const [a, b, c, edge] = [big[t], big[t + 1], big[t + 2], big[t + 3]]
      const steps = Math.min(40, Math.ceil(edge / Math.max(cell, 0.02)))
      for (let i = 0; i <= steps; i++) {
        for (let j = 0; j <= steps - i; j++) {
          const u = i / steps, v = j / steps, w = 1 - u - v
          add(
            w * P[a * 3] + u * P[b * 3] + v * P[c * 3],
            w * P[a * 3 + 1] + u * P[b * 3 + 1] + v * P[c * 3 + 1],
            w * P[a * 3 + 2] + u * P[b * 3 + 2] + v * P[c * 3 + 2],
            w * N[a * 3] + u * N[b * 3] + v * N[c * 3],
            w * N[a * 3 + 1] + u * N[b * 3 + 1] + v * N[c * 3 + 1],
            w * N[a * 3 + 2] + u * N[b * 3 + 2] + v * N[c * 3 + 2],
          )
        }
      }
    }
    this.samples = Float32Array.from(xs)
    this.normals = Float32Array.from(ns)
    this.count = xs.length / 3
    // Winding differs between builders; a closed solid's normals, on the whole, point away from its middle.
    let out = 0
    for (let i = 0; i < this.count; i++) {
      const j = i * 3
      out += (xs[j] - cx) * ns[j] + (xs[j + 1] - cy) * ns[j + 1] + (xs[j + 2] - cz) * ns[j + 2]
    }
    if (out < 0) for (let i = 0; i < this.normals.length; i++) this.normals[i] = -this.normals[i]
    this.grid = null
    void n2
  }

  /** Signed distance of a point in the scaled local frame from this surface, + outside. Infinity when no surface lies within maxR. */
  signed(x, y, z, maxR) {
    if (!this.grid) this.grid = new Grid(this.samples, this.count, 0.02)
    if (!this.grid.nearest(x, y, z, maxR)) return Infinity
    const j = this.grid.best * 3
    const c = this.samples
    const n = this.normals
    const dx = x - c[j], dy = y - c[j + 1], dz = z - c[j + 2]
    const d = dx * n[j] + dy * n[j + 1] + dz * n[j + 2]
    if (d < 0 && -d < 0.6 * Math.sqrt(this.grid.bestD2)) return 0
    return d
  }
}

function isNoCollide(o) {
  for (let p = o; p; p = p.parent) if (p.userData && p.userData.noCollide) return true
  return false
}

const short = (x) => {
  const s = x.toFixed(2)
  return s.startsWith('0.') ? s.slice(1) : s.startsWith('-0.') ? '-' + s.slice(2) : s
}

class Part {
  constructor(o, type, propIndex) {
    const g = o.geometry
    const e = o.matrixWorld.elements
    const sx = Math.hypot(e[0], e[1], e[2]) || 1e-9
    const sy = Math.hypot(e[4], e[5], e[6]) || 1e-9
    const sz = Math.hypot(e[8], e[9], e[10]) || 1e-9
    this.type = type
    this.propIndex = propIndex
    this.R = [e[0] / sx, e[1] / sx, e[2] / sx, e[4] / sy, e[5] / sy, e[6] / sy, e[8] / sz, e[9] / sz, e[10] / sz]
    this.t = [e[12], e[13], e[14]]
    this.sx = sx
    this.sy = sy
    this.sz = sz
    const hint = o.userData && o.userData.collide
    const params = g.parameters || {}
    if (hint && hint.kind === 'sphere') {
      this.kind = 'sphere'
      this.c = hint.c.map((x, i) => x * [sx, sy, sz][i])
      this.r = hint.r * sx
      this.half = [this.r, this.r, this.r]
    } else if (hint && hint.kind === 'cylinder') {
      this.kind = 'cyl'
      const ax = 'xyz'.indexOf(hint.axis || 'y')
      this.axis = ax
      this.c = hint.c.map((x, i) => x * [sx, sy, sz][i])
      this.r0 = this.r1 = hint.r * [sy, sx, sx][ax]
      this.h = hint.h * [sx, sy, sz][ax]
    } else if (g.type === 'BoxGeometry') {
      this.kind = 'box'
      if (!g.boundingBox) g.computeBoundingBox()
      const b = g.boundingBox
      this.c = [((b.min.x + b.max.x) / 2) * sx, ((b.min.y + b.max.y) / 2) * sy, ((b.min.z + b.max.z) / 2) * sz]
      this.half = [((b.max.x - b.min.x) / 2) * sx, ((b.max.y - b.min.y) / 2) * sy, ((b.max.z - b.min.z) / 2) * sz]
    } else if (g.type === 'CylinderGeometry') {
      this.kind = 'cyl'
      this.axis = 1
      this.c = [0, 0, 0]
      this.r0 = params.radiusBottom * sx
      this.r1 = params.radiusTop * sx
      this.h = params.height * sy
    } else if (g.type === 'SphereGeometry' && (params.phiLength ?? 7) > 6.2 && (params.thetaLength ?? 4) > 3.1) {
      this.kind = 'sphere'
      this.c = [0, 0, 0]
      this.r = params.radius * sx
      this.half = [this.r, this.r, this.r]
    } else {
      this.kind = 'mesh'
      if (!g.boundingBox) g.computeBoundingBox()
      const b = g.boundingBox
      this.c = [((b.min.x + b.max.x) / 2) * sx, ((b.min.y + b.max.y) / 2) * sy, ((b.min.z + b.max.z) / 2) * sz]
      this.half = [((b.max.x - b.min.x) / 2) * sx, ((b.max.y - b.min.y) / 2) * sy, ((b.max.z - b.min.z) / 2) * sz]
      this.geometry = g
    }
    if (this.kind === 'cyl') {
      const r = Math.max(this.r0, this.r1)
      this.half = this.axis === 0 ? [this.h / 2, r, r] : this.axis === 1 ? [r, this.h / 2, r] : [r, r, this.h / 2]
    }
    // The world bounding box.
    const [hx, hy, hz] = this.half
    const R = this.R
    const c = this.toWorld(this.c[0], this.c[1], this.c[2])
    const ex = Math.abs(R[0]) * hx + Math.abs(R[3]) * hy + Math.abs(R[6]) * hz
    const ey = Math.abs(R[1]) * hx + Math.abs(R[4]) * hy + Math.abs(R[7]) * hz
    const ez = Math.abs(R[2]) * hx + Math.abs(R[5]) * hy + Math.abs(R[8]) * hz
    this.centre = c
    this.box = [c[0] - ex, c[1] - ey, c[2] - ez, c[0] + ex, c[1] + ey, c[2] + ez]
    this.minHalf = Math.min(hx, hy, hz)
  }

  toWorld(x, y, z) {
    const R = this.R
    const t = this.t
    return [t[0] + R[0] * x + R[3] * y + R[6] * z, t[1] + R[1] * x + R[4] * y + R[7] * z, t[2] + R[2] * x + R[5] * y + R[8] * z]
  }

  get shape() {
    if (this.kind !== 'mesh') return null
    if (!this._shape) this._shape = meshShape(this.geometry, this.sx, this.sy, this.sz)
    return this._shape
  }

  /** The most that anything can lie inside this part. */
  get room() {
    if (this.kind === 'mesh') return this.shape.room
    if (this.kind === 'cyl') return Math.min(Math.max(this.r0, this.r1), this.h / 2)
    return this.minHalf
  }

  label() {
    const kind = { box: 'box', cyl: 'cylinder', sphere: 'sphere', mesh: 'part' }[this.kind]
    const [hx, hy, hz] = this.half
    const sizes = this.kind === 'cyl' ? `r${short(Math.max(this.r0, this.r1))} h${short(this.h)}` : this.kind === 'sphere' ? `r${short(this.r)}` : `${short(hx * 2)}x${short(hy * 2)}x${short(hz * 2)}`
    return `${kind} ${sizes} @[${short(this.centre[0])},${short(this.centre[1])},${short(this.centre[2])}]`
  }

  /**
   * Signed distance from the surface, + outside. World coordinates. A box and a cylinder measure outside too; a general mesh only
   * within maxR, Infinity beyond that.
   */
  signed(wx, wy, wz, maxR = 0.2) {
    const R = this.R
    const tx = wx - this.t[0], ty = wy - this.t[1], tz = wz - this.t[2]
    const x = R[0] * tx + R[1] * ty + R[2] * tz
    const y = R[3] * tx + R[4] * ty + R[5] * tz
    const z = R[6] * tx + R[7] * ty + R[8] * tz
    switch (this.kind) {
      case 'box': {
        const dx = Math.abs(x - this.c[0]) - this.half[0]
        const dy = Math.abs(y - this.c[1]) - this.half[1]
        const dz = Math.abs(z - this.c[2]) - this.half[2]
        if (dx <= 0 && dy <= 0 && dz <= 0) return Math.max(dx, dy, dz)
        return Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0))
      }
      case 'cyl': {
        const ax = this.axis
        const along = (ax === 0 ? x : ax === 1 ? y : z) - this.c[ax]
        const a = ax === 0 ? y - this.c[1] : x - this.c[0]
        const b = ax === 2 ? y - this.c[1] : z - this.c[2]
        const radial = Math.hypot(a, b)
        const f = clamp(along / this.h + 0.5, 0, 1)
        const r = this.r0 + (this.r1 - this.r0) * f
        const dr = radial - r
        const dh = Math.abs(along) - this.h / 2
        if (dr <= 0 && dh <= 0) return Math.max(dr, dh)
        return Math.hypot(Math.max(dr, 0), Math.max(dh, 0))
      }
      case 'sphere':
        return Math.hypot(x - this.c[0], y - this.c[1], z - this.c[2]) - this.r
      default: {
        const s = this.shape
        // Only inside the bounding box is the wrong side of the surface inside: past an open edge there's nothing.
        const inBox = Math.abs(x - this.c[0]) <= this.half[0] && Math.abs(y - this.c[1]) <= this.half[1] && Math.abs(z - this.c[2]) <= this.half[2]
        const d = s.signed(x, y, z, maxR)
        return inBox ? d : Math.abs(d)
      }
    }
  }

  /** Points on this part's middle line or sheet, or surface samples, to test against the body. */
  samplesInWorld() {
    if (this._samples) return this._samples
    const pts = []
    const add = (x, y, z) => pts.push(...this.toWorld(x, y, z))
    if (this.kind === 'cyl') {
      const n = Math.max(1, Math.min(160, Math.ceil(this.h / 0.015)))
      for (let i = 0; i <= n; i++) {
        const a = (i / n - 0.5) * this.h
        add(this.c[0] + (this.axis === 0 ? a : 0), this.c[1] + (this.axis === 1 ? a : 0), this.c[2] + (this.axis === 2 ? a : 0))
      }
    } else if (this.kind === 'box') {
      // The sheet through the box's two longest sides.
      const order = [0, 1, 2].sort((p, q) => this.half[q] - this.half[p])
      const [u, v] = order
      const nu = Math.max(1, Math.min(100, Math.ceil((this.half[u] * 2) / 0.02)))
      const nv = Math.max(1, Math.min(100, Math.ceil((this.half[v] * 2) / 0.02)))
      for (let i = 0; i <= nu; i++) {
        for (let j = 0; j <= nv; j++) {
          const q = [this.c[0], this.c[1], this.c[2]]
          q[u] += (i / nu - 0.5) * this.half[u] * 2
          q[v] += (j / nv - 0.5) * this.half[v] * 2
          add(q[0], q[1], q[2])
        }
      }
    } else if (this.kind === 'sphere') {
      add(this.c[0], this.c[1], this.c[2])
    } else {
      const s = this.shape
      for (let i = 0; i < s.count; i++) add(s.samples[i * 3], s.samples[i * 3 + 1], s.samples[i * 3 + 2])
    }
    this._samples = pts
    return pts
  }

  /** Half the thickness that lies between a sample and the part's own surface, already in the depth a surface sample shows. */
  get sampleOffset() {
    return this.kind === 'mesh' ? this.shape.half : 0
  }

  /** The direction this part runs in, for a straight bar: world unit vector, or null if it is no long thin thing. */
  barAxis() {
    const h = this.half
    const order = [0, 1, 2].sort((a, b) => h[b] - h[a])
    if (h[order[1]] > 0.045) return null
    if (h[order[0]] < 3 * h[order[1]]) return null
    if (this.kind === 'mesh') {
      // A bent tube fills little of its bounding box; a straight one about pi/4 of it.
      const box = 8 * h[0] * h[1] * h[2]
      if (this.shape.volume < 0.45 * box) return null
    }
    const k = order[0] * 3
    return [this.R[k], this.R[k + 1], this.R[k + 2]]
  }

  distanceToAxis(wx, wy, wz) {
    const h = this.half
    const order = [0, 1, 2].sort((a, b) => h[b] - h[a])
    const R = this.R
    const tx = wx - this.t[0], ty = wy - this.t[1], tz = wz - this.t[2]
    const l = [R[0] * tx + R[1] * ty + R[2] * tz, R[3] * tx + R[4] * ty + R[5] * tz, R[6] * tx + R[7] * ty + R[8] * tz]
    const a = order[0]
    const u = order[1]
    const v = order[2]
    const along = Math.max(0, Math.abs(l[a] - this.c[a]) - h[a])
    return Math.hypot(l[u] - this.c[u], l[v] - this.c[v], along)
  }
}

function partsOf(group, type, propIndex) {
  const parts = []
  group.updateMatrixWorld(true)
  group.traverse((o) => {
    if (!o.isMesh || o.visible === false) return
    if (!o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return
    if (isNoCollide(o)) return
    // A big merged frame is not a solid: its bounding box says nothing about what is inside it.
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox()
    const size = o.geometry.boundingBox.getSize(new THREE.Vector3())
    if (Math.min(size.x, size.y, size.z) > 0.3 && !/Box|Cylinder|Sphere/.test(o.geometry.type)) return
    parts.push(new Part(o, type, propIndex))
  })
  return parts
}

function buildProp(p, ctx, index) {
  const make = PROPS[p.type]
  if (!make) {
    const broken = propErrors.filter((e) => !/not loaded/.test(e))
    return { error: `unknown prop "${p.type}"${broken.length ? ` (a prop module is broken, maybe mid-edit: ${broken[0].split('\n')[0]})` : ''}`, code: 'prop-unknown' }
  }
  let g
  try {
    g = make(p, ctx)
  } catch (e) {
    return { error: `the builder of "${p.type}" threw: ${e.message}`, code: 'prop-error' }
  }
  if (!g.userData.world) {
    const q = p.pos || [0, 0, 0]
    g.position.set(q[0], q[1], q[2])
    g.rotation.y = ((p.yaw || 0) * Math.PI) / 180
  }
  return { parts: partsOf(g, p.type, index) }
}

// ------------------------------------------------------------------------------------------------------------------- the body

const SEGMENT_OF_BONE = (name) => {
  const side = name.endsWith('.L') ? '.L' : name.endsWith('.R') ? '.R' : ''
  if (/^(root|pelvis)/.test(name)) return 'pelvis'
  if (/^spine0[345]/.test(name)) return 'abdomen'
  if (/^(spine0[12]|clavicle|shoulder)/.test(name)) return 'chest'
  if (/^neck/.test(name)) return 'neck'
  if (name === 'head' || /^(jaw|eye|tongue)/.test(name)) return 'head'
  if (/^upperarm/.test(name)) return 'upperarm' + side
  if (/^lowerarm/.test(name)) return 'forearm' + side
  if (/^(wrist|metacarpal)/.test(name)) return 'palm' + side
  if (/^finger/.test(name)) return 'fingers' + side
  if (/^upperleg/.test(name)) return 'thigh' + side
  if (/^lowerleg/.test(name)) return 'shin' + side
  if (/^foot/.test(name)) return 'foot' + side
  if (/^toe/.test(name)) return 'toes' + side
  return 'chest'
}

/** Segments that share a joint: their skin is continuous, so "inside" means nothing there. */
const ADJACENT = [
  ['head', 'neck'],
  ['neck', 'chest'],
  ['chest', 'abdomen'],
  ['abdomen', 'pelvis'],
  ...['.L', '.R'].flatMap((s) => [
    ['chest', 'upperarm' + s],
    ['upperarm' + s, 'forearm' + s],
    ['forearm' + s, 'palm' + s],
    ['palm' + s, 'fingers' + s],
    ['pelvis', 'thigh' + s],
    ['thigh' + s, 'shin' + s],
    ['shin' + s, 'foot' + s],
    ['foot' + s, 'toes' + s],
  ]),
]

class QABody extends Body {
  constructor(data) {
    super(data)
    this.segNames = []
    const segIndex = new Map()
    const boneSeg = this.bones.map((b) => {
      const s = SEGMENT_OF_BONE(b.name)
      if (!segIndex.has(s)) {
        segIndex.set(s, this.segNames.length)
        this.segNames.push(s)
      }
      return segIndex.get(s)
    })
    this.segOf = new Uint8Array(this.ctlN)
    const lists = this.segNames.map(() => [])
    for (let k = 0; k < this.ctlN; k++) {
      const s = boneSeg[this.skinB[k * this.maxInf]]
      this.segOf[k] = s
      lists[s].push(k)
    }
    this.segVerts = lists.map((l) => Int32Array.from(l))
    this.segIndex = segIndex
    // The pairs to compare, with how deep each may go.
    const adjacent = new Set(ADJACENT.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]))
    this.pairs = []
    const base = (n) => n.split('.')[0]
    for (let i = 0; i < this.segNames.length; i++) {
      for (let j = 0; j < this.segNames.length; j++) {
        if (i === j) continue
        const a = this.segNames[i]
        const b = this.segNames[j]
        if (adjacent.has(`${a}|${b}`)) continue
        let limit = DEPTH_ERROR
        for (const [p, q, d] of SOFT_PAIRS) {
          // A forearm against the upper arm of the other side is no fold, so that one only holds on the same side.
          const sameSideOnly = p === 'forearm' && q === 'upperarm'
          if (((base(a) === p && base(b) === q) || (base(a) === q && base(b) === p)) && (!sameSideOnly || a.slice(-2) === b.slice(-2))) limit = d
        }
        this.pairs.push([i, j, limit])
      }
    }
    this.quads = Int32Array.from(data.quads)
    this.normals_ = new Float32Array(this.ctlN * 3)
    this.segBox = new Float32Array(this.segNames.length * 6)
    this.grids = new Array(this.segNames.length).fill(null)
    this.bodyBox = new Float32Array(6)
    this.normalSign = 1
    // Winding: decide once, on the rest pose, that normals point out.
    this.ctlPos.set(this.ctlRest)
    this._normals()
    const list = this.segVerts[segIndex.get('thigh.L')]
    const rest = this.ctlRest
    let cx = 0, cy = 0, cz = 0
    for (const k of list) {
      cx += rest[k * 3]
      cy += rest[k * 3 + 1]
      cz += rest[k * 3 + 2]
    }
    cx /= list.length
    cy /= list.length
    cz /= list.length
    let out = 0
    for (const k of list) out += (rest[k * 3] - cx) * this.normals_[k * 3] + (rest[k * 3 + 1] - cy) * this.normals_[k * 3 + 1] + (rest[k * 3 + 2] - cz) * this.normals_[k * 3 + 2]
    if (out < 0) this.normalSign = -1
  }

  _skin(Q, P) {
    this.Q = Q
    this.P = P
    super._skin(Q, P)
  }

  _normals() {
    const { quads, ctlPos: p, normals_: n, normalSign } = this
    n.fill(0)
    for (let i = 0; i < quads.length; i += 4) {
      const a = quads[i] * 3, b = quads[i + 1] * 3, c = quads[i + 2] * 3, d = quads[i + 3] * 3
      const ux = p[c] - p[a], uy = p[c + 1] - p[a + 1], uz = p[c + 2] - p[a + 2]
      const vx = p[d] - p[b], vy = p[d + 1] - p[b + 1], vz = p[d + 2] - p[b + 2]
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
      n[a] += nx; n[a + 1] += ny; n[a + 2] += nz
      n[b] += nx; n[b + 1] += ny; n[b + 2] += nz
      n[c] += nx; n[c + 1] += ny; n[c + 2] += nz
      n[d] += nx; n[d + 1] += ny; n[d + 2] += nz
    }
    for (let k = 0; k < n.length; k += 3) {
      const l = (Math.hypot(n[k], n[k + 1], n[k + 2]) || 1) * normalSign
      n[k] /= l
      n[k + 1] /= l
      n[k + 2] /= l
    }
  }

  /** Call right after solve(): normals, the boxes, and no grids yet. */
  preparePose() {
    this._normals()
    const p = this.ctlPos
    const B = this.segBox
    const all = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
    for (let s = 0; s < this.segNames.length; s++) {
      let a = Infinity, b = Infinity, c = Infinity, d = -Infinity, e = -Infinity, f = -Infinity
      for (const k of this.segVerts[s]) {
        const x = p[k * 3], y = p[k * 3 + 1], z = p[k * 3 + 2]
        if (x < a) a = x
        if (y < b) b = y
        if (z < c) c = z
        if (x > d) d = x
        if (y > e) e = y
        if (z > f) f = z
      }
      B.set([a, b, c, d, e, f], s * 6)
      all[0] = Math.min(all[0], a)
      all[1] = Math.min(all[1], b)
      all[2] = Math.min(all[2], c)
      all[3] = Math.max(all[3], d)
      all[4] = Math.max(all[4], e)
      all[5] = Math.max(all[5], f)
      this.grids[s] = null
    }
    this.bodyBox.set(all)
  }

  grid(s) {
    if (!this.grids[s]) this.grids[s] = new Grid(this.ctlPos, this.segVerts[s].length, 0.03, this.segVerts[s])
    return this.grids[s]
  }

  /** The deepest a world point lies under the skin of any body part, except the masked ones. Sets lastSeg. */
  depthInBody(x, y, z, skip) {
    const B = this.segBox
    let best = 0
    this.lastSeg = -1
    for (let s = 0; s < this.segNames.length; s++) {
      if (skip && skip[s]) continue
      const o = s * 6
      if (x < B[o] || y < B[o + 1] || z < B[o + 2] || x > B[o + 3] || y > B[o + 4] || z > B[o + 5]) continue
      const d = depthUnder(this.grid(s), this.normals_, x, y, z, 0.16)
      if (d > best) {
        best = d
        this.lastSeg = s
      }
    }
    return best
  }
}

const overlap = (a, b, ao = 0, bo = 0, m = 0) => a[ao] <= b[bo + 3] + m && a[ao + 3] >= b[bo] - m && a[ao + 1] <= b[bo + 4] + m && a[ao + 4] >= b[bo + 1] - m && a[ao + 2] <= b[bo + 5] + m && a[ao + 5] >= b[bo + 2] - m

// ------------------------------------------------------------------------------------------------------------------- joints

const interp = (table, x) => {
  // table: rows [x, a, b], x ascending.
  if (x <= table[0][0]) return [table[0][1], table[0][2]]
  for (let i = 0; i + 1 < table.length; i++) {
    const r = table[i]
    const s = table[i + 1]
    if (x <= s[0]) {
      const t = (x - r[0]) / (s[0] - r[0])
      return [r[1] + (s[1] - r[1]) * t, r[2] + (s[2] - r[2]) * t]
    }
  }
  const l = table[table.length - 1]
  return [l[1], l[2]]
}

const twistOf = (q, axis) => {
  const d = q.x * axis.x + q.y * axis.y + q.z * axis.z
  let a = 2 * Math.atan2(d, q.w)
  if (a > Math.PI) a -= 2 * Math.PI
  if (a < -Math.PI) a += 2 * Math.PI
  return a * D
}

const X = new V3(1, 0, 0)
const Y = new V3(0, 1, 0)
const Z = new V3(0, 0, 1)

/** All joint angles of the pose just solved, for the checks and for calibrating them. */
export function measureJoints(body, frame, report) {
  const { Q, P, by } = body
  const out = { angles: {} }
  const a = out.angles
  const sp = frame.spine || {}
  const w = sp.weights || [0.2, 0.2, 0.2, 0.2, 0.2]
  const sum = w.reduce((t, x) => t + x, 0)
  a.spineFlex = (sp.flex || 0) * sum
  a.spineSide = (sp.side || 0) * sum
  a.spineTwist = (sp.twist || 0) * sum
  a.spineSegment = Math.max(...w.map((x) => x * Math.hypot(sp.flex || 0, sp.side || 0, sp.twist || 0)))
  const nk = frame.neck || {}
  a.neckFlex = nk.flex || 0
  a.neckSide = nk.side || 0
  a.neckTwist = nk.twist || 0
  const QcI = Q[by.spine01.i].clone().invert()
  const QpI = Q[by.root.i].clone().invert()
  for (const s of ['L', 'R']) {
    const mirror = s === 'L' ? 1 : -1
    const inFrame = (v, qi) => {
      const u = v.clone().applyQuaternion(qi)
      u.x *= mirror
      return u.normalize()
    }
    // Shoulder.
    const S = P[by[`upperarm01.${s}`].i]
    const E = P[by[`lowerarm01.${s}`].i]
    const W = P[by[`wrist.${s}`].i]
    const h = inFrame(E.clone().sub(S), QcI)
    const f = inFrame(W.clone().sub(E), QcI)
    a[`elbow${s}`] = report.angles[`elbow${s}`]
    a[`shoulderElev${s}`] = Math.acos(clamp(-h.y, -1, 1)) * D
    a[`shoulderPlane${s}`] = Math.atan2(h.z, h.x) * D
    a[`shoulderDir${s}`] = [h.x, h.y, h.z]
    const swingA = new Q4().setFromUnitVectors(X, h)
    const N = Z.clone().applyQuaternion(swingA)
    const g = f.clone().addScaledVector(h, -f.dot(h))
    if (g.length() > 0.2 && a[`elbow${s}`] >= 25) {
      g.normalize()
      a[`shoulderRot${s}`] = -Math.atan2(h.dot(N.clone().cross(g)), N.dot(g)) * D
    } else {
      a[`shoulderRot${s}`] = null
    }
    // Wrist. The forearm's direction in the hand's own axes.
    const hand = report.hands && report.hands[s]
    if (hand) {
      const fw = E.clone().negate().add(W).normalize()
      const af = fw.dot(new V3(...hand.fingers))
      const an = fw.dot(new V3(...hand.palm))
      const at = fw.dot(new V3(...hand.thumb))
      a[`wristFlex${s}`] = Math.atan2(-an, af) * D
      a[`wristDev${s}`] = Math.asin(clamp(at, -1, 1)) * D // + ulnar: the fingers lean away from the thumb.
    }
    a[`forearmTwist${s}`] = report.twist[`forearm${s}`]
    // Scapula.
    const sc = report.angles[`scap${s}`]
    if (sc) {
      a[`scapElev${s}`] = sc.elev
      a[`scapProt${s}`] = sc.prot
    }
    // Hip.
    const H = P[by[`upperleg01.${s}`].i]
    const K = P[by[`lowerleg01.${s}`].i]
    const A = P[by[`foot.${s}`].i]
    const th = inFrame(K.clone().sub(H), QpI)
    const sh = inFrame(A.clone().sub(K), QpI)
    a[`knee${s}`] = report.angles[`knee${s}`]
    a[`hipElev${s}`] = Math.acos(clamp(-th.y, -1, 1)) * D
    a[`hipPlane${s}`] = Math.atan2(th.z, th.x) * D
    const down = new V3(0, -1, 0)
    const swingL = new Q4().setFromUnitVectors(down, th)
    const NL = new V3(0, 0, -1).applyQuaternion(swingL)
    const gl = sh.clone().addScaledVector(th, -sh.dot(th))
    if (gl.length() > 0.2 && a[`knee${s}`] >= 25) {
      gl.normalize()
      a[`hipRot${s}`] = -Math.atan2(th.dot(NL.clone().cross(gl)), NL.dot(gl)) * D
    } else {
      a[`hipRot${s}`] = null
    }
    // Ankle and toes, in the rest pose's axes: pitch + is toes down.
    const qShin = Q[by[`lowerleg02.${s}`].i]
    const qFoot = Q[by[`foot.${s}`].i]
    const rel = qShin.clone().invert().multiply(qFoot)
    a[`anklePitch${s}`] = twistOf(rel, X)
    a[`ankleRoll${s}`] = twistOf(rel, Z)
    a[`ankleYaw${s}`] = twistOf(rel, Y)
    const relT = qFoot.clone().invert().multiply(Q[by[`toe3-1.${s}`].i])
    a[`toePitch${s}`] = twistOf(relT, X)
  }
  return out
}

function checkJoints(m, spec, say) {
  const a = m.angles
  const L = LIMITS
  const over = (key, value, limit, text) => {
    if (value > limit) say('E', `joint:${key}`, value, `${text} ${deg(value)} deg, a body reaches about ${limit}`)
  }
  over('spine.flex', a.spineFlex, L.spine.flex, 'spine bent forward')
  over('spine.ext', -a.spineFlex, L.spine.ext, 'spine arched back')
  over('spine.side', Math.abs(a.spineSide), L.spine.side, 'spine bent sideways')
  over('spine.twist', Math.abs(a.spineTwist), L.spine.twist, 'spine twisted')
  over('spine.kink', a.spineSegment, L.spine.segment, 'one spine joint takes (check spine.weights)')
  over('neck.flex', a.neckFlex, L.neck.flex, 'neck bent forward')
  over('neck.ext', -a.neckFlex, L.neck.ext, 'neck bent back')
  over('neck.side', Math.abs(a.neckSide), L.neck.side, 'neck bent sideways')
  over('neck.twist', Math.abs(a.neckTwist), L.neck.twist, 'neck turned')
  for (const s of ['L', 'R']) {
    over(`elbow.${s}`, a[`elbow${s}`], L.elbow, `elbow.${s} bent`)
    over(`knee.${s}`, a[`knee${s}`], L.knee, `knee.${s} bent`)
    if (a[`wristFlex${s}`] !== undefined) {
      over(`wrist.${s}.flex`, a[`wristFlex${s}`], L.wristFlex, `wrist.${s} flexed (fingers toward the palm side)`)
      over(`wrist.${s}.ext`, -a[`wristFlex${s}`], L.wristExt, `wrist.${s} bent back`)
      over(`wrist.${s}.ulnar`, a[`wristDev${s}`], L.wristUlnar, `wrist.${s} leaning toward the little finger`)
      over(`wrist.${s}.radial`, -a[`wristDev${s}`], L.wristRadial, `wrist.${s} leaning toward the thumb`)
    }
    const [lo, hi] = interp(SHOULDER_FORBIDDEN, a[`shoulderPlane${s}`])
    const e = a[`shoulderElev${s}`]
    if (e > lo && e < hi) say('E', `joint:shoulder.${s}.range`, Math.min(e - lo, hi - e), `upper arm ${s} points where it can't: ${deg(e)} deg up from hanging, in the plane ${planeName(a[`shoulderPlane${s}`])} (${deg(a[`shoulderPlane${s}`])})`)
    if (a[`shoulderRot${s}`] !== null) {
      const [rlo, rhi] = armRotRange(a[`shoulderDir${s}`])
      const r = unwrapInto(a[`shoulderRot${s}`], rlo, rhi)
      if (r < rlo || r > rhi) say('E', `joint:shoulder.${s}.rot`, Math.min(Math.abs(r - rlo), Math.abs(r - rhi)), `elbow ${s} bends the wrong way: the upper arm would have to turn ${deg(r)} deg around itself (${deg(rlo)}..${deg(rhi)} here). Change the pole`)
    }
    if (a[`scapElev${s}`] !== undefined) {
      if (a[`scapElev${s}`] > L.scap.elevMax || a[`scapElev${s}`] < L.scap.elevMin) say('E', `joint:scap.${s}.elev`, Math.abs(a[`scapElev${s}`]), `shoulder girdle ${s} raised ${deg(a[`scapElev${s}`])} deg`)
      if (Math.abs(a[`scapProt${s}`]) > L.scap.prot) say('E', `joint:scap.${s}.prot`, Math.abs(a[`scapProt${s}`]), `shoulder girdle ${s} slid ${deg(a[`scapProt${s}`])} deg`)
    }
    const hp = a[`hipPlane${s}`]
    const [hlo, hhi] = interp(HIP_FORBIDDEN, hp)
    const he = a[`hipElev${s}`]
    if (he > hlo && he < hhi) say('E', `joint:hip.${s}.range`, he - hlo, `thigh ${s} points where it can't: ${deg(he)} deg up from hanging, in the plane ${planeName(hp)} (${deg(hp)}), a hip reaches about ${deg(hlo)}`)
    if (a[`hipRot${s}`] !== null) {
      const r = a[`hipRot${s}`]
      if (r > HIP_ROT.ext || r < -HIP_ROT.int) say('E', `joint:hip.${s}.rot`, Math.abs(r), `knee ${s} points the wrong way: the thigh would have to turn ${deg(r)} deg around itself (-${HIP_ROT.int}..${HIP_ROT.ext}). Change the pole`)
    }
    over(`ankle.${s}.plantar`, a[`anklePitch${s}`], L.anklePlantar, `ankle.${s} pointed`)
    over(`ankle.${s}.dorsi`, -a[`anklePitch${s}`], L.ankleDorsi, `ankle.${s} pulled up`)
    over(`ankle.${s}.roll`, Math.abs(a[`ankleRoll${s}`]), L.ankleRoll, `ankle.${s} rolled`)
    over(`toes.${s}`, -a[`toePitch${s}`], L.toeExt, `toes ${s} bent up`)
  }
}

const planeName = (p) => {
  const a = Math.abs(p)
  if (a < 30) return 'out to the side'
  if (a > 150) return 'across the body'
  if (p > 0) return a < 60 ? 'forward and out' : a < 120 ? 'forward' : 'forward and across'
  return a < 60 ? 'back and out' : a < 120 ? 'back' : 'back and across'
}

function armRotRange(dir) {
  let lo = 0
  let hi = 0
  let total = 0
  for (const [d, a, b] of SHOULDER_ROT) {
    const l = Math.hypot(d[0], d[1], d[2])
    const c = (d[0] * dir[0] + d[1] * dir[1] + d[2] * dir[2]) / l
    // Close anchors dominate.
    const w = Math.pow(Math.max(0, (c + 1) / 2), 12)
    lo += a * w
    hi += b * w
    total += w
  }
  return [lo / (total || 1), hi / (total || 1)]
}

/** An angle may be read 360 degrees around: take the reading that lies in the range, or nearest to it. */
function unwrapInto(r, lo, hi) {
  let best = r
  let bestOut = Infinity
  for (const c of [r - 360, r, r + 360]) {
    const out = c < lo ? lo - c : c > hi ? c - hi : 0
    if (out < bestOut) {
      bestOut = out
      best = c
    }
  }
  return best
}

// ------------------------------------------------------------------------------------------------------------------- bars

/** Two hands on one straight bar: how many degrees each grip axis may leave the line through the hands. */
const LINE_BARS = {
  barbell: 18,
  'thick-bar': 18,
  'axle-bar': 18,
  'cambered-bar': 22,
  stick: 22,
  'muscle-roller': 22,
  'ab-wheel': 22,
  'bar-test': 18,
  'ez-bar': 42,
  smith: 18,
}
const LINE_ATTACHMENTS = { 'straight-bar': 18, 'straight-bar-attachment': 18, 'lat-bar': 32, 'ez-attachment': 42, 'angled-v-bar': 42 }
/** Two parallel handles: the two grip axes must agree with each other, whatever the line through the hands does. */
const PARALLEL_BARS = new Set(['trap-bar', 'log-bar', 'v-bar', 'v-handle'])
const PARALLEL_ATTACHMENTS = new Set(['v-bar'])

function checkTwoHandBars(spec, frame, report, say) {
  const list = [...(spec.props || []), ...(frame.props || [])]
  for (const p of list) {
    if (p.hands === undefined || p.hands === false) continue
    const L = report.hands && report.hands.L
    const R = report.hands && report.hands.R
    if (!L || !R) continue
    const tol = LINE_BARS[p.type] ?? LINE_ATTACHMENTS[p.attachment]
    const parallel = PARALLEL_BARS.has(p.type) || PARALLEL_ATTACHMENTS.has(p.attachment)
    if (tol === undefined && !parallel) continue
    const tL = new V3(...L.thumb)
    const tR = new V3(...R.thumb)
    const agree = Math.acos(clamp(Math.abs(tL.dot(tR)), 0, 1)) * D
    const name = p.attachment && !PARALLEL_BARS.has(p.type) && !LINE_BARS[p.type] ? `${p.type}/${p.attachment}` : p.type
    if (parallel) {
      if (agree > 22) say('E', `bar:${name}`, agree, `${name}: the hands' grip axes differ by ${deg(agree)} deg, and its handles are parallel. Turn the palms`)
      continue
    }
    const line = new V3(...L.centre).sub(new V3(...R.centre))
    const dist = line.length()
    if (dist < 0.03) continue
    line.normalize()
    const offL = Math.acos(clamp(Math.abs(tL.dot(line)), 0, 1)) * D
    const offR = Math.acos(clamp(Math.abs(tR.dot(line)), 0, 1)) * D
    const off = Math.max(offL, offR)
    if (off > tol) say('E', `bar:${name}`, off, `${name} runs through the hands off their grip axis: left ${deg(offL)}, right ${deg(offR)} deg (max ${tol}), axes differ by ${deg(agree)}. Turn fingers and palm so the thumbs point along the bar`)
  }
}

// ------------------------------------------------------------------------------------------------------------------- the checker

const frameLabel = (n) => n

export function formatResult(r, { verbose = false } = {}) {
  const lines = []
  const head = r.errors || r.warnings ? `${r.slug}: ${r.errors} error${r.errors === 1 ? '' : 's'}${r.warnings ? `, ${r.warnings} warning${r.warnings === 1 ? '' : 's'}` : ''}${r.allowed ? `, ${r.allowed} allowed` : ''}` : `${r.slug}: ok${r.allowed ? ` (${r.allowed} allowed)` : ''}`
  lines.push(verbose ? `${head}  [${r.ms} ms]` : head)
  for (const i of r.issues) {
    if (i.allowedBy && !verbose) continue
    lines.push(`  ${i.allowedBy ? 'a' : i.level} ${i.key}  ${i.msg}  [${i.frames.join(' ')}]`)
  }
  if (verbose && r.frameLines) lines.push(...r.frameLines)
  return lines.join('\n')
}

class Checker {
  constructor(data) {
    this.body = new QABody(data)
    this.fingerSeg = { L: this.body.segIndex.get('fingers.L'), R: this.body.segIndex.get('fingers.R') }
    this.palmSeg = { L: this.body.segIndex.get('palm.L'), R: this.body.segIndex.get('palm.R') }
    this.muscles = new Set(MUSCLE_NAMES)
  }

  check(spec, { verbose = false, measure = null } = {}) {
    const t0 = performance.now()
    const body = this.body
    const issues = new Map()
    const say = (level, key, value, msg, frame) => {
      const name = frame ?? this.currentFrame
      let i = issues.get(key)
      if (!i) issues.set(key, (i = { level, key, value: -Infinity, msg: '', frames: [] }))
      if (name && !i.frames.includes(name)) i.frames.push(name)
      if (value > i.value) {
        i.value = value
        i.msg = msg
        if (level === 'E') i.level = 'E'
      }
    }
    const slug = spec.slug || spec.__file || 'spec'
    this.checkMuscles(spec, say)
    this.checkConsistency(spec, say)

    const frameSpecs = spec.frames || {}
    const names = Object.keys(frameSpecs)
    const hasMotion = !!(frameSpecs.end || frameSpecs.mid)
    const keyNames = ['start', ...['mid', 'mid2', 'mid3'].filter((k) => frameSpecs[k]), ...(frameSpecs.end ? ['end'] : [])].filter((k) => frameSpecs[k])
    const keys = keyNames.map((k) => body.resolveFrame(frameSpecs[k]))
    if (!frameSpecs.end) keys.push(keys[0])
    const at = (t) => {
      const x = Math.min(0.999999, Math.max(0, t)) * (keys.length - 1)
      const i = Math.floor(x)
      return mixFrames(keys[i], keys[i + 1], x - i)
    }
    const segments = keys.length - 1
    const ts = []
    if (hasMotion) {
      const onKey = (t) => Math.abs(t * segments - Math.round(t * segments)) < 1e-6
      for (const t of [0.25, 0.5, 0.75]) if (!onKey(t)) ts.push(t)
      for (let i = 0; i < segments; i++) {
        const t = (i + 0.5) / segments
        if (!ts.some((u) => Math.abs(u - t) < 0.04)) ts.push(t)
      }
      ts.sort((a, b) => a - b)
    }
    const samples = [
      ...names.map((n) => ({ name: n, frame: frameSpecs[n], key: true })),
      ...ts.map((t) => ({ name: `t${String(+t.toFixed(2)).replace(/^0/, '')}`, frame: at(t), key: false, t })),
    ]

    // The props that never move, built once.
    const staticList = (spec.props || []).filter((p) => !isDynamic(p))
    const staticParts = []
    staticList.forEach((p, i) => {
      if (WORN.has(p.type)) return
      const b = buildProp(p, null, i)
      if (b.error) say('E', `${b.code}:${p.type}`, 1, b.error, 'all')
      else staticParts.push(...b.parts)
    })
    for (const n of keyNames) {
      for (const p of frameSpecs[n].props || []) if (!PROPS[p.type]) say('E', `prop-unknown:${p.type}`, 1, `unknown prop "${p.type}"`, n)
    }

    const frameLines = []
    const track = { joints: {}, limbs: {}, moved: 0, base: null }
    let touchedAny = false
    for (const sample of samples) {
      this.currentFrame = sample.name
      const { report: r } = body.solve(sample.frame)
      body.preparePose()
      const m = measureJoints(body, sample.frame, r)
      if (measure) measure(sample.name, m, r, sample)
      checkJoints(m, spec, say)
      this.checkReach(r, say)
      this.checkMotion(r, track, sample)

      // Props that follow the body, and those of this frame.
      const dynamic = []
      const moving = [...(spec.props || []).filter(isDynamic), ...(sample.frame.props || [])]
      moving.forEach((p, i) => {
        if (WORN.has(p.type)) return
        const b = buildProp(p, r, 1000 + i)
        if (b.error) say('E', `${b.code}:${p.type}`, 1, b.error)
        else dynamic.push(...b.parts)
      })
      const parts = staticParts.concat(dynamic)
      const grips = this.gripsOf(sample.frame, r)
      this.checkBodyAgainstProps(parts, grips, r, say)
      this.checkThinParts(parts, grips, say)
      this.checkSelf(say)
      checkTwoHandBars(spec, sample.frame, r, say)
      this.checkGripAxes(parts, grips, r, say)
      const touching = this.checkFloor(spec, parts, r, say, sample)
      if (touching) touchedAny = true
      if (sample.key) this.rememberContacts(spec, sample, r, staticParts, track)
      else this.rememberBetween(sample, r, track)
      if (verbose) {
        const j = r.joints
        const f3 = (a) => a.map((x) => x.toFixed(2)).join(',')
        frameLines.push(`  ${sample.name.padEnd(5)} elbows ${r.angles.elbowL}/${r.angles.elbowR} knees ${r.angles.kneeL}/${r.angles.kneeR} lowest ${r.lowestPoint} (${r.lowestPart}) trunk ${r.trunkLowest}`)
        frameLines.push(`        head ${f3(j.head)} chest ${f3(j.spine01)} hipL ${f3(j['upperleg01.L'])} kneeL ${f3(j['lowerleg01.L'])} ankleL ${f3(j['foot.L'])} ankleR ${f3(j['foot.R'])}`)
        frameLines.push(`        shL ${f3(j['upperarm01.L'])} elbowL ${f3(j['lowerarm01.L'])} wristL ${f3(j['wrist.L'])} wristR ${f3(j['wrist.R'])}`)
        for (const s of ['L', 'R']) frameLines.push(`        ${s} wrist ${deg(m.angles[`wristFlex${s}`] ?? 0)} dev ${deg(m.angles[`wristDev${s}`] ?? 0)} twist ${r.twist[`forearm${s}`]} shoulder ${deg(m.angles[`shoulderElev${s}`])}/${deg(m.angles[`shoulderPlane${s}`])} rot ${m.angles[`shoulderRot${s}`] === null ? '-' : deg(m.angles[`shoulderRot${s}`])} hip ${deg(m.angles[`hipElev${s}`])}/${deg(m.angles[`hipPlane${s}`])} rot ${m.angles[`hipRot${s}`] === null ? '-' : deg(m.angles[`hipRot${s}`])} ankle ${deg(m.angles[`anklePitch${s}`])}`)
      }
    }
    this.currentFrame = null
    this.finishMotion(spec, track, hasMotion, say)
    this.finishContacts(spec, track, keyNames, say)
    this.checkTowelRope(spec, keyNames, say)
    void touchedAny

    // Exceptions the spec declares.
    const allow = spec.qaAllow || {}
    const list = [...issues.values()].sort((a, b) => (a.level === b.level ? b.value - a.value : a.level === 'E' ? -1 : 1))
    for (const i of list) {
      const by = Object.keys(allow).find((k) => i.key.startsWith(k))
      if (by) i.allowedBy = by
      i.frames = orderFrames(i.frames, samples)
    }
    return {
      slug,
      issues: list,
      errors: list.filter((i) => i.level === 'E' && !i.allowedBy).length,
      warnings: list.filter((i) => i.level === 'W' && !i.allowedBy).length,
      allowed: list.filter((i) => i.allowedBy).length,
      frameLines,
      ms: Math.round(performance.now() - t0),
    }
  }

  checkMuscles(spec, say) {
    const list = spec.muscles
    if (!list || !list.length) say('W', 'muscle:none', 1, 'no muscles painted', 'all')
    for (const m of list || []) {
      if (m === 'neck' || m === 'full-body') continue
      if (!this.muscles.has(m)) say('E', `muscle:${m}`, 1, `unknown muscle id "${m}": it would paint nothing. Known: ${MUSCLE_NAMES.join(', ')}`, 'all')
    }
    if (list && list.length > 4) say('W', 'muscle:many', list.length, `${list.length} muscles painted: too much colour says nothing, keep the primary ones`, 'all')
  }

  /** A limb has one mode through the loop, and a frame's props are the same list in every frame: anything else jumps. */
  checkConsistency(spec, say) {
    const frames = Object.entries(spec.frames || {})
    if (!frames.length) {
      say('E', 'frames', 1, 'the spec has no frames', 'all')
      return
    }
    if (!spec.frames.start) say('E', 'frames', 1, 'the spec has no start frame', 'all')
    for (const limb of ['armL', 'armR', 'legL', 'legR']) {
      const modes = frames.filter(([, f]) => f[limb]).map(([n, f]) => [n, f[limb].fk ? 'fk' : 'pos', f[limb].rel || (f[limb].fk ? (limb.startsWith('arm') ? 'chest' : 'pelvis') : 'world')])
      if (new Set(modes.map((x) => x[1])).size > 1) say('E', `mode:${limb}`, 1, `${limb} changes between pos and fk: ${modes.map((x) => `${x[0]} ${x[1]}`).join(', ')}. The loop jumps there`, 'all')
      else if (new Set(modes.map((x) => x[2])).size > 1) say('E', `rel:${limb}`, 1, `${limb} changes its frame of reference: ${modes.map((x) => `${x[0]} ${x[2]}`).join(', ')}. The loop jumps there`, 'all')
      const missing = frames.filter(([, f]) => !f[limb]).map(([n]) => n)
      if (missing.length && modes.length) say('E', `mode:${limb}`, 1, `${limb} is set in some frames but not in ${missing.join(', ')}: it falls back to the default pose there`, 'all')
    }
    const lists = frames.map(([n, f]) => [n, (f.props || []).map((p) => p.type).join(',')])
    if (new Set(lists.map((x) => x[1])).size > 1) say('E', 'props:frames', 1, `a frame's props must list the same items in every frame: ${lists.map((x) => `${x[0]} [${x[1]}]`).join(', ')}`, 'all')
  }

  checkReach(r, say) {
    for (const [k, miss] of Object.entries(r.reach)) {
      if (miss > REACH_ERROR) say('E', `reach:${k}`, miss, `${k} misses its target by ${cm(miss)} cm`)
    }
    for (const [k, t] of Object.entries(r.twist)) {
      if (Math.abs(t) > LIMITS.forearmTwist) say('E', `twist:${k}`, Math.abs(t), `${k} twisted ${t} deg (max ${LIMITS.forearmTwist}): change the pole or the palm`)
    }
  }

  /** Is any part of the body within reach of a prop? Stops at the first vertex that is. */
  touches(parts, gap = CONTACT_GAP) {
    const body = this.body
    const p = body.ctlPos
    for (const part of parts) {
      if (!overlap(part.box, body.bodyBox, 0, 0, gap)) continue
      for (let s = 0; s < body.segNames.length; s++) {
        if (!overlap(part.box, body.segBox, 0, s * 6, gap)) continue
        for (const k of body.segVerts[s]) {
          const x = p[k * 3], y = p[k * 3 + 1], z = p[k * 3 + 2]
          const b = part.box
          if (x < b[0] - gap || y < b[1] - gap || z < b[2] - gap || x > b[3] + gap || y > b[4] + gap || z > b[5] + gap) continue
          if (part.signed(x, y, z, gap * 1.5) <= gap) return true
        }
      }
    }
    return false
  }

  checkFloor(spec, parts, r, say, sample) {
    const small = /^(finger|toe)/.test(r.lowestPart)
    if (r.lowestPoint < (small ? -0.03 : -0.012)) say('E', 'floor:sink', -r.lowestPoint, `${cm(-r.lowestPoint)} cm under the floor (${r.lowestPart})`)
    const onFloor = r.lowestPoint <= CONTACT_GAP
    if (onFloor) return true
    if (this.touches(parts)) return true
    if (!spec.floats) say('E', 'floor:float', r.lowestPoint, `${cm(r.lowestPoint)} cm off the floor and touching no prop. If it stands on something, add it; if it is meant, "floats": true`)
    else say('W', 'airborne', r.lowestPoint, `touches nothing, ${cm(r.lowestPoint)} cm off the floor: right for a jump, wrong for anything else`)
    void sample
    return false
  }

  /** Who holds what: a closed hand. {L:{centre}, R:{...}}, null when open. */
  gripsOf(frame, r) {
    const out = {}
    for (const s of ['L', 'R']) {
      const spec = frame[`arm${s}`] || {}
      const closed = spec.grip !== undefined || (spec.curl ?? 0) >= 0.55
      out[s] = closed && r.hands && r.hands[s] ? { centre: r.hands[s].centre, thumb: r.hands[s].thumb } : null
    }
    return out
  }

  checkBodyAgainstProps(parts, grips, r, say) {
    const body = this.body
    const p = body.ctlPos
    const worst = new Map()
    for (const part of parts) {
      if (!overlap(part.box, body.bodyBox)) continue
      if (part.room <= DEPTH_ERROR) continue
      // Handles a closed hand may wrap.
      const skip = {}
      if (part.minHalf < 0.05) {
        for (const s of ['L', 'R']) {
          const g = grips[s]
          if (!g) continue
          const c = g.centre
          const b = part.box
          const m = 0.05
          if (c[0] > b[0] - m && c[1] > b[1] - m && c[2] > b[2] - m && c[0] < b[3] + m && c[1] < b[4] + m && c[2] < b[5] + m) {
            skip[this.fingerSeg[s]] = true
            skip[this.palmSeg[s]] = true
          }
        }
      }
      const b = part.box
      for (let s = 0; s < body.segNames.length; s++) {
        if (skip[s]) continue
        if (!overlap(b, body.segBox, 0, s * 6)) continue
        let deepest = 0
        let deepestK = -1
        let over = 0
        for (const k of body.segVerts[s]) {
          const x = p[k * 3], y = p[k * 3 + 1], z = p[k * 3 + 2]
          if (x < b[0] || y < b[1] || z < b[2] || x > b[3] || y > b[4] || z > b[5]) continue
          const d = -part.signed(x, y, z, 0.2)
          if (d > DEPTH_ERROR) over++
          if (d > deepest) {
            deepest = d
            deepestK = k
          }
        }
        if (deepest > DEPTH_ERROR) {
          const key = `prop:${part.type}:${body.segNames[s]}`
          const w = worst.get(key)
          if (!w || deepest > w.depth) worst.set(key, { depth: deepest, part, seg: body.segNames[s], over, k: deepestK })
        }
      }
    }
    for (const [key, w] of worst) say('E', key, w.depth, `${w.seg} ${cm(w.depth)} cm inside ${w.part.type} ${w.part.label()} (${w.over} vertices past 2 cm)`)
  }

  /** Bars, cables, plates: too thin to hold a vertex 2 cm deep, so measured from the part into the body. */
  checkThinParts(parts, grips, say) {
    const body = this.body
    const bb = body.bodyBox
    const worst = new Map()
    const hands = ['L', 'R'].map((s) => ({ s, g: grips[s] })).filter((h) => h.g)
    const fullSkip = {}
    for (const h of hands) {
      fullSkip[h.s] = new Uint8Array(body.segNames.length)
      fullSkip[h.s][this.fingerSeg[h.s]] = 1
      fullSkip[h.s][this.palmSeg[h.s]] = 1
    }
    const both = new Uint8Array(body.segNames.length)
    for (const h of hands) {
      both[this.fingerSeg[h.s]] = 1
      both[this.palmSeg[h.s]] = 1
    }
    for (const part of parts) {
      if (!overlap(part.box, bb)) continue
      // A thick part is the other test's business, unless it is a sparse thin one in a big bounding box.
      if (part.kind === 'box' && part.minHalf >= 0.03) continue
      if (part.kind === 'cyl' && Math.max(part.r0, part.r1) >= 0.04) continue
      if (part.kind === 'sphere' && part.r >= 0.04) continue
      if (part.kind === 'mesh' && part.room >= 0.04) continue
      const pts = part.samplesInWorld()
      const off = part.sampleOffset
      let best = 0
      let bestSeg = -1
      for (let i = 0; i < pts.length; i += 3) {
        const x = pts[i], y = pts[i + 1], z = pts[i + 2]
        if (x < bb[0] || y < bb[1] || z < bb[2] || x > bb[3] || y > bb[4] || z > bb[5]) continue
        let skip = null
        let held = 0
        for (const h of hands) {
          const c = h.g.centre
          const dx = x - c[0], dy = y - c[1], dz = z - c[2]
          if (dx * dx + dy * dy + dz * dz < 0.075 * 0.075) {
            held++
            skip = held === 1 ? fullSkip[h.s] : both
          }
        }
        const d = body.depthInBody(x, y, z, skip) - off
        if (d > best) {
          best = d
          bestSeg = body.lastSeg
        }
      }
      if (best > DEPTH_ERROR) {
        const key = `thru:${part.type}:${body.segNames[bestSeg]}`
        const w = worst.get(key)
        if (!w || best > w.depth) worst.set(key, { depth: best, part, seg: body.segNames[bestSeg] })
      }
    }
    for (const [key, w] of worst) say('E', key, w.depth, `${w.part.type} ${w.part.label()} runs ${cm(w.depth)} cm under the skin of ${w.seg}`)
  }

  checkSelf(say) {
    const body = this.body
    const B = body.segBox
    const p = body.ctlPos
    const n = body.normals_
    for (const [i, j, limit] of body.pairs) {
      if (!overlap(B, B, i * 6, j * 6)) continue
      const o = j * 6
      const grid = body.grid(j)
      let deepest = 0
      for (const k of body.segVerts[i]) {
        const x = p[k * 3], y = p[k * 3 + 1], z = p[k * 3 + 2]
        if (x < B[o] || y < B[o + 1] || z < B[o + 2] || x > B[o + 3] || y > B[o + 4] || z > B[o + 5]) continue
        const d = depthUnder(grid, n, x, y, z, 0.16)
        if (d > deepest) deepest = d
      }
      if (deepest > limit) {
        const a = body.segNames[i]
        const b = body.segNames[j]
        // One line per pair of body parts, whichever way around it was found.
        const key = `self:${a < b ? a : b}:${a < b ? b : a}`
        say('E', key, deepest, `${a} ${cm(deepest)} cm inside ${b}${limit > DEPTH_ERROR ? ` (allowed ${cm(limit)} here)` : ''}`)
      }
    }
  }

  /** A closed hand on a straight part: the part must run along the hand's grip axis. */
  checkGripAxes(parts, grips, r, say) {
    for (const s of ['L', 'R']) {
      const g = grips[s]
      if (!g) continue
      const c = g.centre
      let best = null
      let bestD = 0.03
      for (const part of parts) {
        const b = part.box
        const m = bestD
        if (c[0] < b[0] - m || c[1] < b[1] - m || c[2] < b[2] - m || c[0] > b[3] + m || c[1] > b[4] + m || c[2] > b[5] + m) continue
        const axis = part.barAxis()
        if (!axis) continue
        const d = part.distanceToAxis(c[0], c[1], c[2])
        if (d < bestD) {
          bestD = d
          best = { part, axis }
        }
      }
      if (!best) continue
      const t = g.thumb
      const off = Math.acos(clamp(Math.abs(t[0] * best.axis[0] + t[1] * best.axis[1] + t[2] * best.axis[2]), 0, 1)) * D
      if (off > 40) say('E', `grip:arm${s}`, off, `the ${s} hand closes across ${best.part.type} ${best.part.label()}: ${deg(off)} deg between its grip axis and the bar. Thumb along the bar: turn fingers and palm`)
    }
    void r
  }

  checkMotion(r, track, sample) {
    const flat = []
    for (const k of Object.keys(r.joints)) flat.push(...r.joints[k])
    if (!track.base) {
      track.base = flat
      return
    }
    let most = 0
    for (let i = 0; i < flat.length; i += 3) {
      const d = Math.hypot(flat[i] - track.base[i], flat[i + 1] - track.base[i + 1], flat[i + 2] - track.base[i + 2])
      if (d > most) most = d
    }
    if (most > track.moved) track.moved = most
    void sample
  }

  finishMotion(spec, track, hasMotion, say) {
    if (!hasMotion) return
    if (spec.loop === 'hold') return
    if (track.moved >= STILL) return
    // A frame's own prop may be all that moves.
    const a = JSON.stringify(spec.frames.start.props || [])
    const b = JSON.stringify((spec.frames.end || spec.frames.mid).props || [])
    if (a !== b) return
    say('E', 'still', STILL - track.moved, `the loop moves nothing (at most ${cm(track.moved)} cm): start and end are the same pose. A static hold has no end frame`, 'all')
  }

  /**
   * What each hand and foot rests on, at a key frame. A foot's landmark is the one its spec names as the anchor; a hand's is its centre.
   * "Rests" means the spec fixes it in the world and it lies on the floor or on a still prop.
   */
  rememberContacts(spec, sample, r, staticParts, track) {
    const followed = this.followedLimbs(spec, sample.frame)
    for (const s of ['L', 'R']) {
      const leg = sample.frame[`leg${s}`]
      if (leg && leg.pos && (leg.rel === undefined || leg.rel === 'world')) {
        const name = `leg${s}`
        const anchor = leg.anchor && leg.anchor !== 'ankle' ? leg.anchor : 'sole'
        const at = r.feet[s]
        ;(track.limbs[name] ||= []).push({ frame: sample.name, anchor, points: { sole: at.sole, ball: at.ball, heel: at.heel }, rests: !followed.has(name) && this.restsOn(at[anchor], staticParts), keyT: sample.name })
      }
      const arm = sample.frame[`arm${s}`]
      if (arm && arm.pos && arm.contact && (arm.rel === undefined || arm.rel === 'world')) {
        const name = `arm${s}`
        ;(track.limbs[name] ||= []).push({ frame: sample.name, anchor: 'centre', points: { centre: r.hands[s].centre }, rests: !followed.has(name) && this.restsOn(r.hands[s].centre, staticParts), keyT: sample.name })
      }
    }
  }

  rememberBetween(sample, r, track) {
    ;(track.between ||= []).push({ frame: sample.name, t: sample.t, feet: { L: r.feet.L, R: r.feet.R }, hands: { L: r.hands.L, R: r.hands.R } })
  }

  /** A limb a prop follows may slide: a towel under a heel, a glider. That is the prop's whole point. */
  followedLimbs(spec, frame) {
    const out = new Set()
    for (const p of [...(spec.props || []), ...(frame.props || [])]) {
      if (p.hand) out.add(`arm${p.hand}`)
      if (p.hands) {
        out.add('armL')
        out.add('armR')
      }
      if (p.foot) out.add(`leg${p.foot}`)
      if (p.feet) {
        out.add('legL')
        out.add('legR')
      }
    }
    return out
  }

  restsOn(pt, staticParts) {
    if (pt[1] <= CONTACT_GAP) return true
    for (const part of staticParts) {
      const b = part.box
      const m = CONTACT_GAP
      if (pt[0] < b[0] - m || pt[1] < b[1] - m || pt[2] < b[2] - m || pt[0] > b[3] + m || pt[1] > b[4] + m || pt[2] > b[5] + m) continue
      const d = part.signed(pt[0], pt[1], pt[2], m * 1.5)
      if (Math.abs(d) <= m) return true
    }
    return false
  }

  finishContacts(spec, track, keyNames, say) {
    // Consecutive key frames in the loop's own order.
    const order = (n) => keyNames.indexOf(n)
    for (const [limb, list] of Object.entries(track.limbs)) {
      const seq = list.filter((x) => order(x.frame) >= 0).sort((a, b) => order(a.frame) - order(b.frame))
      for (let i = 0; i + 1 < seq.length; i++) {
        const a = seq[i]
        const b = seq[i + 1]
        if (!a.rests || !b.rests) continue
        // Between two frames that name different anchors, what stays put is the later anchor: sole, then up on the ball.
        const pick = b.anchor !== 'sole' ? b.anchor : a.anchor
        const pa = a.points[pick]
        const pb = b.points[pick]
        if (!pa || !pb) continue
        const d = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2])
        if (d > DRIFT_MIN && d < DRIFT_MAX) say('E', `drift:${limb}`, d, `${limb} rests on something, yet its ${pick} moves ${cm(d)} cm between ${a.frame} and ${b.frame}. Give it the same position, or a real step`, `${a.frame}-${b.frame}`)
        if (d <= DRIFT_MIN && track.between) {
          // Standing still at both ends: does it stay there in between?
          const segs = keyNames.length - 1
          const lo = order(a.frame) / segs
          const hi = order(b.frame) / segs
          for (const m of track.between) {
            if (m.t <= lo || m.t >= hi) continue
            const s = limb.slice(-1)
            const at = limb.startsWith('leg') ? m.feet[s][pick] : m.hands[s].centre
            if (!at) continue
            const e = Math.hypot(at[0] - pa[0], at[1] - pa[1], at[2] - pa[2])
            if (e > DRIFT_BETWEEN) say('E', `drift:${limb}`, e, `${limb} is at the same place in ${a.frame} and ${b.frame}, yet its ${pick} strays ${cm(e)} cm in between. Use the same anchor and foot angle, or add a mid frame`, m.frame)
          }
        }
      }
    }
  }

  checkTowelRope(spec, keyNames, say) {
    let first = null
    for (const n of keyNames) {
      for (const prop of spec.frames[n].props || []) {
        if (prop.type !== 'towel-strip' || prop.hands) continue
        const pts = prop.points || (prop.a && prop.b ? [prop.a, prop.b] : null)
        if (!pts) continue
        let len = 0
        for (let i = 0; i + 1 < pts.length; i++) len += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1], pts[i + 1][2] - pts[i][2])
        if (first === null) first = len
        else if (Math.abs(len - first) > 0.02) say('E', 'towel:length', Math.abs(len - first), `the towel rope is ${len.toFixed(2)} m in ${n} and ${first.toFixed(2)} m in ${keyNames[0]}: it has one length`, n)
      }
    }
  }
}

function orderFrames(frames, samples) {
  const order = samples.map((s) => s.name)
  return [...frames].sort((a, b) => {
    const x = order.indexOf(a.split('-')[0])
    const y = order.indexOf(b.split('-')[0])
    return (x < 0 ? 99 : x) - (y < 0 ? 99 : y)
  })
}

void frameLabel

export async function createChecker() {
  const data = JSON.parse(fs.readFileSync(path.join(HERE, 'build', 'body-real.json'), 'utf8'))
  return new Checker(data)
}

export { propErrors, Grid }
