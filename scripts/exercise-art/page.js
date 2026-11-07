// Renders exercise specs with three.js. Loaded by render.html, driven by render.mjs.
import * as THREE from './vendor/three.module.js'
import { Body, mixFrames } from './rig.js'
import { makePaint, MUSCLE_NAMES } from './paint.js'
import { PROPS, propErrors } from './props/index.js'

const W = 1600
const H = 1200
// The look: grey body, glowing target muscles, black background, no outlines.
const STYLE = {
  background: 0x0b0b0c,
  skin: new THREE.Color(0xb9b9b9),
  shorts: new THREE.Color(0x121213),
  target: new THREE.Color(0xff5a1f),
  muscleEdge: 0.45,
  muscleGlow: 0.32,
  muscleFiber: 0.16,
  waistY: 0.985,
  hemY: 0.77,
}

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false })
renderer.setPixelRatio(1)
renderer.setSize(W, H)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.outputColorSpace = THREE.SRGBColorSpace
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(STYLE.background)

// A dim studio to reflect: without it, metal renders black. Soft boxes above and to the sides, nothing below.
{
  const env = new THREE.Scene()
  env.background = new THREE.Color(0x050506)
  const panel = (w, h, pos, intensity) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity), side: THREE.DoubleSide }))
    m.position.set(...pos)
    m.lookAt(0, 0, 0)
    env.add(m)
  }
  panel(8, 8, [0, 6, 0], 2.2)
  panel(3, 6, [6, 2, 2], 3.2)
  panel(3, 6, [-6, 2, 2], 1.6)
  panel(6, 3, [0, 2, -6], 1.2)
  panel(6, 3, [0, 2, 6], 0.9)
  const pm = new THREE.PMREMGenerator(renderer)
  scene.environment = pm.fromScene(env, 0.03).texture
  scene.environmentIntensity = 0.55
}

scene.add(new THREE.HemisphereLight(0xc8ccd2, 0x141416, 0.75))
const sun = new THREE.DirectionalLight(0xffffff, 3.0)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.radius = 7
sun.shadow.bias = -0.0005
sun.shadow.normalBias = 0.02
scene.add(sun)
scene.add(sun.target)

const rim = new THREE.DirectionalLight(0xffffff, 1.6)
scene.add(rim)
scene.add(rim.target)
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.62 }))
// The floor: a soft pool of light under the figure, fading into the black background.
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
scene.add(pool)
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)

let body
let geom
let bodyMesh
let paint
const propsGroup = new THREE.Group()
scene.add(propsGroup)

const framePropsGroup = new THREE.Group()
scene.add(framePropsGroup)

// A prop that follows the body is rebuilt for every frame, from where the hands and feet ended up.
// ctx = { hands: {L, R}, feet: {L, R}, frames: {pelvis, chest, head}, joints } (see Body.solve), null for a static prop.
const FOLLOW_KEYS = ['hand', 'hands', 'foot', 'feet', 'follow']
const isDynamic = (p) => FOLLOW_KEYS.some((k) => p[k] !== undefined)

function fillProps(group, list, ctx = null) {
  while (group.children.length) group.remove(group.children[0])
  for (const p of list || []) {
    const make = PROPS[p.type]
    if (!make) throw new Error(`unknown prop "${p.type}"${propErrors.length ? ` (module errors: ${propErrors.join(' | ')})` : ''}`)
    const g = make(p, ctx)
    // A builder that works in world coordinates (a cable between a pulley and a hand) says so with userData.world.
    if (!g.userData.world) {
      g.position.set(...(p.pos || [0, 0, 0]))
      g.rotation.y = ((p.yaw || 0) * Math.PI) / 180
    }
    if (p.frameIgnore) g.userData.frameIgnore = true
    group.add(g)
  }
  group.updateMatrixWorld(true)
}
const buildProps = (list) => fillProps(propsGroup, list)

/** All the props a frame draws besides the static ones: its own, and the spec's that follow the body. */
const movingProps = (spec, frame) => [...(spec.props || []).filter(isDynamic), ...(frame.props || [])]

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

function isFrameIgnored(o) {
  for (let p = o; p; p = p.parent) if (p.userData && p.userData.frameIgnore) return true
  return false
}

function propPoints(group = propsGroup) {
  const pts = []
  const v = new THREE.Vector3()
  group.traverse((o) => {
    if (o.isMesh && o.geometry.attributes.position && !isFrameIgnored(o)) {
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
  geom.attributes.normal.array.set(body.normals)
  geom.attributes.normal.needsUpdate = true
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

  buildProps((spec.props || []).filter((p) => !isDynamic(p)))
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
    const moving = movingProps(spec, f)
    if (moving.length) {
      fillProps(framePropsGroup, moving, r.report)
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
  // A long lens: depth reads naturally and the figure keeps its proportions. Fitted so the nearest face of the movement's
  // bounds fills the frame.
  const FOV = 22
  const tanV = Math.tan((FOV * Math.PI) / 360)
  const midD = (bounds.minD + bounds.maxD) / 2
  const target = right.clone().multiplyScalar(cR).add(up.clone().multiplyScalar(cU)).addScaledVector(dir, midD)
  const fit = Math.max(viewH / 2 / tanV, viewW / 2 / (tanV * aspect)) + (bounds.maxD - bounds.minD) / 2
  const camera = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 80)
  camera.position.copy(target).addScaledVector(dir, fit)
  camera.up.copy(worldUp)
  camera.lookAt(target)

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
    fillProps(framePropsGroup, movingProps(spec, frameSpecs[n]), r.report)
    renderer.render(scene, camera)
    images[n] = snapshot()
  }
  // Close-ups for review: the hands and feet are small in the full frame, and they are where a figure goes wrong.
  const closeups = {}
  if (opts.closeups) {
    const SPOTS = { handL: ['wrist.L', 0.34], handR: ['wrist.R', 0.34], footL: ['foot.L', 0.42], footR: ['foot.R', 0.42], head: ['head', 0.5] }
    const near = new THREE.Vector3()
    for (const n of names) {
      const r = body.solve(frameSpecs[n])
      setBodyPose(r.positions)
      fillProps(framePropsGroup, movingProps(spec, frameSpecs[n]), r.report)
      for (const [spot, [joint, size]] of Object.entries(SPOTS)) {
        const j = r.report.joints[joint]
        near.set(j[0], j[1], j[2])
        const cam = new THREE.OrthographicCamera((-size * aspect) / 2, (size * aspect) / 2, size / 2, -size / 2, 0.1, 40)
        cam.position.copy(near).addScaledVector(dir, 8)
        cam.up.copy(worldUp)
        cam.lookAt(near)
        renderer.render(scene, cam)
        closeups[`${n}-${spot}`] = snapshot()
      }
    }
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
      fillProps(framePropsGroup, movingProps(spec, mixed), r.report)
      renderer.render(scene, camera)
      loop.push(snapshot())
    }
  }
  return { images, reports, loop, closeups, view: { viewW, viewH } }
}

async function init() {
  const data = await (await fetch('./build/body-real.json')).json()
  body = new Body(data, { render: true })
  geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(body.n * 3), 3))
  geom.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(body.n * 3), 3))
  geom.setAttribute('aRest', new THREE.BufferAttribute(body.rest, 3))
  geom.setIndex(new THREE.BufferAttribute(body.index, 1))
  const muscleData = await (await fetch('./build/muscles.json')).json()
  paint = makePaint(THREE, body, STYLE, muscleData, geom)
  const skinMat = paint.patch(new THREE.MeshStandardMaterial({ roughness: 0.48, metalness: 0.02, envMapIntensity: 0.25 }))
  bodyMesh = new THREE.Mesh(geom, skinMat)
  bodyMesh.castShadow = true
  bodyMesh.frustumCulled = false
  scene.add(bodyMesh)
  window.MUSCLE_NAMES = MUSCLE_NAMES
  window.propTypes = Object.keys(PROPS)
  window.propErrors = propErrors
  window.ready = true
}
init().catch((e) => {
  window.initError = String(e && e.stack || e)
})
