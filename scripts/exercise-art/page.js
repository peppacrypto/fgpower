// Renders exercise specs with three.js. Loaded by render.html, driven by render.mjs.
import * as THREE from './vendor/three.module.js'
import { Body, mixFrames } from './rig.js'
import { makePaint, MUSCLE_NAMES } from './paint.js'

const W = 1600
const H = 1200
// ?look=studio is the dark look: grey body, glowing target muscles, black background, no outlines.
const LOOK = new URLSearchParams(location.search).get('look') || ''
const STUDIO = LOOK === 'studio'
const STYLE = {
  background: 0xf4f6f3,
  skin: new THREE.Color(0xdcd8d0),
  shorts: new THREE.Color(0x7a8681),
  target: new THREE.Color(0x2f9e6a),
  waistY: 0.985,
  hemY: 0.685,
  ink: 0x17201b,
  floorLine: 0xcfd5cf,
  wood: 0xc9b597,
  fabric: 0x8fa39a,
  wall: 0xe8ebe7,
  towel: 0xe2b04a,
  step: 0xb8bfb9,
}

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false })
if (STUDIO) {
  Object.assign(STYLE, {
    background: 0x0b0b0c,
    skin: new THREE.Color(0xb9b9b9),
    shorts: new THREE.Color(0x121213),
    target: new THREE.Color(0xff5a1f),
    muscleEdge: 0.45,
    muscleGlow: 0.32,
    hemY: 0.77,
    ink: 0x000000,
    floorLine: 0x222224,
    wood: 0x3b3b3e,
    fabric: 0x2c2c2f,
    wall: 0x161618,
    towel: 0xc9ccd0,
    muscleFiber: 0.16,
    step: 0x333336,
  })
}
renderer.setPixelRatio(1)
renderer.setSize(W, H)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.outputColorSpace = THREE.SRGBColorSpace
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(STYLE.background)

const gradient = (() => {
  const data = new Uint8Array([120, 195, 255])
  const t = new THREE.DataTexture(data, 3, 1, THREE.RedFormat)
  t.minFilter = THREE.NearestFilter
  t.magFilter = THREE.NearestFilter
  t.needsUpdate = true
  return t
})()

scene.add(STUDIO ? new THREE.HemisphereLight(0xc8ccd2, 0x141416, 0.75) : new THREE.HemisphereLight(0xffffff, 0xd8dcd6, 1.9))
const sun = new THREE.DirectionalLight(0xffffff, STUDIO ? 3.0 : 1.5)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.radius = 7
sun.shadow.bias = -0.0005
sun.shadow.normalBias = 0.02
scene.add(sun)
scene.add(sun.target)

const rim = new THREE.DirectionalLight(0xffffff, 1.6)
if (STUDIO) {
  scene.add(rim)
  scene.add(rim.target)
}
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: STUDIO ? 0.62 : 0.16 }))
// The studio look's floor: a soft pool of light under the figure, fading into the black background.
const pool = (() => {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const x = c.getContext('2d')
  const g = x.createRadialGradient(256, 256, 10, 256, 256, 256)
  g.addColorStop(0, 'rgba(66,66,72,1)')
  g.addColorStop(0.55, 'rgba(34,34,38,0.8)')
  g.addColorStop(1, 'rgba(11,11,12,0)')
  x.fillStyle = g
  x.fillRect(0, 0, 512, 512)
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }))
  m.rotation.x = -Math.PI / 2
  m.position.y = -0.004
  m.renderOrder = -1
  return m
})()
if (STUDIO) scene.add(pool)
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)

const outlineMaterial = (thickness) =>
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { t: { value: thickness }, c: { value: new THREE.Color(STYLE.ink) } },
    vertexShader: `uniform float t; attribute float aInk; void main(){ vec3 p = position + normal * t * aInk; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform vec3 c;
void main(){
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`,
  })

let body
let geom
let bodyMesh
let outlineMesh
let paint
const propsGroup = new THREE.Group()
scene.add(propsGroup)

function toon(color) {
  return new THREE.MeshToonMaterial({ color, gradientMap: gradient })
}

function addBox(group, size, pos, color, rotY = 0, outline = true, thickness = 0.006) {
  const g = new THREE.BoxGeometry(size[0], size[1], size[2])
  const m = new THREE.Mesh(g, toon(color))
  m.position.set(pos[0], pos[1], pos[2])
  m.rotation.y = rotY
  m.castShadow = true
  m.receiveShadow = true
  group.add(m)
  if (outline) {
    const o = new THREE.Mesh(new THREE.BoxGeometry(size[0] + thickness * 2, size[1] + thickness * 2, size[2] + thickness * 2), new THREE.MeshBasicMaterial({ color: STYLE.ink, side: THREE.BackSide }))
    o.position.copy(m.position)
    o.rotation.copy(m.rotation)
    group.add(o)
  }
  return m
}

// Props. `pos` is the point on the floor under the centre; `yaw` turns them. A chair at yaw 0 has its back at -Z and
// its seat front at +Z, so someone sitting on it faces +Z.
const PROPS = {
  chair(p) {
    const g = new THREE.Group()
    const seatH = p.seatH ?? 0.46
    addBox(g, [0.42, 0.035, 0.42], [0, seatH, 0], STYLE.wood)
    for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) addBox(g, [0.035, seatH, 0.035], [x, seatH / 2, z], STYLE.wood)
    addBox(g, [0.035, 0.42, 0.03], [-0.18, seatH + 0.21, -0.19], STYLE.wood)
    addBox(g, [0.035, 0.42, 0.03], [0.18, seatH + 0.21, -0.19], STYLE.wood)
    addBox(g, [0.4, 0.09, 0.025], [0, seatH + 0.36, -0.19], STYLE.wood)
    return g
  },
  sofa(p) {
    const g = new THREE.Group()
    const w = p.width ?? 1.5
    addBox(g, [w, 0.3, 0.72], [0, 0.27, 0], STYLE.fabric)
    addBox(g, [w, 0.46, 0.2], [0, 0.65, -0.3], STYLE.fabric)
    addBox(g, [0.16, 0.34, 0.72], [-w / 2 + 0.08, 0.53, 0], STYLE.fabric)
    addBox(g, [0.16, 0.34, 0.72], [w / 2 - 0.08, 0.53, 0], STYLE.fabric)
    for (const [x, z] of [[-w / 2 + 0.05, -0.32], [w / 2 - 0.05, -0.32], [-w / 2 + 0.05, 0.32], [w / 2 - 0.05, 0.32]]) addBox(g, [0.05, 0.12, 0.05], [x, 0.06, z], STYLE.ink, 0, false)
    return g
  },
  wall(p) {
    const g = new THREE.Group()
    const w = p.width ?? 30
    const h = p.height ?? 3.4
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), new THREE.MeshBasicMaterial({ color: STYLE.wall }))
    m.position.set(0, h / 2, 0)
    g.add(m)
    // Only the skirting line: a wall that runs past the frame needs no outline.
    const line = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, 0.09), new THREE.MeshBasicMaterial({ color: STYLE.floorLine }))
    line.position.set(0, 0.006, 0)
    g.add(line)
    return g
  },
  step(p) {
    const g = new THREE.Group()
    addBox(g, [p.width ?? 0.7, p.height ?? 0.17, p.depth ?? 0.28], [0, (p.height ?? 0.17) / 2, 0], STYLE.step)
    return g
  },
  towel(p) {
    // A flat folded towel lying on the floor.
    const g = new THREE.Group()
    addBox(g, [p.width ?? 0.3, 0.012, p.depth ?? 0.42], [0, 0.006, 0], STYLE.towel, 0, true, 0.004)
    return g
  },
  'towel-strip'(p) {
    // A towel twisted into a rope, for pulling: a straight run from a to b, or through `points`.
    const g = new THREE.Group()
    const pts = (p.points || [p.a, p.b]).map((q) => new THREE.Vector3(...q))
    const r = p.radius ?? 0.022
    const ink = new THREE.MeshBasicMaterial({ color: STYLE.ink, side: THREE.BackSide })
    const body = toon(STYLE.towel)
    const up = new THREE.Vector3(0, 1, 0)
    const addTube = (a, b) => {
      const len = a.distanceTo(b)
      const q = new THREE.Quaternion().setFromUnitVectors(up, b.clone().sub(a).normalize())
      for (const [rad, mat, shadow] of [[r, body, true], [r + 0.0045, ink, false]]) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len, 14, 1, true), mat)
        m.position.copy(a.clone().lerp(b, 0.5))
        m.quaternion.copy(q)
        m.castShadow = shadow
        g.add(m)
      }
    }
    const addBall = (c) => {
      for (const [rad, mat, shadow] of [[r, body, true], [r + 0.0045, ink, false]]) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(rad, 14, 10), mat)
        m.position.copy(c)
        m.castShadow = shadow
        g.add(m)
      }
    }
    for (let i = 0; i + 1 < pts.length; i++) addTube(pts[i], pts[i + 1])
    pts.forEach(addBall)
    return g
  },
  'door-frame'(p) {
    const g = new THREE.Group()
    const w = p.width ?? 0.8
    const h = p.height ?? 2.1
    addBox(g, [0.09, h, 0.14], [-w / 2, h / 2, 0], STYLE.wood)
    addBox(g, [0.09, h, 0.14], [w / 2, h / 2, 0], STYLE.wood)
    addBox(g, [w + 0.09, 0.09, 0.14], [0, h, 0], STYLE.wood)
    return g
  },
  'door-corner'(p) {
    // A masonry wall with a doorway in it, seen from the side of a person who stands along the wall. `pos` is the floor
    // point of the corner to hook. At yaw 0 the wall runs along Z: this segment goes from the corner toward -Z, the opening
    // starts at the corner and continues toward +Z, then the wall carries on. Thickness 0.12, centred on pos.x.
    const g = new THREE.Group()
    const open = p.opening ?? 0.8
    const len = p.length ?? 6
    const h = p.height ?? 3
    const headY = p.headY ?? 2.1
    const flat = new THREE.MeshBasicMaterial({ color: STYLE.wall })
    const ink = new THREE.MeshBasicMaterial({ color: STYLE.ink, side: THREE.BackSide })
    const slab = (size, pos) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...size), flat)
      m.position.set(...pos)
      g.add(m)
      const o = new THREE.Mesh(new THREE.BoxGeometry(size[0] + 0.012, size[1] + 0.012, size[2] + 0.012), ink)
      o.position.set(...pos)
      g.add(o)
    }
    slab([0.12, h, len], [0, h / 2, -len / 2])
    slab([0.12, h, len], [0, h / 2, open + len / 2])
    slab([0.12, h - headY, open], [0, (h + headY) / 2, open / 2])
    return g
  },
  table(p) {
    const g = new THREE.Group()
    const hT = p.height ?? 0.75
    addBox(g, [1.1, 0.04, 0.7], [0, hT, 0], STYLE.wood)
    for (const [x, z] of [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]]) addBox(g, [0.05, hT, 0.05], [x, hT / 2, z], STYLE.wood)
    return g
  },
}

const framePropsGroup = new THREE.Group()
scene.add(framePropsGroup)

function fillProps(group, list) {
  while (group.children.length) group.remove(group.children[0])
  for (const p of list || []) {
    const make = PROPS[p.type]
    if (!make) throw new Error('unknown prop ' + p.type)
    const g = make(p)
    g.position.set(...(p.pos || [0, 0, 0]))
    g.rotation.y = ((p.yaw || 0) * Math.PI) / 180
    group.add(g)
  }
  group.updateMatrixWorld(true)
}
const buildProps = (list) => fillProps(propsGroup, list)

function collectBounds(points, camRight, camUp, camDir) {
  const b = { minR: Infinity, maxR: -Infinity, minU: Infinity, maxU: -Infinity, minD: Infinity, maxD: -Infinity }
  const v = new THREE.Vector3()
  for (let i = 0; i < points.length; i += 3) {
    v.set(points[i], points[i + 1], points[i + 2])
    const r = v.dot(camRight)
    const u = v.dot(camUp)
    const d = v.dot(camDir)
    if (r < b.minR) b.minR = r
    if (r > b.maxR) b.maxR = r
    if (u < b.minU) b.minU = u
    if (u > b.maxU) b.maxU = u
    if (d < b.minD) b.minD = d
    if (d > b.maxD) b.maxD = d
  }
  return b
}

function propPoints(group = propsGroup) {
  const pts = []
  const v = new THREE.Vector3()
  group.traverse((o) => {
    if (o.isMesh && o.geometry.attributes.position) {
      const a = o.geometry.attributes.position
      for (let i = 0; i < a.count; i++) {
        v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld)
        pts.push(v.x, v.y, v.z)
      }
    }
  })
  return pts
}

function setBodyPose(positions) {
  geom.attributes.position.array.set(positions)
  geom.attributes.position.needsUpdate = true
  geom.computeVertexNormals()
  geom.computeBoundingSphere()
}

function snapshot() {
  return renderer.domElement.toDataURL('image/png')
}

window.renderSpec = async function renderSpec(spec, opts = {}) {
  const az = spec.camera?.az ?? 90
  const el = spec.camera?.el ?? 8
  const ca = (az * Math.PI) / 180
  const ce = (el * Math.PI) / 180
  const dir = new THREE.Vector3(Math.sin(ca) * Math.cos(ce), Math.sin(ce), Math.cos(ca) * Math.cos(ce)) // from target to camera
  const worldUp = new THREE.Vector3(0, 1, 0)
  const right = worldUp.clone().cross(dir).normalize()
  const up = dir.clone().cross(right).normalize()

  buildProps(spec.props)
  paint.setMuscles(spec.muscles || [], spec.muscleSide)

  const frameSpecs = spec.frames
  const names = Object.keys(frameSpecs)
  const posed = {}
  const reports = {}
  // Sampling the mix too keeps the framing steady across the whole loop.
  const loopN = opts.loopFrames || 0
  const startF = body.resolveFrame(frameSpecs.start)
  const endF = body.resolveFrame(frameSpecs.end || frameSpecs.start)
  // t runs 0..1 from start to end, through the optional mid, mid2 and mid3 poses, evenly spaced.
  const keys = [startF, ...['mid', 'mid2', 'mid3'].filter((k) => frameSpecs[k]).map((k) => body.resolveFrame(frameSpecs[k])), endF]
  const at = (t) => {
    const x = Math.min(0.999999, Math.max(0, t)) * (keys.length - 1)
    const i = Math.floor(x)
    return mixFrames(keys[i], keys[i + 1], x - i)
  }
  const samples = [...names.map((n) => frameSpecs[n]), at(0.25), at(0.5), at(0.75)]
  let bounds = null
  const pp = propPoints()
  const merge = (b) => {
    if (!bounds) bounds = { ...b }
    else {
      bounds.minR = Math.min(bounds.minR, b.minR)
      bounds.maxR = Math.max(bounds.maxR, b.maxR)
      bounds.minU = Math.min(bounds.minU, b.minU)
      bounds.maxU = Math.max(bounds.maxU, b.maxU)
      bounds.minD = Math.min(bounds.minD, b.minD)
      bounds.maxD = Math.max(bounds.maxD, b.maxD)
    }
  }
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const f of samples) {
    const r = body.solve(f)
    merge(collectBounds(r.positions, right, up, dir))
    for (let k = 0; k < r.positions.length; k += 3) {
      minX = Math.min(minX, r.positions[k]); maxX = Math.max(maxX, r.positions[k])
      minZ = Math.min(minZ, r.positions[k + 2]); maxZ = Math.max(maxZ, r.positions[k + 2])
    }
    if (f.props) {
      fillProps(framePropsGroup, f.props)
      const fp = propPoints(framePropsGroup)
      if (fp.length) merge(collectBounds(fp, right, up, dir))
    }
  }
  if (pp.length) {
    // Walls and long props must not force the camera far out: they only count where the figure is.
    const wide = (spec.props || []).some((p) => p.type === 'wall' || p.type === 'door-frame' || p.type === 'door-corner')
    if (!wide) merge(collectBounds(pp, right, up, dir))
    else {
      const b = collectBounds(pp, right, up, dir)
      bounds.minD = Math.min(bounds.minD, b.minD)
      bounds.maxD = Math.max(bounds.maxD, b.maxD)
    }
  }
  pool.position.x = (minX + maxX) / 2
  pool.position.z = (minZ + maxZ) / 2
  const poolSize = Math.max(maxX - minX, maxZ - minZ, 0.9) * 1.9
  pool.scale.set(poolSize, poolSize, 1)
  // The floor always lies inside the frame.
  bounds.minU = Math.min(bounds.minU, 0)
  const cR = (bounds.minR + bounds.maxR) / 2
  const cU = (bounds.minU + bounds.maxU) / 2
  const aspect = W / H
  const wR = bounds.maxR - bounds.minR
  const hU = bounds.maxU - bounds.minU
  // Wider margins left and right than top and bottom: the app shows some thumbnails as squares cut from this 4:3 frame,
  // and the figure must survive that crop.
  const padH = spec.camera?.padH ?? 0.135
  const padV = spec.camera?.pad ?? 0.07
  const viewH = Math.max(hU / (1 - 2 * padV), wR / (aspect * (1 - 2 * padH)))
  const viewW = viewH * aspect
  const dist = 6
  const target = right.clone().multiplyScalar(cR).add(up.clone().multiplyScalar(cU))
  const camera = new THREE.OrthographicCamera(-viewW / 2, viewW / 2, viewH / 2, -viewH / 2, 0.1, 40)
  camera.position.copy(target).addScaledVector(dir, dist + bounds.maxD)
  camera.up.copy(worldUp)
  camera.lookAt(target.clone().addScaledVector(dir, bounds.maxD))

  // Line weight follows the framing, so a lying figure and a standing one look alike at the same size.
  outlineMesh.material = outlineMaterial(viewH * 0.0034)

  // Light from up, camera side.
  const lightDir = new THREE.Vector3().copy(dir).multiplyScalar(0.55).add(new THREE.Vector3(0.25, 1, 0.2)).normalize()
  const cw = new THREE.Vector3(0, 0.6, 0)
  sun.position.copy(cw).addScaledVector(lightDir, 8)
  // From behind the figure, opposite the camera: the bright edge that separates a grey body from a black background.
  rim.position.copy(cw).addScaledVector(dir, -6).add(new THREE.Vector3(-1.5, 3, 0))
  rim.target.position.copy(cw)
  sun.target.position.copy(cw)
  const sc = Math.max(viewW, viewH) * 1.1
  sun.shadow.camera.left = -sc
  sun.shadow.camera.right = sc
  sun.shadow.camera.top = sc
  sun.shadow.camera.bottom = -sc
  sun.shadow.camera.near = 0.5
  sun.shadow.camera.far = 20
  sun.shadow.camera.updateProjectionMatrix()

  const images = {}
  for (const n of names) {
    const r = body.solve(frameSpecs[n])
    reports[n] = r.report
    setBodyPose(r.positions)
    fillProps(framePropsGroup, frameSpecs[n].props || [])
    renderer.render(scene, camera)
    images[n] = snapshot()
  }
  const loop = []
  if (loopN) {
    // There and back, eased so the ends linger like a real rep. `timing` (seconds) shows a set tempo instead.
    const ts = []
    if (spec.timing) {
      const fps = opts.fps || 6
      const ease = (x) => 0.5 - 0.5 * Math.cos(x * Math.PI)
      const { there = 1, holdEnd = 0, back = 1, holdStart = 0 } = spec.timing
      const n = (sec) => Math.max(0, Math.round(sec * fps))
      for (let i = 0; i < n(there); i++) ts.push(ease(i / n(there)))
      for (let i = 0; i < n(holdEnd); i++) ts.push(1)
      for (let i = 0; i < n(back); i++) ts.push(1 - ease(i / n(back)))
      for (let i = 0; i < n(holdStart); i++) ts.push(0)
    } else {
      for (let i = 0; i < loopN; i++) ts.push(0.5 - 0.5 * Math.cos((i / loopN) * 2 * Math.PI))
    }
    for (const t of ts) {
      const mixed = at(t)
      const r = body.solve(mixed)
      setBodyPose(r.positions)
      fillProps(framePropsGroup, mixed.props || [])
      renderer.render(scene, camera)
      loop.push(snapshot())
    }
  }
  return { images, reports, loop, view: { viewW, viewH } }
}

async function init() {
  const data = await (await fetch(STUDIO ? './build/body-real.json' : './build/body.json')).json()
  body = new Body(data)
  geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(body.n * 3), 3))
  geom.setAttribute('aRest', new THREE.BufferAttribute(body.rest, 3))
  geom.setAttribute('aInk', new THREE.BufferAttribute(body.ink, 1))
  geom.setIndex(body.index)
  paint = makePaint(THREE, body, STYLE)
  const mat = paint.patch(STUDIO ? new THREE.MeshStandardMaterial({ roughness: 0.48, metalness: 0.02 }) : new THREE.MeshToonMaterial({ gradientMap: gradient }))
  bodyMesh = new THREE.Mesh(geom, mat)
  bodyMesh.castShadow = true
  bodyMesh.frustumCulled = false
  scene.add(bodyMesh)
  outlineMesh = new THREE.Mesh(geom, outlineMaterial(0.005))
  outlineMesh.frustumCulled = false
  if (!STUDIO) scene.add(outlineMesh)
  window.MUSCLE_NAMES = MUSCLE_NAMES
  window.ready = true
}
init().catch((e) => {
  window.initError = String(e && e.stack || e)
})
