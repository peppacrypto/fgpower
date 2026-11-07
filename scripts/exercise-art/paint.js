// Per-pixel colouring of the figure: skin, shorts, and the target muscles of the exercise.
//
// The muscle shapes are anatomical outlines baked per vertex by bake-muscles.mjs (build/muscles.json): a signed distance to
// the outline, the fibre direction, the lines between heads. The vertex shader passes them on, so the edge stays crisp and
// the fibres stay on the muscle through any pose. Shorts are measured on the rest pose. Muscle ids are FGPOWER's taxonomy ids.

export const MUSCLE_NAMES = [
  'chest', 'abdominals', 'obliques', 'lats', 'traps', 'rhomboids', 'middle-back', 'spinal-erectors', 'glutes', 'abductors', 'adductors',
  'quadriceps', 'hamstrings', 'calves', 'biceps', 'triceps', 'forearms', 'shoulders', 'anterior-deltoid', 'lateral-deltoid', 'posterior-deltoid',
]

const decode = (b64, Type) => {
  const bin = atob(b64)
  const u8 = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  return new Type(u8.buffer)
}

export function makePaint(THREE, body, style, data, geom) {
  if (data.n !== body.n) throw new Error(`build/muscles.json has ${data.n} vertices, the mesh ${body.n}: run node bake-muscles.mjs`)
  const N = body.n
  const OUTSIDE = -data.band
  const aMask = new Float32Array(N * 4) // sdf, phase, along, belly
  const aSep = new Float32Array(N * 4) // g0, g1, st0, st1
  const aMore = new Float32Array(N * 2) // fade, tendon
  geom.setAttribute('aMask', new THREE.BufferAttribute(aMask, 4))
  geom.setAttribute('aSep', new THREE.BufferAttribute(aSep, 4))
  geom.setAttribute('aMore', new THREE.BufferAttribute(aMore, 2))
  const uniforms = {
    uSkin: { value: style.skin },
    uShorts: { value: style.shorts },
    uTarget: { value: style.target },
    uGlow: { value: style.muscleGlow ?? 0 },
    uWaist: { value: style.waistY },
    uHem: { value: style.hemY },
  }
  const cache = new Map()
  const load = (id) => {
    if (cache.has(id)) return cache.get(id)
    const m = data.ids[id]
    if (!m) throw new Error(`unknown muscle id: ${id}`)
    const v = { whole: m.whole, idx: decode(m.idx, Int32Array) }
    for (const k of ['sdf', 'g0', 'g1', 'st0', 'st1', 'phase', 'along', 'belly', 'fade', 'tendon']) v[k] = decode(m[k], Int16Array)
    cache.set(id, v)
    return v
  }

  // side: "L" or "R" paints only that side of the figure (a one-legged calf raise), anything else both.
  function setMuscles(ids, side) {
    aMask.fill(0)
    for (let k = 0; k < N; k++) aMask[k * 4] = OUTSIDE
    aSep.fill(0)
    aMore.fill(0)
    const sign = side === 'L' ? 1 : side === 'R' ? -1 : 0
    const rest = body.rest
    for (const id of ids) {
      if (id === 'full-body' || id === 'neck') continue
      const m = load(id)
      for (let j = 0; j < m.idx.length; j++) {
        const k = m.idx[j]
        let sdf = m.sdf[j] / 1e4
        if (sign && !m.whole) sdf = Math.min(sdf, rest[k * 3] * sign)
        if (sdf <= aMask[k * 4]) continue
        aMask[k * 4] = sdf
        aMask[k * 4 + 1] = m.phase[j] / 1e4
        aMask[k * 4 + 2] = m.along[j] / 1e4
        aMask[k * 4 + 3] = m.belly[j] / 1e4
        aSep[k * 4] = m.g0[j] / 1e4
        aSep[k * 4 + 1] = m.g1[j] / 1e4
        aSep[k * 4 + 2] = m.st0[j] / 1e4
        aSep[k * 4 + 3] = m.st1[j] / 1e4
        aMore[k * 2] = m.fade[j] / 1e4
        aMore[k * 2 + 1] = m.tendon[j] / 1e4
      }
    }
    geom.attributes.aMask.needsUpdate = true
    geom.attributes.aSep.needsUpdate = true
    geom.attributes.aMore.needsUpdate = true
  }

  function patch(material) {
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
attribute vec3 aRest;
attribute vec4 aMask;
attribute vec4 aSep;
attribute vec2 aMore;
varying vec3 vRest;
varying vec4 vMask;
varying vec4 vSep;
varying vec2 vMore;`,
        )
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = aRest; vMask = aMask; vSep = aSep; vMore = aMore;')
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vRest;
varying vec4 vMask;
varying vec4 vSep;
varying vec2 vMore;
uniform vec3 uSkin;
uniform vec3 uShorts;
uniform vec3 uTarget;
uniform float uGlow;
uniform float uWaist;
uniform float uHem;
float gMuscle = 0.0;`,
        )
        .replace(
          '#include <color_fragment>',
          `{
  vec3 p = vRest;
  float ax = abs(p.x);
  float notArm = 1.0 - smoothstep(0.255, 0.27, ax);
  float shorts = smoothstep(uHem - 0.002, uHem + 0.002, p.y) * (1.0 - smoothstep(uWaist - 0.002, uWaist + 0.002, p.y)) * notArm;
  vec3 base = mix(uSkin, uShorts, shorts);
  float m = smoothstep(-0.0016, 0.0016, vMask.x);
  // Fine fibres along the muscle, fading out where the outline or a head change makes them meaningless.
  float fibre = 0.5 + 0.5 * sin(vMask.y * 6.2832 / 0.0058 + 1.5 * sin(vMask.z * 38.0));
  float fibreAmt = 0.2 * clamp(vMore.x, 0.0, 1.0) * smoothstep(0.0, 0.006, vMask.x);
  // Thin dark lines between the heads of a muscle.
  float sep = max((1.0 - smoothstep(0.0, 0.0017, abs(vSep.x))) * vSep.z, (1.0 - smoothstep(0.0, 0.0017, abs(vSep.y))) * vSep.w);
  vec3 muscle = uTarget * (1.0 - fibreAmt * fibre) * (0.8 + 0.2 * clamp(vMask.w, 0.0, 1.0));
  muscle = mix(muscle, uTarget * 0.32, clamp(sep, 0.0, 1.0) * 0.85);
  // Tendon ends turn pale, as on an anatomy plate.
  muscle = mix(muscle, vec3(0.86, 0.66, 0.54), clamp(vMore.y, 0.0, 1.0) * 0.55);
  gMuscle = m * (0.65 + 0.35 * clamp(vMask.w, 0.0, 1.0)) * (1.0 - 0.7 * clamp(sep, 0.0, 1.0)) * (1.0 - clamp(vMore.y, 0.0, 1.0) * 0.7);
  diffuseColor.rgb = mix(base, muscle, m);
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
