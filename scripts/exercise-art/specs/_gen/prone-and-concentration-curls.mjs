import fs from 'fs';
import { BODY } from '../../props/benches.js';
const D = Math.PI/180;
const nrm = v => { const l = Math.hypot(...v); return v.map(x => x/l); };
// hand centre for forearm angle th (0 = hanging, 90 = horizontal forward +Z, 140 = near shoulder)
const hand = (E, th, L=0.345) => [E[0], E[1]-L*Math.cos(th*D), E[2]+L*Math.sin(th*D)];
const orient = th => ({ f:[0,-Math.cos(th*D),Math.sin(th*D)], p:[0,Math.sin(th*D),Math.cos(th*D)] });
// one curling arm: s = +1 left / -1 right; E = elbow world; th; xHand offset
const curlArm = (s, E, th, o={}) => {
  const h = hand(E, th, o.L); const r = orient(th);
  const tw = o.palmIn ?? 0.2; // palm slightly turned in
  const fx = 0, px = -tw*(o.dir??1);
  return { pos:[ (o.hx ?? E[0])*s*(1), h[1], h[2] ], contact:true, curl:0.85,
    fingers:[0,r.f[1],r.f[2]], palm:[px*s, r.p[1], r.p[2]],
    pole:o.pole ? o.pole.map((v,i)=>i===0?v*s:v) : [0.25*s,-0.2,-1] };
};
const write = (slug, o) => {
  const frames = {};
  for (const [k, th] of Object.entries(o.ths)) {
    const f = { root:o.root, neck:o.neck, spine:o.spine };
    f.legL = o.legL; f.legR = o.legR;
    for (const e of o.arms) f['arm'+e.side] = curlArm(e.side==='L'?1:-1, e.E, e.fix ?? th, e);
    if (o.other) f['arm'+o.other.side] = o.other.frame;
    for (const j in f) if (f[j]===undefined) delete f[j];
    frames[k] = f;
  }
  const s = { slug, camera:o.camera, muscles:['biceps'], floats:o.floats, props:o.props, frames };
  if (o.muscleSide) s.muscleSide = o.muscleSide;
  if (!s.floats) delete s.floats;
  fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify(s,null,1));
};
const T3 = { start:0, mid:75, end:140 }; const T4 = { start:0, mid:70, end:120 };
const bb = { type:'barbell', hands:true, plates:[10] };
const db = h => ({ type:'dumbbell', hand:h, kg:10 });

// ---- chest-down on a tall flat bench (upper chest over the end)
{
  const h = 0.85, root = { pos:[0,h+0.14,0.26], pitch:90 };
  const S = [0.19, h+0.14, 0.72]; // shoulder joint
  const E = [0.19, S[1]-0.275, S[2]-0.02];
  const legs = { legL:{ pos:[0.11,h+0.4,-0.1], anchor:'ankle' } };
  const mk = (x, arm) => ({ E:[x, E[1], E[2]], ...arm });
  const legs2 = {
    legL:{ fk:{flex:-5,abd:3,rot:0,knee:100}, rel:'pelvis' }, legR:{ fk:{flex:-5,abd:3,rot:0,knee:100}, rel:'pelvis' } };
  write('lying-high-bench-barbell-curl', { ths:T4, camera:{az:70,el:8}, floats:true,
    props:[{type:'flat-bench',height:h}, bb], root, neck:{flex:-55}, spine:{flex:0}, 
    legL:legs2.legL, legR:legs2.legR,
    arms:[{side:'L',E:[0.17,E[1],E[2]],hx:0.14,dir:0,pole:[0.15,-0.2,-1]},{side:'R',E:[0.17,E[1],E[2]],hx:0.14,dir:0,pole:[0.15,-0.2,-1]}] });
}
// ---- chest-down on an incline
{
  const ang = 20, b = BODY['incline-bench']({angle:ang});
  const bp = [b.backPoint[1], -b.backPoint[2]]; // y, z after yaw 180
  const d = [Math.sin(ang*D), Math.cos(ang*D)]; // y, z
  const n = [Math.cos(ang*D), -Math.sin(ang*D)];
  const s = 0.4 + (0.1+0.2*Math.sin(ang*D))/Math.cos(ang*D);
  const root = [bp[0]+s*d[0]+0.2*n[0], bp[1]+s*d[1]+0.2*n[1]];
  const sh = [root[0]+0.46*d[0], root[1]+0.46*d[1]];
  const E = [0.19, sh[0]-0.275, sh[1]-0.02];
  const R = { pos:[0,root[0],root[1]], pitch:90-ang };
  const leg = x => ({ pos:[x,0,0.3], anchor:'sole', pole:[x*1.5,0.5,1], pitch:0 });
  const common = { ths:T3, camera:{az:65,el:8}, floats:true, root:R, neck:{flex:-20}, legL:leg(0.46), legR:leg(-0.46) };
  const props = extra => [{type:'incline-bench',angle:ang,yaw:180}, ...extra];
  write('dumbbell-prone-incline-curl', { ...common, ths:{start:0,mid:70,end:120}, props:props([db('L'),db('R')]),
    arms:[{side:'L',E,dir:1,L:0.385},{side:'R',E,dir:1,L:0.385}] });
  write('barbell-curls-lying-against-an-incline', { ...common, props:props([bb]),
    arms:[{side:'L',E:[0.17,E[1],E[2]],hx:0.14,dir:0},{side:'R',E:[0.17,E[1],E[2]],hx:0.14,dir:0}] });
}
// ---- concentration family: seated on a flat bench, elbow on inner thigh
{
  const bh = 0.44, ps = 26;
  const root = { pos:[0,bh+0.15,-0.05], pitch:ps };
  const sy = bh+0.1+0.46*Math.cos(ps*D), sz = 0.46*Math.sin(ps*D);
  const legL = { pos:[0.62,0,0.4], anchor:'sole', yaw:15, pole:[0.5,0.3,1] };
  const legR = { pos:[-0.62,0,0.4], anchor:'sole', yaw:-15, pole:[-0.5,0.3,1] };
  const E = [0.18, sy-0.27, sz+0.0];
  const rest = { side:'R', frame:{ pos:[-0.3, bh+0.3, 0.22], hand:'relaxed' } };
  const base = { ths:{start:20,mid:75,end:125}, camera:{az:50,el:8}, root, neck:{flex:-30}, spine:{flex:5}, legL, legR };
  write('concentration-curls', { ...base, props:[{type:'flat-bench',height:bh,yaw:90}, db('L')], muscleSide:'L',
    arms:[{side:'L',E,dir:1,hx:0.1,L:0.335}], other:rest });
  write('seated-close-grip-concentration-barbell-curl', { ...base, props:[{type:'flat-bench',height:bh,yaw:90}, {...bb}],
    ths:{start:45,mid:85,end:112},
    arms:[{side:'L',E:[0.18,E[1],E[2]],hx:0.12,dir:0},{side:'R',E:[0.18,E[1],E[2]],hx:0.12,dir:0}] });
}
// ---- standing concentration curl: hinged, arm hanging, elbow out
{
  const ps = 55;
  const root = { pos:[0,0.86,-0.1], pitch:ps };
  const sy = 0.86+0.46*Math.cos(ps*D), sz = -0.1+0.46*Math.sin(ps*D);
  const leg = s => ({ pos:[0.27*s,0,0.05], anchor:'sole', yaw:15, pole:[0.3*s,0.4,1] });
  const E = [0.24, sy-0.275, sz];
  write('standing-concentration-curl', { ths:{start:5,mid:70,end:130}, camera:{az:60,el:8}, root, neck:{flex:-35},
    legL:leg(1), legR:leg(-1), props:[db('L')], muscleSide:'L',
    arms:[{side:'L',E,dir:1,pole:[0.7,-0.2,-0.6],hx:0.2,L:0.375}],
    other:{ side:'R', frame:{ pos:[-0.2, 0.72, 0.14], hand:'flat', contact:true, fingers:[0,-1,0], palm:[0,0,-1] } } });
}
// ---- standing behind an incline bench, arm draped over the top
{
  const ang = 70, b = BODY['incline-bench']({angle:ang});
  const bpy = b.backPoint[1], bpz = b.backPoint[2];
  const d = [Math.sin(ang*D), -Math.cos(ang*D)]; // y,z along the pad toward the top (pad rises toward -Z)
  const topY = bpy + 0.86*d[0], topZ = bpz + 0.86*d[1];
  const root = { pos:[0,0.92,topZ-0.33], pitch:12 };
  const E = [0.19, 1.12, topZ-0.12];
  write('standing-one-arm-dumbbell-curl-over-incline-bench', { ths:{start:30,mid:85,end:140}, camera:{az:60,el:8},
    root, neck:{flex:10}, legL:{pos:[0.25,0,topZ-0.33],anchor:'sole',pole:[0.2,0,1]}, legR:{pos:[-0.25,0,topZ-0.33],anchor:'sole',pole:[-0.2,0,1]},
    props:[{type:'incline-bench',angle:ang}, db('L')], muscleSide:'L',
    arms:[{side:'L',E,dir:1}],
    other:{ side:'R', frame:{ pos:[-0.1, bpy+0.7*d[0]+0.0034, bpz+0.7*d[1]+0.0094], hand:'flat', contact:true, fingers:[0,-0.94,0.34], palm:[0,-0.34,-0.94] } } });
  console.log('top', topY, topZ);
}
