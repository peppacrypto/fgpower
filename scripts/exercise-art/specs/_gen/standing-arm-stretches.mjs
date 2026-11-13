import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const legs={legL:{pos:[0.13,0,0],anchor:'sole',yaw:4},legR:{pos:[-0.13,0,0],anchor:'sole',yaw:-4}};
const base=(o={})=>({root:{pos:[0,0.92,0],pitch:0},spine:{flex:0},neck:{flex:0},...legs,...o});
const A=(x,p,pole,extra={})=>({pos:[x*p[0],p[1],p[2]],rel:'world',pole:[x*pole[0],pole[1],pole[2]],...extra});
const both=(p,pole,extra)=>({armL:A(1,p,pole,extra),armR:A(-1,p,pole,extra)});
const out={};
const save=(slug,camera,muscles,start,props=[],more={})=>{out[slug]={slug,camera,muscles,props,frames:{start},...more};};
save('overhead-stretch',{az:30,el:6},['abdominals'],base({...both([0.045,1.88,0.02],[1,0,-0.3],{hand:'ball'})}));
save('upward-stretch',{az:30,el:6},['shoulders'],base({spine:{flex:-3},...both([0.02,1.9,-0.02],[1,0,-0.2],{hand:'flat',fingers:[0,1,0],palm:[1,0,0]})}));
save('upper-back-stretch',{az:60,el:6},['middle-back'],base({root:{pos:[0,0.92,-0.03],pitch:-3},spine:{flex:7,weights:[0,0,1,2,3]},neck:{flex:20},...both([0.045,1.3,0.55],[1,-0.3,0],{hand:'ball'})}));
save('standing-biceps-stretch',{az:150,el:8},['biceps'],base({...both([0.06,1.04,-0.36],[0.5,0.2,-1],{hand:'ball'})}));
save('elbows-back',{az:140,el:8},['chest'],base({spine:{flex:-4},...both([0.09,0.95,-0.1],[1,0,-0.4],{hand:'flat',contact:true,fingers:[0,-1,0],palm:[0,0,-1]})}));
save('triceps-stretch',{az:30,el:6},['triceps'],base({spine:{flex:0,side:0,twist:0},
 armL:{pos:[0.04,1.54,-0.1],rel:'world',pole:[1,0.1,0.6],hand:'relaxed'},
 armR:{pos:[0.2,1.5,0.15],rel:'world',contact:true,hand:'grip',grip:0.02,pole:[-0.3,-1,0.2],fingers:[0,0,-1],palm:[-1,0,0]}}),[],{muscleSide:'L'});
save('tricep-side-stretch',{az:25,el:6},['triceps'],base({
 armR:{fk:{flex:70,abd:-5,rot:0,elbow:130},rel:'chest',hand:'relaxed'},
 armL:{pos:[-0.16,1.44,0.3],rel:'world',contact:true,hand:'flat',fingers:[-1,0,0.3],palm:[0,0,-1],pole:[0.3,-1,0]}}),[],{muscleSide:'R'});
for(const s of ['shoulder-stretch','side-wrist-pull']){
 const sw=s==='side-wrist-pull';
 save(s,{az:25,el:6},['shoulders'],base({
  armL:{pos:sw?[-0.12,1.2,0.38]:[-0.22,1.38,0.32],rel:'world',pole:[0.3,-1,0],hand:'relaxed'},
  armR:{pos:sw?[-0.12,0.97,0.28]:[-0.3,1.12,0.3],rel:'world',contact:true,hand:'grip',pole:sw?[-1,-0.5,0]:[-0.4,-1,-0.2],fingers:[1,0,0],palm:sw?[0,-1,0]:[0,0,-1]}}),[],{muscleSide:'L'});
}
save('one-arm-against-wall',{az:115,el:6},['lats'],base({root:{pos:[0,0.92,0.2],pitch:10},spine:{flex:6},legL:{pos:[0.13,0,0.2],anchor:'sole',yaw:4},legR:{pos:[-0.13,0,0.2],anchor:'sole',yaw:-4},
 armL:{pos:[0.26,1.7,0.76],rel:'world',contact:true,hand:'flat',fingers:[0,1,0],palm:[0,0,1],pole:[1,-0.2,-0.5]},
 armR:{fk:{flex:0,abd:10,rot:0,elbow:10},rel:'chest'}}),[{type:'wall',pos:[0,0,0.79],width:4}],{muscleSide:'L'});

// ---- coach audit 2026-11-13 fixes: real start -> stretch paths ----
const mk=(slug,camera,muscles,fr,props=[],more={})=>{out[slug]={slug,camera,muscles,props,frames:fr,...more};};
const hang=(x)=>({pos:[x*0.29,0.9,0.03],rel:'world',pole:[x*0.3,-1,-0.2],hand:'relaxed'});
// overhead-stretch: laced hands at the chest -> overhead, small lean and rib lift in the hold
mk('overhead-stretch',{az:30,el:6},['abdominals'],{
 start:base({armL:hang(1),armR:hang(-1)}),
 mid:base({...both([0.34,1.55,0.2],[1,-0.3,0],{hand:'open'})}),
 end:base({...both([0.045,1.88,0.02],[0.3,1,-0.3],{hand:'ball'})})},[],{tempo:{lift:'even'}});
// upper-back-stretch: tall -> clasped hands pushed forward, rounded upper back, head dropped
mk('upper-back-stretch',{az:60,el:6},['middle-back'],{
 start:base({armL:{...hang(1),fingers:[0,-1,0.2],palm:[-1,0,0]},armR:{...hang(-1),fingers:[0,-1,0.2],palm:[1,0,0]}}),
 end:base({root:{pos:[0,0.92,-0.06],pitch:-5},spine:{flex:12,weights:[0,0,1,2,3]},neck:{flex:30},
  armL:{pos:[0.045,1.3,0.58],rel:'world',pole:[1,-0.3,0],hand:'ball',fingers:[0,-0.4,1],palm:[-1,0,0]},
  armR:{pos:[-0.045,1.3,0.58],rel:'world',pole:[-1,-0.3,0],hand:'ball',fingers:[0,-0.4,1],palm:[1,0,0]}})},[],{tempo:{lift:'even'}});
// standing-biceps-stretch: hands clasped behind the hips -> straight arms lifted behind, chest tall; side-on camera
mk('standing-biceps-stretch',{az:80,el:8},['biceps'],{
 start:base({...both([0.06,0.92,-0.19],[0.5,0.2,-1],{hand:'ball'})}),
 end:base({spine:{flex:-3},...both([0.08,1.0,-0.36],[0.5,0.2,-1],{hand:'ball'})})},[],{tempo:{lift:'even'}});
// elbows-back: hands planted on the lower back, elbows pulled back and together, chest lifted
const eb=(pole,sp,sc,fg=[0,-1,0])=>base({spine:{flex:sp},...both([0.09,0.95,-0.1],pole,{hand:'flat',contact:true,fingers:fg,palm:[0,0,-1],scap:sc})});
mk('elbows-back',{az:100,el:8},['chest'],{
 start:eb([1,-0.1,-0.1],0,{elev:0,prot:0}),
 end:eb([1,-0.2,-1],-4,{elev:0,prot:-1})},[],{tempo:{lift:'even'}});
// shoulder-stretch: straight arm swings across the chest, other hand hooks it above the elbow and pulls
const cross=(dirx,dirz)=>[0.19-0.62*dirx,1.38,0.62*dirz];
mk('shoulder-stretch',{az:25,el:6},['shoulders'],{
 start:base({armL:hang(1),armR:{...hang(-1),fingers:[0.66,0,0.75],palm:[0,-1,0]}}),
 mid:base({armL:{pos:[0.25,1.38,0.5],rel:'world',pole:[0.3,-1,0],hand:'relaxed'},armR:{pos:[-0.2,1.2,0.3],rel:'world',pole:[-0.3,-1,0.3],hand:'relaxed',fingers:[0.66,0,0.75],palm:[0,-1,0]}}),
 end:base({
  armL:{pos:[-0.2,1.38,0.34],rel:'world',pole:[0.3,-1,0.3],hand:'relaxed'},
  armR:{pos:[-0.05,1.4,0.24],rel:'world',contact:true,hand:'flat',pole:[-0.5,-1,0.2],fingers:[0.66,0,0.75],palm:[0,-1,0]}})},[],{muscleSide:'L'});
// side-wrist-pull: bent arm across at hip level, wrist held from above, pulled straight and up to shoulder height
const wp=(l,r)=>base({armL:{pos:l,rel:'world',pole:[0.3,-1,0],hand:'relaxed'},armR:{pos:r,rel:'world',contact:true,hand:'flat',pole:[-0.5,-1,0.2],fingers:[0.66,0,0.75],palm:[0,-1,0]}});
mk('side-wrist-pull',{az:25,el:6},['shoulders'],{
 start:wp([-0.05,1.05,0.28],[-0.02,1.1,0.24]),
 end:wp([-0.05,1.38,0.45],[-0.02,1.37,0.4])},[],{muscleSide:'L'});
// tricep-side-stretch: arm at the side -> elbow up beside the ear, hand behind the head, other hand grips the elbow and pushes it back and out
const rEnd={pos:[0.2,1.5,0.15],rel:'world',contact:false,hand:'grip',grip:0.02,pole:[-0.3,-1,0.2],fingers:[0,0,-1],palm:[-1,0,0]};
mk('tricep-side-stretch',{az:30,el:6},['triceps'],{
 start:base({armL:hang(1),armR:rEnd}),
 mid:base({armL:{pos:[0.55,1.45,0.02],rel:'world',pole:[0.3,-1,0.2],hand:'relaxed'},armR:rEnd}),
 mid2:base({armL:{pos:[0.16,1.84,-0.02],rel:'world',pole:[1,0.6,0.2],hand:'relaxed'},armR:rEnd}),
 end:base({
  armL:{pos:[0.04,1.54,-0.1],rel:'world',pole:[1,0.1,0.6],hand:'relaxed'},
  armR:{...rEnd,contact:true}})},[],{muscleSide:'L'});
// one-arm-against-wall: hand planted on the wall; hips move away and the trunk leans/side-bends so the lat lengthens
const wl=(root,pitch,sp,side)=>base({root:{pos:root,pitch},spine:{flex:sp,side},legL:{pos:[0.13,0,0.3],anchor:'sole',yaw:4},legR:{pos:[-0.13,0,0.3],anchor:'sole',yaw:-4},
 armL:{pos:[0.26,1.62,0.76],rel:'world',contact:true,hand:'flat',fingers:[0,1,0],palm:[0,0,1],pole:[1,-0.2,-0.5]},
 armR:{fk:{flex:0,abd:10,rot:0,elbow:10},rel:'chest'}});
mk('one-arm-against-wall',{az:115,el:6},['lats'],{
 start:wl([0,0.92,0.3],3,2,0),
 end:wl([0,0.92,0.2],20,10,-8)},[{type:'wall',pos:[0,0,0.79],width:4}],{muscleSide:'L',tempo:{lift:'even'}});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
