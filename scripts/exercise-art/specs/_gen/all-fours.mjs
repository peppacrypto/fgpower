import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const hand=(s,x=0.19,z=0.5)=>({pos:[s*x,0,z],contact:true,hand:'flat',fingers:[0,0,1],palm:[0,-1,0],pole:[s*0.3,0,-1]});
const leg=(s,z=-0.44)=>({pos:[s*0.11,0.075,z],anchor:'ankle',pitch:160,pole:[0,-1,0.05]});
const base=(o={})=>({root:{pos:[0,0.53,0],pitch:81},neck:{flex:-10},armL:hand(1),armR:hand(-1),legL:leg(1),legR:leg(-1),...o});
const save=(slug,cam,muscles,frames,more={})=>{out[slug]={slug,camera:cam,muscles,frames,...more};};
// bird-dog: keep existing spec (specs/bird-dog.json)
// coach audit fixes 2026-11-13
const E=(k,d)=>Number(process.env[k]||d);
const cow=base({spine:{flex:-4},neck:{flex:-25},root:{pos:[0,0.5,0],pitch:81}});
const cat=base({spine:{flex:20},neck:{flex:18},root:{pos:[0,0.5,0],pitch:84}});
save('cat-cow',{az:90,el:10},['spinal-erectors'],{start:cow,mid:cat,end:cow},{tempo:{lift:'even'}});
save('cat-stretch',{az:90,el:10},['spinal-erectors'],{start:base({neck:{flex:0}}),end:base({spine:{flex:24},neck:{flex:20},root:{pos:[0,0.5,0],pitch:84}})});
const cpa=(s)=>({pos:[s*0.19,0,0.49],contact:true,hand:'flat',fingers:[0,0,1],palm:[0,-1,0],pole:[s*0.3,1,0]});
const cpe=(y,z)=>base({root:{pos:[0,y,z],pitch:84},neck:{flex:0},spine:{flex:2},armL:cpa(1),armR:cpa(-1),
 legL:{pos:[0.10,0.12,-0.55],anchor:'ankle',pitch:150,pole:[0.3,0.9,1]},legR:{pos:[-0.10,0.12,-0.55],anchor:'ankle',pitch:150,pole:[-0.3,0.9,1]}});
save('childs-pose',{az:90,el:10},['spinal-erectors'],{start:base({neck:{flex:0}}),mid:base({neck:{flex:0},root:{pos:[0,E('MY',0.42),E('MZ',-0.25)],pitch:83},armL:cpa(1),armR:cpa(-1)}),end:cpe(E('CY',0.34),E('CZ',-0.46))},{tempo:{lift:'there'}});
save('glute-kickback',{az:90,el:10},['glutes'],{
 start:base({neck:{flex:-4},legL:{pos:[0.11,0.45,-0.35],anchor:'ankle',pitch:150,pole:[0,-1,0.1]}}),
 end:base({neck:{flex:-4},legL:{pos:[0.11,0.84,-0.4],anchor:'ankle',pitch:142,pole:[0,-1,0.1]}})},{muscleSide:'L'});
save('rear-leg-raises',{az:90,el:10},['glutes'],{
 start:base({neck:{flex:-4},legL:{pos:[0.11,0.45,-0.35],anchor:'ankle',pitch:150,pole:[0,-1,0.1]}}),
 end:base({neck:{flex:-4},legL:{pos:[0.11,0.53,-0.857],anchor:'ankle',pitch:125,pole:[0,-1,0]}})},{muscleSide:'L',tempo:{lift:'there',up:1.0,down:1.8}});
const hq=(x,y,z)=>base({neck:{flex:-4},legL:{pos:[x,y,z],anchor:'ankle',pitch:122,roll:-10,pole:[0.5,-0.8,0.5]}});
const [cx,cy,cz,R]=JSON.parse(process.env.HC||'[0.5,0.2,-0.15,0.14]');
const hcp=(an)=>hq(cx+R*0.8*Math.sin(an),cy+0.05*Math.cos(an),cz+R*Math.cos(an));
save('hip-circles-prone',{az:180,el:40},['abductors','glutes'],{
 start:hcp(0),a:hcp(Math.PI/2),b:hcp(Math.PI),c:hcp(1.5*Math.PI),end:hcp(0)},{muscleSide:'L',tempo:{lift:'even'}});
const kh=(sx)=>({pos:[sx*0.19,0,E('KZ',0.36)],contact:true,hand:'flat',fingers:[0,0,-1],palm:[0,-1,0],pole:[sx*1,0,0.3]});
const kf2=(lean)=>base({neck:{flex:0},root:{pos:[0,0.53,-lean],pitch:81},armL:kh(1),armR:kh(-1),legL:leg(1,-0.44-lean),legR:leg(-1,-0.44-lean)});
save('kneeling-forearm-stretch',{az:60,el:20},['forearms'],{start:kf2(0.0),end:kf2(E('KL',0.08))});
const tw=(arm,r)=>base({neck:{flex:-8},root:{pos:[0,r.y||0.5,0],pitch:r.p||78,roll:r.r??6},spine:{flex:2},armL:arm,armR:hand(-1,0.3,0.5)});
const TA={pos:[0.19,0.07,0.5],hand:'open',fingers:[0,0,1],palm:[0,-1,0],pole:[0.3,0,-1]};
const TM=tw({pos:JSON.parse(process.env.MPOS||'[-0.03,0.18,0.45]'),hand:'open',fingers:[-0.85,-0.1,0.5],palm:[-0.4,0.1,-0.2],pole:[1,0.5,-0.7]},{y:0.5,p:78,r:E('TR',-6)});
save('thread-the-needle',{az:E('TAZ',300),el:25},['shoulders'],{start:tw(hand(1),{}),a:tw(TA,{}),mid:TM,end:tw(TA,{})},{muscleSide:'L'});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
