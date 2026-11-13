import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,muscles,props,frames,more={})=>{out[slug]={slug,camera,muscles,props,frames,...more};};
const V=(a,b)=>a.map((x,i)=>x+b[i]);
// machine at the figure's LEFT (+X), front toward the figure
const tower=(y,att='d-handle',x={})=>({type:'cable-tower',pos:[+(process.env.TX||0.8),0,+(process.env.TZ||0.4)],yaw:+(process.env.TY||-90),pulleyY:y,attachment:att,hands:true,...x});
const stand=(o={})=>({root:{pos:[0,o.y??0.9,0],pitch:o.pitch??4,yaw:o.yaw??0},spine:{flex:o.sf??4,twist:o.tw??0,side:o.side??0,weights:[0.1,0.2,0.25,0.25,0.2]},neck:{flex:2},
 legL:{pos:[o.lx??0.15,0,o.lz??0],anchor:'sole',yaw:o.lyaw??7},legR:{pos:[-(o.rx??0.15),0,o.rz??0],anchor:'sole',yaw:-(o.ryaw??7)}});
const nrm=v=>{const l=Math.hypot(...v);return v.map(x=>x/l)};
const cr=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const PS=+process.env.PS||1, FS=+process.env.FS||-1;
// two hands gripping one handle: axis perpendicular to the forearm line, hands 4 cm apart along it
const h=(c,pl,pr,sep=0.04,ref=[0,1.35,0],ax)=>{
 const f=nrm(c.map((x,i)=>x-ref[i]));let a=ax?nrm(ax):nrm(cr(f,[1,0,0]));if(a[1]<0)a=a.map(x=>-x);
 const fg=nrm(cr(a,f)).map(x=>x*FS), pm=f.map(x=>x*PS);
 return {armL:{pos:V(c,a.map(v=>v*sep)),hand:'grip',grip:0.015,fingers:fg,palm:pm,pole:pl},
  armR:{pos:V(c,a.map(v=>-v*sep)),hand:'grip',grip:0.015,fingers:fg.map(x=>-x),palm:pm,pole:pr}};};
const hc=(c,pl,pr,sep=0.045,ref=[0,1.35,0])=>{
 const f=nrm(c.map((x,i)=>x-ref[i]));let a=nrm(cr(f,[1,0,0]));if(a[1]<0)a=a.map(x=>-x);
 const pm=nrm(cr(f,[0,1,0])).map(x=>x*PS);
 return {armL:{pos:V(c,a.map(v=>v*sep)),contact:true,curl:0.78,fingers:f,palm:pm,pole:pl},
  armR:{pos:V(c,a.map(v=>-v*sep)),contact:true,curl:0.78,fingers:f,palm:pm.map(x=>-x),pole:pr}};};
const sty={camera:{az:30,el:6}};
// fk arms (rel chest) so the arms turn with the trunk; both hands on one handle
const fkA=(fl,ab,el,ro=0)=>({armL:{fk:{flex:fl,abd:-ab,rot:ro,elbow:el},rel:'chest',hand:'grip'},armR:{fk:{flex:fl,abd:-ab,rot:ro,elbow:el},rel:'chest',hand:'grip'}});
const AB=+process.env.AB||10;
const trunk=(y,sf,tw,w,o={})=>({...stand({y,sf,tw,lx:w,rx:w,lyaw:15,ryaw:15,...o})});
const ry=(v,t)=>{const r=t*Math.PI/180,c=Math.cos(r),n=Math.sin(r);return [v[0]*c+v[2]*n,v[1],-v[0]*n+v[2]*c];};
// hands at reach r (m from the chest centre), height y, turned with the chest by tw deg
const pg=(tw,r,y)=>{const c=ry([0,0,r],tw);c[1]=y;return {...stand({y:0.89,sf:2,tw}),...h(c,ry([0.6,-1,0.1],tw),ry([-0.6,-1,0.1],tw),0.05,[0,1.4,0],ry([0,0,1],tw))};};
save('pallof-press',{az:50,el:6},['abdominals','obliques'],[tower(1.35)],{
 start:pg(0,0.34,1.28),mid:pg(0,0.48,1.32),end:pg(0,0.6,1.38)});
save('pallof-press-with-rotation',{az:50,el:6},['abdominals','obliques'],[tower(1.35)],{
 start:pg(0,0.34,1.28),mid:pg(-16,0.44,1.31),mid2:pg(-28,0.52,1.34),end:pg(-40,0.58,1.38)});
save('standing-cable-wood-chop',{az:-55,el:8},['abdominals','obliques'],[tower(2.0)],{
 start:{...trunk(0.9,-4,25,0.22),...fkA(150,AB,10)},
 end:{...trunk(0.82,28,-30,0.22),...fkA(55,AB,10)}});
const fk1=(fl,el)=>({...fkA(fl,AB,el),armR:{fk:{flex:fl*0.5,abd:30,rot:0,elbow:25},rel:'chest',hand:'relaxed'}});
save('standing-cable-lift',{az:-55,el:8},['abdominals','obliques'],[tower(0.2,'d-handle',{hand:'L',hands:undefined,pos:[0.8,0,0.2]})],{
 start:{...trunk(0.82,28,25,0.22),...fk1(55,10)},mid:{...trunk(0.86,14,0,0.22),...fk1(100,10)},
 end:{...trunk(0.9,-4,-30,0.22),...fk1(150,10)}});
save('cable-judo-flip',{az:-55,el:8},['abdominals','obliques'],[tower(0.2,'rope')],{
 start:{...trunk(0.8,26,20,0.3),...fkA(45,AB,15)},
 end:{...trunk(0.8,24,-35,0.3),...fkA(75,AB,100)}});
// Russian twists on stability ball, hips up, arms straight above the chest, rotate away
const ru=(tw)=>({root:{pos:[0,0.46,0.28],pitch:-70},spine:{flex:6,twist:tw},neck:{flex:10},
 armL:{fk:{flex:90,abd:0,rot:0,elbow:0},rel:'chest',hand:'grip'},armR:{fk:{flex:90,abd:0,rot:0,elbow:0},rel:'chest',hand:'grip'},
 legL:{pos:[0.15,0,0.85],anchor:'sole',pitch:0,pole:[0.2,0.2,1]},legR:{pos:[-0.15,0,0.85],anchor:'sole',pitch:0,pole:[-0.2,0.2,1]}});
save('cable-russian-twists',{az:70,el:10},['abdominals','obliques'],[{type:'stability-ball',pos:[0,0,0],radius:0.325,load:0.6},tower(1.1,'d-handle',{pos:[0.8,0,0.8]})],{
 start:ru(35),end:ru(-35)});
// One-arm high-pulley side bend: handle at shoulder, bend away from the tower
const sb=(side)=>({...stand({y:0.9,side,lx:0.1,rx:0.1}),
 armL:{fk:{flex:5,abd:20,rot:0,elbow:145},rel:'chest',hand:'grip'},
 armR:{fk:{flex:-5,abd:35,rot:0,elbow:105},rel:'chest',hand:'relaxed'}});
save('one-arm-high-pulley-cable-side-bends',{az:20,el:6},['obliques','abdominals'],[tower(2.0,'d-handle',{hand:'L',hands:undefined})],{
 start:sb(0),end:sb(-22)},{qaAllow:{'rom:trunk-flexion.range':'lateral flexion (side bend), not a sagittal crunch: the pattern table has no side-bend entry'}});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
