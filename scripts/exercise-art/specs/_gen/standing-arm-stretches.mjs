import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const legs={legL:{pos:[0.13,0,0],anchor:'sole',yaw:4},legR:{pos:[-0.13,0,0],anchor:'sole',yaw:-4}};
const base=(o={})=>({root:{pos:[0,0.92,0],pitch:0},spine:{flex:0},neck:{flex:0},...legs,...o});
const A=(x,p,pole,extra={})=>({pos:[x*p[0],p[1],p[2]],rel:'world',pole:[x*pole[0],pole[1],pole[2]],...extra});
const both=(p,pole,extra)=>({armL:A(1,p,pole,extra),armR:A(-1,p,pole,extra)});
const out={};
const save=(slug,camera,muscles,start,props=[],more={})=>{out[slug]={slug,camera,muscles,props,frames:{start},...more};};
save('overhead-stretch',{az:30,el:6},['abdominals'],base({...both([0.045,1.88,0.02],[1,0,-0.3],{hand:'ball'})}));
save('upward-stretch',{az:30,el:6},['shoulders'],base({spine:{flex:-3},...both([0.02,1.9,-0.02],[1,0,-0.2],{hand:'flat',contact:true,fingers:[0,1,0],palm:[1,0,0]})}));
save('upper-back-stretch',{az:60,el:6},['middle-back'],base({root:{pos:[0,0.92,-0.03],pitch:-3},spine:{flex:7,weights:[0,0,1,2,3]},neck:{flex:20},...both([0.045,1.3,0.55],[1,-0.3,0],{hand:'ball'})}));
save('standing-biceps-stretch',{az:150,el:8},['biceps'],base({...both([0.06,1.04,-0.36],[0.5,0.2,-1],{hand:'ball'})}));
save('elbows-back',{az:140,el:8},['chest'],base({spine:{flex:-4},...both([0.08,0.95,-0.14],[1,0,-0.4],{hand:'flat',contact:true,fingers:[0,-1,0],palm:[0,0,-1]})}));
save('triceps-stretch',{az:30,el:6},['triceps'],base({spine:{flex:0,side:0,twist:0},
 armL:{pos:[0.04,1.54,-0.1],rel:'world',pole:[1,0.1,0.6],hand:'relaxed'},
 armR:{pos:[0.2,1.5,0.15],rel:'world',contact:true,hand:'grip',grip:0.02,pole:[-0.3,-1,0.2],fingers:[0,0,-1],palm:[-1,0,0]}}),[],{muscleSide:'L'});
save('tricep-side-stretch',{az:25,el:6},['triceps'],base({
 armR:{fk:{flex:70,abd:-5,rot:0,elbow:130},rel:'chest',hand:'relaxed'},
 armL:{pos:[-0.08,1.5,0.24],rel:'world',contact:true,hand:'flat',fingers:[-1,0,0.3],palm:[0,0,-1],pole:[0.3,-1,0]}}),[],{muscleSide:'R'});
for(const s of ['shoulder-stretch','side-wrist-pull']){
 const sw=s==='side-wrist-pull';
 save(s,{az:25,el:6},['shoulders'],base({
  armL:{pos:sw?[-0.12,1.2,0.38]:[-0.22,1.38,0.32],rel:'world',pole:[0.3,-1,0],hand:'relaxed'},
  armR:{pos:sw?[-0.12,0.97,0.28]:[-0.3,1.12,0.3],rel:'world',contact:true,hand:'grip',pole:sw?[-1,-0.5,0]:[-0.4,-1,-0.2],fingers:[1,0,0],palm:sw?[0,-1,0]:[0,0,-1]}}),[],{muscleSide:'L'});
}
save('one-arm-against-wall',{az:115,el:6},['lats'],base({root:{pos:[0,0.92,0.2],pitch:10},spine:{flex:6},legL:{pos:[0.13,0,0.2],anchor:'sole',yaw:4},legR:{pos:[-0.13,0,0.2],anchor:'sole',yaw:-4},
 armL:{pos:[0.26,1.7,0.76],rel:'world',contact:true,hand:'flat',fingers:[0,1,0],palm:[0,0,1],pole:[1,-0.2,-0.5]},
 armR:{fk:{flex:0,abd:10,rot:0,elbow:10},rel:'chest'}}),[{type:'wall',pos:[0,0,0.79],width:4}],{muscleSide:'L'});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
