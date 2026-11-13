// The catalog's facts about an exercise, for the tempo (motion.js) and the motion checks (qa-lib.mjs): category, movement pattern,
// force type, primary muscles, name. From prisma/seed-data/exercises.generated.json, read once.
//
//   import { catalogInfo } from './catalog.mjs'
//   catalogInfo('barbell-full-squat')  // { category: 'STRENGTH', movementPattern: 'squat', forceType: 'PUSH', ... }
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FILE = path.join(HERE, '..', '..', 'prisma', 'seed-data', 'exercises.generated.json')
let bySlug = null

export function catalogInfo(slug) {
  if (!bySlug) {
    bySlug = new Map()
    try {
      for (const e of JSON.parse(fs.readFileSync(FILE, 'utf8'))) {
        bySlug.set(e.slug, {
          category: e.category,
          movementPattern: e.movementPattern,
          forceType: e.forceType,
          mechanics: e.mechanics,
          laterality: e.laterality,
          primaryMuscles: e.primaryMuscles,
          nameEn: e.nameEn,
          namePt: e.namePt,
        })
      }
    } catch (e) {
      // No catalog (a checkout without the seed data): everything falls back to the defaults.
    }
  }
  return bySlug.get(slug) || {}
}
