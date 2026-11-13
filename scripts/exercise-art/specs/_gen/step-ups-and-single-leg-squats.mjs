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
const bbArm=s=>({pos:[s*0.33,0.205,-0.02],rel:'chest',contact:true,fingers:[s*0.02,0.97,-0.2],palm:[0,0.2,0.97],curl:0.85,pole:[s*0.5,-0.3,-1],scap:{elev:0,prot:0}});
const bbArms={armL:bbArm(1),armR:bbArm(-1)};
const bbProps=[{type:'barbell',hands:true,plates:[20,10]}];
const dbProps=[{type:'dumbbell',hand:'L',kg:10},{type:'dumbbell',hand:'R',kg:10}];
const footBox={pos:[0.1,BH,0.3],anchor:'sole',pole:[0.05,0.3,1]};
const rootStart={root:{pos:[0.06,0.82,-0.02],pitch:8},spine:{flex:2},neck:{flex:0},legL:footBox,legR:{pos:[-0.11,0,-0.24],anchor:'sole',pole:[-0.05,0.3,1]}};
const rootTop=(y=0.92+BH)=>({root:{pos:[0.1,y,0.3],pitch:0},spine:{flex:0},neck:{flex:0},legL:footBox});
const cam={az:90,el:5};
// step-up with knee raise
save('step-up-with-knee-raise',cam,Q,box,{
 start:{...rootStart,armL:fk(-10),armR:fk(25)},
 mid:{root:{pos:[0.09,1.1,0.2],pitch:6},spine:{flex:1},neck:{flex:0},legL:footBox,legR:{pos:[-0.1,0.9,0.1],anchor:'ankle',pitch:45,pole:[-0.05,0.3,1]},armL:fk(25,40,12),armR:fk(-20,40,14)},
 end:{...rootTop(),legR:{pos:[-0.1,0.92,0.7],anchor:'ankle',pitch:-5,pole:[-0.05,0.3,1]},armL:fk(45,70,10),armR:fk(-30,50,10)}});
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
save('shrimp-squat',{az:90,el:5},['quadriceps','glutes'],[],{
 start:{root:{pos:[-0.05,0.92,0.02],pitch:14},legR:{pos:[-0.08,0,0.04],anchor:'sole',pole:[0,0,1]},
  legL:{pos:[0.16,0.9,-0.12],anchor:'ankle',pitch:95,pole:[0.1,-0.3,1]},armL:holdHand(0.218,0.91,-0.16),armR:fk(85,10)},
 end:{root:{pos:[-0.05,0.38,-0.14],pitch:14},neck:{flex:-10},legR:{pos:[-0.08,0,0.04],anchor:'sole',pole:[0,0,1]},
  legL:{pos:[0.16,0.5,-0.34],anchor:'ankle',pitch:150,pole:[0.1,-0.6,-0.2]},armL:holdHand(0.27,0.50,-0.41),armR:fk(100,10)}},{muscleSide:'R'});
// single-leg high box squat: standing on a 0.6 box, free leg hanging, hand on band
const HB=0.6;
const hb=[{type:'plyo-box',height:HB,pos:[0.35,0,0.3]}];
const hb2=hb;
save('single-leg-high-box-squat',{az:90,el:5},Q,hb2,{
 start:{root:{pos:[0.09,0.92+HB,0.3],pitch:0},legL:{pos:[0.2,HB,0.3],anchor:'sole',pole:[0,0,1]},legR:{fk:{flex:50,abd:0,knee:4},rel:'pelvis'},armL:fk(85,6),armR:fk(85,6)},
 end:{root:{pos:[0.09,0.50+HB,0.04],pitch:38},neck:{flex:-15},legL:{pos:[0.2,HB,0.3],anchor:'sole',pole:[0,0,1]},legR:{fk:{flex:85,abd:0,knee:4},rel:'pelvis'},armL:fk(100,6),armR:fk(100,6)}},{muscleSide:'L',floats:true});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
