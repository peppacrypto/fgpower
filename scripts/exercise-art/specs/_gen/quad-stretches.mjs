import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,muscles,props,frames,more={})=>{out[slug]={slug,camera,muscles,...(props?{props}:{}),frames,...more};};
const mat=[{type:'floor-mat'}];
const grip=(p,f,pa,pole,g=0.03)=>({pos:p,hand:'grip',grip:g,fingers:f,palm:pa,curl:0.7,pole});
// ---- side lying (right side down, head +Z, belly +X)
const sroot={root:{pos:[0,0.215,0],yaw:90,roll:80},neck:{side:-6}};
const botArmHead={pos:[0.04,0.035,1.06],contact:true,fingers:[0,0,1],palm:[-0.5,-0.85,0],pole:[0.6,1,0],curl:-0.1};
const botLegBent={pos:[0.43,0.08,-0.38],anchor:'ankle',yaw:90,roll:90,pole:[1,0,0]};
const topFootBack={pos:[-0.2,0.34,0.05],anchor:'ankle',yaw:-120,pitch:0,roll:90,pole:[0,0.1,-1]};
save('on-your-side-quad-stretch',{az:70,el:22},['quadriceps'],mat,{start:{...sroot,armR:botArmHead,legR:botLegBent,legL:{...topFootBack,pos:[-0.2,0.34,0.05]},
 armL:grip([-0.24,0.37,0.05],[0,0,1],[0,-1,0],[-1,0.5,0])}},{muscleSide:'L'});
save('quad-stretch',{az:70,el:22},['quadriceps'],[...mat,{type:'stretch-strap',foot:'L',hands:true,at:0.45,over:true}],{start:{...sroot,legR:botLegBent,legL:{...topFootBack,pos:[-0.2,0.34,0.05]},
 armL:grip([-0.15,0.5,0.2],[0,0,1],[0,-1,0],[-1,0.5,0],0.02),armR:grip([-0.15,0.3,0.25],[0,0,1],[0,1,0],[-1,0,0],0.02)}},{muscleSide:'L'});
save('side-lying-groin-stretch',{az:30,el:25},['adductors'],mat,{start:{...sroot,spine:{flex:35},armR:{...botArmHead,pos:[0.3,0.04,0.9]},legR:botLegBent,
 legL:{fk:{flex:35,abd:60,rot:0,knee:35},rel:'pelvis',foot:{pitch:0}},
 armL:grip([0.08,0.64,-0.16],[0,0,-1],[1,0,0],[0.5,0.5,0.5])}},{muscleSide:'L'});
save('side-lying-floor-stretch',{az:70,el:25},['lats'],mat,{start:{...sroot,spine:{side:8},legR:botLegBent,legL:{pos:[-0.05,0.09,-0.78],anchor:'ankle',pole:[0,1,0]},
 armL:{pos:[0.0,0.6,0.97],fingers:[0,0,1],palm:[1,0,0],pole:[0.3,1,0],curl:0.2},
 armR:{pos:[0.3,0.06,0.6],hand:'relaxed',fingers:[0,0,1],palm:[0,-1,0],pole:[1,0,0],curl:0.2}}},{muscleSide:'L'});
// ---- all fours
const af={root:{pos:[0,0.53,0],pitch:81},neck:{flex:-10}};
const afArm=s=>({pos:[s*0.19,0,0.5],contact:true,fingers:[0,0,1],palm:[0,-1,0],pole:[s*0.3,0,-1],curl:-0.25});
save('all-fours-quad-stretch',{az:105,el:18},['quadriceps'],mat,{start:{...af,spine:{twist:25},
 armR:afArm(-1),legR:{pos:[-0.11,0.075,-0.44],anchor:'ankle',pitch:160,pole:[0,-1,0.05]},
 legL:{pos:[0.12,0.6,-0.1],anchor:'ankle',pole:[0.2,0,-1]},
 armL:grip([0.15,0.6,-0.1],[0,0,1],[-1,0,0],[1,0.2,-0.2])}},{muscleSide:'L'});
// ---- prone
save('one-half-locust',{az:105,el:18},['quadriceps'],mat,{start:{root:{pos:[0,0.18,0],pitch:92},spine:{flex:-45},neck:{flex:-8},
 armL:{pos:[0.3,0.02,0.05],contact:true,hand:'flat',fingers:[0,0,-1],palm:[0,-1,0],pole:[1,0,0],curl:0.1},
 legL:{fk:{flex:0,abd:3,knee:0},foot:{pitch:60}},
 legR:{pos:[-0.14,0.38,-0.05],anchor:'ankle',pole:[-0.2,0,-1]},
 armR:grip([-0.17,0.38,-0.05],[0,0,1],[1,0,0],[-1,0.3,-0.2])}},{muscleSide:'R'});
save('intermediate-hip-flexor-and-quad-stretch',{az:105,el:18},['quadriceps'],[...mat,{type:'stretch-strap',foot:'L',hands:true,at:0.45,over:true}],{start:{root:{pos:[0,0.15,0],pitch:92},spine:{flex:-25},neck:{flex:-8},
 legR:{fk:{flex:0,abd:3,knee:0},foot:{pitch:60}},
 legL:{pos:[0.11,0.5,-0.2],anchor:'ankle',pole:[0.2,0,-1]},
 armL:grip([0.14,0.3,0.1],[0,-1,0.3],[0,0.3,1],[1,0,-0.3],0.02),armR:grip([-0.14,0.3,0.1],[0,-1,0.3],[0,0.3,1],[-1,0,-0.3],0.02)}},{muscleSide:'L'});
// ---- supine on bench
const bench={type:'flat-bench'};
save('on-your-back-quad-stretch',{az:30,el:15},['quadriceps'],[bench],{start:{root:{pos:[0.1,0.532,0.1],pitch:-90},neck:{flex:4},
 legL:{pos:[0.2,0.2,-0.12],anchor:'ankle',pole:[0.5,-1,0.3]},
 legR:{pos:[-0.05,0.44,0.7],anchor:'sole',pole:[-0.2,1,0.3]},
 armL:grip([0.23,0.22,-0.12],[0,-1,0],[1,0,0],[1,-0.5,0.2]),
 armR:{fk:{flex:-10,abd:25,elbow:20},curl:0.2}}},{muscleSide:'L'});
// ---- standing
save('standing-elevated-quad-stretch',{az:80,el:10},['quadriceps'],[{type:'flat-bench',pos:[0,0,-0.9]}],{start:{root:{pos:[0,0.93,0],pitch:2},
 legR:{fk:{flex:0,abd:2,knee:10},foot:{pitch:0}},
 legL:{pos:[0.11,0.52,-0.5],anchor:'ankle',pitch:-120,pole:[0,0,1]},
 armL:{fk:{flex:5,abd:10,elbow:15},curl:0.3},armR:{fk:{flex:5,abd:10,elbow:15},curl:0.3}}},{muscleSide:'L'});
// ---- kneeling
const kleg={fk:{flex:0,abd:3,knee:90},rel:'world',foot:{pitch:78}};
const heel=s=>grip([s*0.12,0.22,-0.4],[0,0,-1],[0,1,0],[s*1,0,-0.2]);
save('looking-at-ceiling',{az:90,el:8},['quadriceps'],mat,{start:{root:{pos:[0,0.5,0.16],pitch:-38},spine:{flex:-50},neck:{flex:-25},
 legL:kleg,legR:kleg,armL:heel(1),armR:heel(-1)}});
const TU=fs.existsSync(W+'_gen/quad-tuned.json')?JSON.parse(fs.readFileSync(W+'_gen/quad-tuned.json')):{};
for(const [k,v] of Object.entries(out)){for(const [l,o] of Object.entries(TU[k]||{}))Object.assign(v.frames.start[l]||{},o)}
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
