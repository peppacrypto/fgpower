// Shared materials and geometry for the equipment. Metres, Y up, like the rest of the art tooling.
//
// Geometry is cached by its parameters and never disposed, so a builder can run for every frame of a loop without cost.
// Colours follow the dark studio look: equipment reads as graphite, steel and black, never orange (orange means "this
// muscle works"). Anything black needs a rim of light or a lighter edge, or it disappears into the background.
import * as THREE from '../vendor/three.module.js'

const geoCache = new Map()
const cached = (key, make) => {
  let g = geoCache.get(key)
  if (!g) {
    g = make()
    geoCache.set(key, g)
  }
  return g
}

const std = (o) => new THREE.MeshStandardMaterial(o)

export const mat = {
  // Metals: they need the scene's environment map (set up in page.js) to read as metal.
  chrome: std({ color: 0xd8dade, metalness: 1, roughness: 0.16 }),
  steel: std({ color: 0xa9adb3, metalness: 1, roughness: 0.34 }),
  knurl: std({ color: 0x8e9298, metalness: 1, roughness: 0.62 }),
  frame: std({ color: 0x3a3c40, metalness: 0.65, roughness: 0.46 }),
  frameLight: std({ color: 0x5a5d62, metalness: 0.6, roughness: 0.42 }),
  blackSteel: std({ color: 0x1d1e20, metalness: 0.7, roughness: 0.38 }),
  iron: std({ color: 0x2a2b2e, metalness: 0.55, roughness: 0.62 }),
  // Soft goods.
  upholstery: std({ color: 0x232325, metalness: 0, roughness: 0.58 }),
  rubber: std({ color: 0x161617, metalness: 0, roughness: 0.82 }),
  plate: std({ color: 0x19191b, metalness: 0.1, roughness: 0.6 }),
  foam: std({ color: 0x2a2a2d, metalness: 0, roughness: 0.92 }),
  wood: std({ color: 0x4a4038, metalness: 0, roughness: 0.66 }),
  fabric: std({ color: 0x2c2c2f, metalness: 0, roughness: 0.9 }),
  towel: std({ color: 0xc9ccd0, metalness: 0, roughness: 0.96 }),
  wall: std({ color: 0x161618, metalness: 0, roughness: 0.95 }),
  step: std({ color: 0x333336, metalness: 0, roughness: 0.74 }),
  cable: std({ color: 0x0f0f10, metalness: 0.2, roughness: 0.5 }),
  rope: std({ color: 0x8a8d90, metalness: 0, roughness: 0.92 }),
  band: std({ color: 0x4d5056, metalness: 0, roughness: 0.55 }),
  ball: std({ color: 0x38393d, metalness: 0, roughness: 0.5 }),
  white: std({ color: 0xd5d6d8, metalness: 0, roughness: 0.6 }),
}

const AXIS = { x: new THREE.Euler(0, 0, Math.PI / 2), y: new THREE.Euler(0, 0, 0), z: new THREE.Euler(Math.PI / 2, 0, 0) }

function mesh(g, m, pos, rot) {
  const o = new THREE.Mesh(g, m)
  o.castShadow = true
  o.receiveShadow = true
  if (pos) o.position.set(pos[0], pos[1], pos[2])
  if (rot) o.rotation.copy(rot)
  return o
}

/** A box with rounded edges and proper normals, the base of every pad and most frames. Sizes are full lengths. */
function roundedBoxGeometry(w, h, d, r, seg) {
  const rr = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)
  const g = new THREE.BoxGeometry(1, 1, 1, seg * 2 + 1, seg * 2 + 1, seg * 2 + 1)
  const p = g.attributes.position
  const n = g.attributes.normal
  const v = new THREE.Vector3()
  const inner = new THREE.Vector3(w / 2 - rr, h / 2 - rr, d / 2 - rr)
  const a0 = 1 / (seg * 2 + 1)
  // The unit cube's outer `seg` cells on each axis become the rounding; the middle cell is the flat part.
  const curve = (x) => {
    const a = Math.abs(x) * 2
    const t = a <= a0 + 1e-6 ? 0 : (a - a0) / (1 - a0)
    return Math.sign(x) * Math.tan((t * Math.PI) / 4)
  }
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const dir = new THREE.Vector3(curve(v.x), curve(v.y), curve(v.z)).normalize()
    p.setXYZ(i, Math.sign(v.x) * inner.x + dir.x * rr, Math.sign(v.y) * inner.y + dir.y * rr, Math.sign(v.z) * inner.z + dir.z * rr)
    n.setXYZ(i, dir.x, dir.y, dir.z)
  }
  return g
}

export const kit = {
  THREE,
  mat,
  group(...children) {
    const g = new THREE.Group()
    for (const c of children.flat()) if (c) g.add(c)
    return g
  },
  /** Sharp box: only for things that really are sharp. Prefer rbox. */
  box(w, h, d, m, pos) {
    return mesh(cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), m, pos)
  },
  /** Rounded box. r is the corner radius in metres. */
  rbox(w, h, d, r, m, pos, seg = 3) {
    return mesh(cached(`rb${w},${h},${d},${r},${seg}`, () => roundedBoxGeometry(w, h, d, r, seg)), m, pos)
  },
  /** Cylinder along an axis ('x', 'y' or 'z'), centred on pos. r2 makes it a cone. */
  cyl(r, h, m, pos, axis = 'y', { r2 = r, seg = 32, open = false } = {}) {
    return mesh(cached(`c${r},${r2},${h},${seg},${open}`, () => new THREE.CylinderGeometry(r2, r, h, seg, 1, open)), m, pos, AXIS[axis])
  },
  /** A cylinder from point a to point b. Built per call, but cheap: use it for moving links and cables. */
  between(a, b, r, m, seg = 16) {
    const A = new THREE.Vector3(...a)
    const B = new THREE.Vector3(...b)
    const len = A.distanceTo(B) || 1e-4
    const o = mesh(cached(`c${r},${r},1,${seg},false`, () => new THREE.CylinderGeometry(r, r, 1, seg)), m)
    o.scale.set(1, len, 1)
    o.position.copy(A).lerp(B, 0.5)
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize())
    return o
  },
  sphere(r, m, pos, seg = 32) {
    return mesh(cached(`s${r},${seg}`, () => new THREE.SphereGeometry(r, seg, Math.ceil(seg * 0.7))), m, pos)
  },
  /** Surface of revolution: profile is [[radius, y], ...] around the axis. The right tool for plates, knobs, hubs, kettlebells. */
  lathe(profile, m, pos, axis = 'y', seg = 48) {
    const key = `l${JSON.stringify(profile)},${seg}`
    return mesh(cached(key, () => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg)), m, pos, AXIS[axis])
  },
  /** A smooth tube through points: bent frames, handles, ropes, bands. Not cached: don't use it for a static part in a hot loop. */
  tube(points, r, m, { closed = false, seg = 12, tubular = 0, curve = 'catmullrom', tension = 0.5 } = {}) {
    const pts = points.map((p) => new THREE.Vector3(...p))
    const c = new THREE.CatmullRomCurve3(pts, closed, curve, tension)
    const g = new THREE.TubeGeometry(c, tubular || Math.max(24, pts.length * 12), r, seg, closed)
    return mesh(g, m)
  },
  /** A torus, for rings, chain links and collars. */
  torus(R, r, m, pos, axis = 'y', seg = 48) {
    const o = mesh(cached(`t${R},${r},${seg}`, () => new THREE.TorusGeometry(R, r, 16, seg)), m, pos)
    if (axis === 'x') o.rotation.y = Math.PI / 2
    if (axis === 'y') o.rotation.x = Math.PI / 2
    return o
  },
  mesh,
}
