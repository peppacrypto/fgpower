// Turns a spec into what is drawn and checked: page.js and qa-lib.mjs both call prepareSpec() first, so the render and the check
// see the same pose. Three passes over the key frames (start, mid.., end), none of which a spec has to ask for:
//
// GRIP MAGNET. A closed hand ("grip"/"hook", or an older closed hand: curl over 0.55 with fingers and palm) that no prop follows
//   (no dumbbell or bar in it) and that comes within MAGNET (8 cm) of a graspable cylinder (grasp.js: a machine's handle, a bar,
//   a rung) is put on it: its grip centre goes onto the handle's axis, kept 4 cm inside the handle's ends, and its grip axis
//   (fingers x palm) along the handle: the least turn when it was nearly along it already, otherwise closed on the handle the way
//   a hand does, fingers continuing the forearm. Machines whose handle follows the body (follow:true) are rebuilt after each
//   round, so a handle on a carriage or a lever settles with the hand (3 rounds at most). An fk arm gets a world `nudge` of its
//   wrist instead of a new pos. A snap that leaves the arm short, or bends the elbow or the wrist past its range, is undone in
//   every key frame of that arm (check.mjs then reports hover: or grip:). "magnet": false on the spec or on an arm turns it off.
//   spec.__prep.grips lists what moved, how far, how much it turned.
//
// FREE GRIPS. A closed hand holding alone a dumbbell, a plate or a cable's single handle (grasp.js singleHeldSides) gets
//   freeGrip:true: rig.js then keeps that wrist in a comfortable band, the arm as declared and the weight following the hand.
//   Kettlebells and landmines keep the declared hand, and so do wrist exercises (muscles include "forearms") and "freeGrip": false.
//
// RESTING HANDS. An open hand whose palm lies on the body in every key frame (palm toward the skin, within REST_REACH of it) gets
//   hand "rest" (fingers together, softly curved) and is laid on the skin: palm against the surface's normal there, fingers along
//   it (turned on it when they would sink into the body in some key frame), palm centre on it. A relaxed hand's curled fingers
//   dig into the body like a claw. Not when a prop lies between, the wrist or the reach gets worse, or the other hand is under it.
//   "rest": false on an arm keeps the declared hand.
import * as THREE from './vendor/three.module.js'
import { basisQ } from './rig.js'
import { buildPropGroup, graspablesOf, bestGraspable, isDynamic, heldSides, singleHeldSides } from './grasp.js'

const { Vector3: V3, Quaternion: Q4 } = THREE
const v3 = (a) => (a && a.isVector3 ? a.clone() : new V3(a[0], a[1], a[2]))
const D = 180 / Math.PI

export const MAGNET = 0.08
export const REST_GAP = 0.035
const KEYS = ['start', 'mid', 'mid2', 'mid3', 'end']

/** A closed hand: grip, hook, or an older closed hand (curl over 0.55 with fingers and palm). */
export function isClosedArm(a) {
  if (!a) return false
  if (a.hand === 'grip' || a.hand === 'hook') return true
  return !a.hand && a.curl !== undefined && a.curl > 0.55 && !!a.fingers && !!a.palm
}

/** An open hand that may rest on something: no mode, or relaxed, flat, open, rest. */
function isOpenArm(a) {
  if (!a || isClosedArm(a)) return false
  const m = a.hand
  return !m || m === 'relaxed' || m === 'flat' || m === 'open' || m === 'rest'
}

function relFrame(report, rel) {
  if (!rel || rel === 'world') return null
  const f = report.frames[rel === 'chest' ? 'chest' : rel === 'pelvis' ? 'pelvis' : rel === 'head' ? 'head' : null]
  return f ? { o: v3(f.pos), q: new Q4(...f.quat) } : null
}
const pointToRel = (report, rel, p) => {
  const f = relFrame(report, rel)
  return f ? v3(p).sub(f.o).applyQuaternion(f.q.clone().invert()).toArray() : [...p]
}
const dirToWorld = (report, rel, d) => {
  const f = relFrame(report, rel)
  const v = v3(d).normalize()
  return f ? v.applyQuaternion(f.q) : v
}
const dirToRel = (report, rel, d) => {
  const f = relFrame(report, rel)
  const v = v3(d).normalize()
  return f ? v.applyQuaternion(f.q.clone().invert()) : v
}
const round = (a, k = 4) => a.map((x) => +x.toFixed(k))

/** The posed control mesh's outward vertex normals and, per side, the vertices of that arm (left out when a hand rests). */
function surfaceOf(body) {
  if (!body.__surf) {
    const quads = Int32Array.from(body.data.quads)
    // Left out for a resting hand: its own arm, and the other hand (palms pressed together, fingers laced: no surface to lay on).
    const armBones = { L: new Set(), R: new Set() }
    const handBones = new Set()
    for (const b of body.bones) {
      const m = /^(upperarm|lowerarm|wrist|metacarpal|finger)/.test(b.name) && b.name.match(/\.(L|R)$/)
      if (m) armBones[m[1]].add(b.i)
      if (/^(wrist|metacarpal|finger)/.test(b.name)) handBones.add(b.i)
    }
    const arm = { L: new Uint8Array(body.ctlN), R: new Uint8Array(body.ctlN) }
    for (let k = 0; k < body.ctlN; k++) {
      const b0 = body.skinB[k * body.maxInf]
      if (armBones.L.has(b0) || handBones.has(b0)) arm.L[k] = 1
      if (armBones.R.has(b0) || handBones.has(b0)) arm.R[k] = 1
    }
    body.__surf = { quads, arm, normals: new Float32Array(body.ctlN * 3), sign: 0 }
    // Winding: decide once, on the rest pose, which way is out (as qa-lib does).
    const s = body.__surf
    computeNormals(s, body.ctlRest)
    let cx = 0, cy = 0, cz = 0
    for (let k = 0; k < body.ctlN; k++) {
      cx += body.ctlRest[k * 3]
      cy += body.ctlRest[k * 3 + 1]
      cz += body.ctlRest[k * 3 + 2]
    }
    cx /= body.ctlN
    cy /= body.ctlN
    cz /= body.ctlN
    let out = 0
    for (let k = 0; k < body.ctlN; k++) out += (body.ctlRest[k * 3] - cx) * s.normals[k * 3] + (body.ctlRest[k * 3 + 1] - cy) * s.normals[k * 3 + 1] + (body.ctlRest[k * 3 + 2] - cz) * s.normals[k * 3 + 2]
    s.sign = out < 0 ? -1 : 1
  }
  return body.__surf
}

function computeNormals(s, p) {
  const { quads, normals: n } = s
  n.fill(0)
  for (let i = 0; i < quads.length; i += 4) {
    const a = quads[i] * 3, b = quads[i + 1] * 3, c = quads[i + 2] * 3, d = quads[i + 3] * 3
    const ux = p[c] - p[a], uy = p[c + 1] - p[a + 1], uz = p[c + 2] - p[a + 2]
    const vx = p[d] - p[b], vy = p[d + 1] - p[b + 1], vz = p[d + 2] - p[b + 2]
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    for (const k of [a, b, c, d]) {
      n[k] += nx
      n[k + 1] += ny
      n[k + 2] += nz
    }
  }
  for (let k = 0; k < n.length; k += 3) {
    const l = Math.hypot(n[k], n[k + 1], n[k + 2]) || 1
    n[k] /= l
    n[k + 1] /= l
    n[k + 2] /= l
  }
}

/**
 * The skin nearest to a point, leaving out one arm: { p, n (outward), d }. The normal is averaged over the vertices within 3 cm,
 * so a hand lies on the local shape rather than on one facet.
 */
function nearestSkin(body, point, skipSide) {
  const s = surfaceOf(body)
  const P = body.ctlPos
  computeNormals(s, P)
  const skip = s.arm[skipSide]
  let best = -1
  let bd = Infinity
  for (let k = 0; k < body.ctlN; k++) {
    if (skip[k]) continue
    const dx = P[k * 3] - point[0], dy = P[k * 3 + 1] - point[1], dz = P[k * 3 + 2] - point[2]
    const d = dx * dx + dy * dy + dz * dz
    if (d < bd) {
      bd = d
      best = k
    }
  }
  if (best < 0) return null
  const c = v3([P[best * 3], P[best * 3 + 1], P[best * 3 + 2]])
  const n = new V3()
  let w = 0
  for (let k = 0; k < body.ctlN; k++) {
    if (skip[k]) continue
    const dx = P[k * 3] - c.x, dy = P[k * 3 + 1] - c.y, dz = P[k * 3 + 2] - c.z
    const d2 = dx * dx + dy * dy + dz * dz
    if (d2 > 0.03 * 0.03) continue
    const wk = 1 - Math.sqrt(d2) / 0.03
    n.x += s.normals[k * 3] * wk
    n.y += s.normals[k * 3 + 1] * wk
    n.z += s.normals[k * 3 + 2] * wk
    w += wk
  }
  if (!w) return null
  n.multiplyScalar(s.sign).normalize()
  return { p: c, n, d: Math.sqrt(bd) }
}

/**
 * The prepared copy of a spec (and what it changed, in spec.__prep). body: a rig.js Body (or qa-lib's QABody).
 * opts.magnet, opts.freeGrip, opts.rest: false turns a pass off.
 */
export function prepareSpec(body, spec, opts = {}) {
  const out = JSON.parse(JSON.stringify(spec))
  const notes = { grips: [], free: [], rest: [], restSkipped: [] }
  out.__prep = notes
  if (!out.frames) return out
  const names = Object.keys(out.frames).filter((n) => KEYS.includes(n) || !n.startsWith('_'))
  const solve = (frame) => body.solve(frame, { surface: false }).report
  // The props: those that never move built once, the others for the frame being looked at. An unknown or broken prop is the
  // check's business (prop-unknown, prop-error): left out here.
  let statics = null
  const build = (p, ctx) => {
    try {
      return buildPropGroup(p, ctx)
    } catch (e) {
      return null
    }
  }
  const staticGroups = () => (statics ||= (out.props || []).filter((p) => !isDynamic(p)).map((p) => ({ p, g: build(p, null) })).filter((x) => x.g))
  const groupsAt = (frame, report) => [
    ...staticGroups(),
    ...[...(out.props || []).filter(isDynamic), ...(frame.props || [])].map((p) => ({ p, g: build(p, report) })).filter((x) => x.g),
  ]
  // What a closed hand can hold: not the props in the hands themselves.
  const graspables = (frame, report) => groupsAt(frame, report).filter((x) => !x.p.hand && !x.p.hands).flatMap((x) => graspablesOf(x.g))
  const forearms = (out.muscles || []).includes('forearms')
  // The magnet's work per arm: { L: [{ name, original }], ... }. An arm it had to undo in one key frame is undone in all of them,
  // or the hand would turn one way in one key frame and another way in the next.
  const snapped = { L: [], R: [] }
  const undone = new Set()

  for (const name of names) {
    const frame = out.frames[name]
    if (!frame || typeof frame !== 'object') continue
    // Free grips.
    if (opts.freeGrip !== false && !forearms) {
      for (const s of singleHeldSides(out, frame)) {
        const a = frame[`arm${s}`]
        if (!a || !isClosedArm(a) || a.freeGrip === false || !a.fingers || !a.palm) continue
        if (!a.hand) {
          a.hand = 'grip'
          a.grip = a.grip ?? 0.016
        }
        a.freeGrip = true
        notes.free.push(`${name}.${s}`)
      }
    }
    // The grip magnet.
    if (opts.magnet !== false && out.magnet !== false) {
      const held = heldSides(out, frame)
      const sides = ['L', 'R'].filter((s) => isClosedArm(frame[`arm${s}`]) && !held.has(s) && frame[`arm${s}`].magnet !== false)
      if (sides.length) {
        const res = magnetFrame(body, out, name, frame, sides, graspables, solve, notes)
        for (const [s, r] of Object.entries(res)) {
          if (r.undone) undone.add(s)
          else snapped[s].push({ name, original: r.original })
        }
      }
    }
  }
  // Resting hands: an arm whose hand lies on the body in every key frame, so the loop never switches what pos means.
  if (opts.rest !== false) {
    for (const s of ['L', 'R']) {
      const frames = names.filter((n) => out.frames[n] && out.frames[n][`arm${s}`])
      if (!frames.length) continue
      if (frames.some((n) => { const a = out.frames[n][`arm${s}`]; return !isOpenArm(a) || a.fk || !a.pos || a.rest === false })) continue
      const why = []
      const plans = frames.map((n) => restPlan(body, out.frames[n], s, solve, why, groupsAt))
      if (plans.some((p) => !p)) {
        // Only near the body: a hand in the air is no candidate worth a note.
        if (opts.debug || why.some((w) => +w.split(' ')[1] < 6)) notes.restSkipped.push(`${s}: ${why.join('; ')}`)
        continue
      }
      const before = frames.map((n) => JSON.parse(JSON.stringify(out.frames[n][`arm${s}`])))
      // Laid on the skin, in every key frame: the wrist no worse than declared, the arm not short of its target, no fingertip
      // sunk 1.5 cm into the body (a thigh coming up to a hand on the hip), and the other hand not under it (palms together).
      // The fingers first point as declared (along the skin), then turned on it, then back (thumbs forward on a hip).
      let why2 = ''
      const fails = () =>
        frames.some((n, i) => {
          const r = solve(out.frames[n])
          if (wristExcess(r, s) > plans[i].wrist0 + 2) return (why2 = `${n}: the wrist would bend past its range`)
          if (r.reach[`arm${s}`] > Math.max(plans[i].reach0, 0.004) + 0.001) return (why2 = `${n}: the arm would not reach`)
          const o = r.hands[s === 'L' ? 'R' : 'L'].centre
          if (v3(r.hands[s].centre).distanceTo(v3(o)) < 0.09) return (why2 = `${n}: the other hand is under it`)
          for (const tip of r.hands[s].tips) {
            const k = nearestSkin(body, tip, s)
            if (k && v3(tip).sub(k.p).dot(k.n) < -0.015) return (why2 = `${n}: a fingertip would sink into the body`)
          }
          return false
        })
      let laid = null
      for (const turn of [0, 35, -35, 70, -70, 180]) {
        frames.forEach((n, i) => {
          const a = Object.assign(out.frames[n][`arm${s}`], plans[i].arm, { fingers: plans[i].fingersAt(turn) })
          delete a.curl
        })
        if (!fails()) {
          laid = turn
          break
        }
        frames.forEach((n, i) => (out.frames[n][`arm${s}`] = JSON.parse(JSON.stringify(before[i]))))
      }
      if (laid === null) {
        notes.restSkipped.push(`${s}: not laid, ${why2}`)
        continue
      }
      frames.forEach((n, i) => notes.rest.push({ frame: n, arm: s, cm: plans[i].gap, deg: plans[i].turn, fingersTurned: laid }))
    }
  }
  for (const s of undone) {
    for (const { name, original } of snapped[s]) {
      out.frames[name][`arm${s}`] = original
      const n = notes.grips.find((g) => g.frame === name && g.arm === s)
      if (n) n.undone = true
    }
  }
  return out
}

/** Degrees a wrist is past qa-lib's limits (flexion 70, extension 80, ulnar 35, radial 25), measured as qa-lib does. */
export function wristExcess(report, s) {
  const h = report.hands[s]
  const fw = v3(h.wrist).sub(v3(report.joints[`lowerarm01.${s}`])).normalize()
  const flex = Math.atan2(-fw.dot(v3(h.palm)), fw.dot(v3(h.fingers))) * D
  const dev = Math.asin(Math.max(-1, Math.min(1, fw.dot(v3(h.thumb))))) * D
  return Math.max(0, flex - 70) + Math.max(0, -flex - 80) + Math.max(0, dev - 35) + Math.max(0, -dev - 25)
}

/**
 * The hand on a handle along `axis` (unit), its grip centre wherever it is: { fingers, palm } in world. The thumb runs along the
 * handle, the fingers continue the forearm (wrist neutral, as a hand closes on a handle), and of the two ways round (overhand,
 * underhand) the one whose palm is nearer the declared palm.
 */
function handOnAxis(s, axis, forearm, palmDecl) {
  const f = forearm.clone().addScaledVector(axis, -forearm.dot(axis))
  if (f.lengthSq() < 0.04) return null
  f.normalize()
  let best = null
  for (const sign of [1, -1]) {
    const t = axis.clone().multiplyScalar(sign)
    // rig.js: thumb = palm x fingers on the left hand, fingers x palm on the right.
    const n = s === 'L' ? f.clone().cross(t) : t.clone().cross(f)
    const score = n.dot(palmDecl)
    if (!best || score > best.score) best = { fingers: f.clone(), palm: n, score }
  }
  return best
}

function magnetFrame(body, spec, name, frame, sides, graspables, solve, notes) {
  const moved = {}
  const original = Object.fromEntries(sides.map((s) => [s, JSON.parse(JSON.stringify(frame[`arm${s}`]))]))
  const before = solve(frame)
  for (let pass = 0; pass < 3; pass++) {
    const report = pass === 0 ? before : solve(frame)
    const list = graspables(frame, report)
    if (!list.length) return {}
    let changed = false
    for (const s of sides) {
      const a = frame[`arm${s}`]
      const h = report.hands[s]
      const si = body.side[s]
      const r0 = a.grip ?? 0.016
      // Where the bar is in this hand: its grip centre (an older closed hand is a grip in rig.js too).
      const q = new Q4(...h.quat)
      const c = v3(h.wrist).add(body._gripCentre(s, r0).sub(si.W).applyQuaternion(q))
      const best = bestGraspable(list, c.toArray(), h.thumb, MAGNET)
      if (!best) continue
      // A frame tube or a rung across the hand, a few cm off, is not what it holds.
      if (best.g.src === 'cyl' && best.ang > 50 && best.d > 0.02) continue
      // Under 3 mm nothing shows, and a straight arm would only bend at the elbow.
      const needMove = best.d > 0.003
      const needTurn = best.ang > 4
      if (!needMove && !needTurn) continue
      // fingers and palm are in the arm's rel frame, world by default (for an fk arm too: see rig.js handQ).
      const rel = a.rel || 'world'
      const axis = v3(best.axis)
      let fingersW
      let palmW
      if (best.ang > 12) {
        // Declared across the handle: closed on it the way a hand closes on a handle, from the forearm.
        const forearm = v3(h.wrist).sub(v3(report.joints[`lowerarm01.${s}`])).normalize()
        const on = handOnAxis(s, axis, forearm, dirToWorld(report, rel, a.palm))
        if (!on) continue
        fingersW = on.fingers
        palmW = on.palm
      } else {
        // Nearly along it already: the least turn, so the declared look stays.
        const t = v3(h.thumb)
        if (axis.dot(t) < 0) axis.negate()
        const turn = new Q4().setFromUnitVectors(t, axis)
        fingersW = dirToWorld(report, rel, a.fingers).applyQuaternion(turn)
        palmW = dirToWorld(report, rel, a.palm).applyQuaternion(turn)
      }
      const grip = Math.min(0.03, Math.max(0.012, best.g.r))
      const P = v3(best.p)
      if (a.fk) {
        // The wrist that puts this hand's grip centre on P, turned as above (the hand built from fingers and palm as rig.js does).
        const fRest = basisQ(si.fingerDir.clone().cross(si.palmNormal), si.fingerDir)
        const q1 = basisQ(fingersW.clone().cross(palmW), fingersW).multiply(fRest.invert())
        const W1 = P.clone().sub(body._gripCentre(s, grip).sub(si.W).applyQuaternion(q1))
        const n0 = a.nudge ? v3(a.nudge) : new V3()
        a.nudge = round(n0.add(W1.sub(v3(h.wrist))).toArray())
      } else {
        a.pos = round(pointToRel(report, rel, P.toArray()))
      }
      a.fingers = round(dirToRel(report, rel, fingersW).toArray())
      a.palm = round(dirToRel(report, rel, palmW).toArray())
      a.hand = 'grip'
      a.grip = +grip.toFixed(4)
      const m = (moved[s] ||= { d: 0, ang: 0, to: '' })
      m.d += best.d
      m.ang += best.ang
      m.to = best.g.name || best.g.src
      changed = true
    }
    if (!changed) break
  }
  // A snap that leaves the arm short of its target, bends the elbow past what a body does or the wrist past its range is undone:
  // the check then says plainly that the hand is off its handle (hover:) or across it (grip:), which is what to fix in the spec
  // (usually the elbow: the forearm must come to the handle square to it).
  const after = Object.keys(moved).length ? solve(frame) : null
  const result = {}
  for (const [s, m] of Object.entries(moved)) {
    const worse =
      after.reach[`arm${s}`] > Math.max(before.reach[`arm${s}`], 0.004) + 0.001 ||
      (after.angles[`elbow${s}`] > 150 && after.angles[`elbow${s}`] > before.angles[`elbow${s}`] + 1) ||
      wristExcess(after, s) > wristExcess(before, s) + 3
    if (worse) frame[`arm${s}`] = original[s]
    result[s] = { undone: worse, original: original[s] }
    notes.grips.push({ frame: name, arm: s, ...(worse ? { undone: true } : {}), cm: +(m.d * 100).toFixed(1), deg: Math.round(m.ang), to: m.to })
  }
  return result
}

/**
 * How far off the skin an open hand may be and still be taken as resting on it, by what the spec says: contact:true declared on
 * the body (rel pelvis, chest, head) means "on the body", so a palm up to 12 cm off is brought onto it; relative to a body part
 * without contact, 6 cm; anything else REST_GAP. And how far its palm may have to turn to lie flat: past that the hand is
 * meant some other way (on its edge, cupped).
 */
const REST_REACH = { contact: 0.12, body: 0.06, other: REST_GAP }
const REST_TURN = { contact: 60, body: 40, other: 40 }

/**
 * Where an open hand would lie on the body in this frame, or null when it does not rest on it: its palm centre near the skin (see
 * REST_REACH; or up to 3 cm sunk in), right over it, the palm toward it and within REST_TURN of lying flat on it.
 */
function restPlan(body, frame, s, solve, why = [], groupsAt = null) {
  const a = frame[`arm${s}`]
  const onBody = a.rel === 'pelvis' || a.rel === 'chest' || a.rel === 'head'
  const intent = onBody && a.contact ? 'contact' : onBody ? 'body' : 'other'
  const report = solve(frame)
  const h = report.hands[s]
  const skin = nearestSkin(body, h.centre, s)
  if (!skin) return null
  const off = v3(h.centre).sub(skin.p)
  const gap = off.dot(skin.n)
  const lateral = off.clone().addScaledVector(skin.n, -gap).length()
  const palm = v3(h.palm)
  const turn = Math.acos(Math.max(-1, Math.min(1, -palm.dot(skin.n)))) * D
  why.push(`gap ${(gap * 100).toFixed(1)} lateral ${(lateral * 100).toFixed(1)} cm, turn ${Math.round(turn)} deg (${intent})`)
  if (gap > REST_REACH[intent] || gap < -0.03 || lateral > 0.04) return null
  if (turn > REST_TURN[intent]) return null
  // A prop between the palm and the skin (a plate held to the forehead, a pad): the hand rests on that, not on the body.
  if (groupsAt && gap > 0.005) {
    const from = v3(h.centre).addScaledVector(skin.n, 0.01)
    const ray = new THREE.Raycaster(from, skin.n.clone().negate(), 0, gap + 0.01)
    const hits = ray.intersectObjects(groupsAt(frame, report).map((x) => x.g), true)
    if (hits.length) {
      why.push('a prop lies between the palm and the skin')
      return null
    }
  }
  const n = skin.n
  const fingers = v3(h.fingers).addScaledVector(n, -v3(h.fingers).dot(n))
  if (fingers.lengthSq() < 0.05) return null
  fingers.normalize()
  const rel = a.rel || 'world'
  // The palm's skin just touching the body's (the drawn skin lies a few mm inside the control mesh).
  const at = skin.p.clone().addScaledVector(n, -0.002)
  return {
    arm: {
      pos: round(pointToRel(report, rel, at.toArray())),
      fingers: round(dirToRel(report, rel, fingers).toArray()),
      palm: round(dirToRel(report, rel, n.clone().negate()).toArray()),
      contact: true,
      hand: 'rest',
    },
    // The fingers turned on the skin about its normal by deg, in the arm's frame.
    fingersAt: (deg) => round(dirToRel(report, rel, fingers.clone().applyQuaternion(new Q4().setFromAxisAngle(n, (deg * Math.PI) / 180))).toArray()),
    wrist0: wristExcess(report, s),
    reach0: report.reach[`arm${s}`],
    gap: +(Math.abs(gap) * 100).toFixed(1),
    turn: Math.round(turn),
  }
}
