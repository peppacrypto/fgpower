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

const fkL=(flex,abd,knee,rot=0)=>({fk:{flex,abd,rot,knee},rel:'pelvis',foot:{pitch:0}});
const fl0=(s)=>fkL(0,3,0);
const D=(a,b)=>({start:a,end:b});
// 1 adductor-groin: legs up together, then spread wide in a V
const addL=(s,ab)=>fkL(88,ab,0);
save('adductor-groin',{az:0,el:22},['adductors'],D({...lroot(),legL:addL(1,4),legR:addL(-1,4),armL:side(1),armR:side(-1)},{...lroot(),legL:addL(1,50),legR:addL(-1,50),armL:side(1),armR:side(-1)}),{tempo:{up:2,down:2.4}});
// 3 lying-bent-leg-groin: butterfly, knees high then pressed toward the floor
const bf=(s,fx,ab)=>({...fkL(fx,ab,125,-25),foot:{pitch:35}});
save('lying-bent-leg-groin',{az:0,el:30},['adductors'],D({...lroot(),legL:bf(1,92,20),legR:bf(-1,92,20),armL:side(1),armR:side(-1)},{...lroot(),legL:bf(1,78,42),legR:bf(-1,78,42),armL:side(1),armR:side(-1)}),{tempo:{up:2,down:2.4}});
const side2=(s)=>({fk:{flex:5,abd:25,rot:0,elbow:5},rel:'chest',hand:'relaxed',curl:0.2});
// 4 lying-crossover: bent knee carried across the body, shoulders down
save('lying-crossover',{az:20,el:35},['abductors','glutes'],D(
 {...lroot(),spine:{twist:0,flex:0},legR:straight(-1),legL:fkL(90,0,100),armL:side2(1),armR:side2(-1)},
 {...lroot(),spine:{twist:-18,flex:0},legR:straight(-1),legL:fkL(95,-28,100),armL:side2(1),armR:side2(-1)}),{muscleSide:'L',tempo:{up:2,down:2.4}});
// 5 lying-glute: leg travels to a figure-four pulled toward the chest
const ar5=(s,x,y,z)=>rel(s,[x,y,z],[0,0.5,1],[-s,0,0]);
save('lying-glute',{az:35,el:30},['glutes'],D(
 {...lroot(),neck:{flex:4},legR:{pos:[-0.11,0.09,0.5],anchor:'ankle',pole:[0,1,0.2],pitch:-30},legL:{pos:[-0.07,0.62,0.19],anchor:'ankle',pole:[1,0.2,-0.2],pitch:-90,yaw:-40},armL:side(1),armR:side(-1)},
 {...lroot(),neck:{flex:8},legR:{pos:[-0.11,0.09,0.5],anchor:'ankle',pole:[0,1,0.2],pitch:-30},legL:{pos:[-0.09,0.64,0.17],anchor:'ankle',pole:[1,0.2,-0.2],pitch:-90,yaw:-40},armL:side(1),armR:side(-1)}),{muscleSide:'L',tempo:{up:2,down:2.4}});
// 6 lying-hamstring: straight leg from low to pulled toward the chest, other leg flat
save('lying-hamstring',{az:80,el:12},['hamstrings'],D(
 {...lroot(),neck:{flex:2},legL:fkL(50,0,0),legR:straight(-1),armL:side(1),armR:side(-1)},
 {...lroot(),neck:{flex:2},legL:fkL(108,0,0),legR:straight(-1),armL:side(1),armR:side(-1)}),{muscleSide:'L',tempo:{up:2,down:2.4}});
// 7 lying-prone-quadriceps: heel to glute, hips on the mat, low prop
const prq={root:{pos:[0,0.15,0],pitch:91},spine:{flex:-6},neck:{flex:-3}};
const qarm=(s)=>({pos:[s*0.3,0.03,0.5],contact:true,hand:'flat',fingers:[0,0,1],palm:[0,-1,0],pole:[s*1,0.3,0],curl:0.1});
save('lying-prone-quadriceps',{az:95,el:14},['quadriceps'],D(
 {...prq,legL:{fk:{flex:0,abd:3,knee:60},foot:{pitch:60}},legR:{fk:{flex:0,abd:3,knee:0},foot:{pitch:60}},armL:qarm(1),armR:qarm(-1)},
 {...prq,legL:{fk:{flex:0,abd:3,knee:150},foot:{pitch:30}},legR:{fk:{flex:0,abd:3,knee:0},foot:{pitch:60}},armL:qarm(1),armR:qarm(-1)}),{muscleSide:'L',tempo:{up:2,down:2.4}});
// 9 prone-manual-hamstring
const pr={root:{pos:[0,0.15,0],pitch:91},spine:{flex:-5},neck:{flex:-3}};
const parm=(s)=>({pos:[s*0.3,0.03,0.5],contact:true,hand:'flat',fingers:[0,0,1],palm:[0,-1,0],pole:[s*1,0.3,0],curl:0.1});
const pl=(s,k,p)=>({fk:{flex:0,abd:3,knee:k},foot:{pitch:p}});
save('prone-manual-hamstring',{az:95,el:10},['hamstrings'],{
 start:{...pr,legL:pl(1,0,60),legR:pl(-1,0,60),armL:parm(1),armR:parm(-1)},
 end:{...pr,legL:pl(1,98,60),legR:pl(-1,0,60),armL:parm(1),armR:parm(-1)}},{muscleSide:'L',tempo:{up:1.5,down:1.8}});
// seated
const sroot=(p,sf,nf,z=-0.05)=>({root:{pos:[0,0.125,z],pitch:p},spine:{flex:sf},neck:{flex:nf}});
const sleg=(s,x,z,pitch=-70)=>({pos:[s*x,0.08,z],pitch,pole:[s*0.1,1,0.1]});
const bent=(s)=>({pos:[s*0.14,0.0,0.55],anchor:'sole',pole:[s*0.05,1,0.1]});
// 2 behind-head-chest: hands behind the head, elbows wide then drawn back
const bh=(s,fx)=>({fk:{flex:fx,abd:100,rot:0,elbow:140},rel:'chest',hand:'relaxed',curl:0.3});
save('behind-head-chest-stretch',{az:60,el:8},['chest'],D(
 {...sroot(0,0,0,-0.1),legL:bent(1),legR:bent(-1),armL:bh(1,-5),armR:bh(-1,-5)},
 {...sroot(0,-4,0,-0.1),legL:bent(1),legR:bent(-1),armL:bh(1,-45),armR:bh(-1,-45)}),{tempo:{up:2,down:2.4}});
// 8,10 overhead lat / triceps
const oh=(sideLean,fx,el)=>({...sroot(0,0,0,-0.1),spine:{flex:0,side:sideLean},legL:bent(1),legR:bent(-1),
 armL:{fk:{flex:fx,abd:12,rot:0,elbow:el},rel:'chest',hand:'relaxed',curl:0.3},
 armR:rel(-1,[0.3,0.1,0.0])});
save('overhead-lat',{az:15,el:8},['lats'],D(oh(0,170,130),oh(-16,172,140)),{muscleSide:'L',tempo:{up:2,down:2.4}});
save('overhead-triceps',{az:100,el:8},['triceps'],D(oh(0,170,110),oh(0,170,148)),{muscleSide:'L',tempo:{up:2,down:2.4}});
// 11 seated-biceps: arms back and slightly up, palms facing in
const bk2=(fx)=>({fk:{flex:fx,abd:8,rot:0,elbow:0},rel:'chest',hand:'relaxed',curl:0.2,pron:0});
save('seated-biceps',{az:45,el:10},['biceps'],D(
 {...sroot(0,0,0,-0.1),legL:bent(1),legR:bent(-1),armL:bk2(-35),armR:bk2(-35)},
 {...sroot(0,0,0,-0.1),legL:bent(1),legR:bent(-1),armL:bk2(-65),armR:bk2(-65)}),{tempo:{up:2,down:2.4}});
// 12 seated-front-deltoid: arms taken back behind the frontal plane
const fd=(fx)=>({fk:{flex:fx,abd:90,rot:0,elbow:0},rel:'chest',hand:'relaxed',curl:0.1});
save('seated-front-deltoid',{az:40,el:10},['anterior-deltoid'],D(
 {...sroot(0,0,0,-0.1),legL:bent(1),legR:bent(-1),armL:fd(0),armR:fd(0)},
 {...sroot(0,-4,0,-0.1),legL:bent(1),legR:bent(-1),armL:fd(-40),armR:fd(-40)}),{tempo:{up:2,down:2.4}});
// 13 seated-glute: figure-four, then the chest folds forward
const sga=(x,z)=>({pos:[x,0.03,z],contact:true,hand:'flat',fingers:[0,0,1],palm:[0,-1,0],pole:[x*2,0,-1],curl:0.1});
const fa=(fx)=>({fk:{flex:fx,abd:22,rot:0,elbow:5},rel:'chest',hand:'relaxed',curl:0.2});
const sg=(sf,fx)=>({...sroot(0,sf,0,-0.15),legR:{pos:[-0.11,0.0,0.55],anchor:'sole',pole:[0,1,0.1]},legL:{fk:{flex:90,abd:55,rot:-90,knee:140},rel:'pelvis',foot:{pitch:0}},armL:fa(fx),armR:fa(fx)});
save('seated-glute',{az:60,el:14},['glutes','abductors'],D(sg(0,40),sg(26,65)),{muscleSide:'L',tempo:{up:2,down:2.4}});
// 14 seated-hamstring: tall, then hinge with a flat back
const hl=(s,y,z)=>rel(s,[0.21,y,z],[0,-0.2,1],[-1,0,0],[0.5,-0.7,-0.3]);
save('seated-hamstring',{az:70,el:10},['hamstrings'],D(
 {...sroot(0,0,0),legL:sleg(1,0.1,0.81),legR:sleg(-1,0.1,0.81),armL:hl(1,0.4,0.5),armR:hl(-1,0.4,0.5)},
 {...sroot(34,4,0),legL:sleg(1,0.1,0.81),legR:sleg(-1,0.1,0.81),armL:hl(1,0.14,0.66),armR:hl(-1,0.14,0.66)}),{tempo:{up:2,down:2.4}});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).length,Object.keys(out).join(' '));
