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
 start:fr(1.185,-0.03,2,0,-4,O,[4,6]),
 end:fr(1.2,-0.12,-12,8,4,O,[132,10])},{tempo:{lift:'there',up:1,down:1.8,squeeze:0.35,stretch:0.2}});
save('gorilla-chin-crunch',cam,bar,{
 start:fr(1.185,-0.03,2,0,-4,arms(0.2,'under'),[4,6]),
 end:fr(1.2,-0.14,-10,22,2,arms(0.2,'under'),[122,118])});
save('wind-sprints',cam,bar,{
 start:fr(1.185,-0.03,-2,0,-4,O,[100,100],[4,6]),
 end:fr(1.185,-0.03,-2,0,-4,O,[4,6],[100,100])},{tempo:{lift:'even',up:0.4,down:0.4,squeeze:0,stretch:0}});
// captain's chair
const Y2=1.30,ch=s=>({pos:[s*0.225,Y2+0.10,0.29],contact:true,fingers:[0,0,1],palm:[-s,0,0],pole:[s*0.15,-1,-0.15],curl:0.82});
const CA={armL:ch(1),armR:ch(-1)};
save('knee-hip-raise-on-parallel-bars',{az:64,el:10},[{type:'captains-chair'}],{
 start:{root:{pos:[0,1.144,-0.075],pitch:0},neck:{flex:2},spine:{flex:0},...CA,legL:lg(6,8),legR:lg(6,8)},
 mid:{root:{pos:[0,1.144,-0.075],pitch:-6},neck:{flex:8},spine:{flex:4},...CA,legL:lg(75,112),legR:lg(75,112)},
 end:{root:{pos:[0,1.144,-0.06],pitch:-10},neck:{flex:14},spine:{flex:6},...CA,legL:lg(118,115),legR:lg(118,115)}});
// one-handed hang
const H=2.25;
const oh=(y,z,r)=>({root:{pos:[0,y,z],pitch:0,roll:r},neck:{flex:0},spine:{flex:0},
 armL:{pos:[0.19,H,0],contact:true,fingers:[0,1,0],palm:[0,0,1],pole:[0.3,-1,0.4],curl:0.82},
 armR:{fk:{flex:0,abd:12,rot:0,elbow:8}},
 legL:lg(3,4),legR:lg(3,4)});
save('one-handed-hang',{az:35,el:8},[{type:'pull-up-bar',height:H}],{start:oh(1.185,-0.03,-4)},{muscles:['lats'],muscleSide:'L'});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
