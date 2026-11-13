// What a closed hand can hold: the graspable cylinders of the props (handles, bars, grips), in world coordinates. Shared by
// page.js (the renderer), prep.js (the grip magnet) and qa-lib.mjs (the grip:hover check). No DOM, no Node: runs in both.
//
// A graspable is { a:[x,y,z], b:[x,y,z], r, src, name }: the axis from a to b and the radius. Two sources:
//   'grip'  the machines' grip registry: every handle drawn with Asm.grip() (props/machines.js), stored on the part's group as
//           userData.grips in its local coordinates, with its radius. Machines merge their meshes, so this is the only way to
//           find their handles.
//   'cyl'   any CylinderGeometry mesh (kit.cyl, kit.between: bars, rods, rungs, uprights) with a radius from 0.9 to 3 cm and
//           at least 7 cm long: what a hand can close around. userData.noGrasp on a mesh or a group leaves it out.
import * as THREE from './vendor/three.module.js'
import { PROPS } from './props/index.js'

const { Vector3: V3 } = THREE

export const FOLLOW_KEYS = ['hand', 'hands', 'foot', 'feet', 'follow']
export const isDynamic = (p) => FOLLOW_KEYS.some((k) => p[k] !== undefined)

/** Radius range and least length of a cylinder a hand can close around. */
export const GRASP_R = [0.009, 0.03]
export const GRASP_LEN = 0.07

/** Builds one prop as the renderer does (placed by pos and yaw unless it works in world coordinates). */
export function buildPropGroup(p, ctx = null) {
  const make = PROPS[p.type]
  if (!make) throw new Error(`unknown prop "${p.type}"`)
  const g = make(p, ctx)
  if (!g.userData.world) {
    g.position.set(...(p.pos || [0, 0, 0]))
    g.rotation.y = ((p.yaw || 0) * Math.PI) / 180
  }
  g.updateMatrixWorld(true)
  return g
}

const ignored = (o) => {
  for (let p = o; p; p = p.parent) if (p.userData && p.userData.noGrasp) return true
  return false
}

/** The graspable cylinders of a built prop group, in world coordinates. */
export function graspablesOf(group) {
  group.updateMatrixWorld(true)
  const out = []
  const A = new V3()
  const B = new V3()
  group.traverse((o) => {
    const reg = o.userData && o.userData.grips
    if (reg && !ignored(o)) {
      const e = o.matrixWorld.elements
      const sc = Math.hypot(e[0], e[1], e[2]) || 1
      for (const g of reg) {
        A.set(g.a[0], g.a[1], g.a[2]).applyMatrix4(o.matrixWorld)
        B.set(g.b[0], g.b[1], g.b[2]).applyMatrix4(o.matrixWorld)
        out.push({ a: A.toArray(), b: B.toArray(), r: (g.r ?? 0.0165) * sc, src: 'grip', name: g.name || '' })
      }
    }
    if (!o.isMesh || !o.geometry || o.geometry.type !== 'CylinderGeometry' || ignored(o)) return
    const prm = o.geometry.parameters || {}
    if (Math.abs((prm.radiusTop ?? 0) - (prm.radiusBottom ?? 0)) > 0.003) return
    const e = o.matrixWorld.elements
    const sx = Math.hypot(e[0], e[1], e[2])
    const sz = Math.hypot(e[8], e[9], e[10])
    const r = Math.max(prm.radiusTop, prm.radiusBottom) * Math.max(sx, sz)
    A.set(0, -prm.height / 2, 0).applyMatrix4(o.matrixWorld)
    B.set(0, prm.height / 2, 0).applyMatrix4(o.matrixWorld)
    const len = A.distanceTo(B)
    if (r < GRASP_R[0] || r > GRASP_R[1] || len < GRASP_LEN) return
    out.push({ a: A.toArray(), b: B.toArray(), r, src: 'cyl', name: '' })
  })
  return out
}

/**
 * The nearest point of a graspable's axis to c, kept a little inside its ends (a hand is about 9 cm wide: its centre stays
 * up to 4 cm in from an end when the handle is long enough). Returns { p:[x,y,z], d, axis:[x,y,z] (unit, a to b), u (0..1) }.
 */
export function nearestOnAxis(g, c, margin = 0.04) {
  const ax = g.b[0] - g.a[0], ay = g.b[1] - g.a[1], az = g.b[2] - g.a[2]
  const len = Math.hypot(ax, ay, az) || 1e-9
  const ux = ax / len, uy = ay / len, uz = az / len
  const m = Math.min(margin, len / 2 - 0.002)
  let s = (c[0] - g.a[0]) * ux + (c[1] - g.a[1]) * uy + (c[2] - g.a[2]) * uz
  s = Math.min(len - m, Math.max(m, s))
  const p = [g.a[0] + ux * s, g.a[1] + uy * s, g.a[2] + uz * s]
  return { p, d: Math.hypot(c[0] - p[0], c[1] - p[1], c[2] - p[2]), axis: [ux, uy, uz], u: s / len }
}

/**
 * The graspable a closed hand at c, its grip axis along t, is most likely holding: the nearest axis within maxD, with the
 * angle between the hand's axis and the bar as a tie-breaker (5 degrees count as 1 mm). null when none is that near.
 */
export function bestGraspable(list, c, t, maxD = 0.06) {
  let best = null
  for (const g of list) {
    const n = nearestOnAxis(g, c)
    if (n.d > maxD) continue
    const cos = Math.abs(n.axis[0] * t[0] + n.axis[1] * t[1] + n.axis[2] * t[2])
    const ang = (Math.acos(Math.min(1, cos)) * 180) / Math.PI
    const score = n.d + ang * 0.0002
    if (!best || score < best.score) best = { g, ...n, ang, score }
  }
  return best
}

/** Sides whose hand a prop follows (a dumbbell in that hand, a bar in both): those hands hold the prop by construction. */
export function heldSides(spec, frame) {
  const out = new Set()
  for (const p of [...(spec.props || []), ...((frame && frame.props) || [])]) {
    if (p.hand === 'L' || p.hand === 'R') out.add(p.hand)
    if (p.hands) {
      out.add('L')
      out.add('R')
    }
  }
  return out
}

/**
 * Sides whose hand alone holds a free weight that hangs wherever the hand puts it: a dumbbell, a plate, a cable's single handle.
 * Not a bar shared by both hands, not a kettlebell (its ball is drawn off the wrist's direction, so the declared wrist is the
 * look), not a landmine (its bar runs to a pivot).
 */
export function singleHeldSides(spec, frame) {
  const out = new Set()
  const all = [...(spec.props || []), ...((frame && frame.props) || [])]
  if (all.some((p) => p.hands)) return out
  for (const p of all) {
    if (p.hand !== 'L' && p.hand !== 'R') continue
    const free = p.type === 'dumbbell' || p.type === 'weight-plate' || p.attachment === 'd-handle' || p.attachment === 'single-handle' || p.type === 'single-handle'
    if (free) out.add(p.hand)
  }
  return out
}
