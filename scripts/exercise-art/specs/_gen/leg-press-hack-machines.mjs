const [DX,PX,PY,PZ,DY,A]=(process.env.P||"0,0.8,-0.2,0.4,0.04,25").split(",").map(Number);
import fs from 'fs';
const G=n=>JSON.parse(fs.readFileSync(new URL('../_gallery/'+n+'.json',import.meta.url)));
const out=(slug,g,fn)=>{const s=structuredClone(g);s.slug=slug;if(fn)fn(s);
 fs.writeFileSync(new URL('../'+slug+'.json',import.meta.url),JSON.stringify(s,null,1));};
const ev=(n,d)=>Number(process.env[n]??d);
const shift=(s,fr,d)=>{for(const l of ['legL','legR']){s.frames[fr][l].pos[1]+=d;s.frames[fr][l].pos[2]+=d;}};
const deeper=s=>shift(s,'end',-ev('LPE',-0.01));
const longer=s=>shift(s,'start',ev('LPS',0.03));
const lp=s=>{for(const f of Object.values(s.frames)){f.root.pitch=ev('RP',-52);f.root.pos[1]=ev('RY',0.44);f.root.pos[2]=ev('RZ',0);}};
// Depth (2026-11-17, the owner: "eu tento encostar a bunda", "não desce nem até 90 graus"): the soles FWD metres up the foot plate and
// the hips from t=T0 to t=T1 on the rails (props/machines.js hack-squat). 0.10 / -0.02 / -0.64: knees about 17 -> 147 deg, the glutes
// down to the calves. With the soles at the plate's centre the ankles (50 deg) stop the squat near 133.
const hackDeep=s=>{const fwd=ev('FWD',0.10),r=[0.743,-0.669],nb=[0.669,0.743],ff=[Math.sin(25*Math.PI/180),Math.cos(25*Math.PI/180)],top=[0.9106,-0.6278];
 const hip=t=>[0,+(top[0]+t*r[0]).toFixed(5),+(top[1]+t*r[1]).toFixed(5)];
 const hand=(t,x)=>{const h=hip(t);return [x,+(h[1]+0.585*r[0]+0.03*nb[0]).toFixed(5),+(h[2]+0.585*r[1]+0.03*nb[1]).toFixed(5)];};
 for(const [fr,t] of [['start',ev('T0',-0.02)],['end',ev('T1',-0.64)]]){const f=s.frames[fr];f.root.pos=hip(t);f.armL.pos=hand(t,0.28);f.armR.pos=hand(t,-0.28);
  for(const l of ['legL','legR']){f[l].pos[1]=+(0.24+fwd*ff[0]).toFixed(5);f[l].pos[2]=+(fwd*ff[1]).toFixed(5);}}};
const narrow=s=>{s.camera={az:55,el:12};for(const f of Object.values(s.frames)){f.legL.pos[0]=0.06;f.legR.pos[0]=-0.06;f.legL.yaw=8;f.legR.yaw=-8;}};
out('leg-press',G('leg-press'),s=>{lp(s);longer(s);deeper(s);});
out('narrow-stance-leg-press',G('leg-press'),s=>{narrow(s);lp(s);longer(s);deeper(s);});
out('hack-squat',G('hack-squat'),hackDeep);
out('narrow-stance-hack-squats',G('hack-squat'),s=>{narrow(s);hackDeep(s);});
out('calf-press-on-the-leg-press-machine',G('leg-press-calf'));
out('calf-press',G('seated-calf'),s=>{s.frames.end.root.pos[1]=0.589;for(const f of Object.values(s.frames)){f.armL.pos[1]+=0.03;f.armR.pos[1]+=0.03;}});
out('lying-machine-squat',G('lying-squat'),s=>{for(const f of Object.values(s.frames)){f.armL.pos[1]+=DY;f.armR.pos[1]+=DY;const c=Math.cos(A*Math.PI/180),n=Math.sin(A*Math.PI/180);for(const a of [f.armL,f.armR])a.fingers=[0,0.3*c-0.95*n,0.3*n+0.95*c];f.armL.pos[0]+=DX;f.armR.pos[0]-=DX;f.armL.pole=[PX,PY,PZ];f.armR.pole=[-PX,PY,PZ];}});
