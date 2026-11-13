// How a rep moves in time, and the joint measures behind it. Shared by page.js (the loop's frames), qa-lib.mjs (the motion checks)
// and motion-strips.mjs. No DOM, no Node.
//
// THE LIFT. A spec runs start -> (mid, mid2, mid3) -> end and the loop comes back the same way. Each segment between two key
// frames is a concentric part (the lit muscles shorten: the lift), an eccentric part (they lengthen: the lowering) or neither.
// muscleLength() turns joint angles into a length for each muscle id of the taxonomy (degrees of the joints that stretch it), so
// the frame where the lit muscles are shortest is the top of the concentric. spec.tempo.lift overrides it: "there" (start -> end
// is the lift), "back" (end -> start is the lift) or "even" (no lift: a stretch, a mobility drill, or when unsure).
//
// THE TEMPO. A coached rep: the lowering slower than the lift, a short pause at each end, never a constant speed. Each part moves
// on a minimum-jerk curve (the smooth start and stop of a human reach). Defaults, seconds, by the catalog's category:
//   strength       up 1.0, down 1.8, squeeze 0.35 (pause where the muscles are shortest), stretch 0.2 (where they are longest)
//   plyometrics    up 0.45, down 0.6, squeeze 0.12, stretch 0.18        olympic lifts up 0.7, down 1.3
//   stretching     even: 1.6 each way, hold 1.0 in the stretch (end), 0.4 at the start
//   cardio         even 0.6 each way, no pause                          static holds with an end frame: even 1.5, hold 0.6
// spec.tempo { lift, up, down, squeeze, stretch, even, hold } changes any of them. spec.timing { there, holdEnd, back, holdStart }
// (seconds, the older field) still sets the whole loop by hand and wins over both.
import * as THREE from './vendor/three.module.js'

const { Vector3: V3, Quaternion: Q4 } = THREE
const D = 180 / Math.PI
const v3 = (a) => new V3(a[0], a[1], a[2])

/** Joint measures of a solved pose (rig.js report) and its frame spec, in degrees. Side keys end in L or R. */
export function anglesOf(report, frame = {}) {
  const j = report.joints
  const qp = new Q4(...report.frames.pelvis.quat).invert()
  const qc = new Q4(...report.frames.chest.quat).invert()
  const a = {}
  const sp = frame.spine || {}
  const sum = (sp.weights || [0.2, 0.2, 0.2, 0.2, 0.2]).reduce((t, x) => t + x, 0)
  a.spineFlex = (sp.flex || 0) * sum
  a.spineSide = (sp.side || 0) * sum
  a.spineTwist = (sp.twist || 0) * sum
  for (const s of ['L', 'R']) {
    const side = s === 'L' ? 1 : -1
    const th = v3(j[`lowerleg01.${s}`]).sub(v3(j[`upperleg01.${s}`])).applyQuaternion(qp).normalize()
    a[`hipFlex${s}`] = Math.atan2(th.z, -th.y) * D
    a[`hipAbd${s}`] = Math.atan2(th.x * side, -th.y) * D
    a[`knee${s}`] = report.angles[`knee${s}`]
    a[`elbow${s}`] = report.angles[`elbow${s}`]
    const ua = v3(j[`lowerarm01.${s}`]).sub(v3(j[`upperarm01.${s}`])).applyQuaternion(qc).normalize()
    a[`shFlex${s}`] = Math.atan2(ua.z, -ua.y) * D
    a[`shElev${s}`] = Math.acos(Math.max(-1, Math.min(1, -ua.y))) * D
    // The lats' stretch: the arm raised (in front, out or overhead) lengthens them, pulled back behind the trunk shortens them.
    a[`lat${s}`] = (1 + ua.y) * 90 + 40 * ua.z
    // The chest's length: the upper arm's angle from forward-and-across (arms pressed together in front: short; out and back: long).
    a[`pec${s}`] = Math.acos(Math.max(-1, Math.min(1, ua.dot(new V3(-0.35 * side, 0, 0.94).normalize())))) * D
    // Plantar flexion (+, up on the toes) from the shin and the foot: 90 deg between them is a neutral ankle.
    const shin = v3(j[`foot.${s}`]).sub(v3(j[`lowerleg01.${s}`])).normalize()
    a[`plantar${s}`] = 90 - Math.acos(Math.max(-1, Math.min(1, shin.dot(v3(report.feet[s].forward))))) * D
    const sc = report.angles[`scap${s}`] || { elev: 0, prot: 0 }
    a[`scapElev${s}`] = sc.elev
    a[`scapProt${s}`] = sc.prot
  }
  // The trunk: its lean from vertical (0 upright, 90 lying), and the pelvis height.
  const up = new V3(0, 1, 0).applyQuaternion(new Q4(...report.frames.chest.quat))
  a.trunkLean = Math.acos(Math.max(-1, Math.min(1, up.y))) * D
  a.pelvisY = report.frames.pelvis.pos[1]
  return a
}

/** The length of each lit muscle, in degrees of the joints that stretch it (bigger: longer). */
export const MUSCLE_LENGTH = {
  quadriceps: (a, s) => a[`knee${s}`],
  hamstrings: (a, s) => a[`hipFlex${s}`] - 0.6 * a[`knee${s}`],
  glutes: (a, s) => a[`hipFlex${s}`],
  adductors: (a, s) => a[`hipAbd${s}`],
  abductors: (a, s) => -a[`hipAbd${s}`],
  calves: (a, s) => -a[`plantar${s}`] - 0.3 * a[`knee${s}`],
  'spinal-erectors': (a) => a.spineFlex,
  abdominals: (a, s) => -a.spineFlex - 0.25 * a[`hipFlex${s}`],
  obliques: (a) => -(Math.abs(a.spineSide) + Math.abs(a.spineTwist)),
  chest: (a, s) => a[`pec${s}`],
  lats: (a, s) => a[`lat${s}`],
  traps: (a, s) => -2 * a[`scapElev${s}`] + 0.5 * a[`scapProt${s}`],
  rhomboids: (a, s) => a[`scapProt${s}`] - 0.3 * a[`pec${s}`],
  'middle-back': (a, s) => a[`scapProt${s}`] - 0.3 * a[`pec${s}`],
  biceps: (a, s) => -a[`elbow${s}`] - 0.3 * a[`shFlex${s}`],
  triceps: (a, s) => a[`elbow${s}`] + 0.3 * a[`shFlex${s}`],
  forearms: () => 0,
  shoulders: (a, s) => -a[`shElev${s}`],
  'anterior-deltoid': (a, s) => -a[`shFlex${s}`],
  'lateral-deltoid': (a, s) => -a[`shElev${s}`],
  'posterior-deltoid': (a, s) => -a[`pec${s}`],
}

/** The lit muscles' summed length (in units of 90 degrees) on one side, or the mean of both (side null). */
export function muscleLength(angles, spec, side = null) {
  const sides = side ? [side] : spec.muscleSide === 'L' || spec.muscleSide === 'R' ? [spec.muscleSide] : ['L', 'R']
  let total = 0
  for (const m of spec.muscles || []) {
    const f = MUSCLE_LENGTH[m]
    if (!f) continue
    total += sides.reduce((t, s) => t + f(angles, s), 0) / sides.length / 90
  }
  return total
}

/**
 * The lit muscles' length at each key frame, on the side that works: the spec's muscleSide, else the side whose muscles change
 * most (a one-arm row moves one side; averaging both would halve it), else both when they move alike.
 */
export function workingLengths(spec, angles) {
  if (spec.muscleSide === 'L' || spec.muscleSide === 'R') return angles.map((a) => muscleLength(a, spec, spec.muscleSide))
  const L = angles.map((a) => muscleLength(a, spec, 'L'))
  const R = angles.map((a) => muscleLength(a, spec, 'R'))
  const span = (v) => Math.max(...v) - Math.min(...v)
  if (Math.abs(span(L) - span(R)) < 0.5 * Math.max(span(L), span(R))) return L.map((x, i) => (x + R[i]) / 2)
  return span(L) >= span(R) ? L : R
}

/** How far apart two poses are: the main joints' displacement, summed, in metres. */
export function poseDistance(ra, rb) {
  let d = 0
  for (const k of ['head', 'spine01', 'wrist.L', 'wrist.R', 'lowerarm01.L', 'lowerarm01.R', 'lowerleg01.L', 'lowerleg01.R', 'foot.L', 'foot.R']) {
    const a = ra.joints[k]
    const b = rb.joints[k]
    d += Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  }
  return d + Math.hypot(...ra.frames.pelvis.pos.map((x, i) => x - rb.frames.pelvis.pos[i]))
}

const SEG_EPS = 0.08 // a segment changes the lit muscles' length by less than this (about 7 degrees): neither lift nor lowering

export const TEMPO_DEFAULTS = {
  strength: { up: 1.0, down: 1.8, squeeze: 0.35, stretch: 0.2, even: 1.3, hold: 0.3 },
  plyometrics: { up: 0.45, down: 0.6, squeeze: 0.12, stretch: 0.18, even: 0.55, hold: 0.15 },
  olympic: { up: 0.7, down: 1.3, squeeze: 0.3, stretch: 0.2, even: 0.9, hold: 0.25 },
  stretching: { up: 1.6, down: 1.6, squeeze: 1.0, stretch: 1.0, even: 1.6, hold: 0.4, holdEnd: 1.0 },
  cardio: { up: 0.6, down: 0.6, squeeze: 0, stretch: 0, even: 0.6, hold: 0 },
  static: { up: 1.5, down: 1.5, squeeze: 0.6, stretch: 0.6, even: 1.5, hold: 0.6 },
}

/** The tempo for a spec, from the catalog's category and force type (info) and the spec's own tempo field. */
export function tempoFor(spec, info = {}) {
  const cat = info.category || ''
  const base =
    cat === 'PLYOMETRICS' ? TEMPO_DEFAULTS.plyometrics
    : cat === 'OLYMPIC_WEIGHTLIFTING' ? TEMPO_DEFAULTS.olympic
    : cat === 'STRETCHING' ? TEMPO_DEFAULTS.stretching
    : cat === 'CARDIO' ? TEMPO_DEFAULTS.cardio
    : info.forceType === 'STATIC' ? TEMPO_DEFAULTS.static
    : TEMPO_DEFAULTS.strength
  return { ...base, ...(spec.tempo || {}) }
}

/**
 * What each segment between key frames is ('con' the lift, 'ecc' the lowering, 'even') and how long it is, from the key frames'
 * solved reports. lift: the spec's tempo.lift, else from the lit muscles; a stretch is always even.
 */
export function segmentsOf(spec, info, keyReports, keyFrames) {
  const L = workingLengths(spec, keyReports.map((r, i) => anglesOf(r, keyFrames[i])))
  const dist = []
  for (let i = 0; i + 1 < keyReports.length; i++) dist.push(poseDistance(keyReports[i], keyReports[i + 1]))
  const forced = spec.tempo && spec.tempo.lift
  const stretch = (info.category || '') === 'STRETCHING' || (info.category || '') === 'CARDIO'
  const dirs = dist.map((_, i) => {
    if (forced === 'even' || (stretch && !forced)) return 'even'
    if (forced === 'there') return 'con'
    if (forced === 'back') return 'ecc'
    const dL = L[i + 1] - L[i]
    return dL < -SEG_EPS ? 'con' : dL > SEG_EPS ? 'ecc' : 'even'
  })
  // The spec's lift as one word, for reports: the direction of the start -> end pass where the muscles change most.
  const net = L[L.length - 1] - L[0]
  const lift = forced || (stretch ? 'even' : net < -SEG_EPS ? 'there' : net > SEG_EPS ? 'back' : dirs.includes('con') || dirs.includes('ecc') ? 'mixed' : 'even')
  return { dirs, dist, lengths: L.map((x) => +x.toFixed(3)), lift, inferred: !forced }
}

/** Minimum-jerk position along a move, 0..1 for time 0..1: how a hand reaches, smooth at both ends. */
export const minJerk = (u) => u * u * u * (10 - 15 * u + 6 * u * u)

/**
 * The loop's timeline: for each frame (at fps), the blend parameter t (0 start .. 1 end, through the mids). Returns
 * { ts, seconds, parts: [{ dir, from, to, sec }] }. segs from segmentsOf(); tempo from tempoFor().
 */
export function timelineOf(segs, tempo, fps, timing = null) {
  const n = segs.dirs.length
  const total = segs.dist.reduce((t, d) => t + d, 0) || 1
  const flip = (d) => (d === 'con' ? 'ecc' : d === 'ecc' ? 'con' : 'even')
  // A pass: the segments in travel order, merged into parts of one direction.
  const pass = (forward) => {
    const parts = []
    for (let i = 0; i < n; i++) {
      const k = forward ? i : n - 1 - i
      const dir = forward ? segs.dirs[k] : flip(segs.dirs[k])
      const t0 = forward ? k / n : (k + 1) / n
      const t1 = forward ? (k + 1) / n : k / n
      const last = parts[parts.length - 1]
      if (last && last.dir === dir) {
        last.to = t1
        last.segs.push({ t0, t1, d: segs.dist[k] })
      } else parts.push({ dir, from: t0, to: t1, segs: [{ t0, t1, d: segs.dist[k] }] })
    }
    return parts
  }
  const fwd = pass(true)
  const back = pass(false)
  const dur = (p, all) => {
    const d = p.segs.reduce((t, s) => t + s.d, 0)
    const share = Math.max(0.5, Math.min(1, d / Math.max(...all.map((q) => q.segs.reduce((t, s) => t + s.d, 0)), 1e-6)))
    return (p.dir === 'con' ? tempo.up : p.dir === 'ecc' ? tempo.down : tempo.even) * share
  }
  // The pause after a part: where a lift ends the muscles are shortest (squeeze), where a lowering ends they are longest (stretch).
  const pauseAfter = (p) => (p.dir === 'con' ? tempo.squeeze : p.dir === 'ecc' ? tempo.stretch : tempo.hold)
  const steps = [] // { kind: 'hold', t, sec } | { kind: 'move', part, sec }
  if (timing) {
    // The older hand-set loop: there, holdEnd, back, holdStart (seconds).
    const { there = 1, holdEnd = 0, back: b = 1, holdStart = 0 } = timing
    if (holdStart) steps.push({ kind: 'hold', t: 0, sec: holdStart })
    steps.push({ kind: 'move', part: { dir: 'even', from: 0, to: 1, segs: fwd.flatMap((p) => p.segs) }, sec: there })
    if (holdEnd) steps.push({ kind: 'hold', t: 1, sec: holdEnd })
    steps.push({ kind: 'move', part: { dir: 'even', from: 1, to: 0, segs: back.flatMap((p) => p.segs) }, sec: b })
  } else {
    const firstPause = back.length ? pauseAfter(back[back.length - 1]) : tempo.hold
    steps.push({ kind: 'hold', t: 0, sec: firstPause })
    fwd.forEach((p, i) => {
      steps.push({ kind: 'move', part: p, sec: dur(p, fwd) })
      // Between two parts of one pass a shorter pause; at the end the full one (a stretch holds its end longer).
      const endHold = tempo.holdEnd !== undefined && p.dir === 'even' ? tempo.holdEnd : pauseAfter(p)
      steps.push({ kind: 'hold', t: p.to, sec: i + 1 < fwd.length ? 0.5 * pauseAfter(p) : endHold })
    })
    back.forEach((p, i) => {
      steps.push({ kind: 'move', part: p, sec: dur(p, back) })
      if (i + 1 < back.length) steps.push({ kind: 'hold', t: p.to, sec: 0.5 * pauseAfter(p) })
    })
  }
  // A loop with several parts per pass (alternating sides, a step up and down) keeps the tempo's proportions but fits in
  // tempo.maxLoop seconds: the app plays it on repeat, and a long loop is a big file.
  const raw = steps.reduce((t, x) => t + x.sec, 0)
  if (!timing && raw > (tempo.maxLoop || 4.8)) for (const st of steps) st.sec *= (tempo.maxLoop || 4.8) / raw
  // Along a part: minimum-jerk in time, mapped onto its segments by their share of the path.
  const tAlong = (part, u) => {
    const s = minJerk(u)
    const len = part.segs.reduce((t, x) => t + x.d, 0)
    if (len <= 1e-9) return part.from + (part.to - part.from) * s
    let acc = 0
    for (const g of part.segs) {
      const f = g.d / len
      if (s <= acc + f || g === part.segs[part.segs.length - 1]) return g.t0 + (g.t1 - g.t0) * Math.min(1, (s - acc) / (f || 1))
      acc += f
    }
    return part.to
  }
  const seconds = steps.reduce((t, x) => t + x.sec, 0)
  const frames = Math.max(2, Math.round(seconds * fps))
  const ts = []
  for (let i = 0; i < frames; i++) {
    let time = (i / frames) * seconds
    let t = 0
    for (const st of steps) {
      if (time <= st.sec || st === steps[steps.length - 1]) {
        const u = st.sec > 0 ? Math.min(1, time / st.sec) : 1
        t = st.kind === 'hold' ? st.t : tAlong(st.part, u)
        break
      }
      time -= st.sec
    }
    ts.push(Math.min(1, Math.max(0, t)))
  }
  return { ts, seconds: +seconds.toFixed(2), frames, parts: steps.map((s) => (s.kind === 'hold' ? `hold ${s.sec.toFixed(2)}s at t${s.t.toFixed(2)}` : `${s.part.dir} ${s.part.from.toFixed(2)}->${s.part.to.toFixed(2)} ${s.sec.toFixed(2)}s`)) }
}
