import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const sit={legL:{pos:[0.13,0,0.4],anchor:'sole',pitch:0,yaw:6},legR:{pos:[-0.13,0,0.4],anchor:'sole',pitch:0,yaw:-6}};
const arm=(s,p,f,pa,pole,extra={})=>{const x=s;return {pos:[x*p[0],p[1],p[2]],contact:true,fingers:[x*f[0],f[1],f[2]],palm:[x*pa[0],pa[1],pa[2]],curl:0.78,pole:[x*pole[0],pole[1],pole[2]],...extra};};
const both=(p,f,pa,pole,extra)=>({armL:arm(1,p,f,pa,pole,extra),armR:arm(-1,p,f,pa,pole,extra)});
const out={};const ARM={fk:{flex:0,abd:12,rot:0,elbow:25},rel:'chest'};
const save=(slug,camera,props,frames,more={})=>{out[slug]={slug,camera,muscles:['lats'],props,frames,...more};};
const lp=(att,extra={})=>[{type:'lat-pulldown',pos:[0,0,0],hands:true,attachment:att,...extra}];
const seated=(pitch,sf,nf)=>({root:{pos:[0,0.57,-0.02],pitch},spine:{flex:sf},neck:{flex:nf},...sit});
const over=[0.35,0.931,0.1], overP=[0,-0.2,0.98], pole=[1,-1.6,-0.15];
const under=[0.35,0.931,0.1], underP=[0,0.2,-0.98];
function two(slug,att,x,fing,palm,cam={az:140,el:14},endY=1.14,endZ=0.26,p1=-4,p2=-12,pl=pole,sy=1.63,sz=0.17,pl0=null){
 save(slug,cam,lp(att),{
  start:{...seated(p1,-2,-14),...both([x,sy,sz],fing,palm,pl0||pl)},
  end:{...seated(p2,-6,-6),...both([x,endY,endZ],fing,palm,pl)}});
}
two('wide-grip-lat-pulldown','lat-bar',0.4,over,overP);
two('close-grip-front-lat-pulldown','lat-bar',0.16,[-0.2,0.97,0.1],overP,{az:140,el:14},1.1,0.28,-4,-12,pole,1.7,0.1);
two('underhand-cable-pulldowns','lat-bar',0.17,[0.1,0.99,0.1],underP,{az:125,el:12},1.1,0.28,-4,-12,[0,-1,-0.5],1.68,0.1,[0,-1,0.3]);
// v-bar
save('v-bar-pulldown',{az:118,el:12},lp('v-bar'),{
 start:{...seated(-8,-2,-12),...both([0.07,1.64,0.12],[0,0.8,0.5],[-1,0,0],[0,-1,0.3])},
 mid:{...seated(-14,-4,-5),...both([0.07,1.36,0.2],[0,0.8,0.55],[-1,0,0],[1,-0.5,-0.2])},
 end:{...seated(-20,-6,2),...both([0.07,1.08,0.26],[0,0.6,0.8],[-1,0,0],[0.35,-0.5,-1])}});
// behind neck
save('wide-grip-pulldown-behind-the-neck',{az:125,el:14},lp('lat-bar'),{
 start:{...seated(-2,-2,-14),...both([0.42,1.63,0.17],over,overP,pole)},
 end:{...seated(6,4,12),...both([0.42,1.4,-0.1],[0.2,0.5,-0.85],[0,0.85,0.5],[1,-0.8,-0.3])}});
// one arm
save('one-arm-lat-pulldown',{az:130,el:12},[{type:'lat-pulldown',pos:[0,0,0],hand:'L',attachment:'d-handle'}],{
 start:{...seated(-4,-2,-10),armL:arm(1,[0.12,1.68,0.1],[0.2,0.97,0.1],[-1,0,0.1],pole),armR:ARM},
 end:{...seated(-12,-6,-4),armL:arm(1,[0.28,1.12,0.1],[0.1,0.9,0.4],[-1,0,0.2],[0.4,-0.3,-1]),armR:ARM}},{muscleSide:'L'});
// straight arm
const stand=(z,p)=>({root:{pos:[0,0.92,z],pitch:p},spine:{flex:4},neck:{flex:-12},legL:{pos:[0.13,0,z+0.05],anchor:'sole',yaw:6},legR:{pos:[-0.13,0,z-0.08],anchor:'sole',yaw:-6}});
const tower=att=>[{type:'cable-tower',pos:[0,0,0.66],yaw:180,pulleyY:2,hands:true,attachment:att}];
const z0=-0.25;
save('straight-arm-pulldown',{az:70,el:8},tower('straight-bar'),{
 start:{...stand(z0,30),...both([0.36,1.5,0.44],[0,0.2,0.98],[0,-0.98,0.2],[0.3,-0.2,-1])},
 end:{...stand(z0,32),...both([0.36,0.86,0.2],[0,-0.1,1],[0,-1,-0.1],[0.3,-0.2,-1])}});
save('rope-straight-arm-pulldown',{az:70,el:8},tower('rope'),{
 start:{...stand(z0,30),...both([0.06,1.5,0.44],[0,0.7,0.7],[-0.95,0.3,0.05],[0.2,-1,-0.2])},
 end:{...stand(z0,32),...both([0.12,0.86,0.2],[0.05,-0.5,0.85],[-0.95,0.3,0.0],[0.2,-1,-0.2])}});
// incline pushdown
const inc=(p)=>({root:{pos:[0,0.542,0.0556],pitch:-50},neck:{flex:6},legL:{pos:[0.21,0,0.62],anchor:'sole',pole:[0.15,0.4,1]},legR:{pos:[-0.21,0,0.62],anchor:'sole',pole:[-0.15,0.4,1]}});
const ia=(p,f,pa,pole)=>both(p,f,pa,[0.5,-0.8,-0.2],{curl:0.82});
save('cable-incline-pushdown',{az:56,el:14},[{type:'incline-bench',angle:40,uprights:true},{type:'cable-tower',pos:[0,0,-1.15],yaw:0,pulleyY:2,hands:true,attachment:'straight-bar'}],{
 start:{...inc(),...ia([0.22,0.85,0.25],[0,-0.6,0.8],[0,-0.8,-0.6],[0.5,-0.3,-0.2])},
 mid:{...inc(),...ia([0.22,1.3,0.05],[0,0.2,0.98],[0,-0.98,0.2],[0.5,-0.3,-0.2])},
 end:{...inc(),...ia([0.22,1.38,-0.5],[0,0.6,-0.8],[0,0.8,0.6],[0.5,-0.3,-0.2])}});
// full ROM
const st=(sf)=>({root:{pos:[0,0.92,0.1],pitch:4},spine:{flex:sf},neck:{flex:-6},legL:{pos:[0.13,0,0.1],anchor:'sole',yaw:6},legR:{pos:[-0.13,0,0.1],anchor:'sole',yaw:-6}});
const cr=(x,y,z,f,pa,po)=>({armL:arm(1,[-x,y,z],f,pa,po),armR:arm(-1,[-x,y,z+0.1],f,pa,po)});
save('full-range-of-motion-lat-pulldown',{az:24,el:7},[{type:'cable-crossover',pos:[0,0,0],hands:true,pulleyY:2,attachment:'d-handle'}],{
 start:{...st(2),...cr(0.04,1.9,0.42,[-0.3,1,0],[-0.4,0.4,0.8],[0.7,-0.5,-0.3])},
 mid0:{...st(2),...cr(-0.25,1.65,0.3,[-0.15,0.9,0.4],[-0.55,0.15,0.8],[0.9,-0.55,-0.3])},
 mid:{...st(2),...cr(-0.5,1.5,0.15,[0,0.7,0.7],[-1,0,0],[0.8,-0.6,-0.6])},
 end:{...st(4),...cr(-0.3,1.1,0.22,[0,0,1],[-1,0,0],[0.6,-0.9,-0.4])}});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
