// Home props: chair, sofa, table, wall, step, towels, doorway. `pos` is the point on the floor under the centre, `yaw` turns it. At yaw 0 the figure faces +Z and +X is its left.
//
// WHERE THE BODY GOES
// chair   seatH 0.46. Top of the pad y = seatH + 0.02 (0.48), its crown rises 6 mm more. Seat 0.42 square centred on pos, back at -Z, so a sitter faces +Z and the front edge is at
//     pos.z + 0.21. Hips of a sitter at about pos.z - 0.03, y = seat top + 0.10. Front legs at x ±0.18, z +0.18. Back: raked, top rail at y = seatH + 0.39, z = pos.z - 0.235.
//     Hands on the seat edge: y = seat top, x ±0.21. Foot on the seat (split squat): sole at y 0.485.
// sofa   width 1.5. Seat top y 0.42, its cushions crown 12 mm more. Front edge z = pos.z + 0.36. The back cushions start at z = pos.z - 0.12 on the seat and lean back to about pos.z - 0.19 at their top, y 0.85. Arms 0.17 wide, top y 0.64.
//     Upper back on the front edge (hip thrust): shoulder blades at z = pos.z + 0.36, y 0.42. Widen `width` when an arm hides the body. Hands on the front edge: y 0.42, z = pos.z + 0.35.
// table   height 0.75 is the top surface. Top 1.1 x 0.7 centred on pos. Legs at the corners.
// wall   A slab 0.08 thick centred on pos.z, top at `height`. Faces at pos.z ± 0.04, skirting 9 cm tall and 12 mm proud of each face. width shortens it. skirting:false removes it.
// step   height 0.17, depth 0.28, width 0.7. A stair tread: top y = height, nosing 12 mm over the -Z edge (facing someone who comes up it toward +Z), so the heel hangs off at
//     z = pos.z - depth/2 - 0.012.
// towel   Folded flat: width 0.3 (X), depth 0.42 (Z), thickness 0.018. Top y = thickness. It gives, so a heel may sink 1 cm. Following the body: { foot:"L", at:"heel"|"sole"|"ball" }, { feet:true, at },
//     { hand:"R" } or { hands:true } slides it on the floor under that point in every frame. offset:[x, z] shifts it from there. Static or inside a frame's props with pos, as before.
// towel-strip   A towel twisted into a rope. radius 0.022 (hold it with grip radius 0.022).
//     { hands:true } runs it from the left hand's grip centre to the right hand's, entering and leaving each fist along that hand's thumb axis, with a loose flared tail past each hand (tail 0.085, 0 for none).
//     { hands:true, points:[...] } passes through world points between the hands. { hand:"R", points:[[x,y,z], ...] } starts in one hand and ends at the last point: towel over a bar.
//     { hands:true, around:"L"|"R"|"both", at:0.55 } goes around the sole of that foot or feet in every frame (at: 0 heel, 1 ball; over:true crosses the top of the foot instead). length:0.9 lets it hang slack between the hands when they are closer than that.
//     { a:[...], b:[...] } or { points:[...] } alone is the plain form, in a frame's props. Prefer hands:true: it can't leave the hands in between frames.
// door-frame   A doorway in a wall, centred on pos, in the plane z = pos.z. Clear opening width 0.8 (jamb faces at x = pos.x ± 0.4), headY 2.1 is the underside of the head. Casing faces at z = pos.z ± 0.06.
//     wall:false shows the frame with no wall; wallWidth 1.2 each side. Hands on the jambs for a doorway stretch: x ±0.4, or on the casing face, z = pos.z + 0.06.
// door-corner   A wall with a doorway, seen from a person who stands along the wall. pos is the floor point of the corner to hook. At yaw 0 the wall runs along Z through pos.x, casing faces at
//     x = pos.x ± 0.06: one segment goes from the corner toward -Z, the opening (opening 0.8) goes from the corner toward +Z, then the wall carries on, with the head at headY 2.1. The corner edge is at z = pos.z. Yaw 180 flips it.
//     Hooked hand: palm on the casing face x = pos.x + 0.06 at z = pos.z - 0.04, fingers around the edge to +Z.
import { kit, mat } from './kit.js'
import {
  M, soft, bar, gridGeo, lathe, pipeGeo, roundRectPath, samplePath, transportFrames, aroundFoot, vec, noise1, noise2, placeOnFloor, dynamicGeo, smooth, memoGeo, K, noCollide,
} from './small-gear.js'

const { THREE, box, group, mesh } = kit
const V3 = THREE.Vector3

// ---------------------------------------------------------------------------------------------------------------------------- towels

/** One folded layer: a soft-edged sheet whose outline and top wander a little. */
function towelLayerGeo(w, d, t, y0, seed, hem) {
  return memoGeo(K('towel-layer', w, d, t, y0, seed, hem), () => {
    const nu = Math.max(24, Math.round(w / 0.009))
    const nv = Math.max(24, Math.round(d / 0.009))
    // More rows near the edges, where it rounds over.
    const g = (x) => {
      const a = 2 * x - 1
      return Math.sign(a) * (0.42 * Math.abs(a) + 0.58 * (1 - Math.pow(1 - Math.abs(a), 2.6)))
    }
    const edge = (a, b) => Math.min((1 - Math.abs(a)) * (w / 2), (1 - Math.abs(b)) * (d / 2))
    const roundOff = t * 0.95
    const q01 = (a, b) => Math.min(1, edge(a, b) / roundOff)
    const dome = (q) => Math.sqrt(Math.max(0, 1 - (1 - q) * (1 - q)))
    return gridGeo(
      nu,
      nv,
      (u, v, out) => {
        const a = g(u)
        const b = g(v)
        const x = (a * w) / 2 + 0.0034 * (noise2(b * 3.3 + seed, seed * 1.7, 21) - 0.5) * 2 * Math.abs(a) * Math.abs(a)
        const z = (b * d) / 2 + 0.0034 * (noise2(a * 3.9 - seed, seed * 2.3, 22) - 0.5) * 2 * Math.abs(b) * Math.abs(b)
        const q = q01(a, b)
        let h = t * dome(q)
        // Slow swells of the cloth.
        h += t * 0.42 * (noise2(x * 11 + seed, z * 11 - seed, 23) - 0.5) * q
        if (hem) {
          // The flat woven band near the short end of a bath towel.
          const dz = (b * d) / 2 - (d / 2 - 0.05)
          h -= 0.0009 * smooth(0.016, 0.013, Math.abs(dz))
          h -= 0.0012 * (smooth(0.0012, 0, Math.abs(dz - 0.015)) + smooth(0.0012, 0, Math.abs(dz + 0.015)))
        }
        out.set(x, y0 + h, z)
      },
      {
        flip: true,
        uvFn: (u, v) => [g(u) * w * 0.5 + seed * 0.13, g(v) * d * 0.5],
        colorFn: (u, v) => {
          const q = q01(g(u), g(v))
          return 0.5 + 0.5 * Math.pow(q, 0.8)
        },
      },
    )
  })
}

function foldedTowel(p) {
  const w = p.width ?? 0.3
  const d = p.depth ?? 0.42
  const t = p.thickness ?? 0.018
  const layers = t < 0.012 ? 2 : 3
  const lt = t / layers
  const parts = []
  for (let i = 0; i < layers; i++) {
    const inset = i === layers - 1 ? 0.012 : 0
    const off = i === 1 ? 0.002 : -0.001
    const geo = towelLayerGeo(w - inset * 2 - i * 0.002, d - inset - i * 0.002, lt * 1.15, i * lt, 3 + i * 5, i === layers - 1)
    parts.push(noCollide(mesh(geo, M.terryFlat(), [off, 0, -inset * 0.5])))
  }
  // The fold along one long side: a soft roll that binds the layers together.
  parts.push(
    noCollide(mesh(
      memoGeo(K('towel-fold', d, t), () =>
        gridGeo(
          10,
          40,
          (u, v, out) => {
            const a = -Math.PI / 2 + u * Math.PI
            const z = (v - 0.5) * (d - 0.004)
            const r = (t / 2) * (1 + 0.1 * Math.sin(z * 31))
            out.set(w / 2 - 0.005 + Math.cos(a) * r * 0.9 + 0.003 * (noise2(z * 7, 0.3, 24) - 0.5), t / 2 + Math.sin(a) * r, z)
          },
          { flip: true, uvFn: (u, v) => [u * 0.05, v * d], colorFn: (u) => 0.72 + 0.28 * Math.sin(u * Math.PI) },
        ),
      ),
      M.terryFlat(),
    )),
  )
  return group(parts)
}

/**
 * A rope of twisted cloth. Three soft strands wind round a path, deepest in the grooves, less regular than a real rope: it is a towel.
 * Past the hands the twist lets go and the cloth flares into a flat tail with a hem.
 */
function twistedTowel(p, ctx) {
  const R0 = p.radius ?? 0.022
  const tail = p.tail ?? 0.085
  const fromHands = ctx && p.hands
  const oneHand = ctx && p.hand
  const startH = fromHands ? ctx.hands.L : oneHand ? ctx.hands[p.hand] : null
  const endH = fromHands ? ctx.hands.R : null
  const mid = (p.points || (p.a && p.b ? [p.a, p.b] : [])).map(vec)
  const gripHalf = 0.045
  const ctrl = []
  let wraps = []

  // Between the hands: the given points, or the path around the feet.
  const startAt = startH ? vec(startH.centre) : mid[0]
  if (ctx && p.around) {
    const at = p.at ?? 0.55
    const opt = { at, halfWidth: 0.042, clear: R0 * 0.3, rise: 0.03, over: !!p.over }
    const sides = p.around === 'both' ? ['L', 'R'] : [p.around]
    // Walk the feet from the one nearest the first hand.
    const dist = (s) => startAt.distanceTo(vec(ctx.feet[s].sole))
    sides.sort((a, b) => dist(a) - dist(b))
    let from = startAt
    for (const s of sides) {
      const w = aroundFoot(ctx, s, opt, from)
      wraps.push(w)
      mid.push(...(sides.length > 1 ? (s === sides[0] ? w.points.slice(0, 4) : w.points.slice(1)) : w.points))
      from = w.points[w.points.length - 1]
    }
  }
  if (p.length && fromHands && !mid.length) {
    // Slack between the hands: it hangs as a shallow curve of the given length.
    const a = vec(startH.centre)
    const b = vec(endH.centre)
    const span = a.distanceTo(b)
    if (p.length > span * 1.003) {
      const sag = Math.sqrt(Math.max(0, (p.length * p.length - span * span) * (3 / 16))) * 1.0
      for (const f of [0.2, 0.5, 0.8]) mid.push(a.clone().lerp(b, f).add(new V3(0, -sag * 4 * f * (1 - f), 0)))
    }
  }

  const handEnd = (h, next) => {
    const c = vec(h.centre)
    const t = vec(h.thumb).normalize()
    const sign = next.clone().sub(c).dot(t) >= 0 ? 1 : -1
    // Hands close together leave no room for the full width of a fist.
    const half = Math.min(gripHalf, c.distanceTo(next) * 0.22)
    return { c, inner: c.clone().addScaledVector(t, sign * half), outer: c.clone().addScaledVector(t, -sign * gripHalf), out: t.clone().multiplyScalar(-sign) }
  }
  // No two ends of a towel hang alike: k makes one shorter, side swings it a little off the line.
  const tailPoints = (from, dir, k = 1, side = 0.3) => {
    const L = tail * k
    const off = new V3().crossVectors(dir, new V3(0, 1, 0))
    if (off.lengthSq() > 1e-4) off.normalize().multiplyScalar(side * L)
    // Runs on for a moment, then gravity takes it.
    const q1 = from.clone().addScaledVector(dir, L * 0.42).add(new V3(0, -L * 0.08, 0)).addScaledVector(off, 0.25)
    const q2 = from.clone().addScaledVector(dir, L * 0.7).add(new V3(0, -L * 0.42, 0)).addScaledVector(off, 0.7)
    const q3 = from.clone().addScaledVector(dir, L * 0.78).add(new V3(0, -L * 0.95, 0)).add(off)
    return [q1, q2, q3]
  }

  let tailStart = 0
  let tailEnd = 0
  if (startH) {
    const next = mid[0] || (endH ? vec(endH.centre) : vec(startH.centre).add(new V3(0, -1, 0)))
    const e = handEnd(startH, next)
    if (tail > 0) {
      ctrl.push(...tailPoints(e.outer, e.out).reverse())
      tailStart = 1
    }
    ctrl.push(e.outer, e.c, e.inner)
  } else if (mid.length && tail > 0) {
    // The plain form has no hand to read: the tail carries on past the end of the path.
    const dir = mid[0].clone().sub(mid[1] || mid[0]).normalize()
    ctrl.push(...tailPoints(mid[0], dir).reverse())
    tailStart = 1
  }
  ctrl.push(...mid)
  if (endH) {
    const prev = mid[mid.length - 1] || vec(startH.centre)
    const e = handEnd(endH, prev)
    ctrl.push(e.inner, e.c, e.outer)
    if (tail > 0) {
      ctrl.push(...tailPoints(e.outer, e.out, 0.74, -0.45))
      tailEnd = 1
    }
  } else if (!startH && mid.length > 1 && tail > 0) {
    const n = mid.length
    const dir = mid[n - 1].clone().sub(mid[n - 2]).normalize()
    ctrl.push(...tailPoints(mid[n - 1], dir, 0.74, -0.45))
    tailEnd = 1
  } else if (oneHand && mid.length > 1 && tail > 0) {
    const n = mid.length
    const dir = mid[n - 1].clone().sub(mid[n - 2]).normalize()
    ctrl.push(...tailPoints(mid[n - 1], dir))
    tailEnd = 1
  }
  if (ctrl.length < 2) return group()

  const { pts, S, len } = samplePath(ctrl, 0.0042)
  const m = pts.length
  const frames = transportFrames(pts, new V3(0.31, 0.87, 0.38), Math.floor(m / 2))
  const nearestS = (q) => {
    let best = Infinity
    let at = 0
    for (let i = 0; i < m; i++) {
      const d = pts[i].distanceToSquared(q)
      if (d < best) {
        best = d
        at = S[i]
      }
    }
    return at
  }
  // Where the tails start, along the path.
  const tailA = tailStart ? nearestS(ctrl[3]) : -1
  const tailB = tailEnd ? nearestS(ctrl[ctrl.length - 4]) : len + 1
  // Where it presses flat against a sole.
  const presses = wraps.map((w) => ({ s: nearestS(w.mid), n: w.normal }))
  const pitch = 0.135
  const rings = S.map((s, i) => {
    const wt = Math.max(tailA >= 0 ? smooth(tailA, tailA - tail * 0.8, s) : 0, tailB <= len ? smooth(tailB, tailB + tail * 0.8, s) : 0)
    let wp = 0
    let phi = 0
    for (const q of presses) {
      const w = smooth(0.1, 0.04, Math.abs(s - q.s))
      if (w > wp) {
        wp = w
        phi = Math.atan2(-q.n.dot(frames.N[i]), q.n.dot(frames.B[i]))
      }
    }
    const R = R0 * (1 + 0.07 * (noise1(s * 13.1, 2) - 0.5) * 2 + 0.03 * (noise1(s * 37, 3) - 0.5) * 2)
    // The twist lets go along the tail: past the hand it stops winding.
    const sTwist = Math.max(tailA >= 0 ? tailA : s, Math.min(tailB <= len ? tailB : s, s))
    const psi = (sTwist / pitch) * Math.PI * 2 + 1.1 * noise1(sTwist * 4.3, 4) + 0.5 * noise1(sTwist * 11, 5)
    const amp = 0.3 * (0.8 + 0.4 * noise1(s * 8.7, 6)) * (1 - 0.45 * wt) * (1 - 0.8 * wp)
    const a = R * (1 + 1.15 * wt * wt + 0.5 * wp)
    const b = R * (1 - 0.5 * wt - 0.42 * wp)
    let thin = 1
    // The last rings close the hem.
    if (tailStart && i < 2) thin = i === 0 ? 0 : 0.6
    if (tailEnd && i > m - 3) thin = i === m - 1 ? 0 : 0.6
    return { s, a, b: b * thin, psi, amp, phi: phi * wp, wt, wp }
  })
  const around = 28
  const ringIndex = (v) => Math.round(v * (m - 1))
  const crestOf = (u, r) => {
    const q = u * Math.PI * 2 - r.psi
    return Math.pow(Math.abs(Math.cos(q * 1.5)), 0.72)
  }
  const geo = gridGeo(
    around,
    m - 1,
    (u, v, t) => {
      const i = ringIndex(v)
      const r = rings[i]
      const th = u * Math.PI * 2
      const q = th - r.psi
      const crest = crestOf(u, r)
      const k = 1 + r.amp * (crest - 0.7) + 0.03 * Math.sin(5 * q + r.s * 23) * (1 - r.wt)
      let x = Math.cos(th) * r.a * k
      // Past the hand the cloth fans out in soft folds that run along it.
      const fold = r.wt ? r.wt * R0 * 0.62 * Math.sin(2.7 * Math.PI * Math.cos(th) + r.s * 7) : 0
      let y = Math.sin(th) * r.b * k + fold
      if (r.phi) {
        const c = Math.cos(r.phi)
        const s = Math.sin(r.phi)
        const nx = x * c - y * s
        y = x * s + y * c
        x = nx
      }
      t.copy(pts[i]).addScaledVector(frames.N[i], x).addScaledVector(frames.B[i], y)
    },
    {
      closeU: true,
      uvFn: (u, v) => [S[ringIndex(v)], u * 2 * Math.PI * R0],
      colorFn: (u, v) => {
        const r = rings[ringIndex(v)]
        const crest = crestOf(u, r)
        const fold = 0.52 + 0.48 * Math.pow(crest, 0.62)
        const w = Math.max(r.wt, r.wp)
        const fan = 0.86 + 0.14 * Math.sin(2.7 * Math.PI * Math.cos(u * Math.PI * 2) + r.s * 7)
        return fold + (0.97 * fan - fold) * w
      },
    },
  )
  const g = group(noCollide(mesh(dynamicGeo(geo), M.terryShaded())))
  g.userData.world = true
  return g
}

// ---------------------------------------------------------------------------------------------------------------------------- doorway

/**
 * A wall running along Z, thickness 0.10, with an opening from z0 to z1 and casing that stands to ±0.06. Built in this frame for both door types.
 * near:false leaves out the door stop on the near jamb, where a hand hooks round the edge.
 */
function doorway({ z0, z1, headY, height, lenA, lenB, wall = true, stopOnNear = true }) {
  const face = 0.05
  const proud = 0.06
  const cw = 0.072
  const lining = 0.018
  const parts = []
  const trim = M.trim()
  const jamb = M.jamb()
  const wallM = M.wallPaint()
  const quiet = (o) => {
    o.userData.frameIgnore = true
    return o
  }
  if (wall) {
    if (lenA > 0) parts.push(quiet(box(face * 2, height, lenA - lining, wallM, [0, height / 2, z0 - lining - (lenA - lining) / 2])))
    if (lenB > 0) parts.push(quiet(box(face * 2, height, lenB - lining, wallM, [0, height / 2, z1 + lining + (lenB - lining) / 2])))
    parts.push(quiet(box(face * 2, height - headY - lining, z1 - z0 + 2 * lining, wallM, [0, (height + headY + lining) / 2, (z0 + z1) / 2])))
  }
  // Lining boards inside the opening.
  parts.push(soft(face * 2 + 0.006, headY + lining, lining, jamb, [0, (headY + lining) / 2, z0 - lining / 2], { r: 0.002, flat: 2, corner: 1 }))
  parts.push(soft(face * 2 + 0.006, headY + lining, lining, jamb, [0, (headY + lining) / 2, z1 + lining / 2], { r: 0.002, flat: 2, corner: 1 }))
  parts.push(soft(face * 2 + 0.006, lining, z1 - z0, jamb, [0, headY + lining / 2, (z0 + z1) / 2], { r: 0.002, flat: 2, corner: 1 }))
  // Door stop: a shallow strip around the far jamb and head, and very shallow on the near jamb, where it can't get in the way of fingers.
  parts.push(soft(0.038, headY, 0.012, jamb, [0, headY / 2, z1 - 0.006], { r: 0.002, flat: 2, corner: 1 }))
  parts.push(soft(0.038, 0.012, z1 - z0, jamb, [0, headY - 0.006, (z0 + z1) / 2], { r: 0.002, flat: 2, corner: 1 }))
  if (stopOnNear) parts.push(soft(0.038, headY, 0.005, jamb, [0, headY / 2, z0 + 0.0025], { r: 0.0015, flat: 2, corner: 1 }))
  // Casing on both faces of the wall: flat board, a raised back band on its outer edge, a small bead on the inside. Skirting runs into it.
  for (const s of [-1, 1]) {
    const boardT = proud - face - 0.003
    const bx = s * (face + boardT / 2)
    const postH = headY + cw
    const place = (w, h, d, pos, m = trim, r = 0.002) => parts.push(soft(w, h, d, m, pos, { r, flat: 2, corner: 2 }))
    // Near post.
    place(boardT, postH, cw, [bx, postH / 2, z0 - cw / 2])
    place(proud - face, postH, 0.012, [s * (face + (proud - face) / 2), postH / 2, z0 - cw + 0.006], trim, 0.0035)
    place(0.0055, headY, 0.006, [s * (face + boardT + 0.0005), headY / 2, z0 - 0.004], jamb, 0.0018)
    // Far post.
    place(boardT, postH, cw, [bx, postH / 2, z1 + cw / 2])
    place(proud - face, postH, 0.012, [s * (face + (proud - face) / 2), postH / 2, z1 + cw - 0.006], trim, 0.0035)
    place(0.0055, headY, 0.006, [s * (face + boardT + 0.0005), headY / 2, z1 + 0.004], jamb, 0.0018)
    // Head.
    const hl = z1 - z0 + 2 * cw
    place(boardT, cw, hl, [bx, headY + cw / 2, (z0 + z1) / 2])
    place(proud - face, 0.012, hl, [s * (face + (proud - face) / 2), headY + cw - 0.006, (z0 + z1) / 2], trim, 0.0035)
    // Skirting.
    if (wall) {
      const skirt = (a, b) => {
        if (b - a < 0.01) return
        parts.push(quiet(soft(0.012, 0.095, b - a, trim, [s * (face + 0.006), 0.0475, (a + b) / 2], { r: 0.0035, flat: 2, corner: 2 })))
      }
      skirt(z0 - lenA, z0 - cw)
      skirt(z1 + cw, z1 + lenB)
    }
  }
  // Hinges on the far jamb: two small knuckles, the only metal in the frame.
  for (const y of [0.22, headY - 0.26]) {
    parts.push(soft(0.0025, 0.09, 0.026, mat.frameLight, [face - 0.012, y, z1 - 0.0005], { r: 0.0008, flat: 2, corner: 1 }))
    parts.push(lathe([[0, -0.045], [0.0045, -0.045, 0.001], [0.0045, 0.045, 0.001], [0, 0.045]], mat.frameLight, [face - 0.001, y, z1 - 0.002], 'y', { seg: 12, steps: 1 }))
  }
  // Threshold.
  parts.push(soft(face * 2, 0.008, z1 - z0, jamb, [0, 0.004, (z0 + z1) / 2], { r: 0.002, flat: 2, corner: 1 }))
  return parts
}

// ---------------------------------------------------------------------------------------------------------------------------- furniture

function chair(p) {
  const seatH = p.seatH ?? 0.46
  const wood = M.wood()
  const y = seatH
  const parts = []
  const lx = 0.178
  const fz = 0.178
  const bz = -0.178
  const railTop = y - 0.014
  const railH = 0.05
  for (const s of [-1, 1]) {
    // Front leg: square, tapering to the floor.
    parts.push(bar([[s * (lx + 0.006), 0, fz + 0.006], [s * lx, y - 0.012, fz]], wood, { w: 0.026, d: 0.026, w2: 0.04, d2: 0.04, n: 7, up: [0, 0, 1], rings: 4, cap: 0.06 }))
    // Rear leg and back post, one piece, raked.
    parts.push(bar(
      [[s * (lx + 0.004), 0, bz - 0.05], [s * (lx + 0.001), y * 0.5, bz - 0.016], [s * lx, y - 0.012, bz], [s * (lx - 0.002), y + 0.2, bz - 0.02], [s * (lx - 0.005), y + 0.435, bz - 0.073]],
      wood,
      { w: 0.034, d: 0.04, w2: 0.03, d2: 0.024, n: 7, up: [0, 0, 1], rings: 36, around: 20, cap: 0.08 },
    ))
    // Side rail and side stretcher.
    parts.push(bar([[s * lx, railTop - railH / 2, fz - 0.012], [s * lx, railTop - railH / 2, bz + 0.012]], wood, { w: 0.02, d: railH, n: 6 }))
    parts.push(bar([[s * (lx + 0.003), 0.17, fz + 0.002], [s * (lx + 0.002), 0.17, bz - 0.022]], wood, { w: 0.017, d: 0.024, n: 5 }))
  }
  parts.push(bar([[-lx, railTop - railH / 2, fz], [lx, railTop - railH / 2, fz]], wood, { w: 0.02, d: railH, n: 6 }))
  parts.push(bar([[-lx, railTop - railH / 2, bz], [lx, railTop - railH / 2, bz]], wood, { w: 0.02, d: railH, n: 6 }))
  parts.push(bar([[-lx - 0.002, 0.17, -0.012], [lx + 0.002, 0.17, -0.012]], wood, { w: 0.017, d: 0.022, n: 5 }))
  // Seat: an upholstered pad on a board.
  parts.push(soft(0.42, 0.014, 0.42, wood, [0, y - 0.012, 0], { r: 0.005, flat: 4, corner: 2 }))
  parts.push(soft(0.415, 0.03, 0.415, M.seatFabric(), [0, y + 0.005, 0], { r: 0.012, crown: 0.006, flat: 14, corner: 3 }))
  parts.push(mesh(pipeGeo(roundRectPath(0.407, 0.407, 0.02, y - 0.006), 0.0024, { closed: true, seg: 6, tubular: 130 }), M.piping()))
  // Back: a curved top rail, a lower rail, three slats.
  const rail = (ry, h, t, zc) => bar([[-lx + 0.012, ry, zc + 0.004], [-lx * 0.5, ry, zc - 0.005], [0, ry, zc - 0.008], [lx * 0.5, ry, zc - 0.005], [lx - 0.012, ry, zc + 0.004]], wood, { w: t, d: h, n: 6, rings: 24, around: 18, cap: 0.08 })
  const topY = y + 0.39
  const midY = y + 0.17
  const topZ = bz - 0.056
  const midZ = bz - 0.017
  parts.push(rail(topY, 0.075, 0.019, topZ), rail(midY, 0.034, 0.017, midZ))
  for (const x of [-0.092, 0, 0.092]) {
    const k = Math.abs(x) / 0.092
    parts.push(bar([[x, midY, midZ - 0.008 + 0.003 * k], [x, (midY + topY) / 2, (midZ + topZ) / 2 - 0.008 + 0.003 * k], [x, topY, topZ - 0.008 + 0.003 * k]], wood, { w: 0.034, d: 0.011, n: 5, up: [0, 0, 1], rings: 10, cap: 0.05 }))
  }
  return group(parts)
}

function sofa(p) {
  const w = p.width ?? 1.5
  const armW = 0.17
  const fabric = M.sofaFabric()
  const parts = []
  const seatTop = 0.42
  // Frame.
  parts.push(soft(w - 0.012, 0.19, 0.71, fabric, [0, 0.215, 0], { r: 0.022, crownSide: 0.004, flat: 10, corner: 3 }))
  parts.push(mesh(pipeGeo(roundRectPath(w - 0.014, 0.708, 0.03, 0.128), 0.0034, { closed: true, seg: 6, tubular: 170 }), M.piping()))
  // Seat cushions.
  const inner = w - 2 * armW
  const n = Math.max(1, Math.round(inner / 0.66))
  const cw = inner / n
  const cushH = 0.115
  const cushD = 0.585
  for (let i = 0; i < n; i++) {
    const x = -inner / 2 + cw * (i + 0.5)
    parts.push(soft(cw - 0.004, cushH, cushD, fabric, [x, seatTop - cushH / 2, 0.0675], { r: 0.034, crown: 0.012, crownSide: 0.006, lump: 0.0016, seed: i, flat: 14, corner: 4 }))
    const edge = 0.01
    parts.push(mesh(pipeGeo(roundRectPath(cw - 0.004 - edge * 2, cushD - edge * 2, 0.04, seatTop - edge), 0.0033, { closed: true, seg: 6, tubular: 150 }), M.piping(), [x, 0, 0.0675]))
    // Back cushion, leaning back, its lower edge on the seat.
    const back = soft(cw - 0.012, 0.42, 0.17, fabric, null, { r: 0.05, crownSide: 0.022, crown: 0.006, lump: 0.0035, seed: i + 7, flat: 14, corner: 4 })
    back.position.set(x, 0.63, -0.235)
    back.rotation.x = -0.17
    parts.push(back)
  }
  // Back of the sofa.
  parts.push(soft(w - 0.008, 0.72, 0.14, fabric, [0, 0.48, -0.325], { r: 0.04, crownSide: 0.005, flat: 10, corner: 3 }))
  // Arms: a panel with a soft top roll.
  for (const s of [-1, 1]) {
    const x = s * (w / 2 - armW / 2)
    parts.push(soft(armW, 0.46, 0.725, fabric, [x, 0.35, 0], { r: 0.035, crownSide: 0.006, flat: 10, corner: 3 }))
    parts.push(soft(armW + 0.016, 0.115, 0.735, fabric, [x, 0.585, 0], { r: 0.054, crownSide: 0.003, crown: 0.003, flat: 10, corner: 4 }))
    parts.push(mesh(pipeGeo(roundRectPath(armW + 0.004, 0.725, 0.05, 0.532), 0.0028, { closed: true, seg: 6, tubular: 110 }), M.piping(), [x, 0, 0]))
  }
  // Tapered legs.
  const legs = []
  for (const x of [-w / 2 + 0.055, w / 2 - 0.055]) for (const z of [-0.31, 0.31]) legs.push([x, z])
  if (w > 1.7) for (const z of [-0.31, 0.31]) legs.push([0, z])
  for (const [x, z] of legs) parts.push(lathe([[0, 0], [0.013, 0, 0.002], [0.024, 0.122, 0.001], [0, 0.122]], M.wood(), [x, 0, z], 'y', { seg: 20, steps: 2 }))
  return group(parts)
}

function table(p) {
  const hT = p.height ?? 0.75
  const wood = M.wood()
  const parts = [soft(1.1, 0.034, 0.7, wood, [0, hT - 0.017, 0], { r: 0.008, flat: 8, corner: 2 })]
  for (const x of [-0.5, 0.5]) {
    for (const z of [-0.3, 0.3]) {
      parts.push(bar([[x + Math.sign(x) * 0.006, 0, z + Math.sign(z) * 0.006], [x, hT - 0.03, z]], wood, { w: 0.034, d: 0.034, w2: 0.055, d2: 0.055, n: 7, up: [0, 0, 1], rings: 4, cap: 0.05 }))
    }
  }
  for (const z of [-0.3, 0.3]) parts.push(bar([[-0.5, hT - 0.07, z], [0.5, hT - 0.07, z]], wood, { w: 0.022, d: 0.07, n: 6, cap: 0.05 }))
  for (const x of [-0.5, 0.5]) parts.push(bar([[x, hT - 0.07, -0.3], [x, hT - 0.07, 0.3]], wood, { w: 0.022, d: 0.07, n: 6, cap: 0.05 }))
  return group(parts)
}

export default {
  chair,
  sofa,
  table,
  wall(p) {
    const w = p.width ?? 30
    const h = p.height ?? 3.4
    const parts = [box(w, h, 0.08, M.wallPaint(), [0, h / 2, 0])]
    if (p.skirting !== false) {
      for (const s of [-1, 1]) {
        parts.push(soft(w, 0.09, 0.012, M.trim(), [0, 0.045, s * 0.046], { r: 0.0035, flat: 2, corner: 2 }))
      }
    }
    return group(parts)
  },
  step(p) {
    const h = p.height ?? 0.17
    const w = p.width ?? 0.7
    const d = p.depth ?? 0.28
    const treadT = Math.min(0.03, h * 0.5)
    const parts = [
      soft(w, treadT, d + 0.012, M.wood(), [0, h - treadT / 2, -0.006], { r: 0.0065, flat: 8, corner: 3 }),
      soft(w - 0.008, h - treadT + 0.002, d - 0.008, M.jamb(), [0, (h - treadT + 0.002) / 2, 0], { r: 0.004, flat: 4, corner: 2 }),
    ]
    // Non-slip grooves behind the nosing.
    const front = -d / 2 - 0.012
    for (const q of [0.026, 0.04, 0.054]) parts.push(box(w - 0.05, 0.0006, 0.0035, mat.iron, [0, h + 0.0002, front + q]))
    return group(parts)
  },
  towel(p, ctx) {
    return placeOnFloor(foldedTowel(p), p, ctx)
  },
  'towel-strip': twistedTowel,
  'door-frame'(p) {
    const w = p.width ?? 0.8
    const h = p.headY ?? p.height ?? 2.1
    const lenS = p.wall === false ? 0 : p.wallWidth ?? 1.2
    const inner = group(doorway({ z0: -w / 2, z1: w / 2, headY: h, height: p.wallHeight ?? 3, lenA: lenS, lenB: lenS, wall: p.wall !== false }))
    // Built along Z; this door sits in the plane z = pos.z.
    inner.rotation.y = Math.PI / 2
    return group(inner)
  },
  'door-corner'(p) {
    const open = p.opening ?? 0.8
    const len = p.length ?? 6
    const h = p.height ?? 3
    const headY = p.headY ?? 2.1
    return group(doorway({ z0: 0, z1: open, headY, height: h, lenA: len, lenB: len, stopOnNear: true }))
  },
}
