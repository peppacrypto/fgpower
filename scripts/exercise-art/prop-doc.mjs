#!/usr/bin/env node
// Prints what a poser needs about one or more prop types: the module's general notes, the lines of its header that talk about
// the type, and the gallery specs that use it. Cheaper than reading a whole module.
//
//   node prop-doc.mjs leg-press lat-pulldown
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const mods = fs.readdirSync(path.join(HERE, 'props')).filter((f) => f.endsWith('.js') && !['index.js', 'kit.js'].includes(f))
for (const type of process.argv.slice(2)) {
  let found = false
  for (const m of mods) {
    const text = fs.readFileSync(path.join(HERE, 'props', m), 'utf8')
    if (!new RegExp(`['"]?${type}['"]?\\s*\\(p|['"]${type}['"]\\s*[:(]|^\\s*${type}\\(`, 'm').test(text)) continue
    found = true
    const lines = text.split('\n')
    const head = []
    for (const l of lines) {
      if (!l.startsWith('//')) break
      head.push(l)
    }
    const out = []
    head.forEach((l, i) => {
      if (l.includes(type)) {
        out.push(l)
        for (let j = i + 1; j < head.length && /^\/\/\s{2,}/.test(head[j]) && j < i + 9; j++) if (!out.includes(head[j])) out.push(head[j])
      }
    })
    console.log(`== ${type} (props/${m})`)
    console.log((out.length ? out : head.slice(0, 12)).join('\n').slice(0, 2600))
  }
  if (!found) console.log(`== ${type}: no such prop`)
  const dir = path.join(HERE, 'specs', '_gallery')
  const g = fs.readdirSync(dir).filter((f) => fs.readFileSync(path.join(dir, f), 'utf8').includes(`"${type}"`))
  console.log(`gallery: ${g.slice(0, 6).map((f) => `specs/_gallery/${f}`).join(' ') || 'none'}`)
}
