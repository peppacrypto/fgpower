import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,muscles,props,frames,more={})=>{out[slug]={slug,camera,muscles,props,frames,...more};};
const RA=+(process.env.RA||0);   // rot sign test
const stand={root:{pos:[0,0.93,0],pitch:2},spine:{flex:0},neck:{flex:0},
 legL:{pos:[0.15,0,0],anchor:'sole',yaw:6},legR:{pos:[-0.15,0,0],anchor:'sole',yaw:-6}};
// standing ER/IR, working arm = left, elbow pinned at side at 90
const fkA=(rot,hand='grip',ex={})=>({fk:{flex:0,abd:ER_ABD,rot,elbow:90},rel:'chest',hand,pron:0.5,...ex});
const ER_ABD=+(process.env.ABD||8);
const rest={fk:{flex:0,abd:6,rot:0,elbow:12},rel:'chest',hand:'relaxed'};
const T=+(process.env.T||70);
const band=(x)=>[{type:'band',hands:true,a:{hand:'L',r:0.007,axis:[0,1,0]},b:{pos:[x,1.08,0.25],axis:[0,1,0],r:0.02},width:0.032,rest:0.5}];

const fx=(rot,ex={})=>({fk:{flex:0,abd:ER_ABD,rot,elbow:90},rel:'chest',hand:'grip',pron:0.5,...ex});
const EXT=-60,INT=+45;
const two=(a)=>({...stand,armL:a,armR:rest});
save('external-rotation-with-band',{az:40,el:8},['posterior-deltoid'],band(-0.9),{start:two(fx(INT)),end:two(fx(EXT))},{muscleSide:'L'});
save('internal-rotation-with-band',{az:40,el:8},['anterior-deltoid'],band(0.9),{start:two(fx(EXT)),end:two(fx(INT))},{muscleSide:'L'});
const cab=(side)=>[{type:'cable-tower',pos:[side*0.75,0,0],yaw:side*-90,pulleyY:1.08,hand:'L',attachment:'d-handle'}];
save('external-rotation-with-cable',{az:40,el:8},['posterior-deltoid'],cab(-1),{start:two(fx(INT)),end:two(fx(EXT))},{muscleSide:'L'});
save('cable-internal-rotation',{az:40,el:8},['anterior-deltoid'],cab(1),{start:two(fx(EXT)),end:two(fx(INT))},{muscleSide:'L'});
// cuban press
const db=[{type:'dumbbell',hand:'L',kg:5},{type:'dumbbell',hand:'R',kg:5}];
const cu=(abd,rot,el,flex=0)=>{const a={fk:{flex,abd,rot,elbow:el},rel:'chest',hand:'grip',pron:0.5};return {...stand,armL:a,armR:{...a}};};
const CR=+(process.env.CR||90);
save('cuban-press',{az:20,el:6},['shoulders'],db,{start:cu(88,CR,90),mid:cu(88,-CR,90),mid2:cu(88,-CR,90),end:cu(165,-CR*0.3,8)});
// lying (side-lying on a bench, top arm = left)
const sideRoot={root:{pos:[0,0.72,0.1],yaw:90,roll:80},spine:{flex:0},neck:{side:-6},
 legL:{fk:{flex:-5,abd:0,knee:15,rot:0},rel:'pelvis'},legR:{fk:{flex:-5,abd:0,knee:15,rot:0},rel:'pelvis'}};
const bench=[{type:'flat-bench',pos:[0,0,0]},{type:'dumbbell',hand:'L',kg:5}];
const PR=+(process.env.PR||0.9), FL=+(process.env.FL||20), AB=+(process.env.AB||12);
const sl=(rot,pron=0.5)=>({...sideRoot,armL:{fk:{flex:FL,abd:AB,rot,elbow:90},rel:'chest',hand:'grip',pron,autoRoll:false},armR:{fk:{flex:70,abd:0,rot:0,elbow:100},rel:'chest',hand:'relaxed'}});
save('external-rotation',{az:50,el:15},['posterior-deltoid'],bench,{start:sl(30),end:sl(-90)},{muscleSide:'L',floats:true});
save('dumbbell-lying-supination',{az:50,el:15},['forearms'],bench,{start:sl(6,PR),end:sl(-6,-PR)},{muscleSide:'L',floats:true});
// prone pronation
const pr=(pron,rot=0)=>({root:{pos:[0,0.6,0.2],yaw:180,pitch:90},spine:{flex:0},neck:{flex:-20},
 legL:{fk:{flex:0,abd:0,knee:0,rot:0},rel:'pelvis',foot:{pitch:25}},legR:{fk:{flex:0,abd:0,knee:0,rot:0},rel:'pelvis',foot:{pitch:25}},
 armL:{fk:{flex:0,abd:90,rot,elbow:90},rel:'chest',hand:'grip',pron,autoRoll:false},armR:{fk:{flex:0,abd:75,rot:0,elbow:140},rel:'chest',hand:'relaxed'}});
save('dumbbell-lying-pronation',{az:240,el:12},['forearms'],bench,{start:pr(-PR,-6),end:pr(PR,6)},{muscleSide:'L',floats:true});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).length);
