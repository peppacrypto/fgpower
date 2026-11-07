// Benches, racks, boxes, bars and bodyweight stations. Metres, Y up, floor at y = 0.
//
// EVERY NUMBER HERE IS LOCAL TO THE PROP: world = p.pos + (local turned by p.yaw). At yaw 0 a user faces +Z, so +X is the
// user's LEFT. The body numbers are measured on the figure: its back and buttocks lie 0.083 behind the root (root.pos, the point
// between the hip joints), the seat 0.10 under it, so a supine figure has its root 0.092 above a pad (the foam gives 1-2 cm), a
// seated one 0.10 above the seat. Shoulder joints are 0.46 along the trunk from the root, 0.19 to each side. Palm centre reaches 1.065 above the
// root in a dead hang. specs/_gallery/<type>.json has each type in use, start and end, with these numbers.
//
// BODY, the named export, computes all of this for any parameters, from the same numbers that build the prop:
//   node -e "import('./props/benches.js').then(m=>console.log(m.BODY['decline-bench']({angle:25})))"
//
// HANDS ON BARS. In the gallery a closed hand on a bar is { pos: <point on the bar's axis>, contact: true, fingers, palm, pole,
// curl: 0.82 }: `contact` puts the palm centre on that point. Bars in the hands: barbell { hands: true } from free-weights.
// Bars resting on something: its axis is at barY, a barbell's plates are clear of the uprights.
//
// ============================== BENCHES ==============================
// flat-bench { height 0.44, length 1.22, width 0.30, barY?, barZ -0.44, barX 0.56, uprights? }
//   Pad along Z, top at y = height, centred on z = 0. Head end is -Z. height works from 0.25 to 0.95 (lying-high-bench curls).
//   Supine, head on the pad, knees over the end: root [0, height+0.092, 0.20], pitch -90; shoulders z -0.26; soles [+-0.2, 0, 0.72].
//   Seated across or along it: root y = height + 0.10.
//   barY or uprights:true adds two posts with J-hooks (x = +-barX, posts behind the head): bar axis at [x, barY, barZ]. Default
//   barY 1.02 takes the bar off with nearly straight arms. Bar at lockout y 1.105, z -0.24; on the chest y 0.70, z -0.16.
// bench-rack: flat-bench with uprights on by default.
// adjustable-bench / incline-bench { angle 45 (0 flat..90 upright), seatAngle 0..25, uprights?, barY?, barZ?, barX 0.56 }
// shoulder-press-bench: the same with angle 82, seatAngle 10.
//   pos is the floor under the hinge between seat and back. Seat top y 0.442, seat z 0.012..0.312. Back pad 0.86 long from the
//   hinge, plane through backPoint with normal backNormal. A real ladder and strut: the strut's cross bar sits in a notch for each
//   15 degrees. Seated, back on the pad, pitch = angle - 90, root y 0.542:
//     angle   0: lying, root [0, 0.534, 0.03], shoulder y 0.534, z -0.43
//     angle  30: root z 0.034, shoulder [0.772, -0.364]        angle 45: root z 0.066, shoulder [0.867, -0.259]
//     angle  60: root z 0.099, shoulder [0.940, -0.131]        angle 75: root z 0.135, shoulder [0.986, 0.016]
//     angle  82: root z 0.154, shoulder [0.998, 0.091]         angle 90: root z 0.179, shoulder [1.002, 0.179]
//     ([y, z] pairs, x +-0.19.) Feet: soles [+-0.21, 0, 0.62], ahead of the front foot.
//   Uprights: default bar just below lockout over the shoulders, BODY gives barY, barZ. They stand on their own feet.
// decline-bench { angle 20 (5..35), uprights?, barY?, barZ?, barX 0.56 }  Press bench with shin rollers.
//   Pad 1.15 long, head end fixed at y 0.30, z -0.66, the seat end rises with the angle (telescoping post). root.pitch = -(90+angle).
//   angle 20: high end [y 0.693, z 0.421]; root [0, 0.658, 0.056]; shoulder [y 0.501, z -0.377]; ankles between the rollers at
//   [+-0.11, 0.358, 0.586] with foot pitch 25; rollers y 0.443 at z 0.481 and 0.691. Other angles: BODY.
// decline-situp-bench { angle 30 (0..50) }  Long narrow ab board for crunches and sit-ups, head end low, perforated spine.
//   root.pitch = -(90+angle). angle 30: high end [0.86, 0.25]; root [0, 0.75, -0.125]; ankles [+-0.1, 0.936, 0.426], foot pitch -5;
//   rollers (behind the Achilles, in front of the shin) [y, z] = [0.88, 0.325], [1.085, 0.43]. Knee pole [0.05, 1, 0.3].
// preacher-bench { height 0.995 (pad's upper edge), seatH 0.62, slope 45, seatZ -0.275 }
//   Arm pad's upper edge at [0, height, 0], running down toward +Z at `slope` from horizontal, one raked column in front of the
//   shins. root [0, seatH+0.10, -0.27], pitch 20, soles [+-0.17, 0, 0.12]; elbows [+-0.2, seatH+0.313, 0.127], on the pad. The bar runs
//   on an arc of 0.297 around the elbow, plus 0.03 up off the palm (give a mid frame, or the elbow drifts). Hand in line with the
//   forearm, palm up: BODY gives bar(deg) (deg 0 = forearm level, -38 bottom, +60 top). Rack cups hold a bar at y 0.907, z 0.335.
//   Spider curl lies on the rear (the -Z side of the pad).
//
// ============================== RACKS ==============================
// power-rack { width 1.20, depth 1.10, height 2.28, barY 1.38, pinY?, pegs true }
//   Four uprights at x +-width/2, z +-depth/2. The lifter is inside, facing +Z. J-hooks on the front uprights: bar axis at
//   [x, barY, depth/2 - 0.0825] = z 0.4675 by default. pinY adds safety pins front to back: a bar RESTING on them has its axis at
//   y = pinY, anywhere along z. Pull-up bar: y height-0.10 at z depth/2. Band pegs outside: low [+-0.6875, 0.039, +-0.3], high
//   [+-0.6875, height-0.10, +-0.3]. Bench in the rack: rack yaw 180, so the hooks are at the head end. frameIgnore keeps the
//   figure large and lets the rack run out of the frame.
// squat-stand { width 1.20, height 1.85, barY 1.38, pinY? }
//   Two uprights at x +-width/2, z 0. The lifter faces +Z at the -Z side. Bar axis on the hooks [x, barY, -0.075]. pinY adds spotter
//   arms reaching to z -0.62; a bar resting on them has its axis at y = pinY.
//
// ============================== BOXES AND PLATFORMS ==============================
// plyo-box { height 0.5, width 0.6, depth 0.5, style 'wood'|'steel'|'frame'|'foam', taper 0.26 }  Top at y = height, centred.
//   'frame' is the low open steel box, used in pairs for plyometric push-ups: height 0.3, width 0.42, depth 0.42.
// squat-box { height 0.40, width 0.46, depth 0.42 }  Timber box. Seated: root [0, height+0.105, 0.02] relative to the box, pitch ~24.
// pull-blocks / lifting-blocks { height 0.30, spread 1.44, width 0.38, depth 0.56, course 0.15 }  Two stacks of crates under the
//   plates at x +-spread/2. Top at y = height, so a bar with 450 mm plates has its axis at height + 0.225.
// foot-anchor { height 0.13 (clear under the roller), width 0.56 }  Roller axis y height+0.05 at z 0; open on the -Z side where the
//   user is. Sit-up: root [0, 0.094, -0.5], pitch -90, soles [+-0.11, 0, 0.03]. Nordic: kneel with ankles [+-0.11, 0.1, 0].
// calf-block { height 0.10, width 0.50, depth 0.24, rail?, railY 1.2, style 'board' }  Rubber deck, toes toward +Z, rear edge at
//   z -depth/2. Foot { pos: [+-0.11, height, -0.07], anchor: 'ball' }. rail:true adds a post with a T-handle: hand centres
//   [+-0.24, railY+0.01, 0.33]. style 'board' is the plain 65 mm wooden board.
// step-platform { height 0.20, width 1.00, depth 0.38 }  Long axis X, top at y = height, on stacked risers.
// deficit-platform { height 0.075, width 0.90, depth 0.70 }  Top at y = height. Plates at x +-0.7 clear it and stay on the floor.
// floor-mat { length 1.9, width 0.75, thickness 0.012, style 'mat'|'gym', panels 3, roll? }  Along Z, top at y = thickness. Lying:
//   add thickness to the root. 'gym' is a 50 mm folding mat.
// press-board { boards 2, length 0.36, follow: 'chest', offset [0, 0, 0.186] }  2x6 stack. With follow it rides the sternum in every
//   frame; each board is 0.038. Without follow it lies on the floor at p.pos.
//
// ============================== BARS AND STATIONS ==============================
// pull-up-bar { height 2.25, width 1.22, mount 'free'|'rack'|'wall', multi?, wallZ -0.5 }  32 mm bar along X at y = height, z = 0.
//   Dead hang: root y = height-1.065 (1.185), soles 0.15 clear with the knees a little bent. Overhand hand { pos: [+-0.33, height, 0], fingers [0,1,0], palm [0,0,1] }.
//   multi:true adds neutral grips forward of the bar at x +-0.20 and +-0.32, z 0.13, and angled ends.
// v-handle  Hangs over a bar running along Z (a pull-up-bar at yaw 90). p.pos is the point on the bar's axis, NOT the floor. Hand
//   centres at pos + [+-0.116, -0.147, 0], grip direction [+-0.68, -0.73, 0]. Top: root y 1.42 at most, the head stops under the bar.
// parallel-bars { height 1.30, length 2.20, spacing 0.56, rail 'steel'|'wood' }  Bars along Z at x +-spacing/2, axis y = height,
//   r 0.0255. Support: palm { pos: [+-0.28, height+0.022, 0], fingers [-+0.25,0,1], palm [0,-1,0] }, root y height+0.09 at lockout,
//   height-0.16 at the bottom of a dip. Knees bent, the soles clear the floor.
// dip-station { height 1.25, spacing 0.56 }  One bent tube closes behind the hips at z -0.42, open at z +0.30. Numbers as above.
// captains-chair { padY 1.30, dips true }  Forearm pads at x +-0.225, top y = padY, z -0.24+0.07..+0.44. Back pad face z = -0.16.
//   root [0, padY-0.156, -0.075], pitch 0, soles 0.14 clear. Elbows on the pads [+-0.225, padY+0.045, -0.05]. Handles upright: hand
//   { pos: [+-0.225, padY+0.10, 0.29], fingers [0,0,1], palm [-+1,0,0], pole [+-0.15,-1,-0.15] }. Steps at y 0.375. Dip bars y padY-0.42.
// roman-chair-45 / hyperextension-bench { angle 45 (20..70) }  Feet low at -Z, head up toward +Z. root [0, 0.90, 0], pitch = angle.
//   Soles on the plate at [+-0.1, 0.242, -0.658], foot pitch = angle, pole [+-0.05,-0.7,0.7]. Pad faces 0.10 from the body axis;
//   their top edge is 0.16 below the hip, so the waist folds past it. Bottom: same root, pitch 82, spine.flex 34.
// roman-chair-90 { hipY 0.95 }  Body level. root [0, hipY, 0], pitch 90. Pad top hipY-0.10, z -0.46..-0.16. Soles [+-0.1, hipY, -0.93],
//   foot pitch 90. Bottom: same root, pitch 134, spine.flex 36; head 0.18 above the floor.
// ghd { padY 1.005, drumR 0.15 }  Drums axis [y padY-0.15, z 0.02]. Plate faces +Z at z -0.64. Ankles [+-0.1, padY+0.025, -0.57], foot
//   pitch 90, toes 90, between two pairs of rollers. Knee stays at [y padY+0.045, z -0.13], just behind the drum. Bottom: root
//   [0, 1.159, 0.276], pitch 105. Top: root [0, 1.47, -0.12], pitch 0. Mid: root on the arc around the knee, or it cuts the drum.
// donkey-calf { follow: true }  Block top y 0.13, rear edge z 0.04, toes +Z. Foot { pos: [+-0.1, 0.13, 0.08], anchor: 'ball' }.
//   root [0, 1.0..1.13, -0.01], pitch 82. Hand centres [+-0.264, 0.88, 0.88]. With follow the padded lever rides on the lower back
//   (ctx.frames.pelvis + [0, 0.11, -0.09]), pivoting on the tower at [0, 1.27, -0.62]. Without it the pad rests at padY.
//
// ============================== STRAPS AND ROPE (WORLD COORDINATES WHEN FOLLOWING) ==============================
// suspension-trainer { hands: true | 'L' | 'R', feet: true | 'L' | 'R', anchor [0, 2.4, 0] (WORLD), mount true }
//   Rubber handle along the hand's thumb direction through ctx.hands.X.centre, a webbing triangle up to a cam buckle, one strap to
//   the anchor. feet: a sling round the foot. Straps do not stretch: keep |hand - anchor| the same in all frames (gallery: 1.21) and
//   give the hand fingers along the strap. Pass frameIgnore on the prop: the straps then leave the top of the frame, the figure stays
//   large. mount: false drops the overhead beam. Without hands or feet it hangs at p.pos, handles at handleY.
// gym-rings { hands: true, anchorL, anchorR (WORLD) or anchor + spread 0.5, mount true }
//   The ring's lower arc passes through ctx.hands.X.centre, in the plane of the strap and the thumb. So give a neutral hand (thumb
//   forward) to keep the rings beside the body: { pos: [0.255, 1.22, 0.02], fingers [0.28,-0.82,0.5], palm [-0.8,-0.5,-0.3] }. Lockout
//   root y 1.30, bottom 1.08, same hand position. Anchors wider than the shoulders (+-0.30), or the straps cut the deltoids.
//   Without hands the rings hang at p.pos, lowest point p.ringY.
// climb-rope { pos (rope's x, z), top 4, radius 0.019, hands: true | 'L' | 'R', foot: 'L' | 'R', coil true, coilDir [0, -1] }
//   Three-strand rope, from a steel eye at y = top. With hands it runs through both hand centres, higher hand first; with foot it
//   goes on past that foot before falling to a coil on the floor. Put both hands at x, z of the rope. frameIgnore keeps the camera in.
//
// Materials: never black on black: pads and rubber are charcoal, frames graphite powder coat, chrome only where the real thing is.
import { kit, mat } from './kit.js'

const { THREE, mesh, rbox, cyl, lathe, between, sphere, torus } = kit
const { Vector3: V3, Quaternion: Q4, Matrix4: M4, Matrix3: M3 } = THREE
const D = Math.PI / 180
const std = (o) => new THREE.MeshStandardMaterial(o)

// ---------------------------------------------------------------------------------------------------------------------
// Materials. New ones are local: the shared kit.mat is never changed.
// ---------------------------------------------------------------------------------------------------------------------
const M = {
  // Powder coat, not bare metal: a low metalness keeps it readable from every angle instead of flashing white at grazing views.
  frame: std({ color: 0x505257, metalness: 0.2, roughness: 0.6, envMapIntensity: 0.7 }),
  frameLight: std({ color: 0x74777d, metalness: 0.25, roughness: 0.54, envMapIntensity: 0.8 }),
  frameDark: std({ color: 0x38393d, metalness: 0.2, roughness: 0.6, envMapIntensity: 0.7 }),
  chrome: mat.chrome,
  steel: mat.steel,
  knurl: std({ color: 0x5f6368, metalness: 0.7, roughness: 0.78, envMapIntensity: 0.8 }),
  pad: std({ color: 0x323236, metalness: 0, roughness: 0.64, envMapIntensity: 0.45, vertexColors: true }),
  vinyl: std({ color: 0x323236, metalness: 0, roughness: 0.64, envMapIntensity: 0.45 }),
  foam: std({ color: 0x38383c, metalness: 0, roughness: 0.6, vertexColors: true }),
  rubber: std({ color: 0x28282b, metalness: 0, roughness: 0.78 }),
  rubberTop: std({ color: 0x323235, metalness: 0, roughness: 0.84, vertexColors: true }),
  paint: std({ color: 0x505257, metalness: 0.2, roughness: 0.6, envMapIntensity: 0.7, vertexColors: true }),
  grip: std({ color: 0x2c2c2f, metalness: 0, roughness: 0.66 }),
  cap: std({ color: 0x242427, metalness: 0, roughness: 0.62 }),
  hole: std({ color: 0x050506, metalness: 0, roughness: 0.95 }),
  holeRim: std({ color: 0x6f7277, metalness: 0.7, roughness: 0.4 }),
  liner: std({ color: 0x77797c, metalness: 0, roughness: 0.6 }),
  wood: std({ color: 0x5c554b, metalness: 0, roughness: 0.68 }),
  woodEnd: std({ color: 0x7d7568, metalness: 0, roughness: 0.74 }),
  woodDark: std({ color: 0x423d36, metalness: 0, roughness: 0.72 }),
  strap: std({ color: 0x46474c, metalness: 0, roughness: 0.86 }),
  strapDark: std({ color: 0x303134, metalness: 0, roughness: 0.86 }),
  rope: std({ color: 0x8f8775, metalness: 0, roughness: 0.92 }),
  ropeLight: std({ color: 0xa79e8a, metalness: 0, roughness: 0.92 }),
  ropeTape: std({ color: 0x2c2c2f, metalness: 0, roughness: 0.6 }),
  ring: std({ color: 0x847b6d, metalness: 0, roughness: 0.46 }),
  mat: std({ color: 0x3a3a3f, metalness: 0, roughness: 0.82, vertexColors: true }),
  deck: std({ color: 0x3b3b3e, metalness: 0, roughness: 0.78, vertexColors: true }),
  plastic: std({ color: 0x45464a, metalness: 0, roughness: 0.5 }),
  stamp: std({ color: 0x1a1a1c, metalness: 0, roughness: 0.8 }),
}

// ---------------------------------------------------------------------------------------------------------------------
// Geometry helpers. Everything static goes through this cache, so a prop rebuilt for every frame costs almost nothing.
// ---------------------------------------------------------------------------------------------------------------------
const geoCache = new Map()
const cached = (key, make) => {
  let g = geoCache.get(key)
  if (!g) {
    g = make()
    geoCache.set(key, g)
  }
  return g
}

const vec = (a) => new V3(a[0], a[1], a[2])
const Y = new V3(0, 1, 0)

function G(...items) {
  const g = new THREE.Group()
  const add = (x) => {
    if (!x) return
    if (Array.isArray(x)) x.forEach(add)
    else g.add(x)
  }
  items.forEach(add)
  return g
}

/** Orthonormal basis with local Y along dir and local X as close to `side` as possible. */
function basisQ(dir, side) {
  const y = vec(dir).normalize()
  let s = side ? vec(side) : new V3(1, 0, 0)
  if (Math.abs(s.clone().normalize().dot(y)) > 0.92) s = new V3(0, 0, 1)
  const x = s.addScaledVector(y, -s.dot(y)).normalize()
  const z = x.clone().cross(y)
  return new Q4().setFromRotationMatrix(new M4().makeBasis(x, y, z))
}

function placed(g, m, pos, q) {
  const o = mesh(g, m)
  if (pos) o.position.set(pos[0], pos[1], pos[2])
  if (q) o.quaternion.copy(q)
  return o
}

function aim(o, pos, dir, side) {
  o.position.set(pos[0], pos[1], pos[2])
  o.quaternion.copy(basisQ(dir, side))
  return o
}

/**
 * Rounded rectangle outline in the XZ plane, angle increasing from +X toward +Z. tilt (degrees) bends the normals of the flat
 * faces a little, as if they were very slightly convex: a dead flat face mirrors a light all at once and flashes white as a whole,
 * a face that is even a little crowned shows a soft gradient instead, the way a real painted tube does.
 */
function rrOutline(w, d, r, n = 4, tilt = 0) {
  const hw = w / 2
  const hd = d / 2
  const rr = Math.min(r, hw - 1e-4, hd - 1e-4)
  const out = []
  const corners = [
    [hw - rr, hd - rr, 0],
    [-hw + rr, hd - rr, 90],
    [-hw + rr, -hd + rr, 180],
    [hw - rr, -hd + rr, 270],
  ]
  for (const [cx, cz, base] of corners) {
    for (let i = 0; i <= n; i++) {
      const a = (base + (i * 90) / n) * D
      const b = (base + tilt + (i * (90 - 2 * tilt)) / n) * D
      out.push({ x: cx + Math.cos(a) * rr, z: cz + Math.sin(a) * rr, nx: Math.cos(b), nz: Math.sin(b) })
    }
  }
  return out
}

/** A square or rectangular tube of unit length along +Y from y = 0, scaled to length by its mesh. */
function tubeGeo(w, d, r) {
  return cached(`tube${w},${d},${r}`, () => {
    const o = rrOutline(w, d, r, 4, 7)
    const n = o.length
    const pos = []
    const nor = []
    const idx = []
    for (const y of [0, 1]) {
      for (const p of o) {
        pos.push(p.x, y, p.z)
        nor.push(p.nx, 0, p.nz)
      }
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      idx.push(i, i + n, j, j, i + n, j + n)
    }
    for (const [y, ny] of [[0, -1], [1, 1]]) {
      const c = pos.length / 3
      pos.push(0, y, 0)
      nor.push(0, ny, 0)
      const s = pos.length / 3
      for (const p of o) {
        pos.push(p.x, y, p.z)
        nor.push(0, ny, 0)
      }
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n
        if (ny > 0) idx.push(c, s + j, s + i)
        else idx.push(c, s + i, s + j)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
    g.setIndex(idx)
    return g
  })
}

/**
 * A weld bead around a rectangular tube where it meets a surface: a small tube swept along the tube's outline. The bead lies on
 * the plane through the local origin with local normal nl (default the tube's own axis), so a raked tube gets a raked bead.
 */
function weldRingGeo(w, d, r, b, nl = [0, 1, 0]) {
  const key = nl.map((q) => q.toFixed(3)).join()
  return cached(`weld${w},${d},${r},${b},${key}`, () => {
    const o = rrOutline(w + b * 0.6, d + b * 0.6, r + b * 0.3, 3)
    const n = o.length
    const seg = 6
    const pos = []
    const nor = []
    const idx = []
    const up = new V3(...nl).normalize()
    for (const p of o) {
      const yy = Math.abs(up.y) > 1e-3 ? -(up.x * p.x + up.z * p.z) / up.y : 0
      for (let k = 0; k < seg; k++) {
        const a = (k / seg) * 2 * Math.PI
        const cr = Math.cos(a)
        const sr = Math.sin(a)
        pos.push(p.x + (p.nx * b * 0.5 * cr + up.x * b * 0.6 * sr), yy + up.y * b * 0.6 * sr, p.z + (p.nz * b * 0.5 * cr + up.z * b * 0.6 * sr))
        nor.push(p.nx * cr + up.x * sr, up.y * sr, p.nz * cr + up.z * sr)
      }
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      for (let k = 0; k < seg; k++) {
        const l = (k + 1) % seg
        idx.push(i * seg + k, i * seg + l, j * seg + k, j * seg + k, i * seg + l, j * seg + l)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
    g.setIndex(idx)
    return g
  })
}

/**
 * A rectangular steel tube from a to b. w is the size across, along `side` (default: world X, or world Z for a tube along X),
 * d the size the other way. cap / capA / capB plug an end with a plastic cap; weld / weldA / weldB add a weld bead there.
 */
function beam(a, b, w, d, m = M.frame, o = {}) {
  const A = vec(a)
  const B = vec(b)
  const dir = B.clone().sub(A)
  const len = dir.length() || 1e-4
  dir.normalize()
  const side = o.side || (Math.abs(dir.x) > 0.7 ? [0, 0, 1] : [1, 0, 0])
  const q = basisQ(dir.toArray(), side)
  const r = o.r ?? Math.min(w, d) * 0.12
  const body = mesh(tubeGeo(w, d, r), m)
  body.position.copy(A)
  body.quaternion.copy(q)
  body.scale.set(1, len, 1)
  const parts = [body]
  const endCap = (P, along) => {
    const c = rbox(+(w + 0.0016).toFixed(4), 0.012, +(d + 0.0016).toFixed(4), 0.0035, M.cap, undefined, 2)
    const qq = q.clone()
    c.quaternion.copy(qq)
    c.position.copy(P).addScaledVector(dir, along * 0.005)
    return c
  }
  if (o.capA || o.cap) parts.push(endCap(A, -1))
  if (o.capB || o.cap) parts.push(endCap(B, 1))
  // weldA / weldB: true for a bead square to the tube at that end, or [nx, ny, nz] for one on the plane with that normal, through
  // the point where the tube's axis crosses it. weldAt: [{ p, n }] adds beads anywhere along the tube.
  const qi = q.clone().invert()
  const bead = (P, nrm) => {
    const nl = nrm ? vec(nrm).normalize().applyQuaternion(qi).toArray() : [0, 1, 0]
    const w2 = mesh(weldRingGeo(w, d, r, o.bead ?? 0.0055, nl), m)
    w2.position.copy(P)
    w2.quaternion.copy(q)
    return w2
  }
  if (o.weldA || o.weld) parts.push(bead(A, Array.isArray(o.weldA) ? o.weldA : null))
  if (o.weldB || o.weld) parts.push(bead(B, Array.isArray(o.weldB) ? o.weldB : null))
  for (const wa of o.weldAt || []) parts.push(bead(vec(wa.p), wa.n))
  return parts
}

/** A torus whose axis is local Y, ready to aim along a direction. */
const ringY = (R, r, seg = 28) =>
  cached(`ringY${R},${r},${seg}`, () => {
    const g = new THREE.TorusGeometry(R, r, 10, seg)
    g.rotateX(Math.PI / 2)
    return g
  })

/** Round bar from a to b. Options as for beam. */
function rod(a, b, r, m = M.steel, o = {}) {
  const parts = [between(a, b, r, m, o.seg ?? 24)]
  const A = vec(a)
  const B = vec(b)
  const dir = B.clone().sub(A).normalize()
  const domed = (P, s) => aim(lathe(capProfile(r), M.cap, [0, 0, 0]), P.toArray(), dir.clone().multiplyScalar(s).toArray())
  if (o.capA || o.cap) parts.push(domed(A, -1))
  if (o.capB || o.cap) parts.push(domed(B, 1))
  const weld = (P) => aim(mesh(ringY(+(r + 0.001).toFixed(4), 0.0035), m), P.toArray(), dir.toArray())
  if (o.weldA || o.weld) parts.push(weld(A))
  if (o.weldB || o.weld) parts.push(weld(B))
  return parts
}
const capProfile = (r) => {
  const R = +(r + 0.0012).toFixed(4)
  return [[0.0001, -0.001], [R, -0.001], [R, 0.004], [+(R * 0.86).toFixed(4), 0.009], [+(R * 0.5).toFixed(4), 0.0125], [0.0001, 0.0135]]
}

/** Replaces the corners of a polyline with circular arcs. */
function filletPath(pts, rad, n = 10) {
  const P = pts.map(vec)
  const out = [P[0]]
  for (let i = 1; i + 1 < P.length; i++) {
    const b = P[i]
    const u = P[i - 1].clone().sub(b)
    const v = P[i + 1].clone().sub(b)
    const lu = u.length()
    const lv = v.length()
    u.normalize()
    v.normalize()
    const ang = Math.acos(Math.max(-1, Math.min(1, u.dot(v))))
    if (ang > Math.PI - 1e-3) {
      out.push(b)
      continue
    }
    const r0 = Array.isArray(rad) ? rad[i - 1] : rad
    const tan = Math.tan(ang / 2)
    const t = Math.min(r0 / tan, lu * 0.49, lv * 0.49)
    const r = t * tan
    const c = b.clone().add(u.clone().add(v).normalize().multiplyScalar(r / Math.sin(ang / 2)))
    const s = b.clone().addScaledVector(u, t).sub(c)
    const e = b.clone().addScaledVector(v, t).sub(c)
    const sweep = Math.acos(Math.max(-1, Math.min(1, s.clone().normalize().dot(e.clone().normalize()))))
    for (let k = 0; k <= n; k++) {
      const f = k / n
      const v1 = s.clone().multiplyScalar(Math.sin((1 - f) * sweep) / Math.sin(sweep)).add(e.clone().multiplyScalar(Math.sin(f * sweep) / Math.sin(sweep)))
      out.push(c.clone().add(v1))
    }
  }
  out.push(P[P.length - 1])
  return out
}

/** A tube swept along a dense polyline, with parallel-transported rings and closed ends. */
function sweepGeo(points, r, seg = 18, ends = true) {
  const n = points.length
  const pos = []
  const nor = []
  const idx = []
  const T = []
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)]
    const b = points[Math.min(n - 1, i + 1)]
    T.push(b.clone().sub(a).normalize())
  }
  let N = new V3(0, 1, 0)
  if (Math.abs(N.dot(T[0])) > 0.9) N = new V3(1, 0, 0)
  N.addScaledVector(T[0], -N.dot(T[0])).normalize()
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const q = new Q4().setFromUnitVectors(T[i - 1], T[i])
      N.applyQuaternion(q).addScaledVector(T[i], -N.dot(T[i])).normalize()
    }
    const Bn = T[i].clone().cross(N)
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * 2 * Math.PI
      const nx = N.x * Math.cos(a) + Bn.x * Math.sin(a)
      const ny = N.y * Math.cos(a) + Bn.y * Math.sin(a)
      const nz = N.z * Math.cos(a) + Bn.z * Math.sin(a)
      pos.push(points[i].x + nx * r, points[i].y + ny * r, points[i].z + nz * r)
      nor.push(nx, ny, nz)
    }
  }
  for (let i = 0; i + 1 < n; i++) {
    for (let k = 0; k < seg; k++) {
      const l = (k + 1) % seg
      const a = i * seg + k
      const b = i * seg + l
      const c = (i + 1) * seg + k
      const d = (i + 1) * seg + l
      idx.push(a, c, b, b, c, d)
    }
  }
  if (ends) {
    for (const [i, s] of [[0, -1], [n - 1, 1]]) {
      const c = pos.length / 3
      pos.push(points[i].x, points[i].y, points[i].z)
      nor.push(T[i].x * s, T[i].y * s, T[i].z * s)
      const st = pos.length / 3
      for (let k = 0; k < seg; k++) {
        pos.push(pos[(i * seg + k) * 3], pos[(i * seg + k) * 3 + 1], pos[(i * seg + k) * 3 + 2])
        nor.push(T[i].x * s, T[i].y * s, T[i].z * s)
      }
      for (let k = 0; k < seg; k++) {
        const l = (k + 1) % seg
        if (s > 0) idx.push(c, st + k, st + l)
        else idx.push(c, st + l, st + k)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setIndex(idx)
  return g
}

/** A bent round tube through corner points, with bends of the given radius. */
function bentRod(pts, r, m = M.frame, { bend = 0.06, seg = 20, capA, capB, cap } = {}) {
  const key = `bent${JSON.stringify(pts)},${r},${JSON.stringify(bend)},${seg}`
  const g = cached(key, () => sweepGeo(filletPath(pts, bend), r, seg))
  const parts = [mesh(g, m)]
  const P = pts.map(vec)
  const n = P.length
  const dome = (Q, dir) => aim(lathe(capProfile(r), M.cap, [0, 0, 0]), Q.toArray(), dir.toArray())
  if (capA || cap) parts.push(dome(P[0], P[0].clone().sub(P[1]).normalize()))
  if (capB || cap) parts.push(dome(P[n - 1], P[n - 1].clone().sub(P[n - 2]).normalize()))
  return parts
}

/** Merges geometries into one, for many small identical parts such as adjustment holes. */
function mergeGeos(list) {
  const pos = []
  const nor = []
  const v = new V3()
  for (const [g0, m] of list) {
    const g = g0.index ? g0.toNonIndexed() : g0
    const p = g.attributes.position
    const n = g.attributes.normal
    const nm = new M3().getNormalMatrix(m)
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m)
      pos.push(v.x, v.y, v.z)
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize()
      nor.push(v.x, v.y, v.z)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  return g
}

/**
 * One column of adjustment holes on the faces of an upright of section s: axis along Y through the local origin, holes from
 * y0 to y1 every `step` on the faces listed ('x','-x','z','-z'). Holes are dark discs with a thin bright chamfer, flush with
 * the face. Returns two meshes: discs and rims.
 */
function holeColumn(s, y0, y1, step, faces = ['x', '-x', 'z', '-z'], r = 0.0105) {
  const key = `holes${s},${y0},${y1},${step},${faces.join()},${r}`
  const mk = (rad, h, ky) =>
    cached(key + ky, () => {
      const disc = new THREE.CylinderGeometry(rad, rad, h, 18)
      const list = []
      const off = s / 2
      for (let y = y0; y <= y1 + 1e-6; y += step) {
        for (const f of faces) {
          const m = new M4()
          const nrm = { x: [1, 0, 0], '-x': [-1, 0, 0], z: [0, 0, 1], '-z': [0, 0, -1] }[f]
          m.compose(new V3(nrm[0] * off, y, nrm[2] * off), new Q4().setFromUnitVectors(Y, vec(nrm)), new V3(1, 1, 1))
          list.push([disc, m])
        }
      }
      return mergeGeos(list)
    })
  const rim = mesh(mk(r + 0.0022, 0.0006, 'r'), M.holeRim)
  const hole = mesh(mk(r, 0.0012, 'h'), M.hole)
  rim.castShadow = false
  hole.castShadow = false
  return [rim, hole]
}

/** Flat plate in the Y-Z plane at x, from a [z, y] polygon with optional round cut-outs [z, y, r]. */
function plateYZ(points, x, t, m = M.frame, holes = [], bevel = 0.0012) {
  const key = `pyz${JSON.stringify(points)},${t},${JSON.stringify(holes)},${bevel}`
  const g = cached(key, () => {
    const s = new THREE.Shape()
    points.forEach(([a, b], i) => (i ? s.lineTo(a, b) : s.moveTo(a, b)))
    s.closePath()
    for (const [a, b, r] of holes) {
      const h = new THREE.Path()
      h.absarc(a, b, r, 0, Math.PI * 2, true)
      s.holes.push(h)
    }
    const e = new THREE.ExtrudeGeometry(s, { depth: t - 2 * bevel, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 20 })
    e.translate(0, 0, -(t - 2 * bevel) / 2)
    e.rotateY(-Math.PI / 2)
    return e
  })
  const o = mesh(g, m)
  o.position.x = x
  return o
}

/** Flat plate in the X-Y plane at z, from an [x, y] polygon with optional round cut-outs [x, y, r]. */
function plateXY(points, z, t, m = M.frame, holes = [], bevel = 0.0012) {
  const key = `pxy${JSON.stringify(points)},${t},${JSON.stringify(holes)},${bevel}`
  const g = cached(key, () => {
    const s = new THREE.Shape()
    points.forEach(([a, b], i) => (i ? s.lineTo(a, b) : s.moveTo(a, b)))
    s.closePath()
    for (const [a, b, r] of holes) {
      const h = new THREE.Path()
      h.absarc(a, b, r, 0, Math.PI * 2, true)
      s.holes.push(h)
    }
    const e = new THREE.ExtrudeGeometry(s, { depth: t - 2 * bevel, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 20 })
    e.translate(0, 0, -(t - 2 * bevel) / 2)
    return e
  })
  const o = mesh(g, m)
  o.position.z = z
  return o
}

/**
 * An upholstered pad: flat base at y = 0, side wall with a slight bulge, rolled top edge, soft crown and a stitched seam line
 * that follows the outline. Runs along Z. Built on a grid that clusters near the edges, so the rolled edge and the seam are
 * smooth; `warp` bends the finished shape ([x, y, z] => [x, y, z], give it a `warpKey`). grooves: [{z, width, depth}] or
 * [{x, width, depth}] are sewn creases across the pad. Vertex colours darken the seams, so use a vertexColors material.
 */
function padGeo(o) {
  const { w, l, t, rc = 0.03, edge = 0.022, crown = 0.008, seam = 0.024, seamDepth = 0.0024, grooves = [], bulge = 0.0035, warp = null, warpKey = '', tone = 1 } = o
  const key = `pad${w},${l},${t},${rc},${edge},${crown},${seam},${seamDepth},${JSON.stringify(grooves)},${bulge},${warpKey},${tone}`
  return cached(key, () => {
    const hw = w / 2
    const hl = l / 2
    const lines = (h, step, extra) => {
      const near = [0, 0.0012, 0.003, 0.0055, 0.0085, 0.012, 0.016, 0.021, 0.027, 0.034, 0.042, 0.052, 0.064]
      if (seam > 0) near.push(seam - 0.0035, seam - 0.0018, seam, seam + 0.0018, seam + 0.0035)
      const lim = h * 0.7
      const vals = []
      let last = 0
      for (const d of near) {
        if (d <= lim) {
          vals.push(-h + d, h - d)
          last = Math.max(last, d)
        }
      }
      const inner = h - last
      const n = Math.max(1, Math.ceil((2 * inner) / step))
      for (let i = 1; i < n; i++) vals.push(-inner + (2 * inner * i) / n)
      for (const e of extra) vals.push(e)
      vals.sort((a, b) => a - b)
      const out = []
      for (const v of vals) if (!out.length || v - out[out.length - 1] > 4e-4) out.push(v)
      return out
    }
    const grooveLines = (key2) => {
      const ex = []
      for (const g of grooves) {
        if (g[key2] === undefined) continue
        const s = g.width
        for (const f of [-2.2, -1.2, -0.6, 0, 0.6, 1.2, 2.2]) ex.push(g[key2] + f * s)
      }
      return ex
    }
    const xs = lines(hw, 0.024, grooveLines('x'))
    const zs = lines(hl, 0.03, grooveLines('z'))
    const nx = xs.length
    const nz = zs.length
    const cx = hw - rc
    const cz = hl - rc
    const pos = []
    const col = []
    const idx = []
    const topY = (d, x, z) => {
      const base = t - crown - edge
      const e = d < edge ? Math.sqrt(Math.max(0, 1 - (1 - d / edge) ** 2)) * edge : edge
      // The crown is smooth across the pad and along it: no ridges running in from the corners.
      const f = (1 - Math.abs(x / hw) ** 2.2) * (1 - Math.abs(z / hl) ** 4)
      let y = base + e + crown * f
      let c = 1
      if (seam > 0) {
        const g = Math.exp(-(((d - seam) / 0.0017) ** 2))
        y -= seamDepth * g
        c *= 1 - 0.62 * g
      }
      for (const g of grooves) {
        const u = g.z !== undefined ? z - g.z : x - g.x
        const k = Math.exp(-((u / g.width) ** 2))
        y -= g.depth * k
        c *= 1 - 0.6 * k
      }
      return [y, c]
    }
    const map = (x, z) => {
      const ax = Math.abs(x)
      const az = Math.abs(z)
      if (ax > cx && az > cz) {
        const dx = ax - cx
        const dz = az - cz
        const s = Math.max(dx, dz) / Math.hypot(dx, dz)
        return [Math.sign(x) * (cx + dx * s), Math.sign(z) * (cz + dz * s)]
      }
      return [x, z]
    }
    const distIn = (x, z) => {
      const qx = Math.abs(x) - cx
      const qz = Math.abs(z) - cz
      return -(Math.min(Math.max(qx, qz), 0) + Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) - rc)
    }
    const at = (i, j) => i * nz + j
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const [x, z] = map(xs[i], zs[j])
        const d = Math.max(0, distIn(x, z))
        const [y, c] = topY(d, x, z)
        pos.push(x, y, z)
        col.push(c * tone, c * tone, c * tone)
      }
    }
    for (let i = 0; i + 1 < nx; i++) {
      for (let j = 0; j + 1 < nz; j++) {
        const a = at(i, j)
        const b = at(i, j + 1)
        const c = at(i + 1, j)
        const d = at(i + 1, j + 1)
        idx.push(a, b, c, c, b, d)
      }
    }
    // Boundary loop of the top sheet, then the side wall going down.
    const loop = []
    for (let i = 0; i < nx; i++) loop.push(at(i, 0))
    for (let j = 1; j < nz; j++) loop.push(at(nx - 1, j))
    for (let i = nx - 2; i >= 0; i--) loop.push(at(i, nz - 1))
    for (let j = nz - 2; j >= 1; j--) loop.push(at(0, j))
    const nL = loop.length
    const rows = 7
    const base = t - crown - edge
    let prev = loop
    for (let r = 1; r <= rows; r++) {
      const yn = 1 - r / rows
      const row = []
      for (const k of loop) {
        const x = pos[k * 3]
        const z = pos[k * 3 + 2]
        const qx = Math.abs(x) - cx
        const qz = Math.abs(z) - cz
        let ox = 0
        let oz = 0
        if (qx > 0 && qz > 0) {
          const h = Math.hypot(qx, qz) || 1
          ox = (Math.sign(x) * qx) / h
          oz = (Math.sign(z) * qz) / h
        } else if (qx > qz) ox = Math.sign(x)
        else oz = Math.sign(z)
        const off = bulge * Math.sin(Math.PI * yn) - 0.003 * (1 - yn) ** 3
        row.push(pos.length / 3)
        pos.push(x + ox * off, base * yn, z + oz * off)
        const c = yn < 0.14 ? 0.55 : 0.9
        col.push(c * tone, c * tone, c * tone)
      }
      for (let i = 0; i < nL; i++) {
        const j = (i + 1) % nL
        idx.push(row[i], prev[i], row[j], row[j], prev[i], prev[j])
      }
      prev = row
    }
    const center = pos.length / 3
    pos.push(0, 0, 0)
    col.push(0.5, 0.5, 0.5)
    const capRing = []
    for (const k of prev) {
      capRing.push(pos.length / 3)
      pos.push(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2])
      col.push(0.5, 0.5, 0.5)
    }
    for (let i = 0; i < nL; i++) {
      const j = (i + 1) % nL
      idx.push(center, capRing[j], capRing[i])
    }
    if (warp) {
      const p2 = []
      for (let i = 0; i < pos.length; i += 3) {
        const [a, b, c] = warp([pos[i], pos[i + 1], pos[i + 2]])
        p2.push(a, b, c)
      }
      pos.length = 0
      pos.push(...p2)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  })
}

/** Upholstered pad mesh with base at y (see padGeo), on a dark steel backing board that hides the underside. */
function pad(opts, pos = [0, 0, 0], m = M.pad) {
  const o = mesh(padGeo(opts), m)
  o.position.set(pos[0], pos[1], pos[2])
  return o
}

/** A vinyl foam roller along an axis: rounded ends with a dished face, a steel washer and a bolt at each end. */
function roller(c, axis, r, len, { ends = true, m = M.vinyl } = {}) {
  const h = len / 2
  const k = 0.016
  const prof = [[0.0001, -h + 0.006], [r * 0.42, -h + 0.006], [r * 0.5, -h + 0.0015], [r - k, -h]]
  for (let i = 1; i <= 5; i++) {
    const a = (i / 5) * (Math.PI / 2)
    prof.push([r - k + Math.sin(a) * k, -h + k - Math.cos(a) * k])
  }
  for (let i = 0; i <= 5; i++) {
    const a = (i / 5) * (Math.PI / 2)
    prof.push([r - k + Math.cos(a) * k, h - k + Math.sin(a) * k])
  }
  prof.push([r * 0.5, h - 0.0015], [r * 0.42, h - 0.006], [0.0001, h - 0.006])
  const rounded = prof.map(([a, b]) => [+a.toFixed(5), +b.toFixed(5)])
  const dir = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[axis] || axis
  const parts = [aim(lathe(rounded, m, [0, 0, 0], 'y', 40), c, dir)]
  if (ends) {
    const dv = vec(dir).normalize()
    for (const s of [-1, 1]) {
      const p = vec(c).addScaledVector(dv, s * (h - 0.006))
      parts.push(aim(cyl(+(r * 0.4).toFixed(4), 0.003, M.steel, [0, 0, 0]), p.toArray(), dv.toArray()))
      parts.push(bolt(p.clone().addScaledVector(dv, s * 0.0015).toArray(), dv.clone().multiplyScalar(s).toArray(), 0.009))
    }
  }
  return parts
}

/** A hex bolt with a washer whose head points along dir. */
function bolt(p, dir, s = 0.009) {
  const dv = vec(dir).normalize()
  const washer = aim(cyl(+(s * 1.35).toFixed(4), 0.0016, M.steel, [0, 0, 0], 'y', { seg: 18 }), p, dv.toArray())
  const head = aim(cyl(s, +(s * 0.68).toFixed(4), M.steel, [0, 0, 0], 'y', { seg: 6 }), vec(p).addScaledVector(dv, s * 0.42).toArray(), dv.toArray())
  return [washer, head]
}

/** The spring-loaded pull pin that locks a telescoping tube: a stem and a round black knob, out along dir from p. */
function popPin(p, dir) {
  return aim(
    lathe([[0.0001, 0], [0.012, 0], [0.012, 0.006], [0.0065, 0.008], [0.0065, 0.026], [0.015, 0.03], [0.02, 0.04], [0.019, 0.05], [0.012, 0.056], [0.0001, 0.058]], M.cap, [0, 0, 0], 'y', 24),
    p,
    dir,
  )
}

/** A rubber foot under a floor tube, sitting on the floor. */
const foot = (x, z, w = 0.07, d = 0.066) => rbox(w, 0.014, d, 0.004, M.rubber, [x, 0.007, z], 2)

/** A floor tube along X with rubber feet near its ends. Its underside is at y = 0.014. */
function floorX(z, w, { depth = 0.06, h = 0.05, x0 = 0, m = M.frame } = {}) {
  const y = 0.014 + h / 2
  return [beam([x0 - w / 2, y, z], [x0 + w / 2, y, z], depth, h, m, { cap: true }), foot(x0 - w / 2 + 0.055, z, 0.075, depth + 0.006), foot(x0 + w / 2 - 0.055, z, 0.075, depth + 0.006)]
}

/** A floor tube along Z with rubber feet near its ends. Its underside is at y = 0.014. */
function floorZ(x, z0, z1, { width = 0.06, h = 0.05, m = M.frame, cap = true } = {}) {
  const y = 0.014 + h / 2
  return [beam([x, y, z0], [x, y, z1], width, h, m, { cap }), foot(x, Math.min(z0, z1) + 0.055, width + 0.006, 0.075), foot(x, Math.max(z0, z1) - 0.055, width + 0.006, 0.075)]
}

/** Triangular gusset at the inside of a corner J in the Y-Z plane, on both faces of a tube of width w. */
function gusset(J, d1, d2, size, w, t = 0.005, m = M.frame) {
  const [z, y] = J
  const P = [[z, y], [z + d1[0] * size, y + d1[1] * size], [z + d2[0] * size, y + d2[1] * size]]
  const c = [(P[0][0] + P[1][0] + P[2][0]) / 3, (P[0][1] + P[1][1] + P[2][1]) / 3, size * 0.14]
  const round = (a) => a.map((q) => +q.toFixed(4))
  return [plateYZ(P.map(round), w / 2 + t / 2, t, m, [round(c)]), plateYZ(P.map(round), -w / 2 - t / 2, t, m, [round(c)])]
}

/** A transport wheel with a rubber tyre and steel hub, axis along X. */
function wheel(c, r = 0.036, w = 0.028) {
  return [
    lathe(
      [[0.0001, -w / 2], [+(r * 0.45).toFixed(4), -w / 2], [+(r * 0.55).toFixed(4), -w / 2 + 0.002], [+(r - 0.004).toFixed(4), -w / 2 + 0.002], [r, -w / 2 + 0.007], [r, w / 2 - 0.007], [+(r - 0.004).toFixed(4), w / 2 - 0.002], [+(r * 0.55).toFixed(4), w / 2 - 0.002], [+(r * 0.45).toFixed(4), w / 2], [0.0001, w / 2]],
      M.rubber,
      c,
      'x',
      32,
    ),
    cyl(+(r * 0.42).toFixed(4), +(w + 0.002).toFixed(4), M.steel, c, 'x'),
  ]
}

/**
 * A J-hook. Its bar seat is at `bar` (the axis of a 28 mm shaft), on an upright face at z = zFace, sticking out in Z toward the
 * bar (sign from the two). A steel plate on the face, a cup under the bar with a lip in front, lined with hard plastic.
 */
function jHook(bar, zFace, w = 0.05) {
  const dirZ = Math.sign(bar[2] - zFace) || 1
  const off = Math.abs(bar[2] - zFace)
  const r = 0.021
  const key = `jhook${off},${w}`
  const g = cached(key, () => {
    const s = new THREE.Shape()
    const R = r + 0.012
    s.moveTo(0, -0.11)
    s.lineTo(0, 0.085)
    s.lineTo(0.009, 0.085)
    s.lineTo(0.009, 0.036)
    // Into the cup along the back wall.
    s.lineTo(off - r - 0.003, 0.012)
    s.absarc(off, 0, r, Math.PI * 0.97, Math.PI * 2.03, false)
    // The lip.
    s.lineTo(off + r + 0.002, 0.02)
    s.absarc(off + r + 0.0075, 0.02, 0.0075, Math.PI, 0, true)
    s.lineTo(off + r + 0.0155, -0.002)
    s.absarc(off, 0, R + 0.002, -0.05, -Math.PI * 0.72, true)
    s.lineTo(0.012, -0.058)
    s.lineTo(0.012, -0.11)
    s.closePath()
    const e = new THREE.ExtrudeGeometry(s, { depth: w - 0.003, bevelEnabled: true, bevelSize: 0.0012, bevelThickness: 0.0015, bevelSegments: 2, curveSegments: 18 })
    e.translate(0, 0, -(w - 0.003) / 2)
    return e
  })
  const body = mesh(g, M.frameLight)
  body.position.set(bar[0], bar[1], zFace)
  body.rotation.y = dirZ < 0 ? Math.PI / 2 : -Math.PI / 2
  const liner = cached(`jliner${r},${w}`, () => {
    const s = new THREE.Shape()
    s.absarc(0, 0, r + 0.001, Math.PI * 0.98, Math.PI * 2.02, false)
    s.absarc(0, 0, r - 0.0045, Math.PI * 2.02, Math.PI * 0.98, true)
    s.closePath()
    const e = new THREE.ExtrudeGeometry(s, { depth: w + 0.004, bevelEnabled: false, curveSegments: 18 })
    e.translate(0, 0, -(w + 0.004) / 2)
    e.rotateY(-Math.PI / 2)
    return e
  })
  const line = mesh(liner, M.liner)
  line.position.set(bar[0], bar[1], bar[2])
  return [body, line, bolt([bar[0], bar[1] + 0.055, zFace + dirZ * 0.009], [0, 0, dirZ], 0.008), bolt([bar[0], bar[1] - 0.085, zFace + dirZ * 0.012], [0, 0, dirZ], 0.008)]
}

// A short knurled band with smooth chrome either side, for pull-up bars.
function grippedBar(a, b, r, { m = M.steel, knurlAt = [] } = {}) {
  const parts = [between(a, b, r, m, 28)]
  const A = vec(a)
  const B = vec(b)
  for (const [u0, u1] of knurlAt) {
    const P0 = A.clone().lerp(B, u0)
    const P1 = A.clone().lerp(B, u1)
    parts.push(between(P0.toArray(), P1.toArray(), +(r + 0.0004).toFixed(4), M.knurl, 28))
  }
  return parts
}

// ---------------------------------------------------------------------------------------------------------------------
// Benches
// ---------------------------------------------------------------------------------------------------------------------

/** The bar uprights shared by the flat and decline benches: two square posts with hole columns and J-hooks, on a floor tube. */
function barUprights({ barY, barZ, x = 0.56, s = 0.06, top = 0.16, tieY = 0.3, feet = false }) {
  const zFace = barZ - 0.045
  const z = zFace - s / 2
  const Y0 = 0.064
  const yTop = barY + top
  const parts = [floorX(z, 2 * x + 0.2, { depth: 0.07 })]
  for (const sx of [-1, 1]) {
    parts.push(beam([sx * x, Y0, z], [sx * x, yTop, z], s, s, M.frame, { capB: true, weldA: true }))
    const col = G(holeColumn(s, Math.max(0.42, barY - 0.32), yTop - 0.05, 0.05, ['z', 'x', '-x']))
    col.position.set(sx * x, 0, z)
    parts.push(col)
    parts.push(jHook([sx * x, barY, barZ], zFace))
    if (feet) {
      parts.push(floorZ(sx * x, z - 0.26, z + 0.26, { width: 0.06 }))
      parts.push(beam([sx * x, 0.05, z - 0.22], [sx * x, 0.62, z - s / 2], 0.04, 0.04, M.frame, { side: [1, 0, 0], weldA: [0, 1, 0], weldB: [0, 0, 1] }))
    }
  }
  if (tieY) parts.push(beam([-x, tieY, z], [x, tieY, z], 0.04, 0.05, M.frame, { weld: true, side: [0, 0, 1] }))
  return { parts, z }
}

function flatBench(p) {
  const H = p.height ?? 0.44
  const L = p.length ?? 1.22
  const W = p.width ?? 0.3
  const t = 0.082
  const board = 0.012
  const under = H - t - board
  const sh = 0.07
  const yS = under - sh / 2
  const zE = L / 2 - 0.1
  const parts = [
    pad({ w: W, l: L, t, rc: 0.028, edge: 0.024, crown: 0.007 }, [0, H - t, 0]),
    rbox(+(W - 0.012).toFixed(3), board, +(L - 0.012).toFixed(3), 0.004, M.frameDark, [0, H - t - board / 2, 0], 2),
    beam([0, yS, -zE], [0, yS, zE], 0.06, sh, M.frame, { cap: true }),
  ]
  // Two cross tubes under the board carry the pad.
  for (const z of [-zE + 0.14, zE - 0.14]) parts.push(beam([-0.105, under - 0.0125, z], [0.105, under - 0.0125, z], 0.05, 0.025, M.frame, { cap: true }))
  const legRake = Math.min(0.14, under * 0.32)
  const hasUprights = p.uprights || p.barY !== undefined
  const u = hasUprights ? barUprights({ barY: p.barY ?? 1.02, barZ: p.barZ ?? -0.44, x: p.barX ?? 0.56 }) : null
  for (const [zT, w, s] of [[-0.36, 0.58, -1], [0.36, 0.5, 1]]) {
    const zB = u && s < 0 ? u.z : zT + s * legRake
    const yF = 0.039
    const J = [zT, under - sh]
    const dz = zB - zT
    const len = Math.hypot(dz, under - sh - yF)
    const legD = [dz / len, -(under - sh - yF) / len]
    const yA = yF + 0.025
    const yB = under - sh
    const ptAt = (y) => [0, y, zB + (zT - zB) * ((y - yF) / (under - sh - yF))]
    parts.push(beam([0, yF, zB], ptAt(yB + 0.02), 0.06, 0.05, M.frame, { weldAt: [{ p: ptAt(yA), n: [0, 1, 0] }, { p: ptAt(yB), n: [0, 1, 0] }] }))
    if (!(u && s < 0)) parts.push(floorX(zB, w))
    parts.push(gusset(J, [-s, 0], legD, 0.12, 0.06))
  }
  if (u) parts.push(u.parts)
  else {
    // Transport wheels on the head end.
    const zW = -0.36 - legRake - 0.055
    for (const sx of [-1, 1]) {
      parts.push(wheel([sx * 0.2, 0.046, zW]))
      parts.push(rod([sx * 0.2, 0.046, zW], [sx * 0.2, 0.046, zW + 0.05], 0.009, M.steel))
    }
  }
  return G(parts)
}

const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const num = (x) => +x.toFixed(4)

// Point in a sloped pad's frame, as [y, z] from the reference point E: `down` metres down the slope, `n` metres out of the pad.
const slopePt = (E, a, down, n) => [E[0] - down * Math.sin(a) + n * Math.cos(a), E[1] - down * Math.cos(a) - n * Math.sin(a)]
const P3 = (yz, x = 0) => [x, yz[0], yz[1]]

/** Adjustable bench geometry: where everything is for a back angle. Shared by the builder and by BODY. */
function adjustableGeom(p) {
  const a = clamp(p.angle ?? 45, 0, 90) * D
  const hy = 0.355
  const T = 0.087 // pad top above the hinge line
  const k = (0.21 - 0.072) / 0.76
  const railC = (z) => 0.072 + k * (z + 0.74)
  const ladderY = (z) => railC(z) + 0.047
  const pivotOf = (ang) => [hy + -0.03 * Math.cos(ang) + 0.22 * Math.sin(ang), -0.03 * Math.sin(ang) - 0.22 * Math.cos(ang)]
  const Ls = 0.44
  const lowerOf = (ang) => {
    const [Py, Pz] = pivotOf(ang)
    const ly0 = ladderY(0)
    const A = 1 + k * k
    const B = 2 * (-Pz + k * (ly0 - Py))
    const C = Pz * Pz + (ly0 - Py) ** 2 - Ls * Ls
    const z = (-B - Math.sqrt(Math.max(0, B * B - 4 * A * C))) / (2 * A)
    return [ladderY(z), z]
  }
  return { a, hy, T, k, railC, ladderY, pivotOf, lowerOf, Ls, seatTop: hy + T }
}

function adjustableBench(p) {
  const g = adjustableGeom(p)
  const { a, hy, railC, ladderY } = g
  const seatA = clamp(p.seatAngle ?? 0, 0, 25) * D
  const board = 0.012
  const t = 0.075
  const parts = []
  // Main rail, floor feet and the tower that carries the hinge.
  const zR = -0.74
  parts.push(beam([0, railC(zR), zR], [0, railC(0.02), 0.02], 0.06, 0.06, M.frame, {}))
  parts.push(floorX(zR, 0.62))
  parts.push(beam([0, 0.05, 0.38], [0, railC(0.02) - 0.004, 0.0], 0.06, 0.05, M.frame, { weldAt: [{ p: [0, 0.064, 0.38 - (0.064 - 0.05) * (0.38 / (railC(0.02) - 0.054))], n: [0, 1, 0] }] }))
  parts.push(floorX(0.38, 0.5))
  parts.push(beam([0, railC(-0.012) + 0.02, -0.012], [0, hy - 0.012, -0.012], 0.06, 0.06, M.frame, { weldA: true }))
  const round = (a2) => a2.map((q) => q.map(num))
  for (const sx of [-1, 1]) {
    // Tower gusset with cut-outs, and the hinge lug on top of the tower.
    parts.push(plateYZ(round([[-0.33, railC(-0.33) - 0.012], [0.09, railC(0.09) - 0.05], [0.04, hy - 0.08], [-0.03, hy - 0.08]]), sx * 0.0325, 0.005, M.frame, round([[-0.02, railC(-0.02) + 0.045, 0.028], [-0.12, railC(-0.12) + 0.03, 0.019]])))
    parts.push(plateYZ(round([[-0.052, hy - 0.11], [0.05, hy - 0.11], [0.05, hy + 0.0], [0.02, hy + 0.026], [-0.02, hy + 0.026], [-0.052, hy + 0.0]]), sx * 0.04, 0.007, M.frameLight))
    parts.push(bolt([sx * 0.0555, hy, 0], [sx, 0, 0], 0.011))
  }
  // The ladder: two notched plates on the rail, with a notch for each 15 degrees of back angle.
  const notches = []
  for (let d = 0; d <= 90; d += 15) notches.push(g.lowerOf(d * D)[1])
  notches.sort((x, y) => x - y)
  const zL0 = notches[0] - 0.05
  const zL1 = notches[notches.length - 1] + 0.05
  const outline = [[zL0, railC(zL0) - 0.02]]
  outline.push([zL0, ladderY(zL0) - 0.012])
  for (const z of notches) {
    const n = 8
    const r = 0.0135
    for (let i = 0; i <= n; i++) {
      const u = Math.PI * (1 - i / n)
      outline.push([z + Math.cos(u) * r, ladderY(z) - Math.sin(u) * r])
    }
  }
  outline.push([zL1, ladderY(zL1) - 0.012], [zL1, railC(zL1) - 0.02])
  for (const sx of [-1, 1]) parts.push(plateYZ(round(outline), sx * 0.038, 0.006, M.frameLight))
  // Back, in a group that swings about the hinge.
  const back = new THREE.Group()
  back.position.set(0, hy, 0)
  back.rotation.x = a
  const lb = 0.86
  back.add(
    G(
      pad(
        { w: 0.29, l: lb, t, rc: 0.04, edge: 0.024, crown: 0.007, warpKey: 'taper-back', warp: ([x, y, z]) => [x * (1 - 0.13 * ((lb / 2 - z) / lb)), y, z] },
        [0, board, -0.03 - lb / 2],
      ),
      rbox(0.255, board, num(lb - 0.02), 0.004, M.frameDark, [0, board / 2, -0.03 - lb / 2], 2),
      [-1, 1].map((sx) => [
        beam([sx * 0.065, -0.014, -0.012], [sx * 0.065, -0.014, -0.8], 0.04, 0.028, M.frame, { capB: true }),
        plateYZ(round([[-0.04, 0.0], [0.03, 0.0], [0.03, -0.03], [0, -0.042], [-0.05, -0.032]]), sx * 0.052, 0.006, M.frameLight),
      ]),
      rod([-0.085, -0.03, -0.22], [0.085, -0.03, -0.22], 0.0125, M.frameLight, { cap: true }),
      [-0.09, -0.62].map((z) => beam([-0.085, -0.014, z], [0.085, -0.014, z], 0.03, 0.022, M.frame)),
    ),
  )
  parts.push(back)
  // The strut: a U-frame hanging from the back, its cross bar seated in a notch of the ladder.
  const [Py, Pz] = g.pivotOf(a)
  const [Qy, Qz] = g.lowerOf(a)
  for (const sx of [-1, 1]) {
    parts.push(beam([sx * 0.055, Qy, Qz], [sx * 0.055, Py, Pz], 0.022, 0.03, M.frame, { side: [1, 0, 0] }))
    parts.push(bolt([sx * 0.066, Py, Pz], [sx, 0, 0], 0.008))
  }
  parts.push(rod([-0.078, Qy, Qz], [0.078, Qy, Qz], 0.0115, M.steel, { cap: true }))
  // Seat, tilting about the same hinge line.
  const seat = new THREE.Group()
  seat.position.set(0, hy, 0)
  seat.rotation.x = -seatA
  const ls = 0.3
  seat.add(
    G(
      pad({ w: 0.3, l: ls, t, rc: 0.05, edge: 0.024, crown: 0.008, seam: 0.022, warpKey: 'taper-seat', warp: ([x, y, z]) => [x * (1 - 0.14 * ((z + ls / 2) / ls)), y, z] }, [0, board, 0.012 + ls / 2]),
      rbox(0.255, board, num(ls - 0.02), 0.004, M.frameDark, [0, board / 2, 0.012 + ls / 2], 2),
      [-1, 1].map((sx) => [
        beam([sx * 0.065, -0.014, 0.012], [sx * 0.065, -0.014, 0.27], 0.04, 0.028, M.frame, { capB: true }),
        plateYZ(round([[-0.03, 0.0], [0.06, 0.0], [0.06, -0.028], [0.02, -0.04], [-0.024, -0.03]]), sx * 0.0465, 0.005, M.frameLight),
      ]),
      rod([-0.085, -0.03, 0.18], [0.085, -0.03, 0.18], 0.0115, M.frameLight, { cap: true }),
    ),
  )
  parts.push(seat)
  // The seat's tilt post, on the front leg.
  const zT = 0.18
  const yLeg = railC(0.02) - (railC(0.02) - 0.039) * (zT / 0.38)
  const yTop = hy + -0.03 * Math.cos(seatA) + zT * Math.sin(seatA)
  const zTop = zT * Math.cos(seatA) + 0.03 * Math.sin(seatA)
  parts.push(beam([0, yLeg, zT], [0, yLeg + 0.1, zT], 0.042, 0.042, M.frame, { weldA: true }))
  parts.push(beam([0, yLeg + 0.05, zT], [0, yTop, zTop], 0.03, 0.03, M.steel, {}))
  parts.push(popPin([0.021, yLeg + 0.07, zT], [1, 0, 0]))
  // Wheels at the front, a handle at the back.
  for (const sx of [-1, 1]) {
    parts.push(wheel([sx * 0.19, 0.046, 0.435]))
    parts.push(rod([sx * 0.19, 0.046, 0.38], [sx * 0.19, 0.046, 0.435], 0.009, M.steel))
  }
  parts.push(bentRod([[-0.09, 0.05, zR - 0.02], [-0.09, 0.15, zR - 0.1], [0.09, 0.15, zR - 0.1], [0.09, 0.05, zR - 0.02]], 0.0115, M.frame, { bend: 0.035 }))
  // Bar uprights on their own feet, straddling the bench behind the back pad.
  if (p.uprights || p.barY !== undefined) {
    const d = BODY['adjustable-bench'](p)
    const u = barUprights({ barY: p.barY ?? d.barY, barZ: p.barZ ?? d.barZ, x: p.barX ?? 0.56, tieY: null, feet: true })
    parts.push(u.parts)
    // A short post ties the bench's rail to the uprights' floor tube.
    const yRail = railC(u.z) - 0.03
    if (yRail > 0.07) parts.push(beam([0, 0.064, u.z], [0, yRail, u.z], 0.05, 0.05, M.frame, {}))
  }
  return G(parts)
}

function declineGeom(p) {
  const a = clamp(p.angle ?? 20, 5, 35) * D
  const L = 1.15
  const lo = [0.3, -0.66]
  const E = [lo[0] + L * Math.sin(a), lo[1] + L * Math.cos(a)]
  return { a, L, lo, E, rollerY: E[0] - 0.25, shinZ: E[1] + 0.165 }
}

function declineBench(p) {
  const { a, L, E, rollerY, shinZ } = declineGeom(p)
  const t = 0.08
  const board = 0.012
  const sh = 0.07
  const padGroup = new THREE.Group()
  padGroup.position.set(0, E[0], E[1])
  padGroup.rotation.x = -a
  padGroup.add(
    G(
      pad({ w: 0.3, l: L, t, rc: 0.035, edge: 0.024, crown: 0.007 }, [0, -t, -L / 2]),
      rbox(0.28, board, num(L - 0.02), 0.004, M.frameDark, [0, -t - board / 2, -L / 2], 2),
      beam([0, -t - board - sh / 2, -0.04], [0, -t - board - sh / 2, -L + 0.08], 0.06, sh, M.frame, { cap: true }),
      [-0.2, -L + 0.2].map((z) => beam([-0.105, -t - board - 0.0125, z], [0.105, -t - board - 0.0125, z], 0.05, 0.025, M.frame, { cap: true })),
    ),
  )
  const parts = [padGroup]
  const yUnder = -t - board - sh
  const hasUprights = p.uprights || p.barY !== undefined
  // Head-end leg, straight down from the spine.
  const pL = slopePt(E, a, L - 0.2, yUnder)
  const zFootLow = pL[1] - 0.02
  const u = hasUprights ? barUprights({ barY: p.barY ?? declineBar(p).barY, barZ: p.barZ ?? declineBar(p).barZ, x: p.barX ?? 0.56 }) : null
  parts.push(beam([0, 0.039, zFootLow], [0, pL[0] + 0.02, pL[1]], 0.06, 0.05, M.frame, { weldAt: [{ p: [0, 0.064, zFootLow], n: [0, 1, 0] }] }))
  if (!u) parts.push(floorX(zFootLow, 0.58))
  else {
    parts.push(u.parts)
    parts.push(beam([0, 0.039, zFootLow], [0, 0.039, u.z], 0.06, 0.05, M.frame, {}))
    parts.push(floorX(zFootLow, 0.46))
  }
  // Seat-end post, telescoping with the angle, and the floor beam between the feet.
  const pH = slopePt(E, a, 0.08, yUnder)
  const zFootHigh = Math.max(0.5, pH[1] + 0.04)
  parts.push(floorX(zFootHigh, 0.56))
  parts.push(beam([0, 0.039, zFootLow], [0, 0.039, zFootHigh], 0.06, 0.05, M.frame, {}))
  const base = [0, 0.05, zFootHigh]
  const top = [0, pH[0] + 0.02, pH[1]]
  const dirP = vec(top).sub(vec(base)).normalize()
  const lenP = vec(top).distanceTo(vec(base))
  const outerLen = Math.min(0.3, lenP * 0.55)
  const midOuter = vec(base).addScaledVector(dirP, outerLen)
  parts.push(beam(base, midOuter.toArray(), 0.072, 0.072, M.frame, { weldA: [0, 1, 0] }))
  parts.push(beam(vec(base).addScaledVector(dirP, outerLen * 0.5).toArray(), top, 0.056, 0.056, M.steel, {}))
  parts.push(popPin(midOuter.clone().addScaledVector(dirP, -0.05).add(new V3(0.036, 0, 0)).toArray(), [1, 0, 0]))
  // The roller yoke: a short tube along Z off the post, an axle at each end, two rollers per axle.
  const zPost = vec(base).z + (vec(top).z - vec(base).z) * ((rollerY - base[1]) / (top[1] - base[1]))
  const zR = shinZ - 0.105
  const zF = shinZ + 0.105
  parts.push(beam([0, rollerY, Math.min(zR, zPost - 0.04)], [0, rollerY, Math.max(zF, zPost + 0.04)], 0.044, 0.044, M.frame, { cap: true }))
  for (const z of [zR, zF]) {
    parts.push(rod([-0.03, rollerY, z], [0.03, rollerY, z], 0.012, M.steel))
    for (const sx of [-1, 1]) parts.push(roller([sx * 0.13, rollerY, z], 'x', 0.058, 0.19))
  }
  return G(parts)
}

/** Where a decline bench's bar sits by default: above the eyes of someone in its standard position. */
function declineBar(p) {
  const b = BODY['decline-bench'](p)
  return { barY: num(b.shoulder[1] + 0.49), barZ: num(b.shoulder[2] - 0.13) }
}

function situpGeom(p) {
  const a = clamp(p.angle ?? 30, 0, 50) * D
  const L = 1.12
  const lo = [0.3, -0.72]
  const E = [lo[0] + L * Math.sin(a), lo[1] + L * Math.cos(a)]
  return { a, L, lo, E }
}

function declineSitupBench(p) {
  const { a, L, E } = situpGeom(p)
  const t = 0.075
  const board = 0.012
  const sh = 0.08
  const nSpine = -t - board - sh / 2
  const padGroup = new THREE.Group()
  padGroup.position.set(0, E[0], E[1])
  padGroup.rotation.x = -a
  const holes = []
  for (let i = 0; i < 6; i++) holes.push([num(-0.26 - i * 0.135), num(nSpine - 0.012), num(0.03 - i * 0.002)])
  padGroup.add(
    G(
      pad({ w: 0.29, l: L, t, rc: 0.05, edge: 0.024, crown: 0.007 }, [0, -t, -L / 2]),
      rbox(0.27, board, num(L - 0.02), 0.004, M.frameDark, [0, -t - board / 2, -L / 2], 2),
      beam([0, nSpine, 0.03], [0, nSpine, -L + 0.06], 0.05, sh, M.frame, { cap: true }),
      [-1, 1].map((sx) => plateYZ([[-0.2, nSpine + 0.03], [-0.2, nSpine - 0.055], [-L + 0.12, nSpine - 0.055], [-L + 0.12, nSpine + 0.03]].map((q) => q.map(num)), sx * 0.0285, 0.007, M.frameLight, holes)),
    ),
  )
  const parts = [padGroup]
  // Low-end leg with its T-foot.
  const pL = slopePt(E, a, L - 0.14, nSpine)
  const zLow = pL[1] - 0.03
  parts.push(beam([0, 0.039, zLow], [0, pL[0], pL[1]], 0.05, 0.05, M.frame, { weldAt: [{ p: [0, 0.064, zLow], n: [0, 1, 0] }] }))
  parts.push(floorX(zLow, 0.56))
  // High-end telescoping leg.
  const pH = slopePt(E, a, 0.14, nSpine)
  const zHigh = pH[1] + 0.12
  parts.push(floorX(zHigh, 0.56))
  const base = [0, 0.05, zHigh]
  const top = [0, pH[0], pH[1]]
  const dirP = vec(top).sub(vec(base)).normalize()
  const lenP = vec(top).distanceTo(vec(base))
  const outerLen = lenP * 0.52
  const mid = vec(base).addScaledVector(dirP, outerLen)
  parts.push(beam(base, mid.toArray(), 0.064, 0.05, M.frame, { weldA: [0, 1, 0] }))
  parts.push(beam(vec(base).addScaledVector(dirP, outerLen * 0.5).toArray(), top, 0.05, 0.038, M.steel, {}))
  parts.push(popPin(mid.clone().addScaledVector(dirP, -0.05).add(new V3(0.032, 0, 0)).toArray(), [1, 0, 0]))
  // Ankle rollers past the high end of the pad, in the pad's frame: s is metres past the end, n metres out of the pad's face.
  const pS = (s, n) => P3(slopePt(E, a, -s, n))
  const R1 = pS(0.075, -0.02)
  const R2 = pS(0.268, 0.105)
  parts.push(beam(pS(-0.0, nSpine), pS(0.02, nSpine + 0.03), 0.05, 0.05, M.frame, {}))
  parts.push(beam(pS(0.02, nSpine), R1, 0.044, 0.044, M.frame, { capB: true, side: [1, 0, 0] }))
  parts.push(beam(R1, R2, 0.036, 0.036, M.frame, { cap: true, side: [1, 0, 0] }))
  for (const R of [R1, R2]) {
    parts.push(rod([-0.03, R[1], R[2]], [0.03, R[1], R[2]], 0.012, M.steel))
    for (const sx of [-1, 1]) parts.push(roller([sx * 0.125, R[1], R[2]], 'x', 0.06, 0.19))
  }
  return G(parts)
}

function preacherGeom(p) {
  const seatH = p.seatH ?? 0.62
  const top = p.height ?? 0.995
  const a = clamp(p.slope ?? 45, 25, 60) * D
  return { seatH, top, a }
}

function preacherBench(p) {
  const { seatH, top, a } = preacherGeom(p)
  const parts = []
  const t = 0.075
  const lp = 0.27
  const wp = 0.56
  // The arm pad and its steel tray, in a group whose +Y is the pad's face normal and +Z runs down the slope.
  const trayGroup = new THREE.Group()
  trayGroup.position.set(0, top, 0)
  trayGroup.rotation.x = a
  const bendKey = 'preacher'
  const warp = ([x, y, z]) => {
    const u = Math.abs(x) / (wp / 2)
    // Chevron in plan: the wings reach back toward the user's armpits, the middle leaves room for the chest. The top falls away
    // toward the ends, as the upper arms lie on it.
    return [x, y - 0.02 * u * u, z - 0.05 * u ** 1.4 + 0.012]
  }
  trayGroup.add(
    pad({ w: wp, l: lp, t, rc: 0.06, edge: 0.034, crown: 0.012, seam: 0.03, warp, warpKey: bendKey }, [0, -t, lp / 2]),
    // The steel tray, bent like the pad and a little smaller.
    mesh(padGeo({ w: num(wp - 0.03), l: num(lp - 0.03), t: 0.01, rc: 0.05, edge: 0.003, crown: 0, seam: 0, bulge: 0, warp, warpKey: bendKey + 't' }), M.paint, [0, num(-t - 0.009), lp / 2]),
  )
  parts.push(trayGroup)
  const padPt = (down, n) => [top - down * Math.sin(a) + n * Math.cos(a), down * Math.cos(a) + n * Math.sin(a)]
  // Base: one floor beam between two T-feet, the feet stand either side of it.
  const zRear = -0.52
  const zFront = 0.56
  const yF = 0.039
  parts.push(floorX(zRear, 0.62))
  parts.push(floorX(zFront, 0.86))
  parts.push(beam([0, yF, zRear], [0, yF, zFront], 0.07, 0.05, M.frame, {}))
  // A single raked column in front of the shins carries the pad: nothing stands between the camera and the figure's legs.
  const under = padPt(0.135, -t - 0.022)
  const zC0 = 0.4
  parts.push(beam([0, 0.064, zC0], [0, under[0] + 0.012, under[1]], 0.075, 0.075, M.frame, { weldA: [0, 1, 0], side: [1, 0, 0] }))
  // Gussets at the floor, following the column's faces, and a saddle under the tray.
  const round = (q) => q.map((v) => v.map(num))
  const slopeC = (under[1] - zC0) / (under[0] + 0.012 - 0.064)
  const halfC = 0.0375 * Math.hypot(1, slopeC)
  const zFace = (y, sgn) => zC0 + slopeC * (y - 0.064) + sgn * halfC
  for (const sx of [-1, 1]) {
    parts.push(plateYZ(round([[zFace(0.064, 1), 0.064], [zFace(0.064, 1) + 0.17, 0.064], [zFace(0.34, 1), 0.34]]), sx * 0.0405, 0.006, M.frame, round([[zFace(0.064, 1) + 0.045, 0.12, 0.022]])))
    parts.push(plateYZ(round([[zFace(0.064, -1), 0.064], [zFace(0.3, -1), 0.064], [zFace(0.3, -1), 0.3]]), sx * 0.0405, 0.006, M.frame, round([[zFace(0.3, -1) + 0.035, 0.105, 0.018]])))
  }
  // The saddle: two lugs from the column up to the tray, bolted through the cross tube.
  const trayPt = (down, n) => padPt(down, -t - 0.011 + n)
  for (const sx of [-1, 1]) {
    parts.push(plateYZ(round([[under[1] - 0.05, under[0] - 0.04], [under[1] + 0.05, under[0] - 0.04], [trayPt(0.19, 0)[1], trayPt(0.19, 0)[0]], [trayPt(0.08, 0)[1], trayPt(0.08, 0)[0]]]), sx * 0.0425, 0.005, M.frameLight))
    parts.push(bolt([sx * 0.045, under[0], under[1]], [sx, 0, 0], 0.0095))
  }
  parts.push(rod([-0.2, under[0], under[1]], [0.2, under[0], under[1]], 0.021, M.frame, {}))
  // A low bar across the column to rest the feet on.
  const fbT = (0.2 - 0.064) / (under[0] - 0.064)
  const fbZ = zC0 + (under[1] - zC0) * fbT
  parts.push(rod([-0.27, 0.2, fbZ], [0.27, 0.2, fbZ], 0.0135, M.steel, { cap: true }))
  // The bar rack: a horn at each end of the cross tube, ending in a lined cup in front of the pad.
  const rackY = top - 0.09 - (p.rackDrop ?? 0)
  const rackZ = 0.335
  for (const sx of [-1, 1]) {
    const x = sx * 0.305
    const y0 = under[0]
    parts.push(bentRod([[sx * 0.2, y0, under[1]], [x, y0, under[1] + 0.06], [x, rackY - 0.026, rackZ]], 0.0135, M.frameLight, { bend: 0.03 }))
    parts.push(rackCup([x, rackY, rackZ]))
  }
  // Seat on its telescoping post, raked forward from the rear floor tube.
  const seatZ = p.seatZ ?? -0.275
  const y1 = seatH - 0.075 - 0.012
  const base = [0, 0.064, zRear]
  const topP = [0, y1, seatZ]
  const dirP = vec(topP).sub(vec(base)).normalize()
  const lenP = vec(topP).distanceTo(vec(base))
  const midP = vec(base).addScaledVector(dirP, lenP * 0.62)
  parts.push(beam(base, midP.toArray(), 0.064, 0.064, M.frame, { weldA: [0, 1, 0] }))
  parts.push(beam(vec(base).addScaledVector(dirP, lenP * 0.4).toArray(), [0, y1 - 0.01, topP[2]], 0.048, 0.048, M.steel, {}))
  parts.push(popPin(midP.clone().addScaledVector(dirP, -0.05).add(new V3(0.032, 0, 0)).toArray(), [1, 0, 0]))
  parts.push(rbox(0.2, 0.012, 0.18, 0.003, M.frame, [0, y1 - 0.004, seatZ], 2))
  parts.push(pad({ w: 0.33, l: 0.25, t: 0.075, rc: 0.09, edge: 0.03, crown: 0.012, seam: 0.022 }, [0, y1 + 0.012 - 0.0, seatZ]))
  return G(parts)
}

/** A small lined cup that holds a bar: axis along X. */
function rackCup(c) {
  const r = 0.02
  const g = cached(`rackcup${r}`, () => {
    const s = new THREE.Shape()
    s.absarc(0, 0, r + 0.009, Math.PI * 1.06, Math.PI * 1.94, false)
    s.lineTo(r + 0.012, 0.02)
    s.lineTo(r + 0.003, 0.02)
    s.lineTo(r, 0.0)
    s.absarc(0, 0, r, 0, Math.PI, true)
    s.lineTo(-r - 0.003, 0.02)
    s.lineTo(-r - 0.012, 0.02)
    s.closePath()
    const e = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.001, bevelThickness: 0.001, bevelSegments: 1, curveSegments: 16 })
    e.translate(0, 0, -0.025)
    e.rotateY(-Math.PI / 2)
    return e
  })
  const o = mesh(g, M.liner)
  o.position.set(c[0], c[1], c[2])
  return o
}

// ---------------------------------------------------------------------------------------------------------------------
// Racks and stands
// ---------------------------------------------------------------------------------------------------------------------

/** The heights of a hole column, passing through refY. */
const holeRange = (refY, lo, hi, step = 0.05) => {
  const k0 = Math.ceil((lo - refY) / step)
  const k1 = Math.floor((hi - refY) / step)
  return [refY + k0 * step, refY + k1 * step]
}

function powerRack(p) {
  const W = p.width ?? 1.2
  const Dp = p.depth ?? 1.1
  const Ht = p.height ?? 2.28
  const s = 0.075
  const barY = p.barY ?? 1.38
  const pinY = p.pinY
  const parts = []
  const refY = pinY !== undefined ? pinY - 0.03 : barY - 0.05
  const [h0, h1] = holeRange(refY, 0.16, Ht - 0.17)
  const yF = 0.039
  for (const x of [-W / 2, W / 2]) {
    parts.push(floorZ(x, -Dp / 2 - 0.2, Dp / 2 + 0.2, { width: s, h: 0.05 }))
    for (const z of [-Dp / 2, Dp / 2]) {
      parts.push(beam([x, 0.05, z], [x, Ht, z], s, s, M.frame, { capB: true, weldA: true, r: 0.006 }))
      const col = G(holeColumn(s, h0, h1, 0.05))
      col.position.set(x, 0, z)
      parts.push(col)
    }
    // Top rail with its bolted brackets.
    const yT = Ht - 0.1
    parts.push(beam([x, yT, -Dp / 2 + s / 2], [x, yT, Dp / 2 - s / 2], s, 0.05, M.frame, { r: 0.006 }))
    for (const sz of [-1, 1]) {
      const z = sz * (Dp / 2 - s / 2)
      const sx = Math.sign(x)
      parts.push(rbox(0.006, 0.09, 0.17, 0.002, M.frameLight, [x + sx * (s / 2 + 0.003), yT, z - sz * 0.0], 2))
      for (const [dy, dz] of [[-0.025, 0.05], [0.025, 0.05], [-0.025, -0.05], [0.025, -0.05]]) parts.push(bolt([x + sx * (s / 2 + 0.006), yT + dy, z + dz], [sx, 0, 0], 0.009))
    }
  }
  // Rear cross members, top and floor.
  parts.push(beam([-W / 2 + s / 2, Ht - 0.1, -Dp / 2], [W / 2 - s / 2, Ht - 0.1, -Dp / 2], s, 0.05, M.frame, { r: 0.006 }))
  parts.push(beam([-W / 2, yF, -Dp / 2], [W / 2, yF, -Dp / 2], s, 0.05, M.frame, { r: 0.006 }))
  // The front pull-up bar, knurled in the grip zones.
  const yPull = Ht - 0.1
  const zPull = Dp / 2
  parts.push(grippedBar([-W / 2 + s / 2, yPull, zPull], [W / 2 - s / 2, yPull, zPull], 0.016, { knurlAt: [[0.12, 0.42], [0.58, 0.88]] }))
  for (const x of [-W / 2, W / 2]) parts.push(rod([x - Math.sign(x) * (s / 2 + 0.006), yPull, zPull], [x - Math.sign(x) * (s / 2 - 0.002), yPull, zPull], 0.028, M.frameLight))
  // Band pegs: low on the floor rails and high on the top rails, on the outside, at the two working stations along the rack.
  if (p.pegs !== false) {
    for (const sx of [-1, 1]) {
      for (const z of [-0.3, 0.3]) {
        const x0 = sx * (W / 2 + s / 2)
        parts.push(rod([x0, yF, z], [x0 + sx * 0.075, yF, z], 0.016, M.steel, { capB: true, weldA: true }))
        parts.push(rod([x0, Ht - 0.1, z], [x0 + sx * 0.075, Ht - 0.1, z], 0.016, M.steel, { capB: true, weldA: true }))
      }
    }
  }
  // J-hooks on the inner faces of the front uprights.
  const zFace = Dp / 2 - s / 2
  const barZ = zFace - 0.045
  if (barY) for (const x of [-W / 2, W / 2]) parts.push(jHook([x, barY, barZ], zFace))
  // Safety pins, front to back through the uprights, a bar resting on them has its axis at pinY.
  if (pinY !== undefined) {
    const y = pinY - 0.03
    for (const x of [-W / 2, W / 2]) {
      parts.push(rod([x, y, -Dp / 2 - s / 2 - 0.022], [x, y, Dp / 2 + s / 2 + 0.03], 0.016, M.chrome))
      parts.push(bentRod([[x, y, Dp / 2 + s / 2 + 0.01], [x, y, Dp / 2 + s / 2 + 0.05], [x + Math.sign(x) * 0.07, y, Dp / 2 + s / 2 + 0.05]], 0.0095, M.chrome, { bend: 0.016, capB: true }))
      parts.push(cyl(0.024, 0.006, M.frameLight, [x, y, Dp / 2 + s / 2 + 0.003], 'z'))
      parts.push(cyl(0.024, 0.006, M.frameLight, [x, y, -Dp / 2 - s / 2 - 0.003], 'z'))
    }
  }
  return G(parts)
}

function squatStand(p) {
  const W = p.width ?? 1.2
  const Ht = p.height ?? 1.85
  const s = 0.06
  const barY = p.barY ?? 1.38
  const parts = []
  const zB = 0.34
  const zFront = -0.62
  const refY = p.pinY !== undefined ? p.pinY - 0.039 : barY - 0.05
  const [h0, h1] = holeRange(refY, 0.3, Ht - 0.08)
  for (const x of [-W / 2, W / 2]) {
    parts.push(floorZ(x, zFront, zB + 0.06, { width: 0.06 }))
    parts.push(beam([x, 0.05, 0], [x, Ht, 0], s, s, M.frame, { capB: true, weldA: true }))
    const col = G(holeColumn(s, h0, h1, 0.05))
    col.position.set(x, 0, 0)
    parts.push(col)
    parts.push(beam([x, 0.05, zB], [x, 0.74, 0.0], 0.04, 0.04, M.frame, { weldA: [0, 1, 0], weldB: [0, 0, 1], side: [1, 0, 0] }))
    parts.push(jHook([x, barY, -s / 2 - 0.045], -s / 2))
    if (p.pinY !== undefined) {
      const y = p.pinY - 0.014 - 0.025
      const sx = Math.sign(x)
      parts.push(beam([x, y, -s / 2], [x, y, -0.62], 0.04, 0.05, M.frameLight, { capB: true, weldA: true }))
      parts.push(rbox(0.04, 0.006, 0.5, 0.002, M.liner, [x, y + 0.028, -0.36], 2))
      parts.push(rod([x - sx * 0.0, y, 0.0], [x + 0, y, s / 2 + 0.03], 0.008, M.steel))
    }
  }
  parts.push(beam([-W / 2, 0.039, zB], [W / 2, 0.039, zB], 0.06, 0.05, M.frame, {}))
  // A tie across the top keeps a free stand from racking.
  parts.push(beam([-W / 2, 0.24, 0], [W / 2, 0.24, 0], 0.04, 0.05, M.frame, { weld: true }))
  return G(parts)
}

// ---------------------------------------------------------------------------------------------------------------------
// Boxes, blocks, platforms
// ---------------------------------------------------------------------------------------------------------------------

/** Finger joints and plywood edges on a wooden box: thin lighter strips on the outside faces. */
function woodBoxDetail(w, h, d, y0 = 0, step = 0.07) {
  const key = `woodbox${w},${h},${d},${y0},${step}`
  const g = cached(key, () => {
    const list = []
    const tt = 0.018
    const add = (sx, sy, sz, x, y, z) => list.push([new THREE.BoxGeometry(sx, sy, sz), new M4().makeTranslation(x, y, z)])
    const n = Math.max(2, Math.round(h / step))
    const dy = h / n
    for (let i = 0; i < n; i++) {
      const y = y0 + (i + 0.5) * dy
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          if (i % 2 === 0) add(0.0006, dy - 0.0012, tt, sx * (w / 2 + 0.0003), y, sz * (d / 2 - tt / 2))
          else add(tt, dy - 0.0012, 0.0006, sx * (w / 2 - tt / 2), y, sz * (d / 2 + 0.0003))
        }
      }
    }
    for (const sx of [-1, 1]) add(0.0006, tt, d - 0.002, sx * (w / 2 + 0.0003), y0 + h - tt / 2, 0)
    for (const sz of [-1, 1]) add(w - 0.002, tt, 0.0006, 0, y0 + h - tt / 2, sz * (d / 2 + 0.0003))
    return mergeGeos(list)
  })
  const o = mesh(g, M.woodEnd)
  o.castShadow = false
  return o
}

/** A hand slot on a wooden side: dark, rounded, with a chamfered lighter rim. */
function handSlot(pos, axis, w = 0.13, h = 0.036) {
  const nrm = axis === 'x' ? [Math.sign(pos[0]), 0, 0] : [0, 0, Math.sign(pos[2])]
  const shape = (ww, hh) =>
    cached(`slot${ww},${hh}`, () => {
      const s = new THREE.Shape()
      const r = hh / 2
      s.absarc(ww / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false)
      s.absarc(-ww / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5, false)
      s.closePath()
      const g = new THREE.ShapeGeometry(s, 10)
      g.computeVertexNormals()
      return g
    })
  const mk = (ww, hh, m, off) => {
    const o = mesh(shape(num(ww), num(hh)), m)
    o.castShadow = false
    o.position.set(pos[0] + nrm[0] * off, pos[1], pos[2] + nrm[2] * off)
    o.quaternion.setFromUnitVectors(new V3(0, 0, 1), vec(nrm))
    return o
  }
  return [mk(w + 0.008, h + 0.008, M.woodEnd, 0.0007), mk(w, h, M.hole, 0.0011)]
}

function plyoBox(p) {
  const h = p.height ?? 0.5
  const w = p.width ?? 0.6
  const d = p.depth ?? 0.5
  const style = p.style ?? 'wood'
  if (style === 'wood') {
    const parts = [
      rbox(w, h, d, 0.0035, M.wood, [0, h / 2, 0], 2),
      woodBoxDetail(w, h, d),
      handSlot([w / 2, h * 0.76, 0], 'x'),
      handSlot([-w / 2, h * 0.76, 0], 'x'),
      handSlot([0, h * 0.76, d / 2], 'z'),
      handSlot([0, h * 0.76, -d / 2], 'z'),
      rbox(num(w - 0.05), 0.0025, num(d - 0.05), 0.001, M.rubber, [0, h + 0.00125, 0], 1),
    ]
    return G(parts)
  }
  if (style === 'steel') {
    // The tapered steel pyramid box: a painted shell with a rubber top.
    const taper = p.taper ?? 0.26
    const body = mesh(
      padGeo({ w, l: d, t: h, rc: 0.012, edge: 0.012, crown: 0, seam: 0, bulge: 0, warpKey: `pyr${taper},${h}`, warp: ([x, y, z]) => { const f = 1 - taper * (y / h); return [x * f, y, z * f] } }),
      M.paint,
    )
    const top = mesh(padGeo({ w: num(w * (1 - taper) - 0.03), l: num(d * (1 - taper) - 0.03), t: 0.006, rc: 0.012, edge: 0.003, crown: 0, seam: 0, bulge: 0 }), M.rubberTop)
    top.position.y = h - 0.003
    return G(body, top)
  }
  if (style === 'frame') {
    // Open steel frame with a padded rubber top, the low kind used in pairs for plyometric push-ups.
    const s = 0.036
    const parts = []
    const hw = w / 2 - s / 2
    const hd = d / 2 - s / 2
    const r = 0.86
    const yTop = h - 0.03
    const y0 = 0.014 + s / 2
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        parts.push(beam([sx * hw, y0, sz * hd], [sx * hw * r, yTop, sz * hd * r], s, s, M.frame, { side: [1, 0, 0], weld: true }))
        parts.push(foot(sx * hw, sz * hd, 0.05, 0.05))
      }
    }
    for (const sx of [-1, 1]) parts.push(beam([sx * hw, y0, -hd], [sx * hw, y0, hd], s, s, M.frame, {}))
    for (const sz of [-1, 1]) parts.push(beam([-hw, y0, sz * hd], [hw, y0, sz * hd], s, s, M.frame, {}))
    for (const sx of [-1, 1]) parts.push(beam([sx * hw * r, yTop - 0.012, -hd * r], [sx * hw * r, yTop - 0.012, hd * r], s, 0.024, M.frame, {}))
    for (const sz of [-1, 1]) parts.push(beam([-hw * r, yTop - 0.012, sz * hd * r], [hw * r, yTop - 0.012, sz * hd * r], s, 0.024, M.frame, {}))
    parts.push(pad({ w: num(w * r + 0.02), l: num(d * r + 0.02), t: 0.03, rc: 0.02, edge: 0.012, crown: 0.002, seam: 0.012 }, [0, h - 0.03, 0]))
    return G(parts)
  }
  // Soft foam box: vinyl over foam, seams up the corners and around the top.
  const seams = []
  return G(mesh(padGeo({ w, l: d, t: h, rc: 0.05, edge: 0.05, crown: 0.006, seam: 0.05, seamDepth: 0.003, bulge: 0.004, grooves: seams }), M.foam))
}

function squatBox(p) {
  const h = p.height ?? 0.4
  const w = p.width ?? 0.46
  const d = p.depth ?? 0.42
  const parts = []
  const s = 0.06
  const tt = 0.03
  const hw = w / 2 - s / 2
  const hd = d / 2 - s / 2
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(rbox(s, num(h - tt), s, 0.004, M.wood, [sx * hw, (h - tt) / 2, sz * hd], 2))
  // Rails under the top and stretchers low down.
  for (const sz of [-1, 1]) {
    parts.push(rbox(num(w - 2 * s), 0.09, 0.03, 0.003, M.woodDark, [0, h - tt - 0.045, sz * hd], 2))
    parts.push(rbox(num(w - 2 * s), 0.06, 0.03, 0.003, M.woodDark, [0, 0.11, sz * hd], 2))
  }
  for (const sx of [-1, 1]) {
    parts.push(rbox(0.03, 0.09, num(d - 2 * s), 0.003, M.woodDark, [sx * hw, h - tt - 0.045, 0], 2))
    parts.push(rbox(0.03, 0.06, num(d - 2 * s), 0.003, M.woodDark, [sx * hw, 0.11, 0], 2))
  }
  // Top planks, then a rubber sheet.
  const n = 4
  const gap = 0.006
  const pw = (d - (n - 1) * gap) / n
  for (let i = 0; i < n; i++) parts.push(rbox(w, tt, num(pw), 0.004, M.wood, [0, h - tt / 2, num(-d / 2 + pw / 2 + i * (pw + gap))], 2))
  // Screw heads in the planks.
  for (let i = 0; i < n; i++) {
    for (const sx of [-1, 1]) {
      const z = num(-d / 2 + pw / 2 + i * (pw + gap))
      parts.push(cyl(0.0055, 0.0015, M.steel, [sx * hw, h + 0.0005, z], 'y', { seg: 10 }))
    }
  }
  return G(parts)
}

function pullBlocks(p) {
  const h = p.height ?? 0.3
  const spread = p.spread ?? 1.44
  const w = p.width ?? 0.38
  const d = p.depth ?? 0.56
  const course = p.course ?? 0.15
  const n = Math.max(1, Math.round(h / course))
  const ch = h / n
  const parts = []
  for (const sx of [-1, 1]) {
    const x = (sx * spread) / 2
    const g = new THREE.Group()
    g.position.x = x
    for (let i = 0; i < n; i++) {
      const y0 = i * ch
      g.add(rbox(w, num(ch - 0.003), d, 0.004, M.wood, [0, y0 + ch / 2, 0], 2))
      g.add(woodBoxDetail(w, num(ch - 0.003), d, y0 + 0.0015, 0.05))
      // A hand slot in each end, so the crate can be carried.
      for (const sz of [-1, 1]) g.add(...handSlot([0, y0 + ch * 0.62, sz * (d / 2)], 'z', 0.12, 0.032))
    }
    g.add(rbox(num(w - 0.01), 0.01, num(d - 0.01), 0.003, M.rubber, [0, h - 0.0045 + 0.005, 0], 2))
    parts.push(g)
  }
  return G(parts)
}

function deficitPlatform(p) {
  const h = p.height ?? 0.075
  const w = p.width ?? 0.9
  const d = p.depth ?? 0.7
  const parts = []
  const rim = 0.03
  parts.push(mesh(padGeo({ w: num(w - 2 * rim + 0.004), l: num(d - 2 * rim + 0.004), t: 0.012, rc: 0.006, edge: 0.003, crown: 0, seam: 0, bulge: 0 }), M.rubberTop, [0, h - 0.012, 0]))
  // Steel angle around the edge, mitred corners on rubber feet.
  for (const sz of [-1, 1]) parts.push(beam([-w / 2, h - 0.0245, (sz * (d - rim)) / 2], [w / 2, h - 0.0245, (sz * (d - rim)) / 2], rim, 0.049, M.frame, { r: 0.003 }))
  for (const sx of [-1, 1]) parts.push(beam([(sx * (w - rim)) / 2, h - 0.0245, -d / 2 + rim], [(sx * (w - rim)) / 2, h - 0.0245, d / 2 - rim], rim, 0.049, M.frame, { r: 0.003 }))
  if (h > 0.06) parts.push(rbox(num(w - 0.06), num(h - 0.05), num(d - 0.06), 0.002, M.frameDark, [0, (h - 0.05) / 2, 0], 1))
  // Ribbed rubber.
  const n = Math.floor((d - 2 * rim - 0.04) / 0.05)
  const ribs = cached(`ribs${w},${d},${h},${n}`, () => {
    const list = []
    const rib = new THREE.BoxGeometry(w - 2 * rim - 0.03, 0.0012, 0.006)
    for (let i = 0; i < n; i++) list.push([rib, new M4().makeTranslation(0, h + 0.0002, -((n - 1) * 0.05) / 2 + i * 0.05)])
    return mergeGeos(list)
  })
  const rb = mesh(ribs, M.rubber)
  rb.castShadow = false
  parts.push(rb)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(cyl(0.008, 0.0015, M.steel, [(sx * (w - rim)) / 2, h + 0.0002, (sz * (d - rim)) / 2], 'y', { seg: 6 }))
  return G(parts)
}

function calfBlock(p) {
  const h = p.height ?? (p.style === 'board' ? 0.065 : 0.1)
  const w = p.width ?? 0.5
  const d = p.depth ?? 0.24
  if (p.style === 'board') {
    // The plain wooden board from the instructions: 2x planks on edge battens, screwed down.
    const n = 2
    const gap = 0.004
    const pw = (d - (n - 1) * gap) / n
    const plank = 0.024
    const out = []
    for (let i = 0; i < n; i++) {
      const z = num(-d / 2 + pw / 2 + i * (pw + gap))
      out.push(rbox(w, plank, num(pw), 0.0035, M.wood, [0, num(h - plank / 2), z], 2))
      for (const sx of [-1, 1]) out.push(cyl(0.0052, 0.0012, M.steel, [sx * (w / 2 - 0.06), h + 0.0004, z], 'y', { seg: 10 }))
    }
    for (const sx of [-1, 1]) out.push(rbox(0.045, num(h - plank), num(d - 0.006), 0.003, M.woodDark, [sx * (w / 2 - 0.06), (h - plank) / 2, 0], 2))
    return G(out)
  }
  const parts = []
  // A steel wedge with a rubber deck; the deck's rear edge is well rounded, the toes go toward +Z.
  parts.push(rbox(w, num(h - 0.022), d, 0.004, M.frame, [0, (h - 0.022) / 2, 0], 2))
  parts.push(mesh(padGeo({ w, l: d, t: 0.024, rc: 0.008, edge: 0.012, crown: 0.001, seam: 0, bulge: 0.0005 }), M.rubberTop, [0, h - 0.024, 0]))
  const n = Math.floor((d - 0.05) / 0.022)
  const ribs = cached(`calfribs${w},${d},${n}`, () => {
    const list = []
    const rib = new THREE.BoxGeometry(w - 0.03, 0.0012, 0.008)
    for (let i = 0; i < n; i++) list.push([rib, new M4().makeTranslation(0, 0, -((n - 1) * 0.022) / 2 + i * 0.022)])
    return mergeGeos(list)
  })
  const rb = mesh(ribs, M.rubber, [0, h + 0.0004, 0])
  rb.castShadow = false
  parts.push(rb)
  for (const sx of [-1, 1]) {
    parts.push(rbox(0.06, 0.008, num(d - 0.03), 0.003, M.rubber, [sx * (w / 2 - 0.06), 0.004, 0], 1))
    parts.push(bolt([sx * (w / 2), (h - 0.022) / 2, 0], [sx, 0, 0], 0.009))
  }
  if (p.rail) {
    const z = d / 2 + 0.34
    const yy = p.railY ?? 1.2
    parts.push(beam([0, 0.039, d / 2 - 0.02], [0, 0.039, z + 0.06], 0.06, 0.05, M.frame, {}))
    parts.push(floorX(z, 0.56))
    parts.push(beam([0, 0.05, z], [0, yy, z], 0.05, 0.05, M.frame, { weldA: true }))
    parts.push(bentRod([[-0.24, yy + 0.01, z - 0.11], [-0.24, yy + 0.01, z], [0.24, yy + 0.01, z], [0.24, yy + 0.01, z - 0.11]], 0.015, M.steel, { bend: 0.04, cap: true }))
    for (const sx of [-1, 1]) parts.push(rod([sx * 0.24, yy + 0.01, z - 0.115], [sx * 0.24, yy + 0.01, z - 0.02], 0.0175, M.grip))
  }
  return G(parts)
}

function stepPlatform(p) {
  const h = p.height ?? 0.2
  const w = p.width ?? 1.0
  const d = p.depth ?? 0.38
  const t = 0.05
  const parts = []
  parts.push(mesh(padGeo({ w: d, l: w, t, rc: 0.04, edge: 0.016, crown: 0.0015, seam: 0, bulge: 0.001 }), M.deck, [0, h - t, 0]))
  parts[0].rotation.y = Math.PI / 2
  // Ribs across the deck.
  const n = Math.floor((d - 0.08) / 0.03)
  const ribs = cached(`stepribs${w},${d},${n}`, () => {
    const list = []
    const rib = new THREE.BoxGeometry(w - 0.1, 0.0014, 0.012)
    for (let i = 0; i < n; i++) list.push([rib, new M4().makeTranslation(0, 0, -((n - 1) * 0.03) / 2 + i * 0.03)])
    return mergeGeos(list)
  })
  const rb = mesh(ribs, M.rubber, [0, h + 0.0002, 0])
  rb.castShadow = false
  parts.push(rb)
  // Two risers, stacked in courses of 0.05 m with a visible joint.
  const under = h - t
  const courses = Math.max(1, Math.round(under / 0.05))
  const ch = under / courses
  for (const sx of [-1, 1]) {
    for (let i = 0; i < courses; i++) {
      const x = sx * (w / 2 - 0.2)
      parts.push(rbox(0.24, num(ch - 0.002), num(d - 0.03), 0.012, M.plastic, [x, ch / 2 + i * ch, 0], 2))
      if (ch > 0.03) for (const sz of [-1, 1]) parts.push(rbox(0.13, 0.016, 0.001, 0.0004, M.hole, [x, ch * 0.5 + i * ch, sz * (d / 2 - 0.015 + 0.0006)], 1))
    }
    parts.push(rbox(0.25, 0.004, num(d - 0.02), 0.002, M.rubber, [sx * (w / 2 - 0.2), 0.002, 0], 1))
  }
  return G(parts)
}

function floorMat(p) {
  const L = p.length ?? 1.9
  const W = p.width ?? 0.75
  const t = p.thickness ?? 0.012
  const style = p.style ?? 'mat'
  if (style === 'gym') {
    // A folding gym mat: thick vinyl over foam, sewn across at each fold.
    const T = p.thickness ?? 0.05
    const panels = p.panels ?? 3
    const grooves = []
    for (let i = 1; i < panels; i++) grooves.push({ z: num(-L / 2 + (i * L) / panels), width: 0.0035, depth: 0.012 })
    return G(mesh(padGeo({ w: W, l: L, t: T, rc: 0.03, edge: 0.018, crown: 0.002, seam: 0.018, grooves }), M.foam))
  }
  const parts = [mesh(padGeo({ w: W, l: L, t, rc: 0.012, edge: Math.min(0.005, t * 0.45), crown: 0.0005, seam: 0.018, seamDepth: 0.0009, bulge: 0 }), M.mat)]
  if (p.roll) {
    // The end of the mat still rolled up, for a mat left half unrolled.
    const r = 0.055
    parts.push(cyl(r, W, M.rubber, [0, r, L / 2 + r * 0.6], 'x'))
    parts.push(cyl(num(r * 0.5), num(W + 0.001), M.hole, [0, r, L / 2 + r * 0.6], 'x'))
  }
  return G(parts)
}

/**
 * Press boards: 2x6 pieces screwed together, held on the chest. follow: 'chest' sits them on the lifter's sternum for every frame
 * (world coordinates, from ctx.frames.chest); otherwise they stand on the floor at p.pos.
 */
function pressBoard(p, ctx) {
  const n = p.boards ?? 2
  const T = 0.038
  const w = 0.14
  const L = p.length ?? 0.36
  const key = `boards${n},${w},${L}`
  const screws = cached(key, () => {
    const list = []
    const hd = new THREE.CylinderGeometry(0.0048, 0.0048, 0.001, 10)
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) list.push([hd, new M4().makeTranslation(sx * (w / 2 - 0.03), T * n + 0.0002, sz * (L / 2 - 0.04))])
    return mergeGeos(list)
  })
  const parts = []
  for (let i = 0; i < n; i++) {
    // Each board steps back a little at the end the partner holds, the way real ones are stacked.
    const step = 0.03 * i
    const len = num(L - step)
    const zc = num(step / 2)
    parts.push(rbox(w, 0.0375, len, 0.0035, M.wood, [0, T * (i + 0.5), zc], 2))
    parts.push(rbox(num(w - 0.002), 0.0007, 0.001, 0.0002, M.woodEnd, [0, T * (i + 0.5), zc + len / 2 + 0.0002], 1))
  }
  parts.push(mesh(screws, M.steel))
  const g = G(parts)
  if (!ctx || !p.follow) return g
  // World frame: chest forward (+Z of the chest frame) is the board's up, along the torso is the board's length.
  const f = ctx.frames.chest
  const q = new Q4(f.quat[0], f.quat[1], f.quat[2], f.quat[3])
  const off = new V3(p.offset?.[0] ?? 0, p.offset?.[1] ?? 0.0, p.offset?.[2] ?? 0.186).applyQuaternion(q)
  const up = new V3(0, 0, 1).applyQuaternion(q)
  const along = new V3(0, 1, 0).applyQuaternion(q)
  const x = along.clone().cross(up).normalize()
  const m = new M4().makeBasis(x.clone().negate(), up, along.clone().negate())
  // Local +Y of the stack goes along the chest's forward direction.
  const outer = new THREE.Group()
  outer.position.set(f.pos[0] + off.x, f.pos[1] + off.y, f.pos[2] + off.z)
  outer.quaternion.setFromRotationMatrix(m)
  outer.add(g)
  outer.userData.world = true
  return outer
}

/**
 * Foot anchor: a low padded roller on a floor frame, to hook the feet under for sit-ups or the ankles for Nordic curls. Open on
 * the -Z side, where the user is; the cross tube behind the toes is at z = +0.26.
 */
function footAnchor(p) {
  const gap = p.height ?? 0.13
  const r = 0.05
  const y = gap + r
  const w = p.width ?? 0.56
  const parts = []
  const x = w / 2 + 0.035
  for (const sx of [-1, 1]) {
    parts.push(floorZ(sx * x, -0.28, 0.28, { width: 0.05 }))
    parts.push(beam([sx * x, 0.05, 0], [sx * x, y + 0.03, 0], 0.05, 0.05, M.frame, { weldA: true, capB: true }))
    parts.push(plateYZ([[0.025, 0.05], [0.16, 0.05], [0.025, y - 0.015]].map((q) => q.map(num)), sx * x, 0.008, M.frame))
    parts.push(bolt([sx * (x + 0.025), y, 0], [sx, 0, 0], 0.011))
  }
  parts.push(beam([-x, 0.039, 0.26], [x, 0.039, 0.26], 0.05, 0.05, M.frame, {}))
  parts.push(rod([-x, y, 0], [x, y, 0], 0.014, M.steel))
  parts.push(roller([0, y, 0], 'x', r, num(w - 0.01), { ends: true }))
  return G(parts)
}

// ---------------------------------------------------------------------------------------------------------------------
// Bars and bodyweight stations
// ---------------------------------------------------------------------------------------------------------------------

function pullUpBar(p) {
  const H = p.height ?? 2.25
  const W = p.width ?? 1.22
  const mount = p.mount ?? 'free'
  const r = 0.016
  const parts = []
  const hw = W / 2
  const s = 0.07
  if (mount === 'free') {
    for (const sx of [-1, 1]) {
      const x = sx * hw
      parts.push(floorZ(x, -0.72, 0.72, { width: 0.07 }))
      parts.push(beam([x, 0.05, 0], [x, H + 0.075, 0], s, s, M.frame, { capB: true, weldA: true }))
      // Raking braces fore and aft: a free stand has to resist a swinging user.
      for (const sz of [-1, 1]) parts.push(beam([x, 0.05, sz * 0.62], [x, 1.24, sz * (s / 2)], 0.045, 0.045, M.frame, { weldA: [0, 1, 0], weldB: [0, 0, sz], side: [1, 0, 0] }))
      const col = G(holeColumn(s, 1.3, H - 0.05, 0.05, ['x', '-x']))
      col.position.set(x, 0, 0)
      parts.push(col)
    }
    // A low tie between the two sides.
    parts.push(beam([-hw, 0.039, -0.6], [hw, 0.039, -0.6], 0.07, 0.05, M.frame, {}))
    parts.push(beam([-hw, 0.039, 0.6], [hw, 0.039, 0.6], 0.07, 0.05, M.frame, {}))
  } else if (mount === 'rack') {
    // A half rack seen around the bar: two uprights each side, floor and top rails.
    const dp = 0.75
    const Ht = H + 0.1
    for (const sx of [-1, 1]) {
      const x = sx * hw
      parts.push(floorZ(x, -dp - 0.15, 0.18, { width: 0.075 }))
      for (const z of [0, -dp]) {
        parts.push(beam([x, 0.05, z], [x, Ht, z], 0.075, 0.075, M.frame, { capB: true, weldA: true }))
        const col = G(holeColumn(0.075, 0.2, Ht - 0.12, 0.05))
        col.position.set(x, 0, z)
        parts.push(col)
      }
      parts.push(beam([x, H, -dp + 0.0375], [x, H, -0.0375], 0.075, 0.05, M.frame, {}))
    }
    parts.push(beam([-hw, 0.039, -dp], [hw, 0.039, -dp], 0.075, 0.05, M.frame, {}))
    parts.push(beam([-hw, H, -dp], [hw, H, -dp], 0.075, 0.05, M.frame, {}))
  } else if (mount === 'wall') {
    const wallZ = p.wallZ ?? -0.5
    for (const sx of [-1, 1]) {
      const x = sx * hw * 0.8
      parts.push(rbox(0.1, 0.3, 0.01, 0.003, M.frameLight, [x, H, wallZ], 2))
      for (const dy of [-0.11, 0.11]) parts.push(bolt([x, H + dy, wallZ + 0.005], [0, 0, 1], 0.011))
      parts.push(beam([x, H, wallZ + 0.005], [x, H, 0.0], 0.05, 0.05, M.frame, { weldA: true, capB: true }))
      parts.push(beam([x, H - 0.14, wallZ + 0.005], [x, H - 0.012, wallZ + 0.3], 0.04, 0.03, M.frame, { weld: true, side: [1, 0, 0] }))
    }
  }
  // The bar itself: 32 mm, knurled where the hands go, in a welded sleeve at each end.
  const xB = mount === 'wall' ? hw : hw - s / 2
  parts.push(grippedBar([-xB, H, 0], [xB, H, 0], r, { knurlAt: [[0.08, 0.44], [0.56, 0.92]] }))
  for (const sx of [-1, 1]) parts.push(cyl(0.028, 0.012, M.frameLight, [sx * (xB - 0.004), H, 0], 'x'))
  // Multi-grip handles forward of the main bar: neutral grips close and wide, and an angled outer grip.
  if (p.multi) {
    const yy = H
    for (const x of [0.2, 0.32]) {
      for (const sx of [-1, 1]) {
        parts.push(rod([sx * x, yy, 0], [sx * x, yy, 0.22], 0.015, M.steel, { weldA: true, cap: true }))
        parts.push(rod([sx * x, yy, 0.07], [sx * x, yy, 0.19], 0.0175, M.grip))
      }
    }
    for (const sx of [-1, 1]) {
      parts.push(bentRod([[sx * 0.44, yy, 0], [sx * 0.48, yy + 0.0, 0.08], [sx * 0.46, yy - 0.09, 0.2]], 0.015, M.steel, { bend: 0.05, capB: true }))
    }
  }
  return G(parts)
}

/**
 * The close-grip V handle, hung over a bar. At yaw 0 the V lies in the X-Y plane and straddles a bar running along Z; p.pos is
 * the point on the axis of that bar (not on the floor), and the two grips fall away to each side. Hand centres are in
 * BODY['v-handle'], relative to p.pos.
 */
function vHandle() {
  const parts = []
  const r = 0.0125
  // The legs run straight into an arch that clears the 32 mm bar.
  const R = 0.034
  const arch = []
  for (let i = 0; i <= 24; i++) {
    const t = Math.PI * (1 + 0.14 - (1.28 * i) / 24)
    arch.push(new V3(Math.cos(t) * R, Math.sin(t) * R + 0.002, 0))
  }
  const legPts = (sx) => [new V3(sx * 0.168, -0.203, 0), new V3(sx * 0.06, -0.087, 0)]
  const line = [...legPts(-1), ...arch, ...legPts(1).reverse()]
  const body = cached('vhandle', () => {
    const c = new THREE.CatmullRomCurve3(line, false, 'centripetal')
    return sweepGeo(c.getSpacedPoints(90), r, 16)
  })
  parts.push(mesh(body, M.chrome))
  // Knurled rubber grips on both legs, and the swivel eye the handle normally hangs from on a cable.
  for (const sx of [-1, 1]) {
    parts.push(between([sx * 0.074, -0.102, 0], [sx * 0.158, -0.192, 0], 0.0148, M.grip, 24))
    parts.push(aim(lathe(capProfile(0.0148), M.cap, [0, 0, 0]), [sx * 0.158, -0.192, 0], [sx * 0.68, -0.73, 0]))
  }
  parts.push(aim(mesh(ringY(0.016, 0.004), M.steel), [0, 0.066, 0], [0, 0, 1]))
  parts.push(cyl(0.008, 0.016, M.steel, [0, 0.046, 0], 'y', { seg: 16 }))
  return G(parts)
}

function parallelBars(p) {
  const H = p.height ?? 1.3
  const L = p.length ?? 2.2
  const sp = p.spacing ?? 0.56
  const rail = p.rail ?? 'steel'
  const parts = []
  const x = sp / 2
  const zp = L / 2 - 0.3
  for (const sx of [-1, 1]) {
    const xx = sx * x
    if (rail === 'wood') {
      // Oval wood rail, a strip of darker finish where the hands sit.
      const g = cached(`pwood${L}`, () => {
        const c = new THREE.CylinderGeometry(0.024, 0.024, L, 28)
        c.scale(1, 1, 1.28)
        c.rotateX(Math.PI / 2)
        return c
      })
      parts.push(mesh(g, M.wood, [xx, H, 0]))
    } else {
      parts.push(rod([xx, H, -L / 2], [xx, H, L / 2], 0.0255, M.steel, { cap: true }))
    }
  }
  for (const z of [-zp, zp]) {
    const yB = 0.05
    parts.push(floorX(z, sp + 0.64))
    for (const sx of [-1, 1]) {
      const xx = sx * x
      // Telescoping post: a square outer, a round chrome inner, a pull pin between.
      parts.push(beam([xx, yB, z], [xx, H * 0.56, z], 0.07, 0.07, M.frame, { weldA: true }))
      parts.push(rod([xx, H * 0.5, z], [xx, H - 0.03, z], 0.024, M.steel, {}))
      parts.push(popPin([xx + sx * 0.035, H * 0.5, z], [sx, 0, 0]))
      parts.push(rod([xx, H - 0.03, z - 0.03], [xx, H - 0.03, z + 0.03], 0.03, M.frameLight, {}))
    }
  }
  parts.push(beam([0, 0.039, -zp], [0, 0.039, zp], 0.07, 0.05, M.frame, {}))
  return G(parts)
}

function dipStation(p) {
  const H = p.height ?? 1.25
  const sp = p.spacing ?? 0.56
  const parts = []
  const x = sp / 2
  const Z0 = -0.42
  const Z1 = 0.3
  // Floor frame: two rails and a rear cross, open at the front to step in.
  const xF = x + 0.16
  for (const sx of [-1, 1]) parts.push(floorZ(sx * xF, Z0 - 0.08, Z1 + 0.1, { width: 0.06 }))
  parts.push(beam([-xF, 0.039, Z0], [xF, 0.039, Z0], 0.06, 0.05, M.frame, {}))
  // A single bent tube makes the bars and closes them behind the hips; two posts each side hold it up.
  parts.push(bentRod([[-x, H, Z1], [-x, H, Z0], [x, H, Z0], [x, H, Z1]], 0.022, M.steel, { bend: 0.07 }))
  for (const sx of [-1, 1]) {
    const xx = sx * x
    // Rubber sleeves where the hands go, with caps at the bar ends.
    parts.push(rod([xx, H, -0.2], [xx, H, Z1], 0.0255, M.grip, { capB: true }))
    parts.push(beam([sx * xF, 0.05, Z1 - 0.02], [xx, H - 0.02, Z1 - 0.12], 0.05, 0.05, M.frame, { weldA: [0, 1, 0], side: [1, 0, 0] }))
    parts.push(beam([sx * xF, 0.05, Z0 + 0.03], [xx, H - 0.02, Z0 + 0.14], 0.05, 0.05, M.frame, { weldA: [0, 1, 0], side: [1, 0, 0] }))
  }
  // Tie the posts together behind the user.
  parts.push(beam([-(x + 0.1), 0.5, Z0 + 0.075], [x + 0.1, 0.5, Z0 + 0.075], 0.04, 0.04, M.frame, { weld: true }))
  return G(parts)
}

function captainsChair(p) {
  const padY = p.padY ?? 1.3
  const parts = []
  const xU = 0.3
  const zU = -0.24
  const s = 0.07
  const hTop = padY + 0.42
  const armLen = 0.5
  // Tower: two uprights on a floor frame.
  for (const sx of [-1, 1]) {
    const x = sx * xU
    parts.push(floorZ(x, zU - 0.34, 0.56, { width: 0.07 }))
    parts.push(beam([x, 0.05, zU], [x, hTop, zU], s, s, M.frame, { capB: true, weldA: true }))
    parts.push(beam([x, 0.05, zU - 0.28], [x, padY - 0.12, zU - s / 2], 0.045, 0.045, M.frame, { weldA: [0, 1, 0], weldB: [0, 0, 1], side: [1, 0, 0] }))
    // The arm: a tube along Z under the pad, with a kicker brace below it.
    const xA = sx * 0.225
    parts.push(beam([x, padY - 0.058, zU], [xA, padY - 0.058, zU + 0.12], 0.05, 0.04, M.frame, { weld: true, side: [1, 0, 0] }))
    parts.push(beam([xA, padY - 0.058, zU + 0.1], [xA, padY - 0.058, zU + armLen + 0.04], 0.05, 0.04, M.frame, { capB: true }))
    parts.push(beam([x, padY - 0.34, zU], [xA, padY - 0.078, zU + 0.3], 0.04, 0.04, M.frame, { weld: true, side: [1, 0, 0] }))
    // Forearm pad.
    parts.push(rbox(0.09, 0.008, 0.36, 0.003, M.frameDark, [xA, padY - 0.054, zU + 0.25], 1))
    parts.push(pad({ w: 0.1, l: 0.38, t: 0.052, rc: 0.04, edge: 0.024, crown: 0.004, seam: 0.012 }, [xA, padY - 0.052, zU + 0.25]))
    // The handle: a short upright at the pad's front end, foam sleeved.
    const zG = zU + 0.53
    parts.push(rod([xA, padY - 0.04, zG], [xA, padY + 0.15, zG], 0.0135, M.steel, { weldA: true }))
    parts.push(rod([xA, padY + 0.0, zG], [xA, padY + 0.145, zG], 0.0165, M.grip, { capB: true }))
    // A step each side, to climb up on.
    parts.push(beam([x, 0.34, zU], [x, 0.34, zU + 0.27], 0.05, 0.03, M.frame, { weldA: true, capB: true }))
    parts.push(rbox(0.14, 0.024, 0.23, 0.005, M.rubber, [x + sx * 0.03, 0.363, zU + 0.16], 2))
    // Dip bars, below the arms.
    if (p.dips !== false) {
      const yD = padY - 0.42
      parts.push(bentRod([[x, yD, zU], [sx * 0.29, yD, zU + 0.2], [sx * 0.275, yD, 0.42]], 0.0165, M.steel, { bend: 0.08, capB: true }))
    }
    parts.push(bolt([x + sx * (s / 2), padY - 0.058, zU], [sx, 0, 0], 0.01))
    parts.push(bolt([x + sx * (s / 2), padY - 0.34, zU], [sx, 0, 0], 0.01))
  }
  parts.push(beam([-xU, 0.039, zU - 0.25], [xU, 0.039, zU - 0.25], 0.07, 0.05, M.frame, {}))
  parts.push(beam([-xU, hTop - 0.14, zU], [xU, hTop - 0.14, zU], 0.05, 0.05, M.frame, {}))
  parts.push(beam([-xU, padY - 0.56, zU], [xU, padY - 0.56, zU], 0.05, 0.05, M.frame, {}))
  // The back pad, its face at z = -0.16.
  const bh = 0.56
  const yC = padY - 0.13
  const bp = new THREE.Group()
  bp.position.set(0, yC, zU + 0.0)
  bp.rotation.x = -Math.PI / 2
  // Pad's local +Y must point to +Z (the user); rotation.x = +90 does that.
  bp.rotation.x = Math.PI / 2
  bp.add(pad({ w: 0.26, l: bh, t: 0.05, rc: 0.05, edge: 0.024, crown: 0.006, seam: 0.018 }, [0, 0.03, 0]))
  bp.add(rbox(0.24, 0.012, num(bh - 0.02), 0.004, M.frameDark, [0, 0.024, 0], 2))
  parts.push(bp)
  parts.push(beam([-0.08, yC - 0.2, zU + 0.01], [-0.08, yC + 0.2, zU + 0.01], 0.03, 0.03, M.frame, {}))
  parts.push(beam([0.08, yC - 0.2, zU + 0.01], [0.08, yC + 0.2, zU + 0.01], 0.03, 0.03, M.frame, {}))
  parts.push(beam([-0.08, padY - 0.13, zU], [0.08, padY - 0.13, zU], 0.04, 0.03, M.frame, {}))
  parts.push(beam([-xU, padY - 0.13, zU], [xU, padY - 0.13, zU], 0.04, 0.04, M.frame, {}))
  return G(parts)
}

// Local frame of a back-extension bench: u runs from feet to head, f is the way the belly faces.
const seg2 = (H, u, f, a, b) => [H[0] + a * u[1] + b * f[1], H[1] + a * u[0] + b * f[0]]

function backExtensionFrame(H, angle) {
  // (y, z) axes in the bench's slope.
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const u = [c, s] // [y, z] of feet-to-head
  const f = [-s, c] // [y, z] of the belly direction
  return { u, f, pt: (a, b, x = 0) => [x, H[0] + a * u[0] + b * f[0], H[1] + a * u[1] + b * f[1]] }
}

/** Two rolled hip pads, the foot plate, ankle rollers: the working parts shared by both back extension benches. */
function backExtensionParts(H, angle, opts = {}) {
  const { pt, u, f } = backExtensionFrame(H, angle)
  const parts = []
  const padB = opts.padB ?? 0.1
  // The pads stop 0.16 below the hip joint: the belly has to fold past their top edge at the bottom of the rep.
  const a0 = -0.46
  const a1 = -0.16
  const lp = a1 - a0
  // A group whose +Y is the pad's face normal, toward the body, and +Z runs from head to feet.
  const g = new THREE.Group()
  const C = pt((a0 + a1) / 2, padB + 0.085)
  g.position.set(C[0], C[1], C[2])
  const nY = new V3(0, -f[0], -f[1]) // toward the body
  const zL = new V3(0, -u[0], -u[1])
  g.quaternion.setFromRotationMatrix(new M4().makeBasis(nY.clone().cross(zL), nY, zL))
  for (const sx of [-1, 1]) g.add(pad({ w: 0.2, l: lp, t: 0.085, rc: 0.06, edge: 0.038, crown: 0.012, seam: 0.018 }, [sx * 0.112, 0, 0]))
  g.add(rbox(0.41, 0.012, num(lp - 0.075), 0.004, M.frameDark, [0, -0.006, 0], 2))
  parts.push(g)
  // Spine under the pads.
  const bS = padB + 0.085 + 0.012 + 0.035
  parts.push(beam(pt(-0.99, bS), pt(-0.2, bS), 0.06, 0.07, M.frame, { capB: true, side: [1, 0, 0] }))
  // Foot plate, square to the legs, on an arm off the spine; the soles sit at a = -0.93.
  const aP = -0.93
  const pg = new THREE.Group()
  const Cp = pt(aP - 0.01, 0.05)
  pg.position.set(Cp[0], Cp[1], Cp[2])
  // Plate's +Y points along u, its +Z along f.
  const yL = new V3(0, u[0], u[1])
  const zPl = new V3(0, f[0], f[1])
  pg.quaternion.setFromRotationMatrix(new M4().makeBasis(yL.clone().cross(zPl), yL, zPl))
  pg.add(rbox(0.34, 0.016, 0.26, 0.006, M.frame, [0, 0, 0], 2))
  pg.add(mesh(padGeo({ w: 0.33, l: 0.25, t: 0.006, rc: 0.006, edge: 0.002, crown: 0, seam: 0, bulge: 0 }), M.rubberTop, [0, 0.004, 0]))
  const rib = cached('fpribs', () => {
    const list = []
    const b = new THREE.BoxGeometry(0.29, 0.0012, 0.006)
    for (let i = 0; i < 9; i++) list.push([b, new M4().makeTranslation(0, 0, -0.1 + i * 0.025)])
    return mergeGeos(list)
  })
  const rb = mesh(rib, M.rubber, [0, 0.0105, 0])
  rb.castShadow = false
  pg.add(rb)
  parts.push(pg)
  parts.push(beam(pt(aP - 0.04, bS), pt(aP - 0.04, 0.08), 0.05, 0.04, M.frame, { side: [1, 0, 0], weldA: true }))
  // Ankle rollers behind the Achilles, on a post that comes up between the feet.
  const aR = aP + 0.1
  const bR = -0.1
  parts.push(beam(pt(aR, bS), pt(aR, bR), 0.036, 0.036, M.frame, { capB: true, side: [1, 0, 0] }))
  const Rc = pt(aR, bR)
  parts.push(rod([-0.03, Rc[1], Rc[2]], [0.03, Rc[1], Rc[2]], 0.012, M.steel))
  for (const sx of [-1, 1]) parts.push(roller([sx * 0.115, Rc[1], Rc[2]], 'x', 0.055, 0.17))
  return { parts, pt, bS, aP }
}

function romanChair45(p) {
  const angle = clamp(p.angle ?? 45, 20, 70) * D
  const H = [0.9, 0]
  const { parts, pt, bS } = backExtensionParts(H, angle)
  const low = pt(-0.99, bS)
  const yF = 0.039
  const z0 = low[2] - 0.06
  const z1 = 0.36
  parts.push(floorX(z0, 0.62))
  parts.push(floorX(z1, 0.62))
  parts.push(beam([0, yF, z0], [0, yF, z1], 0.06, 0.05, M.frame, {}))
  // The spine's foot, and a big side plate with round cut-outs that carries the spine at its top.
  const hi = pt(-0.26, bS)
  const round = (a) => a.map((q) => q.map(num))
  const zA = low[2] + 0.1
  const poly = [[zA, 0.064], [hi[2] + 0.11, 0.064], [hi[2] + 0.015, hi[1] - 0.05], [hi[2] - 0.03, hi[1] - 0.04], [zA, low[1] + 0.09]]
  const t = 0.38
  const hRow = [[0.18, 0.05], [0.42, 0.04], [0.66, 0.032]].map(([f, r]) => [zA + (hi[2] + 0.06 - zA) * (f + 0.12), 0.064 + (hi[1] - 0.1) * f * 0.8 * (t / 0.38), r])
  for (const sx of [-1, 1]) parts.push(plateYZ(round(poly), sx * 0.0345, 0.008, M.frame, round(hRow)))
  parts.push(beam([0, 0.064, low[2]], [low[0], low[1] + 0.02, low[2]], 0.06, 0.06, M.frame, { weldA: true }))
  // The height knob for the hip pads.
  parts.push(popPin(pt(-0.2, bS, 0.03), [1, 0, 0]))
  return G(parts)
}

function romanChair90(p) {
  const H = [p.hipY ?? 0.95, 0]
  const { parts, pt, bS } = backExtensionParts(H, Math.PI / 2)
  const yS = pt(-0.3, bS)[1]
  const zLeg = -0.42
  const zRear = -0.98
  const yF = 0.039
  // Main post under the pads, the rear post under the foot plate, on one long floor beam with T-feet.
  const zF = 0.42
  parts.push(floorX(zF, 0.7))
  parts.push(floorX(zRear - 0.06, 0.6))
  parts.push(beam([0, yF, zRear - 0.06], [0, yF, zF], 0.07, 0.05, M.frame, {}))
  parts.push(beam([0, 0.064, zLeg], [0, yS - 0.03, zLeg], 0.07, 0.07, M.frame, { weld: true }))
  parts.push(beam([0, 0.064, zRear + 0.03], [0, yS - 0.03, zRear + 0.03], 0.05, 0.05, M.frame, { weld: true }))
  const round = (a) => a.map((q) => q.map(num))
  for (const sx of [-1, 1]) {
    parts.push(plateYZ(round([[zLeg - 0.02, yS - 0.03], [zLeg - 0.3, yS - 0.03], [zLeg - 0.02, yS - 0.33]]), sx * 0.0385, 0.006, M.frame, round([[zLeg - 0.1, yS - 0.11, 0.035]])))
    parts.push(plateYZ(round([[zLeg - 0.02, 0.09], [zLeg - 0.3, 0.09], [zLeg - 0.02, 0.4]]), sx * 0.0385, 0.006, M.frame, round([[zLeg - 0.1, 0.17, 0.035]])))
  }
  return G(parts)
}

const GHD = { ankleAbovePad: 0.025, kneeZ: -0.13, kneeAbovePad: 0.045, ankleZ: -0.57, thighRise: 15 }

function ghd(p) {
  const parts = []
  const yF = 0.039
  const Ra = p.drumR ?? 0.15
  const yC = (p.padY ?? 1.005) - Ra
  const zC = 0.02
  const zFoot = -0.64
  const yA = yC + Ra + GHD.ankleAbovePad
  const zEnd = 0.56
  const zRear = -0.87
  parts.push(floorX(zEnd, 0.76))
  parts.push(floorX(zRear, 0.7))
  parts.push(beam([0, yF, zRear], [0, yF, zEnd], 0.08, 0.05, M.frame, {}))
  // Hump tower: a square post with gussets carrying the axle of the two drums.
  parts.push(beam([0, 0.064, zC], [0, yC, zC], 0.075, 0.075, M.frame, { weld: true }))
  const round = (a) => a.map((q) => q.map(num))
  for (const sx of [-1, 1]) {
    parts.push(plateYZ(round([[zC - 0.03, 0.09], [zC + 0.34, 0.09], [zC + 0.03, 0.56]]), sx * 0.0405, 0.006, M.frame, round([[zC + 0.09, 0.2, 0.05]])))
    parts.push(plateYZ(round([[zC + 0.03, 0.09], [zC - 0.34, 0.09], [zC - 0.03, 0.56]]), sx * 0.0405, 0.006, M.frame, round([[zC - 0.09, 0.2, 0.05]])))
    parts.push(rbox(0.014, 0.1, 0.1, 0.004, M.frameLight, [sx * 0.0405, yC - 0.02, zC], 2))
  }
  parts.push(rod([-0.045, yC, zC], [0.045, yC, zC], 0.02, M.steel))
  const lenD = 0.235
  for (const sx of [-1, 1]) {
    const cx = sx * (0.022 + lenD / 2)
    parts.push(lathe(drumProfile(Ra, lenD), M.vinyl, [cx, yC, zC], 'x', 56))
    // Machined end caps with a ring of lightening holes, as on the real thing.
    for (const ss of [-1, 1]) {
      const xe = cx + (ss * lenD) / 2
      parts.push(aim(lathe(drumCapProfile(Ra), M.steel, [0, 0, 0], 'y', 48), [xe, yC, zC], [ss, 0, 0]))
      for (let i = 0; i < 8; i++) {
        const q = (i / 8) * 2 * Math.PI
        parts.push(cyl(0.012, 0.0014, M.hole, [xe + ss * 0.0052, yC + Math.cos(q) * Ra * 0.56, zC + Math.sin(q) * Ra * 0.56], 'x', { seg: 14 }))
      }
    }
  }
  // Foot tower: post, plate behind the soles, two pairs of rollers that trap the ankles.
  const zT = zFoot - 0.05
  const yTopT = yA + 0.22
  parts.push(beam([0, 0.064, zT], [0, yTopT, zT], 0.075, 0.075, M.frame, { weldA: true, capB: true }))
  const col = G(holeColumn(0.075, 0.55, yTopT - 0.05, 0.05, ['x', '-x']))
  col.position.set(0, 0, zT)
  parts.push(col)
  for (const sx of [-1, 1]) parts.push(plateYZ(round([[zT - 0.34, 0.09], [zT + 0.03, 0.09], [zT + 0.03, 0.5]]), sx * 0.0405, 0.006, M.frame, round([[zT - 0.09, 0.2, 0.05]])))
  // Plate: its working face at z = zFoot, facing +Z.
  const pg = new THREE.Group()
  pg.position.set(0, yA - 0.05, zFoot - 0.009)
  pg.rotation.x = Math.PI / 2
  pg.add(rbox(0.32, 0.016, 0.32, 0.006, M.frame, [0, 0, 0], 2))
  pg.add(mesh(padGeo({ w: 0.31, l: 0.31, t: 0.006, rc: 0.006, edge: 0.002, crown: 0, seam: 0, bulge: 0 }), M.rubberTop, [0, 0.004, 0]))
  parts.push(pg)
  // Arms carrying the rollers out from the tower.
  const zRoll = zFoot + 0.085
  const yUp = yA + 0.098
  const yLow = yA - 0.1
  parts.push(beam([0, yUp, zT], [0, yUp, zRoll], 0.04, 0.04, M.frame, { capB: true, weldA: true }))
  parts.push(beam([0, yLow, zT], [0, yLow, zRoll], 0.04, 0.04, M.frame, { capB: true, weldA: true }))
  for (const y of [yUp, yLow]) {
    parts.push(rod([-0.03, y, zRoll], [0.03, y, zRoll], 0.012, M.steel))
    for (const sx of [-1, 1]) parts.push(roller([sx * 0.125, y, zRoll], 'x', 0.058, 0.19))
  }
  // A step to climb in.
  for (const sx of [-1, 1]) {
    parts.push(beam([sx * 0.04, 0.42, zT], [sx * 0.2, 0.42, zT + 0.0], 0.04, 0.03, M.frame, { capB: true, weldA: true }))
    parts.push(rbox(0.15, 0.024, 0.19, 0.005, M.rubber, [sx * 0.15, 0.443, zT + 0.05], 2))
  }
  return G(parts)
}

const drumProfile = (R, L) => {
  const h = L / 2
  const k = 0.02
  const out = [[0.0001, -h], [num(R - k), -h]]
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2)
    out.push([num(R - k + Math.sin(a) * k), num(-h + k - Math.cos(a) * k)])
  }
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2)
    out.push([num(R - k + Math.cos(a) * k), num(h - k + Math.sin(a) * k)])
  }
  out.push([0.0001, h])
  return out
}
const drumCapProfile = (R) => [[0.0001, 0.0], [num(R * 0.9), 0.0], [num(R * 0.82), 0.005], [num(R * 0.72), 0.005], [num(R * 0.34), 0.005], [num(R * 0.3), 0.012], [num(R * 0.16), 0.014], [num(R * 0.16), 0.02], [0.0001, 0.02]]

// ---------------------------------------------------------------------------------------------------------------------
// Straps, rings, rope: the parts that follow the hands
// ---------------------------------------------------------------------------------------------------------------------

/** A flat strap between two points. wHint is a direction the strap's width should lie along. */
function strap(a, b, width, wHint = [1, 0, 0], m = M.strap, thick = 0.003) {
  return beam(a, b, width, thick, m, { side: wHint, r: 0.0012 })
}

/** A cam buckle on a strap at p, along the strap's direction. */
function camBuckle(p, dir, side) {
  const q = basisQ(dir, side)
  const o = rbox(0.05, 0.05, 0.012, 0.004, M.steel)
  o.position.set(p[0], p[1], p[2])
  o.quaternion.copy(q)
  const bar = rbox(0.04, 0.014, 0.018, 0.004, M.frameDark)
  bar.position.copy(vec(p).add(new V3(0, 0.012, 0.002).applyQuaternion(q)))
  bar.quaternion.copy(q)
  return [o, bar]
}

function strapDirs(from, anchor) {
  const up = vec(anchor).sub(vec(from)).normalize()
  return up
}

/** One suspension handle: rubber sleeve along `thumb` through `c`, a triangle of webbing up to a buckle, a strap to the anchor. */
function suspensionHandle(c, thumb, anchor) {
  const C = vec(c)
  const up = strapDirs(c, anchor)
  const axis = vec(thumb).addScaledVector(up, -vec(thumb).dot(up)).normalize()
  const hl = 0.066
  const A = C.clone().addScaledVector(axis, -hl)
  const B = C.clone().addScaledVector(axis, hl)
  const apex = C.clone().addScaledVector(up, 0.15)
  const parts = [between(A.toArray(), B.toArray(), 0.0165, M.grip, 24)]
  const face = axis.toArray()
  const nrm = axis.clone().cross(up).normalize()
  parts.push(aim(lathe(capProfile(0.0165), M.cap, [0, 0, 0]), B.toArray(), axis.toArray()))
  parts.push(aim(lathe(capProfile(0.0165), M.cap, [0, 0, 0]), A.toArray(), axis.clone().negate().toArray()))
  for (const E of [A, B]) parts.push(strap(E.toArray(), apex.toArray(), 0.022, nrm.toArray(), M.strapDark, 0.003))
  parts.push(camBuckle(apex.clone().addScaledVector(up, 0.012).toArray(), up.toArray(), face))
  parts.push(strap(apex.toArray(), anchor, 0.038, face, M.strap))
  return parts
}

/** A sling around a foot, for suspended leg work: `foot` is a ctx.feet entry. */
function footCradle(foot2, anchor) {
  const ankle = vec(foot2.ankle)
  const ball = vec(foot2.ball)
  const up = vec(foot2.up)
  const fwd = vec(foot2.forward)
  const C = ankle.clone().lerp(ball, 0.42).addScaledVector(up, 0.004)
  const parts = []
  // A flat loop round the arch and instep, in the plane square to the foot's length.
  const loop = mesh(cached('cradle', () => {
    const pts = []
    for (let i = 0; i <= 36; i++) {
      const a = (i / 36) * 2 * Math.PI
      pts.push(new V3(Math.cos(a) * 0.058, Math.sin(a) * 0.05, 0))
    }
    return sweepGeo(pts, 0.006, 8, false)
  }), M.strap)
  loop.position.copy(C)
  const side = up.clone().cross(fwd).normalize()
  loop.quaternion.setFromRotationMatrix(new M4().makeBasis(side, up, fwd))
  parts.push(loop)
  const dirUp = strapDirs(C.toArray(), anchor)
  const top = C.clone().addScaledVector(dirUp, 0.05)
  const apex = C.clone().addScaledVector(dirUp, 0.14)
  parts.push(strap(top.toArray(), apex.toArray(), 0.03, side.toArray(), M.strapDark))
  parts.push(camBuckle(apex.toArray(), dirUp.toArray(), side.toArray()))
  parts.push(strap(apex.toArray(), anchor, 0.038, side.toArray(), M.strap))
  return parts
}

/** A length of overhead beam along X, for straps to hang from. Its underside is at y. */
function overheadBeam(x, y, z, w = 1.5) {
  return [beam([x - w / 2, y + 0.05, z], [x + w / 2, y + 0.05, z], 0.1, 0.1, M.frame, { cap: true }), beam([x - w / 2, y + 0.05, z], [x + w / 2, y + 0.05, z], 0.107, 0.012, M.frameLight, {})]
}

/** A mounting strap around the beam and a steel locking ring at the point everything hangs from. */
function anchorHardware(anchor, mount) {
  const A = vec(anchor)
  const parts = []
  const ring = torus(0.028, 0.005, M.steel, [0, 0, 0], 'z', 32)
  ring.position.set(A.x, A.y, A.z)
  parts.push(ring)
  const yB = A.y + 0.2
  parts.push(strap([A.x, A.y + 0.025, A.z], [A.x, yB + 0.1, A.z - 0.054], 0.038, [1, 0, 0], M.strap))
  parts.push(strap([A.x, A.y + 0.025, A.z], [A.x, yB + 0.1, A.z + 0.054], 0.038, [1, 0, 0], M.strap))
  if (mount !== false) parts.push(overheadBeam(A.x, yB, A.z))
  return parts
}

/**
 * Suspension trainer. Rebuilt each frame when `hands` (or `feet`) is set, and then it works in world coordinates: p.anchor is
 * the world point the straps hang from.
 */
function suspensionTrainer(p, ctx) {
  const anchor = p.anchor ?? [0, 2.4, 0]
  if (ctx && p.feet) {
    const sides = p.feet === 'L' || p.feet === 'R' ? [p.feet] : ['L', 'R']
    const g = G(sides.map((s) => footCradle(ctx.feet[s], anchor)), anchorHardware(anchor, p.mount))
    g.userData.world = true
    return g
  }
  if (ctx && p.hands) {
    const sides = p.hands === 'L' || p.hands === 'R' ? [p.hands] : ['L', 'R']
    const items = sides.map((s) => suspensionHandle(ctx.hands[s].centre, ctx.hands[s].thumb, anchor))
    const g = G(items, anchorHardware(anchor, p.mount))
    g.userData.world = true
    return g
  }
  // Static: at p.pos, hanging straight, for when nobody holds it.
  const y = p.handleY ?? 1.05
  const H = p.anchorY ?? 2.4
  const local = [0, H, 0]
  const hs = p.spread ?? 0.16
  return G(suspensionHandle([-hs, y, 0], [-1, 0, 0.0], local), suspensionHandle([hs, y, 0], [1, 0, 0], local), anchorHardware(local, p.mount))
}

/** One gymnastic ring with its strap. */
function ringAndStrap(c, thumb, anchor) {
  const C = vec(c)
  const Ra = 0.104
  const up = strapDirs(c, anchor)
  const x = vec(thumb).addScaledVector(up, -vec(thumb).dot(up)).normalize()
  const ctr = C.clone().addScaledVector(up, Ra)
  const ring = mesh(cached(`ring${Ra}`, () => new THREE.TorusGeometry(Ra, 0.0145, 20, 64)), M.ring)
  ring.position.copy(ctr)
  ring.quaternion.setFromRotationMatrix(new M4().makeBasis(x, up, x.clone().cross(up)))
  const top = ctr.clone().addScaledVector(up, Ra)
  const face = x.clone().cross(up).normalize()
  const parts = [ring]
  // The strap goes over the ring's top: a short double thickness, a cam buckle, then one strap to the anchor.
  const hi = top.clone().addScaledVector(up, 0.24)
  parts.push(strap(top.clone().addScaledVector(up, -0.016).addScaledVector(face, 0.016).toArray(), hi.toArray(), 0.036, x.toArray(), M.strapDark))
  parts.push(strap(top.clone().addScaledVector(up, -0.016).addScaledVector(face, -0.016).toArray(), hi.toArray(), 0.036, x.toArray(), M.strapDark))
  parts.push(camBuckle(hi.toArray(), up.toArray(), x.toArray()))
  parts.push(strap(hi.toArray(), anchor, 0.036, x.toArray(), M.strap))
  return parts
}

/**
 * Gymnastic rings. With `hands` set they follow the hands, in world coordinates: p.anchorL / p.anchorR (or p.anchor plus
 * p.spread) are the world points the straps hang from. Otherwise they hang free at p.pos with their lowest point at p.ringY.
 */
function gymRings(p, ctx) {
  const spread = p.spread ?? 0.5
  const base = p.anchor ?? [0, 2.8, 0]
  const aL = p.anchorL ?? [base[0] + spread / 2, base[1], base[2]]
  const aR = p.anchorR ?? [base[0] - spread / 2, base[1], base[2]]
  const beamOver = (a, b) => (p.mount === false ? null : overheadBeam((a[0] + b[0]) / 2, Math.max(a[1], b[1]), (a[2] + b[2]) / 2))
  if (ctx && p.hands) {
    const g = G(ringAndStrap(ctx.hands.L.centre, ctx.hands.L.thumb, aL), ringAndStrap(ctx.hands.R.centre, ctx.hands.R.thumb, aR), beamOver(aL, aR))
    g.userData.world = true
    return g
  }
  const y = p.ringY ?? 1.2
  const H = p.anchorY ?? 2.8
  return G(ringAndStrap([spread / 2, y, 0], [0, 0, 1], [spread / 2, H, 0]), ringAndStrap([-spread / 2, y, 0], [0, 0, 1], [-spread / 2, H, 0]), p.mount === false ? null : overheadBeam(0, H, 0))
}

// Geometries rebuilt per frame: freed at the next build, so a long render does not pile them up in the GPU.
let ropeTrash = []

/** Three-strand laid rope along a smooth path. */
function ropeGeo(points, r) {
  const curve = new THREE.CatmullRomCurve3(points.map(vec), false, 'centripetal')
  const len = curve.getLength()
  const n = Math.max(8, Math.ceil(len / 0.011))
  const spaced = curve.getSpacedPoints(n)
  const tang = []
  for (let i = 0; i <= n; i++) tang.push(spaced[Math.min(n, i + 1)].clone().sub(spaced[Math.max(0, i - 1)]).normalize())
  let N = Math.abs(tang[0].y) > 0.9 ? new V3(1, 0, 0) : new V3(0, 1, 0)
  N.addScaledVector(tang[0], -N.dot(tang[0])).normalize()
  const lay = 0.115
  const rho = r * 0.52
  const rs = r * 0.62
  const seg = 7
  const pos = []
  const nor = []
  const idx = []
  const strands = 3
  for (let i = 0; i <= n; i++) {
    if (i > 0) {
      const q = new Q4().setFromUnitVectors(tang[i - 1], tang[i])
      N.applyQuaternion(q).addScaledVector(tang[i], -N.dot(tang[i])).normalize()
    }
    const Bn = tang[i].clone().cross(N)
    const s = (i / n) * len
    for (let st = 0; st < strands; st++) {
      const ph = (s / lay) * 2 * Math.PI + (st / strands) * 2 * Math.PI
      const ox = Math.cos(ph)
      const oy = Math.sin(ph)
      const cx = spaced[i].x + (N.x * ox + Bn.x * oy) * rho
      const cy = spaced[i].y + (N.y * ox + Bn.y * oy) * rho
      const cz = spaced[i].z + (N.z * ox + Bn.z * oy) * rho
      for (let k = 0; k < seg; k++) {
        const a = (k / seg) * 2 * Math.PI
        // The strand's own ring, in the plane of the rope's cross-section, is good enough at this lay angle.
        const u = Math.cos(a)
        const v = Math.sin(a)
        const nx = (N.x * ox + Bn.x * oy) * u + (-N.x * oy + Bn.x * ox) * v
        const ny = (N.y * ox + Bn.y * oy) * u + (-N.y * oy + Bn.y * ox) * v
        const nz = (N.z * ox + Bn.z * oy) * u + (-N.z * oy + Bn.z * ox) * v
        pos.push(cx + nx * rs, cy + ny * rs, cz + nz * rs)
        nor.push(nx, ny, nz)
      }
    }
  }
  const perRing = strands * seg
  for (let i = 0; i < n; i++) {
    for (let st = 0; st < strands; st++) {
      for (let k = 0; k < seg; k++) {
        const l = (k + 1) % seg
        const a = i * perRing + st * seg + k
        const b = i * perRing + st * seg + l
        const c = (i + 1) * perRing + st * seg + k
        const d = (i + 1) * perRing + st * seg + l
        idx.push(a, c, b, b, c, d)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setIndex(idx)
  return g
}

/**
 * A climbing rope hanging from p.top (metres, default 4). World coordinates when it follows the body: `hands: true` passes it
 * through both hands (higher hand first), foot: 'L'|'R' on down past that foot, the rest falling to the floor and coiling.
 * Pass frameIgnore on the prop, or the camera backs off to fit the whole rope.
 */
function climbRope(p, ctx) {
  const r = p.radius ?? 0.019
  const x0 = p.pos?.[0] ?? 0
  const z0 = p.pos?.[2] ?? 0
  const follows = ctx && (p.hands || p.foot)
  const local = !follows
  const X = local ? 0 : x0
  const Z = local ? 0 : z0
  const top = p.top ?? 4
  const pts = [[X, top, Z], [X, top - 0.5, Z]]
  if (follows) {
    const handSides = p.hands === 'L' || p.hands === 'R' ? [p.hands] : p.hands ? ['L', 'R'] : []
    const hs = handSides.map((s) => ctx.hands[s].centre).sort((a, b) => b[1] - a[1])
    for (const h of hs) pts.push(h)
    if (p.foot) {
      // The climber's J-hook: down the inside of the shin, over the instep, off the outer edge and under the foot, where the other
      // foot stands on it.
      const f = ctx.feet[p.foot]
      const up = vec(f.up)
      const fwd = vec(f.forward)
      const out = up.clone().cross(fwd).normalize()
      if (p.foot === 'R') out.negate()
      const ank = vec(f.ankle)
      const ins = ank.clone().lerp(vec(f.ball), 0.45)
      const at = (P, o, u) => P.clone().addScaledVector(out, o).addScaledVector(up, u).toArray()
      pts.push(at(ank, -0.062, 0.26))
      pts.push(at(ank, -0.062, 0.12))
      pts.push(at(ins, -0.04, 0.03))
      pts.push(at(ins, 0, 0.041))
      pts.push(at(ins, 0.043, 0.02))
      pts.push(at(ins, 0.06, -0.025))
      pts.push(at(ins, 0.055, -0.12))
    }
    const last = pts[pts.length - 1]
    if (last[1] > 0.5) pts.push([(last[0] + X) / 2, last[1] * 0.5, (last[2] + Z) / 2])
    else if (p.foot) pts.push([(last[0] + X) / 2, last[1] * 0.6, (last[2] + Z) / 2])
  } else {
    pts.push([X, 1.6, Z], [X, 0.7, Z])
  }
  if (p.coil !== false) {
    const cdx = p.coilDir?.[0] ?? 0
    const cdz = p.coilDir?.[1] ?? -1
    const R0 = 0.16
    const cx = X + cdx * 0.24
    const cz = Z + cdz * 0.24
    const startA = Math.atan2(Z - cz, X - cx)
    pts.push([X, 0.25, Z])
    pts.push([X + (cx - X) * 0.1, 0.045, Z + (cz - Z) * 0.1])
    const turns = 2.6
    const M2 = 26
    for (let i = 1; i <= M2; i++) {
      const f = i / M2
      const a = startA + f * turns * 2 * Math.PI
      const R = 0.2 - 0.08 * f
      pts.push([cx + Math.cos(a) * R, 0.024 + (f > 0.5 ? 0.036 : 0), cz + Math.sin(a) * R])
    }
  } else {
    pts.push([X, 0.25, Z], [X, 0.05, Z])
  }
  let geo
  if (follows) {
    for (const g of ropeTrash) g.dispose()
    ropeTrash = []
    geo = ropeGeo(pts, r)
    ropeTrash.push(geo)
  } else {
    geo = cached(`rope${JSON.stringify(pts)},${r}`, () => ropeGeo(pts, r))
  }
  const rope = mesh(geo, M.rope)
  const parts = [rope]
  // A taped end, and the steel eye it hangs from.
  const last = pts[pts.length - 1]
  parts.push(sphere(num(r * 1.15), M.ropeTape, last, 14))
  const eye = torus(0.05, 0.009, M.steel, [X, top + 0.07, Z], 'x', 28)
  parts.push(eye)
  parts.push(rod([X, top - 0.03, Z], [X, top + 0.03, Z], 0.026, M.ropeTape))
  const g = G(parts)
  if (follows) g.userData.world = true
  return g
}

const DONKEY = { zU: 1.06, handleY: 0.88, pivotY: 1.27, pivotZ: -0.62 }

/**
 * Standing donkey calf station: a calf block, handles in front, and a single lever from a tower behind the heels with a pad
 * on the lower back. follow: true rebuilds it for every frame with the pad on the pelvis (ctx.frames.pelvis), so the pad rides
 * up with the hips. The lever pivots level with the pad, so its length hardly changes over the rep.
 */
function donkeyCalf(p, ctx) {
  const parts = []
  const h = 0.13
  const zB = 0.17
  const dB = 0.26
  // Block.
  parts.push(rbox(0.52, num(h - 0.022), dB, 0.005, M.frame, [0, (h - 0.022) / 2, zB], 2))
  parts.push(mesh(padGeo({ w: 0.52, l: dB, t: 0.024, rc: 0.008, edge: 0.014, crown: 0.001, seam: 0, bulge: 0.0005 }), M.rubberTop, [0, h - 0.024, zB]))
  const rib = cached('donkeyribs', () => {
    const list = []
    const b = new THREE.BoxGeometry(0.47, 0.0012, 0.008)
    for (let i = 0; i < 9; i++) list.push([b, new M4().makeTranslation(0, 0, -0.088 + i * 0.022)])
    return mergeGeos(list)
  })
  const rb = mesh(rib, M.rubber, [0, h + 0.0004, zB])
  rb.castShadow = false
  parts.push(rb)
  // Floor frame.
  const xF = 0.34
  const { zU, handleY: yH, pivotY: yP, pivotZ: zP } = DONKEY
  const zBack = zP - 0.2
  const yF = 0.039
  for (const sx of [-1, 1]) parts.push(floorZ(sx * xF, zBack, zU + 0.26, { width: 0.06 }))
  parts.push(beam([-xF, yF, zBack + 0.03], [xF, yF, zBack + 0.03], 0.06, 0.05, M.frame, {}))
  parts.push(beam([-xF, yF, zP], [xF, yF, zP], 0.07, 0.05, M.frame, {}))
  parts.push(beam([-xF, yF, zU + 0.24], [xF, yF, zU + 0.24], 0.06, 0.05, M.frame, {}))
  // Handle frame in front.
  const xU = 0.3
  for (const sx of [-1, 1]) {
    parts.push(beam([sx * xU, 0.05, zU], [sx * xU, 1.06, zU], 0.06, 0.06, M.frame, { weldA: true, capB: true }))
    parts.push(beam([sx * xF, 0.05, zU + 0.22], [sx * xU, 0.7, zU + 0.03], 0.04, 0.04, M.frame, { side: [1, 0, 0], weldA: [0, 1, 0], weldB: [0, 0, 1] }))
    const col = G(holeColumn(0.06, 0.45, 1.01, 0.05, ['x', '-x', '-z']))
    col.position.set(sx * xU, 0, zU)
    parts.push(col)
    // Steel out from the upright, then a rubber grip angled in toward the user.
    parts.push(bentRod([[sx * xU, yH, zU - 0.03], [sx * xU, yH, zU - 0.1], [sx * 0.235, yH, zU - 0.2]], 0.0165, M.steel, { bend: 0.05 }))
    parts.push(rod([sx * 0.293, yH, zU - 0.163], [sx * 0.235, yH, zU - 0.2], 0.0195, M.grip, { capB: true }))
  }
  parts.push(beam([-xU, 1.02, zU], [xU, 1.02, zU], 0.05, 0.05, M.frame, { weld: true }))
  // Tower behind the heels, with big gussets and a hub at the top.
  const round = (q) => q.map((v) => v.map(num))
  parts.push(beam([0, 0.064, zP], [0, yP + 0.09, zP], 0.08, 0.08, M.frame, { weldA: true, capB: true }))
  for (const sx of [-1, 1]) {
    parts.push(plateYZ(round([[zP - 0.04, 0.064], [zP - 0.17, 0.064], [zP - 0.04, 0.5]]), sx * 0.0435, 0.006, M.frame, round([[zP - 0.08, 0.15, 0.028]])))
    parts.push(plateYZ(round([[zP + 0.04, 0.064], [zP + 0.17, 0.064], [zP + 0.04, 0.5]]), sx * 0.0435, 0.006, M.frame, round([[zP + 0.08, 0.15, 0.028]])))
    parts.push(rbox(0.012, 0.13, 0.13, 0.005, M.frameLight, [sx * 0.046, yP, zP], 2))
    parts.push(bolt([sx * 0.052, yP, zP], [sx, 0, 0], 0.014))
    parts.push(cyl(0.03, 0.01, M.frameLight, [sx * 0.054, yP, zP], 'x'))
  }
  // Where the pad sits: on the lower back, from the pelvis frame when following.
  const pv = ctx && p.follow ? ctx.frames.pelvis : null
  let C
  let nrm
  let along
  const P0 = p.pos || [0, 0, 0]
  const yawR = ((p.yaw || 0) * Math.PI) / 180
  if (pv) {
    const yawQ = new Q4().setFromAxisAngle(new V3(0, 1, 0), -yawR)
    const q = new Q4(pv.quat[0], pv.quat[1], pv.quat[2], pv.quat[3])
    const off = new V3(0, 0.11, -0.09).applyQuaternion(q)
    C = vec(pv.pos).sub(vec(P0)).add(off).applyQuaternion(yawQ)
    nrm = new V3(0, 0, -1).applyQuaternion(q).applyQuaternion(yawQ).normalize()
    along = new V3(0, 1, 0).applyQuaternion(q).applyQuaternion(yawQ).normalize()
  } else {
    C = new V3(0, p.padY ?? 1.1, 0.09)
    nrm = new V3(0, 1, 0)
    along = new V3(0, 0, 1)
  }
  const pg = new THREE.Group()
  pg.position.copy(C)
  pg.quaternion.setFromRotationMatrix(new M4().makeBasis(nrm.clone().cross(along.clone().negate()).normalize(), nrm, along.clone().negate()))
  // Pad on the body side of a cross plate: flipped, so its crown faces the back.
  const flip = new THREE.Group()
  flip.rotation.x = Math.PI
  flip.position.y = 0.075
  flip.add(pad({ w: 0.34, l: 0.2, t: 0.075, rc: 0.05, edge: 0.03, crown: 0.012, seam: 0.018 }, [0, 0, 0]))
  pg.add(flip)
  pg.add(rbox(0.3, 0.01, 0.17, 0.004, M.frameDark, [0, 0.08, 0], 2))
  parts.push(pg)
  // The lever: one rectangular tube from the hub to the back of the pad, with a stub for the pad plate.
  const barC = C.clone().addScaledVector(nrm, 0.11)
  parts.push(beam([0, yP, zP], barC.toArray(), 0.05, 0.075, M.frameLight, { side: [1, 0, 0], capB: true }))
  parts.push(beam(C.clone().addScaledVector(nrm, 0.083).toArray(), barC.toArray(), 0.06, 0.05, M.frame, { side: [1, 0, 0] }))
  return G(parts)
}

// ---------------------------------------------------------------------------------------------------------------------
// BODY: where the figure goes, computed from the same numbers that build the prop. All local to the prop.
// Root offsets measured on the figure: its back and buttocks lie 0.083 behind the root, the seat 0.10 under it.
// ---------------------------------------------------------------------------------------------------------------------
const OFF_BACK = 0.092
const OFF_SEAT = 0.1

export const BODY = {
  'flat-bench': (p = {}) => {
    const H = p.height ?? 0.44
    return { padTop: H, root: [0, H + OFF_BACK, 0.2], pitch: -90, shoulder: [0, H + OFF_BACK, -0.26], feet: [[0.2, 0, 0.72], [-0.2, 0, 0.72]], barY: p.barY ?? 1.02, barZ: p.barZ ?? -0.44 }
  },
  'adjustable-bench': (p = {}) => {
    const g = adjustableGeom(p)
    const { a, hy, T, seatTop } = g
    const C = [hy + T * Math.cos(a), T * Math.sin(a)]
    const n = [Math.cos(a), Math.sin(a)]
    const y = seatTop + OFF_SEAT
    let root
    if (a > 12 * D) {
      const z = C[1] + (OFF_BACK - (y - C[0]) * n[0]) / n[1]
      root = [0, y, z]
    } else {
      root = [0, C[0] + OFF_BACK * n[0], 0.03]
    }
    const pitch = (a / D) - 90
    const shoulder = [0, num(root[1] + 0.46 * Math.sin(a)), num(root[2] - 0.46 * Math.cos(a))]
    // Bar on the uprights, when it has them: just below lockout over the shoulders for an incline, above the head for a press.
    const barY = num(shoulder[1] + 0.5)
    const barZ = num(shoulder[2] + (a / D > 65 ? 0.02 : -0.02))
    return { seatTop, backPoint: [0, C[0], C[1]], backNormal: [0, n[0], n[1]], root: root.map(num), pitch, shoulder, barY, barZ }
  },
  'decline-bench': (p = {}) => {
    const { a, E, rollerY, shinZ } = declineGeom(p)
    const down = p.hipDown ?? 0.355
    const r = slopePt(E, a, down, OFF_BACK)
    const s = slopePt(E, a, down + 0.46, OFF_BACK)
    return { highEnd: [0, E[0], E[1]], slope: a / D, root: [0, num(r[0]), num(r[1])], pitch: -(90 + a / D), shoulder: [0, num(s[0]), num(s[1])], ankle: [0.1, num(E[0] - 0.335), num(shinZ)], rollerY: num(rollerY), rollerZ: [num(shinZ - 0.105), num(shinZ + 0.105)] }
  },
  'decline-situp-bench': (p = {}) => {
    const { a, E } = situpGeom(p)
    const r = slopePt(E, a, 0.38, OFF_BACK)
    const ank = slopePt(E, a, -0.191, -0.022)
    const pS = (s, n) => slopePt(E, a, -s, n)
    return { highEnd: [0, num(E[0]), num(E[1])], slope: a / D, root: [0, num(r[0]), num(r[1])], pitch: -(90 + a / D), ankle: [0.1, num(ank[0]), num(ank[1])], rollers: [pS(0.075, -0.02).map(num), pS(0.268, 0.105).map(num)] }
  },
  'preacher-bench': (p = {}) => {
    const { seatH, top, a } = preacherGeom(p)
    const elbowY = seatH + 0.313
    const elbowZ = 0.127
    const bar = (deg) => {
      const t = deg * D
      return [num(elbowY + 0.297 * Math.sin(t) + 0.03 * Math.cos(t)), num(elbowZ + 0.297 * Math.cos(t) - 0.03 * Math.sin(t))]
    }
    return { seatTop: seatH, padEdge: [0, top, 0], padSlope: a / D, root: [0, seatH + OFF_SEAT, -0.27], pitch: 20, elbow: [0.2, num(elbowY), elbowZ], bar, rackBarY: num(top - 0.09 + 0.002), rackBarZ: 0.335 }
  },
  'power-rack': (p = {}) => {
    const Dp = p.depth ?? 1.1
    const W = p.width ?? 1.2
    const Ht = p.height ?? 2.28
    const px = num(W / 2 + 0.0375 + 0.05)
    return { barZ: num(Dp / 2 - 0.0375 - 0.045), barY: p.barY ?? 1.38, pinY: p.pinY, uprightX: W / 2, uprightZ: Dp / 2, pullUp: [0, num(Ht - 0.1), Dp / 2], bandPegsLow: [[px, 0.039, -0.3], [px, 0.039, 0.3]], bandPegsHigh: [[px, num(Ht - 0.1), -0.3], [px, num(Ht - 0.1), 0.3]] }
  },
  'squat-stand': (p = {}) => ({ barZ: -0.075, barY: p.barY ?? 1.38, pinY: p.pinY, uprightX: (p.width ?? 1.2) / 2 }),
  'foot-anchor': (p = {}) => ({ underRoller: p.height ?? 0.13, rollerY: num((p.height ?? 0.13) + 0.05), ankle: [0.11, 0.075, -0.02], footFlat: 'sole at [±0.11, 0, 0.03], foot pointing +Z, roller on the instep', kneel: 'shin on the floor, ankle at [±0.11, 0.1, 0.0], toes toward +Z, roller on the Achilles' }),
  'plyo-box': (p = {}) => ({ top: p.height ?? 0.5, frontEdgeZ: -(p.depth ?? 0.5) / 2 }),
  'squat-box': (p = {}) => ({ top: p.height ?? 0.4, root: [0, (p.height ?? 0.4) + OFF_SEAT, -0.02] }),
  'pull-blocks': (p = {}) => ({ top: p.height ?? 0.3, barY: num((p.height ?? 0.3) + 0.225), blockX: (p.spread ?? 1.44) / 2 }),
  'pull-up-bar': (p = {}) => ({ barY: p.height ?? 2.25, barZ: 0, hangRoot: [0, num((p.height ?? 2.25) - 1.065), -0.03] }),
  'v-handle': () => ({ handL: [0.116, -0.147, 0], handR: [-0.116, -0.147, 0], gripDir: [0.68, -0.73, 0] }),
  'parallel-bars': (p = {}) => ({ barY: p.height ?? 1.3, barX: (p.spacing ?? 0.56) / 2 }),
  'dip-station': (p = {}) => ({ barY: p.height ?? 1.25, barX: (p.spacing ?? 0.56) / 2 }),
  'captains-chair': (p = {}) => {
    const padY = p.padY ?? 1.3
    return { padTop: padY, armX: 0.225, backFaceZ: -0.16, root: [0, num(padY - 0.156), -0.075], elbow: [0.225, num(padY + 0.045), -0.05], handle: [0.225, num(padY + 0.07), 0.29] }
  },
  'roman-chair-45': (p = {}) => {
    const a = clamp(p.angle ?? 45, 20, 70) * D
    const { pt } = backExtensionFrame([0.9, 0], a)
    return { root: [0, 0.9, 0], pitch: p.angle ?? 45, padFaceAt: pt(-0.3, 0.1).map(num), ankle: pt(-0.86, 0).map(num), sole: pt(-0.93, 0).map(num) }
  },
  'roman-chair-90': (p = {}) => {
    const Hy = p.hipY ?? 0.95
    const { pt } = backExtensionFrame([Hy, 0], Math.PI / 2)
    return { root: [0, Hy, 0], pitch: 90, padTop: num(Hy - 0.1), ankle: pt(-0.86, 0).map(num), sole: pt(-0.93, 0).map(num) }
  },
  ghd: (p = {}) => {
    const padY = p.padY ?? 1.005
    const yA = padY + GHD.ankleAbovePad
    const yK = padY + GHD.kneeAbovePad
    const th = GHD.thighRise * D
    return { padTop: padY, drum: [0, num(padY - 0.15), 0.02], drumR: 0.15, soleZ: -0.64, ankle: [0.1, num(yA), GHD.ankleZ], knee: [0.11, num(yK), GHD.kneeZ], rootBottom: [0, num(yK + 0.42 * Math.sin(th)), num(GHD.kneeZ + 0.42 * Math.cos(th))], pitchBottom: 90 + GHD.thighRise, rootTop: [0, num(yK + 0.42), num(GHD.kneeZ + 0.01)], pitchTop: 0 }
  },
  'donkey-calf': () => ({ blockTop: 0.13, blockRearZ: 0.04, ball: [0.1, 0.13, 0.08], root: [0, 1.0, -0.01], pitch: 82, handle: [0.264, DONKEY.handleY, num(DONKEY.zU - 0.18)] }),
  'calf-block': (p = {}) => ({ top: p.height ?? 0.1, ball: [0.1, p.height ?? 0.1, -(p.depth ?? 0.24) / 2 + 0.05] }),
  'step-platform': (p = {}) => ({ top: p.height ?? 0.2 }),
  'floor-mat': (p = {}) => ({ top: p.thickness ?? (p.style === 'gym' ? 0.05 : 0.012) }),
  'deficit-platform': (p = {}) => ({ top: p.height ?? 0.075 }),
  'press-board': (p = {}) => ({ thickness: 0.038 * (p.boards ?? 2) }),
}

BODY['bench-rack'] = BODY['flat-bench']
BODY['incline-bench'] = BODY['adjustable-bench']
BODY['shoulder-press-bench'] = (p = {}) => BODY['adjustable-bench']({ angle: 82, ...p })
BODY['lifting-blocks'] = BODY['pull-blocks']
BODY['hyperextension-bench'] = BODY['roman-chair-45']
BODY['exercise-mat'] = BODY['floor-mat']
BODY['bench-boards'] = BODY['press-board']
BODY['glute-ham-developer'] = BODY.ghd
BODY['donkey-calf-machine'] = BODY['donkey-calf']

export default {
  'flat-bench': flatBench,
  'bench-rack': (p) => flatBench({ uprights: true, ...p }),
  'adjustable-bench': adjustableBench,
  'incline-bench': adjustableBench,
  'shoulder-press-bench': (p) => adjustableBench({ angle: 82, seatAngle: 10, ...p }),
  'decline-bench': declineBench,
  'decline-situp-bench': declineSitupBench,
  'preacher-bench': preacherBench,
  'power-rack': powerRack,
  'squat-stand': squatStand,
  'plyo-box': plyoBox,
  'squat-box': squatBox,
  'pull-blocks': pullBlocks,
  'lifting-blocks': pullBlocks,
  'foot-anchor': footAnchor,
  'deficit-platform': deficitPlatform,
  'calf-block': calfBlock,
  'step-platform': stepPlatform,
  'floor-mat': floorMat,
  'exercise-mat': floorMat,
  'press-board': pressBoard,
  'bench-boards': pressBoard,
  'pull-up-bar': pullUpBar,
  'v-handle': vHandle,
  'parallel-bars': parallelBars,
  'dip-station': dipStation,
  'captains-chair': captainsChair,
  'roman-chair-45': romanChair45,
  'hyperextension-bench': romanChair45,
  'roman-chair-90': romanChair90,
  ghd,
  'glute-ham-developer': ghd,
  'suspension-trainer': suspensionTrainer,
  'suspension-straps': suspensionTrainer,
  'gym-rings': gymRings,
  'gymnastic-rings': gymRings,
  'climb-rope': climbRope,
  'climbing-rope': climbRope,
  'donkey-calf': donkeyCalf,
  'donkey-calf-machine': donkeyCalf,
}
