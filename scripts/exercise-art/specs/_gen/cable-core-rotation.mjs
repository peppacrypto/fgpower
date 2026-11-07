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
const h=(c,pl,pr,sep=0.04,ref=[0,1.35,0])=>{
 const f=nrm(c.map((x,i)=>x-ref[i]));let a=nrm(cr(f,[1,0,0]));if(a[1]<0)a=a.map(x=>-x);
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
const pal=(tw,fl,el)=>({...stand({y:0.89,sf:2,tw}),...fkA(fl,AB,el)});
save('pallof-press',{az:50,el:6},['abdominals','obliques'],[tower(1.35)],{
 start:pal(0,45,115),end:pal(0,88,5)});
save('pallof-press-with-rotation',{az:50,el:6},['abdominals','obliques'],[tower(1.35)],{
 start:pal(0,45,115),mid:pal(-8,75,30),end:pal(-30,88,5)});
save('standing-cable-wood-chop',{az:-55,el:8},['abdominals','obliques'],[tower(2.0)],{
 start:{...trunk(0.9,-4,25,0.22),...fkA(150,AB,10)},
 end:{...trunk(0.82,28,-30,0.22),...fkA(55,AB,10)}});
save('standing-cable-lift',{az:-55,el:8},['abdominals','obliques'],[tower(0.2)],{
 start:{...trunk(0.82,28,25,0.22),...fkA(55,AB,10)},
 end:{...trunk(0.9,-4,-30,0.22),...fkA(150,AB,10)}});
save('cable-judo-flip',{az:-55,el:8},['abdominals','obliques'],[tower(0.2,'rope')],{
 start:{...trunk(0.8,26,20,0.3),...fkA(45,AB,15)},
 end:{...trunk(0.8,24,-35,0.3),...fkA(75,AB,100)}});
// Russian twists on stability ball, hips up, arms straight above the chest, rotate away
const ru=(tw)=>({root:{pos:[0,0.46,0.28],pitch:-70},spine:{flex:6,twist:tw},neck:{flex:10},
 armL:{fk:{flex:90,abd:0,rot:0,elbow:0},rel:'chest',hand:'grip'},armR:{fk:{flex:90,abd:0,rot:0,elbow:0},rel:'chest',hand:'grip'},
 legL:{pos:[0.15,0,0.85],anchor:'sole',pitch:0,pole:[0.2,0.2,1]},legR:{pos:[-0.15,0,0.85],anchor:'sole',pitch:0,pole:[-0.2,0.2,1]}});
save('cable-russian-twists',{az:70,el:10},['abdominals','obliques'],[{type:'stability-ball',pos:[0,0,0],radius:0.325,load:0.6},tower(1.0,'d-handle')],{
 start:ru(35),end:ru(-35)});
// One-arm high-pulley side bend: handle at shoulder, bend away from the tower
const sb=(side)=>({...stand({y:0.9,side,lx:0.1,rx:0.1}),
 armL:{fk:{flex:5,abd:20,rot:0,elbow:145},rel:'chest',hand:'grip'},
 armR:{fk:{flex:-5,abd:35,rot:0,elbow:105},rel:'chest',hand:'relaxed'}});
save('one-arm-high-pulley-cable-side-bends',{az:20,el:6},['obliques','abdominals'],[tower(2.0,'d-handle',{hand:'L',hands:undefined})],{
 start:sb(0),end:sb(-22)});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
