// Per-pixel colouring of the figure: skin, shorts, and the target muscles of the exercise.
//
// Everything is measured on the REST pose (standing, arms out, facing +Z, +X is the figure's left), passed to the
// fragment shader as a varying, so the shapes stay crisp and follow the body through any pose. Muscles are mirrored:
// each one is defined once on the left side. Muscle ids are FGPOWER's taxonomy ids (prisma/seed-data/taxonomy.ts).
//
// Two kinds of shape:
//   T(torso): an ellipse on the x-y plane limited to a z range. {cx, cy, rx, ry, rot, zMin, zMax}
//   L(limb): an ellipse in (position along the limb, angle around it). {limb, tc, tw, ac, aw, rMax}
//     angle: 0 = front of the limb, 90 = outer side, 180 = back, -90 = inner side.

const T = (cx, cy, rx, ry, zMin = -1, zMax = 1, rot = 0, whole = false) => ({ kind: 0, cx, cy, rx, ry, zMin, zMax, rot, whole })
const L = (limb, tc, tw, ac, aw, rMax) => ({ kind: 1, limb, tc, tw, ac, aw, rMax })

const FRONT = 0.055
const BACK = 0.0

const SHAPES = {
  chest: [T(0.09, 1.293, 0.098, 0.066, FRONT, 1, -0.12)],
  // The rectus crosses the midline: painted whole even on a one-sided move, or it reads as a half-moon.
  abdominals: [T(0, 1.085, 0.078, 0.128, FRONT, 1, 0, true)],
  obliques: [L('flank', 0.52, 0.52, 80, 40, 0.3)],
  lats: [T(0.118, 1.2, 0.058, 0.118, -1, 0.02, 0.22)],
  traps: [T(0.035, 1.39, 0.13, 0.066, -1, BACK), T(0, 1.285, 0.05, 0.1, -1, BACK)],
  rhomboids: [T(0.05, 1.28, 0.05, 0.055, -1, -0.02)],
  'middle-back': [T(0.06, 1.27, 0.066, 0.075, -1, -0.015)],
  'spinal-erectors': [T(0.036, 1.08, 0.034, 0.135, -1, -0.005)],
  glutes: [T(0.098, 0.865, 0.098, 0.088, -1, BACK)],
  abductors: [L('hip', 0.42, 0.42, 92, 42, 0.26)],
  biceps: [L('upperarm', 0.58, 0.38, 0, 62, 0.085)],
  triceps: [L('upperarm', 0.55, 0.42, 180, 72, 0.085)],
  shoulders: [L('upperarm', 0.08, 0.4, 90, 118, 0.09)],
  'anterior-deltoid': [L('upperarm', 0.1, 0.38, 25, 40, 0.09)],
  'lateral-deltoid': [L('upperarm', 0.1, 0.38, 90, 44, 0.09)],
  'posterior-deltoid': [L('upperarm', 0.1, 0.38, 155, 40, 0.09)],
  forearms: [L('forearm', 0.36, 0.38, 0, 400, 0.075)],
  quadriceps: [L('thigh', 0.56, 0.42, 5, 74, 0.13)],
  hamstrings: [L('thigh', 0.6, 0.38, 180, 62, 0.13)],
  adductors: [L('thigh', 0.32, 0.32, -90, 40, 0.13)],
  calves: [L('shank', 0.32, 0.3, 180, 82, 0.095)],
}

export const MUSCLE_NAMES = Object.keys(SHAPES)
const MAX = 16

export function makePaint(THREE, body, style) {
  const s = body.side.L
  const limbs = {
    upperarm: { a: s.S, b: s.E, n: new THREE.Vector3(0, 0, 1) },
    forearm: { a: s.E, b: s.W, n: new THREE.Vector3(0, 1, 0) },
    thigh: { a: s.H, b: s.K, n: new THREE.Vector3(0, 0, 1) },
    shank: { a: s.K, b: s.A, n: new THREE.Vector3(0, 0, 1) },
    // Around the trunk rather than along a limb: decals on the side of the waist and of the hip.
    flank: { a: new THREE.Vector3(0, 1.2, 0.03), b: new THREE.Vector3(0, 0.95, 0.03), n: new THREE.Vector3(0, 0, 1) },
    hip: { a: new THREE.Vector3(0, 1.0, 0.0), b: new THREE.Vector3(0, 0.78, 0.0), n: new THREE.Vector3(0, 0, 1) },
  }
  const uniforms = {
    uN: { value: 0 },
    uK: { value: new Float32Array(MAX) },
    uP0: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) },
    uP1: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) },
    uP2: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) },
    uP3: { value: Array.from({ length: MAX }, () => new THREE.Vector4()) },
    uSkin: { value: style.skin },
    uShorts: { value: style.shorts },
    uTarget: { value: style.target },
    uSide: { value: 0 },
    uEdge: { value: style.muscleEdge ?? 0.95 },
    uGlow: { value: style.muscleGlow ?? 0 },
    uFiber: { value: style.muscleFiber ?? 0 },
    uFeet: { value: style.feet ?? style.skin },
    uFeetY: { value: style.feet ? 0.1 : -1 },
    uWaist: { value: style.waistY },
    uHem: { value: style.hemY },
  }

  // side: "L" or "R" paints only that side of the figure (a one-legged calf raise), anything else both.
  function setMuscles(ids, side) {
    uniforms.uSide.value = side === 'L' ? 1 : side === 'R' ? -1 : 0
    const list = []
    for (const id of ids) {
      if (id === 'full-body' || id === 'neck') continue
      const shapes = SHAPES[id]
      if (!shapes) throw new Error(`unknown muscle id: ${id}`)
      list.push(...shapes)
    }
    if (list.length > MAX) throw new Error('too many muscle shapes')
    uniforms.uN.value = list.length
    list.forEach((p, i) => {
      if (p.kind === 0) {
        uniforms.uK.value[i] = 0
        uniforms.uP0.value[i].set(p.cx, p.cy, p.rx, p.ry)
        uniforms.uP1.value[i].set(p.rot, p.zMin, p.zMax, p.whole ? 1 : 0)
      } else {
        const l = limbs[p.limb]
        uniforms.uK.value[i] = 1
        uniforms.uP0.value[i].set(l.a.x, l.a.y, l.a.z, p.tc)
        uniforms.uP1.value[i].set(l.b.x, l.b.y, l.b.z, p.tw)
        uniforms.uP2.value[i].set(l.n.x, l.n.y, l.n.z, (p.ac * Math.PI) / 180)
        uniforms.uP3.value[i].set((p.aw * Math.PI) / 180, p.rMax, 0, 0)
      }
    })
  }

  function patch(material) {
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 aRest;\nvarying vec3 vRest;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = aRest;')
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vRest;
uniform float uN;
uniform float uK[${MAX}];
uniform vec4 uP0[${MAX}];
uniform vec4 uP1[${MAX}];
uniform vec4 uP2[${MAX}];
uniform vec4 uP3[${MAX}];
uniform vec3 uSkin;
uniform vec3 uShorts;
uniform vec3 uTarget;
uniform float uSide;
uniform float uEdge;
uniform float uGlow;
uniform float uFiber;
uniform vec3 uFeet;
uniform float uFeetY;
float gMuscle = 0.0;
uniform float uWaist;
uniform float uHem;
float muscleMask(vec3 q) {
  vec3 p = q;
  p.x = abs(p.x);
  float side = uSide == 0.0 ? 1.0 : smoothstep(-0.004, 0.004, q.x * uSide);
  float m = 0.0;
  for (int i = 0; i < int(uN); i++) {
    if (uK[i] < 0.5) {
      vec2 d = p.xy - uP0[i].xy;
      float c = cos(uP1[i].x);
      float s = sin(uP1[i].x);
      vec2 e = vec2(c * d.x + s * d.y, -s * d.x + c * d.y) / uP0[i].zw;
      float zm = smoothstep(uP1[i].y - 0.006, uP1[i].y + 0.006, p.z) * (1.0 - smoothstep(uP1[i].z - 0.006, uP1[i].z + 0.006, p.z));
      float fT = 1.0 - uFiber + uFiber * (0.5 + 0.5 * sin(e.x * 34.0 + e.y * 5.0));
      m = max(m, (1.0 - smoothstep(uEdge, 1.0, length(e))) * zm * (uP1[i].w > 0.5 ? 1.0 : side) * fT);
    } else {
      vec3 a = uP0[i].xyz;
      vec3 ab = uP1[i].xyz - a;
      float len = length(ab);
      vec3 u = ab / len;
      float along = dot(p - a, u);
      float t = along / len;
      vec3 r = p - a - u * along;
      vec3 n = normalize(uP2[i].xyz - u * dot(uP2[i].xyz, u));
      vec3 l = cross(n, u);
      float th = atan(dot(r, l), dot(r, n));
      float dth = th - uP2[i].w;
      dth = atan(sin(dth), cos(dth));
      float val = length(vec2((t - uP0[i].w) / uP1[i].w, dth / uP3[i].x));
      float near = 1.0 - smoothstep(uP3[i].y - 0.004, uP3[i].y + 0.004, length(r));
      float fL = 1.0 - uFiber + uFiber * (0.5 + 0.5 * sin(th * 22.0 + t * 3.0));
      m = max(m, (1.0 - smoothstep(uEdge, 1.0, val)) * near * side * fL);
    }
  }
  return m;
}`,
        )
        .replace(
          '#include <color_fragment>',
          `{
  vec3 p = vRest;
  float ax = abs(p.x);
  float notArm = 1.0 - smoothstep(0.255, 0.27, ax);
  float shorts = smoothstep(uHem - 0.002, uHem + 0.002, p.y) * (1.0 - smoothstep(uWaist - 0.002, uWaist + 0.002, p.y)) * notArm;
  vec3 base = mix(uSkin, uShorts, shorts);
  if (uFeetY > 0.0) base = mix(base, uFeet, 1.0 - smoothstep(uFeetY - 0.004, uFeetY + 0.004, p.y));
  float mm = muscleMask(p);
  gMuscle = mm;
  diffuseColor.rgb = mix(base, uTarget, mm);
}`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
totalEmissiveRadiance += uTarget * gMuscle * uGlow;`,
        )
    }
    return material
  }

  return { setMuscles, patch, uniforms }
}
