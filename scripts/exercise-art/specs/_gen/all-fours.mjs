import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const hand=(s,x=0.19,z=0.5)=>({pos:[s*x,0,z],contact:true,hand:'flat',fingers:[0,0,1],palm:[0,-1,0],pole:[s*0.3,0,-1]});
const leg=(s,z=-0.44)=>({pos:[s*0.11,0.075,z],anchor:'ankle',pitch:160,pole:[0,-1,0.05]});
const base=(o={})=>({root:{pos:[0,0.53,0],pitch:81},neck:{flex:-10},armL:hand(1),armR:hand(-1),legL:leg(1),legR:leg(-1),...o});
const save=(slug,cam,muscles,frames,more={})=>{out[slug]={slug,camera:cam,muscles,frames,...more};};
// cat-cow
save('cat-cow',{az:90,el:10},['spinal-erectors'],{
 start:base({spine:{flex:-4},neck:{flex:-35},root:{pos:[0,0.5,0],pitch:81}}),
 mid:base({spine:{flex:30},neck:{flex:40},root:{pos:[0,0.5,0],pitch:90}}),
 end:base({spine:{flex:-4},neck:{flex:-35},root:{pos:[0,0.5,0],pitch:81}})});
save('cat-stretch',{az:90,el:10},['spinal-erectors'],{
 start:base(),
 end:base({spine:{flex:30},neck:{flex:40},root:{pos:[0,0.5,0],pitch:90}})});
// child's pose: hips to heels, arms forward
const cp=(z,f=2,n=-5,y=0.34)=>({root:{pos:[0,y,-0.82],pitch:85},neck:{flex:n},spine:{flex:f},
 armL:{pos:[0.19,0,z],contact:true,hand:'flat',fingers:[0,0,1],palm:[0,-1,0],pole:[0.3,1,0]},
 armR:{pos:[-0.19,0,z],contact:true,hand:'flat',fingers:[0,0,1],palm:[0,-1,0],pole:[-0.3,1,0]},
 legL:{pos:[0.11,0.075,-0.92],anchor:'ankle',pitch:160,pole:[0,0.3,1]},legR:{pos:[-0.11,0.075,-0.92],anchor:'ankle',pitch:160,pole:[0,0.3,1]}});
save('childs-pose',{az:90,el:10},['spinal-erectors'],{start:cp(0.0),end:cp(0.0,4,-35,0.37)});
// thread the needle
const RX=Number(process.env.RX||0.3);
const T=(process.env.TN||'0.54,80,6,-0.05,0.35,0').split(',').map(Number);
const tn=(thread)=>base(thread?{
 root:{pos:[0,T[0],0],pitch:T[1],roll:T[2]},neck:{flex:-5},spine:{flex:4},
 armL:{pos:[T[3],0.07,T[4]],hand:'open',fingers:JSON.parse(process.env.EF||'[-1,-0.2,0.2]'),palm:JSON.parse(process.env.EP||'[0,1,0]'),pole:[0,0.5,-1]},
 armR:hand(-1,RX,0.5)}:{armR:hand(-1,RX,0.5)});
const tq=(pos,f,pa,pl=[0,0.5,-1])=>base({root:{pos:[0,0.5,0],pitch:78,roll:6},neck:{flex:-8},spine:{flex:2},
 armL:{pos,hand:'open',fingers:f,palm:pa,pole:pl},armR:hand(-1,RX,0.5)});
const tm=base({root:{pos:[0,0.5,0],pitch:78,roll:6},neck:{flex:-8},spine:{flex:2},
 armL:{pos:JSON.parse(process.env.MPOS||'[0.0,0.2,0.4]'),hand:'open',fingers:JSON.parse(process.env.MF||'[-0.85,-0.1,0.5]'),palm:JSON.parse(process.env.MP||'[-0.4,0.1,-0.2]'),pole:JSON.parse(process.env.MPL||'[1,0.5,-0.7]')},armR:hand(-1,RX,0.5)});
const ta=tq([0.19,0.07,0.5],[0,0,1],[0,-1,0],[0.3,0,-1]);
const tb=tq([-0.06,0.15,0.4],[-1,0,0.5],[-0.3,0.9,-0.1]);
save('thread-the-needle',{az:140,el:30},['shoulders'],{start:tn(false),a:ta,mid:tm,b:tb,end:tn(true)},{muscleSide:'L'});
// bird-dog unchanged: keep existing spec
// kickbacks
const kb=(s,ankle,pitch,pole)=>({pos:[s*0.11,ankle[0],ankle[1]],anchor:'ankle',pitch,pole});
save('glute-kickback',{az:90,el:10},['glutes'],{
 start:base({legL:{pos:[0.11,0.45,-0.35],anchor:'ankle',pitch:150,pole:[0,-1,0.1]},
   root:{pos:[0,0.53,0],pitch:81}}),
 end:base({legL:{pos:[0.11,0.95,-0.38],anchor:'ankle',pitch:142,pole:[0,-1,0.1]}})},{muscleSide:'L'});
save('rear-leg-raises',{az:90,el:10},['glutes'],{
 start:base({legL:{pos:[0.11,0.45,-0.35],anchor:'ankle',pitch:150,pole:[0,-1,0.1]}}),
 end:base({legL:{pos:[0.11,0.53,-0.857],anchor:'ankle',pitch:125,pole:[0,-1,0]}})},{muscleSide:'L'});
// hip circles: knee bent 90, knee circles out to side
const hc=(x,y,z)=>base({legL:{pos:[x,y,z],anchor:'ankle',pitch:122,roll:-35,pole:[0.8,0,0.3]}});
save('hip-circles-prone',{az:150,el:35},['abductors'],{
 start:hc(0.45,0.2,-0.4),a:hc(0.5,0.3,-0.36),b:hc(0.6,0.4,-0.45),c:hc(0.4,0.3,-0.6),end:hc(0.45,0.2,-0.4)},{muscleSide:'L'});
// kneeling forearm stretch: hands behind, fingers toward knees
const kh=(sx,lean)=>({pos:[sx*0.19,0,Number(process.env.KZ||0.36)],contact:true,hand:'flat',fingers:[0,0,-1],palm:[0,-1,0],pole:[sx*1,0,0.3]});
const kf=(lean)=>base({root:{pos:[0,0.53,-lean],pitch:81},armL:kh(1),armR:kh(-1),legL:leg(1,-0.44-lean),legR:leg(-1,-0.44-lean)});
save('kneeling-forearm-stretch',{az:60,el:20},['forearms'],{start:kf(0),end:kf(0.02)});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
