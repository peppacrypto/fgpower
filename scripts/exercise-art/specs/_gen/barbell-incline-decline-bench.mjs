import fs from 'fs';
import { BODY } from '../../props/benches.js';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const rad = d => d*Math.PI/180;
// grip hand; s=+1 left. o: fingers/palm overrides
const hand = (s, p, o={}) => ({ pos:[p[0]*s,p[1],p[2]], contact:true, hand:'grip', grip:o.grip??0.014,
  fingers:[(o.fx??0.05)*s, o.fy??1, o.fz??-0.05], palm:[0,o.py??0.05,o.pz??1],
  pole:[(o.px??0.7)*s, o.pey??-0.5, o.pz2??-0.1], curl:0.82, ...(o.scap?{scap:o.scap}:{}), ...(o.swivel!==undefined?{swivel:o.swivel}:{}), ...(o.roll!==undefined?{roll:o.roll}:{}) });
const inclineBase = a => {
  const b = BODY['incline-bench']({angle:a}); const g = BODY['incline-bench']({angle:40});
  return { root:{pos:[0,b.root[1],b.root[2]],pitch:-(90-a)}, sh:b.shoulder };
};
const incLegs = { legL:{pos:[0.21,0,0.62],anchor:'sole',pole:[0.15,0.4,1]}, legR:{pos:[-0.21,0,0.62],anchor:'sole',pole:[-0.15,0.4,1]} };
const decLegs = { legL:{pos:[0.12,0.405,0.585],anchor:'ankle',pitch:25,pole:[0.15,1,0.4]}, legR:{pos:[-0.12,0.405,0.585],anchor:'ankle',pitch:25,pole:[-0.15,1,0.4]} };
const frame = (root, legs, neck, L, R, extra={}) => ({ root, neck:{flex:neck}, ...legs, armL:L, armR:R, ...extra });

// ---- incline (angle a): lockout bar over shoulders
const D = 0.58;
const inc = (slug, a, x, muscles, o={}) => {
  const B = inclineBase(a); const sh = B.sh;
  const top = [sh[1]+D, sh[2]+(o.dz??0)];
  const bot = [top[0]-0.365, top[1]+0.15];
  const fr = (y,z,pz2,scap) => { const ho={...o,pz2,scap};
    return frame(B.root, incLegs, 6, hand(1,[x,y,z],ho), hand(-1,[x,y,z],ho)); };
  return {B, top, bot, fr};
};
{ const {top,bot,fr} = inc('', 30, 0.37);
  W('barbell-incline-bench-press-medium-grip', { camera:{az:40,el:10}, muscles:['chest'], floats:true,
    props:[{type:'incline-bench',angle:30,uprights:true},{type:'barbell',hands:true,plates:[20]}],
    frames:{ start:fr(top[0],top[1],-0.1), end:fr(bot[0],bot[1],0.15) } }); }
{ const {top,fr} = inc('', 30, 0.40, [], {px:0.9,pey:-0.3});
  W('barbell-incline-shoulder-raise', { camera:{az:85,el:6}, muscles:['shoulders'], floats:true,
    props:[{type:'incline-bench',angle:30,uprights:true},{type:'barbell',hands:true,plates:[20]}],
    frames:{ start:fr(top[0],top[1],-0.1,{prot:0}), end:fr(top[0]+0.03,top[1],-0.1,{prot:1}) } }); }
{ const {top,fr} = inc('', 30, 0.20, [], {px:0.9,pey:-0.3, grip:0.016});
  const mk = (y,z,scap) => { const B=inclineBase(30); const L=hand(1,[0.19,y,z],{grip:0.016,px:0.5,pey:-0.5,scap}), R=hand(-1,[0.19,y,z],{grip:0.016,px:0.5,pey:-0.5,scap});
    return frame(B.root,incLegs,6,L,R); };
  W('dumbbell-incline-shoulder-raise', { camera:{az:85,el:6}, muscles:['shoulders'], floats:true,
    props:[{type:'incline-bench',angle:30},{type:'dumbbell',hand:'L'},{type:'dumbbell',hand:'R'}],
    frames:{ start:mk(top[0],top[1],{prot:0}), end:mk(top[0]+0.03,top[1],{prot:1}) } }); }
{ // incline triceps extension, bench 60, bar overhead in line with torso; end: bar behind head
  const a=60, B=inclineBase(a), sh=B.sh, h=[Math.sin(rad(a)),-Math.cos(rad(a))]; // head direction (y,z)
  const x=0.15;
  const topP=[sh[1]+0.52*Math.cos(rad(15)), sh[2]-0.52*Math.sin(rad(15))*0];
  const fr=(y,z,pey,pz2)=>frame(B.root,incLegs,6,hand(1,[x,y,z],{px:0.25,pey,pz2}),hand(-1,[x,y,z],{px:0.25,pey,pz2}));
  const el=[sh[1]+0.279, sh[2]];
  const end=[el[0]+0.24*h[0]*0.6, el[1]+0.24*h[1]*0.6];
  const mid=[ (topP[0]+end[0])/2+0.03, (topP[1]+end[1])/2-0.06];
  W('incline-barbell-triceps-extension',{camera:{az:85,el:6},muscles:['triceps'],floats:true,
    props:[{type:'incline-bench',angle:a},{type:'barbell',hands:true,plates:[20]}],
    frames:{start:fr(topP[0],topP[1],1,0.1),mid:fr(mid[0],mid[1],1,0.1),end:fr(end[0],end[1],1,0.1)}}); }

// ---- decline
const dec = BODY['decline-bench']({angle:20}); const dsh=dec.shoulder;
const dRoot={pos:[0,dec.root[1],dec.root[2]],pitch:-110};
const dtop=[dsh[1]+0.58, dsh[2]];
const dfr=(x,y,z,o={})=>frame(dRoot,decLegs,10,hand(1,[x,y,z],o),hand(-1,[x,y,z],o));
const dbot=[0.691,-0.2867];
W('decline-barbell-bench-press',{camera:{az:40,el:14},muscles:['chest'],floats:true,
  props:[{type:'decline-bench',angle:20,uprights:true},{type:'barbell',hands:true,plates:[20]}],
  frames:{start:dfr(0.37,dtop[0],dtop[1],{pz2:-0.1}),end:dfr(0.37,dbot[0],dbot[1],{pz2:0.1})}});
W('wide-grip-decline-barbell-bench-press',{camera:{az:40,el:14},muscles:['chest'],floats:true,
  props:[{type:'decline-bench',angle:20,uprights:true},{type:'barbell',hands:true,plates:[20]}],
  frames:{start:dfr(0.46,dtop[0],dtop[1],{px:0.9,pey:-0.3,pz2:-0.1}),end:dfr(0.46,dbot[0],dbot[1],{px:0.9,pey:-0.3,pz2:0.1})}});
// forehead arc (bar over the face)
const fore=[dsh[1]+0.04, dsh[2]-0.27];
const cg={px:0.035,pey:-0.7,swivel:0};
W('decline-close-grip-bench-to-skull-crusher',{camera:{az:70,el:8},muscles:['triceps'],floats:true,
  props:[{type:'decline-bench',angle:20,uprights:true},{type:'barbell',hands:true,plates:[20]}],
  frames:{start:dfr(0.22,dtop[0],dtop[1],{...cg,pz2:0.0}),
          mid:dfr(0.22,0.70,-0.25,{...cg,pey:-0.75,pz2:0.0}),
          mid2:dfr(0.22,dtop[0],dtop[1],{...cg,pz2:0.0}),
          mid3:dfr(0.22,(dtop[0]+fore[0])/2+0.05,(dtop[1]+fore[1])/2-0.02,{swivel:0,px:0.15,pey:-0.3,pz2:-0.1,fy:0.9,fz:-0.45,py:0.45,pz:0.9}),
          end:dfr(0.22,fore[0],fore[1],{swivel:0,px:0.15,pey:-0.2,pz2:-0.1,fy:0.7,fz:-0.7,py:0.7,pz:0.7})}});
const ez=(y,z,pz2,pey)=>({x:0.1,y,z,o:{px:0.25,pey,pz2,fx:-0.55,fy:0.83,fz:-0.1,py:0.1}});
{ const f=(y,z,pey,x={})=>dfr(x.hx??0.1,y,z,{px:0.25,pey,pz2:-0.1,fx:-0.55,fy:0.83,fz:-0.1,py:0.1,...x});
  W('decline-ez-bar-triceps-extension',{camera:{az:70,el:8},muscles:['triceps'],floats:true,
    props:[{type:'decline-bench',angle:20,uprights:true},{type:'ez-bar',grip:'inner',hands:true,plates:[10]}],
    frames:{start:f(dtop[0],dtop[1],-0.6),mid:f((dtop[0]+dsh[1])/2+0.04,(dtop[1]+dsh[2]-0.30)/2+0.03,-0.2,{px:0.12}),end:f(dsh[1]+0.02,dsh[2]-0.30,0.1,{"hx": 0.13, "fx": -0.55, "fy": -0.174, "fz": -0.985, "py": 0.985, "pz": -0.174, "px": 0.35, "pey": -0.3, "pz2": -0.3})}}); }
