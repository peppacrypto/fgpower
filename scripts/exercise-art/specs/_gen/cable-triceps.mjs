import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,muscles,props,frames,more={})=>{out[slug]={slug,camera,muscles,props,frames,...more};};
const A=(s,p,f,pa,pole,ex={})=>({pos:[s*p[0],p[1],p[2]],contact:true,fingers:[s*f[0],f[1],f[2]],palm:[s*pa[0],pa[1],pa[2]],curl:0.78,pole:[s*pole[0],pole[1],pole[2]],...ex});
const both=(p,f,pa,pole,ex)=>({armL:A(1,p,f,pa,pole,ex),armR:A(-1,p,f,pa,pole,ex)});
// standing facing tower
const st=(pitch=8)=>({root:{pos:[0,0.93,0],pitch},spine:{flex:4},neck:{flex:2},
 legL:{pos:[0.13,0,0],anchor:'sole',yaw:7},legR:{pos:[-0.13,0,0],anchor:'sole',yaw:-7}});
const tw=att=>[{type:'cable-tower',pos:[0,0,0.66],yaw:180,pulleyY:2,hands:true,attachment:att}];
const pole=[0.25,-0.2,-1];
const push=(slug,att,x0,x1,top,bot,pole=[0.25,-0.2,-1],cam={az:62,el:8})=>save(slug,cam,['triceps'],tw(att),{
 start:{...st(),...both([x0,1.2,x0<0.1?0.4:0.3],top[0],top[1],pole)},
 end:{...st(),...both([x1,0.83,x0<0.1?0.3:0.2],bot[0],bot[1],pole)}});
const over=[[0,0.28,0.96],[0,-0.96,0.28]],overB=[[0,-0.96,0.28],[0,-0.28,-0.96]];
const under=[[0,0.28,0.96],[0,0.96,-0.28]],underB=[[0,-0.96,0.28],[0,0.28,0.96]];
const neu=[[0,0.5,0.86],[-1,0,0.05]],neuB=[[0.05,-0.8,0.6],[-1,0,0]];
push('triceps-pushdown','straight-bar',0.15,0.15,over,overB);
push('triceps-pushdown-v-bar-attachment','v-bar',0.07,0.08,[[0,0.5,0.86],[-1,0,0.05]],[[0,-0.8,0.6],[-1,0,0]]);
push('triceps-pushdown-rope-attachment','rope',0.06,0.15,neu,neuB,[0.6,-0.2,-1]);
push('reverse-grip-triceps-pushdown','straight-bar',0.15,0.15,under,underB);
// one arm underhand pushdown
const oa=(y,z,f,pa)=>({...st(),armL:A(1,[0.25,y,z],f,pa,[0.2,-0.5,-1]),armR:{fk:{flex:0,abd:12,rot:0,elbow:25},rel:'chest'}});
save('cable-one-arm-tricep-extension',{az:50,el:8},['triceps'],[{type:'cable-tower',pos:[0,0,0.66],yaw:180,pulleyY:2,hand:'L',attachment:'d-handle'}],{
 start:oa(1.31,0.2,[0,0.5,0.85],[0,0.85,-0.5]),end:oa(0.86,0.22,[0,-0.3,0.95],[0,0.95,0.3])},{muscleSide:'L'});
// overhead, back to low pulley
const bk=(pitch)=>({root:{pos:[0,0.915,0],pitch},spine:{flex:4},neck:{flex:-4},
 legL:{pos:[0.13,0,0.1],anchor:'sole',yaw:7},legR:{pos:[-0.13,0,-0.05],anchor:'sole',yaw:-7}});
const lowt=[{type:'cable-tower',pos:[0,0,-0.85],yaw:0,pulleyY:0.2,hands:true,attachment:'rope'}];
const ov=slug=>save(slug,{az:75,el:8},['triceps'],lowt,{
 start:{...bk(10),...both([0.06,1.5,-0.05],[0,-0.7,-0.7],[-1,0,0],[0.5,0.5,0.8])},
 end:{...bk(10),...both([0.07,1.9,0.0],[0,1,0],[-1,0,0],[0.2,1,0.5])}});
ov('cable-rope-overhead-triceps-extension');ov('triceps-overhead-extension-with-rope');
// one arm overhead
const oo=(y,z,f,pa)=>({...bk(8),armL:A(1,[0.15,y,z],f,pa,[0.2,1,0.5]),
 armR:{pos:[-0.17,1.6,0.0],hand:'flat',contact:true,fingers:[1,0,0],palm:[0,1,0],pole:[-0.3,-0.5,0.2]}});
save('standing-low-pulley-one-arm-triceps-extension',{az:60,el:8},['triceps'],[{type:'cable-tower',pos:[0,0,-0.85],yaw:0,pulleyY:0.2,hand:'L',attachment:'d-handle'}],{
 start:oo(1.52,-0.1,[0,-0.7,-0.7],[0,0.7,-0.7]),mid:oo(1.71,-0.05,[0,0.38,-0.92],[0,0.92,0.38]),end:oo(1.9,0.0,[0,1,0],[0,0,1])},{muscleSide:'L'});
// lying, flat bench, low pulley behind head
const ly=()=>({root:{pos:[0,0.567,0.2],pitch:-90},neck:{flex:6},spine:{flex:-4},
 legL:{pos:[0.22,0,0.74],anchor:'sole',pole:[0.3,1,0.3]},legR:{pos:[-0.22,0,0.74],anchor:'sole',pole:[-0.3,1,0.3]}});
const lyo=[{type:'flat-bench'},{type:'cable-tower',pos:[0,0,-1.5],yaw:0,pulleyY:0.2,hands:true,attachment:'straight-bar'}];
save('cable-lying-triceps-extension',{az:75,el:8},['triceps'],lyo,{
 start:{...ly(),...both([0.1,1.02,-0.26],[0,0.5,-0.85],[0,0.85,0.5],[0.5,0,1])},
 end:{...ly(),...both([0.1,0.8,-0.46],[0,-0.85,-0.5],[0,0.5,-0.85],[0.5,-0.5,1])}});
// low cable lying on seated-row bench, rope
const lyr=[{type:'flat-bench'},{type:'cable-tower',pos:[0,0,-1.5],yaw:0,pulleyY:0.2,hands:true,attachment:'rope',ropeLeg:0.5}];
save('low-cable-triceps-extension',{az:75,el:8},['triceps'],lyr,{
 start:{...ly(),...both([0.1,1.02,-0.26],[0,0.9,-0.4],[-1,0,0],[0.5,0,1])},
 end:{...ly(),...both([0.1,0.8,-0.46],[0,0.2,-1],[-1,0,0],[0.5,-0.5,1])}});
// incline, head toward the tower
const inc={root:{pos:[0,0.542,0.0556],pitch:-50},neck:{flex:6},legL:{pos:[0.21,0,0.62],anchor:'sole',pole:[0.15,0.4,1]},legR:{pos:[-0.21,0,0.62],anchor:'sole',pole:[-0.15,0.4,1]}};
const ia=(p,f,pa,po=[0.12,-0.3,-0.2])=>both(p,f,pa,po,{curl:0.82});
save('cable-incline-triceps-extension',{az:70,el:12},['triceps'],[{type:'incline-bench',angle:40,uprights:true},{type:'cable-tower',pos:[0,0,-1.15],yaw:0,pulleyY:2,hands:true,attachment:'straight-bar'}],{
 start:{...inc,...ia([0.08,1.38,-0.5],[0,0.6,-0.8],[0,0.8,0.6])},
 end:{...inc,...ia([0.08,1.2,-0.15],[0,1,0],[0,0,1],[0.3,-0.3,-1])}});
// kneeling, head and arms on a sideways bench
const kn=()=>({root:{pos:[0,0.59,0.0],pitch:75},neck:{flex:8},spine:{flex:4},
 legL:{pos:[0.11,0.145,-0.4],anchor:'ankle',pitch:41,pole:[0,1,1]},legR:{pos:[-0.11,0.145,-0.4],anchor:'ankle',pitch:41,pole:[0,1,1]}});
save('kneeling-cable-triceps-extension',{az:70,el:10},['triceps'],[{type:'flat-bench',yaw:90,pos:[0,0,0.62]},{type:'cable-tower',pos:[0,0,-0.8],yaw:0,pulleyY:2,hands:true,attachment:'straight-bar'}],{
 start:{...kn(),...both([0.12,0.84,0.62],[0,0.64,-0.77],[0,0.77,0.64],[0.12,0,1])},
 mid:{...kn(),...both([0.12,0.88,0.8],[0,0.8,0.6],[0,-0.6,0.8],[0.12,0,1])},
 mid2:{...kn(),...both([0.12,0.66,0.92],[0,0.4,0.92],[0,-0.92,0.4],[0.3,-0.3,1])},
 end:{...kn(),...both([0.12,0.56,0.95],[0,0,1],[0,-1,0],[0.3,-0.3,1])}});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).length);
