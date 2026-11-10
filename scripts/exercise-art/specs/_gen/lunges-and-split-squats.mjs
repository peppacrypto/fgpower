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
const bbProps=()=>[{type:'barbell',hands:true,plates:[20,10]}];
const sidecam={az:80,el:8};
const Q=['quadriceps','glutes'];
// forward lunge: front L at hz+0.43, rear R
const fwdStand=(hz=0)=>body(0.92,hz,L(0.12,0,hz+0.03),R(-0.12,0,hz-0.03));
const fwdDown=(hz=0.06,e=0.62)=>body(e,hz,L(0.12,0,hz+0.43,{yaw:2}),rearFoot(hz-0.7));
function fwd(slug,arms,props,cam=sidecam){
 save(slug,cam,Q,props,{start:{...fwdStand(),...arms(0.92,0)},end:{...fwdDown(),...arms(0.62,0.06)}});
}
fwd('bodyweight-walking-lunge',()=>({armL:hipsArm,armR:hipsArm}),[]);
fwd('barbell-walking-lunge',()=>bbArms,bbProps());
fwd('barbell-lunge',()=>bbArms,bbProps());
fwd('dumbbell-lunges',dbArms,dbProps());
// stationary split squat (back heel lifted, wall hold omitted)
save('split-squat',sidecam,Q,[],{
 start:{...body(0.82,0.0,L(0.12,0,0.43,{yaw:2}),rearFoot(-0.6)),armL:hipsArm,armR:hipsArm},
 end:{...fwdDown(0.0,0.6),armL:hipsArm,armR:hipsArm}});
// rear foot on bench (bench along X, behind)
const bench=[{type:'flat-bench',yaw:90,pos:[0,0,-0.72]}];
const bulg=(hy,hz)=>body(hy,hz,L(0.12,0,0.4,{yaw:2}),R(-0.12,0.52,-0.68,{anchor:'ball',pitch:85,pole:[-0.1,-0.2,1]}),0,4);
save('split-squat-with-dumbbells',sidecam,Q,[...bench,...dbProps()],{
 start:{...bulg(0.86,0.0),...dbArms(0.86,0)},end:{...bulg(0.64,0.02),...dbArms(0.64,0.02)}});
save('one-leg-barbell-squat',sidecam,Q,[...bench,...bbProps()],{
 start:{...bulg(0.86,0.0),...bbArms},end:{...bulg(0.64,0.02),...bbArms}});
// rear lunges: front foot planted at z 0.3
const rStand=()=>body(0.92,0.3,L(0.12,0,0.3,{yaw:2}),R(-0.12,0,0.27));
const rDown=(e={})=>body(0.62,-0.13,L(0.12,0,0.3,{yaw:2}),rearFoot(-0.8,e));
save('dumbbell-rear-lunge',sidecam,Q,dbProps(),{start:{...rStand(),...dbArms(0.92,0.3)},end:{...rDown(),...dbArms(0.62,-0.13)}});
// elevated back lunge: start both feet on platform, step back to floor
const plat=[{type:'step-platform',height:0.3,pos:[0,0,0.3],depth:0.5}];
save('elevated-back-lunge',sidecam,Q,[...plat,...bbProps()],{
 start:{...body(1.22,0.3,L(0.12,0.3,0.3,{yaw:2}),R(-0.12,0.3,0.27)),...bbArms},
 mid:{...body(1.0,0.1,L(0.12,0.3,0.3,{yaw:2}),rearFoot(-0.2,{pos:[-0.12,0.42,-0.2]})),...bbArms},
 end:{...body(0.88,-0.13,L(0.12,0.3,0.3,{yaw:2}),rearFoot(-0.65,{pos:[-0.12,0.08,-0.65]})),...bbArms}});
// crossover reverse lunge: step back and across, torso twists over front leg
const xa={fk:{flex:30,abd:-25,rot:0,elbow:120},rel:'chest'};
save('crossover-reverse-lunge',{az:45,el:10},['obliques','glutes','quadriceps'],[],{
 start:{...rStand(),armL:xa,armR:xa},
 end:{...rDown({pos:[0.02,0.03,-0.8],pole:[0.3,-0.2,1]}),spine:{flex:8,twist:35},root:{pos:[0,0.62,-0.13],pitch:0},armL:xa,armR:xa}});
// side split squat
const sw=(x,hy,sf)=>({root:{pos:[x,hy,0],pitch:0},spine:{flex:sf},neck:{flex:0},
 legL:L(0.62,0,0,{yaw:45,pole:[0.8,0.2,0.6]}),legR:R(-0.3,0,0,{yaw:-5,pole:[-0.2,0.3,1]}),...bbArms});
save('barbell-side-split-squat',{az:25,el:8},['quadriceps','adductors','glutes'],bbProps(),{
 start:{...sw(0.1,0.87,3),legL:L(0.5,0,0,{yaw:45,pole:[0.8,0.2,0.6]}),legR:R(-0.3,0,0,{yaw:-5,pole:[-0.2,0.3,1]})},
 end:sw(0.3,0.68,10)});
{const b=JSON.parse(fs.readFileSync(W+'bulgarian-split-squat.json'));for(const k in b.frames){const F=b.frames[k];F.armL={...F.armL,pos:[0.24,0.17,0.03],fingers:[-0.3,-0.1,0.9],hand:'flat',contact:true};F.armR={...F.armR,pos:[-0.24,0.17,0.03],fingers:[0.3,-0.1,0.9],hand:'flat',contact:true};}out['bulgarian-split-squat']=b;}
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
