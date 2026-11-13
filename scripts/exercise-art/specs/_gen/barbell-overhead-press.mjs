import fs from 'fs';
// ref: standing or seated (shoulder-press-bench, gallery numbers)
const arm = (s, x, y, z, o={}) => ({
  pos:[x*s,y+(o.dy??0),z], contact:true, hand:'grip', grip:0.014,
  fingers:[0.05*s,...(o.f??[1,0.05])], palm:o.pm??[0,-0.05,1],
  pole:[(o.px??0.9)*s, o.py??-0.35, o.pz??-0.2], curl:0.82 });
const standFrame = (o) => ({ root:{pos:[0,0.92,-0.08],pitch:0}, neck:{flex:o.neck??0}, spine:{flex:o.flex??0},
  legL:{pos:[0.15,0,0.02],anchor:'sole',pole:[0.1,0.4,1]}, legR:{pos:[-0.15,0,0.02],anchor:'sole',pole:[-0.1,0.4,1]},
  armL:arm(1,o.x,o.y,o.z,o), armR:arm(-1,o.x,o.y,o.z,o) });
const seatFrame = (o0) => { const o={...o0,dy:0.048}; return seatFrame2(o); };
const seatFrame2 = (o) => ({ root:{pos:[0,0.59,0.1545],pitch:-8}, neck:{flex:-2},
  legL:{pos:[0.22,0,0.58],anchor:'sole',pole:[0.2,0.4,1]}, legR:{pos:[-0.22,0,0.58],anchor:'sole',pole:[-0.2,0.4,1]},
  armL:arm(1,o.x,o.y,o.z,o), armR:arm(-1,o.x,o.y,o.z,o) });
const G = (d) => [[Math.cos(d*Math.PI/180),Math.sin(d*Math.PI/180)],[0,-Math.sin(d*Math.PI/180),Math.cos(d*Math.PI/180)]];
const DL = +(process.env.DL??30);
const mk = (slug, seated, muscles, frames, cam={az:40,el:6}, extra={}) => {
  const F = seated ? seatFrame : standFrame;
  const s = { slug, camera:cam, muscles, floats:seated,
    props: seated ? [{type:'shoulder-press-bench',uprights:true},{type:'barbell',hands:true,plates:[15]}]
                  : [{type:'barbell',hands:true,plates:[15]}],
    frames:{} };
  for (const [k,o] of Object.entries(frames)) s.frames[k] = F(o);
  Object.assign(s, extra);
  fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify(s,null,1));
};
const D = ['anterior-deltoid','lateral-deltoid','triceps'];
// standing: shoulders y1.38 z0
mk('standing-military-press', false, D, {
  start:{x:0.36,y:1.46,z:0.11,px:0.9,py:-0.35,pz:-0.3},
  mid:{x:0.36,y:1.66,z:0.2,px:0.7,py:-0.3,pz:-0.5},
  end:{x:0.30,y:2.04,z:0.0,px:0.3,py:0.3,pz:0.3} });
mk('seated-barbell-military-press', true, D, {
  start:{x:0.36,y:1.63,z:0.1505,pz:-0.15},
  end:{x:0.36,y:1.0875,z:0.2905,pz:-0.35} });
mk('barbell-shoulder-press', true, D, {
  start:{x:0.36,y:1.63,z:0.1505,pz:-0.15},
  end:{x:0.36,y:1.0875,z:0.2905,pz:-0.35} }, {az:44,el:8});
mk('bradford-rocky-presses', true, D, {
  start:{x:0.36,y:1.0875,z:0.2905,pz:-0.35},
  mid:{x:0.36,y:1.55,z:0.2,pz:-0.2},
  mid2:{x:0.30,y:1.66,z:0.15,py:0.2,pz:0.2},
  mid3:{x:0.36,y:1.38,z:-0.05,py:-0.3,pz:0.3},
  end:{x:0.40,y:1.16,z:-0.13,px:0.9,py:-0.8,pz:-0.5,f:[0.55,-0.83],pm:[0,0.83,0.55]} }, {az:90,el:6}, {tempo:{up:1.0}});
mk('standing-barbell-press-behind-neck', false, D, {
  start:{x:0.40,y:1.52,z:-0.13,px:0.3,py:-0.8,pz:-0.5,f:[0.55,-0.83],pm:[0,0.83,0.55],flex:3},
  end:{x:0.32,y:2.03,z:0.0,px:0.5,py:0.3,pz:0.3,flex:3} }, {az:90,el:6});
{
const LK={x:0.30,y:2.04,z:0.0,px:0.3,py:0.3,pz:0.3};
const FR={x:0.36,y:1.46,z:0.11,pz:-0.3}, FM={x:0.36,y:1.72,z:0.2,pz:-0.3};
const BH={x:0.40,y:1.52,z:-0.13,px:0.9,py:-0.8,pz:-0.5,f:[0.55,-0.83],pm:[0,0.83,0.55],flex:3}, BM={x:0.36,y:1.72,z:-0.16,py:-0.2,pz:0.3};
mk('standing-bradford-press', false, D, { start:FR, mid:FM, mid2:{...LK,z:0.10,y:2.03}, mid3:{...LK,z:-0.10,y:2.03}, mid4:BM, end:BH }, {az:90,el:6});
}
// straight-arm raise: fk arms
const fkArm = (s,flex,pron=0) => ({fk:{flex,abd:8,rot:0,elbow:8},rel:'chest',hand:'grip',grip:0.014});
{
  const fk = (fl) => ({ fk:{flex:fl,abd:6,rot:90,elbow:12}, rel:'chest', hand:'grip', grip:0.014, curl:0.82 });
  const F = (fl) => ({ root:{pos:[0,0.92,-0.08],pitch:0},
    legL:{pos:[0.15,0,0.08],anchor:'sole',pole:[0.1,0.4,1]}, legR:{pos:[-0.15,0,0.08],anchor:'sole',pole:[-0.1,0.4,1]},
    armL:fk(fl), armR:fk(fl) });
  const s = { slug:'standing-front-barbell-raise-over-head', camera:{az:90,el:6}, muscles:['anterior-deltoid','shoulders'],
    props:[{type:'barbell',hands:true,plates:[15]}],
    frames:{ start:F(18), mid:F(60), mid2:F(100), mid3:F(140), end:F(172) } };
  fs.writeFileSync(new URL('../standing-front-barbell-raise-over-head.json', import.meta.url), JSON.stringify(s,null,1));
}
const TD = +(process.env.TD??-105);
const TG = d => { const [f,p]=G(d-DL); return {f,pm:p}; };
mk('standing-overhead-barbell-triceps-extension', false, ['triceps'], {
  start:{x:0.12,y:2.06,z:0.0,px:0.3,py:0.2,pz:0.3,...TG(2)},
  mid:{x:0.12,y:1.78,z:-0.12,px:0.3,py:0.6,pz:0.2,...TG(-70)},
  end:{x:0.12,y:1.60,z:-0.22,px:0.2,py:1,pz:0.1,...TG(TD)} }, {az:90,el:6}, {tempo:{lift:'back',up:1.0,down:1.8}});
