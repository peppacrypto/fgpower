import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,muscles,props,frames,more={})=>{out[slug]={slug,camera,muscles,...(props?{props}:{}),frames,...more};};
// ---- seated floor
const R0=[0,0.125,-0.05];
const sroot=(p,sf,nf,z=-0.05)=>({root:{pos:[0,0.125,z],pitch:p},spine:{flex:sf},neck:{flex:nf}});
const sleg=(s,x,z,pitch=-70)=>({pos:[s*x,0.08,z],pitch,pole:[s*0.1,1,0.1]});
const bothLegs=(pitch,x=0.1,z=0.81)=>({legL:sleg(1,x,z,pitch),legR:sleg(-1,x,z,pitch)});
const rel=(s,p,f=[0,0,1],pa=[0,-1,0])=>({pos:[s*p[0],p[1],p[2]],hand:'relaxed',fingers:[s*f[0],f[1],f[2]],palm:[s*pa[0],pa[1],pa[2]],curl:0.3,pole:[s*0.8,-0.4,-0.3]});
const flat=(s,p)=>({pos:[s*p[0],p[1],p[2]],contact:true,hand:'flat',fingers:[0,0,1],palm:[0,-1,0],pole:[s*0.3,-0.3,-0.8],curl:0.2});
const lap=(s)=>rel(s,[0.2,0.2,0.3],[0,-0.2,1]);
const SEATM='mat';
const mat=[{type:'floor-mat'}];
save('seated-forward-fold',{az:70,el:10},['hamstrings','spinal-erectors'],mat,{
 start:{...sroot(8,2,-4),...bothLegs(-70),armL:rel(1,[0.22,0.2,0.3],[0,-0.2,1]),armR:rel(-1,[0.22,0.2,0.3],[0,-0.2,1])},
 end:{...sroot(32,28,10),...bothLegs(-70),armL:rel(1,[0.21,0.12,0.74],[0,-0.2,1],[-1,0,0]),armR:rel(-1,[0.21,0.12,0.74],[0,-0.2,1],[-1,0,0])}});
// one long, one foot to inner thigh (long = right leg)
const JL={fk:{flex:84,abd:52,rot:-75,knee:135},rel:'world',foot:{pitch:0}};
const janu=(armsEnd,p=55,sf=18,nf=8)=>({
 legR:sleg(-1,0.1,0.81),
 legL:JL}); 
const jFrames=()=>({
 start:{...sroot(8,2,-4),...janu(),armL:rel(1,[0.22,0.2,0.3],[0,-0.2,1]),armR:rel(-1,[0.22,0.2,0.3],[0,-0.2,1])},
 end:{...sroot(36,10,0),...janu(),armL:rel(1,[0.06,0.2,0.62],[0.2,-0.2,1],[-0.8,0.3,0]),armR:rel(-1,[0.2,0.2,0.66],[0,-0.2,1])}});
const jan={az:70,el:12};
save('seated-floor-hamstring-stretch',jan,['hamstrings'],mat,jFrames(),{muscleSide:'R'});
save('head-to-knee-pose',{az:70,el:12},['hamstrings'],mat,{
 start:{...sroot(10,3,-2),...janu(),armL:rel(1,[0.22,0.2,0.3],[0,-0.2,1]),armR:rel(-1,[0.22,0.2,0.3],[0,-0.2,1])},
 mid:{...sroot(30,8,0),...janu(),armL:rel(1,[0.09,0.26,0.56],[0.15,-0.2,1],[-0.8,0.3,0]),armR:rel(-1,[0.18,0.22,0.55],[0,-0.2,1])},
 end:{...sroot(36,10,0),...janu(),armL:rel(1,[0.06,0.2,0.62],[0.2,-0.2,1],[-0.8,0.3,0]),armR:rel(-1,[0.2,0.2,0.66],[0,-0.2,1])}},{muscleSide:'R'});
// straddle
const vleg=(s)=>({pos:[s*0.78,0.08,0.45],pitch:-70,yaw:0,pole:[s*0.1,1,0.1]});
save('the-straddle',{az:35,el:26},['hamstrings','adductors'],mat,{
 start:{...sroot(18,6,0),legL:vleg(1),legR:vleg(-1),armL:flat(1,[0.12,0.02,0.3]),armR:flat(-1,[0.12,0.02,0.3])},
 mid:{...sroot(28,10,0),legL:vleg(1),legR:vleg(-1),armL:{...rel(1,[0.15,0.2,0.5]),pole:[0.8,-0.4,-0.3]},armR:{...rel(-1,[0.15,0.2,0.5])}},
 end:{...sroot(40,14,-2),legL:vleg(1),legR:vleg(-1),armL:flat(1,[0.15,0.02,0.7]),armR:flat(-1,[0.15,0.02,0.7])}});
// hug legs
const hug=(s,z)=>({pos:[s*0.2,0.2,z],hand:'relaxed',fingers:[0,-0.2,1],palm:[-s*0.5,-0.8,0],curl:0.6,pole:[s*0.3,-0.9,-0.1]});
const hl={legL:{pos:[0.07,0.09,0.8],pitch:-72,pole:[0.1,1,0.1]},legR:{pos:[-0.07,0.09,0.8],pitch:-72,pole:[-0.1,1,0.1]}};
save('upper-back-leg-grab',{az:70,el:12},['hamstrings','spinal-erectors'],mat,{
 start:{...sroot(18,6,0),...hl,armL:hug(1,0.36),armR:hug(-1,0.36)},
 mid:{...sroot(28,10,0),...hl,armL:hug(1,0.45),armR:hug(-1,0.45)},
 end:{...sroot(30,8,0),...hl,armL:hug(1,0.6),armR:hug(-1,0.6)}});
// ---- lying
const lroot=(extra={})=>({root:{pos:[0,0.1,0],pitch:-90,...extra},neck:{flex:0}});
const leg=(s,p,pole=[0,1,0.2],extra={})=>{const {sa=0,...r}=extra;return {pos:[s*p[0],p[1],p[2]],anchor:'ankle',pole:[s*pole[0],pole[1],pole[2]],pitch:-(90+sa),...r};};
const straight=(s)=>leg(s,[0.11,0.09,0.86],[0,1,0]);
const grip=(s,p,f,pa,g=0.035)=>({pos:[s*p[0],p[1],p[2]],hand:'grip',grip:g,fingers:[s*f[0],f[1],f[2]],palm:[s*pa[0],pa[1],pa[2]],curl:0.8,pole:[s*0.6,-0.6,-0.3]});
const up90=leg(1,[0.11,0.96,0.0],[0,0,-1],{sa:90});
const behindThigh=(s,y=0.45,z=-0.17,x=0.2)=>({pos:[s*x,y,z],hand:'relaxed',fingers:[0,1,0.1],palm:[0,0.1,1],curl:0.5,pole:[s*0.6,-0.6,-0.3]});
const fl=(th,d)=>{const r=th*Math.PI/180;return [+(0.86*Math.cos(r)).toFixed(3),+(0.1+0.86*Math.sin(r)).toFixed(3)]};
const onLeg=(th,d,s=1,off=0.13)=>{const r=th*Math.PI/180;return [s*0.2,+(0.1+d*Math.sin(r)+off*Math.cos(r)).toFixed(3),+(d*Math.cos(r)-off*Math.sin(r)).toFixed(3)]};
const bentFoot=(s)=>leg(s,[0.11,0.1,0.42],[0,1,-0.2],{sa:-45});
const lu=(th,nf)=>{const [z,y]=fl(th);return {...lroot(),neck:{flex:nf},legL:leg(1,[0.11,y,z],[0,0,-1],{sa:th}),legR:bentFoot(-1),armL:behindThigh(1,...onLeg(th,0.3).slice(1),0.22),armR:behindThigh(-1,...onLeg(th,0.3).slice(1),0.22)};};
save('leg-up-hamstring-stretch',{az:62,el:14},['hamstrings'],null,{start:lu(78,4),end:lu(108,8)},{muscleSide:'L'});
const sh=(z,y)=>({armL:grip(1,[0.12,y,z],[0,0.3,1],[1,0,-0.1],0.02),armR:grip(-1,[0.12,y,z],[0,0.3,1],[1,0,-0.1],0.02)});
const hs=(th,nf)=>{const [z,y]=fl(th);return {...lroot(),neck:{flex:nf},legL:leg(1,[0.11,y,z],[0,0,-1],{sa:th}),legR:straight(-1),...sh(-0.3,0.42)};};
save('hamstring-stretch',{az:62,el:14},['hamstrings','calves'],[{type:'stretch-strap',foot:'L',hands:true,at:0.8}],{start:hs(60,4),end:hs(96,8)},{muscleSide:'L'});
// 90/90
const ninety=leg(1,[0.11,0.53,0.43],[0,1,-0.1],{});
save('90-90-hamstring',{az:62,el:14},['hamstrings'],null,{
 start:{...lroot(),neck:{flex:4},legL:ninety,legR:straight(-1),armL:behindThigh(1),armR:behindThigh(-1)},
 mid:{...lroot(),neck:{flex:4},legL:leg(1,[0.11,0.72,0.45],[0,1,-0.3],{sa:30}),legR:straight(-1),armL:behindThigh(1),armR:behindThigh(-1)},
 end:{...lroot(),neck:{flex:6},legL:up90,legR:straight(-1),armL:behindThigh(1),armR:behindThigh(-1)}},{muscleSide:'L'});
const sg=(y,z)=>({armL:grip(1,[0.15,y,z],[0,0.3,1],[1,0,-0.1],0.02),armR:grip(-1,[0.15,y,z],[0,0.3,1],[1,0,-0.1],0.02)});
const gl=(p,sa)=>leg(1,p,[0.3,1,0],{sa});
save('intermediate-groin-stretch',{az:20,el:45},['adductors','hamstrings'],[{type:'stretch-strap',foot:'L',hands:true,at:0.8}],{
 start:{...lroot(),legL:gl([0.11,0.92,0.21],75),legR:straight(-1),...sg(0.42,-0.25)},
 mid:{...lroot(),legL:gl([0.44,0.77,0.38],60),legR:straight(-1),...sg(0.42,-0.25)},
 end:{...lroot(),legL:gl([0.69,0.57,0.38],45),legR:straight(-1),...sg(0.42,-0.25)}},{muscleSide:'L'});
const ib=(x,y,z,sa)=>({...lroot(),legL:leg(1,[x,y,z],[-0.2,1,0],{sa}),legR:straight(-1),armL:grip(1,[0.03,0.5,-0.2],[-0.3,0.3,1],[1,0,-0.1],0.02),armR:grip(-1,[0.12,0.5,-0.2],[0,0.3,1],[1,0,-0.1],0.02)});
save('it-band-and-glute-stretch',{az:25,el:38},['abductors','glutes'],[{type:'stretch-strap',foot:'L',hands:true,at:0.8}],{
 start:ib(0.11,0.9,0.3,70),
 mid:ib(-0.15,0.79,0.45,60),
 end:ib(-0.36,0.63,0.48,50)},{muscleSide:'L'});
// chair
const CH={type:'chair',pos:[0,0,-0.15]};
const croot=(p=8)=>({root:{pos:[0,0.57,0.0],pitch:p},neck:{flex:0}});
const cfeet=(extraL)=>({legL:extraL||{pos:[0.13,0,0.4],anchor:'sole',pitch:0,yaw:6},legR:{pos:[-0.13,0,0.4],anchor:'sole',pitch:0,yaw:-6}});
const seatHand=(s)=>({pos:[s*0.215,0.47,0.02],contact:true,hand:'flat',fingers:[0,-0.3,1],palm:[0,-1,0],pole:[s*0.9,-0.4,-0.5],curl:0.2});
const cl=(x,y,z)=>({pos:[x,y,z],anchor:'heel',pitch:-40,pole:[0.05,1,0.1]});
const lean=(p,sf)=>({root:{pos:[0,0.57,0.0],pitch:p},spine:{flex:sf},neck:{flex:0}});
const thH=(s)=>({pos:[s*0.14,0.78,0.3],hand:'relaxed',fingers:[0,-0.2,1],palm:[0,-1,0],pole:[s*0.6,-0.4,-0.8],curl:0.2});
save('chair-leg-extended-stretch',{az:80,el:10},['hamstrings'],[CH],{
 start:{...croot(),...cfeet(),armL:thH(1),armR:thH(-1)},
 mid:{...croot(),...cfeet(cl(0.13,0.12,0.5)),armL:thH(1),armR:thH(-1)},
 mid2:{...croot(),...cfeet(cl(0.13,0.0,0.7)),armL:thH(1),armR:thH(-1)},
 end:{...lean(18,14),...cfeet(cl(0.13,0.0,0.7)),armL:thH(1),armR:thH(-1)}},{muscleSide:'L'});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
