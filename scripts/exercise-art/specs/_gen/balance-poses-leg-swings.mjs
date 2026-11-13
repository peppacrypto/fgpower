import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,muscles,frames,more={})=>{out[slug]={slug,camera,muscles,frames,...more};};
const stL=(x=0.1,extra={})=>({pos:[x,0,0],anchor:'sole',pole:[0.05,0.3,1],...extra});
const fk=(flex,abd,elbow,rot=0)=>({fk:{flex,abd,rot,elbow},rel:'chest'});
const down=fk(0,10,15);
const palmH=(s,x,y,z,extra={})=>({pos:[s*x,y,z],hand:'flat',fingers:[0,1,0.25],palm:[-s,0,0],pole:[s*0.5,-1,0],curl:0.3,...extra});
const airH=(s,x,y,z)=>({pos:[s*x,y,z],hand:'relaxed',pole:[s*0.5,-1,0]});
const lerp=(a,b,t)=>a+(b-a)*t;
// ---- tree: foot lifts to the inner thigh, knee open, prayer hands at the sternum
const tree=(sy,sx,sz,kn,fo)=>({root:{pos:[0.1,0.92,0]},neck:{flex:0},legL:stL(0.1),
 legR:{pos:[sx,sy,sz],anchor:'sole',pole:kn,...fo},armL:palmH(1,0.03,1.3,0.22),armR:palmH(-1,0.03,1.3,0.22)});
save('tree-pose',{az:20,el:6},['glutes','abductors'],{
 start:tree(0,-0.1,0,[-0.1,0.3,1],{}),
 mid:tree(0.3,-0.05,0.06,[-0.6,0.1,1],{roll:45}),
 end:tree(0.5,0.06,0.07,[-1,0.1,0.3],{roll:90})},{muscleSide:'L',tempo:{lift:'there'}});
// ---- eagle: sink and rise
const eg=(y)=>({root:{pos:[0.05,y,0],pitch:0},neck:{flex:0},
 legL:{pos:[0.08,0,0],anchor:'sole',pole:[0.2,0.3,1]},legR:{pos:[0.25,0.4,0.26],anchor:'ankle',pole:[0.6,0,1]},
 armL:fk(70,-30,120),armR:fk(80,-40,130)});
save('eagle-pose',{az:40,el:6},['shoulders'],{start:eg(0.82),end:eg(0.74)},{tempo:{lift:'even'}});
// ---- warrior 3
const w3=(pitch,ank,fo,pole)=>({root:{pos:[0.11,0.92,0],pitch},neck:{flex:pitch>60?-10:0},legL:stL(0.11,{pole:[0,0.3,1]}),
 legR:{pos:ank,anchor:'ankle',pole,...fo},armL:fk(172,10,0),armR:fk(172,10,0)});
save('warrior-3',{az:85,el:6},['hamstrings','glutes'],{
 start:w3(0,[-0.0,0.07,0],{},[0,0.3,1]),
 mid:w3(45,[0.0,0.5,-0.6],{pitch:45},[0,-1,0]),
 end:w3(88,[0.0,0.9,-0.8],{pitch:90},[0,-1,0])},{tempo:{lift:'even'}});
// ---- half moon
const flat={hand:'flat',fingers:[0,0,1],palm:[0,-1,0],pole:[0.5,-0.3,-1],curl:0.2};
const hm=(roll,root,ank,hand,abdR,fo)=>({root:{pos:root,roll},neck:{flex:(roll<0&&roll>-100)?-70:0},
 legL:stL(0.1,{pole:[0.1,0.3,1]}),legR:{pos:ank,anchor:'ankle',pole:[0,0,1],...fo},armL:{...flat,...hand},armR:fk(0,abdR,0)});
save('half-moon-pose',{az:0,el:8},['hamstrings','glutes'],{
 start:hm(-105,[0.13,1.03,0],[-0.58,0.75,0],{pos:[0.52,0.23,0],contact:true},90,{roll:-80}),
 end:hm(-105,[0.13,1.03,0],[-0.7,1.12,0],{pos:[0.52,0.23,0],contact:true},90,{roll:-90})},
 {props:[{type:'yoga-block',orient:'tall',pos:[0.52,0,0]}],tempo:{lift:'even'}});
// ---- swings: the working leg is the figure's LEFT, the chair is on its right
const wall={type:'wall',pos:[-0.55,0,0],yaw:90,width:3};
const stepP={type:'step',pos:[-0.1,0,0],yaw:90};
const hold=(y)=>({pos:[-0.51,y,0],contact:true,hand:'flat',fingers:[0,1,0],palm:[-1,0,0],pole:[-0.4,-1,-0.3],curl:0.2});
const sw=(legL,up=0.17,armL=fk(0,12,12))=>({root:{pos:[0,0.92+up,0]},neck:{flex:0},legR:stL(-0.1,{pos:[-0.1,up,0],pole:[-0.05,0.3,1]}),legL,armR:hold(1.15+up),armL});
const ch=[wall,stepP];
const lg=(flex,abd,knee=0,rot=0)=>({fk:{flex,abd,rot,knee},rel:'pelvis'});
save('front-leg-raises',{az:90,el:6},['quadriceps'],{start:sw(lg(-20,0)),end:sw(lg(85,0))},{props:ch,muscleSide:'L',tempo:{lift:'there'}});
save('side-leg-raises',{az:5,el:6},['abductors'],{start:sw(lg(0,4),0.17,fk(0,75,10)),end:sw(lg(0,40),0.17,fk(0,75,10))},{props:ch,muscleSide:'L',tempo:{lift:'there'}});
save('leg-lift',{az:90,el:6},['glutes'],{start:sw(lg(0,0)),end:sw(lg(-35,0))},{props:ch,muscleSide:'L',tempo:{lift:'there'}});
// hip circles: the knee (bent 90) draws a circle, thigh from flexed to out to back
const circ=(n,f)=>{const o={};const names=['start','mid','mid2','mid3','mid4','end'];for(let i=0;i<n;i++)o[names[i]]=f(i*330/(n-1)*Math.PI/180);return o;};
save('standing-hip-circles',{az:30,el:8},['abductors','glutes'],circ(6,th=>sw(lg(60+30*Math.cos(th),30+30*Math.sin(th),90),0.17,fk(0,80,10))),{props:ch,muscleSide:'L',tempo:{lift:'even'}});
// ankle circles: lifted foot, ankle draws circles with the shin still
const ank=(th)=>sw({pos:[0.1+0.06*Math.sin(th),0.15+0.06*Math.cos(th),0.2],anchor:'ball',pole:[0.1,0,1]},0);
save('ankle-circles',{az:50,el:10},['calves'],circ(6,ank),{props:[wall],muscleSide:'L',tempo:{lift:'even'}});
// knee circles: feet together, hands on knees, torso forward, knees draw a circle
const kc=(th)=>{const dx=0.06*Math.cos(th),dz=0.06*Math.sin(th);
 const h=(sg)=>({pos:[sg*0.08+dx*0.5,0.69,0.24+dz*0.5],rel:'world',hand:'flat',fingers:[0,-0.3,1],palm:[0,-1,0],pole:[sg*0.8,-0.3,-0.3],curl:0.3});
 return {root:{pos:[dx*0.6,0.72,-0.02+dz*0.6],pitch:30},neck:{flex:-15},
 legL:{pos:[0.06,0,0],anchor:'sole',pole:[0.15+dx*5,0.2,1+dz*5]},legR:{pos:[-0.06,0,0],anchor:'sole',pole:[-0.15+dx*5,0.2,1+dz*5]},armL:h(1),armR:h(-1)};};
save('knee-circles',{az:40,el:8},['quadriceps','hamstrings'],circ(6,kc),{tempo:{lift:'even'}});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
