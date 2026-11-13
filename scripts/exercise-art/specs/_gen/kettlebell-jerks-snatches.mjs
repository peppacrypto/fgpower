import fs from 'fs';
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const neg=(v,s)=>s>0?v:[-v[0],v[1],v[2]];
const R0={pos:[0.25,1.44,0.2],f:[0,1,0.12],p:[-0.9,-0.05,-0.45],pole:[0.25,-1,-0.15]};
const R1={pos:[0.25,1.96,0.07],f:[0,1,0.03],p:[-0.5,0,0.87],pole:[0.8,-0.1,-0.3]};
const M={pos:[0.27,1.68,0.16],f:[0,1,0.08],p:[-0.7,-0.02,0.1],pole:[0.55,-0.7,-0.15]};
// hanging / swing grips (from kettlebell-swings-and-passes)
const th=t=>{const r=t*Math.PI/180;return {f:[0,-Math.cos(r),Math.sin(r)],p:[0,-Math.sin(r),-Math.cos(r)]};};
const arm=(s,o)=>({pos:neg(o.pos,s),contact:true,fingers:neg(o.f,s),palm:neg(o.p,s),curl:0.85,pole:neg(o.pole,s)});
const rk=(s,t,d=[0,0,0])=>arm(s,{pos:lerp(R0.pos,R1.pos,t).map((v,i)=>v+d[i]),f:lerp(R0.f,R1.f,t),p:lerp(R0.p,R1.p,t),pole:lerp(R0.pole,R1.pole,t)});
const mid=(s,d=[0,0,0])=>arm(s,{...M,pos:M.pos.map((v,i)=>v+d[i])});
const hg=(s,x,y,z,a,pole)=>{const q=th(a);return arm(s,{pos:[x,y,z],f:q.f,p:q.p,pole});};
const PULL=s=>arm(s,{pos:[0.24,1.3,0.26],f:[0,0.9,0.35],p:[-0.85,0.05,-0.5],pole:[0.4,-1,-0.1]});
const HM=(s,x=0.2,y=1.0,z=0.36)=>arm(s,{pos:[x,y,z],f:[0,0.5,0.85],p:[-0.8,0.3,-0.2],pole:[0.5,-0.8,-0.4]});
const H2=(s,x,y,z,a,k,pole=[0.5,-0.8,-0.4])=>{const q=th(a);const v=[q.p[0]*(1-k)-k,q.p[1]*(1-k),q.p[2]*(1-k)];const n=Math.hypot(...v);return arm(s,{pos:[x,y,z],f:q.f,p:v.map(c=>c/n),pole});};
const free={fk:{flex:0,abd:12,elbow:12},curl:0.3};
const wide=()=>({legL:{pos:[0.2,0,0.02],anchor:'sole',yaw:14,pitch:0,pole:[0.3,0,1]},legR:{pos:[-0.2,0,0.02],anchor:'sole',yaw:-14,pitch:0,pole:[-0.3,0,1]}});
const stand=()=>wide();
const split=(f=0.4,b=-0.28)=>({legL:{pos:[0.13,0,f],anchor:'sole',yaw:5,pitch:0,pole:[0.05,0,1]},legR:{pos:[-0.13,0,b],anchor:'ball',yaw:-5,pitch:0,pole:[-0.05,0,1]}});
const STAND={root:{pos:[0,0.925,0]},neck:{flex:0}};
const DIP=(y,z=-0.03)=>({root:{pos:[0,y,z],pitch:4},neck:{flex:0}});
const dd=(y,z=-0.03)=>[0,y-0.925,z];
const fr=(b,legs,L,R)=>({...b,...legs,armL:L,armR:R});
const out={};
const mk=(slug,cam,props,frames,extra={})=>{out[slug]={slug,camera:cam,muscles:['shoulders','quadriceps','triceps'],...extra,props,frames};};
const P1=[{type:'kettlebell',hand:'L',kg:16,mode:'rack'}];
const P2=[{type:'kettlebell',hand:'L',kg:16,mode:'rack'},{type:'kettlebell',hand:'R',kg:16,mode:'rack'}];
const one=(b,legs,L)=>fr(b,legs,L,free);
const two=(b,legs,f)=>fr(b,legs,f(1),f(-1));
const dip=0.80, dipd=dd(dip);
// ---- one-arm ----
const cam1={az:55,el:6};
mk('one-arm-kettlebell-push-press',cam1,P1,{
  start:one(STAND,stand(),rk(1,0)),
  mid:one(DIP(dip),wide(),rk(1,0,dipd)),
  mid2:one({root:{pos:[0,0.925,0.0],pitch:-2},neck:{flex:0}},wide(),mid(1)),
  end:one(STAND,stand(),rk(1,1))},{muscleSide:'L'});
mk('one-arm-kettlebell-jerk',cam1,P1,{
  start:one(STAND,stand(),rk(1,0)),
  mid:one(DIP(dip),wide(),rk(1,0,dipd)),
  mid2:one({root:{pos:[0,0.925,0.0],pitch:-2},neck:{flex:0}},wide(),mid(1,[0,0.02,0])),
  mid3:one(DIP(0.84),wide(),rk(1,0.9,dd(0.84))),
  end:one(STAND,stand(),rk(1,1))},{muscleSide:'L'});
mk('one-arm-kettlebell-split-jerk',cam1,P1,{
  start:one(STAND,stand(),rk(1,0)),
  mid:one(DIP(dip),wide(),rk(1,0,dipd)),
  mid2:one({root:{pos:[0,0.925,0.0],pitch:-2},neck:{flex:0}},wide(),mid(1,[0,0.02,0])),
  mid3:one({root:{pos:[0,0.8,0.03],pitch:0},neck:{flex:0}},split(),rk(1,0.85,[0,-0.1,0.03])),
  end:one(STAND,stand(),rk(1,1))},{muscleSide:'L',camera:{az:80,el:6}});
out['one-arm-kettlebell-split-jerk'].camera={az:80,el:6};
const HR={root:{pos:[0,0.8,-0.27],pitch:52},neck:{flex:-30}};
const MD={root:{pos:[0,0.86,-0.12],pitch:25},neck:{flex:-14}};
mk('one-arm-kettlebell-clean-and-jerk',cam1,P1,{
  start:one(STAND,stand(),hg(1,0.27,0.88,0.12,5,[0.5,-1,-0.3])),
  mid:one({root:{pos:[0,0.925,0.0],pitch:-2},neck:{flex:0}},wide(),H2(1,0.28,1.2,0.3,110,0.5)),
  mid2:one(STAND,stand(),rk(1,0)),
  mid3:one(DIP(dip),wide(),rk(1,0,dipd)),
  end:one(STAND,stand(),rk(1,1))},{muscleSide:'L'});
mk('one-arm-kettlebell-snatch',cam1,P1,{
  start:one(HR,wide(),hg(1,0.08,0.64,0.2,5,[0.1,0,-1])),
  mid:one({root:{pos:[0,0.9,-0.02],pitch:0},neck:{flex:0}},wide(),H2(1,0.2,1.0,0.36,70,0)),
  mid2:one({root:{pos:[0,0.925,0.0],pitch:-2},neck:{flex:0}},wide(),H2(1,0.24,1.3,0.28,130,0.5)),
  mid3:one({root:{pos:[0,0.93,0],pitch:-2},neck:{flex:0}},wide(),rk(1,0.9,[0,-0.02,0.03])),
  end:one(STAND,stand(),rk(1,1))},{muscleSide:'L'});
mk('one-arm-kettlebell-split-snatch',{az:80,el:6},P1,{
  start:one(HR,wide(),hg(1,0.08,0.64,0.2,5,[0.1,0,-1])),
  mid:one({root:{pos:[0,0.9,-0.02],pitch:0},neck:{flex:0}},wide(),H2(1,0.2,1.0,0.36,70,0)),
  mid2:one({root:{pos:[0,0.925,0.0],pitch:-2},neck:{flex:0}},wide(),H2(1,0.24,1.3,0.28,130,0.5)),
  mid3:one({root:{pos:[0,0.8,0.03],pitch:0},neck:{flex:0}},split(),rk(1,0.85,[0,-0.1,0.03])),
  end:one(STAND,stand(),rk(1,1))},{muscleSide:'L'});
// ---- two-arm ----
const cam2={az:40,el:6};
const dbl=(slug,frames)=>mk(slug,cam2,P2,frames);
const r2=(t,d)=>s=>rk(s,t,d), m2=d=>s=>mid(s,d);
dbl('double-kettlebell-push-press',{
  start:two(STAND,stand(),r2(0)),mid:two(DIP(dip),wide(),r2(0,dipd)),
  mid2:two({root:{pos:[0,0.925,0],pitch:-2},neck:{flex:0}},wide(),m2()),end:two(STAND,stand(),r2(1))});
dbl('double-kettlebell-jerk',{
  start:two(STAND,stand(),r2(0)),mid:two(DIP(dip),wide(),r2(0,dipd)),
  mid2:two({root:{pos:[0,0.925,0],pitch:-2},neck:{flex:0}},wide(),m2([0,0.02,0])),
  mid3:two(DIP(0.84),wide(),r2(0.9,dd(0.84))),end:two(STAND,stand(),r2(1))});
dbl('two-arm-kettlebell-jerk',{
  start:two(STAND,stand(),r2(0)),mid:two(DIP(dip),wide(),r2(0,dipd)),
  mid2:two({root:{pos:[0,0.925,0],pitch:-2},neck:{flex:0}},wide(),m2([0,0.02,0])),
  mid3:two(DIP(0.82),wide(),r2(0.9,dd(0.82))),end:two(STAND,stand(),r2(1))});
const back=s=>hg(s,0.12,0.6,0.1,10,[0.3,-0.5,-1]);
dbl('double-kettlebell-snatch',{
  start:two(HR,wide(),back),
  mid:two({root:{pos:[0,0.9,-0.02],pitch:0},neck:{flex:0}},wide(),x=>H2(x,0.2,1.0,0.36,70,0)),
  mid2:two({root:{pos:[0,0.925,0],pitch:-2},neck:{flex:0}},wide(),x=>H2(x,0.24,1.3,0.28,130,0.5)),
  mid3:two({root:{pos:[0,0.93,0],pitch:-2},neck:{flex:0}},wide(),r2(0.9,[0,-0.02,0.03])),
  end:two(STAND,stand(),r2(1))});
for(const [k,v] of Object.entries(out)) fs.writeFileSync(new URL(`../${k}.json`,import.meta.url),JSON.stringify(v,null,1));
console.log(Object.keys(out).length);
