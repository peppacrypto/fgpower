import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,muscles,frames,more={})=>{out[slug]={slug,camera,muscles,frames,...more};};
const up={fk:{flex:172,abd:14,rot:0,elbow:0},rel:'chest'};
const hips={fk:{flex:10,abd:35,rot:0,elbow:100},rel:'chest'};
const side={fk:{flex:0,abd:90,rot:0,elbow:0},rel:'chest'};
const flat=(x,y,z)=>({pos:[x,y,z],contact:true,hand:'flat',fingers:[0,0,1],palm:[0,-1,0],pole:[x*2,-0.3,-1],curl:0.2});
const L=(x,y,z,extra={})=>({pos:[x,y,z],anchor:'sole',pole:[0.1,0.5,1],...extra});
const R=(x,y,z,extra={})=>({pos:[x,y,z],anchor:'sole',pole:[-0.1,0.5,1],...extra});
const cam={az:80,el:8};
// lunge family: front leg L (z+), rear R
const lunge=(hy,hz,rz,rear,pitch=0,sf=0)=>({root:{pos:[0,hy,hz],pitch},spine:{flex:sf},neck:{flex:0},
 legL:L(0.12,0,hz+0.43,{yaw:2}),legR:rear(rz)});
save('warrior-1',cam,['quadriceps'],{start:{...lunge(0.55,0.08,-0.6,z=>R(-0.12,0,z,{yaw:-45,pitch:12,pole:[-0.2,0,1]})),armL:up,armR:up}});
save('high-lunge',cam,['quadriceps'],{start:{...lunge(0.55,0.08,-0.52,z=>R(-0.12,0.05,z,{anchor:'ball',pitch:60,pole:[-0.1,-0.2,1]})),armL:up,armR:up}});
// warrior 2 / side angle / triangle: wide stance in x, front = figure's left
const wide=(rootExtra,legLx=0.62,hy=0.62)=>({root:{pos:[-0.0+(rootExtra.x||0),hy,0],yaw:0,...rootExtra.r},
 legL:{pos:[legLx,0,0.0],anchor:'sole',yaw:90,pole:[1,0.3,0.3]},legR:{pos:[-0.95,0,0.0],anchor:'sole',yaw:-15,pole:[-1,0.3,0]}});
save('warrior-2',{az:15,el:6},['quadriceps'],{start:{root:{pos:[0.12,0.66,0],yaw:0},neck:{twist:75},
 legL:{pos:[0.7,0,0],anchor:'sole',yaw:90,pole:[1,0.3,0.1]},legR:{pos:[-0.45,0,0],anchor:'sole',yaw:-15,pole:[-1,0.3,0]},armL:side,armR:side}});
save('extended-side-angle',{az:15,el:6},['quadriceps'],{start:{root:{pos:[0.12,0.66,0],yaw:0,roll:-15},spine:{side:45},neck:{twist:-10,flex:-45},
 legL:{pos:[0.7,0,0],anchor:'sole',yaw:90,pole:[1,0.3,0.1]},legR:{pos:[-0.45,0,0],anchor:'sole',yaw:-15,pole:[-1,0.3,0]},
 armL:{pos:[0.5,0.68,0.0],contact:true,hand:'flat',fingers:[0.5,0,1],palm:[0,-1,0],pole:[0.6,0.4,-1],curl:0.2},armR:{fk:{flex:0,abd:165,rot:0,elbow:0},rel:'world'}}});
save('triangle-pose',{az:15,el:6},['hamstrings'],{start:{root:{pos:[0.15,0.76,0],yaw:0,roll:-30},spine:{side:45},neck:{twist:-10,flex:-20},
 legL:{pos:[0.6,0,0],anchor:'sole',yaw:90,pole:[1,0.1,0.3]},legR:{pos:[-0.22,0,0],anchor:'sole',yaw:-15,pole:[-1,0.1,0]},
 armL:{pos:[0.7,0.3,0.05],contact:true,hand:'flat',fingers:[0,0,1],palm:[0,-1,0],pole:[0.5,-0.3,-1],curl:0.2},armR:{fk:{flex:0,abd:165,rot:0,elbow:0},rel:'world'}}});
// kneeling lunges
const kneel=(arms,pitch=0)=>({root:{pos:[0,0.5,0.1],pitch},neck:{flex:0},
 legL:L(0.12,0,0.55),legR:{pos:[-0.12,0.09,-0.33],anchor:'ankle',pole:[0,-1,0],pitch:130},...arms});
save('low-lunge',cam,['quadriceps'],{start:kneel({armL:up,armR:up})});
save('kneeling-hip-flexor',cam,['quadriceps'],{start:kneel({armL:hips,armR:hips})});
// lizard: both hands inside front foot
save('lizard-pose',{az:60,el:14},['adductors'],{start:{root:{pos:[0,0.40,0],pitch:30},spine:{flex:60},neck:{flex:-20},
 legL:L(0.45,0,0.72,{yaw:0,pole:[1,0.4,0.8]}),legR:R(-0.1,0.02,-0.66,{anchor:'ball',pitch:60,pole:[-0.1,-0.2,1]}),
 armL:flat(0.12,0.02,0.6),armR:flat(-0.08,0.02,0.6)}});
save('runners-stretch',{az:70,el:10},['hamstrings'],{start:{root:{pos:[0,0.58,0.01],pitch:70},spine:{flex:24},neck:{flex:-15},
 legL:L(0.1,0,0.75),legR:R(-0.1,0.05,-0.68,{anchor:'ball',pitch:60,pole:[-0.1,-0.2,1]}),
 armL:flat(0.3,0.02,0.45),armR:flat(-0.08,0.02,0.45)}});
save('standing-hip-flexors',cam,['quadriceps'],{start:{root:{pos:[0,0.82,0.08],pitch:-3},neck:{flex:0},
 legL:L(0.12,0,0.32),legR:R(-0.12,0.03,-0.3,{anchor:'ball',pitch:42,pole:[-0.1,0.2,1]}),armL:hips,armR:hips}});
// world's greatest: 3 parts
const wg=(r,sp,ar)=>({root:{pos:[0,0.42,0.1],...r},...sp,legL:L(0.5,0,0.6,{yaw:2,pole:[1,0.5,0.8]}),legR:R(-0.12,0.04,-0.6,{anchor:'ball',pitch:60,pole:[-0.1,-0.2,1]}),...ar});
save('worlds-greatest-stretch',{az:60,el:12},['hamstrings'],{
 start:wg({pitch:0},{neck:{flex:0}},{armL:{pos:[0.38,0.55,0.0],rel:'world',fingers:[0,0,1],palm:[0,-1,0],pole:[1,-0.3,-1]},armR:{pos:[-0.3,0.55,0.0],rel:'world',pole:[-1,-0.3,-1]}}),
 mid:wg({pos:[0,0.385,0.1],pitch:12},{spine:{flex:70},neck:{flex:-20}},{armL:{...flat(-0.02,0.02,0.55),pole:[0,-1,-1]},armR:flat(-0.28,0.02,0.55)}),
 mid2:wg({pos:[0,0.38,0.1],pitch:12},{spine:{flex:70},neck:{flex:-20},},{armL:{...flat(-0.02,0.02,0.55),pole:[0,-1,-1]},armR:flat(-0.28,0.02,0.55)}),
 mid3:wg({pos:[0,0.38,0.1],pitch:12},{spine:{flex:62,twist:-15},neck:{twist:-20,flex:-20}},{armL:{...flat(-0.02,0.02,0.55),pole:[0,-1,-1]},armR:{pos:[-0.37,0.55,0.45],rel:'world',fingers:[0,0.5,0.65],palm:[0,-0.5,0.5],pole:[-1,-0.15,-0.65]}}),
 end:wg({pos:[0,0.38,0.1],pitch:12},{spine:{flex:55,twist:-40},neck:{twist:-40,flex:-25}},{armL:{...flat(-0.02,0.02,0.55),pole:[0,-1,-1]},armR:{pos:[-0.45,1.1,0.35],rel:'world',fingers:[0,1,0.3],palm:[0,0,1],pole:[-1,0,-0.3]}})});
// pigeon
save('pigeon-pose',{az:50,el:20},['glutes'],{start:{root:{pos:[0,0.38,0.0],pitch:22},spine:{flex:60},neck:{flex:-10},
 legL:{pos:[0.25,0.12,0.3],anchor:'ankle',pole:[0.5,1,0.5],yaw:-60},legR:{pos:[-0.1,0.09,-0.7],anchor:'ankle',pole:[0,-1,0],pitch:130},
 armL:flat(0.3,0.02,0.45),armR:flat(-0.12,0.02,0.45)}});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
