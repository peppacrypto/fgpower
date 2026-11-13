import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,muscles,props,frames,more={})=>{out[slug]={slug,camera,muscles,props,frames,...more};};
const rad=d=>d*Math.PI/180, r4=v=>v.map(x=>+x.toFixed(4));
const nrm=v=>{const l=Math.hypot(...v);return v.map(x=>x/l);};
const MR=['middle-back','lats','biceps'];
// ---- supine body pivoting on the heels (theta = body angle above horizontal)
const sup=(th,zh,y0=0.06)=>{const s=Math.sin(rad(th)),c=Math.cos(rad(th));
 const root=[0,y0+0.87*s,zh-0.86*c];const d=[0,s,-c],n=[0,c,s];
 const sh=[0,root[1]+0.46*s,root[2]-0.46*c];
 return {root,d,n,sh,P:th-90};};
const legsHeel=(P,zh)=>({legL:{pos:[0.11,0,zh],anchor:'heel',pitch:P,toes:P,pole:[0.1,0.3,1]},legR:{pos:[-0.11,0,zh],anchor:'heel',pitch:P,toes:P,pole:[-0.1,0.3,1]}});
const body=(b,zh,nk,arms)=>({root:{pos:r4(b.root),pitch:b.P},neck:{flex:nk},...arms,...legsHeel(b.P,zh)});
// ---- strap row: hands carried on straps from one anchor
function strapRow(slug,ths,the,cam,zh=0.5,more={}){
 const a=sup(ths,zh),b=sup(the,zh);
 const hs=[0.17,a.sh[1]+(+(process.env.OFF||more.off||0.63)),a.sh[2]];const SP=process.env.SP?JSON.parse(process.env.SP):[0.1,-1,0.2];
 const HX=+(process.env.HX||0.1);const he=[HX,b.sh[1]+(+process.env.EO||0.26)*b.n[1],b.sh[2]+(+process.env.EO||0.26)*b.n[2]];
 const m=sup((ths+the)/2,zh),hm=[HX,m.sh[1]+(+process.env.MF||more.mf||0.36)*m.n[1],m.sh[2]+(+process.env.MF||more.mf||0.36)*m.n[2]];
 const ay=+(process.env.AY||more.ay||2.6);const T0=+(process.env.T0||1),T1=+(process.env.T1||1),T2=+(process.env.T2||1);
 const az=(he[1]**2+he[2]**2+he[0]**2-hs[1]**2-hs[2]**2-hs[0]**2-2*ay*(he[1]-hs[1]))/(2*(he[2]-hs[2]));
 const anc=[0,ay,az];
 const arm=(s,h,pole,PT)=>{const f=nrm([-h[0]*0+(anc[0]-s*h[0]),anc[1]-h[1],anc[2]-h[2]]);
  return {pos:r4([s*h[0],h[1],h[2]]),contact:true,fingers:r4([-s*f[0]*0+f[0]*-1*-1*0+(-s*h[0]*0)+ (anc[0]-s*h[0])/Math.hypot(...[anc[0]-s*h[0],anc[1]-h[1],anc[2]-h[2]]),f[1],f[2]]),palm:r4(nrm([-s,PT*(pole[1]>-0.9?1:1),0])),pole:[s*pole[0],pole[1],pole[2]],curl:0.82};};
 const A=(h,p,t)=>({armL:arm(1,h,p,t),armR:arm(-1,h,p,t)});
 const {ay:_a,mf:_m,off:_o,...more2}=more;
 save(slug,cam,MR,[{type:'suspension-trainer',anchor:r4(anc),hands:true,frameIgnore:true}],
  {start:body(a,zh,14,A(hs,SP,T0)),mid:body(m,zh,6,A(hm,process.env.MP?JSON.parse(process.env.MP):[0.3,-1,-0.2],T1)),end:body(b,zh,0,A(he,process.env.EPO?JSON.parse(process.env.EPO):[0.9,-0.1,-0.7],T2))},more2);
 if(process.env.NOMID)delete out[slug].frames.mid;
}
strapRow('suspended-row',+(process.env.S1||50),+(process.env.S2||62),{az:78,el:8},0.5,{tempo:{lift:'there',up:1,down:1.8},ay:3.4,mf:0.42});
strapRow('inverted-row-with-straps',22,42,{az:80,el:8},0.6,{tempo:{lift:'there',up:1,down:1.8}});
// ---- inverted row on a bar in a rack
const bar=(slug,Y,bx,cam)=>{
 const hz=0;let ths=Math.asin((Y-0.62-0.06)/1.33)*180/Math.PI;
 const zh=hz+1.33*Math.cos(rad(ths));
 let best=[1e9,0];
 for(let t=ths;t<85;t+=0.25){const b=sup(t,zh);
  const e=Math.hypot(Y-b.sh[1]-(-0.1*b.d[1]+0.15*b.n[1]),hz-b.sh[2]-(-0.1*b.d[2]+0.15*b.n[2]));if(e<best[0])best=[e,t];}
 console.log(slug,'start',ths.toFixed(1),'end',best[1],'resid',best[0].toFixed(3));
 const a=sup(ths,zh),b=sup(best[1],zh);
 const arm=(s,pole)=>({pos:[s*bx,Y,hz],contact:true,fingers:[0,1,0],palm:[0,0,1],pole:[s*pole[0],pole[1],pole[2]],curl:0.82});
 const A=p=>({armL:arm(1,p),armR:arm(-1,p)});
 save(slug,cam,MR,[{type:'pull-up-bar',height:Y,width:1.2,mount:'rack'}],
  {start:body(a,zh,14,A([1,-0.6,-0.3])),end:body(b,zh,-4,A([1,-0.3,0.2]))});
};
bar('inverted-row',1.1,0.4,{az:60,el:8});
bar('bodyweight-mid-row',+(process.env.MY2||1.0),0.3,{az:85,el:6});
// ---- standing-floor bodies (prone on toes)
const prone=(P,zb,y0=0.12)=>{const s=Math.sin(rad(P)),c=Math.cos(rad(P));
 const root=[0,y0+0.86*c+0.01,zb+0.86*s-0.026];const d=[0,c,s];
 return {root,d,P,sh:[0,root[1]+0.46*c,root[2]+0.46*s]};};
const toes=(P,zb)=>({legL:{pos:[0.1,0,zb],anchor:'ball',pitch:P-8,yaw:0,toes:0},legR:{pos:[-0.1,0,zb],anchor:'ball',pitch:P-8,yaw:0,toes:0}});
const trainerArm=(s,h,anc,pole,u,pal)=>u?({pos:r4([s*h[0],h[1],h[2]]),contact:true,fingers:r4(u),palm:pal||[-s,0,0],pole:[s*pole[0],pole[1],pole[2]],curl:0.82,autoRoll:false}):({pos:r4([s*h[0],h[1],h[2]]),contact:true,fingers:[s*0.12,0,1],palm:[0,-1,0],pole:[s*pole[0],pole[1],pole[2]],curl:0.82});
const trainerArmOld=(s,h,anc,pole)=>{const v=[anc[0]-s*h[0],anc[1]-h[1],anc[2]-h[2]];const l=Math.hypot(...v);
 return {pos:r4([s*h[0],h[1],h[2]]),contact:true,fingers:r4(v.map(x=>x/l)),palm:[-s,0,0],pole:[s*pole[0],pole[1],pole[2]],curl:0.82};};
function bisectAnchor(hs,he,ay){return [0,ay,(he[1]**2+he[2]**2+he[0]**2-hs[1]**2-hs[2]**2-hs[0]**2-2*ay*(he[1]-hs[1]))/(2*(he[2]-hs[2]))];}
// suspended push-up: hands fixed on handles
(function(){
 const PT=+(process.env.PT||62),TP=prone(PT,-0.81),h=[+(process.env.PX||0.32),0.14,TP.sh[2]+(+process.env.PZ||0)],anc=[0,2.4,+(process.env.AZ||1.4)];
 const fr=(P,y,z,nk,pole)=>({root:{pos:[0,y,z],pitch:P},neck:{flex:nk},armL:trainerArm(1,h,anc,pole),armR:trainerArm(-1,h,anc,pole),...toes(P,-0.81)});
 save('suspended-push-up',{az:52,el:5},['chest','triceps'],[{type:'suspension-trainer',anchor:anc,hands:true,frameIgnore:true}],
  {start:fr(PT,TP.root[1],TP.root[2],-8,[0.4,-0.2,-1]),end:fr(85.543,0.21,0.084,-18,process.env.EP?JSON.parse(process.env.EP):[0.3,0.3,-1])});
})();
// suspended fallout
(function(){
 const zb=-0.5,a=prone(62,zb),b=prone(80,zb),m=prone(71,zb);
 const U=(v)=>nrm(v);
 const us=U([0,-0.95,0.3]),um=U(JSON.parse(process.env.UM||"[0,-0.5,0.85]")),ue=U(process.env.UE?JSON.parse(process.env.UE):[0,0.25,0.97]);
 const H=(q,u)=>[0.2,q.sh[1]+0.5*u[1],q.sh[2]+0.5*u[2]];
 const hs=H(a,us),hm=H(m,um),he=H(b,ue);
 const anc=[0,2.4,+(process.env.FZ||0.8)];
 const fr=(b,h,u,nk,pole,pal0)=>{const pal=r4(nrm([0,-u[2],u[1]]));return {root:{pos:r4(b.root),pitch:b.P},neck:{flex:nk},armL:trainerArm(1,h,anc,pole,u,pal&&pal.map((x,i)=>i?x:-x*0+x)),armR:trainerArm(-1,h,anc,pole,u,pal&&pal.map((x,i)=>i?x:-x)),...toes(b.P,zb)};};
 save('suspended-fallout',{az:70,el:6},['abdominals'],[{type:'suspension-trainer',anchor:r4(anc),hands:true,frameIgnore:true}],
  {start:fr(a,hs,us,-8,[0.4,-0.2,-1]),mid:fr(m,hm,um,-8,[0.4,-0.4,-0.9]),end:fr(b,he,ue,-6,[0.4,-0.6,-0.8],(()=>{const f=+(process.env.PH||0)*Math.PI/180;const q=nrm([0,-ue[2],ue[1]]);return [-Math.sin(f),q[1]*Math.cos(f),q[2]*Math.cos(f)];})())});
})();
// suspended reverse crunch: plank facing away, feet in handles (rig as the gallery)
(function(){
 const g=JSON.parse(fs.readFileSync(W+'_gallery/suspension-feet.json','utf8'));
 delete g.slug;for(const f of Object.values(g.frames))for(const l of ['legL','legR']){f[l].pos[1]+=0.05;f[l].pos[2]+=0.04;f[l].pitch+=30;}g.frames.start.root.pos[1]=+(process.env.SY||0.55);g.frames.start.neck.flex=-3;g.frames.end.neck.flex=-20;const HZ=+(process.env.HZ||0.52),FX=+(process.env.FX||0.12);for(const f of Object.values(g.frames))for(const [l,sg] of [['armL',1],['armR',-1]]){f[l].pos[2]=HZ;f[l].fingers=[sg*FX,0,1];}save('suspended-reverse-crunch',g.camera,g.muscles,g.props,g.frames,{floats:true});
})();
// suspended split squat: rear (right) foot in the handle
(function(){
 const RZ=+(process.env.RZ||-0.5),FZ2=+(process.env.FF||0.1),HZ2=+(process.env.HH||0.1),rear=[-0.12,0.51,RZ],anc=[0,2.25,RZ-0.04];
 const hip={fk:{flex:-35,abd:30,rot:0,elbow:25},rel:'chest'};
 const fr=(y,z,pitch,k)=>({root:{pos:[0,y,z],pitch},neck:{flex:0},armL:hip,armR:hip,
  legL:{pos:[+(process.env.FX2||0.05),0,FZ2],anchor:'sole',pole:[0.05,0.3,1]},
  legR:{pos:rear,anchor:'ankle',pitch:130,pole:[-0.05,-1,0.3]}});
 save('suspended-split-squat',{az:70,el:6},['quadriceps','glutes'],[{type:'suspension-trainer',anchor:anc,feet:'R',frameIgnore:true}],
  {start:fr(+(process.env.Y0||0.92),HZ2,0),end:fr(+(process.env.Y1||0.64),+(process.env.HE||0.04),+(process.env.PE||10))});
})();
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
