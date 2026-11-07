// Gym machines, one builder per type, all drawn in the same kit: square and oval steel, chrome rods, upholstered pads with piping
// and stitching, rubber feet, wheels and cables, selector stacks and iron plates. A worked pose for every type is in
// specs/_gallery/<type>.json (and -stack, -incline, -decline, -reverse, -adductor, -shrug, smith-bench): start from those.
//
// USING ONE
//   { "type": "leg-press", "pos": [0,0,0], "follow": true }   Metres, local axes: figure faces +Z, +X is its LEFT, origin on the floor.
//   follow: true    rebuild per frame so the moving part goes where the body is. Without it the machine stands at rest (or angle/s/t/barY).
//   pos, yaw        moves it. All numbers below are local: keep pos [0,0,0], yaw 0 unless you must, and turn the camera instead.
//   mirror: true    swaps the machine's left and right. Levers, cams and pivots on one side are on -X (the figure's right), so a
//                   camera on +X (az 30..120) sees the body unhidden. With a camera on -X, set mirror.
//   angle (deg)     the lever's angle when static, as far as a machine has one.
// A handle's centre is where ctx.hands.*.centre must be; radius 0.0165, so "grip": 0.0165. "hand [x,y,z]" below is that centre: today it is
// armL.pos with contact:true (the gallery's way). The bar runs along the thumb: fingers and palm below keep it so. The handle (and the
// lever it is on) follows the hand, the hand does not snap to it: put the hand exactly on the numbers below. Levers swing on arcs, hands interpolate on straight
// lines, so give a machine with a long swing a "mid" frame on the arc, as the gallery does. Better still use fk arms and legs for
// anything turning around a joint (leg extension, curls, arm machines): fk moves on a true arc, and the pad stays on the limb exactly.
//
// WHERE THE BODY GOES. Hips = root.pos at start. y above seat = 0.098 for a seated figure. Back pads sit 0.092 behind the trunk's line
// through the hips. Hand targets below are for the figure's left hand: for the right, negate x (and fingers.x, palm.x, pole.x).
//
// leg-extension   (leg-extensions, single-leg-leg-extension with side:"L") params seatY=0.5, side, angle.
//   Hips [0,seatY+.098,0], root.pitch -10. Knee on the pivot line y=hips, z=.425: legs { fk:{flex:90,abd:2,knee:90 -> 5}, rel:"world" }.
//   Rollers .335 down the shin, in front of it. Handles run along Z by the hips: hand [.255,seatY+.015,.07], fingers [0,-1,.12], palm [-1,0,0], pole [.35,0,-1].
// seated-leg-curl (seated-leg-curl) same chassis. Legs fk flex 92, knee 6 -> 100. Rollers .36 down the shin, behind the calf. Lap pad's face
//   y=hips+.098 over z .265-.395, fixed. Handles as leg-extension.
// lying-leg-curl  (lying-leg-curls) Hips [0,.72,0], root.pitch 100, neck.flex -42. Knee pivot [y .633, z -.41]: legs { fk:{flex:-78,abd:2,knee:6 -> 112},
//   rel:"world" }. Roller .36 from the knee, behind the ankle. Handles under the chest pad, neutral: hand [.27,.44,.645], fingers [0,-.6,.8],
//   palm [-1,0,0], pole [.3,-.9,0]. Thigh and chest pads carry the front of the body with hips where they are.
// standing-leg-curl (standing-leg-curl) one leg: the left. Hips [0,1.02,0], root.pitch 32, neck.flex -26. Left leg { fk:{flex:18,abd:2,knee:8 -> 112},
//   rel:"world" }, knee pivot [y .61, z .133], roller .355 down the shin behind it. Right sole [-.11,.12,-.05] on the step. Forearm rest top y 1.10 at
//   z .35-.69. Handles: hand [.19,1.12,.72], fingers [.02,-.1,1], palm [0,-1,-.1], pole [.25,-1,-.2]. Use muscleSide "L". Follows p.side (default L).
// leg-press       (leg-press, narrow-stance-leg-press, calf-press-on-the-leg-press-machine) 45 degree sled. Hips [0,.42,0], root.pitch -50, neck.flex 12.
//   Rails go along r=[0,.707,.707]; toes point along f=[0,.707,-.707]. Each sole at hips + w*r + .04*f, x=+-.125 (narrow: +-.05), anchor "sole", pitch -135,
//   pole [0,.75,-.65]. w=.90 legs nearly straight, w=.65 knees at 96. The sled's face follows the soles along r: keep them on that line.
//   Calf press: prop anchor:"ball" (the sled then follows the balls). Each ball at hips + w*r - .2*f, heels off the plate's lower edge, anchor "ball", toes follow; pitch -150, w .80 -> pitch -105, w .89.
//   Plate is .72 wide, .56 along f. Handles by the hips, neutral: hand [.305,.425,.03], fingers [0,-.59,.81], palm [-1,0,0], pole [.2,-.75,-.65].
// hack-squat      (hack-squat, narrow-stance-hack-squats) r=[0,.743,-.669] up the rails, nb=[0,.669,.743] out of the back pad. Soles on the fixed plate at
//   [+-.125,.24,0] (narrow: +-.05), anchor "sole", pitch -25, pole [0,.2,1]. Hips = [0,.911,-.628] + t*r, root.pitch -42, neck.flex 16: t=0 legs nearly
//   straight, t=-.28 knees at 100. The carriage follows the pelvis along r. Hands move with it: hips + .585*r + .03*nb, x=.28, fingers r, palm nb,
//   pole [.85,-.5,.15].
// standing-calf   (standing-calf-raises, calf-machine-shoulder-shrug) Balls [+-.11,.14,.06], anchor "ball", toes 0. Foot pitch -14: hips [0,1.03,-.04]. Foot
//   pitch 28: hips [0,1.116,0]. Yoke pads rest on the shoulders, following the shoulder joints: pad faces y = shoulder joint + .065. Handles on the
//   yoke: hand [.301,1.59,.07] -> [.301,1.64,.052], fingers [0,.95,.3], palm [0,-.3,.95], pole [.8,-.6,.1]. A shrug: shoulders rise with scap.elev, feet flat.
// seated-calf     (seated-calf-raise) Hips [0,.598,0], root.pitch -3. Balls [+-.12,.115,.585], anchor "ball", toes 0, pitch -18 -> 24, pole [0,.2,1]. Pads sit on the
//   lower thighs, following the knees (knee + [0,.1,-.085]). Handles on the pad: hand [.1,.777,.365] at pitch -18, [.1,.836,.309] at pitch 24.
// chest-press     (machine-bench-press load:"stack", leverage-chest-press; variant:"incline"|"decline" for those) Plates by default. Hips [0,.538,0], neck 4,
//   legs { fk:{flex:88,abd:6,knee:84}, rel:"world" }. Each hand drives its own lever (plates) or both share one yoke (stack). From -> to, with mid on the arc:
//     flat     root.pitch -12: hand [.25,.93,.2] -> [.236,.95,.479]  (stack: x stays .25). Pivot [.443,1.616,.302]. fingers [0,.6,.8]->[0,.5,.87], palm [0,-.8,.6]->[0,-.87,.5].
//     incline  root.pitch -30: hand [.25,.95,-.02] -> [.235,1.15,.203]. Pivot [.442,1.559,-.353]. fingers [0,.85,.52], palm [0,-.52,.85].
//     decline  root.pitch -8:  hand [.25,.84,.21] -> [.236,.768,.48]. Pivot [.443,1.455,.53]. fingers [0,.45,.89]->[0,.25,.97], palm [0,-.89,.45]->[0,-.97,.25].
//     pole [1,-.3,-.6] -> [1,-.6,-.1]. pressArc(name, side, conv) in this file gives the arc; conv 0 for stack.
// shoulder-press  (leverage-shoulder-press, machine-shoulder-military-press load:"stack") Hips [0,.538,0], root.pitch -8. Hand [.27,1.1,.04] -> [.249,1.517,.084] (stack: x stays .27),
//   pivot [.459,1.387,-.592], fingers [0,.75,-.66], palm [0,.66,.75], pole [1,-.5,0] -> [1,-.1,.1].
// pec-deck        (butterfly; reverse-machine-flyes with mode:"reverse") Hips [0,.538,0], root.pitch -5. Axles over the shoulders at [+-.19,1.42,-.02]; handles .565 out, centre y 1.0, grip vertical.
//   Fly: arms { fk:{flex:90,abd:72 -> -12,rot:90,elbow:14}, rel:"world", fingers:[sin a,0,cos a], palm:[-cos a,0,sin a], scap:{elev:0,prot:0} } (a = abd; right arm mirrors fingers and palm x).
//   Reverse: root { pos:[0,.538,.03], yaw:180, pitch:-2 }, chest on the pad, knees either side of its rail (legs fk flex 86, abd 18, knee 90, rel pelvis), arms rel "chest" abd 8 -> 98, elbow 8.
// high-row        (leverage-high-row) Hips [0,.598,0], root.pitch 6 -> -3, legs fk flex 84 knee 84. Thigh roller's underside y .71 at z .33, fixed. Hand [.24,1.346,.538] -> [.24,1.137,.297] on an arc
//   around [y 1.86, z -.12], R .835: rowHand("high", a) with a 52 -> 30. fingers [0,.55,.85] -> [0,.1,1], palm [0,-.85,.55] -> [0,-1,.1], pole [.5,-.8,0] -> [.4,-.5,-.8].
// iso-row         (leverage-iso-row) Hips [0,.558,0], root.pitch 5, chest pad's face z .178 at y .885. Hand [.24,1.023,.62] -> [.24,1.026,.232]: rowHand("iso", a), a 15.5 -> -14.5, around [y .3, z .42], R .75.
//   Neutral grip, vertical at the start and tilting with the lever: fingers [-.12,0,1], palm [-1,0,-.12] turned around X by a-15.5, pole [.5,-.8,0] -> [.35,-.3,-1].
// dip-machine     (dip-machine) Hips [0,.558,0], root.pitch -8. Hand [.31,.72,.06] -> [.31,.46,.02] with a mid on the arc around [y .481, z .75]: the handle is the lever's end, along it, so the thumb points
//   down the lever. fingers [.906,-.405,-.121] -> [.906,-.423,.002], palm [-.423,-.868,-.259] -> [-.423,-.906,.005], pole [.25,-.2,-1] -> [.25,-.1,-1].
// machine-curl    (machine-bicep-curl) Hips [0,.578,0], root.pitch 4. Arms { fk:{flex:55,abd:0,elbow:12 -> 108}, rel:"world", fingers, palm, scap:{elev:0,prot:6} }: elbow pivot [.194,.869,.3].
//   With q = flex+elbow: fingers [0,-cos q,sin q], palm [0,sin q,cos q].
// machine-preacher (machine-preacher-curls) Hips [0,.618,0], root.pitch 8. Same arms with flex 50, elbow 12 -> 112, elbow pivot [.194,.883,.317]. One bar across both hands.
// machine-triceps (machine-triceps-extension) Hips [0,.578,0], root.pitch -6, back pad. Same arms with flex 72, elbow 118 -> 10, palm negated: [0,-sin q,-cos q], elbow pivot [.194,.948,.258].
// hip-machine     (thigh-abductor mode:"abductor" default, thigh-adductor mode:"adductor") Hips [0,.558,0], root.pitch -16. Legs { fk:{flex:90,abd:2 -> 32,knee:84}, rel:"world", foot:{pitch:2} }
//   (adductor: abd 32 -> 4). Each arm turns on a vertical axle under its hip joint, following that knee. Handles: hand [.27,.49,.045], fingers [0,-1,.12], palm [-1,0,0], pole [.35,0,-1].
// ab-crunch       (ab-crunch-machine) Hips [0,.658,0], root.pitch -14. spine { flex:-2 -> 36, weights:[0,.1,.3,.35,.25] }, neck 8 -> 22. Arms rel "chest": pos [.24,.31,.11], contact, fingers [0,.9,-.42],
//   palm [0,.42,.9], pole [.5,-.5,1], scap {elev:6,prot:6}. Legs { fk:{flex:75 -> 95,abd:4,knee:65 -> 80}, rel:"world", foot:{pitch:12} }. The top lever follows the hands around [y .811, z -.071],
//   the ankle lever the ankles around [y .361, z .01]. Another pose needs those two centres moved: they come from the hand and ankle paths.
// smith           (every smith-*; decline-smith-press, chair-squat, lunge-sprint) Bar along X at z=0, y free. follow: true or "hands" (mean of hand centres), "hand-L"/"hand-R", "shoulders" (mean
//   shoulder joint + offset, default .07), "feet" (soles - offset, default .016), "hips" (pelvis + offset). Static: no follow, barY=1.3. tilt: rods' lean in degrees. Rods at x +-.64, rear posts z -.44,
//   hook ladder z -.14, top rails to z .18, height 2.27, base rails x +-.72 from z -.62 to .6; plates: [[dia,thick],...].
//   Back squat: root [0,.915,.14] pitch 8 -> [0,.56,0] pitch 26 spine.flex 8; soles [+-.15,0,.12]; hand [.36,bar y,0], fingers [.05,.75,-.65], palm [0,.65,.75], pole [.6,-.8,-.1]. Bar y 1.43 -> 1.03.
//   Bench press: flat-bench at pos [0,0,.08]; root [0,.545,.28] pitch -90; hand [.33,bar y,0], fingers [0,.35,-.94], palm [0,.94,.35], pole [.8,-.5,.1]. Bar y 1.06 -> .73. See smith-bench.json.
// lying-t-bar     (lying-t-bar-row) Hips [0,1.1,0], root.pitch 45, neck -30. Soles [+-.11,.24,-.246], pitch 0, toes 0. Hand [.24,.848,.394] -> [.24,1.081,.231]: tbarHand(a), a 28 -> 42, around [y .3, z -.636], R 1.167.
//   fingers [0,-1,.1] -> [0,-.55,.85], palm [0,-.1,-1] -> [0,-.85,-.55], pole [.6,.2,-.7] -> [.5,.7,-.6].
// leverage-lift   (leverage-deadlift grip:"bottom", leverage-shrug grip:"top") Deck top y .09: soles [+-.13,.09,.06], anchor "sole". Handles run along Z at x +-.3, lever at rest: bottom y .49, top y .69, z centre .02.
//   Deadlift: root [0,.69,-.15] pitch 42 neck -30, hand [.3,.49,.02] -> root [0,.995,-.015] pitch 2, hand [.3,.895,.02]. Shrug (grip:"top"): root [0,.995,-.01], hand [.3,.895,.02] -> [.3,.94,.02] with scap.elev 0 -> 12.
//   fingers [0,-1,.05], palm [-.95,-.15,0], pole [.25,0,-1]. Each lever follows its hand.
// reverse-hyper   (reverse-hyperextension) Belly pad top y 1.12, from z .14 to .86. Hips [0,1.245,0], root.pitch 90, neck -46. Legs { fk:{flex:14 -> -28,abd:1,knee:3}, rel:"world", foot:{pitch:18} }.
//   The pendulum turns on the line through the hip joints, following the ankles. Handles: hand [.2,.943,.94], fingers [0,-.3,.95], palm [0,-.95,-.3], pole [.8,.4,-.2].
// lying-squat     (lying-machine-squat) r=[0,.342,.94] up the rails, n=[0,.94,-.342] out of the back pad. Soles on the fixed plate [+-.125,.9,0], anchor "sole", pitch -110, pole [0,.94,-.34]. Hips = [0,.838,-.052] - t*r,
//   root.pitch -110, neck 14: t=.58 deep (knees 95), t=.84 nearly straight. The carriage follows the pelvis. Hands move with it: hips - .32*r - .025*n, x=.295, fingers [0,.3,.95], palm [-1,0,.1], pole [.8,-.2,.4].
// seated-leg-press (calf-press with anchor:"ball") Sled on low rails. Hips [0,.598,0], root.pitch -20, neck 10. Plate's face leans 8 degrees: soles at [+-.13,y,s+(y-.5)*.1405], anchor "sole", pitch -82, pole [0,1,0]; s=.9 nearly
//   straight, .6 knees at 100. Calf press: prop anchor:"ball", feet anchor "ball" at the plate's lower part, heels hanging off it: see seated-leg-press-calf.json. Handles as leg-extension with seatY .5: hand [.255,.515,.07].
//
// Not here: glute-ham-raise (ghd) and donkey-calf-raises (donkey-calf) are in benches.js.
import { kit, mat } from './kit.js'

const { THREE } = kit
const { Vector3: V3, Quaternion: Q4, Matrix4: M4, BufferGeometry, BufferAttribute } = THREE
const D = Math.PI / 180
const std = (o) => new THREE.MeshStandardMaterial(o)
const vec = (a) => (a instanceof V3 ? a.clone() : new V3(a[0], a[1], a[2]))
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const lerp = (a, b, t) => a + (b - a) * t
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

// ---------------------------------------------------------------------------------------------------------------------
// Materials. Lighter than the shared ones where the machines need it: nothing may vanish into the black background.
// ---------------------------------------------------------------------------------------------------------------------
// Painted and upholstered surfaces: at a low camera a top face is seen at a grazing angle, and a standard material then flashes white. A
// lower specular level keeps them matte however low the camera goes.
const matte = (o) => new THREE.MeshPhysicalMaterial({ specularIntensity: 0.38, ...o })
const M = {
  frame: matte({ color: 0x5f6269, metalness: 0.15, roughness: 0.74, envMapIntensity: 0.8 }), // powder-coated steel, the main structure
  frameDark: matte({ color: 0x44464c, metalness: 0.15, roughness: 0.76, envMapIntensity: 0.8 }), // secondary structure, brackets
  arm: matte({ color: 0x858990, metalness: 0.2, roughness: 0.56, specularIntensity: 0.42 }), // moving levers: lighter, so the motion reads
  chrome: mat.chrome,
  steel: mat.steel,
  pad: matte({ color: 0x2e2f34, metalness: 0, roughness: 0.62, envMapIntensity: 0.8, specularIntensity: 0.5 }), // leatherette
  piping: std({ color: 0x505157, metalness: 0, roughness: 0.55 }),
  stitch: std({ color: 0x74767c, metalness: 0, roughness: 0.8 }),
  grip: std({ color: 0x2c2d30, metalness: 0, roughness: 0.7 }),
  rubber: std({ color: 0x1f1f21, metalness: 0, roughness: 0.78 }),
  cap: std({ color: 0x232325, metalness: 0, roughness: 0.55 }),
  iron: std({ color: 0x3a3b40, metalness: 0.55, roughness: 0.46 }), // weight plates
  stack: matte({ color: 0x4a4c52, metalness: 0.15, roughness: 0.7, envMapIntensity: 0.7 }), // selector stack plates
  hole: std({ color: 0x050506, metalness: 0, roughness: 1 }),
  cable: std({ color: 0x6d7077, metalness: 0.75, roughness: 0.36 }),
  tread: matte({ color: 0x6b6e74, metalness: 0.4, roughness: 0.55, specularIntensity: 0.5 }), // foot plates
  roller: std({ color: 0x2e2f33, metalness: 0, roughness: 0.72 }),
}

// ---------------------------------------------------------------------------------------------------------------------
// Geometry. Everything is cached by its parameters and merged per material when an assembly is baked, so rebuilding a
// machine for each frame of a loop costs a few clones.
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

function indexed(pos, nor, idx) {
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3))
  g.setIndex(idx)
  return g
}

/** Points around a rounded rectangle, counter-clockwise, each with its outward normal: [x, y, nx, ny]. */
function sectionRing(w, h, r, cs) {
  const rr = Math.min(r, w / 2, h / 2)
  const pts = []
  for (const [cx, cy, a0] of [[w / 2 - rr, h / 2 - rr, 0], [-w / 2 + rr, h / 2 - rr, 90], [-w / 2 + rr, -h / 2 + rr, 180], [w / 2 - rr, -h / 2 + rr, 270]]) {
    for (let i = 0; i <= cs; i++) {
      const a = (a0 + (i * 90) / cs) * D
      pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a), Math.cos(a), Math.sin(a)])
    }
  }
  return pts
}

/** Sweeps a section along a list of points. `side` is the direction of the section's width at the first point. */
function sweepGeometry(path, w, h, r, side, { caps = true, cs = 4 } = {}) {
  const sec = sectionRing(w, h, r, cs)
  const pos = []
  const nor = []
  const idx = []
  const ns = sec.length
  const tangents = path.map((_, i) => {
    const a = path[Math.max(0, i - 1)]
    const b = path[Math.min(path.length - 1, i + 1)]
    return b.clone().sub(a).normalize()
  })
  let s = side.clone().addScaledVector(tangents[0], -side.dot(tangents[0])).normalize()
  const q = new Q4()
  path.forEach((p, i) => {
    if (i > 0) {
      q.setFromUnitVectors(tangents[i - 1], tangents[i])
      s.applyQuaternion(q)
      s.addScaledVector(tangents[i], -s.dot(tangents[i])).normalize()
    }
    const t = tangents[i]
    const b = t.clone().cross(s).normalize() // s x b = t
    for (const [x, y, nx, ny] of sec) {
      pos.push(p.x + s.x * x + b.x * y, p.y + s.y * x + b.y * y, p.z + s.z * x + b.z * y)
      nor.push(s.x * nx + b.x * ny, s.y * nx + b.y * ny, s.z * nx + b.z * ny)
    }
  })
  for (let i = 0; i + 1 < path.length; i++) {
    for (let j = 0; j < ns; j++) {
      const a = i * ns + j
      const b = i * ns + ((j + 1) % ns)
      const c = (i + 1) * ns + ((j + 1) % ns)
      const d = (i + 1) * ns + j
      idx.push(a, b, d, b, c, d)
    }
  }
  if (caps) {
    for (const [i, sgn] of [[0, -1], [path.length - 1, 1]]) {
      const base = pos.length / 3
      const t = tangents[i]
      const p = path[i]
      pos.push(p.x, p.y, p.z)
      nor.push(t.x * sgn, t.y * sgn, t.z * sgn)
      for (let j = 0; j < ns; j++) {
        const o = (i * ns + j) * 3
        pos.push(pos[o], pos[o + 1], pos[o + 2])
        nor.push(t.x * sgn, t.y * sgn, t.z * sgn)
      }
      for (let j = 0; j < ns; j++) {
        const a = base + 1 + j
        const b = base + 1 + ((j + 1) % ns)
        if (sgn > 0) idx.push(base, a, b)
        else idx.push(base, b, a)
      }
    }
  }
  return indexed(pos, nor, idx)
}

/** The section's width direction at the far end of a sweep. */
function transported(path, side) {
  const ts = path.map((_, i) => path[Math.min(path.length - 1, i + 1)].clone().sub(path[Math.max(0, i - 1)]).normalize())
  const s = side.clone()
  for (let i = 1; i < path.length; i++) s.applyQuaternion(new Q4().setFromUnitVectors(ts[i - 1], ts[i]))
  return s
}

/** A polyline with its corners replaced by arcs: what a mandrel bend does to a tube. radius may be one number or a list per corner. */
function filletPath(points, radius, step = 9 * D) {
  const pts = points.map(vec)
  const out = [pts[0].clone()]
  for (let i = 1; i + 1 < pts.length; i++) {
    const p = pts[i]
    const d0 = p.clone().sub(pts[i - 1])
    const l0 = d0.length()
    d0.divideScalar(l0)
    const d1 = pts[i + 1].clone().sub(p)
    const l1 = d1.length()
    d1.divideScalar(l1)
    const phi = Math.acos(clamp(d0.dot(d1), -1, 1))
    if (phi < 1e-3) {
      out.push(p.clone())
      continue
    }
    const want = Array.isArray(radius) ? radius[i - 1] : radius
    const t = Math.min(want * Math.tan(phi / 2), l0 * 0.49, l1 * 0.49)
    const R = t / Math.tan(phi / 2)
    const a = p.clone().addScaledVector(d0, -t)
    const n = d1.clone().addScaledVector(d0, -d0.dot(d1)).normalize()
    const c = a.clone().addScaledVector(n, R)
    const steps = Math.max(2, Math.ceil(phi / step))
    for (let k = 0; k <= steps; k++) {
      const ang = (phi * k) / steps
      out.push(c.clone().addScaledVector(n, -R * Math.cos(ang)).addScaledVector(d0, R * Math.sin(ang)))
    }
  }
  out.push(pts[pts.length - 1].clone())
  return out
}

/**
 * An upholstered pad. Local axes: X across (w), Z along (l), Y out of the contact surface; the base is at y = 0, the edge of
 * the contact surface at y = t and its centre at y = t + crown. Concentric rings, so the rim stays round however long the pad.
 *   r rim radius, rc corner radius seen from above, crown bulge, taper narrows the +Z end (0.2 = 20 %), fall bends the +Z end
 *   down like a seat's waterfall edge, dish hollows it across X, like an arm rest.
 */
function padShape({ w, l, t, r = 0.02, rc = 0.04, crown = 0.01, taper = 0, fall = 0, dish = 0 }) {
  const hw = w / 2
  const hl = l / 2
  const rcc = Math.min(rc, hw - 1e-3, hl - 1e-3)
  const emax = Math.min(hw, hl) * 0.985
  const CS = 6
  const nX = Math.max(2, Math.round(w / 0.05))
  const nZ = Math.max(2, Math.round(l / 0.05))
  // The outline inset by e.
  const ring = (e) => {
    const a = hw - e
    const b = hl - e
    const rr = Math.max(rcc - e, 0.0005)
    const out = []
    const seg = (x0, z0, x1, z1, n) => {
      for (let i = 0; i < n; i++) out.push([lerp(x0, x1, i / n), lerp(z0, z1, i / n)])
    }
    const arc = (cx, cz, a0) => {
      for (let i = 0; i < CS; i++) {
        const q = (a0 - (i * 90) / CS) * D
        out.push([cx + rr * Math.cos(q), cz + rr * Math.sin(q)])
      }
    }
    // Counter-clockwise seen from +Y: the +X side toward -Z, the -Z side toward -X, and so on.
    seg(a, b - rr, a, -b + rr, nZ)
    arc(a - rr, -b + rr, 0)
    seg(a - rr, -b, -a + rr, -b, nX)
    arc(-a + rr, -b + rr, -90)
    seg(-a, -b + rr, -a, b - rr, nZ)
    arc(-a + rr, b - rr, 180)
    seg(-a + rr, b, a - rr, b, nX)
    arc(a - rr, b - rr, 90)
    return out
  }
  const lift = (x, z) => {
    const u = clamp(x / hw, -1, 1)
    const v = clamp(z / hl, -1, 1)
    return { c: (1 - u * u) * (1 - v * v), d: 1 - u * u, f: smoothstep(0.35, 1, v) }
  }
  const place = (x, z, y, e) => {
    const k = lift(x, z)
    const on = smoothstep(0, r * 1.6 + 0.012, e)
    const yy = y + on * (crown * k.c - dish * k.d) - fall * k.f * k.f
    const xx = x * (1 - taper * smoothstep(-1, 1, z / hl))
    return [xx, yy, z]
  }
  return { hw, hl, ring, place, emax, r, t, CS }
}

function padGeometry(o) {
  return cached(`pad${JSON.stringify(o)}`, () => {
    const { ring, place, emax, r, t } = padShape(o)
    const profile = [] // [inset, height]
    profile.push([0.0015, 0])
    profile.push([0, 0.004])
    if (t - r > 0.006) profile.push([0, t - r])
    for (let i = 1; i <= 6; i++) {
      const a = (i / 6) * (Math.PI / 2)
      profile.push([r * (1 - Math.cos(a)), t - r + r * Math.sin(a)])
    }
    const inner = 6
    for (let i = 1; i <= inner; i++) profile.push([lerp(r, emax, i / inner), t])
    const rings = profile.map(([e, y]) => ring(e).map(([x, z]) => place(x, z, y, e)))
    const n = rings[0].length
    const pos = []
    const idx = []
    for (const rg of rings) for (const p of rg) pos.push(p[0], p[1], p[2])
    for (let i = 0; i + 1 < rings.length; i++) {
      for (let j = 0; j < n; j++) {
        const a = i * n + j
        const b = i * n + ((j + 1) % n)
        const c = (i + 1) * n + ((j + 1) % n)
        const d = (i + 1) * n + j
        idx.push(a, b, d, b, c, d)
      }
    }
    // Close the top with a fan and the bottom with another.
    const last = (rings.length - 1) * n
    let cx = 0
    let cy = 0
    let cz = 0
    for (let j = 0; j < n; j++) {
      cx += pos[(last + j) * 3]
      cy += pos[(last + j) * 3 + 1]
      cz += pos[(last + j) * 3 + 2]
    }
    const top = pos.length / 3
    pos.push(cx / n, cy / n, cz / n)
    for (let j = 0; j < n; j++) idx.push(last + j, last + ((j + 1) % n), top)
    const bot = pos.length / 3
    pos.push(0, 0, 0)
    for (let j = 0; j < n; j++) idx.push((j + 1) % n, j, bot)
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  })
}

/** The piping along a pad's edge: a thin bead following the outline, where the top panel meets the sides. */
function pipingGeometry(o) {
  return cached(`pip${JSON.stringify(o)}`, () => {
    const { ring, place, r, t } = padShape(o)
    const pr = 0.0028
    const y = t - r * 0.28
    const e = r * (1 - Math.cos(Math.asin(0.72))) * 0.6
    const pts = ring(e).map(([x, z]) => new V3(...place(x, z, y, e)))
    const n = pts.length
    const SEG = 6
    const pos = []
    const nor = []
    const idx = []
    for (let i = 0; i < n; i++) {
      const t0 = pts[(i + 1) % n].clone().sub(pts[(i - 1 + n) % n]).normalize()
      const out = t0.clone().cross(new V3(0, 1, 0)).normalize()
      const up = new V3(0, 1, 0)
      for (let k = 0; k < SEG; k++) {
        const a = (k / SEG) * Math.PI * 2
        const nx = out.x * Math.cos(a) + up.x * Math.sin(a)
        const ny = out.y * Math.cos(a) + up.y * Math.sin(a)
        const nz = out.z * Math.cos(a) + up.z * Math.sin(a)
        pos.push(pts[i].x + nx * pr, pts[i].y + ny * pr, pts[i].z + nz * pr)
        nor.push(nx, ny, nz)
      }
    }
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < SEG; k++) {
        const a = i * SEG + k
        const b = i * SEG + ((k + 1) % SEG)
        const c = ((i + 1) % n) * SEG + ((k + 1) % SEG)
        const d = ((i + 1) % n) * SEG + k
        idx.push(a, d, b, b, d, c)
      }
    }
    return indexed(pos, nor, idx)
  })
}

/** Double stitching on the contact surface, a little inside the edge: small raised dashes. */
function stitchGeometry(o) {
  return cached(`sti${JSON.stringify(o)}`, () => {
    const { ring, place, r, t } = padShape(o)
    const pos = []
    const nor = []
    const idx = []
    const halfW = 0.0009
    for (const inset of [r + 0.006]) {
      const pts = ring(inset).map(([x, z]) => new V3(...place(x, z, t, inset)))
      const n = pts.length
      const DASH = 0.0065
      const GAP = 0.0035
      let along = 0
      let drawing = true
      let left = DASH
      let a = pts[0].clone()
      for (let i = 0; i < n; i++) {
        const b = pts[(i + 1) % n]
        let seg = a.distanceTo(b)
        let from = a.clone()
        while (seg > 1e-6) {
          const take = Math.min(seg, left)
          const to = from.clone().lerp(b, take / seg)
          if (drawing) {
            const d = to.clone().sub(from)
            const len = d.length() || 1
            const sideV = new V3(-d.z / len, 0, d.x / len).multiplyScalar(halfW)
            const base = pos.length / 3
            for (const [q, s] of [[from, -1], [from, 1], [to, -1], [to, 1]]) {
              pos.push(q.x + sideV.x * s, q.y + 0.0008, q.z + sideV.z * s)
              nor.push(0, 1, 0)
            }
            idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base, base + 2, base + 1, base + 1, base + 2, base + 3)
          }
          seg -= take
          left -= take
          from = to
          along += take
          if (left <= 1e-6) {
            drawing = !drawing
            left = drawing ? DASH : GAP
          }
        }
        a = b.clone()
      }
    }
    return indexed(pos, nor, idx)
  })
}

// ---------------------------------------------------------------------------------------------------------------------
// Assemblies: collect parts in a local frame, then bake them into one mesh per material.
// ---------------------------------------------------------------------------------------------------------------------
/** The orientation that sends +Y along dir and +X as near as possible along side. */
function basis(dir, side) {
  const y = dir.clone().normalize()
  let x = side ? vec(side) : Math.abs(y.x) < 0.9 ? new V3(1, 0, 0) : new V3(0, 0, 1)
  x.addScaledVector(y, -x.dot(y))
  if (x.lengthSq() < 1e-8) x = Math.abs(y.x) < 0.9 ? new V3(1, 0, 0) : new V3(0, 0, 1)
  x.normalize()
  const z = x.clone().cross(y).normalize()
  return new M4().makeBasis(x, y, z)
}

/** Is point p inside the straight run seg (a tube's body or its very end)? Used to leave out plugs that would poke through a joint. */
function insideTube(p, seg) {
  const d = seg.B.clone().sub(seg.A)
  const len = d.length()
  const t = p.clone().sub(seg.A).dot(d) / (len * len)
  const margin = 0.012 / len
  if (t < -margin || t > 1 + margin) return false
  const near = seg.A.clone().addScaledVector(d, t)
  return near.distanceTo(p) < Math.max(seg.w, seg.h) / 2 + 0.002
}

class Asm {
  constructor() {
    this.items = []
    this.pads = []
    this.grips = []
    this.runs = [] // every straight run of tube, to tell a free end from one buried in a joint
    this.plugs = [] // tube ends waiting to see whether they are free
  }
  put(g, m, mtx) {
    this.items.push({ g, m, mtx: mtx || new M4() })
    return this
  }
  /** Any mesh made with kit.* (already carrying its local transform). */
  add(...meshes) {
    for (const o of meshes.flat()) {
      o.updateMatrix()
      this.items.push({ g: o.geometry, m: o.material, mtx: o.matrix.clone() })
    }
    return this
  }
  /** Another assembly, optionally moved. */
  inc(asm, mtx) {
    const T = mtx || new M4()
    for (const it of asm.items) this.items.push({ g: it.g, m: it.m, mtx: T.clone().multiply(it.mtx) })
    return this
  }
  /**
   * Straight tube from a to b. w along `side`, h across it. r is the section's corner radius; round tube when r >= w/2.
   * Every free end gets a plastic plug, decided when the assembly is baked: an end inside another tube gets none, or the plug's
   * corners would stick out of the joint. noCaps skips them altogether.
   */
  tube(a, b, w, h, m = M.frame, { side, r = Math.min(0.012, 0.18 * Math.min(w, h)), noCaps = false } = {}) {
    const A = vec(a)
    const B = vec(b)
    const len = A.distanceTo(B)
    if (len < 1e-5) return this
    const g = cached(`tu${w},${h},${r}`, () => sweepGeometry([new V3(0, 0, 0), new V3(0, 1, 0)], w, h, r, new V3(1, 0, 0), { cs: w === h && r >= w / 2 ? 8 : 3 }))
    const R = basis(B.clone().sub(A), side)
    const mtx = R.clone().setPosition(A).multiply(new M4().makeScale(1, len, 1))
    this.put(g, m, mtx)
    const run = { A, B, w, h }
    this.runs.push(run)
    if (!noCaps) {
      this.plugs.push({ owner: [run], at: A, dir: A.clone().sub(B), w, h, r, side })
      this.plugs.push({ owner: [run], at: B, dir: B.clone().sub(A), w, h, r, side })
    }
    return this
  }
  /** Round tube or rod. */
  rod(a, b, rad, m = M.steel, o = {}) {
    return this.tube(a, b, rad * 2, rad * 2, m, { r: rad, ...o })
  }
  /** Plastic plug in the end of a tube: at `at`, facing out along `dir`. */
  endCap(at, dir, w, h, r, side) {
    const round = w === h && r >= w / 2
    const key = `cap${w},${h},${r}`
    const g = cached(key, () => {
      if (round) {
        const R = w / 2
        const c = Math.min(0.0025, R * 0.4)
        return new THREE.LatheGeometry([[0, -0.002], [R, -0.002], [R, 0.003 - c], [R - c, 0.003], [0, 0.003]].map(([a0, b0]) => new THREE.Vector2(Math.max(a0, 1e-5), b0)), 24)
      }
      return kit.rbox(w + 0.0012, 0.006, h + 0.0012, Math.min(r + 0.0006, 0.0028), M.cap, null, 2).geometry
    })
    const d = vec(dir).normalize()
    const mtx = basis(d, side).setPosition(vec(at).addScaledVector(d, 0.0015))
    return this.put(g, M.cap, mtx)
  }
  /** Bent tube through points, with arcs at the corners. */
  bent(points, w, h, m = M.frame, { side, r = Math.min(0.012, 0.18 * Math.min(w, h)), fillet = 0.1, caps = true } = {}) {
    const key = `be${JSON.stringify(points)},${w},${h},${r},${fillet},${JSON.stringify(side)}`
    const path = filletPath(points, fillet)
    const dir0 = path[1].clone().sub(path[0]).normalize()
    const sd = side ? vec(side) : Math.abs(dir0.x) < 0.9 ? new V3(1, 0, 0) : new V3(0, 0, 1)
    const g = cached(key, () => sweepGeometry(path, w, h, r, sd, { cs: w === h && r >= w / 2 ? 8 : 3 }))
    this.put(g, m)
    const own = []
    for (let i = 0; i + 1 < path.length; i++) own.push({ A: path[i], B: path[i + 1], w, h })
    this.runs.push(...own)
    if (caps) {
      const n = path.length
      this.plugs.push({ owner: own, at: path[0], dir: path[0].clone().sub(path[1]), w, h, r, side: sd })
      this.plugs.push({ owner: own, at: path[n - 1], dir: path[n - 1].clone().sub(path[n - 2]), w, h, r, side: transported(path, sd) })
    }
    return this
  }
  /** Round tube through points, with arcs at the corners. */
  bentRod(points, rad, m = M.steel, { fillet = 0.08, caps = true } = {}) {
    return this.bent(points, rad * 2, rad * 2, m, { r: rad, fillet, caps })
  }
  /** Solid of revolution around the line through pos along dir. profile is [[radius, along], ...]. */
  lathe(profile, m, pos, dir = [0, 1, 0], seg = 32) {
    const g = cached(`la${JSON.stringify(profile)},${seg}`, () => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-5), y)), seg))
    return this.put(g, m, basis(vec(dir)).setPosition(vec(pos)))
  }
  /** Disc with a chamfer and a centre bolt, on a pivot axle. T is its thickness, measured along dir from pos. */
  hub(pos, dir, R, T = 0.012, m = M.steel) {
    const c = Math.min(0.003, T / 3)
    this.lathe([[0, 0], [R, 0], [R, T - c], [R - c, T], [R * 0.45, T], [R * 0.42, T + 0.006], [0, T + 0.006]], m, pos, dir, 36)
    return this
  }
  bolt(pos, dir, r = 0.008, m = M.steel) {
    const d = vec(dir).normalize()
    const P = vec(pos)
    const g = cached(`bolt${r}`, () => new THREE.CylinderGeometry(r, r, r * 0.8, 6))
    this.put(g, m, basis(d).setPosition(P.clone().addScaledVector(d, r * 0.4)))
    return this
  }
  /** A row of adjustment holes on a tube's face: from a to b, n holes, seen along normal. */
  holes(a, b, n, rad, normal, m = M.hole) {
    const A = vec(a)
    const B = vec(b)
    const d = vec(normal).normalize()
    const g = cached(`ho${rad}`, () => new THREE.CylinderGeometry(rad, rad, 0.0016, 18))
    const gr = cached(`hor${rad}`, () => new THREE.LatheGeometry([[rad, 0], [rad + 0.0022, 0], [rad + 0.0026, 0.0008], [rad, 0.0014]].map(([r, y]) => new THREE.Vector2(r, y)), 20))
    for (let i = 0; i < n; i++) {
      const P = A.clone().lerp(B, n > 1 ? i / (n - 1) : 0)
      this.put(g, m, basis(d).setPosition(P))
      this.put(gr, M.steel, basis(d).setPosition(P))
    }
    return this
  }
  /** Pull pin with a round knob, standing out along dir from pos. */
  popPin(pos, dir, m = M.steel) {
    const d = vec(dir).normalize()
    const P = vec(pos)
    this.lathe([[0.012, 0], [0.012, 0.012], [0.007, 0.014], [0.007, 0.03], [0.015, 0.033], [0.017, 0.042], [0.016, 0.052], [0, 0.056]], m, P, d, 20)
    return this
  }
  /**
   * A pad: c is the centre of the contact surface, n points out of it, u along the pad's length. See padShape for the rest.
   * Adds the board behind it. name marks it for the fit check.
   */
  pad({ name, c, n, u, w, l, t = 0.06, board = true, ...shape }) {
    const N = vec(n).normalize()
    const U = vec(u)
    U.addScaledVector(N, -U.dot(N)).normalize()
    const X = N.clone().cross(U).normalize()
    const C = vec(c)
    const base = C.clone().addScaledVector(N, -t)
    const mtx = new M4().makeBasis(X, N, U).setPosition(base)
    const o = { w, l, t, ...shape }
    this.put(padGeometry(o), M.pad, mtx)
    this.put(pipingGeometry(o), M.piping, mtx)
    this.put(stitchGeometry(o), M.stitch, mtx)
    if (board) {
      const bt = 0.012
      const bw = w * (1 - (shape.taper || 0) * 0.5) - 0.012
      const g = cached(`bo${bw},${l},${bt}`, () => kit.rbox(bw, bt, l - 0.012, 0.004, M.frameDark, null, 2).geometry)
      this.put(g, M.frameDark, mtx.clone().multiply(new M4().makeTranslation(0, -bt / 2, 0)))
    }
    if (name) this.pads.push({ name, c: C.toArray(), n: N.toArray(), u: U.toArray(), w, l })
    return this
  }
  /** A flat rounded slab: c centre of its top face, n out of that face, u along its length. X across (w). Thickness t behind the face. */
  slab(c, n, u, w, l, t, m = M.frame, r = 0.004) {
    const N = vec(n).normalize()
    const U = vec(u)
    U.addScaledVector(N, -U.dot(N)).normalize()
    const X = N.clone().cross(U).normalize()
    const g = cached(`sl${w},${l},${t},${r}`, () => kit.rbox(w, t, l, r, m, null, 2).geometry)
    return this.put(g, m, new M4().makeBasis(X, N, U).setPosition(vec(c).addScaledVector(N, -t / 2)))
  }
  /** A foot plate: a steel slab with rows of raised anti-slip ribs. */
  footPlate(c, n, u, w, l, t = 0.012, { rib = 0.032, name } = {}) {
    const N = vec(n).normalize()
    const U = vec(u)
    U.addScaledVector(N, -U.dot(N)).normalize()
    const C = vec(c)
    this.slab(C, N, U, w, l, t, M.tread, 0.005)
    const rows = Math.floor((l - 0.05) / rib)
    for (let i = 0; i <= rows; i++) {
      const off = -((rows * rib) / 2) + i * rib
      this.slab(C.clone().addScaledVector(U, off).addScaledVector(N, 0.0035), N, U, w - 0.05, 0.012, 0.0045, M.rubber, 0.002)
    }
    if (name) this.pads.push({ name, c: C.toArray(), n: N.toArray(), u: U.toArray(), w, l })
    return this
  }
  /** A linear bearing: a sleeve with flanges around a guide rod, centred on at, along dir. */
  bearing(at, dir, rad, len = 0.1, m = M.steel) {
    const d = vec(dir).normalize()
    const A = vec(at).addScaledVector(d, -len / 2)
    const R = rad + 0.012
    this.lathe([[rad, 0], [R + 0.005, 0], [R + 0.005, 0.007], [R, 0.009], [R, len - 0.009], [R + 0.005, len - 0.007], [R + 0.005, len], [rad, len]], m, A, d, 28)
    return this
  }
  /** Foam roller around the line from a to b, with end caps and a steel core showing at the ends. */
  roller(a, b, rad, m = M.roller) {
    const A = vec(a)
    const B = vec(b)
    const len = A.distanceTo(B)
    const d = B.clone().sub(A).normalize()
    const e = Math.min(0.016, rad * 0.4)
    const prof = [[0, 0], [rad - e * 0.62, 0], [rad - e * 0.2, e * 0.25], [rad, e], [rad, len - e], [rad - e * 0.2, len - e * 0.25], [rad - e * 0.62, len], [0, len]]
    this.lathe(prof, m, A, d, 36)
    // The cap at each end: a slightly domed plastic disc.
    for (const [P, s] of [[A, -1], [B, 1]]) {
      this.lathe([[rad * 0.5, 0], [rad * 0.48, 0.002], [rad * 0.22, 0.004], [0, 0.0045]], M.steel, P, d.clone().multiplyScalar(s), 24)
    }
    return this
  }
  /** A handle's rubber sleeve from a to b, faintly ribbed, with a flange at b. Marks a grip for the fit check. */
  grip(a, b, rad = 0.016, { name, flange = true, m = M.grip } = {}) {
    const A = vec(a)
    const B = vec(b)
    const len = A.distanceTo(B)
    const d = B.clone().sub(A).normalize()
    const prof = cached(`gripP${len.toFixed(3)},${rad},${flange}`, () => {
      const p = [[0, 0], [rad - 0.0015, 0], [rad, 0.002]]
      const ribs = Math.max(1, Math.floor((len - 0.008) / 0.009))
      for (let i = 0; i < ribs; i++) {
        const y = 0.004 + (i / ribs) * (len - 0.008)
        p.push([rad, y], [rad + 0.0007, y + 0.002], [rad + 0.0007, y + 0.0045], [rad, y + 0.0065])
      }
      if (flange) p.push([rad, len - 0.004], [rad + 0.007, len - 0.002], [rad + 0.007, len + 0.002], [rad + 0.003, len + 0.005], [0, len + 0.005])
      else p.push([rad, len], [rad - 0.002, len + 0.001], [0, len + 0.001])
      return p
    })
    this.lathe(prof, m, A, d, 28)
    if (name) this.grips.push({ name, a: A.toArray(), b: B.toArray() })
    return this
  }
  /** One iron plate, flat on the plane through pos normal to dir. D outer diameter, T thickness. */
  plate(pos, dir, Dia = 0.45, T = 0.038, m = M.iron) {
    const R = Dia / 2
    const h = 0.0265 // the hole's radius, for a 50 mm sleeve
    const prof = [
      [h, -T * 0.38], [h + 0.018, -T * 0.42], [h + 0.024, -T * 0.32], [R * 0.56, -T * 0.26], [R * 0.82, -T * 0.26], [R * 0.86, -T * 0.42],
      [R * 0.975, -T * 0.5], [R, -T * 0.42], [R, T * 0.42], [R * 0.975, T * 0.5], [R * 0.86, T * 0.42], [R * 0.82, T * 0.26], [R * 0.56, T * 0.26],
      [h + 0.024, T * 0.32], [h + 0.018, T * 0.42], [h, T * 0.38], [h, -T * 0.38],
    ]
    return this.lathe(prof, m, pos, dir, 56)
  }
  /** A plate horn: chromed sleeve along dir from pos, length len, with a collar at its base, and plates on it. */
  horn(pos, dir, len = 0.26, plates = [[0.45, 0.038]], { rad = 0.025 } = {}) {
    const P = vec(pos)
    const d = vec(dir).normalize()
    this.lathe([[0, 0], [rad + 0.012, 0], [rad + 0.012, 0.012], [rad + 0.002, 0.016], [rad, 0.016], [rad, len - 0.004], [rad - 0.004, len], [0, len]], M.chrome, P, d, 28)
    let at = 0.016
    for (const [Dia, T] of plates) {
      this.plate(P.clone().addScaledVector(d, at + T / 2), d, Dia, T)
      at += T + 0.001
    }
    // The spring collar that holds them on.
    this.lathe([[rad, 0], [rad + 0.011, 0], [rad + 0.012, 0.004], [rad + 0.012, 0.014], [rad + 0.011, 0.018], [rad, 0.018]], M.steel, P.clone().addScaledVector(d, at), d, 24)
    return this
  }
  /**
   * A flat steel plate with rounded corners. pts are [z, y] in the side view, at x; thick grows toward +x. holes are [z, y, r].
   */
  sidePlate(pts, x, thick = 0.008, m = M.frame, { round = 0.012, holes = [], bevel = 0.0012 } = {}) {
    const key = `sp${JSON.stringify(pts)},${thick},${round},${JSON.stringify(holes)},${bevel}`
    const g = cached(key, () => {
      const sh = new THREE.Shape()
      const n = pts.length
      for (let i = 0; i < n; i++) {
        const p = new THREE.Vector2(...pts[i])
        const a = new THREE.Vector2(...pts[(i - 1 + n) % n])
        const b = new THREE.Vector2(...pts[(i + 1) % n])
        const da = a.clone().sub(p)
        const db = b.clone().sub(p)
        const ra = Math.min(round, da.length() * 0.45)
        const rb = Math.min(round, db.length() * 0.45)
        const p0 = p.clone().add(da.normalize().multiplyScalar(ra))
        const p1 = p.clone().add(db.normalize().multiplyScalar(rb))
        if (i === 0) sh.moveTo(p0.x, p0.y)
        else sh.lineTo(p0.x, p0.y)
        sh.quadraticCurveTo(p.x, p.y, p1.x, p1.y)
      }
      sh.closePath()
      for (const [hz, hy, hr] of holes) {
        const h = new THREE.Path()
        h.absarc(hz, hy, hr, 0, Math.PI * 2, true)
        sh.holes.push(h)
      }
      const eg = new THREE.ExtrudeGeometry(sh, { depth: thick - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 1, curveSegments: 8 })
      eg.translate(0, 0, bevel)
      // Shape x -> world z, shape y -> world y, extrusion -> world x. A rotation, so the faces keep their winding.
      eg.rotateY(-Math.PI / 2)
      eg.translate(thick, 0, 0)
      return eg
    })
    return this.put(g, m, new M4().makeTranslation(x, 0, 0))
  }
  bake() {
    for (const c of this.plugs) {
      const buried = this.runs.some((run) => !c.owner.includes(run) && insideTube(c.at, run))
      if (!buried) this.endCap(c.at, c.dir, c.w, c.h, c.r, c.side)
    }
    this.plugs = []
    const byMat = new Map()
    for (const it of this.items) {
      if (!byMat.has(it.m)) byMat.set(it.m, [])
      byMat.get(it.m).push(it)
    }
    const meshes = []
    for (const [m, list] of byMat) {
      let nv = 0
      let ni = 0
      for (const { g } of list) {
        nv += g.attributes.position.count
        ni += g.index ? g.index.count : g.attributes.position.count
      }
      const pos = new Float32Array(nv * 3)
      const nor = new Float32Array(nv * 3)
      const idx = new Uint32Array(ni)
      let vo = 0
      let io = 0
      const v = new V3()
      const nm = new THREE.Matrix3()
      for (const { g, mtx } of list) {
        nm.getNormalMatrix(mtx)
        const flip = mtx.determinant() < 0
        const P = g.attributes.position
        const N = g.attributes.normal
        for (let i = 0; i < P.count; i++) {
          v.fromBufferAttribute(P, i).applyMatrix4(mtx)
          pos[(vo + i) * 3] = v.x
          pos[(vo + i) * 3 + 1] = v.y
          pos[(vo + i) * 3 + 2] = v.z
          v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize()
          nor[(vo + i) * 3] = v.x
          nor[(vo + i) * 3 + 1] = v.y
          nor[(vo + i) * 3 + 2] = v.z
        }
        const n = g.index ? g.index.count : P.count
        for (let i = 0; i < n; i += 3) {
          const a = g.index ? g.index.getX(i) : i
          const b = g.index ? g.index.getX(i + 1) : i + 1
          const c = g.index ? g.index.getX(i + 2) : i + 2
          idx[io + i] = vo + a
          idx[io + i + 1] = vo + (flip ? c : b)
          idx[io + i + 2] = vo + (flip ? b : c)
        }
        vo += P.count
        io += n
      }
      const geo = new BufferGeometry()
      geo.setAttribute('position', new BufferAttribute(pos, 3))
      geo.setAttribute('normal', new BufferAttribute(nor, 3))
      geo.setIndex(new BufferAttribute(idx, 1))
      const mesh = new THREE.Mesh(geo, m)
      mesh.castShadow = true
      mesh.receiveShadow = true
      meshes.push(mesh)
    }
    return { meshes, pads: this.pads, grips: this.grips }
  }
}

const bakedCache = new Map()
/** Builds an assembly once for each set of parameters, and hands out cheap copies placed where they're asked. */
function part(key, build) {
  let b = bakedCache.get(key)
  if (!b) {
    const a = new Asm()
    build(a)
    b = a.bake()
    bakedCache.set(key, b)
  }
  const g = new THREE.Group()
  for (const m of b.meshes) g.add(m.clone())
  if (b.pads.length) g.userData.pads = b.pads
  if (b.grips.length) g.userData.grips = b.grips
  return g
}

// ---------------------------------------------------------------------------------------------------------------------
// Following the body.
// ---------------------------------------------------------------------------------------------------------------------
/** World point from the solve report to the prop's local coordinates. */
function toLocal(p, w) {
  const y = ((p.yaw || 0) * Math.PI) / 180
  const o = p.pos || [0, 0, 0]
  const x = w[0] - o[0]
  const z = w[2] - o[2]
  const lx = x * Math.cos(y) - z * Math.sin(y)
  return new V3(p.mirror ? -lx : lx, w[1] - o[1], x * Math.sin(y) + z * Math.cos(y))
}
const avg = (a, b) => a.clone().add(b).multiplyScalar(0.5)

/** The centre of the hand on the machine's +X (s > 0) or -X side, whichever way the figure faces and however it is mirrored. */
function handOn(p, ctx, s) {
  const l = toLocal(p, ctx.hands.L.centre)
  const r = toLocal(p, ctx.hands.R.centre)
  return l.x * s >= r.x * s ? l : r
}
/** The same for any joint with .L and .R in the report's joints. */
function jointOn(p, ctx, joint, s) {
  const l = toLocal(p, ctx.joints[`${joint}.L`])
  const r = toLocal(p, ctx.joints[`${joint}.R`])
  return l.x * s >= r.x * s ? l : r
}

/** Signed angle (radians) around axis from rest to dir, both projected on the plane normal to it. */
function angleAbout(axis, rest, dir) {
  const A = vec(axis).normalize()
  const a = vec(rest).addScaledVector(A, -vec(rest).dot(A))
  const b = vec(dir).addScaledVector(A, -vec(dir).dot(A))
  return Math.atan2(a.clone().cross(b).dot(A), a.dot(b))
}

/** The limb points of a side ('L', 'R') or the mean of both, in local coordinates. */
function limb(p, ctx, joint, side) {
  const jl = (s) => toLocal(p, ctx.joints[`${joint}.${s}`])
  if (side === 'L' || side === 'R') return jl(side)
  return avg(jl('L'), jl('R'))
}

// ---------------------------------------------------------------------------------------------------------------------
// Shared sub-assemblies.
// ---------------------------------------------------------------------------------------------------------------------
/** A rubber foot under a base tube: pos is the point on the floor. */
function foot(a, x, z, w = 0.075, d = 0.075) {
  a.add(kit.rbox(w, 0.014, d, 0.005, M.rubber, [x, 0.007, z], 2))
}

/**
 * The selector stack in its tower. Local origin on the floor under the stack's centre; the plates are w across X, d along Z.
 * The static part: uprights, head, rods, the plates that stay down. See stackMoving for the rest.
 */
const STACK = { w: 0.26, d: 0.13, ph: 0.0225, gap: 0.0015, y0: 0.13 }
const stackTop = (n) => STACK.y0 + n * (STACK.ph + STACK.gap)

function plateRun(a, from, count, m = M.stack) {
  const { w, d, ph, gap, y0 } = STACK
  const g = cached(`stP${w},${d},${ph}`, () => kit.rbox(w, ph, d, 0.0035, m, null, 2).geometry)
  for (let i = 0; i < count; i++) {
    const y = y0 + (from + i) * (ph + gap) + ph / 2
    a.put(g, m, new M4().makeTranslation(0, y, 0))
    // Pin hole in the front face of each plate.
    a.holes([0, y, d / 2 + 0.0002], [0, y, d / 2 + 0.0002], 1, 0.0055, [0, 0, 1])
  }
}

function towerStatic(a, { H = 1.62, n = 16, sel = 7, width = 0.36, footZ = 0.26 } = {}) {
  // H is the underside of the head.
  const { w, d, y0 } = STACK
  const hw = width / 2
  // Base: a tube across and two runners along Z.
  for (const s of [-1, 1]) {
    a.tube([s * hw, 0.03, -footZ], [s * hw, 0.03, footZ], 0.05, 0.05, M.frame)
    foot(a, s * hw, -footZ + 0.04)
    foot(a, s * hw, footZ - 0.04)
    // Upright, with a gusset at the foot.
    a.tube([s * hw, 0.055, 0], [s * hw, H, 0], 0.05, 0.08, M.frame, { side: [1, 0, 0] })
    a.tube([s * hw, 0.05, -0.17], [s * hw, 0.34, -0.03], 0.03, 0.03, M.frameDark)
  }
  a.tube([-hw, 0.05, 0], [hw, 0.05, 0], 0.05, 0.05, M.frame)
  // Rubber bumpers under the stack.
  for (const s of [-1, 1]) a.lathe([[0.02, 0], [0.02, 0.05], [0.014, y0 - 0.05], [0, y0 - 0.05]], M.rubber, [s * (w / 2 - 0.08), 0.05, 0], [0, 1, 0], 16)
  // Guide rods.
  const rx = w / 2 - 0.045
  for (const s of [-1, 1]) a.rod([s * rx, 0.06, 0], [s * rx, H + 0.01, 0], 0.0095, M.chrome)
  // The head: a channel across the top, a bracket and the pulley.
  a.tube([-hw - 0.025, H + 0.03, 0], [hw + 0.025, H + 0.03, 0], 0.06, 0.09, M.frame, { side: [0, 1, 0] })
  // The plates that stay down.
  plateRun(a, 0, n - sel)
}

/** The moving top of the stack: selected plates, top plate, stem, pin. Built at rest; move it up by the lift. */
function stackMoving(a, { n = 16, sel = 7 } = {}) {
  const { w, d, ph, gap } = STACK
  plateRun(a, n - sel, sel)
  const top = stackTop(n)
  // Top plate: thicker, with a bushing on each rod.
  a.add(kit.rbox(w, 0.03, d, 0.005, M.frame, [0, top + 0.015, 0], 2))
  const rx = w / 2 - 0.045
  for (const s of [-1, 1]) a.lathe([[0.019, 0], [0.019, 0.016], [0.0165, 0.02], [0, 0.02]], M.steel, [s * rx, top + 0.03, 0], [0, 1, 0], 16)
  // The stem running down through the plates, and the cable's fitting on top.
  a.lathe([[0.0, 0], [0.012, 0], [0.012, 0.022], [0.007, 0.03], [0.004, 0.04], [0, 0.04]], M.chrome, [0, top + 0.03, 0], [0, 1, 0], 14)
  // Selector pin in the top selected plate.
  const y = STACK.y0 + (n - sel) * (ph + gap) + ph / 2
  a.popPin([0, y, d / 2], [0, 0, 1])
}

/**
 * Adds a whole stack tower to a machine's group. at = [x, z] on the floor, yaw in degrees, lift in metres.
 * Returns the points a cable needs, in the machine's local coordinates.
 */
function addStack(root, { at, yaw = 0, H = 1.62, n = 16, sel = 7, width = 0.36, footZ = 0.26 }, lift = 0) {
  const key = `tw${H},${n},${sel},${width},${footZ}`
  const st = part(key, (a) => towerStatic(a, { H, n, sel, width, footZ }))
  const mv = part(`st${n},${sel}`, (a) => stackMoving(a, { n, sel }))
  mv.position.y = lift
  const g = new THREE.Group()
  g.add(st, mv)
  g.position.set(at[0], 0, at[1])
  g.rotation.y = yaw * D
  root.add(g)
  const c = Math.cos(yaw * D)
  const s = Math.sin(yaw * D)
  const X = (x, y, z) => new V3(at[0] + x * c + z * s, y, at[1] - x * s + z * c)
  return { eye: X(0, stackTop(n) + 0.07 + lift, 0), wheel: X(0, H + 0.13, 0), head: X(0, H + 0.075, 0), X }
}

/**
 * A pulley: a grooved wheel on an axle between two cheeks. c centre, axis its axle, R radius to the groove's floor.
 * base is the point where the cheeks are fixed, or none.
 */
function pulley(a, c, axis, R = 0.05, { base, w = 0.028, m = M.steel } = {}) {
  const A = vec(axis).normalize()
  const C = vec(c)
  const r = R
  const hw = w / 2
  const rim = r + 0.009
  a.lathe(
    [[0.006, -hw], [rim - 0.002, -hw], [rim, -hw + 0.002], [rim, -hw + 0.005], [r, -0.0035], [r, 0.0035], [rim, hw - 0.005], [rim, hw - 0.002], [rim - 0.002, hw], [0.006, hw], [0.006, -hw]],
    m,
    C,
    A,
    40,
  )
  // Lightening holes, and the hub.
  const perp = Math.abs(A.y) < 0.9 ? new V3(0, 1, 0).cross(A).normalize() : new V3(1, 0, 0).cross(A).normalize()
  const perp2 = A.clone().cross(perp)
  for (let i = 0; i < 5; i++) {
    const q = (i / 5) * Math.PI * 2
    const o = perp.clone().multiplyScalar(Math.cos(q) * r * 0.58).addScaledVector(perp2, Math.sin(q) * r * 0.58)
    for (const s of [-1, 1]) a.holes(C.clone().add(o).addScaledVector(A, s * (hw + 0.0002)), C.clone().add(o).addScaledVector(A, s * (hw + 0.0002)), 1, r * 0.17, A.clone().multiplyScalar(s))
  }
  a.rod(C.clone().addScaledVector(A, -hw - 0.012), C.clone().addScaledVector(A, hw + 0.012), 0.008, M.chrome)
  if (base) {
    const B = vec(base)
    for (const s of [-1, 1]) {
      const off = A.clone().multiplyScalar(s * (hw + 0.006))
      a.tube(B.clone().add(off), C.clone().add(off), 0.004, 0.036, M.frameDark, { side: A, r: 0.0015 })
      a.lathe([[0.015, 0], [0.015, 0.003], [0.01, 0.005], [0, 0.005]], M.frameDark, C.clone().add(off), A.clone().multiplyScalar(s), 18)
    }
  }
  return a
}

/** The straight spans of a cable around wheels in one plane. stops: {c, r, s}, s = +1 or -1 picks the side it passes. */
function cableSpans(stops, axis) {
  const A = vec(axis).normalize()
  const spans = []
  for (let i = 0; i + 1 < stops.length; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    const ca = vec(a.c)
    const cb = vec(b.c)
    const d = cb.clone().sub(ca)
    const L = d.length()
    const u = d.clone().divideScalar(L)
    const p = A.clone().cross(u).normalize()
    const ra = (a.r || 0) * (a.s || 1)
    const rb = (b.r || 0) * (b.s || 1)
    const k = (ra - rb) / L
    const n = u.clone().multiplyScalar(k).addScaledVector(p, Math.sqrt(Math.max(0, 1 - k * k)))
    spans.push([ca.clone().addScaledVector(n, ra), cb.clone().addScaledVector(n, rb)])
  }
  return spans
}
function addCable(root, stops, axis, rad = 0.0034) {
  for (const [p, q] of cableSpans(stops, axis)) root.add(kit.between(p.toArray(), q.toArray(), rad, M.cable, 8))
}

/** Eccentric cam: flat disc with a groove, on an axle along dir. R0 smallest radius, R1 largest, at spin degrees. */
function cam(a, pos, dir, R0, R1, T, spin = 0, m = M.steel) {
  const g = cached(`cam${R0},${R1},${T}`, () => {
    const sh = new THREE.Shape()
    const N = 64
    for (let i = 0; i <= N; i++) {
      const q = (i / N) * Math.PI * 2
      const k = 0.5 - 0.5 * Math.cos(q)
      const r = lerp(R0, R1, k * k)
      const x = r * Math.cos(q)
      const y = r * Math.sin(q)
      if (i === 0) sh.moveTo(x, y)
      else sh.lineTo(x, y)
    }
    const hole = new THREE.Path()
    hole.absarc(0, 0, 0.012, 0, Math.PI * 2, true)
    sh.holes.push(hole)
    const out = new THREE.ExtrudeGeometry(sh, { depth: T, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 12 })
    out.translate(0, 0, -T / 2)
    return out
  })
  const Z = vec(dir).normalize()
  const X0 = Math.abs(Z.y) < 0.9 ? new V3(0, 1, 0).cross(Z).normalize() : new V3(1, 0, 0)
  const Y0 = Z.clone().cross(X0)
  const R = new M4().makeBasis(X0, Y0, Z).setPosition(vec(pos)).multiply(new M4().makeRotationZ(spin * D))
  a.put(g, m, R)
}

// ---------------------------------------------------------------------------------------------------------------------
// The machines.
// ---------------------------------------------------------------------------------------------------------------------
const machines = {}

/** The group a builder returns: handles mirror, and marks a machine that follows the body. */
function rootFor(p) {
  const g = new THREE.Group()
  if (p.mirror) g.scale.x = -1
  return g
}

// Helpers that several machines share.
const swing = (root, key, pivot, axis, angle, build) => {
  const g = part(key, build)
  g.position.copy(vec(pivot))
  g.quaternion.setFromAxisAngle(vec(axis).normalize(), angle)
  root.add(g)
  return g
}

/** The back pad for a figure whose hips are at hip, reclined by deg from vertical. along = where its centre sits up the trunk. */
function backPadAt(hip, deg, along = 0.33, off = 0.092) {
  const r = deg * D
  const U = new V3(0, Math.cos(r), -Math.sin(r))
  const N = new V3(0, Math.sin(r), Math.cos(r))
  return { c: vec(hip).addScaledVector(U, along).addScaledVector(N, -off), n: N, u: U }
}

/** What makes a seat post read as one: its adjustment holes and pin, and gussets where it meets the floor spine and the seat. */
function seatPostDetail(a, S, z, h = 0.04) {
  a.holes([h + 0.0005, 0.2, z], [h + 0.0005, S - 0.14, z], 5, 0.0065, [1, 0, 0])
  a.popPin([h + 0.001, S - 0.175, z], [1, 0, 0])
  a.tube([-h - 0.006, S - 0.2, z], [h + 0.006, S - 0.2, z], 0.1, 0.1, M.frameDark, { side: [0, 1, 0], r: 0.006, noCaps: true })
  for (const x of [-h - 0.006, h]) {
    a.sidePlate([[z - 0.13, 0.08], [z + 0.13, 0.08], [z + 0.04, 0.2], [z - 0.04, 0.2]], x, 0.006, M.frameDark, { round: 0.012 })
    for (const b of [[z - 0.08, 0.105], [z + 0.08, 0.105]]) a.bolt([x > 0 ? x + 0.006 : x, b[1], b[0]], [Math.sign(x), 0, 0], 0.006)
  }
}

/** A seat and back on a post rising from a floor spine along Z, like most plate and stack machines. */
function seatAndBack(a, { S, recline = 10, along = 0.33, seatZ = 0.085, seatW = 0.33, seatL = 0.42, backW = 0.31, backL = 0.62, railFoot = -0.3 }) {
  const hip = new V3(0, S + 0.098, 0)
  a.tube([0, 0.08, 0.05], [0, S - 0.09, 0.05], 0.08, 0.08, M.frame)
  a.tube([0, S - 0.09, seatZ - 0.18], [0, S - 0.09, seatZ + 0.18], 0.1, 0.05, M.frame, { side: [1, 0, 0] })
  seatPostDetail(a, S, 0.05)
  a.pad({ name: 'seat', c: [0, S, seatZ], n: [0, 1, 0], u: [0, 0, 1], w: seatW, l: seatL, t: 0.075, r: 0.028, rc: 0.06, crown: 0.012, taper: 0.1, fall: 0.012 })
  const b = backPadAt(hip, recline, along)
  a.pad({ name: 'back', c: b.c, n: b.n, u: b.u, w: backW, l: backL, t: 0.07, r: 0.028, rc: 0.07, crown: 0.012 })
  // The rail that carries the back: from the floor spine, at the pad's angle, with its adjustment holes and pin.
  const off = 0.07 + 0.012 + 0.07
  const top = b.c.clone().addScaledVector(b.n, -off).addScaledVector(b.u, backL / 2 - 0.06)
  const low = new V3(0, 0.08, railFoot)
  const dir = top.clone().sub(low).normalize()
  a.tube(low, top, 0.07, 0.07, M.frame)
  const face = dir.clone().cross(new V3(1, 0, 0)).normalize() // points forward
  const f = face.z > 0 ? face : face.negate()
  a.holes(low.clone().lerp(top, 0.3).addScaledVector(f, 0.0352), low.clone().lerp(top, 0.55).addScaledVector(f, 0.0352), 5, 0.006, f)
  // Bracket from the rail to the pad's board.
  const mid = b.c.clone().addScaledVector(b.n, -0.082)
  a.tube(mid.clone().addScaledVector(b.u, -0.17), mid.clone().addScaledVector(b.u, 0.17), 0.1, 0.012, M.frameDark, { side: [1, 0, 0], r: 0.004 })
  a.tube(mid.clone().addScaledVector(b.n, -0.006), mid.clone().addScaledVector(b.n, -0.075), 0.05, 0.05, M.frameDark)
  for (const k of [-0.14, 0.14]) for (const s of [-1, 1]) a.bolt(mid.clone().addScaledVector(b.u, k).add(new V3(s * 0.035, 0, 0)).addScaledVector(b.n, -0.006), b.n.clone().negate(), 0.006)
  return { hip, back: b }
}

/** Side handles by the hips, on a bent rod from the seat carriage. */
function seatHandles(a, S, { x = 0.255, z0 = -0.03, z1 = 0.165, dy = 0.015, name = 'handle' } = {}) {
  for (const s of [-1, 1]) {
    a.bentRod([[s * 0.05, S - 0.09, -0.06], [s * x, S - 0.09, -0.06], [s * x, S + dy, -0.06], [s * x, S + dy, z1 - 0.005]], 0.0125, M.frame, { fillet: 0.035, caps: false })
    a.grip([s * x, S + dy, z0], [s * x, S + dy, z1], 0.0165, { name: `${name}${s < 0 ? 'R' : 'L'}` })
  }
}

/** Floor base: a spine along Z at x = 0 and crossing feet. */
function floorSpine(a, z0, z1, feet = [[-0.3, 0.3, z0], [-0.3, 0.3, z1]]) {
  a.tube([0, 0.05, z0], [0, 0.05, z1], 0.1, 0.06, M.frame, { side: [1, 0, 0] })
  for (const [x0, x1, z] of feet) {
    a.tube([x0, 0.035, z], [x1, 0.035, z], 0.07, 0.07, M.frame, { side: [0, 1, 0] })
    foot(a, x0 + 0.04, z)
    foot(a, x1 - 0.04, z)
  }
}

/**
 * Run a cable from an arm's cam, along the floor and up a tower to the plates. All in the plane x = X, the tower centred
 * on it: cam -> wheel low in front -> wheel at the tower's foot, behind the plates -> over the head wheel -> down to the top plate.
 */
const HEAD_R = 0.05
function lowRun(root, key, { X, cam: camC, camR, frontZ, towerZ, H, wrap = -1, n, sel }, lift) {
  const footZ = towerZ - 2 * HEAD_R + 0.04
  const low = 0.115
  root.add(
    part(`run${key}${X},${frontZ},${towerZ},${H}`, (a) => {
      pulley(a, [X, low, frontZ], [1, 0, 0], 0.04, { base: [X, 0.07, frontZ] })
      pulley(a, [X, low, footZ], [1, 0, 0], 0.04, { base: [X, 0.07, footZ] })
      pulley(a, [X, H + 0.13, towerZ - HEAD_R], [1, 0, 0], HEAD_R, { base: [X, H + 0.07, towerZ - HEAD_R] })
    }),
  )
  const eye = new V3(X, stackTop(n) + 0.07 + lift, towerZ)
  addCable(root, [{ c: camC, r: camR, s: wrap }, { c: [X, low, frontZ], r: 0.04, s: -1 }, { c: [X, low, footZ], r: 0.04, s: -1 }, { c: [X, H + 0.13, towerZ - HEAD_R], r: HEAD_R, s: -1 }, { c: eye, r: 0, s: -1 }], [1, 0, 0])
}

/** A leg lever around the knee: the rest pose has the shin hanging straight down, the pad in front of it (+Z) or behind it. */
function legLever(a, { X, along = 0.335, off = 0.088, camX, shaftTo, armW = 0.044 }) {
  const s = Math.sign(X)
  const z1 = off * 0.45
  a.tube([X, 0.05, 0], [X, -0.27, z1 * 0.5], armW, armW, M.arm, { side: [1, 0, 0] })
  a.tube([X, -0.21, z1 * 0.3], [X, -along - 0.09, z1 * 1.2], 0.032, 0.032, M.steel, { side: [1, 0, 0] })
  a.holes([X + s * 0.0162, -0.27, z1 * 0.52], [X + s * 0.0162, -along - 0.05, z1 * 1.08], 5, 0.0048, [s, 0, 0])
  a.popPin([X + s * 0.022, -0.235, z1 * 0.42], [s, 0, 0])
  a.tube([X, -along + 0.03, z1 * 0.9], [X, -along, off], 0.026, 0.026, M.steel, { side: [1, 0, 0] })
  a.rod([-s * 0.21, -along, off], [X + s * 0.02, -along, off], 0.011, M.chrome)
  a.roller([s * 0.012, -along, off], [s * 0.205, -along, off], 0.05)
  a.roller([-s * 0.012, -along, off], [-s * 0.205, -along, off], 0.05)
  a.rod([X - s * 0.03, 0, 0], [shaftTo, 0, 0], 0.02, M.chrome)
  a.hub([X - s * 0.022, 0, 0], [-s, 0, 0], 0.05, 0.006, M.arm)
  a.hub([X + s * 0.022, 0, 0], [s, 0, 0], 0.036, 0.006, M.arm)
  cam(a, [camX, 0, 0], [1, 0, 0], 0.075, 0.1, 0.018, 200, M.frameDark)
}

/**
 * Leg extension and seated leg curl share a chassis: the knee pivot on the figure's right (-X), so a camera on its left sees
 * the legs and pad unhidden. mirror swaps the side.
 */
function seatedLegMachine(p, ctx, kind) {
  const S = p.seatY ?? 0.5
  const curl = kind === 'curl'
  const hipY = S + 0.098
  const pivot = new V3(0, hipY, 0.425)
  const X = -0.228
  const PX = -0.3
  const CX = -0.272
  const towerZ = -0.82
  const root = rootFor(p)
  root.add(
    part(`seatedleg${kind}${S}`, (a) => {
      floorSpine(a, -0.62, 0.62, [[-0.38, 0.3, 0.62], [-0.3, 0.3, -0.3]])
      seatAndBack(a, { S, recline: curl ? 12 : 10 })
      seatHandles(a, S)
      // The post with the knee pivot.
      a.tube([PX, 0.05, 0.64], [PX, hipY + 0.06, 0.48], 0.07, 0.07, M.frame)
      a.tube([PX, 0.05, 0.16], [PX, hipY - 0.08, 0.46], 0.05, 0.05, M.frameDark)
      a.tube([0, 0.05, 0.16], [PX, 0.05, 0.16], 0.05, 0.05, M.frame)
      a.tube([PX + 0.04, pivot.y, pivot.z], [PX - 0.045, pivot.y, pivot.z], 0.05, 0.05, M.chrome, { r: 0.025 })
      a.hub([PX - 0.043, pivot.y, pivot.z], [-1, 0, 0], 0.035, 0.008)
      // Frame out to the tower.
      a.tube([0, 0.05, -0.56], [CX - 0.18, 0.05, -0.56], 0.05, 0.05, M.frame)
      if (curl) {
        // The lap pad, on its own lever from the pivot post, pressing just above the knees.
        const lapY = hipY + 0.098
        a.tube([PX, hipY + 0.04, 0.47], [PX, lapY + 0.13, 0.37], 0.05, 0.05, M.frameDark)
        a.tube([PX, lapY + 0.13, 0.35], [0.0, lapY + 0.13, 0.35], 0.05, 0.05, M.frameDark)
        a.pad({ name: 'lap', c: [0, lapY, 0.33], n: [0, -1, 0], u: [0, 0, 1], w: 0.38, l: 0.13, t: 0.055, r: 0.026, rc: 0.05, crown: 0.01 })
        a.tube([0, lapY + 0.13, 0.35], [0, lapY + 0.067, 0.33], 0.05, 0.05, M.frameDark)
      }
    }),
  )
  let ang = (p.angle ?? 0) * D
  if (ctx) {
    const knee = limb(p, ctx, 'lowerleg01', p.side)
    const ankle = limb(p, ctx, 'foot', p.side)
    ang = angleAbout([1, 0, 0], [0, -1, 0], ankle.clone().sub(knee))
  }
  swing(root, `seatedlegarm${kind}`, pivot, [1, 0, 0], ang, (a) => legLever(a, { X, off: curl ? -0.088 : 0.088, along: curl ? 0.36 : 0.335, camX: CX, shaftTo: PX + 0.03 }))
  const open = curl ? ang : -ang
  const lift = Math.max(0, curl ? open + 90 * D : open) * 0.08
  const towerCfg = { at: [CX, towerZ], H: 1.55, n: 15, sel: 6, footZ: 0.22 }
  addStack(root, towerCfg, lift)
  lowRun(root, kind, { X: CX, cam: pivot.clone().setX(CX), camR: 0.08, frontZ: 0.26, towerZ, H: towerCfg.H, n: towerCfg.n, sel: towerCfg.sel, wrap: curl ? -1 : 1 }, lift)
  return root
}
machines['leg-extension'] = (p, ctx) => seatedLegMachine(p, ctx, 'ext')
machines['seated-leg-curl'] = (p, ctx) => seatedLegMachine(p, ctx, 'curl')

// ---- Press machines: a lever on each side, from a high pivot down to a handle. The handle swings on an arc around the pivot.
const PRESS = {
  'chest-flat': { S: 0.44, recline: 12, h0: [0.25, 0.93, 0.2], phi: 4, L: 0.28, R: 0.72, conv: 0.05 },
  'chest-incline': { S: 0.44, recline: 30, h0: [0.25, 0.95, -0.02], phi: 42, L: 0.3, R: 0.72, conv: 0.05 },
  'chest-decline': { S: 0.44, recline: 8, h0: [0.25, 0.84, 0.21], phi: -15, L: 0.28, R: 0.72, conv: 0.05 },
  shoulder: { S: 0.44, recline: 8, h0: [0.27, 1.1, 0.04], phi: 84, L: 0.42, R: 0.72, conv: 0.05, hornAt: 0.42 },
}

/** Where a press machine's handle starts and ends, its pivot and its axle, for the figure's left hand (x > 0). */
export function pressArc(cfgName, side = 1, conv) {
  const c = PRESS[cfgName]
  const cv = conv ?? c.conv
  const H0 = new V3(c.h0[0], c.h0[1], c.h0[2])
  const dir = new V3(-cv, Math.sin(c.phi * D), Math.cos(c.phi * D)).normalize()
  const H1 = H0.clone().addScaledVector(dir, c.L)
  const Hm = H0.clone().lerp(H1, 0.5)
  const n = new V3(0, Math.cos(c.phi * D), -Math.sin(c.phi * D))
  n.addScaledVector(dir, -n.dot(dir)).normalize()
  const e = new V3(1, 0, 0).addScaledVector(dir, -dir.x)
  const e2 = e.clone().addScaledVector(n, -e.dot(n)).normalize()
  const dx = 0.2
  const d = Math.sqrt(c.R * c.R - (c.L / 2) * (c.L / 2) - dx * dx)
  const P = Hm.clone().addScaledVector(n, d).addScaledVector(e2, dx)
  const axis = H0.clone().sub(P).cross(H1.clone().sub(P)).normalize()
  if (side < 0) {
    for (const v of [H0, H1, P]) v.x *= -1
    axis.copy(H0.clone().sub(P).cross(H1.clone().sub(P)).normalize())
  }
  return { H0, H1, P, axis }
}

function pressFrame(a, cfgName, Pz, Py, stacked) {
  const c = PRESS[cfgName]
  const AX = 0.41
  const zr = Math.min(Pz - 0.02, -0.62)
  const zf = Math.max(Pz + 0.62, 0.86)
  const beamY = Py + 0.075
  // The spine on the floor and the crossing feet.
  a.tube([0, 0.05, zr - 0.08], [0, 0.05, zf + 0.08], 0.11, 0.06, M.frame, { side: [1, 0, 0] })
  for (const [z, w] of [[zr, 0.42], [zf, 0.42]]) {
    a.tube([-w, 0.035, z], [w, 0.035, z], 0.07, 0.07, M.frame, { side: [0, 1, 0] })
    foot(a, -w + 0.05, z)
    foot(a, w - 0.05, z)
  }
  // One arch in the middle plane, over the figure: the levers hang from its cross axle.
  const over = Pz > zr + 0.3
  const pts = over
    ? [[0, 0.07, zr], [0, beamY, zr + 0.05], [0, beamY, zf - 0.24], [0, 0.07, zf]]
    : [[0, 0.07, zr], [0, beamY, zr], [0, beamY, Pz + 0.12]]
  a.bent(pts, 0.09, 0.075, M.frame, { side: [1, 0, 0], fillet: 0.14, r: 0.01, caps: !over })
  a.rod([-AX, Py, Pz], [AX, Py, Pz], 0.032, M.frame)
  // Saddle between the axle and the beam.
  a.sidePlate([[Pz - 0.08, beamY], [Pz + 0.08, beamY], [Pz + 0.05, Py - 0.045], [Pz - 0.05, Py - 0.045]], -0.062, 0.008, M.frameDark, { round: 0.015 })
  a.sidePlate([[Pz - 0.08, beamY], [Pz + 0.08, beamY], [Pz + 0.05, Py - 0.045], [Pz - 0.05, Py - 0.045]], 0.054, 0.008, M.frameDark, { round: 0.015 })
  a.bolt([0.062, Py, Pz], [1, 0, 0], 0.01)
  a.bolt([-0.062, Py, Pz], [-1, 0, 0], 0.01)
  return seatAndBack(a, { S: c.S, recline: c.recline, railFoot: Math.max(zr + 0.05, -0.36), along: 0.34, backL: 0.66 })
}

function pressLever(a, arc, s, { horn, hornAt = 0, hornFwd = 0.46 }) {
  const { P, H0, axis } = arc
  // Everything is relative to the pivot, with the lever at its starting position.
  const H = H0.clone().sub(P)
  const out = new V3(s, 0, 0)
  const E = H.clone().addScaledVector(out, 0.145)
  const up = E.clone().normalize().negate() // from the handle end toward the pivot
  const ax = axis.clone().multiplyScalar(Math.sign(axis.x * s) || 1) // outward
  a.tube([0, 0, 0], E, 0.04, 0.072, M.arm, { side: ax, r: 0.007 })
  a.rod(ax.clone().multiplyScalar(-0.05), ax.clone().multiplyScalar(0.03), 0.038, M.arm)
  a.hub(ax.clone().multiplyScalar(0.03), ax, 0.04, 0.006, M.steel)
  a.hub(ax.clone().multiplyScalar(-0.05), ax.clone().negate(), 0.04, 0.004, M.steel)
  // Handle: a round bar welded to the lever's end, turning in along X.
  const g0 = H.clone().addScaledVector(out, 0.09)
  const stem0 = E.clone().addScaledVector(up, 0.035).addScaledVector(ax, -0.019)
  a.bentRod([stem0, stem0.clone().addScaledVector(up, -0.035).addScaledVector(out, -0.03), g0], 0.0125, M.steel, { fillet: 0.018, caps: false })
  a.grip(g0, H.clone().addScaledVector(out, -0.1), 0.0165, { name: `handle${s > 0 ? 'L' : 'R'}` })
  if (horn) {
    let hp
    if (hornAt > 0) {
      hp = E.clone().multiplyScalar(hornAt)
    } else {
      // A short arm ahead of the pivot: it rises as the handle swings forward, which is what lifts the plates.
      const F = new V3(0, 0.1, 1)
      F.addScaledVector(ax, -F.dot(ax)).normalize()
      hp = F.clone().multiplyScalar(hornFwd)
      a.tube([0, 0, 0], hp, 0.04, 0.072, M.arm, { side: ax, r: 0.007 })
      a.tube(F.clone().multiplyScalar(0.02).add(E.clone().normalize().multiplyScalar(0.17)), F.clone().multiplyScalar(0.2), 0.03, 0.03, M.arm, { side: ax })
    }
    a.horn(hp.clone().addScaledVector(ax, 0.02), ax, 0.26, [[0.45, 0.038], [0.31, 0.03]])
  }
}

function pressMachine(p, ctx, cfgName) {
  const root = rootFor(p)
  const plates = (p.load ?? 'plates') === 'plates'
  const c = PRESS[cfgName]
  const conv = plates ? undefined : 0
  const arcs = { 1: pressArc(cfgName, 1, conv), '-1': pressArc(cfgName, -1, conv) }
  const Py = arcs[1].P.y
  const Pz = arcs[1].P.z
  root.add(part(`pressframe${cfgName}`, (a) => pressFrame(a, cfgName, Pz, Py, !plates)))
  const handAngle = (s) => {
    const arc = arcs[s]
    if (!ctx) return (p.angle ?? 0) * D * Math.sign(arc.axis.x || 1)
    return angleAbout(arc.axis, arc.H0.clone().sub(arc.P), handOn(p, ctx, s).sub(arc.P))
  }
  let travel = 0
  for (const s of [1, -1]) {
    const arc = arcs[s]
    const ang = handAngle(s)
    travel += Math.abs(ang) / 2
    swing(root, `presslever${cfgName}${s}${plates}`, arc.P, arc.axis, plates ? ang : (handAngle(1) + handAngle(-1) * Math.sign(arcs[1].axis.x * arcs[-1].axis.x)) / 2 * (s > 0 ? 1 : Math.sign(arcs[1].axis.x * arcs[-1].axis.x)), (a) => pressLever(a, arc, s, { horn: plates, hornAt: c.hornAt || 0 }))
  }
  if (!plates) {
    // One stack behind the seat, on a cable from a cam on the axle.
    const tz = Math.min(Pz - 0.42, -0.98)
    const H = 1.5
    const lift = travel * 0.095
    addStack(root, { at: [0.1, tz], H, n: 16, sel: 7, footZ: 0.24 }, lift)
    const wheel = new V3(0.1, H + 0.13, tz + HEAD_R)
    root.add(
      part(`presstop${cfgName}`, (a) => {
        cam(a, [0.1, Py, Pz], [1, 0, 0], 0.08, 0.105, 0.02, 90, M.frameDark)
        pulley(a, wheel, [1, 0, 0], HEAD_R, { base: [0.1, H + 0.07, tz + HEAD_R] })
      }),
    )
    addCable(root, [{ c: [0.1, Py, Pz], r: 0.09, s: -1 }, { c: wheel, r: HEAD_R, s: 1 }, { c: [0.1, stackTop(16) + 0.07 + lift, tz], r: 0, s: 1 }], [1, 0, 0])
  }
  return root
}
machines['chest-press'] = (p, ctx) => pressMachine(p, ctx, `chest-${p.variant ?? 'flat'}`)
machines['shoulder-press'] = (p, ctx) => pressMachine(p, ctx, 'shoulder')

// ---- Leg press: a 45 degree sled. The rails rise toward +Z; the feet push the sled up them.
const LP = { hipY: 0.42, rail: 45, trunk: 40, off: 0.3 }
export const legPressAxes = () => {
  const a = LP.rail * D
  return { hip: new V3(0, LP.hipY, 0), r: new V3(0, Math.sin(a), Math.cos(a)), f: new V3(0, Math.cos(a), -Math.sin(a)) }
}
machines['leg-press'] = function legPress(p, ctx) {
  const root = rootFor(p)
  const { hip, r, f } = legPressAxes()
  const q = f.clone().negate() // from the leg line toward the rails, down and forward
  const Lp = (x, v, w) => new V3(x, hip.y + v * f.y + w * r.y, hip.z + v * f.z + w * r.z) // v along the plate toward the toes, w up the rails
  const RX = 0.25
  root.add(
    part('legpress-frame', (a) => {
      const rail = (t) => Lp(0, -LP.off, t)
      // Base rails on the floor, from under the head to past the top of the rails.
      const z0 = -0.86
      const z1 = 1.28
      for (const s of [-1, 1]) {
        a.tube([s * 0.36, 0.035, z0], [s * 0.36, 0.035, z1], 0.08, 0.07, M.frame, { side: [1, 0, 0] })
        foot(a, s * 0.36, z0 + 0.05)
        foot(a, s * 0.36, z1 - 0.05)
      }
      for (const z of [z0 + 0.05, 0.05, z1 - 0.05]) a.tube([-0.36, 0.035, z], [0.36, 0.035, z], 0.07, 0.07, M.frame)
      for (const s of [-1, 1]) {
        const X = s * RX
        // Main rail tube under the guide rod, and the chromed rod on stand-offs.
        const a0 = Lp(X, -LP.off - 0.062, -0.2)
        const a1 = Lp(X, -LP.off - 0.062, 1.45)
        a.tube(a0, a1, 0.07, 0.09, M.frame, { side: [1, 0, 0] })
        const r0 = Lp(X, -LP.off, -0.16)
        const r1 = Lp(X, -LP.off, 1.42)
        a.rod(r0, r1, 0.021, M.chrome)
        for (const t of [-0.15, 1.41]) a.tube(Lp(X, -LP.off, t), Lp(X, -LP.off - 0.03, t), 0.06, 0.03, M.frameDark, { side: [1, 0, 0], r: 0.004 })
        // The rail's lower end is carried by the base, its upper end by a post and a stay.
        a.tube(Lp(X, -LP.off - 0.09, 1.15), [X, 0.05, Lp(X, -LP.off - 0.09, 1.15).z - 0.02], 0.08, 0.08, M.frame)
        a.tube(Lp(X, -LP.off - 0.09, 0.55), [X, 0.05, Lp(X, -LP.off - 0.09, 1.15).z - 0.02], 0.05, 0.05, M.frameDark)
        a.tube([X, 0.05, 0.05], Lp(X, -LP.off - 0.09, 0.2), 0.06, 0.06, M.frameDark)
        // Stops: a rubber bumper low on each rail.
        a.lathe([[0.03, 0], [0.03, 0.03], [0.024, 0.038], [0.021, 0.038]], M.rubber, Lp(X, -LP.off, 0.42), r, 18)
      }
      a.tube(Lp(-RX, -LP.off - 0.062, 1.42), Lp(RX, -LP.off - 0.062, 1.42), 0.07, 0.07, M.frame)
      a.tube(Lp(-RX, -LP.off - 0.062, -0.17), Lp(RX, -LP.off - 0.062, -0.17), 0.07, 0.07, M.frame)
      // The seat, tilted up toward the knees, and the long back pad.
      const seatT = 18 * D
      const seatN = new V3(0, Math.cos(seatT), -Math.sin(seatT))
      const seatU = new V3(0, Math.sin(seatT), Math.cos(seatT))
      const seatC = hip.clone().addScaledVector(seatN, -0.1).addScaledVector(seatU, 0.11)
      a.pad({ name: 'seat', c: seatC, n: seatN, u: seatU, w: 0.36, l: 0.34, t: 0.07, r: 0.028, rc: 0.06, crown: 0.012 })
      const tr = LP.trunk * D
      const backN = new V3(0, Math.cos(tr), Math.sin(tr))
      const backU = new V3(0, Math.sin(tr), -Math.cos(tr))
      const backC = hip.clone().addScaledVector(backU, 0.37).addScaledVector(backN, -0.092)
      a.pad({ name: 'back', c: backC, n: backN, u: backU, w: 0.36, l: 0.8, t: 0.07, r: 0.03, rc: 0.08, crown: 0.012 })
      // Saddle frame carrying both pads.
      const under = (c, n, u, k) => c.clone().addScaledVector(n, -0.1).addScaledVector(u, k)
      for (const s of [-1, 1]) {
        const off = new V3(s * 0.13, 0, 0)
        const A = under(seatC, seatN, seatU, 0.15).add(off)
        const B = under(seatC, seatN, seatU, -0.14).add(off)
        const C = under(backC, backN, backU, 0.34).add(off)
        a.bent([A, B, C], 0.05, 0.07, M.frame, { side: [1, 0, 0], fillet: 0.08 })
        a.tube(B.clone().lerp(C, 0.05), [s * 0.13, 0.05, B.z], 0.07, 0.07, M.frame)
        a.tube(C, [s * 0.13, 0.05, C.z - 0.02], 0.05, 0.05, M.frameDark)
      }
      a.tube(under(backC, backN, backU, 0.34).setX(-0.13), under(backC, backN, backU, 0.34).setX(0.13), 0.05, 0.05, M.frameDark)
      // Safety handles by the hips, across the forearm's line.
      for (const s of [-1, 1]) {
        const gc = new V3(s * 0.305, hip.y + 0.005, 0.03)
        const ax = new V3(0, 0.81, 0.59)
        const g0 = gc.clone().addScaledVector(ax, -0.09)
        const g1 = gc.clone().addScaledVector(ax, 0.09)
        a.bentRod([[s * 0.13, hip.y - 0.17, -0.1], [s * 0.305, hip.y - 0.17, -0.1], g0], 0.0125, M.steel, { fillet: 0.03, caps: false })
        a.grip(g0, g1, 0.0165, { name: `handle${s > 0 ? 'L' : 'R'}` })
      }
    }),
  )
  // How far up the rails the sled is. w = 0 is the leg line's start at the hips, measured to the plate's face.
  let w = p.s ?? 0.9
  if (ctx) {
    const key = p.anchor === 'ball' ? 'ball' : 'sole'
    const sole = avg(toLocal(p, ctx.feet.L[key]), toLocal(p, ctx.feet.R[key]))
    w = sole.sub(hip).dot(r)
  }
  const sled = part('legpress-sled', (a) => {
    const S = (x, v, t) => new V3(x, v * f.y + t * r.y, v * f.z + t * r.z)
    a.footPlate(S(0, 0.0, 0), r.clone().negate(), f, 0.66, 0.56, 0.014, { name: 'plate' })
    // The box behind the plate.
    for (const s of [-1, 1]) {
      a.tube(S(s * 0.3, 0.26, 0.03), S(s * 0.3, -0.26, 0.03), 0.05, 0.05, M.arm, { side: [1, 0, 0] })
      // Side cheeks running down to the bearings.
      a.sidePlate([[S(0, 0.2, 0.016).z, S(0, 0.2, 0.016).y], [S(0, -0.28, 0.016).z, S(0, -0.28, 0.016).y], [S(0, -LP.off - 0.03, 0.09).z, S(0, -LP.off - 0.03, 0.09).y], [S(0, -LP.off - 0.03, 0.33).z, S(0, -LP.off - 0.03, 0.33).y], [S(0, -0.12, 0.3).z, S(0, -0.12, 0.3).y]], s * RX - (s > 0 ? 0.042 : -0.034), 0.008, M.arm, { round: 0.03, holes: [[S(0, -0.13, 0.17).z, S(0, -0.13, 0.17).y, 0.038]] })
      a.tube(S(s * 0.3, 0.2, 0.03), S(s * RX, -LP.off, 0.12), 0.04, 0.04, M.arm, { side: [1, 0, 0] })
      a.bearing(S(s * RX, -LP.off, 0.12), r, 0.021, 0.14)
      a.bearing(S(s * RX, -LP.off, 0.3), r, 0.021, 0.14)
      // The horn, with plates.
      a.tube(S(s * RX, -LP.off, 0.21), S(s * (RX + 0.05), -LP.off - 0.14, 0.21), 0.07, 0.07, M.arm, { side: [0, 1, 0], r: 0.008 })
      a.horn(S(s * (RX + 0.05), -LP.off - 0.14, 0.21), [s, 0, 0], 0.3, [[0.45, 0.038], [0.45, 0.038], [0.31, 0.03]])
    }
    a.tube(S(-0.3, 0.2, 0.03), S(0.3, 0.2, 0.03), 0.05, 0.05, M.arm, { side: [0, 1, 0] })
    a.tube(S(-0.3, -0.2, 0.03), S(0.3, -0.2, 0.03), 0.05, 0.05, M.arm, { side: [0, 1, 0] })
    a.tube(S(-RX, -LP.off - 0.0, 0.21), S(RX, -LP.off - 0.0, 0.21), 0.06, 0.06, M.arm, { side: [0, 1, 0] })
  })
  sled.position.copy(hip).addScaledVector(r, w)
  root.add(sled)
  return root
}

// ---- Hack squat: back on a carriage that slides up rails behind the figure, feet on a fixed tilted plate.
const HS = { rail: 48, plate: 25, plateY: 0.24, off: 0.19 }
export const hackAxes = () => {
  const a = HS.rail * D
  const b = HS.plate * D
  const r = new V3(0, Math.sin(a), -Math.cos(a))
  const nb = new V3(0, Math.cos(a), Math.sin(a))
  const nf = new V3(0, Math.cos(b), -Math.sin(b))
  const ff = new V3(0, Math.sin(b), Math.cos(b))
  const sole = new V3(0, HS.plateY, 0)
  const ankle = sole.clone().addScaledVector(nf, 0.07).addScaledVector(ff, -0.04)
  const hipTop = ankle.clone().addScaledVector(r, 0.84)
  return { r, nb, nf, ff, sole, ankle, hipTop }
}
machines['hack-squat'] = function hackSquat(p, ctx) {
  const root = rootFor(p)
  const { r, nb, nf, ff, sole, hipTop } = hackAxes()
  const L = (x, along, off) => new V3(x, hipTop.y + along * r.y + off * nb.y, hipTop.z + along * r.z + off * nb.z)
  const RX = 0.235
  root.add(
    part('hack-frame', (a) => {
      for (const s of [-1, 1]) {
        a.tube([s * 0.33, 0.035, -1.42], [s * 0.33, 0.035, 0.46], 0.08, 0.07, M.frame, { side: [1, 0, 0] })
        foot(a, s * 0.33, -1.37)
        foot(a, s * 0.33, 0.41)
        const X = s * RX
        const a0 = L(X, -0.82, -HS.off - 0.062)
        const a1 = L(X, 0.72, -HS.off - 0.062)
        a.tube(a0, a1, 0.07, 0.09, M.frame, { side: [1, 0, 0] })
        a.rod(L(X, -0.78, -HS.off), L(X, 0.7, -HS.off), 0.022, M.chrome)
        for (const t of [-0.77, 0.69]) a.tube(L(X, t, -HS.off), L(X, t, -HS.off - 0.03), 0.06, 0.03, M.frameDark, { side: [1, 0, 0], r: 0.004 })
        // Rear post and stay.
        const top = L(X, 0.6, -HS.off - 0.09)
        a.tube(top, [X, 0.05, top.z - 0.02], 0.08, 0.08, M.frame)
        const mid = L(X, -0.05, -HS.off - 0.09)
        a.tube(mid, [X, 0.05, top.z + 0.3], 0.05, 0.05, M.frameDark)
        // The low end sits on the base.
        const low = L(X, -0.78, -HS.off - 0.09)
        a.tube(low, [X, 0.05, low.z], 0.08, 0.08, M.frame)
        // A rubber stop, where the carriage bottoms out.
        a.lathe([[0.032, 0], [0.032, 0.03], [0.026, 0.04], [0.022, 0.04]], M.rubber, L(X, -0.37, -HS.off), r, 18)
      }
      for (const z of [-1.37, -0.32, 0.41]) a.tube([-0.33, 0.035, z], [0.33, 0.035, z], 0.07, 0.07, M.frame)
      a.tube(L(-RX, 0.7, -HS.off - 0.062), L(RX, 0.7, -HS.off - 0.062), 0.07, 0.07, M.frame)
      // The foot plate, on a bent frame from the base.
      const c = sole
      a.footPlate(c, nf, ff, 0.66, 0.5, 0.014, { name: 'plate' })
      for (const s of [-1, 1]) {
        const b0 = c.clone().addScaledVector(ff, 0.2).addScaledVector(nf, -0.03).setX(s * 0.25)
        const b1 = c.clone().addScaledVector(ff, -0.23).addScaledVector(nf, -0.03).setX(s * 0.25)
        a.tube(b0, b1, 0.05, 0.05, M.frameDark, { side: [1, 0, 0] })
        a.tube(b0, [s * 0.25, 0.05, b0.z], 0.05, 0.05, M.frameDark)
        a.tube(b1, [s * 0.25, 0.05, b1.z], 0.05, 0.05, M.frameDark)
      }
      a.tube(c.clone().addScaledVector(ff, 0.2).addScaledVector(nf, -0.03).setX(-0.25), c.clone().addScaledVector(ff, 0.2).addScaledVector(nf, -0.03).setX(0.25), 0.05, 0.05, M.frameDark)
    }),
  )
  // The carriage moves with the pelvis: t = 0 with the legs nearly straight, negative going down.
  let t = p.t ?? 0
  if (ctx) t = toLocal(p, ctx.frames.pelvis.pos).sub(hipTop).dot(r)
  const car = part('hack-carriage', (a) => {
    const C = (x, along, off) => new V3(x, along * r.y + off * nb.y, along * r.z + off * nb.z)
    a.pad({ name: 'back', c: C(0, 0.3, -0.092), n: nb, u: r, w: 0.34, l: 0.72, t: 0.07, r: 0.03, rc: 0.08, crown: 0.012 })
    // Frame behind the pad, onto the bearings.
    for (const s of [-1, 1]) {
      a.bearing(C(s * RX, -0.02, -HS.off), r, 0.022, 0.15)
      a.bearing(C(s * RX, 0.52, -HS.off), r, 0.022, 0.15)
      a.tube(C(s * 0.12, -0.04, -0.175), C(s * 0.12, 0.62, -0.175), 0.05, 0.03, M.arm, { side: [1, 0, 0] })
      // Horn low on the carriage, with plates.
      a.tube(C(s * RX, 0.06, -HS.off), C(s * (RX + 0.055), 0.06, -0.335), 0.06, 0.06, M.arm, { side: [0, 1, 0] })
      a.horn(C(s * (RX + 0.055), 0.06, -0.335), [s, 0, 0], 0.27, [[0.45, 0.038], [0.31, 0.03]])
      // Shoulder pad: thick and short, from the back plane over the top of the shoulder.
      const sc = C(s * 0.15, 0.525, -0.03)
      a.pad({ name: `shoulder${s > 0 ? 'L' : 'R'}`, c: sc, n: r.clone().negate(), u: nb, w: 0.12, l: 0.17, t: 0.08, r: 0.038, rc: 0.05, crown: 0.012 })
      a.tube(C(s * 0.15, 0.525 + 0.08 + 0.004, -0.12), C(s * 0.15, 0.525 + 0.08 + 0.004, 0.05), 0.1, 0.012, M.arm, { side: [1, 0, 0], r: 0.004 })
      a.tube(C(s * 0.15, 0.62, -0.09), C(s * 0.14, 0.56, -0.175), 0.05, 0.03, M.arm, { side: [1, 0, 0] })
      // Handle above the shoulder pad, turning out.
      const h0 = C(s * 0.215, 0.585, 0.03)
      const h1 = C(s * 0.345, 0.585, 0.03)
      a.bentRod([C(s * 0.15, 0.612, -0.03), C(s * 0.215, 0.612, 0.03), h0], 0.0125, M.steel, { fillet: 0.02, caps: false })
      a.grip(h0, h1, 0.0165, { name: `handle${s > 0 ? 'L' : 'R'}` })
    }
    for (const k of [-0.02, 0.28, 0.52]) a.tube(C(-RX, k, -HS.off), C(RX, k, -HS.off), 0.06, 0.05, M.arm, { side: [0, 1, 0] })
    for (const s of [-1, 1]) for (const k of [-0.02, 0.28, 0.52]) a.tube(C(s * 0.12, k, -HS.off), C(s * 0.12, k, -0.175), 0.05, 0.04, M.arm, { side: [1, 0, 0] })
  })
  car.position.copy(hipTop).addScaledVector(r, t)
  root.add(car)
  return root
}

// ---- Lying leg curl: prone on an angled bench, knee on the pivot, roller behind the ankles.
const LC = { hipY: 0.72, thigh: 12, chest: 10 }
export const lyingCurlAxes = () => {
  const a = LC.thigh * D
  const hip = new V3(0, LC.hipY, 0)
  const knee = hip.clone().add(new V3(0, -Math.sin(a) * 0.419, -Math.cos(a) * 0.419))
  return { hip, knee }
}
machines['lying-leg-curl'] = function lyingLegCurl(p, ctx) {
  const root = rootFor(p)
  const { hip, knee } = lyingCurlAxes()
  const pivot = knee.clone().setX(0)
  const X = -0.23
  const PX = -0.3
  const CX = -0.272
  const towerZ = pivot.z - 0.84
  const H = 1.32
  const a1 = LC.thigh * D
  const b1 = LC.chest * D
  const thighT = new V3(0, Math.sin(a1), Math.cos(a1)) // toward the hip
  const thighN = new V3(0, Math.cos(a1), -Math.sin(a1))
  const chestT = new V3(0, -Math.sin(b1), Math.cos(b1)) // toward the head
  const chestN = new V3(0, Math.cos(b1), Math.sin(b1))
  root.add(
    part('lyingcurl-frame', (a) => {
      floorSpine(a, -1.14, 0.86, [[-0.3, 0.3, 0.86], [-0.42, 0.3, -0.42]])
      a.tube([0, 0.05, -1.14], [CX - 0.18, 0.05, -1.14], 0.05, 0.05, M.frame)
      const thC = hip.clone().addScaledVector(thighT, -0.205).addScaledVector(thighN, -0.142)
      a.pad({ name: 'thigh', c: thC, n: thighN, u: thighT, w: 0.34, l: 0.42, t: 0.065, r: 0.028, rc: 0.05, crown: 0.012, taper: 0.0 })
      const chC = hip.clone().addScaledVector(chestT, 0.36).addScaledVector(chestN, -0.15)
      a.pad({ name: 'chest', c: chC, n: chestN, u: chestT, w: 0.3, l: 0.64, t: 0.065, r: 0.028, rc: 0.06, crown: 0.012, taper: 0.1 })
      // The bench's spine under both pads: a single bent tube, down to the floor at each end.
      const b0 = thC.clone().addScaledVector(thighN, -0.11).addScaledVector(thighT, -0.2)
      const bm = hip.clone().add(new V3(0, -0.28, 0.0))
      const b2 = chC.clone().addScaledVector(chestN, -0.11).addScaledVector(chestT, 0.28)
      a.bent([b0, bm, b2], 0.1, 0.06, M.frame, { side: [1, 0, 0], fillet: 0.12 })
      a.tube(b0.clone().lerp(bm, 0.28), [0, 0.07, b0.z + 0.12], 0.08, 0.07, M.frame)
      a.tube(b2.clone().lerp(bm, 0.2), [0, 0.07, b2.z + 0.04], 0.08, 0.07, M.frame)
      // Handles under the front of the chest pad, across the forearm's line.
      for (const s of [-1, 1]) {
        const gc = new V3(s * 0.27, 0.44, 0.645)
        const ax = new V3(0, 0.8, 0.6)
        const g0 = gc.clone().addScaledVector(ax, -0.085)
        const g1 = gc.clone().addScaledVector(ax, 0.085)
        a.bentRod([[0, 0.5, 0.42], [s * 0.27, 0.5, 0.42], g1], 0.0125, M.frame, { fillet: 0.04, caps: false })
        a.grip(g1, g0, 0.0165, { name: `handle${s > 0 ? 'L' : 'R'}` })
      }
      // The post with the knee pivot.
      a.tube([PX, 0.05, pivot.z + 0.2], [PX, pivot.y + 0.06, pivot.z + 0.02], 0.07, 0.07, M.frame)
      a.tube([PX, 0.05, pivot.z - 0.26], [PX, pivot.y - 0.1, pivot.z - 0.015], 0.05, 0.05, M.frameDark)
      a.tube([0, 0.05, pivot.z + 0.2], [PX, 0.05, pivot.z + 0.2], 0.05, 0.05, M.frame)
      a.tube([PX, 0.05, pivot.z - 0.26], [PX, 0.05, pivot.z + 0.2], 0.05, 0.05, M.frame)
      a.tube([PX + 0.04, pivot.y, pivot.z], [PX - 0.045, pivot.y, pivot.z], 0.05, 0.05, M.chrome, { r: 0.025 })
      a.hub([PX - 0.043, pivot.y, pivot.z], [-1, 0, 0], 0.035, 0.008)
    }),
  )
  // The straight leg is where the lever rests. The shin direction sets the angle.
  const rest = 90 - LC.thigh
  let ang = (p.angle ?? rest) * D
  if (ctx) {
    const kn = limb(p, ctx, 'lowerleg01', p.side)
    const an = limb(p, ctx, 'foot', p.side)
    ang = angleAbout([1, 0, 0], [0, -1, 0], an.clone().sub(kn))
    if (ang < -0.5) ang += 2 * Math.PI
  }
  swing(root, 'lyingcurl-arm', pivot, [1, 0, 0], ang, (a) => legLever(a, { X, off: -0.088, along: 0.36, camX: CX, shaftTo: PX + 0.03 }))
  const lift = Math.max(0, ang - rest * D) * 0.08
  const cfg = { at: [CX, towerZ], H, n: 12, sel: 5, footZ: 0.22 }
  addStack(root, cfg, lift)
  lowRun(root, 'lc', { X: CX, cam: pivot.clone().setX(CX), camR: 0.08, frontZ: pivot.z - 0.14, towerZ, H, n: cfg.n, sel: cfg.sel, wrap: -1 }, lift)
  return root
}

// ---- Seated calf raise: lever pad on the lower thighs, plates on the far end of the lever.
const SC = { S: 0.5, ballY: 0.115, ballZ: 0.585, pivot: [0, 0.3, -0.2] }
machines['seated-calf'] = function seatedCalf(p, ctx) {
  const root = rootFor(p)
  const S = SC.S
  const P = new V3(...SC.pivot)
  const padRest = new V3(0, S + 0.215, 0.33)
  root.add(
    part('seatedcalf-frame', (a) => {
      floorSpine(a, -0.42, 1.0, [[-0.3, 0.3, -0.38], [-0.3, 0.3, 0.98]])
      // Seat on a triangular upright, which also carries the lever's pivot.
      a.sidePlate([[-0.34, 0.08], [0.18, 0.08], [0.2, S - 0.09], [-0.16, S - 0.09], [-0.32, 0.36]], 0.03, 0.01, M.frame, { round: 0.03, holes: [[-0.07, 0.2, 0.05], [0.06, 0.2, 0.04]] })
      a.sidePlate([[-0.34, 0.08], [0.18, 0.08], [0.2, S - 0.09], [-0.16, S - 0.09], [-0.32, 0.36]], -0.04, 0.01, M.frame, { round: 0.03, holes: [[-0.07, 0.2, 0.05], [0.06, 0.2, 0.04]] })
      a.tube([0, S - 0.09, -0.13], [0, S - 0.09, 0.22], 0.1, 0.05, M.frame, { side: [1, 0, 0] })
      a.pad({ name: 'seat', c: [0, S, 0.04], n: [0, 1, 0], u: [0, 0, 1], w: 0.31, l: 0.36, t: 0.07, r: 0.028, rc: 0.06, crown: 0.012, taper: 0.08, fall: 0.01 })
      // Foot block: a stepped steel plate on its own post, with a rubber top. Balls of the feet over its front edge.
      a.tube([0, 0.05, SC.ballZ + 0.02], [0, SC.ballY - 0.04, SC.ballZ + 0.02], 0.08, 0.04, M.frame, { side: [1, 0, 0] })
      a.footPlate([0, SC.ballY, SC.ballZ + 0.05], [0, 1, 0], [0, 0, 1], 0.5, 0.2, 0.024, { name: 'block' })
      a.tube([-0.24, SC.ballY - 0.04, SC.ballZ + 0.05], [0.24, SC.ballY - 0.04, SC.ballZ + 0.05], 0.05, 0.05, M.frame, { side: [0, 0, 1] })
      // The stop that holds the lever at rest, and a guide post.
      a.tube([0, 0.05, 0.86], [0, 0.46, 0.86], 0.06, 0.06, M.frame)
      a.lathe([[0.025, 0], [0.025, 0.02], [0.018, 0.028], [0, 0.028]], M.rubber, [0, 0.46, 0.86], [0, 1, 0], 18)
      a.rod([-0.09, P.y, P.z], [0.09, P.y, P.z], 0.018, M.chrome)
    }),
  )
  let ang = (p.angle ?? 0) * D
  if (ctx) {
    const k = avg(limb(p, ctx, 'lowerleg01', 'L'), limb(p, ctx, 'lowerleg01', 'R'))
    // The pad rides on the thighs, above the knee and a little behind it.
    const target = k.clone().add(new V3(0, 0.1, -0.085))
    ang = angleAbout([1, 0, 0], padRest.clone().sub(P), target.sub(P))
  }
  swing(root, 'seatedcalf-lever', P, [1, 0, 0], ang, (a) => {
    const beamEnd = new V3(0, 0, 1.28)
    a.tube([0, 0, -0.04], beamEnd, 0.06, 0.09, M.arm, { side: [1, 0, 0] })
    a.hub([0.03, 0, 0], [1, 0, 0], 0.045, 0.006)
    a.hub([-0.03, 0, 0], [-1, 0, 0], 0.045, 0.006)
    // The post up to the pad: rises between the shins.
    const pad = padRest.clone().sub(P)
    a.tube([0, 0.02, pad.z - 0.05], [0, pad.y + 0.075, pad.z], 0.05, 0.05, M.arm, { side: [1, 0, 0] })
    a.holes([0.0252, 0.14, pad.z - 0.035], [0.0252, 0.32, pad.z - 0.012], 5, 0.0048, [1, 0, 0])
    a.tube([-0.14, pad.y + 0.075, pad.z], [0.14, pad.y + 0.075, pad.z], 0.045, 0.045, M.arm, { side: [0, 1, 0] })
    for (const s of [-1, 1]) a.pad({ name: s > 0 ? 'kneeL' : 'kneeR', c: [s * 0.12, pad.y, pad.z], n: [0, -1, 0], u: [0, 0, 1], w: 0.17, l: 0.16, t: 0.058, r: 0.028, rc: 0.05, crown: 0.012 })
    // A short bar on top for the hands.
    for (const s of [-1, 1]) a.grip([s * 0.02, pad.y + 0.1, pad.z - 0.0], [s * 0.15, pad.y + 0.1, pad.z - 0.0], 0.0165, { name: `handle${s > 0 ? 'L' : 'R'}` })
    a.rod([0, pad.y + 0.075, pad.z], [0, pad.y + 0.1, pad.z], 0.0125, M.steel)
    a.rod([-0.03, pad.y + 0.1, pad.z], [0.03, pad.y + 0.1, pad.z], 0.0125, M.steel)
    // The plates, on a horn crossing the end of the beam. The upright horn takes more.
    a.horn([0.035, 0.0, 1.2], [1, 0, 0], 0.24, [[0.45, 0.038], [0.31, 0.03]])
    a.horn([-0.035, 0.0, 1.2], [-1, 0, 0], 0.24, [[0.45, 0.038], [0.31, 0.03]])
  })
  return root
}

// ---- Standing calf machine: shoulder yoke on a long lever from a high pivot in front of the figure, stack behind that pivot.
const CM = { blockY: 0.14, ballZ: 0.06 }
export const calfAxes = () => ({ P: new V3(0, 1.82, 0.62), padY: 1.545, padZ: -0.03 })
machines['standing-calf'] = function standingCalf(p, ctx) {
  const root = rootFor(p)
  const { P, padY, padZ } = calfAxes()
  const towerZ = 1.02
  const H = 1.84
  const wheelZ = towerZ - HEAD_R
  const tip = new V3(0, P.y + 0.04, wheelZ - HEAD_R)
  const shoulderRest = new V3(0, padY - 0.065, padZ)
  root.add(
    part('calf-frame', (a) => {
      floorSpine(a, -0.26, 1.28, [[-0.34, 0.34, -0.22], [-0.3, 0.3, 1.26]])
      // The block under the balls of the feet.
      a.tube([0, 0.05, CM.ballZ + 0.13], [0, CM.blockY - 0.03, CM.ballZ + 0.13], 0.1, 0.05, M.frame, { side: [1, 0, 0] })
      a.footPlate([0, CM.blockY, CM.ballZ + 0.095], [0, 1, 0], [0, 0, 1], 0.56, 0.21, 0.03, { name: 'block' })
      a.tube([-0.26, CM.blockY - 0.05, CM.ballZ + 0.11], [0.26, CM.blockY - 0.05, CM.ballZ + 0.11], 0.06, 0.04, M.frame, { side: [0, 1, 0] })
      // Column carrying the pivot; a stay to the base.
      a.bent([[0, 0.06, 0.62], [0, P.y + 0.09, 0.62]], 0.09, 0.09, M.frame, { side: [1, 0, 0], fillet: 0.1, caps: true })
      a.tube([0, 0.05, 0.28], [0, 0.82, 0.62], 0.05, 0.05, M.frameDark)
      a.tube([0, P.y + 0.06, 0.62], [0, H + 0.03, towerZ], 0.06, 0.06, M.frameDark)
      a.rod([-0.1, P.y, P.z], [0.1, P.y, P.z], 0.02, M.chrome)
      pulley(a, [0, H + 0.13, wheelZ], [1, 0, 0], HEAD_R, { base: [0, H + 0.07, wheelZ] })
    }),
  )
  let ang = (p.angle ?? 0) * D
  if (ctx) {
    const sh = avg(toLocal(p, ctx.joints['upperarm01.L']), toLocal(p, ctx.joints['upperarm01.R']))
    ang = angleAbout([1, 0, 0], shoulderRest.clone().sub(P), sh.sub(P))
  }
  const lift = Math.max(0, ang) * 0.3
  swing(root, 'calf-yoke', P, [1, 0, 0], ang, (a) => {
    const pad = new V3(0, padY - P.y, padZ - P.z)
    const armY = pad.y + 0.045
    const fork = new V3(0, armY, 0.4 - 0.62)
    // The main lever, from past the pivot back and down to the fork in front of the chest.
    a.bent([[0, tip.y - P.y, tip.z - P.z], [0, 0, 0], fork], 0.05, 0.08, M.arm, { side: [1, 0, 0], fillet: 0.1 })
    a.hub([0.05, 0, 0], [1, 0, 0], 0.045, 0.006)
    a.hub([-0.05, 0, 0], [-1, 0, 0], 0.045, 0.006)
    a.rod([-0.05, 0, 0], [0.05, 0, 0], 0.04, M.arm)
    // The fork around the shoulders, and a pad on each one, hung from its outer side.
    for (const s of [-1, 1]) {
      a.bent([[0, armY, fork.z], [s * 0.225, armY, fork.z - 0.1], [s * 0.225, armY, pad.z - 0.13]], 0.038, 0.038, M.arm, { side: [0, 1, 0], fillet: 0.07, r: 0.012 })
      a.pad({ name: `shoulder${s > 0 ? 'L' : 'R'}`, c: [s * 0.15, pad.y, pad.z], n: [0, -1, 0], u: [0, 0, 1], w: 0.13, l: 0.2, t: 0.085, r: 0.04, rc: 0.055, crown: 0.012, board: false })
      a.tube([s * 0.09, pad.y + 0.087, pad.z], [s * 0.225, pad.y + 0.087, pad.z], 0.12, 0.012, M.arm, { side: [0, 0, 1], r: 0.004 })
      a.tube([s * 0.225, pad.y + 0.087, pad.z], [s * 0.225, armY, pad.z], 0.03, 0.03, M.arm)
      // Handle, standing out from the fork.
      a.grip([s * 0.245, armY, pad.z + 0.1], [s * 0.37, armY, pad.z + 0.1], 0.0165, { name: `handle${s > 0 ? 'L' : 'R'}` })
    }
  })
  addStack(root, { at: [0, towerZ], H, n: 16, sel: 6, footZ: 0.24 }, lift)
  const tipNow = tip.clone().sub(P).applyAxisAngle(new V3(1, 0, 0), ang).add(P)
  addCable(root, [{ c: tipNow }, { c: [0, H + 0.13, wheelZ], r: HEAD_R, s: -1 }, { c: [0, stackTop(16) + 0.07 + lift, towerZ], r: 0, s: 1 }], [1, 0, 0])
  return root
}

// ---- Pec deck / rear delt fly: an arm on each side around a vertical axle above the shoulder, a vertical handle at its end.
export const PD = { S: 0.44, recline: 5, px: 0.19, pz: -0.02, top: 1.42, R: 0.565, gripY: 1.0 }
machines['pec-deck'] = function pecDeck(p, ctx) {
  const root = rootFor(p)
  const { S, recline, px, pz, top, R, gripY } = PD
  const reverse = p.mode === 'reverse'
  const tz = -0.76
  const H = 1.52
  root.add(
    part('pecdeck-frame', (a) => {
      floorSpine(a, -1.0, 0.62, [[-0.34, 0.34, 0.6], [-0.34, 0.34, -0.42]])
      seatAndBack(a, { S, recline, along: 0.43, backL: 0.5, backW: 0.3, railFoot: -0.34, seatZ: 0.07, seatL: 0.44 })
      // Two beams from the tower's head forward to the axles, a bridge between them.
      for (const s of [-1, 1]) {
        a.tube([s * 0.1, top + 0.11, tz], [s * px, top + 0.11, pz], 0.06, 0.08, M.frame, { side: [0, 1, 0], capB: true })
        a.rod([s * px, top - 0.06, pz], [s * px, top + 0.07, pz], 0.03, M.steel)
        a.hub([s * px, top + 0.07, pz], [0, 1, 0], 0.036, 0.006, M.steel)
      }
      a.tube([-0.14, top + 0.11, tz], [0.14, top + 0.11, tz], 0.08, 0.06, M.frame, { side: [0, 0, 1] })
      a.tube([0, top + 0.11, tz], [0, H + 0.03, tz], 0.05, 0.05, M.frameDark)
    }),
  )
  // The arm's angle comes from the hand, and so does its reach: real arms adjust, and a hand on an arc around the shoulder is
  // not quite on an arc around the axle.
  const poseOf = (s) => {
    if (!ctx) return { ang: (p.angle ?? (reverse ? 165 : 75)) * s * D, reach: R }
    const h = handOn(p, ctx, s).sub(new V3(s * px, top, pz))
    return { ang: angleAbout([0, 1, 0], [0, 0, 1], h), reach: Math.round(Math.hypot(h.x, h.z) / 0.003) * 0.003 }
  }
  let travel = 0
  for (const s of [-1, 1]) {
    const { ang, reach } = poseOf(s)
    const rest = (reverse ? 165 : 75) * s * D
    travel += Math.abs(ang - rest) / 2
    swing(root, `pecdeck-arm${s},${reach}`, [s * px, top, pz], [0, 1, 0], ang, (a) => {
      const dy = top - gripY
      a.bent([[0, 0, -0.04], [0, 0, reach], [0, -dy + 0.13, reach]], 0.045, 0.07, M.arm, { side: [1, 0, 0], fillet: 0.09, r: 0.008, caps: false })
      a.lathe([[0.042, -0.05], [0.042, 0.05], [0, 0.05]], M.arm, [0, 0, 0], [0, 1, 0], 28)
      // The handle: a rubber sleeve hanging from the arm's end.
      a.lathe([[0.0225, 0], [0.019, 0.012], [0, 0.012]], M.steel, [0, -dy + 0.13, reach], [0, 1, 0], 16)
      a.grip([0, -dy + 0.125, reach], [0, -dy - 0.125, reach], 0.0165, { name: `handle${s > 0 ? 'L' : 'R'}` })
      cam(a, [0, 0.12, 0], [0, 1, 0], 0.06, 0.075, 0.016, 0, M.frameDark)
    })
  }
  const lift = travel * 0.07
  const cfg = { at: [0, tz], H, n: 14, sel: 6, footZ: 0.24 }
  addStack(root, cfg, lift)
  const eye = stackTop(cfg.n) + 0.07 + lift
  const wy = H + 0.13
  root.add(part('pecdeck-wheels', (a) => pulley(a, [0, wy, tz + HEAD_R], [1, 0, 0], HEAD_R, { base: [0, H + 0.07, tz + HEAD_R] })))
  for (const s of [-1, 1]) {
    // From the cam, back along the beam to the wheel.
    root.add(kit.between([s * (px - 0.05), top + 0.12, pz - 0.05], [s * 0.012, wy + HEAD_R, tz + HEAD_R], 0.0034, M.cable, 8))
  }
  addCable(root, [{ c: [0, wy, tz + HEAD_R], r: HEAD_R, s: -1 }, { c: [0, eye, tz], r: 0, s: 1 }], [1, 0, 0])
  return root
}

// ---- Plate-loaded rows: a lever on each side, swinging around a crossing axle.
export const ROW = {
  high: { S: 0.5, P: [0.33, 1.86, -0.12], R: 0.835, a0: 52, a1: 30, x: 0.24 },
  iso: { S: 0.46, P: [0.34, 0.3, 0.42], R: 0.75, a0: 15.5, a1: -14.5, x: 0.24 },
}
/** Hand centre on the lever at angle a (degrees from straight down for the high row, from straight up for the iso row). */
export function rowHand(kind, a, s = 1) {
  const c = ROW[kind]
  const q = a * D
  const [px, py, pz] = c.P
  if (kind === 'high') return new V3(s * c.x, py - c.R * Math.cos(q), pz + c.R * Math.sin(q))
  return new V3(s * c.x, py + c.R * Math.cos(q), pz + c.R * Math.sin(q))
}
machines['high-row'] = function highRow(p, ctx) {
  const root = rootFor(p)
  const c = ROW.high
  const [px, py, pz] = c.P
  const S = c.S
  const hipY = S + 0.098
  root.add(
    part('highrow-frame', (a) => {
      floorSpine(a, -0.78, 0.78, [[-0.42, 0.42, 0.78], [-0.42, 0.42, -0.72]])
      // A post under the seat.
      a.tube([0, 0.08, 0.02], [0, S - 0.09, 0.02], 0.08, 0.08, M.frame)
      a.tube([0, S - 0.09, -0.12], [0, S - 0.09, 0.2], 0.1, 0.05, M.frame, { side: [1, 0, 0] })
      a.pad({ name: 'seat', c: [0, S, 0.05], n: [0, 1, 0], u: [0, 0, 1], w: 0.33, l: 0.36, t: 0.075, r: 0.028, rc: 0.06, crown: 0.012, taper: 0.1, fall: 0.012 })
      seatPostDetail(a, S, 0.02)
      // The thigh hold-down: a padded bar on a post in front of the knees.
      const hy = hipY + 0.115
      a.tube([0, 0.05, 0.66], [0, hy + 0.1, 0.5], 0.06, 0.06, M.frame)
      a.tube([0, hy + 0.1, 0.5], [0, hy + 0.05, 0.33], 0.05, 0.05, M.frameDark)
      a.rod([-0.22, hy + 0.05, 0.33], [0.22, hy + 0.05, 0.33], 0.012, M.steel)
      a.roller([0.01, hy + 0.05, 0.33], [0.2, hy + 0.05, 0.33], 0.05)
      a.roller([-0.01, hy + 0.05, 0.33], [-0.2, hy + 0.05, 0.33], 0.05)
      // Column behind the figure and the beam out to the axle.
      const zr = -0.7
      a.bent([[0, 0.07, zr], [0, py + 0.09, zr + 0.02], [0, py + 0.09, pz + 0.14]], 0.09, 0.075, M.frame, { side: [1, 0, 0], fillet: 0.14, r: 0.01 })
      a.tube([0, 0.05, zr + 0.42], [0, 0.72, zr + 0.015], 0.05, 0.05, M.frameDark)
      a.rod([-px + 0.05, py, pz], [px - 0.05, py, pz], 0.032, M.frame)
      for (const s of [-1, 1]) a.sidePlate([[pz - 0.08, py + 0.09], [pz + 0.08, py + 0.09], [pz + 0.05, py - 0.045], [pz - 0.05, py - 0.045]], s * 0.058 - 0.004, 0.008, M.frameDark, { round: 0.015 })
    }),
  )
  for (const s of [-1, 1]) {
    const P = new V3(s * px, py, pz)
    const H0 = rowHand('high', c.a0, s).sub(P)
    let ang = (p.angle ?? 0) * D
    if (ctx) {
      ang = angleAbout([1, 0, 0], [0, H0.y, H0.z], handOn(p, ctx, s).sub(P))
    }
    swing(root, `highrow-lever${s}`, P, [1, 0, 0], ang, (a) => {
      // The lever runs forward from the axle, then a hanger drops to the handle.
      const lx = s * 0.0
      const elbow = new V3(lx, -0.09, H0.z + 0.03)
      const lowEnd = new V3(lx, H0.y + 0.075, H0.z + 0.0)
      a.bent([[lx, 0, 0], elbow, lowEnd], 0.04, 0.066, M.arm, { side: [1, 0, 0], fillet: 0.11, r: 0.007, caps: false })
      a.lathe([[0.04, -0.05], [0.04, 0.03], [0, 0.03]], M.arm, [lx, 0, 0], [s, 0, 0], 28)
      a.hub([s * 0.03, 0, 0], [s, 0, 0], 0.036, 0.006)
      // Handle: from the hanger's foot, inward along X.
      a.rod(lowEnd, [lx, H0.y, H0.z], 0.0125, M.steel)
      a.bentRod([lowEnd.clone().add(new V3(0, -0.02, 0)), [lx, H0.y, H0.z], [H0.x + s * 0.09, H0.y, H0.z]], 0.0125, M.steel, { fillet: 0.02, caps: false })
      a.grip([H0.x + s * 0.09, H0.y, H0.z], [H0.x - s * 0.09, H0.y, H0.z], 0.0165, { name: `handle${s > 0 ? 'L' : 'R'}` })
      // Behind the axle: the short arm with the horn. It rises as the handle comes down.
      const back = new V3(lx, -0.17, -0.44)
      a.tube([lx, 0, 0], back, 0.04, 0.066, M.arm, { side: [1, 0, 0], r: 0.007 })
      a.horn(back.clone().add(new V3(s * 0.02, 0, 0)), [s, 0, 0], 0.26, [[0.45, 0.038], [0.31, 0.03]])
    })
  }
  return root
}

machines['iso-row'] = function isoRow(p, ctx) {
  const root = rootFor(p)
  const c = ROW.iso
  const [px, py, pz] = c.P
  const S = c.S
  root.add(
    part('isorow-frame', (a) => {
      floorSpine(a, -0.36, 1.1, [[-0.3, 0.3, 1.08], [-0.3, 0.3, -0.32]])
      a.tube([0, 0.08, 0.02], [0, S - 0.09, 0.02], 0.08, 0.08, M.frame)
      a.tube([0, S - 0.09, -0.1], [0, S - 0.09, 0.2], 0.1, 0.05, M.frame, { side: [1, 0, 0] })
      a.pad({ name: 'seat', c: [0, S, 0.04], n: [0, 1, 0], u: [0, 0, 1], w: 0.33, l: 0.34, t: 0.075, r: 0.028, rc: 0.06, crown: 0.012, taper: 0.1, fall: 0.012 })
      seatPostDetail(a, S, 0.02)
      // The chest pad, on a post rising between the knees.
      const cc = new V3(0, 0.885, 0.178)
      a.pad({ name: 'chest', c: cc, n: [0, 0.09, -1], u: [0, 1, 0.09], w: 0.26, l: 0.4, t: 0.065, r: 0.03, rc: 0.08, crown: 0.012 })
      a.bent([[0, 0.07, 0.72], [0, 0.72, 0.48], [0, 0.885, 0.36]], 0.06, 0.08, M.frame, { side: [1, 0, 0], fillet: 0.14, caps: false })
      a.tube([0, 0.885, 0.36], [0, 0.885, cc.z + 0.08], 0.05, 0.05, M.frameDark)
      // Axle stands, one each side.
      for (const s of [-1, 1]) {
        a.tube([s * 0.42, 0.04, pz - 0.2], [s * 0.42, py + 0.03, pz], 0.05, 0.05, M.frameDark)
        a.tube([s * 0.42, 0.04, pz + 0.2], [s * 0.42, py + 0.03, pz], 0.05, 0.05, M.frameDark)
        a.tube([s * 0.42, 0.03, pz - 0.28], [s * 0.42, 0.03, pz + 0.28], 0.06, 0.06, M.frame, { side: [0, 1, 0] })
        foot(a, s * 0.42, pz - 0.24)
        foot(a, s * 0.42, pz + 0.24)
        a.tube([0, 0.05, pz], [s * 0.42, 0.04, pz], 0.05, 0.05, M.frameDark)
        a.rod([s * 0.3, py, pz], [s * 0.45, py, pz], 0.02, M.chrome)
      }
    }),
  )
  for (const s of [-1, 1]) {
    const P = new V3(s * px, py, pz)
    const H0 = rowHand('iso', c.a0, s).sub(P)
    let ang = (p.angle ?? 0) * D
    if (ctx) {
      ang = angleAbout([1, 0, 0], [0, H0.y, H0.z], handOn(p, ctx, s).sub(P))
    }
    swing(root, `isorow-lever${s}`, P, [1, 0, 0], ang, (a) => {
      // Up from the axle, bent in at the top, the handle hanging from there.
      const top = new V3(s * 0.0, H0.y + 0.1, H0.z + 0.02)
      a.bent([[0, 0, 0], [0, H0.y * 0.5, 0.02], top], 0.04, 0.066, M.arm, { side: [1, 0, 0], fillet: 0.2, r: 0.007, caps: false })
      a.lathe([[0.04, -0.05], [0.04, 0.05], [0, 0.05]], M.arm, [0, 0, 0], [s, 0, 0], 28)
      a.hub([s * 0.05, 0, 0], [s, 0, 0], 0.036, 0.006)
      a.hub([-s * 0.05, 0, 0], [-s, 0, 0], 0.036, 0.006)
      a.bentRod([top, [H0.x, H0.y + 0.135, H0.z + 0.0], [H0.x, H0.y + 0.1, H0.z]], 0.0125, M.steel, { fillet: 0.02, caps: false })
      a.grip([H0.x, H0.y + 0.11, H0.z], [H0.x, H0.y - 0.11, H0.z], 0.0165, { name: `handle${s > 0 ? 'L' : 'R'}` })
      // Ahead of the axle: the arm with the horn. It rises as the handle comes back.
      const fw = new V3(0, 0.03, 0.56)
      a.tube([0, 0, 0], fw, 0.04, 0.066, M.arm, { side: [1, 0, 0], r: 0.007 })
      a.horn(fw.clone().add(new V3(s * 0.02, 0, 0)), [s, 0, 0], 0.26, [[0.45, 0.038], [0.31, 0.03]])
    })
  }
  return root
}

// ---- Dip machine: long levers from an axle in front of the knees, their ends are the handles by the hips.
export const DIP = { S: 0.46, P: [0.33, 0.481, 0.75], H0: [0.31, 0.72, 0.06], H1: [0.31, 0.46, 0.02] }
machines['dip-machine'] = function dipMachine(p, ctx) {
  const root = rootFor(p)
  const { S, P: pp, H0, H1 } = DIP
  const [px, py, pz] = pp
  const towerZ = -0.86
  const H = 1.42
  const CX = 0.12
  root.add(
    part('dip-frame', (a) => {
      floorSpine(a, -1.02, 0.98, [[-0.44, 0.44, pz], [-0.3, 0.3, -0.42]])
      seatAndBack(a, { S, recline: 8, along: 0.36, backL: 0.66, railFoot: -0.34 })
      for (const s of [-1, 1]) {
        a.tube([s * 0.42, 0.05, pz], [s * 0.42, py + 0.05, pz], 0.07, 0.07, M.frame)
        a.tube([s * 0.42, 0.05, pz + 0.24], [s * 0.42, py - 0.1, pz + 0.02], 0.05, 0.05, M.frameDark)
        a.tube([s * 0.42, 0.04, pz - 0.14], [s * 0.42, 0.04, pz + 0.28], 0.06, 0.06, M.frame, { side: [0, 1, 0] })
        foot(a, s * 0.42, pz + 0.24)
        foot(a, s * 0.42, pz - 0.1)
      }
      a.rod([-0.45, py, pz], [0.45, py, pz], 0.019, M.chrome)
    }),
  )
  const H0L = new V3(H0[0], H0[1], H0[2])
  const rest = new V3(0, H0[1] - py, H0[2] - pz)
  let ang = (p.angle ?? 0) * D
  if (ctx) {
    const h = avg(toLocal(p, ctx.hands.L.centre), toLocal(p, ctx.hands.R.centre)).sub(new V3(0, py, pz))
    ang = angleAbout([1, 0, 0], rest, h.setX(0))
  }
  swing(root, 'dip-lever', [0, py, pz], [1, 0, 0], ang, (a) => {
    const u = rest.clone().normalize()
    for (const s of [-1, 1]) {
      const X = s * px
      const end = new V3(s * H0L.x, rest.y, rest.z)
      const handle0 = end.clone().addScaledVector(u, -0.115)
      const stem = handle0.clone().setX(X)
      a.tube([X, 0, 0], stem, 0.04, 0.066, M.arm, { side: [1, 0, 0], r: 0.007 })
      a.bentRod([stem, handle0], 0.0125, M.steel, { fillet: 0.01, caps: false })
      a.grip(handle0, end.clone().addScaledVector(u, 0.075), 0.0165, { name: `handle${s > 0 ? 'L' : 'R'}` })
      a.lathe([[0.04, -0.05], [0.04, 0.05], [0, 0.05]], M.arm, [X, 0, 0], [1, 0, 0], 28)
    }
    a.rod([-px + 0.05, 0, 0], [px - 0.05, 0, 0], 0.028, M.arm)
    cam(a, [CX, 0, 0], [1, 0, 0], 0.08, 0.105, 0.018, 250, M.frameDark)
  })
  const lift = Math.max(0, ang < 0 ? -ang : ang) * 0.09
  addStack(root, { at: [CX, towerZ], H, n: 14, sel: 6, footZ: 0.22 }, lift)
  lowRun(root, 'dip', { X: CX, cam: new V3(CX, py, pz), camR: 0.09, frontZ: 0.36, towerZ, H, n: 14, sel: 6, wrap: -1 }, lift)
  return root
}

// ---- Arm machines: upper arms on pads, a lever around the elbow on each side. The hand's centre stays 0.303 from the elbow.
export const ARM = {
  curl: { S: 0.48, pitch: 4, flex: 55, E: [0.194, 0.869, 0.3], R: 0.303 },
  triceps: { S: 0.48, pitch: -6, flex: 72, E: [0.194, 0.948, 0.258], R: 0.303 },
  preacher: { S: 0.52, pitch: 8, flex: 50, E: [0.194, 0.883, 0.317], R: 0.303 },
}
function armMachine(p, ctx, kind) {
  const root = rootFor(p)
  const c = ARM[kind]
  const [ex, ey, ez] = c.E
  const S = c.S
  const preacher = kind === 'preacher'
  const towerZ = -0.66
  const CX = 0.08
  const H = 1.22
  // The upper arm's own line, elbow to shoulder, for the pads under it.
  const u = new V3(0, Math.cos(c.flex * D), -Math.sin(c.flex * D))
  const n = new V3(0, Math.sin(c.flex * D), Math.cos(c.flex * D))
  root.add(
    part(`arm-frame${kind}`, (a) => {
      floorSpine(a, -0.86, 0.82, [[-0.36, 0.36, 0.8], [-0.3, 0.3, -0.34]])
      a.tube([0, 0.08, 0.02], [0, S - 0.09, 0.02], 0.08, 0.08, M.frame)
      a.tube([0, S - 0.09, -0.12], [0, S - 0.09, 0.2], 0.1, 0.05, M.frame, { side: [1, 0, 0] })
      a.pad({ name: 'seat', c: [0, S, 0.05], n: [0, 1, 0], u: [0, 0, 1], w: 0.33, l: 0.36, t: 0.075, r: 0.028, rc: 0.06, crown: 0.012, taper: 0.1, fall: 0.012 })
      seatPostDetail(a, S, 0.02)
      if (kind === 'triceps') {
        const b = backPadAt([0, S + 0.098, 0], -c.pitch, 0.31)
        a.pad({ name: 'back', c: b.c, n: b.n, u: b.u, w: 0.28, l: 0.52, t: 0.07, r: 0.028, rc: 0.07, crown: 0.012 })
        const low = new V3(0, 0.08, -0.32)
        const hi = b.c.clone().addScaledVector(b.n, -0.13).addScaledVector(b.u, 0.2)
        a.tube(low, hi, 0.06, 0.06, M.frame)
        a.tube(b.c.clone().addScaledVector(b.n, -0.082), b.c.clone().addScaledVector(b.n, -0.15), 0.05, 0.05, M.frameDark)
      }
      // The post in front, rising between the knees to a beam across, which carries the arm pads and the axle stands.
      const bz = ez - 0.075
      const by = ey - 0.13
      a.bent([[0, 0.07, 0.72], [0, by - 0.25, 0.5], [0, by, bz + 0.06]], 0.07, 0.07, M.frame, { side: [1, 0, 0], fillet: 0.14, caps: false })
      a.tube([-0.36, by, bz + 0.06], [0.36, by, bz + 0.06], 0.06, 0.06, M.frame, { side: [0, 1, 0] })
      for (const s of [-1, 1]) {
        // Axle stand at the side.
        a.tube([s * 0.36, by, bz + 0.06], [s * 0.36, ey + 0.05, ez], 0.05, 0.05, M.frame)
        a.rod([s * 0.325, ey, ez], [s * 0.385, ey, ez], 0.018, M.chrome)
        a.hub([s * 0.385, ey, ez], [s, 0, 0], 0.03, 0.006)
      }
      if (preacher) {
        // One wide preacher pad under both upper arms.
        const pc = new V3(0, ey, ez).addScaledVector(u, 0.14).addScaledVector(n, -0.046)
        a.pad({ name: 'arms', c: pc, n, u, w: 0.5, l: 0.25, t: 0.06, r: 0.028, rc: 0.05, crown: 0.012 })
        const q = pc.clone().addScaledVector(n, -0.07)
        a.tube(q, [0, by, bz + 0.06], 0.06, 0.06, M.frameDark)
      } else {
        for (const s of [-1, 1]) {
          const pc = new V3(s * ex, ey, ez).addScaledVector(u, 0.1).addScaledVector(n, -0.047)
          a.pad({ name: `arm${s > 0 ? 'L' : 'R'}`, c: pc, n, u, w: 0.135, l: 0.21, t: 0.05, r: 0.024, rc: 0.05, crown: 0.012, dish: 0.012 })
          const q = pc.clone().addScaledVector(n, -0.06)
          a.tube(q, [s * ex, by, bz + 0.06], 0.045, 0.045, M.frameDark)
        }
      }
    }),
  )
  // Lever angle from the hands. Rest is +Z from the elbow.
  const axis = new V3(1, 0, 0)
  let ang = (p.angle ?? 0) * D
  if (ctx) {
    const e = new V3(0, ey, ez)
    if (p.side === 'L' || p.side === 'R') ang = angleAbout(axis, [0, 0, 1], toLocal(p, ctx.hands[p.side].centre).sub(e).setX(0))
    else ang = angleAbout(axis, [0, 0, 1], avg(toLocal(p, ctx.hands.L.centre), toLocal(p, ctx.hands.R.centre)).sub(e).setX(0))
  }
  swing(root, `arm-lever${kind}`, [0, ey, ez], axis, ang, (a) => {
    const X = 0.315
    const R = c.R
    a.rod([-X, 0, 0], [X, 0, 0], 0.016, M.chrome)
    for (const s of [-1, 1]) {
      a.tube([s * X, 0, -0.03], [s * X, 0, R + 0.03], 0.02, 0.05, M.arm, { side: [1, 0, 0], r: 0.006 })
      a.hub([s * X, 0, 0], [s, 0, 0], 0.048, 0.01, M.arm)
      a.holes([s * (X + 0.0105), 0, 0.12], [s * (X + 0.0105), 0, 0.2], 3, 0.005, [s, 0, 0])
      if (!preacher) {
        a.rod([s * X, 0, R], [s * (ex + 0.08), 0, R], 0.0125, M.steel)
        a.grip([s * (ex + 0.085), 0, R], [s * (ex - 0.085), 0, R], 0.0165, { name: `handle${s > 0 ? 'L' : 'R'}` })
      } else {
        a.grip([s * 0.3, 0, R], [s * 0.1, 0, R], 0.0165, { name: `handle${s > 0 ? 'L' : 'R'}`, flange: false })
      }
    }
    if (preacher) a.rod([-X, 0, R], [X, 0, R], 0.0135, M.steel)
    cam(a, [CX, 0, 0], [1, 0, 0], 0.075, 0.1, 0.018, kind === 'triceps' ? 60 : 250, M.frameDark)
  })
  const lift = Math.min(0.34, Math.abs(ang - (ctx ? (p.rest ?? restAng(kind)) : ang)) * 0.075)
  addStack(root, { at: [CX, towerZ], H, n: 14, sel: 6, footZ: 0.22 }, lift)
  lowRun(root, kind, { X: CX, cam: new V3(CX, ey, ez), camR: 0.085, frontZ: 0.36, towerZ, H, n: 14, sel: 6, wrap: kind === 'triceps' ? 1 : -1 }, lift)
  return root
}
/** The lever's angle at the rep's start, where the stack is down. */
const restAng = (kind) => {
  const c = ARM[kind]
  // Curl and preacher start nearly straight; triceps starts bent. The fk elbow angle these are measured against is in the specs.
  const e = kind === 'triceps' ? 118 : 12
  const fore = (c.flex + e) * D
  // angle around +X taking +Z to the forearm's direction
  return angleAbout([1, 0, 0], [0, 0, 1], [0, -Math.cos(fore), Math.sin(fore)])
}
machines['machine-curl'] = (p, ctx) => armMachine(p, ctx, 'curl')
machines['machine-triceps'] = (p, ctx) => armMachine(p, ctx, 'triceps')
machines['machine-preacher'] = (p, ctx) => armMachine(p, ctx, 'preacher')

// ---- Hip abductor / adductor: an arm under each thigh, turning around a vertical axle under the hip joint.
export const HIP = { S: 0.46, recline: 16, jointX: 0.11 }
machines['hip-machine'] = function hipMachine(p, ctx) {
  const root = rootFor(p)
  const { S, recline, jointX } = HIP
  const hipY = S + 0.098
  const adduct = p.mode === 'adductor'
  const towerZ = -0.86
  const H = 1.42
  root.add(
    part('hip-frame', (a) => {
      floorSpine(a, -1.02, 0.34, [[-0.34, 0.34, 0.3], [-0.3, 0.3, -0.42]])
      seatAndBack(a, { S, recline, along: 0.31, backL: 0.62, railFoot: -0.36, seatL: 0.38, seatZ: 0.06 })
      seatHandles(a, S, { x: 0.27, z0: -0.05, z1: 0.14, dy: 0.03 })
      // The axles, each under a hip joint, on a low cross beam.
      a.tube([-0.2, 0.14, 0.05], [0.2, 0.14, 0.05], 0.05, 0.05, M.frameDark, { side: [0, 1, 0] })
      a.tube([0, 0.08, 0.05], [0, 0.14, 0.05], 0.06, 0.06, M.frame)
      for (const s of [-1, 1]) a.rod([s * jointX, 0.14, 0.05], [s * jointX, S - 0.13, 0.05], 0.018, M.chrome)
    }),
  )
  let total = 0
  const armY = 0.26
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'L' : 'R'
    const P = new V3(s * jointX, armY, 0.05)
    let ang = ((p.angle ?? (adduct ? 30 : 0)) * s * D)
    if (ctx) {
      ang = angleAbout([0, 1, 0], [0, 0, 1], jointOn(p, ctx, 'lowerleg01', s).sub(jointOn(p, ctx, 'upperleg01', s)))
    }
    total += Math.abs(ang - (adduct ? 32 * s * D : 2 * s * D)) / 2
    swing(root, `hip-arm${s}${adduct}`, P, [0, 1, 0], ang, (a) => {
      const padY = hipY - armY - 0.015
      const padZ = 0.335
      // The thigh's own width at the knee end decides where the pad's face sits.
      const face = adduct ? -s * 0.072 : s * 0.083
      const padDir = adduct ? s : -s // the way the face looks: toward the thigh
      const pc = new V3(face, padY, padZ)
      a.lathe([[0.03, -0.03], [0.03, 0.03], [0, 0.03]], M.arm, [0, 0, 0], [0, 1, 0], 24)
      const postX = face - padDir * 0.095
      // Arm from the axle, forward to under the pad, up to it.
      a.bent([[0, 0, 0], [0, 0, 0.12], [postX, 0, padZ], [postX, padY, padZ]], 0.045, 0.045, M.arm, { side: [0, 1, 0], fillet: 0.06, caps: true })
      a.pad({ name: `knee${side}`, c: pc, n: [padDir, 0, 0], u: [0, 0, 1], w: 0.15, l: 0.24, t: 0.06, r: 0.028, rc: 0.05, crown: 0.012, board: true })
      a.tube([postX, padY, padZ], [face - padDir * 0.072, padY, padZ], 0.08, 0.08, M.arm, { side: [0, 1, 0], r: 0.008 })
      // Foot rest: a small tread on a stem from the arm, right under the foot.
      const fz = 0.5
      const fy = 0.09 - armY
      a.bent([[postX, 0, padZ], [postX, 0, fz - 0.06], [postX * 0.55, fy - 0.03, fz - 0.06]], 0.03, 0.03, M.arm, { side: [0, 1, 0], fillet: 0.05, r: 0.01, caps: false })
      a.tube([0, fy - 0.022, fz - 0.14], [0, fy - 0.022, fz + 0.1], 0.1, 0.02, M.arm, { side: [1, 0, 0], r: 0.005 })
      a.tube([postX * 0.55, fy - 0.03, fz - 0.06], [0, fy - 0.03, fz - 0.06], 0.03, 0.03, M.arm)
      a.footPlate([0, fy, fz - 0.02], [0, 1, 0], [0, 0, 1], 0.12, 0.26, 0.01, { rib: 0.03 })
    })
  }
  const lift = total * 0.09
  const CX = 0
  addStack(root, { at: [CX, towerZ], H, n: 14, sel: 6, footZ: 0.22 }, lift)
  root.add(
    part('hip-wheels', (a) => {
      pulley(a, [0, 0.115, -0.2], [1, 0, 0], 0.04, { base: [0, 0.07, -0.2] })
      const footZ = towerZ - 2 * HEAD_R + 0.04
      pulley(a, [0, 0.115, footZ], [1, 0, 0], 0.04, { base: [0, 0.07, footZ] })
      pulley(a, [0, H + 0.13, towerZ - HEAD_R], [1, 0, 0], HEAD_R, { base: [0, H + 0.07, towerZ - HEAD_R] })
    }),
  )
  const footZ = towerZ - 2 * HEAD_R + 0.04
  addCable(root, [{ c: [0, 0.115, -0.2], r: 0.04, s: -1 }, { c: [0, 0.115, footZ], r: 0.04, s: -1 }, { c: [0, H + 0.13, towerZ - HEAD_R], r: HEAD_R, s: -1 }, { c: [0, stackTop(14) + 0.07 + lift, towerZ], r: 0, s: -1 }], [1, 0, 0])
  for (const s of [-1, 1]) root.add(kit.between([s * jointX, armY, 0.05], [0, 0.155, -0.2], 0.0034, M.cable, 8))
  return root
}

// ---- Smith machine: a bar on two guide rods. Follows the hands by default; see the notes at the top of this file.
const SM = { rodX: 0.64, postZ: -0.44, top: 2.22 }
export const smithBarY = (p, ctx) => {
  if (!ctx) return p.barY ?? 1.3
  const mode = p.follow === true ? 'hands' : p.follow
  if (mode === 'shoulders') return (toLocal(p, ctx.joints['upperarm01.L']).y + toLocal(p, ctx.joints['upperarm01.R']).y) / 2 + (p.offset ?? 0.07)
  if (mode === 'feet') return (toLocal(p, ctx.feet.L.sole).y + toLocal(p, ctx.feet.R.sole).y) / 2 - (p.offset ?? 0.016)
  if (mode === 'hips') return toLocal(p, ctx.frames.pelvis.pos).y + (p.offset ?? 0)
  if (mode === 'hand-L' || mode === 'hand-R') return toLocal(p, ctx.hands[mode.slice(-1)].centre).y
  return (toLocal(p, ctx.hands.L.centre).y + toLocal(p, ctx.hands.R.centre).y) / 2
}
machines.smith = function smith(p, ctx) {
  const root = rootFor(p)
  const { rodX, postZ, top } = SM
  const tilt = Math.tan((p.tilt ?? 0) * D)
  const zAt = (y) => (y - 1.1) * tilt
  root.add(
    part(`smith-frame${p.tilt ?? 0}`, (a) => {
      const RX = 0.72
      for (const s of [-1, 1]) {
        a.tube([s * RX, 0.035, -0.62], [s * RX, 0.035, 0.6], 0.08, 0.07, M.frame, { side: [1, 0, 0] })
        foot(a, s * RX, -0.57)
        foot(a, s * RX, 0.55)
        a.tube([s * RX, 0.06, postZ], [s * RX, top, postZ], 0.075, 0.075, M.frame)
        // Top rail from the post, forward past the rods.
        a.tube([s * RX, top + 0.035, postZ - 0.04], [s * RX, top + 0.035, 0.18], 0.07, 0.07, M.frame)
        const X = s * rodX
        // The guide rod, clamped at the base and the head.
        a.tube([s * RX, 0.07, zAt(0.07)], [X - s * 0.03, 0.07, zAt(0.07)], 0.06, 0.05, M.frameDark, { side: [0, 0, 1] })
        a.tube([s * RX, top + 0.01, zAt(top + 0.01)], [X - s * 0.03, top + 0.01, zAt(top + 0.01)], 0.06, 0.05, M.frameDark, { side: [0, 0, 1] })
        a.rod([X, 0.05, zAt(0.05)], [X, top + 0.03, zAt(top + 0.03)], 0.019, M.chrome)
        a.lathe([[0.034, 0], [0.034, 0.03], [0.022, 0.036], [0.019, 0.036]], M.steel, [X, 0.08, zAt(0.08)], [0, 1, 0], 22)
        // The ladder of hook pegs, behind the rod.
        const LZ = -0.14
        a.tube([X, 0.06, LZ + zAt(0.06)], [X, top, LZ + zAt(top)], 0.045, 0.03, M.frameDark, { side: [1, 0, 0] })
        for (let y = 0.3; y < top - 0.2; y += 0.1) a.rod([X - 0.012, y, LZ + zAt(y) + 0.012], [X - 0.012, y, LZ + zAt(y) + 0.05], 0.0055, M.steel)
        a.tube([X, 0.06, LZ + zAt(0.06)], [s * RX, 0.06, LZ + zAt(0.06)], 0.04, 0.04, M.frameDark)
        a.tube([X, top - 0.02, LZ + zAt(top)], [s * RX, top - 0.02, LZ + zAt(top)], 0.04, 0.04, M.frameDark)
        // Rubber stop low on the rod, with its collar.
        a.lathe([[0.03, 0], [0.03, 0.05], [0.024, 0.058], [0.019, 0.058]], M.rubber, [X, 0.36, zAt(0.36)], [0, 1, 0], 18)
        // Brace from the base to the post.
        a.tube([s * RX, 0.06, -0.08], [s * RX, 0.75, postZ], 0.045, 0.045, M.frameDark)
      }
      a.tube([-0.72, 0.035, postZ], [0.72, 0.035, postZ], 0.07, 0.07, M.frame)
      a.tube([-0.72, top + 0.035, postZ], [0.72, top + 0.035, postZ], 0.07, 0.07, M.frame)
      a.tube([-0.72, top + 0.035, 0.12], [0.72, top + 0.035, 0.12], 0.07, 0.07, M.frame)
    }),
  )
  const y = smithBarY(p, ctx)
  const plates = p.plates ?? [[0.45, 0.038], [0.31, 0.03]]
  const bar = part(`smith-bar${JSON.stringify(plates)}`, (a) => {
    const X = rodX
    // The bar: smooth in the middle, knurled where hands go.
    a.rod([-X - 0.08, 0, 0], [X + 0.08, 0, 0], 0.0145, M.steel)
    for (const s of [-1, 1]) {
      a.rod([s * 0.03, 0, 0], [s * 0.54, 0, 0], 0.0148, mat.knurl)
      // Carriage on the rod: a bearing, a block around the bar.
      a.bearing([s * X, 0, 0], [0, 1, 0], 0.019, 0.17)
      a.add(kit.rbox(0.055, 0.1, 0.075, 0.008, M.arm, [s * (X - 0.052), 0, 0], 2))
      a.add(kit.rbox(0.055, 0.1, 0.075, 0.008, M.arm, [s * (X + 0.052), 0, 0], 2))
      // The hook, a flat plate behind the carriage, turned by rotating the bar.
      const hx = s * X - 0.012 - 0.004
      a.sidePlate([[0.02, 0.012], [-0.112, 0.012], [-0.112, -0.052], [-0.09, -0.052], [-0.09, -0.01], [0.02, -0.01]], hx, 0.008, M.steel, { round: 0.006, bevel: 0.0006 })
      // Sleeve and collar, plates on it.
      const x0 = s * (X + 0.08)
      a.lathe([[0.0145, 0], [0.034, 0], [0.034, 0.012], [0.025, 0.016], [0.025, 0.27], [0.021, 0.274], [0, 0.274]], M.chrome, [x0, 0, 0], [s, 0, 0], 28)
      let at = 0.016
      for (const [Dia, T] of plates) {
        a.plate([x0 + s * (at + T / 2), 0, 0], [s, 0, 0], Dia, T)
        at += T + 0.001
      }
      a.lathe([[0.025, 0], [0.036, 0], [0.036, 0.022], [0.025, 0.022]], M.steel, [x0 + s * at, 0, 0], [s, 0, 0], 22)
    }
    a.grips.push({ name: 'bar', a: [-X, 0, 0], b: [X, 0, 0] })
  })
  bar.position.set(0, y, zAt(y))
  root.add(bar)
  return root
}

// ---- Lying T-bar row: chest down on a 45 degree pad, feet on steps either side of the lever.
export const TB = { P: [0, 0.3, -0.636], R: 1.167, a0: 28, a1: 42, hipY: 1.1, x: 0.24, sole: [0.11, 0.24, -0.246], drop: 0.16 }
export const tbarHand = (a, s = 1) => new V3(s * TB.x, TB.P[1] + TB.R * Math.sin(a * D), TB.P[2] + TB.R * Math.cos(a * D))
machines['lying-t-bar'] = function lyingTBar(p, ctx) {
  const root = rootFor(p)
  const [ , py, pz] = TB.P
  const hip = new V3(0, TB.hipY, 0)
  const t = new V3(0, Math.SQRT1_2, Math.SQRT1_2)
  const nb = new V3(0, -Math.SQRT1_2, Math.SQRT1_2) // the front of the body
  root.add(
    part('tbar-frame', (a) => {
      const z0 = -0.86
      const z1 = 1.06
      for (const s of [-1, 1]) {
        a.tube([s * 0.3, 0.035, z0], [s * 0.3, 0.035, z1], 0.08, 0.07, M.frame, { side: [1, 0, 0] })
        foot(a, s * 0.3, z0 + 0.05)
        foot(a, s * 0.3, z1 - 0.05)
      }
      for (const z of [z0 + 0.05, -0.1, z1 - 0.05]) a.tube([-0.3, 0.035, z], [0.3, 0.035, z], 0.07, 0.07, M.frame)
      // The pad.
      const c = hip.clone().addScaledVector(t, 0.36).addScaledVector(nb, 0.135)
      const padN = nb.clone().negate()
      a.pad({ name: 'chest', c, n: padN, u: t, w: 0.32, l: 0.56, t: 0.08, r: 0.03, rc: 0.07, crown: 0.012 })
      // Two posts carrying it, with the lever running between them.
      const low = c.clone().addScaledVector(nb, 0.1).addScaledVector(t, 0.15)
      for (const s of [-1, 1]) {
        const top = low.clone().setX(s * 0.115)
        a.tube(top, [s * 0.115, 0.05, 0.93], 0.06, 0.06, M.frame)
        a.tube(c.clone().addScaledVector(nb, 0.1).addScaledVector(t, -0.2).setX(s * 0.115), c.clone().addScaledVector(nb, 0.1).addScaledVector(t, 0.28).setX(s * 0.115), 0.05, 0.05, M.frameDark)
      }
      a.tube([-0.3, 0.035, 0.93], [0.3, 0.035, 0.93], 0.07, 0.07, M.frame)
      // Foot steps either side of the lever, on a frame from the base.
      for (const s of [-1, 1]) {
        a.footPlate([s * 0.145, 0.24, -0.245], [0, 1, 0], [0, 0, 1], 0.19, 0.34, 0.012)
        a.tube([s * 0.145, 0.222, -0.38], [s * 0.145, 0.222, -0.1], 0.06, 0.03, M.frameDark, { side: [1, 0, 0] })
        a.tube([s * 0.145, 0.222, -0.34], [s * 0.145, 0.05, -0.44], 0.04, 0.04, M.frameDark)
        a.tube([s * 0.145, 0.222, -0.14], [s * 0.145, 0.05, -0.1], 0.04, 0.04, M.frameDark)
        a.tube([s * 0.145, 0.05, -0.44], [s * 0.3, 0.05, -0.44], 0.04, 0.04, M.frameDark)
        // The stand that carries the pivot.
        a.sidePlate([[pz - 0.14, 0.05], [pz + 0.14, 0.05], [pz + 0.045, py + 0.045], [pz - 0.045, py + 0.045]], s * 0.075, 0.012, M.frame, { round: 0.02, holes: [[pz, 0.17, 0.035]] })
        a.tube([s * 0.08, 0.05, pz], [s * 0.3, 0.05, pz], 0.05, 0.05, M.frame)
      }
      a.rod([-0.11, py, pz], [0.11, py, pz], 0.018, M.chrome)
      for (const s of [-1, 1]) a.hub([s * 0.087, py, pz], [s, 0, 0], 0.032, 0.006)
      // The cradle the lever rests in, on a rail between the two posts.
      a.tube([-0.115, 0.56, 0.665], [0.115, 0.56, 0.665], 0.035, 0.035, M.frameDark)
      a.lathe([[0.024, 0], [0.024, 0.016], [0, 0.02]], M.rubber, [0, 0.575, 0.665], [0, 1, 0], 14)
    }),
  )
  const H0 = tbarHand(TB.a0, 1).sub(new V3(0, py, pz)).setX(0)
  let ang = (p.angle ?? 0) * D
  if (ctx) {
    const h = avg(toLocal(p, ctx.hands.L.centre), toLocal(p, ctx.hands.R.centre)).sub(new V3(0, py, pz)).setX(0)
    ang = angleAbout([1, 0, 0], H0, h)
  }
  swing(root, 'tbar-lever', [0, py, pz], [1, 0, 0], ang, (a) => {
    // Local: the hand line H0 from the pivot; the lever runs 0.16 below that line, so it clears the pad.
    const u = H0.clone().normalize()
    const down = new V3(0, -u.z, u.y).multiplyScalar(-1) // perpendicular to the lever, on the floor side
    const dn = down.y > 0 ? down.clone().negate() : down.clone()
    const T = H0.clone().addScaledVector(dn, TB.drop)
    const dir = T.clone().normalize()
    const end = dir.clone().multiplyScalar(1.74)
    a.tube([0, 0, 0], end, 0.05, 0.075, M.arm, { side: [1, 0, 0], r: 0.008 })
    a.lathe([[0.04, -0.045], [0.04, 0.045], [0, 0.045]], M.arm, [0, 0, 0], [1, 0, 0], 24)
    // The yoke across the lever, its posts rising to the two handles.
    for (const s of [-1, 1]) {
      const gi = H0.clone().setX(s * 0.165)
      const go = H0.clone().setX(s * 0.315)
      a.bentRod([T.clone().setX(0), T.clone().setX(s * 0.165), gi], 0.0155, M.steel, { fillet: 0.03, caps: false })
      a.grip(gi, go, 0.0165, { name: `handle${s > 0 ? 'L' : 'R'}` })
      a.horn(end.clone().addScaledVector(dir, -0.05).add(new V3(s * 0.025, 0, 0)), [s, 0, 0], 0.22, [[0.45, 0.038], [0.31, 0.03]])
    }
  })
  return root
}

// ---- Leverage shrug and deadlift: a lever each side from a low pivot behind the figure, two handles on each.
export const LV = { P: [0.3, 0.68, -1.05], Q: [0.3, 0.59, -0.12], dY: 0.1, gz: 0.14, deck: 0.09 }
export const leverHand = (which, s = 1) => new V3(s * LV.Q[0], LV.Q[1] + (which === 'top' ? LV.dY : -LV.dY), LV.Q[2] + LV.gz)
machines['leverage-lift'] = function leverageLift(p, ctx) {
  const root = rootFor(p)
  const [px, py, pz] = LV.P
  const which = p.grip === 'top' ? 'top' : 'bottom'
  root.add(
    part('lever-frame', (a) => {
      const z0 = -1.22
      const z1 = 0.46
      for (const s of [-1, 1]) {
        a.tube([s * 0.46, 0.035, z0], [s * 0.46, 0.035, z1], 0.08, 0.07, M.frame, { side: [1, 0, 0] })
        foot(a, s * 0.46, z0 + 0.05)
        foot(a, s * 0.46, z1 - 0.05)
        // Pivot stand.
        a.sidePlate([[pz - 0.24, 0.06], [pz + 0.24, 0.06], [pz + 0.05, py + 0.05], [pz - 0.05, py + 0.05]], s * 0.44 - 0.006, 0.012, M.frame, { round: 0.02, holes: [[pz, 0.2, 0.05], [pz, py - 0.18, 0.035]] })
        a.rod([s * (px - 0.03), py, pz], [s * 0.465, py, pz], 0.018, M.chrome)
        a.hub([s * 0.452, py, pz], [s, 0, 0], 0.03, 0.006)
        // The stop the lever rests on, with a rubber top.
        const sz = LV.Q[2] - 0.14
        a.tube([s * px, 0.05, sz], [s * px, LV.Q[1] - 0.09, sz], 0.05, 0.05, M.frameDark)
        a.tube([s * px, 0.05, sz], [s * 0.46, 0.05, sz], 0.05, 0.05, M.frameDark)
        a.lathe([[0.022, 0], [0.022, 0.018], [0, 0.022]], M.rubber, [s * px, LV.Q[1] - 0.09, sz], [0, 1, 0], 14)
      }
      for (const z of [z0 + 0.05, z1 - 0.05]) a.tube([-0.46, 0.035, z], [0.46, 0.035, z], 0.07, 0.07, M.frame)
      a.tube([-0.46, 0.035, -0.3], [0.46, 0.035, -0.3], 0.07, 0.07, M.frame)
      // The deck under the feet.
      a.footPlate([0, LV.deck, 0.03], [0, 1, 0], [0, 0, 1], 0.52, 0.66, 0.02, { name: 'deck' })
      a.tube([0, 0.05, -0.3], [0, 0.05, 0.42], 0.08, 0.05, M.frame, { side: [1, 0, 0] })
    }),
  )
  for (const s of [-1, 1]) {
    const P = new V3(s * px, py, pz)
    const rest = leverHand(which, s).sub(P).setX(0)
    let ang = (p.angle ?? 0) * D
    if (ctx) {
      ang = angleAbout([1, 0, 0], rest, handOn(p, ctx, s).sub(P).setX(0))
    }
    swing(root, `lever-arm${s}`, P, [1, 0, 0], ang, (a) => {
      const Q = new V3(0, LV.Q[1] - py, LV.Q[2] - pz)
      a.tube([0, 0, 0], Q, 0.04, 0.075, M.arm, { side: [1, 0, 0], r: 0.008 })
      a.lathe([[0.04, -0.05], [0.04, 0.03], [0, 0.03]], M.arm, [0, 0, 0], [s, 0, 0], 24)
      // The upright that carries both handles, and the handles.
      const dirY = new V3(0, 1, 0)
      a.tube(Q.clone().addScaledVector(dirY, -0.135), Q.clone().addScaledVector(dirY, 0.135), 0.04, 0.05, M.arm, { side: [1, 0, 0], r: 0.008 })
      for (const k of [-1, 1]) {
        const y = Q.y + k * LV.dY
        a.grip([0, y, Q.z + 0.03], [0, y, Q.z + 0.255], 0.0165, { name: k > 0 ? `top${s > 0 ? 'L' : 'R'}` : `bottom${s > 0 ? 'L' : 'R'}` })
      }
      // Horn on the lever, with plates.
      const hp = Q.clone().multiplyScalar(0.42).add(new V3(s * 0.02, 0, 0))
      a.horn(hp, [s, 0, 0], 0.26, [[0.45, 0.038], [0.31, 0.03]])
    })
  }
  return root
}

// ---- Reverse hyperextension: prone on a high pad, hips off its end. The pendulum turns on the line through the hip joints.
export const RH = { padY: 1.12, hipUp: 0.125, padZ0: 0.14, padL: 0.72, roll: 0.8 }
machines['reverse-hyper'] = function reverseHyper(p, ctx) {
  const root = rootFor(p)
  const { padY, hipUp, padZ0, padL, roll } = RH
  const hipY = padY + hipUp
  const P = new V3(0, hipY, 0)
  const zc = padZ0 + padL / 2
  root.add(
    part('rh-frame', (a) => {
      a.pad({ name: 'belly', c: [0, padY, zc], n: [0, 1, 0], u: [0, 0, 1], w: 0.42, l: padL, t: 0.075, r: 0.03, rc: 0.07, crown: 0.012 })
      const topY = padY - 0.075 - 0.012 - 0.03
      const X = 0.19
      // Nothing stands behind the hips, so the legs swing back clear of the frame: two posts under the pad's middle, an
      // A-frame in front of it, long runners on the floor to keep it from tipping.
      const postZ = 0.42
      for (const s of [-1, 1]) {
        a.tube([s * X, topY, -0.06], [s * X, topY, padZ0 + padL], 0.06, 0.06, M.frame, { side: [1, 0, 0] })
        a.tube([s * X, topY, padZ0 + padL - 0.1], [s * (X + 0.1), 0.05, 1.32], 0.07, 0.07, M.frame)
        a.tube([s * X, topY, postZ], [s * (X + 0.1), 0.05, postZ], 0.07, 0.07, M.frame)
        a.tube([s * (X + 0.1), 0.035, -0.96], [s * (X + 0.1), 0.035, 1.4], 0.07, 0.07, M.frame, { side: [1, 0, 0] })
        foot(a, s * (X + 0.1), -0.91)
        foot(a, s * (X + 0.1), 1.35)
        // Gusset where the post meets the top rail.
        a.sidePlate([[postZ - 0.14, topY - 0.03], [postZ + 0.14, topY - 0.03], [postZ, topY - 0.17]], s * (X + 0.01) - 0.004, 0.008, M.frameDark, { round: 0.012 })
      }
      // The bracket that lifts the pivot up to hip height, on the far side, outside the thigh. (mirror swaps sides.)
      a.sidePlate([[-0.09, topY + 0.03], [0.17, topY + 0.03], [0.07, hipY + 0.045], [-0.05, hipY + 0.045]], -0.325 - 0.007, 0.012, M.frame, { round: 0.02, holes: [[0.04, topY + 0.08, 0.022]] })
      a.tube([-X, topY, 0.03], [-0.335, topY, 0.03], 0.05, 0.05, M.frameDark)
      a.rod([-0.27, hipY, 0], [-0.345, hipY, 0], 0.018, M.chrome)
      a.hub([-0.332, hipY, 0], [-1, 0, 0], 0.03, 0.006)
      a.tube([-X, topY, padZ0 + padL - 0.03], [X, topY, padZ0 + padL - 0.03], 0.06, 0.06, M.frame)
      a.tube([-X, topY, padZ0], [X, topY, padZ0], 0.06, 0.06, M.frame)
      for (const z of [-0.91, 0.42, 1.35]) a.tube([-(X + 0.1), 0.035, z], [X + 0.1, 0.035, z], 0.07, 0.07, M.frame)
      // Cross bar in front, for the hands.
      a.bentRod([[-X, topY - 0.02, padZ0 + padL - 0.14], [-0.28, topY - 0.06, padZ0 + padL + 0.08], [0.28, topY - 0.06, padZ0 + padL + 0.08], [X, topY - 0.02, padZ0 + padL - 0.14]], 0.0135, M.steel, { fillet: 0.05, caps: false })
      for (const s of [-1, 1]) a.grip([s * 0.3, topY - 0.06, padZ0 + padL + 0.08], [s * 0.1, topY - 0.06, padZ0 + padL + 0.08], 0.0165, { name: `handle${s > 0 ? 'L' : 'R'}`, flange: false })
    }),
  )
  let ang = (p.angle ?? 0) * D
  if (ctx) {
    const k = avg(toLocal(p, ctx.joints['foot.L']), toLocal(p, ctx.joints['foot.R'])).sub(P).setX(0)
    ang = angleAbout([1, 0, 0], [0, -1, 0], k)
  }
  swing(root, 'rh-pendulum', P, [1, 0, 0], ang, (a) => {
    const X = -0.262
    const bot = -0.965
    // One arm, on the far side, carrying everything: nothing crosses in front of the leg.
    a.bent([[X, 0, 0], [X, bot, 0], [0.2, bot, 0]], 0.03, 0.05, M.arm, { side: [1, 0, 0], fillet: 0.09, r: 0.007, caps: true })
    a.lathe([[0.04, -0.03], [0.04, 0.03], [0, 0.03]], M.arm, [X, 0, 0], [1, 0, 0], 22)
    // Two rollers either side of the lower shins, on axles from the arm.
    for (const z of [0.074, -0.09]) {
      a.rod([X, -roll, z], [0.215, -roll, z], 0.009, M.chrome)
      a.roller([-0.012, -roll, z], [0.2, -roll, z], 0.038)
      a.roller([-0.205, -roll, z], [-0.018, -roll, z], 0.038)
    }
    a.tube([X, -roll, -0.105], [X, -roll, 0.09], 0.02, 0.03, M.arm, { side: [1, 0, 0], r: 0.005 })
    // A stem forward from the yoke's foot, with the horn: plates hang clear of the feet.
    const hz = 0.37
    a.tube([0, bot, 0], [0, bot - 0.02, hz], 0.05, 0.05, M.arm, { side: [1, 0, 0] })
    for (const s of [-1, 1]) a.horn([s * 0.025, bot - 0.02, hz], [s, 0, 0], 0.2, [[0.45, 0.038]])
  })
  return root
}

// ---- Lying machine squat: on the back on a sled, shoulders under pads, feet against a fixed plate high up.
const LS = { slope: 20, soleY: 0.9, off: 0.19 }
export const lyingSquatAxes = () => {
  const a = LS.slope * D
  const r = new V3(0, Math.sin(a), Math.cos(a))
  const n = new V3(0, Math.cos(a), -Math.sin(a))
  const sole = new V3(0, LS.soleY, 0)
  const ankle = sole.clone().addScaledVector(n, -0.04).addScaledVector(r, -0.07)
  return { r, n, sole, ankle }
}
machines['lying-squat'] = function lyingSquat(p, ctx) {
  const root = rootFor(p)
  const { r, n, sole, ankle } = lyingSquatAxes()
  const L = (x, t, o) => new V3(x, ankle.y - t * r.y + o * n.y, ankle.z - t * r.z + o * n.z)
  const RX = 0.225
  const towerZ = 0.34
  const H = 0.86
  const stackN = 10
  const sel = 5
  const wheel = new V3(0, H + 0.13, towerZ - HEAD_R)
  root.add(
    part('ls-frame', (a) => {
      for (const s of [-1, 1]) {
        a.tube([s * 0.34, 0.035, -1.82], [s * 0.34, 0.035, 0.58], 0.08, 0.07, M.frame, { side: [1, 0, 0] })
        foot(a, s * 0.34, -1.77)
        foot(a, s * 0.34, 0.53)
        const X = s * RX
        const a0 = L(X, 0.34, -LS.off - 0.062)
        const a1 = L(X, 1.72, -LS.off - 0.062)
        a.tube(a0, a1, 0.07, 0.09, M.frame, { side: [1, 0, 0] })
        a.rod(L(X, 0.36, -LS.off), L(X, 1.7, -LS.off), 0.021, M.chrome)
        for (const t of [0.37, 1.69]) a.tube(L(X, t, -LS.off), L(X, t, -LS.off - 0.03), 0.06, 0.03, M.frameDark, { side: [1, 0, 0], r: 0.004 })
        const low = L(X, 1.55, -LS.off - 0.09)
        a.tube(low, [X, 0.05, low.z], 0.08, 0.08, M.frame)
        const hi = L(X, 0.55, -LS.off - 0.09)
        a.tube(hi, [X, 0.05, hi.z], 0.08, 0.08, M.frame)
        a.tube(hi.clone().lerp(low, 0.45), [X, 0.05, hi.z], 0.05, 0.05, M.frameDark)
        a.tube(a0, [X, 0.05, a0.z], 0.08, 0.08, M.frame)
        // Plate's own frame, tied into the rails' upper end.
        const bb = sole.clone().addScaledVector(n, 0.2).addScaledVector(r, 0.05).setX(s * 0.22)
        const cc = sole.clone().addScaledVector(n, -0.2).addScaledVector(r, 0.05).setX(s * 0.22)
        a.tube(bb, cc, 0.05, 0.05, M.frame, { side: [1, 0, 0] })
        a.tube(cc, a0.clone().lerp(L(X, 0.34, -LS.off), 0.5), 0.05, 0.05, M.frameDark)
        a.tube(bb, [s * 0.22, 0.05, cc.z + 0.3], 0.06, 0.06, M.frame)
      }
      for (const z of [-1.77, 0.53]) a.tube([-0.34, 0.035, z], [0.34, 0.035, z], 0.07, 0.07, M.frame)
      a.tube(L(-RX, 1.7, -LS.off - 0.062), L(RX, 1.7, -LS.off - 0.062), 0.07, 0.07, M.frame)
      a.footPlate(sole, r.clone().negate(), n, 0.62, 0.56, 0.014, { name: 'plate' })
      const m = sole.clone().addScaledVector(r, 0.05)
      a.tube(m.clone().addScaledVector(n, 0.2).setX(-0.22), m.clone().addScaledVector(n, 0.2).setX(0.22), 0.05, 0.05, M.frame)
      a.tube(m.clone().addScaledVector(n, -0.2).setX(-0.22), m.clone().addScaledVector(n, -0.2).setX(0.22), 0.05, 0.05, M.frame)
      pulley(a, wheel, [1, 0, 0], HEAD_R, { base: [0, H + 0.07, towerZ - HEAD_R] })
    }),
  )
  // Where the sled is: hips t from the ankle, measured down the rails. 0.58 is deep, 0.84 nearly straight.
  let t = p.t ?? 0.58
  if (ctx) t = -toLocal(p, ctx.frames.pelvis.pos).sub(ankle).dot(r)
  const car = part('ls-carriage', (a) => {
    // Local: hips at the origin, +along toward the head (-r), +off away from the pad (n).
    const C = (x, along, o) => new V3(x, -along * r.y + o * n.y, -along * r.z + o * n.z)
    a.pad({ name: 'back', c: C(0, 0.34, -0.092), n, u: r.clone().negate(), w: 0.36, l: 0.84, t: 0.07, r: 0.03, rc: 0.08, crown: 0.012 })
    for (const s of [-1, 1]) {
      a.bearing(C(s * RX, -0.05, -LS.off), r, 0.021, 0.15)
      a.bearing(C(s * RX, 0.58, -LS.off), r, 0.021, 0.15)
      a.tube(C(s * 0.12, -0.05, -0.175), C(s * 0.12, 0.72, -0.175), 0.05, 0.03, M.arm, { side: [1, 0, 0] })
      // Shoulder pad.
      const sc = C(s * 0.15, 0.545, 0.005)
      a.pad({ name: `shoulder${s > 0 ? 'L' : 'R'}`, c: sc, n: r, u: n, w: 0.12, l: 0.17, t: 0.08, r: 0.038, rc: 0.05, crown: 0.012 })
      a.tube(C(s * 0.15, 0.545 + 0.084, -0.09), C(s * 0.15, 0.545 + 0.084, 0.08), 0.1, 0.012, M.arm, { side: [1, 0, 0], r: 0.004 })
      a.tube(C(s * 0.15, 0.62, -0.09), C(s * 0.14, 0.57, -0.175), 0.05, 0.03, M.arm, { side: [1, 0, 0] })
      // Handle standing up from the side of the sled.
      const hb = C(s * 0.295, 0.32, -0.12)
      const ht = C(s * 0.295, 0.32, 0.07)
      a.tube(C(s * 0.12, 0.32, -0.175), C(s * 0.295, 0.32, -0.175), 0.04, 0.04, M.arm, { side: [0, 1, 0] })
      a.rod(C(s * 0.295, 0.32, -0.175), hb, 0.0125, M.steel)
      a.grip(hb, ht, 0.0165, { name: `handle${s > 0 ? 'L' : 'R'}` })
    }
    for (const k of [-0.05, 0.25, 0.58]) a.tube(C(-RX, k, -LS.off), C(RX, k, -LS.off), 0.06, 0.05, M.arm, { side: [0, 1, 0] })
    for (const s of [-1, 1]) for (const k of [-0.05, 0.25, 0.58]) a.tube(C(s * 0.12, k, -LS.off), C(s * 0.12, k, -0.175), 0.05, 0.04, M.arm, { side: [1, 0, 0] })
  })
  const hipNow = ankle.clone().addScaledVector(r, -t)
  car.position.copy(hipNow)
  root.add(car)
  const lift = Math.max(0, t - 0.58)
  addStack(root, { at: [0, towerZ], H, n: stackN, sel, footZ: 0.2 }, lift)
  const attach = hipNow.clone().addScaledVector(n, -LS.off).add(new V3(0, 0, 0))
  addCable(root, [{ c: attach }, { c: wheel, r: HEAD_R, s: 1 }, { c: [0, stackTop(stackN) + 0.07 + lift, towerZ], r: 0, s: 1 }], [1, 0, 0])
  return root
}

// ---- Standing leg curl, plate-loaded: knee against a pad, forearms on a rest, one leg working around a pivot at its knee.
export const SL = { hip: [0, 1.02, 0], knee: [0, 0.61, 0.133], step: 0.12 }
machines['standing-leg-curl'] = function standingLegCurl(p, ctx) {
  const root = rootFor(p)
  const P = new V3(...SL.knee)
  root.add(
    part('slc-frame', (a) => {
      floorSpine(a, -0.74, 1.0, [[-0.36, 0.36, 0.98], [-0.42, 0.34, -0.7]])
      // A post from the front foot to the forearm rest.
      a.bent([[0, 0.07, 0.92], [0, 0.72, 0.74], [0, 1.03, 0.58]], 0.08, 0.08, M.frame, { side: [1, 0, 0], fillet: 0.2, caps: false })
      a.tube([0, 0.05, 0.42], [0, 0.72, 0.74], 0.05, 0.05, M.frameDark)
      const rest = new V3(0, 1.1, 0.52)
      a.pad({ name: 'forearms', c: rest, n: [0, 1, 0], u: [0, 0, 1], w: 0.46, l: 0.34, t: 0.05, r: 0.024, rc: 0.06, crown: 0.012 })
      a.tube([0, 1.04, 0.62], [0, 1.03, 0.46], 0.08, 0.04, M.frameDark, { side: [1, 0, 0] })
      // The bar for the hands, ahead of the rest.
      a.rod([-0.3, 1.12, 0.72], [0.3, 1.12, 0.72], 0.013, M.steel)
      a.tube([0, 1.04, 0.62], [0, 1.12, 0.72], 0.03, 0.03, M.frameDark)
      for (const s of [-1, 1]) a.grip([s * 0.3, 1.12, 0.72], [s * 0.09, 1.12, 0.72], 0.0165, { name: `handle${s > 0 ? 'L' : 'R'}`, flange: false })
      // The knee pad on a beam from the post, and the pivot's hanger between the knees.
      const pc = new V3(0.05, 0.72, 0.205)
      const n = new V3(0, -0.31, -0.951)
      const u = new V3(0, 0.951, -0.31)
      a.pad({ name: 'knee', c: pc, n, u, w: 0.32, l: 0.17, t: 0.06, r: 0.028, rc: 0.05, crown: 0.012 })
      const back = pc.clone().addScaledVector(n, -0.075)
      a.tube(back.clone().setX(0), [0, 0.74, 0.74], 0.06, 0.06, M.frame)
      a.tube(back.clone().setX(-0.11), back.clone().setX(0.21), 0.05, 0.03, M.frameDark, { side: [0, 1, 0] })
      a.sidePlate([[back.z + 0.02, back.y - 0.02], [back.z + 0.02, back.y - 0.1], [P.z + 0.03, P.y - 0.03], [P.z - 0.03, P.y - 0.03], [P.z - 0.03, P.y + 0.03], [P.z + 0.03, P.y + 0.03]], -0.03, 0.01, M.frameDark, { round: 0.015 })
      a.rod([-0.04, P.y, P.z], [0.02, P.y, P.z], 0.016, M.chrome)
      // The step under the standing foot.
      a.footPlate([-0.14, SL.step, -0.03], [0, 1, 0], [0, 0, 1], 0.27, 0.46, 0.012)
      a.tube([-0.14, SL.step - 0.03, -0.24], [-0.14, SL.step - 0.03, 0.18], 0.06, 0.03, M.frameDark, { side: [1, 0, 0] })
      a.tube([-0.14, SL.step - 0.03, -0.2], [-0.05, 0.05, -0.2], 0.04, 0.04, M.frameDark)
      a.tube([-0.14, SL.step - 0.03, 0.14], [-0.05, 0.05, 0.14], 0.04, 0.04, M.frameDark)
    }),
  )
  let ang = (p.angle ?? 8) * D
  if (ctx) {
    const side = p.side ?? 'L'
    const k = toLocal(p, ctx.joints[`lowerleg01.${side}`])
    const an = toLocal(p, ctx.joints[`foot.${side}`])
    ang = angleAbout([1, 0, 0], [0, -1, 0], an.sub(k))
  }
  swing(root, 'slc-lever', P, [1, 0, 0], ang, (a) => {
    const X = 0.022
    a.tube([X, 0.03, 0.002], [X, -0.27, 0.0], 0.03, 0.05, M.arm, { side: [1, 0, 0], r: 0.006 })
    a.tube([X, -0.2, 0.0], [X, -0.44, -0.015], 0.022, 0.036, M.steel, { side: [1, 0, 0], r: 0.004 })
    a.holes([X + 0.0115, -0.29, -0.003], [X + 0.0115, -0.41, -0.012], 4, 0.0045, [1, 0, 0])
    a.tube([X, -0.33, -0.01], [X, -0.355, -0.088], 0.022, 0.03, M.steel, { side: [1, 0, 0], r: 0.004 })
    a.rod([X, -0.355, -0.088], [0.26, -0.355, -0.088], 0.011, M.chrome)
    a.roller([X + 0.015, -0.355, -0.088], [0.245, -0.355, -0.088], 0.05)
    a.lathe([[0.035, -0.022], [0.035, 0.022], [0, 0.022]], M.arm, [X, 0, 0], [1, 0, 0], 22)
    // The load arm, behind and below the knee: it rises as the heel comes up.
    const hb = new V3(X, -0.3, -0.36)
    a.tube([X, -0.05, -0.01], hb, 0.03, 0.05, M.arm, { side: [1, 0, 0], r: 0.006 })
    a.tube(hb, [-0.23, hb.y, hb.z], 0.05, 0.05, M.arm, { side: [0, 1, 0], r: 0.008 })
    a.horn([-0.23, hb.y, hb.z], [-1, 0, 0], 0.22, [[0.45, 0.038], [0.31, 0.03]])
  })
  return root
}

// ---- Ab crunch: a padded lever over the shoulders turning around the lower back, a lever at the ankles lifting the feet.
export const AB = { S: 0.56, recline: 14, top: [0.3, 0.811, -0.071], hand0: [0.244, 1.296, -0.106], ank: [0.0, 0.361, 0.01] }
machines['ab-crunch'] = function abCrunch(p, ctx) {
  const root = rootFor(p)
  const { S, recline } = AB
  const hipY = S + 0.098
  const [tx, ty, tz] = AB.top
  const [ , ay, az] = AB.ank
  const towerZ = -0.88
  const H = 1.36
  const CX = 0.0
  const ankleRest = new V3(0, 0.125, 0.49)
  root.add(
    part('ab-frame', (a) => {
      floorSpine(a, -1.04, 0.72, [[-0.36, 0.36, 0.7], [-0.32, 0.32, -0.44]])
      a.tube([0, 0.08, 0.05], [0, S - 0.09, 0.05], 0.08, 0.08, M.frame)
      a.tube([0, S - 0.09, -0.12], [0, S - 0.09, 0.24], 0.1, 0.05, M.frame, { side: [1, 0, 0] })
      a.pad({ name: 'seat', c: [0, S, 0.04], n: [0, 1, 0], u: [0, 0, 1], w: 0.33, l: 0.34, t: 0.07, r: 0.028, rc: 0.06, crown: 0.012, taper: 0.1, fall: 0.012 })
      seatPostDetail(a, S, 0.05)
      const b = backPadAt([0, hipY, 0], recline, 0.24)
      a.pad({ name: 'back', c: b.c, n: b.n, u: b.u, w: 0.3, l: 0.46, t: 0.07, r: 0.028, rc: 0.07, crown: 0.012 })
      const low = new V3(0, 0.08, -0.36)
      const hi = b.c.clone().addScaledVector(b.n, -0.13).addScaledVector(b.u, 0.18)
      a.tube(low, hi, 0.07, 0.07, M.frame)
      a.tube(b.c.clone().addScaledVector(b.n, -0.082), b.c.clone().addScaledVector(b.n, -0.15), 0.05, 0.05, M.frameDark)
      // Axle stands at the lower back, out to both sides.
      a.tube([-tx - 0.04, ty, tz - 0.07], [tx + 0.04, ty, tz - 0.07], 0.05, 0.05, M.frameDark, { side: [0, 1, 0] })
      const on = b.c.clone().addScaledVector(b.n, -0.13).addScaledVector(b.u, -0.08)
      a.tube(on, [0, ty, tz - 0.07], 0.05, 0.05, M.frameDark)
      for (const s of [-1, 1]) {
        a.sidePlate([[tz - 0.1, ty - 0.03], [tz - 0.04, ty - 0.03], [tz + 0.035, ty - 0.03], [tz + 0.035, ty + 0.03], [tz - 0.1, ty + 0.03]], s * tx + (s > 0 ? 0.03 : -0.038), 0.008, M.frameDark, { round: 0.008 })
        a.rod([s * (tx - 0.02), ty, tz], [s * (tx + 0.04), ty, tz], 0.016, M.chrome)
      }
      // Stand under the seat's front, for the ankle lever's axle.
      a.tube([0, 0.05, az - 0.06], [0, ay - 0.02, az], 0.05, 0.05, M.frameDark)
      a.rod([-0.05, ay, az], [0.05, ay, az], 0.016, M.chrome)
    }),
  )
  // Top lever, from the hands.
  const axis = new V3(1, 0, 0)
  const Pt = new V3(0, ty, tz)
  const H0 = new V3(0, AB.hand0[1] - ty, AB.hand0[2] - tz)
  let ang = (p.angle ?? 0) * D
  let ank = (p.ankleAngle ?? 0) * D
  if (ctx) {
    const h = avg(toLocal(p, ctx.hands.L.centre), toLocal(p, ctx.hands.R.centre)).sub(Pt).setX(0)
    ang = angleAbout(axis, H0, h)
    const f = avg(toLocal(p, ctx.joints['foot.L']), toLocal(p, ctx.joints['foot.R'])).setX(0).sub(new V3(0, ay, az))
    ank = angleAbout(axis, ankleRest.clone().sub(new V3(0, ay, az)), f)
  }
  swing(root, 'ab-top', Pt, axis, ang, (a) => {
    for (const s of [-1, 1]) {
      const X = s * tx
      const top = new V3(X, H0.y + 0.015, H0.z)
      a.bent([[X, 0, 0], [X, H0.y * 0.5, -0.02], top], 0.03, 0.055, M.arm, { side: [1, 0, 0], fillet: 0.1, r: 0.006, caps: true })
      a.lathe([[0.04, -0.025], [0.04, 0.025], [0, 0.025]], M.arm, [X, 0, 0], [1, 0, 0], 22)
      a.hub([X + s * 0.025, 0, 0], [s, 0, 0], 0.03, 0.005)
      // The handle turns in from the lever's top.
      a.grip([X - s * 0.012, H0.y, H0.z], [s * (AB.hand0[0] - 0.075), H0.y, H0.z], 0.0165, { name: `handle${s > 0 ? 'L' : 'R'}` })
      // The pad under the upper arm, on a stem from the lever.
      const n = new V3(s * -0.184, 0.933, -0.25)
      const pc = new V3(s * 0.277, 0.313, 0.1055).addScaledVector(n, -0.03)
      const u = new V3(s * 0.563, 0.315, 0.767)
      a.pad({ name: `tri${s > 0 ? 'L' : 'R'}`, c: pc, n, u, w: 0.11, l: 0.2, t: 0.045, r: 0.022, rc: 0.045, crown: 0.01 })
      a.tube(pc.clone().addScaledVector(n, -0.055), new V3(X, 0.24, -0.028), 0.028, 0.028, M.arm)
    }
    // Cam, and a bar tying the two sides together behind the back.
    a.rod([-tx, 0, 0], [tx, 0, 0], 0.016, M.chrome)
    cam(a, [0.06, 0, 0], [1, 0, 0], 0.075, 0.1, 0.018, 180, M.frameDark)
  })
  swing(root, 'ab-low', [0, ay, az], axis, ank, (a) => {
    const R0 = ankleRest.clone().sub(new V3(0, ay, az))
    const padAt = R0.clone().add(new V3(0, 0.05, 0.075))
    a.tube([0, 0, 0], padAt, 0.04, 0.05, M.arm, { side: [1, 0, 0], r: 0.006 })
    a.lathe([[0.035, -0.03], [0.035, 0.03], [0, 0.03]], M.arm, [0, 0, 0], [1, 0, 0], 22)
    a.rod([-0.22, padAt.y, padAt.z], [0.22, padAt.y, padAt.z], 0.011, M.chrome)
    a.roller([0.03, padAt.y, padAt.z], [0.21, padAt.y, padAt.z], 0.045)
    a.roller([-0.03, padAt.y, padAt.z], [-0.21, padAt.y, padAt.z], 0.045)
  })
  const lift = Math.max(0, Math.abs(ang)) * 0.09
  addStack(root, { at: [0.06, towerZ], H, n: 14, sel: 6, footZ: 0.22 }, lift)
  const footZ = towerZ - 2 * HEAD_R + 0.04
  root.add(
    part('ab-wheels', (a) => {
      pulley(a, [0.06, 0.115, -0.36], [1, 0, 0], 0.04, { base: [0.06, 0.07, -0.36] })
      pulley(a, [0.06, 0.115, footZ], [1, 0, 0], 0.04, { base: [0.06, 0.07, footZ] })
      pulley(a, [0.06, H + 0.13, towerZ - HEAD_R], [1, 0, 0], HEAD_R, { base: [0.06, H + 0.07, towerZ - HEAD_R] })
    }),
  )
  addCable(root, [{ c: new V3(0.06, ty, tz), r: 0.085, s: 1 }, { c: [0.06, 0.115, -0.36], r: 0.04, s: -1 }, { c: [0.06, 0.115, footZ], r: 0.04, s: -1 }, { c: [0.06, H + 0.13, towerZ - HEAD_R], r: HEAD_R, s: -1 }, { c: [0.06, stackTop(14) + 0.07 + lift, towerZ], r: 0, s: -1 }], [1, 0, 0])
  return root
}

// ---- Seated leg press (also the calf press): sled on rails near the floor, selector stack behind the seat.
export const SP = { S: 0.5, recline: 20, plateY: 0.5, tilt: 8, railY: 0.33, railX: 0.2, sNear: 0.42, sFar: 1.3 }
machines['seated-leg-press'] = function seatedLegPress(p, ctx) {
  const root = rootFor(p)
  const { S, recline, plateY, tilt, railY, railX } = SP
  const towerZ = -0.78
  const H = 1.32
  const CX = 0.07
  const tt = Math.tan(tilt * D)
  root.add(
    part('slp-frame', (a) => {
      floorSpine(a, -0.94, 1.56, [[-0.34, 0.34, 1.54], [-0.3, 0.3, -0.4]])
      seatAndBack(a, { S, recline, along: 0.31, backL: 0.62, railFoot: -0.36 })
      seatHandles(a, S)
      // Rails on two stands.
      for (const s of [-1, 1]) {
        a.rod([s * railX, railY, 0.4], [s * railX, railY, 1.5], 0.019, M.chrome)
        for (const z of [0.42, 1.48]) {
          a.tube([s * railX, railY - 0.02, z], [s * railX, 0.05, z], 0.05, 0.05, M.frame)
          a.tube([s * railX, railY - 0.018, z - 0.03], [s * railX, railY - 0.018, z + 0.03], 0.05, 0.02, M.frameDark, { side: [1, 0, 0], r: 0.004 })
          a.tube([0, 0.05, z], [s * railX, 0.05, z], 0.05, 0.05, M.frame)
        }
      }
      pulley(a, [CX, 0.21, 1.54], [1, 0, 0], 0.09, { base: [CX, 0.07, 1.54] })
    }),
  )
  let s0 = p.s ?? 0.9
  if (ctx) {
    const key = p.anchor === 'ball' ? 'ball' : 'sole'
    const q = avg(toLocal(p, ctx.feet.L[key]), toLocal(p, ctx.feet.R[key]))
    s0 = q.z - (q.y - plateY) * tt
  }
  const sled = part('slp-sled', (a) => {
    const n = new V3(0, Math.sin(tilt * D), -Math.cos(tilt * D))
    const u = new V3(0, Math.cos(tilt * D), Math.sin(tilt * D))
    a.footPlate([0, 0, 0], n, u, 0.54, 0.52, 0.014, { name: 'plate' })
    for (const s of [-1, 1]) {
      const low = new V3(s * 0.22, -0.24, 0.016 - 0.034)
      const hi = new V3(s * 0.22, 0.24, 0.05)
      a.tube(hi, low, 0.04, 0.04, M.arm, { side: [1, 0, 0] })
      a.bearing([s * railX, railY - plateY, 0.09], [0, 0, 1], 0.019, 0.13)
      a.bearing([s * railX, railY - plateY, 0.32], [0, 0, 1], 0.019, 0.13)
      a.tube([s * 0.22, railY - plateY + 0.03, 0.0], [s * 0.22, railY - plateY + 0.03, 0.36], 0.045, 0.03, M.arm, { side: [1, 0, 0] })
      a.tube(hi.clone().add(new V3(0, -0.02, 0)), [s * 0.22, railY - plateY + 0.03, 0.26], 0.035, 0.035, M.arm)
    }
    a.tube([-0.22, railY - plateY + 0.03, 0.2], [0.22, railY - plateY + 0.03, 0.2], 0.05, 0.04, M.arm, { side: [0, 1, 0] })
    a.tube([-0.22, 0.2, 0.05], [0.22, 0.2, 0.05], 0.04, 0.04, M.arm, { side: [0, 1, 0] })
  })
  sled.position.set(0, plateY, s0)
  root.add(sled)
  const lift = Math.max(0, s0 - SP.sNear)
  addStack(root, { at: [CX, towerZ], H, n: 14, sel: 6, footZ: 0.22 }, lift * 0.4)
  const footZ = towerZ - 2 * HEAD_R + 0.04
  root.add(
    part('slp-wheels', (a) => {
      pulley(a, [CX, 0.115, footZ], [1, 0, 0], 0.04, { base: [CX, 0.07, footZ] })
      pulley(a, [CX, H + 0.13, towerZ - HEAD_R], [1, 0, 0], HEAD_R, { base: [CX, H + 0.07, towerZ - HEAD_R] })
    }),
  )
  addCable(root, [{ c: new V3(CX, 0.3, s0 + 0.2) }, { c: [CX, 0.21, 1.54], r: 0.09, s: -1 }, { c: [CX, 0.115, footZ], r: 0.04, s: -1 }, { c: [CX, H + 0.13, towerZ - HEAD_R], r: HEAD_R, s: -1 }, { c: [CX, stackTop(14) + 0.07 + lift * 0.4, towerZ], r: 0, s: -1 }], [1, 0, 0])
  return root
}

export default machines
