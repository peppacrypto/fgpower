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
const down={fk:{flex:0,abd:8,rot:0,elbow:0},rel:'chest'};
const wtee={fk:{flex:0,abd:90,rot:0,elbow:0},rel:'world'};
const tee={fk:{flex:0,abd:90,rot:0,elbow:0},rel:'chest'};
const rearFoot=(z,y,extra={})=>R(-0.12,y,z,{anchor:'ball',pitch:60,pole:[-0.1,-0.2,1],...extra});
// warrior-1: back foot turned out 45, flat, heel down; staggered stand -> deeper lunge, arms down -> overhead
const w1=(hy,hz,sf,arms)=>({root:{pos:[0,hy,hz],pitch:0},spine:{flex:sf},neck:{flex:0},
 legL:L(0.12,0,0.46,{yaw:2}),legR:R(-0.2,0,-0.64,{yaw:-50,pitch:10,pole:[-0.2,0.2,1]}),...arms});
save('warrior-1',cam,['quadriceps'],{start:w1(0.68,-0.08,0,{armL:down,armR:down}),end:w1(0.55,0.03,0,{armL:up,armR:up})},{muscleSide:'L'});
// high-lunge: straight back leg, heel up
const hl=(hy,hz,arms)=>({root:{pos:[0,hy,hz],pitch:0},neck:{flex:0},legL:L(0.12,0,0.51,{yaw:2}),legR:rearFoot(-0.6,0.05),...arms});
save('high-lunge',cam,['quadriceps'],{start:hl(0.66,0.1,{armL:down,armR:down}),mid:hl(0.65,0.09,{armL:tee,armR:tee}),end:hl(0.63,0.08,{armL:up,armR:up})},{muscleSide:'R'});
// warrior 2 / side angle / triangle: wide stance in x, front = figure's left
const w2legs={legL:{pos:[0.7,0,0],anchor:'sole',yaw:90,pole:[1,0.3,0.1]},legR:{pos:[-0.46,0,0],anchor:'sole',yaw:-80,pole:[-1,0.3,0]}};
save('warrior-2',{az:25,el:6},['quadriceps'],{
 start:{root:{pos:[0.12,0.64,0],yaw:0},neck:{twist:0},...w2legs,armL:{...tee,fk:{...tee.fk,abd:45}},armR:{...tee,fk:{...tee.fk,abd:45}}},
 end:{root:{pos:[0.27,0.57,0],yaw:0},neck:{twist:75},...w2legs,armL:tee,armR:tee}},{muscleSide:'L'});
const fkw=(flex,abd,elbow=0)=>({fk:{flex,abd,rot:0,elbow},rel:'world'});
const esa=(x)=>({root:{pos:[0.27,0.57,0],yaw:0,roll:-28*x},spine:{side:0},neck:{twist:-10*x,side:0,flex:-20*x},...w2legs});
save('extended-side-angle',{az:25,el:8},['quadriceps','glutes','obliques'],{
 start:{root:{pos:[0.27,0.57,0],yaw:0},neck:{twist:0},...w2legs,armL:fkw(0,90),armR:fkw(0,90)},
 end:{...esa(1),armL:fkw(0,28),armR:fkw(0,172)}},{muscleSide:'L'});
const tlegs={legL:{pos:[0.62,0,0],anchor:'sole',yaw:90,pole:[1,0.1,0.3]},legR:{pos:[-0.62,0,0],anchor:'sole',yaw:-80,pole:[-1,0.1,0]}};
save('triangle-pose',{az:12,el:6},['hamstrings','obliques'],{
 start:{root:{pos:[0,0.62,0],yaw:0},neck:{twist:0},...tlegs,armL:fkw(0,90),armR:fkw(0,90)},
 end:{root:{pos:[-0.1,0.62,0],yaw:0,roll:-34},spine:{side:0},neck:{twist:-10,side:0,flex:-20},...tlegs,
 armL:fkw(0,25),armR:fkw(0,158)}},{muscleSide:'L'});
// kneeling lunges
const kneel=(arms,pitch=0)=>({root:{pos:[0,0.5,0.1],pitch},neck:{flex:0},
 legL:L(0.12,0,0.55),legR:{pos:[-0.12,0.09,-0.33],anchor:'ankle',pole:[0,-1,0],pitch:130},...arms});
save('low-lunge',cam,['quadriceps'],{start:kneel({armL:up,armR:up})});
const thighHand=(x,y,z)=>({pos:[x,y,z],contact:true,hand:'flat',fingers:[0,0,1],palm:[0,-1,0],pole:[0.5,0.3,-1],curl:0.2});
const khf=(hz,pitch,arms)=>({root:{pos:[0,0.5,hz],pitch},neck:{flex:0},legL:L(0.12,0,0.55),legR:{pos:[-0.12,0.09,-0.33],anchor:'ankle',pole:[0,-1,0],pitch:130},...arms});
const reach={fk:{flex:172,abd:10,rot:0,elbow:0},rel:'chest'};
save('kneeling-hip-flexor',cam,['quadriceps'],{start:khf(-0.02,0,{armL:thighHand(0.12,0.595,0.4),armR:reach}),end:khf(0.14,-8,{armL:thighHand(0.12,0.595,0.4),armR:reach})},{muscleSide:'R'});
// lizard: lower from a tall low lunge to the deep hold, hands fixed inside the front foot
const liz=(y,pitch,sf,ne)=>({root:{pos:[0,y,-0.1],pitch},spine:{flex:sf},neck:{flex:ne},
 legL:L(0.54,0,0.6,{yaw:0,pole:[0.6,0.3,1]}),legR:R(-0.1,0.06,-0.8,{anchor:'ball',pitch:60,pole:[-0.1,-0.2,1]}),
 armL:flat(-0.02,0.02,0.45),armR:flat(-0.22,0.02,0.45)});
save('lizard-pose',{az:60,el:14},['adductors'],{start:liz(0.42,40,45,-20),end:liz(0.37,48,58,-30)},{muscleSide:'L'});
// runner's stretch: hips back, front leg straight, heel down, toes up; rear knee kneeling
const rs=(hz,hy,pitch,sf)=>({root:{pos:[0,hy,hz],pitch},spine:{flex:sf},neck:{flex:-15},
 legL:{pos:[0.18,0,0.26],anchor:'heel',pitch:-30,pole:[0,0.3,1]},legR:{pos:[-0.12,0.16,-0.85],anchor:'ankle',pole:[0,-1,0],pitch:130},
 armL:flat(0.5,0.0,0.0),armR:flat(-0.14,0.0,0.0)});
save('runners-stretch',{az:80,el:8},['hamstrings'],{start:rs(-0.2,0.5,55,25),end:rs(-0.5,0.46,55,28)},{muscleSide:'L'});
// standing hip flexors: rear leg straight, heel up; pelvis shifts forward and tucks
const shf=(hz,hy,pitch)=>({root:{pos:[0,hy,hz],pitch},neck:{flex:0},
 legL:L(0.12,0,0.4),legR:R(-0.12,0.03,-0.42,{anchor:'ball',pitch:42,pole:[-0.1,0.2,1]}),armL:hips,armR:{fk:{flex:172,abd:10,rot:0,elbow:0},rel:'chest'}});
save('standing-hip-flexors',cam,['quadriceps'],{start:shf(0.0,0.8,0),end:shf(0.16,0.74,-8)},{muscleSide:'R'});
// world's greatest: 3 parts
const wg=(r,sp,ar)=>({root:{pos:[0,0.42,0.1],...r},...sp,legL:L(0.54,0,0.6,{yaw:2,pole:[1,0.5,0.8]}),legR:R(-0.12,0.04,-0.6,{anchor:'ball',pitch:60,pole:[-0.1,-0.2,1]}),...ar});
save('worlds-greatest-stretch',{az:45,el:4},['hamstrings'],{
 start:wg({pos:[0,0.385,0.1],pitch:12},{spine:{flex:70},neck:{flex:-20}},{armL:{...flat(-0.02,0.02,0.52),pole:[0,-1,-1]},armR:flat(-0.28,0.02,0.55)}),
 mid:wg({pos:[0,0.385,0.1],pitch:12},{spine:{flex:70},neck:{flex:-20}},{armL:{...flat(-0.02,0.02,0.52),pole:[0,-1,-1]},armR:flat(-0.28,0.02,0.55)}),
 mid2:wg({pos:[0,0.38,0.1],pitch:12},{spine:{flex:70},neck:{flex:-20},},{armL:{...flat(-0.02,0.02,0.52),pole:[0,-1,-1]},armR:flat(-0.28,0.02,0.55)}),
 mid3:wg({pos:[0,0.38,0.1],pitch:12},{spine:{flex:62,twist:-15},neck:{twist:-20,flex:-20}},{armL:{...flat(-0.02,0.02,0.52),pole:[0,-1,-1]},armR:{pos:[-0.37,0.55,0.45],rel:'world',fingers:[0,0.5,0.65],palm:[0,-0.5,0.5],pole:[-1,-0.15,-0.65]}}),
 mid4:wg({pos:[0,0.38,0.1],pitch:12},{spine:{flex:60,twist:-30},neck:{twist:-30,flex:-22}},{armL:{...flat(-0.02,0.02,0.52),pole:[0,-1,-1]},armR:{pos:[-0.42,0.75,0.4],rel:'world',fingers:[0,0.55,0.6],palm:[0,-0.45,0.65],pole:[-1,-0.1,-0.5]}}),
 mid5:wg({pos:[0,0.38,0.1],pitch:12},{spine:{flex:55,twist:-40},neck:{twist:-40,flex:-25}},{armL:{...flat(-0.02,0.02,0.52),pole:[0,-1,-1]},armR:{pos:[-0.45,1.1,0.35],rel:'world',roll:0,fingers:[0,0.9,0.1],palm:[0,0,1],pole:[-1,0,-0.3]}}),
 end:wg({pos:[0,0.38,0.1],pitch:12},{spine:{flex:62,twist:-15},neck:{twist:-20,flex:-20}},{armL:{...flat(-0.02,0.02,0.52),pole:[0,-1,-1]},armR:{pos:[-0.37,0.55,0.45],rel:'world',fingers:[0,0.5,0.65],palm:[0,-0.5,0.5],pole:[-1,-0.15,-0.65]}})},{muscleSide:'L',tempo:{lift:'there',pauses:{end:2}}});
// pigeon: all fours -> front shin across, hips down, long back leg
const pg=(hy,pitch,legL,sf)=>({root:{pos:[0,hy,0],pitch},spine:{flex:sf},neck:{flex:-10},legL,legR:{pos:[-0.11,0.09,-0.74],anchor:'ankle',pole:[0,-1,0],pitch:130},armL:flat(0.14,0.02,0.55),armR:flat(-0.12,0.02,0.55)});
save('pigeon-pose',{az:35,el:25},['glutes'],{
 start:pg(0.5,85,{pos:[0.11,0.09,-0.43],anchor:'ankle',pole:[0,-1,0],pitch:130},10),
 mid:pg(0.4,70,{pos:[0.0,0.3,0.1],anchor:'ankle',pole:[1,-0.2,0.7]},15),
 end:pg(0.24,55,{pos:[-0.05,0.1,0.3],anchor:'ankle',pole:[1,-0.2,0.7]},20)},{muscleSide:'L'});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
