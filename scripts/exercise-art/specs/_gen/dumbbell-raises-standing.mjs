import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const fk=(flex,abd,elbow=12,rot=0,pron=0)=>({fk:{flex,abd,rot,elbow},rel:'chest',hand:'grip',pron});
const stand=(p=4,extra={})=>({root:{pos:[0,0.92,0],pitch:p},spine:{flex:2},neck:{flex:-4},legL:{pos:[0.13,0,0.02],anchor:'sole',pitch:0,yaw:6},legR:{pos:[-0.13,0,0.02],anchor:'sole',pitch:0,yaw:-6},...extra});
const WIDE={legL:{pos:[0.24,0,0.02],anchor:'sole',pitch:0,yaw:10},legR:{pos:[-0.24,0,0.02],anchor:'sole',pitch:0,yaw:-10}};
const sit={root:{pos:[0,0.54,0.4],pitch:0},spine:{flex:0},neck:{flex:-4},legL:{pos:[0.15,0,0.85],anchor:'sole',pitch:0,yaw:6},legR:{pos:[-0.15,0,0.85],anchor:'sole',pitch:0,yaw:-6}};
const dbs=[{type:'dumbbell',hand:'L',kg:8},{type:'dumbbell',hand:'R',kg:8}];
const save=(slug,camera,props,frames,more={})=>{out[slug]={slug,camera,muscles:['shoulders'],props,frames,...more};};
// L/R arms; L abd positive outward? mirror R
const A=(l,r,base=stand())=>({...base,armL:l,armR:r});
const both=(f,a,e=12,rot=0,pron=0,base)=>A(fk(f,a,e,rot,pron),fk(f,a,e,rot,pron),base);
const SIDE=cam=>cam;
// side lateral
save('side-lateral-raise',{az:35,el:8},dbs,{start:both(0,6,10,0,0),mid:both(0,50,14),end:both(0,86,16,0,0)});
save('power-partials',{az:35,el:8},dbs,{start:both(0,6,0),mid:both(0,40,0),end:both(0,86,0)});
save('seated-side-lateral-raise',{az:35,el:8},[...dbs,{type:'flat-bench'}],{start:both(0,6,10,0,0,sit),mid:both(0,50,14,0,0,sit),end:both(0,86,16,0,0,sit)});
save('front-two-dumbbell-raise',{az:60,el:8},dbs,{start:both(0,9,8),mid:both(50,4,10),end:both(92,4,10)});
save('front-dumbbell-raise',{az:60,el:8},dbs,{start:A(fk(0,9,8),fk(0,9,8)),mid:A(fk(50,4,10),fk(0,9,8)),end:A(fk(92,4,10),fk(0,9,8))});
save('alternating-deltoid-raise',{az:50,el:8},dbs,{start:both(0,9,8),mid:both(50,4,10),end:both(92,4,10),mid2:both(50,45,12),end2:both(0,88,14)});
save('side-laterals-to-front-raise',{az:50,el:8},dbs,{start:both(0,9,8),mid:both(92,4,10),end:both(92,4,10,0,0),mid2:both(92,45,10)});
save('dumbbell-scaption',{az:55,el:8},dbs,{start:both(0,12,6,0,-90),mid:both(45,18,6,0,-90),end:both(90,32,6,0,-90)});
save('standing-dumbbell-straight-arm-front-delt-raise-above-head',{az:70,el:8},dbs,{start:both(0,9,8),mid:both(90,4,8),end:both(165,4,8)});
save('single-dumbbell-raise',{az:55,el:8},[{type:'dumbbell',hold:'goblet',hands:true,dir:[0,1,0],kg:10}],{start:{...stand(4,WIDE),armL:{pos:[0.045,0.9,0.37],contact:true,fingers:[-0.3,-0.25,0.9],palm:[-0.3,0.9,0.1],curl:0.85,pole:[0.5,-1,-0.4]},armR:{pos:[-0.045,0.9,0.37],contact:true,fingers:[0.3,-0.25,0.9],palm:[0.3,0.9,0.1],curl:0.85,pole:[-0.5,-1,-0.4]}},mid:{...stand(4,WIDE),armL:{pos:[0.045,1.15,0.6],contact:true,fingers:[-0.3,0.3,0.95],palm:[-0.3,0.9,-0.3],curl:0.85,pole:[0.5,-1,-0.4]},armR:{pos:[-0.045,1.15,0.6],contact:true,fingers:[0.3,0.3,0.95],palm:[0.3,0.9,-0.3],curl:0.85,pole:[-0.5,-1,-0.4]}},mid2:{...stand(4,WIDE),armL:{pos:[0.045,1.45,0.69],contact:true,fingers:[-0.3,0.3,0.95],palm:[-0.3,0.9,-0.3],curl:0.85,pole:[0.5,-1,-0.4]},armR:{pos:[-0.045,1.45,0.69],contact:true,fingers:[0.3,0.3,0.95],palm:[0.3,0.9,-0.3],curl:0.85,pole:[-0.5,-1,-0.4]}},end:{...stand(4,WIDE),armL:{pos:[0.045,1.66,0.65],contact:true,fingers:[-0.3,0.3,0.95],palm:[-0.3,0.9,-0.3],curl:0.85,pole:[0.5,-1,-0.4]},armR:{pos:[-0.045,1.66,0.65],contact:true,fingers:[0.3,0.3,0.95],palm:[0.3,0.9,-0.3],curl:0.85,pole:[-0.5,-1,-0.4]}}});
save('iron-cross',{az:50,el:8},dbs,{start:{root:{pos:[0,0.6,-0.08],pitch:25},spine:{flex:8},neck:{flex:-12},legL:{pos:[0.2,0,0.1],anchor:'sole',pitch:0,yaw:15},legR:{pos:[-0.2,0,0.1],anchor:'sole',pitch:0,yaw:-15},armL:fk(90,4,0),armR:fk(90,4,0)},end:both(0,90,0,0,0,{...stand(),legL:{pos:[0.2,0,0.1],anchor:'sole',pitch:0,yaw:15},legR:{pos:[-0.2,0,0.1],anchor:'sole',pitch:0,yaw:-15}})});
// one arm with off hand on incline bench
save('one-arm-side-laterals',{az:50,el:8},[{type:'dumbbell',hand:'R',kg:8},{type:'incline-bench',angle:60,pos:[0.78,0,0.1],yaw:0}],{start:{...stand(0,{root:{pos:[0.04,0.92,0],pitch:0,roll:8}}),armR:fk(0,12,8),armL:{pos:[0.5,1.05,0.1],contact:true,fingers:[0,0,1],palm:[0,-1,0],curl:0.6,pole:[1,0,-0.3]}},end:{...stand(0,{root:{pos:[0.04,0.92,0],pitch:0,roll:8}}),armR:fk(0,88,12),armL:{pos:[0.5,1.05,0.1],contact:true,fingers:[0,0,1],palm:[0,-1,0],curl:0.6,pole:[1,0,-0.3]}}});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
