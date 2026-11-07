import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,muscles,props,frames,more={})=>{out[slug]={slug,camera,muscles,props,frames,...more};};
const WALL=[{type:'wall',pos:[0,0,0.79],width:4}];
const flat=(s,p,f=[0.15,1,0])=>({pos:[s*p[0],p[1],p[2]],contact:true,hand:'flat',fingers:[s*f[0],f[1],f[2]],palm:[0,0,1],curl:-0.3,pole:[s*0.5,-0.8,-0.3]});
// hands against wall, staggered
const wallFrame=(rz,rp,ry)=>({root:{pos:[0,ry,rz],pitch:rp},neck:{flex:-14},
 armL:flat(1,[0.26,1.2,0.75]),armR:flat(-1,[0.26,1.2,0.75]),
 legL:{pos:[0.1,0,0.3],anchor:'sole',pitch:0,pole:[0,0.3,1]},
 legR:{pos:[-0.1,0,-0.2],anchor:'sole',pitch:0}});
save('calf-stretch-hands-against-wall',{az:90,el:4},['calves'],WALL,{start:wallFrame(0.1,24,0.84)},{muscleSide:'R'});
// elbows on wall: forearms flat on wall
const fore=(s)=>({pos:[s*0.2,1.55,0.75],contact:true,hand:'flat',fingers:[0,1,0],palm:[0,0,1],curl:0.2,pole:[s*0.3,-1,-0.2]});
save('calf-stretch-elbows-against-wall',{az:90,el:4},['calves'],WALL,{start:{root:{pos:[0,0.82,0.16],pitch:28},neck:{flex:-15},
 armL:fore(1),armR:fore(-1),
 legL:{pos:[0.1,0,-0.15],anchor:'sole',pitch:0},legR:{pos:[-0.1,0,-0.15],anchor:'sole',pitch:0}}});
// gastrocnemius with step
save('standing-gastrocnemius-calf-stretch',{az:90,el:5},['calves'],[{type:'step',pos:[0,0,0.47]}],{start:{
 root:{pos:[0,0.84,-0.1],pitch:50},spine:{flex:12},neck:{flex:-12},
 legR:{pos:[-0.11,0.17,0.42],anchor:'heel',pitch:-30,pole:[0,0.6,1]},
 legL:{pos:[0.11,0,-0.12],anchor:'sole',pitch:0,pole:[0,0.3,1]},
 armR:{pos:[-0.25,0.58,0.27],hand:'relaxed',fingers:[0,-0.5,1],palm:[0,-1,0],curl:0.5,pole:[-0.5,-0.2,-0.6]},
 armL:{pos:[0.25,0.64,0.1],hand:'relaxed',fingers:[0,-0.8,0.6],palm:[0,-1,0],pole:[1,-0.3,-0.4]}}},{muscleSide:'R'});
// soleus: both knees bent, rear heel down
save('standing-soleus-and-achilles-stretch',{az:90,el:4},['calves'],null,{start:{
 root:{pos:[0,0.76,0.08],pitch:8},neck:{flex:0},
 legL:{pos:[0.1,0,0.38],anchor:'sole',pitch:0,pole:[0,0.1,1]},
 legR:{pos:[-0.1,0,-0.1],anchor:'sole',pitch:0,pole:[0,0.1,1]},
 armL:{pos:[0.2,1.0,0.0],hand:'relaxed',fingers:[0,-1,0],palm:[-1,0,0],pole:[1,-0.3,-1]},
 armR:{pos:[-0.2,1.0,0.0],hand:'relaxed',fingers:[0,-1,0],palm:[1,0,0],pole:[-1,-0.3,-1]}}},{muscleSide:'R'});
// seated with strap
const STRAP=[{type:'stretch-strap',foot:'L',hands:true,at:0.8}];
const grip=(s,p)=>({pos:[s*p[0],p[1],p[2]],hand:'grip',grip:0.02,fingers:[0,0.1,1],palm:[-s,0,0],curl:0.8,pole:[s*1,-0.6,-0.1]});
const sroot=(p,sf,nf=0,z=-0.05)=>({root:{pos:[0,0.125,z],pitch:p},spine:{flex:sf},neck:{flex:nf}});
const sleg=(s,x,z,pitch=-70,y=0.08)=>({pos:[s*x,y,z],pitch,pole:[s*0.1,1,0.1]});
const mat=[{type:'floor-mat'}];
const seated=(roll,pitch,y)=>({...sroot(16,12),legL:{...sleg(1,0.11,0.8,pitch,y),roll},legR:sleg(-1,0.11,0.81),
 armL:grip(1,[0.12,0.34,0.42]),armR:grip(-1,[0.12,0.34,0.42])});
save('peroneals-stretch',{az:25,el:8},['calves'],[...mat,...STRAP],{start:seated(-25,-72,0.2)},{muscleSide:'L'});
save('posterior-tibialis-stretch',{az:25,el:8},['calves'],[...mat,...STRAP],{start:seated(25,-72,0.2)},{muscleSide:'L'});
save('seated-hamstring-and-calf-stretch',{az:80,el:8},['hamstrings','calves'],[...mat,...STRAP],{start:{...sroot(20,12),legL:sleg(1,0.11,0.8,-82),legR:sleg(-1,0.11,0.81),
 armL:grip(1,[0.14,0.38,0.5]),armR:grip(-1,[0.14,0.38,0.5])}},{muscleSide:'L'});
save('seated-calf-stretch',{az:80,el:8},['calves'],[...mat,{type:'stretch-strap',foot:'L',hand:'L'}],{start:{...sroot(8,6),legL:sleg(1,0.11,0.8,-82),
 legR:{pos:[-0.38,0.0,0.62],anchor:'sole',pitch:0,pole:[-0.3,1,0.1]},
 armL:grip(1,[0.12,0.34,0.42]),armR:{pos:[-0.2,0.15,-0.24],hand:'relaxed',fingers:[0,-0.7,0.7],palm:[0,-1,0],curl:0.3,pole:[-0.6,-0.5,-0.6]}}},{muscleSide:'L'});
// standing hamstring and calf: front foot forward, toes up, back knee bent, lean, belt
save('standing-hamstring-and-calf-stretch',{az:90,el:5},['hamstrings','calves'],STRAP,{start:{
 root:{pos:[0,0.83,0.0],pitch:60},spine:{flex:15},neck:{flex:-10},
 legL:{pos:[0.11,0,0.44],anchor:'heel',pitch:-35,pole:[0,0.5,1]},
 legR:{pos:[-0.11,0,-0.35],anchor:'sole',pitch:0,pole:[0,0.1,1]},
 armL:{...grip(1,[0.14,0.55,0.55]),fingers:[0,-0.5,0.85]},armR:{...grip(-1,[0.14,0.55,0.55]),fingers:[0,-0.5,0.85]}}},{muscleSide:'L'});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
