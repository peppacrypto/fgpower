// Cardio equipment. Metres, Y up; at yaw 0 the user faces +Z, so +X is the user's LEFT. `pos` is the floor point the prop
// is centred on. The module also exports its geometry toolbox (beam, pipe, slab, pad, weld, ...), used by strongman.js. Moving parts
// follow the body through ctx in the prop's local frame, so any pos and yaw work.
/*
 * TYPES: parameters, and exactly where the body goes. Coordinates are the prop's own (add pos, turn by yaw) unless they say world.
 *
 * treadmill  { incline: degrees (default 0) }
 * Commercial treadmill, 2.2 long, 0.86 wide. pos is the floor under the middle of the belt; the user faces +Z, the console.
 * BODY, at incline 0:
 *   Belt surface y = 0.215, running surface z -0.78..+0.78, x -0.28..+0.28. Stand around z = -0.05, put soles on y 0.215:
 *   root.pos y for a straight stance is 0.215 + 0.93 = 1.145. Feet stay in x -0.2..+0.2.
 *   Side rails to stand on: top y 0.226, x +-0.28..+-0.40.
 *   Hand rails: tube centre x +-0.365, y 1.045, straight from z 0.08 to 0.58, foam on z 0.10..0.42. Hand centre at, say,
 *   [+-0.365, 1.045, 0.28], bar direction along Z. Front crossbar: y 1.12, z 0.74, x -0.30..+0.30, along X.
 * With an incline the deck pivots about (y 0.02, z -1.0): belt y at z is about 0.02 + 0.195 cos(a) + (z + 1.0) sin(a). The
 * uprights, console and hand rails do not move.
 *
 * upright-bike  { crank: degrees, feet: true to follow the feet, saddle: extra saddle height in metres }
 * Upright exercise bike. pos: the floor point 0.07 behind the crank axis. The user faces +Z.
 * BODY:
 *   Saddle top y 0.977, its sitting point z -0.255. root.pos [0, 1.082, -0.275], root.pitch 18, spine flex 14 (hip 0.105 above saddle).
 *   Crank axis y 0.315, z 0.07, crank 0.17. Left pedal at crank angle a (0 = top, 90 = forward): y 0.315 + 0.17 cos a,
 *   z 0.07 + 0.17 sin a; the sole (ball) rests 0.012 above that. Right pedal is a + 180. Pedals centred at x +-0.122.
 *   Handlebar grips: x +-0.25, y 1.085, z 0.15..0.355, axis along Z. Hand centre [+-0.25, 1.085, 0.25].
 * MOVING: with feet: true the cranks and pedals are rebuilt under ctx.feet.*.ball. The pedal is where the ball is, and the crank
 * joins it to the axis, so keep the balls on the circle at the key frames. In between, the engine's four interpolated segments cut
 * the circle (the crank's length changes by up to 6 cm there; the foot never leaves the pedal). specs/_gallery/upright-bike.json has
 * a full one-way cycle ready to copy, as fk leg angles: timing {there: T, back: 0} and start = end.
 *
 * recumbent-bike  { crank: degrees, feet: true, slide: seat position 0..1, default 0.5 }
 * Recumbent bike with a seat on a slide rail. The user faces +Z, reclined. pos: floor under the machine's middle.
 * BODY, at slide 0.5:
 *   Seat cushion top y 0.63 at z -0.2 (width 0.42). Backrest face leans back 22 degrees from vertical, passes [y 0.89, z -0.39].
 *   root.pos [0, 0.71, -0.2] with root.pitch -20, spine flex 2 and the back on the rest (the trunk's lowest point is then y 0.62,
 *   just into the foam).
 *   Crank axis y 0.43, z 0.42, crank 0.17: left pedal y 0.43 + 0.17 cos a, z 0.42 + 0.17 sin a (a 90 = toward the front of the
 *   machine, a 180 = down). Pedal centres at x +-0.122, soles 0.012 above them.
 *   Side handles: foam at x +-0.285, y 0.63, z -0.27..-0.05, axis along Z. Hand centre [+-0.285, 0.63, -0.16].
 *   slide moves the seat by (slide - 0.5) * 0.16 m along Z (at 0 it is further from the pedals).
 * MOVING: as upright-bike. Copy the fk keys from specs/_gallery/recumbent-bike.json.
 *
 * road-bike  { crank: degrees, feet: true to follow the feet }
 * A 700c road bicycle standing upright on its wheels. pos: floor under the crank axis. Wheelbase 0.96, overall 1.63 long. The
 * rider faces +Z.
 * BODY:
 *   Saddle top y 0.965 at z -0.215 (sitting point). root.pos about [0, 1.065, -0.235], root.pitch 48, spine flex about 14.
 *   Crank axis y 0.265, z 0, crank 0.17: left pedal y 0.265 + 0.17 cos a, z 0.17 sin a (a 90 = forward, 180 = down). The ball of
 *   the foot sits 0.012 above, pedal centres near x +-0.115.
 *   Brake hoods (hands): centre [+-0.2, 0.935, 0.525], axis along Z rising forward. Tops of the bar: y 0.885, x -0.17..0.17,
 *   z 0.455, axis along X. Drops: [+-0.205, 0.78, 0.5].
 * MOVING: like upright-bike, the pedals sit under the balls of the feet. The wheels' spokes turn with the crank, so they keep
 * moving in a one-way loop.
 *
 * elliptical  { feet: true, hands: true, phase: degrees for a static picture }
 * Rear-drive elliptical. pos: floor under the middle of the machine, overall z -1.17..+1.05. The user faces +Z.
 * BODY: soles on long pedal plates centred at x +-0.112. The plates ride a closed path: y = 0.37 - 0.015 cos a - 0.075 sin a,
 *   z = -0.05 + 0.24 cos a (left foot; the right is half a turn away). a grows with time, so the foot goes forward along the top. Keep
 *   the foot flat on its plate (pitch within -8..+8): the plate takes the foot's pitch. Anchor 'sole' sits at the middle of the plate.
 *   root.pos [0, 1.22, -0.06], pitch 4, with a bob of about 1 cm.
 *   Moving handles: pivot [+-0.19, 0.8, 0.74]. A grip stays at 0.75 from the pivot: hand centre x +-0.3, z 0.12..0.48, y =
 *   0.8 + sqrt(0.75^2 - (0.74 - z)^2) - about 1.24 back, 1.5 forward. The tube runs from the pivot through the hand centre, so
 *   the bar's direction in the hand must be close to pivot -> hand (mostly up and back).
 *   Fixed handles under the console: centre [+-0.13, 1.26, 0.72], axis mostly vertical.
 * MOVING: a pedal arm runs from a roller on the front ramp, through the pedal, into the rear drum. Everything is solved each frame
 * from the foot's position: the roller's z is 0.63 + foot z + 0.05. The handles turn about their pivots to reach the hands.
 * With no ctx, `phase` drives both by the path above.
 *
 * rower  { follow: true (seat follows the pelvis), hands: true (handle follows the hands), seatZ: for a static picture }
 * Air rowing ergometer, 2.6 long, z -1.2..+1.4 from pos. The user sits on the rail and faces +Z, the flywheel.
 * BODY:
 *   Rail top y(z) = 0.3 + (z + 1.2) * 0.066, z -1.2..0.72. Seat top = rail + 0.07. Pelvis root y = seat top + 0.095.
 *   Catch (knees bent): root z -0.01, pitch 13; finish (legs long): root z -0.31, pitch -14. The seat stays under the pelvis.
 *   Foot plates: centred at x +-0.092, y 0.5, z 0.62, tilted so the sole faces up and back: foot pitch -42 with anchor 'sole'
 *   at those points. Heel cups and straps are on the plate.
 *   Handle: straight bar along X, grips at x +-0.105..+-0.285, the chain leaves the cage at [0, 0.665, 0.875]. Catch: hand centres
 *   [+-0.15, 0.8, 0.76]. Finish: [+-0.15, 0.87, 0.02] (lower ribs).
 * MOVING: the handle is built through both hand centres, and the chain runs straight from the cage to the handle's middle.
 *
 * stair-climber  { feet: true, phase: degrees for a static picture }
 * Dependent-action stepper with long pedal levers. pos: floor under the pedals' mean position. The user faces +Z, the console.
 * BODY: soles on the pedal plates, x +-0.13, around z -0.02. The plate top moves between y 0.2 (bottom) and y 0.5 (top), it stays
 *   under ctx.feet.*.sole and takes the foot's pitch: keep the foot level.
 *   Pelvis root [0, 1.11, -0.09], pitch 6, for a stroke of 0.23..0.47 (full stroke: 0.2..0.5).
 *   Hand rails: x +-0.3, a straight part from [+-0.3, 1.1, 0.26] to [+-0.3, 0.98, -0.2], axis mostly Z. Hand centre around
 *   [+-0.3, 1.05, 0.08]. Front grips under the console at [+-0.13, 1.27, 0.4].
 * MOVING: each lever pivots at [+-0.13, 0.3, 0.52] and reaches the foot; a parallel link keeps the plate level.
 *
 * step-mill  { phase: number, the staircase's travel in steps. Goes inside each frame's props so it interpolates }
 * Revolving staircase, 2.25 tall. pos: floor under the stairs' middle. The user climbs toward +Z.
 * BODY: tread k (k = 0..7) has its top at y = 0.3 + (k - f) * 0.2 and its centre at z = -0.46 + (k - f) * 0.265, where f is the
 *   fractional part of phase (the treads move down and back as phase grows). Tread width x -0.29..+0.29, depth 0.265. The
 *   step mill helper is exported as STEPMILL.tread(k, phase).
 *   Feet at x +-0.11, soles flat on the treads. The usual stance: the low foot on tread 2 (y 0.7, z 0.07), the high foot on
 *   tread 3 (y 0.9, z 0.335). Pelvis root [0, 1.56, 0.03], pitch 8.
 *   Hand rails: x +-0.335, y = 0.98 + (z + 0.5) * 0.755, z -0.5..0.72. Hand centre [+-0.335, 1.59, 0.31], axis along the rail.
 * MOVING: for a loop, climb with four segments: phase goes 0, 0.5, 1, 1.5, 2 in start, mid, mid2, mid3, end, with timing
 * {there: T, back: 0}. A foot on a tread descends with it. See specs/_gallery/step-mill.json.
 *
 * inline-skate  { foot: 'L' or 'R' to wear it, otherwise a static skate on the floor at pos }
 * BODY: wearing raises the figure: wheels touch the floor when the sole is SKATE_RISE = 0.112 above it. Foot pitch 0 and anchor
 * 'sole' with y 0.112 put all four wheels on the floor. Use one per foot: {type:'inline-skate', foot:'L'}. Boot and cuff are built
 * around the foot in world coordinates; the cuff follows the shin.
 *
 * hurdle  { height: 0.3 (top of the bar), width: 0.6 }
 * A plyometric speed hurdle: bent tube frame on flat runners. pos: floor under the bar's middle, the bar lies along X, the user
 * jumps along Z. Clear the bar at y = height.
 *
 * cone  { height: 0.23 }
 * Training cone with a square base and a reflective band, in light grey (never orange). pos: floor under its centre.
 *
 * agility-ladder  { rungs: 8, spacing: 0.42, width: 0.46 }
 * Flat speed ladder. pos: floor under its middle, it runs along Z. Rung k (0-based) lies at z = pos.z + (k - (rungs - 1) / 2) *
 * spacing. Rungs are flat plastic slats on two webbing straps, 6 mm off the floor: step in the gaps, soles at y 0.
 */
import { kit, mat } from './kit.js'

const { THREE, group, mesh } = kit
const { Vector3: V3, Quaternion: Q4, Matrix4: M4 } = THREE
const RAD = Math.PI / 180

/* ------------------------------------------------------------------------------------------------------------------ *
 * Toolbox, shared with strongman.js. All geometry is cached by its parameters, so a machine can be rebuilt every frame.
 * ------------------------------------------------------------------------------------------------------------------ */

const geoCache = new Map()
export const cachedGeo = (key, make) => {
  let g = geoCache.get(key)
  if (!g) {
    g = make()
    geoCache.set(key, g)
  }
  return g
}
const mm = (x) => Math.round(x * 1000) / 1000
const vec = (a) => (a instanceof V3 ? a.clone() : new V3(a[0], a[1], a[2]))
const keyOf = (o) => JSON.stringify(o, (_, v) => (typeof v === 'number' ? mm(v) : v))

const std = (o) => new THREE.MeshStandardMaterial(o)

/** Materials tuned to read on the near-black studio background. kit.mat stays untouched. */
export const M = {
  coat: std({ color: 0x5b5e64, metalness: 0.28, roughness: 0.54 }), // graphite powder coat, most frames
  coatDark: std({ color: 0x3c3e43, metalness: 0.28, roughness: 0.56 }),
  coatLight: std({ color: 0x83868c, metalness: 0.28, roughness: 0.5 }),
  shroud: std({ color: 0x585a5f, metalness: 0, roughness: 0.52 }), // moulded plastic covers
  shroudDark: std({ color: 0x323338, metalness: 0, roughness: 0.5 }),
  shroudLight: std({ color: 0x96989d, metalness: 0, roughness: 0.46 }),
  alu: std({ color: 0xc0c3c8, metalness: 0.95, roughness: 0.34 }),
  aluDark: std({ color: 0x7c7f85, metalness: 0.9, roughness: 0.42 }),
  belt: std({ color: 0x2a2b2e, metalness: 0, roughness: 0.86 }),
  beltMatte: new THREE.MeshPhysicalMaterial({ color: 0x2b2c2f, metalness: 0, roughness: 0.7, specularIntensity: 0.2 }),
  rubber: std({ color: 0x28292b, metalness: 0, roughness: 0.72 }),
  rubberDark: std({ color: 0x1b1c1d, metalness: 0, roughness: 0.78 }),
  grip: std({ color: 0x38393c, metalness: 0, roughness: 0.84 }), // foam and rubber sleeves
  pad: new THREE.MeshPhysicalMaterial({ color: 0x3e3f43, metalness: 0, roughness: 0.56, specularIntensity: 0.4 }), // vinyl upholstery
  piping: std({ color: 0x5d5f64, metalness: 0, roughness: 0.46 }),
  weld: std({ color: 0x8a8d92, metalness: 0.6, roughness: 0.62 }),
  hole: std({ color: 0x08080a, metalness: 0, roughness: 0.9 }),
  glass: std({ color: 0x0a0b0d, metalness: 0.3, roughness: 0.1 }),
  lcd: std({ color: 0x14161a, emissive: 0xb9c4cf, emissiveIntensity: 0.42, roughness: 0.4 }),
  led: std({ color: 0x14161a, emissive: 0xe4e8ee, emissiveIntensity: 0.9, roughness: 0.4 }),
  bikePaint: std({ color: 0x9b9ea4, metalness: 0.55, roughness: 0.28 }),
  // Large faces that look up toward the key light: little specular, so a low camera does not see them glare white.
  matte: new THREE.MeshPhysicalMaterial({ color: 0x4a4c51, metalness: 0, roughness: 0.66, specularIntensity: 0.22 }),
  matteDark: new THREE.MeshPhysicalMaterial({ color: 0x2c2d31, metalness: 0, roughness: 0.66, specularIntensity: 0.22 }),
  coneBody: std({ color: 0xa7a9ad, metalness: 0, roughness: 0.48 }),
  flatLight: new THREE.MeshPhysicalMaterial({ color: 0x7e8085, metalness: 0, roughness: 0.62, specularIntensity: 0.25 }),
  coneBand: std({ color: 0xeeeeee, metalness: 0, roughness: 0.3 }),
  webbing: std({ color: 0x5f6166, metalness: 0, roughness: 0.86 }),
}

/** A closed cross-section with its normals: points run counter-clockwise. */
export function ellipseSection(rx, ry = rx, seg = 16) {
  const pts = []
  const nrm = []
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2
    pts.push([rx * Math.cos(a), ry * Math.sin(a)])
    const nx = Math.cos(a) / rx
    const ny = Math.sin(a) / ry
    const l = Math.hypot(nx, ny)
    nrm.push([nx / l, ny / l])
  }
  return { pts, nrm }
}

/** Rounded rectangle section, w along the first axis and d along the second. Flats stay flat under the light. */
export function rectSection(w, d, r = 0.004, cs = 3) {
  const rr = Math.min(r, w / 2 - 1e-4, d / 2 - 1e-4)
  const pts = []
  const nrm = []
  const corners = [
    [w / 2 - rr, d / 2 - rr, 0],
    [-w / 2 + rr, d / 2 - rr, 90],
    [-w / 2 + rr, -d / 2 + rr, 180],
    [w / 2 - rr, -d / 2 + rr, 270],
  ]
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= cs; i++) {
      const a = (a0 + (i / cs) * 90) * RAD
      pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)])
      nrm.push([Math.cos(a), Math.sin(a)])
    }
  }
  return { pts, nrm }
}

/** Sweeps a section along a path of points with parallel-transport frames. Normals come from the section, so it stays crisp. */
export function sweepGeo(path, sec, { closed = false, caps = true, up = null, taper = null } = {}) {
  const P = path.map(vec)
  const n = P.length
  const m = sec.pts.length
  const T = P.map((p, i) => {
    const a = closed ? P[(i - 1 + n) % n] : P[Math.max(0, i - 1)]
    const b = closed ? P[(i + 1) % n] : P[Math.min(n - 1, i + 1)]
    return b.clone().sub(a).normalize()
  })
  let N0 = up ? vec(up) : Math.abs(T[0].x) < 0.9 ? new V3(1, 0, 0) : new V3(0, 1, 0)
  N0.addScaledVector(T[0], -N0.dot(T[0]))
  if (N0.lengthSq() < 1e-8) N0 = Math.abs(T[0].y) < 0.9 ? new V3(0, 1, 0) : new V3(0, 0, 1)
  N0.normalize()
  const Ns = [N0.clone()]
  const q = new Q4()
  for (let i = 1; i < n; i++) {
    q.setFromUnitVectors(T[i - 1], T[i])
    const N = Ns[i - 1].clone().applyQuaternion(q)
    N.addScaledVector(T[i], -N.dot(T[i])).normalize()
    Ns.push(N)
  }
  if (closed) {
    // Spread the leftover twist along the loop, or a flat strap shows a kink at the seam.
    q.setFromUnitVectors(T[n - 1], T[0])
    const last = Ns[n - 1].clone().applyQuaternion(q)
    const ang = Math.atan2(last.clone().cross(Ns[0]).dot(T[0]), last.dot(Ns[0]))
    for (let i = 0; i < n; i++) Ns[i].applyAxisAngle(T[i], (ang * i) / n)
  }
  const pos = []
  const nor = []
  const idx = []
  const ring = (i, s = 1) => {
    const N = Ns[i]
    const B = T[i].clone().cross(N)
    for (let j = 0; j < m; j++) {
      const [sx, sy] = sec.pts[j]
      const [nx, ny] = sec.nrm[j]
      pos.push(P[i].x + (N.x * sx + B.x * sy) * s, P[i].y + (N.y * sx + B.y * sy) * s, P[i].z + (N.z * sx + B.z * sy) * s)
      nor.push(N.x * nx + B.x * ny, N.y * nx + B.y * ny, N.z * nx + B.z * ny)
    }
  }
  for (let i = 0; i < n; i++) ring(i, taper ? taper(i / (n - 1)) : 1)
  const last = closed ? n : n - 1
  for (let i = 0; i < last; i++) {
    const i2 = (i + 1) % n
    for (let j = 0; j < m; j++) {
      const j2 = (j + 1) % m
      const a = i * m + j
      const b = i * m + j2
      const c = i2 * m + j2
      const d = i2 * m + j
      idx.push(a, b, c, a, c, d)
    }
  }
  if (!closed && caps) {
    for (const [i, sign] of [[0, -1], [n - 1, 1]]) {
      const base = pos.length / 3
      const N = Ns[i]
      const B = T[i].clone().cross(N)
      const s = taper ? taper(i / (n - 1)) : 1
      pos.push(P[i].x, P[i].y, P[i].z)
      nor.push(T[i].x * sign, T[i].y * sign, T[i].z * sign)
      for (let j = 0; j < m; j++) {
        const [sx, sy] = sec.pts[j]
        pos.push(P[i].x + (N.x * sx + B.x * sy) * s, P[i].y + (N.y * sx + B.y * sy) * s, P[i].z + (N.z * sx + B.z * sy) * s)
        nor.push(T[i].x * sign, T[i].y * sign, T[i].z * sign)
      }
      for (let j = 0; j < m; j++) {
        const j2 = (j + 1) % m
        if (sign > 0) idx.push(base, base + 1 + j, base + 1 + j2)
        else idx.push(base, base + 1 + j2, base + 1 + j)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setIndex(idx)
  return g
}

/** A polyline with its corners rounded by real arcs. A point may carry its own radius as a 4th number. */
export function fillet(points, radius = 0.05, seg = 8) {
  const P = points.map((p) => new V3(p[0], p[1], p[2]))
  const out = [P[0].clone()]
  for (let i = 1; i < P.length - 1; i++) {
    const r = points[i][3] ?? radius
    const u = P[i - 1].clone().sub(P[i])
    const v = P[i + 1].clone().sub(P[i])
    const lu = u.length()
    const lv = v.length()
    u.normalize()
    v.normalize()
    const ang = u.angleTo(v)
    if (r <= 0 || ang > Math.PI - 0.01 || ang < 0.01) {
      out.push(P[i].clone())
      continue
    }
    let t = r / Math.tan(ang / 2)
    t = Math.min(t, lu * 0.49, lv * 0.49)
    const rr = t * Math.tan(ang / 2)
    const c = P[i].clone().addScaledVector(u.clone().add(v).normalize(), rr / Math.sin(ang / 2))
    const a = P[i].clone().addScaledVector(u, t).sub(c)
    const b = P[i].clone().addScaledVector(v, t).sub(c)
    const axis = a.clone().cross(b).normalize()
    const sweep = a.angleTo(b)
    for (let k = 0; k <= seg; k++) out.push(c.clone().add(a.clone().applyAxisAngle(axis, (sweep * k) / seg)))
  }
  out.push(P[P.length - 1].clone())
  // Long straight runs get intermediate rings only where they bend, so the mesh stays light.
  return out
}

/** Round (or oval, with ry) bent tube through corner points, with arcs at the corners. */
export function pipe(points, r, m, { bend = 0.06, seg = 18, caps = true, ry = r, up = null } = {}) {
  const g = cachedGeo(`pipe${keyOf([points, r, ry, bend, seg, caps, up])}`, () => sweepGeo(fillet(points, bend), ellipseSection(r, ry, seg), { caps, up }))
  return mesh(g, m)
}

/** Rectangular tube bent through corner points: w across `up`, d along it. */
export function rectPipe(points, w, d, m, { bend = 0.05, cr = 0.004, caps = true, up = null } = {}) {
  const g = cachedGeo(`rpipe${keyOf([points, w, d, bend, cr, caps, up])}`, () => sweepGeo(fillet(points, bend), rectSection(w, d, cr), { caps, up }))
  return mesh(g, m)
}

const unitPrism = (w, d, r) => cachedGeo(`prism${keyOf([w, d, r])}`, () => sweepGeo([[0, -0.5, 0], [0, 0.5, 0]], rectSection(w, d, r), { up: [1, 0, 0] }))

/**
 * Straight square or rectangular steel tube from a to b, the way machines are really built. w lies along `side` (default X,
 * or Z for a tube running along X), d lies across. Options: caps adds plastic end caps, holes [{at, r}] drills adjustment
 * holes through the w faces... use `holes: {n, from, to, r}` with from and to in metres along the tube.
 */
export function beam(a, b, w, d, m, { side = null, r = 0.005, caps = false, holes = null, capM = M.rubberDark } = {}) {
  const A = vec(a)
  const B = vec(b)
  const dir = B.clone().sub(A)
  const len = dir.length() || 1e-4
  dir.normalize()
  const x = side ? vec(side) : Math.abs(dir.x) < 0.95 ? new V3(1, 0, 0) : new V3(0, 0, 1)
  x.addScaledVector(dir, -x.dot(dir)).normalize()
  const z = x.clone().cross(dir).normalize()
  const q = new Q4().setFromRotationMatrix(new M4().makeBasis(x, dir, z))
  const o = mesh(unitPrism(w, d, r), m)
  o.scale.set(1, len, 1)
  o.position.copy(A).lerp(B, 0.5)
  o.quaternion.copy(q)
  if (!caps && !holes) return o
  const g = group(o)
  if (caps) {
    for (const [p, s] of [[A, -1], [B, 1]]) {
      const c = kit.rbox(w + 0.002, 0.008, d + 0.002, Math.min(0.003, w / 3), capM, [0, 0, 0], 2)
      c.position.copy(p).addScaledVector(dir, s * 0.003)
      c.quaternion.copy(q)
      g.add(c)
    }
  }
  if (holes) {
    const { n, from = 0.05, to = len - 0.05, r: hr = 0.006, face = 'w' } = holes
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? from : from + ((to - from) * i) / (n - 1)
      const h = kit.cyl(hr, (face === 'w' ? d : w) + 0.0015, M.hole, [0, 0, 0], 'y', { seg: 14 })
      h.position.copy(A).addScaledVector(dir, t)
      h.quaternion.setFromUnitVectors(new V3(0, 1, 0), face === 'w' ? z : x)
      g.add(h)
    }
  }
  return g
}

/** The bead around a square tube where it meets another: a ring in the plane square to `axis`, w along `side` (default X). */
export function weld(center, axis, w, d, { side = null, m = M.weld, r = 0.0024 } = {}) {
  const g = cachedGeo(`weld${keyOf([w, d, r])}`, () => {
    const pts = rectSection(w + r, d + r, 0.006, 3).pts.map(([x, y]) => [x, 0, y])
    return sweepGeo(pts, ellipseSection(r, r, 6), { closed: true })
  })
  const o = mesh(g, m)
  o.position.set(center[0], center[1], center[2])
  const y = vec(axis).normalize()
  const x = side ? vec(side) : Math.abs(y.x) < 0.95 ? new V3(1, 0, 0) : new V3(0, 0, 1)
  x.addScaledVector(y, -x.dot(y)).normalize()
  o.quaternion.setFromRotationMatrix(new M4().makeBasis(x, y, x.clone().cross(y)))
  return o
}

/** Rounds polygon corners: verts are [u, v] or [u, v, r]. Returns plain [u, v] points. */
export function roundPoly(verts, r = 0, seg = 6) {
  const n = verts.length
  const out = []
  for (let i = 0; i < n; i++) {
    const p = verts[i]
    const a = verts[(i - 1 + n) % n]
    const b = verts[(i + 1) % n]
    const rr = p[2] ?? r
    const ux = a[0] - p[0]
    const uy = a[1] - p[1]
    const vx = b[0] - p[0]
    const vy = b[1] - p[1]
    const lu = Math.hypot(ux, uy)
    const lv = Math.hypot(vx, vy)
    const ang = Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (lu * lv))))
    if (rr <= 0 || ang > Math.PI - 0.01) {
      out.push([p[0], p[1]])
      continue
    }
    const t = Math.min(rr / Math.tan(ang / 2), lu * 0.49, lv * 0.49)
    const R = t * Math.tan(ang / 2)
    const a0 = [p[0] + (ux / lu) * t, p[1] + (uy / lu) * t]
    const b0 = [p[0] + (vx / lv) * t, p[1] + (vy / lv) * t]
    const bx = ux / lu + vx / lv
    const by = uy / lu + vy / lv
    const bl = Math.hypot(bx, by)
    const cd = R / Math.sin(ang / 2)
    const c = [p[0] + (bx / bl) * cd, p[1] + (by / bl) * cd]
    let s0 = Math.atan2(a0[1] - c[1], a0[0] - c[0])
    const s1 = Math.atan2(b0[1] - c[1], b0[0] - c[0])
    let d = s1 - s0
    while (d > Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    for (let k = 0; k <= seg; k++) out.push([c[0] + R * Math.cos(s0 + (d * k) / seg), c[1] + R * Math.sin(s0 + (d * k) / seg)])
  }
  return out
}

/** Smooth normals on faces within `deg` of each other, hard edges elsewhere. */
export function creaseNormals(g0, deg = 38) {
  const g = g0.index ? g0.toNonIndexed() : g0
  const p = g.attributes.position
  const n = p.count
  const faces = []
  const groups = new Map()
  const a = new V3()
  const b = new V3()
  const c = new V3()
  const key = (i) => `${Math.round(p.getX(i) * 2e4)},${Math.round(p.getY(i) * 2e4)},${Math.round(p.getZ(i) * 2e4)}`
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, i)
    b.fromBufferAttribute(p, i + 1)
    c.fromBufferAttribute(p, i + 2)
    faces.push(b.clone().sub(a).cross(c.clone().sub(a)))
    for (let k = 0; k < 3; k++) {
      const K = key(i + k)
      if (!groups.has(K)) groups.set(K, [])
      groups.get(K).push(i / 3)
    }
  }
  const unit = faces.map((f) => f.clone().normalize())
  const cos = Math.cos(deg * RAD)
  const out = new Float32Array(n * 3)
  const sum = new V3()
  for (let i = 0; i < n; i++) {
    const me = unit[Math.floor(i / 3)]
    sum.set(0, 0, 0)
    for (const f of groups.get(key(i))) if (unit[f].dot(me) > cos) sum.add(faces[f])
    if (sum.lengthSq() < 1e-16) sum.copy(me)
    sum.normalize()
    out[i * 3] = sum.x
    out[i * 3 + 1] = sum.y
    out[i * 3 + 2] = sum.z
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3))
  return g
}

/**
 * An extruded panel with bevelled edges: covers, plates, gussets, consoles. `outline` is a list of [u, v] in the given plane,
 * and the depth is centred on it:
 *   plane 'zy': u = z, v = y, extruded along X (a side profile)
 *   plane 'xy': u = x, v = y, extruded along Z (a front view)
 *   plane 'xz': u = x, v = z, extruded along Y (a top view)
 * Run it through roundPoly first to round the corners.
 */
export function slabGeo(outline, depth, { plane = 'zy', bevel = 0.004, bevelSeg = 2, crease = 38, holes = [] } = {}) {
  return cachedGeo(`slab${keyOf([outline, depth, plane, bevel, bevelSeg, crease, holes])}`, () => {
    const shape = new THREE.Shape(outline.map(([u, v]) => new THREE.Vector2(u, v)))
    for (const h of holes) shape.holes.push(new THREE.Path(h.map(([u, v]) => new THREE.Vector2(u, v))))
    const b = Math.min(bevel, depth / 2 - 1e-4)
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: depth - 2 * b,
      bevelEnabled: b > 0,
      bevelThickness: b,
      bevelSize: b,
      bevelOffset: -b,
      bevelSegments: bevelSeg,
      steps: 1,
      curveSegments: 1,
    })
    g.translate(0, 0, -(depth - 2 * b) / 2)
    if (plane === 'zy') g.rotateY(-Math.PI / 2)
    if (plane === 'xz') g.rotateX(Math.PI / 2)
    return creaseNormals(g, crease)
  })
}
export const slab = (outline, depth, m, pos, opts) => mesh(slabGeo(outline, depth, opts), m, pos)

/** A circle as an outline, for slabGeo holes and discs. */
export const circleOutline = (cx, cy, r, seg = 32) => Array.from({ length: seg }, (_, i) => [cx + r * Math.cos((i / seg) * Math.PI * 2), cy + r * Math.sin((i / seg) * Math.PI * 2)])

/** One rounded-rectangle ring in the XZ plane, inset by s from the outline. Counter-clockwise seen from above. */
function padRing(w, l, r, s, cs) {
  const hx = Math.max(w / 2 - s, 5e-4)
  const hz = Math.max(l / 2 - s, 5e-4)
  const rr = Math.min(Math.max(r - s, 4e-4), hx, hz)
  const out = []
  const corners = [
    [hx - rr, hz - rr, 0],
    [-hx + rr, hz - rr, 90],
    [-hx + rr, -hz + rr, 180],
    [hx - rr, -hz + rr, 270],
  ]
  for (const [cx, cz, a0] of corners) {
    for (let i = 0; i <= cs; i++) {
      const a = (a0 + (i / cs) * 90) * RAD
      out.push([cx + rr * Math.cos(a), -(cz + rr * Math.sin(a))])
    }
  }
  return out
}

/** Upholstered cushion: width along X, length along Z, thickness along Y, centred. The top crowns like foam under vinyl. */
export function padGeo(w, l, t, { r = 0.03, crown = 0.008, rim = null, flatBottom = true } = {}) {
  return cachedGeo(`pad${keyOf([w, l, t, r, crown, rim, flatBottom])}`, () => {
    const cs = 6
    const rimS = rim ?? Math.min(t / 2, r)
    const sMax = Math.min(w, l) / 2 - 1e-3
    const prof = []
    const N1 = 5
    const N2 = 7
    const N3 = 8
    for (let k = 0; k <= N1; k++) prof.push([sMax + (rimS - sMax) * (k / N1), -t / 2])
    for (let k = 1; k <= N2; k++) {
      const a = (k / N2) * (Math.PI / 2)
      prof.push([rimS * (1 - Math.sin(a)), (-t / 2) * Math.cos(a)])
    }
    for (let k = 1; k <= N2; k++) {
      const a = (k / N2) * (Math.PI / 2)
      prof.push([rimS * (1 - Math.cos(a)), (t / 2) * Math.sin(a)])
    }
    for (let k = 1; k <= N3; k++) {
      const u = k / N3
      prof.push([rimS + (sMax - rimS) * u, t / 2 + crown * Math.sin((u * Math.PI) / 2) ** 2])
    }
    const pos = []
    const idx = []
    const m = (cs + 1) * 4
    for (const [s, y] of prof) for (const [x, z] of padRing(w, l, r, s, cs)) pos.push(x, y, z)
    for (let i = 0; i < prof.length - 1; i++) {
      for (let j = 0; j < m; j++) {
        const j2 = (j + 1) % m
        const a = i * m + j
        const b = i * m + j2
        const c = (i + 1) * m + j2
        const d = (i + 1) * m + j
        idx.push(a, b, c, a, c, d)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  })
}

/** A cushion with a welt along its upper edge. Returns a group: place it with position and rotation. */
export function pad(w, l, t, m = M.pad, pos = null, { r = 0.03, crown = 0.008, rim = null, seam = true, seamM = M.piping } = {}) {
  const g = group(mesh(padGeo(w, l, t, { r, crown, rim }), m))
  if (seam) {
    const rimS = rim ?? Math.min(t / 2, r)
    const y = (t / 2) * 0.72
    const s = rimS * (1 - Math.sqrt(1 - 0.72 * 0.72))
    const path = cachedGeo(`padSeam${keyOf([w, l, t, r, rim])}`, () => {
      const ring = padRing(w, l, r, s - 0.0005, 6).map(([x, z]) => [x, y, z])
      return sweepGeo(ring, ellipseSection(0.0028, 0.0028, 6), { closed: true })
    })
    g.add(mesh(path, seamM))
  }
  if (pos) g.position.set(pos[0], pos[1], pos[2])
  return g
}

/** Merges geometries (with optional matrices) into one: many small parts as a single mesh. Input needs position and normal. */
export function mergeGeos(list) {
  const pos = []
  const nor = []
  const idx = []
  const v = new V3()
  const nm = new THREE.Matrix3()
  let base = 0
  for (const item of list) {
    const [g, mtx] = Array.isArray(item) ? item : [item, null]
    const p = g.attributes.position
    const n = g.attributes.normal
    if (mtx) nm.getNormalMatrix(mtx)
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i)
      if (mtx) v.applyMatrix4(mtx)
      pos.push(v.x, v.y, v.z)
      v.fromBufferAttribute(n, i)
      if (mtx) v.applyMatrix3(nm).normalize()
      nor.push(v.x, v.y, v.z)
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base)
    else for (let i = 0; i < p.count; i++) idx.push(i + base)
    base += p.count
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  out.setIndex(idx)
  return out
}

/** Moves and turns an object. rot is in degrees, applied in three.js XYZ Euler order. Returns it, so it can wrap a call. */
export function place(o, pos, rot) {
  if (pos) o.position.set(pos[0], pos[1], pos[2])
  if (rot) o.rotation.set(rot[0] * RAD, rot[1] * RAD, rot[2] * RAD)
  return o
}

/** World point or direction into a prop's local frame, for parts that follow the body. */
export function localFrame(p) {
  const o = vec(p.pos || [0, 0, 0])
  const yaw = ((p.yaw || 0) * Math.PI) / 180
  const Y = new V3(0, 1, 0)
  return {
    pt: (w) => vec(w).sub(o).applyAxisAngle(Y, -yaw),
    dir: (w) => vec(w).applyAxisAngle(Y, -yaw),
  }
}

/**
 * A surface of revolution along X whose profile's +y end faces outward, toward sign(s) on X. kit.lathe with axis 'x' always runs +y toward
 * -X, so a dome or cap that is not symmetric would be buried inside its part on the +X side.
 */
export function latheOut(profile, m, pos, s, seg = 48) {
  const o = kit.lathe(profile, m, pos, 'x', seg)
  o.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2
  return o
}

/** Screws, pivots and such: a domed bolt head on a face, normal along `axis`. On X it faces away from the middle of the machine. */
export function bolt(pos, axis = 'x', r = 0.008, m = M.alu) {
  const profile = [[0, -0.001], [r, -0.001], [r, 0.0015], [r * 0.82, 0.004], [r * 0.4, 0.005], [0, 0.0052]]
  return axis === 'x' ? latheOut(profile, m, pos, pos[0] >= 0 ? 1 : -1, 16) : kit.lathe(profile, m, pos, axis, 16)
}

/** A rubber foot pad under a stabiliser tube, y is its top. Sits on the floor. */
export function rubberFoot(x, z, y = 0.03, r = 0.03) {
  return kit.lathe([[0, 0], [r * 0.92, 0], [r, 0.004], [r, y * 0.55], [r * 0.72, y * 0.8], [r * 0.5, y], [0, y]], M.rubberDark, [x, 0, z], 'y', 24)
}

/** Small round transport wheel on an axle along X. */
export function transportWheel(x, y, z, r = 0.035, w = 0.022) {
  return group(
    kit.lathe([[0, -w / 2], [r * 0.82, -w / 2], [r, -w / 3], [r, w / 3], [r * 0.82, w / 2], [0, w / 2]], M.rubber, [x, y, z], 'x', 28),
    kit.lathe([[0, -w / 2 - 0.0015], [r * 0.42, -w / 2 - 0.0015], [r * 0.46, -w / 2], [r * 0.46, w / 2], [r * 0.42, w / 2 + 0.0015], [0, w / 2 + 0.0015]], M.aluDark, [x, y, z], 'x', 20),
  )
}

/**
 * Console for a cardio machine, facing -Z before tilting (toward the user). w and h are the overall size. A wide lower dash
 * with cup wells and keys, a raised central screen, no text and no logos. Origin at its centre.
 */
function consolePanel({ w = 0.62, h = 0.3, d = 0.085, screen = [0.3, 0.17], wings = true } = {}) {
  const g = group()
  const shell = wings
    ? [[-w / 2, -h / 2, 0.035], [w / 2, -h / 2, 0.035], [w / 2 - 0.012, -h / 2 + h * 0.42, 0.03], [screen[0] / 2 + 0.05, h / 2 - h * 0.1, 0.06], [screen[0] / 2 + 0.01, h / 2, 0.035], [-screen[0] / 2 - 0.01, h / 2, 0.035], [-screen[0] / 2 - 0.05, h / 2 - h * 0.1, 0.06], [-w / 2 + 0.012, -h / 2 + h * 0.42, 0.03]]
    : [[-w / 2, -h / 2, 0.04], [w / 2, -h / 2, 0.04], [w / 2, h / 2, 0.04], [-w / 2, h / 2, 0.04]]
  g.add(slab(roundPoly(shell, 0, 7), d, M.shroud, [0, 0, 0], { plane: 'xy', bevel: 0.018, bevelSeg: 4 }))
  // A dark inlay follows the shell, leaving a light rim around it.
  const inset = 0.016
  const inlay = shell.map(([x, y, r]) => [x * (1 - (2 * inset) / w), y + (y > 0 ? -inset : inset), r * 0.8])
  g.add(slab(roundPoly(inlay, 0, 6), 0.005, M.shroudDark, [0, 0, -d / 2 - 0.0005], { plane: 'xy', bevel: 0.0015, bevelSeg: 1 }))
  const [sw, sh] = screen
  const sy = h / 2 - sh / 2 - 0.028
  g.add(kit.rbox(sw + 0.016, sh + 0.016, 0.004, 0.006, M.coat, [0, sy, -d / 2 - 0.004], 2))
  g.add(kit.rbox(sw, sh, 0.004, 0.003, M.glass, [0, sy, -d / 2 - 0.0055], 1))
  // On the screen: an exercise profile of bright bars and four readouts.
  const heights = [0.18, 0.26, 0.34, 0.46, 0.6, 0.72, 0.64, 0.5, 0.56, 0.7, 0.82, 0.66, 0.44, 0.3]
  const bw = (sw * 0.84) / heights.length
  heights.forEach((hh, i) => {
    const bh = sh * 0.5 * hh
    g.add(kit.box(bw * 0.7, bh, 0.001, M.lcd, [-sw * 0.42 + bw * (i + 0.5), sy - sh * 0.42 + bh / 2, -d / 2 - 0.008]))
  })
  for (const x of [-0.3, -0.1, 0.1, 0.3]) g.add(kit.box(sw * 0.15, sh * 0.13, 0.001, M.led, [sw * x, sy + sh * 0.33, -d / 2 - 0.008]))
  if (wings) {
    for (const side of [-1, 1]) {
      // Keys beside the screen, cup well further out.
      for (let row = 0; row < 3; row++) g.add(kit.rbox(0.03, 0.017, 0.004, 0.003, M.shroudLight, [side * (sw / 2 + 0.042), sy - sh / 2 + 0.018 + row * 0.03, -d / 2 - 0.005], 1))
      const cx = side * (w / 2 - 0.085)
      g.add(place(kit.cyl(0.038, 0.006, M.hole, [0, 0, 0], 'z', { seg: 28 }), [cx, -h / 2 + 0.058, -d / 2 - 0.0035]))
      g.add(place(kit.torus(0.038, 0.0035, M.shroudLight, [0, 0, 0], 'z', 32), [cx, -h / 2 + 0.058, -d / 2 - 0.006]))
    }
    for (let i = 0; i < 5; i++) g.add(kit.rbox(0.034, 0.012, 0.004, 0.003, M.shroudLight, [(i - 2) * 0.046, -h / 2 + 0.03, -d / 2 - 0.005], 1))
  }
  return g
}

/* ------------------------------------------------------------------------------------------------------------------ *
 * Treadmill
 * ------------------------------------------------------------------------------------------------------------------ */

function treadmill(p) {
  const incline = p.incline ?? 0
  const out = group()
  const deck = group()

  // Belt over its rollers.
  deck.add(kit.rbox(0.56, 0.046, 1.62, 0.0225, M.beltMatte, [0, 0.192, 0], 5))
  // A fine lighter line along each belt edge reads as the moulded belt border.
  for (const s of [-1, 1]) deck.add(kit.box(0.006, 0.0008, 1.58, M.coat, [s * 0.262, 0.2153, 0]))
  // Rear roller, with end bells visible between the rail ends.
  deck.add(kit.cyl(0.03, 0.57, M.steel ?? mat.steel, [0, 0.185, -0.815], 'x', { seg: 24 }))
  deck.add(kit.cyl(0.03, 0.57, mat.steel, [0, 0.185, 0.815], 'x', { seg: 24 }))

  for (const s of [-1, 1]) {
    // Aluminium side rail with a ribbed rubber tread let into it.
    const x = s * 0.345
    const railZ0 = -0.98
    const railZ1 = 0.82
    deck.add(beam([x, 0.208, railZ0], [x, 0.208, railZ1], 0.122, 0.036, M.alu, { r: 0.008 }))
    deck.add(kit.rbox(0.082, 0.006, railZ1 - railZ0 - 0.06, 0.002, M.rubber, [x, 0.2265, (railZ0 + railZ1) / 2], 1))
    for (const ox of [-0.024, -0.008, 0.008, 0.024]) deck.add(kit.box(0.005, 0.0028, railZ1 - railZ0 - 0.08, M.rubberDark, [x + ox, 0.23, (railZ0 + railZ1) / 2]))
    // Moulded end cap at the rear of each rail.
    const capPoly = roundPoly([[-1.05, 0.14, 0.03], [-1.0, 0.1, 0.02], [-0.95, 0.1, 0.005], [-0.95, 0.2255, 0.005], [-1.015, 0.2255, 0.02], [-1.055, 0.19, 0.02]], 0, 6)
    deck.add(slab(capPoly, 0.128, M.shroudDark, [x, 0, 0], { plane: 'zy', bevel: 0.008, bevelSeg: 3 }))
    // Side skirt: the long steel frame member under the rail.
    deck.add(beam([s * 0.325, 0.125, -0.96], [s * 0.325, 0.125, 0.86], 0.05, 0.1, M.coatDark, { r: 0.006 }))
    // Bolts along the frame, the kind of thing that sells the construction.
    for (const z of [-0.8, -0.4, 0, 0.4, 0.74]) deck.add(bolt([s * 0.351, 0.125, z], 'x', 0.006, M.aluDark))
    // Rear foot and the wheel that lets the deck roll when the front lifts.
    deck.add(group(kit.lathe([[0, 0], [0.03, 0], [0.034, 0.005], [0.034, 0.02], [0.026, 0.032], [0, 0.032]], M.rubberDark, [s * 0.32, 0, -0.98], 'y', 24)))
  }
  // Cross members tie the frame; the rear one is visible from behind.
  deck.add(beam([-0.3, 0.115, -0.93], [0.3, 0.115, -0.93], 0.05, 0.08, M.coatDark, { side: [0, 0, 1] }))
  deck.add(beam([-0.3, 0.115, 0.4], [0.3, 0.115, 0.4], 0.05, 0.08, M.coatDark, { side: [0, 0, 1] }))
  deck.add(beam([-0.3, 0.115, -0.3], [0.3, 0.115, -0.3], 0.05, 0.08, M.coatDark, { side: [0, 0, 1] }))

  // Motor hood: a moulded cover, wider than the deck, over the front roller.
  const hoodW = 0.84
  const hood = roundPoly(
    [[0.78, 0.075, 0.01], [0.78, 0.232, 0.012], [0.86, 0.3, 0.05], [1.08, 0.315, 0.08], [1.2, 0.235, 0.05], [1.23, 0.075, 0.03]],
    0,
    8,
  )
  deck.add(slab(hood, hoodW, M.shroud, [0, 0, 0], { plane: 'zy', bevel: 0.03, bevelSeg: 5 }))
  // Recessed top panel and vent slots.
  deck.add(place(kit.rbox(0.56, 0.006, 0.17, 0.003, M.shroudDark, [0, 0, 0], 2), [0, 0.316, 0.98], [3.5, 0, 0]))
  for (let i = 0; i < 7; i++) deck.add(place(kit.rbox(0.5, 0.004, 0.009, 0.0015, M.hole, [0, 0, 0], 1), [0, 0.3186, 0.914 + i * 0.022], [3.5, 0, 0]))
  // Hood skirt close to the floor, in dark plastic.
  deck.add(kit.rbox(hoodW - 0.02, 0.05, 0.42, 0.012, M.shroudDark, [0, 0.07, 1.01], 3))
  for (const s of [-1, 1]) deck.add(transportWheel(s * 0.36, 0.035, 1.16, 0.035, 0.024))

  // Everything above pivots about the rear foot when the deck inclines.
  const pivot = group(place(deck, [0, -0.02, 1.0]))
  place(pivot, [0, 0.02, -1.0], [-incline, 0, 0])
  out.add(pivot)

  // Fixed frame: uprights rising from outside the hood, leaning back toward the user.
  const upTop = [1.33, 0.7]
  for (const s of [-1, 1]) {
    const x = s * 0.395
    out.add(pipe([[x, 0.04, 0.96], [x, 0.2, 0.93], [x, upTop[0], upTop[1]]], 0.052, M.coat, { ry: 0.036, bend: 0.2, seg: 24 }))
    // Base shoe and floor beam of the upright.
    const shoe = roundPoly([[0.8, 0.0, 0.006], [1.14, 0.0, 0.006], [1.1, 0.075, 0.03], [0.99, 0.15, 0.03], [0.88, 0.15, 0.03], [0.82, 0.08, 0.02]], 0, 6)
    out.add(slab(shoe, 0.1, M.shroudDark, [x, 0, 0], { plane: 'zy', bevel: 0.012, bevelSeg: 3 }))
    // Hand rail: leaves the upright, runs back level, and turns down at its end.
    const rx = s * 0.365
    const rail = [[x, 1.19, 0.755], [rx, 1.045, 0.64], [rx, 1.045, 0.06], [rx, 0.905, -0.04]]
    out.add(pipe(rail, 0.0175, mat.chrome, { bend: 0.06, seg: 18 }))
    out.add(kit.lathe([[0, -0.006], [0.0195, -0.006], [0.0205, -0.003], [0.0205, 0.002], [0.016, 0.006], [0, 0.007]], M.rubberDark, [rx, 0.9, -0.044], 'y', 16))
    // Foam grip and the steel heart-rate contacts.
    out.add(kit.lathe([[0, -0.16], [0.0215, -0.16], [0.0235, -0.154], [0.0235, 0.154], [0.0215, 0.16], [0, 0.16]], M.grip, [rx, 1.045, 0.26], 'z', 18))
    out.add(kit.cyl(0.0205, 0.055, mat.steel, [rx, 1.045, 0.482], 'z', { seg: 18 }))
    out.add(kit.cyl(0.0205, 0.055, mat.steel, [rx, 1.045, 0.548], 'z', { seg: 18 }))
    out.add(kit.cyl(0.0225, 0.008, M.rubberDark, [rx, 1.045, 0.515], 'z', { seg: 18 }))
    // Bracket where the rail meets the upright.
    out.add(place(kit.rbox(0.06, 0.08, 0.05, 0.012, M.coatDark, [0, 0, 0], 2), [x, 1.19, 0.755], [-22, 0, 0]))
  }
  // Front crossbar under the console.
  out.add(kit.lathe([[0, -0.3], [0.0165, -0.3], [0.0165, 0.3], [0, 0.3]], mat.chrome, [0, 1.12, 0.74], 'x', 18))
  out.add(kit.lathe([[0, -0.17], [0.021, -0.17], [0.0225, -0.164], [0.0225, 0.164], [0.021, 0.17], [0, 0.17]], M.grip, [0, 1.12, 0.74], 'x', 18))
  for (const s of [-1, 1]) out.add(beam([s * 0.3, 1.12, 0.74], [s * 0.39, 1.15, 0.74], 0.032, 0.032, M.coatDark, { side: [0, 0, 1] }))

  // Console: tilted back, hood-like top lip.
  const con = consolePanel({ w: 0.88, h: 0.38, d: 0.1, screen: [0.36, 0.215] })
  place(con, [0, upTop[0] + 0.08, upTop[1] - 0.03], [32, 0, 0])
  out.add(con)
  // Safety clip and stop button at the console's lower edge.
  out.add(place(kit.lathe([[0, 0], [0.028, 0], [0.03, 0.006], [0.022, 0.016], [0, 0.018]], M.shroudLight, [0, 0, 0], 'y', 24), [0.28, 1.298, 0.6], [-60, 0, 0]))
  return out
}

/* ------------------------------------------------------------------------------------------------------------------ *
 * Bikes
 * ------------------------------------------------------------------------------------------------------------------ */

/** Lofts closed rings of [x, y, z] (all the same size) into a smooth skin. A ring shrunk to a point closes an end. */
export function loftGeo(rings) {
  const n = rings.length
  const m = rings[0].length
  const pos = []
  const idx = []
  for (const r of rings) for (const q of r) pos.push(q[0], q[1], q[2])
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < m; j++) {
      const j2 = (j + 1) % m
      const a = i * m + j
      const b = i * m + j2
      const c = (i + 1) * m + j2
      const d = (i + 1) * m + j
      idx.push(a, b, c, a, c, d)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Bicycle saddle along Z, nose toward +Z, sitting surface y about 0 at z = 0 (the widest part), length L, rear width W.
 * Rings run rear to nose. The underside is hollowed so it reads as a shell over rails.
 */
function saddleGeo(L = 0.27, W = 0.15, nose = 0.042, H = 0.05) {
  return cachedGeo(`saddle${keyOf([L, W, nose, H])}`, () => {
    const rings = []
    const NS = 36
    const NA = 28
    for (let i = 0; i <= NS; i++) {
      const s = i / NS
      const z = (s - 0.3) * L
      const round = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * s - 1), 5)), 0.5)
      const plan = (W / 2 + (nose / 2 - W / 2) * sstep(0.22, 0.62, s)) * Math.max(round, 1e-3)
      // Side view: rear kicks up a little, dips at the sitting area, nose stays level.
      const top = H * (0.012 / H + 0.22 * (1 - sstep(0, 0.3, s)) ** 2 - 0.1 * Math.sin(Math.PI * sstep(0.12, 0.7, s))) + (round - 1) * H * 0.55
      const ring = []
      for (let j = 0; j < NA; j++) {
        const a = (j / NA) * Math.PI * 2
        const c = Math.cos(a)
        const sn = Math.sin(a)
        // In the saddle's section the top is a flattened dome and the skirt turns under at the sides.
        const up = sn > 0 ? Math.pow(sn, 0.62) : sn * 0.72
        ring.push([plan * Math.sign(c) * Math.pow(Math.abs(c), 0.8), top + (up - 1) * H * (0.5 + 0.5 * round), z])
      }
      rings.push(ring)
    }
    return loftGeo(rings)
  })
}

/** Toe strap and cage platform for a pedal, built around its own origin: forward +Z, up +Y, top surface at y = 0.011. */
function pedalPlatform(strap = true) {
  const g = group()
  const w = 0.098
  const l = 0.095
  const outline = roundPoly([[-w / 2, -l / 2], [w / 2, -l / 2], [w / 2, l / 2], [-w / 2, l / 2]], 0.012, 4)
  const hole1 = roundPoly([[-w / 2 + 0.012, -l / 2 + 0.012], [-0.012, -l / 2 + 0.012], [-0.012, l / 2 - 0.012], [-w / 2 + 0.012, l / 2 - 0.012]], 0.005, 3)
  const hole2 = roundPoly([[0.012, -l / 2 + 0.012], [w / 2 - 0.012, -l / 2 + 0.012], [w / 2 - 0.012, l / 2 - 0.012], [0.012, l / 2 - 0.012]], 0.005, 3)
  g.add(slab(outline, 0.018, M.coatDark, [0, 0.002, 0], { plane: 'xz', bevel: 0.003, bevelSeg: 1, holes: [hole1, hole2] }))
  g.add(kit.cyl(0.0095, w - 0.008, M.coat, [0, 0, 0], 'x', { seg: 14 }))
  if (strap) {
    // Strap over the toes.
    const pts = []
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * (i / 12)
      pts.push([0.054 * Math.cos(a), 0.011 + 0.05 * Math.pow(Math.sin(a), 0.8), 0.04])
    }
    g.add(mesh(cachedGeo('toestrap', () => sweepGeo(pts, rectSection(0.03, 0.0035, 0.0012))), M.rubber))
    for (const s of [-1, 1]) g.add(kit.rbox(0.008, 0.012, 0.034, 0.002, M.aluDark, [s * 0.05, 0.012, 0.04], 1))
  }
  return g
}

/**
 * One crank, its spindle and pedal. hub: local crank axis point (x ignored). armX: where the arm runs. target: the point on the
 * sole the pedal must touch (the ball of the foot), fwd and up its directions.
 */
function crankAndPedal(hub, armX, target, fwd, up, { strap = true, armM = M.alu } = {}) {
  const g = group()
  const axle = target.clone().addScaledVector(up, -0.012)
  const a = new V3(armX, hub.y, hub.z)
  const b = new V3(armX, axle.y, axle.z)
  g.add(beam(a, b, 0.012, 0.03, armM, { r: 0.005, side: [1, 0, 0] }))
  g.add(kit.cyl(0.024, 0.016, armM, [armX, hub.y, hub.z], 'x', { seg: 24 }))
  g.add(kit.cyl(0.019, 0.016, armM, [armX, axle.y, axle.z], 'x', { seg: 20 }))
  g.add(bolt([armX + Math.sign(armX) * 0.008, hub.y, hub.z], 'x', 0.009, mat.chrome))
  g.add(kit.between([armX, axle.y, axle.z], [axle.x, axle.y, axle.z], 0.007, mat.steel, 12))
  const pedalO = pedalPlatform(strap)
  const f = fwd.clone().addScaledVector(up, -fwd.dot(up)).normalize()
  const x = up.clone().cross(f).normalize()
  pedalO.quaternion.setFromRotationMatrix(new M4().makeBasis(x, up, f))
  pedalO.position.copy(axle)
  g.add(pedalO)
  return g
}

/** Where each pedal goes: from the feet when the prop follows them, from the `crank` angle otherwise. */
function pedalTargets(p, ctx, hub, R, pedalX) {
  const out = {}
  if (ctx && ctx.feet) {
    const L = localFrame(p)
    for (const s of ['L', 'R']) {
      const f = ctx.feet[s]
      out[s] = { target: L.pt(f.ball), fwd: L.dir(f.forward), up: L.dir(f.up) }
    }
    const d = out.L.target.clone().sub(hub)
    out.angle = Math.atan2(d.z, d.y)
    return out
  }
  const th = ((p.crank ?? 40) * Math.PI) / 180
  for (const [s, a, sign] of [['L', th, 1], ['R', th + Math.PI, -1]]) {
    out[s] = {
      target: new V3(sign * pedalX, hub.y + R * Math.cos(a) + 0.012, hub.z + R * Math.sin(a)),
      fwd: new V3(0, 0, 1),
      up: new V3(0, 1, 0),
    }
  }
  out.angle = th
  return out
}

/** A floor stabiliser along X at z: elliptical tube, moulded end feet, optional transport wheels. */
function stabiliser(z, w = 0.56, { y = 0.045, wheels = false, m = M.coat } = {}) {
  const g = group()
  g.add(pipe([[-w / 2, y, z], [w / 2, y, z]], 0.032, m, { ry: 0.024, seg: 20, bend: 0, up: [0, 0, 1] }))
  for (const s of [-1, 1]) {
    const foot = roundPoly([[z - 0.05, 0, 0.006], [z + 0.05, 0, 0.006], [z + 0.05, 0.05, 0.02], [z + 0.03, 0.078, 0.01], [z - 0.03, 0.078, 0.01], [z - 0.05, 0.05, 0.02]], 0, 4)
    g.add(slab(foot, 0.06, M.rubberDark, [s * (w / 2 - 0.02), 0, 0], { plane: 'zy', bevel: 0.008, bevelSeg: 2 }))
    if (wheels) g.add(transportWheel(s * (w / 2 + 0.018), 0.035, z + 0.02, 0.033, 0.02))
  }
  return g
}

const BIKE = { hubY: 0.315, hubZ: 0.07, R: 0.17, pedalX: 0.122, armX: 0.104 }

function uprightBike(p, ctx) {
  const g = group()
  const extra = p.saddle ?? 0
  const hub = new V3(0, BIKE.hubY, BIKE.hubZ)
  // Base: long floor beam and two stabilisers.
  g.add(stabiliser(-0.5, 0.54))
  g.add(stabiliser(0.56, 0.56, { wheels: true }))
  g.add(beam([0, 0.07, -0.5], [0, 0.07, 0.56], 0.08, 0.05, M.coatDark, { r: 0.008 }))
  // Flywheel housing: one moulded body, swelling around the flywheel, sweeping up into the seat post and the mast.
  const body = roundPoly(
    [[-0.2, 0.08, 0.05], [0.33, 0.08, 0.09], [0.5, 0.2, 0.14], [0.5, 0.42, 0.09], [0.43, 0.62, 0.05], [0.33, 0.62, 0.05], [0.25, 0.5, 0.12], [-0.07, 0.5, 0.1], [-0.21, 0.6, 0.05], [-0.31, 0.56, 0.05], [-0.29, 0.25, 0.14]],
    0,
    9,
  )
  g.add(slab(body, 0.15, M.shroud, [0, 0, 0], { plane: 'zy', bevel: 0.03, bevelSeg: 5 }))
  for (const s of [-1, 1]) {
    // The flywheel cover domes out of the flank, with a dark centre and a fine ring. It gives the side a real form.
    const fr = 0.205
    g.add(latheOut([[0, -0.004], [fr, -0.004], [fr - 0.002, 0.003], [fr - 0.022, 0.013], [fr - 0.06, 0.02], [0.1, 0.022], [0, 0.022]], M.shroud, [s * 0.073, BIKE.hubY, BIKE.hubZ], s, 64))
    if (s < 0) continue
  }
  for (const s of [-1, 1]) {
    g.add(latheOut([[0, -0.003], [0.082, -0.003], [0.086, 0], [0.082, 0.006], [0, 0.008]], M.shroudDark, [s * 0.0925, BIKE.hubY, BIKE.hubZ], s, 40))
    g.add(place(kit.torus(0.164, 0.0024, M.shroudLight, [0, 0, 0], 'x', 64), [s * 0.0885, BIKE.hubY, BIKE.hubZ]))
    // An accent panel along the top of the flank.
    const accent = roundPoly([[-0.27, 0.53, 0.02], [-0.21, 0.565, 0.02], [-0.06, 0.475, 0.05], [0.24, 0.475, 0.05], [0.33, 0.585, 0.02], [0.41, 0.585, 0.02], [0.45, 0.47, 0.04], [0.35, 0.42, 0.04], [-0.1, 0.42, 0.06], [-0.25, 0.46, 0.04]], 0, 5)
    g.add(slab(accent, 0.004, M.shroudDark, [s * 0.0745, 0, 0], { plane: 'zy', bevel: 0.0012, bevelSeg: 1 }))
  }
  g.add(kit.cyl(0.03, 0.2, mat.steel, [0, BIKE.hubY, BIKE.hubZ], 'x', { seg: 24 }))

  // Seat post: square sleeve, inner chromed post with adjustment holes, spring pop-pin.
  const postA = new V3(0, 0.46, -0.16)
  const postDir = new V3(0, 0.955, -0.296).normalize()
  const sleeveTop = postA.clone().addScaledVector(postDir, 0.17)
  const postTop = postA.clone().addScaledVector(postDir, 0.47 + extra)
  g.add(beam(postA, sleeveTop, 0.066, 0.066, M.coat, { r: 0.007 }))
  g.add(beam(postA.clone().addScaledVector(postDir, 0.05), postTop, 0.05, 0.05, mat.chrome, { r: 0.006, holes: { n: 7, from: 0.14 + 0.05, to: 0.41, r: 0.0055, face: 'w' } }))
  g.add(beam(sleeveTop.clone().addScaledVector(postDir, -0.008), sleeveTop.clone().addScaledVector(postDir, 0.004), 0.072, 0.072, M.rubberDark, { r: 0.008 }))
  // Pop-pin on the rear face of the sleeve.
  const pin = sleeveTop.clone().addScaledVector(postDir, -0.05)
  g.add(place(kit.lathe([[0, 0], [0.012, 0], [0.012, 0.018], [0.02, 0.022], [0.02, 0.05], [0.016, 0.056], [0, 0.056]], M.shroudLight, [0, 0, 0], 'y', 20), [pin.x, pin.y, pin.z - 0.032], [-90, 0, 0]))

  // Saddle: wide commercial shape, on a clamp.
  const saddleSeat = new V3(0, 0.977 + extra * 0.955, -0.255 - extra * 0.296)
  g.add(mesh(saddleGeo(0.3, 0.235, 0.075, 0.075), M.pad, [saddleSeat.x, saddleSeat.y, saddleSeat.z]))
  g.add(kit.rbox(0.08, 0.03, 0.09, 0.008, M.coatDark, [postTop.x, postTop.y + 0.01, postTop.z], 2))

  // Mast from the housing to the console, leaning toward the user at the top.
  const mastPts = [[0, 0.5, 0.385], [0, 1.0, 0.56], [0, 1.2, 0.54]]
  g.add(pipe(mastPts, 0.052, M.coat, { ry: 0.034, bend: 0.3, seg: 22, up: [1, 0, 0] }))
  // Handlebar: a one-piece bent tube clamped to the mast, with foam on the part the hands use.
  const bar = (s) => [[0, 1.05, 0.565], [s * 0.15, 1.05, 0.555], [s * 0.25, 1.085, 0.44], [s * 0.25, 1.085, 0.14]]
  for (const s of [-1, 1]) {
    g.add(pipe(bar(s), 0.0145, mat.chrome, { bend: 0.07, seg: 16 }))
    g.add(kit.lathe([[0, -0.105], [0.018, -0.105], [0.0205, -0.1], [0.0205, 0.1], [0.018, 0.105], [0, 0.105]], M.grip, [s * 0.25, 1.085, 0.25], 'z', 18))
    g.add(kit.lathe([[0, -0.006], [0.0165, -0.006], [0.0175, -0.003], [0.0175, 0.003], [0.013, 0.006], [0, 0.007]], M.rubberDark, [s * 0.25, 1.085, 0.138], 'z', 16))
    // Heart-rate plates just ahead of the foam.
    g.add(kit.cyl(0.0185, 0.05, mat.steel, [s * 0.25, 1.085, 0.395], 'z', { seg: 16 }))
  }
  g.add(place(kit.rbox(0.11, 0.05, 0.05, 0.012, M.coatDark, [0, 0, 0], 2), [0, 1.05, 0.56], [0, 0, 0]))
  const con = consolePanel({ w: 0.33, h: 0.21, d: 0.06, screen: [0.25, 0.15], wings: false })
  place(con, [0, 1.25, 0.525], [38, 0, 0])
  g.add(con)

  // Cranks follow the feet.
  const t = pedalTargets(p, ctx, hub, BIKE.R, BIKE.pedalX)
  g.add(crankAndPedal(hub, BIKE.armX, t.L.target, t.L.fwd, t.L.up))
  g.add(crankAndPedal(hub, -BIKE.armX, t.R.target, t.R.fwd, t.R.up))
  return g
}

function recumbentBike(p, ctx) {
  const g = group()
  const hub = new V3(0, 0.43, 0.42)
  const dz = ((p.slide ?? 0.5) - 0.5) * -0.16
  g.add(stabiliser(-0.72, 0.56))
  g.add(stabiliser(0.72, 0.56, { wheels: true }))
  // Spine of the machine: a long rectangular tube.
  g.add(beam([0, 0.17, -0.72], [0, 0.17, 0.44], 0.1, 0.075, M.coat, { r: 0.008 }))
  g.add(beam([0, 0.07, -0.72], [0, 0.17, -0.42], 0.08, 0.05, M.coatDark, { r: 0.008 }))
  g.add(beam([0, 0.07, 0.72], [0, 0.17, 0.4], 0.08, 0.05, M.coatDark, { r: 0.008 }))
  // Slide rail: raised square tube with adjustment holes; the seat carriage runs on it.
  g.add(beam([0, 0.34, -0.66], [0, 0.34, 0.13], 0.07, 0.07, M.coatLight, { r: 0.008, holes: { n: 12, from: 0.1, to: 0.72, r: 0.0065, face: 'w' } }))
  for (const z of [-0.6, 0.06]) {
    g.add(beam([0, 0.2, z], [0, 0.31, z], 0.06, 0.05, M.coat, { r: 0.006 }))
  }
  // Housing around the flywheel and crank at the front, with the console mast growing from it.
  const body = roundPoly(
    [[0.13, 0.13, 0.03], [0.74, 0.13, 0.03], [0.76, 0.46, 0.1], [0.66, 0.68, 0.05], [0.57, 0.68, 0.05], [0.42, 0.66, 0.12], [0.22, 0.52, 0.08], [0.13, 0.32, 0.04]],
    0,
    8,
  )
  g.add(slab(body, 0.15, M.shroud, [0, 0, 0], { plane: 'zy', bevel: 0.03, bevelSeg: 5 }))
  for (const s of [-1, 1]) {
    // The flywheel cover domes out of the flank, as on the upright.
    const fr = 0.2
    g.add(latheOut([[0, -0.004], [fr, -0.004], [fr - 0.002, 0.003], [fr - 0.022, 0.013], [fr - 0.06, 0.02], [0.1, 0.022], [0, 0.022]], M.shroud, [s * 0.073, hub.y, hub.z], s, 64))
    g.add(latheOut([[0, -0.003], [0.082, -0.003], [0.086, 0], [0.082, 0.006], [0, 0.008]], M.shroudDark, [s * 0.0925, hub.y, hub.z], s, 40))
    g.add(place(kit.torus(0.16, 0.0024, M.shroudLight, [0, 0, 0], 'x', 64), [s * 0.0885, hub.y, hub.z]))
    // Accent panel along the rear flank of the housing.
    const accent = roundPoly([[0.15, 0.17, 0.02], [0.2, 0.17, 0.02], [0.24, 0.47, 0.05], [0.33, 0.56, 0.03], [0.26, 0.54, 0.04], [0.17, 0.36, 0.05]], 0, 5)
    g.add(slab(accent, 0.004, M.shroudDark, [s * 0.0745, 0, 0], { plane: 'zy', bevel: 0.0012, bevelSeg: 1 }))
  }
  g.add(kit.cyl(0.03, 0.2, mat.steel, [0, hub.y, hub.z], 'x', { seg: 24 }))
  // Mast and console above the pedals.
  g.add(pipe([[0, 0.62, 0.62], [0, 1.06, 0.68], [0, 1.2, 0.63]], 0.05, M.coat, { ry: 0.033, bend: 0.2, seg: 22, up: [1, 0, 0] }))
  const con = consolePanel({ w: 0.34, h: 0.21, d: 0.06, screen: [0.25, 0.15], wings: false })
  place(con, [0, 1.26, 0.6], [32, 0, 0])
  g.add(con)
  // Upper handles on the mast (the "racing" grips).
  for (const s of [-1, 1]) {
    g.add(pipe([[0, 1.0, 0.67], [s * 0.1, 1.0, 0.67], [s * 0.2, 0.98, 0.58], [s * 0.2, 0.95, 0.46]], 0.0135, mat.chrome, { bend: 0.05, seg: 14 }))
    g.add(kit.lathe([[0, -0.05], [0.0165, -0.05], [0.0185, -0.046], [0.0185, 0.046], [0.0165, 0.05], [0, 0.05]], M.grip, [s * 0.2, 0.955, 0.5], 'z', 16))
  }

  // The seat assembly slides.
  const seat = group()
  // Carriage on the rail, with the lever that releases it.
  seat.add(kit.rbox(0.1, 0.1, 0.24, 0.012, M.coatDark, [0, 0.34, -0.2], 2))
  seat.add(pipe([[0.05, 0.33, -0.1], [0.14, 0.31, -0.04], [0.14, 0.31, 0.04]], 0.008, mat.chrome, { bend: 0.03, seg: 12 }))
  seat.add(place(kit.lathe([[0, -0.03], [0.0115, -0.03], [0.012, 0.026], [0.009, 0.03], [0, 0.03]], M.shroudLight, [0, 0, 0], 'z', 14), [0.14, 0.31, 0.04]))
  seat.add(beam([0, 0.39, -0.2], [0, 0.545, -0.2], 0.07, 0.11, M.coat, { r: 0.008 }))
  // Plastic seat pan and cushion.
  seat.add(place(pad(0.4, 0.34, 0.03, M.shroudDark, null, { r: 0.05, crown: 0, seam: false }), [0, 0.552, -0.2]))
  seat.add(place(pad(0.42, 0.37, 0.07, M.pad, null, { r: 0.07, crown: 0.012, rim: 0.03 }), [0, 0.595 - 0.012, -0.2]))
  // Backrest, on a tube from behind the seat.
  const backTilt = 22
  const bc = new V3(0, 0.87, -0.445)
  const back = group()
  back.add(place(pad(0.4, 0.56, 0.028, M.shroudDark, null, { r: 0.09, crown: 0, seam: false }), [0, 0, -0.024]))
  back.add(place(pad(0.42, 0.58, 0.075, M.pad, null, { r: 0.1, crown: 0.012, rim: 0.03 }), [0, 0, 0.012]))
  // pad() lies flat: stand it up, its top facing the user.
  const stand = group(back)
  stand.rotation.set(Math.PI / 2 - backTilt * RAD, 0, 0)
  stand.position.copy(bc)
  seat.add(stand)
  seat.add(pipe([[0, 0.46, -0.3], [0, 0.56, -0.42], [0, 0.82, -0.49]], 0.028, M.coat, { ry: 0.02, bend: 0.08, seg: 16, up: [1, 0, 0] }))
  // Side handles: a loop under the seat that comes up beside the hips.
  for (const s of [-1, 1]) {
    seat.add(pipe([[s * 0.05, 0.46, -0.3], [s * 0.285, 0.46, -0.3], [s * 0.285, 0.63, -0.3], [s * 0.285, 0.63, -0.02]], 0.0135, mat.chrome, { bend: 0.05, seg: 14 }))
    seat.add(kit.lathe([[0, -0.11], [0.0165, -0.11], [0.0195, -0.104], [0.0195, 0.104], [0.0165, 0.11], [0, 0.11]], M.grip, [s * 0.285, 0.63, -0.16], 'z', 16))
    seat.add(kit.lathe([[0, -0.006], [0.0155, -0.006], [0.0165, -0.002], [0.0165, 0.003], [0.012, 0.006], [0, 0.007]], M.rubberDark, [s * 0.285, 0.63, -0.018], 'z', 14))
  }
  seat.position.z = dz
  g.add(seat)

  const t = pedalTargets(p, ctx, hub, BIKE.R, BIKE.pedalX)
  g.add(crankAndPedal(hub, BIKE.armX, t.L.target, t.L.fwd, t.L.up))
  g.add(crankAndPedal(hub, -BIKE.armX, t.R.target, t.R.fwd, t.R.up))
  // Welds where the posts meet the rail and the spine.
  for (const z of [-0.6, 0.06]) {
    g.add(weld([0, 0.21, z], [0, 1, 0], 0.06, 0.05))
    g.add(weld([0, 0.303, z], [0, 1, 0], 0.06, 0.05))
  }
  return g
}

/* ------------------------------------------------------------------------------------------------------------------ *
 * Road bicycle
 * ------------------------------------------------------------------------------------------------------------------ */

const ROAD = {
  bb: new V3(0, 0.265, 0),
  rearAxle: new V3(0, 0.335, -0.405),
  frontAxle: new V3(0, 0.335, 0.555),
  R: 0.17,
  armX: 0.074,
}

/** Tooth outline for a chainring, centred on the origin. */
function gearOutline(rRoot, rTip, teeth) {
  const pts = []
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2
    const w = (Math.PI * 2) / teeth
    for (const [da, r] of [[0, rRoot], [0.32, rTip], [0.68, rTip], [1, rRoot]]) pts.push([r * Math.cos(a + da * w), r * Math.sin(a + da * w)])
  }
  return pts
}

function bikeWheel(angle) {
  const R = 0.3225 // tyre centre, 0.335 overall
  const g = group()
  const spin = group()
  g.add(place(kit.torus(R, 0.0125, M.rubber, [0, 0, 0], 'x', 120), [0, 0, 0]))
  // The tread line on the crown, slightly lighter, catches the light.
  g.add(kit.lathe([[R - 0.0165, -0.0118], [R - 0.0005, -0.0121], [R + 0.0118, -0.0052], [R + 0.0127, 0], [R + 0.0118, 0.0052], [R - 0.0005, 0.0121], [R - 0.0165, 0.0118]], M.rubber, [0, 0, 0], 'x', 120))
  // Rim: deep aluminium section, open toward the hub.
  g.add(kit.lathe([[R - 0.046, -0.0035], [R - 0.0145, -0.0105], [R - 0.0105, -0.0105], [R - 0.0105, 0.0105], [R - 0.0145, 0.0105], [R - 0.046, 0.0035], [R - 0.046, -0.0035]], M.alu, [0, 0, 0], 'x', 120))
  const spokes = cachedGeo('roadSpokes', () => {
    const list = []
    const N = 24
    const cyl = new THREE.CylinderGeometry(0.00115, 0.00115, 1, 5, 1, true)
    const q = new Q4()
    const up = new V3(0, 1, 0)
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2
      const lace = i % 2 ? 0.5 : -0.5
      const sideX = i % 4 < 2 ? 0.021 : -0.021
      const A = new V3(sideX, 0.024 * Math.cos(a + lace * 1.2), 0.024 * Math.sin(a + lace * 1.2))
      const B = new V3(0, (R - 0.044) * Math.cos(a), (R - 0.044) * Math.sin(a))
      const d = B.clone().sub(A)
      const len = d.length()
      q.setFromUnitVectors(up, d.normalize())
      const m = new M4().compose(A.clone().add(B).multiplyScalar(0.5), q, new V3(1, len, 1))
      list.push([cyl, m])
    }
    return mergeGeos(list)
  })
  spin.add(mesh(spokes, mat.steel))
  spin.rotation.x = angle
  g.add(spin)
  // Hub: two flanges and a barrel, axle sticking out.
  g.add(kit.lathe([[0, -0.052], [0.006, -0.052], [0.006, -0.03], [0.012, -0.028], [0.027, -0.0235], [0.027, -0.0205], [0.013, -0.018], [0.013, 0.018], [0.027, 0.0205], [0.027, 0.0235], [0.012, 0.028], [0.006, 0.03], [0.006, 0.052], [0, 0.052]], M.alu, [0, 0, 0], 'x', 28))
  return g
}

function roadBike(p, ctx) {
  const g = group()
  const t = pedalTargets(p, ctx, ROAD.bb, ROAD.R, 0.115)
  const spin = t.angle * 2 // a whole number of turns per crank turn, so a looping picture has no jump
  // Wheels.
  g.add(place(bikeWheel(spin), [0, ROAD.rearAxle.y, ROAD.rearAxle.z]))
  g.add(place(bikeWheel(spin), [0, ROAD.frontAxle.y, ROAD.frontAxle.z]))

  const paint = M.bikePaint
  const bb = ROAD.bb
  const sd = new V3(0, 0.959, -0.284) // seat tube direction
  const seatCluster = bb.clone().addScaledVector(sd, 0.5)
  const headTop = new V3(0, 0.815, 0.395)
  const headBot = new V3(0, 0.675, 0.437)
  const P = (v) => [v.x, v.y, v.z]
  g.add(pipe([P(bb), P(seatCluster.clone().addScaledVector(sd, 0.02))], 0.0145, paint, { bend: 0, seg: 18 })) // seat tube
  g.add(pipe([P(seatCluster), P(headTop.clone().add(new V3(0, -0.02, 0.006)))], 0.0145, paint, { bend: 0, seg: 18 })) // top tube
  g.add(pipe([P(bb), P(headBot.clone().add(new V3(0, 0.022, -0.006)))], 0.0195, paint, { bend: 0, seg: 18 })) // down tube
  g.add(pipe([P(headBot.clone().add(new V3(0, -0.012, 0.0036))), P(headTop.clone().add(new V3(0, 0.012, -0.0036)))], 0.0205, paint, { bend: 0, seg: 22 })) // head tube
  g.add(kit.cyl(0.022, 0.078, paint, [bb.x, bb.y, bb.z], 'x', { seg: 24 })) // bottom bracket shell
  for (const s of [-1, 1]) {
    g.add(pipe([[s * 0.024, bb.y, bb.z - 0.02], [s * 0.058, ROAD.rearAxle.y, ROAD.rearAxle.z]], 0.0085, paint, { bend: 0, seg: 12 })) // chainstays
    g.add(pipe([[s * 0.018, seatCluster.y + 0.006, seatCluster.z - 0.006], [s * 0.058, ROAD.rearAxle.y + 0.008, ROAD.rearAxle.z]], 0.0065, paint, { bend: 0, seg: 12 })) // seatstays
    g.add(kit.rbox(0.004, 0.032, 0.034, 0.005, M.aluDark, [s * 0.058, ROAD.rearAxle.y, ROAD.rearAxle.z + 0.006], 1)) // dropout
    // Fork blade: swept forward at the tip.
    const a = headBot.clone().add(new V3(s * 0.03, -0.022, 0.006))
    g.add(pipe([[a.x, a.y, a.z], [s * 0.045, 0.51, 0.487], [s * 0.052, ROAD.frontAxle.y, ROAD.frontAxle.z]], 0.0098, paint, { bend: 0.16, seg: 14 }))
    g.add(kit.rbox(0.004, 0.028, 0.026, 0.005, M.aluDark, [s * 0.052, ROAD.frontAxle.y, ROAD.frontAxle.z], 1))
  }
  g.add(place(kit.cyl(0.033, 0.03, paint, [0, 0, 0], 'x', { seg: 20 }), [0, headBot.y - 0.024, headBot.z + 0.006])) // fork crown
  // Seat post, clamp, saddle.
  const postTop = bb.clone().addScaledVector(sd, 0.72)
  g.add(kit.between(P(seatCluster), P(postTop), 0.0135, M.alu, 16))
  g.add(kit.cyl(0.0172, 0.016, M.aluDark, P(seatCluster.clone().addScaledVector(sd, 0.018)), 'y', { seg: 18 }))
  g.add(place(kit.rbox(0.03, 0.022, 0.045, 0.006, M.aluDark, [0, 0, 0], 2), P(postTop.clone().add(new V3(0, 0.004, 0)))))
  for (const s of [-1, 1]) g.add(pipe([[s * 0.022, postTop.y + 0.014, postTop.z - 0.075], [s * 0.019, postTop.y + 0.002, postTop.z - 0.03], [s * 0.019, postTop.y + 0.002, postTop.z + 0.03], [s * 0.008, postTop.y + 0.016, postTop.z + 0.09]], 0.0032, mat.steel, { bend: 0.015, seg: 8 }))
  g.add(mesh(saddleGeo(0.275, 0.142, 0.042, 0.052), M.pad, [0, 0.965, postTop.z - 0.033]))
  // Stem and handlebar. Drop bar: a single tube through 3D points, wrapped with tape.
  g.add(pipe([[headTop.x, headTop.y + 0.012, headTop.z - 0.004], [0, 0.86, 0.383]], 0.0125, M.alu, { bend: 0, seg: 16 })) // steerer
  g.add(pipe([[0, 0.855, 0.385], [0, 0.885, 0.46]], 0.0145, M.aluDark, { bend: 0, seg: 16 })) // stem
  g.add(place(kit.cyl(0.0185, 0.042, M.aluDark, [0, 0, 0], 'x', { seg: 20 }), [0, 0.885, 0.46]))
  for (const s of [-1, 1]) {
    const pts = [[0, 0.885, 0.46], [s * 0.17, 0.885, 0.46], [s * 0.2, 0.885, 0.455, 0.03], [s * 0.205, 0.885, 0.545, 0.05], [s * 0.205, 0.77, 0.56, 0.045], [s * 0.205, 0.77, 0.47]]
    g.add(pipe(pts, 0.012, M.rubber, { bend: 0.04, seg: 14 }))
    g.add(kit.cyl(0.0125, 0.26, M.alu, [s * 0.07, 0.885, 0.46], 'x', { seg: 14 }))
    // Brake hood on the bar's front curve, with the lever hanging from it.
    g.add(mesh(cachedGeo('roadHood', () => {
      const rings = []
      const N = 14
      for (let i = 0; i <= N; i++) {
        const u = i / N
        const rr = 0.0165 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.05 + 0.04)), 0.45)
        const z = -0.02 + u * 0.082
        const y = 0.004 + 0.022 * Math.sin(u * Math.PI * 0.7)
        rings.push(ellipseSection(rr * 0.82, rr, 14).pts.map(([x, yy]) => [x, y + yy, z]))
      }
      return loftGeo(rings)
    }), M.grip, [s * 0.205, 0.894, 0.525]))
    g.add(pipe([[s * 0.205, 0.905, 0.585], [s * 0.207, 0.86, 0.606], [s * 0.207, 0.79, 0.583]], 0.0052, M.alu, { bend: 0.05, seg: 10, ry: 0.0038 }))
  }
  // Brake calipers on fork crown and seatstay bridge.
  for (const [y, z] of [[headBot.y - 0.03, headBot.z + 0.045], [seatCluster.y - 0.105, seatCluster.z - 0.135]]) {
    g.add(place(kit.rbox(0.05, 0.024, 0.016, 0.005, M.aluDark, [0, 0, 0], 2), [0, y, z]))
  }
  // Drive side (the rider's right, -X). The chainring turns with the crank.
  const driveX = -0.05
  const ring = group()
  const rr = 0.098
  const cuts = [0, 1, 2, 3, 4].map((i) => {
    const a0 = (i / 5) * Math.PI * 2 + 0.16
    const a1 = ((i + 1) / 5) * Math.PI * 2 - 0.16
    const pts = []
    for (let k = 0; k <= 10; k++) {
      const a = a0 + ((a1 - a0) * k) / 10
      pts.push([0.082 * Math.cos(a), 0.082 * Math.sin(a)])
    }
    for (let k = 10; k >= 0; k--) {
      const a = a0 + 0.12 + ((a1 - a0 - 0.24) * k) / 10
      pts.push([0.034 * Math.cos(a), 0.034 * Math.sin(a)])
    }
    return pts
  })
  ring.add(slab(gearOutline(rr - 0.0035, rr + 0.002, 50), 0.0035, M.alu, [0, 0, 0], { plane: 'zy', bevel: 0.0006, bevelSeg: 1, crease: 25, holes: cuts }))
  const ringG = group(ring)
  ringG.position.set(driveX, bb.y, bb.z)
  ringG.rotation.x = t.angle
  g.add(ringG)
  // Cassette and chain.
  g.add(kit.lathe([[0.01, -0.026], [0.05, -0.026], [0.05, -0.021], [0.044, -0.019], [0.044, -0.014], [0.038, -0.012], [0.038, -0.006], [0.032, -0.004], [0.032, 0.002], [0.026, 0.004], [0.026, 0.01], [0.01, 0.012]], M.aluDark, [-0.042, ROAD.rearAxle.y, ROAD.rearAxle.z], 'x', 36))
  const chainPts = (() => {
    const c1 = bb
    const c2 = ROAD.rearAxle
    const jockey1 = [ROAD.rearAxle.y - 0.075, ROAD.rearAxle.z - 0.005]
    const jockey2 = [ROAD.rearAxle.y - 0.15, ROAD.rearAxle.z + 0.022]
    const arc = (y, z, r, a0, a1, n = 8) => Array.from({ length: n + 1 }, (_, i) => {
      const a = a0 + ((a1 - a0) * i) / n
      return [driveX, y + r * Math.cos(a), z + r * Math.sin(a)]
    })
    return [
      ...arc(c1.y, c1.z, rr, Math.PI * 1.05, 0.12, 16), // around the ring's front, from bottom to top... drawn clockwise seen from -X
      ...arc(c2.y, c2.z, 0.044, 0.1, -Math.PI * 0.72, 8),
      ...arc(jockey1[0], jockey1[1], 0.016, Math.PI * 0.75, Math.PI * 1.25, 4),
      ...arc(jockey2[0], jockey2[1], 0.016, -Math.PI * 0.3, Math.PI * 1.02 - Math.PI * 2 + Math.PI * 2, 2),
    ]
  })()
  g.add(mesh(cachedGeo('roadChain', () => sweepGeo(chainPts, rectSection(0.0075, 0.0072, 0.002), { closed: true })), M.rubberDark))
  // Rear derailleur cage.
  g.add(kit.lathe([[0, -0.003], [0.016, -0.003], [0.016, 0.003], [0, 0.003]], M.aluDark, [driveX, ROAD.rearAxle.y - 0.075, ROAD.rearAxle.z - 0.005], 'x', 18))
  g.add(kit.lathe([[0, -0.003], [0.016, -0.003], [0.016, 0.003], [0, 0.003]], M.aluDark, [driveX, ROAD.rearAxle.y - 0.15, ROAD.rearAxle.z + 0.022], 'x', 18))
  g.add(beam([driveX - 0.005, ROAD.rearAxle.y - 0.06, ROAD.rearAxle.z - 0.004], [driveX - 0.005, ROAD.rearAxle.y - 0.158, ROAD.rearAxle.z + 0.025], 0.003, 0.02, M.alu, { r: 0.001, side: [1, 0, 0] }))
  // Cranks.
  g.add(crankAndPedal(ROAD.bb, ROAD.armX, t.L.target, t.L.fwd, t.L.up, { armM: M.alu }))
  g.add(crankAndPedal(ROAD.bb, -ROAD.armX, t.R.target, t.R.fwd, t.R.up, { armM: M.alu }))
  return g
}

/* ------------------------------------------------------------------------------------------------------------------ *
 * Elliptical
 * ------------------------------------------------------------------------------------------------------------------ */

export const ELLIPTICAL = {
  ramp: [[0.34, 0.145], [0.92, 0.275]], // [z, y] of the rail's two ends, top surface
  rearHub: [-0.84, 0.335],
  pivotY: 0.8,
  pivotZ: 0.74,
  pedalX: 0.112,
  armBelowSole: 0.058,
}

function elliptical(p, ctx) {
  const g = group()
  const L = localFrame(p)
  const E = ELLIPTICAL

  // Base.
  g.add(stabiliser(-0.98, 0.62))
  g.add(stabiliser(0.98, 0.62, { wheels: true }))
  g.add(beam([0, 0.075, -0.98], [0, 0.075, 0.98], 0.12, 0.06, M.coatDark, { r: 0.01 }))

  // Rear shroud: the housing that hides the flywheel and cranks.
  const [hz, hy] = E.rearHub
  const drum = [[0, -0.15], [0.205, -0.15], [0.232, -0.146], [0.25, -0.13], [0.26, -0.1], [0.262, -0.03], [0.264, 0], [0.262, 0.03], [0.26, 0.1], [0.25, 0.13], [0.232, 0.146], [0.205, 0.15], [0, 0.15]]
  g.add(kit.lathe(drum, M.shroud, [0, hy, hz], 'x', 80))
  for (const s of [-1, 1]) {
    g.add(latheOut([[0, -0.004], [0.175, -0.004], [0.179, 0], [0.175, 0.005], [0.08, 0.008], [0, 0.012]], M.shroudDark, [s * 0.15, hy, hz], s, 64))
    g.add(place(kit.torus(0.135, 0.0024, M.shroudLight, [0, 0, 0], 'x', 64), [s * 0.155, hy, hz]))
    g.add(latheOut([[0, -0.003], [0.045, -0.003], [0.048, 0], [0.043, 0.005], [0, 0.007]], M.coatLight, [s * 0.158, hy, hz], s, 32))
    // The slot each pedal arm enters through.
    g.add(place(kit.rbox(0.05, 0.13, 0.012, 0.004, M.hole, [0, 0, 0], 1), [s * E.pedalX, hy + 0.03, hz + 0.258]))
  }
  // Moulded skirt tying the shroud to the base, flowing toward the front.
  const skirt = roundPoly([[hz - 0.24, 0.07, 0.01], [hz + 0.3, 0.07, 0.01], [hz + 0.22, 0.2, 0.04], [hz - 0.18, 0.2, 0.04]], 0, 5)
  g.add(slab(skirt, 0.26, M.shroudDark, [0, 0, 0], { plane: 'zy', bevel: 0.018, bevelSeg: 3 }))

  // Front ramp: a moulded wedge, with an aluminium rail let into it for each pedal's roller.
  const [[z0, y0], [z1, y1]] = E.ramp
  const slope = (y1 - y0) / (z1 - z0)
  const rampY = (z) => y0 + (z - z0) * slope
  const wedge = roundPoly([[z0 - 0.06, 0.055, 0.01], [z1 + 0.1, 0.055, 0.01], [z1 + 0.08, y1 - 0.008, 0.02], [z0 - 0.03, y0 - 0.012, 0.02]], 0, 4)
  g.add(slab(wedge, 0.34, M.matteDark, [0, 0, 0], { plane: 'zy', bevel: 0.012, bevelSeg: 3 }))
  for (const s of [-1, 1]) {
    g.add(beam([s * E.pedalX, y0 - 0.007, z0], [s * E.pedalX, y1 - 0.007, z1], 0.044, 0.014, M.aluDark, { r: 0.003 }))
    // End stops.
    for (const z of [z0 - 0.006, z1 + 0.006]) g.add(place(kit.rbox(0.05, 0.03, 0.012, 0.004, M.rubberDark, [0, 0, 0], 1), [s * E.pedalX, rampY(z) + 0.006, z]))
  }

  // Mast and console.
  const mast = [[0, 0.06, 0.93], [0, 1.0, 0.86], [0, 1.42, 0.7]]
  g.add(pipe(mast, 0.06, M.coat, { ry: 0.042, bend: 0.3, seg: 24, up: [1, 0, 0] }))
  const shoe = roundPoly([[0.76, 0.05, 0.01], [1.1, 0.05, 0.01], [1.03, 0.2, 0.04], [0.97, 0.3, 0.03], [0.86, 0.3, 0.03], [0.81, 0.2, 0.03]], 0, 5)
  g.add(slab(shoe, 0.17, M.shroudDark, [0, 0, 0], { plane: 'zy', bevel: 0.02, bevelSeg: 4 }))
  const con = consolePanel({ w: 0.46, h: 0.27, d: 0.075, screen: [0.27, 0.16], wings: false })
  place(con, [0, 1.49, 0.655], [34, 0, 0])
  g.add(con)
  // Fixed handles on the mast.
  for (const s of [-1, 1]) {
    g.add(pipe([[0, 1.14, 0.81], [s * 0.09, 1.14, 0.8], [s * 0.13, 1.2, 0.74], [s * 0.13, 1.31, 0.7]], 0.0135, mat.chrome, { bend: 0.04, seg: 14 }))
    g.add(kit.lathe([[0, -0.055], [0.0165, -0.055], [0.019, -0.05], [0.019, 0.05], [0.0165, 0.055], [0, 0.055]], M.grip, [s * 0.13, 1.26, 0.72], 'y', 14))
  }
  // Pivot shaft on an arm from the mast.
  g.add(kit.cyl(0.018, 0.42, mat.steel, [0, E.pivotY, E.pivotZ], 'x', { seg: 20 }))
  g.add(beam([0, E.pivotY, E.pivotZ], [0, E.pivotY + 0.01, 0.9], 0.07, 0.06, M.coatDark, { r: 0.01 }))

  // Moving parts, one side at a time.
  const sides = [['L', 1], ['R', -1]]
  const phase = ((p.phase ?? 30) * Math.PI) / 180
  for (const [side, s] of sides) {
    const ph = phase + (s < 0 ? Math.PI : 0)
    // The sole on the pedal.
    let sole
    let fwd = new V3(0, 0, 1)
    let up = new V3(0, 1, 0)
    if (ctx && ctx.feet) {
      const f = ctx.feet[side]
      sole = L.pt(f.sole)
      fwd = L.dir(f.forward)
      up = L.dir(f.up)
    } else {
      const z = -0.05 + 0.24 * Math.cos(ph)
      sole = new V3(s * E.pedalX, 0.37 - 0.015 * Math.cos(ph) - 0.075 * Math.sin(ph), z)
    }
    // Arm: from a roller on the ramp, through a point below the pedal, into the drum.
    const rollerZ = 0.63 + (sole.z + 0.05)
    const roller = new V3(s * E.pedalX, rampY(rollerZ) + 0.035, rollerZ)
    const mount = sole.clone().addScaledVector(up, -E.armBelowSole)
    mount.x = s * E.pedalX
    const dir = mount.clone().sub(roller).normalize()
    const rearEnd = roller.clone().addScaledVector(dir, (hz + 0.1 - rollerZ) / dir.z)
    g.add(beam(roller, rearEnd, 0.044, 0.03, M.coatLight, { r: 0.006 }))
    // Roller, on its axle, riding the rail.
    g.add(kit.lathe([[0, -0.016], [0.028, -0.016], [0.035, -0.012], [0.035, 0.012], [0.028, 0.016], [0, 0.016]], M.rubber, [s * E.pedalX, roller.y, roller.z], 'x', 28))
    g.add(kit.cyl(0.012, 0.05, M.alu, [s * E.pedalX, roller.y, roller.z], 'x', { seg: 14 }))
    // Pedal plate on a bracket, carried on the arm, taking the sole's angle.
    const pedal = group()
    const plate = roundPoly([[-0.078, -0.19], [0.078, -0.19], [0.078, 0.19], [-0.078, 0.19]], 0.03, 5)
    pedal.add(slab(plate, 0.022, M.shroudDark, [0, -0.012, 0], { plane: 'xz', bevel: 0.006, bevelSeg: 2 }))
    pedal.add(kit.rbox(0.13, 0.004, 0.34, 0.002, M.rubber, [0, -0.0015, 0], 1))
    for (let i = 0; i < 14; i++) pedal.add(kit.box(0.118, 0.0018, 0.008, M.grip, [0, 0.0012, -0.156 + i * 0.024]))
    // Outer lip keeps the foot in.
    pedal.add(kit.rbox(0.012, 0.03, 0.34, 0.005, M.shroud, [s * 0.078, 0.004, 0], 2))
    pedal.add(kit.rbox(0.05, 0.036, 0.12, 0.006, M.coat, [(s * E.pedalX - sole.x) * 0.5 * 0, -0.04, 0], 2))
    const f = fwd.clone().addScaledVector(up, -fwd.dot(up)).normalize()
    const x = up.clone().cross(f).normalize()
    pedal.quaternion.setFromRotationMatrix(new M4().makeBasis(x, up, f))
    pedal.position.copy(sole)
    g.add(pedal)

    // Moving handle: turns about the pivot, passes through the hand.
    const piv = new V3(s * 0.19, E.pivotY, E.pivotZ)
    let hand
    if (ctx && ctx.hands) hand = L.pt(ctx.hands[side].centre)
    else {
      // Opposite to the foot on the same side.
      const hz = 0.3 + 0.18 * Math.cos(ph)
      hand = new V3(s * 0.3, E.pivotY + Math.sqrt(0.75 * 0.75 - (E.pivotZ - hz) ** 2), hz)
    }
    const toHand = hand.clone().sub(piv).normalize()
    const tip = hand.clone().addScaledVector(toHand, 0.095)
    const below = piv.clone().addScaledVector(toHand, -0.34)
    below.x = s * 0.17
    g.add(pipe([[below.x, below.y, below.z], [piv.x, piv.y, piv.z], [piv.x + (hand.x - piv.x) * 0.45, piv.y + (hand.y - piv.y) * 0.45, piv.z + (hand.z - piv.z) * 0.45], [hand.x, hand.y, hand.z], [tip.x, tip.y, tip.z]], 0.0155, M.coatLight, { bend: 0.05, seg: 14 }))
    // Foam sleeve around the hand.
    const sa = hand.clone().addScaledVector(toHand, -0.13)
    g.add(pipe([[sa.x, sa.y, sa.z], [tip.x, tip.y, tip.z]], 0.0195, M.grip, { bend: 0, seg: 14 }))
    g.add(kit.sphere(0.0195, M.rubberDark, [tip.x, tip.y, tip.z], 14))
    // Bearing at the pivot and link down to the arm.
    g.add(kit.cyl(0.03, 0.05, M.coat, [piv.x, piv.y, piv.z], 'x', { seg: 22 }))
    const armPoint = roller.clone().addScaledVector(dir, 0.12)
    g.add(beam([s * 0.17, below.y, below.z], [s * 0.145, armPoint.y + 0.01, armPoint.z], 0.02, 0.03, M.coat, { r: 0.005 }))
    g.add(kit.cyl(0.016, 0.05, M.alu, [s * 0.145, armPoint.y + 0.01, armPoint.z], 'x', { seg: 14 }))
    g.add(kit.cyl(0.016, 0.05, M.alu, [s * 0.17, below.y, below.z], 'x', { seg: 14 }))
  }
  return g
}

/* ------------------------------------------------------------------------------------------------------------------ *
 * Rowing ergometer
 * ------------------------------------------------------------------------------------------------------------------ */

export const ROWER = {
  railY: (z) => 0.3 + (z + 1.2) * 0.066, // top of the rail
  seatRise: 0.07, // top of the seat above the rail
  seatTop: (z) => 0.3 + (z + 1.2) * 0.066 + 0.07,
  plate: { x: 0.092, y: 0.5, z: 0.62, tilt: 42 },
  chainOut: new V3(0, 0.665, 0.875),
}

function chain(a, b, m = mat.steel) {
  // Roller-free flat chain: link plates along the line, seen as alternating flat and upright links.
  const g = group()
  const A = vec(a)
  const B = vec(b)
  const d = B.clone().sub(A)
  const len = d.length()
  d.normalize()
  const pitch = 0.0127
  const n = Math.max(1, Math.round(len / pitch))
  const link = cachedGeo('chainLink', () => {
    const geo = new THREE.TorusGeometry(0.0065, 0.0018, 8, 14)
    geo.scale(1, 0.72, 1)
    return geo
  })
  const q0 = new Q4().setFromUnitVectors(new V3(1, 0, 0), d)
  const twist = new Q4().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2)
  for (let i = 0; i < n; i++) {
    const o = mesh(link, m)
    o.position.copy(A).addScaledVector(d, ((i + 0.5) / n) * len)
    o.quaternion.copy(q0)
    if (i % 2) o.quaternion.multiply(twist)
    g.add(o)
  }
  return g
}

function rower(p, ctx) {
  const g = group()
  const L = localFrame(p)
  const R = ROWER
  const railZ0 = -1.2
  const railZ1 = 0.72
  // Monorail: an aluminium I-section beam, polished on top where the seat runs.
  const a = [0, R.railY(railZ0) - 0.042, railZ0]
  const b = [0, R.railY(railZ1) - 0.042, railZ1]
  g.add(beam(a, b, 0.076, 0.056, M.aluDark, { r: 0.006 }))
  g.add(beam([0, R.railY(railZ0) - 0.006, railZ0], [0, R.railY(railZ1) - 0.006, railZ1], 0.092, 0.012, M.alu, { r: 0.003 }))
  g.add(beam([0, R.railY(railZ0) - 0.076, railZ0], [0, R.railY(railZ1) - 0.076, railZ1], 0.086, 0.01, M.aluDark, { r: 0.003 }))
  // Rail end stop.
  g.add(place(kit.rbox(0.1, 0.09, 0.03, 0.01, M.rubberDark, [0, 0, 0], 2), [0, R.railY(railZ0) - 0.04, railZ0 - 0.01]))
  // Rear legs.
  const rearLeg = pipe([[-0.3, 0.03, railZ0 + 0.04], [-0.1, R.railY(railZ0) - 0.09, railZ0 + 0.04], [0.1, R.railY(railZ0) - 0.09, railZ0 + 0.04], [0.3, 0.03, railZ0 + 0.04]], 0.024, M.coat, { bend: 0.08, seg: 16, ry: 0.018, up: [0, 0, 1] })
  g.add(rearLeg)
  for (const s of [-1, 1]) g.add(group(rubberFoot(s * 0.3, railZ0 + 0.04, 0.04, 0.032)))

  // Front frame and legs: a box beam rising under the flywheel.
  g.add(beam([0, R.railY(railZ1) - 0.05, railZ1 - 0.06], [0, 0.45, 0.98], 0.1, 0.08, M.coat, { r: 0.01 }))
  g.add(pipe([[-0.3, 0.03, 0.86], [-0.1, 0.27, 0.86], [0.1, 0.27, 0.86], [0.3, 0.03, 0.86]], 0.026, M.coat, { bend: 0.08, seg: 16, ry: 0.02, up: [0, 0, 1] }))
  g.add(beam([0, 0.28, 0.86], [0, 0.4, 0.87], 0.07, 0.05, M.coat, { r: 0.008 }))
  for (const s of [-1, 1]) {
    g.add(rubberFoot(s * 0.3, 0.86, 0.04, 0.032))
    g.add(transportWheel(s * 0.325, 0.036, 0.9, 0.034, 0.02))
  }

  // Flywheel in its housing: a drum with a side cover of spiral vanes around a domed hub, not see-through.
  const fw = new V3(0, 0.56, 1.11)
  const fr = 0.27
  const halfW = 0.1
  const cage = group()
  cage.add(kit.lathe([[0, -halfW], [fr - 0.022, -halfW], [fr - 0.01, -halfW + 0.002], [fr - 0.002, -halfW + 0.012], [fr, -halfW + 0.03], [fr, halfW - 0.03], [fr - 0.002, halfW - 0.012], [fr - 0.01, halfW - 0.002], [fr - 0.022, halfW], [0, halfW]], M.shroud, [0, 0, 0], 'x', 96))
  // Fine ventilation ribs around the drum.
  for (const x of [-0.052, -0.026, 0, 0.026, 0.052]) cage.add(place(kit.torus(fr + 0.0005, 0.0028, M.shroudDark, [0, 0, 0], 'x', 96), [x, 0, 0]))
  const vanes = cachedGeo('rowerVanes', () => {
    const list = []
    const N = 22
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2
      const pts = []
      for (let k = 0; k <= 8; k++) {
        const u = k / 8
        const r = 0.095 + u * (fr - 0.04 - 0.095)
        const a = a0 + u * 0.72
        pts.push([0, r * Math.cos(a), r * Math.sin(a)])
      }
      list.push(sweepGeo(pts, rectSection(0.008, 0.011, 0.002), { up: [1, 0, 0] }))
    }
    return mergeGeos(list)
  })
  for (const s of [-1, 1]) {
    cage.add(kit.lathe([[0, -0.002], [fr - 0.028, -0.002], [fr - 0.028, 0.002], [0, 0.002]], M.rubberDark, [s * (halfW + 0.0005), 0, 0], 'x', 72))
    const v = mesh(vanes, M.shroudLight)
    v.position.x = s * (halfW + 0.002)
    cage.add(v)
    cage.add(latheOut([[0, -0.004], [0.1, -0.004], [0.098, 0.006], [0.08, 0.014], [0.046, 0.019], [0, 0.021]], M.shroud, [s * (halfW + 0.002), 0, 0], s, 48))
    cage.add(latheOut([[0, -0.003], [0.03, -0.003], [0.032, 0], [0.027, 0.004], [0, 0.006]], M.alu, [s * (halfW + 0.02), 0, 0], s, 24))
  }
  place(cage, [fw.x, fw.y, fw.z])
  g.add(cage)
  // Chain tube leaving the cage.
  g.add(beam([0, 0.625, 0.9], [0, 0.695, 0.92], 0.05, 0.05, M.coat, { r: 0.012 }))
  g.add(place(kit.rbox(0.056, 0.03, 0.05, 0.012, M.rubberDark, [0, 0, 0], 2), [0, R.chainOut.y, R.chainOut.z]))

  // Monitor arm and monitor.
  g.add(pipe([[0, 0.42, 0.93], [0, 0.72, 0.965], [0, 1.02, 0.86]], 0.018, M.coat, { bend: 0.12, seg: 16, ry: 0.014, up: [1, 0, 0] }))
  const con = consolePanel({ w: 0.2, h: 0.17, d: 0.05, screen: [0.15, 0.1], wings: false })
  place(con, [0, 1.07, 0.84], [20, 0, 0])
  g.add(con)

  // Foot stretchers: a bracket on the rail carrying two tilted plates with heel cups and straps.
  const { x: px, y: py, z: pz, tilt } = R.plate
  g.add(beam([0, R.railY(pz) + 0.002, pz - 0.02], [0, py - 0.03, pz + 0.05], 0.05, 0.03, M.coat, { r: 0.006 }))
  g.add(beam([-px, py - 0.03, pz + 0.05], [px, py - 0.03, pz + 0.05], 0.03, 0.03, M.coat, { r: 0.006, side: [0, 0, 1] }))
  for (const s of [-1, 1]) {
    const f = group()
    // In its local frame the plate lies flat, toes toward +Z; +Y is the sole's side.
    const outline = roundPoly([[-0.058, -0.15], [0.058, -0.15], [0.052, 0.14], [-0.052, 0.14]], 0.022, 5)
    f.add(slab(outline, 0.012, M.shroudDark, [0, -0.007, 0], { plane: 'xz', bevel: 0.004, bevelSeg: 2 }))
    f.add(slab(roundPoly([[-0.05, -0.13], [0.05, -0.13], [0.046, 0.125], [-0.046, 0.125]], 0.016, 4), 0.003, M.rubber, [0, 0.0005, 0], { plane: 'xz', bevel: 0.001, bevelSeg: 1 }))
    // Heel cup, adjustable: a rounded pocket behind the heel.
    const cupPts = []
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI * (i / 14)
      cupPts.push([0.05 * Math.cos(a), 0.02, -0.095 - 0.03 * Math.sin(a)])
    }
    f.add(mesh(cachedGeo('heelCup', () => sweepGeo(cupPts, rectSection(0.006, 0.04, 0.002))), M.shroud))
    // Strap over the forefoot with its buckle.
    const strapPts = []
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI * (i / 16)
      strapPts.push([0.058 * Math.cos(a), 0.058 * Math.pow(Math.sin(a), 0.72), 0.06])
    }
    f.add(mesh(cachedGeo('rowStrap', () => sweepGeo(strapPts, rectSection(0.035, 0.003, 0.001))), M.grip))
    f.add(kit.rbox(0.03, 0.006, 0.042, 0.002, M.alu, [0.026, 0.05, 0.06], 1))
    place(f, [s * px, py, pz], [-tilt, 0, 0])
    g.add(f)
  }

  // Seat: carriage with rollers on the rail, moulded saddle on top.
  let seatZ = p.seatZ ?? -0.1
  if (ctx && ctx.frames) seatZ = L.pt(ctx.frames.pelvis.pos).z + 0.005
  const seat = group()
  const seatRail = R.railY(seatZ)
  seat.add(kit.rbox(0.13, 0.03, 0.2, 0.01, M.coatDark, [0, 0.03, 0], 2))
  for (const s of [-1, 1]) {
    for (const z of [-0.07, 0.07]) {
      seat.add(kit.lathe([[0, -0.009], [0.015, -0.009], [0.019, -0.006], [0.019, 0.006], [0.015, 0.009], [0, 0.009]], M.rubber, [s * 0.056, 0.019, z], 'x', 18))
    }
  }
  // Moulded seat with two shallow hollows.
  const seatGeo = cachedGeo('rowSeat', () => {
    const rings = []
    const NS = 30
    const NA = 36
    const W = 0.14
    const LL = 0.145
    for (let i = 0; i <= NS; i++) {
      const u = i / NS
      const z = (u - 0.5) * 2 * LL
      const plan = W * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * u - 1), 3.2)), 0.5)
      const ring = []
      for (let j = 0; j < NA; j++) {
        const a = (j / NA) * Math.PI * 2
        const x = Math.cos(a)
        const up = Math.sin(a)
        const xx = plan * Math.sign(x) * Math.pow(Math.abs(x), 0.62)
        const hollow = 0.009 * Math.exp(-(((Math.abs(xx) - 0.058) / 0.045) ** 2)) * Math.exp(-(((z + 0.02) / 0.09) ** 2))
        const yy = up > 0 ? 0.03 * Math.pow(up, 0.5) - hollow * up : up * 0.008
        ring.push([xx, yy * Math.pow(Math.max(0.001, plan / W), 0.4), z])
      }
      rings.push(ring)
    }
    return loftGeo(rings)
  })
  seat.add(mesh(seatGeo, M.pad, [0, 0.04, 0]))
  // Slope with the rail.
  place(seat, [0, seatRail, seatZ], [-Math.atan(0.066) / RAD, 0, 0])
  g.add(seat)

  // Handle and chain.
  let hL
  let hR
  if (ctx && ctx.hands) {
    hL = L.pt(ctx.hands.L.centre)
    hR = L.pt(ctx.hands.R.centre)
  } else {
    hL = new V3(0.14, 0.72, 0.56)
    hR = new V3(-0.14, 0.72, 0.56)
  }
  const mid = hL.clone().add(hR).multiplyScalar(0.5)
  const ax = hL.clone().sub(hR).normalize()
  const e = (d) => mid.clone().addScaledVector(ax, d)
  const barPts = [e(-0.29), e(0.29)]
  g.add(pipe([barPts[0].toArray(), barPts[1].toArray()], 0.0115, mat.chrome, { bend: 0, seg: 14 }))
  for (const s of [-1, 1]) {
    const c1 = e(s * 0.105)
    const c2 = e(s * 0.285)
    g.add(pipe([c1.toArray(), c2.toArray()], 0.0165, M.grip, { bend: 0, seg: 14 }))
    g.add(kit.sphere(0.0172, M.rubberDark, c2.toArray(), 12))
  }
  // Swivel at the middle of the handle, chain back to the cage.
  g.add(kit.sphere(0.02, M.alu, mid.toArray(), 16))
  g.add(chain(mid, R.chainOut))
  return g
}

/* ------------------------------------------------------------------------------------------------------------------ *
 * Stair climber and step mill
 * ------------------------------------------------------------------------------------------------------------------ */

export const CLIMBER = { pivotY: 0.3, pivotZ: 0.52, pedalX: 0.13 }

function stairClimber(p, ctx) {
  const g = group()
  const L = localFrame(p)
  const C = CLIMBER
  // Base: floor rails and cross members in steel.
  for (const s of [-1, 1]) {
    g.add(beam([s * 0.3, 0.045, -0.58], [s * 0.3, 0.045, 0.72], 0.06, 0.05, M.coat, { r: 0.007 }))
    for (const z of [-0.54, 0.68]) g.add(rubberFoot(s * 0.3, z, 0.022, 0.03))
  }
  for (const z of [-0.56, 0.7]) g.add(beam([-0.3, 0.05, z], [0.3, 0.05, z], 0.05, 0.05, M.coat, { side: [0, 0, 1] }))
  // Front tower: the moulded column holding resistance gear, pivot shaft and console.
  const tower = roundPoly(
    [[0.42, 0.05, 0.02], [0.82, 0.05, 0.02], [0.8, 0.62, 0.1], [0.64, 1.32, 0.08], [0.52, 1.32, 0.05], [0.56, 0.68, 0.1], [0.42, 0.42, 0.08]],
    0,
    8,
  )
  g.add(slab(tower, 0.28, M.shroud, [0, 0, 0], { plane: 'zy', bevel: 0.035, bevelSeg: 5 }))
  // Dark inlay on the tower's flanks.
  const inlay = roundPoly([[0.48, 0.11, 0.02], [0.76, 0.11, 0.02], [0.74, 0.56, 0.06], [0.6, 0.66, 0.06], [0.5, 0.42, 0.05]], 0, 5)
  for (const s of [-1, 1]) g.add(slab(inlay, 0.004, M.shroudDark, [s * 0.1405, 0, 0], { plane: 'zy', bevel: 0.0012, bevelSeg: 1 }))
  // Pivot shaft and bearing blocks.
  g.add(kit.cyl(0.02, 0.36, mat.steel, [0, C.pivotY, C.pivotZ], 'x', { seg: 20 }))
  // Console.
  const con = consolePanel({ w: 0.52, h: 0.3, d: 0.08, screen: [0.28, 0.17], wings: true })
  place(con, [0, 1.42, 0.57], [38, 0, 0])
  g.add(con)
  // Hand rails: a one-piece hoop per side, from the tower, back along the user, down to the rear of the base.
  for (const s of [-1, 1]) {
    const rail = [[s * 0.12, 1.2, 0.6], [s * 0.3, 1.14, 0.44], [s * 0.3, 1.1, 0.26], [s * 0.3, 0.98, -0.2], [s * 0.3, 0.72, -0.34], [s * 0.3, 0.07, -0.42]]
    g.add(pipe(rail, 0.0175, mat.chrome, { bend: 0.1, seg: 16 }))
    // Foam section where hands rest.
    const a = [s * 0.3, 1.092, 0.23]
    const b = [s * 0.3, 1.0, -0.13]
    g.add(pipe([a, b], 0.0225, M.grip, { bend: 0, seg: 16 }))
    // Grips under the console.
    g.add(pipe([[s * 0.06, 1.17, 0.54], [s * 0.13, 1.21, 0.46], [s * 0.13, 1.33, 0.36]], 0.0135, M.grip, { bend: 0.03, seg: 12 }))
    // Base shroud that hides the rail's foot.
    g.add(place(kit.rbox(0.07, 0.1, 0.09, 0.016, M.shroudDark, [0, 0, 0], 2), [s * 0.3, 0.09, -0.42]))
  }
  // Pedals.
  const phase = ((p.phase ?? 40) * Math.PI) / 180
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    let sole
    let fwd = new V3(0, 0, 1)
    let up = new V3(0, 1, 0)
    if (ctx && ctx.feet) {
      const f = ctx.feet[side]
      sole = L.pt(f.sole)
      fwd = L.dir(f.forward)
      up = L.dir(f.up)
    } else {
      sole = new V3(s * C.pedalX, 0.35 + s * 0.15 * Math.cos(phase), -0.02)
    }
    const piv = new V3(s * C.pedalX, C.pivotY, C.pivotZ)
    const pedal = group()
    const plate = roundPoly([[-0.085, -0.17], [0.085, -0.17], [0.085, 0.16], [-0.085, 0.16]], 0.022, 5)
    pedal.add(slab(plate, 0.024, M.coatDark, [0, -0.013, 0], { plane: 'xz', bevel: 0.006, bevelSeg: 2 }))
    pedal.add(kit.rbox(0.15, 0.004, 0.3, 0.002, M.rubber, [0, -0.0015, -0.005], 1))
    for (let i = 0; i < 12; i++) pedal.add(kit.box(0.136, 0.0018, 0.009, M.grip, [0, 0.0012, -0.145 + i * 0.0255]))
    const f = fwd.clone().addScaledVector(up, -fwd.dot(up)).normalize()
    const x = up.clone().cross(f).normalize()
    pedal.quaternion.setFromRotationMatrix(new M4().makeBasis(x, up, f))
    pedal.position.copy(sole)
    g.add(pedal)
    // Lever arm from the pivot to the plate's underside, with a parallel link just above it.
    const under = sole.clone().add(new V3(0, -0.035, 0.0))
    under.x = s * C.pedalX
    g.add(beam(piv, under, 0.04, 0.05, M.coatLight, { r: 0.006 }))
    g.add(kit.cyl(0.036, 0.05, M.coat, [piv.x, piv.y, piv.z], 'x', { seg: 24 }))
    g.add(kit.cyl(0.018, 0.055, M.alu, [under.x, under.y, under.z], 'x', { seg: 18 }))
    g.add(beam([s * (C.pedalX + 0.03), C.pivotY + 0.09, C.pivotZ], [s * (C.pedalX + 0.03), sole.y - 0.018, sole.z + 0.11], 0.012, 0.018, M.alu, { r: 0.003 }))
  }
  return g
}

export const STEPMILL = {
  rise: 0.2,
  run: 0.265,
  y0: 0.3, // top of tread 0 at phase 0
  z0: -0.46, // centre of tread 0 at phase 0
  width: 0.58,
  count: 8,
  tread: (k, phase = 0) => {
    const f = phase - Math.floor(phase)
    return { y: 0.3 + (k - f) * 0.2, z: -0.46 + (k - f) * 0.265 }
  },
}

function stepMill(p) {
  const g = group()
  const S = STEPMILL
  const f = (p.phase ?? 0) - Math.floor(p.phase ?? 0)
  // Treads and risers: drawn when inside the window of the machine.
  const treadGeo = cachedGeo('millTread', () => {
    const o = roundPoly([[-S.run / 2 - 0.012, -0.022, 0.006], [S.run / 2, -0.022, 0.002], [S.run / 2, 0, 0.002], [-S.run / 2 - 0.012, 0, 0.012]], 0, 3)
    return slabGeo(o, S.width, { plane: 'zy', bevel: 0.002, bevelSeg: 1 })
  })
  for (let k = -1; k < S.count + 1; k++) {
    const y = S.y0 + (k - f) * S.rise
    const z = S.z0 + (k - f) * S.run
    if (z < -0.72 || z > 0.92) continue
    const step = group()
    step.add(mesh(treadGeo, M.shroudDark))
    // Rubber strips and a light nosing, so each step edge reads against the next.
    step.add(kit.box(S.width - 0.02, 0.0025, 0.016, M.alu, [0, 0.0005, -S.run / 2 + 0.002]))
    for (let i = 0; i < 6; i++) step.add(kit.box(S.width - 0.04, 0.002, 0.016, M.rubber, [0, 0.0008, -S.run / 2 + 0.042 + i * 0.036]))
    // The riser behind the nosing of the step above.
    step.add(kit.box(S.width - 0.004, S.rise - 0.02, 0.007, M.coatDark, [0, S.rise / 2 - 0.005, S.run / 2 - 0.004]))
    for (let i = 0; i < 3; i++) step.add(kit.box(S.width - 0.05, 0.004, 0.0012, M.coat, [0, 0.05 + i * 0.05, S.run / 2 - 0.0085]))
    place(step, [0, y, z])
    g.add(step)
  }
  // Inner dark case behind the stairs, so nothing looks hollow.
  const caseOutline = [[-0.72, 0.04], [-0.72, 0.1], [0.95, 1.36], [1.1, 1.36], [1.1, 0.04]]
  g.add(slab(caseOutline, S.width + 0.01, M.rubberDark, [0, 0, 0], { plane: 'zy', bevel: 0 }))
  // Side panels following the stair line just above the noses, closing into a tall rear tower.
  const sideOutline = roundPoly(
    [[-0.82, 0.02, 0.02], [-0.82, 0.16, 0.05], [-0.62, 0.16, 0.1], [0.72, 1.17, 0.25], [0.72, 1.62, 0.06], [1.2, 1.62, 0.1], [1.26, 0.02, 0.02]],
    0,
    8,
  )
  for (const s of [-1, 1]) {
    const x = s * (S.width / 2 + 0.042)
    g.add(slab(sideOutline, 0.07, M.shroud, [x, 0, 0], { plane: 'zy', bevel: 0.02, bevelSeg: 4 }))
    const inlay = roundPoly([[-0.72, 0.07, 0.01], [-0.72, 0.1, 0.01], [-0.6, 0.1, 0.03], [0.7, 1.08, 0.2], [1.1, 1.08, 0.05], [1.14, 0.07, 0.02]], 0, 5)
    g.add(slab(inlay, 0.003, M.shroudDark, [s * (S.width / 2 + 0.078), 0, 0], { plane: 'zy', bevel: 0.001, bevelSeg: 1 }))
    // Rail with posts.
    const rx = s * 0.335
    const railPts = [[rx, 0.62, -0.72], [rx, 0.98, -0.5], [rx, 1.9, 0.72], [rx, 1.93, 0.78]]
    g.add(pipe(railPts, 0.018, mat.chrome, { bend: 0.1, seg: 16 }))
    g.add(pipe([[rx, 0.35, -0.78], [rx, 0.62, -0.72]], 0.021, M.coat, { bend: 0, seg: 14 }))
    g.add(kit.lathe([[0, -0.04], [0.026, -0.04], [0.026, 0.04], [0, 0.04]], M.shroudDark, [rx, 0.34, -0.78], 'y', 18))
    for (const u of [0.25, 0.7]) {
      const z = -0.5 + u * 1.22
      const y = 0.98 + (z + 0.5) * 0.754
      g.add(pipe([[rx, y - 0.01, z], [rx, 0.3 + (z + 0.62) * 0.74, z - 0.02]], 0.0135, M.coat, { bend: 0, seg: 12 }))
    }
    // Foam along the middle of the rail.
    g.add(pipe([[rx, 1.13, -0.3], [rx, 1.68, 0.43]], 0.0225, M.grip, { bend: 0, seg: 16 }))
  }
  // Roof over the top of the stairs and console mast.
  g.add(kit.rbox(0.72, 0.1, 0.56, 0.03, M.matte, [0, 1.6, 0.97], 3))
  g.add(pipe([[0, 1.62, 0.92], [0, 1.95, 0.8]], 0.05, M.coat, { ry: 0.034, bend: 0, seg: 22, up: [1, 0, 0] }))
  const con = consolePanel({ w: 0.62, h: 0.32, d: 0.08, screen: [0.32, 0.19], wings: true })
  place(con, [0, 2.06, 0.75], [34, 0, 0])
  g.add(con)
  // Cross rail under the console, joining both hand rails.
  g.add(pipe([[-0.335, 1.92, 0.76], [0.335, 1.92, 0.76]], 0.018, mat.chrome, { bend: 0, seg: 16 }))
  // Base.
  for (const s of [-1, 1]) g.add(group(rubberFoot(s * 0.33, -0.76, 0.024, 0.034), rubberFoot(s * 0.33, 1.2, 0.024, 0.034)))
  return g
}

/* ------------------------------------------------------------------------------------------------------------------ *
 * Inline skates, hurdle, cone, agility ladder
 * ------------------------------------------------------------------------------------------------------------------ */

/** Skate wheel with a bearing core, axle along X. */
function skateWheel(z, y, r = 0.04) {
  const w = 0.012
  return group(
    kit.lathe([[r * 0.48, -w], [r * 0.72, -w], [r * 0.92, -w * 0.72], [r, -w * 0.25], [r, w * 0.25], [r * 0.92, w * 0.72], [r * 0.72, w], [r * 0.48, w]], M.shroudLight, [0, y, z], 'x', 36),
    kit.lathe([[0, -w - 0.0005], [r * 0.48, -w - 0.0005], [r * 0.48, w + 0.0005], [0, w + 0.0005]], M.shroudDark, [0, y, z], 'x', 24),
    kit.cyl(0.0055, w * 2 + 0.018, mat.chrome, [0, y, z], 'x', { seg: 12 }),
  )
}

/** Height of the soles above the floor when standing on inline skates. */
export const SKATE_RISE = 0.112

function inlineSkate(p, ctx) {
  const inner = group()
  // Local frame: origin on the sole under the foot's middle, +Z toes, +Y up.
  const bootGeo = cachedGeo('skateBoot', () => {
    const rings = []
    const NS = 34
    const NA = 28
    // Foot runs z -0.1 (heel) to z 0.165 (toes).
    for (let i = 0; i <= NS; i++) {
      const u = i / NS
      const z = -0.122 + u * 0.312
      const end = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * u - 1), 4)), 0.5)
      const hw = (0.054 + 0.012 * Math.sin(Math.PI * sstep(0.1, 0.9, u))) * end
      // The top line: high at the ankle, sloping over the instep to a rounded toe cap.
      const top = (0.082 + 0.09 * (1 - sstep(0.18, 0.62, u)) + 0.008 * Math.sin(Math.PI * sstep(0.62, 1, u))) * Math.pow(end, 0.6)
      const ring = []
      for (let j = 0; j < NA; j++) {
        const a = (j / NA) * Math.PI * 2
        const c = Math.cos(a)
        const s = Math.sin(a)
        const yy = s > 0 ? top * Math.pow(s, 0.72) : -0.014 * end * Math.pow(-s, 0.4)
        ring.push([hw * Math.sign(c) * Math.pow(Math.abs(c), 0.7), yy + 0.002, z])
      }
      rings.push(ring)
    }
    return loftGeo(rings)
  })
  inner.add(mesh(bootGeo, M.shroudDark))
  // Hard sole line and toe bumper, lighter, so the shoe has a readable shape.
  inner.add(mesh(cachedGeo('skateSole', () => slabGeo(roundPoly([[-0.052, -0.12], [0.052, -0.12], [0.066, 0.06], [0.05, 0.178], [-0.05, 0.178], [-0.066, 0.06]], 0.035, 6), 0.012, { plane: 'xz', bevel: 0.004, bevelSeg: 2 })), M.shroud, [0, -0.012, 0]))

  // Frame under the sole: two aluminium plates pierced between the wheels.
  const frameY = -0.018
  const axleY = -0.072
  const wheels = [-0.114, -0.038, 0.038, 0.114].map((z) => z + 0.03)
  const plate = roundPoly(
    [[-0.13, frameY, 0.012], [0.19, frameY, 0.012], [0.19, axleY + 0.012, 0.018], [0.15, axleY - 0.012, 0.012], [-0.09, axleY - 0.012, 0.012], [-0.13, axleY + 0.012, 0.018]],
    0,
    4,
  )
  const cuts = [-0.046, 0.03, 0.106].map((c) => roundPoly([[c - 0.014, frameY - 0.01], [c + 0.052 - 0.014, frameY - 0.01], [c + 0.052 - 0.014, axleY + 0.006], [c - 0.014, axleY + 0.006]], 0.006, 2))
  for (const s of [-1, 1]) inner.add(slab(plate, 0.0045, M.alu, [s * 0.0175, 0, 0], { plane: 'zy', bevel: 0.0012, bevelSeg: 1, holes: cuts }))
  inner.add(kit.rbox(0.042, 0.008, 0.28, 0.003, M.alu, [0, frameY - 0.002, 0.03], 1))
  for (const z of wheels) inner.add(skateWheel(z, axleY))
  // Rubber heel brake, on the right skate only, as on real ones.
  if (p.foot === 'R' || p.brake) {
    inner.add(pipe([[0, frameY - 0.002, -0.1], [0, frameY - 0.012, -0.135], [0, axleY + 0.006, -0.155]], 0.012, M.alu, { bend: 0.02, seg: 12, ry: 0.016 }))
    inner.add(mesh(cachedGeo('skateBrake', () => slabGeo(roundPoly([[-0.135, axleY + 0.01, 0.008], [-0.178, axleY + 0.01, 0.008], [-0.195, axleY - 0.024, 0.008], [-0.15, axleY - 0.03, 0.006]], 0, 3), 0.032, { plane: 'zy', bevel: 0.006, bevelSeg: 2 })), M.rubber))
  }
  // Buckle over the instep and laces.
  const strap = (pts, m = M.rubber, w = 0.022) => mesh(cachedGeo(`skateStrap${w}${keyOf(pts)}`, () => sweepGeo(pts, rectSection(w, 0.0028, 0.001))), m)
  const over = (z, y0, hw, rise) => Array.from({ length: 15 }, (_, i) => {
    const a = Math.PI * (i / 14)
    return [(hw + 0.0035) * Math.cos(a), y0 + rise * Math.pow(Math.sin(a), 0.62), z]
  })
  inner.add(strap(over(0.052, 0.02, 0.062, 0.078), M.grip, 0.024))
  inner.add(kit.rbox(0.024, 0.006, 0.03, 0.002, M.alu, [0.024, 0.094, 0.052], 1))
  for (const z of [0.09, 0.112, 0.134]) inner.add(strap(over(z, 0.03, 0.05, 0.052 - (z - 0.09) * 0.4), M.piping, 0.004))

  // The cuff turns about the ankle to follow the shin.
  const cuffPivot = new V3(0, 0.086, -0.04)
  const cuff = group()
  const cuffGeo = cachedGeo('skateCuff', () => {
    const rings = []
    const NY = 16
    const NA = 28
    for (let i = 0; i <= NY; i++) {
      const u = i / NY
      const y = u * 0.14
      const rx = 0.058 + 0.004 * Math.sin(u * Math.PI)
      const rz = 0.073 - 0.008 * u
      const taper = i === NY ? 0.985 : 1
      const ring = []
      for (let j = 0; j < NA; j++) {
        const a = (j / NA) * Math.PI * 2
        ring.push([rx * taper * Math.cos(a), y, 0.006 - rz * taper * Math.sin(a)])
      }
      rings.push(ring)
    }
    // Close the top with a soft liner roll.
    const last = rings[rings.length - 1]
    rings.push(last.map(([x, y, z]) => [x * 0.86, y + 0.006, z * 0.86]))
    rings.push(last.map(([x, y, z]) => [x * 0.6, y + 0.004, z * 0.6]))
    rings.push(last.map(([x, y, z]) => [x * 0.01, y + 0.002, z * 0.01]))
    return loftGeo(rings)
  })
  cuff.add(mesh(cuffGeo, M.shroud))
  // Cuff strap with a ratchet buckle, and the liner's collar.
  const cuffStrap = Array.from({ length: 29 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2
    return [0.0625 * Math.cos(a), 0.095, 0.006 + 0.0735 * Math.sin(a)]
  })
  cuff.add(mesh(cachedGeo('skateCuffStrap', () => sweepGeo(cuffStrap.slice(0, -1), rectSection(0.003, 0.024, 0.001), { closed: true })), M.grip))
  cuff.add(place(kit.rbox(0.008, 0.016, 0.04, 0.002, M.alu, [0, 0, 0], 1), [0.066, 0.095, 0.03]))
  cuff.add(place(kit.torus(0.062, 0.006, M.grip, [0, 0, 0], 'y', 40), [0, 0.14, 0.004]))
  cuff.position.copy(cuffPivot)
  inner.add(cuff)
  // Cuff hinge rivets.
  for (const s of [-1, 1]) inner.add(bolt([s * 0.064, 0.098, -0.04], 'x', 0.011, M.alu))

  const out = group(inner)
  if (ctx && ctx.feet && p.foot) {
    const side = p.foot
    const f = ctx.feet[side]
    const fwd = vec(f.forward)
    const up = vec(f.up)
    const ff = fwd.clone().addScaledVector(up, -fwd.dot(up)).normalize()
    const x = up.clone().cross(ff).normalize()
    const qFoot = new Q4().setFromRotationMatrix(new M4().makeBasis(x, up, ff))
    inner.quaternion.copy(qFoot)
    inner.position.copy(vec(f.sole))
    // Shin direction in the foot's frame, for the cuff.
    const knee = vec(ctx.joints[`lowerleg01.${side}`])
    const ankle = vec(f.ankle)
    const shin = knee.sub(ankle).normalize().applyQuaternion(qFoot.clone().invert())
    const q = new Q4().setFromUnitVectors(new V3(0, 1, 0), shin)
    // The cuff is stiff: it follows most of the way, and the leg does the rest.
    cuff.quaternion.copy(new Q4().slerp(q, 0.8))
    out.userData.world = true
  } else {
    inner.position.y = SKATE_RISE
  }
  return out
}

function hurdle(p) {
  const h = p.height ?? 0.3
  const w = p.width ?? 0.6
  const g = group()
  const r = 0.0125
  const hx = w / 2
  // One bent tube: legs and bar.
  g.add(pipe([[-hx, 0.016, 0], [-hx, h - r, 0], [hx, h - r, 0], [hx, 0.016, 0]], r, M.shroudLight, { bend: 0.045, seg: 18 }))
  for (const s of [-1, 1]) {
    // Flat runner, with moulded T fitting and rubber end tips.
    g.add(pipe([[s * hx, 0.014, -0.2], [s * hx, 0.014, 0.2]], 0.0125, M.shroudLight, { bend: 0, seg: 16, ry: 0.0125 }))
    g.add(place(kit.rbox(0.034, 0.04, 0.05, 0.008, M.shroudDark, [0, 0, 0], 2), [s * hx, 0.024, 0]))
    for (const z of [-1, 1]) g.add(kit.lathe([[0, -0.014], [0.0145, -0.014], [0.0155, -0.009], [0.0155, 0.009], [0.012, 0.014], [0, 0.015]], M.rubberDark, [s * hx, 0.0155, z * 0.204], 'z', 16))
    // Height clamp on the leg.
    g.add(kit.lathe([[0.012, -0.02], [0.0165, -0.02], [0.0175, -0.016], [0.0175, 0.016], [0.0165, 0.02], [0.012, 0.02]], M.shroudDark, [s * hx, h * 0.55, 0], 'y', 18))
    g.add(place(kit.lathe([[0, 0], [0.005, 0], [0.005, 0.012], [0.011, 0.014], [0.011, 0.024], [0, 0.026]], M.alu, [0, 0, 0], 'y', 14), [s * (hx + 0.015), h * 0.55, 0], [0, 0, -s * 90]))
  }
  return g
}

function cone(p) {
  const h = p.height ?? 0.23
  const base = h * 0.76
  const r = h * 0.2
  const tip = h * 0.06
  const g = group()
  const yb = 0.016
  const body = [[r * 1.02, yb], [r * 0.99, yb + 0.006]]
  const N = 12
  for (let i = 1; i <= N; i++) {
    const u = i / N
    body.push([r + (tip - r) * u + 0.004 * Math.sin(u * Math.PI), yb + (h - yb) * u])
  }
  body.push([tip * 0.82, h + 0.0015], [tip * 0.62, h])
  g.add(kit.lathe(body, M.coneBody, [0, 0, 0], 'y', 48))
  // Hollow top.
  g.add(kit.lathe([[0, h - 0.018], [tip * 0.6, h - 0.018], [tip * 0.62, h + 0.0005]], M.hole, [0, 0, 0], 'y', 28))
  // Base plate with a raised rim, corners rounded.
  const outline = roundPoly([[-base / 2, -base / 2], [base / 2, -base / 2], [base / 2, base / 2], [-base / 2, base / 2]], base * 0.14, 6)
  g.add(slab(outline, 0.016, M.flatLight, [0, 0.008, 0], { plane: 'xz', bevel: 0.0035, bevelSeg: 2 }))
  g.add(kit.lathe([[r * 1.13, 0.0165], [r * 1.09, 0.021], [r * 1.0, 0.022]], M.coneBody, [0, 0, 0], 'y', 48))
  // Reflective band.
  const u0 = 0.44
  const u1 = 0.66
  const at = (u) => r + (tip - r) * u + 0.004 * Math.sin(u * Math.PI) + 0.0006
  g.add(kit.lathe([[at(u0), yb + (h - yb) * u0], [at((u0 + u1) / 2), yb + (h - yb) * ((u0 + u1) / 2)], [at(u1), yb + (h - yb) * u1]], M.coneBand, [0, 0, 0], 'y', 48))
  return g
}

function agilityLadder(p) {
  const n = p.rungs ?? 8
  const sp = p.spacing ?? 0.42
  const w = p.width ?? 0.46
  const g = group()
  const len = (n - 1) * sp + 0.16
  for (const s of [-1, 1]) {
    g.add(kit.rbox(0.032, 0.0025, len, 0.001, M.webbing, [s * w / 2, 0.0015, 0], 1))
    // Stitched loop at the ends.
    for (const e of [-1, 1]) g.add(kit.rbox(0.036, 0.0045, 0.06, 0.001, M.webbing, [s * w / 2, 0.0025, e * (len / 2 - 0.03)], 1))
  }
  for (let i = 0; i < n; i++) {
    const z = (i - (n - 1) / 2) * sp
    const rung = roundPoly([[-w / 2 - 0.024, -0.024], [w / 2 + 0.024, -0.024], [w / 2 + 0.024, 0.024], [-w / 2 - 0.024, 0.024]], 0.012, 4)
    g.add(slab(rung, 0.009, M.flatLight, [0, 0.005, z], { plane: 'xz', bevel: 0.0025, bevelSeg: 2 }))
    for (const s of [-1, 1]) g.add(kit.rbox(0.04, 0.004, 0.034, 0.0015, M.shroudDark, [s * w / 2, 0.0098, z], 1))
  }
  return g
}

export default {
  treadmill,
  'upright-bike': uprightBike,
  'recumbent-bike': recumbentBike,
  'road-bike': roadBike,
  elliptical,
  rower,
  'stair-climber': stairClimber,
  'step-mill': stepMill,
  'inline-skate': inlineSkate,
  hurdle,
  cone,
  'agility-ladder': agilityLadder,
}
