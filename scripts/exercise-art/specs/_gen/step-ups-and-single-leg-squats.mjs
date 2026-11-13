import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,muscles,props,frames,more={})=>{out[slug]={slug,camera,muscles,props,frames,...more};};
const BH=0.4;
const box=[{type:'step-platform',height:BH,width:0.9,depth:0.5,pos:[0,0,0.3]}];
const Q=['quadriceps','glutes'];
const fk=(f,e=20,a=4)=>({fk:{flex:f,abd:a,elbow:e},rel:'chest'});
const dbArm=(s,hy,hz)=>({pos:[s*0.40,hy+0.0,hz+0.0],contact:true,fingers:[0,-1,0],palm:[-s*0.25,0,1],curl:0.85,pole:[s*0.15,0,-1]});
const dbArms=(hy,hz)=>({armL:dbArm(1,hy,hz),armR:dbArm(-1,hy,hz)});
const bbArm=s=>({pos:[s*0.33,0.215,-0.015],rel:'chest',contact:true,fingers:[s*0.02,0.97,-0.2],palm:[0,0.2,0.97],curl:0.85,pole:[s*0.5,-0.3,-1],scap:{elev:0,prot:0}});
const bbArms={armL:bbArm(1),armR:bbArm(-1)};
const bbProps=[{type:'barbell',hands:true,plates:[20,10]}];
const dbProps=[{type:'dumbbell',hand:'L',kg:10},{type:'dumbbell',hand:'R',kg:10}];
const footBox={pos:[0.1,BH,0.3],anchor:'sole',pole:[0.05,0.3,1]};
const rootStart={root:{pos:[0.06,0.82,-0.02],pitch:14},spine:{flex:2},neck:{flex:0},legL:footBox,legR:{pos:[-0.11,0,-0.24],anchor:'sole',pole:[-0.05,0.3,1]}};
const rootTop=(y=0.92+BH)=>({root:{pos:[0.1,y,0.3],pitch:0},spine:{flex:0},neck:{flex:0},legL:footBox});
const cam={az:80,el:8};
// step-up with knee raise
save('step-up-with-knee-raise',cam,Q,box,{
 start:{...rootStart,armL:fk(-10),armR:fk(25)},
 mid:{root:{pos:[0.09,1.1,0.2],pitch:6},spine:{flex:1},neck:{flex:0},legL:footBox,legR:{pos:[-0.1,0.9,0.1],anchor:'ankle',pitch:45,pole:[-0.05,0.3,1]},armL:fk(10,20,12),armR:fk(-20,20,14)},
 end:{...rootTop(),legR:{pos:[-0.1,0.92,0.7],anchor:'ankle',pitch:-5,pole:[-0.05,0.3,1]},armL:fk(30,60,10),armR:fk(-15,60,10)}});
const mid={root:{pos:[0.09,1.12,0.2],pitch:10},spine:{flex:2},neck:{flex:0},legL:footBox,legR:{pos:[-0.11,0.72,0.15],anchor:'sole',pitch:30,pole:[-0.05,0.3,1]}};
const mid2={root:{pos:[0.1,1.1,0.28],pitch:6},spine:{flex:1},neck:{flex:0},legL:footBox,legR:{pos:[-0.11,BH+0.2,0.3],anchor:'sole',pitch:22,pole:[-0.05,0.3,1]}};
const feetTop={...rootTop(),legR:{pos:[-0.11,BH+0.025,0.3],anchor:'sole',pole:[-0.05,0.3,1]}};
save('barbell-step-ups',cam,Q,[...box,...bbProps],{start:{...rootStart,...bbArms},mid:{...mid,...bbArms},mid2:{...mid2,...bbArms},end:{...feetTop,...bbArms}});
save('dumbbell-step-ups',cam,Q,[...box,...dbProps],{start:{...rootStart,...dbArms(0.82,-0.04)},mid:{...mid,...dbArms(1.12,0.1)},mid2:{...mid2,...dbArms(1.1,0.25)},end:{...feetTop,...dbArms(0.92+BH,0.3)}});
// pistol
const pArm=fk(88,4);
save('pistol-squat',{az:68,el:8},['quadriceps'],[],{
 start:{root:{pos:[0.07,0.928,0.2],pitch:3},armL:pArm,armR:pArm,legL:{pos:[0.1,0,0.28],anchor:'sole',pole:[-0.1,0,1]},legR:{fk:{flex:85,abd:0,knee:4},foot:{pitch:-20}}},
 end:{root:{pos:[0.07,0.52,-0.12],pitch:36},neck:{flex:-18},armL:fk(112,4),armR:fk(112,4),legL:{pos:[0.1,0,0.28],anchor:'sole',pole:[-0.1,0,1]},legR:{fk:{flex:100,abd:0,knee:4},foot:{pitch:-20}}}},{muscleSide:'L'});
// shrimp: right leg stands, left foot held behind by the left hand (same side: the opposite hand cannot cross the body in this rig)
const holdHand=(x,y,z)=>({pos:[x,y,z],contact:true,hand:'hook',fingers:[0,-0.4,-1],palm:[-1,0,0],pole:[0.9,-0.2,-0.3]});
save('shrimp-squat',{az:60,el:8},['quadriceps','glutes'],[],{
 start:{root:{pos:[-0.05,0.92,0.02],pitch:14},legR:{pos:[-0.08,0,0.04],anchor:'sole',pole:[0,0,1]},
  legL:{pos:[0.16,0.9,-0.12],anchor:'ankle',pitch:95,pole:[0.1,-0.3,1]},armL:holdHand(0.218,0.91,-0.16),armR:fk(85,10)},
 end:{root:{pos:[-0.05,0.38,-0.22],pitch:40},neck:{flex:-15},legR:{pos:[-0.08,0,0.04],anchor:'sole',pole:[0,0,1]},
  legL:{pos:[0.16,0.33,-0.24],anchor:'ankle',pitch:110,pole:[0.1,-0.5,1]},armL:holdHand(0.25,0.35,-0.3),armR:fk(100,10)}},{muscleSide:'R'});
// single-leg high box squat: standing on a 0.6 box, free leg hanging, hand on band
const HB=0.6;
const hb=[{type:'plyo-box',height:HB,pos:[0.35,0,0.3]}];
const band={type:'band',a:{pos:[0.38,2.2,0.62]},b:{hand:'L'},follow:'pelvis',width:0.032,r:0.007,rest:0.5};
const hArm={pos:[0.38,1.1+HB,0.62],contact:true,hand:'grip',grip:0.015,fingers:[0,0.3,1],palm:[-1,0,0],pole:[0.5,-0.6,-0.1]};
save('single-leg-high-box-squat',{az:70,el:6},Q,[...hb,band],{
 start:{root:{pos:[0.09,0.92+HB,0.3],pitch:0},legL:{pos:[0.2,HB,0.3],anchor:'sole',pole:[0,0,1]},legR:{fk:{flex:5,abd:0,knee:8},rel:'pelvis'},armL:hArm,armR:fk(80,10)},
 end:{root:{pos:[0.09,0.66+HB,0.2],pitch:25},legL:{pos:[0.2,HB,0.3],anchor:'sole',pole:[0,0,1]},legR:{fk:{flex:25,abd:0,knee:25},rel:'pelvis'},armL:hArm,armR:fk(100,10)}},{muscleSide:'L',floats:true});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
