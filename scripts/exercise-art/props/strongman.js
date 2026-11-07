// Strongman equipment. Metres, Y up; at yaw 0 the user faces +Z, so +X is the user's LEFT. `pos` is the floor point the prop is
// centred on.
//
// A held implement takes one of three placements:
//   static:          on the floor at pos / yaw, as documented per type.
//   hands: true:     rebuilt each frame through both hands (ctx.hands.L/R.centre). hand: 'L'|'R' uses one hand.
//   at: [x, y, z]:   its centre at this world point. Put the prop inside each frame's props and the numbers interpolate.
/*
 * TYPES: parameters, and exactly where the body goes. Coordinates are the prop's own (add pos, turn by yaw) unless they say world.
 *
 * atlas-stone  { d: 0.5 (diameter), hands: true, offset: [x, y, z], at: [x, y, z] }
 * Cast concrete sphere with a flat spot, a mould seam and air pockets. Static: pos is the floor under it, and its centre sits at y =
 * d/2 - 0.015. Standing over it: feet at x +-0.25..0.3, stone between them.
 * Held: hands: true centres it between the hand centres, plus `offset` in world axes (hands under and around the stone sit below
 * its middle, so add about [0, 0.1, 0]). Or at: [x, y, z] inside each frame's props.
 * HANDS on a stone of radius r: palms flat on its surface, fingers reaching under it: wrists about r + 0.03 from the centre.
 *
 * atlas-platform  { height: 1.2, width: 0.8, depth: 0.8 }
 * A plywood pedestal with battens, scuffed by stones. pos: floor under its centre. Top surface at y = height, front face (the
 * side the user stands on) at pos.z - depth/2. A stone resting on it has its centre at y = height + d/2 - 0.015 (with a small
 * rubber ring). Stand with the toes about 0.15 from the front face.
 *
 * atlas-trainer  { plates: 4 (per the stack), hands: true, offset, at }
 * A stone trainer: a short heavy pipe with plates stacked in the middle, hugged like a stone. X is the pipe's axis, plates 0.45 in
 * diameter, so it lies on the floor with its axis at y = 0.225, across the user. Straddle it, wrap the arms around the plates.
 * Held: hands: true puts its centre between the hand centres (plus offset), with the axis along the line between the hands' wrists.
 *
 * log-bar  { d: 0.3, plates: 1 (per side), hands: true, at }
 * Steel log 2.2 long: body 1.7, loading sleeves 0.25. Its axis is X. Two neutral handles cross the log's axis at x +-0.3, each
 * 0.2 clear between the window's cheeks, set in windows open on the side the wrists come from.
 * Static: pos on the floor under its centre, axis at y = 0.225 with plates (y = d/2 with plates: 0), handles along Z, windows up.
 * Held: hands: true runs the log's axis through both hand centres, and turns it so that the windows face the wrists. The hands'
 * thumb direction should lie along the handle (perpendicular to the log), palms facing each other: for the rack on the chest, fingers
 * forward and up, palm toward the middle. Keep the hand centres 0.6 apart.
 *
 * axle-bar  { plates: 2 (per side), hands: true, at, thick: 0.05 }
 * Fat bar: 0.05 thick, 2.13 long, no sleeves spinning and no knurl. Axis X. Static: on the floor with its axis at y = 0.225. Hold at
 * x +-0.22 to +-0.3. hands: true runs it through both hand centres. Grip radius 0.025.
 *
 * farmers-handle  { hand: 'L' or 'R', plates: 1 (per end), at, dir }
 * One farmer's-walk implement: a 1.5 long bar with a thick knurled grip in the middle and plates at both ends, 0.42 from the grip, far enough
 * for a walking stride. Use one per hand, standing between the two. Static: pos on the floor under the grip, axis along Z (front to back),
 * at y = 0.225. Two implements stand at x +-0.34.
 * Held: hand: 'L' centres the grip in that hand, axis along the thumb. Point the thumb forward (fingers down, palm in).
 *
 * yoke  { barH: 1.5, width: 1.04, plates: 2 (per side), follow: true, lift: for a static picture }
 * Tall carry frame: two uprights on long floor runners, crossbar padded across the upper back. pos: floor under the crossbar's
 * middle. The user stands inside, facing +Z.
 * BODY: crossbar at y = barH on the shoulders behind the neck, z = pos.z. Uprights at x +-0.52, square 0.09, inner faces at x +-0.475:
 * palms flat on those faces around y 1.2..1.3, thumbs forward, elbows down. Runners on the floor z -0.62..+0.62. Set barH to the height of the
 * traps in the bent-knee start, so that the bar touches them there (1.4 for root.pos y 0.83, pitch 14): standing up then lifts the frame.
 * MOVING: follow: true carries the frame on the shoulders: its crossbar sits at the point `at` in the chest frame ([0, 0.215, -0.055] by
 * default, top of the trapezius), the frame stays upright, and never goes below the floor. So when the knees bend it rests on
 * the floor, and when the legs straighten it lifts. Keep root.pos.z and yaw steady.
 *
 * tractor-tire  { tilt: degrees, hands: true (tilt follows the hands), yaw, scale: 1 }
 * A big tractor tire with deep chevron lugs: 1.45 across, 0.46 wide, hole 0.72. Lying flat with tilt 0: pos is the floor under its
 * centre, top surface at y 0.46.
 * The user stands on the -Z side, facing +Z. The tire pivots on its far edge, local (y 0, z +0.725). The near lip of the tread at
 * tilt a, for the fingers under it:
 *   hand y = 0.06 cos a + 1.45 sin a,   hand z = pos.z + 0.725 - 1.45 cos a + 0.06 sin a.
 * At tilt 0 that is y 0.06, z pos.z - 0.725 (hands low, fingers under the edge, chest against the tread). At tilt 90 the tire stands
 * on its edge, 1.45 tall, the near lip at y 1.45.
 * hands: true solves the tilt from the mean height of the hands, so the tire stays in the hands in every in-between. Or put it in
 * each frame's props and interpolate `tilt`. Use a mid frame around tilt 45, since a straight line in the hands is a chord.
 * scale 0.7 gives a smaller tire for sledgehammer swings (1.0 across, top at y 0.32); every number above scales with it.
 *
 * sled  { plates: 2, hands: true }
 * Low drag and push sled: two turned-up runners, a checker deck, a plate horn, a short push handle at each end, and a ring for
 * the strap at each end. L 1.1, W 0.55. pos: floor under its centre. For pushing the user is at -Z and moves toward +Z.
 * Hook points: rear ring at local [0, 0.13, -0.53], front ring at local [0, 0.13, 0.53].
 * Rear push handle: a low bar along X, at y 0.34, z -0.5, x -0.19..+0.19. Hand centre [+-0.15, 0.34, -0.5], arms straight, leaning low.
 * hands: true slides the sled along Z so that the handle stays in the hands, wherever they go.
 *
 * prowler  { plates: 2, hands: true }
 * Tall push sled with high and low handles and a plate peg. L 1.1, W 0.6. pos: floor under its centre. The user is at -Z.
 * High handles: two uprights at x +-0.27 rising from the base with a small lean to the rear, rubber grips y 0.92..1.2 at z about -0.2.
 * Hand centre [+-0.27, 1.05, -0.2] (world = pos + that), axis vertical, palms in, arms long, body leaning in.
 * Low handles: bars along Z at y 0.62, x +-0.27, z -0.58..-0.2. Hand centre [+-0.27, 0.62, -0.46], palms in or down.
 * Hook point for a strap: rear ring at local [0, 0.13, -0.53]. hands: true slides it along Z to stay in the hands (the high grip).
 *
 * sled-straps  { hands: true, to: [x, y, z] }
 * Two handles joined to one line that runs to a sled's ring at world point `to`. For sled rows, flyes, presses and drags: the line
 * is taut in every frame. Put it in spec.props with hands: true. The handles follow the hands.
 *
 * harness  { follow: true, to: [x, y, z], attach: 'back' or 'waist' }
 * Pulling harness, worn: a padded chest strap, two padded shoulder straps crossing to a ring between the shoulder blades, a waist belt with
 * a second ring at its rear. With `to`, a rope runs from the ring (attach chooses which) to a world point, usually a sled's ring. Use it in
 * spec.props with follow: true: the straps ride the chest and pelvis frames and fit the figure's rest shape, measured from the mesh. Nothing
 * to place by hand; the rope has the slightest sag. Big arm raises or a strong spine bend open small gaps at the shoulders.
 *
 * keg  { hands: true, offset, at, dir: axis direction, up }
 * A 50 l stainless beer keg: 0.41 across, 0.6 tall, with two rolling rings and chimes with handle slots. Static: standing on the floor
 * at pos, centre at y = 0.3. Held: its centre at the middle of the hand centres plus `offset` in world axes, or at `at`. Its axis
 * runs along `dir` (default [1, 0, 0], across the chest). For the carry: hands on the chimes at x +-0.3 from its centre, or one hand
 * under and one over, on its surface, 0.25 from the centre.
 *
 * loading-sandbag  { d: 0.46, h: 0.56, hands: true, offset, at, dir: its long axis (default up) }
 * A filled canvas event bag, sewn and tied at the neck, the kind loaded onto a platform (free-weights.js has `sandbag`, the long handled
 * training bag). Static: on the floor at pos, neck up, 0.56 tall. Held: its centre (about halfway up) between the hand centres plus
 * offset. For the hug: arms around it, hands under, against the chest; offset about [0, 0.1, 0]. at: [x, y, z] inside each frame's props.
 *
 * sandbag-platform  { height: 1.2, width: 1.2, depth: 0.6 }
 * Loading platform for sandbags and kegs: welded square-tube frame with a plank deck. pos: floor under its centre. Deck top y = height;
 * the user stands on the -Z side, front edge at pos.z - depth/2. A load rests with its base on y = height.
 *
 * car-deadlift  { lift: metres the handles have risen, hands: true, car: true, carInFrame: false }
 * Car lift frame. A long lever frame turns about a pivot on the floor by the car's rear axle; the car's front wheels sit in a cradle on it.
 * pos: floor under the middle of the handles. The user stands between the handles, faces +Z, away from the car, which lies toward -Z.
 * BODY: handles run along Z at x +-0.32, y 0.44 at rest, z -0.15..+0.15. Hand centre [+-0.32, 0.44, 0], palms in, thumbs forward. Feet at
 * x +-0.13, z 0. Standing tall, the hand centre is near y 0.815: the lift is then 0.375.
 * MOVING: hands: true solves the frame's angle from the height of the hands; it also moves the handles' z by a few mm. The car is 3.6 long:
 * it is left out of the camera fit (carInFrame: true puts it in), so the figure stays large and the car fills the background, partly out of
 * the picture. Cameras with az 20..40 and el about 10 work best. The rear of the frame is also out of the fit.
 *
 * conans-wheel  { arm: 2.4, plates: 2, follow: true, height: 0.82 }
 * A long beam pivoting on a post, held in the crooks of the elbows, walked in a circle. pos: floor point of the post, in world coordinates
 * (yaw is not used). The beam runs from the post (hub at y `height`) through the middle of the user's elbows, and 0.28 past them.
 * BODY: the user stands 2.3..2.5 from the post, facing square to the beam, arms in a zercher hold: elbows bent about 110, forearms
 * up, hands together or holding a wrist. The beam sits in the crooks of the elbows, its axis along the line between them.
 * MOVING: follow: true re-aims the beam at the elbows in every frame: its height at the user comes from the elbows, the hub stays put, the
 * beam's length is whatever the user's distance is. Load sits on the beam, 0.6 from the post.
 *
 * rickshaw  { plates: 2, hands: true, lift: for a static picture }
 * Carry frame the user stands in. pos: floor under the middle of the handles. The user faces +Z.
 * BODY: neutral handles along Z, at x +-0.36, y 0.44, z -0.12..+0.12. Hand centre [+-0.36, 0.44, 0], palms in, thumbs forward. Feet at x
 * +-0.13, z 0. Standing tall (root y 0.915) the hand centres reach y 0.83.
 * MOVING: hands: true carries the frame so the handles stay in the hands wherever they go, keeping it level and never below the floor.
 *
 * circus-dumbbell  { d: 0.27 (head), hand: 'L' or 'R', hands: true, at, dir }
 * Oversized cast dumbbell: two hollow spheres on a thick handle. 0.06 thick, 0.24 clear between the heads. Static: on the floor at pos,
 * axis along X, handle centre at y = d/2. Held: hand: 'R' centres the handle in that hand, axis along the thumb. For the rack: a head
 * behind the shoulder, axis pointing back and up. hands: true holds it in both hands (hand centres 0.09 apart).
 *
 * strongman-axe  { hand: 'L' or 'R', at, dir, up, length: 0.8, flip: true }
 * A long-handled axe for the crucifix hold (one per hand). The handle runs through the hand along the thumb and its head is at the thumb's
 * end, 0.68 from the hand centre. Static: lying on the floor at pos, along X. With hand, its local Y (the poll side) faces the wrist and the
 * blade away from it; flip: true turns the blade the other way. For the crucifix: arms straight out to the sides, hand centres at about
 * [+-0.76, 1.4, 0.02], thumbs up and a little out, palms forward.
 *
 * power-stairs  { steps: 3, rise: 0.42, run: 0.6, width: 1.1 }
 * Tall plywood stairs. pos: floor under the middle of the first step's front edge. Steps climb toward +Z. Step k (0-based): top at y =
 * (k + 1) * rise, from z = pos.z + k * run to pos.z + (k + 1) * run. The user starts on the floor at z about pos.z - 0.45, feet wide, the
 * implement between the feet, facing +Z.
 *
 * power-stairs-weight  { plates: 2, hands: true, at }
 * The weighted implement: a T handle on a steel post, a plate horn, a skid plate for landing on the stairs. 0.56 tall from skid to grip.
 * Its local origin is the middle of the handle. Static: pos on the floor under it, handle at y = 0.56. Held: hands: true hangs it from the
 * middle of the hand centres, post vertical, handle along the line between the hands. Hand centres about 0.11 apart.
 *
 * battling-ropes  { hands: true, anchor: [x, y, z] (default [0, 0.03, 3.4]), phase: number, amp: 0.34, wavelength: 1.25, r: 0.019 }
 * A heavy rope doubled round an anchor on the floor, an end in each hand, with a travelling wave. In spec.props it needs hands: true.
 * To animate the wave, put it in each frame's props with phase growing: one unit of phase = one wave length travelled. For a clean loop
 * use phase 0, 0.5, 1, ... and timing {there: T, back: 0}, with start and end alike. L and R run half a wave apart (alternating arms); `sync:
 * true` makes them move together (double waves).
 * BODY: stand facing +Z, feet shoulder-width, about 3.4 from the anchor, knees bent. Arms move each hand up and down between hip and
 * shoulder height. The rope passes through the hand along its thumb: hold it hammer-style with the thumb toward the anchor (fingers to the
 * side, palm in), and the taped end sticks out behind the little finger.
 *
 * heavy-bag  { hand: 'L' or 'R' (bag rests on that hand), swing: degrees, d: 0.36, len: 1.15, anchorY: 2.45, mount: true }
 * A vinyl punch bag on four chains from a beam. pos: floor under the anchor. At rest: bag bottom at y = anchorY - 0.55 - len, about 0.75; top
 * about 1.9. The surface facing the user is at pos.z - d/2 when the user stands on the -Z side.
 * MOVING: `swing` tilts it about the anchor, away from the user. With hand: 'R' (a follow key) the bag is pushed by that hand: when the hand
 * centre is nearer the bag's axis than its radius, the bag swings away just enough to stay on the palm, and hangs straight
 * otherwise. So place the hand at chest height, with the palm toward the bag.
 */
import { kit, mat } from './kit.js'
import {
  M,
  beam,
  pipe,
  rectPipe,
  slab,
  roundPoly,
  pad,
  place,
  localFrame,
  bolt,
  transportWheel,
  sweepGeo,
  rectSection,
  cachedGeo,
  loftGeo,
  mergeGeos,
  creaseNormals,
  weld,
} from './cardio.js'

const { THREE, group, mesh } = kit
const { Vector3: V3, Quaternion: Q4, Matrix4: M4 } = THREE
const RAD = Math.PI / 180
const vec = (a) => (a instanceof V3 ? a.clone() : new V3(a[0], a[1], a[2]))
const lerp = (a, b, t) => a + (b - a) * t
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const std = (o) => new THREE.MeshStandardMaterial(o)

/* ---------------------------------------- textures and materials ---------------------------------------- */

const seeded = (seed) => {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}
const texCache = new Map()
function canvasTex(name, size, draw, { repeat = [1, 1], srgb = false } = {}) {
  const key = `${name}|${repeat}`
  if (texCache.has(key)) return texCache.get(key)
  const c = document.createElement('canvas')
  c.width = c.height = size
  draw(c.getContext('2d'), size)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat[0], repeat[1])
  t.anisotropy = 4
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  texCache.set(key, t)
  return t
}

function drawConcrete(x, S, base, seed) {
  const r = seeded(seed)
  x.fillStyle = base
  x.fillRect(0, 0, S, S)
  // Large soft clouds: pours and weathering.
  for (let i = 0; i < 130; i++) {
    const cx = r() * S
    const cy = r() * S
    const rad = 30 + r() * 170
    const v = r() < 0.5 ? 0 : 255
    const a = 0.02 + r() * 0.07
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        const g = x.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, rad)
        g.addColorStop(0, `rgba(${v},${v},${v},${a})`)
        g.addColorStop(1, `rgba(${v},${v},${v},0)`)
        x.fillStyle = g
        x.fillRect(cx + ox - rad, cy + oy - rad, rad * 2, rad * 2)
      }
    }
  }
  // Air pockets and specks.
  for (let i = 0; i < 2600; i++) {
    const v = r() < 0.75 ? 30 : 200
    x.fillStyle = `rgba(${v},${v},${v},${0.12 + r() * 0.3})`
    const rad = 0.5 + r() * r() * 3
    x.beginPath()
    x.arc(r() * S, r() * S, rad, 0, Math.PI * 2)
    x.fill()
  }
}

function drawGrain(x, S, seed, { base = 120, lines = 240 } = {}) {
  const r = seeded(seed)
  x.fillStyle = `rgb(${base},${base},${base})`
  x.fillRect(0, 0, S, S)
  for (let i = 0; i < lines; i++) {
    const y0 = r() * S
    const v = r() < 0.5 ? 60 : 170
    x.strokeStyle = `rgba(${v},${v},${v},${0.05 + r() * 0.16})`
    x.lineWidth = 0.6 + r() * 2.6
    x.beginPath()
    const a = r() * 6
    for (let px = 0; px <= S; px += 16) {
      const yy = y0 + Math.sin((px / S) * Math.PI * 2 + a) * 5 + Math.sin((px / S) * Math.PI * 6 + a * 2) * 1.6
      if (px === 0) x.moveTo(px, yy)
      else x.lineTo(px, yy)
    }
    x.stroke()
  }
}

const LZ = {} // lazily built materials: they need `document`
const lazy = (name, make) => () => (LZ[name] ||= make())

const MS = {
  concrete: lazy('concrete', () =>
    std({
      map: canvasTex('concreteMap', 1024, (x, S) => drawConcrete(x, S, '#9a9a97', 11), { repeat: [2, 1], srgb: true }),
      bumpMap: canvasTex('concreteBump', 1024, (x, S) => drawConcrete(x, S, '#808080', 11), { repeat: [2, 1] }),
      bumpScale: 2.2,
      roughness: 0.88,
      metalness: 0,
    }),
  ),
  ply: lazy('ply', () =>
    std({
      color: 0xb0aaa2,
      map: canvasTex('plyMap', 1024, (x, S) => {
        drawGrain(x, S, 7, { base: 150, lines: 300 })
        // Chalk and stone smears, the marks in every strongman gym.
        const r = seeded(99)
        for (let i = 0; i < 70; i++) {
          const v = r() < 0.4 ? 40 : 230
          x.fillStyle = `rgba(${v},${v},${v},${0.02 + r() * 0.05})`
          x.beginPath()
          x.ellipse(r() * S, r() * S, 10 + r() * 90, 4 + r() * 22, r() * 3, 0, Math.PI * 2)
          x.fill()
        }
      }, { repeat: [1, 1], srgb: true }),
      bumpMap: canvasTex('plyBump', 512, (x, S) => drawGrain(x, S, 7, { base: 128, lines: 180 }), { repeat: [1, 1] }),
      bumpScale: 0.3,
      roughness: 0.78,
      metalness: 0,
    }),
  ),
  plank: lazy('plank', () =>
    std({
      color: 0x8f8a83,
      map: canvasTex('plankMap', 512, (x, S) => drawGrain(x, S, 23, { base: 128, lines: 160 }), { repeat: [1, 1], srgb: true }),
      roughness: 0.74,
      metalness: 0,
    }),
  ),
  canvas: lazy('canvas', () =>
    std({
      color: 0xa6a9ae,
      map: canvasTex('canvasMap', 512, (x, S) => {
        const r = seeded(5)
        x.fillStyle = '#b4b4b4'
        x.fillRect(0, 0, S, S)
        for (let i = 0; i < 60; i++) {
          const v = r() < 0.5 ? 60 : 240
          const cx = r() * S
          const cy = r() * S
          const rad = 20 + r() * 90
          const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad)
          g.addColorStop(0, `rgba(${v},${v},${v},0.1)`)
          g.addColorStop(1, `rgba(${v},${v},${v},0)`)
          x.fillStyle = g
          x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2)
        }
      }, { repeat: [1, 1], srgb: true }),
      bumpMap: canvasTex('canvasWeave', 256, (x, S) => {
        const n = 42
        const c = S / n
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            const v = (i + j) % 2 ? 190 : 80
            x.fillStyle = `rgb(${v},${v},${v})`
            x.fillRect(i * c, j * c, c, c)
          }
        }
      }, { repeat: [5, 5] }),
      bumpScale: 0.8,
      roughness: 0.92,
      metalness: 0,
    }),
  ),
  tire: lazy('tire', () =>
    std({
      color: 0x3c3d41,
      bumpMap: canvasTex('tireNoise', 512, (x, S) => {
        const r = seeded(77)
        x.fillStyle = '#808080'
        x.fillRect(0, 0, S, S)
        for (let i = 0; i < 9000; i++) {
          const v = r() < 0.5 ? 60 : 190
          x.fillStyle = `rgba(${v},${v},${v},0.25)`
          x.fillRect(r() * S, r() * S, 1 + r() * 2.5, 1 + r() * 2.5)
        }
      }, { repeat: [24, 3] }),
      bumpScale: 0.5,
      roughness: 0.74,
      metalness: 0,
    }),
  ),
  bagVinyl: lazy('bagVinyl', () =>
    std({
      color: 0x8b8d91,
      bumpMap: canvasTex('vinylBump', 512, (x, S) => {
        const r = seeded(31)
        x.fillStyle = '#808080'
        x.fillRect(0, 0, S, S)
        for (let i = 0; i < 18000; i++) {
          const v = r() < 0.5 ? 70 : 180
          x.fillStyle = `rgba(${v},${v},${v},0.18)`
          x.beginPath()
          x.arc(r() * S, r() * S, 0.8 + r() * 2.2, 0, Math.PI * 2)
          x.fill()
        }
      }, { repeat: [4, 4] }),
      bumpScale: 0.35,
      roughness: 0.46,
      metalness: 0,
    }),
  ),
}

const STEEL = {
  paint: std({ color: 0x5a5d63, metalness: 0.25, roughness: 0.58 }), // welded implements, plain paint
  paintLight: std({ color: 0x80838a, metalness: 0.25, roughness: 0.54 }),
  paintDark: std({ color: 0x3e4045, metalness: 0.25, roughness: 0.6 }),
  weld: std({ color: 0x75787e, metalness: 0.7, roughness: 0.6 }),
  shaft: std({ color: 0xb4b7bc, metalness: 1, roughness: 0.32 }),
  sleeve: std({ color: 0xdadce0, metalness: 1, roughness: 0.17 }),
  knurl: std({ color: 0x9fa2a7, metalness: 1, roughness: 0.68 }),
  iron: std({ color: 0x4b4c51, metalness: 0.4, roughness: 0.5 }),
  ironEdge: std({ color: 0x55575c, metalness: 0.6, roughness: 0.46 }),
  bumper: std({ color: 0x33343a, metalness: 0, roughness: 0.6 }),
  bumperBand: std({ color: 0x5a5c61, metalness: 0, roughness: 0.56 }),
  stainless: std({ color: 0xc6c8cc, metalness: 1, roughness: 0.3 }),
  stainlessDull: std({ color: 0xa8abaf, metalness: 1, roughness: 0.46 }),
  rope: std({ color: 0x8c8e91, metalness: 0, roughness: 0.92 }),
  ropeDark: std({ color: 0x5a5c60, metalness: 0, roughness: 0.92 }),
  strap: std({ color: 0x4b4d52, metalness: 0, roughness: 0.84 }),
  tape: std({ color: 0xb4b6ba, metalness: 0, roughness: 0.72 }),
  glass: std({ color: 0x101114, metalness: 0.1, roughness: 0.22, envMapIntensity: 0.35 }),
  carBody: std({ color: 0x6a6d73, metalness: 0.42, roughness: 0.42 }),
  carTrim: std({ color: 0x25262a, metalness: 0.2, roughness: 0.5 }),
  lamp: std({ color: 0xd8dade, metalness: 0.2, roughness: 0.25 }),
}

/* ---------------------------------------- shared parts ---------------------------------------- */

/** A lathe whose flat faces stay flat: each corner of the profile gets a tiny bevel, so normals do not smear across faces. */
function latheHard(points, m, pos, axis = 'x', seg = 64, bev = 0.0015) {
  const pts = []
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    if (i === 0 || i === points.length - 1 || p[2] === 0) {
      pts.push([p[0], p[1]])
      continue
    }
    const a = points[i - 1]
    const b = points[i + 1]
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]) || 1
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1
    const e = Math.min(bev, la * 0.4, lb * 0.4)
    pts.push([p[0] + ((a[0] - p[0]) / la) * e, p[1] + ((a[1] - p[1]) / la) * e])
    pts.push([p[0] + ((b[0] - p[0]) / lb) * e, p[1] + ((b[1] - p[1]) / lb) * e])
  }
  return kit.lathe(pts, m, pos, axis, seg)
}

/** Olympic plate, bore along the axis, centred on pos. kind: 'iron' or 'bumper'. */
function plate(d = 0.45, t = 0.05, pos = [0, 0, 0], axis = 'x', kind = 'bumper') {
  const R = d / 2
  const bore = 0.0255
  const g = group()
  if (kind === 'bumper') {
    const insert = 0.05
    const face = R * 0.74
    g.add(latheHard([[insert, -t / 2 + 0.002], [face, -t / 2 + 0.002], [face + 0.006, -t / 2], [R - 0.006, -t / 2], [R, -t / 2 + 0.008], [R, t / 2 - 0.008], [R - 0.006, t / 2], [face + 0.006, t / 2], [face, t / 2 - 0.002], [insert, t / 2 - 0.002]], STEEL.bumper, pos, axis, 96, 0.002))
    g.add(latheHard([[bore, -t / 2], [insert + 0.002, -t / 2], [insert + 0.002, t / 2], [bore, t / 2], [bore, -t / 2]], STEEL.sleeve, pos, axis, 40, 0.0012))
  } else {
    const hub = 0.062
    const rim = R * 0.13
    const web = t * 0.5
    g.add(latheHard([[hub * 0.6, -t / 2], [hub, -t / 2], [hub + 0.01, -web / 2], [R - rim - 0.008, -web / 2], [R - rim, -t / 2], [R - 0.004, -t / 2], [R, -t / 2 + 0.006], [R, t / 2 - 0.006], [R - 0.004, t / 2], [R - rim, t / 2], [R - rim - 0.008, web / 2], [hub + 0.01, web / 2], [hub, t / 2], [hub * 0.6, t / 2]], STEEL.iron, pos, axis, 96, 0.002))
    g.add(latheHard([[bore, -t / 2], [hub * 0.6 + 0.001, -t / 2], [hub * 0.6 + 0.001, t / 2], [bore, t / 2], [bore, -t / 2]], STEEL.ironEdge, pos, axis, 40, 0.0012))
  }
  return g
}

/** Spring-clip collar on a sleeve along X at x. */
function collar(x, r = 0.0265) {
  return group(
    latheHard([[r - 0.001, -0.012], [r + 0.012, -0.012], [r + 0.012, 0.012], [r - 0.001, 0.012]], STEEL.paintDark, [x, 0, 0], 'x', 28, 0.002),
    place(kit.rbox(0.012, 0.02, 0.022, 0.003, STEEL.sleeve, [0, 0, 0], 1), [x, r + 0.018, 0]),
  )
}

/** Weld bead around a joint: a rough little ring. Normal along axis. */
function weldRing(pos, R, axis = 'y') {
  return kit.torus(R, 0.0028, STEEL.weld, pos, axis, 28)
}

/** A plate-loaded sleeve along +X (mirror with s = -1) starting at x0: flange, sleeve, plates, collar. Length L. */
function loadedSleeve(s, x0, L, plates, { r = 0.025, kind = 'bumper', d = 0.45, t = 0.05 } = {}) {
  const g = group()
  g.add(latheHard([[0, -L / 2], [r, -L / 2], [r, L / 2], [0, L / 2]], STEEL.sleeve, [s * (x0 + L / 2), 0, 0], 'x', 28, 0.002))
  g.add(latheHard([[0, -0.009], [r + 0.019, -0.009], [r + 0.019, 0.009], [0, 0.009]], STEEL.shaft, [s * (x0 - 0.009), 0, 0], 'x', 32, 0.002))
  let x = x0
  for (let i = 0; i < plates; i++) {
    g.add(plate(d, t, [s * (x + t / 2), 0, 0], 'x', kind))
    x += t + 0.001
  }
  if (plates) g.add(collar(s * (x + 0.012), r))
  return g
}

/** Orientation with local X along x, local Y as close as possible to y. */
function basis(x, y) {
  const X = vec(x).normalize()
  let Y = vec(y).addScaledVector(X, -vec(y).dot(X))
  if (Y.lengthSq() < 1e-6) Y = new V3(0, 1, 0).addScaledVector(X, -X.y)
  if (Y.lengthSq() < 1e-6) Y = new V3(0, 0, 1).addScaledVector(X, -X.z)
  Y.normalize()
  const Z = X.clone().cross(Y)
  return new Q4().setFromRotationMatrix(new M4().makeBasis(X, Y, Z))
}

/**
 * The world frame of a bar held in the hands: origin between the hand centres, X from right hand to left, Y toward the wrists.
 * Returns null when the prop is not following.
 */
function barFrame(p, ctx) {
  if (p.hands && ctx && ctx.hands) {
    const cl = vec(ctx.hands.L.centre)
    const cr = vec(ctx.hands.R.centre)
    const o = cl.clone().add(cr).multiplyScalar(0.5)
    const x = cl.clone().sub(cr)
    const wrist = vec(ctx.hands.L.wrist).add(vec(ctx.hands.R.wrist)).multiplyScalar(0.5).sub(o)
    return { o, q: basis(x, wrist) }
  }
  if (p.hand && ctx && ctx.hands) {
    const h = ctx.hands[p.hand]
    const o = vec(h.centre)
    return { o, q: basis(vec(h.thumb), vec(h.wrist).sub(o)) }
  }
  if (p.at) return { o: vec(p.at), q: basis(p.dir ?? [1, 0, 0], p.up ?? [0, 1, 0]) }
  return null
}

/** Wraps a local assembly (origin on its grip or centre, X along it) in a world frame, or leaves it at `height` for a static prop. */
function holdOrRest(inner, p, ctx, height, { rollX = 0 } = {}) {
  const out = group(inner)
  const f = barFrame(p, ctx)
  if (f) {
    inner.quaternion.copy(f.q)
    if (rollX) inner.quaternion.multiply(new Q4().setFromAxisAngle(new V3(1, 0, 0), rollX))
    inner.position.copy(f.o)
    if (p.offset) inner.position.add(vec(p.offset))
    out.userData.world = true
  } else {
    inner.position.y = height
  }
  return out
}

/** Smooth points through a list of points. */
const smooth = (points, n, tension = 0.5) => {
  const c = new THREE.CatmullRomCurve3(points.map((q) => vec(q)), false, 'catmullrom', tension)
  return c.getPoints(n)
}

/** Laid rope: three strands wound around a path. Reads as rope, not as a pipe. Not cached: built per frame when it moves. */
function ropeGeo(path, r, { pitch = 0.09, strands = 3, seg = 18, depth = 0.17 } = {}) {
  const P = path
  const n = P.length
  const T = P.map((q, i) => P[Math.min(n - 1, i + 1)].clone().sub(P[Math.max(0, i - 1)]).normalize())
  let N = Math.abs(T[0].y) < 0.9 ? new V3(0, 1, 0) : new V3(1, 0, 0)
  N.addScaledVector(T[0], -N.dot(T[0])).normalize()
  const pos = []
  const idx = []
  const q = new Q4()
  let along = 0
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      q.setFromUnitVectors(T[i - 1], T[i])
      N = N.clone().applyQuaternion(q)
      N.addScaledVector(T[i], -N.dot(T[i])).normalize()
      along += P[i].distanceTo(P[i - 1])
    }
    const B = T[i].clone().cross(N)
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2
      const ph = strands * (a - (along / pitch) * Math.PI * 2)
      const rr = r * (1 - depth + depth * Math.abs(Math.cos(ph / 2)) ** 0.6)
      pos.push(P[i].x + (N.x * Math.cos(a) + B.x * Math.sin(a)) * rr, P[i].y + (N.y * Math.cos(a) + B.y * Math.sin(a)) * rr, P[i].z + (N.z * Math.cos(a) + B.z * Math.sin(a)) * rr)
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const j2 = (j + 1) % seg
      idx.push(i * seg + j, i * seg + j2, (i + 1) * seg + j2, i * seg + j, (i + 1) * seg + j2, (i + 1) * seg + j)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/* ---------------------------------------- stones and platforms ---------------------------------------- */

function atlasStone(p, ctx) {
  const d = p.d ?? 0.5
  const R = d / 2
  const g = cachedGeo(`atlasGeo${d}`, () => {
    const s = new THREE.SphereGeometry(R, 128, 96)
    const q = s.attributes.position
    const v = new V3()
    for (let i = 0; i < q.count; i++) {
      v.fromBufferAttribute(q, i)
      // A cast stone is never a true sphere: slow lumps, and a flat where it sat in the mould.
      const n = v.clone().normalize()
      const lump = 0.006 * Math.sin(n.x * 5 + 1.1) * Math.sin(n.y * 4 + 0.4) + 0.004 * Math.sin(n.z * 7 + 2.3) * Math.cos(n.x * 6)
      v.addScaledVector(n, lump)
      const flat = -R + 0.015
      if (v.y < flat) v.y = flat
      q.setXYZ(i, v.x, v.y, v.z)
    }
    s.computeVertexNormals()
    return s
  })
  const inner = group(mesh(g, MS.concrete()))
  // The seam the mould leaves.
  inner.add(place(kit.torus(R + 0.0005, 0.0022, MS.concrete(), [0, 0, 0], 'x', 96), [0, 0, 0]))
  return holdOrRest(inner, p, ctx, R - 0.015)
}

function atlasPlatform(p) {
  const h = p.height ?? 1.2
  const w = p.width ?? 0.8
  const d = p.depth ?? 0.8
  const g = group()
  const t = 0.022
  const wood = MS.ply()
  // Four sheets and a top, with the battens on the outside that hold real ones together.
  g.add(kit.rbox(w, h - t, t, 0.003, wood, [0, (h - t) / 2, -d / 2 + t / 2], 2))
  g.add(kit.rbox(w, h - t, t, 0.003, wood, [0, (h - t) / 2, d / 2 - t / 2], 2))
  g.add(kit.rbox(t, h - t, d - 2 * t, 0.003, wood, [-w / 2 + t / 2, (h - t) / 2, 0], 2))
  g.add(kit.rbox(t, h - t, d - 2 * t, 0.003, wood, [w / 2 - t / 2, (h - t) / 2, 0], 2))
  g.add(kit.rbox(w + 0.02, 0.03, d + 0.02, 0.006, MS.plank(), [0, h - 0.015, 0], 2))
  const batten = 0.07
  for (const s of [-1, 1]) {
    for (const f of [-1, 1]) {
      // Corner battens on the front and rear faces, and rails at the top and foot.
      g.add(kit.rbox(batten, h - 0.04, 0.018, 0.003, MS.plank(), [s * (w / 2 - batten / 2), (h - 0.04) / 2 + 0.005, f * (d / 2 + 0.008)], 2))
    }
    g.add(kit.rbox(0.018, h - 0.04, batten, 0.003, MS.plank(), [s * (w / 2 + 0.008), (h - 0.04) / 2 + 0.005, -d / 2 + batten / 2], 2))
    g.add(kit.rbox(0.018, h - 0.04, batten, 0.003, MS.plank(), [s * (w / 2 + 0.008), (h - 0.04) / 2 + 0.005, d / 2 - batten / 2], 2))
  }
  for (const f of [-1, 1]) {
    g.add(kit.rbox(w - 2 * batten, batten, 0.018, 0.003, MS.plank(), [0, h - 0.07, f * (d / 2 + 0.008)], 2))
    g.add(kit.rbox(w - 2 * batten, batten, 0.018, 0.003, MS.plank(), [0, 0.05, f * (d / 2 + 0.008)], 2))
  }
  // Rubber ring that seats the stone, and screw heads along the battens.
  g.add(place(kit.torus(0.13, 0.012, M.rubber, [0, 0, 0], 'y', 48), [0, h + 0.008, 0]))
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) g.add(bolt([s * (w / 2 - batten / 2), 0.15 + i * (h - 0.3) * 0.25, -d / 2 - 0.0175], 'z', 0.005, M.aluDark).rotateX(Math.PI))
  }
  return g
}

function atlasTrainer(p, ctx) {
  const n = p.plates ?? 4
  const t = 0.05
  const inner = group()
  const L = 0.4
  inner.add(latheHard([[0, -L / 2], [0.03, -L / 2], [0.03, L / 2], [0, L / 2]], STEEL.shaft, [0, 0, 0], 'x', 28, 0.002))
  const x0 = (-(n - 1) * (t + 0.001)) / 2
  for (let i = 0; i < n; i++) inner.add(plate(0.45, t, [x0 + i * (t + 0.001), 0, 0], 'x', 'bumper'))
  const end = (n * (t + 0.001)) / 2 + 0.012
  inner.add(collar(end, 0.03))
  inner.add(collar(-end, 0.03))
  return holdOrRest(inner, p, ctx, 0.225)
}

/* ---------------------------------------- bars ---------------------------------------- */

function logBar(p, ctx) {
  const d = p.d ?? 0.3
  const R = d / 2
  const plates = p.plates ?? 1
  const inner = group()
  const hx0 = 0.2
  const hx1 = 0.4
  const end = 0.85
  // A log is a thick-walled tube: a machined centre, two handle wells, ends with a weld at the sleeve.
  inner.add(latheHard([[0, -hx0], [R, -hx0], [R, hx0], [0, hx0]], STEEL.paint, [0, 0, 0], 'x', 72, 0.004))
  for (const s of [-1, 1]) {
    inner.add(latheHard([[0, -(end - hx1) / 2], [R - 0.012, -(end - hx1) / 2], [R, -(end - hx1) / 2 + 0.012], [R, (end - hx1) / 2], [0, (end - hx1) / 2]], STEEL.paint, [s * (hx1 + (end - hx1) / 2), 0, 0], 'x', 72, 0.004))
    // The chamfer belongs on the log's outer end.
    if (s < 0) inner.children[inner.children.length - 1].rotation.z = -Math.PI / 2
    // End face, with its bead around the sleeve.
    inner.add(place(kit.torus(0.042, 0.004, STEEL.weld, [0, 0, 0], 'x', 32), [s * (end + 0.002), 0, 0]))
    // Handle well: the log with a rectangular window cut out of the +Y side.
    const nw = R - 0.028
    const ny = -0.05
    const yc = Math.sqrt(R * R - nw * nw)
    const a0 = Math.atan2(yc, nw)
    const outline = []
    const N = 48
    for (let i = 0; i <= N; i++) {
      const a = a0 - (i / N) * (Math.PI * 2 - (Math.PI - 2 * a0))
      outline.push([R * Math.cos(a), R * Math.sin(a)])
    }
    outline.push([-nw, ny], [nw, ny])
    inner.add(slab(roundPoly(outline.map(([u, v]) => [u, v, 0]), 0, 1), hx1 - hx0, STEEL.paint, [s * (hx0 + hx1) * 0.5, 0, 0], { plane: 'zy', bevel: 0.002, bevelSeg: 1, crease: 30 }))
    // Inside of the window in a darker tone.
    inner.add(kit.box(hx1 - hx0 - 0.002, 0.002, 2 * nw - 0.004, M.hole, [s * (hx0 + hx1) * 0.5, ny + 0.001, 0]))
    // The handle, knurled in the middle, across the window.
    inner.add(latheHard([[0, -R + 0.01], [0.019, -R + 0.01], [0.019, R - 0.01], [0, R - 0.01]], STEEL.shaft, [s * 0.3, 0, 0], 'z', 24, 0.001))
    inner.add(kit.cyl(0.0198, 0.13, STEEL.knurl, [s * 0.3, 0, 0], 'z', { seg: 24 }))
    // Sleeve and plates.
    inner.add(loadedSleeve(s, end + 0.006, 0.25, plates, { r: 0.025 }))
  }
  // Two lighter bands where the plates of the log were welded.
  for (const x of [-0.72, -0.5, 0, 0.5, 0.72]) inner.add(latheHard([[R + 0.0006, -0.004], [R + 0.0006, 0.004]], STEEL.weld, [x, 0, 0], 'x', 72, 0))
  const restY = plates ? 0.225 : R
  return holdOrRest(inner, p, ctx, restY)
}

function axleBar(p, ctx) {
  const r = (p.thick ?? 0.05) / 2
  const n = p.plates ?? 2
  const inner = group()
  const L = 2.13
  inner.add(latheHard([[0, -L / 2], [r, -L / 2], [r, L / 2], [0, L / 2]], STEEL.shaft, [0, 0, 0], 'x', 32, 0.003))
  // Machined rings near the ends show it is one solid axle, and the loaded plates stop against pipe-clamp collars.
  for (const s of [-1, 1]) {
    inner.add(latheHard([[r, -0.015], [r + 0.01, -0.015], [r + 0.01, 0.015], [r, 0.015]], STEEL.paintDark, [s * 0.56, 0, 0], 'x', 32, 0.002))
    let x = 0.58
    for (let i = 0; i < n; i++) {
      inner.add(plate(0.45, 0.05, [s * (x + 0.025), 0, 0], 'x', 'bumper'))
      x += 0.051
    }
    if (n) inner.add(latheHard([[r, -0.015], [r + 0.01, -0.015], [r + 0.01, 0.015], [r, 0.015]], STEEL.paintDark, [s * (x + 0.015), 0, 0], 'x', 32, 0.002))
  }
  return holdOrRest(inner, p, ctx, 0.225)
}

function farmersHandle(p, ctx) {
  const n = p.plates ?? 1
  const inner = group()
  const L = 1.5
  const x0 = 0.42
  // The bar runs along local X. A thick grip in the middle, then stops, then bare sleeves carrying the plates.
  inner.add(latheHard([[0, -L / 2], [0.0225, -L / 2], [0.0225, L / 2], [0, L / 2]], STEEL.shaft, [0, 0, 0], 'x', 24, 0.002))
  inner.add(latheHard([[0.019, -0.1], [0.0245, -0.1], [0.0245, 0.1], [0.019, 0.1]], STEEL.knurl, [0, 0, 0], 'x', 24, 0.001))
  for (const s of [-1, 1]) {
    // A rubbed ring either side of the grip, and the stop collar with its weld.
    inner.add(latheHard([[0.022, -0.006], [0.031, -0.006], [0.031, 0.006], [0.022, 0.006]], STEEL.paintDark, [s * 0.11, 0, 0], 'x', 28, 0.0015))
    inner.add(latheHard([[0.022, -0.016], [0.054, -0.016], [0.054, 0.016], [0.022, 0.016]], STEEL.paint, [s * (x0 - 0.018), 0, 0], 'x', 36, 0.002))
    inner.add(place(kit.torus(0.0245, 0.0026, STEEL.weld, [0, 0, 0], 'x', 28), [s * (x0 - 0.035), 0, 0]))
    let x = x0
    for (let i = 0; i < n; i++) {
      inner.add(plate(0.45, 0.05, [s * (x + 0.025), 0, 0], 'x', 'bumper'))
      x += 0.051
    }
    inner.add(collar(s * (x + 0.012), 0.0225))
  }
  const out = group(inner)
  if (p.hand && ctx && ctx.hands) {
    const h = ctx.hands[p.hand]
    const o = vec(h.centre)
    inner.quaternion.copy(basis(vec(h.thumb), vec(h.wrist).sub(o)))
    inner.position.copy(o)
    out.userData.world = true
  } else if (p.at) {
    inner.quaternion.copy(basis(p.dir ?? [0, 0, 1], [0, 1, 0]))
    inner.position.copy(vec(p.at))
    out.userData.world = true
  } else {
    inner.rotation.y = -Math.PI / 2
    inner.position.y = 0.225
  }
  return out
}

function yoke(p, ctx) {
  const inner = group()
  const barH = p.barH ?? 1.5
  const w = p.width ?? 1.04
  const hx = w / 2
  const n = p.plates ?? 2
  const H = 1.95
  const up = 0.09
  for (const s of [-1, 1]) {
    const x = s * hx
    inner.add(beam([x, 0.06, 0], [x, H, 0], up, up, STEEL.paint, { r: 0.008, side: [1, 0, 0], holes: { n: 12, from: 1.02, to: 1.72, r: 0.009, face: 'side' } }))
    // Floor runner: a heavy channel with upturned ends.
    inner.add(rectPipe([[x, 0.05, -0.62], [x, 0.03, -0.54], [x, 0.03, 0.54], [x, 0.05, 0.62]], 0.1, 0.05, STEEL.paintDark, { bend: 0.03, cr: 0.006, up: [1, 0, 0] }))
    // Gussets, welded.
    for (const f of [-1, 1]) {
      const gus = roundPoly([[f * 0.045, 0.055, 0], [f * 0.32, 0.055, 0.005], [f * 0.045, 0.34, 0.005]], 0, 2)
      inner.add(slab(gus, 0.012, STEEL.paintLight, [x, 0, 0], { plane: 'zy', bevel: 0.002, bevelSeg: 1 }))
    }
    inner.add(weld([x, 0.058, 0], [0, 1, 0], up, up))
    inner.add(weld([x, H - 0.073, 0], [0, 1, 0], up, up))
    // Plate peg low on the outside of the upright.
    const pegY = 0.36
    const peg = group()
    peg.add(latheHard([[0, -0.15], [0.025, -0.15], [0.025, 0.15], [0, 0.15]], STEEL.sleeve, [s * 0.15, 0, 0], 'x', 24, 0.002))
    peg.add(latheHard([[0, -0.009], [0.05, -0.009], [0.05, 0.009], [0, 0.009]], STEEL.paintLight, [s * 0.009, 0, 0], 'x', 28, 0.002))
    let px = 0.02
    for (let i = 0; i < n; i++) {
      peg.add(plate(0.45, 0.05, [s * (px + 0.025), 0, 0], 'x', 'bumper'))
      px += 0.051
    }
    place(peg, [x + s * up * 0.5, pegY, 0])
    inner.add(peg)
    // Bar sleeve around the upright at the crossbar's height, with its locking pin.
    inner.add(place(kit.rbox(up + 0.024, 0.09, up + 0.024, 0.008, STEEL.paintLight, [0, 0, 0], 2), [x, barH, 0]))
    inner.add(place(kit.lathe([[0, 0], [0.008, 0], [0.008, 0.03], [0.018, 0.034], [0.018, 0.05], [0, 0.052]], STEEL.sleeve, [0, 0, 0], 'y', 16), [x, barH, up / 2 + 0.012], [90, 0, 0]))
  }
  // Top beam.
  inner.add(beam([-hx - up / 2, H - 0.035, 0], [hx + up / 2, H - 0.035, 0], 0.07, 0.07, STEEL.paint, { r: 0.007, side: [0, 0, 1] }))
  // Crossbar with a shoulder pad.
  inner.add(latheHard([[0, -hx], [0.03, -hx], [0.03, hx], [0, hx]], STEEL.shaft, [0, barH, 0], 'x', 28, 0.002))
  inner.add(latheHard([[0.03, -0.24], [0.052, -0.235], [0.056, -0.21], [0.056, 0.21], [0.052, 0.235], [0.03, 0.24]], M.pad, [0, barH, 0], 'x', 32, 0.004))
  const out = group(inner)
  if (p.follow && ctx && ctx.frames) {
    const c = ctx.frames.chest
    const q = new Q4(c.quat[0], c.quat[1], c.quat[2], c.quat[3])
    const pt = vec(p.at ?? [0, 0.215, -0.055]).applyQuaternion(q).add(vec(c.pos))
    const y = Math.max(0, pt.y - barH)
    inner.position.set(pt.x, y, pt.z)
    inner.rotation.y = ((p.yaw || 0) * Math.PI) / 180
    out.userData.world = true
  } else {
    inner.position.y = p.lift ?? 0
  }
  return out
}

/* ---------------------------------------- tractor tire ---------------------------------------- */

const TIRE = { od: 1.45, w: 0.46, id: 0.72 }

/** One tread lug, wrapped on the crown: corners are given in (theta, h), its top `e` above the crown. */
function lugGeometry(R, W, corners, e, crown, nu = 6, nv = 3) {
  // Bilinear patch on the corners a-b-c-d, plus a skirt that drops into the carcass.
  const [a, b, c, dd] = corners
  const at = (u, v) => {
    const th = (1 - u) * ((1 - v) * a[0] + v * dd[0]) + u * ((1 - v) * b[0] + v * c[0])
    const h = (1 - u) * ((1 - v) * a[1] + v * dd[1]) + u * ((1 - v) * b[1] + v * c[1])
    return [th, h]
  }
  const P = (th, h, lift) => {
    const r = crown(h) + lift
    return new V3(r * Math.cos(th), h, -r * Math.sin(th))
  }
  const pos = []
  const quad = (p, q, r, s) => {
    for (const v of [p, q, r, p, r, s]) pos.push(v.x, v.y, v.z)
  }
  // Top face, with the edges chamfered a little so light catches them.
  const ch = 0.008
  const inset = (u, v) => {
    const margin = 0.06
    return [margin + u * (1 - 2 * margin), margin + v * (1 - 2 * margin)]
  }
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const [u0, v0] = inset(i / nu, j / nv)
      const [u1, v1] = inset((i + 1) / nu, (j + 1) / nv)
      const A = at(u0, v0)
      const B = at(u1, v0)
      const C = at(u1, v1)
      const D = at(u0, v1)
      quad(P(A[0], A[1], e), P(B[0], B[1], e), P(C[0], C[1], e), P(D[0], D[1], e))
    }
  }
  // Walls around the outline, chamfer then sides.
  const ring = []
  const edge = (u0, v0, u1, v1, n) => {
    for (let i = 0; i < n; i++) ring.push([u0 + ((u1 - u0) * i) / n, v0 + ((v1 - v0) * i) / n])
  }
  edge(0, 0, 1, 0, nu)
  edge(1, 0, 1, 1, nv)
  edge(1, 1, 0, 1, nu)
  edge(0, 1, 0, 0, nv)
  for (let i = 0; i < ring.length; i++) {
    const [u0, v0] = ring[i]
    const [u1, v1] = ring[(i + 1) % ring.length]
    const [iu0, iv0] = inset(u0, v0)
    const [iu1, iv1] = inset(u1, v1)
    const A = at(iu0, iv0)
    const B = at(iu1, iv1)
    const C = at(u0, v0)
    const D = at(u1, v1)
    quad(P(A[0], A[1], e), P(C[0], C[1], e - ch), P(D[0], D[1], e - ch), P(B[0], B[1], e))
    quad(P(C[0], C[1], e - ch), P(C[0], C[1], -0.01), P(D[0], D[1], -0.01), P(D[0], D[1], e - ch))
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  return g
}

function tireGeo() {
  return cachedGeo('tractorTire', () => {
    const R = TIRE.od / 2
    const hw = TIRE.w / 2
    const rIn = TIRE.id / 2
    const crown = (h) => R - 0.045 - 0.05 * Math.pow(Math.abs(h) / hw, 2.4)
    const lugs = []
    const N = 34
    const le = 0.045 // lug height
    for (let i = 0; i < N; i++) {
      const th0 = (i / N) * Math.PI * 2
      const dth = (Math.PI * 2) / N
      for (const s of [-1, 1]) {
        const shift = s > 0 ? 0 : dth * 0.5
        // A long lug from the centre rib out over the shoulder, swept back as tractor lugs are.
        const h0 = s * -0.014
        const h1 = s * (hw - 0.006)
        const sweep = dth * 0.95
        const wid = dth * 0.46
        const a = [th0 + shift, h0]
        const b = [th0 + shift + sweep, h1]
        const c = [th0 + shift + sweep + wid * 1.15, h1]
        const dd = [th0 + shift + wid * 0.85, h0]
        lugs.push(lugGeometry(R, hw * 2, s > 0 ? [a, b, c, dd] : [b, a, dd, c], le, crown))
      }
    }
    const merged = new THREE.BufferGeometry()
    const total = lugs.reduce((t, g) => t + g.attributes.position.count, 0)
    const arr = new Float32Array(total * 3)
    let off = 0
    for (const g of lugs) {
      arr.set(g.attributes.position.array, off)
      off += g.attributes.position.array.length
    }
    merged.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    // Winding may flip with the corner order: make every face point away from the axis or up/down, by the wall it belongs to.
    const n = merged.attributes.position.count
    const pa = merged.attributes.position
    const A = new V3()
    const B = new V3()
    const C = new V3()
    for (let i = 0; i < n; i += 3) {
      A.fromBufferAttribute(pa, i)
      B.fromBufferAttribute(pa, i + 1)
      C.fromBufferAttribute(pa, i + 2)
      const f = B.clone().sub(A).cross(C.clone().sub(A))
      const m = A.clone().add(B).add(C).multiplyScalar(1 / 3)
      const radial = new V3(m.x, 0, m.z).normalize()
      if (f.dot(radial) < 0) {
        pa.setXYZ(i + 1, C.x, C.y, C.z)
        pa.setXYZ(i + 2, B.x, B.y, B.z)
      }
    }
    return creaseNormals(merged, 34)
  })
}

/** The tire in its flat pose, on the floor, axis Y, centred. */
function tireBody() {
  const R = TIRE.od / 2
  const hw = TIRE.w / 2
  const rIn = TIRE.id / 2
  const crownEdge = R - 0.045 - 0.05
  const g = group()
  // Carcass: sidewalls bulge, bead turns in. Traversed counter-clockwise in (r, y) so faces point out.
  const prof = []
  const y0 = -hw
  prof.push([rIn + 0.012, y0 + 0.042])
  prof.push([rIn + 0.04, y0 + 0.022])
  // Bottom sidewall, flat-ish with a slow curve.
  for (let i = 0; i <= 10; i++) {
    const u = i / 10
    const r = lerp(rIn + 0.05, crownEdge + 0.012, u)
    prof.push([r, y0 + 0.017 * Math.sin(u * Math.PI) * -1 + 0.008 * u])
  }
  // Shoulder and crown.
  for (let i = 0; i <= 18; i++) {
    const u = i / 18
    const h = lerp(-hw + 0.012, hw - 0.012, u)
    prof.push([R - 0.045 - 0.05 * Math.pow(Math.abs(h) / hw, 2.4), h])
  }
  for (let i = 0; i <= 10; i++) {
    const u = 1 - i / 10
    const r = lerp(rIn + 0.05, crownEdge + 0.012, u)
    prof.push([r, -y0 + 0.017 * Math.sin(u * Math.PI) - 0.008 * u])
  }
  prof.push([rIn + 0.04, -y0 - 0.022])
  prof.push([rIn + 0.012, -y0 - 0.042])
  // Inside of the hole.
  prof.push([rIn, 0.1])
  prof.push([rIn, -0.1])
  prof.push([rIn + 0.012, y0 + 0.042])
  const carcass = kit.lathe(prof, MS.tire(), [0, 0, 0], 'y', 144)
  g.add(carcass)
  g.add(mesh(tireGeo(), MS.tire()))
  // Moulded rings on the sidewalls and a row of shoulder blocks read at a distance.
  for (const s of [-1, 1]) {
    for (const [rr, tt] of [[rIn + 0.085, 0.006], [rIn + 0.11, 0.004], [crownEdge - 0.05, 0.005]]) {
      g.add(place(kit.torus(rr, tt, MS.tire(), [0, 0, 0], 'y', 120), [0, s * (hw + 0.004), 0]))
    }
  }
  return g
}

function tractorTire(p, ctx) {
  const k = p.scale ?? 1
  const R = TIRE.od / 2
  const hw = TIRE.w / 2
  let tilt = (p.tilt ?? 0) * RAD
  if (p.hands && ctx && ctx.hands) {
    const y = (ctx.hands.L.centre[1] + ctx.hands.R.centre[1]) / 2 / k
    // Solve hand y = 0.06 cos a + 2R sin a, keeping a grip low on the near lip.
    const s = clamp((y - 0.06) / (2 * R), 0, 1)
    tilt = Math.asin(s)
    for (let i = 0; i < 3; i++) tilt = Math.asin(clamp((y - 0.06 * Math.cos(tilt)) / (2 * R), 0, 1))
  }
  const body = tireBody()
  // Tire's centre sits hw above the floor at tilt 0. In the pivot's frame: the pivot is the far edge at floor level.
  body.position.set(0, hw, -R)
  const pivot = group(body)
  pivot.scale.setScalar(k)
  pivot.position.set(0, 0, R * k)
  pivot.rotation.x = tilt
  return group(pivot)
}

/* ---------------------------------------- sleds ---------------------------------------- */

/** Vertical plate horn with its base flange, plates stacked flat on it. Base at y0. */
function plateHorn(y0, n, h = 0.34) {
  const g = group()
  g.add(latheHard([[0, 0], [0.024, 0], [0.024, h], [0.019, h + 0.006], [0, h + 0.006]], STEEL.sleeve, [0, y0, 0], 'y', 28, 0.002))
  g.add(latheHard([[0.024, 0], [0.058, 0], [0.058, 0.012], [0.024, 0.012]], STEEL.paintLight, [0, y0, 0], 'y', 36, 0.002))
  let y = y0 + 0.014
  for (let i = 0; i < n; i++) {
    g.add(plate(0.45, 0.05, [0, y + 0.025, 0], 'y', 'bumper'))
    y += 0.051
  }
  return g
}

function sledBase(L, W) {
  const g = group()
  const hx = W / 2
  // Runners: flat steel skids, turned up at both ends so they ride over the ground.
  for (const s of [-1, 1]) {
    const x = s * hx
    const pts = [[x, 0.13, -L / 2 - 0.03], [x, 0.02, -L / 2 + 0.09], [x, 0.02, L / 2 - 0.09], [x, 0.13, L / 2 + 0.03]]
    g.add(rectPipe(pts, 0.07, 0.016, STEEL.shaft, { bend: 0.09, cr: 0.003, up: [1, 0, 0] }))
    // Rail over the runner.
    g.add(beam([x, 0.075, -L / 2 + 0.08], [x, 0.075, L / 2 - 0.08], 0.05, 0.05, STEEL.paint, { r: 0.006 }))
    for (const z of [-L / 2 + 0.16, L / 2 - 0.16]) g.add(beam([x, 0.03, z], [x, 0.055, z], 0.04, 0.04, STEEL.paint, { r: 0.004 }))
  }
  // Cross members and a checker-plate deck.
  for (const z of [-L / 2 + 0.11, L / 2 - 0.11]) g.add(beam([-hx, 0.075, z], [hx, 0.075, z], 0.05, 0.05, STEEL.paint, { r: 0.006, side: [0, 0, 1] }))
  g.add(kit.rbox(W - 0.04, 0.008, L - 0.26, 0.002, M.matte, [0, 0.103, 0], 1))
  const dots = cachedGeo(`sledDeckDots${L}${W}`, () => {
    const list = []
    const bump = new THREE.CapsuleGeometry(0.0035, 0.02, 2, 6)
    const nx = Math.floor((W - 0.08) / 0.05)
    const nz = Math.floor((L - 0.3) / 0.05)
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const m = new M4().compose(new V3(-(W - 0.08) / 2 + (i + 0.5) * 0.05, 0.1075, -(L - 0.3) / 2 + (j + 0.5) * 0.05), new Q4().setFromEuler(new THREE.Euler(Math.PI / 2, 0, (i + j) % 2 ? Math.PI / 4 : -Math.PI / 4)), new V3(1, 1, 0.45))
        list.push([bump, m])
      }
    }
    return mergeGeos(list)
  })
  g.add(mesh(dots, M.matteDark))
  return g
}

/** Local z of a sled that keeps a handle point under the hands. */
function sledFollow(p, ctx, handleZ) {
  if (!(p.hands && ctx && ctx.hands)) return 0
  const L = localFrame(p)
  const mid = L.pt(vec(ctx.hands.L.centre).add(vec(ctx.hands.R.centre)).multiplyScalar(0.5))
  return mid.z - handleZ
}

function sled(p, ctx) {
  const n = p.plates ?? 2
  const inner = group()
  const L = 1.1
  const W = 0.55
  inner.add(sledBase(L, W))
  inner.add(plateHorn(0.108, n, 0.36))
  for (const e of [-1, 1]) {
    // A low U handle at each end.
    const z = e * 0.5
    inner.add(pipe([[-0.19, 0.1, e * 0.42], [-0.19, 0.34, z], [0.19, 0.34, z], [0.19, 0.1, e * 0.42]], 0.016, STEEL.paint, { bend: 0.05, seg: 16 }))
    inner.add(latheHard([[0.016, -0.1], [0.0195, -0.098], [0.0195, 0.098], [0.016, 0.1]], M.grip, [0, 0.34, z], 'x', 18, 0.002))
    // Strap ring.
    inner.add(place(kit.torus(0.03, 0.0065, STEEL.sleeve, [0, 0, 0], 'x', 28), [0, 0.13, e * 0.53]))
    inner.add(kit.rbox(0.03, 0.04, 0.02, 0.004, STEEL.paintDark, [0, 0.105, e * 0.485], 1))
  }
  inner.position.z = sledFollow(p, ctx, -0.5)
  return group(inner)
}

function prowler(p, ctx) {
  const n = p.plates ?? 2
  const inner = group()
  const L = 1.1
  const W = 0.6
  inner.add(sledBase(L, W))
  const horn = plateHorn(0.108, n, 0.36)
  horn.position.z = 0.14
  inner.add(horn)
  for (const s of [-1, 1]) {
    const x = s * 0.27
    // The upright: a bent round tube from the base, with a small lean to the rear and a rubber grip on top.
    inner.add(pipe([[x, 0.09, -0.12], [x, 0.7, -0.18], [x, 1.22, -0.21]], 0.019, STEEL.paint, { bend: 0.2, seg: 18 }))
    inner.add(latheHard([[0.019, -0.145], [0.0235, -0.14], [0.0235, 0.14], [0.019, 0.145]], M.grip, [x, 1.07, -0.2], 'y', 18, 0.002))
    inner.add(kit.sphere(0.0215, M.rubberDark, [x, 1.225, -0.21], 14))
    // Low handle: a bar from the upright to the rear, foam where hands go.
    inner.add(pipe([[x, 0.62, -0.17], [x, 0.62, -0.58]], 0.0165, STEEL.paint, { bend: 0, seg: 16 }))
    inner.add(latheHard([[0.0165, -0.125], [0.0205, -0.121], [0.0205, 0.121], [0.0165, 0.125]], M.grip, [x, 0.62, -0.44], 'z', 18, 0.002))
    inner.add(kit.sphere(0.018, M.rubberDark, [x, 0.62, -0.58], 12))
    // Diagonals: from the front of the base up to the upright, and under the low handle. A real welded triangle.
    inner.add(pipe([[x, 0.09, 0.4], [x, 0.76, -0.17]], 0.0135, STEEL.paint, { bend: 0, seg: 14 }))
    inner.add(pipe([[x, 0.09, -0.46], [x, 0.61, -0.36]], 0.0135, STEEL.paint, { bend: 0, seg: 14 }))
    inner.add(weldRing([x, 0.105, -0.12], 0.024, 'y'))
    inner.add(weldRing([x, 0.105, 0.39], 0.019, 'y'))
    inner.add(weldRing([x, 0.105, -0.455], 0.019, 'y'))
    inner.add(place(kit.rbox(0.05, 0.07, 0.07, 0.004, STEEL.paintDark, [0, 0, 0], 1), [x, 0.09, -0.12]))
  }
  // Tie bars between the uprights.
  inner.add(pipe([[-0.27, 0.92, -0.195], [0.27, 0.92, -0.195]], 0.0145, STEEL.paint, { bend: 0, seg: 14 }))
  inner.add(pipe([[-0.27, 0.44, -0.15], [0.27, 0.44, -0.15]], 0.0145, STEEL.paint, { bend: 0, seg: 14 }))
  inner.add(place(kit.torus(0.03, 0.0065, STEEL.sleeve, [0, 0, 0], 'x', 28), [0, 0.13, -0.53]))
  inner.add(kit.rbox(0.03, 0.04, 0.02, 0.004, STEEL.paintDark, [0, 0.105, -0.485], 1))
  inner.position.z = sledFollow(p, ctx, -0.2)
  return group(inner)
}

function sledStraps(p, ctx) {
  const g = group()
  g.userData.world = true
  if (!(ctx && ctx.hands)) return g
  const to = vec(p.to ?? [0, 0.13, 2])
  const L = vec(ctx.hands.L.centre)
  const R = vec(ctx.hands.R.centre)
  const mid = L.clone().add(R).multiplyScalar(0.5)
  const span = to.distanceTo(mid)
  // The two lines meet at a ring near the hands, one line continues to the sled.
  const ring = mid.clone().lerp(to, Math.min(0.62, 0.55 / Math.max(span, 0.6)))
  const r = 0.012
  for (const [side, h] of [['L', L], ['R', R]]) {
    g.add(mesh(ropeGeo(smooth([h, h.clone().lerp(ring, 0.5), ring], 30), r, { pitch: 0.05 }), STEEL.rope))
    // A handle bar across the hand: thumb direction.
    const t = vec(ctx.hands[side].thumb)
    const a = h.clone().addScaledVector(t, -0.075)
    const b = h.clone().addScaledVector(t, 0.075)
    g.add(pipe([a.toArray(), b.toArray()], 0.015, M.grip, { bend: 0, seg: 14 }))
    g.add(kit.sphere(0.0165, M.rubberDark, a.toArray(), 12))
    g.add(kit.sphere(0.0165, M.rubberDark, b.toArray(), 12))
  }
  g.add(kit.sphere(0.022, STEEL.sleeve, ring.toArray(), 16))
  // The main line, slightly heavier, with a very small sag that shows its weight.
  const m = ring.clone().lerp(to, 0.5)
  m.y -= Math.min(0.03, span * 0.012)
  g.add(mesh(ropeGeo(smooth([ring, m, to], Math.max(40, Math.round(span * 40))), 0.014, { pitch: 0.06 }), STEEL.rope))
  g.add(kit.sphere(0.018, STEEL.sleeve, to.toArray(), 14))
  return g
}

/* ---------------------------------------- harness ---------------------------------------- */

// The figure's outline in the rest pose, measured from the mesh (convex hull, so a strap bridges the hollows). Half of each section,
// x >= 0, from the front centre round to the back centre, as [x, z].
const CHEST_Y = 1.24
const CHEST_HALF = [[0, 0.134], [0.054, 0.134], [0.1, 0.117], [0.127, 0.098], [0.157, 0.047], [0.177, 0.013], [0.161, -0.02], [0.142, -0.047], [0.122, -0.072], [0.066, -0.094], [0, -0.096]]
const WAIST_Y = 1.005
const WAIST_HALF = [[0, 0.133], [0.048, 0.133], [0.092, 0.121], [0.126, 0.107], [0.145, 0.083], [0.154, 0.04], [0.157, -0.007], [0.141, -0.036], [0.116, -0.057], [0.055, -0.068], [0, -0.068]]

// The left shoulder strap's centreline, 6 mm off the rest mesh: from the chest strap's front, over the trapezius, down to the back ring.
const SHOULDER_STRAP = [[0.112, 1.255, 0.131], [0.112, 1.281, 0.134], [0.112, 1.309, 0.129], [0.112, 1.334, 0.12], [0.112, 1.357, 0.108], [0.112, 1.38, 0.095], [0.112, 1.403, 0.081], [0.112, 1.433, 0.065], [0.112, 1.462, 0.04], [0.112, 1.473, 0.006], [0.11, 1.471, -0.03], [0.106, 1.452, -0.062], [0.102, 1.424, -0.084], [0.093, 1.395, -0.098], [0.079, 1.369, -0.11], [0.065, 1.344, -0.12], [0.052, 1.316, -0.117], [0.038, 1.293, -0.112], [0.031, 1.282, -0.11]]

/** A smooth closed loop around a body section, e metres off the skin. */
function sectionLoop(half, y, cz, e, n = 72) {
  const pts = [...half, ...half.slice(1, -1).reverse().map(([x, z]) => [-x, z])].map(([x, z]) => {
    const dz = z - cz
    const l = Math.hypot(x, dz) || 1
    return new V3(x + (x / l) * e, y, z + (dz / l) * e)
  })
  return new THREE.CatmullRomCurve3(pts, true, 'centripetal').getPoints(n).slice(0, -1)
}

function harness(p, ctx) {
  const g = group()
  g.userData.world = true
  if (!(ctx && ctx.frames)) return g
  const C = ctx.frames.chest
  const Pv = ctx.frames.pelvis
  const qc = new Q4(C.quat[0], C.quat[1], C.quat[2], C.quat[3])
  const qp = new Q4(Pv.quat[0], Pv.quat[1], Pv.quat[2], Pv.quat[3])
  // All parts are written in rest-pose coordinates, then carried by the frame of the bone they ride.
  const chestO = new V3(0, 1.277, -0.05)
  const pelvisO = new V3(0, 0.93, -0.01)
  const chest = new THREE.Group()
  chest.position.copy(vec(C.pos))
  chest.quaternion.copy(qc)
  const offC = group()
  offC.position.copy(chestO).negate()
  chest.add(offC)
  const waist = new THREE.Group()
  waist.position.copy(vec(Pv.pos))
  waist.quaternion.copy(qp)
  const offP = group()
  offP.position.copy(pelvisO).negate()
  waist.add(offP)
  // Chest strap, and its padded front.
  offC.add(mesh(cachedGeo('hChest', () => sweepGeo(sectionLoop(CHEST_HALF, CHEST_Y, 0.02, 0.006), rectSection(0.05, 0.007, 0.003), { closed: true, up: [0, 1, 0] })), STEEL.strap))
  offC.add(mesh(cachedGeo('hChestPad', () => {
    const loop = sectionLoop(CHEST_HALF, CHEST_Y, 0.02, 0.009)
    // The front half of the loop, from side to side, starting at the wearer's left.
    const n = loop.length
    const front = []
    for (let i = -Math.round(n * 0.2); i <= Math.round(n * 0.2); i++) front.push(loop[(i + n) % n])
    return sweepGeo(front, rectSection(0.07, 0.012, 0.005), { up: [0, 1, 0] })
  }), M.pad))
  // Shoulder straps: from the chest strap's front, over the trapezius, down to the ring. Flat on the body: wide along X, thin off the skin.
  for (const s of [-1, 1]) {
    const strap = cachedGeo(`hShoulder${s}`, () => {
      const pts = smooth(SHOULDER_STRAP.map(([x, y, z]) => [s * x, y, z]), 90)
      return sweepGeo(pts, rectSection(0.048, 0.008, 0.0035))
    })
    offC.add(mesh(strap, M.pad))
    // Adjuster buckle on the chest.
    offC.add(place(kit.rbox(0.056, 0.028, 0.008, 0.003, STEEL.stainlessDull, [0, 0, 0], 1), [s * 0.112, 1.3, 0.137], [-6, 0, 0]))
  }
  // The ring on the back, with its reinforcing patch.
  const backRing = [0, 1.268, -0.122]
  offC.add(place(kit.rbox(0.11, 0.09, 0.012, 0.012, STEEL.strap, [0, 0, 0], 2), [0, 1.272, -0.108]))
  offC.add(place(kit.torus(0.022, 0.005, STEEL.sleeve, [0, 0, 0], 'x', 24), backRing))
  // Waist belt, with a roller buckle in front.
  offP.add(mesh(cachedGeo('hBelt', () => sweepGeo(sectionLoop(WAIST_HALF, WAIST_Y, 0.035, 0.006), rectSection(0.062, 0.007, 0.003), { closed: true, up: [0, 1, 0] })), STEEL.strap))
  offP.add(place(kit.rbox(0.056, 0.042, 0.008, 0.003, STEEL.stainlessDull, [0, 0, 0], 1), [0, WAIST_Y, 0.145]))
  const beltRing = [0, WAIST_Y - 0.006, -0.087]
  offP.add(place(kit.torus(0.02, 0.005, STEEL.sleeve, [0, 0, 0], 'x', 24), beltRing))
  g.add(chest, waist)
  if (p.to) {
    const to = vec(p.to)
    const from = p.attach === 'waist' ? vec(beltRing).sub(pelvisO).applyQuaternion(qp).add(vec(Pv.pos)) : vec(backRing).sub(chestO).applyQuaternion(qc).add(vec(C.pos))
    const m = from.clone().lerp(to, 0.5)
    m.y -= Math.min(0.03, from.distanceTo(to) * 0.012)
    g.add(mesh(ropeGeo(smooth([from, m, to], 60), 0.014, { pitch: 0.06 }), STEEL.rope))
    g.add(kit.sphere(0.017, STEEL.sleeve, to.toArray(), 14))
  }
  return g
}

/* ---------------------------------------- keg, sandbag, platform ---------------------------------------- */

function keg(p, ctx) {
  const R = 0.205
  const H = 0.6
  const inner = group()
  // Body, built along local X: profile from one end to the other.
  const prof = [
    [0, -H / 2 + 0.03],
    [0.03, -H / 2 + 0.03],
    [0.04, -H / 2 + 0.034],
    [0.15, -H / 2 + 0.046],
    [0.195, -H / 2 + 0.07],
    [R - 0.003, -H / 2 + 0.1],
    [R - 0.002, -0.175],
    [R + 0.008, -0.158],
    [R + 0.008, -0.14],
    [R - 0.002, -0.122],
    [R + 0.004, 0],
    [R - 0.002, 0.122],
    [R + 0.008, 0.14],
    [R + 0.008, 0.158],
    [R - 0.002, 0.175],
    [R - 0.003, H / 2 - 0.1],
    [0.195, H / 2 - 0.07],
    [0.15, H / 2 - 0.046],
    [0.04, H / 2 - 0.034],
    [0.03, H / 2 - 0.03],
    [0, H / 2 - 0.03],
  ]
  inner.add(kit.lathe(prof, STEEL.stainless, [0, 0, 0], 'x', 96))
  for (const s of [-1, 1]) {
    // The chime: a rolled skirt beyond the dome, with handle slots.
    const y1 = H / 2 - 0.1
    const c = latheHard([[R - 0.03, y1 - 0.01], [R - 0.012, y1], [R - 0.01, H / 2 - 0.012], [R - 0.006, H / 2], [R - 0.016, H / 2], [R - 0.02, H / 2 - 0.012], [R - 0.022, y1 + 0.03]], STEEL.stainlessDull, [0, 0, 0], 'y', 72, 0.002)
    c.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2
    inner.add(c)
    // Hand slots through the chime, drawn as dark windows.
    for (const a of [0, 120, 240]) {
      const slot = group(kit.rbox(0.03, 0.03, 0.11, 0.012, M.hole, [0, 0, 0], 2))
      const hub = group(slot)
      slot.position.set(0, R - 0.013, 0)
      hub.rotation.x = a * RAD
      hub.position.x = s * (H / 2 - 0.045)
      inner.add(hub)
    }
  }
  // Spear in one end.
  inner.add(latheHard([[0, -0.016], [0.028, -0.016], [0.03, 0], [0.024, 0.018], [0, 0.018]], STEEL.sleeve, [H / 2 - 0.046, 0, 0], 'x', 24, 0.002))
  inner.children[inner.children.length - 1].rotation.z = -Math.PI / 2
  inner.add(kit.cyl(0.012, 0.012, M.hole, [H / 2 - 0.026, 0, 0], 'x', { seg: 16 }))
  const out = holdOrRest(inner, p, ctx, 0.3)
  if (!out.userData.world) {
    inner.rotation.z = Math.PI / 2
  } else if (p.hands || p.hand) {
    // In the hands the keg keeps the world axis asked for, not the line between the hands.
    inner.quaternion.copy(basis(p.dir ?? [1, 0, 0], p.up ?? [0, 1, 0]))
  }
  return out
}

/** Soft bag geometry: lofted along +Y from the base to a tied neck, with a slump and some dents. */
function sandbagGeo(r, h, seed = 3) {
  return cachedGeo(`sandbag${r}${h}${seed}`, () => {
    const rings = []
    const NY = 40
    const NA = 48
    for (let i = 0; i <= NY; i++) {
      const u = i / NY
      // Profile: flat bottom with a heavy belly, shoulders, then gathered tightly to the neck.
      const belly = Math.pow(Math.sin(Math.min(1, (u / 0.72) * 0.86 + 0.14) * Math.PI * 0.5), 0.5) * (1 - 0.42 * sstep2(0.3, 0.8, u))
      const neck = u < 0.78 ? 1 : lerp(1, 0.11, sstep2(0.78, 0.9, u))
      const flare = u > 0.92 ? lerp(0.11, 0.18, sstep2(0.92, 1, u)) : 0
      const rad = r * Math.max(belly * neck, flare)
      const y = h * u
      const ring = []
      for (let j = 0; j < NA; j++) {
        const a = (j / NA) * Math.PI * 2
        const dent = 1 + 0.03 * Math.sin(a * 3 + seed + u * 5) + 0.02 * Math.sin(a * 7 + seed * 2 + u * 11) + (u > 0.8 ? 0.14 * Math.sin(a * 9) * Math.min(1, (u - 0.8) * 8) : 0)
        const rr = rad * dent * (u < 0.1 ? Math.sqrt(1 - Math.pow(1 - u / 0.1, 2)) * 0.28 + 0.72 : 1)
        ring.push([rr * Math.cos(a), y, -rr * Math.sin(a) * 0.96])
      }
      rings.push(ring)
    }
    // Close both ends.
    rings.unshift(rings[0].map(([x, y, z]) => [x * 0.5, y, z * 0.5]))
    rings.unshift(rings[0].map(([x, y, z]) => [x * 0.01, y, z * 0.01]))
    rings.push(rings[rings.length - 1].map(([x, y, z]) => [x * 0.01, y, z * 0.01]))
    const g = loftGeo(rings)
    // UVs so the canvas weave lands on it.
    const uv = []
    const nr = rings.length
    for (let i = 0; i < nr; i++) for (let j = 0; j < NA; j++) uv.push(j / NA, i / nr)
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    return g
  })
}
const sstep2 = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

function loadingSandbag(p, ctx) {
  const r = (p.d ?? 0.46) / 2
  const h = p.h ?? 0.56
  const inner = group()
  const body = group()
  body.add(mesh(sandbagGeo(r, h), MS.canvas()))
  // Sewn seams up the sides and a rope tying the neck.
  for (const a of [40, 200]) {
    const seamPts = []
    for (let i = 3; i <= 28; i++) {
      const u = i / 40
      const belly = Math.pow(Math.sin(Math.min(1, (u / 0.72) * 0.86 + 0.14) * Math.PI * 0.5), 0.5) * (1 - 0.42 * sstep2(0.3, 0.8, u))
      const rad = r * belly * 1.012
      seamPts.push([rad * Math.cos(a * RAD), h * u, rad * Math.sin(a * RAD) * 0.96])
    }
    body.add(mesh(cachedGeo(`bagSeam${a}${r}${h}`, () => sweepGeo(seamPts, rectSection(0.006, 0.003, 0.001))), STEEL.ropeDark))
  }
  body.add(place(kit.torus(r * 0.125, 0.0085, STEEL.rope, [0, 0, 0], 'y', 24), [0, h * 0.885, 0]))
  body.add(place(kit.torus(r * 0.125, 0.0085, STEEL.rope, [0, 0, 0], 'y', 24), [0, h * 0.905, 0]))
  body.position.y = -h * 0.45
  inner.add(body)
  const out = holdOrRest(inner, p, ctx, h * 0.45)
  if (out.userData.world) inner.quaternion.copy(new Q4().setFromUnitVectors(new V3(0, 1, 0), vec(p.dir ?? [0, 1, 0]).normalize()))
  return out
}

function sandbagPlatform(p) {
  const h = p.height ?? 1.2
  const w = p.width ?? 1.2
  const d = p.depth ?? 0.6
  const g = group()
  const t = 0.06
  const hx = w / 2 - t / 2
  const hz = d / 2 - t / 2
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      g.add(beam([sx * hx, 0, sz * hz], [sx * hx, h - 0.05, sz * hz], t, t, STEEL.paint, { r: 0.006, caps: false }))
      g.add(kit.rbox(t + 0.024, 0.012, t + 0.024, 0.002, STEEL.paintDark, [sx * hx, 0.006, sz * hz], 1))
      g.add(weld([sx * hx, 0.014, sz * hz], [0, 1, 0], t, t))
      g.add(weld([sx * hx, 0.228, sz * hz], [0, 1, 0], t, t))
    }
    // Side frames and their diagonals.
    g.add(beam([sx * hx, h - 0.09, -hz], [sx * hx, h - 0.09, hz], 0.05, t, STEEL.paint, { r: 0.005 }))
    g.add(beam([sx * hx, 0.2, -hz], [sx * hx, 0.2, hz], 0.05, 0.05, STEEL.paint, { r: 0.005 }))
    g.add(beam([sx * hx, 0.22, -hz], [sx * hx, h - 0.11, hz], 0.04, 0.04, STEEL.paintLight, { r: 0.004, side: [1, 0, 0] }))
  }
  for (const sz of [-1, 1]) {
    g.add(beam([-hx, h - 0.09, sz * hz], [hx, h - 0.09, sz * hz], t, 0.05, STEEL.paint, { r: 0.005, side: [0, 1, 0] }))
    g.add(beam([-hx, 0.2, sz * hz], [hx, 0.2, sz * hz], 0.05, 0.05, STEEL.paint, { r: 0.005, side: [0, 0, 1] }))
  }
  // Deck of planks.
  const n = 5
  const pw = (d + 0.04) / n
  for (let i = 0; i < n; i++) g.add(kit.rbox(w + 0.04, 0.04, pw - 0.006, 0.004, MS.plank(), [0, h - 0.02, -d / 2 - 0.02 + (i + 0.5) * pw], 2))
  return g
}

/* ---------------------------------------- car deadlift, conan's wheel, rickshaw, circus dumbbell ---------------------------------------- */

/** A simplified hatchback. Local: front at +Z, ground at y 0, 3.6 long, 1.62 wide, 1.45 tall. Front axle z 1.25, rear axle z -1.2. */
function carBody() {
  const g = group()
  const W = 1.62
  // Lower body: one side profile, softened by a wide bevel. The wheel arches are part of the outline, arcs cut up from the sill.
  const profile = []
  const cutArch = (zc, list) => {
    for (let i = 0; i <= 20; i++) {
      const a = Math.PI - (i / 20) * Math.PI
      list.push([zc + 0.345 * Math.cos(a), 0.3 + 0.345 * Math.sin(a)])
    }
  }
  const low = 0.26
  profile.push([-1.82, low])
  cutArch(-1.2, profile)
  cutArch(1.25, profile)
  profile.push([1.8, low])
  const top = roundPoly([[1.82, 0.56, 0.08], [1.76, 0.72, 0.1], [0.84, 0.92, 0.2], [-1.66, 0.96, 0.12], [-1.84, 0.82, 0.1], [-1.84, 0.5, 0.06]], 0, 7)
  const outline = [...profile, ...top]
  g.add(slab(outline, W, STEEL.carBody, [0, 0, 0], { plane: 'zy', bevel: 0.09, bevelSeg: 6, crease: 30 }))
  // Cabin: a narrower greenhouse with rounded shoulders, glass on the sides and ends.
  const cabin = roundPoly([[-1.62, 0.93, 0.05], [-1.42, 1.42, 0.14], [0.08, 1.45, 0.16], [0.86, 0.93, 0.05]], 0, 8)
  g.add(slab(cabin, W - 0.2, STEEL.carBody, [0, 0, 0], { plane: 'zy', bevel: 0.08, bevelSeg: 5, crease: 30 }))
  // Side windows.
  const win = roundPoly([[-1.34, 0.98, 0.03], [-1.2, 1.32, 0.06], [-0.1, 1.34, 0.05], [0.0, 1.335, 0.03], [0.6, 0.98, 0.03]], 0, 5)
  for (const s of [-1, 1]) {
    g.add(slab(win, 0.006, STEEL.glass, [s * (W / 2 - 0.1), 0, 0], { plane: 'zy', bevel: 0.001, bevelSeg: 1 }))
    g.add(beam([s * (W / 2 - 0.098), 0.98, -0.42], [s * (W / 2 - 0.098), 1.33, -0.42], 0.012, 0.05, STEEL.carTrim, { r: 0.002, side: [1, 0, 0] }))
    // Door seams and handles, wheel arch lips, sills.
    g.add(place(kit.rbox(0.006, 0.6, 0.008, 0.002, STEEL.carTrim, [0, 0, 0], 1), [s * (W / 2 + 0.0005), 0.62, -0.42]))
    g.add(place(kit.rbox(0.006, 0.56, 0.008, 0.002, STEEL.carTrim, [0, 0, 0], 1), [s * (W / 2 + 0.0005), 0.64, 0.68]))
    g.add(place(kit.rbox(0.014, 0.024, 0.13, 0.008, STEEL.carTrim, [0, 0, 0], 2), [s * (W / 2 + 0.003), 0.8, -0.15]))
    g.add(place(kit.rbox(0.014, 0.024, 0.13, 0.008, STEEL.carTrim, [0, 0, 0], 2), [s * (W / 2 + 0.003), 0.8, 0.48]))
    g.add(kit.rbox(0.02, 0.05, 1.5, 0.01, STEEL.carTrim, [s * (W / 2 + 0.001), 0.3, 0.02], 2))
  }
  // Windscreen and rear screen, as sloped dark panels.
  const screen = (z0, y0, z1, y1) => {
    const a = new V3(0, y0, z0)
    const b = new V3(0, y1, z1)
    const o = kit.rbox(W - 0.46, a.distanceTo(b), 0.012, 0.03, STEEL.glass, [0, 0, 0], 2)
    o.position.copy(a).lerp(b, 0.5)
    o.quaternion.setFromUnitVectors(new V3(0, 1, 0), b.clone().sub(a).normalize())
    return o
  }
  g.add(screen(0.88, 0.98, 0.17, 1.38))
  g.add(screen(-1.62, 0.98, -1.44, 1.38))
  // Wheels.
  for (const z of [-1.2, 1.25]) {
    for (const s of [-1, 1]) {
      const x = s * (W / 2 - 0.1)
      g.add(latheHard([[0.18, -0.095], [0.28, -0.095], [0.3, -0.08], [0.3, 0.08], [0.28, 0.095], [0.18, 0.095]], STEEL.bumper, [x, 0.3, z], 'x', 56, 0.004))
      g.add(latheHard([[0, s * -0.1], [0.18, s * -0.1], [0.182, s * -0.085], [0.18, s * 0.095], [0.1, s * 0.09], [0.05, s * 0.1], [0, s * 0.1]], STEEL.shaft, [x, 0.3, z], 'x', 40, 0.003))
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2
        const spoke = kit.rbox(0.008, 0.11, 0.05, 0.004, STEEL.paintDark, [x + s * 0.096, 0.3 + 0.1 * Math.cos(a), z + 0.1 * Math.sin(a)], 1)
        spoke.rotation.x = a
        g.add(spoke)
      }
    }
  }
  // Headlights, grille, tail lights, bumpers.
  for (const s of [-1, 1]) {
    g.add(place(kit.rbox(0.34, 0.1, 0.05, 0.03, STEEL.lamp, [0, 0, 0], 3), [s * 0.5, 0.68, 1.79]))
    g.add(place(kit.rbox(0.3, 0.1, 0.04, 0.02, STEEL.carTrim, [0, 0, 0], 2), [s * 0.5, 0.74, -1.83]))
    g.add(place(kit.rbox(0.24, 0.08, 0.04, 0.02, STEEL.lamp, [0, 0, 0], 2), [s * 0.5, 0.74, -1.85]))
  }
  g.add(place(kit.rbox(0.5, 0.14, 0.03, 0.02, STEEL.carTrim, [0, 0, 0], 2), [0, 0.46, 1.81]))
  g.add(place(kit.rbox(W - 0.1, 0.12, 0.08, 0.05, STEEL.carTrim, [0, 0, 0], 3), [0, 0.32, 1.8]))
  g.add(place(kit.rbox(W - 0.1, 0.12, 0.08, 0.05, STEEL.carTrim, [0, 0, 0], 3), [0, 0.34, -1.83]))
  return g
}

function carDeadlift(p, ctx) {
  const pivotZ = -3.6
  const pivotY = 0.11
  const hY = 0.44
  let lift = p.lift ?? 0
  if (p.hands && ctx && ctx.hands) lift = Math.max(0, (ctx.hands.L.centre[1] + ctx.hands.R.centre[1]) / 2 - hY)
  const armL = -pivotZ
  const ang = Math.atan2(lift, armL)
  const content = group()
  const far = group()
  far.userData.frameIgnore = !p.carInFrame
  const railY = pivotY
  for (const s of [-1, 1]) {
    const x = s * 0.62
    // Lever rails: from the pivot forward past the car's front wheels, then narrowing to the handles.
    far.add(beam([x, railY, pivotZ], [x, railY, -0.62], 0.1, 0.12, STEEL.paint, { r: 0.008 }))
    content.add(rectPipe([[x, railY, -0.62], [s * 0.32, railY, -0.2], [s * 0.32, railY, 0.26]], 0.08, 0.1, STEEL.paint, { bend: 0.12, cr: 0.008, up: [0, 1, 0] }))
    content.add(kit.rbox(0.03, 0.03, 0.08, 0.004, M.rubberDark, [s * 0.32, railY - 0.055, 0.2], 1))
    // Handle: two risers and a knurled grip.
    content.add(beam([s * 0.32, railY + 0.04, -0.19], [s * 0.32, hY - 0.01, -0.19], 0.05, 0.05, STEEL.paintLight, { r: 0.005 }))
    content.add(beam([s * 0.32, railY + 0.04, 0.19], [s * 0.32, hY - 0.01, 0.19], 0.05, 0.05, STEEL.paintLight, { r: 0.005 }))
    for (const z of [-0.19, 0.19]) content.add(weld([s * 0.32, railY + 0.052, z], [0, 1, 0], 0.05, 0.05))
    content.add(latheHard([[0, -0.22], [0.021, -0.22], [0.021, 0.22], [0, 0.22]], STEEL.shaft, [s * 0.32, hY, 0], 'z', 24, 0.002))
    content.add(kit.cyl(0.022, 0.2, STEEL.knurl, [s * 0.32, hY, 0], 'z', { seg: 24 }))
    // The cradle the front wheel sits in.
    far.add(kit.rbox(0.3, 0.012, 0.7, 0.003, STEEL.paintDark, [x + s * 0.09, railY + 0.066, -1.15], 1))
    far.add(beam([x + s * 0.09, railY + 0.07, -1.5], [x + s * 0.09, railY + 0.135, -1.56], 0.28, 0.016, STEEL.paintLight, { r: 0.003 }))
    far.add(beam([x + s * 0.09, railY + 0.07, -0.8], [x + s * 0.09, railY + 0.135, -0.74], 0.28, 0.016, STEEL.paintLight, { r: 0.003 }))
    // Pivot bearing.
    far.add(kit.cyl(0.07, 0.14, STEEL.paintLight, [x, railY, pivotZ], 'x', { seg: 32 }))
  }
  // Cross members.
  for (const z of [-3.3, -2.3, -1.15]) far.add(beam([-0.62, railY, z], [0.62, railY, z], 0.08, 0.1, STEEL.paint, { r: 0.006, side: [0, 0, 1] }))
  content.add(beam([-0.32, railY, -0.1], [0.32, railY, -0.1], 0.06, 0.08, STEEL.paint, { r: 0.006, side: [0, 0, 1] }))
  content.add(far)
  content.position.set(0, -pivotY, -pivotZ)
  const moving = group(content)
  if (p.car !== false) {
    // The car turns with the frame, its rear tyres on the floor at the pivot, its front tyres in the cradle.
    const car = carBody()
    const cradleTop = railY + 0.072
    const pitch0 = Math.atan2(cradleTop, 2.45)
    const carWrap = group(car)
    car.position.z = 1.2 // rear axle at the wrap's origin
    carWrap.position.set(0, -pivotY, 0)
    carWrap.rotation.x = -pitch0
    carWrap.userData.frameIgnore = !p.carInFrame
    moving.add(carWrap)
  }
  place(moving, [0, pivotY, pivotZ])
  moving.rotation.x = -ang
  const out = group(moving)
  // The fixed foot of the pivot, on the floor.
  const anchor = group()
  anchor.userData.frameIgnore = !p.carInFrame
  for (const s of [-1, 1]) {
    const foot = roundPoly([[pivotZ - 0.2, 0, 0.005], [pivotZ + 0.2, 0, 0.005], [pivotZ + 0.06, 0.16, 0.02], [pivotZ - 0.06, 0.16, 0.02]], 0, 3)
    anchor.add(slab(foot, 0.05, STEEL.paintDark, [s * 0.71, 0, 0], { plane: 'zy', bevel: 0.005, bevelSeg: 1 }))
  }
  out.add(anchor)
  return out
}

function conansWheel(p, ctx) {
  const g = group()
  g.userData.world = true
  const pos = vec(p.pos || [0, 0, 0])
  const hub = pos.clone()
  hub.y = p.height ?? 0.82
  // Base and post.
  g.add(kit.rbox(0.8, 0.02, 0.8, 0.004, STEEL.paintDark, [pos.x, 0.01, pos.z], 1))
  g.add(beam([pos.x, 0.02, pos.z], [pos.x, hub.y - 0.06, pos.z], 0.12, 0.12, STEEL.paint, { r: 0.008, side: [1, 0, 0] }))
  for (const a of [0, 90, 180, 270]) {
    const c = Math.cos(a * RAD)
    const s = Math.sin(a * RAD)
    g.add(pipe([[pos.x + 0.06 * c, 0.3, pos.z + 0.06 * s], [pos.x + 0.36 * c, 0.03, pos.z + 0.36 * s]], 0.016, STEEL.paint, { bend: 0, seg: 12 }))
  }
  // Rotating head on the post.
  g.add(latheHard([[0, -0.05], [0.09, -0.05], [0.09, 0.05], [0, 0.05]], STEEL.paintLight, [hub.x, hub.y - 0.03, hub.z], 'y', 36, 0.004))
  // Where the beam goes.
  let crook
  if (p.follow && ctx && ctx.joints) {
    const a = vec(ctx.joints['lowerarm01.L'])
    const b = vec(ctx.joints['lowerarm01.R'])
    crook = a.add(b).multiplyScalar(0.5)
    crook.y -= 0.005
  } else {
    crook = hub.clone().add(new V3(p.arm ?? 2.4, 0.2, 0))
  }
  const dir = crook.clone().sub(hub)
  const L = dir.length()
  dir.normalize()
  const tip = crook.clone().addScaledVector(dir, 0.28)
  g.add(pipe([hub.toArray(), tip.toArray()], 0.03, STEEL.paint, { bend: 0, seg: 22 }))
  // Pad where the arms hold it.
  g.add(pipe([crook.clone().addScaledVector(dir, -0.26).toArray(), crook.clone().addScaledVector(dir, 0.26).toArray()], 0.04, M.pad, { bend: 0, seg: 22 }))
  g.add(kit.sphere(0.031, M.rubberDark, tip.toArray(), 16))
  // The hinge at the hub.
  g.add(place(kit.cyl(0.05, 0.14, STEEL.paintLight, [0, 0, 0], 'y', { seg: 28 }), hub.toArray()))
  g.children[g.children.length - 1].quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3(-dir.z, 0, dir.x).normalize())
  // Load on the beam: plates on a sleeve across it.
  const load = group()
  for (const s of [-1, 1]) load.add(loadedSleeve(s, 0.05, 0.3, p.plates ?? 2, { r: 0.025 }))
  load.add(kit.rbox(0.1, 0.1, 0.1, 0.01, STEEL.paintLight, [0, 0, 0], 2))
  const at = hub.clone().addScaledVector(dir, Math.min(0.6, L * 0.3))
  load.position.copy(at)
  const side = new V3(-dir.z, 0, dir.x).normalize()
  load.quaternion.copy(basis(side, new V3(0, 1, 0)))
  g.add(load)
  return g
}

function rickshaw(p, ctx) {
  const n = p.plates ?? 2
  const inner = group()
  const hY = 0.44
  const hx = 0.47
  const zF = 0.34
  const zB = -0.74
  for (const s of [-1, 1]) {
    const x = s * hx
    // Side frame: welded rectangle of square tube.
    inner.add(beam([x, 0.06, zB], [x, 0.06, zF], 0.06, 0.06, STEEL.paint, { r: 0.006 }))
    inner.add(beam([x, 0.5, zB], [x, 0.5, zF], 0.06, 0.06, STEEL.paint, { r: 0.006 }))
    inner.add(beam([x, 0.06, zF - 0.03], [x, 0.5, zF - 0.03], 0.06, 0.06, STEEL.paint, { r: 0.006 }))
    inner.add(beam([x, 0.06, zB + 0.03], [x, 0.5, zB + 0.03], 0.06, 0.06, STEEL.paint, { r: 0.006 }))
    for (const z of [zF - 0.03, zB + 0.03]) {
      inner.add(weld([x, 0.092, z], [0, 1, 0], 0.06, 0.06))
      inner.add(weld([x, 0.468, z], [0, 1, 0], 0.06, 0.06))
    }
    // The handle hangs off the side frame by two lugs, inside, with a knurled grip.
    const gx = s * 0.36
    inner.add(latheHard([[0, -0.16], [0.02, -0.16], [0.02, 0.16], [0, 0.16]], STEEL.shaft, [gx, hY, 0], 'z', 24, 0.002))
    inner.add(kit.cyl(0.0208, 0.16, STEEL.knurl, [gx, hY, 0], 'z', { seg: 24 }))
    for (const z of [-0.15, 0.15]) inner.add(beam([gx, hY, z], [x, 0.5, z], 0.03, 0.04, STEEL.paintLight, { r: 0.004 }))
    // Plate horn pointing outward, behind the hands.
    const peg = group()
    peg.add(latheHard([[0, -0.15], [0.025, -0.15], [0.025, 0.15], [0, 0.15]], STEEL.sleeve, [s * 0.15, 0, 0], 'x', 24, 0.002))
    peg.add(latheHard([[0, -0.009], [0.052, -0.009], [0.052, 0.009], [0, 0.009]], STEEL.paintLight, [s * 0.009, 0, 0], 'x', 28, 0.002))
    let px = 0.02
    for (let i = 0; i < n; i++) {
      peg.add(plate(0.45, 0.05, [s * (px + 0.025), 0, 0], 'x', 'bumper'))
      px += 0.051
    }
    peg.add(collar(s * (px + 0.012), 0.025))
    place(peg, [x + s * 0.03, 0.26, -0.26])
    inner.add(peg)
    // Rollers at the rear so it can be walked with.
    inner.add(transportWheel(x, 0.05, zB - 0.04, 0.05, 0.03))
  }
  // Rear cross members; the front stays open for the legs to step through.
  inner.add(beam([-hx, 0.5, zB + 0.03], [hx, 0.5, zB + 0.03], 0.06, 0.06, STEEL.paint, { r: 0.006, side: [0, 0, 1] }))
  inner.add(beam([-hx, 0.06, zB + 0.03], [hx, 0.06, zB + 0.03], 0.06, 0.06, STEEL.paint, { r: 0.006, side: [0, 0, 1] }))
  // A diagonal tie, to show it is a welded frame.
  inner.add(beam([-hx, 0.09, zB + 0.03], [hx, 0.47, zB + 0.03], 0.04, 0.03, STEEL.paintLight, { r: 0.004, side: [0, 0, 1] }))
  inner.position.y = p.lift ?? 0
  if (p.hands && ctx && ctx.hands) {
    const mid = localFrame(p).pt(vec(ctx.hands.L.centre).add(vec(ctx.hands.R.centre)).multiplyScalar(0.5))
    inner.position.set(mid.x, Math.max(0, mid.y - hY), mid.z)
  }
  return group(inner)
}

function circusDumbbell(p, ctx) {
  const d = p.d ?? 0.27
  const R = d / 2
  const inner = group()
  const hw = 0.12 + R * 0.92
  inner.add(latheHard([[0, -hw], [0.03, -hw], [0.03, hw], [0, hw]], STEEL.iron, [0, 0, 0], 'x', 32, 0.002))
  inner.add(kit.cyl(0.0305, 0.2, STEEL.knurl, [0, 0, 0], 'x', { seg: 28 }))
  for (const s of [-1, 1]) {
    // A cast head: slightly flattened where the handle enters, a filler plug on the outer end.
    const head = cachedGeo(`circusHead${d}`, () => {
      const prof = [[0, -R * 0.97]]
      for (let i = 1; i < 40; i++) {
        const a = -Math.PI / 2 + (i / 40) * Math.PI
        prof.push([R * Math.cos(a), R * Math.sin(a)])
      }
      prof.push([0, R])
      return new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 72)
    })
    const o = mesh(head, STEEL.iron)
    o.rotation.z = Math.PI / 2
    o.position.x = s * (0.12 + R)
    inner.add(o)
    inner.add(latheHard([[0, -0.006], [0.042, -0.006], [0.042, 0.004], [0, 0.008]], STEEL.ironEdge, [s * (0.12 + 2 * R - 0.001), 0, 0], 'x', 32, 0.002))
    inner.children[inner.children.length - 1].rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2
    inner.add(latheHard([[0.03, -0.006], [0.062, -0.006], [0.062, 0.006], [0.03, 0.006]], STEEL.ironEdge, [s * (0.12 + 0.005), 0, 0], 'x', 32, 0.002))
    // The casting seam around the head.
    inner.add(place(kit.torus(R + 0.0002, 0.002, STEEL.ironEdge, [0, 0, 0], 'x', 64), [s * (0.12 + R), 0, 0]))
  }
  return holdOrRest(inner, p, ctx, R)
}

function strongmanAxe(p, ctx) {
  const L = p.length ?? 0.8
  const inner = group()
  const x1 = L - 0.12
  // A slightly oval ash handle with a rubber grip around the hand.
  inner.add(pipe([[-0.1, 0, 0], [x1 + 0.06, 0, 0]], 0.0165, MS.plank(), { bend: 0, seg: 18, ry: 0.0145, up: [0, 0, 1] }))
  inner.add(pipe([[-0.1, 0, 0], [0.12, 0, 0]], 0.0185, M.grip, { bend: 0, seg: 18, ry: 0.0165, up: [0, 0, 1] }))
  inner.add(kit.sphere(0.0195, M.rubberDark, [-0.1, 0, 0], 14))
  // The head: a steel eye around the handle, a wedge blade one way, a short poll the other.
  const head = group()
  head.add(kit.rbox(0.1, 0.075, 0.05, 0.008, STEEL.paintDark, [0, 0, 0], 2))
  const blade = roundPoly([[-0.05, -0.03, 0.002], [0.05, -0.03, 0.002], [0.1, -0.2, 0.006], [-0.075, -0.2, 0.006]], 0, 2)
  head.add(slab(blade, 0.03, STEEL.stainless, [0, 0, 0], { plane: 'xy', bevel: 0.0145, bevelSeg: 1, crease: 25 }))
  head.add(kit.rbox(0.085, 0.045, 0.045, 0.006, STEEL.paintDark, [0, 0.05, 0], 2))
  head.position.set(x1, 0, 0)
  if (p.flip) head.rotation.x = Math.PI
  inner.add(head)
  const out = group(inner)
  if (p.hand && ctx && ctx.hands) {
    const h = ctx.hands[p.hand]
    const o = vec(h.centre)
    inner.quaternion.copy(basis(vec(h.thumb), vec(h.wrist).sub(o)))
    inner.position.copy(o)
    out.userData.world = true
  } else if (p.at) {
    inner.quaternion.copy(basis(p.dir ?? [1, 0, 0], p.up ?? [0, 1, 0]))
    inner.position.copy(vec(p.at))
    out.userData.world = true
  } else {
    inner.position.y = 0.2
    inner.rotation.x = Math.PI / 2
  }
  return out
}

/* ---------------------------------------- power stairs ---------------------------------------- */

function powerStairs(p) {
  const n = p.steps ?? 3
  const rise = p.rise ?? 0.42
  const run = p.run ?? 0.6
  const w = p.width ?? 1.1
  const g = group()
  for (let k = 0; k < n; k++) {
    const h = (k + 1) * rise
    const z0 = k * run
    const z1 = (k + 1) * run
    const wood = MS.ply()
    g.add(kit.rbox(w, h - 0.03, 0.022, 0.003, wood, [0, (h - 0.03) / 2, z0 + 0.011], 2))
    for (const s of [-1, 1]) {
      g.add(kit.rbox(0.022, h - 0.03, z1 - z0 - 0.022, 0.003, wood, [s * (w / 2 - 0.011), (h - 0.03) / 2, (z0 + z1) / 2 + 0.011], 2))
    }
    g.add(kit.rbox(w + 0.03, 0.03, run + 0.03, 0.005, MS.plank(), [0, h - 0.015, (z0 + z1) / 2], 2))
    if (k === n - 1) g.add(kit.rbox(w, h - 0.03, 0.022, 0.003, wood, [0, (h - 0.03) / 2, z1 - 0.011], 2))
    // A steel nosing that takes the implement's blows.
    g.add(kit.rbox(w + 0.03, 0.014, 0.03, 0.002, STEEL.paintLight, [0, h + 0.0005, z0 - 0.002], 1))
    // Steel angle on the outer corners, screwed on: these boxes take heavy blows.
    for (const sx of [-1, 1]) {
      g.add(kit.rbox(0.03, h - 0.03, 0.03, 0.002, STEEL.paintDark, [sx * (w / 2 - 0.01), (h - 0.03) / 2, z0 + 0.008], 1))
      for (let i = 0; i < Math.max(2, k + 2); i++) g.add(bolt([sx * (w / 2 - 0.01), 0.06 + (i * (h - 0.13)) / Math.max(1, k + 1), z0 - 0.0075], 'z', 0.005, STEEL.sleeve).rotateX(Math.PI))
    }
  }
  return g
}

function powerStairsWeight(p, ctx) {
  const n = p.plates ?? 2
  const inner = group()
  const H = 0.56
  inner.add(latheHard([[0, -0.15], [0.021, -0.15], [0.021, 0.15], [0, 0.15]], STEEL.shaft, [0, 0, 0], 'x', 24, 0.002))
  inner.add(kit.cyl(0.0218, 0.2, STEEL.knurl, [0, 0, 0], 'x', { seg: 24 }))
  // Post and skid.
  inner.add(beam([0, -0.015, 0], [0, -H + 0.02, 0], 0.07, 0.07, STEEL.paint, { r: 0.007 }))
  inner.add(kit.rbox(0.36, 0.02, 0.26, 0.004, STEEL.paintDark, [0, -H + 0.01, 0], 1))
  for (const s of [-1, 1]) {
    const gus = roundPoly([[-0.035 * s, -H + 0.02, 0.003], [-0.14 * s, -H + 0.02, 0.003], [-0.035 * s, -H + 0.15, 0.003]], 0, 1)
    inner.add(slab(gus, 0.01, STEEL.paintLight, [0, 0, 0], { plane: 'xy', bevel: 0.002, bevelSeg: 1 }))
    // Plates on a horn across the post.
    const peg = group()
    peg.add(latheHard([[0, -0.08], [0.025, -0.08], [0.025, 0.08], [0, 0.08]], STEEL.sleeve, [0, 0, s * 0.08 + s * 0.035], 'z', 24, 0.002))
    let z = 0.04
    for (let i = 0; i < n; i++) {
      peg.add(plate(0.325, 0.05, [0, 0, s * (z + 0.025)], 'z', 'iron'))
      z += 0.051
    }
    place(peg, [0, -H + 0.2, 0])
    inner.add(peg)
  }
  const out = group(inner)
  if (p.hands && ctx && ctx.hands) {
    const cl = vec(ctx.hands.L.centre)
    const cr = vec(ctx.hands.R.centre)
    const o = cl.clone().add(cr).multiplyScalar(0.5)
    const x = cl.clone().sub(cr)
    x.y = 0
    inner.quaternion.copy(basis(x.lengthSq() > 1e-4 ? x : new V3(1, 0, 0), new V3(0, 1, 0)))
    inner.position.copy(o)
    out.userData.world = true
  } else if (p.at) {
    inner.position.copy(vec(p.at))
    out.userData.world = true
  } else {
    inner.position.y = H
  }
  return out
}

/* ---------------------------------------- battling ropes, heavy bag ---------------------------------------- */

function battlingRopes(p, ctx) {
  const g = group()
  g.userData.world = true
  const anchor = vec(p.anchor ?? [0, 0.03, 3.4])
  const r = p.r ?? 0.019
  const amp = p.amp ?? 0.34
  const lam = p.wavelength ?? 1.25
  const phase = p.phase ?? 0
  // Anchor: a floor plate with a steel eye, the rope's loop passing through it.
  g.add(kit.rbox(0.26, 0.012, 0.2, 0.003, STEEL.paintDark, [anchor.x, 0.006, anchor.z + 0.02], 1))
  for (const s of [-1, 1]) for (const f of [-1, 1]) g.add(bolt([anchor.x + s * 0.1, 0.012, anchor.z + 0.02 + f * 0.07], 'y', 0.008, STEEL.sleeve))
  g.add(place(kit.torus(0.05, 0.009, STEEL.sleeve, [0, 0, 0], 'z', 32), [anchor.x, 0.058, anchor.z + 0.02]))
  const hands = ctx && ctx.hands ? ctx.hands : {
    L: { centre: [anchor.x + 0.26, 0.95, anchor.z - 3.25], thumb: [0, 0, 1] },
    R: { centre: [anchor.x - 0.26, 0.95, anchor.z - 3.25], thumb: [0, 0, 1] },
  }
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const h = hands[side]
    const c = vec(h.centre)
    const t = vec(h.thumb).normalize()
    // Point where the rope leaves the fist, and where it reaches the anchor's loop.
    const start = c.clone().addScaledVector(t, 0.06)
    const end = new V3(anchor.x + s * 0.052, 0.05, anchor.z + 0.02)
    const pts = []
    const D = end.clone().sub(start)
    const horizontal = Math.hypot(D.x, D.z)
    const N = Math.max(60, Math.round(horizontal * 32))
    const off = s > 0 ? 0 : p.sync ? 0 : 0.5
    for (let i = 0; i <= N; i++) {
      const u = i / N
      const sAlong = u * horizontal
      // Along the floor: a straight line from hand to anchor, in plan.
      const x = start.x + D.x * u
      const z = start.z + D.z * u
      // The wave: strongest in the first metres, dying toward the anchor.
      const env = Math.min(1, sAlong / 0.25) * Math.pow(1 - u, 0.72)
      const wave = amp * env * (0.5 + 0.5 * Math.sin(2 * Math.PI * (sAlong / lam - phase - off)))
      // The hand holds the rope up: its height falls off fast, then the rope lies along the floor.
      const carry = start.y * Math.exp(-Math.pow(sAlong / 0.85, 1.7))
      const y = Math.max(r, carry + wave + r * (1 - u) + end.y * u * u * u)
      // A little lateral snake.
      const lat = 0.04 * env * Math.sin(2 * Math.PI * (sAlong / (lam * 1.6) - phase - off))
      pts.push(new V3(x + lat, y, z))
    }
    // Into the fist and out behind it.
    const tail = c.clone().addScaledVector(t, -0.14)
    const path = [tail, c.clone(), ...pts]
    const curve = new THREE.CatmullRomCurve3(path, false, 'centripetal')
    const samples = curve.getPoints(Math.max(120, N * 3))
    g.add(mesh(ropeGeo(samples, r, { pitch: 0.11, seg: 16, depth: 0.16 }), STEEL.rope))
    // Tape on the end.
    const tapeEnd = c.clone().addScaledVector(t, 0.1)
    g.add(pipe([tail.clone().addScaledVector(t, -0.002).toArray(), tapeEnd.toArray()], r + 0.0025, STEEL.tape, { bend: 0, seg: 16 }))
    // The rope's loop at the anchor.
    g.add(mesh(ropeGeo(smooth([[anchor.x + s * 0.052, 0.05, anchor.z + 0.02], [anchor.x + s * 0.03, 0.09, anchor.z + 0.06], [anchor.x, 0.1, anchor.z + 0.07]], 20), r, { pitch: 0.11, seg: 16, depth: 0.16 }), STEEL.rope))
  }
  return g
}

function heavyBag(p, ctx) {
  const d = p.d ?? 0.36
  const R = d / 2
  const len = p.len ?? 1.15
  const ay = p.anchorY ?? 2.45
  const chainL = 0.55
  const g = group()
  let swingX = (p.swing ?? 0) * RAD
  let swingDir = new V3(0, 0, 1)
  const local = localFrame(p)
  if (p.hand && ctx && ctx.hands) {
    const h = local.pt(ctx.hands[p.hand].centre)
    const horizontal = new V3(h.x, 0, h.z)
    const D = horizontal.length()
    if (D > 1e-4) swingDir = horizontal.clone().multiplyScalar(-1 / D)
    const drop = ay - h.y
    swingX = D < R ? Math.atan2(R - D, Math.max(0.2, drop)) : 0
  }
  // Overhead mount: a beam stub and eye bolt, fixed.
  if (p.mount !== false) {
    g.add(beam([-0.5, ay + 0.1, 0], [0.5, ay + 0.1, 0], 0.08, 0.14, STEEL.paint, { r: 0.008, side: [0, 0, 1], caps: true }))
    g.add(kit.lathe([[0, 0], [0.012, 0], [0.012, 0.03], [0, 0.03]], STEEL.sleeve, [0, ay, 0], 'y', 12))
  }
  const swinger = group()
  // The bag, hanging down from the swivel at the anchor. Local Y runs up along its axis.
  const top = -chainL
  // Swivel and ring.
  swinger.add(place(kit.torus(0.026, 0.006, STEEL.sleeve, [0, 0, 0], 'x', 24), [0, -0.04, 0]))
  swinger.add(kit.lathe([[0, -0.02], [0.014, -0.02], [0.018, -0.008], [0.018, 0.008], [0.014, 0.02], [0, 0.02]], STEEL.sleeve, [0, -0.09, 0], 'y', 16))
  // Chains: four, from the ring to the D rings at the bag's top.
  const links = (a, b) => {
    const A = vec(a)
    const B = vec(b)
    const dir = B.clone().sub(A)
    const L = dir.length()
    dir.normalize()
    const out = group()
    const n = Math.round(L / 0.022)
    const geo = cachedGeo('bagLink', () => {
      const gg = new THREE.TorusGeometry(0.0085, 0.0022, 8, 14)
      gg.scale(1.4, 1, 1)
      return gg
    })
    const q0 = new Q4().setFromUnitVectors(new V3(1, 0, 0), dir)
    const tw = new Q4().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2)
    for (let i = 0; i < n; i++) {
      const o = mesh(geo, STEEL.shaft)
      o.position.copy(A).addScaledVector(dir, ((i + 0.5) / n) * L)
      o.quaternion.copy(q0)
      if (i % 2) o.quaternion.multiply(tw)
      out.add(o)
    }
    return out
  }
  for (const a of [45, 135, 225, 315]) {
    const x = (R - 0.035) * Math.cos(a * RAD)
    const z = (R - 0.035) * Math.sin(a * RAD)
    swinger.add(links([0, -0.11, 0], [x, top - 0.008, z]))
    swinger.add(place(kit.torus(0.015, 0.0035, STEEL.sleeve, [0, 0, 0], 'y', 16), [x, top - 0.012, z]))
  }
  // Body: a tall cylinder with rounded ends, seams and reinforced straps at the top.
  const prof = [[0, -len], [R - 0.05, -len], [R - 0.02, -len + 0.01], [R - 0.005, -len + 0.035], [R, -len + 0.07], [R, -0.07], [R - 0.005, -0.035], [R - 0.02, -0.01], [R - 0.05, 0], [0, 0]]
  const body = kit.lathe(prof, MS.bagVinyl(), [0, top, 0], 'y', 72)
  swinger.add(body)
  // Leather caps, darker, on both ends: they also stop the top glaring under the key light.
  swinger.add(latheHard([[0, 0.002], [R - 0.05, 0.002], [R - 0.02, -0.008], [R - 0.004, -0.034], [R + 0.0015, -0.07]], STEEL.strap, [0, top, 0], 'y', 72, 0))
  swinger.add(latheHard([[R + 0.0015, -len + 0.07], [R - 0.004, -len + 0.034], [R - 0.02, -len + 0.008], [R - 0.05, -len - 0.002], [0, -len - 0.002]], STEEL.strap, [0, top, 0], 'y', 72, 0))
  // Stitched seam bands and vertical seams.
  for (const y of [-0.13, -len + 0.13]) swinger.add(latheHard([[R + 0.0012, -0.012], [R + 0.0012, 0.012]], STEEL.strap, [0, top + y, 0], 'y', 72, 0))
  for (const a of [0, 90, 180, 270]) {
    // Vertical seams and the straps that carry the D rings.
    const x = (R + 0.0006) * Math.cos(a * RAD)
    const z = (R + 0.0006) * Math.sin(a * RAD)
    const o = kit.box(0.005, len - 0.32, 0.005, STEEL.strap, [x, top - len / 2, z])
    o.rotation.y = -a * RAD
    swinger.add(o)
    const a2 = (a + 45) * RAD
    const sx = (R + 0.001) * Math.cos(a2)
    const sz = (R + 0.001) * Math.sin(a2)
    const strap = kit.rbox(0.004, 0.17, 0.04, 0.001, STEEL.strap, [sx, top - 0.085, sz], 1)
    strap.rotation.y = -a2
    swinger.add(strap)
  }
  swinger.position.set(0, ay, 0)
  // Tilt away from the hand: rotate about a horizontal axis through the anchor.
  const axis = new V3(0, 1, 0).cross(swingDir).normalize()
  swinger.quaternion.setFromAxisAngle(axis, -swingX)
  g.add(swinger)
  return g
}

export default {
  'atlas-stone': atlasStone,
  'atlas-platform': atlasPlatform,
  'atlas-trainer': atlasTrainer,
  'log-bar': logBar,
  'axle-bar': axleBar,
  'farmers-handle': farmersHandle,
  yoke,
  'tractor-tire': tractorTire,
  sled,
  prowler,
  'sled-straps': sledStraps,
  harness,
  keg,
  'loading-sandbag': loadingSandbag,
  'sandbag-platform': sandbagPlatform,
  'car-deadlift': carDeadlift,
  'conans-wheel': conansWheel,
  rickshaw,
  'circus-dumbbell': circusDumbbell,
  'strongman-axe': strongmanAxe,
  'power-stairs': powerStairs,
  'power-stairs-weight': powerStairsWeight,
  'battling-ropes': battlingRopes,
  'heavy-bag': heavyBag,
}
