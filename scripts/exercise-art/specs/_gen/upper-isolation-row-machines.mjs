const RZ = 0.01;
import fs from 'fs';
const G = n => JSON.parse(fs.readFileSync(new URL(`../_gallery/${n}.json`, import.meta.url)));
const map = {'reverse-machine-flyes':'pec-deck-reverse','butterfly':'pec-deck','machine-bicep-curl':'machine-curl','machine-triceps-extension':'machine-triceps','ab-crunch-machine':'ab-crunch','leverage-iso-row':'iso-row','leverage-high-row':'high-row'};
const patch = {
  'butterfly': s => { for (const a of ['armL','armR']) s.frames.end[a].fk.abd = 4; },
  'ab-crunch-machine': s => { for (const f of Object.values(s.frames)) for (const a of ['armL','armR']) { f[a].pos[1] = 0.335; f[a].pos[2] = 0.13; } s.frames.start.spine.flex = 2; for (const f of Object.values(s.frames)) f.root.pos[2] = RZ; },
  'machine-bicep-curl': s => { for (const f of Object.values(s.frames)) f.neck.flex = -6; },
  'machine-triceps-extension': s => { for (const f of Object.values(s.frames)) for (const l of ['legL','legR']) f[l].fk.abd = 16; },
};
for (const [slug,g] of Object.entries(map)) { const s = {...G(g), slug}; patch[slug]?.(s); fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify(s,null,1)); }
console.log(Object.keys(map).join(' '));
