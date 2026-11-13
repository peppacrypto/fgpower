import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,muscles,frames,more={})=>{out[slug]={slug,camera,muscles,frames,...more};};
const clone=o=>JSON.parse(JSON.stringify(o));
const SW=[0,0.1,0.3,0.3,0.3];
// hands behind head
const head=s=>({pos:[0.13*s,0.03,0.04],rel:'head',fingers:[0.546*s,0.584,-0.6],palm:[-0.827*s,0.265,-0.495],pole:[0.576*s,0.361,0.278],curl:0.3});
const sole=(s,x,z,pole=[0,1,0.2])=>({pos:[x*s,0,z],anchor:'sole',pole:[pole[0]*s,pole[1],pole[2]]});
const ank=(s,x,y,z,pole)=>({pos:[x*s,y,z],anchor:'ankle',pitch:-30,pole:[pole[0]*s,pole[1],pole[2]]});
const sup=(pitch=-90,y=0.1)=>({pos:[0,y,0],pitch});
const fr=(root,extra)=>({root,neck:{flex:6},...extra});
// ---- cross-body-crunch: right elbow to left knee
const cbc=(c,tw)=>fr(sup(-90+c*0.1),{spine:{flex:22*c,twist:tw,weights:SW},armL:head(1),armR:head(-1),
  legL:c?ank(1,0.11,0.5,0.4,[0,1,-0.3]):sole(1,0.11,0.55),legR:sole(-1,0.11,0.55)});
save('cross-body-crunch',{az:50,el:18},['abdominals','obliques'],{start:cbc(0,0),end:cbc(1,26)});
// ---- air-bike
const leg=(f,k)=>({fk:{flex:f,abd:1,knee:k},foot:{pitch:20}});
const bike=(tw,fl,fr_)=>fr(sup(-82),{spine:{flex:24,twist:tw,weights:SW},armL:head(1),armR:head(-1),
  legL:fl,legR:fr_});
save('air-bike',{az:55,el:18},['abdominals','obliques'],{
 start:bike(24,leg(105,105),leg(35,5)),mid:bike(0,leg(70,55),leg(70,55)),end:bike(-24,leg(35,5),leg(105,105))});
// ---- alternate-heel-touchers: side crunch to the right heel
const ht=(c)=>{const hx=0.27;return fr(sup(-90,0.1),{neck:{flex:-4,side:8*c},spine:{flex:26*c,side:-24*c,weights:SW},
  armL:{pos:[hx,0.02,0.0],fingers:[0,0,1],palm:[0,-1,0],contact:true,hand:'flat',pole:[1,0,-0.3]},
  armR:{pos:[-hx,0.02,0.0+0.2*c],fingers:[0,0,1],palm:[0,-1,0],contact:true,hand:'flat',pole:[-1,0,-0.3]},
  legL:sole(1,0.28,0.5,[0.2,1,0.1]),legR:sole(-1,0.28,0.5,[-0.2,1,0.1])});};
save('alternate-heel-touchers',{az:20,el:35},['obliques','abdominals'],{start:ht(0),end:ht(1)});
// ---- elbow-to-knee: left foot flat, right ankle on left knee, left elbow to right knee
const etk=(c,tw)=>fr(sup(-90+c*0.1),{spine:{flex:24*c,twist:tw,weights:SW},armL:head(1),armR:head(-1),
  legL:sole(1,0.11,0.38,[0,1,0.1]),
  legR:{pos:[0.1,0.6,0.2],anchor:'ankle',pitch:-20,roll:80,pole:[-1,0.6,0]}});
save('elbow-to-knee',{az:50,el:18},['abdominals','obliques'],{start:etk(0,0),end:etk(1,-26)});
// ---- oblique-crunches: feet on a bench, right hand at head, left hand on floor
const BZ=0.45;
const oc=(c)=>fr(sup(-90+c*0.1),{neck:{flex:0},spine:{flex:30*c,twist:24*c,weights:SW},armR:head(-1),
  armL:{pos:[0.3,0.01,-0.05],fingers:[0,0,1],palm:[0,-1,0],contact:true,hand:'flat',pole:[1,0,-0.3]},
  legL:{pos:[0.11,0.445,BZ],anchor:'sole',pitch:-12,pole:[0,1,0.2]},legR:{pos:[-0.11,0.445,BZ],anchor:'sole',pitch:-12,pole:[0,1,0.2]}});
save('oblique-crunches',{az:50,el:18},['obliques','abdominals'],{start:oc(0),end:oc(1)},{props:[{type:'plyo-box',height:0.43,width:0.6,depth:0.5,pos:[0,0,BZ+0.25-0.1]}]});
// ---- side-jackknife: lying on side, top leg up, top elbow to knee
const SD=6;const sj=(c,fl=0,lift=0.4,nf=0)=>({root:{pos:[0,0.2,0],yaw:90,roll:81-2*c},neck:{side:-4+2*c,flex:nf*c},
 spine:{flex:fl*c,side:SD*c,weights:[0,0.1,0.3,0.3,0.3]},
 armL:{pos:[0.09,0.1,-0.17],rel:'head',fingers:[-1,0,0.2],palm:[0,0.2,1],pole:[0,1,0],curl:0.3},
 armR:{pos:[0.3,0.02,0.28],fingers:[0,0,-1],palm:[0,-1,0],pole:[1,0,0.3],curl:0.1,contact:true},
 legL:{pos:[0.08,0.16+lift*c,-0.82+0.18*c],anchor:'ankle',yaw:90,roll:90,pole:[1,0,0]},
 legR:{pos:[0.08,0.07,-0.82],anchor:'ankle',yaw:90,roll:90,pole:[1,0,0]}});
save('side-jackknife',{az:76,el:10},['obliques','abdominals'],{start:sj(0),end:sj(1,24,0.45,0)},{muscleSide:'L'});
save('oblique-crunches-on-the-floor',{az:76,el:10},['obliques','abdominals'],{start:sj(0),end:sj(1,24,0.1,0)},{muscleSide:'L'});
// ---- russian twist (feet on floor) and plate twist (legs crossed, plate)
const twArm=(s)=>({fk:{flex:84,abd:-18*s*-1*-1,rot:0,elbow:8},rel:'chest',hand:'relaxed'});
const rt=(tw)=>fr({pos:[0,0.085,-0.05],pitch:-50},{spine:{flex:0,twist:tw,weights:SW},neck:{flex:-4},
  armL:{fk:{flex:84,abd:-16,rot:0,elbow:8},rel:'chest'},armR:{fk:{flex:84,abd:-16,rot:0,elbow:8},rel:'chest'},
  legL:sole(1,0.12,0.5,[0.1,1,0.3]),legR:sole(-1,0.12,0.5,[-0.1,1,0.3])});
save('russian-twist',{az:25,el:18},['obliques','abdominals'],{start:rt(40),mid:rt(0),end:rt(-40)});
const pt=(tw)=>fr({pos:[0,0.11,-0.05],pitch:-52},{spine:{flex:0,twist:tw,weights:SW},neck:{flex:-12,twist:-tw*0.5},
  armL:{pos:[0.213,-0.1,0.4],rel:'chest',contact:true,fingers:[0,0.3,0.95],palm:[-1,0,0],curl:0.85,pole:[0.3,-1,-0.2]},
  armR:{pos:[-0.213,-0.1,0.4],rel:'chest',contact:true,fingers:[0,0.3,0.95],palm:[1,0,0],curl:0.85,pole:[-0.3,-1,-0.2]},
  legL:{pos:[0.04,0.32,0.66],anchor:'ankle',pitch:-20,pole:[0.1,1,0.1]},legR:{pos:[-0.04,0.34,0.66],anchor:'ankle',pitch:-20,pole:[-0.1,1,0.1]}});
save('plate-twist',{az:25,el:18},['obliques','abdominals'],{start:pt(40),mid:pt(0),end:pt(-40)},{props:[{type:'weight-plate',hands:true,kg:10}]});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
