// CABLE EQUIPMENT: tower, crossover, lat pulldown, seated row, seated press, floor pulley, pulley bracket, weight stack, and the cable with
// its attachments. Metres, Y up. Every builder here places itself (it returns a world-space group), so `pos` is the point on the floor named
// below and `yaw` (degrees) turns the whole thing around that point. All numbers below are at yaw 0. Worked examples: specs/_gallery/, the
// types' own names plus cable-rope, cable-ez, cable-v-bar, cable-angled-v-bar, cable-ankle-strap, seated-row-lying, seated-cable-press-incline
// and seated-cable-press-shoulder.
//
// HOW IT WORKS. Put hand / hands / foot / feet and `attachment` on the machine and it does the rest in every frame: the swivel pulley turns to
// face the load, the cable leaves the wheel on its true tangent and runs straight to the attachment's eye, the wheels turn by the cable's
// travel, the stack rises by exactly the cable it pays out, and the attachment sits on the solve report's hands. There is no cable to draw
// and nothing to compute:
//     {"type":"cable-tower","pos":[0,0,0.66],"yaw":180,"pulleyY":2.0,"hands":true,"attachment":"rope"}
// Keep machines in spec.props. No hand or foot key: a static machine, its attachment hanging idle under the pulley, or lying on the floor in
// front of it if the pulley is low (attachment or idle picks which, default d-handle; attachment:"none" leaves only the end of the cable).
//
// STACK RISE, per machine, first match wins:
//   lift    metres (number, or [L,R] on the crossover). For a machine in a frame's own `props`, where numbers interpolate.
//   rest    the cable length (pulley to the attachment's link) with the stack home: rise = (length - rest) * ratio.
//   neither the shortest cable length of the whole movement is home, plus 1.4 cm of tension. The normal case: write nothing. It needs the machine
//           in spec.props, because the renderer samples the whole movement before it draws.
//   ratio   rise per metre of cable. 0.5 on tower and crossover (2:1 routing), 1 on lat pulldown, seated row and seated press.
// pin: plates selected, default 7 (row 9). plates: default 20, 0.51 m tall. pinSide 1 or -1: the way the stack's wide face and selector pin look.
//
// ATTACHMENTS (the attachment key; the plan's names work too: single-handle, rope-attachment, straight-bar-attachment, ankle-cuff, ez-bar).
// Each sits on ctx.hands.X.centre with its grip along ctx.hands.X.thumb, so the hand's fingers and palm decide how it lies. Thumb = palm x fingers
// on the left hand, fingers x palm on the right.
//   d-handle       Stirrup. hand:"L"|"R", or hands:true for both hands on one handle (Pallof press). Grip radius 0.0165, sleeve 0.12 long. Its frame reaches
//                  0.145 from the grip's axis to the eye, in the plane of the grip and the pulley: keep the pulley off the forearm's line.
//   rope           hands:true. Two legs joined at a steel ball end, a stopper under each little finger. The rope leaves each fist on the side of the thumb
//                  nearer the ball (decided at the first frame; ropeFlip:true swaps it). ropeLeg: ball to hand, default 0.33: keep the hands closer than
//                  0.60. Grip radius 0.0135. hand:"L" makes it a single leg in one hand.
//   straight-bar   hands:true. barLength default 0.50, swivel at the middle between the hands. Grip radius 0.014. Keep the hand spacing constant.
//   lat-bar        hands:true. 1.20 long, straight within +-0.34 of the middle, the ends falling 22 degrees away from the pulley. Passes exactly through both
//                  hand centres at any spacing. Past +-0.34 the hand is on the slope: tilt its thumb 22 degrees with it, inward and up for a pronated grip
//                  (fingers [0.35,0.93,0.1], palm [0,-0.2,0.98], left hand). Inside +-0.34 is the knurled flat, for the closer grips. Grip radius 0.0145.
//   v-bar          hands:true. Close neutral handle: two parallel grips along the thumbs, chrome hoops to a swivel toward the pulley. Hand centres 0.12 to 0.17
//                  apart, palms facing, thumbs parallel. Grip radius 0.0155.
//   angled-v-bar   hands:true. The inverted V pushdown bar, arms falling 28 degrees from the apex: thumbs inward and up. Hand centres 0.14 to 0.30 apart. Radius 0.0135.
//   ez-attachment  hands:true. 0.60 long, its wave in the plane of the thumbs. Curl grip: hand centres 0.19 to 0.27 apart, palms up, thumbs outward and tilted
//                  30 degrees toward the palm side (fingers [0,-0.95,0.3], palm [-0.47,0.28,0.84], left hand, bar at the thighs). Grip radius 0.0135.
//   ankle-strap    foot:"L"|"R", or feet:true for both ankles on one carabiner. Padded cuff 8.5 cm above the ankle joint, fitted to the leg, its D ring toward the pulley.
//   none           Only the end of the cable: stop ball, ferrule, carabiner.
// The same names as prop types draw the attachment alone, with no pulley: single-handle, rope-attachment, straight-bar-attachment, lat-bar, v-bar, angled-v-bar,
// ez-attachment, ankle-cuff. {"type":"single-handle","hand":"L","dir":[0,-1,0]} has its eye toward dir, 0.145 from the grip's axis (chain press).
// {"type":"v-bar","hands":true,"dir":[0,1,0]}: its cross tube is 0.112 from the line between the hand centres, the part that sits on a pull-up bar. Add `from` and they
// get a cable.
//
// A hand that turns more than about 120 degrees between two key frames (any curl) needs a `mid` frame, or its fingers vector takes the short way around,
// backwards. specs/_gallery/cable-ez.json shows it.
//
// TYPES AND WHERE THE BODY GOES. Hand positions below are `pos` with contact:true, which puts the palm centre on the attachment's axis; once the
// hands take "grip", use the radius given above. For the figure's right hand negate x (and fingers.x, palm.x, pole.x).
//
// cable-tower   pos: floor under the track column, its front +Z. Column 0.08 square at the origin, stack at z -0.33, rear post at z -0.66, top plates to y 2.30 (height
//     changes it). Floor beam z -0.92 to 0.30, cross feet at both ends, x within +-0.33, 7 cm high: keep feet clear of them.
//     pulleyY: height of the wheel's centre, 0.14 (on the base) to 2.00 (above the head). Default 1.2. Use 0.2 low pulley, 1.0 waist, 1.4 chest, 2.0 high.
//     The swivel axis is at z 0.128, and the wheel (radius 0.055) sits 0.046 from it toward the load.
//     Facing the machine, soles at z: yaw 180, pos z + 0.66 (pushdown, curl, face pull, kneeling crunch).
//     Back to the machine, soles at z: yaw 0, pos z - 0.55 (overhead extension, front raise, pull-through).
//     Side on, machine at the figure's left (+X): yaw -90, pos x + 0.75. At its right: yaw 90, pos x - 0.75 (wood chop, Pallof press).
//     Holding the frame: palm on the column at local (0, y, 0.04) or (+-0.04, y, 0), palm vector into it, above or below the carriage, whose sleeve, 0.104 square,
//     spans pulleyY - 0.04 to pulleyY + 0.12. At yaw 180 with pos z 0.72 the palms are at world z 0.68: specs/_gallery/cable-ankle-strap.json.
//
// cable-crossover (cable-crossover-station)   pos: floor at the middle of the line between the two columns. The user faces +Z. functional-trainer is the same, narrower.
//     Two towers, swivel axes at x +-span/2, z 0.128, each running back to z -0.92. span default 2.40 (functional-trainer 1.70). Base feet to z 0.30 within +-0.33 of each
//     column. pulleyY: number or [L,R], default 2.00. L is the tower at +X, the figure's left. pin, lift, rest: number or [L,R].
//     Overhead: beams from column to column at z 0 and z -0.66, top at y 2.38. Pull-up bar at y 2.25, z 0.24, radius 0.016, knurled either side.
//     Figure at x 0, z 0.1 to 0.45, facing +Z (crossover: staggered feet). A bench goes between the towers along Z.
//     hands:true: a d-handle per hand, left hand to the +X tower. cross:true swaps the towers (rear delt fly, crossed pulldown). hand:"L" uses one tower, the other handle
//     hangs idle. attachment changes the kind, idle the idle one. feet / foot work the same with ankle straps.
//     left / right: {hand, foot, attachment, rest, lift} set one tower entirely, for anything else; add follow:true if nothing else marks it dynamic.
//
// lat-pulldown (lat-pulldown-station)   pos: floor under the middle of the seat. The sitter faces +Z, the stack ahead at z 0.98, upright at z 1.20, boom overhead.
//     seatH: top of the pad, default 0.48. Pad x +-0.18, z +-0.17. Floor beam along x 0, z -0.52 to 1.38: the legs straddle it.
//     Body: root.pos (0, seatH + 0.09, -0.02). Soles (+-0.13, 0, 0.40), yaw +-6. Lean back with root.pitch; the hips stay.
//     padY: centre of the thigh rollers, default seatH + 0.225, which rests them on the thighs of that sitter. Rollers at z 0.22, x +-0.13, 0.19 long, radius 0.055, on a
//     post at x 0, z 0.37 that comes up between the shins.
//     Cable: wheel centre (0, 2.26, 0.17); it leaves on the sitter's side, at about z 0.125.
//     Lat bar: hands (+-0.40, 1.57, 0.17), arms nearly straight (root.pitch -4), to (+-0.40, 1.14, 0.26) with root.pitch -12. Default attachment lat-bar; also v-bar,
//     straight-bar, rope; hand:"L" + d-handle.
//
// seated-row (seated-row-station)   pos: floor under the sitter's hips. The sitter faces +Z along the bench, the machine ahead: column at z 1.15, stack at z 1.41.
//     benchH: top of the pad, default 0.42. Pad x +-0.15, z -0.53 to 0.42. Body: root.pos (0, benchH + 0.09, 0). Add "floats":true to the spec.
//     Foot plates: two, centred (+-0.115, 0.36, 0.875), 0.15 x 0.32, facing the sitter and up 20 degrees, a heel lip at the bottom. Soles: pos (+-0.115, 0.343, 0.863),
//     anchor "sole", pitch -70, pole [+-0.15, 1, 0.3]: knees bent about 40 degrees.
//     Wheel centre (0, pulleyY, 0.976), pulleyY default 0.48: the cable passes between the feet. V-bar hands: (+-0.07, 0.74, 0.72), root.pitch 6, spine.flex 30, to
//     (+-0.07, 0.84, 0.30), root.pitch -6, spine.flex -4. Default attachment v-bar; also rope, straight-bar; hand:"L" + d-handle.
//     Lying on the bench, head toward the machine: root.pos (0, benchH + 0.10, -0.25), root.yaw 180, root.pitch -90 (the figure's left is then at -X, soles
//     (-+0.2, 0, -0.74), yaw 180): specs/_gallery/seated-row-lying.json.
//
// seated-cable-press (seated-cable-press-machine)   pos: floor under the middle of the seat. The sitter faces +Z, back on a pad, a cable handle on each side.
//     seatH: default 0.46, pad as the lat seat. backAngle: degrees from vertical, default 8.
//     Body: root.pos (0, seatH + 0.09, -0.03), root.pitch = -backAngle, spine.flex 0: that lays the back flat on the pad at any angle. Soles (+-0.17, 0, 0.42), yaw +-8.
//     Swivel wheels at x +-pulleyX (0.46), y pulleyY (0.90: under the elbows, so the cable clears the arm), z pulleyZ (-0.10), on arms from a carriage behind the pad.
//     Chest press: hands (+-0.27, 1.06, 0.20) to (+-0.09, 1.10, 0.52), fingers forward, palms down.
//     Incline: backAngle 30, pulleyY 0.68, pulleyZ -0.2, hands (+-0.27, 0.98, -0.02) to (+-0.09, 1.27, 0.21).
//     Shoulder press: pulleyY 0.6, pulleyZ 0, pulleyX 0.42, hands (+-0.30, 1.14, 0.08) to (+-0.10, 1.58, 0.02), palms forward.
//     hands:true or hand:"L"; d-handle by default.
//
// low-pulley    pos: floor under the swivel. A floor-bolted pulley: plate 0.24 square, wheel centre y 0.20, it turns to face the load. Keys as the tower, no stack: put a
//     weight-stack beside it if the picture needs one (specs/_gallery/weight-stack.json).
//
// pulley-bracket  pos: floor under the swivel. pulleyY (default 2.15) is the wheel's height. It hangs off an arm coming from -Z and the cable leaves on the +Z side.
//     mount: "post" (default: a floor post at z -0.34, base within z -0.68 to 0, x +-0.3), "wall" (a plate at z -0.39), "beam" (clamped on a beam along X above the arm), "none".
//     Keys as the tower; ratio does nothing, as it has no stack. Kneeling crunch: yaw 180, pos z + 0.40 from the knees' line: specs/_gallery/pulley-bracket.json.
//
// weight-stack  pos: floor under the middle of the plates, pin toward +Z, with its own small frame. plates, pin, lift, topY (top of the rods, default 2.1). Plates 0.30 wide,
//     0.125 deep, rods at x +-0.122. For another machine: import { buildWeightStack } from './cables.js'; it returns {group, eyeY, headTop, rise}, without the frame.
//
// cable   from: world point where the plain cable starts; hand / hands / foot / feet, or to (a world point for the attachment's eye), + attachment. wheel:true draws a free
//     swivel block with from as the point where the cable arrives on the wheel, and axis (default [0,1,0]) the way it arrives from. Use this for a pulley that isn't one of
//     these machines. On the machines use their own keys; bare:true on a machine leaves its cable and attachment off if you must draw them separately.
//
// CAMERAS. These machines are large. Az that works: tower 55-120 facing it (the pin side shows), row 118, lat pulldown 140, press 40, crossover 0-45 or 135-180 (at az 90 a tower
// stands in front of the figure). frameIgnore:true on a machine makes the figure much bigger but crops the machine, the high pulley first: out of frame the cable just
// leaves the picture, which reads fine.
import { kit, mat } from './kit.js'

const { THREE, group, rbox, cyl, between, sphere, lathe, torus, mesh } = kit
const V3 = THREE.Vector3
const v = (a) => new V3(a[0], a[1], a[2])
const D = Math.PI / 180
const YUP = new V3(0, 1, 0)

// ---------------------------------------------------------------------------------------------------------------------
// Materials: local versions tuned so the machine reads on black without competing with the figure. Powder coat is a dielectric
// with little of the studio in it: a metallic frame mirrors the top panel and burns out every flat top.
// ---------------------------------------------------------------------------------------------------------------------
const std = (o) => new THREE.MeshStandardMaterial(o)
// The scene's rim light comes from behind the machine at a low angle. Seen from a low camera, any flat top then shows its mirror
// image at grazing Fresnel: white stripes. specularIntensity cuts that, and it is why these are physical materials.
const coat = (color, roughness = 0.6, specularIntensity = 0.42) => new THREE.MeshPhysicalMaterial({ color, metalness: 0, roughness, specularIntensity, envMapIntensity: 0.42 })
function knurlMaterial() {
  const m = std({ color: 0xa2a5aa, metalness: 1, roughness: 0.5, envMapIntensity: 1.1 })
  if (typeof document === 'undefined') return m
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')
  x.fillStyle = '#ffffff'
  x.fillRect(0, 0, 64, 64)
  x.strokeStyle = '#000000'
  x.lineWidth = 5
  for (let i = -64; i <= 128; i += 32) {
    x.beginPath()
    x.moveTo(i, 0)
    x.lineTo(i + 64, 64)
    x.stroke()
    x.beginPath()
    x.moveTo(i + 64, 0)
    x.lineTo(i, 64)
    x.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(16, 40)
  t.anisotropy = 4
  m.bumpMap = t
  m.bumpScale = 0.6
  return m
}

const M = {
  frame: coat(0x5c5e63),
  frameDark: coat(0x3b3d40),
  sheet: coat(0x4b4d51, 0.56),
  weld: std({ color: 0x6d7075, metalness: 0.5, roughness: 0.62, envMapIntensity: 0.4 }),
  cap: coat(0x26272a, 0.5, 0.5),
  hole: std({ color: 0x050506, metalness: 0, roughness: 0.95, envMapIntensity: 0 }),
  chrome: std({ color: 0xd8dade, metalness: 1, roughness: 0.2, envMapIntensity: 1.25 }),
  barSteel: std({ color: 0xcfd1d5, metalness: 1, roughness: 0.3, envMapIntensity: 1.3 }),
  steel: mat.steel,
  zinc: std({ color: 0x8d9095, metalness: 0.75, roughness: 0.46, envMapIntensity: 0.55 }),
  knurl: knurlMaterial(),
  stackPlate: coat(0x3e4043, 0.52, 0.5),
  stackTop: coat(0x54565a, 0.46, 0.55),
  cable: std({ color: 0x96999e, metalness: 0.4, roughness: 0.4, envMapIntensity: 0.7 }),
  wheel: coat(0x66696d, 0.42, 0.8),
  rubber: coat(0x292a2d, 0.68, 0.5),
  grip: coat(0x35363a, 0.58, 0.6),
  vinyl: coat(0x36373a, 0.5, 0.5),
  piping: coat(0x55575b, 0.52, 0.5),
  stitch: std({ color: 0x77797d, metalness: 0, roughness: 0.82, envMapIntensity: 0.3 }),
  board: coat(0x2c2d2f, 0.62),
  rope: std({ color: 0x7c7f83, metalness: 0, roughness: 0.84, envMapIntensity: 0.4 }),
  strap: coat(0x424347, 0.72, 0.4),
  tread: coat(0x2f3032, 0.74, 0.5),
}

// ---------------------------------------------------------------------------------------------------------------------
// Geometry helpers.
// ---------------------------------------------------------------------------------------------------------------------
const geoCache = new Map()
const memo = (key, make) => {
  let g = geoCache.get(key)
  if (!g) {
    g = make()
    geoCache.set(key, g)
  }
  return g
}

/** Merges geometries into one, to keep the draw calls down for rows of small parts. Items are {g, m (Matrix4), uv?}. */
function mergeList(list) {
  let nv = 0
  let ni = 0
  for (const { g } of list) {
    nv += g.attributes.position.count
    ni += g.index ? g.index.count : g.attributes.position.count
  }
  const pos = new Float32Array(nv * 3)
  const nor = new Float32Array(nv * 3)
  const uvs = new Float32Array(nv * 2)
  const idx = new Uint32Array(ni)
  let vo = 0
  let io = 0
  const t = new V3()
  const nm = new THREE.Matrix3()
  for (const { g, m, uv } of list) {
    const pa = g.attributes.position
    const na = g.attributes.normal
    const ua = g.attributes.uv
    nm.getNormalMatrix(m)
    for (let i = 0; i < pa.count; i++) {
      t.fromBufferAttribute(pa, i).applyMatrix4(m)
      pos[(vo + i) * 3] = t.x
      pos[(vo + i) * 3 + 1] = t.y
      pos[(vo + i) * 3 + 2] = t.z
      t.fromBufferAttribute(na, i).applyMatrix3(nm).normalize()
      nor[(vo + i) * 3] = t.x
      nor[(vo + i) * 3 + 1] = t.y
      nor[(vo + i) * 3 + 2] = t.z
      if (ua) {
        const u = ua.getX(i)
        const w = ua.getY(i)
        uvs[(vo + i) * 2] = uv ? uv[0] + u * uv[2] : u
        uvs[(vo + i) * 2 + 1] = uv ? uv[1] + w * uv[3] : w
      }
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.getX(i) + vo
    else for (let i = 0; i < pa.count; i++) idx[io++] = i + vo
    vo += pa.count
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  out.setIndex(new THREE.BufferAttribute(idx, 1))
  return out
}

const TR = (x = 0, y = 0, z = 0, ex = 0, ey = 0, ez = 0) => new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(ex, ey, ez)), new V3(1, 1, 1))

/** Smooth normals across shallow edges of a non-indexed geometry, keeping real corners sharp. ExtrudeGeometry needs this. */
function creased(geometry, deg = 40) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry
  const p = g.attributes.position
  const faces = p.count / 3
  const fn = new Float32Array(faces * 3)
  const a = new V3()
  const b = new V3()
  const c = new V3()
  for (let f = 0; f < faces; f++) {
    a.fromBufferAttribute(p, f * 3)
    b.fromBufferAttribute(p, f * 3 + 1).sub(a)
    c.fromBufferAttribute(p, f * 3 + 2).sub(a)
    b.cross(c).normalize()
    fn[f * 3] = b.x
    fn[f * 3 + 1] = b.y
    fn[f * 3 + 2] = b.z
  }
  const byPos = new Map()
  const key = (i) => `${Math.round(p.getX(i) * 2e4)},${Math.round(p.getY(i) * 2e4)},${Math.round(p.getZ(i) * 2e4)}`
  for (let i = 0; i < p.count; i++) {
    const k = key(i)
    if (!byPos.has(k)) byPos.set(k, [])
    byPos.get(k).push(i)
  }
  const cosT = Math.cos(deg * D)
  const nrm = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) {
    const f = Math.floor(i / 3)
    let nx = 0
    let ny = 0
    let nz = 0
    for (const j of byPos.get(key(i))) {
      const h = Math.floor(j / 3)
      if (fn[f * 3] * fn[h * 3] + fn[f * 3 + 1] * fn[h * 3 + 1] + fn[f * 3 + 2] * fn[h * 3 + 2] >= cosT) {
        nx += fn[h * 3]
        ny += fn[h * 3 + 1]
        nz += fn[h * 3 + 2]
      }
    }
    const l = Math.hypot(nx, ny, nz) || 1
    nrm[i * 3] = nx / l
    nrm[i * 3 + 1] = ny / l
    nrm[i * 3 + 2] = nz / l
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
  return g
}

/** A polygon with rounded corners, as a THREE.Shape. `holes` are extra paths (see circlePath, slotPath). */
function roundedShape(pts, r = 0.008, holes = []) {
  const s = new THREE.Shape()
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n]
    const p = pts[i]
    const p1 = pts[(i + 1) % n]
    const ax = p0[0] - p[0]
    const ay = p0[1] - p[1]
    const bx = p1[0] - p[0]
    const by = p1[1] - p[1]
    const la = Math.hypot(ax, ay)
    const lb = Math.hypot(bx, by)
    const cos = (ax * bx + ay * by) / (la * lb)
    const half = Math.acos(Math.max(-1, Math.min(1, cos))) / 2
    const t = Math.min(r / Math.tan(half || 1e-3), la * 0.5, lb * 0.5)
    const x0 = p[0] + (ax / la) * t
    const y0 = p[1] + (ay / la) * t
    const x1 = p[0] + (bx / lb) * t
    const y1 = p[1] + (by / lb) * t
    if (i === 0) s.moveTo(x0, y0)
    else s.lineTo(x0, y0)
    s.quadraticCurveTo(p[0], p[1], x1, y1)
  }
  s.closePath()
  for (const h of holes) s.holes.push(h)
  return s
}

const circlePath = (x, y, r) => {
  const c = new THREE.Path()
  c.absarc(x, y, r, 0, Math.PI * 2, true)
  return c
}

/** A slot running horizontally, centred on (x, y). */
const slotPath = (x, y, len, h) => {
  const r = h / 2
  const c = new THREE.Path()
  c.moveTo(x - len / 2 + r, y - r)
  c.absarc(x - len / 2 + r, y, r, -Math.PI / 2, -Math.PI * 1.5, true)
  c.lineTo(x + len / 2 - r, y + r)
  c.absarc(x + len / 2 - r, y, r, Math.PI / 2, -Math.PI / 2, true)
  c.closePath()
  return c
}

/** Flat plate cut from a shape, thickness t along local Z, centred on z = 0, with a small bevel. */
function plateGeo(shape, t, bevel = 0.001, curve = 10) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(1e-4, t - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, bevelOffset: -bevel, curveSegments: curve, steps: 1 })
  g.translate(0, 0, -(t - 2 * bevel) / 2)
  return creased(g, 26)
}

/** Plate in the YZ plane: shape coordinates are [z, y], thickness along X, centred on x. dir -1 mirrors the plate along Z. */
function sidePlate(key, shape, t, m, x = 0, dir = 1) {
  const g = memo(`side:${key}`, () => plateGeo(shape(), t))
  const o = mesh(g, m, [x, 0, 0])
  o.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2
  return o
}

/** A surface of revolution pointing along any direction. Profile as kit.lathe: [[radius, along], ...]. */
function turned(profile, m, pos, dir = [0, 1, 0], seg = 24) {
  const o = lathe(profile, m, pos, 'y', seg)
  o.quaternion.setFromUnitVectors(YUP, v(dir).normalize())
  return o
}

// Pool for geometry that really changes per frame (a rope): old ones are freed once they can't be on screen any more.
const liveGeos = []
function perFrameGeo(g) {
  liveGeos.push(g)
  while (liveGeos.length > 96) liveGeos.shift().dispose()
  return g
}

const postY = (x, z, y0, y1, w, d = w, m = M.frame, r = 0.008) => rbox(w, y1 - y0, d, r, m, [x, (y0 + y1) / 2, z])
const railZ = (x, y, z0, z1, w, h, m = M.frame, r = 0.008) => rbox(w, h, z1 - z0, r, m, [x, y, (z0 + z1) / 2])
const railX = (z, y, x0, x1, d, h, m = M.frame, r = 0.008) => rbox(x1 - x0, h, d, r, m, [(x0 + x1) / 2, y, z])

/** A square tube from point a to point b. */
function beam(a, b, w, d = w, m = M.frame, r = 0.006) {
  const A = v(a)
  const B = v(b)
  const o = rbox(w, A.distanceTo(B), d, r, m, A.clone().lerp(B, 0.5).toArray())
  const y = B.clone().sub(A).normalize()
  o.quaternion.copy(basisQ(perpUnit(new V3(1, 0, 0), y), y))
  return o
}

/** A bead of weld around a vertical tube. */
const weldY = (x, y, z, w, d = w) => rbox(w + 0.0035, 0.007, d + 0.0035, 0.003, M.weld, [x, y, z], 2)

const AXIS_R = { '+y': [0, 0, 0], '-y': [Math.PI, 0, 0], '+z': [Math.PI / 2, 0, 0], '-z': [-Math.PI / 2, 0, 0], '+x': [0, 0, -Math.PI / 2], '-x': [0, 0, Math.PI / 2] }

/** Hex bolt head with a washer. `axis` is the way the head faces: '+x', '-x', '+y', '-y', '+z', '-z'. */
function bolt(pos, axis = '+z', size = 0.008, m = M.zinc) {
  const g = memo(`bolt${size}`, () => {
    const washer = new THREE.CylinderGeometry(size * 1.35, size * 1.35, 0.0016, 18)
    const head = new THREE.CylinderGeometry(size, size, size * 0.72, 6)
    return mergeList([
      { g: washer, m: TR(0, 0.0008, 0) },
      { g: head, m: TR(0, 0.0016 + size * 0.36, 0) },
    ])
  })
  const o = mesh(g, m, pos)
  const R = AXIS_R[axis]
  o.rotation.set(R[0], R[1], R[2])
  return o
}

/** Rubber levelling foot: sits on the floor at y = 0, its top at about 0.02. */
function foot(x, z) {
  const g = memo('rubberFoot', () =>
    new THREE.LatheGeometry(
      [[0, 0], [0.027, 0], [0.033, 0.003], [0.034, 0.01], [0.03, 0.016], [0.014, 0.02], [0.012, 0.03], [0, 0.03]].map(([r, y]) => new THREE.Vector2(r, y)),
      28,
    ),
  )
  return mesh(g, M.rubber, [x, 0, z])
}

/** A cross foot of a base: tube along X with rubber feet and end caps. */
function crossFoot(z, hw, y = 0.044) {
  const parts = [railX(z, y, -hw, hw, 0.07, 0.05)]
  for (const x of [-hw + 0.04, hw - 0.04]) parts.push(foot(x, z))
  for (const x of [-hw, hw]) parts.push(rbox(0.01, 0.054, 0.074, 0.003, M.cap, [x, y, z]))
  return group(parts)
}

/** A long floor beam along Z with its end caps. */
function floorBeam(z0, z1, w = 0.12, y = 0.044) {
  return group(railZ(0, y, z0, z1, w, 0.05), rbox(w + 0.004, 0.054, 0.01, 0.003, M.cap, [0, y, z0]), rbox(w + 0.004, 0.054, 0.01, 0.003, M.cap, [0, y, z1]))
}

/** A vertical row of holes on a tube's face, as dark discs. Faces local +Z unless the mesh is turned. */
function holeRow(count, step, r) {
  const g = memo(`holes:${count}:${step}:${r}`, () => {
    const disc = new THREE.CylinderGeometry(r, r, 0.0014, 16)
    const list = []
    for (let i = 0; i < count; i++) list.push({ g: disc, m: TR(0, i * step, 0, Math.PI / 2) })
    return mergeList(list)
  })
  const o = mesh(g, M.hole)
  o.castShadow = false
  return o
}

/** Spring pop-pin that locks a sleeve to a hole. Starts at pos and points along dir. */
function popPin(pos, dir) {
  return group(
    turned([[0, 0], [0.0125, 0], [0.0125, 0.016], [0, 0.016]], M.steel, pos, dir, 18),
    turned([[0, 0.012], [0.0065, 0.012], [0.0065, 0.024], [0.015, 0.027], [0.0178, 0.033], [0.0178, 0.046], [0.0145, 0.052], [0, 0.054]], M.grip, pos, dir, 22),
  )
}

/**
 * An upholstered pad: rounded box with a crowned top, on a grid fine enough to carry the crown. w, h, d are full sizes;
 * r is the edge radius; crown is how far the middle of the top stands above its edges.
 */
function padGeo(w, h, d, r, crown, N = 22) {
  return memo(`pad:${w},${h},${d},${r},${crown},${N}`, () => {
    const g = new THREE.BoxGeometry(1, 1, 1, N, N, N)
    const p = g.attributes.position
    const n = g.attributes.normal
    const band = 5
    const flat = (N - 2 * band) / N
    const hw = w / 2
    const hd = d / 2
    const iw = hw - r
    const ih = h / 2 - r
    const id = hd - r
    const part = (u, inner) => {
      const a = Math.min(1, Math.abs(u) * 2)
      if (a <= flat + 1e-6) return [Math.sign(u) * (a / flat) * inner, 0]
      const t = (a - flat) / (1 - flat)
      return [Math.sign(u) * inner, Math.sign(u) * Math.tan((t * Math.PI) / 4)]
    }
    for (let i = 0; i < p.count; i++) {
      const [ax, dx] = part(p.getX(i), iw)
      const [ay, dy] = part(p.getY(i), ih)
      const [az, dz] = part(p.getZ(i), id)
      const l = Math.hypot(dx, dy, dz) || 1
      const nx0 = dx / l
      const ny0 = dy / l
      const nz0 = dz / l
      const x = ax + nx0 * r
      let y = ay + ny0 * r
      const z = az + nz0 * r
      const fx = 1 - (x / hw) ** 2
      const fz = 1 - (z / hd) ** 2
      let nx = nx0
      let nz = nz0
      if (ny0 > 0) {
        // The crown rises smoothly from the edges, and the normals follow it.
        y += crown * fx * fz * ny0
        nx += ny0 * crown * ((2 * x) / (hw * hw)) * fz
        nz += ny0 * crown * ((2 * z) / (hd * hd)) * fx
      }
      const ln = Math.hypot(nx, ny0, nz) || 1
      p.setXYZ(i, x, y, z)
      n.setXYZ(i, nx / ln, ny0 / ln, nz / ln)
    }
    return g
  })
}

/** Points around a rounded rectangle in the XZ plane, for piping and stitching. Closed, not repeating the first. */
function roundedRectLoop(hw, hd, rc, y = 0, corner = 6, sideStep = 0.05) {
  const pts = []
  const corners = [
    [hw - rc, hd - rc, 0],
    [-hw + rc, hd - rc, 90],
    [-hw + rc, -hd + rc, 180],
    [hw - rc, -hd + rc, 270],
  ]
  for (let c = 0; c < 4; c++) {
    const [cx, cz, a0] = corners[c]
    for (let i = 0; i <= corner; i++) {
      const a = (a0 + (90 * i) / corner) * D
      pts.push([cx + Math.cos(a) * rc, y, cz + Math.sin(a) * rc])
    }
    const [nx, nz, a1] = corners[(c + 1) % 4]
    const ex = cx + Math.cos((a0 + 90) * D) * rc
    const ez = cz + Math.sin((a0 + 90) * D) * rc
    const fx = nx + Math.cos(a1 * D) * rc
    const fz = nz + Math.sin(a1 * D) * rc
    const len = Math.hypot(fx - ex, fz - ez)
    const m = Math.floor(len / sideStep)
    for (let i = 1; i < m; i++) pts.push([ex + ((fx - ex) * i) / m, y, ez + ((fz - ez) * i) / m])
  }
  return pts
}

/** Static tube through local points, cached by its key. */
function staticTube(key, pts, r, m, { closed = false, segments = 72, radial = 12, type = 'centripetal' } = {}) {
  const g = memo(`tube:${key}:${r}`, () => {
    const c = new THREE.CatmullRomCurve3(pts.map(v), closed, type)
    return new THREE.TubeGeometry(c, segments, r, radial, closed)
  })
  return mesh(g, m)
}

/**
 * A complete upholstered pad, on a board, its top seam piped, its top panel stitched. Origin at the middle of the pad's underside,
 * long side along Z.
 */
function pad(w, h, d, { r = 0.028, crown = 0.012, stitch = true, board = true } = {}) {
  const parts = [mesh(padGeo(w, h, d, r, crown), M.vinyl, [0, h / 2, 0])]
  parts.push(staticTube(`piping:${w},${h},${d},${r}`, roundedRectLoop(w / 2 + 0.0002, d / 2 + 0.0002, r, h - r * 0.72), 0.0024, M.piping, { closed: true, segments: Math.round(((w + d) * 2) / 0.008), radial: 6 }))
  if (stitch) {
    const g = memo(`stitch:${w},${h},${d},${r},${crown}`, () => {
      // Dashes of thread on the crown, one panel in from the edge.
      const inset = 0.024
      const dash = new THREE.BoxGeometry(0.0058, 0.0007, 0.0011)
      const loop = roundedRectLoop(w / 2 - inset, d / 2 - inset, 0.018, 0, 5, 0.012)
      const list = []
      for (let i = 0; i < loop.length; i++) {
        const a = loop[i]
        const b = loop[(i + 1) % loop.length]
        const dx = b[0] - a[0]
        const dz = b[2] - a[2]
        const n = Math.max(1, Math.round(Math.hypot(dx, dz) / 0.0115))
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n
          const x = a[0] + dx * t
          const z = a[2] + dz * t
          const fx = 1 - (x / (w / 2)) ** 2
          const fz = 1 - (z / (d / 2)) ** 2
          list.push({ g: dash, m: TR(x, h + crown * fx * fz + 0.0002, z, 0, -Math.atan2(dz, dx), 0) })
        }
      }
      return mergeList(list)
    })
    const o = mesh(g, M.stitch)
    o.castShadow = false
    parts.push(o)
  }
  if (board) parts.push(rbox(w - 0.016, 0.014, d - 0.016, 0.004, M.board, [0, -0.005, 0], 2))
  return group(parts)
}

/** A foam roller pad with its axis along X, a chrome washer and bolt on each end. */
function roller(r, len) {
  const hl = len / 2
  const body = turned(
    [
      [0, -hl],
      [r * 0.72, -hl],
      [r * 0.9, -hl + 0.003],
      [r - 0.002, -hl + 0.012],
      [r, -hl + 0.024],
      [r, hl - 0.024],
      [r - 0.002, hl - 0.012],
      [r * 0.9, hl - 0.003],
      [r * 0.72, hl],
      [0, hl],
    ],
    M.vinyl,
    [0, 0, 0],
    [1, 0, 0],
    36,
  )
  const seam = (s) => turned([[r + 0.0007, -0.0015], [r + 0.0007, 0.0015]], M.piping, [s * (hl - 0.03), 0, 0], [1, 0, 0], 36)
  return group(body, seam(1), seam(-1), cyl(0.021, 0.003, M.steel, [hl + 0.001, 0, 0], 'x', { seg: 22 }), cyl(0.021, 0.003, M.steel, [-hl - 0.001, 0, 0], 'x', { seg: 22 }), bolt([hl + 0.0025, 0, 0], '+x', 0.0075), bolt([-hl - 0.0025, 0, 0], '-x', 0.0075))
}

// ---------------------------------------------------------------------------------------------------------------------
// The pulley: a real wheel with a groove, a web with holes and a hub, carried by a swivelling fork.
//
// The block's local frame: origin at the pivot, the point where the cable arrives on the wheel. +Y is the side the cable comes
// from, and it runs down the Y axis. The wheel's centre is at (GROOVE_R, 0, 0), its axle along Z. The cable goes around the wheel
// from angle 180 degrees (the pivot), counterclockwise in XY, and leaves on the tangent that points at the load.
// ---------------------------------------------------------------------------------------------------------------------
const WHEEL_R = 0.055
const GROOVE_R = 0.046
const CABLE_R = 0.0031
const COLLAR_Y = GROOVE_R + 0.045 // from the pivot to the middle of the swivel collar

function wheelGeos(R, w) {
  const rg = R * 0.84
  return memo(`wheel:${R}:${w}`, () => {
    const hw = w / 2
    const chamfer = Math.min(0.002, R * 0.04)
    const rimIn = R * 0.72
    const rim = new THREE.LatheGeometry(
      [
        [rimIn, -hw + 0.001],
        [R - chamfer, -hw],
        [R, -hw + chamfer],
        [R - 0.0005, -hw * 0.62],
        [rg + 0.0012, -hw * 0.28],
        [rg, 0],
        [rg + 0.0012, hw * 0.28],
        [R - 0.0005, hw * 0.62],
        [R, hw - chamfer],
        [R - chamfer, hw],
        [rimIn, hw - 0.001],
        [rimIn, -hw + 0.001],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      56,
    )
    rim.rotateX(Math.PI / 2)
    const n = 5
    const rh = R * 0.46
    const disc = new THREE.Shape()
    disc.absarc(0, 0, rimIn + 0.0005, 0, Math.PI * 2, false)
    for (let i = 0; i < n; i++) disc.holes.push(circlePath(Math.cos((i / n) * 2 * Math.PI) * rh, Math.sin((i / n) * 2 * Math.PI) * rh, R * 0.135))
    const web = plateGeo(disc, 0.0065, 0.0006, 24)
    const hub = new THREE.LatheGeometry(
      [[0, -hw - 0.003], [0.008, -hw - 0.003], [0.0095, -hw - 0.002], [0.012, -hw * 0.7], [R * 0.3, -0.0034], [R * 0.3, 0.0034], [0.012, hw * 0.7], [0.0095, hw + 0.002], [0.008, hw + 0.003], [0, hw + 0.003]].map(([r, y]) => new THREE.Vector2(r, y)),
      28,
    )
    hub.rotateX(Math.PI / 2)
    return { rim, web, hub }
  })
}

/** A wheel with its axle along local Z, centred on the origin. `spin` turns it, in radians. */
function wheel(R = WHEEL_R, w = 0.024, spin = 0) {
  const { rim, web, hub } = wheelGeos(R, w)
  const g = group(mesh(rim, M.wheel), mesh(web, M.wheel), mesh(hub, M.steel))
  g.rotation.z = spin
  return g
}

/** The swivelling block described above, with the fork and the swivel collar. */
function pulleyBlock(spin = 0) {
  const rg = GROOVE_R
  const forkGeo = memo('fork', () => {
    // One cheek of the fork, in the XY plane: from the collar down to the axle, the outline of two circles and their tangents.
    const s = new THREE.Shape()
    const ax = rg
    const ay = 0
    const cx = 0
    const cy = COLLAR_Y - 0.014
    const ra = 0.0165
    const rc = 0.019
    const dir = Math.atan2(cy - ay, cx - ax)
    const pa = dir + Math.PI / 2
    s.absarc(ax, ay, ra, pa, pa + Math.PI, false)
    s.absarc(cx, cy, rc, pa + Math.PI, pa + 2 * Math.PI, false)
    s.closePath()
    s.holes.push(circlePath(rg * 0.46, COLLAR_Y * 0.46, 0.0065))
    return plateGeo(s, 0.0042, 0.0006, 16)
  })
  const gap = 0.0165
  const collarGeo = memo('collar', () =>
    new THREE.LatheGeometry(
      [[0.0052, -0.018], [0.02, -0.018], [0.0215, -0.0165], [0.0215, -0.0095], [0.017, -0.008], [0.017, 0.011], [0.0135, 0.0125], [0.0135, 0.024], [0.0052, 0.026]].map(([r, y]) => new THREE.Vector2(r, y)),
      30,
    ),
  )
  const holder = group(wheel(WHEEL_R, 0.024, spin))
  holder.position.x = rg
  return group(
    holder,
    mesh(forkGeo, M.steel, [0, 0, gap]),
    mesh(forkGeo, M.steel, [0, 0, -gap]),
    // The bridge across the cheeks, under the collar.
    rbox(0.04, 0.012, 2 * gap + 0.0042, 0.003, M.steel, [0, COLLAR_Y - 0.022, 0]),
    mesh(collarGeo, M.frameDark, [0, COLLAR_Y, 0]),
    // The axle: a bolt through the cheeks, its head and nut on the outside.
    cyl(0.0055, 2 * gap + 0.012, M.chrome, [rg, 0, 0], 'z', { seg: 16 }),
    bolt([rg, 0, gap + 0.0021], '+z', 0.0078),
    bolt([rg, 0, -gap - 0.0021], '-z', 0.0078),
  )
}

/** Where a cable arriving down axis `a` onto a wheel of groove radius rg leaves it for point H. See above. */
function solveWrap(pivot, a, H, rg, fallback) {
  const toH = H.clone().sub(pivot)
  const along = toH.dot(a)
  const dv = toH.clone().addScaledVector(a, -along)
  let h = dv.length()
  let d
  if (h < 0.004) {
    d = fallback.clone().addScaledVector(a, -fallback.dot(a)).normalize()
    h = 0
  } else {
    d = dv.divideScalar(h)
  }
  const C = pivot.clone().addScaledVector(d, rg)
  const hx = h - rg
  const hy = along
  const L = Math.hypot(hx, hy)
  const phi = Math.atan2(hy, hx)
  const alpha = Math.acos(Math.min(1, rg / Math.max(L, rg)))
  let tEnd = phi - alpha
  while (tEnd < Math.PI) tEnd += 2 * Math.PI
  while (tEnd > 3 * Math.PI) tEnd -= 2 * Math.PI
  const at = (t) => C.clone().addScaledVector(d, Math.cos(t) * rg).addScaledVector(a, Math.sin(t) * rg)
  const N = Math.max(2, Math.ceil((tEnd - Math.PI) / (12 * D)))
  const arc = []
  for (let i = 0; i <= N; i++) arc.push(at(Math.PI + ((tEnd - Math.PI) * i) / N))
  const exit = arc[arc.length - 1]
  const wrapLen = (tEnd - Math.PI) * rg
  return { d, C, exit, arc, wrapLen, len: wrapLen + exit.distanceTo(H) }
}

const basisQ = (x, y) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, x.clone().cross(y)))

/** Places a block in the world for a solved wrap. */
function placedBlock(pivot, a, wrap, spin) {
  const b = pulleyBlock(spin)
  b.position.copy(pivot)
  b.quaternion.copy(basisQ(wrap.d, a))
  return b
}

function polyCable(points, r = CABLE_R) {
  const parts = []
  for (let i = 0; i + 1 < points.length; i++) parts.push(between(points[i].toArray(), points[i + 1].toArray(), r, M.cable, 8))
  return parts
}

// ---------------------------------------------------------------------------------------------------------------------
// The weight stack, in its own frame: origin on the floor under its centre, width along X, depth along Z, pin toward +Z.
// ---------------------------------------------------------------------------------------------------------------------
const PLATE = { w: 0.3, h: 0.0245, d: 0.125, pitch: 0.0255, y0: 0.13 }
const ROD_X = 0.122
const TAG = { cols: 6, rows: 8, cw: 96, ch: 48 }

function tagAtlas(kgStep) {
  return memo(`tagAtlas:${kgStep}`, () => {
    if (typeof document === 'undefined') return new THREE.MeshStandardMaterial({ color: 0x9a9ca0, roughness: 0.7 })
    const c = document.createElement('canvas')
    c.width = TAG.cols * TAG.cw
    c.height = TAG.rows * TAG.ch
    const x = c.getContext('2d')
    x.fillStyle = '#a7a9ac'
    x.fillRect(0, 0, c.width, c.height)
    x.fillStyle = '#17181a'
    x.font = 'bold 36px "DejaVu Sans", Arial, sans-serif'
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    for (let i = 0; i < TAG.cols * TAG.rows; i++) {
      const col = i % TAG.cols
      const row = Math.floor(i / TAG.cols)
      x.fillText(String((i + 1) * kgStep), (col + 0.5) * TAG.cw, (row + 0.52) * TAG.ch)
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return new THREE.MeshStandardMaterial({ map: tex, metalness: 0, roughness: 0.74, envMapIntensity: 0.25 })
  })
}

/** Plates i0 (inclusive) to i1 (exclusive), counted from the bottom of an n-plate stack, as three cached merged meshes. */
function plateRun(i0, i1, n, kgStep) {
  if (i1 <= i0) return []
  const P = PLATE
  const yOf = (i) => P.y0 + P.h / 2 + i * P.pitch
  const key = `${i0},${i1},${n},${kgStep}`
  const body = memo(`plates:${key}`, () => {
    const one = rbox(P.w, P.h, P.d, 0.0045, M.stackPlate, undefined, 2).geometry
    const list = []
    for (let i = i0; i < i1; i++) list.push({ g: one, m: TR(0, yOf(i), 0) })
    return mergeList(list)
  })
  const holes = memo(`plateHoles:${key}`, () => {
    const disc = new THREE.CylinderGeometry(0.0068, 0.0068, 0.0012, 14)
    const list = []
    for (let i = i0; i < i1; i++) for (const s of [1, -1]) list.push({ g: disc, m: TR(0, yOf(i), s * (P.d / 2 + 0.0003), Math.PI / 2) })
    return mergeList(list)
  })
  const tags = memo(`plateTags:${key}`, () => {
    const q = new THREE.PlaneGeometry(0.03, 0.015)
    const list = []
    for (let i = i0; i < i1; i++) {
      const k = n - 1 - i // 0 for the top plate
      const col = k % TAG.cols
      const row = Math.floor(k / TAG.cols)
      for (const s of [1, -1]) {
        list.push({ g: q, m: TR(-s * 0.066, yOf(i), s * (P.d / 2 + 0.0004), 0, s > 0 ? 0 : Math.PI, 0), uv: [col / TAG.cols, 1 - (row + 1) / TAG.rows, 1 / TAG.cols, 1 / TAG.rows] })
      }
    }
    return mergeList(list)
  })
  const b = mesh(body, M.stackPlate)
  const h = mesh(holes, M.hole)
  h.castShadow = false
  const t = mesh(tags, tagAtlas(kgStep))
  t.castShadow = false
  return [b, h, t]
}

function weightStack({ plates = 20, pin = 7, lift = 0, topY = 2.1, kgStep = 5 } = {}) {
  const P = PLATE
  const n = plates
  const sel = Math.max(1, Math.min(n, Math.round(pin)))
  const out = group()
  const headH = 0.042
  const yTop = P.y0 + n * P.pitch - (P.pitch - P.h)
  const headY = yTop + 0.0015 + headH / 2
  // The stack can't rise into the top of its own rods.
  const rise = Math.max(0, Math.min(lift, topY - (headY + headH / 2 + 0.03)))
  // Guide rods and their stops.
  for (const x of [-ROD_X, ROD_X]) {
    out.add(cyl(0.0125, topY - 0.065, M.chrome, [x, (topY + 0.065) / 2, 0], 'y', { seg: 20 }))
    out.add(lathe([[0.0125, 0.075], [0.026, 0.075], [0.029, 0.08], [0.029, P.y0 - 0.006], [0.025, P.y0 - 0.001], [0.0125, P.y0 - 0.001]], M.rubber, [x, 0, 0], 'y', 24))
  }
  out.add(rbox(P.w + 0.05, 0.013, P.d + 0.03, 0.004, M.frameDark, [0, 0.0695, 0], 2))
  // The plates that stay.
  out.add(...plateRun(0, n - sel, n, kgStep))
  // What rises: the selected plates, the head plate, the stem, the pin.
  const up = group(...plateRun(n - sel, n, n, kgStep))
  up.add(rbox(P.w, headH, P.d + 0.004, 0.008, M.stackTop, [0, headY, 0]))
  const headTop = headY + headH / 2
  for (const x of [-ROD_X, ROD_X]) {
    up.add(lathe([[0.0125, headTop], [0.021, headTop], [0.021, headTop + 0.02], [0.018, headTop + 0.024], [0.0125, headTop + 0.024]], M.steel, [x, 0, 0], 'y', 24))
  }
  // The stem runs down through the plates, and its eye takes the cable above the head plate.
  const eyeY = headTop + 0.058
  const stemBottom = P.y0 + 0.012
  up.add(cyl(0.0085, headY - stemBottom, M.chrome, [0, (headY + stemBottom) / 2, 0], 'y', { seg: 14 }))
  up.add(lathe([[0, headTop], [0.021, headTop], [0.0215, headTop + 0.008], [0.012, headTop + 0.014], [0.0095, headTop + 0.032], [0, headTop + 0.034]], M.chrome, [0, 0, 0], 'y', 24))
  up.add(torus(0.0115, 0.0034, M.chrome, [0, eyeY - 0.0115 + 0.0026, 0], 'x', 24))
  // The selector pin in the chosen plate: a steel shaft and a turned knob.
  const pinY = P.y0 + P.h / 2 + (n - sel) * P.pitch
  up.add(cyl(0.0058, 0.05, M.chrome, [0, pinY, P.d / 2 + 0.008], 'z', { seg: 12 }))
  up.add(turned([[0, 0.012], [0.008, 0.012], [0.0105, 0.016], [0.0165, 0.02], [0.0175, 0.03], [0.0155, 0.043], [0.011, 0.05], [0, 0.052]], M.steel, [0, pinY, P.d / 2], [0, 0, 1], 22))
  up.position.y = rise
  out.add(up)
  return { group: out, eyeY: eyeY + rise, headTop: headTop + rise, rise }
}

// ---------------------------------------------------------------------------------------------------------------------
// The tower body, shared by the cable tower, the crossover and the seated row.
// ---------------------------------------------------------------------------------------------------------------------
const TOWER = { H: 2.3, axisZ: 0.128, stackZ: -0.33, rearZ: -0.66, frontBase: 0.3, rearBase: -0.92, col: 0.08, plateX: 0.0475 }
const yBaseMid = 0.044
const yBaseTop = 0.068

/** Side plate of the top: a long bar with tabs down over the column and the rear post, and oblong windows along it. */
function cheekShape(H, rearZ) {
  const yb = H - 0.105
  const yt = H
  const span = -0.085 - (rearZ + 0.085)
  const nSlots = Math.max(1, Math.round(span / 0.185))
  const slotLen = span / nSlots - 0.052
  const holes = []
  for (let i = 0; i < nSlots; i++) holes.push(slotPath(-0.085 - ((i + 0.5) * span) / nSlots, H - 0.05, slotLen, 0.036))
  return roundedShape(
    [
      [0.18, yt],
      [rearZ - 0.062, yt],
      [rearZ - 0.062, yb - 0.075],
      [rearZ + 0.052, yb - 0.075],
      [rearZ + 0.052, yb - 0.022],
      [rearZ + 0.082, yb],
      [-0.082, yb],
      [-0.052, yb - 0.022],
      [-0.052, yb - 0.075],
      [0.052, yb - 0.075],
      [0.052, yb - 0.022],
      [0.076, yb],
      [0.18, yb],
    ],
    0.011,
    holes,
  )
}

function gussetShape(w, h) {
  return roundedShape([[0, 0], [w, 0], [0, h]], 0.006, [circlePath(w * 0.3, h * 0.3, Math.min(w, h) * 0.085)])
}

/** Pair of gussets on either side of a vertical tube's face, in the YZ plane, running toward dir along Z. */
function gussets(key, size, x, y, z, dir) {
  return [-x, x].map((xx) => {
    const o = sidePlate(`gus:${key}`, () => gussetShape(size[0], size[1]), 0.006, M.sheet, xx, dir)
    o.position.set(xx, y, z)
    return o
  })
}

/** Everything of a tower except the swivel block and what hangs from it. Local frame: column at the origin, front +Z. */
function towerBody({ H = TOWER.H, rearZ = TOWER.rearZ, stackZ = TOWER.stackZ, pulleyY = 1.2, lift = 0, plates = 20, pin = 7, pinSide = 1, fixed = false, yoke = false, baseFront = TOWER.frontBase, baseRear = TOWER.rearBase, baseW = 0.33 }) {
  const g = group()
  const col = TOWER.col
  const px = TOWER.plateX
  // Base: a long beam and two cross feet.
  g.add(floorBeam(baseRear, baseFront))
  g.add(crossFoot(baseFront - 0.035, baseW))
  g.add(crossFoot(baseRear + 0.035, baseW))

  // Column with the track holes, rear post.
  const colTop = H - 0.09
  g.add(postY(0, 0, yBaseTop, colTop, col))
  g.add(postY(0, rearZ, yBaseTop, colTop, col))
  g.add(weldY(0, yBaseTop + 0.002, 0, col))
  g.add(weldY(0, yBaseTop + 0.002, rearZ, col))
  if (!fixed) {
    const first = 0.25
    const step = 0.05
    const count = Math.floor((colTop - 0.09 - first) / step)
    const front = holeRow(count, step, 0.0072)
    front.position.set(0, first, col / 2 + 0.0002)
    g.add(front)
    for (const s of [1, -1]) {
      const side = holeRow(count, step, 0.0072)
      side.rotation.y = s * (Math.PI / 2)
      side.position.set(s * (col / 2 + 0.0002), first, 0)
      g.add(side)
    }
  }

  // Gussets at the feet of both posts.
  g.add(...gussets('col', [0.12, 0.115], px, yBaseTop, col / 2, 1), ...gussets('post', [0.17, 0.17], px, yBaseTop, rearZ - col / 2, -1))

  // Top: two long cheek plates. The wheels run between them, half out below so they can be seen.
  for (const x of [-px, px]) g.add(sidePlate(`cheek${H},${rearZ}`, () => cheekShape(H, rearZ), 0.012, M.sheet, x))
  // Bolts through the plates into the posts.
  for (const z of [rearZ, 0]) {
    for (const [x, ax] of [[px + 0.006, '+x'], [-px - 0.006, '-x']]) {
      g.add(bolt([x, H - 0.142, z + 0.022], ax, 0.0072))
      g.add(bolt([x, H - 0.142, z - 0.022], ax, 0.0072))
    }
  }
  // Spacers between the plates, flush with the top edge.
  for (const z of [0.155, -0.065, rearZ + 0.065]) g.add(rbox(0.084, 0.02, 0.03, 0.004, M.frameDark, [0, H - 0.014, z]))
  const yWheel = H - 0.105
  const R2 = 0.046
  const rg2 = 0.0385
  const zRear = stackZ + rg2
  const zFront = TOWER.axisZ - rg2
  const topSpin = lift / rg2
  for (const z of [zRear, zFront]) {
    const holder = group(wheel(R2, 0.02, topSpin))
    holder.rotation.y = Math.PI / 2
    holder.position.set(0, yWheel, z)
    g.add(holder)
    g.add(cyl(0.0058, 2 * px + 0.014, M.chrome, [0, yWheel, z], 'x', { seg: 14 }))
    g.add(bolt([px + 0.006, yWheel, z], '+x', 0.0082))
    g.add(bolt([-px - 0.006, yWheel, z], '-x', 0.0082))
  }

  // The stack, turned so its wide face looks sideways.
  const stack = weightStack({ plates, pin, lift, topY: H - 0.118 })
  const holder = group(stack.group)
  holder.rotation.y = (pinSide >= 0 ? 1 : -1) * (Math.PI / 2)
  holder.position.set(0, 0, stackZ)
  g.add(holder)
  // The blocks the rods end in, under the plates, each welded across them.
  for (const z of [stackZ - ROD_X, stackZ + ROD_X]) g.add(rbox(2 * px + 0.012, 0.03, 0.056, 0.005, M.frameDark, [0, H - 0.117, z]))

  // Inside cable: stem eye, up over the rear wheel, along, over the front wheel, down to the carriage.
  const arcPts = (zc, a0, a1, n = 6) => {
    const pts = []
    for (let i = 0; i <= n; i++) {
      const t = a0 + ((a1 - a0) * i) / n
      pts.push(new V3(0, yWheel + Math.sin(t) * rg2, zc + Math.cos(t) * rg2))
    }
    return pts
  }
  const collarY = pulleyY + COLLAR_Y
  g.add(...polyCable([new V3(0, stack.eyeY, stackZ), ...arcPts(zRear, Math.PI, Math.PI / 2), ...arcPts(zFront, Math.PI / 2, 0), new V3(0, collarY + (yoke ? 0.01 : 0), TOWER.axisZ)]))

  // The carriage: a sleeve on the column (or a block bolted to it), and side plates out to the swivel collar.
  const S1 = collarY + 0.032
  if (!yoke) {
    const armFront = TOWER.axisZ + 0.028
    const armShape = () => roundedShape([[0.04, 0], [armFront, 0], [armFront, -0.062], [0.078, -0.14], [0.04, -0.14]], 0.006)
    for (const x of [-0.0245, 0.0245]) {
      const o = sidePlate('carriageArm', armShape, 0.007, M.frameDark, x)
      o.position.y = S1
      g.add(o)
    }
    g.add(rbox(0.056, 0.007, armFront - 0.04, 0.002, M.frameDark, [0, S1 - 0.0035, (armFront + 0.04) / 2], 2))
  } else {
    const lugFront = TOWER.axisZ + 0.02
    g.add(rbox(0.04, 0.012, lugFront - 0.04, 0.004, M.frameDark, [0, S1 - 0.03, (lugFront + 0.04) / 2], 2))
    g.add(sphere(0.0065, M.steel, [0, S1 - 0.022, TOWER.axisZ], 12))
    g.add(cyl(CABLE_R, S1 - 0.022 - collarY > 0 ? S1 - 0.022 - collarY : 0.001, M.cable, [0, (S1 - 0.022 + collarY) / 2, TOWER.axisZ], 'y', { seg: 8 }))
  }
  if (fixed) {
    g.add(rbox(col + 0.012, 0.15, col + 0.012, 0.004, M.frameDark, [0, S1 - 0.07, 0], 2))
    for (const [x, ax] of [[col / 2 + 0.006, '+x'], [-col / 2 - 0.006, '-x']]) {
      g.add(bolt([x, S1 - 0.03, 0], ax, 0.0072))
      g.add(bolt([x, S1 - 0.11, 0], ax, 0.0072))
    }
  } else {
    const sleeveH = 0.16
    const yS = S1 - sleeveH / 2
    g.add(rbox(0.104, sleeveH, 0.104, 0.011, M.frameDark, [0, yS, 0]))
    // Steel wear strips at both ends of the sleeve.
    g.add(rbox(0.108, 0.007, 0.108, 0.003, M.steel, [0, yS + sleeveH / 2 - 0.004, 0], 2))
    g.add(rbox(0.108, 0.007, 0.108, 0.003, M.steel, [0, yS - sleeveH / 2 + 0.004, 0], 2))
    const sx = pinSide >= 0 ? 1 : -1
    g.add(popPin([sx * 0.052, yS, 0], [sx, 0, 0]))
  }
  return { group: g, collarY, stack }
}

// ---------------------------------------------------------------------------------------------------------------------
// The attachments. Each returns { group (in world coordinates), eye (the world point the carabiner hooks) }.
// ---------------------------------------------------------------------------------------------------------------------
const perp = (dir, axis) => dir.clone().addScaledVector(axis, -dir.dot(axis))
function perpUnit(dir, axis, fallback) {
  const p = perp(dir, axis)
  if (p.length() > 1e-4) return p.normalize()
  const f = perp(fallback || YUP, axis)
  return (f.length() > 1e-4 ? f : perp(new V3(1, 0, 0), axis)).normalize()
}

function placed(origin, x, y, ...children) {
  const g = group(...children)
  g.position.copy(origin)
  g.quaternion.copy(basisQ(x, y))
  return g
}

const GRIP = { dHandle: 0.0165, bar: 0.014, ez: 0.0135, vBar: 0.0155, rope: 0.0135 }

/** The stirrup: a rubber grip on a steel core, and a chrome frame that clears the hand and meets at a welded eye. +X along the grip, +Y to the eye. */
function dHandleLocal() {
  const halfGrip = 0.062
  const frame = staticTube(
    'dhandle',
    [
      [0.0665, 0, 0],
      [0.069, 0.03, 0],
      [0.06, 0.07, 0],
      [0.033, 0.1, 0],
      [0.012, 0.114, 0],
      [0, 0.1165, 0],
      [-0.012, 0.114, 0],
      [-0.033, 0.1, 0],
      [-0.06, 0.07, 0],
      [-0.069, 0.03, 0],
      [-0.0665, 0, 0],
    ],
    0.0047,
    M.chrome,
    { segments: 90, radial: 12 },
  )
  // Fine ribs on the sleeve.
  const profile = [[0.006, -halfGrip], [GRIP.dHandle - 0.0025, -halfGrip], [GRIP.dHandle, -halfGrip + 0.003]]
  for (let y = -halfGrip + 0.008; y < halfGrip - 0.007; y += 0.0066) profile.push([GRIP.dHandle, y], [GRIP.dHandle - 0.0009, y + 0.0014], [GRIP.dHandle, y + 0.0028])
  profile.push([GRIP.dHandle, halfGrip - 0.003], [GRIP.dHandle - 0.0025, halfGrip], [0.006, halfGrip])
  return group(
    frame,
    turned(profile, M.grip, [0, 0, 0], [1, 0, 0], 24),
    cyl(0.0055, 0.14, M.chrome, [0, 0, 0], 'x', { seg: 12 }),
    cyl(0.011, 0.0035, M.steel, [0.0645, 0, 0], 'x', { seg: 18 }),
    cyl(0.011, 0.0035, M.steel, [-0.0645, 0, 0], 'x', { seg: 18 }),
    sphere(0.0075, M.chrome, [0.0715, 0, 0], 14),
    sphere(0.0075, M.chrome, [-0.0715, 0, 0], 14),
    cyl(0.0065, 0.012, M.steel, [0, 0.1205, 0], 'y', { seg: 12 }),
    torus(0.0125, 0.0034, M.chrome, [0, 0.135, 0], 'x', 24),
  )
}
const D_EYE = 0.1445

function dHandle(centre, thumb, aim) {
  const x = thumb.clone().normalize()
  const y = perpUnit(aim.clone().sub(centre), x)
  return { group: placed(centre, x, y, dHandleLocal()), eye: centre.clone().addScaledVector(y, D_EYE) }
}

/** The swivel at the centre of a bar: a collar on the bar, a neck, an eye. Local X is the bar, +Y points at the pulley. */
function barSwivel(rb, neck = 0.052) {
  return group(
    cyl(rb + 0.0058, 0.042, M.steel, [0, 0, 0], 'x', { seg: 20 }),
    cyl(rb + 0.0072, 0.003, M.steel, [0.0215, 0, 0], 'x', { seg: 20 }),
    cyl(rb + 0.0072, 0.003, M.steel, [-0.0215, 0, 0], 'x', { seg: 20 }),
    lathe([[0, 0], [rb * 0.9, 0], [0.0105, rb + 0.008], [0.0078, rb + 0.016], [0.0078, rb + neck - 0.006], [0.0115, rb + neck], [0.0115, rb + neck + 0.004], [0, rb + neck + 0.006]], M.steel, [0, 0, 0], 'y', 20),
    torus(0.0125, 0.0034, M.chrome, [0, rb + neck + 0.0145, 0], 'x', 24),
  )
}
const swivelEye = (rb, neck = 0.052) => rb + neck + 0.0145 + 0.0095

/** A short straight bar. Knurled grip zones, a plain middle, turned end caps. */
function straightBarLocal(len) {
  const hl = len / 2
  const r = GRIP.bar
  const body = memo(`sbar${len}`, () =>
    new THREE.LatheGeometry(
      [
        [0, -hl - 0.005],
        [r * 0.72, -hl - 0.005],
        [r + 0.002, -hl - 0.0025],
        [r + 0.0025, -hl + 0.002],
        [r + 0.0025, -hl + 0.012],
        [r, -hl + 0.016],
        [r, hl - 0.016],
        [r + 0.0025, hl - 0.012],
        [r + 0.0025, hl - 0.002],
        [r + 0.002, hl + 0.0025],
        [r * 0.72, hl + 0.005],
        [0, hl + 0.005],
      ].map(([a, b]) => new THREE.Vector2(a, b)),
      28,
    ),
  )
  const bar = mesh(body, M.barSteel)
  bar.rotation.z = -Math.PI / 2
  const zoneIn = 0.035
  const zoneOut = hl - 0.035
  const zoneLen = zoneOut - zoneIn
  const kn = [1, -1].map((s) => cyl(r + 0.0006, zoneLen, M.knurl, [s * (zoneIn + zoneLen / 2), 0, 0], 'x', { seg: 24 }))
  return group(bar, kn)
}

/** Two hands on one rigid bar: its middle, its axis, the way to the pulley. One hand only: the bar lies along the thumb. */
function twoHands(p, ctx, aim) {
  if (p.hands || !p.hand) {
    const cL = v(ctx.hands.L.centre)
    const cR = v(ctx.hands.R.centre)
    const mid = cL.clone().lerp(cR, 0.5)
    const half = cL.distanceTo(cR) / 2
    const x = half > 1e-3 ? cL.clone().sub(cR).normalize() : v(ctx.hands.L.thumb).normalize()
    return { mid, half, x, y: perpUnit(aim.clone().sub(mid), x) }
  }
  const h = ctx.hands[p.hand]
  const mid = v(h.centre)
  const x = v(h.thumb).normalize()
  return { mid, half: 0, x, y: perpUnit(aim.clone().sub(mid), x) }
}

// The lat bar in its own plane: y of the centreline at distance x from the middle.
const LAT = { length: 1.2, x0: 0.34, angle: 22 * D, r: 0.0145, bend: 0.05 }
function latProfile(x) {
  const a = Math.abs(x)
  return a <= LAT.x0 ? 0 : -(a - LAT.x0) * Math.tan(LAT.angle)
}

function latBarLocal() {
  const { length, x0, angle, r, bend } = LAT
  const hl = length / 2
  const t = bend * Math.tan(angle / 2)
  const bendPts = (s) => {
    const out = []
    const n = 7
    for (let i = 0; i <= n; i++) {
      const a = angle * (i / n)
      out.push([s * (x0 - t + bend * Math.sin(a)), -bend * (1 - Math.cos(a)), 0])
    }
    return out
  }
  const right = bendPts(1)
  const last = right[right.length - 1]
  const endX = hl
  const endY = last[1] - (endX - last[0]) * Math.tan(angle)
  const line = [[-endX, endY, 0], ...bendPts(-1).reverse(), [0, 0, 0], ...right, [endX, endY, 0]]
  const body = memo('latbar', () => {
    const curve = new THREE.CurvePath()
    for (let i = 0; i + 1 < line.length; i++) curve.add(new THREE.LineCurve3(v(line[i]), v(line[i + 1])))
    return new THREE.TubeGeometry(curve, 200, r, 20, false)
  })
  const out = group(mesh(body, M.barSteel))
  const lenSlope = (endX - last[0]) / Math.cos(angle)
  for (const s of [1, -1]) {
    const dir = new V3(s * Math.cos(angle), -Math.sin(angle), 0)
    const start = new V3(s * last[0], last[1], 0)
    const a = start.clone().addScaledVector(dir, 0.012).toArray()
    const b = start.clone().addScaledVector(dir, lenSlope - 0.022).toArray()
    // The grip on the slope, a little fatter than the bar, and a turned end.
    out.add(between(a, b, r + 0.0016, M.grip, 24))
    const tip = start.clone().addScaledVector(dir, lenSlope - 0.022)
    out.add(turned([[r + 0.0016, 0], [r + 0.0034, 0.002], [r + 0.0034, 0.018], [r + 0.0012, 0.024], [0, 0.026]], M.steel, tip.toArray(), dir.toArray(), 22))
    // Knurl on the flat, for the closer grips.
    out.add(between([s * 0.09, 0, 0], [s * (x0 - t - 0.015), 0, 0], r + 0.0005, M.knurl, 24))
  }
  return out
}

function latBar(p, ctx, aim) {
  const { mid, half, x, y } = twoHands(p, ctx, aim)
  const C = mid.clone().addScaledVector(y, -latProfile(half))
  return { group: placed(C, x, y, latBarLocal(), barSwivel(LAT.r, 0.05)), eye: C.clone().addScaledVector(y, swivelEye(LAT.r, 0.05)) }
}

// EZ bar centreline, half of it, from the middle out: [x, y], y in the bar's wave plane. The hand on the slope between the valley and
// the crest has its thumb outward and upward, the semi-supinated grip that makes this bar what it is.
const EZ = { r: 0.0135 }
const EZ_PROFILE = [[0, 0], [0.03, 0], [0.056, -0.018], [0.07, -0.027], [0.084, -0.023], [0.148, 0.023], [0.162, 0.027], [0.176, 0.018], [0.205, 0], [0.235, 0], [0.3, 0]]
const ezY = (x) => {
  const a = Math.abs(x)
  for (let i = 0; i + 1 < EZ_PROFILE.length; i++) {
    const [x0, y0] = EZ_PROFILE[i]
    const [x1, y1] = EZ_PROFILE[i + 1]
    if (a <= x1) return y0 + ((y1 - y0) * (a - x0)) / (x1 - x0)
  }
  return 0
}

function ezBarLocal() {
  const right = EZ_PROFILE.map(([a, b]) => [a, b, 0])
  const left = EZ_PROFILE.slice(1).map(([a, b]) => [-a, b, 0]).reverse()
  const out = group(staticTube('ezbar', [...left, ...right], EZ.r, M.barSteel, { segments: 220, radial: 16 }))
  for (const s of [1, -1]) {
    out.add(turned([[EZ.r, 0], [EZ.r + 0.003, 0.003], [EZ.r + 0.003, 0.016], [EZ.r * 0.7, 0.019], [0, 0.02]], M.steel, [s * 0.3, 0, 0], [s, 0, 0], 22))
    out.add(cyl(EZ.r + 0.0006, 0.05, M.knurl, [s * 0.262, 0, 0], 'x', { seg: 22 }))
  }
  return out
}

function ezBar(p, ctx, aim) {
  const { mid, half, x, y } = twoHands(p, ctx, aim)
  // Wave direction: where the thumbs lean together, or else the way the palms face.
  let w = perp(v(ctx.hands.L.thumb).add(v(ctx.hands.R.thumb)), x)
  if (w.length() < 0.15) w = perp(v(ctx.hands.L.palm).add(v(ctx.hands.R.palm)), x)
  if (w.length() < 1e-3) w = y.clone()
  w.normalize()
  const C = mid.clone().addScaledVector(w, -ezY(half))
  return { group: group(placed(C, x, w, ezBarLocal()), placed(C, x, y, barSwivel(EZ.r))), eye: C.clone().addScaledVector(y, swivelEye(EZ.r)) }
}

/** Two parallel grips across a steel triangle: the close neutral row handle. Local X runs across, Y to the eye, Z along the grips. */
function vBar(p, ctx, aim) {
  const cL = v(ctx.hands.L.centre)
  const cR = v(ctx.hands.R.centre)
  const mid = cL.clone().lerp(cR, 0.5)
  const tR = v(ctx.hands.R.thumb)
  if (tR.dot(v(ctx.hands.L.thumb)) < 0) tR.negate()
  const z = v(ctx.hands.L.thumb).add(tR).normalize()
  const xRaw = perp(cL.clone().sub(cR), z)
  const half = Math.max(0.03, xRaw.length() / 2)
  const x = xRaw.length() > 1e-4 ? xRaw.normalize() : perpUnit(new V3(1, 0, 0), z)
  const y = z.clone().cross(x)
  if (y.dot(aim.clone().sub(mid)) < 0) y.negate()
  const hg = 0.06 // half the grip's length
  const apex = 0.112
  const zt = hg + 0.0065
  const zA = 0.03
  const hk = Math.round(half * 500) / 500 // cached per 2 mm of hand spacing
  const hoop = (sz) =>
    staticTube(
      `vhoop:${hk}:${sz}`,
      [
        [-hk, 0, sz * zt],
        [-hk - 0.002, 0.018, sz * zt],
        [-hk * 0.86, 0.05, sz * (zt - 0.006)],
        [-hk * 0.42, 0.087, sz * (zA + 0.018)],
        [-0.012, apex - 0.002, sz * zA],
        [0, apex, sz * zA],
        [0.012, apex - 0.002, sz * zA],
        [hk * 0.42, 0.087, sz * (zA + 0.018)],
        [hk * 0.86, 0.05, sz * (zt - 0.006)],
        [hk + 0.002, 0.018, sz * zt],
        [hk, 0, sz * zt],
      ],
      0.0056,
      M.chrome,
      { segments: 96, radial: 10 },
    )
  const parts = [hoop(1), hoop(-1)]
  for (const sx of [1, -1]) {
    const gx = sx * half
    parts.push(cyl(GRIP.vBar, hg * 2 - 0.006, M.grip, [gx, 0, 0], 'z', { seg: 22 }))
    parts.push(cyl(0.006, hg * 2 + 0.018, M.chrome, [gx, 0, 0], 'z', { seg: 12 }))
    for (const sz of [1, -1]) parts.push(cyl(0.0105, 0.004, M.steel, [gx, 0, sz * (hg - 0.001)], 'z', { seg: 18 }), sphere(0.0065, M.chrome, [gx, 0, sz * (zt + 0.0035)], 12))
  }
  // The cross tube at the apex and the swivel on it.
  parts.push(cyl(0.0105, 2 * zA + 0.016, M.steel, [0, apex, 0], 'z', { seg: 18 }))
  parts.push(lathe([[0, 0.002], [0.0098, 0.002], [0.0098, 0.01], [0.0078, 0.014], [0.0078, 0.026], [0.0115, 0.029], [0.0115, 0.033], [0, 0.035]], M.steel, [0, apex + 0.006, 0], 'y', 20))
  parts.push(torus(0.0125, 0.0034, M.chrome, [0, apex + 0.006 + 0.043, 0], 'x', 24))
  return { group: placed(mid, x, y, parts), eye: mid.clone().addScaledVector(y, apex + 0.006 + 0.0525) }
}

/** The angled pushdown bar: an inverted V with the swivel at its apex. */
const VP = { half: 0.18, rise: 0.096, r: 0.0135 }
function angledVBar(p, ctx, aim) {
  const { mid, half, x, y } = twoHands(p, ctx, aim)
  const slope = VP.rise / VP.half
  const C = mid.clone().addScaledVector(y, Math.min(half, VP.half) * slope)
  const parts = [
    staticTube(
      'vpush',
      [
        [-VP.half, -VP.rise, 0],
        [-VP.half * 0.55, -VP.rise * 0.55, 0],
        [-0.03, -0.015, 0],
        [-0.012, -0.0045, 0],
        [0, 0, 0],
        [0.012, -0.0045, 0],
        [0.03, -0.015, 0],
        [VP.half * 0.55, -VP.rise * 0.55, 0],
        [VP.half, -VP.rise, 0],
      ],
      VP.r,
      M.barSteel,
      { segments: 110, radial: 16 },
    ),
    barSwivel(VP.r, 0.042),
  ]
  const dir = new V3(VP.half, -VP.rise, 0).normalize()
  const armLen = Math.hypot(VP.half, VP.rise)
  for (const s of [1, -1]) {
    const dd = new V3(s * dir.x, dir.y, 0)
    parts.push(between(dd.clone().multiplyScalar(0.06).toArray(), dd.clone().multiplyScalar(armLen - 0.02).toArray(), VP.r + 0.0008, M.knurl, 20))
    parts.push(turned([[VP.r, 0], [VP.r + 0.003, 0.003], [VP.r + 0.003, 0.016], [VP.r * 0.7, 0.019], [0, 0.02]], M.steel, dd.clone().multiplyScalar(armLen - 0.006).toArray(), dd.toArray(), 20))
  }
  return { group: placed(C, x, y, parts), eye: C.clone().addScaledVector(y, swivelEye(VP.r, 0.042)) }
}

const ROPE = { leg: 0.33, r: 0.0118, knobGap: 0.078, past: 0.05 }
const ropeSide = new WeakMap()

function ropeMaterial() {
  return memo('ropeMat', () => {
    if (typeof document === 'undefined') return M.rope
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const x = c.getContext('2d')
    x.fillStyle = '#9a9da1'
    x.fillRect(0, 0, 64, 64)
    x.strokeStyle = 'rgba(52,53,56,0.6)'
    x.lineWidth = 4
    for (let i = -64; i < 128; i += 16) {
      x.beginPath()
      x.moveTo(i, 0)
      x.lineTo(i + 64, 64)
      x.stroke()
      x.beginPath()
      x.moveTo(i + 64, 0)
      x.lineTo(i, 64)
      x.stroke()
    }
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.SRGBColorSpace
    t.repeat.set(40, 4)
    t.anisotropy = 4
    return new THREE.MeshStandardMaterial({ map: t, metalness: 0, roughness: 0.86, envMapIntensity: 0.35 })
  })
}

function tubeGeo(points, r, radial = 10, tubular = 56) {
  const c = new THREE.CatmullRomCurve3(points, false, 'centripetal')
  return perFrameGeo(new THREE.TubeGeometry(c, tubular, r, radial, false))
}

/** The rubber stopper under the little finger. Its flat side, local +Y, faces the hand. */
function ropeKnob(at, dir) {
  return turned(
    [
      [0, -0.024],
      [0.0125, -0.024],
      [0.017, -0.0215],
      [0.0205, -0.012],
      [0.0205, 0.002],
      [0.018, 0.008],
      [0.0145, 0.016],
      [0.0125, 0.024],
      [0, 0.024],
    ],
    M.cap,
    at.toArray(),
    dir.toArray(),
    26,
  )
}

/** The steel ball end where the two legs meet, its eye toward the pulley. */
function ropeEnd(J, across, eyeDir) {
  return placed(
    J,
    perpUnit(across, eyeDir),
    eyeDir,
    lathe([[0, -0.03], [0.0125, -0.03], [0.0165, -0.022], [0.0225, -0.008], [0.0235, 0.002], [0.0205, 0.0155], [0.0125, 0.0235], [0.0085, 0.031], [0.0085, 0.041], [0.0115, 0.044], [0, 0.046]], M.chrome, [0, 0, 0], 'y', 32),
    torus(0.0125, 0.0034, M.chrome, [0, 0.055, 0], 'x', 24),
  )
}
const ROPE_EYE = 0.0645

function rope(p, ctx, aim) {
  const one = p.hand && !p.hands
  const A = v(ctx.hands[one ? p.hand : 'L'].centre)
  const B = v(ctx.hands[one ? p.hand : 'R'].centre)
  const mid = A.clone().lerp(B, 0.5)
  const half = A.distanceTo(B) / 2
  const across = half > 1e-3 ? A.clone().sub(B).normalize() : v(ctx.hands[one ? p.hand : 'L'].thumb).normalize()
  const dirM = perpUnit(aim.clone().sub(mid), across)
  const legLen = p.ropeLeg ?? ROPE.leg
  const h = Math.sqrt(Math.max(0.0004, legLen * legLen - half * half))
  const J = mid.clone().addScaledVector(dirM, h)
  const eyeDir = aim.clone().sub(J).normalize()
  const g = group()
  const key = p.key || p
  const mem = ropeSide.get(key) || {}
  ropeSide.set(key, mem)
  const hands = one ? [[p.hand, A]] : [['L', A], ['R', B]]
  const m = ropeMaterial()
  for (const [s, C] of hands) {
    const t = v(ctx.hands[s].thumb).normalize()
    if (mem[s] === undefined) mem[s] = t.dot(J.clone().sub(C)) >= 0 ? 1 : -1
    const sign = p.ropeFlip ? -mem[s] : mem[s]
    const tt = t.clone().multiplyScalar(sign)
    const knobAt = C.clone().addScaledVector(tt, -ROPE.knobGap)
    const out1 = C.clone().addScaledVector(tt, ROPE.past)
    const lenToJ = J.distanceTo(out1)
    // The leg leaves the fist along the thumb, turns tightly toward the ball end, and enters it along the ball's axis.
    const dirIn = C.clone().sub(J).normalize().addScaledVector(eyeDir, -0.9).normalize()
    const near = J.clone().addScaledVector(dirIn, 0.05)
    const points = [knobAt, C.clone().addScaledVector(tt, -0.03), C.clone(), out1]
    if (lenToJ > 0.12) {
      const toNear = near.clone().sub(out1).normalize()
      points.push(out1.clone().addScaledVector(tt, 0.012).addScaledVector(toNear, 0.03), out1.clone().lerp(near, 0.55), near)
    }
    points.push(J.clone().addScaledVector(eyeDir, -0.012))
    g.add(mesh(tubeGeo(points, ROPE.r), m))
    g.add(ropeKnob(knobAt, tt))
  }
  g.add(ropeEnd(J, across, eyeDir))
  return { group: g, eye: J.clone().addScaledVector(eyeDir, ROPE_EYE) }
}

// The padded ankle cuff: a neoprene wrap above the ankle joint with a webbing strap and a D ring. The leg's section between 5 and 12 cm
// above the ankle joint, cut from the mesh: 7.3 cm front to back, 5 to 6 cm across, its middle 0.7 cm behind the joint and 1.6 cm to the outside.
const CUFF = { above: 0.085, h: 0.074, rf: 0.0445, rs: 0.0385, back: 0.0065, out: 0.016 }
function ankleCuff(side, footInfo, knee, aim) {
  const ankle = v(footInfo.ankle)
  const shin = v(knee).sub(ankle).normalize()
  const f = perpUnit(v(footInfo.forward), shin)
  const s = shin.clone().cross(f).normalize()
  const outward = side === 'L' ? 1 : -1
  const C = ankle.clone().addScaledVector(shin, CUFF.above).addScaledVector(f, -CUFF.back).addScaledVector(s, outward * CUFF.out)
  // The pull sets where the ring sits on the cuff.
  const pull = perpUnit(aim.clone().sub(C), shin, f)
  const body = memo('cuffBody', () => new THREE.LatheGeometry([[0.82, -0.5], [0.93, -0.5], [0.97, -0.47], [1.0, -0.36], [1.0, 0.36], [0.98, 0.47], [0.96, 0.5], [0.84, 0.5]].map(([r, y]) => new THREE.Vector2(r, y)), 48))
  const cuff = mesh(body, M.strap)
  cuff.scale.set(CUFF.rs, CUFF.h, CUFF.rf)
  const band = mesh(memo('cuffBand', () => new THREE.LatheGeometry([[1.0, -0.5], [1.012, -0.47], [1.012, 0.47], [1.0, 0.5]].map(([r, y]) => new THREE.Vector2(r, y)), 48)), M.piping)
  band.scale.set(CUFF.rs * 1.004, CUFF.h * 0.3, CUFF.rf * 1.004)
  const g = placed(C, s, shin, cuff, band)
  const rad = 1 / Math.hypot(pull.dot(s) / CUFF.rs, pull.dot(f) / CUFF.rf)
  const ringAt = C.clone().addScaledVector(pull, rad + 0.014)
  const ring = placed(ringAt, shin, pull, rbox(0.032, 0.012, 0.016, 0.003, M.piping, [0, -0.012, 0]), bolt([0, -0.012, 0.008], '+z', 0.0038), torus(0.0135, 0.0035, M.chrome, [0, 0.009, 0], 'x', 24))
  return { group: group(g, ring), eye: ringAt.clone().addScaledVector(pull, 0.019) }
}

function ankleStrap(p, ctx, aim) {
  if (!p.feet) {
    const s = p.foot || 'L'
    return ankleCuff(s, ctx.feet[s], ctx.joints[`lowerleg01.${s}`], aim)
  }
  const a = ankleCuff('L', ctx.feet.L, ctx.joints['lowerleg01.L'], aim)
  const b = ankleCuff('R', ctx.feet.R, ctx.joints['lowerleg01.R'], aim)
  const mid = a.eye.clone().lerp(b.eye, 0.5)
  const up = aim.clone().sub(mid).normalize()
  // Both rings on one carabiner, by a short strap from each.
  const eye = mid.clone().addScaledVector(up, 0.11)
  return { group: group(a.group, b.group, between(a.eye.toArray(), eye.toArray(), 0.005, M.strap, 8), between(b.eye.toArray(), eye.toArray(), 0.005, M.strap, 8), sphere(0.008, M.steel, eye.toArray(), 12)), eye }
}

// ---------------------------------------------------------------------------------------------------------------------
// The link between the cable and the attachment: carabiner, ferrule, stop ball.
// ---------------------------------------------------------------------------------------------------------------------
function carabinerLocal() {
  // A snap link with a screw gate. Local +Y runs from the attachment's eye up to the cable.
  const pts = [[0, -0.003, 0], [0.012, 0.002, 0], [0.0155, 0.014, 0], [0.0125, 0.052, 0], [0.008, 0.062, 0], [0, 0.066, 0], [-0.008, 0.062, 0], [-0.0115, 0.052, 0], [-0.0125, 0.014, 0], [-0.011, 0.002, 0]]
  return group(staticTube('carabiner', pts, 0.0032, M.chrome, { closed: true, segments: 70, radial: 10 }), cyl(0.0048, 0.018, M.steel, [-0.0122, 0.033, 0], 'y', { seg: 12 }))
}

/** Everything from the eye up to the end of the bare cable. Returns where the bare cable starts. */
function linkHardware(eye, up, { ball = true } = {}) {
  const g = group()
  const q = new THREE.Quaternion().setFromUnitVectors(YUP, up)
  const c = carabinerLocal()
  c.position.copy(eye)
  c.quaternion.copy(q)
  // A quarter turn relative to the eye, as a real link hangs.
  c.rotateY(Math.PI / 2)
  g.add(c)
  const ferrule = lathe([[0, 0.056], [0.0052, 0.056], [0.0062, 0.0595], [0.0062, 0.086], [0.005, 0.09], [0.0034, 0.094], [0, 0.094]], M.steel, [0, 0, 0], 'y', 16)
  const inner = group(ferrule, torus(0.008, 0.0028, M.steel, [0, 0.05, 0], 'x', 18))
  if (ball) inner.add(sphere(0.0165, M.rubber, [0, 0.13, 0], 22))
  inner.position.copy(eye)
  inner.quaternion.copy(q)
  g.add(inner)
  return { group: g, cableStart: eye.clone().addScaledVector(up, 0.092) }
}

// ---------------------------------------------------------------------------------------------------------------------
// Attachment dispatch.
// ---------------------------------------------------------------------------------------------------------------------
const isAttached = (p) => p.hand !== undefined || p.hands !== undefined || p.foot !== undefined || p.feet !== undefined

const ATT_ALIAS = { 'single-handle': 'd-handle', handle: 'd-handle', stirrup: 'd-handle', 'rope-attachment': 'rope', 'straight-bar-attachment': 'straight-bar', bar: 'straight-bar', 'ankle-cuff': 'ankle-strap', 'ez-bar': 'ez-attachment', ez: 'ez-attachment' }

function attachmentKind(p) {
  if ((p.foot || p.feet) && !p.hand && !p.hands) return p.attachment === 'none' ? 'none' : 'ankle-strap'
  if (p.attachment) return ATT_ALIAS[p.attachment] || p.attachment
  if (p.hands) return 'straight-bar'
  return 'd-handle'
}

// How far each attachment reaches below its eye when it hangs free.
const IDLE_DROP = { 'lat-bar': 0.0885, 'straight-bar': 0.09, 'ez-attachment': 0.0895, 'v-bar': 0.17, 'angled-v-bar': 0.14, rope: 0.39, 'd-handle': D_EYE }

/** Where an idle attachment's eye goes: under the wheel if there's room, otherwise out in front, lying on the floor. */
function idleSpot(kind, pivot, front) {
  const hang = pivot.clone().add(new V3(0, -0.215, 0))
  const reach = (IDLE_DROP[kind] ?? 0.1) + (kind === 'rope' ? 0.11 : 0.03) + (kind === 'lat-bar' ? 0.11 : 0)
  if (hang.y - reach > 0.02) return { at: hang, up: YUP.clone() }
  const out = front.clone()
  out.y = 0
  out.normalize()
  const at = pivot.clone().addScaledVector(out, 0.34)
  at.y = 0.03
  return { at, up: out.clone().negate() }
}

/** A stand-in for the solve report when the attachment hangs by itself. `at` is where its eye should be. */
function idleContext(kind, at, up) {
  const across = perpUnit(new V3(1, 0, 0), up)
  const half = { 'lat-bar': 0.3, 'straight-bar': 0.16, 'ez-attachment': 0.115, 'v-bar': 0.075, 'angled-v-bar': 0.11, rope: 0.05 }[kind] ?? 0
  const mid = at.clone().addScaledVector(up, -(IDLE_DROP[kind] ?? 0.1))
  const front = across.clone().cross(up).normalize()
  const hand = (sx, thumb) => ({ centre: mid.clone().addScaledVector(across, sx * half).toArray(), thumb: thumb.toArray(), palm: front.toArray(), fingers: up.clone().negate().toArray() })
  const thumbOf = (sx) => (kind === 'rope' ? up : kind === 'v-bar' ? front : across.clone().multiplyScalar(-sx))
  return { hands: { L: hand(1, thumbOf(1)), R: hand(-1, thumbOf(-1)) } }
}

function buildAttachment(kind, p, ctx, aim) {
  switch (kind) {
    case 'd-handle': {
      if (p.hands) return dHandle(v(ctx.hands.L.centre).lerp(v(ctx.hands.R.centre), 0.5), v(ctx.hands.L.thumb), aim)
      const s = p.hand || 'L'
      return dHandle(v(ctx.hands[s].centre), v(ctx.hands[s].thumb), aim)
    }
    case 'straight-bar': {
      const { mid, y, x } = twoHands(p, ctx, aim)
      return { group: placed(mid, x, y, straightBarLocal(p.barLength ?? 0.5), barSwivel(GRIP.bar)), eye: mid.clone().addScaledVector(y, swivelEye(GRIP.bar)) }
    }
    case 'lat-bar':
      return latBar(p, ctx, aim)
    case 'ez-attachment':
      return ezBar(p, ctx, aim)
    case 'v-bar':
      return vBar(p, ctx, aim)
    case 'angled-v-bar':
      return angledVBar(p, ctx, aim)
    case 'rope':
      return rope(p, ctx, aim)
    case 'ankle-strap':
      return ankleStrap(p, ctx, aim)
    default:
      throw new Error(`cable: unknown attachment "${kind}"`)
  }
}

/** The body point a cable goes to, if it goes to one. */
function loadPoint(p, ctx) {
  if (!isAttached(p) || !ctx) return null
  if (p.feet) return v(ctx.feet.L.ankle).lerp(v(ctx.feet.R.ankle), 0.5)
  if (p.foot) return v(ctx.feet[p.foot].ankle)
  if (p.hands) return v(ctx.hands.L.centre).lerp(v(ctx.hands.R.centre), 0.5)
  return v(ctx.hands[p.hand].centre)
}

/** For a wheel: where the cable leaves it toward a given point. */
const exitFrom = (pivot, a, fallback) => (H) => solveWrap(pivot, a, H, GROOVE_R, fallback).exit

/**
 * The attachment and its link. exitFor(point) says where the cable leaves its wheel toward that point, so the link lies exactly along the cable.
 * Returns { parts, bareEnd, eye }: bareEnd is where the plain cable ends. idleAt is the eye's position when nothing holds it.
 */
function attachedEnd(p, ctx, exitFor, idleAt, idleUp) {
  if (p.bare) return { parts: [], bareEnd: p.aim ? v(p.aim) : idleAt.clone(), bare: true }
  const kind = attachmentKind(p)
  const held = isAttached(p) && ctx
  const aim = exitFor(loadPoint(p, ctx) || idleAt)
  let att = null
  if (kind !== 'none') {
    if (held) att = buildAttachment(kind, p, ctx, aim)
    else if (kind !== 'ankle-strap') att = buildAttachment(kind, { attachment: kind, hands: true }, idleContext(kind, idleAt, idleUp || aim.clone().sub(idleAt).normalize()), aim)
  }
  const eye = att ? att.eye : loadPoint(p, ctx) || idleAt.clone()
  const up = exitFor(eye).sub(eye)
  if (up.lengthSq() < 1e-8) up.set(0, 1, 0)
  up.normalize()
  const link = linkHardware(eye, up)
  return { parts: att ? [att.group, link.group] : [link.group], bareEnd: link.cableStart, eye }
}

// Stack rise. Explicit `lift` wins; else `rest` is the cable length with the stack home; else the shortest length this prop has
// seen, because the renderer samples the whole movement before it draws. Arrays are per tower on the crossover.
const shortest = new WeakMap()
function riseFor(p, desc, slot, len, ratio, held) {
  const pick = (a) => (Array.isArray(a) ? a[slot] : a)
  const lift = desc.lift ?? pick(p.lift)
  if (typeof lift === 'number') return lift
  if (!held) return 0
  const rest = desc.rest ?? pick(p.rest)
  if (typeof rest === 'number') return Math.max(0, (len - rest) * ratio)
  let m = shortest.get(p)
  if (!m) {
    m = {}
    shortest.set(p, m)
  }
  m[slot] = Math.min(m[slot] ?? Infinity, len)
  return 0.014 + (len - m[slot]) * ratio
}

const worldOf = (pos, yaw) => {
  const c = Math.cos(yaw * D)
  const s = Math.sin(yaw * D)
  return (l) => new V3(pos[0] + l[0] * c + l[2] * s, (pos[1] || 0) + l[1], pos[2] - l[0] * s + l[2] * c)
}

/** The carriage's travel: its sleeve stops under the top plates, its wheel above the base. */
const clampPulley = (y, H) => Math.max(0.14, Math.min(H - 0.296, y))

const defaultPinSide = (yaw) => (0.87 * Math.cos(yaw * D) - 0.5 * Math.sin(yaw * D) >= 0 ? 1 : -1)

/** A world-space group holding a local-space assembly: page.js leaves it alone, and cables can be drawn in world coordinates. */
function worldGroup(pos, yaw) {
  const outer = group()
  outer.userData.world = true
  const inner = group()
  inner.position.set(pos[0], pos[1] || 0, pos[2])
  inner.rotation.y = yaw * D
  outer.add(inner)
  return { outer, inner }
}

/** Block, the cable over its wheel, the attachment: added to `outer`. a is the axis the cable arrives along. */
function addLiveCable(outer, end, pivot, a, wrap, spin, stack = {}) {
  ;(outer.userData.cables ||= []).push({ len: wrap.len, pivot, wrap, bareEnd: end.bareEnd, eye: end.eye, bare: !!end.bare, ...stack })
  outer.add(placedBlock(pivot, a, wrap, spin))
  if (end.bare) return
  outer.add(...polyCable([pivot.clone().addScaledVector(a, COLLAR_Y), ...wrap.arc, end.bareEnd]))
  outer.add(...end.parts)
}

/** The full tower with its block and cable. `desc` says what the cable holds; p is the prop (stack rise is remembered on it). */
function buildTower(p, ctx, desc, slot, opts) {
  const { pos, yaw, pinSide, pulleyY, H = TOWER.H, rearZ = TOWER.rearZ, stackZ = TOWER.stackZ, baseFront = TOWER.frontBase, baseRear = TOWER.rearBase, ratio = 0.5, fixed = false, pin = 7, plates = 20 } = opts
  const W = worldOf(pos, yaw)
  const pivot = W([0, pulleyY, TOWER.axisZ])
  const a = YUP.clone()
  const front = W([0, 0, 1]).sub(W([0, 0, 0]))
  const idle = idleSpot(attachmentKind(desc), pivot, front)
  const end = attachedEnd(desc, ctx, exitFrom(pivot, a, front), idle.at, idle.up)
  const wrap = solveWrap(pivot, a, end.bareEnd, GROOVE_R, front)
  const lift = riseFor(p, desc, slot, wrap.len, ratio, isAttached(desc) && ctx)
  const spin = wrap.len / GROOVE_R
  const body = towerBody({ H, rearZ, stackZ, pulleyY, lift, plates, pin, pinSide, fixed, baseFront, baseRear })
  const { outer, inner } = worldGroup(pos, yaw)
  inner.add(body.group)
  addLiveCable(outer, end, pivot, a, wrap, spin, { lift, rise: body.stack.rise, ratio, held: !!(isAttached(desc) && ctx) })
  return outer
}

function crossoverBuilder(defaultSpan) {
  return (p, ctx) => {
    const pos = p.pos || [0, 0, 0]
    const yaw = p.yaw || 0
    const span = p.span ?? defaultSpan
    const H = p.height ?? TOWER.H
    const W = worldOf(pos, yaw)
    const { outer, inner } = worldGroup(pos, yaw)
    const towers = [
      { name: 'L', x: span / 2, slot: 0, pinSide: -1 },
      { name: 'R', x: -span / 2, slot: 1, pinSide: 1 },
    ]
    const pick = (a, i) => (Array.isArray(a) ? a[i] : a)
    for (const t of towers) {
      // What this tower's cable goes to.
      let desc = t.name === 'L' ? p.left : p.right
      if (!desc) {
        const wanted = p.cross ? (t.name === 'L' ? 'R' : 'L') : t.name
        desc = {}
        if (p.hands || p.hand === wanted) desc.hand = wanted
        if (p.feet || p.foot === wanted) desc.foot = wanted
        desc.attachment = isAttached(desc) ? p.attachment ?? (desc.foot ? 'ankle-strap' : 'd-handle') : p.idle ?? 'd-handle'
      }
      const towerPos = W([t.x, 0, 0]).toArray()
      outer.add(buildTower(p, ctx, { ...desc, key: desc.key || p }, t.slot, { pos: towerPos, yaw, pinSide: t.pinSide, pulleyY: clampPulley(pick(p.pulleyY ?? 2.0, t.slot), H), H, ratio: p.ratio ?? 0.5, pin: pick(p.pin ?? 7, t.slot), plates: p.plates ?? 20 }))
    }
    // The overhead: a beam from column to column, a rear tie, and the pull-up bar.
    const beamY = H + 0.045
    const hx = span / 2
    const beamHalf = hx + 0.08
    for (const z of [0, TOWER.rearZ]) {
      inner.add(rbox(2 * beamHalf, 0.07, 0.08, 0.008, M.frame, [0, beamY, z]))
      for (const s of [1, -1]) {
        // End caps, and a flange bolted down to the tower's top.
        inner.add(rbox(0.01, 0.074, 0.084, 0.003, M.cap, [s * beamHalf, beamY, z], 2))
        inner.add(rbox(0.13, 0.01, 0.11, 0.003, M.sheet, [s * hx, H + 0.005, z], 2))
        for (const dx of [-0.05, 0.05]) for (const dz of [-0.044, 0.044]) inner.add(bolt([s * hx + dx, H + 0.01, z + dz], '+y', 0.0062))
      }
    }
    // Pull-up bar on brackets from the front beam, a collar each side of every bracket.
    const barZ = 0.24
    const barY = H - 0.05
    const bx = hx - 0.11
    const dY = barY - beamY
    inner.add(cyl(0.016, 2 * bx, M.barSteel, [0, barY, barZ], 'x', { seg: 24 }))
    const gripLen = Math.min(0.34, bx * 0.5)
    for (const s of [1, -1]) inner.add(cyl(0.0172, gripLen, M.knurl, [s * (bx - gripLen / 2 - 0.05), barY, barZ], 'x', { seg: 24 }))
    const bracket = () => roundedShape([[-0.03, 0.03], [0.05, 0.03], [barZ + 0.032, dY + 0.03], [barZ + 0.032, dY - 0.032], [barZ - 0.032, dY - 0.032], [0.04, -0.03], [-0.03, -0.03]], 0.01, [slotPath(barZ * 0.5, dY * 0.5, 0.07, 0.022)])
    for (const x of [-bx, bx, ...(span > 1.8 ? [0] : [])]) {
      for (const dx of [-0.008, 0.008]) {
        const pl = sidePlate(`pullBracket${H}`, bracket, 0.006, M.sheet, x + dx)
        pl.position.y = beamY
        inner.add(pl)
      }
      inner.add(cyl(0.0205, 0.03, M.steel, [x, barY, barZ], 'x', { seg: 22 }))
    }
    return outer
  }
}

/** Height-adjustable seat on a post from a floor beam: post, sleeve, pop-pin, plate, pad. seatH is the top of the pad at its edge. */
function adjustableSeat(g, seatH, z) {
  const postTop = seatH - 0.075 - 0.02
  const sleeveTop = Math.min(postTop - 0.06, 0.33)
  g.add(postY(0, z, yBaseTop, sleeveTop, 0.075, 0.075, M.frame))
  g.add(weldY(0, yBaseTop + 0.002, z, 0.075))
  g.add(postY(0, z, sleeveTop - 0.02, postTop, 0.055, 0.055, M.frameDark))
  const seatHoles = holeRow(3, 0.028, 0.0046)
  seatHoles.rotation.y = Math.PI / 2
  seatHoles.position.set(0.0277, sleeveTop + 0.012, z)
  g.add(seatHoles)
  g.add(rbox(0.082, 0.05, 0.082, 0.006, M.frameDark, [0, sleeveTop - 0.02, z]))
  g.add(popPin([0.041, sleeveTop - 0.02, z], [1, 0, 0]))
  g.add(...gussets('seat', [0.12, 0.12], 0.04, yBaseTop, z + 0.0375, 1), ...gussets('seat', [0.12, 0.12], 0.04, yBaseTop, z - 0.0375, -1))
  g.add(rbox(0.19, 0.01, 0.19, 0.003, M.frameDark, [0, postTop + 0.003, z], 2))
  const seat = pad(0.36, 0.075, 0.34, { r: 0.03, crown: 0.012 })
  seat.position.set(0, seatH - 0.075 - 0.012, z)
  g.add(seat)
}

/** Lat pulldown station. See the top of this file. */
const LATM = { top: 2.43, under: 2.3, runY: 2.31, tipZ: 0.17, stemZ: 0.98, postZ: 1.2, baseRear: -0.52, baseFront: 1.38 }

function latStation(p, ctx) {
  const pos = p.pos || [0, 0, 0]
  const yaw = p.yaw || 0
  const W = worldOf(pos, yaw)
  const { outer, inner: g } = worldGroup(pos, yaw)
  const seatH = p.seatH ?? 0.48
  const padY = p.padY ?? seatH + 0.225
  const px = TOWER.plateX
  const L = LATM

  // Base.
  g.add(floorBeam(L.baseRear, L.baseFront))
  g.add(crossFoot(L.baseRear + 0.035, 0.3))
  g.add(crossFoot(L.baseFront - 0.035, 0.36))

  // Upright and the gussets at its foot.
  g.add(postY(0, L.postZ, yBaseTop, L.top - 0.03, 0.09))
  g.add(weldY(0, yBaseTop + 0.002, L.postZ, 0.09))
  g.add(...gussets('latRear', [0.13, 0.2], 0.052, yBaseTop, L.postZ + 0.045, 1), ...gussets('latFront', [0.09, 0.14], 0.052, yBaseTop, L.postZ - 0.045, -1))

  // The boom: two plates, from the upright out over the sitter's head.
  const boomShape = () =>
    roundedShape(
      [
        [0.09, L.top - 0.035],
        [L.postZ + 0.06, L.top],
        [L.postZ + 0.06, 2.02],
        [L.postZ - 0.06, 2.02],
        [L.postZ - 0.06, 2.12],
        [L.postZ - 0.2, L.under],
        [0.11, L.under],
        [0.09, L.under + 0.02],
      ],
      0.012,
      [slotPath(0.46, L.under + 0.078, 0.2, 0.05), slotPath(0.72, L.under + 0.078, 0.2, 0.05)],
    )
  for (const x of [-px, px]) g.add(sidePlate('boom', boomShape, 0.012, M.sheet, x))
  for (const [x, ax] of [[px + 0.006, '+x'], [-px - 0.006, '-x']]) {
    for (const y of [2.09, 2.2, 2.32]) {
      g.add(bolt([x, y, L.postZ + 0.024], ax, 0.0072))
      g.add(bolt([x, y, L.postZ - 0.024], ax, 0.0072))
    }
  }
  for (const z of [0.16, 0.6, 0.86]) g.add(rbox(0.084, 0.02, 0.03, 0.004, M.frameDark, [0, L.top - 0.024 - (L.postZ - z) * 0.03, z]))

  // The attachment first: it says how long the cable is.
  const pivot = W([0, L.runY, L.tipZ])
  const a = W([0, 0, 1]).sub(W([0, 0, 0]))
  const down = new V3(0, -1, 0)
  const desc = isAttached(p) ? { attachment: 'lat-bar', ...p, key: p } : { attachment: p.attachment ?? 'lat-bar' }
  const hangAt = W([0, L.runY - 0.3, L.tipZ - GROOVE_R])
  const end = attachedEnd(desc, ctx, exitFrom(pivot, a, down), hangAt)
  const wrap = solveWrap(pivot, a, end.bareEnd, GROOVE_R, down)
  const lift = riseFor(p, desc, 0, wrap.len, p.ratio ?? 1, isAttached(p) && ctx)
  const spin = wrap.len / GROOVE_R

  // Stack, wide face toward the sitter.
  const stack = weightStack({ plates: p.plates ?? 20, pin: p.pin ?? 7, lift, topY: L.under - 0.012 })
  const sh = group(stack.group)
  sh.rotation.y = Math.PI
  sh.position.set(0, 0, L.stemZ)
  g.add(sh)
  g.add(rbox(0.33, 0.028, 0.06, 0.006, M.frameDark, [0, L.under - 0.01, L.stemZ]))

  // The wheel above the stack, hung under the boom.
  const rg2 = 0.0385
  const zW2 = L.stemZ - rg2
  const yW2 = L.runY - rg2
  const w2 = group(wheel(0.046, 0.02, -lift / rg2))
  w2.rotation.y = Math.PI / 2
  w2.position.set(0, yW2, zW2)
  g.add(w2)
  for (const x of [-0.0185, 0.0185]) {
    const hanger = sidePlate('hanger', () => roundedShape([[-0.024, 0.052], [0.024, 0.052], [0.018, -0.016], [-0.018, -0.016]], 0.006), 0.005, M.steel, x)
    hanger.position.set(x, yW2, zW2)
    g.add(hanger)
  }
  g.add(cyl(0.0052, 0.05, M.chrome, [0, yW2, zW2], 'x', { seg: 14 }))
  g.add(bolt([0.021, yW2, zW2], '+x', 0.0066))
  g.add(bolt([-0.021, yW2, zW2], '-x', 0.0066))

  // Inside cable: stem eye, up over the wheel, along the boom to the tip.
  const arc = []
  for (let i = 0; i <= 8; i++) {
    const t = (i / 8) * (Math.PI / 2)
    arc.push(new V3(0, yW2 + Math.sin(t) * rg2, zW2 + Math.cos(t) * rg2))
  }
  g.add(...polyCable([new V3(0, stack.eyeY, L.stemZ), ...arc, new V3(0, L.runY, L.tipZ + COLLAR_Y)]))

  // Mount of the tip block: a bracket across the plates around the swivel collar.
  g.add(rbox(2 * px - 0.014, 0.05, 0.03, 0.005, M.frameDark, [0, L.runY + 0.022, L.tipZ + COLLAR_Y + 0.033]))
  g.add(rbox(0.05, 0.05, 0.05, 0.005, M.frameDark, [0, L.runY + 0.027, L.tipZ + COLLAR_Y + 0.006]))

  adjustableSeat(g, seatH, 0)

  // Thigh hold-down: a post from the beam, a telescoping tube, an arm back to the rollers.
  const rollerZ = 0.22
  const holdZ = 0.37
  const holdTop = Math.min(0.42, padY - 0.1)
  g.add(postY(0, holdZ, yBaseTop, holdTop, 0.06, 0.06, M.frame))
  g.add(weldY(0, yBaseTop + 0.002, holdZ, 0.06))
  g.add(postY(0, holdZ, holdTop - 0.03, padY + 0.02, 0.044, 0.044, M.frameDark))
  const holdHoles = holeRow(Math.max(1, Math.floor((padY - holdTop - 0.03) / 0.03)), 0.03, 0.0042)
  holdHoles.rotation.y = Math.PI / 2
  holdHoles.position.set(0.0222, holdTop + 0.018, holdZ)
  g.add(holdHoles)
  g.add(rbox(0.066, 0.045, 0.066, 0.006, M.frameDark, [0, holdTop - 0.015, holdZ]))
  g.add(popPin([0.033, holdTop - 0.015, holdZ], [1, 0, 0]))
  g.add(between([0, padY, holdZ], [0, padY, rollerZ], 0.018, M.frameDark, 16))
  g.add(cyl(0.018, 0.05, M.frameDark, [0, padY, rollerZ], 'x', { seg: 18 }))
  g.add(cyl(0.0125, 0.46, M.chrome, [0, padY, rollerZ], 'x', { seg: 16 }))
  for (const s of [1, -1]) {
    const rr = roller(0.055, 0.19)
    rr.position.set(s * 0.13, padY, rollerZ)
    g.add(rr)
  }

  addLiveCable(outer, end, pivot, a, wrap, spin, { lift, rise: stack.rise, ratio: p.ratio ?? 1, held: !!(isAttached(p) && ctx) })
  return outer
}

/** Seated cable row station. See the top of this file. */
const ROW = { towerZ: 1.15, plateZ: 0.875, plateY: 0.36, tilt: 20 * D, rearZ: -0.52, stackZ: -0.26, H: 2.0 }

function rowStation(p, ctx) {
  const pos = p.pos || [0, 0, 0]
  const yaw = p.yaw || 0
  const W = worldOf(pos, yaw)
  const benchH = p.benchH ?? 0.42
  const R = ROW
  const { outer, inner: g } = worldGroup(pos, yaw)
  const desc = isAttached(p) ? { attachment: 'v-bar', ...p, key: p } : { attachment: p.attachment ?? 'v-bar' }
  // The machine at the far end is a compact tower, turned to face the sitter.
  outer.add(
    buildTower(p, ctx, desc, 0, {
      pos: W([0, 0, R.towerZ]).toArray(),
      yaw: yaw + 180,
      pinSide: p.pinSide ?? defaultPinSide(yaw + 180),
      pulleyY: p.pulleyY ?? 0.48,
      H: p.height ?? R.H,
      rearZ: R.rearZ,
      stackZ: R.stackZ,
      baseFront: 0.32,
      baseRear: -0.72,
      ratio: p.ratio ?? 1,
      fixed: true,
      pin: p.pin ?? 9,
      plates: p.plates ?? 20,
    }),
  )
  // Long beam on the floor, from the rear foot to the machine's front foot.
  const zRear = -0.72
  g.add(floorBeam(zRear, R.towerZ - 0.3, 0.1))
  g.add(crossFoot(zRear + 0.035, 0.28))

  // Bench on two legs, each with gussets and welds.
  const padLen = 0.95
  const padZ = -0.055
  const underPad = benchH - 0.075 - 0.012 - 0.012
  for (const z of [-0.44, 0.3]) {
    g.add(postY(0, z, yBaseTop, underPad, 0.07, 0.07, M.frame))
    g.add(weldY(0, yBaseTop + 0.002, z, 0.07))
    g.add(weldY(0, underPad - 0.005, z, 0.07))
    g.add(...gussets('bench', [0.11, 0.11], 0.038, yBaseTop, z + 0.035, 1), ...gussets('bench', [0.11, 0.11], 0.038, yBaseTop, z - 0.035, -1))
  }
  g.add(railZ(0, underPad + 0.006, -0.5, 0.36, 0.11, 0.012, M.frameDark, 0.003))
  const bench = pad(0.3, 0.075, padLen, { r: 0.03, crown: 0.012 })
  bench.position.set(0, benchH - 0.075 - 0.012, padZ)
  g.add(bench)

  // Foot plates: on a cross tube, leaning back, treads across them, a lip at the heel, a stiffener and a tube stay behind.
  const zc = R.plateZ
  const yc = R.plateY
  const up = new V3(0, Math.cos(R.tilt), Math.sin(R.tilt)) // along the plate, bottom to top
  const back = new V3(0, -Math.sin(R.tilt), Math.cos(R.tilt)) // out of the plate's rear
  const crossZ = zc + 0.1
  const crossY = 0.2
  g.add(postY(0, crossZ, yBaseTop, crossY - 0.02, 0.06, 0.06, M.frame))
  g.add(weldY(0, yBaseTop + 0.002, crossZ, 0.06))
  g.add(railX(crossZ, crossY, -0.17, 0.17, 0.05, 0.05, M.frame))
  for (const x of [-0.17, 0.17]) g.add(rbox(0.008, 0.053, 0.053, 0.002, M.cap, [x, crossY, crossZ], 2))
  for (const s of [1, -1]) {
    const x = s * 0.115
    const plate = group(rbox(0.15, 0.32, 0.012, 0.006, M.frameDark, [0, 0, 0.004]), rbox(0.15, 0.022, 0.032, 0.005, M.frameDark, [0, -0.16, -0.016]))
    for (let i = 0; i < 7; i++) plate.add(rbox(0.128, 0.018, 0.005, 0.002, M.tread, [0, -0.125 + i * 0.041, -0.0028], 2))
    plate.add(rbox(0.034, 0.25, 0.02, 0.004, M.frame, [0, -0.01, 0.019]))
    plate.position.set(x, yc, zc)
    plate.rotation.x = R.tilt
    g.add(plate)
    const stayTop = new V3(x, yc, zc).addScaledVector(up, 0.07).addScaledVector(back, 0.03)
    g.add(beam([x, crossY, crossZ], stayTop.toArray(), 0.03, 0.022, M.frame, 0.005))
  }
  return outer
}

/** Floor pulley. See the top of this file. */
function lowPulley(p, ctx) {
  const pos = p.pos || [0, 0, 0]
  const yaw = p.yaw || 0
  const W = worldOf(pos, yaw)
  const { outer, inner } = worldGroup(pos, yaw)
  const pivot = W([0, 0.2, 0])
  const a = new V3(0, -1, 0)
  const front = W([0, 0, 1]).sub(W([0, 0, 0]))
  const lying = pivot.clone().addScaledVector(front, 0.36)
  lying.y = 0.03
  const end = attachedEnd(p, ctx, exitFrom(pivot, a, front), lying, front.clone().negate())
  const wrap = solveWrap(pivot, a, end.bareEnd, GROOVE_R, front)
  const spin = wrap.len / GROOVE_R
  // Base plate, anchor bolts, pedestal.
  inner.add(rbox(0.24, 0.012, 0.24, 0.005, M.frameDark, [0, 0.006, 0], 2))
  for (const [x, z] of [[-0.095, -0.095], [0.095, -0.095], [-0.095, 0.095], [0.095, 0.095]]) inner.add(bolt([x, 0.012, z], '+y', 0.0092))
  inner.add(lathe([[0, 0.012], [0.058, 0.012], [0.058, 0.02], [0.04, 0.026], [0.03, 0.05], [0.0265, 0.08], [0.032, 0.09], [0.032, 0.098], [0, 0.098]], M.frame, [0, 0, 0], 'y', 32))
  addLiveCable(outer, end, pivot, a, wrap, spin)
  return outer
}

/** High pulley on a bracket. See the top of this file. */
function pulleyBracket(p, ctx) {
  const pos = p.pos || [0, 0, 0]
  const yaw = p.yaw || 0
  const W = worldOf(pos, yaw)
  const { outer, inner } = worldGroup(pos, yaw)
  const y = p.pulleyY ?? 2.15
  const mount = p.mount ?? 'post'
  const pivot = W([0, y + GROOVE_R, 0])
  const a = W([0, 0, -1]).sub(W([0, 0, 0]))
  const down = new V3(0, -1, 0)
  const hangAt = W([0, y - 0.2, GROOVE_R])
  const end = attachedEnd(p, ctx, exitFrom(pivot, a, down), hangAt)
  const wrap = solveWrap(pivot, a, end.bareEnd, GROOVE_R, down)
  const spin = wrap.len / GROOVE_R
  const runY = y + GROOVE_R
  const armRear = mount === 'none' ? -COLLAR_Y - 0.06 : -0.34
  // The arm: two plates, the collar bracket between them.
  const armTop = runY + 0.075
  const armUnder = runY - 0.012
  const armShape = () => roundedShape([[armRear - 0.05, armTop], [-0.045, armTop], [-0.03, armTop - 0.03], [-0.03, armUnder], [armRear - 0.05, armUnder]], 0.009)
  const px = TOWER.plateX
  for (const x of [-px, px]) inner.add(sidePlate(`bracketArm:${armRear}:${y}`, armShape, 0.01, M.sheet, x))
  inner.add(rbox(2 * px - 0.012, 0.05, 0.03, 0.005, M.frameDark, [0, runY + 0.022, -COLLAR_Y - 0.032]))
  inner.add(rbox(0.05, 0.05, 0.05, 0.005, M.frameDark, [0, runY + 0.027, -COLLAR_Y - 0.006]))
  if (mount === 'post') {
    const z = armRear
    inner.add(postY(0, z, yBaseTop, armTop - 0.005, TOWER.col))
    inner.add(weldY(0, yBaseTop + 0.002, z, TOWER.col))
    inner.add(group(floorBeam(z - 0.34, z + 0.34)))
    inner.add(crossFoot(z - 0.305, 0.3), crossFoot(z + 0.305, 0.3))
    inner.add(...gussets('post', [0.17, 0.17], px, yBaseTop, z + TOWER.col / 2, 1), ...gussets('post', [0.17, 0.17], px, yBaseTop, z - TOWER.col / 2, -1))
    for (const yy of [runY + 0.01, runY + 0.05]) {
      for (const [x, ax] of [[px + 0.005, '+x'], [-px - 0.005, '-x']]) {
        inner.add(bolt([x, yy, z + 0.02], ax, 0.0072))
        inner.add(bolt([x, yy, z - 0.02], ax, 0.0072))
      }
    }
  } else if (mount === 'wall') {
    inner.add(rbox(0.2, 0.3, 0.012, 0.006, M.frameDark, [0, runY + 0.02, armRear - 0.05]))
    for (const [x, yy] of [[-0.08, -0.11], [0.08, -0.11], [-0.08, 0.15], [0.08, 0.15]]) inner.add(bolt([x, runY + yy, armRear - 0.044], '+z', 0.0092))
  } else if (mount === 'beam') {
    inner.add(rbox(1.2, 0.08, 0.08, 0.007, M.frame, [0, armTop + 0.04, armRear - 0.01]))
    for (const x of [-0.03, 0.03]) inner.add(rbox(0.012, 0.12, 0.12, 0.004, M.sheet, [x, armTop + 0.03, armRear - 0.01]))
  }
  addLiveCable(outer, end, pivot, a, wrap, spin)
  return outer
}

/** Seated press with a cable and a handle on each side. See the top of this file. */
function pressStation(p, ctx) {
  const pos = p.pos || [0, 0, 0]
  const yaw = p.yaw || 0
  const W = worldOf(pos, yaw)
  const { outer, inner: g } = worldGroup(pos, yaw)
  const seatH = p.seatH ?? 0.46
  const lean = (p.backAngle ?? 8) * D
  const pulleyY = p.pulleyY ?? 0.9
  const px = p.pulleyX ?? 0.46
  const pz = p.pulleyZ ?? -0.1
  const colZ = -0.46 - Math.max(0, Math.sin(lean) - Math.sin(8 * D)) * 0.62
  const H = p.height ?? 2.0

  // The two swivel blocks at the tips of the arms. Each cable runs inside its arm.
  const towers = [
    { name: 'L', sx: 1 },
    { name: 'R', sx: -1 },
  ]
  let total = 0
  let count = 0
  const live = []
  for (const t of towers) {
    const pivotL = [t.sx * px, pulleyY, pz]
    const armRoot = [t.sx * 0.06, pulleyY, colZ + 0.02]
    const aDir = new V3(armRoot[0] - pivotL[0], 0, armRoot[2] - pivotL[2]).normalize()
    const pivot = W(pivotL)
    const a = W(aDir.toArray()).sub(W([0, 0, 0]))
    const front = W([0, 0, 1]).sub(W([0, 0, 0]))
    const desc = { key: p, attachment: p.attachment ?? 'd-handle' }
    if (p.hands || p.hand === t.name) desc.hand = t.name
    const idle = idleSpot(attachmentKind(desc), pivot, front)
    const end = attachedEnd(desc, ctx, exitFrom(pivot, a, front), idle.at, idle.up)
    const wrap = solveWrap(pivot, a, end.bareEnd, GROOVE_R, front)
    if (desc.hand) {
      total += wrap.len
      count++
    }
    live.push({ end, pivot, a, wrap, spin: wrap.len / GROOVE_R })
    // The arm: a square tube out from the sleeve, capped, carrying the collar's mount.
    const tip = new V3(...pivotL).addScaledVector(aDir, COLLAR_Y + 0.02)
    g.add(beam(armRoot, tip.toArray(), 0.05, 0.05, M.frame, 0.006))
    g.add(beam(tip.clone().addScaledVector(aDir, 0.004).toArray(), tip.clone().addScaledVector(aDir, -0.006).toArray(), 0.054, 0.054, M.frameDark, 0.003))
  }
  const lift = riseFor(p, {}, 0, count ? total / count : 0, p.ratio ?? 1, count > 0)
  for (const l of live) addLiveCable(outer, l.end, l.pivot, l.a, l.wrap, l.spin)

  // The stack and its column behind the back pad.
  const body = towerBody({ H, rearZ: -0.52, stackZ: -0.26, pulleyY: pulleyY - COLLAR_Y + 0.05, lift, plates: p.plates ?? 20, pin: p.pin ?? 7, pinSide: p.pinSide ?? defaultPinSide(yaw), yoke: true, baseFront: 0.2, baseRear: -0.72 })
  body.group.position.z = colZ
  g.add(body.group)

  // Floor beam forward, seat.
  g.add(floorBeam(colZ + 0.1, 0.3, 0.1))
  g.add(crossFoot(0.265, 0.125))
  adjustableSeat(g, seatH, 0)

  // Back pad on two struts from the column. Its front plane is 8.5 cm behind the sitter's hip joints along the pad's normal (measured on the
  // mesh for a straight spine), so root.pitch = -backAngle at the documented root.pos lays the back flat on it, at any angle.
  const n = new V3(0, Math.sin(lean), Math.cos(lean))
  const u = new V3(0, Math.cos(lean), -Math.sin(lean))
  const hip = new V3(0, seatH + 0.09, -0.03)
  const padT = 0.07
  const crown = 0.01
  const B = hip.clone().addScaledVector(n, -0.083 - padT - crown).addScaledVector(u, 0.29)
  const backPad = pad(0.34, padT, 0.62, { r: 0.028, crown })
  backPad.position.copy(B)
  backPad.quaternion.copy(basisQ(new V3(1, 0, 0), n))
  g.add(backPad)
  const sleeve = [pulleyY - 0.078 - 0.06, pulleyY + 0.082 + 0.06]
  const struts = []
  for (const t of [0.44, 0.52, 0.36, 0.28, 0.2, 0.12, 0.06]) {
    const y = B.y + (t - 0.29) * u.y - 0.012 * n.y
    if ((y < sleeve[0] || y > sleeve[1]) && struts.every((o) => Math.abs(o - t) >= 0.24) && struts.length < 2) struts.push(t)
  }
  for (const t of struts) {
    const at = B.clone().addScaledVector(u, t - 0.29).addScaledVector(n, -0.012)
    g.add(rbox(0.08, 0.012, 0.09, 0.003, M.frameDark, at.toArray(), 2))
    g.children[g.children.length - 1].quaternion.copy(basisQ(new V3(1, 0, 0), n))
    g.add(beam(at.toArray(), [0, at.y, colZ + 0.04], 0.05, 0.04, M.frameDark, 0.005))
    g.add(rbox(0.09, 0.09, 0.008, 0.003, M.frameDark, [0, at.y, colZ + 0.044], 2))
    for (const dx of [-0.032, 0.032]) g.add(bolt([dx, at.y + 0.03, colZ + 0.048], '+z', 0.0052), bolt([dx, at.y - 0.03, colZ + 0.048], '+z', 0.0052))
  }
  return outer
}

/** Only the attachment, or with `from` also its cable. Chains and pull-up bars use this. */
function attachmentProp(kind) {
  return (p, ctx) => {
    const outer = group()
    outer.userData.world = true
    const desc = { ...p, attachment: kind, key: p }
    if (p.from) {
      const from = v(p.from)
      const idleAt = p.to ? v(p.to) : from.clone().add(new V3(0, -0.2, 0))
      const end = attachedEnd(desc, ctx, () => from.clone(), idleAt)
      outer.add(...polyCable([from, end.bareEnd]), ...end.parts)
      return outer
    }
    const dir = v(p.dir || [0, 1, 0]).normalize()
    if (!isAttached(p) || !ctx) {
      const at = v(p.to || p.pos || [0, 0, 0])
      const up = dir.clone()
      const att = buildAttachment(kind, { attachment: kind, hands: true }, idleContext(kind, at, up), at.clone().addScaledVector(up, 1))
      outer.add(att.group)
      return outer
    }
    const s = p.hand || p.foot || 'L'
    const c = p.hands ? v(ctx.hands.L.centre).lerp(v(ctx.hands.R.centre), 0.5) : p.foot || p.feet ? v(ctx.feet[s].ankle) : v(ctx.hands[s].centre)
    const aim = p.aim ? v(p.aim) : c.clone().addScaledVector(dir, 1)
    outer.add(buildAttachment(kind, desc, ctx, aim).group)
    return outer
  }
}

export function buildWeightStack(opts) {
  return weightStack(opts)
}

export default {
  'cable-tower'(p, ctx) {
    const pos = p.pos || [0, 0, 0]
    const yaw = p.yaw || 0
    return buildTower(p, ctx, { ...p, key: p }, 0, { pos, yaw, pinSide: p.pinSide ?? defaultPinSide(yaw), pulleyY: clampPulley(p.pulleyY ?? 1.2, p.height ?? TOWER.H), H: p.height ?? TOWER.H, ratio: p.ratio ?? 0.5, pin: p.pin ?? 7, plates: p.plates ?? 20 })
  },
  'cable-crossover': crossoverBuilder(2.4),
  'cable-crossover-station': crossoverBuilder(2.4),
  'functional-trainer': crossoverBuilder(1.7),
  'lat-pulldown': latStation,
  'lat-pulldown-station': latStation,
  'seated-row': rowStation,
  'seated-row-station': rowStation,
  'seated-cable-press': pressStation,
  'seated-cable-press-machine': pressStation,
  'single-handle': attachmentProp('d-handle'),
  'rope-attachment': attachmentProp('rope'),
  'straight-bar-attachment': attachmentProp('straight-bar'),
  'lat-bar': attachmentProp('lat-bar'),
  'v-bar': attachmentProp('v-bar'),
  'angled-v-bar': attachmentProp('angled-v-bar'),
  'ez-attachment': attachmentProp('ez-attachment'),
  'ankle-cuff': attachmentProp('ankle-strap'),
  'low-pulley': lowPulley,
  'pulley-bracket': pulleyBracket,
  'weight-stack'(p) {
    const topY = p.topY ?? 2.1
    const g = group(weightStack({ plates: p.plates ?? 20, pin: p.pin ?? 7, lift: p.lift ?? 0, topY }).group)
    // Its own frame: a base on rubber feet, two posts, a top rail.
    const hx = 0.2
    const sideRail = (x) => railZ(x, yBaseMid, -0.24, 0.24, 0.06, 0.05)
    g.add(sideRail(-hx), sideRail(hx), railX(0, yBaseMid + 0.012, -hx, hx, 0.18, 0.026, M.frameDark, 0.004))
    for (const x of [-hx, hx]) {
      g.add(postY(x, 0, yBaseTop, topY + 0.03, 0.06), weldY(x, yBaseTop + 0.002, 0, 0.06))
      for (const z of [-0.2, 0.2]) g.add(foot(x, z))
      g.add(...[1, -1].map((s) => rbox(0.064, 0.054, 0.01, 0.003, M.cap, [x, yBaseMid, s * 0.24])))
      g.add(rbox(0.084, 0.03, 0.05, 0.005, M.frameDark, [Math.sign(x) * ROD_X, topY + 0.005, 0]))
    }
    g.add(railX(0, topY + 0.03, -hx - 0.03, hx + 0.03, 0.06, 0.05, M.frame))
    return g
  },
  cable(p, ctx) {
    const from = v(p.from)
    const outer = group()
    outer.userData.world = true
    const idleAt = p.to ? v(p.to) : from.clone().add(new V3(0, -0.2, 0))
    if (p.wheel) {
      // `from` is the pivot of a free swivel block, `axis` the way the cable comes from.
      const a = v(p.axis || [0, 1, 0]).normalize()
      const fallback = perpUnit(new V3(0, 0, 1), a)
      const end = attachedEnd(p, ctx, exitFrom(from, a, fallback), idleAt)
      const wrap = solveWrap(from, a, end.bareEnd, GROOVE_R, fallback)
      addLiveCable(outer, end, from, a, wrap, wrap.len / GROOVE_R)
      return outer
    }
    const end = attachedEnd(p, ctx, () => from.clone(), idleAt)
    outer.add(...polyCable([from, end.bareEnd]))
    outer.add(...end.parts)
    return outer
  },
}
