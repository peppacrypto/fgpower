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
const JL={fk:{flex:70,abd:70,rot:-70,knee:130},rel:'world',foot:{pitch:0}};
const janu=(armsEnd,p=55,sf=18,nf=8)=>({
 legR:sleg(-1,0.1,0.81),
 legL:JL}); 
const jFrames=()=>({
 start:{...sroot(8,2,-4),...janu(),armL:rel(1,[0.22,0.2,0.3],[0,-0.2,1]),armR:rel(-1,[0.22,0.2,0.3],[0,-0.2,1])},
 end:{...sroot(32,26,10),...janu(),armL:rel(1,[0.03,0.27,0.6],[0.2,-0.2,1],[-0.8,0.3,0]),armR:rel(-1,[0.14,0.25,0.74],[0,-0.2,1])}});
const jan={az:40,el:22};
save('seated-floor-hamstring-stretch',jan,['hamstrings'],mat,jFrames(),{muscleSide:'R'});
save('head-to-knee-pose',{az:40,el:22},['hamstrings'],mat,{
 start:{...sroot(10,3,-2),...janu(),armL:rel(1,[0.22,0.2,0.3],[0,-0.2,1]),armR:rel(-1,[0.22,0.2,0.3],[0,-0.2,1])},
 mid:{...sroot(21,14,3),...janu(),armL:rel(1,[0.09,0.26,0.56],[0.15,-0.2,1],[-0.8,0.3,0]),armR:rel(-1,[0.18,0.22,0.55],[0,-0.2,1])},
 end:{...sroot(32,26,10),...janu(),armL:rel(1,[0.03,0.27,0.6],[0.2,-0.2,1],[-0.8,0.3,0]),armR:rel(-1,[0.14,0.25,0.74],[0,-0.2,1])}},{muscleSide:'R'});
// straddle
const vleg=(s)=>({pos:[s*0.55,0.08,0.62],pitch:-70,yaw:s*-15,pole:[s*0.1,1,0.1]});
save('the-straddle',{az:30,el:28},['hamstrings','adductors'],mat,{
 start:{...sroot(26,20,-4),legL:vleg(1),legR:vleg(-1),armL:flat(1,[0.05,0.02,0.5]),armR:flat(-1,[0.05,0.02,0.5])},
 end:{...sroot(34,30,6),legL:vleg(1),legR:vleg(-1),armL:flat(1,[0.05,0.02,0.5]),armR:flat(-1,[0.05,0.02,0.5])}});
// hug legs
const hug=(s,z)=>({pos:[s*0.15,0.05,z],hand:'relaxed',fingers:[-s*0.9,0,0.3],palm:[0,1,0],curl:0.6,pole:[s*0.9,-0.2,-0.4]});
save('upper-back-leg-grab',{az:60,el:14},['hamstrings','spinal-erectors'],mat,{
 start:{...sroot(20,12,-2),...{legL:{pos:[0.07,0.1,0.8],pitch:-72,pole:[0.1,1,0.1]},legR:{pos:[-0.07,0.1,0.8],pitch:-72,pole:[-0.1,1,0.1]}},armL:hug(1,0.3),armR:hug(-1,0.3)},
 end:{...sroot(27,19,12),...{legL:{pos:[0.07,0.1,0.8],pitch:-72,pole:[0.1,1,0.1]},legR:{pos:[-0.07,0.1,0.8],pitch:-72,pole:[-0.1,1,0.1]}},armL:hug(1,0.3),armR:hug(-1,0.3)}});
// ---- lying
const lroot=(extra={})=>({root:{pos:[0,0.1,0],pitch:-90,...extra},neck:{flex:0}});
const leg=(s,p,pole=[0,1,0.2],extra={})=>{const {sa=0,...r}=extra;return {pos:[s*p[0],p[1],p[2]],anchor:'ankle',pole:[s*pole[0],pole[1],pole[2]],pitch:-(90+sa),...r};};
const straight=(s)=>leg(s,[0.11,0.09,0.86],[0,1,0]);
const grip=(s,p,f,pa,g=0.035)=>({pos:[s*p[0],p[1],p[2]],hand:'grip',grip:g,fingers:[s*f[0],f[1],f[2]],palm:[s*pa[0],pa[1],pa[2]],curl:0.8,pole:[s*0.6,-0.6,-0.3]});
const up90=leg(1,[0.11,0.96,0.0],[0,0,-1],{sa:90});
const behindThigh=(s,y=0.45,z=-0.17,x=0.2)=>({pos:[s*x,y,z],hand:'relaxed',fingers:[0,1,0.1],palm:[0,0.1,1],curl:0.5,pole:[s*0.6,-0.6,-0.3]});
// leg-up: bent knee other leg, raised leg, hands behind thigh/calf, pull toward nose
const bentFoot=(s)=>leg(s,[0.11,0.1,0.42],[0,1,-0.2],{sa:-45});
save('leg-up-hamstring-stretch',{az:62,el:14},['hamstrings'],null,{
 start:{...lroot(),neck:{flex:6},legL:leg(1,[0.11,0.9,-0.08],[0,0,-1],{sa:90}),legR:bentFoot(-1),armL:behindThigh(1,0.45,-0.12,0.22),armR:behindThigh(-1,0.45,-0.12,0.22)},
 end:{...lroot(),neck:{flex:10},legL:leg(1,[0.11,0.85,-0.2],[0,0,-1],{sa:120}),legR:bentFoot(-1),armL:behindThigh(1,0.5,-0.2,0.25),armR:behindThigh(-1,0.5,-0.2,0.25)}},{muscleSide:'L'});
// hamstring-stretch with belt
const sh=(z,y)=>({armL:grip(1,[0.12,y,z],[0,0.3,1],[1,0,-0.1],0.02),armR:grip(-1,[0.12,y,z],[0,0.3,1],[1,0,-0.1],0.02)});
save('hamstring-stretch',{az:62,el:14},['hamstrings','calves'],[{type:'stretch-strap',foot:'L',hands:true,at:0.8}],{
 start:{...lroot(),neck:{flex:6},legL:leg(1,[0.11,0.9,0.15],[0,0,-1],{sa:80}),legR:straight(-1),...sh(-0.28,0.42)},
 end:{...lroot(),neck:{flex:10},legL:leg(1,[0.11,0.9,-0.1],[0,0,-1],{sa:105}),legR:straight(-1),...sh(-0.3,0.42)}},{muscleSide:'L'});
// 90/90
const ninety=leg(1,[0.11,0.53,0.43],[0,1,-0.1],{});
save('90-90-hamstring',{az:62,el:14},['hamstrings'],null,{
 start:{...lroot(),neck:{flex:4},legL:ninety,legR:straight(-1),armL:behindThigh(1),armR:behindThigh(-1)},
 mid:{...lroot(),neck:{flex:4},legL:leg(1,[0.11,0.72,0.45],[0,1,-0.3],{sa:30}),legR:straight(-1),armL:behindThigh(1),armR:behindThigh(-1)},
 end:{...lroot(),neck:{flex:6},legL:up90,legR:straight(-1),armL:behindThigh(1),armR:behindThigh(-1)}},{muscleSide:'L'});
// strap swings
const sg=(x,y,z)=>({armL:grip(1,[x,y,z],[0,0.3,1],[1,0,-0.1],0.02),armR:grip(-1,[0.15,y,z],[0,0.3,1],[1,0,-0.1],0.02)});
save('intermediate-groin-stretch',{az:20,el:40},['adductors','hamstrings'],[{type:'stretch-strap',foot:'L',hands:true,at:0.8}],{
 start:{...lroot(),legL:leg(1,[0.11,0.5,0.7],[0,1,0],{sa:35}),legR:straight(-1),...sg(0.15,0.4,-0.28)},
 mid:{...lroot(),legL:leg(1,[0.7,0.1,0.55],[0.3,1,0],{sa:0,yaw:-10,roll:40}),legR:straight(-1),...sg(0.3,0.4,-0.25)},
 end:{...lroot(),legL:leg(1,[0.88,0.12,0.2],[0.3,1,0],{sa:0,yaw:-10,roll:40}),legR:straight(-1),...sg(0.38,0.35,-0.2)}},{muscleSide:'L'});
save('it-band-and-glute-stretch',{az:25,el:38},['abductors','glutes'],[{type:'stretch-strap',foot:'L',hands:true,at:0.8}],{
 start:{...lroot(),legL:leg(1,[0.11,0.5,0.7],[0,1,0],{sa:35}),legR:straight(-1),...sg(0.15,0.4,-0.28)},
 mid:{...lroot(),legL:leg(1,[-0.1,0.5,0.7],[0,1,0],{sa:20}),legR:straight(-1),armL:grip(1,[0.0,0.5,-0.12],[-0.6,0.3,1],[1,0,-0.1],0.02),armR:grip(-1,[0.15,0.5,-0.2],[0,0.3,1],[1,0,-0.1],0.02)},
 end:{...lroot(),legL:leg(1,[-0.45,0.55,0.4],[-0.2,1,0],{sa:20,yaw:20,roll:-40}),legR:straight(-1),armL:grip(1,[-0.08,0.5,-0.1],[-0.6,0.3,1],[1,0,-0.1],0.02),armR:grip(-1,[0.12,0.5,-0.25],[0,0.3,1],[1,0,-0.1],0.02)}},{muscleSide:'L'});
// chair
const CH={type:'chair',pos:[0,0,0]};
const croot=(p=8)=>({root:{pos:[0,0.57,0.0],pitch:p},neck:{flex:0}});
const cfeet=(extraL)=>({legL:extraL||{pos:[0.13,0,0.4],anchor:'sole',pitch:0,yaw:6},legR:{pos:[-0.13,0,0.4],anchor:'sole',pitch:0,yaw:-6}});
const seatHand=(s)=>({pos:[s*0.215,0.47,0.02],contact:true,hand:'flat',fingers:[0,-0.3,1],palm:[0,-1,0],pole:[s*0.9,-0.4,-0.5],curl:0.2});
const cl=(x,y,z)=>({pos:[x,y,z],anchor:'ankle',pitch:-35,pole:[0.1,1,0.1]});
save('chair-leg-extended-stretch',{az:35,el:16},['hamstrings'],[CH],{
 start:{...croot(),...cfeet(),armL:seatHand(1),armR:seatHand(-1)},
 mid:{...croot(),...cfeet(cl(0.11,0.6,0.78)),armL:seatHand(1),armR:seatHand(-1)},
 end:{...croot(),...cfeet(cl(0.42,0.66,0.7)),armL:seatHand(1),armR:seatHand(-1)}},{muscleSide:'L'});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
