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
//     { fk:{ flex, abd, rot, elbow }, rel:"chest", pron, curl, scap }
//       flex 90 is a forward raise, abd 90 is a side raise, elbow 0 is straight, pron turns the forearm.
//   legL / legR, one of:
//     { pos:[x,y,z], rel:"world", anchor:"ankle"|"ball"|"heel"|"sole", yaw, pitch, roll, toes, pole:[x,y,z] }
//       toes is the toes' own world pitch (0 lays them flat on a floor), default follows the foot.
//     { fk:{ flex, abd, rot, knee }, rel:"pelvis", foot:{ pitch } }
//
// Output: {positions (Float32Array), report}. The report gives reach errors, the lowest point and joint angles.

import * as THREE from './vendor/three.module.js'

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

function basisQ(x, y) {
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

export class Body {
  constructor(data) {
    this.data = data
    this.n = data.positions.length / 3
    this.rest = Float32Array.from(data.positions)
    this.index = data.index
    this.maxInf = data.maxInfluences
    this.skinB = Int16Array.from(data.skinB)
    this.skinW = Float32Array.from(data.skinW)
    this.bones = data.bones.map((b, i) => ({ name: b.name, i, parent: b.parent, head: v3(b.head), tail: v3(b.tail) }))
    this.by = Object.fromEntries(this.bones.map((b) => [b.name, b]))
    this.pos = new Float32Array(this.n * 3)
    // Fingers and toes get a thinner outline: at this scale the normal line would swallow them.
    this.ink = new Float32Array(this.n)
    const thin = new Set(this.bones.filter((b) => /^(finger|toe)/.test(b.name)).map((b) => b.i))
    for (let k = 0; k < this.n; k++) {
      let w = 0
      for (let j = 0; j < this.maxInf; j++) {
        const bi = this.skinB[k * this.maxInf + j]
        if (bi >= 0 && thin.has(bi)) w += this.skinW[k * this.maxInf + j]
      }
      this.ink[k] = 1 - 0.68 * w
    }
    this._firmHinges()
    const trunkBones = new Set(this.bones.filter((b) => /^(root|spine0[1-5]|pelvis)/.test(b.name)).map((b) => b.i))
    this.trunkVerts = new Uint8Array(this.n)
    for (let k = 0; k < this.n; k++) this.trunkVerts[k] = trunkBones.has(this.skinB[k * this.maxInf]) ? 1 : 0
    this._landmarks()
  }

  /**
   * The source weights fade across a wide band at the elbow and knee, which bends them like a hose. Narrowing the
   * band between the two sides of each hinge gives a real crease on the inside and a real point on the outside.
   */
  _firmHinges() {
    const HINGES = [
      ['upperarm02', 'lowerarm01', 2.4],
      ['upperleg02', 'lowerleg01', 2.0],
      ['lowerarm02', 'wrist', 1.5],
    ]
    const pairs = new Map()
    for (const [a, b, p] of HINGES) {
      for (const side of ['L', 'R']) {
        const ia = this.by[`${a}.${side}`].i
        const ib = this.by[`${b}.${side}`].i
        pairs.set(ia, { other: ib, p })
      }
    }
    const { skinB, skinW, maxInf, n } = this
    for (let k = 0; k < n; k++) {
      for (let j = 0; j < maxInf; j++) {
        const pair = pairs.get(skinB[k * maxInf + j])
        if (!pair) continue
        for (let l = 0; l < maxInf; l++) {
          if (skinB[k * maxInf + l] !== pair.other) continue
          const w1 = skinW[k * maxInf + j]
          const w2 = skinW[k * maxInf + l]
          const sum = w1 + w2
          if (sum <= 0) continue
          const a = Math.pow(w1 / sum, pair.p)
          const b = Math.pow(w2 / sum, pair.p)
          skinW[k * maxInf + j] = (sum * a) / (a + b)
          skinW[k * maxInf + l] = (sum * b) / (a + b)
        }
      }
    }
  }

  _footVerts(side) {
    const foot = this.by[`foot.${side}`].i
    const toes = new Set(this.bones.filter((b) => /^toe/.test(b.name) && b.name.endsWith(side)).map((b) => b.i))
    const out = []
    for (let k = 0; k < this.n; k++) {
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
      const palmCentre = W.clone().lerp(b[`finger3-1.${s}`].head, 0.5).addScaledVector(n, 0.03)
      // Foot landmarks from the mesh, so they stay right if the body shape changes.
      const fv = this._footVerts(s)
      let minZ = Infinity
      let maxZ = -Infinity
      for (const k of fv) {
        const z = this.rest[k * 3 + 2]
        minZ = Math.min(minZ, z)
        maxZ = Math.max(maxZ, z)
      }
      const heelPts = fv.filter((k) => this.rest[k * 3 + 2] < minZ + 0.012)
      const hx = heelPts.reduce((t, k) => t + this.rest[k * 3], 0) / heelPts.length
      const heel = new V3(hx, 0, minZ + 0.02)
      const ball = b[`toe2-1.${s}`].head.clone().lerp(b[`toe4-1.${s}`].head, 0.5)
      ball.y = 0
      const sole = heel.clone().lerp(ball, 0.5)
      this.side[s] = {
        sign: s === 'L' ? 1 : -1,
        S, E, W, up, lo, armHinge, a: up.length(), b: lo.length(),
        H, K, A, th, sh, legHinge, c: th.length(), d: sh.length(),
        fingerDir: f, palmNormal: n, palmCentre, heel, ball, sole,
      }
    }
  }

  solve(frame) {
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
    const propagate = () => {
      for (const b of this.bones) {
        if (b.parent < 0) {
          Q[b.i] = assigned[b.i] || qRoot
          P[b.i] = pelvisPos.clone().add(b.head.clone().sub(this.pelvisCentre).applyQuaternion(Q[b.i]))
        } else {
          const pb = this.bones[b.parent]
          Q[b.i] = assigned[b.i] || Q[b.parent]
          P[b.i] = P[b.parent].clone().add(b.head.clone().sub(pb.head).applyQuaternion(Q[b.parent]))
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
      L: frame.armL || { fk: { flex: 0, abd: 7, elbow: 12 } },
      R: frame.armR || { fk: { flex: 0, abd: 7, elbow: 12 } },
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
    const armTarget = (s, spec, S, qHand) => {
      const si = this.side[s]
      if (spec.fk) return fkArm(s, spec, S)
      let T = toWorld(spec.rel || 'world', spec.pos)
      if (spec.contact && qHand) T = T.sub(si.palmCentre.clone().sub(si.W).applyQuaternion(qHand))
      const pole = spec.pole
        ? dirWorld(spec.rel || 'world', spec.pole)
        : new V3(si.sign * 0.5, -0.5, -0.7).normalize().applyQuaternion(qChest())
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

    for (const s of ['L', 'R']) {
      const spec = armSpecs[s]
      const si = this.side[s]
      const qh = handQ(s, spec)
      const S0 = P[by[`upperarm01.${s}`].i]
      const { T } = armTarget(s, spec, S0, qh)
      const inChest = T.clone().sub(S0).applyQuaternion(qChest().clone().invert()).normalize()
      const elevAngle = Math.acos(clamp(-inChest.y, -1, 1)) / D
      const forward = Math.max(0, inChest.z)
      const scap = spec.scap || {}
      const elev = scap.elev ?? clamp(elevAngle - 70, 0, 110) * 0.22
      const prot = scap.prot ?? forward * 9
      report.angles[`scap${s}`] = { elev: +elev.toFixed(1), prot: +prot.toFixed(1) }
      const qc = rot(Z, si.sign * elev).multiply(rot(Y, -si.sign * prot))
      set(`clavicle.${s}`, Q[by.spine01.i].clone().multiply(qc))
    }
    propagate()

    for (const s of ['L', 'R']) {
      const spec = armSpecs[s]
      const si = this.side[s]
      const qh = handQ(s, spec)
      const S = P[by[`upperarm01.${s}`].i].clone()
      const { T, pole } = armTarget(s, spec, S, qh)
      const solved = this._twoBone(S, T, si.a, si.b, pole)
      report.reach[`arm${s}`] = +solved.miss.toFixed(3)
      const qParent = Q[by[`shoulder01.${s}`].i]
      const up = this._limbQ(solved, si.up, si.lo, si.armHinge, qParent)
      set(`upperarm01.${s}`, up.q01)
      set(`upperarm02.${s}`, up.q02)
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
      set(`lowerarm01.${s}`, qLower.clone().multiply(rot(axis, tw * 0.2)))
      set(`lowerarm02.${s}`, qLower.clone().multiply(rot(axis, tw * 0.7)))
      set(`wrist.${s}`, qHand)
      this._fingers(s, spec.curl ?? 0.3, qHand, set)
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

    this._skin(Q, P)
    let minY = Infinity
    let minK = 0
    for (let k = 0; k < this.n; k++) {
      if (this.pos[k * 3 + 1] < minY) {
        minY = this.pos[k * 3 + 1]
        minK = k
      }
    }
    report.lowestPoint = +minY.toFixed(3)
    report.lowestPart = this.bones[this.skinB[minK * this.maxInf]].name
    // How far the trunk is from the floor, for poses lying on it: fingers touching the floor hide a floating body.
    let trunk = Infinity
    for (let k = 0; k < this.n; k++) {
      if (this.trunkVerts[k] && this.pos[k * 3 + 1] < trunk) trunk = this.pos[k * 3 + 1]
    }
    report.trunkLowest = +trunk.toFixed(3)
    const joints = {}
    for (const n of ['head', 'spine01', 'wrist.L', 'wrist.R', 'foot.L', 'foot.R', 'lowerarm01.L', 'lowerarm01.R', 'lowerleg01.L', 'lowerleg01.R', 'upperleg01.L', 'upperleg01.R', 'upperarm01.L', 'upperarm01.R']) {
      const p = P[by[n].i]
      joints[n] = [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)]
    }
    report.joints = joints
    return { positions: this.pos, report }
  }

  /**
   * Rewrites world-frame foot anchors and palm contacts as plain ankle and wrist targets, so that two frames using
   * different anchors still interpolate smoothly.
   */
  resolveFrame(frame) {
    const out = JSON.parse(JSON.stringify(frame))
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
      if (arm && arm.pos && arm.contact && arm.fingers && arm.palm && (arm.rel === undefined || arm.rel === 'world')) {
        const fRest = basisQ(si.fingerDir.clone().cross(si.palmNormal), si.fingerDir)
        const f = v3(arm.fingers).normalize()
        const n = v3(arm.palm).normalize()
        const qHand = basisQ(f.clone().cross(n), f).multiply(fRest.clone().invert())
        const T = v3(arm.pos).sub(si.palmCentre.clone().sub(si.W).applyQuaternion(qHand))
        arm.pos = [T.x, T.y, T.z]
        arm.contact = false
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
    const q01 = swing.clone().multiply(rot(axis, tw * 0.45))
    return { q01, q02: qFull, qLower }
  }

  _fingers(s, rawCurl, qHand, set) {
    // An open hand stays gently bent: up to about 0.55 the value is scaled down, or it reads as a claw. Above that it is
    // a grip, on a towel or a door corner, and is taken as it is.
    const curl = rawCurl <= 0.55 ? rawCurl * 0.55 : rawCurl
    const si = this.side[s]
    const by = this.by
    const n = si.palmNormal
    const flexAxis = si.fingerDir.clone().cross(n).normalize()
    const middle = by[`finger3-2.${s}`].head.clone().sub(by[`finger3-1.${s}`].head).normalize()
    // Degrees per joint at curl 1: knuckle, middle, tip. A relaxed hand bends more at the knuckle than a claw does.
    const parts = [62, 58, 30]
    for (const [mc, f] of [[1, 2], [2, 3], [3, 4], [4, 5]]) {
      set(`metacarpal${mc}.${s}`, qHand)
      // The model's rest hand has its fingers spread: bring them most of the way to the middle finger.
      const heads = [1, 2, 3].map((seg) => by[`finger${f}-${seg}.${s}`].head)
      const tail = by[`finger${f}-3.${s}`].tail
      const dirs = [heads[1].clone().sub(heads[0]), heads[2].clone().sub(heads[1]), tail.clone().sub(heads[2])].map((d) => d.normalize())
      const spread = new Q4().setFromUnitVectors(dirs[0].clone().sub(n.clone().multiplyScalar(dirs[0].dot(n))).normalize(), middle.clone().sub(n.clone().multiplyScalar(middle.dot(n))).normalize())
      const gather = new Q4().slerp(spread, 0.8)
      let q = qHand.clone().multiply(gather)
      let prev = si.fingerDir
      parts.forEach((deg, seg) => {
        // Bend relative to the rest pose, but never past straight: a flat hand, not one bent backwards.
        const rest = Math.atan2(prev.clone().cross(dirs[seg]).dot(flexAxis), prev.dot(dirs[seg])) / D
        const target = Math.max(0, rest + curl * deg)
        q = q.clone().multiply(rot(flexAxis, target - rest))
        set(`finger${f}-${seg + 1}.${s}`, q)
        prev = dirs[seg]
      })
    }
    // The thumb rests closer to the palm, then bends with the fingers.
    const t = by[`finger1-2.${s}`].head.clone().sub(by[`finger1-1.${s}`].head).normalize()
    const at = t.clone().cross(n).normalize()
    const toPalm = new Q4().setFromUnitVectors(t, t.clone().lerp(si.fingerDir, 0.35).normalize())
    let q = qHand.clone().multiply(toPalm)
    for (const seg of [1, 2, 3]) {
      q = q.clone().multiply(rot(at, Math.max(0, curl) * 22))
      set(`finger1-${seg}.${s}`, q)
    }
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
    const { rest, pos, skinB, skinW, maxInf, n } = this
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
