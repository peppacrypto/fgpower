import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};const Y=2.25;
const hand=(s,x,mode='over',pole=mode==='over'?[1,-0.6,-0.3]:[0,-1,0.3])=>({pos:[s*x,Y,0],contact:true,fingers:[0,1,0],palm:[0,0,mode==='over'?1:-1],pole:[s*pole[0],pole[1],pole[2]],curl:0.82});
const arms=(x,mode)=>({armL:hand(1,x,mode),armR:hand(-1,x,mode)});
const lg=(f,k,ab=2)=>({fk:{flex:f,abd:ab,knee:k},foot:{pitch:f>60?10:28}});
const fr=(y,z,pitch,sp,neck,A,L,R=L)=>({root:{pos:[0,y,z],pitch},spine:{flex:sp},neck:{flex:neck},...A,legL:lg(...L),legR:lg(...R)});
const save=(slug,camera,props,frames,more={})=>{out[slug]={slug,camera,muscles:['abdominals'],floats:true,props,frames,...more};};
const bar=[{type:'pull-up-bar',height:Y}];const O=arms(0.33,'over');
const cam={az:70,el:6};
save('hanging-leg-raise',cam,bar,{
 start:fr(1.185,-0.03,2,0,-4,O,[4,6]),
 end:fr(1.2,-0.1,-14,10,6,O,[118,45])});
save('hanging-pike',cam,bar,{
 start:fr(1.185,-0.03,-2,0,-4,O,[90,95]),
 end:fr(1.2,-0.12,-12,8,4,O,[132,10])});
save('gorilla-chin-crunch',cam,bar,{
 start:fr(1.185,-0.03,-2,0,-4,arms(0.2,'under'),[90,95]),
 end:fr(1.42,-0.14,-10,22,2,arms(0.2,'under'),[122,118])});
save('wind-sprints',cam,bar,{
 start:fr(1.185,-0.03,-2,0,-4,O,[100,100],[4,6]),
 end:fr(1.185,-0.03,-2,0,-4,O,[4,6],[100,100])});
// captain's chair
const Y2=1.30,ch=s=>({pos:[s*0.225,Y2+0.10,0.29],contact:true,fingers:[0,0,1],palm:[-s,0,0],pole:[s*0.15,-1,-0.15],curl:0.82});
const CA={armL:ch(1),armR:ch(-1)};
save('knee-hip-raise-on-parallel-bars',{az:64,el:10},[{type:'captains-chair'}],{
 start:{root:{pos:[0,1.144,-0.075],pitch:0},neck:{flex:2},spine:{flex:0},...CA,legL:lg(6,8),legR:lg(6,8)},
 end:{root:{pos:[0,1.144,-0.075],pitch:-8},neck:{flex:12},spine:{flex:6},...CA,legL:lg(112,96),legR:lg(112,96)}});
// one-handed hang
const H=1.8;
const oh=(y,z,r)=>({root:{pos:[0,y,z],pitch:0,roll:r},neck:{flex:0},spine:{flex:0},
 armL:{pos:[0.19,H,0],contact:true,fingers:[0,1,0],palm:[0,0,1],pole:[0.3,-1,0.4],curl:0.82},
 armR:{fk:{flex:0,abd:14,rot:0,elbow:10},rel:'chest'},
 legL:{pos:[0.13,0,0.02],anchor:'sole',yaw:6},legR:{pos:[-0.13,0,0.02],anchor:'sole',yaw:-6}});
save('one-handed-hang',{az:150,el:8},[{type:'pull-up-bar',height:H}],{start:oh(0.9,-0.03,-4)},{muscles:['lats'],muscleSide:'L'});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
