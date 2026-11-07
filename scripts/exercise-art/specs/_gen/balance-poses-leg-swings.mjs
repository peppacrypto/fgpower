import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,muscles,frames,more={})=>{out[slug]={slug,camera,muscles,frames,...more};};
const stL=(x=0.1,extra={})=>({pos:[x,0,0],anchor:'sole',pole:[0.05,0.3,1],...extra});
const rootS=(x=0.1,y=0.92,extra={})=>({pos:[x,y,0],...extra});
const free=(pos,o={})=>({pos,anchor:'ankle',pole:[-0.1,0,1],...o});
const fk=(flex,abd,elbow,rot=0)=>({fk:{flex,abd,rot,elbow},rel:'chest'});
const down=fk(0,10,15);
const side=fk(0,90,0), up=fk(172,14,0);
const palmH=(s,x,y,z)=>({pos:[s*x,y,z],contact:true,fingers:[0,1,0.25],palm:[-s,0,0],pole:[s*0.5,-1,0],curl:0.3});
const rail=(x,y,z)=>({pos:[x,y,z],contact:true,hand:'flat',fingers:[0,0,1],palm:[0,-1,0],pole:[0.6,-0.3,-1],curl:0.2});
// tree
save('tree-pose',{az:20,el:6},['calves'],{start:{root:rootS(0.1),neck:{flex:0},legL:stL(0.1),
 legR:{pos:[0.12,0.3,0.1],anchor:'sole',pole:[-1,0.1,0.3],yaw:-80,pitch:20},armL:palmH(1,0.03,1.3,0.22),armR:palmH(-1,0.03,1.3,0.22)}});
// eagle
save('eagle-pose',{az:15,el:6},['shoulders'],{start:{root:{pos:[0.05,0.72,0],pitch:6},neck:{flex:0},
 legL:{pos:[0.08,0,0],anchor:'sole',pole:[0.2,0.3,1]},legR:{pos:[0.25,0.4,0.26],anchor:'ankle',pole:[0.6,0,1]},
 armL:fk(70,-30,120),armR:fk(80,-40,130)}});
// warrior 3
const w3={root:{pos:[0,0.83,0.0],pitch:88},neck:{flex:-70},spine:{flex:0},legL:stL(0,{pole:[0,0.3,1]}),legR:free([-0.1,0.83,-0.85],{pole:[0,1,0],pitch:-90,roll:180}),armL:fk(172,10,0),armR:fk(172,10,0)};
save('warrior-3',{az:85,el:6},['hamstrings'],{start:w3});
// half moon
save('half-moon-pose',{az:12,el:8},['hamstrings'],{start:{root:{pos:[0.25,0.78,0],roll:-85,yaw:0},neck:{twist:-90,flex:0},
 legL:stL(0.25,{pole:[0.1,0.3,1]}),legR:free([-0.58,0.72,0],{pole:[0,1,0],pitch:0,roll:-30}),
 armL:{pos:[0.6,0.14,-0.05],contact:true,hand:'flat',fingers:[0,0,1],palm:[0,-1,0],pole:[0.5,-0.3,-1],curl:0.2},armR:fk(0,170,0)}});
// swings with chair
const ch=[{type:'chair',pos:[0.62,0,0],yaw:90}];
const hold=rail(0.385,0.86,0.0);
const base=(extra)=>({root:rootS(0.1),neck:{flex:0},legL:stL(0.1),armL:hold,armR:fk(0,extra.abdR||40,10),...extra});
save('front-leg-raises',{az:90,el:6},['hamstrings'],{
 start:base({legR:free([-0.1,0.2,0.46],{pole:[0,0.3,1],pitch:-30})}),
 end:base({legR:free([-0.1,0.25,-0.5],{pole:[0,0.3,1],pitch:30})})},{props:ch});
save('side-leg-raises',{az:5,el:6},['adductors'],{
 start:base({legR:free([-0.65,0.4,0.0],{pole:[-1,0.5,0.5]})}),
 end:base({legR:free([0.2,0.2,0.3],{pole:[0,0.3,1]})})},{props:ch});
save('leg-lift',{az:90,el:6},['glutes'],{
 start:base({legR:free([-0.1,0.1,-0.1],{pole:[0,0,1]})}),
 end:base({legR:free([-0.1,0.5,-0.5],{pole:[0,0,1],pitch:60})})},{props:ch});
save('standing-hip-circles',{az:60,el:8},['abductors'],{
 start:base({legR:free([-0.1,0.7,0.35],{pole:[-0.5,0,1]})}),
 mid:base({abdR:65,legR:free([-0.45,0.7,0.2],{pole:[-1,0,0.5]})}),
 end:base({abdR:65,legR:free([-0.45,0.7,-0.1],{pole:[-1,0,0]})})},{props:ch});
// circles free
const std=(o={})=>({root:rootS(0,0.92),neck:{flex:0},legL:stL(0.1,{pos:[0.1,0,0]}),legR:{pos:[-0.1,0,0],anchor:'sole',pole:[-0.05,0.3,1]},...o});
save('knee-circles',{az:35,el:8},['calves'],{
 start:{root:{pos:[0,0.8,0.05],pitch:5},legL:{pos:[0.1,0,0],anchor:'sole',pole:[0.15,0.3,1]},legR:{pos:[-0.1,0,0],anchor:'sole',pole:[-0.15,0.3,1]},armL:fk(30,15,90),armR:fk(30,15,90)},
 mid:{root:{pos:[0.04,0.8,-0.04],pitch:5},legL:{pos:[0.1,0,0],anchor:'sole',pole:[0.4,0.3,1]},legR:{pos:[-0.1,0,0],anchor:'sole',pole:[-0.1,0.3,1]},armL:fk(30,15,90),armR:fk(30,15,90)},
 end:{root:{pos:[-0.04,0.8,0.05],pitch:5},legL:{pos:[0.1,0,0],anchor:'sole',pole:[0.0,0.3,1]},legR:{pos:[-0.1,0,0],anchor:'sole',pole:[-0.4,0.3,1]},armL:fk(30,15,90),armR:fk(30,15,90)}});
const rk=[{type:'squat-rack'}];
const ank=(p,pitch)=>base({armL:hold,legR:free([-0.1,0.14,0.2],{pole:[0,1,0.3],pitch})});
save('ankle-circles',{az:50,el:10},['calves'],{
 start:{...ank(0,20),legR:{pos:[-0.15,0.16,0.15],anchor:'ankle',pole:[0.1,1,0],pitch:10}},
 mid:{...ank(0,20),legR:{pos:[-0.1,0.16,0.15],anchor:'ankle',pole:[0,1,0.4],pitch:30}},
 end:{...ank(0,20),legR:{pos:[-0.1,0.16,0.15],anchor:'ankle',pole:[-0.3,1,0],pitch:10}}},{props:ch});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
