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
const EXT=-55,INT=+45;
const two=(a)=>({...stand,armL:a,armR:rest});
const post=(x)=>({type:'anchor-post',pos:[x,0,0.26],yaw:x<0?90:-90,bandY:1.08,band:false});
const bandP=(x)=>[post(x),{type:'band',hands:true,a:{pos:[x+(x<0?0.065:-0.065),1.08,0.26],axis:[0,1,0],r:0.01},b:{hand:'L'},rest:0.45,width:0.022}];
const SLOW={up:1.0,down:1.8};
const IRM=['chest','lats','shoulders'], ERM=['shoulders','posterior-deltoid'];
save('external-rotation-with-band',{az:35,el:8},ERM,bandP(-0.72),{start:two(fx(INT)),end:two(fx(EXT))},{muscleSide:'L',tempo:{lift:'there',...SLOW}});
save('internal-rotation-with-band',{az:35,el:8},IRM,bandP(0.72),{start:two(fx(EXT)),end:two(fx(INT))},{muscleSide:'L',tempo:{lift:'there',...SLOW}});
const cab=(side)=>[{type:'cable-tower',pos:[side*0.75,0,0.2],yaw:side*-90,pulleyY:1.08,hand:'L',attachment:'d-handle'}];
save('external-rotation-with-cable',{az:35,el:8},ERM,cab(-1),{start:two(fx(INT)),end:two(fx(EXT))},{muscleSide:'L',tempo:{lift:'there',...SLOW}});
save('cable-internal-rotation',{az:20,el:10},IRM,cab(1),{start:two(fx(EXT)),end:two(fx(INT))},{muscleSide:'L',tempo:{lift:'there',...SLOW}});
// cuban press
const db=[{type:'dumbbell',hand:'L',kg:5},{type:'dumbbell',hand:'R',kg:5}];
const cu=(abd,rot,el,flex=0)=>{const a={fk:{flex,abd,rot,elbow:el},rel:'chest',hand:'grip',pron:0.5};return {...stand,armL:a,armR:{...a}};};
const CR=+(process.env.CR||90);
save('cuban-press',{az:25,el:6},['posterior-deltoid','traps','shoulders'],db,{start:cu(4,0,6,14),mid:cu(85,-25,125),mid2:cu(88,CR,90),mid3:cu(88,-CR,90),end:cu(165,-CR*0.3,8)},{tempo:{lift:'there',up:1.0,down:1.8}});
// lying (side-lying on a bench, top arm = left)
const sideRoot={root:{pos:[0,0.72,0.1],yaw:90,roll:80},spine:{flex:0},neck:{side:-6},
 legL:{fk:{flex:-5,abd:0,knee:15,rot:0},rel:'pelvis'},legR:{fk:{flex:-5,abd:0,knee:15,rot:0},rel:'pelvis'}};
const bench=[{type:'flat-bench',pos:[0,0,0]},{type:'dumbbell',hand:'L',kg:5}];
const SZ=+(process.env.SZ||-1);const RL=+(process.env.RL||70);const PR=+(process.env.PR||0.9), FL=+(process.env.FL||0), AB=+(process.env.AB||12);
const sl=(rot,roll,ex={})=>({...sideRoot,armL:{fk:{flex:FL,abd:ER_ABD,rot,elbow:90},rel:'chest',hand:'grip',pron:0.5,roll,...ex},armR:{fk:{flex:70,abd:0,rot:0,elbow:100},rel:'chest',hand:'relaxed'}});
save('external-rotation',{az:70,el:12},ERM,bench,{start:sl(45,0),end:sl(-45,0)},{muscleSide:'L',floats:true,tempo:{lift:'there',...SLOW}});
const sp=(palm,ex={})=>({...sideRoot,armL:{pos:[0.355,0.98,0.236],rel:'world',pole:[0,0,-1],hand:'grip',fingers:[1,0,0],palm,...ex},armR:{fk:{flex:70,abd:0,rot:0,elbow:100},rel:'chest',hand:'relaxed'}});
save('dumbbell-lying-supination',{az:60,el:10},['forearms'],bench,{start:sp([0,-0.74,0.67*SZ]),mid:sp([0,0,SZ]),end:sp([0,0.74,0.67*SZ])},{muscleSide:'L',floats:true,tempo:{lift:'there',up:1.2,down:1.8}});
// prone pronation
const pr=(pron,rot=0)=>({root:{pos:[0,0.6,0.2],yaw:180,pitch:90},spine:{flex:0},neck:{flex:-20},
 legL:{fk:{flex:0,abd:0,knee:0,rot:0},rel:'pelvis',foot:{pitch:25}},legR:{fk:{flex:0,abd:0,knee:0,rot:0},rel:'pelvis',foot:{pitch:25}},
 armL:{fk:{flex:0,abd:90,rot,elbow:90},rel:'chest',hand:'grip',pron,autoRoll:false},armR:{fk:{flex:0,abd:75,rot:0,elbow:140},rel:'chest',hand:'relaxed'}});
const pp=(palm)=>({...pr(0,0),armL:{pos:[-0.471,0.23,-0.30],rel:'world',pole:[-1,0,0],hand:'grip',fingers:[0,-1,0],palm}});
const AZP=+(process.env.AZP||200);
save('dumbbell-lying-pronation',{az:AZP,el:20},['forearms'],bench,{start:pp([0.71,0,-0.7]),mid:pp([1,0,0]),end:pp([0.71,0,0.7])},{muscleSide:'L',floats:true,tempo:{lift:'there',up:1.2,down:1.8}});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).length);
