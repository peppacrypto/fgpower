// Free weights: bars, plates, dumbbells, kettlebells, medicine ball, landmine, chains, bands, sandbag and small loaded tools.
// Metres, Y up, real dimensions. Every proof is a spec in specs/_gallery/<name>.json, with the figure really using the thing.
//
// HOW ANY OF THESE IS PLACED (shared by barbell, ez-bar, trap-bar, thick-bar, cambered-bar, dumbbell, kettlebell, sandbag,
// wrist-roller, sledgehammer...). The prop's local X is the bar's axis, local Y its "up", Z = X x Y. Use one of:
//   hands: true     Both hands. Origin = the midpoint of ctx.hands.L/R.centre, X = from the right hand's centre to the left's,
//                   Y = `up` (world) or, by default, from the bar towards the wrists. It sits in the hands in every in-between.
//   hand: 'L'|'R'   One hand. Origin = its centre, X = its thumb direction (`flip: true` reverses it), Y = `up` or towards the wrist.
//   follow: 'chest'|'pelvis'|'head', at: [x,y,z], dir: [x,y,z], up: [x,y,z]   Rides on a body frame, all three in that frame's coordinates.
//   at: [x,y,z], dir, up   World coordinates. Inside a frame's `props` its numbers interpolate: a ball in the air, a bar on the floor.
//   nothing of these       Static: `pos` is the floor under the centre, `yaw` turns it, `height` is where the axis sits (default: it
//                   rests on the floor, see each type). `dir`/`up` tilt it. Bars at yaw 0 run along X, so a user faces +Z.
//   Always: `roll` (deg) turns around local X, `shift` (m) slides along it (a grip off the middle).
//
// BODY FRAMES FOR THIS FIGURE (measured on the mesh, frame coordinates):
//   chest (origin at spine01, Z forward): front of the chest z +0.183 at y +0.03; upper back z -0.04; top of the traps y +0.215, z -0.015.
//   head (origin at the head joint, Z towards the nose): forehead z +0.105 at y +0.07; back of the head z -0.09; top y +0.15.
//   pelvis (origin between the hips, Z forward): top of the hip crease z +0.12, y +0.02.
//
// PLATES: `plates: [20, 10, 5]`, inner to outer, per side. `kind: 'iron'` (default, cast dish, with its weight cast in) or 'bumper'.
//   `collar: 'spring'|'clamp'|'none'`. Sizes: kg -> diameter, thickness.
//     iron    25 .450 .052 | 20 .450 .044 | 15 .400 .040 | 10 .325 .036 | 7.5 .285 .032 | 5 .230 .030 | 2.5 .190 .024 | 1.25 .155 .018
//     bumper  25 .450 .082 | 20 .450 .067 | 15 .450 .053 | 10 .450 .040 | 5 .250 .032 | 2.5 .190 .024 | 1.25 .155 .018
//   A plate-loaded bar on the floor has its axle at the largest plate's radius: 0.225 with 20 or 25 kg, 0.2 with iron 15, 0.1625 with
//   iron 10, 0.115 with iron 5. That is also where the hand centres go to pull it from the floor (hand y = axle y).
//
// barbell   { plates, kind, collar } and the placement above. 20 kg Olympic bar, 2.2 long. Grip radius 0.014.
//   Local x: centre knurl +-0.06, smooth to +-0.21, hand knurl 0.21..0.60 with marks at +-0.405 and +-0.455, collar at +-0.655, plates
//   from +-0.6855, sleeve (radius 0.025) to +-1.10. Static: axle at the plates' radius, or y 0.03 without plates.
//   Hands: deadlift +-0.235 on the bar's line, fingers down, palm back. On the back: gallery chains.json, hands rel "chest" at
//   [+-0.33, 0.215, -0.015], fingers [0.02, 0.97, -0.2], palm [0, 0.2, 0.97]: the bar then lies on the traps in every frame.
//   On the hips (hip thrust): follow 'pelvis', at [0, 0.03, 0.15]. Over the bench: flat-bench's barY and barZ.
// ez-bar    { plates, kind, collar, grip: 'outer'|'inner' } 1.2 long, shaft radius 0.014, collars at +-0.395, sleeves to +-0.6.
//   Its curve lies in the local XY plane, with the central hump towards local +Y, which by default points away from the wrists.
//   Hand centres: outer grip x +-0.2325, inner grip x +-0.10. `hands: true` lands the slope's middle on the hands. For a true fit tilt the
//   thumbs 17 deg (outer) or 33 deg (inner) along the slope: at the bottom of a curl, left hand, fingers [-0.29, -0.96, 0], palm [0, 0, 1];
//   at the top, fingers [-0.29, 0.96, 0], palm [0, 0.1, -1]; right hand mirrored in x. Static: sleeves' axis at the plates' radius.
// trap-bar  { plates, kind, collar } Hexagon, flat sides at x +-0.35, points at z +-0.36, sleeves x 0.366..0.75. The user stands in the
//   middle, feet about pos, facing +Z. Handles run along Z at x +-0.295, 0.065 above the sleeves' axis, knurl z +-0.085, grip radius 0.0155.
//   Hand centres: (+-0.295, axle + 0.065, 0) with axle = plates' radius, so y 0.29 from the floor with 20 kg. Palms in, fingers down.
// thick-bar { plates, kind, collar } 50 mm plain axle, 2.13 long, no knurl, plates from +-0.657. Grip radius 0.025. Like barbell otherwise.
//   (strongman.js has a separate 'axle-bar' that takes a plate count.)
// cambered-bar { plates, kind, collar, style: 'bow'|'squat', camber } 'bow': the middle bows 0.09 towards local +Y (towards the wrists by
//   default, so towards the chest in a bench press or a row), straight from +-0.36; knurl and hands at 0.38..0.60. Grip radius 0.0145.
//   'squat': a straight yoke x +-0.30 at local y 0, knurl 0.05..0.26, sleeves dropping 0.34 at x +-0.655..1.0; `up` defaults to world Y.
// dumbbell  { kg, roll, style: 'hex'|'adjustable', plates, hold: 'goblet', dir } Rubber hex heads, one flat up at roll 0.
//   kg -> across flats, head width: 2.5 .074 .040 | 5 .094 .052 | 10 .118 .085 | 15 .136 .100 | 20 .149 .112 | 30 .171 .130 | 40 .188 .150.
//   Handle 0.13 long between the heads, grip radius 0.0155 (0.0145 up to 7.5 kg, 0.0165 from 30 kg). hand: 'L'|'R' puts the handle's middle on
//   the hand centre, along the thumb. Static: on its flats, axis at af/2, along X at yaw 0. `hold: 'goblet', hands: true`: stands along `dir`
//   (default world Y) with the palms under the upper head, hand centres 0.09 apart; fingers forward, palms up and in.
// kettlebell { kg, mode: 'hang'|'rack'|'horns'|'palm', flip, roll, up } Base on y 0 at rest. Shape by kg (grip height yG, handle radius,
//   total height, horn x, horn y): 8 .198 .0155 .214 .095 .164 | 12 .219 .016 .235 .095 .183 | 16 .237 .0165 .254 .095 .199 |
//   20 .252 .017 .269 .097 .212 | 24 .266 .0175 .284 .101 .224 | 32 .291 .0185 .309 .108 .245. The grip runs along local X, +-0.056 long.
//   'hang' (default): handle in the hand or hands (hand centres +-0.046 for two), ball away from the wrist. The same mode is a swing, a row, a
//   deadlift, and bottoms-up: with the fist above the wrist the ball stands on top. 'rack': hand: 'L'|'R', handle in the hand, ball resting
//   on the back of the forearm, at the shoulder and overhead alike. 'horns': hands: true, hand centres at (+-hornX, hornY), thumbs up, fingers
//   forward, palms in; `up` is world Y. 'palm': hand: 'L'|'R', the base sits on the open palm. A hand on a static kettlebell: (pos.x, yG, pos.z).
// weight-plate { kg, kind, count, normal, up, upright, at, follow } Faces look along local Z, bore in the middle.
//   hands: true, at 3 and 9 o'clock: hand centres on the rim, 2 x (radius - 0.012) apart: 0.426 for 20 or 25 kg, 0.376 for iron 15, 0.301 for iron 10,
//   0.206 for iron 5; grip radius 0.024. The rim runs along the thumbs: fingers around the rim, palms in. `normal` (world) overrides.
//   hand: 'L'|'R': pinched at the rim, hanging along the fingers; palm against the face. `count: 2` is two plates back to back.
//   hold: 'squeeze', hands: true: pressed between the palms (Svend press): palm centres on the faces, at +-(count x t / 2) from the middle, palms towards it.
//   follow: on the chest at [0, 0.03, 0.187 + t/2], normal [0, 0, 1]; on the forehead at [0, 0.07, 0.109 + t/2], normal [0, 0, 1]; behind the
//   head at [0, 0.06, -0.094 - t/2], normal [0, 0, -1]. Static: flat on the floor, or `upright: true` on its rim (bore along Z at yaw 0).
// medicine-ball { kg, r, spinX, spinY, spinZ } Radius 0.1 + 0.0042 kg (6 kg 0.125). hands: true: the centre between the palm centres, so hands at
//   +-r with contact and palms towards the ball. hand: on the open palm, palm up. at, follow, or static on the floor. spin* (deg) turn it.
// landmine  { pos, yaw, plates, kind, collar, hand|hands|at, handle: 'none'|'v'|'jammer', drop, hook } World builder. Base plate 0.48 x 0.38, pivot
//   P = (pos.x, 0.11, pos.z). The bar swings about P through the hand. Lengths along the bar from P: socket 0.30, bar 0.02..2.22, shaft 0.465..1.775,
//   collar 1.775, plates from 1.806, sleeve radius 0.025 to 2.22. Keep the hand at one distance from P in all frames, or it slides along the bar.
//   Bare hand: on the shaft at 1.70..1.75 (radius 0.014), or on the sleeve past the plates at about 1.95 (radius 0.025), the usual press grip.
//   'jammer': sleeve on the bar 0.34 above the hands' midpoint, two arms down to neutral grips at the hands; the bar passes over the head.
//   Without hands: rests with the plates on the floor, along yaw.
// t-bar-row  landmine with handle 'v' by default. Double-D handle: two grips at the hands, thumbs along the bar, hand centres 0.11 apart, radius 0.0165.
//   The bar lies 0.062 (`hook`) towards the wrists from their midpoint. Keep that midpoint about 1.70 from P. Stand over the bar, P behind you.
// chains    { hands|at|anchors|onHands, x: 0.97, length: 1.55, strands: 2, leader: 0.26, base, wire, pitch, width, seed } World builder. x = where on the
//   sleeve (same bar frame as the bar: repeat hands: true). A thin leader ring hangs `leader` below the sleeve, then the heavy chain, `strands` runs side
//   by side, down to a coil on the floor. Links keep their identity: the coil lies still and only feeds out from its top, so a rep looks right.
//   Give `base: [[xL,0,zL],[xR,0,zR]]` (floor under each sleeve) so that the pile does not slide with a bar that moves in z. `leader: 0` drapes it right on the sleeve.
//   `onHands: true`: hooked to a D-handle in each hand (chain press).
// band      A flat closed loop, thinner as it stretches, in width and thickness alike, as sqrt(rest/length). { a, b, width: 0.029, thick: 0.0045, rest: 1.04 } a belt
//   around two anchors, `rest` is half its unstretched length. Anchors: {hand:'L', r, axis} | {foot:'L', at:'sole'|'ball'|'heel', r} (under the sole) |
//   {ankle:'L'} | {knee:'L'} | {thigh:'L'} | {shin:'L'} (around the limb, `along` m up it, `r`) | {sleeve:'L', x} (needs the bar's hands/at on the prop) |
//   {follow:'chest', at, axis, r} | {pos:[x,y,z], axis:[x,y,z], r} (a post, a peg). A bare [x,y,z] is a point. Needs any follow key so it updates: hands: true or follow:'pelvis'.
//   Mini band around the legs: width 0.05, thick 0.0028, rest 0.2. { points: [...], width, thick, rest, flat, double } instead of a,b: an open strap through
//   points (a band across the hips to two dumbbells, around the neck), `flat` is the direction its face looks.
// band-tube { hands: true | hand:'L'|'R', via: [...anchors], radius: 0.0058, rest } A rubber tube with D-handles, grip radius 0.016. via goes from the left hand round to the
//   right: under the feet use [{foot:'L',edge:'out'},{foot:'L',edge:'in'},{foot:'R',edge:'in'},{foot:'R',edge:'out'}]. To a post: hand:'L', via:[{pos:[...]}].
// bar-bands { hands: true (or at, dir), x: 0.95, to: 'floor'|'top'|'feet', y, pegs, pegAxis, pegR, width, thick, rest: 0.52, drawPeg } One loop from each side of the bar: to a floor peg
//   under it (drawn; `pegs: [[x,y,z],[x,y,z]]` fixes them so they don't slide), to `y` overhead for reverse bands, or under the feet. With 'feet' put x inboard of the hands (0.16).
//   Same bar frame as the bar. In a power-rack use its own pegs, x 0.69: reverse bands to: 'top', pegs [[0.6875, 2.18, z], [-0.6875, 2.18, z]]; band-resisted to: 'floor', drawPeg: false, pegs
//   [[0.6875, 0.039, z], [-0.6875, 0.039, z]], with z = rack pos.z +- 0.3 where the bar is.
// sandbag   { length: 0.66, d: 0.32, flat, seed, gripAt } A stuffed canvas bag with two webbing carrying loops on top, along local X. `flat` 1 settled on the floor (default when static, the
//   centre at y 0.106), 0.25 held. `gripAt` is the bag's local point that lands on the hands: hands under its sides on the floor [0,0,0]; bear hug at the chest [0,-0.14,0.09], with hands
//   at the far low side. Keep up: [0,1,0]. Put it in frame props so that `flat` interpolates.
// sledgehammer { hands: true, low: 'L'|'R', endGap: 0.05, length: 0.9, flipHead } The handle runs from the `low` hand towards the other, 0.05 of it below that hand. Thumbs towards the head.
//   hand: 'L'|'R': one hand, the handle along the thumb (crucifix hold).
//   Grip radius 0.0185 on the rubber grip (the first 0.28), 0.0165 above. Head 0.17 x 0.076, its long axis the striking direction, in the plane of the low forearm. Keep the hands 0.1 apart or more.
// wrist-roller { hands: true, kg, drop, ropeLength: 1.15 } Roller radius 0.0195, 0.46 long, hands at +-0.14 (knurl 0.05..0.21). Rope comes off the middle; `drop` = rope hanging, in frame props
//   so it winds up: the coil on the roller grows by what the drop loses. The plate hangs by its bore, face towards the user.
// jump-rope { hands: true, phase, ropeLength: 2.6, forward, radius } In frame props, for `phase`: 0/360 under the feet, 90 in front, 180 overhead, 270 behind. Handles along the thumbs, the cord
//   leaves above the thumb. Grip radius 0.0125. A loop is there and back, so the rope swings and returns.
// neck-harness { follow: 'head', kg, kind, chinDrop: 0.3, drop: 0.14 } Band around the skull, strap over the top, two chains from the temples to a ring below the chin, on to a loading pin with the plate.
// ankle-weight { foot: 'L'|'R', along: 0.088, width: 0.074 } A sewn cuff with strap and ring on the narrowest part of the shin.

import { kit } from './kit.js'

const { THREE, mesh } = kit
const group = (...children) => kit.group(children.flat(Infinity))
const { Vector3: V3, Quaternion: Q4, Matrix4: M4, Euler } = THREE

// ------------------------------------------------------------------------------------------------------------------
// Small tools
// ------------------------------------------------------------------------------------------------------------------
const v = (a) => new V3(a[0], a[1], a[2])
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const lerp = (a, b, t) => a + (b - a) * t
const DEG = Math.PI / 180

const store = new Map()
const memo = (key, make) => {
  let g = store.get(key)
  if (!g) {
    g = make()
    store.set(key, g)
  }
  return g
}

/** Deterministic noise, so that frames of one loop never flicker. */
const rnd = (i, seed = 0) => {
  const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Orientation with local X along x and local Y as close to y as possible. Z = X x Y. */
function frameQ(x, y) {
  const X = x.clone().normalize()
  let Y = y.clone().addScaledVector(X, -y.dot(X))
  if (Y.lengthSq() < 1e-6) {
    Y = new V3(0, 1, 0).addScaledVector(X, -X.y)
    if (Y.lengthSq() < 1e-6) Y = new V3(0, 0, 1).addScaledVector(X, -X.z)
  }
  Y.normalize()
  const Z = X.clone().cross(Y)
  return new Q4().setFromRotationMatrix(new M4().makeBasis(X, Y, Z))
}

/**
 * Where a held or placed thing goes. Returns a world frame {o, q} or null when it is a plain static prop (page.js then
 * applies pos and yaw). Local X runs along the bar, Y is `up`. A bar held in both hands points X from the right hand to the
 * left; `up` defaults to the direction from the bar towards the wrists.
 */
function placement(p, ctx) {
  let o, x, y
  if (p.hands && ctx) {
    const L = ctx.hands.L
    const R = ctx.hands.R
    const cl = v(L.centre)
    const cr = v(R.centre)
    o = cl.clone().add(cr).multiplyScalar(0.5)
    x = cl.clone().sub(cr)
    if (x.lengthSq() < 1e-6) x = v(L.thumb)
    y = p.up ? v(p.up) : v(L.wrist).add(v(R.wrist)).multiplyScalar(0.5).sub(o)
  } else if (p.hand && ctx) {
    const h = ctx.hands[p.hand]
    o = v(h.centre)
    x = v(h.thumb)
    if (p.flip) x.negate()
    y = p.up ? v(p.up) : v(h.wrist).sub(o)
  } else if (p.follow && ctx) {
    const f = ctx.frames[p.follow]
    const q = new Q4(f.quat[0], f.quat[1], f.quat[2], f.quat[3])
    o = v(p.at ?? [0, 0, 0]).applyQuaternion(q).add(v(f.pos))
    x = v(p.dir ?? [1, 0, 0]).applyQuaternion(q)
    y = v(p.up ?? [0, 1, 0]).applyQuaternion(q)
  } else if (p.at) {
    o = v(p.at)
    x = v(p.dir ?? [1, 0, 0])
    y = v(p.up ?? [0, 1, 0])
  } else return null
  return { o, q: frameQ(x, y) }
}

/**
 * Wraps the local assembly in the group page.js expects. `grip` is the local point that must land on the hands (or on `at`);
 * `height` is where the local origin sits above the floor for a plain static prop. `shift` slides along the local X, `roll`
 * turns around it.
 */
function placed(inner, p, ctx, { grip = [0, 0, 0], height = 0 } = {}) {
  const outer = new THREE.Group()
  outer.add(inner)
  const roll = (p.roll || 0) * DEG
  const f = placement(p, ctx)
  if (f) {
    const q = f.q.clone()
    if (roll) q.multiply(new Q4().setFromAxisAngle(new V3(1, 0, 0), roll))
    inner.quaternion.copy(q)
    inner.position.copy(f.o).add(v(grip).negate().applyQuaternion(q))
    if (p.shift) inner.position.add(new V3(p.shift, 0, 0).applyQuaternion(q))
    outer.userData.world = true
  } else {
    inner.position.y = p.height ?? height
    if (p.dir || roll) {
      const q = frameQ(v(p.dir ?? [1, 0, 0]), v(p.up ?? [0, 1, 0]))
      if (roll) q.multiply(new Q4().setFromAxisAngle(new V3(1, 0, 0), roll))
      inner.quaternion.copy(q)
    }
  }
  return outer
}

// ------------------------------------------------------------------------------------------------------------------
// Geometry builders. All of them give analytic normals: hard where the steel is hard, smooth where it is round.
// ------------------------------------------------------------------------------------------------------------------
function makeGeometry(pos, nor, uv, idx) {
  // Winding is derived from the normals, so that no builder can come out inside-out.
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3
    const b = idx[t + 1] * 3
    const c = idx[t + 2] * 3
    const ux = pos[b] - pos[a]
    const uy = pos[b + 1] - pos[a + 1]
    const uz = pos[b + 2] - pos[a + 2]
    const wx = pos[c] - pos[a]
    const wy = pos[c + 1] - pos[a + 1]
    const wz = pos[c + 2] - pos[a + 2]
    const nx = uy * wz - uz * wy
    const ny = uz * wx - ux * wz
    const nz = ux * wy - uy * wx
    if (nx * (nor[a] + nor[b] + nor[c]) + ny * (nor[a + 1] + nor[b + 1] + nor[c + 1]) + nz * (nor[a + 2] + nor[b + 2] + nor[c + 2]) < 0) {
      const k = idx[t + 1]
      idx[t + 1] = idx[t + 2]
      idx[t + 2] = k
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

/**
 * Expands a 2D profile whose corners get real fillets. Flats keep one exact normal, so that they shade flat and only the
 * fillet carries the highlight. Each point is [r, y, cornerRadius]; radius 0 is a hard crease. Travel so that the outside of
 * the surface is on the right of the direction of travel (outward, up the wall, back in).
 */
function expandProfile(points, defaultR, arc, closed) {
  const P = []
  const N = []
  const m = points.length
  const seg = (a, b) => {
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const l = Math.hypot(dx, dy) || 1e-9
    return { dx: dx / l, dy: dy / l, l }
  }
  for (let i = 0; i < m; i++) {
    const p = points[i]
    const isEnd = !closed && (i === 0 || i === m - 1)
    if (isEnd) {
      const s = i === 0 ? seg(p, points[1]) : seg(points[m - 2], p)
      P.push([p[0], p[1]])
      N.push([s.dy, -s.dx])
      continue
    }
    const a = seg(points[(i - 1 + m) % m], p)
    const b = seg(p, points[(i + 1) % m])
    const n1 = [a.dy, -a.dx]
    const n2 = [b.dy, -b.dx]
    const turn = Math.atan2(a.dx * b.dy - a.dy * b.dx, a.dx * b.dx + a.dy * b.dy)
    const rad = p[2] ?? defaultR
    if (Math.abs(turn) < 1e-4) {
      P.push([p[0], p[1]])
      N.push(n1)
      continue
    }
    if (rad <= 0) {
      P.push([p[0], p[1]])
      N.push(n1)
      P.push([p[0], p[1]])
      N.push(n2)
      continue
    }
    const tn = Math.tan(Math.abs(turn) / 2)
    const t = Math.min(rad * tn, a.l * 0.49, b.l * 0.49)
    const rr = t / tn
    const ax = p[0] - a.dx * t
    const ay = p[1] - a.dy * t
    const sign = turn > 0 ? -1 : 1
    const cx = ax + n1[0] * rr * sign
    const cy = ay + n1[1] * rr * sign
    const steps = Math.max(arc, Math.ceil(Math.abs(turn) / (Math.PI / 2) * arc))
    for (let k = 0; k <= steps; k++) {
      const th = (turn * k) / steps
      const nx = n1[0] * Math.cos(th) - n1[1] * Math.sin(th)
      const ny = n1[0] * Math.sin(th) + n1[1] * Math.cos(th)
      P.push([cx - sign * nx * rr, cy - sign * ny * rr])
      N.push([nx, ny])
    }
  }
  if (closed) {
    P.push(P[0].slice())
    N.push(N[0].slice())
  }
  return { P, N }
}

/** A surface of revolution around Y, from a profile as in expandProfile. UV: u around, v along the profile in metres / vScale. */
function revolveGeometry(points, { r = 0, arc = 3, seg = 64, closed = false, vScale = 0, flipUV = false } = {}) {
  const { P, N } = expandProfile(points, r, arc, closed)
  const n = P.length
  const len = [0]
  for (let j = 1; j < n; j++) len.push(len[j - 1] + Math.hypot(P[j][0] - P[j - 1][0], P[j][1] - P[j - 1][1]))
  const total = vScale || len[n - 1] || 1
  const pos = []
  const nor = []
  const uv = []
  const idx = []
  for (let i = 0; i <= seg; i++) {
    const phi = (i / seg) * Math.PI * 2
    const s = Math.sin(phi)
    const c = Math.cos(phi)
    for (let j = 0; j < n; j++) {
      pos.push(P[j][0] * s, P[j][1], P[j][0] * c)
      nor.push(N[j][0] * s, N[j][1], N[j][0] * c)
      if (flipUV) uv.push(1 - i / seg, 1 - len[j] / total)
      else uv.push(i / seg, len[j] / total)
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j
      const b = (i + 1) * n + j
      idx.push(a, b, a + 1, b + 1, a + 1, b)
    }
  }
  return makeGeometry(pos, nor, uv, idx)
}

const AX = { x: new Euler(0, 0, -Math.PI / 2), y: new Euler(0, 0, 0), z: new Euler(Math.PI / 2, 0, 0) }

/** A cached revolved part. `axis` x: the profile's y runs along +X. */
function rev(points, m, { at = [0, 0, 0], axis = 'x', r = 0, arc = 3, seg = 64, closed = false, flipUV = false } = {}) {
  const g = memo(`rev${JSON.stringify(points)}|${r}|${arc}|${seg}|${closed}|${flipUV}`, () => revolveGeometry(points, { r, arc, seg, closed, flipUV }))
  return mesh(g, m, at, AX[axis])
}

/** Sampled points of a polyline with its corners replaced by smooth bends. `bend` is the corner radius, per point or one number. */
function filletPath(points, bend, steps = 8) {
  const pts = points.map((q) => (q.isVector3 ? q.clone() : v(q)))
  const out = [pts[0].clone()]
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]
    const d1 = p.clone().sub(pts[i - 1])
    const d2 = pts[i + 1].clone().sub(p)
    const l1 = d1.length()
    const l2 = d2.length()
    d1.divideScalar(l1)
    d2.divideScalar(l2)
    const ang = d1.angleTo(d2)
    const rad = Array.isArray(bend) ? bend[i] : bend
    const t = Math.min(rad * Math.tan(ang / 2), l1 * 0.49, l2 * 0.49)
    const a = p.clone().addScaledVector(d1, -t)
    const b = p.clone().addScaledVector(d2, t)
    for (let k = 0; k <= steps; k++) {
      const s = k / steps
      out.push(new V3().addScaledVector(a, (1 - s) * (1 - s)).addScaledVector(p, 2 * (1 - s) * s).addScaledVector(b, s * s))
    }
  }
  out.push(pts[pts.length - 1].clone())
  return out
}

/** Round tube along sampled points with rotation-minimising frames. radius: number or f(t), t = 0..1 by length. */
function sweepGeometry(path, radius, { seg = 14, closed = false, caps = true, capRound = 1, pitch = 0 } = {}) {
  const pts = path.map((q) => (q.isVector3 ? q.clone() : v(q)))
  if (closed) pts.push(pts[0].clone())
  const n = pts.length
  const len = [0]
  for (let i = 1; i < n; i++) len.push(len[i - 1] + pts[i].distanceTo(pts[i - 1]))
  const total = len[n - 1] || 1e-6
  const T = []
  for (let i = 0; i < n; i++) {
    let t
    if (closed) {
      const pa = pts[(i - 1 + n - 1) % (n - 1)]
      const pb = pts[(i + 1) % (n - 1)]
      t = pb.clone().sub(pa)
    } else t = pts[Math.min(n - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)])
    T.push(t.normalize())
  }
  const rad = typeof radius === 'function' ? radius : () => radius
  let N0 = new V3(0, 1, 0)
  if (Math.abs(T[0].y) > 0.9) N0 = new V3(1, 0, 0)
  N0.addScaledVector(T[0], -N0.dot(T[0])).normalize()
  const pos = []
  const nor = []
  const uv = []
  const idx = []
  const ring = (c, t, nn, r, along, nScale = 1, tScale = 0, vv = 0) => {
    const b = t.clone().cross(nn)
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      const rx = nn.x * ca + b.x * sa
      const ry = nn.y * ca + b.y * sa
      const rz = nn.z * ca + b.z * sa
      pos.push(c.x + rx * r, c.y + ry * r, c.z + rz * r)
      const nx = rx * nScale + t.x * tScale
      const ny = ry * nScale + t.y * tScale
      const nz = rz * nScale + t.z * tScale
      nor.push(nx, ny, nz)
      uv.push(pitch ? ((j / seg) * 2 * Math.PI * r) / pitch : j / seg, pitch ? vv / pitch : vv / total)
    }
  }
  let rows = 0
  const addCap = (c, t, nn, r, dir, vv) => {
    const steps = 3
    const order = dir < 0 ? [3, 2, 1] : [1, 2, 3]
    for (const k of order) {
      const a = (k / steps) * (Math.PI / 2)
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      ring(c.clone().addScaledVector(t, dir * r * capRound * sa), t, nn, Math.max(r * ca, 1e-5), vv, ca, dir * sa, vv)
      rows++
    }
  }
  let nn = N0
  const frames = []
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const q = new Q4().setFromUnitVectors(T[i - 1], T[i])
      nn = nn.clone().applyQuaternion(q)
      nn.addScaledVector(T[i], -nn.dot(T[i])).normalize()
    }
    frames.push(nn)
  }
  if (caps && !closed) addCap(pts[0], T[0], frames[0], rad(0), -1, 0)
  for (let i = 0; i < n; i++) {
    const r = rad(len[i] / total)
    ring(pts[i], T[i], frames[i], r, len[i], 1, 0, len[i])
    rows++
  }
  if (caps && !closed) addCap(pts[n - 1], T[n - 1], frames[n - 1], rad(1), 1, total)
  const w = seg + 1
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * w + j
      const b = (i + 1) * w + j
      idx.push(a, b, a + 1, b + 1, a + 1, b)
    }
  }
  return makeGeometry(pos, nor, uv, idx)
}

const sweep = (path, radius, m, o) => mesh(sweepGeometry(path, radius, o), m)
const sweepCached = (key, path, radius, m, o) => mesh(memo(`sw${key}`, () => sweepGeometry(path, radius, o)), m)

/**
 * A flat strap along sampled centre points. W gives the unit width direction at each point, width and thick its size, per
 * point or one number. The section is a stadium, so that the edges catch light.
 */
function ribbonGeometry(C, W, width, thick, { closed = false, arc = 3 } = {}) {
  const n = C.length
  const get = (f, i) => (typeof f === 'function' ? f(i) : f)
  const pos = []
  const nor = []
  const uv = []
  const idx = []
  const section = []
  for (let k = 0; k <= arc; k++) section.push([1, -Math.PI / 2 + (Math.PI * k) / arc])
  for (let k = 0; k <= arc; k++) section.push([-1, Math.PI / 2 + (Math.PI * k) / arc])
  const m = section.length
  let along = 0
  const ringCount = closed ? n + 1 : n
  for (let i = 0; i < ringCount; i++) {
    const ii = i % n
    const prev = C[(ii - 1 + n) % n]
    const next = C[(ii + 1) % n]
    const t = (closed ? next.clone().sub(prev) : C[Math.min(n - 1, ii + 1)].clone().sub(C[Math.max(0, ii - 1)])).normalize()
    const w = W[ii].clone().addScaledVector(t, -W[ii].dot(t)).normalize()
    const b = t.clone().cross(w).normalize()
    const hw = get(width, ii) / 2
    const ht = get(thick, ii) / 2
    const u0 = Math.max(0, hw - ht)
    if (i > 0) along += C[ii].distanceTo(C[(ii - 1 + n) % n])
    for (let k = 0; k <= m; k++) {
      const [sgn, th] = section[k % m]
      const nu = Math.cos(th)
      const nv = Math.sin(th)
      const u = sgn * u0 + ht * nu
      const vv = ht * nv
      pos.push(C[ii].x + w.x * u + b.x * vv, C[ii].y + w.y * u + b.y * vv, C[ii].z + w.z * u + b.z * vv)
      nor.push(w.x * nu + b.x * nv, w.y * nu + b.y * nv, w.z * nu + b.z * nv)
      // In weave tiles of 16 mm, so that webbing looks woven at any length.
      uv.push(((k / m) * 2 * (hw + ht)) / 0.016, along / 0.016)
    }
  }
  const row = m + 1
  for (let i = 0; i < ringCount - 1; i++) {
    for (let k = 0; k < m; k++) {
      const a = i * row + k
      const b = (i + 1) * row + k
      idx.push(a, b, a + 1, b + 1, a + 1, b)
    }
  }
  if (!closed) {
    // End faces.
    for (const [ri, dir] of [
      [0, -1],
      [ringCount - 1, 1],
    ]) {
      const ii = ri % n
      const t = C[Math.min(n - 1, ii + 1)].clone().sub(C[Math.max(0, ii - 1)]).normalize()
      const base = pos.length / 3
      for (let k = 0; k < m; k++) {
        const o = (ri * row + k) * 3
        pos.push(pos[o], pos[o + 1], pos[o + 2])
        nor.push(t.x * dir, t.y * dir, t.z * dir)
        uv.push(0, 0)
      }
      for (let k = 1; k < m - 1; k++) idx.push(base, base + k, base + k + 1)
    }
  }
  return makeGeometry(pos, nor, uv, idx)
}

/** Hexagonal prism along X with rounded corners and bevelled ends: a dumbbell head. af is across the flats. */
const hexHeadGeometry = (af, w, rc, bev, cornerSeg = 4) => polyHeadGeometry(6, af, w, rc, bev, cornerSeg)

/** A regular prism along X with n flats, rounded corners and bevelled ends. One flat faces +Y. */
function polyHeadGeometry(sides, af, w, rc, bev, cornerSeg = 4) {
  const ri = af / 2 - rc
  const outline = []
  const stepA = (2 * Math.PI) / sides
  for (let k = 0; k < sides; k++) {
    const a0 = k * stepA + Math.PI / 2
    const corner = a0 + stepA / 2
    const vx = (ri / Math.cos(stepA / 2)) * Math.cos(corner)
    const vy = (ri / Math.cos(stepA / 2)) * Math.sin(corner)
    for (let s = 0; s <= cornerSeg; s++) {
      const a = a0 + (stepA * s) / cornerSeg
      outline.push({ cx: vx, cy: vy, nx: Math.cos(a), ny: Math.sin(a) })
    }
  }
  const m = outline.length
  const rings = []
  const steps = 4
  for (let s = steps; s >= 0; s--) {
    const b = (s / steps) * (Math.PI / 2)
    rings.push({ x: -(w / 2 - bev + bev * Math.sin(b)), ins: bev * (1 - Math.cos(b)), nr: Math.cos(b), nx: -Math.sin(b) })
  }
  for (let s = 0; s <= steps; s++) {
    const b = (s / steps) * (Math.PI / 2)
    rings.push({ x: w / 2 - bev + bev * Math.sin(b), ins: bev * (1 - Math.cos(b)), nr: Math.cos(b), nx: Math.sin(b) })
  }
  const pos = []
  const nor = []
  const uv = []
  const idx = []
  for (const r of rings) {
    for (let k = 0; k <= m; k++) {
      const o = outline[k % m]
      const rad = rc - r.ins
      pos.push(r.x, o.cy + o.ny * rad, o.cx + o.nx * rad)
      nor.push(r.nx, o.ny * r.nr, o.nx * r.nr)
      uv.push(k / m, r.x)
    }
  }
  const row = m + 1
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < m; k++) {
      const a = i * row + k
      const b = (i + 1) * row + k
      idx.push(a, b, a + 1, b + 1, a + 1, b)
    }
  }
  for (const [ri, dir] of [
    [0, -1],
    [rings.length - 1, 1],
  ]) {
    const c = pos.length / 3
    pos.push(rings[ri].x, 0, 0)
    nor.push(dir, 0, 0)
    uv.push(0.5, 0.5)
    for (let k = 0; k < m; k++) {
      const a = ri * row + k
      idx.push(c, a, a + 1)
    }
  }
  return makeGeometry(pos, nor, uv, idx)
}

// ------------------------------------------------------------------------------------------------------------------
// Materials. The shared kit.mat stays untouched: what reads on a black background under a dim light is tuned here.
// ------------------------------------------------------------------------------------------------------------------
const std = (o) => new THREE.MeshStandardMaterial(o)
/**
 * For flat dark faces. A big flat face seen at a low angle mirrors the rim light behind it and flashes white, whatever its colour,
 * so these keep their sheen low at grazing angles.
 */
const lowGlare = (o) => new THREE.MeshPhysicalMaterial({ specularIntensity: 0.4, ...o })

const canvasTex = (key, size, draw, { repeat = true, srgb = false } = {}) =>
  memo(`tex${key}`, () => {
    const c = document.createElement('canvas')
    c.width = Array.isArray(size) ? size[0] : size
    c.height = Array.isArray(size) ? size[1] : size
    draw(c.getContext('2d'), c.width, c.height)
    const t = new THREE.CanvasTexture(c)
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 8
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    return t
  })

/** Diamond knurling. One tile is one diamond, the geometry's UV is in units of `pitch`. */
const knurlTile = (key, lo, hi) =>
  canvasTex(`knurl${key}`, 64, (g, w, h) => {
    g.fillStyle = hi
    g.fillRect(0, 0, w, h)
    g.strokeStyle = lo
    g.lineWidth = 15
    for (const dx of [-w, 0, w]) {
      g.beginPath()
      g.moveTo(dx, 0)
      g.lineTo(dx + w, h)
      g.moveTo(dx, h)
      g.lineTo(dx + w, 0)
      g.stroke()
    }
  })

/** Fine speckle for cast iron and pebbled rubber. */
const speckleTile = (key, n, r0, r1, lo = '#000', base = '#808080', hi = '#fff') =>
  canvasTex(`speck${key}`, 256, (g, w, h) => {
    g.fillStyle = base
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < n; i++) {
      const x = rnd(i, 1) * w
      const y = rnd(i, 2) * h
      const r = lerp(r0, r1, rnd(i, 3))
      g.fillStyle = rnd(i, 4) > 0.5 ? hi : lo
      g.globalAlpha = 0.18 + rnd(i, 5) * 0.3
      for (const ox of [-w, 0, w]) {
        for (const oy of [-h, 0, h]) {
          g.beginPath()
          g.arc(x + ox, y + oy, r, 0, Math.PI * 2)
          g.fill()
        }
      }
    }
    g.globalAlpha = 1
  })

const lazy = (make) => {
  let m
  return () => m || (m = make())
}

/** A plain weave for webbing and canvas. */
const weaveTile = () =>
  canvasTex('weave', 64, (g, w, h) => {
    g.fillStyle = '#777'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        g.fillStyle = (i + j) % 2 ? '#fff' : '#222'
        g.fillRect(i * 8 + 1, j * 8 + 1, 6, 6)
      }
    }
  })

/** The lay of a braided rope: diagonal strands. */
const ropeTile = () =>
  canvasTex('rope', 64, (g, w, h) => {
    g.fillStyle = '#eee'
    g.fillRect(0, 0, w, h)
    g.strokeStyle = '#111'
    g.lineWidth = 7
    for (let dx = -w; dx <= w; dx += w / 2) {
      g.beginPath()
      g.moveTo(dx, 0)
      g.lineTo(dx + w, h)
      g.stroke()
    }
  })

/** A medicine ball: pebbled rubber with sewn panels. map is the colour, the other its bump. */
const ballTex = (bump) =>
  canvasTex(`ball${bump}`, [1024, 512], (g, w, h) => {
    g.fillStyle = bump ? '#a0a0a0' : '#4a4b50'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 26000; i++) {
      const x = rnd(i, 7) * w
      const y = rnd(i, 8) * h
      const r = 0.7 + rnd(i, 9) * 1.1
      g.fillStyle = bump ? (rnd(i, 10) > 0.5 ? '#fff' : '#555') : rnd(i, 10) > 0.5 ? '#54555a' : '#424347'
      g.beginPath()
      g.arc(x, y, r, 0, Math.PI * 2)
      g.fill()
    }
    // Panels: meridians and a band each side of the equator.
    const seam = bump ? '#000' : '#1b1b1d'
    g.strokeStyle = seam
    g.lineWidth = bump ? 7 : 4
    for (let k = 0; k < 6; k++) {
      const x = (k / 6) * w
      g.beginPath()
      g.moveTo(x, h * 0.12)
      g.lineTo(x, h * 0.88)
      g.stroke()
    }
    for (const y of [0.34, 0.66]) {
      g.beginPath()
      g.moveTo(0, y * h)
      g.lineTo(w, y * h)
      g.stroke()
    }
    if (!bump) {
      // The band between them is a lighter grey, so that the ball's turning reads.
      g.globalAlpha = 0.5
      g.fillStyle = '#8b8d92'
      g.fillRect(0, h * 0.34 + 3, w, h * 0.32 - 6)
      g.globalAlpha = 1
    }
    for (const y of [0.1, 0.9]) {
      g.beginPath()
      g.moveTo(0, y * h)
      g.lineTo(w, y * h)
      g.stroke()
    }
  }, { srgb: !bump })

const M = {
  shaft: lazy(() => std({ color: 0xc4c7cb, metalness: 0.86, roughness: 0.3 })),
  sleeve: lazy(() => std({ color: 0xdcdee1, metalness: 0.82, roughness: 0.2 })),
  brushed: lazy(() => std({ color: 0xb6b9be, metalness: 0.82, roughness: 0.42 })),
  knurl: lazy(() =>
    std({
      color: 0xc6c9ce,
      metalness: 0.8,
      roughness: 0.56,
      map: knurlTile('map', '#6c6e72', '#ffffff'),
      bumpMap: knurlTile('bump', '#000000', '#ffffff'),
      bumpScale: 1.1,
    }),
  ),
  iron: lazy(() => {
    const t = speckleTile('iron', 1400, 0.8, 2.6)
    return lowGlare({ color: 0x4e4f54, metalness: 0.42, roughness: 0.5, bumpMap: t, bumpScale: 0.35 })
  }),
  bumper: lazy(() => lowGlare({ color: 0x37383c, metalness: 0, roughness: 0.56 })),
  bumperBand: lazy(() => lowGlare({ color: 0x55575c, metalness: 0, roughness: 0.5 })),
  hub: lazy(() => std({ color: 0xcfd1d5, metalness: 0.85, roughness: 0.24 })),
  springSteel: lazy(() => std({ color: 0xc9ccd0, metalness: 0.85, roughness: 0.3 })),
  hexRubber: lazy(() => lowGlare({ color: 0x3a3b3f, metalness: 0, roughness: 0.5 })),
  hexFace: lazy(() => lowGlare({ color: 0x4a4c50, metalness: 0, roughness: 0.46 })),
  barFrame: lazy(() => std({ color: 0x74777c, metalness: 0.92, roughness: 0.34 })),
  // Flat steel in powder coat: bare metal would flash white whenever a flat face mirrors the studio's top light.
  powder: lazy(() => lowGlare({ color: 0x505257, metalness: 0, roughness: 0.56, specularIntensity: 0.3 })),
  kb: lazy(() => std({ color: 0x45464b, metalness: 0.35, roughness: 0.4 })),
  kbHandle: lazy(() => std({ color: 0x505257, metalness: 0.5, roughness: 0.32 })),
  chain: lazy(() => std({ color: 0xc2c5ca, metalness: 0.88, roughness: 0.34 })),
  band: lazy(() => std({ color: 0x74777e, metalness: 0, roughness: 0.48 })),
  tube: lazy(() => std({ color: 0x6a6d74, metalness: 0, roughness: 0.42 })),
  foam: lazy(() => std({ color: 0x3e3f43, metalness: 0, roughness: 0.82 })),
  nylon: lazy(() => std({ color: 0x55575c, metalness: 0, roughness: 0.78, bumpMap: weaveTile(), bumpScale: 0.6 })),
  canvas: lazy(() => std({ color: 0x505257, metalness: 0, roughness: 0.86, bumpMap: weaveTile(), bumpScale: 0.55 })),
  rope: lazy(() => std({ color: 0x9b9ea3, metalness: 0, roughness: 0.82, bumpMap: ropeTile(), bumpScale: 0.8 })),
  skipRope: lazy(() => std({ color: 0xa2a5aa, metalness: 0.1, roughness: 0.4 })),
  head: lazy(() => std({ color: 0x6f7277, metalness: 0.72, roughness: 0.52 })),
  fibre: lazy(() => std({ color: 0x8a8c90, metalness: 0, roughness: 0.42 })),
  gripRubber: lazy(() => std({ color: 0x34353a, metalness: 0, roughness: 0.66 })),
  leather: lazy(() => std({ color: 0x45464b, metalness: 0, roughness: 0.56 })),
  neoprene: lazy(() => std({ color: 0x48494e, metalness: 0, roughness: 0.74, bumpMap: weaveTile(), bumpScale: 0.5 })),
  ball: lazy(() => std({ color: 0xffffff, metalness: 0, roughness: 0.55, map: ballTex(false), bumpMap: ballTex(true), bumpScale: 1.2 })),
}

// ------------------------------------------------------------------------------------------------------------------
// Plates and bars
// ------------------------------------------------------------------------------------------------------------------
// [diameter, thickness], from the common real sizes: Olympic iron and training bumpers.
const PLATE = {
  iron: { 25: [0.45, 0.052], 20: [0.45, 0.044], 15: [0.4, 0.04], 10: [0.325, 0.036], 7.5: [0.285, 0.032], 5: [0.23, 0.03], 2.5: [0.19, 0.024], 1.25: [0.155, 0.018] },
  bumper: { 25: [0.45, 0.082], 20: [0.45, 0.067], 15: [0.45, 0.053], 10: [0.45, 0.04], 5: [0.25, 0.032], 2.5: [0.19, 0.024], 1.25: [0.155, 0.018] },
}

export function plateSize(kg, kind = 'iron') {
  const table = PLATE[kind] || PLATE.iron
  if (table[kg]) return { d: table[kg][0], t: table[kg][1] }
  // A weight between two sizes takes the nearest one.
  const best = Object.keys(table).map(Number).reduce((a, b) => (Math.abs(b - kg) < Math.abs(a - kg) ? b : a))
  return { d: table[best][0], t: table[best][1] }
}

const BORE = 0.0256

/** The weight cast into a plate's web: a raised, slightly lighter number twice around the ring. No maker's name. */
const plateLetterMat = (kg, rubber = false) =>
  memo(`plMat${kg}|${rubber}`, () => {
    const text = `${kg} KG`
    const paint = (g, w, h, bg, fg, bump) => {
      g.fillStyle = bg
      g.fillRect(0, 0, w, h)
      g.fillStyle = fg
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.font = `bold ${Math.round(h * 0.62)}px Arial, Helvetica, sans-serif`
      if (bump) g.filter = 'blur(2px)'
      for (const u of [0.25, 0.75]) g.fillText(text, u * w, h * 0.52)
      g.filter = 'none'
    }
    const map = canvasTex(`plM${kg}|${rubber}`, [2048, 128], (g, w, h) => paint(g, w, h, rubber ? '#37383c' : '#4e4f54', rubber ? '#6f7176' : '#8d8f94', false), { srgb: true })
    const bump = canvasTex(`plB${kg}`, [2048, 128], (g, w, h) => paint(g, w, h, '#000', '#fff', true))
    return lowGlare({ color: 0xffffff, map, metalness: rubber ? 0 : 0.42, roughness: rubber ? 0.56 : 0.5, bumpMap: bump, bumpScale: 1.4 })
  })

function ironPlateParts(kg) {
  const { d, t } = plateSize(kg, 'iron')
  const R = d / 2
  const hub = Math.min(0.064, R * 0.42)
  const rim = Math.max(0.016, R * 0.125)
  const web = t * 0.5
  const slope = t * 0.22
  const p = [
    [BORE + 0.003, -t / 2, 0.001],
    [hub, -t / 2, 0.002],
    [hub + slope, -web / 2, 0.004],
    [R - rim - slope, -web / 2, 0.004],
    [R - rim, -t / 2, 0.003],
    [R, -t / 2, Math.min(0.008, t * 0.22)],
    [R, t / 2, Math.min(0.008, t * 0.22)],
    [R - rim, t / 2, 0.003],
    [R - rim - slope, web / 2, 0.004],
    [hub + slope, web / 2, 0.004],
    [hub, t / 2, 0.002],
    [BORE + 0.003, t / 2, 0.001],
  ]
  // A raised bead on the web, like the ring cast into real plates.
  const beadR = lerp(hub + slope, R - rim - slope, 0.3)
  const bead = [
    [beadR - 0.003, web / 2 + 0.0001, 0],
    [beadR - 0.002, web / 2 + 0.0015, 0.001],
    [beadR + 0.002, web / 2 + 0.0015, 0.001],
    [beadR + 0.003, web / 2 + 0.0001, 0],
  ]
  const beadB = bead.map(([a, b, c]) => [a, -b, c]).reverse()
  const ringIn = beadR + 0.005
  const ringOut = R - rim - slope - 0.004
  const letters =
    ringOut - ringIn > 0.022
      ? [
          { pts: [[ringOut, web / 2 + 0.0002], [ringIn, web / 2 + 0.0002]], m: plateLetterMat(kg), closed: false, arc: 1, flipUV: true },
          { pts: [[ringIn, -web / 2 - 0.0002], [ringOut, -web / 2 - 0.0002]], m: plateLetterMat(kg), closed: false, arc: 1 },
        ]
      : []
  return [
    { pts: p, m: M.iron(), closed: true, arc: 3 },
    { pts: bead, m: M.iron(), closed: false, arc: 2 },
    { pts: beadB, m: M.iron(), closed: false, arc: 2 },
    ...letters,
    {
      pts: [
        [BORE, -t / 2 - 0.0006, 0.0005],
        [BORE + 0.0085, -t / 2 - 0.0006, 0.0008],
        [BORE + 0.0085, t / 2 + 0.0006, 0.0008],
        [BORE, t / 2 + 0.0006, 0.0005],
      ],
      m: M.hub(),
      closed: true,
      arc: 2,
    },
  ]
}

function bumperPlateParts(kg) {
  const { d, t } = plateSize(kg, 'bumper')
  const R = d / 2
  const insert = 0.046
  const face = R * 0.72
  const p = [
    [insert, -t / 2 + 0.0015, 0.001],
    [face, -t / 2 + 0.0015, 0.004],
    [face + 0.006, -t / 2, 0.003],
    [R - 0.002, -t / 2, 0.01],
    [R, -t * 0.25, 0.02],
    [R, t * 0.25, 0.02],
    [R - 0.002, t / 2, 0.01],
    [face + 0.006, t / 2, 0.003],
    [face, t / 2 - 0.0015, 0.004],
    [insert, t / 2 - 0.0015, 0.001],
  ]
  const band = (s) => [
    [face + 0.008, s * (t / 2 + 0.0002), 0],
    [R - 0.014, s * (t / 2 + 0.0002), 0],
  ]
  const y = t / 2 - 0.0015 + 0.0002
  const ringIn = insert + 0.012
  const ringOut = face - 0.006
  const letters =
    ringOut - ringIn > 0.022
      ? [
          { pts: [[ringOut, y], [ringIn, y]], m: plateLetterMat(kg, true), closed: false, arc: 1, flipUV: true },
          { pts: [[ringIn, -y], [ringOut, -y]], m: plateLetterMat(kg, true), closed: false, arc: 1 },
        ]
      : []
  return [
    { pts: p, m: M.bumper(), closed: true, arc: 4 },
    { pts: band(1).reverse(), m: M.bumperBand(), closed: false, arc: 1 },
    { pts: band(-1), m: M.bumperBand(), closed: false, arc: 1 },
    ...letters,
    {
      pts: [
        [BORE, -t / 2, 0.0008],
        [insert + 0.001, -t / 2, 0.0015],
        [insert + 0.001, t / 2, 0.0015],
        [BORE, t / 2, 0.0008],
      ],
      m: M.hub(),
      closed: true,
      arc: 2,
    },
  ]
}

/** One plate with its bore along local X (local Y axis of the profile becomes X), centred on x. */
function plateMesh(kg, kind, x = 0) {
  const parts = kind === 'bumper' ? bumperPlateParts(kg) : ironPlateParts(kg)
  return group(parts.map((q) => rev(q.pts, q.m, { at: [x, 0, 0], closed: q.closed, arc: q.arc, seg: 96, flipUV: q.flipUV })))
}

function springCollar(x) {
  // A real spring clip: steel coil around the sleeve, two bent squeeze handles.
  const R = 0.0278
  const r = 0.0021
  const turns = 5
  const w = 0.021
  const m = M.springSteel()
  const coil = sweepCached(
    `spring`,
    (() => {
      const pts = []
      const n = turns * 24
      for (let i = 0; i <= n; i++) {
        const a = (i / 24) * Math.PI * 2
        pts.push(new V3((i / n) * w, Math.cos(a) * R, Math.sin(a) * R))
      }
      return pts
    })(),
    r,
    m,
    { seg: 6 },
  )
  const handle = (s, x0) =>
    sweepCached(
      `springH${s}`,
      filletPath(
        [
          [x0, R, 0],
          [x0, R + 0.012, 0.006 * s],
          [x0, R + 0.042, 0.02 * s],
          [x0, R + 0.056, 0.015 * s],
          [x0, R + 0.05, 0.004 * s],
        ],
        0.008,
        6,
      ),
      r * 1.15,
      m,
      { seg: 6 },
    )
  const g = group(coil, handle(1, 0), handle(-1, w))
  g.position.x = x
  return g
}

function clampCollar(x) {
  // A lever-lock collar: a hard ring with a steel hinge and a flat lever.
  const w = 0.034
  const R = 0.042
  const body = rev(
    [
      [0.0252, 0],
      [R, 0, 0.004],
      [R, w, 0.004],
      [0.0252, w],
    ],
    M.hexRubber(),
    { at: [x, 0, 0], arc: 3, seg: 48 },
  )
  const groove = rev(
    [
      [R + 0.0003, w * 0.34],
      [R + 0.0003, w * 0.66],
    ],
    M.brushed(),
    { at: [x, 0, 0], seg: 48 },
  )
  const lever = kit.rbox(0.016, 0.006, 0.07, 0.002, M.brushed(), [x + w / 2, R + 0.006, 0.012])
  const pin = kit.cyl(0.0035, w + 0.004, M.hub(), [x + w / 2, R, -0.022], 'x', { seg: 10 })
  return group(body, groove, lever, pin)
}

/** Loads a sleeve along +X from x0: plates in the order given, then the collar. Returns the group and the free end x. */
function loadSleeve(x0, plates, kind, collar) {
  const parts = []
  let x = x0
  plates.forEach((kg, i) => {
    const { t } = plateSize(kg, kind)
    const pm = plateMesh(kg, kind, x + t / 2 + (kind === 'iron' ? 0.0006 : 0))
    pm.rotation.x = 0.7 + i * 2.1
    parts.push(pm)
    x += t + (kind === 'iron' ? 0.0012 : 0)
  })
  if (plates.length && collar !== 'none') {
    const c = collar || (kind === 'bumper' ? 'clamp' : 'spring')
    parts.push(c === 'clamp' ? clampCollar(x + 0.001) : springCollar(x + 0.002))
    x += c === 'clamp' ? 0.036 : 0.024
  }
  return { g: group(parts), end: x }
}

const maxPlateR = (plates, kind) => plates.reduce((a, kg) => Math.max(a, plateSize(kg, kind).d / 2), 0)

/** A cylinder along X in real knurl scale. The UV is in diamonds, so that all bars share one material. */
function knurlCyl(r, x0, x1, pitch = 0.0034) {
  const len = x1 - x0
  const g = memo(`kn${r}|${len}|${pitch}`, () => {
    const c = new THREE.CylinderGeometry(r, r, len, 28, 1, true)
    const uv = c.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, Math.round((Math.PI * 2 * r) / pitch) * uv.getX(i), (len / pitch) * uv.getY(i))
    return c
  })
  return mesh(g, M.knurl(), [(x0 + x1) / 2, 0, 0], AX.x)
}

function plainCyl(r, x0, x1, m, seg = 28) {
  const len = x1 - x0
  const g = memo(`pc${r}|${len}|${seg}`, () => new THREE.CylinderGeometry(r, r, len, seg, 1, false))
  return mesh(g, m, [(x0 + x1) / 2, 0, 0], AX.x)
}

/** The rotating sleeve of a bar, from x0 (where the shaft enters it) to x1 (the open end). Along +X. */
function barSleeve(x0, x1, { rShaft = 0.014, R = 0.025, flange = 0.0305, flangeW = 0.028 } = {}) {
  const body = [
    [rShaft, x0, 0],
    [flange, x0, 0.0025],
    [flange, x0 + flangeW * 0.7, 0.002],
    [flange - 0.003, x0 + flangeW * 0.72, 0.0008],
    [flange - 0.003, x0 + flangeW, 0.0015],
    [R, x0 + flangeW + 0.0005, 0.0015],
    [R, x1 - 0.0035, 0.0025],
    [R - 0.0012, x1, 0.0012],
    [0.0165, x1, 0.001],
    [0.0165, x1 - 0.0012, 0.0004],
    [0, x1 - 0.0012],
  ]
  const end = [
    [0, x1 - 0.0005],
    [0.0088, x1 - 0.0005, 0.0006],
    [0.0092, x1 + 0.0014, 0.0005],
    [0, x1 + 0.0014],
  ].reverse()
  return group(rev(body, M.sleeve(), { arc: 3, seg: 48 }), rev(end, M.brushed(), { arc: 2, seg: 24 }))
}

/** Both sides of a bar. `make(side)` builds the +X side; side is 1, or -1 for the copy turned to the other end. */
function bothSides(make) {
  const a = make(1)
  const b = make(-1)
  b.rotation.y = Math.PI
  return group(a, b)
}

/**
 * Plates ride on rotating sleeves: while a bent bar turns in the hands they keep hanging true, their lettering upright.
 * Returns f(side), the turn to give a side's load around the bar.
 */
function hangingTurn(p, ctx) {
  const f = placement(p, ctx)
  if (!f) return () => 0
  const u = new V3(0, 1, 0).applyQuaternion(f.q.clone().invert())
  return (side) => Math.atan2(side * u.z, u.y)
}

function olympicShaft() {
  const r = 0.014
  const m = M.shaft()
  return group(
    plainCyl(r, -0.656, 0.656, m),
    knurlCyl(r + 0.00006, -0.06, 0.06),
    // The hand zones, with the two smooth rings that mark grip width (powerlifting 0.81 m, weightlifting 0.91 m apart).
    [1, -1].map((s) => {
      const z = [
        [0.21, 0.4035],
        [0.4065, 0.4535],
        [0.4565, 0.6],
      ]
      return z.map(([a, b]) => (s > 0 ? knurlCyl(r + 0.00006, a, b) : knurlCyl(r + 0.00006, -b, -a)))
    }),
  )
}

// ------------------------------------------------------------------------------------------------------------------
// Other bars
// ------------------------------------------------------------------------------------------------------------------
/** A knurled length of a bent tube: the sampled part of a path between two lengths along it. */
function pathPart(path, a, b) {
  const out = []
  let s = 0
  for (let i = 0; i < path.length - 1; i++) {
    const p = path[i]
    const q = path[i + 1]
    const l = p.distanceTo(q)
    const s0 = s
    const s1 = s + l
    if (s1 >= a && s0 <= b) {
      const ta = clamp((a - s0) / l, 0, 1)
      const tb = clamp((b - s0) / l, 0, 1)
      if (!out.length) out.push(p.clone().lerp(q, ta))
      out.push(p.clone().lerp(q, tb))
    }
    s = s1
  }
  return out
}

const pathLength = (path) => {
  let s = 0
  for (let i = 0; i < path.length - 1; i++) s += path[i].distanceTo(path[i + 1])
  return s
}

// The EZ curve in the bar's own plane: [x, y] of the left half, y towards the central hump. Hands go on the slopes.
const EZ = { collar: 0.395, end: 0.6, r: 0.014, pts: [[0.395, 0], [0.3, 0], [0.165, -0.042], [0.035, 0.042]], outer: [0.2325, -0.021], inner: [0.1, 0] }

// The hex frame of a trap bar, in its own plane. Handles at x = +-HEX.hx, raised HEX.rise above the frame.
const HEX = { sx: 0.35, sz: 0.19, az: 0.36, hx: 0.295, hz: 0.125, rise: 0.065, r: 0.0165, sleeve0: 0.366, sleeve1: 0.75 }

function dumbbellSize(kg) {
  // Across the flats and head width of real rubber hex dumbbells (kg, af, w).
  const T = [[1, 0.056, 0.026], [2.5, 0.074, 0.04], [5, 0.094, 0.052], [7.5, 0.108, 0.07], [10, 0.118, 0.085], [15, 0.136, 0.1], [20, 0.149, 0.112], [25, 0.161, 0.122], [30, 0.171, 0.13], [40, 0.188, 0.15], [50, 0.203, 0.16], [60, 0.216, 0.17]]
  let a = T[0]
  let b = T[T.length - 1]
  for (let i = 0; i < T.length - 1; i++) {
    if (kg >= T[i][0] && kg <= T[i + 1][0]) {
      a = T[i]
      b = T[i + 1]
      break
    }
  }
  const t = b[0] === a[0] ? 0 : clamp((kg - a[0]) / (b[0] - a[0]), 0, 1)
  return { af: lerp(a[1], b[1], t), w: lerp(a[2], b[2], t), r: kg >= 30 ? 0.0165 : kg <= 7.5 ? 0.0145 : 0.0155, handle: kg <= 5 ? 0.122 : 0.13 }
}

function dumbbellAssembly(kg) {
  const { af, w, r, handle } = dumbbellSize(kg)
  const hl = handle / 2
  const rc = Math.min(0.012, af * 0.09)
  const bev = Math.min(0.009, af * 0.07)
  const headG = memo(`hex${af.toFixed(4)}|${w.toFixed(4)}|${rc}|${bev}`, () => hexHeadGeometry(af, w, rc, bev))
  const side = () => {
    const hx = hl + w / 2
    const ferrule = rev(
      [
        [r, hl - 0.013, 0],
        [r + 0.0012, hl - 0.012, 0.001],
        [r + 0.006, hl - 0.004, 0.003],
        [r + 0.0075, hl - 0.0005, 0.0012],
        [r + 0.0075, hl + 0.002],
      ],
      M.sleeve(),
      { arc: 2, seg: 32 },
    )
    const head = mesh(headG, M.hexRubber(), [hx, 0, 0])
    // The outer face: a shallow recessed disc with a turned steel plug, the way the heads are cast.
    const fr = af * 0.34
    const face = rev(
      [
        [0, hl + w + 0.0004],
        [fr - 0.003, hl + w + 0.0004, 0],
        [fr - 0.001, hl + w + 0.0016, 0.0008],
        [fr + 0.002, hl + w + 0.0016, 0.0008],
        [fr + 0.004, hl + w + 0.0001, 0],
      ].reverse(),
      M.hexFace(),
      { arc: 2, seg: 40 },
    )
    return group(ferrule, head, face)
  }
  return group(
    plainCyl(r, -hl - 0.002, hl + 0.002, M.sleeve()),
    knurlCyl(r + 0.00006, -hl + 0.016, hl - 0.016, 0.0032),
    [hl - 0.016, -hl + 0.016].map((x) => rev([[r + 0.0002, x - 0.0012], [r + 0.0007, x - 0.0004, 0.0003], [r + 0.0007, x + 0.0004, 0.0003], [r + 0.0002, x + 0.0012]], M.hub(), { arc: 1, seg: 28 })),
    bothSides(side),
  )
}

/** A spin-lock dumbbell: threaded chrome handle, small plates, spin-lock collars. */
function adjustableDumbbell(plates) {
  const r = 0.0145
  const hl = 0.065
  const end = hl + 0.15
  const side = () => {
    const { g, end: e } = loadSleeve(hl + 0.006, plates, 'iron', 'none')
    const nut = rev([[r + 0.0005, e + 0.0005], [0.027, e + 0.0005, 0.002], [0.029, e + 0.012, 0.002], [0.024, e + 0.024, 0.003], [r + 0.0005, e + 0.024]], M.brushed(), { arc: 2, seg: 24 })
    const stop = rev([[r, hl], [0.026, hl, 0.0015], [0.026, hl + 0.006, 0.0015], [r, hl + 0.006]], M.sleeve(), { arc: 2, seg: 24 })
    return group(g, nut, stop, plainCyl(0.0125, hl, end, M.brushed(), 20))
  }
  return group(plainCyl(r, -hl, hl, M.sleeve()), knurlCyl(r + 0.00006, -hl + 0.008, hl - 0.008, 0.0032), bothSides(side))
}

// ------------------------------------------------------------------------------------------------------------------
// Kettlebell
// ------------------------------------------------------------------------------------------------------------------
function kbShape(kg) {
  const R = 0.0358 * Math.cbrt(kg)
  const rb = 0.62 * R
  const yc = Math.sqrt(R * R - rb * rb)
  const rG = lerp(0.0155, 0.0195, clamp((kg - 8) / 32, 0, 1))
  const window = 0.05 + 0.0006 * kg
  const yG = yc + R + window + rG
  const gh = Math.max(0.056, 0.6 * R)
  const xh = gh + 0.034 + rG * 0.3
  const hornY = lerp(yc + R * 0.72, yG, 0.62)
  return { R, rb, yc, rG, yG, gh, xh, hornY, H: yG + rG }
}

function kbBodyGeometry(s) {
  const { R, rb, yc } = s
  const P = []
  const N = []
  const fil = 0.009
  P.push([0, 0], [rb - fil * 0.8, 0])
  N.push([0, -1], [0, -1])
  const a0 = Math.asin(-yc / R)
  const steps = 42
  const a1 = a0 + (fil / R) * 1.2
  const ax = R * Math.cos(a1)
  const ay = yc + R * Math.sin(a1)
  for (let k = 1; k <= 3; k++) {
    const t = k / 4
    const nr = lerp(0, Math.cos(a1), t)
    const ny = lerp(-1, Math.sin(a1), t)
    const l = Math.hypot(nr, ny)
    P.push([lerp(rb - fil * 0.8, ax, t), lerp(0, ay, t * t)])
    N.push([nr / l, ny / l])
  }
  for (let k = 0; k <= steps; k++) {
    const a = lerp(a1, Math.PI / 2, k / steps)
    P.push([R * Math.cos(a), yc + R * Math.sin(a)])
    N.push([Math.cos(a), Math.sin(a)])
  }
  const seg = 72
  const n = P.length
  const pos = []
  const nor = []
  const uv = []
  const idx = []
  for (let i = 0; i <= seg; i++) {
    const phi = (i / seg) * Math.PI * 2
    const sn = Math.sin(phi)
    const cs = Math.cos(phi)
    for (let j = 0; j < n; j++) {
      pos.push(P[j][0] * sn, P[j][1], P[j][0] * cs)
      nor.push(N[j][0] * sn, N[j][1], N[j][0] * cs)
      uv.push(i / seg, j / (n - 1))
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j
      const b = (i + 1) * n + j
      idx.push(a, b, a + 1, b + 1, a + 1, b)
    }
  }
  return makeGeometry(pos, nor, uv, idx)
}

function kettlebellAssembly(kg) {
  const s = kbShape(kg)
  const { R, yc, rG, yG, gh, xh } = s
  const body = mesh(memo(`kbb${kg}`, () => kbBodyGeometry(s)), M.kb())
  const handle = mesh(
    memo(`kbh${kg}`, () => {
      const xa = R * 0.74
      const ya = yc + Math.sqrt(R * R - xa * xa)
      const half = [
        [xa * 0.72, ya - 0.022],
        [xa * 0.98, ya + 0.004],
        [lerp(xa, xh, 0.72), lerp(ya, yG, 0.36)],
        [xh, lerp(ya, yG, 0.66)],
        [xh - 0.005, yG - 0.018],
        [gh + 0.014, yG - 0.002],
        [gh - 0.012, yG],
        [gh * 0.4, yG],
      ]
      const pts = [...half.map(([x, y]) => new V3(x, y, 0)), ...half.slice().reverse().map(([x, y]) => new V3(-x, y, 0))]
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5)
      const path = curve.getSpacedPoints(120)
      const smooth = (e0, e1, x) => {
        const t = clamp((x - e0) / (e1 - e0), 0, 1)
        return t * t * (3 - 2 * t)
      }
      const rad = (t) => rG * (1 + 0.62 * (1 - smooth(0.02, 0.19, Math.min(t, 1 - t))) + 0.08 * (1 - smooth(0.19, 0.3, Math.min(t, 1 - t))))
      return sweepGeometry(path, rad, { seg: 18, caps: false })
    }),
    M.kbHandle(),
  )
  // The casting seam: a faint raised line in the plane of the handle.
  const seam = mesh(
    memo(`kbs${kg}`, () => {
      const pts = []
      const a0 = Math.asin(-yc / R) + 0.1
      for (let k = 0; k <= 40; k++) {
        const a = lerp(a0, 0.86, k / 40)
        pts.push(new V3(0, yc + R * Math.sin(a), R * Math.cos(a)))
      }
      return sweepGeometry(pts, 0.0011, { seg: 5 })
    }),
    M.kb(),
  )
  const seamB = seam.clone()
  seamB.rotation.y = Math.PI
  return group(body, handle, seam, seamB)
}

// ------------------------------------------------------------------------------------------------------------------
// Chains
// ------------------------------------------------------------------------------------------------------------------
function linkGeometry(pitch, width, wire) {
  return memo(`link${pitch}|${width}|${wire}`, () => {
    const L = pitch + wire // length of the stadium centreline, end to end
    const W = width - wire
    const pr = W / 2
    const sx = L / 2 - pr
    const pts = []
    const arc = 7
    for (let i = 0; i <= arc; i++) {
      const a = -Math.PI / 2 + (i / arc) * Math.PI
      pts.push(new V3(sx + pr * Math.cos(a), pr * Math.sin(a), 0))
    }
    for (let i = 0; i <= arc; i++) {
      const a = Math.PI / 2 + (i / arc) * Math.PI
      pts.push(new V3(-sx + pr * Math.cos(a), pr * Math.sin(a), 0))
    }
    return sweepGeometry(pts, wire / 2, { seg: 7, closed: true, caps: false })
  })
}

/** Lays the chain's slack on the floor: a loose coil that grows upward, from the free end. Arc length table per seed. */
function coilTable(seed, wire, width, total) {
  return memo(`coil${seed}|${wire}|${width}|${total}`, () => {
    const pts = []
    const ds = 0.006
    const n = Math.ceil(total / ds) + 2
    let th = seed * 2.399
    let s = 0
    let last = null
    for (let i = 0; i < n * 4 && s < total + 0.1; i++) {
      const rho = 0.075 + 0.028 * Math.sin(th * 0.37 + seed) + 0.012 * Math.sin(th * 1.31 + seed * 2)
      const cx = 0.024 * Math.cos(th * 0.21 + seed)
      const cz = 0.024 * Math.sin(th * 0.27 + seed)
      const layer = th - seed * 2.399
      const y = (layer / (Math.PI * 2)) * (width * 0.72)
      const p = new V3(cx + rho * Math.cos(th), y, cz + rho * Math.sin(th))
      if (last) s += p.distanceTo(last)
      pts.push({ p, s })
      last = p
      th += ds / rho
    }
    return pts
  })
}

const atLength = (table, s) => {
  let lo = 0
  let hi = table.length - 1
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1
    if (table[m].s < s) lo = m
    else hi = m
  }
  const a = table[lo]
  const b = table[hi]
  const t = b.s > a.s ? clamp((s - a.s) / (b.s - a.s), 0, 1) : 0
  return a.p.clone().lerp(b.p, t)
}

/**
 * One run of chain from a hook at `top` down to a pile around floor point `base`. The tail end lies still: links only leave
 * the pile from its top as the hook rises, and link i is always the same link, so that a loop shows the chain lifting.
 */
function chainRun(top, base, length, { pitch, width, wire, seed }) {
  const geo = linkGeometry(pitch, width, wire)
  const m = M.chain()
  const out = []
  const table = coilTable(seed, wire, width, length)
  const lift = (w) => w * 0.36 + wire / 2
  const count = Math.round(length / pitch)
  const floorPoint = (s) => atLength(table, s).add(new V3(base.x, lift(width), base.z))
  // Hanging part: straight down from the hook, then leaning towards where the chain leaves the pile.
  const hangTo = (p) => {
    const knee = new V3(top.x, Math.min(top.y, p.y + Math.max(0.09, (top.y - p.y) * 0.22)), top.z)
    return { knee, len: top.distanceTo(knee) + knee.distanceTo(p) }
  }
  let lo = 0
  let hi = length
  if (top.y - lift(width) >= length) hi = 0
  for (let i = 0; i < 26; i++) {
    const s = (lo + hi) / 2
    const f = s + hangTo(floorPoint(s)).len
    if (f > length) hi = s
    else lo = s
  }
  const sLift = (lo + hi) / 2
  const pl = floorPoint(sLift)
  const { knee } = hangTo(pl)
  const hangLen = top.distanceTo(knee) + knee.distanceTo(pl)
  const c = new V3()
  for (let i = 0; i < count; i++) {
    const s = (i + 0.5) * pitch
    let t
    let w
    if (s <= sLift) {
      c.copy(floorPoint(s))
      t = floorPoint(s + 0.012).sub(floorPoint(Math.max(0, s - 0.012))).normalize()
      const flat = new V3(0, 1, 0).cross(t).normalize()
      const tilt = (i % 2 ? 1 : -1) * (36 + 16 * rnd(i, seed)) * DEG
      w = flat.clone().multiplyScalar(Math.cos(tilt)).add(new V3(0, Math.sin(tilt), 0))
      t.y += (rnd(i, seed + 3) - 0.5) * 0.18
      t.normalize()
    } else {
      // Measured from the hook, so that the hanging links line up with the top.
      const d = length - s
      const d1 = top.distanceTo(knee)
      if (d <= d1 || hi === 0) {
        t = new V3(0, -1, 0)
        c.copy(top).addScaledVector(t, d)
      } else {
        const u = clamp((d - d1) / Math.max(1e-4, hangLen - d1), 0, 1)
        c.copy(knee).lerp(pl, u)
        t = pl.clone().sub(knee).normalize()
      }
      const ref = new V3(1, 0, 0).addScaledVector(t, -t.x).normalize()
      w = ref.clone().applyAxisAngle(t, (i % 2 ? 45 : -45) * DEG + (seed * 13 * DEG) % (Math.PI / 2))
    }
    const o = mesh(geo, m)
    o.position.copy(c)
    o.quaternion.copy(frameQ(t, w))
    out.push(o)
  }
  return out
}

// ------------------------------------------------------------------------------------------------------------------
// Bands
// ------------------------------------------------------------------------------------------------------------------
/** A point in the world from a short description. Hands, feet, limbs, body frames, a bar sleeve or plain coordinates. */
function resolvePoint(a, ctx, barF) {
  if (Array.isArray(a)) return { pos: v(a), axis: null, r: 0.015 }
  if (!ctx && !a.pos) throw new Error('a band anchored on the body needs follow: "pelvis" or hands: true on the prop, so that it follows the frames')
  if (a.hand) {
    const h = ctx.hands[a.hand]
    return { pos: v(h.centre), axis: a.axis ? v(a.axis).normalize() : v(h.thumb), r: a.r ?? 0.012 }
  }
  if (a.foot) {
    const f = ctx.feet[a.foot]
    const up = v(f.up)
    const fw = v(f.forward)
    const base = v(a.at === 'heel' ? f.heel : a.at === 'ball' ? f.ball : f.sole)
    const r = a.r ?? 0.045
    const lateral = up.clone().cross(fw).normalize()
    const s = a.foot === 'L' ? 1 : -1
    if (a.edge) base.addScaledVector(lateral, s * (a.edge === 'out' ? 1 : -1) * 0.052)
    return { pos: base.addScaledVector(up, a.edge ? 0.006 : r), axis: fw, r }
  }
  for (const key of ['knee', 'thigh', 'ankle', 'shin']) {
    if (!a[key]) continue
    const s = a[key]
    const j = ctx.joints
    const hip = v(j[`upperleg01.${s}`])
    const knee = v(j[`lowerleg01.${s}`])
    const ankle = v(j[`foot.${s}`])
    // From the mesh: the middle of the limb lies a little off the line between the joints.
    const pq = ctx.frames.pelvis.quat
    const outward = new V3(s === 'L' ? 1 : -1, 0, 0).applyQuaternion(new Q4(pq[0], pq[1], pq[2], pq[3]))
    if (key === 'knee') {
      const up = hip.clone().sub(ankle).normalize()
      return { pos: knee.clone().addScaledVector(up, a.along ?? 0.06).addScaledVector(outward, -0.018), axis: up, r: a.r ?? 0.058 }
    }
    if (key === 'thigh') {
      const up = hip.clone().sub(knee).normalize()
      return { pos: knee.clone().addScaledVector(up, a.along ?? 0.2).addScaledVector(outward, -0.012), axis: up, r: a.r ?? 0.071 }
    }
    const up = knee.clone().sub(ankle).normalize()
    return { pos: ankle.clone().addScaledVector(up, a.along ?? (key === 'ankle' ? 0.075 : 0.14)).addScaledVector(outward, 0.009), axis: up, r: a.r ?? (key === 'ankle' ? 0.034 : 0.039) }
  }
  if (a.sleeve) {
    const q = barF.q
    const X = new V3(1, 0, 0).applyQuaternion(q)
    return { pos: barF.o.clone().addScaledVector(X, (a.sleeve === 'L' ? 1 : -1) * (a.x ?? 0.95)), axis: X, r: a.r ?? 0.0265 }
  }
  if (a.follow) {
    const f = ctx.frames[a.follow]
    const q = new Q4(f.quat[0], f.quat[1], f.quat[2], f.quat[3])
    return { pos: v(a.at ?? [0, 0, 0]).applyQuaternion(q).add(v(f.pos)), axis: a.axis ? v(a.axis).applyQuaternion(q).normalize() : null, r: a.r ?? 0.015 }
  }
  return { pos: v(a.pos), axis: a.axis ? v(a.axis).normalize() : null, r: a.r ?? 0.015 }
}

/** The centreline of a closed flat band around two round things, as a belt around two pulleys, and its width direction. */
function beltPath(A, B, n = 16) {
  const D = B.pos.clone().sub(A.pos)
  const dist = D.length() || 1e-4
  D.divideScalar(dist)
  const pick = (axis) => {
    // The band's width lies along the thing it goes around. A hand gripping along the strand has no such thing: stand the band up.
    let a = axis ? axis.clone() : new V3(0, 1, 0)
    let s = a.clone().cross(D)
    if (s.lengthSq() < 0.05) {
      a = new V3(0, 1, 0)
      s = a.clone().cross(D)
      if (s.lengthSq() < 0.05) {
        a = new V3(1, 0, 0)
        s = a.clone().cross(D)
      }
    }
    return { a: a.normalize(), s: s.normalize() }
  }
  const pa = pick(A.axis)
  const pb = pick(B.axis)
  if (pa.s.dot(pb.s) < 0) {
    pb.s.negate()
    pb.a.negate()
  }
  const C = []
  const W = []
  const arc = 10
  // A's near side to B, around B, back, around A.
  for (let i = 0; i < n; i++) {
    const t = i / n
    const p0 = A.pos.clone().addScaledVector(pa.s, A.r)
    const p1 = B.pos.clone().addScaledVector(pb.s, B.r)
    C.push(p0.lerp(p1, t))
    W.push(pa.a.clone().lerp(pb.a, t).normalize())
  }
  for (let i = 0; i <= arc; i++) {
    const th = (i / arc) * Math.PI
    C.push(B.pos.clone().addScaledVector(pb.s, B.r * Math.cos(th)).addScaledVector(D, B.r * Math.sin(th)))
    W.push(pb.a.clone())
  }
  for (let i = 1; i < n; i++) {
    const t = i / n
    const p0 = B.pos.clone().addScaledVector(pb.s, -B.r)
    const p1 = A.pos.clone().addScaledVector(pa.s, -A.r)
    C.push(p0.lerp(p1, t))
    W.push(pb.a.clone().lerp(pa.a, t).normalize())
  }
  for (let i = 0; i < arc; i++) {
    const th = (i / arc) * Math.PI
    C.push(A.pos.clone().addScaledVector(pa.s, -A.r * Math.cos(th)).addScaledVector(D, -A.r * Math.sin(th)))
    W.push(pa.a.clone())
  }
  return { C, W }
}

function closedLength(C) {
  let s = 0
  for (let i = 0; i < C.length; i++) s += C[i].distanceTo(C[(i + 1) % C.length])
  return s
}

/** A real band: its section shrinks as it stretches, in width and thickness alike. */
function beltMesh(A, B, { width = 0.029, thick = 0.0045, rest = 1.04, m = null } = {}) {
  const { C, W } = beltPath(A, B)
  const stretch = Math.max(1, closedLength(C) / (rest * 2))
  const k = 1 / Math.sqrt(stretch)
  return mesh(ribbonGeometry(C, W, width * k, thick * k, { closed: true }), m || M.band())
}

function smoothThrough(points, samples = 0) {
  if (points.length < 3) return points.map((q) => q.clone())
  const curve = new THREE.CatmullRomCurve3(points.map((q) => q.clone()), false, 'centripetal')
  return curve.getSpacedPoints(samples || points.length * 14)
}

/** A D-handle: foam grip in the hand, webbing from both its ends to a steel ring. */
function dHandle(c, thumb, pull) {
  const a = thumb.clone().normalize()
  const down = pull.clone().addScaledVector(a, -pull.dot(a)).normalize()
  const n = a.clone().cross(down)
  const hl = 0.062
  const ringC = c.clone().addScaledVector(down, 0.098)
  const e0 = c.clone().addScaledVector(a, -hl - 0.008)
  const e1 = c.clone().addScaledVector(a, hl + 0.008)
  const parts = []
  // The grip is a foam sleeve on a stiff core.
  const q = frameQ(a, down)
  const grip = rev([[0.0105, -hl - 0.002], [0.0165, -hl, 0.003], [0.0168, 0, 0], [0.0165, hl, 0.003], [0.0105, hl + 0.002]], M.foam(), { arc: 2, seg: 24 })
  const gripG = group(grip)
  gripG.position.copy(c)
  gripG.quaternion.copy(q)
  parts.push(gripG)
  const strap = (e) => {
    const end = ringC.clone().addScaledVector(a, (e.clone().sub(c).dot(a) > 0 ? 1 : -1) * 0.01)
    const pts = [e.clone().addScaledVector(down, -0.012), e.clone().addScaledVector(down, 0.02), end]
    const path = smoothThrough(pts, 10)
    const W = path.map(() => n.clone())
    return mesh(ribbonGeometry(path, W, 0.02, 0.003), M.nylon())
  }
  parts.push(strap(e0), strap(e1))
  const ringG = kit.torus(0.014, 0.0026, M.hub(), [0, 0, 0], 'y')
  ringG.position.copy(ringC)
  ringG.quaternion.copy(frameQ(a, down))
  parts.push(ringG)
  return { g: group(parts), ring: ringC.clone().addScaledVector(down, 0.012) }
}

// ------------------------------------------------------------------------------------------------------------------
// Sandbag
// ------------------------------------------------------------------------------------------------------------------
function sandbagSurface(L, D, flat, seed) {
  // Point on the skin for u in -1..1 along the bag, angle a around it. a = 0 is on top.
  return (u, a) => {
    const au = Math.abs(u)
    const e = Math.pow(Math.max(0, 1 - Math.pow(au, 3.4)), 1 / 3.4)
    const lumps = 0.018 * Math.sin(a * 2 + u * 2.3 + seed) + 0.011 * Math.sin(a * 5 - u * 4.1 + seed * 2) + 0.006 * Math.sin(a * 9 + u * 7.3)
    const pleat = au > 0.7 ? 0.013 * ((au - 0.7) / 0.3) * Math.sin(a * 16) : 0
    const r = (D / 2) * e * (1 + lumps * 1.6 + pleat * 2.5)
    let y = Math.cos(a) * r
    const z = Math.sin(a) * r
    // The filling settles: wider low, flat on what it lies on.
    const belly = y < 0 ? 1 + flat * 0.1 : 1 - flat * 0.1
    y *= belly
    const floor = -(D / 2) * (1 - flat * 0.34)
    if (flat && y < floor) y = floor + (y - floor) * 0.08
    return new V3(u * (L / 2) * (1 + 0.012 * Math.sin(a * 3)), y, z * (1 + (y < 0 ? flat * 0.12 : 0)))
  }
}

function sandbagGeometry(L, D, flat, seed) {
  const f = sandbagSurface(L, D, flat, seed)
  const nu = 72
  const na = 96
  const P = []
  for (let i = 0; i <= nu; i++) {
    const row = []
    const u = -1 + (2 * i) / nu
    const ue = Math.sign(u) * Math.pow(Math.abs(u), 0.72)
    for (let j = 0; j < na; j++) row.push(f(ue, (j / na) * Math.PI * 2))
    P.push(row)
  }
  const pos = []
  const nor = []
  const uv = []
  const idx = []
  const w = na + 1
  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j <= na; j++) {
      const p = P[i][j % na]
      const pu = P[Math.min(nu, i + 1)][j % na].clone().sub(P[Math.max(0, i - 1)][j % na])
      const pa = P[i][(j + 1) % na].clone().sub(P[i][(j - 1 + na) % na])
      const n = pa.cross(pu)
      if (n.lengthSq() < 1e-14) n.set(i < nu / 2 ? -1 : 1, 0, 0)
      n.normalize()
      // Outward check against the bag's axis.
      const out = new V3(p.x * 0.4, p.y, p.z)
      if (n.dot(out) < 0) n.negate()
      pos.push(p.x, p.y, p.z)
      nor.push(n.x, n.y, n.z)
      uv.push((j / na) * (Math.PI * D) * 64, (i / nu) * L * 64)
    }
  }
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < na; j++) {
      const a = i * w + j
      const b = (i + 1) * w + j
      idx.push(a, b, a + 1, b + 1, a + 1, b)
    }
  }
  return makeGeometry(pos, nor, uv, idx)
}

// ------------------------------------------------------------------------------------------------------------------
const TYPES = {
  /** See the top of this file. */
  barbell(p, ctx) {
    const plates = p.plates ?? []
    const kind = p.kind ?? 'iron'
    const X0 = 0.655
    const X1 = 1.1
    const inner = group(
      olympicShaft(),
      bothSides(() => group(barSleeve(X0, X1), loadSleeve(X0 + 0.0305, plates, kind, p.collar).g)),
    )
    // A round bar has no up of its own: stay level, so that the plates keep hanging true through a curl or a press.
    return placed(inner, { ...p, up: p.up ?? [0, 1, 0] }, ctx, { height: Math.max(maxPlateR(plates, kind), 0.03) })
  },

  'ez-bar'(p, ctx) {
    const plates = p.plates ?? []
    const kind = p.kind ?? 'iron'
    const half = EZ.pts.map(([x, y]) => new V3(x, y, 0))
    const whole = [...half, ...half.slice().reverse().map((q) => new V3(-q.x, q.y, 0))]
    const path = filletPath(whole, 0.032, 9)
    const rTube = EZ.r
    const total = pathLength(path)
    // Knurl on the slopes: lengths along the path, from the left end.
    const sOf = (x, y) => {
      let s = 0
      let best = 0
      let bd = 1e9
      for (let i = 0; i < path.length - 1; i++) {
        const d = Math.hypot(path[i].x - x, path[i].y - y)
        if (d < bd) {
          bd = d
          best = s
        }
        s += path[i].distanceTo(path[i + 1])
      }
      return best
    }
    const zones = []
    for (const [x, y] of [EZ.outer, EZ.inner]) {
      const c = sOf(x, y)
      zones.push([c - 0.052, c + 0.052], [total - c - 0.052, total - c + 0.052])
    }
    const tube = memo('ezTube', () => sweepGeometry(path, rTube, { seg: 18, caps: false }))
    const knurls = zones.map(([a, b], i) => mesh(memo(`ezK${i}`, () => sweepGeometry(pathPart(path, a, b), rTube + 0.00006, { seg: 18, caps: false, pitch: 0.0034 })), M.knurl()))
    const g = p.grip === 'inner' ? EZ.inner : EZ.outer
    // Central hump away from the wrists, as on real curls: the wave's slope then matches the hand's natural oblique grip.
    const q = { ...p }
    if ((p.hands || p.hand) && !p.up && ctx) {
      const h = p.hands ? ctx.hands : { L: ctx.hands[p.hand], R: ctx.hands[p.hand] }
      const c = v(h.L.centre).add(v(h.R.centre)).multiplyScalar(0.5)
      const w = v(h.L.wrist).add(v(h.R.wrist)).multiplyScalar(0.5)
      q.up = c.clone().sub(w).toArray()
    }
    const turn = hangingTurn(q, ctx)
    const inner = group(
      mesh(tube, M.shaft()),
      knurls,
      bothSides((side) => {
        const load = loadSleeve(EZ.collar + 0.025, plates, kind, p.collar).g
        load.rotation.x = turn(side)
        return group(barSleeve(EZ.collar, EZ.end, { rShaft: EZ.r, flange: 0.03, flangeW: 0.024 }), load)
      }),
    )
    return placed(inner, q, ctx, { grip: [0, p.hands || p.hand ? g[1] : 0, 0], height: Math.max(maxPlateR(plates, kind), 0.058) })
  },

  'trap-bar'(p, ctx) {
    const plates = p.plates ?? []
    const kind = p.kind ?? 'iron'
    const { sx, sz, az, hx, hz, rise, r, sleeve0, sleeve1 } = HEX
    const corners = [
      [sx, 0, sz],
      [0, 0, az],
      [-sx, 0, sz],
      [-sx, 0, -sz],
      [0, 0, -az],
      [sx, 0, -sz],
      [sx, 0, sz],
    ]
    const hexG = memo('hexFrame', () => {
      // Start in the middle of a straight side, so that the closing joint is hidden.
      const pts = [[sx, 0, 0], ...corners.slice(0, 6), [sx, 0, 0]]
      return sweepGeometry(filletPath(pts, 0.03, 8), r, { seg: 20, caps: false })
    })
    const handle = (s) => {
      const base = [
        [s * sx, 0, sz - 0.03],
        [s * hx, rise * 0.25, hz + 0.02],
        [s * hx, rise, hz],
        [s * hx, rise, -hz],
        [s * hx, rise * 0.25, -hz - 0.02],
        [s * sx, 0, -sz + 0.03],
      ]
      const tube = mesh(memo(`hexH${s}`, () => sweepGeometry(filletPath(base, 0.022, 7), 0.0155, { seg: 18, caps: false })), M.barFrame())
      const zone = mesh(memo(`hexK${s}`, () => {
        const c = new THREE.CylinderGeometry(0.0156, 0.0156, 0.17, 26, 1, true)
        const uv = c.attributes.uv
        for (let i = 0; i < uv.count; i++) uv.setXY(i, 29 * uv.getX(i), (0.17 / 0.0034) * uv.getY(i))
        return c
      }), M.knurl(), [s * hx, rise, 0], AX.z)
      // Weld beads where the handle meets the frame.
      const welds = [sz - 0.03, -sz + 0.03].map((z) => {
        const w = kit.sphere(0.0195, M.barFrame(), [s * sx, 0, z], 14)
        w.scale.set(1, 1, 1.25)
        return w
      })
      return group(tube, zone, welds)
    }
    const inner = group(
      mesh(hexG, M.barFrame()),
      handle(1),
      handle(-1),
      bothSides(() => {
        // Stub, collar and loading sleeve on the outside of each flat side.
        const collar = rev([[0.016, sx], [0.031, sx + 0.002, 0.002], [0.031, sleeve0, 0.002], [0.0255, sleeve0 + 0.002, 0.001]], M.barFrame(), { arc: 2, seg: 36 })
        return group(collar, barSleeve(sleeve0 - 0.002, sleeve1, { rShaft: 0.016, flange: 0.031, flangeW: 0.012 }), loadSleeve(sleeve0 + 0.012, plates, kind, p.collar).g)
      }),
    )
    const held = p.hands || p.hand
    return placed(inner, p, ctx, { grip: [0, held ? rise : 0, 0], height: Math.max(maxPlateR(plates, kind), 0.035) })
  },

  /** The 50 mm axle, with this module's plate lists. (strongman.js has its own 'axle-bar', with plate counts.) */
  'thick-bar'(p, ctx) {
    const plates = p.plates ?? []
    const kind = p.kind ?? 'iron'
    const r = 0.025
    const stop = 0.655
    const end = 1.065
    const inner = group(
      plainCyl(r, -stop, stop, M.brushed(), 40),
      // The axle is a plain pipe: a butt joint in the middle, and fixed stops for the plates.
      rev([[r - 0.0004, -0.0012], [r + 0.0003, -0.0006, 0.0002], [r + 0.0003, 0.0006, 0.0002], [r - 0.0004, 0.0012]], M.shaft(), { arc: 1, seg: 40 }),
      bothSides(() =>
        group(
          rev([[r, stop - 0.018], [0.034, stop - 0.016, 0.002], [0.034, stop, 0.002], [r, stop + 0.002]], M.sleeve(), { arc: 2, seg: 40 }),
          rev([[r, stop], [r, end - 0.004, 0.002], [r - 0.003, end, 0.0015], [0, end]], M.brushed(), { arc: 2, seg: 40 }),
          loadSleeve(stop + 0.002, plates, kind, p.collar).g,
        ),
      ),
    )
    return placed(inner, { ...p, up: p.up ?? [0, 1, 0] }, ctx, { height: Math.max(maxPlateR(plates, kind), 0.03) })
  },

  'cambered-bar'(p, ctx) {
    const plates = p.plates ?? []
    const kind = p.kind ?? 'iron'
    const style = p.style ?? 'bow'
    const X0 = 0.655
    const X1 = 1.0
    let path
    let zones
    const camber = p.camber ?? (style === 'squat' ? 0.34 : 0.09)
    if (style === 'squat') {
      // Straight yoke across the back; both ends drop, so that the plates hang below the bar and sway.
      const pts = [[X0, -camber, 0], [0.5, -camber, 0], [0.3, 0, 0], [-0.3, 0, 0], [-0.5, -camber, 0], [-X0, -camber, 0]]
      path = memo(`camS${camber}`, () => filletPath(pts, 0.05, 10))
      zones = [[-0.26, -0.05], [0.05, 0.26]]
    } else {
      // A bow in the middle between the hands: the bar clears the chest or the bench for a longer pull.
      path = memo(`camB${camber}`, () => {
        const out = []
        const smooth = (x) => {
          const t = clamp((Math.abs(x) - 0.17) / (0.36 - 0.17), 0, 1)
          return 1 - t * t * (3 - 2 * t)
        }
        for (let i = 0; i <= 80; i++) {
          const x = -X0 + (i / 80) * 2 * X0
          out.push(new V3(x, camber * smooth(x), 0))
        }
        return out
      })
      zones = [[-0.6, -0.38], [0.38, 0.6]]
    }
    const tube = mesh(memo(`camT${style}${camber}`, () => sweepGeometry(path, 0.0145, { seg: 18, caps: false })), M.shaft())
    const knurl = zones.map(([a, b]) => knurlCyl(0.01456, a, b))
    const y = style === 'squat' ? -camber : 0
    const q = { ...p }
    if (style === 'squat' && !p.up) q.up = [0, 1, 0]
    const turn = hangingTurn(q, ctx)
    const sides = bothSides((side) => {
      const load = loadSleeve(X0 + 0.0305, plates, kind, p.collar).g
      load.rotation.x = turn(side)
      return group(barSleeve(X0, X1, { rShaft: 0.0145 }), load)
    })
    sides.position.y = y
    const inner = group(tube, knurl, sides)
    return placed(inner, q, ctx, { height: Math.max(maxPlateR(plates, kind), 0.03) - y })
  },

  dumbbell(p, ctx) {
    const kg = p.kg ?? 15
    const inner = p.style === 'adjustable' ? adjustableDumbbell(p.plates ?? [5, 2.5]) : dumbbellAssembly(kg)
    const { af, handle } = dumbbellSize(kg)
    if (p.hold === 'goblet' && p.hands && ctx) {
      // Both palms under the upper head, the handle hanging between the forearms.
      const c = v(ctx.hands.L.centre).add(v(ctx.hands.R.centre)).multiplyScalar(0.5)
      const axis = v(p.dir ?? [0, 1, 0]).normalize()
      const q = frameQ(axis, v(ctx.hands.L.centre).sub(v(ctx.hands.R.centre)))
      const outer = group(inner)
      inner.quaternion.copy(q)
      inner.position.copy(c).addScaledVector(axis, -(handle / 2 - 0.012))
      outer.userData.world = true
      return outer
    }
    const rest = p.style === 'adjustable' ? maxPlateR(p.plates ?? [5, 2.5], 'iron') : af / 2
    return placed(inner, p, ctx, { height: rest })
  },

  kettlebell(p, ctx) {
    const kg = p.kg ?? 16
    const s = kbShape(kg)
    const inner = kettlebellAssembly(kg)
    const mode = p.mode ?? 'hang'
    if (ctx && (p.hands || p.hand) && mode !== 'hang') {
      const outer = group(inner)
      outer.userData.world = true
      if (mode === 'horns' && p.hands) {
        const c = v(ctx.hands.L.centre).add(v(ctx.hands.R.centre)).multiplyScalar(0.5)
        const x = v(ctx.hands.L.centre).sub(v(ctx.hands.R.centre))
        const q = frameQ(x, v(p.up ?? [0, 1, 0]))
        inner.quaternion.copy(q)
        inner.position.copy(c).add(new V3(0, -s.hornY, 0).applyQuaternion(q))
        return outer
      }
      const h = ctx.hands[p.hand ?? 'L']
      const c = v(h.centre)
      const f = v(h.fingers)
      const n = v(h.palm)
      const t = v(h.thumb)
      if (mode === 'palm') {
        // The ball sits in an open palm, the handle pointing away from it.
        const up = n.clone()
        const q = frameQ(p.flip ? t.clone().negate() : t, up)
        inner.quaternion.copy(q)
        // The contact is on the flat base.
        inner.position.copy(c).addScaledVector(up, -0.002)
        return outer
      }
      // Rack and overhead: the handle lies in the hand, the ball rests on the back of the forearm.
      const toBody = n.clone().multiplyScalar(-0.86).addScaledVector(f, -0.5).normalize()
      const q = frameQ(p.flip ? t.clone().negate() : t, toBody.clone().negate())
      const roll = (p.roll || 0) * DEG
      if (roll) q.multiply(new Q4().setFromAxisAngle(new V3(1, 0, 0), roll))
      inner.quaternion.copy(q)
      inner.position.copy(c).add(new V3(0, -s.yG, 0).applyQuaternion(q))
      return outer
    }
    return placed(inner, p, ctx, { grip: [0, p.hands || p.hand ? s.yG : 0, 0], height: 0 })
  },

  'weight-plate'(p, ctx) {
    const kg = p.kg ?? 20
    const kind = p.kind ?? 'iron'
    const count = p.count ?? 1
    const { d, t } = plateSize(kg, kind)
    const R = d / 2
    // The plates' faces look along local Z; X and Y lie in the plate.
    const parts = []
    for (let i = 0; i < count; i++) {
      const pm = plateMesh(kg, kind, (i - (count - 1) / 2) * (t + 0.001))
      parts.push(pm)
    }
    const stack = group(parts)
    stack.rotation.y = -Math.PI / 2
    const inner = group(stack)
    const outer = group(inner)
    const put = (o, x, y) => {
      inner.position.copy(o)
      inner.quaternion.copy(frameQ(x, y))
      outer.userData.world = true
      return outer
    }
    if (p.hold === 'squeeze' && p.hands && ctx) {
      // Pressed between the palms, as in a Svend press: the plates' faces towards the hands, their axis along the line between them.
      const cl = v(ctx.hands.L.centre)
      const cr = v(ctx.hands.R.centre)
      const n = cl.clone().sub(cr)
      const up = v(p.up ?? [0, 1, 0])
      return put(cl.clone().add(cr).multiplyScalar(0.5), up.clone().cross(n), up)
    }
    if (p.hands && ctx) {
      // At 3 and 9 o'clock: the rim runs through both fists, along the thumbs.
      const L = ctx.hands.L
      const R2 = ctx.hands.R
      const cl = v(L.centre)
      const cr = v(R2.centre)
      const o = cl.clone().add(cr).multiplyScalar(0.5)
      const x = cl.clone().sub(cr)
      let y = p.up ? v(p.up) : v(L.thumb).add(v(R2.thumb))
      if (p.normal) y = x.clone().cross(v(p.normal)).negate()
      if (y.clone().addScaledVector(x.clone().normalize(), -y.dot(x.clone().normalize())).lengthSq() < 1e-3) y = new V3(0, 1, 0)
      return put(o, x, y)
    }
    if (p.hand && ctx) {
      // Pinched by the rim, fingers on one face, thumb on the other: it hangs off the hand along the fingers.
      const h = ctx.hands[p.hand]
      const n = v(h.palm)
      const f = v(h.fingers)
      const o = v(h.centre).addScaledVector(f, R - 0.03)
      return put(o, n.clone().cross(f.clone().negate()), f.clone().negate())
    }
    if (p.follow && ctx) {
      const fr = ctx.frames[p.follow]
      const q = new Q4(fr.quat[0], fr.quat[1], fr.quat[2], fr.quat[3])
      const o = v(p.at ?? [0, 0, 0]).applyQuaternion(q).add(v(fr.pos))
      const n = v(p.normal ?? [0, 0, 1]).applyQuaternion(q)
      const up = v(p.up ?? [0, 1, 0]).applyQuaternion(q)
      return put(o, up.clone().cross(n), up)
    }
    if (p.at) {
      const n = v(p.normal ?? [0, 0, 1])
      const up = v(p.up ?? [0, 1, 0])
      return put(v(p.at), up.clone().cross(n), up)
    }
    // Static: flat on the floor, or standing on its rim with `upright`.
    if (p.upright) inner.position.y = R
    else {
      inner.rotation.x = -Math.PI / 2
      inner.position.y = p.height ?? (t * count) / 2
    }
    return outer
  },

  'medicine-ball'(p, ctx) {
    const kg = p.kg ?? 6
    const R = p.r ?? clamp(0.1 + 0.0042 * kg, 0.1, 0.16)
    const g = memo(`mb${R}`, () => {
      const s = new THREE.SphereGeometry(R, 72, 48)
      return s
    })
    const ball = mesh(g, M.ball())
    ball.rotation.set((p.spinX ?? 0) * DEG, (p.spinY ?? 0) * DEG, (p.spinZ ?? 0) * DEG)
    const inner = group(ball)
    const outer = group(inner)
    if (p.hand && ctx) {
      // Balanced on the open palm.
      const h = ctx.hands[p.hand]
      inner.position.copy(v(h.centre)).addScaledVector(v(h.palm), R + 0.002)
      outer.userData.world = true
      return outer
    }
    const f = placement(p, ctx)
    if (f) {
      inner.position.copy(f.o)
      outer.userData.world = true
      return outer
    }
    inner.position.y = p.height ?? R
    return outer
  },

  landmine(p, ctx) {
    const plates = p.plates ?? [20]
    const kind = p.kind ?? 'iron'
    const base = v(p.pos ?? [0, 0, 0])
    const yaw = (p.yaw || 0) * DEG
    const PY = 0.11
    const pivot = base.clone().setY(PY)
    const hl = p.handle ?? 'none'
    let target = null
    let handleParts = []
    const barQ = (d) => frameQ(d, new V3(0, 1, 0))
    if (ctx && p.hands) {
      const cl = v(ctx.hands.L.centre)
      const cr = v(ctx.hands.R.centre)
      const mid = cl.clone().add(cr).multiplyScalar(0.5)
      if (hl === 'v') {
        // The bar lies on top of a double-D handle: the fists are below it, on two parallel grips.
        const wrists = v(ctx.hands.L.wrist).add(v(ctx.hands.R.wrist)).multiplyScalar(0.5)
        const X = cl.clone().sub(cr).normalize()
        const u = wrists.clone().sub(mid)
        u.addScaledVector(X, -u.dot(X)).normalize()
        const b = mid.clone().addScaledVector(u, p.hook ?? 0.062)
        target = b
        const along = b.clone().sub(pivot).normalize()
        const n = along.clone().addScaledVector(u, -along.dot(u)).normalize()
        const reach = 0.078
        const m = M.barFrame()
        const topA = mid.clone().addScaledVector(u, 0.028)
        const parts = []
        for (const c of [cl, cr]) {
          const grip = rev([[0.0125, -0.058], [0.0165, -0.056, 0.003], [0.0165, 0.056, 0.003], [0.0125, 0.058]], M.gripRubber(), { arc: 2, seg: 22 })
          const G = group(grip)
          G.position.copy(c)
          G.quaternion.copy(frameQ(n, u))
          parts.push(G)
          for (const e of [-1, 1]) {
            const a = c.clone().addScaledVector(n, e * 0.062)
            const b2 = topA.clone().addScaledVector(n, e * reach)
            parts.push(sweep(filletPath([c.clone().addScaledVector(n, e * 0.045), a, b2], 0.012, 5), 0.0085, m, { seg: 12 }))
          }
        }
        parts.push(sweep([topA.clone().addScaledVector(n, -reach), topA.clone().addScaledVector(n, reach)], 0.0105, m, { seg: 14 }))
        // Two hooks around the bar, each open on one side.
        for (const e of [-0.034, 0.034]) {
          const c0 = b.clone().addScaledVector(n, e)
          const pts = []
          const X2 = X
          for (let k = 0; k <= 16; k++) {
            const a = -Math.PI * 0.05 + (k / 16) * Math.PI * 1.55
            pts.push(c0.clone().addScaledVector(u, -Math.cos(a) * 0.0185).addScaledVector(X2, Math.sin(a) * 0.0185))
          }
          parts.push(sweep(pts, 0.0048, M.hub(), { seg: 10 }))
          parts.push(sweep([pts[0], topA.clone().addScaledVector(n, e)], 0.0062, m, { seg: 10 }))
        }
        handleParts = parts
      } else if (hl === 'jammer') {
        // Jammer arms: a sleeve on the bar, two arms dropping to neutral grips, so that the bar passes over the head.
        const X = cl.clone().sub(cr).normalize()
        const upv = new V3(0, 1, 0).addScaledVector(X, -X.y).normalize()
        const b = mid.clone().addScaledVector(upv, p.drop ?? 0.34)
        target = b
        const along = b.clone().sub(pivot).normalize()
        const parts = []
        const m = M.barFrame()
        const collar = rev([[0.0265, -0.13], [0.0345, -0.128, 0.002], [0.0345, 0.128, 0.002], [0.0265, 0.13]], m, { arc: 2, seg: 32 })
        const G = group(collar)
        G.position.copy(b)
        G.quaternion.copy(barQ(along))
        parts.push(G)
        for (const [c, h, sign] of [
          [cl, ctx.hands.L, 1],
          [cr, ctx.hands.R, -1],
        ]) {
          const a = v(h.thumb).normalize()
          const q2 = frameQ(a, upv)
          const grip = rev([[0.0125, -0.066], [0.0172, -0.064, 0.003], [0.0172, 0.064, 0.003], [0.0125, 0.066]], M.gripRubber(), { arc: 2, seg: 22 })
          const H = group(grip)
          H.position.copy(c)
          H.quaternion.copy(q2)
          parts.push(H)
          const top = c.clone().addScaledVector(upv, 0.075)
          const inb = b.clone().addScaledVector(X, sign * 0.03).addScaledVector(upv, -0.012)
          parts.push(sweep(filletPath([inb, inb.clone().lerp(top, 0.25).addScaledVector(X, sign * 0.03), top], 0.05, 7), 0.0135, m, { seg: 14 }))
          for (const e of [-1, 1]) parts.push(sweep(filletPath([top, c.clone().addScaledVector(a, e * 0.082).addScaledVector(upv, 0.03), c.clone().addScaledVector(a, e * 0.07)], 0.012, 5), 0.0095, m, { seg: 12 }))
        }
        handleParts = parts
      } else target = mid
    } else if (ctx && p.hand) target = v(ctx.hands[p.hand].centre)
    else if (p.at) target = v(p.at)
    let d
    const barStart = 0.02
    const X0 = 0.655
    if (target) d = target.clone().sub(pivot).normalize()
    else {
      // At rest: the plates on the floor, along the base's yaw.
      const R = Math.max(maxPlateR(plates, kind), 0.03)
      const sPlate = barStart + 1.1 + X0 + 0.15
      const rise = clamp((R - PY) / sPlate, -0.9, 0.9)
      d = new V3(Math.sin(yaw) * Math.cos(Math.asin(rise)), rise, Math.cos(yaw) * Math.cos(Math.asin(rise)))
    }
    const q = barQ(d)
    const barG = group(
      olympicShaft(),
      group(barSleeve(X0, 1.1), loadSleeve(X0 + 0.0305, plates, kind, p.collar).g),
      (() => {
        const s = barSleeve(X0, 1.1)
        s.rotation.y = Math.PI
        return s
      })(),
    )
    barG.position.copy(pivot).addScaledVector(d, barStart + 1.1)
    barG.quaternion.copy(q)
    // The base: floor plate, turntable, yoke and the socket that swings on its pin.
    const baseG = group(
      kit.rbox(0.48, 0.012, 0.38, 0.006, M.powder(), [0, 0.006, 0], 2),
      [[-0.2, -0.15], [0.2, -0.15], [-0.2, 0.15], [0.2, 0.15]].map(([x, z]) => group(rev([[0, 0.0122], [0.015, 0.0122, 0.001], [0.0145, 0.0165, 0.001], [0, 0.0165]], M.hub(), { axis: 'y', at: [x, 0, z], arc: 1, seg: 20 }))),
    )
    baseG.position.set(base.x, base.y, base.z)
    baseG.rotation.y = yaw
    const flat = Math.atan2(d.x, d.z)
    const yoke = group(
      rev([[0, 0.012], [0.075, 0.012, 0.002], [0.075, 0.024, 0.003], [0, 0.024]], M.brushed(), { axis: 'y', arc: 2, seg: 44 }),
      [-0.046, 0.046].map((x) => {
        const plate = kit.rbox(0.012, 0.11, 0.1, 0.008, M.powder(), [x, 0.078, 0], 2)
        return group(plate, kit.cyl(0.0165, 0.008, M.hub(), [x + Math.sign(x) * 0.009, PY, 0], 'x', { seg: 20 }))
      }),
      kit.cyl(0.012, 0.11, M.brushed(), [0, PY, 0], 'x', { seg: 18 }),
    )
    yoke.position.set(base.x, 0, base.z)
    yoke.rotation.y = flat
    const socket = group(
      rev([[0.0265, -0.012], [0.038, -0.012, 0.002], [0.038, 0.3, 0.0025], [0.0265, 0.3]], M.barFrame(), { arc: 2, seg: 40 }),
      // Ring at the mouth, and a boss around the pin.
      rev([[0.0375, 0.285], [0.041, 0.287, 0.001], [0.041, 0.3, 0.001], [0.0265, 0.3015]], M.brushed(), { arc: 1, seg: 40 }),
    )
    socket.position.copy(pivot)
    socket.quaternion.copy(q)
    const outer = group(barG, baseG, yoke, socket, handleParts)
    outer.userData.world = true
    return outer
  },

  /** A landmine with a double-D handle on the bar, the classic T-bar row. */
  't-bar-row'(p, ctx) {
    return TYPES.landmine({ ...p, handle: p.handle ?? 'v' }, ctx)
  },

  chains(p, ctx) {
    const outer = new THREE.Group()
    outer.userData.world = true
    const wire = p.wire ?? 0.0105
    const pitch = p.pitch ?? 0.044
    const width = p.width ?? 0.038
    const length = p.length ?? 1.55
    const strands = p.strands ?? 2
    const leader = p.leader ?? (p.onHands ? 0 : 0.26)
    const seed0 = p.seed ?? 1
    const f = placement(p, ctx)
    if (!f && !p.anchors) throw new Error('chains needs hands: true, at or anchors')
    const X = f ? new V3(1, 0, 0).applyQuaternion(f.q) : new V3(1, 0, 0)
    let anchors
    if (p.anchors) anchors = p.anchors.map((q) => v(q))
    else if (p.onHands && ctx) {
      // A D-handle in each hand, the chain hooked to its ring.
      anchors = [ctx.hands.L, ctx.hands.R].map((h) => {
        const d = dHandle(v(h.centre), v(h.thumb), new V3(0, -1, 0))
        outer.add(d.g)
        return d.ring
      })
    }
    else anchors = [f.o.clone().addScaledVector(X, p.x ?? 0.97), f.o.clone().addScaledVector(X, -(p.x ?? 0.97))]
    const parts = []
    anchors.forEach((A, side) => {
      const hookY = leader > 0 ? A.y - leader : A.y
      const hook = new V3(A.x, hookY, A.z)
      if (leader > 0) {
        // A thin leader chain looped over the sleeve, with a snap hook at its end.
        const ring = kit.torus(0.0305, 0.0032, M.hub(), [0, 0, 0], 'y')
        ring.position.copy(A)
        const ringUp = new V3(0, 1, 0).addScaledVector(X, -X.y).normalize()
        ring.quaternion.copy(frameQ(ringUp, X.clone().cross(ringUp)))
        parts.push(ring)
        const lp = 0.024
        const lg = linkGeometry(lp, 0.018, 0.0042)
        const nl = Math.floor((leader - 0.05) / lp)
        for (let i = 0; i < nl; i++) {
          const o = mesh(lg, M.chain())
          o.position.set(A.x, A.y - 0.03 - (i + 0.5) * lp, A.z)
          o.quaternion.copy(frameQ(new V3(0, -1, 0), new V3(1, 0, 0).applyAxisAngle(new V3(0, 1, 0), (i % 2 ? 45 : -45) * DEG)))
          parts.push(o)
        }
        // Snap hook.
        const sn = sweep(
          filletPath(
            [
              [A.x, hookY + 0.05, A.z],
              [A.x, hookY - 0.012, A.z],
              [A.x + 0.012, hookY - 0.02, A.z],
              [A.x + 0.02, hookY - 0.008, A.z],
              [A.x + 0.012, hookY + 0.016, A.z],
            ],
            0.006,
            5,
          ),
          0.0036,
          M.hub(),
          { seg: 9 },
        )
        parts.push(sn)
      }
      for (let k = 0; k < strands; k++) {
        const off = strands > 1 ? (k - (strands - 1) / 2) * (p.spread ?? 0.034) : 0
        const zOff = new V3(-X.z, 0, X.x).multiplyScalar(off)
        const top = hook.clone().add(zOff)
        const basePt = p.base ? v(p.base[side]) : A.clone()
        basePt.y = 0
        basePt.addScaledVector(zOff, 2.6)
        const seed = seed0 + side * 7 + k * 3.3
        parts.push(chainRun(top, basePt, length, { pitch, width, wire, seed }))
      }
    })
    for (const q of parts.flat(Infinity)) outer.add(q)
    return outer
  },

  band(p, ctx) {
    const outer = new THREE.Group()
    outer.userData.world = true
    const width = p.width ?? 0.029
    const thick = p.thick ?? 0.0045
    const barF = placement({ hands: p.hands, hand: p.hand, follow: p.follow, at: p.barAt, dir: p.barDir, up: p.up }, ctx)
    if (p.points) {
      // An open strap through points (hand, behind the neck, other hand). `double` lays the two sides of the loop together.
      const pts = p.points.map((a) => resolvePoint(a, ctx, barF).pos)
      const C = smoothThrough(pts, p.points.length * 16)
      const len = pathLength(C)
      const k = 1 / Math.sqrt(Math.max(1, len / (p.rest ?? len)))
      const flat = p.flat ? v(p.flat) : new V3(0, 0, 1)
      const W = C.map((c, i) => {
        const t = C[Math.min(C.length - 1, i + 1)].clone().sub(C[Math.max(0, i - 1)]).normalize()
        const w = t.clone().cross(flat)
        if (w.lengthSq() < 1e-4) w.copy(t).cross(new V3(1, 0, 0))
        return w.normalize()
      })
      const o = p.double ? 0.012 : 0
      for (const s of o ? [-1, 1] : [0]) {
        const shifted = C.map((c, i) => c.clone().addScaledVector(W[i], s * o))
        outer.add(mesh(ribbonGeometry(shifted, W, width * k, thick * k), M.band()))
      }
      return outer
    }
    const A = resolvePoint(p.a, ctx, barF)
    const B = resolvePoint(p.b, ctx, barF)
    outer.add(beltMesh(A, B, { width, thick, rest: p.rest ?? 1.04 }))
    return outer
  },

  'band-tube'(p, ctx) {
    const outer = new THREE.Group()
    outer.userData.world = true
    const r0 = p.radius ?? 0.0058
    const handles = []
    const route = (p.via ?? []).map((a) => resolvePoint(a, ctx, null).pos)
    let pts = route.slice()
    const addHandle = (s, nextPoint) => {
      const h = ctx.hands[s]
      const c = v(h.centre)
      const pull = nextPoint.clone().sub(c).normalize()
      const d = dHandle(c, v(h.thumb), pull)
      handles.push(d.g)
      return d.ring
    }
    if (p.hands) {
      const a = addHandle('L', pts[0] ?? v(ctx.hands.R.centre))
      const b = addHandle('R', pts[pts.length - 1] ?? v(ctx.hands.L.centre))
      pts = [a, ...pts, b]
    } else if (p.hand) {
      const a = addHandle(p.hand, pts[0])
      pts = [a, ...pts]
    }
    const path = smoothThrough(pts, Math.max(40, pts.length * 18))
    const len = pathLength(path)
    const k = 1 / Math.sqrt(Math.max(1, len / (p.rest ?? len)))
    outer.add(mesh(sweepGeometry(path, r0 * k, { seg: 10 }), M.tube()))
    for (const h of handles) outer.add(h)
    return outer
  },

  'bar-bands'(p, ctx) {
    const outer = new THREE.Group()
    outer.userData.world = true
    const f = placement(p, ctx)
    if (!f) throw new Error('bar-bands needs the same placement as its bar: hands: true, or at and dir')
    const X = new V3(1, 0, 0).applyQuaternion(f.q)
    const x = p.x ?? 0.95
    const width = p.width ?? 0.029
    const thick = p.thick ?? 0.0045
    const rest = p.rest ?? 0.52
    ;[1, -1].forEach((s, i) => {
      const sleeve = { pos: f.o.clone().addScaledVector(X, s * x), axis: X.clone(), r: 0.0265 }
      let far
      if (p.to === 'feet') far = resolvePoint({ foot: s > 0 ? 'L' : 'R', r: p.pegR ?? 0.05 }, ctx, f)
      else if (p.pegs) far = { pos: v(p.pegs[i]), axis: v(p.pegAxis ?? [1, 0, 0]), r: p.pegR ?? 0.016 }
      else if (p.to === 'top') far = { pos: new V3(sleeve.pos.x, p.y ?? 2.25, sleeve.pos.z), axis: v(p.pegAxis ?? [1, 0, 0]), r: p.pegR ?? 0.03 }
      else far = { pos: new V3(sleeve.pos.x, p.y ?? 0.035, sleeve.pos.z), axis: v(p.pegAxis ?? [1, 0, 0]), r: p.pegR ?? 0.016 }
      outer.add(beltMesh(sleeve, far, { width, thick, rest }))
      if (p.drawPeg !== false && p.to !== 'top' && p.to !== 'feet') {
        // A floor peg: steel pin on a small base.
        const peg = group(
          kit.cyl(far.r, 0.09, M.hub(), [0, 0, 0], 'x', { seg: 18 }),
          kit.cyl(far.r + 0.008, 0.008, M.barFrame(), [0.05, 0, 0], 'x', { seg: 18 }),
          kit.rbox(0.018, far.pos.y + 0.012, 0.05, 0.003, M.powder(), [-0.05, -far.pos.y / 2 + 0.006, 0], 2),
        )
        peg.position.copy(far.pos)
        if (s < 0) peg.rotation.y = Math.PI
        outer.add(peg)
      }
    })
    return outer
  },

  sandbag(p, ctx) {
    const L = p.length ?? 0.66
    const D = p.d ?? 0.32
    const held = !!(p.hands || p.hand || p.follow || p.at)
    const flat = p.flat ?? (held ? 0.25 : 1)
    const seed = p.seed ?? 1
    const m = M.canvas()
    const surf = sandbagSurface(L, D, flat, seed)
    const body = mesh(memo(`bag${L}|${D}|${flat}|${seed}`, () => sandbagGeometry(L, D, flat, seed)), m)
    const webbing = (u, gripArc) => {
      const pts = []
      const W = []
      const n = 72
      const axis = new V3(1, 0, 0)
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        const sp = surf(u, a)
        const c = new V3(0, sp.y, sp.z)
        const out = c.clone().normalize()
        // Lifted over the top into a carrying loop.
        const da = Math.min(a, Math.PI * 2 - a)
        const liftT = clamp(1 - da / gripArc, 0, 1)
        const lift = 0.004 + 0.034 * liftT * liftT * (3 - 2 * liftT)
        pts.push(sp.clone().addScaledVector(out, lift))
        W.push(axis)
      }
      return mesh(memo(`bagW${L}|${D}|${flat}|${seed}|${u}|${gripArc}`, () => ribbonGeometry(pts, W, 0.046, 0.0035, { closed: true })), M.nylon())
    }
    const zip = mesh(
      memo(`bagZ${L}|${D}|${flat}|${seed}`, () => {
        const pts = []
        const W = []
        for (let i = 0; i <= 50; i++) {
          const u = -0.86 + (i / 50) * 1.72
          pts.push(surf(u, 0.28).addScaledVector(new V3(0, 1, 0.3).normalize(), 0.002))
          W.push(new V3(0, -0.3, 1).normalize())
        }
        return ribbonGeometry(pts, W, 0.016, 0.002)
      }),
      M.nylon(),
    )
    const inner = group(body, webbing(0.36, 0.55), webbing(-0.36, 0.55), zip)
    const low = -(D / 2) * (1 - flat * 0.34)
    return placed(inner, p, ctx, { grip: p.gripAt ?? [0, 0, 0], height: flat >= 1 ? -low + 0.001 : D / 2 })
  },

  sledgehammer(p, ctx) {
    const len = p.length ?? 0.9
    const axisR = 0.0165
    const headL = 0.17
    const headS = 0.076
    const m = M.fibre()
    const shaft = rev(
      [
        [0, 0],
        [0.0175, 0.002, 0.003],
        [0.0185, 0.04, 0.01],
        [0.0155, 0.12, 0.05],
        [axisR, len * 0.6, 0.1],
        [0.0145, len - headS / 2 - 0.02, 0.03],
        [0.0175, len - headS / 2 + 0.008, 0.01],
        [0.0175, len + 0.006, 0.002],
        [0, len + 0.006],
      ],
      m,
      { arc: 3, seg: 28 },
    )
    const grip = rev(
      [
        [0.018, -0.001],
        [0.0205, 0.002, 0.003],
        [0.0208, 0.05, 0.012],
        [0.0185, 0.27, 0.05],
        [0.0165, 0.28],
      ],
      M.gripRubber(),
      { arc: 3, seg: 28 },
    )
    const ribs = []
    for (let i = 0; i < 16; i++) {
      const x = 0.03 + i * 0.0145
      const rr = lerp(0.0204, 0.0186, i / 16)
      ribs.push(rev([[rr, x - 0.0035], [rr + 0.0012, x - 0.0012, 0.0008], [rr + 0.0012, x + 0.0012, 0.0008], [rr, x + 0.0035]], M.gripRubber(), { arc: 1, seg: 28 }))
    }
    // The head: an eight-sided steel block with chamfered faces. Its long axis is the striking direction.
    const headG = memo('sledgeHead', () => polyHeadGeometry(8, headS, headL, 0.006, 0.0075))
    const head = mesh(headG, M.head())
    head.position.set(len - headS / 2 + 0.006, 0, 0)
    // Its long axis is the striking direction: the handle's local Y.
    head.rotation.z = Math.PI / 2
    const eye = kit.rbox(0.008, 0.0015, 0.024, 0.0006, M.fibre(), [len + 0.0065, 0.0, 0], 1)
    const shaftG = group(shaft, grip, ribs, head, eye)
    const outer = group(shaftG)
    if (p.hands && ctx) {
      // `low`: the hand near the end of the handle. The handle runs from it towards the other hand, its head beyond.
      const lowS = p.low ?? 'L'
      const hL = ctx.hands[lowS]
      const hH = ctx.hands[lowS === 'L' ? 'R' : 'L']
      const a = v(hL.centre)
      const b = v(hH.centre)
      let x = b.clone().sub(a)
      if (x.length() < 0.1) x = v(hL.thumb)
      x.normalize()
      const strike = a.clone().sub(v(hL.wrist))
      if (p.flipHead) strike.negate()
      shaftG.quaternion.copy(frameQ(x, strike))
      shaftG.position.copy(a).addScaledVector(x, -(p.endGap ?? 0.05))
      outer.userData.world = true
      return outer
    }
    const f = placement(p, ctx)
    if (f) {
      shaftG.quaternion.copy(f.q)
      shaftG.position.copy(f.o)
      // One hand holds it near the end of the handle.
      if (p.hand) shaftG.position.add(new V3(-(p.endGap ?? 0.05), 0, 0).applyQuaternion(f.q))
      outer.userData.world = true
    } else {
      // Lying on the floor: on the head's flat and the end of the handle.
      const tilt = Math.asin((headS / 2 - 0.02) / (len - headS / 2))
      shaftG.rotation.set(Math.PI / 2, 0, 0)
      shaftG.rotation.y = -tilt
      shaftG.position.y = 0.021
    }
    return outer
  },

  'wrist-roller'(p, ctx) {
    const kg = p.kg ?? 5
    const kind = p.kind ?? 'iron'
    const total = p.ropeLength ?? 1.15
    const drop = clamp(p.drop ?? total * 0.8, 0.12, total)
    const Rr = 0.0195
    const hw = 0.23
    const ropeR = 0.0038
    const wound = total - drop
    const turns = wound / (Math.PI * 2 * (Rr + ropeR))
    // The roller in its own frame. The rope comes off its front, towards the plate.
    const rollerG = group(
      plainCyl(Rr, -hw, hw, M.brushed(), 32),
      knurlCyl(Rr + 0.00008, 0.05, hw - 0.02),
      knurlCyl(Rr + 0.00008, -hw + 0.02, -0.05),
      [hw, -hw].map((x) => rev([[Rr, x > 0 ? x - 0.004 : x - 0.003], [Rr + 0.002, x > 0 ? x - 0.003 : x - 0.002, 0.001], [Rr + 0.002, x > 0 ? x + 0.003 : x + 0.004, 0.001], [0, x > 0 ? x + 0.003 : x + 0.004]], M.sleeve(), { arc: 1, seg: 24 })),
    )
    const f = placement({ ...p, up: p.up ?? [0, 1, 0] }, ctx)
    const o = f ? f.o : new V3(p.pos?.[0] ?? 0, p.height ?? 1.2, p.pos?.[2] ?? 0)
    const q = f ? f.q : new Q4()
    rollerG.position.copy(o)
    rollerG.quaternion.copy(q)
    const parts = [rollerG]
    const X = new V3(1, 0, 0).applyQuaternion(q)
    const fw = new V3(0, 1, 0).cross(X).normalize().multiplyScalar(p.side === 'back' ? -1 : 1)
    // Rope wound in a neat coil on the middle of the roller, its layers stepping out when the coil gets wide.
    const coilW = Math.min(turns, 12) * ropeR * 2.05
    const coilPts = []
    const steps = Math.ceil(Math.max(0.5, turns) * 22)
    for (let i = 0; i <= steps; i++) {
      const tt = i / steps
      const a = tt * turns * Math.PI * 2 + Math.PI / 2
      const layer = Math.floor((tt * turns) / 12)
      const rr = Rr + ropeR * (1 + layer * 1.9)
      const xx = (layer % 2 ? 1 - ((tt * turns) % 12) / 12 : ((tt * turns) % 12) / 12) * coilW - coilW / 2
      coilPts.push(new V3(xx, Math.sin(a) * rr, Math.cos(a) * rr))
    }
    const coilG = turns > 0.05 ? mesh(sweepGeometry(coilPts, ropeR, { seg: 8, pitch: 0.012 }), M.rope()) : null
    if (coilG) {
      coilG.position.copy(o)
      coilG.quaternion.copy(frameQ(X, new V3(0, 1, 0).addScaledVector(X, -X.y)))
      parts.push(coilG)
    }
    // Plate on the rope's end.
    const { d, t } = plateSize(kg, kind)
    const rd = Rr + ropeR
    const exit = o.clone().addScaledVector(fw, rd)
    const plateC = exit.clone().add(new V3(0, -drop + 0.03, 0)).addScaledVector(fw, -(t / 2 + 0.006))
    const plate = plateMesh(kg, kind)
    const PG = group(plate)
    PG.position.copy(plateC)
    PG.quaternion.copy(frameQ(fw, X))
    parts.push(PG)
    const r0 = exit.clone()
    const r1 = plateC.clone().addScaledVector(fw, t / 2 + 0.006).add(new V3(0, 0.05, 0))
    const r2 = plateC.clone().addScaledVector(fw, t / 2 - 0.006).add(new V3(0, 0.012, 0))
    const r3 = plateC.clone().addScaledVector(fw, -t / 2 - 0.008)
    const ropePath = [r0, r1, ...new THREE.CatmullRomCurve3([r1, r2, r3], false, 'centripetal').getSpacedPoints(10).slice(1)]
    parts.push(mesh(sweepGeometry(ropePath, ropeR, { seg: 8, pitch: 0.012 }), M.rope()))
    const knot = kit.sphere(0.0115, M.rope(), [0, 0, 0], 14)
    knot.position.copy(r3)
    parts.push(knot)
    const outer = group(parts)
    outer.userData.world = true
    return outer
  },

  'jump-rope'(p, ctx) {
    const outer = new THREE.Group()
    outer.userData.world = true
    if (!ctx) return outer
    const L = ctx.hands.L
    const R = ctx.hands.R
    const hlen = 0.15
    const parts = []
    const tips = []
    for (const h of [L, R]) {
      const c = v(h.centre)
      const a = v(h.thumb).normalize()
      // Held like a hammer: the cord leaves the end above the thumb.
      const handle = rev(
        [
          [0, -hlen / 2],
          [0.0105, -hlen / 2, 0.002],
          [0.0125, -hlen / 2 + 0.02, 0.008],
          [0.0125, hlen / 2 - 0.05, 0.02],
          [0.0098, hlen / 2 - 0.016, 0.006],
          [0.0098, hlen / 2],
          [0.0065, hlen / 2 + 0.012, 0.002],
          [0, hlen / 2 + 0.012],
        ],
        M.gripRubber(),
        { arc: 2, seg: 22 },
      )
      const cap = rev([[0.0102, hlen / 2 - 0.014], [0.0102, hlen / 2 + 0.002, 0.001], [0.0068, hlen / 2 + 0.013, 0.001], [0.003, hlen / 2 + 0.013]], M.sleeve(), { arc: 2, seg: 22 })
      const H = group(handle, cap)
      H.position.copy(c)
      H.quaternion.copy(frameQ(a, new V3(0, 1, 0)))
      parts.push(H)
      tips.push(c.clone().addScaledVector(a, hlen / 2 + 0.012))
    }
    const [TL, TR] = tips
    const span = TL.clone().sub(TR)
    const X = span.clone().normalize()
    const ph = ((p.phase ?? 0) * DEG) % (Math.PI * 2)
    const fw0 = p.forward ? v(p.forward) : new V3(0, 0, 1).applyQuaternion(new Q4(...ctx.frames.pelvis.quat))
    const fw = fw0.clone().addScaledVector(X, -fw0.dot(X)).normalize()
    const down = X.clone().cross(fw).normalize()
    const dn = down.y > 0 ? down.clone().negate() : down
    // Radial direction in the rope's plane: 0 is down at the feet, 90 is in front, 180 over the head, 270 behind.
    const rad = dn.clone().multiplyScalar(Math.cos(ph)).addScaledVector(fw, Math.sin(ph))
    const total = p.ropeLength ?? 2.6
    const curve = (A) => {
      const pts = []
      const n = 96
      for (let i = 0; i <= n; i++) {
        const u = i / n
        // A spinning rope is a rounded arch, wider than the span of the hands where it leaves them.
        const s = Math.pow(Math.sin(Math.PI * u), 0.62)
        const q = TL.clone().lerp(TR, u).addScaledVector(rad, A * s)
        q.addScaledVector(X, 0.17 * Math.sin(2 * Math.PI * u))
        pts.push(q)
      }
      return pts
    }
    let lo = 0.05
    let hi = 2
    for (let i = 0; i < 24; i++) {
      const A = (lo + hi) / 2
      if (pathLength(curve(A)) > total) hi = A
      else lo = A
    }
    const A = (lo + hi) / 2
    const pts = curve(A)
    const rr = p.radius ?? 0.0032
    // Where it would go through the floor, it lies on it instead.
    for (const q of pts) if (q.y < rr) q.y = rr
    parts.push(mesh(sweepGeometry(pts, rr, { seg: 7 }), M.skipRope()))
    for (const q of parts) outer.add(q)
    return outer
  },

  'neck-harness'(p, ctx) {
    const outer = new THREE.Group()
    outer.userData.world = true
    if (!ctx) return outer
    const hf = ctx.frames.head
    const q = new Q4(hf.quat[0], hf.quat[1], hf.quat[2], hf.quat[3])
    // All in the head's own frame: origin at the head joint, Z towards the nose. The straps follow the skull's measured outline.
    const around = (table, th) => {
      const n = table.length
      const x = ((th / (Math.PI * 2)) * n + n) % n
      const i = Math.floor(x)
      const f = x - i
      const s = f * f * (3 - 2 * f)
      return lerp(table[i % n], table[(i + 1) % n], s)
    }
    const smoothTable = (T) => T.map((x, i) => (T[(i - 1 + T.length) % T.length] + 2 * x + T[(i + 1) % T.length]) / 4)
    const BROW = smoothTable([0.1044, 0.1052, 0.1045, 0.1013, 0.0944, 0.0855, 0.0791, 0.0746, 0.0729, 0.073, 0.0746, 0.0767, 0.0791, 0.0827, 0.0851, 0.0895, 0.0907, 0.0912, 0.0913, 0.0912, 0.0907, 0.0895, 0.0851, 0.0827, 0.0791, 0.0767, 0.0746, 0.073, 0.0729, 0.0746, 0.0791, 0.0855, 0.0944, 0.1013, 0.1045, 0.1052])
    const CROWN = smoothTable([0.0939, 0.0943, 0.0944, 0.0944, 0.0922, 0.0888, 0.0852, 0.0797, 0.0773, 0.0764, 0.0764, 0.0764, 0.0764, 0.0764, 0.0764, 0.0764, 0.0764, 0.0764, 0.0764, 0.0764, 0.0764, 0.0764, 0.0764, 0.0764, 0.0764, 0.0764, 0.0764, 0.0764, 0.0773, 0.0797, 0.0852, 0.0888, 0.0922, 0.0944, 0.0944, 0.0943])
    const tilt = 8 * DEG
    const browC = new V3(0, 0.085, 0)
    const browW = new V3(0, -Math.sin(tilt), Math.cos(tilt))
    const browN = new V3(0, Math.cos(tilt), Math.sin(tilt))
    const browAt = (th, off) => {
      const r = around(BROW, th) + off
      return browC.clone().addScaledVector(new V3(1, 0, 0), Math.sin(th) * r).addScaledVector(browW, Math.cos(th) * r)
    }
    const ringOf = (off, width, thick, m) =>
      memo(`hb${off}|${width}`, () => {
        const pts = []
        const W = []
        for (let i = 0; i < 96; i++) {
          pts.push(browAt((i / 96) * Math.PI * 2, off))
          W.push(browN)
        }
        return mesh(ribbonGeometry(pts, W, width, thick, { closed: true }), m)
      }).clone()
    const band = ringOf(0.003, 0.046, 0.0045, M.leather())
    const crown = memo('hcr', () => {
      // The strap over the top, ear to ear.
      const pts = []
      const W = []
      const c = new V3(0, 0.05, -0.012)
      for (let i = 0; i <= 40; i++) {
        const th = lerp(-1.18, 1.18, i / 40)
        const r = around(CROWN, (th + Math.PI * 2) % (Math.PI * 2)) + 0.0028
        pts.push(new V3(c.x + Math.sin(th) * r, c.y + Math.cos(th) * r, c.z))
        W.push(new V3(0, 0, 1))
      }
      return mesh(ribbonGeometry(pts, W, 0.026, 0.0034), M.leather())
    }).clone()
    // The padded panel on the forehead.
    const pad = memo('hpad', () => {
      const pts = []
      const W = []
      for (let i = 0; i <= 30; i++) {
        pts.push(browAt(lerp(-0.85, 0.85, i / 30) + Math.PI * 2, 0.0056))
        W.push(browN)
      }
      return mesh(ribbonGeometry(pts, W, 0.038, 0.0032), M.nylon())
    }).clone()
    const H = group(band, crown, pad)
    H.position.fromArray(hf.pos)
    H.quaternion.copy(q)
    outer.add(H)
    const toWorld = (w) => w.clone().applyQuaternion(q).add(v(hf.pos))
    // Rings at the temples, chains that pass the jaw and meet below the chin, one more run down to the plate.
    const rL = browAt(Math.PI / 2 + 0.04, 0.0085)
    const rR = browAt(-Math.PI / 2 - 0.04 + Math.PI * 2, 0.0085)
    const earL = toWorld(rL)
    const earR = toWorld(rR)
    const join = toWorld(new V3(0, -0.085, 0.17)).add(new V3(0, -(p.chinDrop ?? 0.3), 0))
    const lp = 0.024
    const lg = linkGeometry(lp, 0.017, 0.0042)
    const links = (a, b) => {
      const n = Math.max(1, Math.round(a.distanceTo(b) / lp))
      const t = b.clone().sub(a).normalize()
      for (let i = 0; i < n; i++) {
        const o = mesh(lg, M.chain())
        o.position.copy(a).lerp(b, (i + 0.5) / n)
        const w = new V3(1, 0, 0).addScaledVector(t, -t.x).normalize().applyAxisAngle(t, (i % 2 ? 45 : -45) * DEG)
        o.quaternion.copy(frameQ(t, w))
        outer.add(o)
      }
    }
    links(earL.clone().add(new V3(0, -0.012, 0).applyQuaternion(q)), join)
    links(earR.clone().add(new V3(0, -0.012, 0).applyQuaternion(q)), join)
    for (const e of [earL, earR]) {
      const rr = kit.torus(0.0125, 0.0026, M.hub(), [0, 0, 0], 'x')
      rr.position.copy(e)
      rr.quaternion.copy(q)
      outer.add(rr)
    }
    const d = kit.torus(0.018, 0.0034, M.hub(), [0, 0, 0], 'z')
    d.position.copy(join)
    outer.add(d)
    const kg = p.kg ?? 10
    const kind = p.kind ?? 'iron'
    const { t } = plateSize(kg, kind)
    const drop = p.drop ?? 0.14
    const hook = join.clone().add(new V3(0, -drop, 0))
    links(join.clone().add(new V3(0, -0.018, 0)), hook)
    // The plate hangs flat from a loading pin: its lower flange carries it.
    const pin = group(
      plainCyl(0.0125, -0.17, 0, M.brushed(), 18),
      rev([[0, -0.17], [0.05, -0.17, 0.003], [0.05, -0.162, 0.002], [0.0125, -0.16, 0.001]], M.brushed(), { arc: 2, seg: 30 }),
    )
    pin.position.copy(hook)
    pin.quaternion.copy(frameQ(new V3(0, 1, 0), new V3(1, 0, 0)))
    const pl = plateMesh(kg, kind)
    const plG = group(pl)
    plG.position.copy(hook).add(new V3(0, -0.16 + t / 2 + 0.001, 0))
    plG.quaternion.copy(frameQ(new V3(0, 1, 0), new V3(1, 0, 0)))
    const eyeR = kit.torus(0.012, 0.0032, M.hub(), [0, 0, 0], 'z')
    eyeR.position.copy(hook)
    outer.add(pin, plG, eyeR)
    return outer
  },

  'ankle-weight'(p, ctx) {
    const outer = new THREE.Group()
    outer.userData.world = true
    if (!ctx) return outer
    const s = p.foot
    const j = ctx.joints
    const a = v(j[`foot.${s}`])
    const k = v(j[`lowerleg01.${s}`])
    const up = k.clone().sub(a).normalize()
    const f = ctx.feet[s]
    const fw = v(f.forward).addScaledVector(up, -v(f.forward).dot(up)).normalize()
    const lat = up.clone().cross(fw).normalize()
    // The cuff sits where the shin is narrowest. From the mesh, 0.075 above the ankle joint: 0.05 wide, 0.076 deep, its
    // middle 0.01 outward and 0.008 back of the line from ankle to knee.
    const along = p.along ?? 0.088
    const sign = s === 'L' ? 1 : -1
    const c = a.clone().addScaledVector(up, along).addScaledVector(lat, sign * 0.009).addScaledVector(fw, -0.008)
    const q = new Q4().setFromRotationMatrix(new M4().makeBasis(lat, up, lat.clone().cross(up)))
    const pockets = 8
    const ra = 0.0266
    const rb = 0.039
    const thick = 0.0125
    const width = p.width ?? 0.074
    const skinAt = (th, ww) => {
      // A pad of sewn pockets: full between the seams, a narrow pinch at each. Square-ish in section, as stuffed fabric is.
      const seam = Math.abs(Math.sin((th * pockets) / 2))
      const pinch = 1 - 0.42 * Math.exp(-(seam * seam) / 0.012)
      const edge = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(ww), 3.4)), 1 / 3.4)
      const tk = thick * pinch * edge
      const r0 = 1 + tk / Math.hypot(ra * Math.sin(th), rb * Math.cos(th))
      return new V3(ra * Math.sin(th) * r0, (ww * width) / 2, rb * Math.cos(th) * r0)
    }
    const cuffG = memo(`ank${pockets}|${width}`, () => {
      const nTh = 144
      const nW = 18
      const grid = []
      for (let i = 0; i <= nTh; i++) {
        const row = []
        for (let w = 0; w <= nW; w++) row.push(skinAt((i / nTh) * Math.PI * 2, -1 + (2 * w) / nW))
        grid.push(row)
      }
      const pos = []
      const nor = []
      const uv = []
      const idx = []
      for (let i = 0; i <= nTh; i++) {
        for (let w = 0; w <= nW; w++) {
          const pp = grid[i][w]
          const du = grid[(i + 1) % nTh][w].clone().sub(grid[(i - 1 + nTh) % nTh][w])
          const dv = grid[i][Math.min(nW, w + 1)].clone().sub(grid[i][Math.max(0, w - 1)])
          const n = du.cross(dv).normalize()
          if (n.dot(new V3(pp.x, 0, pp.z)) < 0 && Math.abs(pp.y) < width * 0.48) n.negate()
          pos.push(pp.x, pp.y, pp.z)
          nor.push(n.x, n.y, n.z)
          uv.push((i / nTh) * 24, (w / nW) * 6)
        }
      }
      const row = nW + 1
      for (let i = 0; i < nTh; i++) {
        for (let w = 0; w < nW; w++) {
          const aa = i * row + w
          const b = (i + 1) * row + w
          idx.push(aa, b, aa + 1, b + 1, aa + 1, b)
        }
      }
      return makeGeometry(pos, nor, uv, idx)
    })
    const cuff = mesh(cuffG, M.neoprene())
    // The closing strap and its ring, on the outside of the leg.
    const side = sign * (Math.PI / 2)
    const strapPts = []
    const strapW = []
    for (let i = 0; i <= 28; i++) {
      const th = side + lerp(-0.95, 0.95, i / 28)
      const r0 = 1 + (thick + 0.0024) / Math.hypot(ra * Math.sin(th), rb * Math.cos(th))
      strapPts.push(new V3(ra * Math.sin(th) * r0, 0, rb * Math.cos(th) * r0))
      strapW.push(new V3(0, 1, 0))
    }
    const strap = mesh(memo(`ankStrap${sign}`, () => ribbonGeometry(strapPts, strapW, 0.042, 0.0026)), M.nylon())
    const ringPos = strapPts[0]
    const dr = kit.torus(0.0165, 0.0022, M.hub(), [ringPos.x, ringPos.y, ringPos.z], 'z')
    const G = group(cuff, strap, dr)
    G.position.copy(c)
    G.quaternion.copy(q)
    outer.add(G)
    return outer
  },
}

export default TYPES
