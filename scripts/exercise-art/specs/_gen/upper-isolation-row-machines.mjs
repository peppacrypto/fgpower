const RZ = 0.01;
import fs from 'fs';
const G = n => JSON.parse(fs.readFileSync(new URL(`../_gallery/${n}.json`, import.meta.url)));
const map = {'reverse-machine-flyes':'pec-deck-reverse','butterfly':'pec-deck','machine-bicep-curl':'machine-curl','machine-triceps-extension':'machine-triceps','ab-crunch-machine':'ab-crunch','leverage-iso-row':'iso-row','leverage-high-row':'high-row'};
const reach = (dz,dy=0) => s => { for (const a of ['armL','armR']) { s.frames.start[a].pos[2] += dz; s.frames.start[a].pos[1] += dy; } };
const patch = {
  'leverage-iso-row': s => { reach(0.10)(s); for (const [a,sd] of [['armL',1],['armR',-1]]) { const e = s.frames.end[a]; e.pos[1] -= 0.06; e.pole = [0.3*sd, -0.2, -1]; e.scap = {prot: -1}; } },
  'leverage-high-row': s => { reach(0.14,0.10)(s); for (const [a,sd] of [['armL',1],['armR',-1]]) { const e = s.frames.end[a]; e.pole = [0.4*sd, -0.5, -0.8]; e.scap = {prot: -1}; } },
  'butterfly': s => { for (const a of ['armL','armR']) s.frames.end[a].fk.abd = 4; },
  // Hands ON the handles (pos on the handle's axis, chest frame), palms up, fingers back along the forearm, elbows forward over
  // the pads: the wrist stays straight with the elbow up, so the upper arms rest on the pads instead of being pulled into them.
  'ab-crunch-machine': s => { for (const f of Object.values(s.frames)) for (const [a,sd] of [['armL',1],['armR',-1]]) Object.assign(f[a], { pos: [0.24*sd, 0.30, 0.122], pole: [0.3*sd, 0.4, 1], fingers: [0, 0.25, -0.97], palm: [0, 0.97, 0.25] }); s.frames.start.spine.flex = 2; for (const f of Object.values(s.frames)) f.root.pos[2] = RZ; },
  'machine-bicep-curl': s => { for (const f of Object.values(s.frames)) f.neck.flex = -6; },
  'machine-triceps-extension': s => { for (const f of Object.values(s.frames)) for (const l of ['legL','legR']) f[l].fk.abd = 16; },
};
for (const [slug,g] of Object.entries(map)) { const s = {...G(g), slug}; patch[slug]?.(s); fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify(s,null,1)); }
console.log(Object.keys(map).join(' '));
