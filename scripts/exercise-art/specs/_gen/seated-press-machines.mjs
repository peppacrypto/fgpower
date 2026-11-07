import fs from 'fs';
const G = n => JSON.parse(fs.readFileSync(new URL(`../_gallery/${n}.json`, import.meta.url)));
const map = {
 'leverage-chest-press':'chest-press','machine-bench-press':'chest-press-stack',
 'leverage-incline-chest-press':'chest-press-incline','leverage-decline-chest-press':'chest-press-decline',
 'leverage-shoulder-press':'shoulder-press','machine-shoulder-military-press':'shoulder-press-stack',
 'cable-chest-press':'seated-cable-press','incline-cable-chest-press':'seated-cable-press-incline',
 'seated-cable-shoulder-press':'seated-cable-press-shoulder','dip-machine':'dip-machine'};
for (const [slug,g] of Object.entries(map)) {
  const s = {...G(g), slug};
  fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify(s,null,1));
}
// dip-machine: neutral grip, fingers forward, palms in
{ const p = new URL('../dip-machine.json', import.meta.url); const s = JSON.parse(fs.readFileSync(p));
  for (const f of Object.values(s.frames)) for (const [k,sd] of [['armL',1],['armR',-1]]) if (f[k]) { f[k].fingers=[0.45*sd,-0.3,0.84]; f[k].palm=[-0.5*sd,-0.85,0.1]; }
  fs.writeFileSync(p, JSON.stringify(s,null,1)); }

// post-fix: rotate grip (fingers+palm) about palm axis so the wrist is not ulnar-deviated; shift cable-press hands/chest clear
const ROT = {'leverage-shoulder-press':25,'machine-shoulder-military-press':25,'leverage-incline-chest-press':25,'incline-cable-chest-press':25,'seated-cable-shoulder-press':25,'cable-chest-press':25};
const PU={'cable-chest-press':{pulleyX:0.6,pulleyY:0.6}};
const ROOTZ={'incline-cable-chest-press':0.03,'seated-cable-shoulder-press':0.03};
const rot = (v,a,deg)=>{const r=deg*Math.PI/180,c=Math.cos(r),s=Math.sin(r),d=a[0]*v[0]+a[1]*v[1]+a[2]*v[2];
  const x=[a[1]*v[2]-a[2]*v[1],a[2]*v[0]-a[0]*v[2],a[0]*v[1]-a[1]*v[0]];
  return [0,1,2].map(i=>+(v[i]*c+x[i]*s+a[i]*d*(1-c)).toFixed(4));};
for (const [slug,deg] of Object.entries(ROT)) {
  const p = new URL(`../${slug}.json`, import.meta.url); const s = JSON.parse(fs.readFileSync(p));
  for (const f of Object.values(s.frames)) for (const [k,sd] of [['armL',1],['armR',-1]]) if (f[k]?.palm) f[k].fingers = rot(f[k].fingers,f[k].palm,deg*sd);
  if (PU[slug]) Object.assign(s.props[0],PU[slug]);
  if (ROOTZ[slug]) for (const f of Object.values(s.frames)) f.root.pos[2]+=ROOTZ[slug];
  fs.writeFileSync(p, JSON.stringify(s,null,1)); }
