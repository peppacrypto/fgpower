import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,muscles,props,frames,more={})=>{out[slug]={slug,camera,muscles,props,frames,...more};};
const L=(x,y,z,e={})=>({pos:[x,y,z],anchor:'sole',pole:[0.1,0.5,1],...e});
const R=(x,y,z,e={})=>({pos:[x,y,z],anchor:'sole',pole:[-0.1,0.5,1],...e});
const rearFoot=(z,e={})=>R(-0.12,0.05,z,{anchor:'ball',pitch:60,pole:[-0.1,-0.2,1],...e});
const hipsArm={fk:{flex:-35,abd:30,rot:0,elbow:25},rel:'chest'};
const body=(hy,hz,legL,legR,pitch=0,sf=0)=>({root:{pos:[0,hy,hz],pitch},spine:{flex:sf},neck:{flex:0},legL,legR});
// arms
const dbArm=(s,hy,hz)=>({pos:[s*0.38,hy-0.078,hz+0.06],contact:true,fingers:[0,-1,0],palm:[-s*0.25,0,1],curl:0.85,pole:[s*0.15,0,-1]});
const dbArms=(hy,hz)=>({armL:dbArm(1,hy,hz),armR:dbArm(-1,hy,hz)});
const dbProps=()=>[{type:'dumbbell',hand:'L',kg:15},{type:'dumbbell',hand:'R',kg:15}];
const bbArm=s=>({pos:[s*0.33,0.215,-0.015],rel:'chest',contact:true,fingers:[s*0.02,0.97,-0.2],palm:[0,0.2,0.97],curl:0.85,pole:[s*0.5,-0.3,-1],scap:{elev:0,prot:0}});
const bbArms={armL:bbArm(1),armR:bbArm(-1)};
const bbProps=(plates=[20,10])=>[{type:'barbell',hands:true,plates}];
const sidecam={az:80,el:8};
const Q=['quadriceps','glutes'];

// ---- Stepping lunges (2026-11-13 fix2). Loop: start (standing) -> mid (the stepping foot lifted) -> mid2 (it reaches over its spot)
// -> mid3 (set down, both feet planted) -> end (the bottom) and back. The planted foot keeps one spot (the rear foot pivots on its
// ball, toes flat). Statically balanced, as check.mjs measures: the weight goes over the standing foot before the lift and stays
// there until the stepping foot is down; the hips then travel to the bottom over both feet.
const D=Math.PI/180;
const Bx=(pos,legL,legR,pitch,sf,arms,spine={})=>({root:{pos,pitch},spine:{flex:sf,...spine},neck:{flex:-0.4*(pitch+sf)},legL,legR,...arms(pos,pitch+sf)});
const hipsA=()=>({armL:hipsArm,armR:hipsArm});
const bbA=()=>bbArms;
// dumbbells hang straight under the shoulders, neutral grip (palms to the thighs)
const dbHang=(s,p,lean)=>{const sy=p[1]+0.46*Math.cos(lean*D),sz=p[2]+0.02+0.46*Math.sin(lean*D);return {pos:[p[0]+s*0.28,sy-0.6,sz],contact:true,fingers:[0,-1,0],palm:[-s,0,0],curl:0.85,pole:[s*0.15,0,-1]};};
const dbA=(p,lean)=>({armL:dbHang(1,p,lean),armR:dbHang(-1,p,lean)});
const Lp=[0.1,0.5,1],Rp=[-0.1,0.5,1],Rk=[-0.1,-0.2,1];
// forward lunge: L steps forward (lands heel first at zhl), R stays on its ball at z 0.13
function fwdLunge(arms,zhl,z2,y2){
 const zh=zhl+0.05-0.33;
 const Lflat={pos:[0.12,0,zhl],anchor:'heel',pitch:0,yaw:2,pole:Lp};
 const Rb=(pitch)=>({pos:[-0.12,0,0.13],anchor:'ball',pitch,toes:0,pole:Rk});
 return {
  start:Bx([-0.03,0.925,0.03],{pos:[0.12,0,0.04],anchor:'sole',pole:Lp},Rb(0),0,0,arms),
  mid:Bx([-0.09,0.9,0.05],{pos:[0.12,0.16,0.07],anchor:'ankle',pitch:0,pole:Lp},Rb(0),0,0,arms),
  mid2:Bx([-0.07,y2,z2],{pos:[0.12,0.03,zhl-0.0135],anchor:'heel',pitch:-12,yaw:2,pole:Lp},Rb(12),0,0,arms),
  mid3:Bx([0,y2-0.02,z2+0.03],Lflat,Rb(18),0,0,arms),
  end:Bx([0,0.52,zh],Lflat,Rb(55),0,2,arms)};
}
save('bodyweight-walking-lunge',sidecam,Q,[],fwdLunge(hipsA,0.68,0.11,0.72));
save('barbell-walking-lunge',sidecam,Q,bbProps(),fwdLunge(bbA,0.72,0.14,0.69));
save('barbell-lunge',sidecam,Q,bbProps(),fwdLunge(bbA,0.72,0.14,0.69));
save('dumbbell-lunges',sidecam,Q,dbProps(),fwdLunge(dbA,0.72,0.14,0.69));
// reverse lunge: L (front) stays flat; R lifts, reaches back, lands on its ball at zb, then the hips drop between the feet
function rearLunge(arms,P){
 const fy=P.fy||0,fz=P.fz||0;
 const Lf={pos:[0.12,fy,0.04+fz],anchor:'sole',yaw:2,pole:Lp};
 const Rb=(z,y,pitch)=>({pos:[P.rx??-0.12,y,z],anchor:'ball',pitch,toes:0,pole:Rk});
 return {
  start:Bx([0.03,0.925+fy,0.03+fz],Lf,{pos:[-0.12,fy,0.04+fz],anchor:'sole',pole:Rp},0,0,arms),
  mid:Bx([0.09,0.9+fy,0.05+fz],Lf,{pos:[-0.12,fy+(P.lift||0.16),-0.10+fz],anchor:'ankle',pitch:5,pole:Rp},0,0,arms),
  mid2:Bx([P.x2,P.y2,P.z2],Lf,Rb(P.zb+0.02,0.04,35),P.pt2,P.sf2,arms,P.s2),
  mid3:Bx([P.x3,P.y3,P.z3],Lf,Rb(P.zb,0,40),P.pt3,P.sf3,arms,P.s3),
  end:Bx([0,P.yh,P.zh],Lf,Rb(P.zb,0,P.pe),P.pte||0,P.sfe||3,arms,P.se)};
}
save('dumbbell-rear-lunge',sidecam,Q,dbProps(),rearLunge(dbA,{zb:-0.78,x2:0.07,y2:0.60,z2:-0.15,pt2:12,sf2:8,x3:0.04,y3:0.57,z3:-0.19,pt3:10,sf3:6,yh:0.52,zh:-0.38,pe:58}));
// crossover reverse lunge: the rear foot lands behind and a little across; the trunk turns over the front (L) leg, arms long in front
{const xa={fk:{flex:75,abd:-12,rot:0,elbow:15},rel:'chest',hand:'fist'};
 save('crossover-reverse-lunge',{az:45,el:10},['obliques','glutes','quadriceps'],[],rearLunge(()=>({armL:xa,armR:xa}),
  {zb:-0.76,rx:-0.04,x2:0.07,y2:0.60,z2:-0.14,pt2:12,sf2:8,x3:0.04,y3:0.57,z3:-0.18,pt3:10,sf3:6,s3:{twist:15},yh:0.52,zh:-0.37,pe:58,se:{twist:30}}));}
// elevated back lunge: both feet on a short platform, R steps back down to the floor, the back knee down to the floor
save('elevated-back-lunge',sidecam,Q,[{type:'step-platform',height:0.15,depth:0.38,pos:[0,0,0.315]},...bbProps([20])],
 rearLunge(bbA,{fy:0.15,fz:0.25,zb:-0.42,lift:0.18,x2:0.07,y2:0.66,z2:0.08,pt2:14,sf2:6,x3:0.04,y3:0.62,z3:0.04,pt3:12,sf3:5,yh:0.475,zh:-0.10,pe:55,pte:4,sfe:3}));
// side split squat: wide stance, the lead (L) foot turned out 40; the hips shift over it and down, the R leg stays nearly straight
{const Ls={pos:[0.52,0,0.02],anchor:'sole',yaw:40,pole:[0.8,0.2,0.6]},Rs={pos:[-0.46,0,0],anchor:'sole',yaw:-5,pole:[-0.2,0.3,1]};
 save('barbell-side-split-squat',{az:25,el:8},['quadriceps','adductors','glutes'],bbProps([20]),{
  start:Bx([0.03,0.84,0],Ls,Rs,0,3,bbA),end:Bx([0.24,0.62,-0.06],Ls,Rs,6,8,bbA)});}

// stationary split squat (back heel lifted, wall hold omitted)
save('split-squat',sidecam,Q,[],{
 start:{...body(0.82,0.0,L(0.12,0,0.43,{yaw:2}),rearFoot(-0.6)),armL:hipsArm,armR:hipsArm},
 end:{...body(0.6,0.0,L(0.12,0,0.43,{yaw:2}),rearFoot(-0.7)),armL:hipsArm,armR:hipsArm}});
// rear foot on bench (bench along X, behind)
const bench=[{type:'flat-bench',yaw:90,pos:[0,0,-0.72]}];
const bulg=(hy,hz)=>body(hy,hz,L(0.12,0,0.4,{yaw:2}),R(-0.12,0.52,-0.68,{anchor:'ball',pitch:85,pole:[-0.1,-0.2,1]}),0,4);
save('split-squat-with-dumbbells',sidecam,Q,[...bench,...dbProps()],{
 start:{...bulg(0.86,0.0),...dbArms(0.86,0)},end:{...bulg(0.64,0.02),...dbArms(0.64,0.02)}});
save('one-leg-barbell-squat',sidecam,Q,[...bench,...bbProps()],{
 start:{...bulg(0.86,0.0),...bbArms},end:{...bulg(0.56,0.04),...bbArms}});
{const b=JSON.parse(fs.readFileSync(W+'bulgarian-split-squat.json'));for(const k in b.frames){const F=b.frames[k];F.armL={...F.armL,pos:[0.24,0.17,0.03],fingers:[-0.3,-0.1,0.9],hand:'flat',contact:true};F.armR={...F.armR,pos:[-0.24,0.17,0.03],fingers:[0.3,-0.1,0.9],hand:'flat',contact:true};}out['bulgarian-split-squat']=b;}
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
