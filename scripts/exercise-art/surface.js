// From the skinned control mesh to the surface we draw. No DOM and no three.js: plain typed arrays, run once per frame.
//
//   skinned control mesh -> Delta Mush -> one level of Catmull-Clark -> smooth normals
//
// Delta Mush (Mancewicz et al. 2014): the rest shape is smoothed by Laplacian iterations and each vertex remembers its
// offset from that smooth shape in a local tangent frame. Per frame the skinned shape gets the same smoothing and the
// offsets go back on, in the new frames. Pinches and ridges from the skinning live in the part that is smoothed away,
// muscle and bone detail lives in the offsets, so it comes back unchanged. `strength` says how much each vertex takes
// part: 0 leaves it exactly where the skinning put it (face, fingers), 1 is full.
//
// Catmull-Clark: one level, as flat loops over precomputed topology. The result has quads only. Boundaries, if there
// are any, follow the crease rule. Triangles are handled by the general rule, so a mesh may mix them with quads.
//
// Fine mesh vertex order: the n control vertices (moved), then one per edge, then one per face. So a value that lives on
// the control mesh can be carried to the fine mesh with subdivideAttribute().

export class Surface {
  /**
   * @param {Float32Array} rest control mesh rest positions
   * @param {Int32Array|number[]} faces 4 indices per face, the 4th being -1 for a triangle
   * @param {{strength?: Float32Array, iterations?: number, lambda?: number}} opts
   */
  constructor(rest, faces, opts = {}) {
    this.n = rest.length / 3
    this.faces = faces
    this.nf = faces.length / 4
    this._topology()
    this.iterations = opts.iterations ?? 16
    this.lambda = opts.lambda ?? 0.6
    this.strength = this._blurred(opts.strength || new Float32Array(this.n).fill(1), opts.strengthBlur ?? 3)
    this._a = new Float64Array(this.n * 3)
    this._b = new Float64Array(this.n * 3)
    this._cn = new Float64Array(this.n * 3)
    this._tan = new Float64Array(this.n * 3)
    this.mushed = new Float32Array(this.n * 3)
    this.fine = new Float32Array(this.N * 3)
    this.normals = new Float32Array(this.N * 3)
    this._mushRest(rest)
    // Rest positions on the fine mesh: the paint system reads them as aRest.
    this.fineRest = new Float32Array(this.N * 3)
    this._subdivide(rest, this.fineRest)
  }

  _topology() {
    const { n, nf, faces } = this
    const faceSize = new Uint8Array(nf)
    const edgeIndex = new Map()
    const ev = []
    const ef = []
    const faceEdges = new Int32Array(nf * 4).fill(-1)
    for (let f = 0; f < nf; f++) {
      const k = faces[f * 4 + 3] < 0 ? 3 : 4
      faceSize[f] = k
      for (let i = 0; i < k; i++) {
        const a = faces[f * 4 + i]
        const b = faces[f * 4 + (i + 1) % k]
        const key = a < b ? a * n + b : b * n + a
        let e = edgeIndex.get(key)
        if (e === undefined) {
          e = ev.length / 2
          edgeIndex.set(key, e)
          ev.push(Math.min(a, b), Math.max(a, b))
          ef.push(f, -1)
        } else if (ef[e * 2 + 1] === -1) {
          ef[e * 2 + 1] = f
        } else {
          // More than two faces on an edge: treat it as a boundary, which is at least stable.
          ef[e * 2 + 1] = -2
        }
        faceEdges[f * 4 + i] = e
      }
    }
    this.faceSize = faceSize
    this.faceEdges = faceEdges
    this.E = ev.length / 2
    this.ev = Int32Array.from(ev)
    this.ef = Int32Array.from(ef)
    this.N = n + this.E + nf

    // Vertex to neighbours and vertex to faces, compressed.
    const nbrCount = new Int32Array(n + 1)
    for (let e = 0; e < this.E; e++) {
      nbrCount[this.ev[e * 2]]++
      nbrCount[this.ev[e * 2 + 1]]++
    }
    const nbrOff = new Int32Array(n + 1)
    for (let v = 0; v < n; v++) nbrOff[v + 1] = nbrOff[v] + nbrCount[v]
    const nbr = new Int32Array(nbrOff[n])
    const fill = nbrOff.slice()
    for (let e = 0; e < this.E; e++) {
      const a = this.ev[e * 2]
      const b = this.ev[e * 2 + 1]
      nbr[fill[a]++] = b
      nbr[fill[b]++] = a
    }
    this.nbrOff = nbrOff
    this.nbr = nbr

    const fCount = new Int32Array(n + 1)
    for (let f = 0; f < nf; f++) for (let i = 0; i < faceSize[f]; i++) fCount[faces[f * 4 + i]]++
    const fOff = new Int32Array(n + 1)
    for (let v = 0; v < n; v++) fOff[v + 1] = fOff[v] + fCount[v]
    const vf = new Int32Array(fOff[n])
    const ffill = fOff.slice()
    for (let f = 0; f < nf; f++) for (let i = 0; i < faceSize[f]; i++) vf[ffill[faces[f * 4 + i]]++] = f
    this.vfOff = fOff
    this.vf = vf

    // Boundary vertices: their two boundary neighbours. -1 means an interior vertex, -2 a corner that stays put.
    const b0 = new Int32Array(n).fill(-1)
    const b1 = new Int32Array(n).fill(-1)
    const bc = new Uint8Array(n)
    let boundaryEdges = 0
    for (let e = 0; e < this.E; e++) {
      if (this.ef[e * 2 + 1] >= 0) continue
      boundaryEdges++
      const a = this.ev[e * 2]
      const b = this.ev[e * 2 + 1]
      if (bc[a] === 0) b0[a] = b
      else b1[a] = b
      if (bc[b] === 0) b0[b] = a
      else b1[b] = a
      bc[a]++
      bc[b]++
    }
    this.boundaryEdges = boundaryEdges
    this.bCount = bc
    this.b0 = b0
    this.b1 = b1

    // Fine quads: one per corner of each control face, and their triangles for drawing.
    let nq = 0
    for (let f = 0; f < nf; f++) nq += faceSize[f]
    const fq = new Int32Array(nq * 4)
    let q = 0
    for (let f = 0; f < nf; f++) {
      const k = faceSize[f]
      const fp = n + this.E + f
      for (let i = 0; i < k; i++) {
        const v = faces[f * 4 + i]
        const eNext = n + faceEdges[f * 4 + i]
        const ePrev = n + faceEdges[f * 4 + (i + k - 1) % k]
        fq[q++] = v
        fq[q++] = eNext
        fq[q++] = fp
        fq[q++] = ePrev
      }
    }
    this.fineQuads = fq
    this.nq = nq
    const index = new Uint32Array(nq * 6)
    for (let i = 0, t = 0; i < nq; i++) {
      const a = fq[i * 4]
      const b = fq[i * 4 + 1]
      const c = fq[i * 4 + 2]
      const d = fq[i * 4 + 3]
      index[t++] = a
      index[t++] = b
      index[t++] = c
      index[t++] = a
      index[t++] = c
      index[t++] = d
    }
    this.index = index
  }

  /** Spreads a per-vertex mask along the mesh, so nothing that depends on it has a visible edge. */
  _blurred(mask, iterations) {
    const { n, nbrOff, nbr } = this
    let a = Float32Array.from(mask)
    for (let it = 0; it < iterations; it++) {
      const b = new Float32Array(n)
      for (let v = 0; v < n; v++) {
        let sum = 0
        for (let o = nbrOff[v]; o < nbrOff[v + 1]; o++) sum += a[nbr[o]]
        b[v] = 0.5 * a[v] + (0.5 * sum) / Math.max(1, nbrOff[v + 1] - nbrOff[v])
      }
      a = b
    }
    return a
  }

  /** Control-mesh normals by summing the faces' area vectors. Works on Float64Array positions. */
  _controlNormals(p, out) {
    out.fill(0)
    const { faces, nf, faceSize } = this
    for (let f = 0; f < nf; f++) {
      const k = faceSize[f]
      const a = faces[f * 4] * 3
      const b = faces[f * 4 + 1] * 3
      const c = faces[f * 4 + 2] * 3
      const d = (k === 4 ? faces[f * 4 + 3] : faces[f * 4]) * 3
      // Half the cross of the diagonals is the area vector of a quad, and of a triangle when d = a.
      const ux = p[c] - p[a]
      const uy = p[c + 1] - p[a + 1]
      const uz = p[c + 2] - p[a + 2]
      const vx = p[d] - p[b]
      const vy = p[d + 1] - p[b + 1]
      const vz = p[d + 2] - p[b + 2]
      const nx = uy * vz - uz * vy
      const ny = uz * vx - ux * vz
      const nz = ux * vy - uy * vx
      for (let i = 0; i < k; i++) {
        const w = faces[f * 4 + i] * 3
        out[w] += nx
        out[w + 1] += ny
        out[w + 2] += nz
      }
    }
  }

  /** Laplacian smoothing of src (n*3), returns the buffer holding the result. */
  _smooth(src) {
    const { n, nbrOff, nbr, strength, lambda, iterations } = this
    let a = this._a
    let b = this._b
    for (let i = 0; i < n * 3; i++) a[i] = src[i]
    for (let it = 0; it < iterations; it++) {
      for (let v = 0; v < n; v++) {
        const w = strength[v] * lambda
        const v3 = v * 3
        const ax = a[v3]
        const ay = a[v3 + 1]
        const az = a[v3 + 2]
        if (w <= 0) {
          b[v3] = ax
          b[v3 + 1] = ay
          b[v3 + 2] = az
          continue
        }
        let sx = 0
        let sy = 0
        let sz = 0
        const o0 = nbrOff[v]
        const o1 = nbrOff[v + 1]
        for (let o = o0; o < o1; o++) {
          const u3 = nbr[o] * 3
          sx += a[u3]
          sy += a[u3 + 1]
          sz += a[u3 + 2]
        }
        const inv = w / (o1 - o0)
        b[v3] = ax + (sx * inv - ax * w)
        b[v3 + 1] = ay + (sy * inv - ay * w)
        b[v3 + 2] = az + (sz * inv - az * w)
      }
      const t = a
      a = b
      b = t
    }
    return a
  }

  /**
   * The tangent frame of every vertex of the smoothed shape s: this._cn holds the unit normals, this._tan the unit
   * tangents, along the first neighbour's edge, or the next one's if that edge runs nearly along the normal.
   */
  _frames(s) {
    const { n, nbrOff, nbr, _cn: cn, _tan: tan } = this
    this._controlNormals(s, cn)
    for (let v = 0; v < n; v++) {
      const v3 = v * 3
      let nx = cn[v3]
      let ny = cn[v3 + 1]
      let nz = cn[v3 + 2]
      const l = Math.hypot(nx, ny, nz) || 1
      nx /= l
      ny /= l
      nz /= l
      cn[v3] = nx
      cn[v3 + 1] = ny
      cn[v3 + 2] = nz
      let tx = 0
      let ty = 0
      let tz = 0
      for (let o = nbrOff[v]; o < nbrOff[v + 1]; o++) {
        const u3 = nbr[o] * 3
        tx = s[u3] - s[v3]
        ty = s[u3 + 1] - s[v3 + 1]
        tz = s[u3 + 2] - s[v3 + 2]
        const dot = tx * nx + ty * ny + tz * nz
        const edge2 = tx * tx + ty * ty + tz * tz
        tx -= dot * nx
        ty -= dot * ny
        tz -= dot * nz
        if (tx * tx + ty * ty + tz * tz > 0.04 * edge2) break
      }
      const tl = Math.hypot(tx, ty, tz) || 1
      tan[v3] = tx / tl
      tan[v3 + 1] = ty / tl
      tan[v3 + 2] = tz / tl
    }
  }

  _mushRest(rest) {
    const { n, _cn: cn, _tan: tan } = this
    const s = this._smooth(rest)
    this._frames(s)
    const d = new Float32Array(n * 3)
    for (let v = 0; v < n; v++) {
      const v3 = v * 3
      const nx = cn[v3]
      const ny = cn[v3 + 1]
      const nz = cn[v3 + 2]
      const tx = tan[v3]
      const ty = tan[v3 + 1]
      const tz = tan[v3 + 2]
      const ox = rest[v3] - s[v3]
      const oy = rest[v3 + 1] - s[v3 + 1]
      const oz = rest[v3 + 2] - s[v3 + 2]
      d[v3] = ox * tx + oy * ty + oz * tz
      d[v3 + 1] = ox * (ny * tz - nz * ty) + oy * (nz * tx - nx * tz) + oz * (nx * ty - ny * tx)
      d[v3 + 2] = ox * nx + oy * ny + oz * nz
    }
    this.delta = d
  }

  /** Delta Mush of skinned control positions into this.mushed. */
  mush(p) {
    const { n, delta: d, mushed: out, _cn: cn, _tan: tan } = this
    const s = this._smooth(p)
    this._frames(s)
    for (let v = 0; v < n; v++) {
      const v3 = v * 3
      const nx = cn[v3]
      const ny = cn[v3 + 1]
      const nz = cn[v3 + 2]
      const tx = tan[v3]
      const ty = tan[v3 + 1]
      const tz = tan[v3 + 2]
      const d0 = d[v3]
      const d1 = d[v3 + 1]
      const d2 = d[v3 + 2]
      out[v3] = s[v3] + d0 * tx + d1 * (ny * tz - nz * ty) + d2 * nx
      out[v3 + 1] = s[v3 + 1] + d0 * ty + d1 * (nz * tx - nx * tz) + d2 * ny
      out[v3 + 2] = s[v3 + 2] + d0 * tz + d1 * (nx * ty - ny * tx) + d2 * nz
    }
    return out
  }

  /** One level of Catmull-Clark from src (control, n*3) into dst (fine, N*3). */
  _subdivide(src, dst) {
    const { n, nf, E, faces, faceSize, ev, ef, nbrOff, nbr, vfOff, vf, bCount, b0, b1 } = this
    const fp0 = n + E
    for (let f = 0; f < nf; f++) {
      const k = faceSize[f]
      let x = 0
      let y = 0
      let z = 0
      for (let i = 0; i < k; i++) {
        const v3 = faces[f * 4 + i] * 3
        x += src[v3]
        y += src[v3 + 1]
        z += src[v3 + 2]
      }
      const o = (fp0 + f) * 3
      dst[o] = x / k
      dst[o + 1] = y / k
      dst[o + 2] = z / k
    }
    for (let e = 0; e < E; e++) {
      const a = ev[e * 2] * 3
      const b = ev[e * 2 + 1] * 3
      const o = (n + e) * 3
      const f0 = ef[e * 2]
      const f1 = ef[e * 2 + 1]
      if (f1 >= 0) {
        const p = (fp0 + f0) * 3
        const q = (fp0 + f1) * 3
        dst[o] = (src[a] + src[b] + dst[p] + dst[q]) * 0.25
        dst[o + 1] = (src[a + 1] + src[b + 1] + dst[p + 1] + dst[q + 1]) * 0.25
        dst[o + 2] = (src[a + 2] + src[b + 2] + dst[p + 2] + dst[q + 2]) * 0.25
      } else {
        dst[o] = (src[a] + src[b]) * 0.5
        dst[o + 1] = (src[a + 1] + src[b + 1]) * 0.5
        dst[o + 2] = (src[a + 2] + src[b + 2]) * 0.5
      }
    }
    for (let v = 0; v < n; v++) {
      const v3 = v * 3
      const c = bCount[v]
      if (c === 0) {
        const val = nbrOff[v + 1] - nbrOff[v]
        let fx = 0
        let fy = 0
        let fz = 0
        for (let o = vfOff[v]; o < vfOff[v + 1]; o++) {
          const p = (fp0 + vf[o]) * 3
          fx += dst[p]
          fy += dst[p + 1]
          fz += dst[p + 2]
        }
        let ex = 0
        let ey = 0
        let ez = 0
        for (let o = nbrOff[v]; o < nbrOff[v + 1]; o++) {
          const u3 = nbr[o] * 3
          ex += src[u3]
          ey += src[u3 + 1]
          ez += src[u3 + 2]
        }
        const i2 = 1 / (val * val)
        const w = (val - 2) / val
        dst[v3] = (fx + ex) * i2 + src[v3] * w
        dst[v3 + 1] = (fy + ey) * i2 + src[v3 + 1] * w
        dst[v3 + 2] = (fz + ez) * i2 + src[v3 + 2] * w
      } else if (c === 2) {
        const a = b0[v] * 3
        const b = b1[v] * 3
        dst[v3] = (src[a] + src[b] + 6 * src[v3]) * 0.125
        dst[v3 + 1] = (src[a + 1] + src[b + 1] + 6 * src[v3 + 1]) * 0.125
        dst[v3 + 2] = (src[a + 2] + src[b + 2] + 6 * src[v3 + 2]) * 0.125
      } else {
        dst[v3] = src[v3]
        dst[v3 + 1] = src[v3 + 1]
        dst[v3 + 2] = src[v3 + 2]
      }
    }
  }

  /** Smooth normals of the fine mesh, from the area vectors of its quads, so the triangulation doesn't bias them. */
  _fineNormals() {
    const { fine: p, normals: out, fineQuads: q, nq, N } = this
    out.fill(0)
    for (let i = 0; i < nq; i++) {
      const a = q[i * 4] * 3
      const b = q[i * 4 + 1] * 3
      const c = q[i * 4 + 2] * 3
      const d = q[i * 4 + 3] * 3
      const ux = p[c] - p[a]
      const uy = p[c + 1] - p[a + 1]
      const uz = p[c + 2] - p[a + 2]
      const vx = p[d] - p[b]
      const vy = p[d + 1] - p[b + 1]
      const vz = p[d + 2] - p[b + 2]
      const nx = uy * vz - uz * vy
      const ny = uz * vx - ux * vz
      const nz = ux * vy - uy * vx
      out[a] += nx
      out[a + 1] += ny
      out[a + 2] += nz
      out[b] += nx
      out[b + 1] += ny
      out[b + 2] += nz
      out[c] += nx
      out[c + 1] += ny
      out[c + 2] += nz
      out[d] += nx
      out[d + 1] += ny
      out[d + 2] += nz
    }
    for (let i = 0; i < N * 3; i += 3) {
      const l = 1 / (Math.hypot(out[i], out[i + 1], out[i + 2]) || 1)
      out[i] *= l
      out[i + 1] *= l
      out[i + 2] *= l
    }
  }

  /** Skinned control positions in, this.fine and this.normals out. */
  update(skinned) {
    const m = this.mush(skinned)
    this._subdivide(m, this.fine)
    this._fineNormals()
    return this.fine
  }

  /** Carries a per-vertex scalar to the fine mesh: edge and face points take the mean of their control vertices. */
  subdivideAttribute(a) {
    const { n, nf, E, faces, faceSize, ev } = this
    const out = new Float32Array(this.N)
    for (let v = 0; v < n; v++) out[v] = a[v]
    for (let e = 0; e < E; e++) out[n + e] = 0.5 * (a[ev[e * 2]] + a[ev[e * 2 + 1]])
    for (let f = 0; f < nf; f++) {
      let s = 0
      const k = faceSize[f]
      for (let i = 0; i < k; i++) s += a[faces[f * 4 + i]]
      out[n + E + f] = s / k
    }
    return out
  }
}
