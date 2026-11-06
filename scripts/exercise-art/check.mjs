#!/usr/bin/env node
// Solves a pose spec without rendering anything. Fast, needs no browser and no lock, so use it freely while tuning.
//
//   node check.mjs specs/pushups.json [more.json ...]
//
// Prints, per frame: limbs that cannot reach (metres), forearm twist, elbow and knee angles (0 = straight), the lowest
// point of the body and which part it is, how high the trunk is off the floor (about 0 when lying on it), and the main
// joint positions.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Body } from './rig.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const body = new Body(JSON.parse(fs.readFileSync(path.join(HERE, 'build', 'body.json'), 'utf8')))
const fmt = (a) => a.map((x) => x.toFixed(2)).join(',')

const files = process.argv.slice(2)
if (!files.length) {
  const s = body.side.L
  const v = (x) => [x.x, x.y, x.z]
  console.log('Landmarks on the figure\'s left side, in the rest pose (metres):')
  for (const [k, x] of Object.entries({ shoulder: s.S, elbow: s.E, wrist: s.W, hip: s.H, knee: s.K, ankle: s.A, heel: s.heel, ball: s.ball, sole: s.sole, palm: s.palmCentre })) {
    console.log(`  ${k.padEnd(9)} ${fmt(v(x))}`)
  }
  console.log(`  upper arm ${s.a.toFixed(3)}  forearm ${s.b.toFixed(3)}  thigh ${s.c.toFixed(3)}  shin ${s.d.toFixed(3)}`)
  console.log(`  pelvis centre ${fmt(v(body.pelvisCentre))}  spine01 ${fmt(v(body.by.spine01.head))}  head joint ${fmt(v(body.by.head.head))}`)
  process.exit(0)
}

let bad = 0
for (const file of files) {
  const spec = JSON.parse(fs.readFileSync(file, 'utf8'))
  console.log(`\n${spec.slug || path.basename(file)}`)
  for (const [name, frame] of Object.entries(spec.frames)) {
    const { report: r } = body.solve(frame)
    const miss = Object.entries(r.reach).filter(([, m]) => m > 0.005).map(([k, m]) => `${k} ${m}`)
    const twist = Object.entries(r.twist).filter(([, t]) => Math.abs(t) > 110).map(([k, t]) => `${k} ${t}`)
    const small = /^(finger|toe)/.test(r.lowestPart)
    const sink = r.lowestPoint < (small ? -0.03 : -0.012)
    const float = r.lowestPoint > 0.03 && !spec.floats
    if (miss.length || twist.length || sink || float) bad++
    console.log(`  ${name.padEnd(5)} elbows ${r.angles.elbowL}/${r.angles.elbowR} knees ${r.angles.kneeL}/${r.angles.kneeR} lowest ${r.lowestPoint} (${r.lowestPart}) trunk ${r.trunkLowest}${miss.length ? ' MISS ' + miss.join(' ') : ''}${twist.length ? ' TWIST ' + twist.join(' ') : ''}${sink ? ' SINKS' : ''}${float ? ' FLOATS' : ''}`)
    // A towel rope has one length: it can't stretch between frames.
    for (const prop of frame.props || []) {
      if (prop.type !== 'towel-strip') continue
      const pts = prop.points || [prop.a, prop.b]
      let len = 0
      for (let i = 0; i + 1 < pts.length; i++) len += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1], pts[i + 1][2] - pts[i][2])
      console.log(`        towel length ${len.toFixed(2)} m`)
    }
    const j = r.joints
    console.log(`        head ${fmt(j.head)} chest ${fmt(j.spine01)} hipL ${fmt(j['upperleg01.L'])} kneeL ${fmt(j['lowerleg01.L'])} ankleL ${fmt(j['foot.L'])} ankleR ${fmt(j['foot.R'])}`)
    console.log(`        shL ${fmt(j['upperarm01.L'])} elbowL ${fmt(j['lowerarm01.L'])} wristL ${fmt(j['wrist.L'])} wristR ${fmt(j['wrist.R'])}`)
  }
}
process.exit(bad ? 1 : 0)
