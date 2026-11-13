import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const rad=Math.PI/180;
// hand frame for forearm along +Z, wrist deflection th (deg, + = fingers up)
const hf=(th,up)=>{const s=Math.sin(th*rad),c=Math.cos(th*rad);
  return {f:[0,s,c],p:up?[0,c,-s]:[0,-c,s]};};
const R=v=>[-v[0],v[1],v[2]];
const hand=(Wp,th,up,side,r=0.014)=>{const {f,p}=hf(th,up);
  const x=side*Wp[0];
  const pos=[x,Wp[1]+0.075*f[1]+0.03*p[1],Wp[2]+0.075*f[2]+0.03*p[2]];
  const m=v=>side>0?v:R(v);
  return {pos,rel:'world',hand:'grip',grip:r,fingers:m(f),palm:m(p)};};
const THR={dn:[-55,25],up:[-50,45]};
// ---- kneeling at bench, bench across (yaw 90), forearms on pad
const BH=0.44;
const kneel=(extra={})=>({root:{pos:[0,0.5,-0.62],pitch:62},spine:{flex:0},neck:{flex:-12},
 legL:{pos:[0.11,0.2,-1.05],anchor:'ankle',pitch:64,yaw:0,pole:[0,-0.4,1]},
 legR:{pos:[-0.11,0.2,-1.05],anchor:'ankle',pitch:64,yaw:0,pole:[0,-0.4,1]},...extra});
const kArms=(th,up,r)=>{const Wp=[0.2,BH+0.065,0.13];
 return {armL:{...hand(Wp,th,up,1,r),pole:[0.2,1,-0.3]},armR:{...hand(Wp,th,up,-1,r),pole:[-0.2,1,-0.3]}};};
const bench=[{type:'flat-bench',yaw:90,pos:[0,0,0]}];
const WA={'rom:elbow-flexion':'wrist curl: the forearm is braced on a pad or the thigh and only the wrist moves; the elbow stays fixed at about 90-100 deg on purpose'};
const save=(slug,cam,props,frames,more={})=>{out[slug]={slug,camera:cam,muscles:['forearms'],props,frames,qaAllow:WA,...more};};
const kc={az:80,el:6};
const wc=(slug,up,prop,lo,hi,mid)=>{
 const f=(t)=>({...kneel(),...kArms(t,up,prop.r)});
 save(slug,kc,[...bench,...prop.props],{start:f(lo),mid:f(mid),end:f(hi)});};
const BB={props:[{type:'barbell',hands:true}],r:0.014};
const DB={props:[{type:'dumbbell',hand:'L',kg:10},{type:'dumbbell',hand:'R',kg:10}],r:0.016};
wc('palms-down-wrist-curl-over-a-bench',false,BB,-55,25,-15);
wc('palms-up-barbell-wrist-curl-over-a-bench',true,BB,-50,32,-8);
wc('palms-down-dumbbell-wrist-curl-over-a-bench',false,DB,-55,25,-15);
wc('palms-up-dumbbell-wrist-curl-over-a-bench',true,DB,-50,32,-8);
// ---- seated, forearms on thighs (thigh top y ~0.63, knees z ~0.8)
const sit=(extra={})=>({root:{pos:[0,0.54,0.30],pitch:0},spine:{flex:40},neck:{flex:-12},
 legL:{pos:[0.15,0,0.85],anchor:'sole',pitch:0,yaw:6},legR:{pos:[-0.15,0,0.85],anchor:'sole',pitch:0,yaw:-6},...extra});
const sW=(x,t=-50)=>[x,0.69+0.022*Math.max(0,(t+50)/80),0.80];
const sArms=(th,up,r,both=true)=>{const l={...hand(sW(0.15,th),th,up,1,r),pole:[0.4,-0.3,-0.8]};
 const rr={...hand(sW(0.15,th),th,up,-1,r),pole:[-0.4,-0.3,-0.8]};return {armL:l,armR:rr};};
const sc={az:80,el:6};
const sw=(slug,up,prop,lo,hi,mid)=>{const f=t=>({...sit(),...sArms(t,up,prop.r)});
 save(slug,sc,[{type:'flat-bench'},...prop.props],{start:f(lo),mid:f(mid),end:f(hi)});};
sw('seated-dumbbell-palms-down-wrist-curl',false,DB,-55,25,-15);
sw('seated-dumbbell-palms-up-wrist-curl',true,DB,-50,32,-8);
sw('seated-palms-down-barbell-wrist-curl',false,BB,-55,25,-15);
sw('seated-palm-up-barbell-wrist-curl',true,BB,-50,32,-8);
// one arm (left works, right rests on right thigh)
const one=(slug,up,lo,hi,mid)=>{const f=t=>({...sit(),armL:{...hand(sW(0.15,t),t,up,1,0.016),pole:[0.4,-0.3,-0.8]},
  armR:{pos:[-0.15,0.605,0.62],rel:'world',hand:'flat',contact:true,fingers:[0,0,1],palm:[0,-1,0]}});
 save(slug,sc,[{type:'flat-bench'},{type:'dumbbell',hand:'L',kg:10}],{start:f(lo),mid:f(mid),end:f(hi)},{muscleSide:'L'});};
one('seated-one-arm-dumbbell-palms-down-wrist-curl',false,-55,25,-15);
one('seated-one-arm-dumbbell-palms-up-wrist-curl',true,-50,45,-5);
// ---- seated low pulley, palms up, forearms on thighs
const cable=(slug)=>{const f=t=>({...sit(),...sArms(t,true,0.014)});
 save(slug,{az:70,el:6},[{type:'flat-bench'},{type:'cable-tower',pos:[0,0,2.1],yaw:180,pulleyY:0.2,hands:true,attachment:'ez-attachment'}],{start:f(-50),mid:f(-8),end:f(32)});};
cable('seated-two-arm-palms-up-low-pulley-wrist-curl');
cable('cable-wrist-curl');
// ---- finger curls: standing, palms up, bar rolls to fingertips then closes
const fc=(d,th)=>{const s=Math.sin(th*rad),c=Math.cos(th*rad);const f=[0,-c,s],p=[0,s,c];
 const a=(x)=>({pos:[x,0.82-d*0.04,0.17+d*0.02],rel:'world',hand:'grip',grip:0.014,fingers:x>0?f:R(f),palm:x>0?p:R(p),pole:[x>0?0.3:-0.3,-0.4,-1]});
 return {root:{pos:[0,0.92,0],pitch:2},spine:{flex:0},neck:{flex:-4},legL:{pos:[0.17,0,0.02],anchor:'sole',pitch:0,yaw:6},legR:{pos:[-0.17,0,0.02],anchor:'sole',pitch:0,yaw:-6},armL:a(0.2),armR:a(-0.2)};};
save('finger-curls',{az:60,el:5},[{type:'barbell',hands:true}],{start:fc(1,-20),mid:fc(0.5,-10),end:fc(0,20)},{qaAllow:{'rom:elbow-flexion':'finger curl: arms hang straight and only the fingers move; the elbow does not curl'}});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).length);
