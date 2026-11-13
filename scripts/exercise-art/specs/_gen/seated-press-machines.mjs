import fs from 'fs';
import { pressArc, DIP } from '../../props/machines.js';
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

// post-fix: rotate grip (fingers+palm) about palm axis so the wrist is not ulnar-deviated; shift cable-press hands/chest clear
const ROT = {'leverage-incline-chest-press':25,'incline-cable-chest-press':25,'seated-cable-shoulder-press':35,'cable-chest-press':25};
const PU={'cable-chest-press':{pulleyX:0.6,pulleyY:0.6}};
const ROOTZ={'cable-chest-press':0.03,'incline-cable-chest-press':0.03,'seated-cable-shoulder-press':0.03};
const rot = (v,a,deg)=>{const r=deg*Math.PI/180,c=Math.cos(r),s=Math.sin(r),d=a[0]*v[0]+a[1]*v[1]+a[2]*v[2];
  const x=[a[1]*v[2]-a[2]*v[1],a[2]*v[0]-a[0]*v[2],a[0]*v[1]-a[1]*v[0]];
  return [0,1,2].map(i=>+(v[i]*c+x[i]*s+a[i]*d*(1-c)).toFixed(4));};
for (const [slug,deg] of Object.entries(ROT)) {
  const p = new URL(`../${slug}.json`, import.meta.url); const s = JSON.parse(fs.readFileSync(p));
  for (const f of Object.values(s.frames)) for (const [k,sd] of [['armL',1],['armR',-1]]) if (f[k]?.palm) f[k].fingers = rot(f[k].fingers,f[k].palm,deg*sd);
  if (PU[slug]) Object.assign(s.props[0],PU[slug]);
  if (ROOTZ[slug]) for (const f of Object.values(s.frames)) f.root.pos[2]+=ROOTZ[slug];
  fs.writeFileSync(p, JSON.stringify(s,null,1)); }

// reach + wrist fixes (see seated-press-overrides.json, found by search)
{ const D=(v)=>v;
  const O = JSON.parse(fs.readFileSync(new URL('./seated-press-overrides.json', import.meta.url)));
  for (const [slug,o] of Object.entries(O)) {
    const p = new URL(`../${slug}.json`, import.meta.url); const s = JSON.parse(fs.readFileSync(p));
    for (const [fr,fac] of [['mid',o.midf ?? 0.5],['end',1]]) if (s.frames[fr]) for (const [k,sg] of [['armL',1],['armR',-1]]) {
      const h = s.frames[fr][k]; for (let i=0;i<3;i++) h.pos[i] = +(h.pos[i] + o.v[i]*o.d*fac).toFixed(4);
      const r = fr==='mid' ? o.rotMid : o.rotEnd; if (r) h.fingers = rot(h.fingers,h.palm,r*sg);
    }
    fs.writeFileSync(p, JSON.stringify(s,null,1)); }
}

// Shoulder presses and the dip machine, from the machine's own arc (machines.js), with mids so the hand never leaves the handle.
const nrm = (v) => { const l = Math.hypot(...v); return v.map((x) => +(x / l).toFixed(4)); };
const lerp = (a, b, t) => nrm(a.map((x, i) => x + (b[i] - x) * t));
const NAMES = (n) => (n === 4 ? ['start', 'mid', 'mid2', 'end'] : ['start', 'mid', 'end']);
function onArc(slug, fs_, at, arm) {
  const p = new URL(`../${slug}.json`, import.meta.url); const s = JSON.parse(fs.readFileSync(p));
  const tpl = s.frames.mid ?? s.frames.start, F = {};
  NAMES(fs_.length).forEach((n, i) => {
    const f = JSON.parse(JSON.stringify(s.frames[n] ?? tpl));
    for (const [k, sd] of [['armL', 1], ['armR', -1]]) {
      const m = (q) => [+(sd * q[0]).toFixed(4), +q[1].toFixed(4), +q[2].toFixed(4)];
      const a = arm(i, fs_[i] / fs_[fs_.length - 1]);
      Object.assign(f[k], { pos: m(at(fs_[i])), pole: m(a.pole), fingers: m(a.fingers), palm: m(a.palm) });
    }
    F[n] = f;
  });
  s.frames = F;
  fs.writeFileSync(p, JSON.stringify(s, null, 1));
}
// Shoulder presses: hands at the top of the shoulders, forearms stacked under the handles (elbows forward and down, so the
// forearm meets the handle across it square), up the arc past the old stop to a locked-out press (bar ~0.61 m from the shoulder).
for (const slug of ['leverage-shoulder-press', 'machine-shoulder-military-press']) {
  const arc = pressArc('shoulder', 1, slug.includes('military') ? 0 : undefined);
  const r0 = arc.H0.clone().sub(arc.P), L1 = r0.angleTo(arc.H1.clone().sub(arc.P));
  let ax = arc.axis.clone(); if (r0.clone().applyAxisAngle(ax, L1).add(arc.P).distanceTo(arc.H1) > 0.01) ax.negate();
  const at = (f) => r0.clone().applyAxisAngle(ax, f * L1).add(arc.P).toArray();
  const poles = [[0.25, -0.8, 0.55], [0.45, -0.35, 0.85], [0.55, -0.1, 0.83], [0.65, 0, 0.75]];
  onArc(slug, [0, 0.47, 0.95, 1.45], at, (i) => ({ pole: poles[i], fingers: [0, 0.75, -0.66], palm: [0, 0.66, 0.75] }));
}
// Dip machine: the handle runs across (machines.js), palms down; from elbows bent past 90, pointing back and in at the sides,
// down the lever's arc to straight arms with a soft elbow.
{
  const [, py, pz] = DIP.P, r = Math.hypot(DIP.H0[1] - py, DIP.H0[2] - pz);
  const a0 = Math.atan2(DIP.H0[1] - py, DIP.H0[2] - pz); let a1 = Math.atan2(DIP.H1[1] - py, DIP.H1[2] - pz); if (a1 < a0) a1 += 2 * Math.PI;
  const at = (f) => { const a = a0 + f * (a1 - a0); return [DIP.H0[0], py + r * Math.sin(a), pz + r * Math.cos(a)]; };
  const poles = [[0.12, -0.2, -1], [0.12, -0.25, -1], [0.1, -0.3, -1]];
  onArc('dip-machine', [0.35, 0.8, 1.25], at, (i, t) => ({ pole: poles[i], fingers: lerp([0, -0.35, 0.94], [0, -0.95, 0.3], t), palm: lerp([0, -0.94, -0.35], [0, -0.3, -0.95], t) }));
}
