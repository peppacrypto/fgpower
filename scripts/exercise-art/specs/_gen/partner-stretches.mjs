import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,muscles,frames,more={})=>{out[slug]={slug,camera,muscles,props:[{type:'floor-mat'}],frames,...more};};
// lying
const lroot=(extra={},y=0.125)=>({root:{pos:[0,y,0],pitch:-90,...extra},neck:{flex:0}});
const leg=(s,p,pole=[0,1,0.2],extra={})=>({pos:[s*p[0],p[1],p[2]],anchor:'ankle',pole:[s*pole[0],pole[1],pole[2]],pitch:-90,...extra});
const straight=(s)=>leg(s,[0.11,0.09,0.86],[0,1,0]);
const side=(s,x=0.42)=>({fk:{flex:5,abd:35,rot:0,elbow:5},rel:'chest',hand:'relaxed',curl:0.2});
const grip=(s,p,f,pa,g=0.04,pole=[0.6,-0.6,-0.3])=>({pos:[s*p[0],p[1],p[2]],hand:'grip',grip:g,fingers:[s*f[0],f[1],f[2]],palm:[s*pa[0],pa[1],pa[2]],curl:0.8,pole:[s*pole[0],pole[1],pole[2]]});
const rel=(s,p,f=[0,0,1],pa=[0,-1,0],pole=[0.8,-0.4,-0.3])=>({pos:[s*p[0],p[1],p[2]],hand:'relaxed',fingers:[s*f[0],f[1],f[2]],palm:[s*pa[0],pa[1],pa[2]],curl:0.3,pole:[s*pole[0],pole[1],pole[2]]});
// 1 adductor-groin: supine legs raised and wide
const wide=(s)=>leg(s,[0.45,0.8,0.05],[0.4,0,-1],{pitch:-150});
save('adductor-groin',{az:25,el:30},['adductors'],{start:{...lroot(),legL:wide(1),legR:wide(-1),armL:side(1),armR:side(-1)}});
// 3 lying-bent-leg-groin
const bk=(s)=>({pos:[s*0.07,0.09,0.42],anchor:'ankle',pole:[s*1,0.3,0],pitch:-60,yaw:s*-40});
save('lying-bent-leg-groin',{az:25,el:35},['adductors'],{start:{...lroot(),legL:bk(1),legR:bk(-1),armL:side(1),armR:side(-1)}});
// 4 lying-crossover
save('lying-crossover',{az:30,el:35},['abductors'],{start:{...lroot(),spine:{twist:-12,flex:0},legR:straight(-1),legL:{fk:{flex:90,abd:-30,rot:0,knee:100},rel:'pelvis',foot:{pitch:0}},armL:side(1),armR:side(-1)}},{muscleSide:'L'});
// 5 lying-glute figure four
save('lying-glute',{az:35,el:30},['glutes'],{start:{...lroot(),neck:{flex:8},legR:{pos:[-0.11,0.09,0.42],anchor:'ankle',pole:[0,1,0.2],pitch:-30},legL:{pos:[-0.09,0.64,0.17],anchor:'ankle',pole:[1,0.2,-0.2],pitch:-90,yaw:-40},armL:rel(1,[0.0,0.42,-0.05],[0,0.5,1],[-1,0,0]),armR:rel(-1,[0.2,0.42,-0.05],[0,0.5,1],[1,0,0])}},{muscleSide:'L'});
// 6 lying-hamstring
const behind=(s)=>rel(s,[0.2,0.58,-0.2],[0,1,0.1],[0,0.1,1],[0.6,-0.6,-0.3]);
save('lying-hamstring',{az:62,el:14},['hamstrings'],{start:{...lroot(),neck:{flex:4},legL:leg(1,[0.11,0.96,0.0],[0,0,-1],{pitch:-180}),legR:straight(-1),armL:behind(1),armR:behind(-1)}},{muscleSide:'L'});
// 7 lying-prone-quadriceps
const LOC=JSON.parse(fs.readFileSync(W+'one-half-locust.json'));save('lying-prone-quadriceps',LOC.camera,['quadriceps'],LOC.frames,{muscleSide:'R'});
// 9 prone-manual-hamstring
const pr={root:{pos:[0,0.15,0],pitch:92},spine:{flex:-15},neck:{flex:-8}};
const parm=(s)=>({pos:[s*0.3,0.03,0.5],contact:true,hand:'flat',fingers:[0,0,1],palm:[0,-1,0],pole:[s*1,0.3,0],curl:0.1});
const pl=(s,k,p)=>({fk:{flex:0,abd:3,knee:k},foot:{pitch:p}});
save('prone-manual-hamstring',{az:105,el:15},['hamstrings'],{
 start:{...pr,legL:pl(1,0,60),legR:pl(-1,0,60),armL:parm(1),armR:parm(-1)},
 end:{...pr,legL:pl(1,115,60),legR:pl(-1,0,60),armL:parm(1),armR:parm(-1)}},{muscleSide:'L'});
// seated
const sroot=(p,sf,nf,z=-0.05)=>({root:{pos:[0,0.125,z],pitch:p},spine:{flex:sf},neck:{flex:nf}});
const sleg=(s,x,z,pitch=-70)=>({pos:[s*x,0.08,z],pitch,pole:[s*0.1,1,0.1]});
const bent=(s)=>({pos:[s*0.14,0.0,0.55],anchor:'sole',pole:[s*0.05,1,0.1]});
const SAZ={az:60,el:12};
// 2 behind-head-chest
const bh=(s)=>({fk:{flex:-25,abd:95,rot:0,elbow:135},rel:'chest',hand:'relaxed',curl:0.3});
save('behind-head-chest-stretch',{az:35,el:8},['chest'],{start:{...sroot(2,0,0,-0.1),legL:bent(1),legR:bent(-1),armL:bh(1),armR:bh(-1)}});
// 8,10 overhead lat / triceps: left arm up, hand behind head, right hand pulls elbow
const oh=(sideLean,flex)=>({...sroot(2,0,0,-0.1),spine:{flex:0,side:sideLean},legL:bent(1),legR:bent(-1),
 armL:{fk:{flex:165,abd:5,rot:0,elbow:flex},rel:'chest',hand:'relaxed',curl:0.3},
 armR:rel(-1,[0.3,0.1,0.0])});
save('overhead-lat',{az:150,el:10},['lats'],{start:oh(-14,140)},{muscleSide:'L'});
save('overhead-triceps',{az:150,el:10},['triceps'],{start:oh(0,150)},{muscleSide:'L'});
// 11 seated-biceps
const bk2=(s)=>({fk:{flex:-55,abd:12,rot:0,elbow:0},rel:'chest',hand:'relaxed',curl:0.2,pron:0});
save('seated-biceps',{az:70,el:10},['biceps'],{start:{...sroot(0,0,0,-0.1),legL:bent(1),legR:bent(-1),armL:bk2(1),armR:bk2(-1)}});
// 12 seated-front-deltoid
const fd=(s)=>({fk:{flex:-35,abd:90,rot:0,elbow:0},rel:'chest',hand:'relaxed',curl:0.1});
save('seated-front-deltoid',{az:40,el:10},['shoulders'],{start:{...sroot(0,0,0,-0.1),legL:bent(1),legR:bent(-1),armL:fd(1),armR:fd(-1)}});
// 13 seated-glute: left ankle on right knee, lean forward
save('seated-glute',{az:45,el:18},['glutes'],{start:{...sroot(-8,0,0,-0.15),legR:{pos:[-0.11,0.0,0.5],anchor:'sole',pole:[0,1,0.1]},legL:{fk:{flex:90,abd:55,rot:-90,knee:140},rel:'pelvis',foot:{pitch:0}},armL:{pos:[0.27,0.03,-0.25],contact:true,hand:'flat',fingers:[0,0,-1],palm:[0,-1,0],pole:[0.5,0,-1],curl:0.1},armR:{pos:[-0.27,0.03,-0.25],contact:true,hand:'flat',fingers:[0,0,-1],palm:[0,-1,0],pole:[-0.5,0,-1],curl:0.1}}},{muscleSide:'L'});
// 14 seated-hamstring
const hl=(s)=>rel(s,[0.21,0.12,0.74],[0,-0.2,1],[-1,0,0],[0.8,-0.4,-0.3]);
save('seated-hamstring',{az:70,el:10},['hamstrings'],{start:{...sroot(32,28,10),legL:sleg(1,0.1,0.81),legR:sleg(-1,0.1,0.81),armL:hl(1),armR:hl(-1)}});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).length,Object.keys(out).join(' '));
