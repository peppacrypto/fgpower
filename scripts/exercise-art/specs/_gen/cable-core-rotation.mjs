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
save('standing-cable-wood-chop',{az:-55,el:8},['abdominals','obliques'],[tower(2.0,'d-handle',{pos:[0.8,0,0.5]})],{
 start:{...trunk(0.9,-2,28,0.24),...fkA(150,AB,5)},
 end:{...trunk(0.85,12,-32,0.24),...fkA(35,AB,5)}});
const fk1=(fl,el)=>({...fkA(fl,AB,el),armR:{fk:{flex:fl*0.5,abd:30,rot:0,elbow:25},rel:'chest',hand:'relaxed'}});
save('standing-cable-lift',{az:-35,el:8},['abdominals','obliques'],[tower(0.2,'d-handle',{hand:'L',hands:undefined,pos:[0.8,0,0.2]})],{
 start:{...trunk(0.87,10,28,0.24),...fk1(25,8)},mid:{...trunk(0.89,6,0,0.24),...fk1(85,8)},
 end:{...trunk(0.91,-2,-35,0.24),...fk1(150,8)}},{tempo:{lift:'there'}});
save('cable-judo-flip',{az:-55,el:8},['abdominals','obliques'],[tower(0.2,'rope')],{
 start:{...trunk(0.84,12,25,0.34),...fkA(40,AB,10)},
 mid:{...trunk(0.85,8,-5,0.34),...fkA(70,AB,50)},
 end:{...trunk(0.86,4,-42,0.34),...fkA(100,AB,70)}});
// Russian twists seated on the ball, torso leaned back, feet planted, arms long at chest height, rotate each way
const ru=(tw)=>({root:{pos:[0,0.47,0.0],pitch:-35},spine:{flex:4,twist:tw},neck:{flex:6},
 armL:{fk:{flex:55,abd:0,rot:0,elbow:0},rel:'chest',hand:'grip'},armR:{fk:{flex:55,abd:0,rot:0,elbow:0},rel:'chest',hand:'grip'},
 legL:{pos:[0.2,0,0.45],anchor:'sole',pole:[0.2,0.5,1]},legR:{pos:[-0.2,0,0.45],anchor:'sole',pole:[-0.2,0.5,1]}});
save('cable-russian-twists',{az:-40,el:10},['abdominals','obliques'],[{type:'stability-ball',pos:[0,0,-0.02],radius:0.325,load:0.6},tower(1.5,'d-handle',{pos:[0.8,0,0.3]})],{
 start:ru(40),end:ru(-45)});
// One-arm high-pulley side bend: handle at shoulder, bend away from the tower
const sb=(side)=>({...stand({y:0.92,side,lx:0.1,rx:0.1,pitch:0,sf:0}),spine:{flex:0,twist:0,side,weights:[0.3,0.3,0.2,0.1,0.1]},
 armL:{fk:{flex:5,abd:20,rot:0,elbow:145},rel:'chest',hand:'grip'},
 armR:{fk:{flex:0,abd:12,rot:0,elbow:12},rel:'chest',hand:'relaxed'}});
save('one-arm-high-pulley-cable-side-bends',{az:8,el:4},['obliques','abdominals'],[tower(2.0,'d-handle',{hand:'L',hands:undefined})],{
 start:sb(0),end:sb(28)},{qaAllow:{'rom:trunk-flexion.range':'lateral flexion (side bend), not a sagittal crunch: the pattern table has no side-bend entry'}});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
