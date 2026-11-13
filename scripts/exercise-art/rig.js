// Poses the figure from a frame spec and skins the mesh. No DOM: runs in the browser page.
//
// WORLD: metres, floor at y = 0, Y up. At yaw 0 the figure faces +Z, so +X is the figure's LEFT.
//
// ANGLE CONVENTIONS (all degrees)
//   root / foot: pitch > 0 tips the front downward (prone is pitch 90, supine is pitch -90, head goes to +Z when
//                prone), yaw > 0 turns the figure toward its left, roll > 0 tips the top toward the figure's right.
//   spine / neck: flex > 0 bends forward, side > 0 bends toward the figure's left, twist > 0 turns toward its left.
//
// FRAME SPEC
//   root: { pos:[x,y,z] (centre between the hip joints), yaw, pitch, roll }
//   spine: { flex, side, twist, weights:[5 numbers, lower to upper, optional] }
//   neck:  { flex, side, twist }
//   armL / armR, one of:
//     { pos:[x,y,z], rel:"world"|"chest"|"pelvis"|"head", pole:[x,y,z], fingers:[x,y,z], palm:[x,y,z], contact:true,
//       curl:0..1, scap:{elev,prot} }
//       pos is the wrist, or the palm surface when contact is true. pole says where the elbow points.
//       fingers and palm are directions; they use the same frame as pos.
//       hand: "relaxed" (default in the air) | "flat" (palm on a surface, default with contact:true) | "rest" (laid on the body,
//         fingers together and softly curved: prep.js gives it to open hands resting on the skin) | "open" | "fist" |
//         "grip" | "hook" (fingers only, the thumb stays out) | "pinch" | "ball". Older specs use curl instead; a closed one
//         (curl over 0.55 with fingers and palm, pos or fk) is a grip.
//       freeGrip: true (prep.js: a dumbbell, plate or single handle in this hand alone) keeps the wrist in a comfortable band
//         and lets the weight follow the hand (freePlan below).
//       With "grip" or "hook": grip is the bar's radius in metres (barbell 0.014, dumbbell 0.016, cable handle 0.015, thick
//         bar 0.025, rope 0.018), pos is the point on the bar's axis in the middle of the hand, fingers is where the fingers
//         would point if the hand opened, palm is the way the palm faces. Both are perpendicular to the bar, whose axis is
//         their cross product. The wrist follows from that. report.hands[s].centre and .thumb then give the bar's centre
//         and direction in every frame, for the props that follow the hands.
//       Auto-roll and auto-swivel: a "grip"/"hook" hand (or an older closed hand, curl over 0.55 with contact) turns about the
//         bar's axis, a flat hand with contact turns on its surface about the palm's normal (the roll, +-70 grip, +-60 flat),
//         and the elbow moves on its circle around the shoulder-to-wrist axis (the swivel, up to +-35 from the pole; any arm
//         with pos, fingers and palm), searched together for the wrist nearest neutral as qa-lib measures it (a loaded grip
//         sits under about 20 degrees; qa-lib's limits: ulnar 35, radial 25, extension 80 or 90 flat, flexion 70), with a
//         small pull back to the declared roll and pole so the look is kept. Never worse reach, forearm twist, elbow bend
//         or shoulder range than the declared pose; the elbow does not move further in toward the trunk once inside the
//         shoulder's line, nor down into the floor; the shoulder girdle follows the declared elbow. A planted flat hand
//         keeps a wide band and a stiff roll (it would spin on the floor), so its elbow does most of the work.
//         roll:<deg> forces the roll (+ turns a grip's fingers toward its palm, a flat hand's fingers toward its thumb),
//         swivel:<deg> forces the swivel (+ swings the elbow of an arm hanging at the side from out to the front, mirrored
//         on the two arms); autoRoll:false keeps the declared hand, autoPole:false the declared pole.
//         report.angles.handRollL/R and elbowSwivelL/R give what was used. Key frames choose; resolveFrame writes rollFrom
//         and swivelFrom (internal), which the in-betweens blend, so a loop never flips. Give roll/swivel in every key
//         frame or in none.
//     { fk:{ flex, abd, rot, elbow }, rel:"chest", pron, curl, hand, scap, nudge }
//       flex 90 is a forward raise, abd 90 is a side raise, elbow 0 is straight, pron turns the forearm. nudge [x,y,z] (world) moves
//       the wrist: prep.js's grip magnet writes it to put an fk hand on its handle.
//     scap: the shoulder girdle, normally left out: it follows the upper arm by itself. elev rises with the arm from 70
//       degrees up to 24 at the top, prot (degrees, + forward) is + reaching forward and - with the elbow behind the trunk.
//       Give { elev } or { prot } only to force them: a shrug is elev 22, a row's squeeze prot -15.
//   legL / legR, one of:
//     { pos:[x,y,z], rel:"world", anchor:"ankle"|"ball"|"heel"|"sole", yaw, pitch, roll, toes, pole:[x,y,z] }
//       toes is the toes' own world pitch (0 lays them flat on a floor), default follows the foot.
//     { fk:{ flex, abd, rot, knee }, rel:"pelvis", foot:{ pitch } }
//
// Output: {positions (Float32Array), report}. The report gives reach errors, the lowest point and joint angles.
//
// TWO MESHES. The control mesh (ctlN, ctlRest, ctlPos; 13.5k vertices, build/body-real.json) is what the bones move and
// what the report measures. The render mesh (n, rest, pos, normals, index) is what a renderer draws. With
// new Body(data, { render: true }) it is the control mesh after Delta Mush and one level of Catmull-Clark (surface.js),
// 54k vertices, solve about 30 ms. With new Body(data), as in check.mjs, it is simply the control mesh, index is null and
// solve costs a few ms.
//
// SKINNING. Dual quaternions over the weights from build-body.mjs. The rest shape first takes this frame's muscle swelling
// (_poseCorrectedRest). The whole shoulder girdle, skin included, rides on the clavicle bone.

import * as THREE from './vendor/three.module.js'
import { Surface } from './surface.js'

const { Vector3: V3, Quaternion: Q4, Matrix4: M4 } = THREE
const D = Math.PI / 180
const v3 = (a) => new V3(a[0], a[1], a[2])
const X = new V3(1, 0, 0)
const Y = new V3(0, 1, 0)
const Z = new V3(0, 0, 1)
const rot = (axis, deg) => new Q4().setFromAxisAngle(axis.clone().normalize(), deg * D)
const qEuler = (e = {}) =>
  rot(Y, e.yaw || 0)
    .multiply(rot(X, e.pitch || 0))
    .multiply(rot(Z, e.roll || 0))
const lerp = (a, b, t) => a + (b - a) * t
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))

export function basisQ(x, y) {
  const yy = y.clone().normalize()
  const xx = x.clone().addScaledVector(yy, -x.dot(yy)).normalize()
  const zz = xx.clone().cross(yy)
  return new Q4().setFromRotationMatrix(new M4().makeBasis(xx, yy, zz))
}

/** Twist angle (degrees) of q around a unit axis, from the swing-twist decomposition. */
function twistAngle(q, axis) {
  const d = q.x * axis.x + q.y * axis.y + q.z * axis.z
  let a = 2 * Math.atan2(d, q.w)
  if (a > Math.PI) a -= 2 * Math.PI
  if (a < -Math.PI) a += 2 * Math.PI
  return a / D
}

// Hand modes. Finger angles are [MCP, PIP, DIP] flexion in degrees; one triple for all fingers, or one each from index to
// little finger. Thumb directions are [along the fingers, toward the thumb side, toward where the palm faces].
const HAND_PRESETS = {
  relaxed: { spread: 3, cup: 0.5, f: [[18, 25, 12], [24, 30, 14], [30, 34, 16], [36, 38, 18]], thumb: [[0.7, 0.55, 0.35], [0.85, 0.3, 0.4], [0.9, 0.1, 0.4]] },
  flat: { spread: 8, cup: 0, f: [2, 3, 2], thumb: [[0.75, 0.65, 0], [0.85, 0.52, 0], [0.92, 0.38, 0]] },
  // A hand laid on the body or on a padded surface: fingers together and softly curved, the thumb alongside. prep.js gives it to
  // any open hand resting on the body (hips, thighs, head), where a relaxed hand's curled fingers would dig in like a claw.
  rest: { spread: 2, cup: 0.2, f: [[9, 9, 4], [10, 10, 5], [12, 11, 6], [14, 12, 7]], thumb: [[0.78, 0.6, 0.06], [0.86, 0.5, 0.06], [0.92, 0.38, 0.05]] },
  open: { spread: 11, cup: 0, f: [4, 6, 3], thumb: [[0.65, 0.75, 0], [0.75, 0.65, 0], [0.85, 0.5, 0]] },
  fist: { spread: 0, cup: 1, f: [[76, 95, 55], [80, 98, 55], [84, 98, 55], [88, 98, 55]], thumb: [[0.55, 0.35, 0.75], [0.7, -0.35, 0.6], [0.35, -0.85, 0.35]] },
  ball: { spread: 7, cup: 0.5, f: [14, 16, 10], thumb: [[0.6, 0.7, 0.25], [0.7, 0.6, 0.3], [0.8, 0.45, 0.35]] },
  pinch: { spread: 1, cup: 0.6, f: [35, 25, 10], thumb: [[0.55, 0.35, 0.75], [0.85, 0, 0.5], [0.95, 0, 0.25]] },
}
const SPREAD = { 2: 1, 3: 0, 4: -0.8, 5: -1.7 }
// How far each metacarpal folds toward the palm in a full grip: the ring and little fingers cup the most.
const CUP = { 2: 0, 3: 2, 4: 7, 5: 12 }

const isGripSpec = (spec) => spec.hand === 'grip' || spec.hand === 'hook'

/**
 * A closed hand written the old way (a position, fingers and palm directions and a curl over 0.55) holds a bar or a handle:
 * it is a grip. Left as it was, its fingers curl in the air around a bar that sits at the middle of the palm, which is what
 * the owner saw as crooked, pinching hands. `pos` keeps its meaning, now the bar's axis, as the props' notes already say.
 */
function upgradeHand(spec) {
  if (!spec || spec.hand || spec.curl === undefined || spec.curl <= 0.55 || !spec.fingers || !spec.palm) return spec
  // An fk arm's closed hand too (machine curls, the pec deck): its handle follows report.hands.centre, which for a grip is the
  // bar's axis across the base of the fingers, not the middle of the palm.
  if (!spec.fk && spec.pos === undefined) return spec
  return { ...spec, hand: 'grip', grip: spec.grip ?? 0.016 }
}
/** A hand that lies on a surface: placed (contact or resolved) and flat or resting. */
const isLaidMode = (mode) => mode === 'flat' || mode === 'rest'

/** The mode a spec asks for. Specs written before modes used a single 'curl'. */
function handMode(spec) {
  if (spec.hand) return spec.hand
  if (spec.curl === undefined) return spec.contact ? 'flat' : 'relaxed'
  if (spec.curl < 0) return 'flat'
  return spec.curl <= 0.55 ? 'relaxed' : 'legacy'
}

/**
 * Wraps a chain around a circle in 2D: tangent from the start, then along the circle, sign = +1 turns from the first axis
 * toward the second. Returns the unit direction of each segment.
 */
function wrapChain(start, lens, C, R, sign) {
  const out = []
  let P = start
  for (const L of lens) {
    const dx = P[0] - C[0]
    const dy = P[1] - C[1]
    const d = Math.hypot(dx, dy)
    const th = Math.atan2(dy, dx)
    let next
    if (d <= R * 1.002) {
      const a = th + sign * 2 * Math.asin(Math.min(1, L / (2 * R)))
      next = [C[0] + R * Math.cos(a), C[1] + R * Math.sin(a)]
    } else {
      const ta = th + sign * Math.acos(R / d)
      const tl = Math.sqrt(d * d - R * R)
      if (L <= tl) {
        const T = [C[0] + R * Math.cos(ta), C[1] + R * Math.sin(ta)]
        next = [P[0] + ((T[0] - P[0]) * L) / tl, P[1] + ((T[1] - P[1]) * L) / tl]
      } else {
        const a = ta + (sign * (L - tl)) / R
        next = [C[0] + R * Math.cos(a), C[1] + R * Math.sin(a)]
      }
    }
    const len = Math.hypot(next[0] - P[0], next[1] - P[1]) || 1
    const dir = [(next[0] - P[0]) / len, (next[1] - P[1]) / len]
    out.push(dir)
    P = [P[0] + dir[0] * L, P[1] + dir[1] * L]
  }
  return out
}

export class Body {
  constructor(data, { render = false } = {}) {
    this.data = data
    this.ctlN = data.positions.length / 3
    this.ctlRest = Float32Array.from(data.positions)
    this.ctlPos = new Float32Array(this.ctlN * 3)
    this.maxInf = data.maxInfluences
    this.skinB = Int16Array.from(data.skinB)
    this.skinW = Float32Array.from(data.skinW)
    this.bones = data.bones.map((b, i) => ({ name: b.name, i, parent: b.parent, head: v3(b.head), tail: v3(b.tail) }))
    this.by = Object.fromEntries(this.bones.map((b) => [b.name, b]))
    this.by['clavicle.L'].girdleSide = 'L'
    this.by['clavicle.R'].girdleSide = 'R'
    const trunkBones = new Set(this.bones.filter((b) => /^(root|spine0[1-5]|pelvis|clavicle)/.test(b.name)).map((b) => b.i))
    this.trunkVerts = new Uint8Array(this.ctlN)
    for (let k = 0; k < this.ctlN; k++) this.trunkVerts[k] = trunkBones.has(this.skinB[k * this.maxInf]) ? 1 : 0
    this._landmarks()
    if (render) {
      this.surface = new Surface(this.ctlRest, data.quads, { strength: this._mushStrength() })
      this.n = this.surface.N
      this.rest = this.surface.fineRest
      this.pos = this.surface.fine
      this.normals = this.surface.normals
      this.index = this.surface.index
    } else {
      this.n = this.ctlN
      this.rest = this.ctlRest
      this.pos = this.ctlPos
      this.normals = null
      this.index = null
    }
  }

  /**
   * How much each control vertex takes part in the Delta Mush. The rigid, detailed parts stay out: the face, the fingers
   * and the toes. surface.js blurs the mask along the mesh, so there is no visible edge where the mush stops.
   */
  _mushStrength() {
    const { ctlN: n, skinB, skinW, maxInf } = this
    const stiff = new Map()
    for (const b of this.bones) {
      if (/^(finger|toe)/.test(b.name)) stiff.set(b.i, 1)
      else if (b.name === 'head') stiff.set(b.i, 1)
      else if (/^metacarpal/.test(b.name)) stiff.set(b.i, 0.9)
      else if (/^foot/.test(b.name)) stiff.set(b.i, 0.6)
    }
    const s = new Float32Array(n)
    for (let k = 0; k < n; k++) {
      let w = 0
      for (let j = 0; j < maxInf; j++) {
        const bi = skinB[k * maxInf + j]
        if (bi >= 0 && stiff.has(bi)) w += stiff.get(bi) * skinW[k * maxInf + j]
      }
      s[k] = 1 - w
    }
    // The outside of an elbow or a knee keeps its edge, or the mush rounds the bent joint into a hose. The inside stays
    // fully mushed: that is where a firm hinge would otherwise cut a knife line.
    const rest = this.ctlRest
    for (const side of ['L', 'R']) {
      const si = this.side[side]
      const elbowOut = si.up.clone().normalize().sub(si.lo.clone().normalize()).normalize()
      for (const [J, out, radius, amount] of [[si.E, elbowOut, 0.075, 0.7], [si.K, Z, 0.1, 0.5]]) {
        for (let k = 0; k < n; k++) {
          const dx = rest[k * 3] - J.x
          const dy = rest[k * 3 + 1] - J.y
          const dz = rest[k * 3 + 2] - J.z
          const d = Math.hypot(dx, dy, dz)
          if (d >= radius * 2.5) continue
          const c = (dx * out.x + dy * out.y + dz * out.z) / (d || 1)
          const t = clamp((c - 0.1) / 0.7, 0, 1)
          s[k] *= 1 - amount * t * t * (3 - 2 * t) * Math.exp(-((d / radius) ** 2))
        }
      }
    }
    return s
  }

  _footVerts(side) {
    const foot = this.by[`foot.${side}`].i
    const toes = new Set(this.bones.filter((b) => /^toe/.test(b.name) && b.name.endsWith(side)).map((b) => b.i))
    const out = []
    for (let k = 0; k < this.ctlN; k++) {
      const b0 = this.skinB[k * this.maxInf]
      if (b0 === foot || toes.has(b0)) out.push(k)
    }
    return out
  }

  _landmarks() {
    const b = this.by
    this.pelvisCentre = b['upperleg01.L'].head.clone().add(b['upperleg01.R'].head).multiplyScalar(0.5)
    this.side = {}
    for (const s of ['L', 'R']) {
      const S = b[`upperarm01.${s}`].head
      const E = b[`lowerarm01.${s}`].head
      const W = b[`wrist.${s}`].head
      const up = E.clone().sub(S)
      const lo = W.clone().sub(E)
      const armHinge = up.clone().cross(lo).normalize()
      const H = b[`upperleg01.${s}`].head
      const K = b[`lowerleg01.${s}`].head
      const A = b[`foot.${s}`].head
      const th = K.clone().sub(H)
      const sh = A.clone().sub(K)
      const legHinge = X.clone()
      const f = b[`finger3-1.${s}`].head.clone().sub(W).normalize()
      const r = b[`finger2-1.${s}`].head.clone().sub(b[`finger5-1.${s}`].head).normalize()
      const n = (s === 'L' ? f.clone().cross(r) : r.clone().cross(f)).normalize()
            // How far the palm's skin stands from the plane of the wrist and knuckles, measured on the mesh.
      const K3 = b[`finger3-1.${s}`].head
      const palmBones = new Set(['wrist', 'metacarpal1', 'metacarpal2', 'metacarpal3', 'metacarpal4'].map((x) => b[`${x}.${s}`].i))
      const palmLen = K3.distanceTo(W)
      const outs = []
      for (let k = 0; k < this.ctlN; k++) {
        if (!palmBones.has(this.skinB[k * this.maxInf])) continue
        const v = new V3(this.ctlRest[k * 3] - W.x, this.ctlRest[k * 3 + 1] - W.y, this.ctlRest[k * 3 + 2] - W.z)
        const along = v.dot(f)
        if (along > palmLen * 0.25 && along < palmLen) outs.push(v.dot(n))
      }
      outs.sort((x, y) => x - y)
      const palmOut = outs[Math.floor(outs.length * 0.92)]
      const palmCentre = W.clone().lerp(K3, 0.5).addScaledVector(n, palmOut)
      // Foot landmarks from the mesh, so they stay right if the body shape changes.
      const fv = this._footVerts(s)
      let minZ = Infinity
      let maxZ = -Infinity
      for (const k of fv) {
        const z = this.ctlRest[k * 3 + 2]
        minZ = Math.min(minZ, z)
        maxZ = Math.max(maxZ, z)
      }
      const heelPts = fv.filter((k) => this.ctlRest[k * 3 + 2] < minZ + 0.012)
      const hx = heelPts.reduce((t, k) => t + this.ctlRest[k * 3], 0) / heelPts.length
      const heel = new V3(hx, 0, minZ + 0.02)
      const ball = b[`toe2-1.${s}`].head.clone().lerp(b[`toe4-1.${s}`].head, 0.5)
      ball.y = 0
      const sole = heel.clone().lerp(ball, 0.5)
      this.side[s] = {
        sign: s === 'L' ? 1 : -1,
        S, E, W, up, lo, armHinge, a: up.length(), b: lo.length(),
        H, K, A, th, sh, legHinge, c: th.length(), d: sh.length(),
        fingerDir: f, palmNormal: n, palmCentre, palmOut, heel, ball, sole,
      }
    }
  }

  /** opts.surface false skips the render mesh's subdivision (prep.js only needs the bones and the control mesh). */
  solve(frame, opts = {}) {
    const nb = this.bones.length
    const assigned = new Array(nb).fill(null)
    const Q = new Array(nb)
    const P = new Array(nb)
    const by = this.by
    const set = (name, q) => {
      assigned[by[name].i] = q
    }
    const report = { reach: {}, twist: {}, angles: {} }

    const rootSpec = frame.root || {}
    const qRoot = qEuler(rootSpec)
    const pelvisPos = v3(rootSpec.pos || [0, this.pelvisCentre.y, 0])
    // A slide of the shoulder girdle in the chest's frame, on top of its rotation.
    const girdleShift = {}
    const propagate = () => {
      for (const b of this.bones) {
        if (b.parent < 0) {
          Q[b.i] = assigned[b.i] || qRoot
          P[b.i] = pelvisPos.clone().add(b.head.clone().sub(this.pelvisCentre).applyQuaternion(Q[b.i]))
        } else {
          const pb = this.bones[b.parent]
          Q[b.i] = assigned[b.i] || Q[b.parent]
          P[b.i] = P[b.parent].clone().add(b.head.clone().sub(pb.head).applyQuaternion(Q[b.parent]))
          if (b.girdleSide && girdleShift[b.girdleSide]) P[b.i].add(girdleShift[b.girdleSide].clone().applyQuaternion(Q[by.spine01.i]))
        }
      }
    }

    // Trunk.
    const sp = frame.spine || {}
    const weights = sp.weights || [0.2, 0.2, 0.2, 0.2, 0.2]
    let acc = qRoot.clone()
    ;['spine05', 'spine04', 'spine03', 'spine02', 'spine01'].forEach((name, idx) => {
      const w = weights[idx]
      const l = rot(X, (sp.flex || 0) * w)
        .multiply(rot(Z, -(sp.side || 0) * w))
        .multiply(rot(Y, (sp.twist || 0) * w))
      acc = acc.clone().multiply(l)
      set(name, acc)
    })
    const nk = frame.neck || {}
    ;['neck01', 'neck02', 'neck03', 'head'].forEach((name) => {
      const l = rot(X, (nk.flex || 0) / 4)
        .multiply(rot(Z, -(nk.side || 0) / 4))
        .multiply(rot(Y, (nk.twist || 0) / 4))
      acc = acc.clone().multiply(l)
      set(name, acc)
    })
    set('root', qRoot)
    propagate()

    const frameOf = (rel) => {
      if (rel === 'chest') return { q: Q[by.spine01.i], o: P[by.spine01.i] }
      if (rel === 'pelvis') return { q: qRoot, o: pelvisPos }
      if (rel === 'head') return { q: Q[by.head.i], o: P[by.head.i] }
      return { q: new Q4(), o: new V3() }
    }
    const toWorld = (rel, p) => {
      const f = frameOf(rel)
      return f.o.clone().add(v3(p).applyQuaternion(f.q))
    }
    const dirWorld = (rel, d) => v3(d).normalize().applyQuaternion(frameOf(rel).q)

    // Arms. Two passes: the direction decides how much the shoulder girdle moves, which moves the shoulder joint.
    const armSpecs = {
      L: upgradeHand(frame.armL) || { fk: { flex: 0, abd: 7, elbow: 12 } },
      R: upgradeHand(frame.armR) || { fk: { flex: 0, abd: 7, elbow: 12 } },
    }
    const qChest = () => Q[by.spine01.i]
    const fkArm = (s, spec, S) => {
      const si = this.side[s]
      const fk = spec.fk
      const f = frameOf(spec.rel || 'chest').q
      const q = rot(X, -(fk.flex || 0)).multiply(rot(Z, si.sign * (fk.abd || 0)))
      const u = new V3(0, -1, 0).applyQuaternion(q)
      let h = new V3(-1, 0, 0).applyQuaternion(q)
      h.applyQuaternion(rot(u, si.sign * (fk.rot || 0)))
      const l = u.clone().applyQuaternion(rot(h, fk.elbow || 0))
      const wrist = u.clone().multiplyScalar(si.a).addScaledVector(l, si.b)
      const n = wrist.clone().normalize()
      const pole = n.clone().cross(h)
      return { T: S.clone().add(wrist.clone().applyQuaternion(f)), pole: pole.applyQuaternion(f) }
    }
    // The elbow's swivel: the circle it can move on around the shoulder-to-wrist axis. + swings the elbow of an arm hanging
    // at the side from out to the side toward the front, the same way on both arms.
    const swivelPole = (s, pole, S, T, deg) => {
      if (!deg) return pole
      const n = T.clone().sub(S).normalize().multiplyScalar(this.side[s].sign)
      return pole.clone().applyQuaternion(rot(n, deg))
    }
    const armTarget = (s, spec, S, qHand, plan) => {
      const si = this.side[s]
      if (spec.fk) {
        // nudge: a world offset of the wrist, written by prep.js's grip magnet to bring an fk hand onto its handle.
        const r = fkArm(s, spec, S)
        if (spec.nudge) r.T.add(v3(spec.nudge))
        return r
      }
      let T = toWorld(spec.rel || 'world', spec.pos)
      if (plan && plan.T) T = plan.T.clone()
      else if (qHand && isGripSpec(spec) && !spec.resolved) T = T.sub(this._gripCentre(s, spec.grip ?? 0.016).sub(si.W).applyQuaternion(qHand))
      else if (spec.contact && qHand) T = T.sub(si.palmCentre.clone().sub(si.W).applyQuaternion(qHand))
      let pole = spec.pole
        ? dirWorld(spec.rel || 'world', spec.pole)
        : new V3(si.sign * 0.5, -0.5, -0.7).normalize().applyQuaternion(qChest())
      if (plan && plan.swivel) pole = swivelPole(s, pole, S, T, plan.swivel)
      return { T, pole }
    }
    const handQ = (s, spec) => {
      if (!spec.fingers || !spec.palm) return null
      const si = this.side[s]
      const rel = spec.rel || 'world'
      const fRest = basisQ(si.fingerDir.clone().cross(si.palmNormal), si.fingerDir)
      const f = dirWorld(rel, spec.fingers)
      const n = dirWorld(rel, spec.palm)
      const want = basisQ(f.clone().cross(n), f)
      return want.multiply(fRest.clone().invert())
    }
    // A free grip (freeGrip:true, written by prep.js when a dumbbell, a plate or a cable's single handle follows this hand alone):
    // the weight hangs from the hand wherever it is, so a lifter's wrist stays nearly straight. The arm stays exactly as declared
    // (the wrist where the declared hand puts it); the hand's bend at the wrist is brought into FREE_WRIST (a little extension
    // under a load is natural, a hooked or sideways-bent wrist is not), keeping the declared turn of the forearm (pronation,
    // at most FREE_TWIST). The bar (fingers x palm) and the prop that follows it move with the hand.
    const FREE_WRIST = { ext: 20, flex: 15, ulnar: 10, radial: 6 }
    const FREE_TWIST = 104
    const freePlan = (s, spec, S) => {
      const q0 = handQ(s, spec)
      if (!q0) return null
      const si = this.side[s]
      const { T, pole } = armTarget(s, spec, S, q0, null)
      const sol = this._twoBone(S, T, si.a, si.b, pole)
      const fw = sol.T.clone().sub(sol.E).normalize()
      // The declared wrist, measured as qa-lib does: + flexion toward the palm, + deviation toward the little finger.
      const f0 = si.fingerDir.clone().applyQuaternion(q0)
      const n0 = si.palmNormal.clone().applyQuaternion(q0)
      const t0 = (s === 'L' ? n0.clone().cross(f0) : f0.clone().cross(n0)).normalize()
      const flex0 = Math.atan2(-fw.dot(n0), fw.dot(f0)) / D
      const dev0 = Math.asin(clamp(fw.dot(t0), -1, 1)) / D
      const qLower = basisQ(sol.hinge, fw).multiply(basisQ(si.armHinge, si.lo).invert())
      const loAxis = si.lo.clone().normalize()
      const qLi = qLower.clone().invert()
      const tw0 = clamp(twistAngle(qLi.clone().multiply(q0), loAxis), -FREE_TWIST, FREE_TWIST)
      // Straight: fingers along the forearm, palm as declared, then turned about the forearm to the declared twist.
      const nDecl = dirWorld(spec.rel || 'world', spec.palm)
      let n = nDecl.clone().addScaledVector(fw, -nDecl.dot(fw))
      if (n.lengthSq() < 0.01) n = sol.hinge.clone()
      n.normalize()
      let q = basisQ(fw.clone().cross(n), fw).multiply(basisQ(si.fingerDir.clone().cross(si.palmNormal), si.fingerDir).invert())
      q = rot(fw, tw0 - twistAngle(qLi.clone().multiply(q), loAxis)).multiply(q)
      // Then bent back toward the declared wrist, as far as the band allows.
      const flex = clamp(flex0, -FREE_WRIST.ext, FREE_WRIST.flex)
      const dev = clamp(dev0, -FREE_WRIST.radial, FREE_WRIST.ulnar)
      const f = si.fingerDir.clone().applyQuaternion(q)
      const nn = si.palmNormal.clone().applyQuaternion(q)
      const t = s === 'L' ? nn.clone().cross(f) : f.clone().cross(nn)
      q = rot(f.clone().cross(nn), flex).multiply(q)
      const f2 = si.fingerDir.clone().applyQuaternion(q)
      q = rot(t.clone().cross(f2), dev).multiply(q)
      return { q, T: T.clone(), free: true }
    }
    const isFree = (spec) => spec.freeGrip && isGripSpec(spec) && spec.fingers && spec.palm

    // Auto-roll and auto-swivel. A hand around a bar turns about the bar's axis, a flat hand turns on its surface about the
    // palm's normal (the roll), and the elbow moves on its circle around the shoulder-to-wrist axis (the swivel, up to 35
    // degrees from the spec's pole): together they bring the forearm in line with the hand, the way a lifter's wrist sits
    // near neutral under load. The bar (or the palm's contact point) and the bar's axis stay exactly where the spec puts them.
    // Measured as qa-lib's measureJoints does. Never worse reach, forearm twist or elbow bend than the declared pose, and the
    // elbow never moves further in toward the trunk than declared once it is inside the shoulder's line.
    // seed: the plan of the first pass (before the shoulder girdle moved), refined from there.
    const SWIVEL = 35
    const armPlan = (s, spec, S, seed) => {
      if (spec.fk || !spec.pos) return null
      // A free grip (a dumbbell or a handle that follows this hand alone) takes its orientation from the forearm: nothing to search.
      if (spec.freeGrip && isGripSpec(spec)) return null
      const qh0 = handQ(s, spec)
      if (!qh0) return null
      const si = this.side[s]
      // A closed hand in the older format (curl over 0.55 with contact) holds its handle at the palm: it rolls like a grip.
      const mode = handMode(spec)
      const placed = spec.contact || spec.resolved
      const grip = isGripSpec(spec) || (mode === 'legacy' && placed)
      const flat = !grip && isLaidMode(mode) && placed
      const rollForced = typeof spec.roll === 'number'
      const swivelForced = typeof spec.swivel === 'number'
      const canRoll = (grip || flat) && (spec.autoRoll !== false || rollForced)
      const canSwivel = spec.autoPole !== false || swivelForced
      if (!canRoll && !canSwivel) return null
      const R = grip ? 70 : 60
      let at
      if (canRoll) {
        const off = (isGripSpec(spec) ? this._gripCentre(s, spec.grip ?? 0.016) : si.palmCentre.clone()).sub(si.W)
        const P0 = toWorld(spec.rel || 'world', spec.pos)
        const B = spec.resolved ? P0.clone().add(off.clone().applyQuaternion(qh0)) : P0
        // Both axes give + roll the same meaning on both sides: a grip's fingers turn toward the palm, a flat hand's toward the thumb.
        const axis = grip ? si.fingerDir.clone().cross(si.palmNormal) : si.palmNormal.clone().multiplyScalar(s === 'L' ? 1 : -1)
        axis.applyQuaternion(qh0).normalize()
        at = (deg) => {
          const q = rot(axis, deg).multiply(qh0)
          return { q, T: B.clone().sub(off.clone().applyQuaternion(q)), roll: deg }
        }
      } else {
        const T0 = armTarget(s, spec, S, qh0, null).T
        at = () => ({ q: qh0, T: T0.clone(), roll: undefined })
      }
      const plan = (roll, swivel, searched) => {
        const p = at(canRoll ? roll : 0)
        if (!canRoll) p.roll = undefined
        p.swivel = canSwivel ? swivel : 0
        p.swivel0 = canSwivel ? swivel0 : 0
        p.reportSwivel = canSwivel
        p.searched = searched
        return p
      }
      // An in-between takes its key frames' blended values as they are (rollFrom, swivelFrom, written by resolveFrame):
      // searching again there can jump between two equally good answers from one in-between to the next.
      const blended = typeof spec.rollFrom === 'number' || typeof spec.swivelFrom === 'number'
      const roll0 = rollForced ? spec.roll : blended ? spec.rollFrom ?? 0 : 0
      const swivel0 = swivelForced ? spec.swivel : blended ? spec.swivelFrom ?? 0 : 0
      const freeRoll = canRoll && !rollForced && spec.autoRoll !== false && !blended
      const freeSwivel = canSwivel && !swivelForced && spec.autoPole !== false && !blended
      if (!freeRoll && !freeSwivel) return plan(roll0, swivel0, false)

      const pole = spec.pole ? dirWorld(spec.rel || 'world', spec.pole) : new V3(si.sign * 0.5, -0.5, -0.7).normalize().applyQuaternion(qChest())
      const loAxis = si.lo.clone().normalize()
      const restLo = basisQ(si.armHinge, si.lo).invert()
      const qChi = qChest().clone().invert()
      const O = P[by.spine01.i]
      const lateral = (p) => si.sign * p.clone().sub(O).applyQuaternion(qChi).x
      const latS = lateral(S)
      // Bands the declared hand may use freely (a back squat's bent-back wrist is meant), then a cost up to qa-lib's LIMITS
      // with a steep wall from 90 % of each. Bending at the wrist (flex, ext) is left to the spec well into its range;
      // leaning sideways (ulnar, radial) looks wrong much sooner, and a loaded grip sits near neutral.
      const lim = { flex: 70, ext: flat ? 90 : 80, ulnar: 35, radial: 25 }
      // A flat hand is planted: turning it on its surface from one key frame to the next would spin it on the floor, so it
      // keeps a wide band and a stiff pull back to the declared hand, and the elbow (the swivel) does most of the work.
      const band = flat ? { flex: 45, ext: 78, ulnar: 24, radial: 17 } : { flex: 35, ext: 50, ulnar: 8, radial: 6 }
      const rollStiff = flat ? 0.4 : 0.05
      const part = (v, dzP, limP, dzN, limN) => {
        const e = v > 0 ? Math.max(0, v - dzP) / limP : Math.max(0, -v - dzN) / limN
        const w = v > 0 ? Math.max(0, v / limP - 0.9) : Math.max(0, -v / limN - 0.9)
        return e * e + 30 * w * w
      }
      const wristOf = (q, sol) => {
        const fw = sol.T.clone().sub(sol.E).normalize()
        const f = si.fingerDir.clone().applyQuaternion(q)
        const n = si.palmNormal.clone().applyQuaternion(q)
        const t = (s === 'L' ? n.clone().cross(f) : f.clone().cross(n)).normalize()
        return {
          fw,
          flex: Math.atan2(-fw.dot(n), fw.dot(f)) / D,
          dev: Math.asin(clamp(fw.dot(t), -1, 1)) / D,
          tw: twistAngle(basisQ(sol.hinge, fw).multiply(restLo).invert().multiply(q), loAxis),
        }
      }
      // The declared pose: reach, elbow and forearm twist may not get worse than this.
      const p0 = at(canRoll ? roll0 : 0)
      const sol0 = this._twoBone(S, p0.T, si.a, si.b, swivelPole(s, pole, S, p0.T, swivel0))
      const w0 = wristOf(p0.q, sol0)
      const miss0 = sol0.miss
      const tw0 = Math.abs(w0.tw)
      const interior0 = sol0.interior
      // How far the upper arm is out of the shoulder's range (where it points, how far it turns around itself), as qa-lib
      // measures it, with the range narrowed by 2 degrees (the bones land a little off the plan's): the plan may not make it worse.
      const shoulderOut = (sol) => {
        const h = sol.E.clone().sub(S).applyQuaternion(qChi)
        h.x *= si.sign
        h.normalize()
        const f = sol.T.clone().sub(sol.E).applyQuaternion(qChi)
        f.x *= si.sign
        f.normalize()
        const [lo, hi] = interpRange(SHOULDER_FORBIDDEN, Math.atan2(h.z, h.x) / D)
        const e = Math.acos(clamp(-h.y, -1, 1)) / D
        let out = e > lo - 2 && e < hi + 2 ? Math.min(e - lo + 2, hi + 2 - e) : 0
        const g = f.clone().addScaledVector(h, -f.dot(h))
        if (g.length() > 0.2 && 180 - sol.interior >= 25) {
          g.normalize()
          const N = Z.clone().applyQuaternion(new Q4().setFromUnitVectors(X, h))
          const [rlo, rhi] = armRotRange([h.x, h.y, h.z])
          const r = unwrapInto(-Math.atan2(h.dot(N.clone().cross(g)), N.dot(g)) / D, rlo, rhi)
          out += r < rlo + 2 ? rlo + 2 - r : r > rhi - 2 ? r - rhi + 2 : 0
        }
        return out
      }
      const out0 = shoulderOut(sol0)
      const missCost = (m) => (miss0 > 0.01 ? 10 * Math.max(0, m - miss0) : (Math.max(0, m - 0.002) / 0.005) ** 2)
      const memo = new Map()
      const cost = (roll, swivel) => {
        const key = roll.toFixed(4) + ',' + swivel.toFixed(4)
        if (memo.has(key)) return memo.get(key)
        const { q, T } = at(canRoll ? roll : 0)
        // solR: the roll alone, at the declared swivel; sol: with the swivel tried.
        const solR = this._twoBone(S, T, si.a, si.b, swivelPole(s, pole, S, T, swivel0))
        const sol = swivel !== swivel0 ? this._twoBone(S, T, si.a, si.b, swivelPole(s, pole, S, T, swivel)) : solR
        const w = wristOf(q, sol)
        let c
        if (Math.abs(w.tw) > Math.max(100, tw0) + 1e-6) c = Infinity
        else if (sol.miss > Math.max(miss0, 0.003) + 1e-4) c = Infinity
        // Inside the shoulder's line the elbow may not move further in than declared: it would go through the trunk.
        else if (swivel !== swivel0 && lateral(sol.E) < Math.min(lateral(solR.E), latS) - 0.002) c = Infinity
        // Nor down into the floor.
        else if (swivel !== swivel0 && sol.E.y < Math.min(solR.E.y, 0.07)) c = Infinity
        else if (shoulderOut(sol) > out0 + 1e-6) c = Infinity
        else {
          const fwR = solR.T.clone().sub(solR.E).normalize()
          c =
            part(w.flex, band.flex, lim.flex, band.ext, lim.ext) +
            part(w.dev, band.ulnar, lim.ulnar, band.radial, lim.radial) +
            part(w.tw, 85, 110, 85, 110) +
            missCost(sol.miss) +
            (Math.max(0, 32 - sol.interior) / 6) ** 2 +
            (Math.max(0, Math.min(40, interior0) - sol.interior) / 12) ** 2 +
            // The roll swings the forearm (the wrist moves around the bar): as little as the wrist allows.
            (Math.max(0, Math.acos(clamp(fwR.dot(w0.fw), -1, 1)) / D - 5) / 15) ** 2 +
            // The look the spec asked for: a small pull back to the declared roll and pole.
            rollStiff * ((roll - roll0) / R) ** 2 +
            0.2 * ((swivel - swivel0) / SWIVEL) ** 2
        }
        memo.set(key, c)
        return c
      }
      // Pattern search: downhill from the declared pose (or the first pass's answer) to the nearest minimum, in 2.5 degree
      // steps, then finer. Not a global search: the nearest minimum moves smoothly with the pose, the global one can jump.
      let r = seed && seed.roll !== undefined && freeRoll ? seed.roll : roll0
      let w = seed && freeSwivel ? seed.swivel || 0 : swivel0
      let c = cost(r, w)
      if (c === Infinity) {
        r = roll0
        w = swivel0
        c = cost(r, w)
      }
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
      for (const step of [2.5, 1.25, 0.6, 0.3]) {
        for (let it = 0; it < 60; it++) {
          let br = r, bw = w, bc = c
          for (const [dr, dw] of dirs) {
            if ((dr && !freeRoll) || (dw && !freeSwivel)) continue
            const nr = r + dr * step
            const nw = w + dw * step
            if (Math.abs(nr) > R + 1e-9 || Math.abs(nw) > SWIVEL + 1e-9) continue
            const nc = cost(nr, nw)
            if (nc < bc - 1e-9) {
              br = nr
              bw = nw
              bc = nc
            }
          }
          if (br === r && bw === w) break
          r = br
          w = bw
          c = bc
        }
      }
      return plan(r, w, true)
    }
    const plans = {}

    const lifts = {}
    // Scapulohumeral rhythm: where the upper arm points decides how far the shoulder girdle moves. spec.scap overrides.
    for (const s of ['L', 'R']) {
      const spec = armSpecs[s]
      const si = this.side[s]
      const S0 = P[by[`upperarm01.${s}`].i]
      plans[s] = isFree(spec) ? freePlan(s, spec, S0) : armPlan(s, spec, S0)
      const qh = plans[s] ? plans[s].q : handQ(s, spec)
      // The girdle follows the declared elbow: the swivel moves the elbow, not the shoulder (raised, it would meet the head).
      const p1 = plans[s] ? { ...plans[s], swivel: plans[s].swivel0 } : null
      const { T, pole } = armTarget(s, spec, S0, qh, p1)
      const trial = this._twoBone(S0, T, si.a, si.b, pole)
      const h = trial.E.clone().sub(S0).normalize().applyQuaternion(qChest().clone().invert())
      // Lift: 0 is the arm hanging, 180 straight up. The girdle starts moving at about 70 and rises 24 degrees at the top.
      const lift = Math.acos(clamp(-h.y, -1, 1)) / D
      lifts[s] = lift
      const autoElev = clamp(lift - 70, 0, 110) * 0.22
      // Forward of the shoulders the blade slides around the ribs; behind them it pinches toward the spine.
      const across = Math.max(0, -h.x * si.sign)
      const reach = Math.sin(clamp(lift, 0, 180) * D)
      const autoProt = h.z > 0 ? 14 * h.z * reach + 8 * across * clamp(h.z * 4, 0, 1) : 20 * h.z
      const scap = spec.scap || {}
      const elev = scap.elev ?? autoElev
      const prot = scap.prot ?? clamp(autoProt, -18, 20)
      // Protraction moves the shoulder joint toward the hand. An arm straight on a fixed hand must stay straight (a plank,
      // the top of a press): the automatic slide is cut back as far as the arm needs. An arm already bent is free.
      const qCh = qChest()
      const qChi = qCh.clone().invert()
      const head = P[by[`clavicle.${s}`].i]
      const off = S0.clone().sub(head).applyQuaternion(qChi)
      const girdle = (k) => {
        const qc = rot(Z, si.sign * elev).multiply(rot(Y, -si.sign * prot * k))
        // Rotating up, the socket also swings toward the neck: the shoulders narrow when the arms go overhead.
        const slide = new V3(-si.sign * 0.028 * (elev / 26), 0, 0)
        return { qc, slide, S: off.clone().applyQuaternion(qc).add(slide).applyQuaternion(qCh).add(head) }
      }
      let k = 1
      if (!spec.fk && scap.prot === undefined) {
        const reachMax = si.a + si.b
        const slack0 = Math.max(0, reachMax - T.distanceTo(S0))
        const allowed = slack0 + Math.max(0, slack0 - 0.003) * 1.5
        if (reachMax - T.distanceTo(girdle(1).S) > allowed) {
          let lo = 0
          let hi = 1
          for (let it = 0; it < 12; it++) {
            const mid = (lo + hi) / 2
            if (reachMax - T.distanceTo(girdle(mid).S) > allowed) hi = mid
            else lo = mid
          }
          k = lo
        }
      }
      const g = girdle(k)
      report.angles[`scap${s}`] = { elev: +elev.toFixed(1), prot: +(prot * k).toFixed(1) }
      set(`clavicle.${s}`, qCh.clone().multiply(g.qc))
      girdleShift[s] = g.slide
    }
    propagate()

    for (const s of ['L', 'R']) {
      const spec = armSpecs[s]
      const si = this.side[s]
      const S = P[by[`upperarm01.${s}`].i].clone()
      // The shoulder girdle has moved the shoulder: refine the plan from there, starting at the first pass's answer.
      if (plans[s] && plans[s].free) plans[s] = freePlan(s, spec, S)
      else if (plans[s] && plans[s].searched) plans[s] = armPlan(s, spec, S, plans[s])
      const qh = plans[s] ? plans[s].q : handQ(s, spec)
      const { T, pole } = armTarget(s, spec, S, qh, plans[s])
      const solved = this._twoBone(S, T, si.a, si.b, pole)
      report.reach[`arm${s}`] = +solved.miss.toFixed(3)
      if (plans[s] && plans[s].roll !== undefined) report.angles[`handRoll${s}`] = +plans[s].roll.toFixed(1)
      if (plans[s] && plans[s].reportSwivel) report.angles[`elbowSwivel${s}`] = +plans[s].swivel.toFixed(1)
      const qParent = Q[by[`shoulder01.${s}`].i]
      const up = this._limbQ(solved, si.up, si.lo, si.armHinge, qParent)
      set(`upperarm01.${s}`, up.q01)
      set(`upperarm02.${s}`, up.q02)
      report.angles[`upperTwist${s}`] = +up.humeralTwist.toFixed(0)
      const qLower = up.qLower
      const axis = si.lo.clone().normalize()
      let qHand
      if (qh) {
        qHand = qh
      } else {
        // A free hand continues the forearm's line: the rest pose has it dropped at the wrist, which reads as limp.
        const straighten = new Q4().slerp(new Q4().setFromUnitVectors(si.fingerDir, axis), 0.85)
        qHand = qLower.clone().multiply(rot(axis, (s === 'L' ? 1 : -1) * (spec.pron || 0))).multiply(straighten)
      }
      const rel = qLower.clone().invert().multiply(qHand)
      const tw = twistAngle(rel, axis)
      report.twist[`forearm${s}`] = +tw.toFixed(0)
      // Turning the palm is the radius rolling around the ulna: nothing at the elbow, all of it at the wrist.
      set(`lowerarm01.${s}`, qLower.clone().multiply(rot(axis, tw * 0.1)))
      set(`lowerarm02.${s}`, qLower.clone().multiply(rot(axis, tw * 0.85)))
      set(`wrist.${s}`, qHand)
      this._fingers(s, spec, qHand, set)
      report.angles[`elbow${s}`] = +(180 - solved.interior).toFixed(0)
    }

    // Legs.
    const legSpecs = {
      L: frame.legL || { fk: { flex: 0, abd: 0, knee: 0 } },
      R: frame.legR || { fk: { flex: 0, abd: 0, knee: 0 } },
    }
    propagate()
    for (const s of ['L', 'R']) {
      const spec = legSpecs[s]
      const si = this.side[s]
      const Hp = P[by[`upperleg01.${s}`].i].clone()
      let T
      let pole
      let qFoot
      if (spec.fk) {
        const fk = spec.fk
        const f = frameOf(spec.rel || 'pelvis').q
        const q = rot(X, -(fk.flex || 0)).multiply(rot(Z, si.sign * (fk.abd || 0)))
        const u = new V3(0, -1, 0).applyQuaternion(q)
        const h = new V3(1, 0, 0).applyQuaternion(q).applyQuaternion(rot(u, -si.sign * (fk.rot || 0)))
        const l = u.clone().applyQuaternion(rot(h, fk.knee || 0))
        const w = u.clone().multiplyScalar(si.c).addScaledVector(l, si.d)
        T = Hp.clone().add(w.clone().applyQuaternion(f))
        const n = w.clone().normalize()
        pole = n.clone().cross(h).applyQuaternion(f)
      } else {
        const rel = spec.rel || 'world'
        const f = frameOf(rel).q
        qFoot = f.clone().multiply(qEuler(spec))
        const anchorRest = spec.anchor === 'ball' ? si.ball : spec.anchor === 'heel' ? si.heel : spec.anchor === 'sole' ? si.sole : si.A
        T = toWorld(rel, spec.pos).sub(anchorRest.clone().sub(si.A).applyQuaternion(qFoot))
        pole = spec.pole ? dirWorld(rel, spec.pole) : Z.clone().applyQuaternion(qRoot)
      }
      const solved = this._twoBone(Hp, T, si.c, si.d, pole)
      report.reach[`leg${s}`] = +solved.miss.toFixed(3)
      const qParent = Q[by[`pelvis.${s}`].i]
      const up = this._limbQ(solved, si.th, si.sh, si.legHinge, qParent)
      set(`upperleg01.${s}`, up.q01)
      set(`upperleg02.${s}`, up.q02)
      set(`lowerleg01.${s}`, up.qLower)
      set(`lowerleg02.${s}`, up.qLower)
      if (!qFoot) qFoot = up.qLower.clone().multiply(rot(X, spec.foot?.pitch ?? 12))
      set(`foot.${s}`, qFoot)
      let qToes = qFoot
      if (spec.toes !== undefined && spec.toes !== null) {
        const rel = frameOf(spec.rel || 'world').q
        qToes = rel.clone().multiply(qEuler({ yaw: spec.yaw, pitch: spec.toes, roll: spec.roll }))
      }
      for (const t of [1, 2, 3, 4, 5]) set(`toe${t}-1.${s}`, qToes)
      report.angles[`knee${s}`] = +(180 - solved.interior).toFixed(0)
    }
    propagate()

    // What drives the muscle swelling in the skin.
    const drivers = (this._drivers = {})
    for (const s of ['L', 'R']) {
      drivers[`elbow${s}`] = report.angles[`elbow${s}`]
      drivers[`knee${s}`] = report.angles[`knee${s}`]
      drivers[`lift${s}`] = lifts[s]
      drivers[`elev${s}`] = report.angles[`scap${s}`].elev
      // Heel up: the foot's own pitch relative to the shin.
      drivers[`ankle${s}`] = twistAngle(Q[by[`lowerleg02.${s}`].i].clone().invert().multiply(Q[by[`foot.${s}`].i]), X)
    }
    this._skin(Q, P)
    // The report measures the control mesh, so check.mjs and a render agree.
    const cp = this.ctlPos
    let minY = Infinity
    let minK = 0
    for (let k = 0; k < this.ctlN; k++) {
      if (cp[k * 3 + 1] < minY) {
        minY = cp[k * 3 + 1]
        minK = k
      }
    }
    report.lowestPoint = +minY.toFixed(3)
    report.lowestPart = this.bones[this.skinB[minK * this.maxInf]].name
    // How far the trunk is from the floor, for poses lying on it: fingers touching the floor hide a floating body.
    let trunk = Infinity
    for (let k = 0; k < this.ctlN; k++) {
      if (this.trunkVerts[k] && cp[k * 3 + 1] < trunk) trunk = cp[k * 3 + 1]
    }
    report.trunkLowest = +trunk.toFixed(3)
    const joints = {}
    for (const n of ['head', 'spine01', 'wrist.L', 'wrist.R', 'foot.L', 'foot.R', 'lowerarm01.L', 'lowerarm01.R', 'lowerleg01.L', 'lowerleg01.R', 'upperleg01.L', 'upperleg01.R', 'upperarm01.L', 'upperarm01.R']) {
      const p = P[by[n].i]
      joints[n] = [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)]
    }
    report.joints = joints
    report.hands = {}
    report.feet = {}
    for (const s of ['L', 'R']) {
      const si = this.side[s]
      const q = Q[by[`wrist.${s}`].i]
      const w = P[by[`wrist.${s}`].i]
      const f = si.fingerDir.clone().applyQuaternion(q)
      const n = si.palmNormal.clone().applyQuaternion(q)
      // The thumb side of the palm: the way a bar held in this hand runs, seen from the little finger.
      const t = (s === 'L' ? n.clone().cross(f) : f.clone().cross(n)).normalize()
      const centreRest = isGripSpec(armSpecs[s]) ? this._gripCentre(s, armSpecs[s].grip ?? 0.016) : si.palmCentre
      const c = w.clone().add(centreRest.clone().sub(si.W).applyQuaternion(q))
      // The fingertips (thumb first), for prep.js's resting hands.
      const tips = [1, 2, 3, 4, 5].map((F) => {
        const b = by[`finger${F}-3.${s}`]
        return P[b.i].clone().add(b.tail.clone().sub(b.head).applyQuaternion(Q[b.i])).toArray()
      })
      report.hands[s] = { wrist: w.toArray(), centre: c.toArray(), fingers: f.toArray(), palm: n.toArray(), thumb: t.toArray(), quat: q.toArray(), tips }
      const qf = Q[by[`foot.${s}`].i]
      const a = P[by[`foot.${s}`].i]
      const toWorld = (x) => a.clone().add(x.clone().sub(si.A).applyQuaternion(qf)).toArray()
      report.feet[s] = {
        ankle: a.toArray(),
        heel: toWorld(si.heel),
        ball: toWorld(si.ball),
        sole: toWorld(si.sole),
        forward: si.ball.clone().sub(si.heel).normalize().applyQuaternion(qf).toArray(),
        up: new V3(0, 1, 0).applyQuaternion(qf).toArray(),
        quat: qf.toArray(),
      }
    }
    const trunkFrame = (name) => ({ pos: P[by[name].i].toArray(), quat: Q[by[name].i].toArray() })
    report.frames = { pelvis: { pos: pelvisPos.toArray(), quat: qRoot.toArray() }, chest: trunkFrame('spine01'), head: trunkFrame('head') }
    if (this.surface && opts.surface !== false) this.surface.update(this.ctlPos)
    return { positions: this.pos, report }
  }

  /**
   * Rewrites world-frame foot anchors and palm contacts as plain ankle and wrist targets, so that two frames using
   * different anchors still interpolate smoothly.
   */
  resolveFrame(frame) {
    const out = JSON.parse(JSON.stringify(frame))
    if (out.armL) out.armL = upgradeHand(out.armL)
    if (out.armR) out.armR = upgradeHand(out.armR)
    // Auto-roll is chosen on the key frames and written down as rollFrom, which the in-betweens blend like any other number:
    // no flip from one in-between to the next.
    // The elbow's swivel the same way, as swivelFrom.
    const autoArms = ['L', 'R'].filter((s) => {
      const a = out[`arm${s}`]
      return a && a.pos && !a.fk && ((a.autoRoll !== false && typeof a.roll !== 'number') || (a.autoPole !== false && typeof a.swivel !== 'number'))
    })
    // Free grips take their hand from the forearm: the wrist below is computed with the hand the solve really used.
    const freeArms = ['L', 'R'].filter((s) => {
      const a = out[`arm${s}`]
      return a && a.pos && !a.fk && a.freeGrip && isGripSpec(a) && a.fingers && a.palm
    })
    let solvedReport = null
    if (autoArms.length || freeArms.length) solvedReport = this.solve(frame, { surface: false }).report
    for (const s of freeArms) {
      const a = out[`arm${s}`]
      const h = solvedReport.hands[s]
      if (a.rel && a.rel !== 'world') continue
      // The hand as drawn: straightened at the wrist, the bar where that puts it. Converted below to the same wrist.
      a.pos = h.centre.slice()
      a.fingers = h.fingers.slice()
      a.palm = h.palm.slice()
    }
    if (autoArms.length) {
      const report = solvedReport
      for (const s of autoArms) {
        const a = out[`arm${s}`]
        if (a.autoRoll !== false && typeof a.roll !== 'number' && report.angles[`handRoll${s}`] !== undefined) a.rollFrom = report.angles[`handRoll${s}`]
        // The swivel as an angle about each frame's own shoulder-to-wrist axis. (Blending the pole it produced instead was
        // tried: it gave more wrist errors and more twitches in the in-betweens.)
        if (a.autoPole !== false && typeof a.swivel !== 'number' && report.angles[`elbowSwivel${s}`] !== undefined) a.swivelFrom = report.angles[`elbowSwivel${s}`]
      }
    }
    for (const s of ['L', 'R']) {
      const si = this.side[s]
      const leg = out[`leg${s}`]
      if (leg && leg.pos && (leg.rel === undefined || leg.rel === 'world') && leg.anchor && leg.anchor !== 'ankle') {
        const qFoot = qEuler(leg)
        const rest = leg.anchor === 'ball' ? si.ball : leg.anchor === 'heel' ? si.heel : si.sole
        const T = v3(leg.pos).sub(rest.clone().sub(si.A).applyQuaternion(qFoot))
        leg.pos = [T.x, T.y, T.z]
        leg.anchor = 'ankle'
      }
      const arm = out[`arm${s}`]
      if (arm && arm.pos && (arm.contact || isGripSpec(arm)) && arm.fingers && arm.palm && (arm.rel === undefined || arm.rel === 'world')) {
        const fRest = basisQ(si.fingerDir.clone().cross(si.palmNormal), si.fingerDir)
        const f = v3(arm.fingers).normalize()
        const n = v3(arm.palm).normalize()
        const qHand = basisQ(f.clone().cross(n), f).multiply(fRest.clone().invert())
        const anchor = isGripSpec(arm) ? this._gripCentre(s, arm.grip ?? 0.016) : si.palmCentre
        const T = v3(arm.pos).sub(anchor.clone().sub(si.W).applyQuaternion(qHand))
        arm.pos = [T.x, T.y, T.z]
        // Keep the hand's shape: without contact a hand with no mode would turn "relaxed" in the in-betweens.
        if (arm.contact && !arm.hand && arm.curl === undefined) arm.hand = 'flat'
        arm.contact = false
        arm.resolved = true
      }
    }
    return out
  }

  _twoBone(S, T, a, b, pole) {
    const toT = T.clone().sub(S)
    let d = toT.length()
    const n = toT.clone().normalize()
    const dMax = a + b - 1e-3
    const dMin = Math.abs(a - b) + 1e-3
    const miss = Math.max(0, d - dMax, dMin - d)
    d = clamp(d, dMin, dMax)
    const along = (a * a - b * b + d * d) / (2 * d)
    const h = Math.sqrt(Math.max(0, a * a - along * along))
    let p = pole.clone().addScaledVector(n, -pole.dot(n))
    if (p.lengthSq() < 1e-6) {
      p = new V3(0, 0, 1).addScaledVector(n, -n.z)
      if (p.lengthSq() < 1e-6) p = new V3(1, 0, 0).addScaledVector(n, -n.x)
    }
    p.normalize()
    const E = S.clone().addScaledVector(n, along).addScaledVector(p, h)
    const Tc = S.clone().addScaledVector(n, d)
    const hinge = p.clone().cross(n).normalize()
    const interior = (Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1)) / D)
    return { S, E, T: Tc, hinge, miss, interior }
  }

  /** World rotations for a two-segment limb. The upper bone pair splits its twist so the root of the limb doesn't wring. */
  _limbQ(solved, upRest, loRest, hingeRest, qParent) {
    const yd = solved.E.clone().sub(solved.S).normalize()
    const yd2 = solved.T.clone().sub(solved.E).normalize()
    const qFull = basisQ(solved.hinge, yd).multiply(basisQ(hingeRest, upRest).invert())
    const qLower = basisQ(solved.hinge, yd2).multiply(basisQ(hingeRest, loRest).invert())
    const yp = upRest.clone().normalize().applyQuaternion(qParent)
    const swing = new Q4().setFromUnitVectors(yp, yd).multiply(qParent)
    const rel = swing.clone().invert().multiply(qFull)
    const axis = upRest.clone().normalize()
    const tw = twistAngle(rel, axis)
    const q01 = swing.clone().multiply(rot(axis, tw * 0.3))
    return { q01, q02: qFull, qLower, humeralTwist: tw }
  }

  /** The hand's rest geometry, once per side, in the rest pose's coordinates. */
  _handRest(s) {
    const si = this.side[s]
    if (si.handRest) return si.handRest
    const by = this.by
    const f = si.fingerDir.clone()
    const n = si.palmNormal.clone()
    const t = (s === 'L' ? n.clone().cross(f) : f.clone().cross(n)).normalize()
    const chain = (F) => {
      const pts = [1, 2, 3].map((k) => by[`finger${F}-${k}.${s}`].head.clone())
      pts.push(by[`finger${F}-3.${s}`].tail.clone())
      const dirs = [0, 1, 2].map((k) => pts[k + 1].clone().sub(pts[k]).normalize())
      const lens = [0, 1, 2].map((k) => pts[k + 1].distanceTo(pts[k]))
      return { pts, dirs, lens, inv: dirs.map((d) => basisQ(d.clone().cross(n), d).invert()) }
    }
    const fingers = { 2: chain(2), 3: chain(3), 4: chain(4), 5: chain(5) }
    const mcHead = { 2: by[`metacarpal1.${s}`].head, 3: by[`metacarpal2.${s}`].head, 4: by[`metacarpal3.${s}`].head, 5: by[`metacarpal4.${s}`].head }
    si.handRest = { f, n, t, fingers, thumb: chain(1), mcHead, K3: by[`finger3-1.${s}`].head.clone() }
    return si.handRest
  }

  /** Where a bar of radius r runs through the hand, in the rest pose: across the base of the fingers, on the palm's skin. */
  _gripCentre(s, r) {
    const si = this.side[s]
    const h = this._handRest(s)
    return h.K3.clone().addScaledVector(h.f, -0.012).addScaledVector(h.n, si.palmOut * 0.82 + r)
  }

  /**
   * Poses a hand from its mode (see the header): each phalanx gets a target direction in the hand's own axes, then the
   * rotation from its rest basis, so a finger bends on its own hinge and never twists. "grip" and "hook" wrap the
   * fingers around the bar, phalanx by phalanx, from their real lengths; everything else comes from angles.
   */
  _fingers(s, spec, qHand, set) {
    const si = this.side[s]
    const h = this._handRest(s)
    const { f, n, t } = h
    const mode = handMode(spec)
    const curl = spec.curl ?? 0
    const preset = mode === 'legacy'
      ? { spread: 0, cup: 0.5, f: [62 * curl, 58 * curl, 30 * curl], thumb: [[0.6, 0.35, 0.7], [0.75, 0, 0.6], [0.8, -0.2, 0.55]] }
      : HAND_PRESETS[mode] || null
    const wrap = mode === 'grip' || mode === 'hook'
    const cupBase = wrap ? 1 : preset.cup
    const r = spec.grip ?? 0.016
    const C3 = this._gripCentre(s, r).sub(si.W)
    const C = [C3.dot(f), C3.dot(n)]
    const flexAxis = f.clone().cross(n).normalize()
    for (const F of [2, 3, 4, 5]) {
      const ch = h.fingers[F]
      const cup = CUP[F] * cupBase
      const qMc = rot(flexAxis, cup)
      set(`metacarpal${F - 1}.${s}`, qHand.clone().multiply(qMc))
      let dirs
      let hinge
      if (wrap) {
        const K = ch.pts[0].clone().sub(h.mcHead[F]).applyQuaternion(qMc).add(h.mcHead[F]).sub(si.W)
        dirs = wrapChain([K.dot(f), K.dot(n)], ch.lens, C, r + 0.0085, 1).map(([u, v]) => f.clone().multiplyScalar(u).addScaledVector(n, v))
        hinge = flexAxis
      } else {
        const d0 = f.clone().applyQuaternion(rot(n, si.sign * preset.spread * SPREAD[F]))
        hinge = d0.clone().cross(n).normalize()
        const angles = Array.isArray(preset.f[0]) ? preset.f[F - 2] : preset.f
        let cum = 0
        dirs = angles.map((deg) => {
          cum += deg
          return d0.clone().applyQuaternion(rot(hinge, cum))
        })
      }
      dirs.forEach((D, k) => {
        set(`finger${F}-${k + 1}.${s}`, qHand.clone().multiply(basisQ(hinge, D)).multiply(ch.inv[k]))
      })
    }
    // The thumb: shortest rotation from its rest direction, because its pad faces a different way from the fingers'.
    const th = h.thumb
    let targets
    if (mode === 'grip') {
      const P0 = th.pts[0].clone().sub(si.W)
      // It closes the other way around the bar, on top of the fingers, ending over the index and middle fingers.
      const circle = wrapChain([P0.dot(f), P0.dot(n)], th.lens, C, r + 0.024, -1)
      const tipT = h.fingers[2].pts[0].clone().sub(si.W).dot(t) * 0.75
      const total = th.lens[0] + th.lens[1] + th.lens[2]
      const slope = clamp((tipT - P0.dot(t)) / total, -0.8, 0.8)
      const c = Math.sqrt(1 - slope * slope)
      targets = circle.map(([u, v]) => f.clone().multiplyScalar(u * c).addScaledVector(n, v * c).addScaledVector(t, slope))
    } else {
      const parts = mode === 'hook' ? HAND_PRESETS.relaxed.thumb : preset.thumb
      targets = parts.map(([a, b, c]) => f.clone().multiplyScalar(a).addScaledVector(t, b).addScaledVector(n, c).normalize())
    }
    targets.forEach((D, k) => {
      set(`finger1-${k + 1}.${s}`, qHand.clone().multiply(new Q4().setFromUnitVectors(th.dirs[k], D)))
    })
  }

  /**
   * The rest shape with this frame's muscle swelling on it (build-body.mjs writes the displacements, see correctives()).
   * this._drivers holds the angles, in degrees, set by solve().
   */
  _poseCorrectedRest() {
    const list = this.data.correctives
    if (!list || !list.length) return this.ctlRest
    if (!this._restBuf) this._restBuf = new Float32Array(this.ctlN * 3)
    const out = this._restBuf
    out.set(this.ctlRest)
    for (const c of list) {
      const v = this._drivers[c.driver]
      if (v === undefined || v <= c.lo) continue
      let t = Math.min(1, (v - c.lo) / (c.hi - c.lo))
      t = t * t * (3 - 2 * t)
      const { idx, dx } = c
      for (let j = 0; j < idx.length; j++) {
        const k3 = idx[j] * 3
        const j3 = j * 3
        out[k3] += dx[j3] * t
        out[k3 + 1] += dx[j3 + 1] * t
        out[k3 + 2] += dx[j3 + 2] * t
      }
    }
    return out
  }

  _skin(Q, P) {
    const nb = this.bones.length
    const d0 = new Float64Array(nb * 4)
    const d1 = new Float64Array(nb * 4)
    const t = new V3()
    for (let i = 0; i < nb; i++) {
      const q = Q[i]
      const h = this.bones[i].head
      t.copy(h).applyQuaternion(q)
      const tx = P[i].x - t.x
      const ty = P[i].y - t.y
      const tz = P[i].z - t.z
      d0[i * 4] = q.x
      d0[i * 4 + 1] = q.y
      d0[i * 4 + 2] = q.z
      d0[i * 4 + 3] = q.w
      // qe = 0.5 * (t, 0) * q
      d1[i * 4] = 0.5 * (tx * q.w + ty * q.z - tz * q.y)
      d1[i * 4 + 1] = 0.5 * (-tx * q.z + ty * q.w + tz * q.x)
      d1[i * 4 + 2] = 0.5 * (tx * q.y - ty * q.x + tz * q.w)
      d1[i * 4 + 3] = 0.5 * (-tx * q.x - ty * q.y - tz * q.z)
    }
    const { ctlPos: pos, skinB, skinW, maxInf, ctlN: n } = this
    const rest = this._poseCorrectedRest()
    for (let k = 0; k < n; k++) {
      let ax = 0, ay = 0, az = 0, aw = 0, bx = 0, by = 0, bz = 0, bw = 0
      let refX = 0, refY = 0, refZ = 0, refW = 0
      for (let j = 0; j < maxInf; j++) {
        const bi = skinB[k * maxInf + j]
        if (bi < 0) break
        let w = skinW[k * maxInf + j]
        const o = bi * 4
        if (j === 0) {
          refX = d0[o]; refY = d0[o + 1]; refZ = d0[o + 2]; refW = d0[o + 3]
        } else if (refX * d0[o] + refY * d0[o + 1] + refZ * d0[o + 2] + refW * d0[o + 3] < 0) {
          w = -w
        }
        ax += w * d0[o]; ay += w * d0[o + 1]; az += w * d0[o + 2]; aw += w * d0[o + 3]
        bx += w * d1[o]; by += w * d1[o + 1]; bz += w * d1[o + 2]; bw += w * d1[o + 3]
      }
      const l = Math.hypot(ax, ay, az, aw) || 1
      ax /= l; ay /= l; az /= l; aw /= l
      bx /= l; by /= l; bz /= l; bw /= l
      const vx = rest[k * 3], vy = rest[k * 3 + 1], vz = rest[k * 3 + 2]
      // v' = v + 2 a x (a x v + aw v) + 2 (aw b - bw a + a x b)
      const cx = ay * vz - az * vy + aw * vx
      const cy = az * vx - ax * vz + aw * vy
      const cz = ax * vy - ay * vx + aw * vz
      const rx = vx + 2 * (ay * cz - az * cy)
      const ry = vy + 2 * (az * cx - ax * cz)
      const rz = vz + 2 * (ax * cy - ay * cx)
      pos[k * 3] = rx + 2 * (aw * bx - bw * ax + ay * bz - az * by)
      pos[k * 3 + 1] = ry + 2 * (aw * by - bw * ay + az * bx - ax * bz)
      pos[k * 3 + 2] = rz + 2 * (aw * bz - bw * az + ax * by - ay * bx)
    }
  }
}

/** Interpolates two frame specs. Numbers lerp, nested objects recurse, anything else snaps at t = 0.5. */
export function mixFrames(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, t)
  if (Array.isArray(a) && Array.isArray(b)) return a.map((x, i) => mixFrames(x, b[i], t))
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const out = {}
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (a[k] === undefined) out[k] = typeof b[k] === 'number' ? lerp(0, b[k], t) : b[k]
      else if (b[k] === undefined) out[k] = typeof a[k] === 'number' ? lerp(a[k], 0, t) : a[k]
      else out[k] = mixFrames(a[k], b[k], t)
    }
    return out
  }
  return t < 0.5 ? a : b
}

// ------------------------------------------------------------------------------------------------- the shoulder's range
// Shared with qa-lib.mjs (which documents them): rig.js keeps its automatic elbow swivel inside them.
export const SHOULDER_FORBIDDEN = [
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
export const SHOULDER_ROT = [
  [[0, -1, 0], -140, 110], // hanging. 0 is forearm forward, -90 across the belly, past that behind the back; 90 pointing out.
  [[1, 0, 0], -110, 140], // out to the side. 90 forearm up, -90 forearm down.
  [[0, 0, 1], -120, 160], // forward. 0 forearm across the chest, 90 forearm up, -90 forearm down.
  [[0, 1, 0], 25, 250], // overhead. 90 forearm over the head, 180 behind it.
  [[0, -0.6, -0.8], -150, 60], // behind the trunk, as at the top of a row. -90 points the forearm down.
  [[0.7, 0.7, 0], -40, 190],
  [[0, 0.7, 0.7], -60, 215],
]
export const interpRange = (table, x) => {
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

/** The range of the upper arm's rotation (degrees) for a direction in the chest's frame (x mirrored to the left side). */
export function armRotRange(dir) {
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
export function unwrapInto(r, lo, hi) {
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

