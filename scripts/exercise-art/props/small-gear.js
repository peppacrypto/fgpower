// Small gear: everything in a gym or a home that isn't a machine, a bench or a barbell.
//
// Same conventions as every prop: metres, Y up, floor at y = 0. `pos` is the point on the floor under the centre, `yaw` (degrees)
// turns it. A figure at yaw 0 faces +Z, so +X is its LEFT. A prop with any of the keys hand, hands, foot, feet or follow is rebuilt
// per frame from the solved body and stays on it in every in-between frame; everything else is static, or goes in a frame's
// `props` list when its numbers should interpolate. Every example below is a working spec in specs/_gallery/<type>.json.
//
// WHERE THE BODY GOES (local coordinates, at yaw 0)
//
// stability-ball (alias exercise-ball)   radius 0.325 (a 65 cm ball; 0.275 = 55 cm, 0.375 = 75 cm), load 0..1 (how hard it is pressed)
//     Centre (0, r - sag, 0), sag = 0.012 + 0.03 * load. Top of the ball y = 2r - sag: 0.638 for r 0.325 unloaded, 0.608 at load 1. Widest radius r + 0.32 sag.
//     A body lying on it: put the skin 1 to 2 cm inside the surface; the ball gives. Horizontal distance from the centre to a point
//     of the surface at height y is sqrt(r^2 - (y - cy)^2).
//     Rolling: the seams roll by themselves from pos (distance / radius), so moving `pos` in a frame's props list looks right.
//     On the body: { feet:true | foot:"L", anchor:"heel"|"sole"|"ball", clear:0 } keeps it under those soles, or
//     { follow:{ on:["lowerleg01","foot"], side:"both"|"L"|"R", clear:0.045, at:0.6 } } keeps it tangent to that limb (shins on the ball; example stability-ball-roll). `on` takes any two joints of ctx.joints,
//     with or without a side: ["upperleg01","spine01"], clear 0.12, for a belly on the ball. offset:[x, z] shifts it. Where the limb is level, `at` (0..1 along it) says where the ball is.
//     Held: { hands:true, radius:0.275 } sits between the two palms, in the air. Palms flat on it: hand centres (ctx.hands.*.centre) r - 0.03 from its centre, opposite each other.
// bosu   radius 0.32, height 0.26, flip:false. Dome up: rim of the plate at y 0.046, top of the dome y 0.26. Skin of the lower back about 0.02 inside the top.
//     flip:true is the flat side up with its handles: flat top y 0.255. Handles along Z at x ±0.20, y 0.282, z from -0.07 to 0.07, grip radius 0.013, for push-ups.
// foam-roller   radius 0.075, length 0.9 (0.45 for short), style "smooth"|"grid", axis along X at yaw 0. Centre at y = radius, top y = 2r = 0.15.
//     Limb resting on it: bone line about 0.15 + limb radius above the floor (thigh 0.07, shin 0.05). spin in degrees, or automatic from pos.z.
// ab-wheel   radius 0.09. { hands:true } puts the handles exactly on the grip centres, the axle between them and the wheel on the floor. Pose the
//     hands with grip centres at y = radius (0.09), about ±0.115 from the middle, thumb along the axle; move z freely, the wheel rolls by itself.
//     Static: pos, yaw; axle along X at y = radius; handle centres at x ±span/2 (span 0.23). Handle grip radius 0.017.
// balance-board   style "wobble"(round, default)|"rocker", radius 0.23, tilt:[pitch, roll] (degrees; pitch + front rim down, roll + the figure's left
//     rim down). Deck top y = 0.09 at tilt 0; feet at x ±0.13, anchor "sole". { feet:true } follows the feet and takes its tilt from them.
//     Deck point when tilted: rotate about (0, 0.11, 0), then shift by 0.11 * angle (rad) toward the low side (it rolls). Max tilt 16 degrees.
// gliding-disc (alias slider)   radius 0.09, top y = 0.012. { foot:"L", at:"ball"|"sole"|"heel" } or { hand:"L" } slides under it on the floor. Lift that sole by 0.012.
// massage-ball   radius 0.032, spiky:true (radius 0.04), peanut:true. Centre at y = r. { foot:"L", at:0.5 } rolls under the arch; { hand:"L" } under the palm.
//     Under a muscle lying on the floor: lift that part by about 2r minus 1 cm.
// wedge   style "foam"|"board", angle 20, width 0.6, depth 0.4; rises toward -Z. Slope height y(z) = low + (depth/2 - z) * tan(angle), low = 0.012 (foam), 0.03 (board).
//     Heels up (figure at yaw 0, facing +Z). Toes up, for a calf stretch: yaw 180. Foot pitch = angle for heels up (+), -angle for toes up.
// skipping-platform   size 1.0, height 0.03. Stand on it at y = 0.03 (set floats:true).
// wall-bars   width 0.9, rungs 14, pitch 0.165, height 2.45, standing with its back to a wall at z = -0.13. Rung i (0 = lowest) is at y = 0.2 + i * pitch, z = 0, radius 0.016,
//     running along X between x = ±width/2. Pull-up rung at y = height - 0.06 (2.39), z = 0.17, radius 0.016. Hanging from it the back clears the rungs. wall:false drops the wall behind it.
// wall-anchor   height 1.1, plate on the wall face at z = 0 facing +Z; the band attaches at (0, height, 0.058). floor:true is a plate on the floor, band point (0, 0.05, 0). wall:true draws wall behind it.
// anchor-post   height 2.2, bandY 1.1, a 75 mm steel upright with a band choked around it. Band point (0, bandY, 0.06). band:false for the bare post.
// parallettes   height 0.2, spread 0.42, length 0.36. Two bars along Z; bar centres at x = ±spread/2, y = height, radius 0.016; hands neutral: thumb along +Z.
// stretch-strap   a 38 mm belt looped around one foot, to the hands: { foot:"L", hands:true } or { foot:"L", hand:"R" }. at 0.72 (0 heel, 1 ball). Goes round the sole in every frame.
//     over:true crosses the top of the foot instead (at 0.45), for pulling a heel toward the glutes (quad stretches).
// stick (broomstick or body bar)   { hands:true, length:1.5, radius:0.0125, shift:0, style:"wood"|"bodybar" } through both grip centres; { hand:"L" } along its thumb.
// muscle-roller   { hands:true, length:0.5 } a stick with spinning segments: handles centred on the grip centres. { hand:"L" } along its thumb. Handle radius 0.0155.
// foot-roller   { foot:"L", at:0.5, radius:0.028, length:0.16 } a section of PVC pipe across the arch, on the floor. Top y = 2r. Static: pos, axis along X at yaw 0.
// yoga-block   orient "flat"|"side"|"tall": sizes X, Y, Z = 0.15, 0.10, 0.23 | 0.10, 0.15, 0.23 | 0.15, 0.23, 0.10. Top is flat: a palm there has pos y = that height.
// knee-pad   width 0.42, depth 0.21, thickness 0.035. A knee on it sits at y = thickness.
// cushion   width 0.45, depth 0.45, thickness 0.11. A firm square cushion on the floor. Something resting on it: y = thickness minus 2 cm.
// trail-slope   angle 8, length 3.4: a ridge of rising ground for an outdoor walk, meeting the floor at its low end and sides and fading into the background, with a paler trodden path down the middle.
//     Ground height on the path, for |x| under 0.3: y(z) = (z + length/2) * tan(angle), so 0.239 at z = 0. Rises toward +Z. Feet: pitch = -angle going up (facing +Z), +angle going down (yaw 180). Set floats:true.
// dip-belt   { follow:true, kg:20, chain:0.3 } a belt around the waist, a chain from the front and a plate hanging from it, always straight down. Needs nothing else.
// bar-test   { hand:"L", length:0.5, radius:0.014 }, or { hands:true }: a thin metal cylinder through a hand's centre along its thumb, for testing grips. hands:true draws one per hand.
//
// The chair, sofa, wall, step, table, towels and door are in basic.js, which uses the helpers exported here. Those helpers need no DOM, so check.mjs can run them in Node.
import { kit, mat } from './kit.js'

const { THREE, group, mesh, box, rbox, cyl, torus, sphere } = kit
const V3 = THREE.Vector3
const D2R = Math.PI / 180
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
export const vec = (a) => new V3(a[0], a[1], a[2])

// ------------------------------------------------------------------------------------------------------------------- noise, textures

const hash2 = (x, y, s) => {
  const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453
  return h - Math.floor(h)
}
const mod = (a, n) => ((a % n) + n) % n
function pnoise(x, y, px, py, s = 0) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const fx = x - xi
  const fy = y - yi
  const u = fx * fx * (3 - 2 * fx)
  const v = fy * fy * (3 - 2 * fy)
  const a = hash2(mod(xi, px), mod(yi, py), s)
  const b = hash2(mod(xi + 1, px), mod(yi, py), s)
  const c = hash2(mod(xi, px), mod(yi + 1, py), s)
  const d = hash2(mod(xi + 1, px), mod(yi + 1, py), s)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
/** Smooth 1D noise in 0..1, for cloth and anything that shouldn't look machine-made. */
export function noise1(x, s = 0) {
  const xi = Math.floor(x)
  const f = x - xi
  const u = f * f * (3 - 2 * f)
  const a = hash2(xi, 0.5, s)
  const b = hash2(xi + 1, 0.5, s)
  return a + (b - a) * u
}
/** Smooth 2D noise in 0..1. */
export const noise2 = (x, y, s = 0) => pnoise(x, y, 100000, 100000, s)

const texMemo = new Map()
function dataTex(key, size, fill, { color = false } = {}) {
  let t = texMemo.get(key)
  if (t) return t
  const d = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = clamp(fill(x / size, y / size), 0, 1) * 255
      const k = (x + y * size) * 4
      d[k] = d[k + 1] = d[k + 2] = v
      d[k + 3] = 255
    }
  }
  t = new THREE.DataTexture(d, size, size, THREE.RGBAFormat)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.anisotropy = 4
  if (color) t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  texMemo.set(key, t)
  return t
}
const tiled = (t, metres) => {
  const c = t.clone()
  c.repeat.set(1 / metres, 1 / metres)
  c.needsUpdate = true
  return c
}
const TEX = {
  // Loops of terry cloth, a few per centimetre.
  terry: () => dataTex('terry', 256, (x, y) => 0.65 * pnoise(x * 40, y * 40, 40, 40, 1) + 0.35 * pnoise(x * 96, y * 96, 96, 96, 2)),
  // Plain weave of upholstery or webbing.
  weave: () => dataTex('weave', 256, (x, y) => 0.5 + 0.34 * Math.sin(x * Math.PI * 2 * 32) * Math.sin(y * Math.PI * 2 * 32) + 0.16 * (pnoise(x * 64, y * 64, 64, 64, 3) - 0.5)),
  // Closed-cell foam: fine pits.
  pits: () => dataTex('pits', 256, (x, y) => {
    const n = pnoise(x * 48, y * 48, 48, 48, 4)
    return 0.9 - 0.8 * smooth(0.62, 0.8, n) + 0.1 * pnoise(x * 128, y * 128, 128, 128, 5)
  }),
  // Rubber: almost smooth.
  rubber: () => dataTex('rubber', 256, (x, y) => 0.5 + 0.5 * (pnoise(x * 64, y * 64, 64, 64, 6) - 0.5)),
  // Long streaks along U: wood grain, as colour and as height.
  grain: () =>
    dataTex('grain', 256, (x, y) => {
      const w = pnoise(x * 3, y * 6, 3, 6, 7)
      const s = 0.55 * pnoise(x * 2, y * 18 + w * 3, 2, 18, 8) + 0.3 * pnoise(x * 4, y * 44 + w * 5, 4, 44, 9) + 0.15 * pnoise(x * 8, y * 96, 8, 96, 10)
      return 0.72 + 0.34 * s
    }, { color: true }),
  grainBump: () =>
    dataTex('grainBump', 256, (x, y) => {
      const w = pnoise(x * 3, y * 6, 3, 6, 7)
      return 0.6 * pnoise(x * 4, y * 44 + w * 5, 4, 44, 9) + 0.4 * pnoise(x * 8, y * 96, 8, 96, 10)
    }),
}

// Materials the kit doesn't have. Built on first use and never mutate the shared ones.
const matMemo = new Map()
const lazyMat = (key, make) => {
  let m = matMemo.get(key)
  if (!m) {
    m = make()
    m.name = key
    matMemo.set(key, m)
  }
  return m
}
// Non-metals keep a low share of the studio's reflections: a flat dark surface seen at a low angle otherwise mirrors the overhead panel and turns white.
const std = (o) => new THREE.MeshStandardMaterial({ envMapIntensity: o.metalness ? 1 : 0.32, ...o })
export const M = {
  /** Terry cloth, with per-vertex shading of its folds: only for geometry that has a colour attribute. */
  terryShaded: () => lazyMat('terryShaded', () => std({ color: 0xc4c7cb, roughness: 0.98, metalness: 0, vertexColors: true, bumpMap: tiled(TEX.terry(), 0.05), bumpScale: 1.1 })),
  terry: () => lazyMat('terry', () => std({ color: 0xc4c7cb, roughness: 0.98, metalness: 0, bumpMap: tiled(TEX.terry(), 0.05), bumpScale: 1.1 })),
  sofaFabric: () => lazyMat('sofaFabric', () => std({ color: 0x3c3d42, roughness: 0.88, metalness: 0, bumpMap: tiled(TEX.weave(), 0.05), bumpScale: 0.5 })),
  seatFabric: () => lazyMat('seatFabric', () => std({ color: 0x3f4045, roughness: 0.8, metalness: 0, bumpMap: tiled(TEX.weave(), 0.04), bumpScale: 0.45 })),
  piping: () => lazyMat('piping', () => std({ color: 0x4b4c52, roughness: 0.72, metalness: 0 })),
  wood: () => lazyMat('wood', () => std({ color: 0x70635a, roughness: 0.74, metalness: 0, map: tiled(TEX.grain(), 0.42), bumpMap: tiled(TEX.grainBump(), 0.42), bumpScale: 0.35 })),
  woodPale: () => lazyMat('woodPale', () => std({ color: 0x8a7e72, roughness: 0.68, metalness: 0, map: tiled(TEX.grain(), 0.42), bumpMap: tiled(TEX.grainBump(), 0.42), bumpScale: 0.3 })),
  ply: () => lazyMat('ply', () => std({ color: 0x8c8176, roughness: 0.62, metalness: 0 })),
  // three.js draws back faces into the shadow map, and with the page's normal bias the floor right under a curved underside comes out lit, as a pale crack.
  // Front faces in the shadow map close it: shadowSide on everything round that rests on the floor.
  gym: () => lazyMat('gym', () => std({ color: 0x4e5056, roughness: 0.42, metalness: 0, bumpMap: tiled(TEX.rubber(), 0.04), bumpScale: 0.12, shadowSide: THREE.FrontSide })),
  gymSeam: () => lazyMat('gymSeam', () => std({ color: 0x67696f, roughness: 0.46, metalness: 0 })),
  plastic: () => lazyMat('plastic', () => std({ color: 0x35363a, roughness: 0.42, metalness: 0, shadowSide: THREE.FrontSide })),
  plasticLight: () => lazyMat('plasticLight', () => std({ color: 0x74767c, roughness: 0.4, metalness: 0 })),
  rubber: () => lazyMat('rubberTex', () => std({ color: 0x2f3034, roughness: 0.78, metalness: 0, bumpMap: tiled(TEX.rubber(), 0.03), bumpScale: 0.25 })),
  rubberRibbed: () => lazyMat('rubberRibbed', () => std({ color: 0x35363b, roughness: 0.74, metalness: 0, shadowSide: THREE.FrontSide })),
  foam: () => lazyMat('foamTex', () => std({ color: 0x5b5d63, roughness: 0.92, metalness: 0, bumpMap: tiled(TEX.pits(), 0.035), bumpScale: 0.9, shadowSide: THREE.FrontSide })),
  foamDark: () => lazyMat('foamDark', () => std({ color: 0x404146, roughness: 0.92, metalness: 0, bumpMap: tiled(TEX.pits(), 0.035), bumpScale: 0.9 })),
  grip: () => lazyMat('grip', () => std({ color: 0x38393d, roughness: 0.8, metalness: 0, bumpMap: tiled(TEX.pits(), 0.018), bumpScale: 0.7 })),
  webbing: () => lazyMat('webbing', () => std({ color: 0x83868c, roughness: 0.82, metalness: 0, bumpMap: tiled(TEX.weave(), 0.018), bumpScale: 0.5 })),
  leather: () => lazyMat('leather', () => std({ color: 0x3e3f43, roughness: 0.6, metalness: 0, bumpMap: tiled(TEX.pits(), 0.03), bumpScale: 0.2 })),
  stitch: () => lazyMat('stitch', () => std({ color: 0x8d9096, roughness: 0.8, metalness: 0 })),
  paint: () => lazyMat('paint', () => std({ color: 0x47484d, roughness: 0.55, metalness: 0.25 })),
  trim: () => lazyMat('trim', () => std({ color: 0x343539, roughness: 0.74, metalness: 0 })),
  wallPaint: () => lazyMat('wallPaint', () => std({ color: 0x1c1c1f, roughness: 0.92, metalness: 0 })),
  jamb: () => lazyMat('jamb', () => std({ color: 0x2b2c30, roughness: 0.8, metalness: 0 })),
  bandLoop: () => lazyMat('bandLoop', () => std({ color: 0x6d7076, roughness: 0.62, metalness: 0 })),
  terryFlat: () => lazyMat('terryFlat', () => std({ color: 0x8f9296, roughness: 1, metalness: 0, vertexColors: true, bumpMap: tiled(TEX.terry(), 0.05), bumpScale: 1.6 })),
  pvc: () => lazyMat('pvc', () => std({ color: 0xa8abb0, roughness: 0.42, metalness: 0, shadowSide: THREE.FrontSide })),
  pvcBore: () => lazyMat('pvcBore', () => std({ color: 0x5c5e62, roughness: 0.5, metalness: 0, side: THREE.BackSide })),
}

// ------------------------------------------------------------------------------------------------------------------- geometry

const geoMemo = new Map()
export const memoGeo = (key, make) => {
  let g = geoMemo.get(key)
  if (!g) {
    g = make()
    geoMemo.set(key, g)
  }
  return g
}
export const K = (...a) => JSON.stringify(a)

// For check.mjs: most of this module's geometry is neither a box nor a cylinder. A mesh can say what it is, in its own local coordinates:
// userData.collide = { kind:'sphere', c:[x, y, z], r } or { kind:'cylinder', axis:'x'|'y'|'z', c:[x, y, z], r, h }; userData.noCollide = true for things that touch the body by design
// (a towel in the hands, a strap around a foot, a belt around the waist) or are too thin to matter (seams, the floor's contact shadow).
export const collide = (o, shape) => {
  o.userData.collide = shape
  return o
}
export const noCollide = (o) => {
  o.userData.noCollide = true
  return o
}

// Geometry that changes every frame (a towel between two hands) would otherwise pile up in GPU memory over a long render.
const liveDynamic = []
export function dynamicGeo(g) {
  liveDynamic.push(g)
  if (liveDynamic.length > 48) liveDynamic.shift().dispose()
  return g
}

/**
 * A grid surface. fn(u, v, target) writes the point for u, v in 0..1. Winding and normals follow du x dv, flip reverses them.
 * Normals come from grid neighbours, so a closed surface has no seam: closeU and closeV say which directions wrap.
 * uvFn(u, v, p) returns [a, b], in metres by convention. colorFn(u, v) returns a brightness.
 */
export function gridGeo(nu, nv, fn, { closeU = false, closeV = false, flip = false, uvFn = null, colorFn = null } = {}) {
  const W = nu + 1
  const H = nv + 1
  const n = W * H
  const P = new Float32Array(n * 3)
  const N = new Float32Array(n * 3)
  const T = new Float32Array(n * 2)
  const C = colorFn ? new Float32Array(n * 3) : null
  const t = new V3()
  for (let j = 0; j < H; j++) {
    const v = j / nv
    for (let i = 0; i < W; i++) {
      const u = i / nu
      fn(u, v, t)
      const k = i + j * W
      P[k * 3] = t.x
      P[k * 3 + 1] = t.y
      P[k * 3 + 2] = t.z
      if (uvFn) {
        const a = uvFn(u, v, t)
        T[k * 2] = a[0]
        T[k * 2 + 1] = a[1]
      } else {
        T[k * 2] = u
        T[k * 2 + 1] = v
      }
      if (C) {
        const c = colorFn(u, v, t)
        C[k * 3] = C[k * 3 + 1] = C[k * 3 + 2] = c
      }
    }
  }
  const sign = flip ? -1 : 1
  const deg = []
  for (let j = 0; j < H; j++) {
    const jl = j > 0 ? j - 1 : closeV ? nv - 1 : 0
    const jr = j < nv ? j + 1 : closeV ? 1 : nv
    for (let i = 0; i < W; i++) {
      const il = i > 0 ? i - 1 : closeU ? nu - 1 : 0
      const ir = i < nu ? i + 1 : closeU ? 1 : nu
      const a = (il + j * W) * 3
      const b = (ir + j * W) * 3
      const c = (i + jl * W) * 3
      const d = (i + jr * W) * 3
      const dux = P[b] - P[a]
      const duy = P[b + 1] - P[a + 1]
      const duz = P[b + 2] - P[a + 2]
      const dvx = P[d] - P[c]
      const dvy = P[d + 1] - P[c + 1]
      const dvz = P[d + 2] - P[c + 2]
      const nx = duy * dvz - duz * dvy
      const ny = duz * dvx - dux * dvz
      const nz = dux * dvy - duy * dvx
      const l = Math.hypot(nx, ny, nz)
      const k = (i + j * W) * 3
      if (l < 1e-14) {
        deg.push(i, j)
        continue
      }
      N[k] = (sign * nx) / l
      N[k + 1] = (sign * ny) / l
      N[k + 2] = (sign * nz) / l
    }
  }
  // Degenerate points (the pole of a sphere, the collapsed end of a sweep) take the average of the row next to them.
  for (let q = 0; q < deg.length; q += 2) {
    const i = deg[q]
    const j = deg[q + 1]
    const r = j === 0 ? 1 : j === nv ? nv - 1 : j + 1
    let x = 0
    let y = 0
    let z = 0
    for (let c = 0; c < nu; c++) {
      const k = (c + r * W) * 3
      x += N[k]
      y += N[k + 1]
      z += N[k + 2]
    }
    const l = Math.hypot(x, y, z) || 1
    const k = (i + j * W) * 3
    N[k] = x / l
    N[k + 1] = y / l
    N[k + 2] = z / l
  }
  const idx = new Uint32Array(nu * nv * 6)
  let w = 0
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = i + j * W
      const b = a + 1
      const c = b + W
      const d = a + W
      if (flip) {
        idx[w++] = a
        idx[w++] = c
        idx[w++] = b
        idx[w++] = a
        idx[w++] = d
        idx[w++] = c
      } else {
        idx[w++] = a
        idx[w++] = b
        idx[w++] = c
        idx[w++] = a
        idx[w++] = c
        idx[w++] = d
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(P, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(T, 2))
  if (C) g.setAttribute('color', new THREE.BufferAttribute(C, 3))
  g.setIndex(new THREE.BufferAttribute(idx, 1))
  return g
}

/** Rounds the corners of a polyline [[x, y, fillet?], ...]: real things have no sharp edges. */
export function filletLine(points, f = 0, steps = 5) {
  const out = []
  const n = points.length
  for (let k = 0; k < n; k++) {
    const p = points[k]
    const r = p[2] ?? f
    if (k === 0 || k === n - 1 || r <= 0) {
      out.push([p[0], p[1]])
      continue
    }
    const a = points[k - 1]
    const b = points[k + 1]
    let d1x = a[0] - p[0]
    let d1y = a[1] - p[1]
    let d2x = b[0] - p[0]
    let d2y = b[1] - p[1]
    const l1 = Math.hypot(d1x, d1y)
    const l2 = Math.hypot(d2x, d2y)
    d1x /= l1
    d1y /= l1
    d2x /= l2
    d2y /= l2
    const cosA = clamp(d1x * d2x + d1y * d2y, -1, 1)
    const ang = Math.acos(cosA)
    if (ang > Math.PI - 0.01 || ang < 0.01) {
      out.push([p[0], p[1]])
      continue
    }
    const tn = Math.min(r / Math.tan(ang / 2), l1 * 0.49, l2 * 0.49)
    const rr = tn * Math.tan(ang / 2)
    let bx = d1x + d2x
    let by = d1y + d2y
    const bl = Math.hypot(bx, by)
    bx /= bl
    by /= bl
    const cd = rr / Math.sin(ang / 2)
    const cx = p[0] + bx * cd
    const cy = p[1] + by * cd
    const s0 = Math.atan2(p[1] + d1y * tn - cy, p[0] + d1x * tn - cx)
    let s1 = Math.atan2(p[1] + d2y * tn - cy, p[0] + d2x * tn - cx)
    let da = s1 - s0
    while (da > Math.PI) da -= Math.PI * 2
    while (da < -Math.PI) da += Math.PI * 2
    s1 = s0 + da
    for (let q = 0; q <= steps; q++) {
      const t = s0 + (da * q) / steps
      out.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr])
    }
  }
  return out
}

/**
 * Surface of revolution around Y. profile is [[radius, y, fillet?], ...], bottom to top for an outward-facing surface. Corners are filleted;
 * a corner sharper than 35 degrees that wasn't filleted stays crisp. UVs are in metres: around, along.
 */
export function revolveGeo(profile, { seg = 64, f = 0, steps = 5 } = {}) {
  return memoGeo(K('rev', profile, seg, f, steps), () => {
    const pts = filletLine(profile, f, steps)
    const rows = []
    let s = 0
    let maxR = 0
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k]
      maxR = Math.max(maxR, p[0])
      const prev = k > 0 ? pts[k - 1] : null
      const next = k < pts.length - 1 ? pts[k + 1] : null
      const nOf = (a, b) => {
        const dx = b[0] - a[0]
        const dy = b[1] - a[1]
        const l = Math.hypot(dx, dy) || 1
        return [dy / l, -dx / l]
      }
      const n0 = prev ? nOf(prev, p) : null
      const n1 = next ? nOf(p, next) : null
      if (prev) s += Math.hypot(p[0] - prev[0], p[1] - prev[1])
      if (n0 && n1 && n0[0] * n1[0] + n0[1] * n1[1] < Math.cos(35 * D2R)) {
        rows.push({ r: p[0], y: p[1], nr: n0[0], ny: n0[1], s })
        rows.push({ r: p[0], y: p[1], nr: n1[0], ny: n1[1], s })
      } else {
        const a = n0 || n1
        const b = n1 || n0
        const l = Math.hypot(a[0] + b[0], a[1] + b[1]) || 1
        rows.push({ r: p[0], y: p[1], nr: (a[0] + b[0]) / l, ny: (a[1] + b[1]) / l, s })
      }
    }
    const W = seg + 1
    const H = rows.length
    const P = new Float32Array(W * H * 3)
    const N = new Float32Array(W * H * 3)
    const T = new Float32Array(W * H * 2)
    for (let j = 0; j < H; j++) {
      const r = rows[j]
      for (let i = 0; i < W; i++) {
        const a = (i / seg) * Math.PI * 2
        const sa = Math.sin(a)
        const ca = Math.cos(a)
        const k = i + j * W
        P[k * 3] = r.r * sa
        P[k * 3 + 1] = r.y
        P[k * 3 + 2] = r.r * ca
        N[k * 3] = r.nr * sa
        N[k * 3 + 1] = r.ny
        N[k * 3 + 2] = r.nr * ca
        T[k * 2] = a * maxR
        T[k * 2 + 1] = r.s
      }
    }
    const idx = new Uint32Array((W - 1) * (H - 1) * 6)
    let w = 0
    for (let j = 0; j < H - 1; j++) {
      for (let i = 0; i < W - 1; i++) {
        const a = i + j * W
        const b = a + 1
        const c = b + W
        const d = a + W
        idx[w++] = a
        idx[w++] = b
        idx[w++] = c
        idx[w++] = a
        idx[w++] = c
        idx[w++] = d
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(P, 3))
    g.setAttribute('normal', new THREE.BufferAttribute(N, 3))
    g.setAttribute('uv', new THREE.BufferAttribute(T, 2))
    g.setIndex(new THREE.BufferAttribute(idx, 1))
    return g
  })
}

const AXIS = { x: new THREE.Euler(0, 0, -Math.PI / 2), y: new THREE.Euler(0, 0, 0), z: new THREE.Euler(Math.PI / 2, 0, 0) }
/** Revolved part. Local +Y of the profile goes to +X, +Y or +Z. */
export const lathe = (profile, m, pos, axis = 'y', o = {}) => mesh(revolveGeo(profile, o), m, pos, AXIS[axis])

function weldNormals(g) {
  g.computeVertexNormals()
  const p = g.attributes.position
  const n = g.attributes.normal
  const groups = new Map()
  for (let i = 0; i < p.count; i++) {
    const k = `${Math.round(p.getX(i) * 2e4)},${Math.round(p.getY(i) * 2e4)},${Math.round(p.getZ(i) * 2e4)}`
    let e = groups.get(k)
    if (!e) {
      e = { x: 0, y: 0, z: 0, ids: [] }
      groups.set(k, e)
    }
    e.x += n.getX(i)
    e.y += n.getY(i)
    e.z += n.getZ(i)
    e.ids.push(i)
  }
  for (const e of groups.values()) {
    const l = Math.hypot(e.x, e.y, e.z) || 1
    for (const i of e.ids) n.setXYZ(i, e.x / l, e.y / l, e.z / l)
  }
  return g
}

/**
 * A soft box: rounded edges, faces that can swell (crown, in metres), optional lumps, smooth normals, UVs in metres. warp(v) may move the finished points:
 * that is how a wedge is a sheared soft box. Cushions, pads, blocks.
 */
export function softBoxGeo(w, h, d, { r = 0.015, crown = 0, crownSide = 0, lump = 0, seed = 0, flat = 8, corner = 3, warp = null, warpKey = '' } = {}) {
  return memoGeo(K('soft', w, h, d, r, crown, crownSide, lump, seed, flat, corner, warpKey), () => {
    const rr = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)
    const seg = flat + corner * 2
    const g = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg)
    const p = g.attributes.position
    const uv = g.attributes.uv
    const a0 = flat / seg
    const half = [w / 2, h / 2, d / 2]
    const map = (u, axis) => {
      const a = Math.abs(u) * 2
      const sg = Math.sign(u)
      if (a <= a0 + 1e-6) return [sg * (a / a0) * (half[axis] - rr), 0]
      const t = (a - a0) / (1 - a0)
      return [sg * (half[axis] - rr), sg * Math.tan((t * Math.PI) / 4)]
    }
    const v = new V3()
    const dir = new V3()
    const g2 = (x, hx) => Math.max(0, 1 - (x / hx) * (x / hx))
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i)
      const mx = map(v.x, 0)
      const my = map(v.y, 1)
      const mz = map(v.z, 2)
      dir.set(mx[1], my[1], mz[1])
      if (dir.lengthSq() < 1e-9) dir.set(0, 1, 0)
      dir.normalize()
      let x = mx[0] + dir.x * rr
      let y = my[0] + dir.y * rr
      let z = mz[0] + dir.z * rr
      const disp =
        crown * g2(x, half[0]) * g2(z, half[2]) * Math.max(0, dir.y) +
        crownSide * (g2(y, half[1]) * g2(z, half[2]) * Math.abs(dir.x) + g2(x, half[0]) * g2(y, half[1]) * Math.abs(dir.z) + g2(x, half[0]) * g2(z, half[2]) * Math.max(0, -dir.y))
      const lumpy = lump ? lump * (noise2(x * 7 + y * 3 + seed, z * 7 - y * 2 + seed * 3, 11) - 0.5) * 2 : 0
      x += dir.x * (disp + lumpy)
      y += dir.y * (disp + lumpy)
      z += dir.z * (disp + lumpy)
      v.set(x, y, z)
      if (warp) warp(v)
      p.setXYZ(i, v.x, v.y, v.z)
      const ax = Math.abs(dir.x)
      const ay = Math.abs(dir.y)
      const az = Math.abs(dir.z)
      if (ay >= ax && ay >= az) uv.setXY(i, x, z)
      else if (ax >= az) uv.setXY(i, z, y)
      else uv.setXY(i, x, y)
    }
    return weldNormals(g)
  })
}
/** Soft box, positioned by its centre. */
export const soft = (w, h, d, m, pos, o = {}, rot = null) => mesh(softBoxGeo(w, h, d, o), m, pos, rot)

const sgnpow = (x, e) => Math.sign(x) * Math.pow(Math.abs(x), e)

/**
 * Sweeps a rounded section along a path: frames, legs, slats, rails. w is the section's size across, d its size along `up`, tapering to w2, d2 at the end.
 * n is the squareness of the section (2 = ellipse, 6 = rounded rectangle). Straight when given two points, a Catmull-Rom curve otherwise.
 * UV: U along the length in metres, V around, so the wood grain runs the right way.
 */
export function sweepGeo(points, { w, d = w, w2 = w, d2 = d, n = 5, up = [0, 1, 0], around = 20, rings = 0, cap = 0.25, dynamic = false } = {}) {
  const make = () => {
    const ctrl = points.map((q) => vec(q))
    const straight = ctrl.length === 2
    const count = straight ? Math.max(rings, 1) : rings || Math.max(24, ctrl.length * 10)
    let pts
    if (straight) {
      pts = []
      for (let i = 0; i <= count; i++) pts.push(ctrl[0].clone().lerp(ctrl[1], i / count))
    } else {
      const c = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal')
      c.arcLengthDivisions = count * 8
      pts = c.getSpacedPoints(count)
    }
    const m = pts.length
    const T = pts.map((_, i) => pts[Math.min(m - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize())
    const B = new Array(m)
    const A = new Array(m)
    let b = vec(up)
    b.addScaledVector(T[0], -b.dot(T[0]))
    if (b.lengthSq() < 1e-8) {
      b = new V3(0, 0, 1)
      b.addScaledVector(T[0], -b.dot(T[0]))
    }
    b.normalize()
    for (let i = 0; i < m; i++) {
      b = b.clone().addScaledVector(T[i], -b.dot(T[i])).normalize()
      B[i] = b
      A[i] = b.clone().cross(T[i]).normalize()
    }
    let len = 0
    const S = [0]
    for (let i = 1; i < m; i++) {
      len += pts[i].distanceTo(pts[i - 1])
      S.push(len)
    }
    // End rings that round the cut ends.
    const capD = Math.min(w, d) * cap
    const rows = []
    if (capD > 0) {
      rows.push({ i: 0, off: 0, s: 0 })
      rows.push({ i: 0, off: 0, s: 0.72 })
      rows.push({ i: 0, off: capD * 0.28, s: 0.93 })
    }
    for (let i = 0; i < m; i++) {
      rows.push({ i, off: i === 0 ? capD : i === m - 1 ? -capD : 0, s: 1 })
    }
    if (capD > 0) {
      rows.push({ i: m - 1, off: -capD * 0.28, s: 0.93 })
      rows.push({ i: m - 1, off: 0, s: 0.72 })
      rows.push({ i: m - 1, off: 0, s: 0 })
    }
    const ex = 2 / n
    return gridGeo(
      around,
      rows.length - 1,
      (u, v, t) => {
        const row = rows[Math.round(v * (rows.length - 1))]
        const q = u * Math.PI * 2
        const f = len ? S[row.i] / len : 0
        const ww = (w + (w2 - w) * f) * 0.5 * row.s
        const dd = (d + (d2 - d) * f) * 0.5 * row.s
        const x = sgnpow(Math.cos(q), ex) * ww
        const y = sgnpow(Math.sin(q), ex) * dd
        t.copy(pts[row.i]).addScaledVector(T[row.i], row.off).addScaledVector(A[row.i], x).addScaledVector(B[row.i], y)
      },
      {
        closeU: true,
        uvFn: (u, v) => {
          const row = rows[Math.round(v * (rows.length - 1))]
          return [S[row.i] + row.off, u * (w + d) * 1.3 + S[row.i] * 0.02]
        },
      },
    )
  }
  if (dynamic) return dynamicGeo(make())
  return memoGeo(K('sweep', points, w, d, w2, d2, n, up, around, rings, cap), make)
}
export const bar = (points, m, o) => mesh(sweepGeo(points, o), m)

/** A round tube along a smooth path, cached. For cables, chains of curves and bent frames that don't move. */
export function pipeGeo(points, r, { seg = 10, tubular = 0, closed = false, dynamic = false } = {}) {
  const make = () => {
    const c = new THREE.CatmullRomCurve3(points.map((q) => vec(q)), closed, 'centripetal')
    return new THREE.TubeGeometry(c, tubular || Math.max(24, points.length * 8), r, seg, closed)
  }
  if (dynamic) return dynamicGeo(make())
  return memoGeo(K('pipe', points, r, seg, tubular, closed), make)
}

/** Points of a rounded rectangle at height y, for piping around a cushion. */
export function roundRectPath(w, d, r, y, n = 6) {
  const out = []
  const corner = (cx, cz, a0) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2)
      out.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r])
    }
  }
  const hx = w / 2 - r
  const hz = d / 2 - r
  corner(hx, hz, 0)
  corner(-hx, hz, Math.PI / 2)
  corner(-hx, -hz, Math.PI)
  corner(hx, -hz, Math.PI * 1.5)
  return out
}

// The studio's shadow map leaves a pale crack under anything that touches the floor along a curve. This soft dark patch grounds it.
const blobTex = () =>
  dataTex('blob', 128, (x, y) => {
    const d = Math.hypot(x + 0.5 / 128 - 0.5, y + 0.5 / 128 - 0.5) * 2
    return Math.pow(smooth(1, 0.1, d), 1.6)
  })
const blobMat = (strength) =>
  lazyMat(`blob${strength}`, () => new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: blobTex(), transparent: true, opacity: strength, depthWrite: false, toneMapped: false }))
/** Contact shadow on the floor: full sizes along X and Z, centred on x, z of the prop. It has no effect on the camera fit. */
export function contactShadow(sx, sz, strength = 0.72, x = 0, z = 0) {
  const g = memoGeo('blobPlane', () => {
    const q = new THREE.PlaneGeometry(1, 1)
    q.rotateX(-Math.PI / 2)
    return q
  })
  const o = new THREE.Mesh(g, blobMat(strength))
  o.position.set(x, 0.0012, z)
  o.scale.set(sx, 1, sz)
  o.renderOrder = 1
  o.userData.frameIgnore = true
  o.userData.noCollide = true
  return o
}

// -------------------------------------------------------------------------------------------------------------------- paths on the body

/** A smooth path through control points, sampled every `step` metres. Returns points, arc lengths and the total length. */
export function samplePath(ctrl, step) {
  const clean = []
  for (const c of ctrl) if (!clean.length || clean[clean.length - 1].distanceTo(c) > 1e-3) clean.push(c)
  if (clean.length < 2) clean.push(clean[0].clone().add(new V3(0, -0.01, 0)))
  const curve = new THREE.CatmullRomCurve3(clean, false, 'centripetal')
  curve.arcLengthDivisions = Math.max(200, clean.length * 60)
  const len = curve.getLength()
  const count = Math.max(4, Math.ceil(len / step))
  const pts = curve.getSpacedPoints(count)
  const S = pts.map((_, i) => (i / count) * len)
  return { pts, S, len, count }
}

/** Twist-free frames along sampled points, starting from a normal at index `from`. N x B = T. */
export function transportFrames(pts, normal0, from = 0) {
  const m = pts.length
  const T = pts.map((_, i) => pts[Math.min(m - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize())
  const N = new Array(m)
  const start = normal0.clone().addScaledVector(T[from], -normal0.dot(T[from]))
  if (start.lengthSq() < 1e-8) start.set(T[from].z, T[from].x, T[from].y).addScaledVector(T[from], -start.dot(T[from]))
  N[from] = start.normalize()
  for (let i = from + 1; i < m; i++) N[i] = N[i - 1].clone().addScaledVector(T[i], -N[i - 1].dot(T[i])).normalize()
  for (let i = from - 1; i >= 0; i--) N[i] = N[i + 1].clone().addScaledVector(T[i], -N[i + 1].dot(T[i])).normalize()
  const B = N.map((n, i) => T[i].clone().cross(n).normalize())
  return { T, N, B }
}

/** The floor point of a foot: at is "heel", "sole", "ball" or a number, 0 heel to 1 ball. */
export function footAnchor(ctx, side, at = 'sole') {
  const f = ctx.feet[side]
  if (typeof at === 'number') return vec(f.heel).lerp(vec(f.ball), at)
  return vec(f[at] || f.sole)
}

/**
 * Control points of something that goes around the sole of a foot, from the side nearest `from` to the other. It leaves the foot on both sides, so a towel or a strap
 * hugs the arch instead of cutting through it.
 */
export function aroundFoot(ctx, side, { at = 0.55, halfWidth = 0.045, clear = 0.008, rise = 0.035, over = false }, from) {
  const f = ctx.feet[side]
  const fwd = vec(f.forward)
  const up = vec(f.up)
  const across = fwd.clone().cross(up).normalize()
  const S = vec(f.heel).lerp(vec(f.ball), at)
  const P = (w, u) => S.clone().addScaledVector(across, w).addScaledVector(up, u)
  // Under the sole, or (over:true) across the top of the foot, for a strap that pulls a heel toward the glutes.
  const top = 0.058 * (1.15 - 0.45 * at) + clear
  let list = over
    ? [P(halfWidth + 0.02, top * 0.32), P(halfWidth * 0.78, top * 0.86), P(0, top), P(-halfWidth * 0.78, top * 0.86), P(-halfWidth - 0.02, top * 0.32)]
    : [P(halfWidth + 0.02, rise), P(halfWidth * 0.75, -clear * 0.3), P(0, -clear), P(-halfWidth * 0.75, -clear * 0.3), P(-halfWidth - 0.02, rise)]
  if (from && from.distanceTo(list[0]) > from.distanceTo(list[list.length - 1])) list = list.reverse()
  return { points: list, normal: up, across: fwd, mid: over ? P(0, top) : S }
}

// --------------------------------------------------------------------------------------------------------------------- gym balls

/** Radial profile of an inflated ball resting on the floor, flattened where it touches. */
function ballProfile(r, sag, n = 88) {
  const cy = r - sag
  const widen = 1 + (sag * 0.32) / r
  const out = []
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI
    const x = r * widen * Math.cos(a)
    const y = cy + r * Math.sin(a)
    // A soft floor patch instead of a cut.
    const k = 0.012
    const h = 0.5 * (y + Math.sqrt(y * y + k * k * 0.25))
    out.push([Math.max(0, i === 0 || i === n ? 0 : x), i === 0 ? 0 : h])
  }
  return out
}

function ballSeams(r, sag, rx, rz, lon) {
  // Meridians between two small pole caps, tilted so they cross the visible side of the ball at an angle.
  const widen = 1 + (sag * 0.32) / r
  const cy = r - sag
  const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz, 'XYZ')).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.62, lon, 0.34, 'YXZ')))
  const place = (x, y, z) => {
    const v = new V3(x, y, z).applyQuaternion(rot).multiplyScalar(r * 1.0003)
    const yy = cy + v.y
    const k = 0.012
    return [v.x * widen, 0.5 * (yy + Math.sqrt(yy * yy + k * k * 0.25)), v.z * widen]
  }
  const curves = []
  const t0 = 0.17
  const meridians = 6
  for (let k = 0; k < meridians; k++) {
    const phi = (k / meridians) * Math.PI * 2
    const pts = []
    const steps = 30
    for (let i = 0; i <= steps; i++) {
      const t = t0 + (i / steps) * (Math.PI - 2 * t0)
      pts.push(place(Math.sin(t) * Math.cos(phi), Math.cos(t), Math.sin(t) * Math.sin(phi)))
    }
    curves.push({ pts, closed: false })
  }
  for (const yy of [Math.cos(t0), -Math.cos(t0)]) {
    const pts = []
    const steps = 28
    for (let i = 0; i < steps; i++) {
      const phi = (i / steps) * Math.PI * 2
      pts.push(place(Math.sin(t0) * Math.cos(phi), yy, Math.sin(t0) * Math.sin(phi)))
    }
    curves.push({ pts, closed: true })
  }
  // The inflation plug, on the upper cap's centre.
  const plug = place(0, 1, 0)
  const plugN = new V3(0, 1, 0).applyQuaternion(rot)
  return { curves, plug, plugN }
}

/** Where a ball on the floor must be to stay under what the prop follows. Returns [x, z]. */
function ballFollow(p, ctx, r) {
  const sideList = (s) => (s === 'L' || s === 'R' ? [s] : ['L', 'R'])
  const mean = (list) => list.reduce((a, b) => a.add(b), new V3()).multiplyScalar(1 / list.length)
  if (p.foot || p.feet) {
    const sides = sideList(p.foot || 'both')
    const anchor = p.anchor || 'heel'
    const pts = sides.map((s) => footAnchor(ctx, s, anchor))
    const ups = sides.map((s) => vec(ctx.feet[s].up))
    const c = mean(pts).addScaledVector(mean(ups).normalize(), -(r + (p.clear ?? 0)))
    return [c.x, c.z]
  }
  const fl = p.follow
  const on = fl.on || ['lowerleg01', 'foot']
  const sides = sideList(fl.side || 'both')
  const joint = (n, s) => vec(ctx.joints[`${n}.${s}`] || ctx.joints[n])
  const A = mean(sides.map((s) => joint(on[0], s)))
  const Bv = mean(sides.map((s) => joint(on[1], s)))
  const d = Bv.clone().sub(A)
  const Lh = Math.hypot(d.x, d.z)
  const hx = Lh > 1e-4 ? d.x / Lh : 0
  const hz = Lh > 1e-4 ? d.z / Lh : 1
  const len = Math.hypot(Lh, d.y) || 1
  // Normal of the limb's line in its vertical plane, pointing up.
  const ns = -d.y / len
  const ny = Lh / len
  const clear = fl.clear ?? 0.045
  const at = (fl.at ?? 0.6) * Lh
  let s = at
  if (Math.abs(ns) > 1e-3) {
    const tangent = (-(r + clear) - (r - A.y) * ny) / ns
    const w = smooth(0.03, 0.12, Math.abs(ns))
    s = w * clamp(tangent, -0.1, Lh + 0.14) + (1 - w) * at
  }
  return [A.x + hx * s, A.z + hz * s]
}

function heldBall(p, ctx, r) {
  // In the air between the palms: round, with its seams turning with the hands.
  const L = vec(ctx.hands.L.centre)
  const Rr = vec(ctx.hands.R.centre)
  const c = L.clone().lerp(Rr, 0.5)
  const axis = L.clone().sub(Rr).normalize()
  const inner = group(collide(mesh(revolveGeo(ballProfile(r, 0), { seg: 96 }), M.gym()), { kind: 'sphere', c: [0, r, 0], r: r - 0.005 }))
  const seams = ballSeams(r, 0, 0, 0, p.lon ?? 0.4)
  for (const q of seams.curves) inner.add(noCollide(mesh(pipeGeo(q.pts, r * 0.0036, { seg: 5, tubular: q.closed ? 56 : 64, closed: q.closed, dynamic: true }), M.gymSeam())))
  inner.position.y = -r
  const g = group(inner)
  g.position.copy(c)
  g.quaternion.setFromUnitVectors(new V3(1, 0, 0), axis)
  const o = group(g)
  o.userData.world = true
  return o
}

function stabilityBall(p, ctx) {
  const r = p.radius ?? 0.325
  if (ctx && p.hands) return heldBall(p, ctx, r)
  const load = clamp(p.load ?? 0, 0, 1)
  const sag = +(0.012 + 0.03 * load).toFixed(4)
  let x = 0
  let z = 0
  let world = false
  if (ctx && (p.foot || p.feet || p.follow)) {
    ;[x, z] = ballFollow(p, ctx, r)
    if (p.offset) {
      x += p.offset[0]
      z += p.offset[1]
    }
    world = true
  } else if (p.pos) {
    x = p.pos[0]
    z = p.pos[2]
  }
  // It rolls without slipping: the turn is the distance from the origin over the radius.
  const rx = (p.roll ?? 0) * D2R + z / r
  const rz = -x / r
  const patch = Math.sqrt(2 * r * sag)
  const g = group(collide(mesh(revolveGeo(ballProfile(r, sag), { seg: 96 }), M.gym()), { kind: 'sphere', c: [0, r - sag, 0], r }), contactShadow(patch * 2 + r * 1.1, patch * 2 + r * 1.1, 0.8))
  const quant = (a) => Math.round(a * 400) / 400
  const seams = ballSeams(r, sag, quant(rx), quant(rz), p.lon ?? 0.4)
  for (const c of seams.curves) g.add(noCollide(mesh(pipeGeo(c.pts, r * 0.0036, { seg: 5, tubular: c.closed ? 56 : 64, closed: c.closed, dynamic: true }), M.gymSeam())))
  const plug = lathe([[0, 0], [0.011, 0, 0.002], [0.0105, 0.0035, 0.0018], [0, 0.0045]], M.gymSeam(), seams.plug, 'y', { seg: 20 })
  plug.quaternion.setFromUnitVectors(new V3(0, 1, 0), seams.plugN)
  g.add(noCollide(plug))
  if (world) {
    g.position.set(x, 0, z)
    const o = group(g)
    o.userData.world = true
    return o
  }
  return g
}

function bosu(p) {
  const a = p.radius ?? 0.32
  const flip = !!p.flip
  // Dome: a spherical cap, with the ring ribs of the real thing.
  const domeBase = 0.045
  const h = (p.height ?? 0.26) - domeBase
  const baseR = a - 0.022
  const R = (baseR * baseR + h * h) / (2 * h)
  const cy = domeBase + h - R
  const a0 = Math.asin(clamp((domeBase - cy) / R, -1, 1))
  const ribs = [0.2, 0.34, 0.48, 0.62, 0.74, 0.86]
  const domeProfile = []
  const n = 220
  domeProfile.push([baseR + 0.002, domeBase - 0.002])
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const ang = a0 + (Math.PI / 2 - a0) * t
    let bump = 0
    for (const q of ribs) bump += 0.0016 * Math.exp(-(((t - q) / 0.0085) ** 2))
    const rr = R + bump
    domeProfile.push([i === n ? 0 : rr * Math.cos(ang), cy + rr * Math.sin(ang)])
  }
  // The base plate: rubber foot ring, plastic rim, a groove where the dome is clamped.
  const plate = [
    [0, 0.008],
    [a - 0.03, 0.008],
    [a - 0.028, 0, 0.002],
    [a - 0.004, 0, 0.003],
    [a, 0.012, 0.004],
    [a, 0.036, 0.005],
    [a - 0.006, 0.046, 0.004],
    [baseR + 0.004, 0.046, 0.002],
    [baseR + 0.004, 0.04],
  ]
  const inner = group(lathe(plate, M.plastic(), null, 'y', { seg: 96, f: 0, steps: 4 }), collide(mesh(revolveGeo(domeProfile, { seg: 96 }), M.gym()), { kind: 'sphere', c: [0, cy, 0], r: R }))
  // The valve, on the dome just off its crown.
  {
    const ang = 1.14
    const v = lathe([[0, 0], [0.012, 0, 0.002], [0.0115, 0.003, 0.002], [0.004, 0.0045, 0.001], [0, 0.0045]], M.plasticLight(), [Math.cos(ang) * R * 0.707, cy + Math.sin(ang) * R, Math.cos(ang) * R * 0.707], 'y', { seg: 18, steps: 2 })
    v.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3(Math.cos(ang) * 0.707, Math.sin(ang), Math.cos(ang) * 0.707).normalize())
    inner.add(noCollide(v))
  }
  // A rubber foot ring, lighter, so the plate's edge doesn't vanish on a black floor.
  inner.add(torus(a - 0.012, 0.0035, M.plasticLight(), [0, 0.024, 0], 'y', 96))
  if (!flip) return group(inner, contactShadow(a * 2.25, a * 2.25, 0.6))
  // Flat side up: the plate on top with its two handles, resting on the crown of the dome.
  inner.rotation.x = Math.PI
  inner.position.y = 0.26
  const handles = []
  for (const sx of [-1, 1]) {
    handles.push(bar([[sx * 0.2, 0.282, -0.07], [sx * 0.2, 0.282, 0.07]], M.grip(), { w: 0.026, d: 0.026, n: 2.2 }))
    for (const z of [-0.075, 0.075]) handles.push(bar([[sx * 0.2, 0.258, z], [sx * 0.2, 0.284, z]], M.plastic(), { w: 0.024, d: 0.03, n: 4 }))
  }
  return group(inner, handles, contactShadow(a * 1.3, a * 1.3, 0.7))
}

// ---------------------------------------------------------------------------------------------------------------------- foam and rollers

function foamRoller(p, ctx) {
  const r = p.radius ?? 0.075
  const L = p.length ?? 0.9
  const style = p.style ?? 'smooth'
  // Rolling: the surface turns with the distance travelled along Z.
  const z = p.pos ? p.pos[2] : 0
  const spin = (p.spin ?? 0) * D2R + z / r
  let body
  if (style === 'grid') {
    // Firm foam moulded on a hollow core, a square grid of raised blocks. The mesh follows the blocks, so their edges are clean.
    const blocksAround = 12
    const blockH = 0.0375
    const blocksAlong = Math.max(2, Math.round(L / blockH))
    const stops = [0, 0.05, 0.13, 0.3, 0.5, 0.7, 0.87, 0.95]
    const geo = memoGeo(K('grid-roller', r, L), () => {
      const nu = blocksAround * stops.length
      const nv = blocksAlong * stops.length + 8
      const prof = (f) => smooth(0.05, 0.13, f) * smooth(0.95, 0.87, f)
      return gridGeo(
        nu,
        nv,
        (u, v, t) => {
          const iu = Math.round(u * nu)
          const fu = stops[iu % stops.length] + Math.floor(iu / stops.length)
          const a = (fu / blocksAround) * Math.PI * 2
          const jv = Math.round(v * nv) - 4
          let y
          let edge = 1
          if (jv < 0) {
            y = -L / 2 - 0.0
            edge = (jv + 4) / 4
          } else if (jv > blocksAlong * stops.length) {
            y = L / 2
            edge = (blocksAlong * stops.length + 4 - jv) / 4
          } else {
            const fv = stops[jv % stops.length] + Math.floor(jv / stops.length)
            y = -L / 2 + (fv / blocksAlong) * L
          }
          const fa = fu % 1
          const fb = jv >= 0 && jv <= blocksAlong * stops.length ? stops[jv % stops.length] : 0
          const rr = r - 0.005 + 0.005 * prof(fa) * prof(fb)
          const inner = r * 0.66
          const rad = inner + (rr - inner) * edge
          t.set(Math.sin(a) * rad, y, Math.cos(a) * rad)
        },
        { closeU: true, uvFn: (u, v) => [u * 2 * Math.PI * r, v * L] },
      )
    })
    const shell = collide(mesh(geo, M.foam()), { kind: 'cylinder', axis: 'y', c: [0, 0, 0], r, h: L })
    const boreMat = lazyMat('rollerBore', () => std({ color: 0x3c3d41, roughness: 0.82, metalness: 0 }))
    const core = r * 0.66
    const coreTube = lathe([[core, L / 2 + 0.0015], [core - 0.006, L / 2 + 0.0015, 0.0012], [core - 0.006, -L / 2 - 0.0015, 0.0012], [core, -L / 2 - 0.0015]], boreMat, null, 'y', { seg: 56, steps: 2 })
    body = group(shell, coreTube)
  } else {
    const f = 0.009
    body = group(collide(lathe([[0, -L / 2], [r, -L / 2, f], [r, L / 2, f], [0, L / 2]], M.foam(), null, 'y', { seg: 72, steps: 5 }), { kind: 'cylinder', axis: 'y', c: [0, 0, 0], r, h: L }))
  }
  const turn = group(body)
  // The body's axis is Y; it must lie along X and spin around that.
  body.rotation.z = -Math.PI / 2
  turn.rotation.x = Math.round(spin * 200) / 200
  turn.position.y = r
  return group(turn, contactShadow(L * 1.06, r * 1.5, 0.75))
}

function yogaBlock(p) {
  const orient = p.orient ?? 'flat'
  const [w, h, d] = orient === 'tall' ? [0.15, 0.23, 0.1] : orient === 'side' ? [0.1, 0.15, 0.23] : [0.15, 0.1, 0.23]
  return group(soft(w, h, d, M.foam(), [0, h / 2, 0], { r: 0.012, flat: 4, corner: 3 }))
}

function kneePad(p) {
  const w = p.width ?? 0.42
  const d = p.depth ?? 0.21
  const t = p.thickness ?? 0.035
  return group(soft(w, t, d, M.foam(), [0, t / 2, 0], { r: 0.012, crown: 0.002, flat: 10, corner: 3 }))
}

// ---------------------------------------------------------------------------------------------------------------------- ab wheel

function abWheelWheel(r) {
  // Side rims with spokes, a rubber tyre with a lugged tread, a hub.
  const tyreW = 0.056
  const rimR = r - 0.017
  const key = K('abtyre', r)
  const tyre = memoGeo(key, () => {
    const nu = 300
    const nv = 44
    return gridGeo(
      nu,
      nv,
      (u, v, t) => {
        const a = u * Math.PI * 2
        // v walks the section of the tyre: inside face, side, tread, side, inside face.
        const s = v * 4
        let x
        let rr
        const hw = tyreW / 2
        if (s < 1) {
          x = -hw + 0.001
          rr = rimR + (r - 0.006 - rimR) * s
        } else if (s < 1.25) {
          const q = (s - 1) / 0.25
          x = -hw + 0.001 * (1 - q) + 0.006 * (1 - Math.cos((q * Math.PI) / 2))
          rr = r - 0.006 + 0.006 * Math.sin((q * Math.PI) / 2)
        } else if (s < 2.75) {
          const q = (s - 1.25) / 1.5
          x = -hw + 0.006 + (tyreW - 0.012) * q
          const cx = Math.abs((x / (hw - 0.006)) * 1)
          // Crowned tread with transverse lugs and a centre rib.
          const lugs = smooth(0.26, 0.36, Math.abs(((a * 22) / (Math.PI * 2)) % 1 - 0.5))
          const rib = smooth(0.1, 0.16, Math.abs(cx))
          rr = r - 0.0012 * cx * cx - 0.002 * (1 - lugs) * rib
        } else if (s < 3) {
          const q = (s - 2.75) / 0.25
          x = hw - 0.006 + 0.006 * Math.sin((q * Math.PI) / 2) - 0.001 * q * q
          rr = r - 0.006 * (1 - Math.cos((q * Math.PI) / 2))
        } else {
          const q = s - 3
          x = hw - 0.001
          rr = r - 0.006 + (rimR - (r - 0.006)) * q
        }
        t.set(x, Math.cos(a) * rr, Math.sin(a) * rr)
      },
      { closeU: true },
    )
  })
  // A disc with six windows, one extrusion for each side of the wheel.
  const disc = memoGeo(K('abdisc', r), () => {
    const R = rimR + 0.001
    const shape = new THREE.Shape()
    shape.absarc(0, 0, R, 0, Math.PI * 2, false)
    const windows = 6
    for (let i = 0; i < windows; i++) {
      const a0 = ((i + 0.17) / windows) * Math.PI * 2
      const a1 = ((i + 0.83) / windows) * Math.PI * 2
      const r0 = 0.03
      const r1 = R - 0.012
      const h = new THREE.Path()
      h.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0)
      h.lineTo(Math.cos(a0) * r1, Math.sin(a0) * r1)
      h.absarc(0, 0, r1, a0, a1, false)
      h.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0)
      h.closePath()
      shape.holes.push(h)
    }
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0012, bevelSegments: 2, curveSegments: 18 })
    g.rotateY(Math.PI / 2)
    g.translate(-0.002, 0, 0)
    return g
  })
  const hubProfile = [[0, -0.031], [0.012, -0.031, 0.002], [0.016, -0.027, 0.002], [0.02, -0.027, 0.002], [0.02, 0.027, 0.002], [0.016, 0.027, 0.002], [0.012, 0.031, 0.002], [0, 0.031]]
  return group(
    mesh(tyre, M.rubberRibbed()),
    mesh(disc, M.plasticLight(), [-0.018, 0, 0]),
    mesh(disc, M.plasticLight(), [0.018, 0, 0]),
    // Between the discs, a dark inner drum closes the wheel where the spokes leave it open.
    lathe(hubProfile, M.plastic(), null, 'x', { seg: 32 }),
  )
}

function abWheel(p, ctx) {
  const r = p.radius ?? 0.09
  let c
  let axis
  let span = p.span ?? 0.23
  if (ctx && p.hands) {
    const L = vec(ctx.hands.L.centre)
    const R = vec(ctx.hands.R.centre)
    c = L.clone().lerp(R, 0.5)
    axis = L.clone().sub(R)
    // To the millimetre: its parts are cached by size.
    span = Math.round(axis.length() * 1000) / 1000
    axis.normalize()
    c.y = r
  } else {
    c = new V3(0, r, 0)
    axis = new V3(1, 0, 0)
  }
  // Rolling direction is across the axle; the wheel turns by distance over radius.
  const fwd = new V3(0, 1, 0).cross(axis).normalize()
  const spin = (c.x * fwd.x + c.z * fwd.z) / r + (p.spin ?? 0) * D2R
  const wheel = abWheelWheel(r)
  wheel.rotation.x = Math.round(spin * 500) / 500
  const axleEnd = span / 2 + 0.058
  const parts = [
    wheel,
    cyl(0.0065, axleEnd * 2 - 0.01, mat.steel, [0, 0, 0], 'x', { seg: 20 }),
    lathe([[0, -0.003], [0.013, -0.003, 0.0015], [0.013, 0.003, 0.0015], [0, 0.003]], mat.chrome, [0.038, 0, 0], 'x', { seg: 24 }),
    lathe([[0, -0.003], [0.013, -0.003, 0.0015], [0.013, 0.003, 0.0015], [0, 0.003]], mat.chrome, [-0.038, 0, 0], 'x', { seg: 24 }),
  ]
  // Handles: rubber sleeve with rings, a flange on the inside, a cap at the end.
  const handleLen = 0.11
  const sleeve = []
  const n = 7
  sleeve.push([0, -handleLen / 2 - 0.006], [0.0205, -handleLen / 2 - 0.006, 0.002], [0.0205, -handleLen / 2 - 0.002, 0.002], [0.0165, -handleLen / 2, 0.002])
  for (let i = 0; i < n; i++) {
    const y0 = -handleLen / 2 + 0.004 + ((handleLen - 0.008) * i) / n
    const y1 = -handleLen / 2 + 0.004 + ((handleLen - 0.008) * (i + 1)) / n
    sleeve.push([0.0165, y0 + 0.001, 0.001], [0.0172, (y0 + y1) / 2, 0.002], [0.0165, y1 - 0.001, 0.001])
  }
  sleeve.push([0.0165, handleLen / 2, 0.002], [0.0205, handleLen / 2 + 0.002, 0.002], [0.0205, handleLen / 2 + 0.006, 0.002], [0, handleLen / 2 + 0.006])
  for (const s of [1, -1]) parts.push(lathe(sleeve, M.rubberRibbed(), [(s * span) / 2, 0, 0], 'x', { seg: 28, steps: 2 }))
  const g = group(parts)
  g.position.copy(c)
  if (ctx && p.hands) {
    g.quaternion.setFromUnitVectors(new V3(1, 0, 0), axis)
    const o = group(g, contactShadow(0.16, 0.24, 0.8, c.x, c.z))
    o.userData.world = true
    return o
  }
  return group(g, contactShadow(0.16, 0.24, 0.8))
}

// -------------------------------------------------------------------------------------------------------------------- balance board

const BOARD = { pivot: 0.11, capH: 0.07, deckTop: 0.09, deckT: 0.02, maxTilt: 16 }

function balanceBoard(p, ctx) {
  const style = p.style ?? 'wobble'
  const r = p.radius ?? 0.23
  const { pivot, capH, deckTop, deckT, maxTilt } = BOARD
  let tx = (p.tilt && p.tilt[0]) || 0
  let tz = (p.tilt && p.tilt[1]) || 0
  let cx = 0
  let cz = 0
  let world = false
  if (ctx && p.feet) {
    const L = vec(ctx.feet.L.sole)
    const R = vec(ctx.feet.R.sole)
    const m = L.clone().lerp(R, 0.5)
    const across = Math.hypot(L.x - R.x, L.z - R.z) || 1
    tz = Math.atan2(R.y - L.y, across) / D2R
    const fL = vec(ctx.feet.L.forward)
    const fR = vec(ctx.feet.R.forward)
    tx = -Math.asin(clamp((fL.y + fR.y) / 2, -1, 1)) / D2R
    cx = m.x
    cz = m.z
    world = true
  }
  tx = clamp(tx, -maxTilt, maxTilt)
  tz = clamp(tz, -maxTilt, maxTilt)
  // Deck.
  const deck = []
  if (style === 'rocker') {
    const w = p.width ?? 0.56
    const d = p.depth ?? 0.34
    deck.push(soft(w, deckT - 0.003, d, M.woodPale(), [0, deckTop - deckT / 2 - 0.0015, 0], { r: 0.006, flat: 6, corner: 2 }))
    deck.push(soft(w - 0.01, 0.0035, d - 0.01, M.rubberRibbed(), [0, deckTop - 0.0015, 0], { r: 0.0016, flat: 3, corner: 2 }))
    // The rocker: a half-round, its axis along Z, so the deck tips from side to side.
    const geo = memoGeo(K('rocker', d), () => {
      const half = Math.sqrt(2 * pivot * capH - capH * capH)
      const a0 = Math.asin(half / pivot)
      const shape = new THREE.Shape()
      shape.moveTo(-half, capH)
      shape.absarc(0, pivot, pivot, -Math.PI / 2 - a0, -Math.PI / 2 + a0, false)
      shape.lineTo(half, capH)
      shape.closePath()
      const g = new THREE.ExtrudeGeometry(shape, { depth: d - 0.06, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.0035, bevelSegments: 2, curveSegments: 32 })
      g.translate(0, 0, -(d - 0.06) / 2)
      return g
    })
    deck.push(mesh(geo, M.plastic()))
  } else {
    // A plywood disc with a rubber top and a lathe-turned pivot under it.
    const deckBottom = deckTop - deckT
    const edge = [
      [0, deckBottom],
      [r - 0.004, deckBottom, 0.003],
      [r, deckBottom + 0.004, 0.003],
      [r, deckTop - 0.0045, 0.002],
      [r - 0.005, deckTop - 0.0035],
    ]
    deck.push(lathe(edge, M.ply(), null, 'y', { seg: 96, steps: 3 }))
    // Plywood layers on the edge: two fine dark lines.
    for (const f of [0.34, 0.67]) deck.push(torus(r + 0.0001, 0.0006, mat.iron, [0, deckBottom + deckT * f, 0], 'y', 96))
    const top = [
      [r - 0.006, deckTop - 0.004],
      [r - 0.008, deckTop, 0.0015],
      [r * 0.72 + 0.003, deckTop],
      [r * 0.72 + 0.002, deckTop - 0.0012, 0.0004],
      [r * 0.72 - 0.002, deckTop - 0.0012, 0.0004],
      [r * 0.72 - 0.003, deckTop],
      [0, deckTop],
    ]
    deck.push(mesh(revolveGeo(top, { seg: 96, steps: 2 }), M.rubberRibbed()))
    // Pivot: a spherical cap, centre at (0, pivot, 0), touching the floor at y 0.
    const cap = []
    const baseR = Math.sqrt(2 * pivot * capH - capH * capH)
    const n = 24
    for (let i = 0; i <= n; i++) {
      const y = (i / n) * capH
      cap.push([i === 0 ? 0 : Math.sqrt(Math.max(0, pivot * pivot - (pivot - y) * (pivot - y))), y])
    }
    deck.push(mesh(revolveGeo(cap, { seg: 72 }), M.plastic()))
    deck.push(lathe([[baseR, capH - 0.001], [baseR + 0.01, capH - 0.001, 0.002], [baseR + 0.01, capH + 0.004, 0.002], [0, capH + 0.004]], M.plastic(), null, 'y', { seg: 72, steps: 2 }))
  }
  const tilt = group(deck)
  tilt.position.set(0, -pivot, 0)
  const pivotG = group(tilt)
  pivotG.rotation.set(tx * D2R, 0, -tz * D2R)
  // It rolls: the pivot's centre travels by angle times radius, toward the low side. Following the feet, the deck simply stays under them.
  if (world) pivotG.position.set(0, pivot, 0)
  else pivotG.position.set(tz * D2R * pivot, pivot, tx * D2R * pivot)
  const low = contactShadow(0.26, style === 'rocker' ? (p.depth ?? 0.34) * 1.05 : 0.26, 0.75, pivotG.position.x, pivotG.position.z)
  if (world) {
    pivotG.position.x += cx
    pivotG.position.z += cz
    low.position.x += cx
    low.position.z += cz
    const o = group(pivotG, low)
    o.userData.world = true
    return o
  }
  return group(pivotG, low)
}

// ------------------------------------------------------------------------------------------------------------- discs, balls, wedge, platform

function floorUnder(p, ctx) {
  // Where a thing that slides under a hand or foot sits on the floor. Returns [x, z, forwardAngle] or null.
  if (!ctx) return null
  const at = p.at ?? 'sole'
  if (p.foot) {
    const a = footAnchor(ctx, p.foot, at)
    const f = vec(ctx.feet[p.foot].forward)
    return [a.x, a.z, Math.atan2(f.x, f.z)]
  }
  if (p.feet) {
    const a = footAnchor(ctx, 'L', at).lerp(footAnchor(ctx, 'R', at), 0.5)
    return [a.x, a.z, 0]
  }
  if (p.hand) {
    const c = vec(ctx.hands[p.hand].centre)
    return [c.x, c.z, 0]
  }
  if (p.hands) {
    const c = vec(ctx.hands.L.centre).lerp(vec(ctx.hands.R.centre), 0.5)
    return [c.x, c.z, 0]
  }
  return null
}
export { floorUnder }

export function placeOnFloor(g, p, ctx) {
  const u = floorUnder(p, ctx)
  if (!u) return g
  const off = p.offset || [0, 0]
  g.position.set(u[0] + off[0], 0, u[1] + off[1])
  g.rotation.y = u[2] + ((p.yaw || 0) * Math.PI) / 180
  const o = group(g)
  o.userData.world = true
  return o
}

function glidingDisc(p, ctx) {
  const r = p.radius ?? 0.09
  const t = 0.012
  // Hard plastic underside and rim, a foam top with rings.
  const under = [[0, 0.0005], [r - 0.004, 0.0005, 0.001], [r, 0.0035, 0.002], [r, 0.0075, 0.002], [r - 0.004, 0.009]]
  const top = [[r - 0.006, 0.008]]
  const rings = 4
  for (let i = rings; i >= 1; i--) {
    const rr = ((r - 0.012) * i) / rings
    top.push([rr + 0.0015, t], [rr + 0.0008, t - 0.0012, 0.0004], [rr - 0.0008, t - 0.0012, 0.0004], [rr - 0.0015, t])
  }
  top.push([0, t])
  const g = group(lathe(under, M.plasticLight(), null, 'y', { seg: 72, steps: 3 }), lathe(top.reverse(), M.foamDark(), null, 'y', { seg: 72, steps: 2 }))
  return placeOnFloor(g, p, ctx)
}

function massageBall(p, ctx) {
  const spiky = !!p.spiky
  const peanut = !!p.peanut
  const r = p.radius ?? (spiky ? 0.04 : 0.032)
  let g
  if (peanut) {
    const prof = []
    const n = 60
    const L = r * 1.75
    for (let i = 0; i <= n; i++) {
      const a = i / n
      const yy = -L / 2 - r + a * (L + 2 * r)
      const d1 = yy - -L / 2
      const d2 = yy - L / 2
      const q1 = Math.sqrt(Math.max(0, r * r - d1 * d1))
      const q2 = Math.sqrt(Math.max(0, r * r - d2 * d2))
      // A smooth union of two balls.
      const k = r * 0.5
      const h = clamp(0.5 + (0.5 * (q1 - q2)) / k, 0, 1)
      const rad = q2 + (q1 - q2) * h + k * h * (1 - h)
      prof.push([i === 0 || i === n ? 0 : rad, yy])
    }
    g = group(mesh(revolveGeo(prof, { seg: 48 }), M.gym()))
    g.children[0].rotation.z = Math.PI / 2
    g.children[0].position.y = r
  } else if (spiky) {
    const geo = memoGeo(K('spiky', r), () => {
      // Soft knobs on a Fibonacci sphere.
      const dirs = []
      const count = 90
      for (let i = 0; i < count; i++) {
        const y = 1 - (2 * (i + 0.5)) / count
        const rad = Math.sqrt(1 - y * y)
        const a = i * Math.PI * (3 - Math.sqrt(5))
        dirs.push(new V3(Math.cos(a) * rad, y, Math.sin(a) * rad))
      }
      const v = new V3()
      return gridGeo(
        180,
        120,
        (a, b, t) => {
          const phi = a * Math.PI * 2
          const th = b * Math.PI
          v.set(Math.sin(th) * Math.sin(phi), -Math.cos(th), Math.sin(th) * Math.cos(phi))
          let best = -1
          for (const d of dirs) best = Math.max(best, d.dot(v))
          const bump = smooth(0.965, 0.998, best)
          const rr = r * (0.84 + 0.16 * bump)
          t.copy(v).multiplyScalar(rr)
        },
        { closeU: true, uvFn: (a, b) => [a * 0.25, b * 0.12] },
      )
    })
    g = group(mesh(geo, M.gym(), [0, r * 0.98, 0]))
  } else {
    g = group(sphere(r, M.gym(), [0, r, 0], 40))
    // A moulding line around the ball, the only feature a lacrosse ball has.
    const ring = torus(r * 1.0005, 0.00045, M.gymSeam(), [0, r, 0], 'x', 64)
    g.add(ring)
  }
  return placeOnFloor(g, p, ctx)
}

function wedge(p) {
  const style = p.style ?? 'foam'
  const ang = (p.angle ?? 20) * D2R
  const w = p.width ?? 0.6
  const d = p.depth ?? 0.4
  const tan = Math.tan(ang)
  if (style === 'board') {
    // A slant board: a deck on a hinge at the toe end, held up by a strut.
    const low = 0.03
    const thick = 0.022
    const len = d / Math.cos(ang)
    const deck = group(
      soft(w, thick, len, M.woodPale(), [0, -thick / 2 - 0.004, -len / 2], { r: 0.004, flat: 6, corner: 2 }),
      soft(w - 0.012, 0.005, len - 0.012, M.rubber(), [0, -0.0025, -len / 2], { r: 0.0018, flat: 6, corner: 2 }),
    )
    for (let i = 0; i < 7; i++) deck.add(rbox(w - 0.05, 0.0012, 0.008, 0.0005, M.plastic(), [0, 0.0002, -0.05 - (i * (len - 0.1)) / 6], 1))
    deck.position.set(0, low, d / 2)
    deck.rotation.x = ang
    const strutZ = -d / 2 + 0.05
    const strutY = low + (d - 0.05) * tan - thick - 0.004
    const base = group(
      bar([[-w / 2 + 0.035, 0.012, d / 2 - 0.01], [-w / 2 + 0.035, 0.012, -d / 2 + 0.01]], M.paint(), { w: 0.03, d: 0.024, n: 6 }),
      bar([[w / 2 - 0.035, 0.012, d / 2 - 0.01], [w / 2 - 0.035, 0.012, -d / 2 + 0.01]], M.paint(), { w: 0.03, d: 0.024, n: 6 }),
      bar([[-w / 2 + 0.035, 0.012, -d / 2 + 0.03], [w / 2 - 0.035, 0.012, -d / 2 + 0.03]], M.paint(), { w: 0.024, d: 0.024, n: 6 }),
      bar([[-w / 2 + 0.035, 0.012, d / 2 - 0.02], [w / 2 - 0.035, 0.012, d / 2 - 0.02]], M.paint(), { w: 0.024, d: 0.024, n: 6 }),
    )
    for (const s of [-1, 1]) {
      // Strut from the base up to the deck, hinge lugs at the toe, rubber feet.
      base.add(bar([[(s * w) / 2 - s * 0.035, 0.022, strutZ - 0.03], [(s * w) / 2 - s * 0.035, strutY, strutZ + 0.012]], M.paint(), { w: 0.018, d: 0.03, n: 6 }))
      base.add(cyl(0.012, 0.03, mat.steel, [(s * w) / 2 - s * 0.035, low, d / 2 - 0.006], 'x', { seg: 20 }))
      for (const z of [-d / 2 + 0.03, d / 2 - 0.03]) base.add(cyl(0.016, 0.006, mat.rubber, [(s * w) / 2 - s * 0.035, 0.003, z], 'y', { seg: 20 }))
    }
    return group(deck, base)
  }
  // Foam wedge in a vinyl cover: a soft box whose top has been sheared into a slope.
  const low = 0.012
  const H = low + d * tan
  const warp = (v) => {
    const hz = low + (d / 2 - v.z) * tan
    const f = (v.y + H / 2) / H
    v.y = f * hz
  }
  const geo = softBoxGeo(w, H, d, { r: Math.min(0.012, H * 0.3), flat: 14, corner: 3, warp, warpKey: `w${p.angle ?? 20}` })
  const cover = lazyMat('vinyl', () => std({ color: 0x46484d, roughness: 0.72, metalness: 0, bumpMap: tiled(TEX.pits(), 0.02), bumpScale: 0.12 }))
  const g = group(mesh(geo, cover))
  // Welted seams down the long slope edges, as on a real upholstered wedge.
  const inset = 0.006
  for (const s of [-1, 1]) {
    const x = s * (w / 2 - inset)
    g.add(mesh(pipeGeo([[x, low + d * tan - 0.003, -d / 2 + 0.008], [x, low + (d * tan) / 2, 0], [x, low + 0.0015, d / 2 - 0.008]], 0.0018, { seg: 6, tubular: 24 }), mat.iron))
  }
  return g
}

function skippingPlatform(p) {
  const s = p.size ?? 1.0
  const h = p.height ?? 0.03
  const bevel = 0.07
  // A low deck with a bevelled rubber skirt, and a ribbed rubber panel set into its top.
  const ribs = lazyMat('skipRubber', () => {
    const t = dataTex('ribs', 128, (x) => Math.pow(0.5 + 0.5 * Math.cos(x * Math.PI * 2 * 8), 2))
    return std({ color: 0x3a3b40, roughness: 0.74, metalness: 0, bumpMap: tiled(t, 0.12), bumpScale: 1.4 })
  })
  const geo = memoGeo(K('skip', s, h), () => {
    const nu = 48
    const g = (x) => {
      // Rows are packed into the bevel, the top is flat.
      const a = 2 * x - 1
      const q = Math.abs(a)
      const inner = (s / 2 - bevel) / (s / 2)
      const m = q < 0.8 ? (q / 0.8) * inner : inner + ((q - 0.8) / 0.2) * (1 - inner)
      return Math.sign(a) * m
    }
    return gridGeo(
      nu,
      nu,
      (u, v, t) => {
        const a = g(u)
        const b = g(v)
        const d = Math.min((1 - Math.abs(a)) * (s / 2), (1 - Math.abs(b)) * (s / 2))
        t.set((a * s) / 2, (h - 0.0012) * smooth(-0.004, bevel, d), (b * s) / 2)
      },
      { flip: true, uvFn: (u, v) => [g(u) * s * 0.5, g(v) * s * 0.5] },
    )
  })
  const inner = s - 2 * bevel
  const line = lazyMat('skipLine', () => std({ color: 0x7a7c82, roughness: 0.7, metalness: 0 }))
  const q = inner - 0.01
  const g = group(mesh(geo, M.rubber()), soft(inner, 0.003, inner, ribs, [0, h - 0.0015, 0], { r: 0.001, flat: 2, corner: 1 }), contactShadow(s * 1.14, s * 1.14, 0.5))
  // A paler line around the jumping area.
  for (const [x, z, w, d] of [[0, q / 2, q + 0.008, 0.008], [0, -q / 2, q + 0.008, 0.008], [q / 2, 0, 0.008, q], [-q / 2, 0, 0.008, q]]) g.add(box(w, 0.0008, d, line, [x, h + 0.0002, z]))
  return g
}

// ---------------------------------------------------------------------------------------------------------------- wall bars, anchors, post

function wallBars(p) {
  const w = p.width ?? 0.9
  const count = p.rungs ?? 14
  const pitch = p.pitch ?? 0.165
  const H = p.height ?? 2.45
  const wood = M.woodPale()
  const parts = []
  // Stiles: thick boards on edge, rounded, standing clear of the wall.
  for (const s of [-1, 1]) {
    const x = s * (w / 2 + 0.018)
    parts.push(bar([[x, 0, 0], [x, H, 0]], wood, { w: 0.036, d: 0.105, n: 6, up: [0, 0, 1], rings: 1, around: 28, cap: 0.05 }))
    // Bolted steel brackets to the wall, top and bottom.
    for (const y of [0.14, H - 0.16]) {
      parts.push(rbox(0.012, 0.06, 0.09, 0.002, mat.frameLight, [x, y, -0.09]))
      parts.push(rbox(0.05, 0.08, 0.005, 0.002, mat.frameLight, [x, y, -0.128]))
      for (const dy of [-0.024, 0.024]) parts.push(cyl(0.005, 0.005, mat.steel, [x, y + dy, -0.124], 'z', { seg: 12 }))
    }
  }
  for (let i = 0; i < count; i++) {
    const y = 0.2 + i * pitch
    parts.push(bar([[-w / 2 - 0.002, y, 0], [w / 2 + 0.002, y, 0]], wood, { w: 0.03, d: 0.034, n: 2.4, rings: 1, around: 20, cap: 0.05, up: [0, 1, 0] }))
    for (const s of [-1, 1]) parts.push(cyl(0.0055, 0.002, mat.steel, [s * (w / 2 + 0.037), y, 0], 'x', { seg: 12 }))
  }
  // The pull-up rung stands off the top on welded steel brackets: a straight arm, a diagonal brace, a plate bolted to each stile.
  const ry = H - 0.06
  for (const sd of [-1, 1]) {
    const x = sd * (w / 2 + 0.018)
    const steel = M.paint()
    parts.push(bar([[x, ry, 0.04], [x, ry, 0.178]], steel, { w: 0.02, d: 0.024, n: 4, cap: 0.05 }))
    parts.push(bar([[x, ry - 0.2, 0.05], [x, ry - 0.012, 0.165]], steel, { w: 0.018, d: 0.02, n: 4, up: [0, 0, 1], cap: 0.05 }))
    parts.push(soft(0.042, 0.27, 0.006, steel, [x, ry - 0.1, 0.055], { r: 0.002, flat: 2, corner: 1 }))
    for (const dy of [-0.2, -0.1, 0]) parts.push(cyl(0.0055, 0.004, mat.steel, [x, ry + dy + 0.002, 0.059], 'z', { seg: 12 }))
  }
  parts.push(cyl(0.016, w + 0.04, mat.steel, [0, ry, 0.17], 'x', { seg: 24 }))
  // Lacquered caps on top of the stiles.
  if (p.wall !== false) {
    const wp = box(p.wallWidth ?? 6, 3.2, 0.08, M.wallPaint(), [0, 1.6, -0.17])
    wp.userData.frameIgnore = true
    parts.push(wp)
  }
  return group(parts)
}

function plateBolts(hw, hh, z, m = mat.steel) {
  const out = []
  for (const x of [-hw, hw]) for (const y of [-hh, hh]) out.push(lathe([[0, 0], [0.0062, 0, 0.0008], [0.0062, 0.002, 0.0012], [0.003, 0.0034, 0.001], [0, 0.0034]], m, [x, y, z], 'z', { seg: 16, steps: 2 }))
  return out
}

function wallAnchor(p) {
  const y = p.height ?? 1.1
  if (p.floor) {
    // Plate on the floor, ring up.
    const plate = soft(0.11, 0.008, 0.11, mat.frameLight, [0, 0.004, 0], { r: 0.003, flat: 2, corner: 2 })
    const bolts = []
    for (const x of [-0.042, 0.042]) for (const z of [-0.042, 0.042]) bolts.push(lathe([[0, 0], [0.0062, 0, 0.0008], [0.0062, 0.002, 0.0012], [0.003, 0.0034, 0.001], [0, 0.0034]], mat.steel, [x, 0.008, z], 'y', { seg: 16, steps: 2 }))
    const eye = lathe([[0, 0], [0.012, 0, 0.002], [0.012, 0.012, 0.003], [0, 0.012]], mat.steel, [0, 0.008, 0], 'y', { seg: 24, steps: 2 })
    const ring = torus(0.022, 0.0042, mat.chrome, [0, 0.044, 0], 'z', 40)
    return group(plate, bolts, eye, ring)
  }
  const parts = [
    soft(0.08, 0.12, 0.008, mat.frameLight, [0, y, 0.004], { r: 0.003, flat: 2, corner: 2 }),
    ...plateBolts(0.028, 0.044, 0.008),
    // A lug with a pin, and a swinging D-ring in it.
    soft(0.03, 0.026, 0.02, mat.steel, [0, y, 0.016], { r: 0.004, flat: 2, corner: 2 }),
    cyl(0.004, 0.038, mat.chrome, [0, y, 0.022], 'x', { seg: 16 }),
    torus(0.021, 0.0042, mat.chrome, [0, y - 0.003, 0.04], 'x', 40),
  ]
  if (p.wall) {
    const wp = box(p.wallWidth ?? 6, 3.2, 0.08, M.wallPaint(), [0, 1.6, -0.04])
    wp.userData.frameIgnore = true
    parts.push(wp)
  }
  return group(parts)
}

function anchorPost(p) {
  const H = p.height ?? 2.2
  const y = p.bandY ?? 1.1
  const s = 0.075
  const paint = M.paint()
  const parts = [bar([[0, 0.012, 0], [0, H, 0]], paint, { w: s, d: s, n: 10, up: [0, 0, 1], rings: 1, around: 36, cap: 0.05 })]
  // Holes on two faces every 5 cm, like a rack upright.
  const holeM = mat.iron
  for (let hy = 0.3; hy < H - 0.1; hy += 0.1) {
    for (const [px, pz, ax] of [[0, s / 2, 'z'], [s / 2, 0, 'x']]) parts.push(cyl(0.0085, 0.0014, holeM, [px, hy, pz], ax, { seg: 18 }))
  }
  // Base plate with bolts, and a welded top cap.
  parts.push(soft(0.2, 0.012, 0.2, mat.frameLight, [0, 0.006, 0], { r: 0.003, flat: 2, corner: 2 }))
  for (const x of [-0.078, 0.078]) for (const z of [-0.078, 0.078]) parts.push(lathe([[0, 0], [0.009, 0, 0.001], [0.009, 0.004, 0.002], [0.004, 0.007, 0.002], [0, 0.007]], mat.steel, [x, 0.012, z], 'y', { seg: 18, steps: 2 }))
  parts.push(soft(s + 0.006, 0.008, s + 0.006, mat.frame, [0, H + 0.002, 0], { r: 0.003, flat: 2, corner: 2 }))
  if (p.band !== false) {
    // A resistance band choked around the post: a flat loop hard against the steel, pulled through itself at the front.
    const q = s / 2 + 0.0025
    const loop = roundRectPath(q * 2, q * 2, 0.008, y)
    const curve = new THREE.CatmullRomCurve3(loop.map((a) => vec(a)), true, 'centripetal')
    const pts = curve.getSpacedPoints(90)
    const T = pts.map((_, i) => pts[(i + 1) % pts.length].clone().sub(pts[(i - 1 + pts.length) % pts.length]).normalize())
    const upV = new V3(0, 1, 0)
    const N = pts.map((_, i) => upV.clone().cross(T[i]).normalize())
    const B = pts.map((_, i) => T[i].clone().cross(N[i]).normalize())
    parts.push(mesh(memoGeo(K('post-band', s, y), () => strapGeo(pts, { N, B }, 0.022, 0.0036, { around: 12 }, true)), M.bandLoop()))
    parts.push(soft(0.03, 0.026, 0.012, M.bandLoop(), [0, y, q + 0.006], { r: 0.0045, flat: 2, corner: 2 }))
    parts.push(bar([[0, y, q + 0.006], [0, y, q + 0.024]], M.bandLoop(), { w: 0.022, d: 0.0045, n: 4 }))
  }
  return group(parts)
}

// --------------------------------------------------------------------------------------------------------------------------- parallettes

function parallettes(p) {
  const H = p.height ?? 0.2
  const spread = p.spread ?? 0.42
  const L = p.length ?? 0.36
  const r = 0.016
  const parts = []
  for (const s of [-1, 1]) {
    const x = (s * spread) / 2
    // One bent tube: foot, leg, bend, grip, bend, leg, foot.
    const hz = L / 2
    const bendR = 0.045
    const tube = [
      [x, 0.018, hz + 0.0],
      [x, H - bendR, hz],
      [x, H - bendR * 0.29, hz - bendR * 0.29],
      [x, H, hz - bendR],
      [x, H, 0],
      [x, H, -hz + bendR],
      [x, H - bendR * 0.29, -hz + bendR * 0.29],
      [x, H - bendR, -hz],
      [x, 0.018, -hz],
    ]
    parts.push(mesh(pipeGeo(tube, r, { seg: 16, tubular: 72 }), mat.steel))
    // Cross feet with rubber caps, so it stands square.
    for (const z of [-hz, hz]) {
      parts.push(bar([[x - 0.09, 0.018, z], [x + 0.09, 0.018, z]], M.paint(), { w: 0.03, d: 0.03, n: 6, up: [0, 1, 0] }))
      for (const e of [-1, 1]) parts.push(soft(0.024, 0.012, 0.036, M.rubberRibbed(), [x + e * 0.082, 0.006, z], { r: 0.004, flat: 2, corner: 2 }))
      parts.push(lathe([[r + 0.004, 0.03], [r + 0.0005, 0.04, 0.001]], mat.frame, [x, 0, z], 'y', { seg: 24 }))
    }
  }
  return group(parts)
}

// ------------------------------------------------------------------------------------------------------------------ terrain and cushions

function trailSlope(p) {
  const deg = p.angle ?? 8
  const L = p.length ?? 3.4
  const tan = Math.tan(deg * D2R)
  // A ridge of rising ground: it meets the floor at the low end and on both sides, so it is never a floating slab. Lit like the floor and without shine,
  // it fades into the background colour at its edges.
  const ground = lazyMat('trailGround', () => {
    const m = new THREE.MeshLambertMaterial({ color: 0x8e9095, vertexColors: true, bumpMap: tiled(TEX.pits(), 0.09), bumpScale: 2.4 })
    m.emissive = new THREE.Color(0x0b0b0c)
    return m
  })
  const halfW = p.width ?? 2.6
  const geo = memoGeo(K('trail', deg, L, halfW), () => {
    const zEnd = L / 2 + 0.8
    return gridGeo(
      96,
      120,
      (u, v, t) => {
        const x = (u - 0.5) * 2 * halfW
        const z = -L / 2 + v * (L + 0.8)
        const wander = 0.04 * Math.sin(z * 1.7)
        const side = smooth(0.16, 0.5, Math.abs(x + wander))
        const lumps = (noise2(x * 5.5 + 3, z * 5.5, 41) - 0.5) * 0.05 + (noise2(x * 17, z * 17, 42) - 0.5) * 0.012
        const rise = Math.max(0, (Math.min(z, L / 2) + L / 2) * tan)
        const crest = smooth(zEnd, L / 2, z)
        const fall = smooth(halfW, 0.75, Math.abs(x))
        const y = (rise + lumps * (0.14 + 0.86 * side) + 0.02 * side) * crest * fall
        t.set(x, Math.max(0, y), z)
      },
      {
        flip: true,
        uvFn: (u, v) => [(u - 0.5) * 2 * halfW, v * (L + 0.8)],
        colorFn: (u, v) => {
          const x = (u - 0.5) * 2 * halfW
          const z = -L / 2 + v * (L + 0.8)
          const wander = 0.04 * Math.sin(z * 1.7)
          const pathW = 0.3 + 0.05 * Math.sin(z * 1.7)
          const onPath = smooth(pathW + 0.1, pathW - 0.06, Math.abs(x + wander))
          // Brightest around the figure, like the floor's pool of light.
          const fade = smooth(0, 1.2, halfW - Math.abs(x)) * smooth(0, 0.9, L / 2 + 0.8 - Math.abs(z - 0.4))
          return fade * (0.3 + 0.7 * onPath) * smooth(2.1, 0.7, Math.hypot(x * 0.8, z))
        },
      },
    )
  })
  const land = mesh(geo, ground)
  land.castShadow = false
  land.userData.frameIgnore = true
  const parts = [land]
  // A few stones beside the path.
  const stone = lazyMat('trailStone', () => std({ color: 0x55575b, roughness: 0.9, metalness: 0, bumpMap: tiled(TEX.pits(), 0.06), bumpScale: 1.4 }))
  const rocks = [[0.5, -0.9, 0.05], [-0.48, -0.5, 0.035], [0.46, 0.15, 0.07], [-0.62, 0.55, 0.05], [0.6, 0.85, 0.04], [-0.42, -1.15, 0.03], [0.38, -0.3, 0.022], [-0.36, 0.95, 0.026]]
  for (const [x, z, r] of rocks) {
    const g = memoGeo(K('rock', r), () => {
      const q = r * 73.1
      return gridGeo(
        24,
        16,
        (a, b, t) => {
          const phi = a * Math.PI * 2
          const th = b * Math.PI
          const d = new V3(Math.sin(th) * Math.sin(phi), -Math.cos(th), Math.sin(th) * Math.cos(phi))
          const k = 0.72 + 0.5 * noise2(d.x * 2.1 + q, d.z * 2.1 + d.y * 1.7, 43)
          t.copy(d).multiplyScalar(r * k)
          t.y *= 0.62
        },
        { closeU: true, uvFn: (a, b) => [a * 0.3, b * 0.2] },
      )
    })
    parts.push(mesh(g, stone, [x, (z + L / 2) * tan + r * 0.3 + 0.012, z]))
  }
  return group(parts)
}

function cushion(p) {
  const w = p.width ?? 0.45
  const d = p.depth ?? 0.45
  const t = p.thickness ?? 0.11
  return group(
    soft(w, t, d, M.sofaFabric(), [0, t / 2, 0], { r: t * 0.42, crown: t * 0.16, crownSide: t * 0.04, lump: 0.002, seed: 3, flat: 14, corner: 4 }),
    mesh(pipeGeo(roundRectPath(w - 0.002, d - 0.002, 0.05, t * 0.5), 0.0032, { closed: true, seg: 6, tubular: 110 }), M.piping()),
  )
}

// --------------------------------------------------------------------------------------------------------- things held in the hands

/** Point and axis of a rod between hands (or in one hand, along its thumb). */
function rodFrame(p, ctx) {
  if (p.hands) {
    const L = vec(ctx.hands.L.centre)
    const R = vec(ctx.hands.R.centre)
    const axis = L.clone().sub(R)
    const span = axis.length()
    axis.normalize()
    return { c: L.lerp(R, 0.5), axis, span }
  }
  if (p.hand) {
    const h = ctx.hands[p.hand]
    return { c: vec(h.centre), axis: vec(h.thumb).normalize(), span: 0 }
  }
  return null
}
function placeRod(g, f) {
  g.position.copy(f.c)
  g.quaternion.setFromUnitVectors(new V3(1, 0, 0), f.axis)
  const o = group(g)
  o.userData.world = true
  return o
}

function barTest(p, ctx) {
  const r = p.radius ?? 0.014
  const L = p.length ?? 0.5
  const steel = mat.chrome
  const out = []
  const one = (h) => {
    const g = group(cyl(r, L, steel, [0, 0, 0], 'x', { seg: 24 }))
    return placeRod(g, { c: vec(h.centre), axis: vec(h.thumb).normalize() })
  }
  if (ctx && p.hands) out.push(one(ctx.hands.L), one(ctx.hands.R))
  else if (ctx && p.hand) out.push(one(ctx.hands[p.hand]))
  else return group(cyl(r, L, steel, [0, p.y ?? 1, 0], 'x', { seg: 24 }))
  const o = group(out)
  o.userData.world = true
  return o
}

function stick(p, ctx) {
  const r = p.radius ?? 0.0125
  const L = p.length ?? 1.5
  const style = p.style ?? 'wood'
  const parts = []
  if (style === 'bodybar') {
    parts.push(lathe([[0, -L / 2 + 0.04], [r, -L / 2 + 0.04, 0.001], [r, L / 2 - 0.04, 0.001], [0, L / 2 - 0.04]], M.rubberRibbed(), null, 'x', { seg: 24 }))
    for (const s of [-1, 1]) parts.push(lathe([[0, -0.04], [r + 0.006, -0.04, 0.005], [r + 0.006, 0.04, 0.005], [0, 0.04]], M.plasticLight(), [(s * (L - 0.08)) / 2, 0, 0], 'x', { seg: 24, steps: 3 }))
  } else {
    parts.push(bar([[-L / 2, 0, 0], [L / 2, 0, 0]], M.woodPale(), { w: r * 2, d: r * 2, n: 2, around: 20, rings: 1, cap: 0.3 }))
  }
  const g = group(parts)
  if (ctx && (p.hands || p.hand)) {
    const f = rodFrame(p, ctx)
    f.c.addScaledVector(f.axis, p.shift ?? 0)
    return placeRod(g, f)
  }
  g.position.y = p.y ?? r
  if (p.vertical) {
    g.rotation.z = Math.PI / 2
    g.position.y = L / 2
  }
  return group(g)
}

function muscleRoller(p, ctx) {
  const L = p.length ?? 0.5
  const handleLen = 0.105
  const f = ctx && (p.hands || p.hand) ? rodFrame(p, ctx) : null
  let span = L - handleLen
  // To the millimetre: its parts are cached by size.
  if (f && f.span) span = Math.round(f.span * 1000) / 1000
  const parts = []
  // Rigid core, spinning segments between the handles.
  const inner = span - handleLen - 0.012
  parts.push(cyl(0.0052, span, mat.steel, [0, 0, 0], 'x', { seg: 16 }))
  const n = Math.max(3, Math.round(inner / 0.038))
  const seg = inner / n
  for (let i = 0; i < n; i++) {
    const x = -inner / 2 + seg * (i + 0.5)
    parts.push(lathe([[0, -seg / 2 + 0.0015], [0.0115, -seg / 2 + 0.0015, 0.002], [0.0155, -seg * 0.18, 0.006], [0.0155, seg * 0.18, 0.006], [0.0115, seg / 2 - 0.0015, 0.002], [0, seg / 2 - 0.0015]], M.plasticLight(), [x, 0, 0], 'x', { seg: 20, steps: 3 }))
  }
  for (const s of [-1, 1]) {
    const h = handleLen
    parts.push(lathe([[0, -h / 2 - 0.005], [0.019, -h / 2 - 0.005, 0.002], [0.019, -h / 2 - 0.001, 0.002], [0.0155, -h / 2, 0.002], [0.0155, h / 2, 0.002], [0.019, h / 2 + 0.001, 0.002], [0.019, h / 2 + 0.005, 0.002], [0, h / 2 + 0.005]], M.grip(), [(s * span) / 2, 0, 0], 'x', { seg: 24, steps: 2 }))
  }
  const g = group(parts)
  if (f) return placeRod(g, f)
  g.position.y = 0.019
  return group(g)
}

function footRoller(p, ctx) {
  const r = p.radius ?? 0.028
  const L = p.length ?? 0.16
  const wall = 0.003
  const ri = r - wall
  // A section of pipe: the bore is open at both ends.
  const prof = [
    [ri, -L / 2],
    [r, -L / 2, 0.0012],
    [r, L / 2, 0.0012],
    [ri, L / 2, 0.0008],
    [ri, -L / 2, 0.0008],
    [ri + 0.0002, -L / 2],
  ]
  const u = floorUnder(p, ctx)
  const dist = u ? u[1] : p.pos ? p.pos[2] : 0
  const body = lathe(prof, M.pvc(), null, 'x', { seg: 40, steps: 2 })
  const spinner = group(body)
  spinner.rotation.x = Math.round((dist / r) * 200) / 200
  spinner.position.y = r
  const g = group(spinner)
  return placeOnFloor(g, { ...p, at: p.at ?? 0.5 }, ctx)
}

// ---------------------------------------------------------------------------------------------------------------- belts around the body

/** A flat strap through a smooth path. Section width across `across` at the start index. */
export function strapGeo(pts, frames, width, thick, { around = 14, widthAt = null } = {}, keep = false) {
  const { N, B } = frames
  const m = pts.length
  const S = [0]
  for (let i = 1; i < m; i++) S.push(S[i - 1] + pts[i].distanceTo(pts[i - 1]))
  const g = gridGeo(
    around,
    m - 1,
    (u, v, t) => {
      const i = Math.round(v * (m - 1))
      const q = u * Math.PI * 2
      const a = sgnpow(Math.cos(q), 0.5) * (widthAt ? widthAt(i) : width) * 0.5
      const b = sgnpow(Math.sin(q), 0.8) * thick * 0.5
      t.copy(pts[i]).addScaledVector(B[i], a).addScaledVector(N[i], b)
    },
    { closeU: true, uvFn: (u, v) => [S[Math.round(v * (m - 1))], u * width * 2] },
  )
  return keep ? g : dynamicGeo(g)
}

function stretchStrap(p, ctx) {
  if (!ctx) return group()
  const width = p.width ?? 0.038
  const side = p.foot || 'L'
  const hasTwo = !!p.hands
  const startH = hasTwo ? ctx.hands.L : ctx.hands[p.hand || (side === 'L' ? 'R' : 'L')]
  const endH = hasTwo ? ctx.hands.R : startH
  const a = vec(startH.centre)
  const wrap = aroundFoot(ctx, side, { at: p.at ?? (p.over ? 0.45 : 0.72), halfWidth: 0.05, clear: 0.004, rise: 0.04, over: !!p.over }, a)
  const e = vec(endH.centre)
  // In one hand the two strands arrive side by side; in two, one to each.
  const ctrl = [a, ...wrap.points, hasTwo ? e : e.clone().add(new V3(0.004, 0.004, 0.004))]
  const { pts } = samplePath(ctrl, 0.006)
  // Start the frames at the sole, where the strap lies flat against it.
  let from = 0
  let best = Infinity
  pts.forEach((q, i) => {
    const d = q.distanceTo(wrap.mid)
    if (d < best) {
      best = d
      from = i
    }
  })
  const frames = transportFrames(pts, wrap.normal, from)
  const parts = [noCollide(mesh(strapGeo(pts, frames, width, 0.0028), M.webbing()))]
  // A steel D-ring buckle just past the hand, where the real strap closes.
  const toFoot = pts[Math.min(pts.length - 1, 20)].clone().sub(pts[0]).normalize()
  const buckle = noCollide(torus(0.022, 0.0028, mat.chrome, null, 'z', 32))
  buckle.position.copy(pts[0]).addScaledVector(toFoot, 0.09)
  buckle.quaternion.setFromUnitVectors(new V3(0, 0, 1), toFoot)
  parts.push(buckle)
  // Tails past the hands.
  const tail = (h, dir) => {
    const c = vec(h.centre)
    const thumb = vec(h.thumb).normalize()
    const s = thumb.dot(dir) >= 0 ? 1 : -1
    const q = [c, c.clone().addScaledVector(thumb, s * 0.05), c.clone().addScaledVector(thumb, s * 0.1).add(new V3(0, -0.04, 0)), c.clone().addScaledVector(thumb, s * 0.12).add(new V3(0, -0.14, 0))]
    const smp = samplePath(q, 0.008)
    const fr = transportFrames(smp.pts, vec(h.palm), 0)
    return noCollide(mesh(strapGeo(smp.pts, fr, width, 0.0028), M.webbing()))
  }
  parts.push(tail(startH, toFoot.clone().negate()))
  if (hasTwo) parts.push(tail(endH, pts[pts.length - 1].clone().sub(pts[pts.length - 12]).normalize()))
  const o = group(parts)
  o.userData.world = true
  return o
}

// A nylon dip belt worn at the top of the hips, in the pelvis frame. Outline of the figure's waist in the rest pose: radius from (0, z = -0.01), every 15 degrees from the belly round to the spine.
const WAIST = { y: 0.066, z: -0.01, front: 0.016, r: [0.148, 0.155, 0.166, 0.178, 0.18, 0.172, 0.16, 0.152, 0.13, 0.108, 0.096, 0.09, 0.088], clear: 0.006 }
const waistAt = (t) => {
  const a = Math.abs(((t + Math.PI) % (Math.PI * 2)) - Math.PI)
  const f = (a / Math.PI) * (WAIST.r.length - 1)
  const i = Math.min(WAIST.r.length - 2, Math.floor(f))
  return WAIST.r[i] + (WAIST.r[i + 1] - WAIST.r[i]) * (f - i) + WAIST.clear
}

function ironPlate(R, t, hole = 0.0255) {
  const rim = 0.009
  return lathe(
    [
      [hole, -t / 2],
      [R * 0.3, -t / 2, 0.002],
      [R * 0.42, -t / 2 + 0.004, 0.002],
      [R - rim - 0.008, -t / 2 + 0.004, 0.002],
      [R - rim, -t / 2, 0.002],
      [R, -t / 2 + 0.003, 0.003],
      [R, t / 2 - 0.003, 0.003],
      [R - rim, t / 2, 0.002],
      [R - rim - 0.008, t / 2 - 0.004, 0.002],
      [R * 0.42, t / 2 - 0.004, 0.002],
      [R * 0.3, t / 2, 0.002],
      [hole, t / 2, 0.001],
      [hole, -t / 2, 0.001],
    ],
    mat.iron,
    null,
    'z',
    { seg: 72, steps: 2 },
  )
}

const PLATE_SIZE = { 25: [0.225, 0.052], 20: [0.225, 0.045], 15: [0.195, 0.04], 10: [0.163, 0.035], 5: [0.115, 0.03], 2.5: [0.095, 0.022] }

function dipBelt(p, ctx) {
  if (!ctx) return group()
  const f = ctx.frames.pelvis
  const q = new THREE.Quaternion(f.quat[0], f.quat[1], f.quat[2], f.quat[3])
  const o = vec(f.pos)
  const local = (x, y, z) => new V3(x, y, z).applyQuaternion(q).add(o)
  const { y, z: zc, front: drop } = WAIST
  const ring = []
  const n = 48
  // Around the waist, a little lower at the front, as a loaded belt sits.
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    const rr = waistAt(t)
    ring.push(local(Math.sin(t) * rr, y - drop * Math.max(0, Math.cos(t)), zc + Math.cos(t) * rr))
  }
  const up = new V3(0, 1, 0).applyQuaternion(q)
  const curve = new THREE.CatmullRomCurve3(ring, true, 'centripetal')
  const pts = curve.getSpacedPoints(120)
  const T = pts.map((_, i) => pts[(i + 1) % pts.length].clone().sub(pts[(i - 1 + pts.length) % pts.length]).normalize())
  const N = pts.map((_, i) => up.clone().cross(T[i]).normalize())
  const B = pts.map((_, i) => T[i].clone().cross(N[i]).normalize())
  // Wide and padded at the back, down to a narrow strap at the front, like the real ones.
  const pointsCount = pts.length
  const widthAt = (i) => 0.04 + 0.055 * smooth(0.28, 0.5, Math.abs(((i / pointsCount + 0.5) % 1) - 0.5))
  const parts = [noCollide(mesh(strapGeo(pts, { N, B }, 0.07, 0.007, { around: 18, widthAt }), M.leather()))]
  // Stitched edges, a little paler than the belt.
  for (const e of [-1, 1]) {
    const line = pts.map((c, i) => c.clone().addScaledVector(B[i], (e * widthAt(i)) / 2 - e * 0.004).addScaledVector(N[i], -0.0038).toArray())
    parts.push(noCollide(mesh(pipeGeo(line.filter((_, i) => i % 2 === 0), 0.001, { closed: true, seg: 5, tubular: 120, dynamic: true }), M.stitch())))
  }
  const onBelt = (t, extra = 0.004) => {
    const rr = waistAt(t) + extra
    return local(Math.sin(t) * rr, y - drop * Math.max(0, Math.cos(t)) - 0.012, zc + Math.cos(t) * rr)
  }
  const front = onBelt(0)
  const frontLeft = onBelt(0.62)
  const frontRight = onBelt(-0.62)
  // Two chain ends meet at a ring; the rest of the chain and the plate hang straight down from it.
  const kg = p.kg ?? 20
  const [R, t] = PLATE_SIZE[kg] || PLATE_SIZE[20]
  const links = (A, Bv, r = 0.0034, l = 0.026) => {
    const d = Bv.clone().sub(A)
    const L = d.length()
    d.normalize()
    const count = Math.max(1, Math.round(L / (l * 0.72)))
    const out = []
    const seen = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d)
    const geo = memoGeo(K('link', r, l), () => {
      const hw = l * 0.28
      const hl = l * 0.5 - hw
      const pts3 = []
      const nn = 20
      for (let i = 0; i < nn; i++) {
        const a3 = (i / nn) * Math.PI * 2
        const sy = Math.sin(a3) >= 0 ? hl : -hl
        pts3.push(new V3(Math.cos(a3) * hw, sy + Math.sin(a3) * hw, 0))
      }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts3, true), 40, r, 8, true)
    })
    for (let i = 0; i < count; i++) {
      const m = noCollide(mesh(geo, mat.steel))
      m.position.copy(A).addScaledVector(d, (i + 0.5) * (L / count))
      m.quaternion.copy(seen).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), i % 2 ? Math.PI / 2 : 0))
      out.push(m)
    }
    return out
  }
  const chainLen = p.chain ?? 0.3
  const hang = front.clone().add(new V3(0, -0.11, 0)).addScaledVector(new V3(0, 0, 1).applyQuaternion(q).setY(0).normalize(), 0.02)
  parts.push(...links(frontLeft, hang), ...links(frontRight, hang))
  const bottom = hang.clone().add(new V3(0, -chainLen, 0))
  parts.push(...links(hang, bottom))
  // Steel fittings where the chain leaves the belt.
  for (const c of [frontLeft, frontRight]) {
    const d = noCollide(torus(0.014, 0.003, mat.chrome, null, 'z', 28))
    d.position.copy(c)
    parts.push(d)
  }
  const carabiner = noCollide(torus(0.016, 0.0034, mat.chrome, null, 'y', 28))
  carabiner.position.copy(hang)
  parts.push(carabiner)
  // The plate hangs by its hole, in the plane the chain and the body's width make.
  const plate = ironPlate(R, t)
  const width = new V3(1, 0, 0).applyQuaternion(q).setY(0).normalize()
  const plateC = bottom.clone().add(new V3(0, -R * 0.9 + 0.02, 0))
  const pg = group(noCollide(plate))
  pg.position.copy(plateC)
  pg.quaternion.setFromUnitVectors(new V3(1, 0, 0), width)
  parts.push(pg)
  const g = group(parts)
  g.userData.world = true
  return g
}

export default {
  'stability-ball': stabilityBall,
  'exercise-ball': stabilityBall,
  bosu,
  'foam-roller': foamRoller,
  'ab-wheel': abWheel,
  'balance-board': balanceBoard,
  'gliding-disc': glidingDisc,
  slider: glidingDisc,
  'massage-ball': massageBall,
  wedge,
  'skipping-platform': skippingPlatform,
  'wall-bars': wallBars,
  'wall-anchor': wallAnchor,
  'anchor-post': anchorPost,
  parallettes,
  'trail-slope': trailSlope,
  cushion,
  'yoga-block': yogaBlock,
  'knee-pad': kneePad,
  'bar-test': barTest,
  stick,
  'muscle-roller': muscleRoller,
  'foot-roller': footRoller,
  'stretch-strap': stretchStrap,
  'dip-belt': dipBelt,
}
