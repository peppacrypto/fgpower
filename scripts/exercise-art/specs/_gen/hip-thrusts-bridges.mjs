import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const legs = (x, z, pz=0.3) => ({ legL:{pos:[x,0,z],anchor:'sole',yaw:0,pitch:0,pole:[0.1,1,pz]}, legR:{pos:[-x,0,z],anchor:'sole',yaw:0,pitch:0,pole:[-0.1,1,pz]} });
const barArm = s => ({ pos:[0.3*s,0.07,0.16], rel:'pelvis', contact:true, hand:'grip', grip:0.014, fingers:[0,-0.98,-0.2], palm:[0,0.2,-0.98], curl:0.85, pole:[s,0.3,0.1] });
const bar = { type:'barbell', hands:true, plates:[20] };
const lift = (y, z, pitch, neck) => ({ root:{pos:[0,y,z],pitch}, neck:{flex:neck} });
// barbell hip thrust: upper back on bench
const thrust = (root, nk) => ({ ...root, neck:{flex:nk}, armL:barArm(1), armR:barArm(-1), ...legs(0.15, 0.40, 0.2) });
W('barbell-hip-thrust', { camera:{az:66,el:10}, muscles:['glutes'],
  props:[{type:'flat-bench', pos:[0,0,-0.7], yaw:90, height:0.42}, bar],
  frames:{ start:thrust({root:{pos:[0,0.27,-0.15],pitch:-50}},5),
           end:thrust({root:{pos:[0,0.505,-0.09],pitch:-90}},20) } });
// barbell glute bridge: back on the floor
const gb = (r, nk) => ({ root:r, neck:{flex:nk}, armL:barArm(1), armR:barArm(-1), ...legs(0.15,0.5) });
W('barbell-glute-bridge', { camera:{az:66,el:10}, muscles:['glutes'], props:[bar],
  frames:{ start:gb({pos:[0,0.105,0],pitch:-90},8), end:gb({pos:[0,0.34,0.03],pitch:-112},26) } });
// butt-lift-bridge keeps its spec (floor bridge, arms by sides)
// bridge-pose: shoulders under, hands clasped beneath the pelvis
const clasp = s => ({ pos:[0.15*s,0,0.09], contact:true, fingers:[0.05*s,0,1], palm:[0,-1,0], pole:[s,0.5,-0.2], curl:-0.3 });
const bp = (r, nk) => ({ root:r, neck:{flex:nk}, armL:clasp(1), armR:clasp(-1), ...legs(0.14,0.58,0.2) });
W('bridge-pose', { camera:{az:70,el:10}, muscles:['glutes','hamstrings'],
  frames:{ start:bp({pos:[0,0.095,0],pitch:-90},22), end:bp({pos:[0,0.33,-0.03],pitch:-118},32) } });
// pelvic tilt into bridge
const side = s => ({ pos:[0.27*s,0,0.105], contact:true, fingers:[0.08*s,0,1], palm:[0,-1,0], pole:[s,0.5,-0.2], curl:-0.3 });
const pt = (r, nk, sp) => ({ root:r, neck:{flex:nk}, armL:side(1), armR:side(-1), ...legs(0.14,0.5,0.2), spine:sp });
W('pelvic-tilt-into-bridge', { camera:{az:70,el:10}, muscles:['spinal-erectors','glutes'],
  frames:{ start:pt({pos:[0,0.14,0],pitch:-90},36,{flex:-6,weights:[0,0,0,0.4,0.6]}),
           mid:pt({pos:[0,0.235,-0.02],pitch:-103},30,{flex:-10,weights:[0,0,0,0.4,0.6]}),
           end:pt({pos:[0,0.335,-0.04],pitch:-118},34,{flex:0,weights:[0,0,0,0.4,0.6]}) } });
// hip lift with band: gallery band-hips
const bh = JSON.parse(fs.readFileSync(new URL('../_gallery/band-hips.json', import.meta.url)));
for (const p of bh.props) if (p.type==='dumbbell') { p.pos[0]*=1.5; } else if (p.points) { p.points[0][0]*=1.5; p.points[4][0]*=1.5; }
for (const f of Object.values(bh.frames)) { f.neck={flex:8}; for (const a of ['armL','armR']) f[a].fk.abd=30; }
W('hip-lift-with-band', { ...bh, slug:undefined });
// physioball hip bridge: upper back on ball
const pb = (r, nk) => ({ root:r, neck:{flex:nk}, armL:{fk:{flex:0,abd:22,elbow:4},curl:0.2}, armR:{fk:{flex:0,abd:22,elbow:4},curl:0.2}, ...legs(0.18,0.42,0.2) });
W('physioball-hip-bridge', { camera:{az:68,el:8}, muscles:['glutes','hamstrings'],
  props:[{type:'stability-ball', pos:[0,0,-0.5], radius:0.325, load:1}],
  frames:{ start:pb({pos:[0,0.25,-0.1],pitch:-60},10), end:pb({pos:[0,0.52,-0.05],pitch:-92},14) } });
const ld=n=>JSON.parse(fs.readFileSync(new URL(`../${n}.json`, import.meta.url)));
const sv=(n,o)=>fs.writeFileSync(new URL(`../${n}.json`, import.meta.url), JSON.stringify(o,null,1));
{ const bl=ld('butt-lift-bridge'); bl.frames.start.neck={flex:14}; bl.frames.end.neck={flex:38};
  bl.frames.start.root.pos[1]=0.145; bl.frames.end.root.pos[1]=0.34;
  for (const k of ['start','end']) { bl.frames[k].armL.pos[2]=0.1; bl.frames[k].armR.pos[2]=0.1; }
  sv('butt-lift-bridge',bl); }
{ const o=ld('single-leg-glute-bridge'); o.frames.start.neck={flex:14}; o.frames.end.neck={flex:26}; o.frames.start.root.pos[1]=0.125; o.frames.end.root.pos[1]=0.32; sv('single-leg-glute-bridge',o); }
{ const o=ld('heel-elevated-bridge'); o.frames.start.neck={flex:14}; o.frames.end.neck={flex:30}; o.frames.start.root.pos[1]=0.145; o.frames.end.root.pos[1]=0.345; sv('heel-elevated-bridge',o); }
for (const n of ['sofa-hip-thrust','single-leg-sofa-hip-thrust']) { const o=ld(n);
  for (const f of Object.values(o.frames)) { f.armL.pos=[0.3,0.04,0.1]; f.armR.pos=[-0.3,0.04,0.1]; }
  o.frames.start.root.pos[2]=-0.1; o.frames.end.root.pos[2]=0.03; o.frames.mid.root.pos[2]=-0.06; o.frames.mid.root.pitch=-58; sv(n,o); }
