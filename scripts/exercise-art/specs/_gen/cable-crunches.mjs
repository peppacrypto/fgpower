import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,props,frames,more={})=>{out[slug]={slug,camera,muscles:['abdominals'],props,frames,...more};};
const ROT=+process.env.ROT||-30;const rotf=f=>{const a=ROT*Math.PI/180,c=Math.cos(a),n=Math.sin(a);return [f[0],f[1]*c-f[2]*n,f[1]*n+f[2]*c];};
let DX=0.05;const hand=(s,p,f,pa,pole)=>({pos:[s*(p[0]+DX),p[1],p[2]],contact:true,fingers:(f=rotf(f),[s*f[0],f[1],f[2]]),palm:[s*pa[0],pa[1],pa[2]],curl:0.78,pole:[s*pole[0],pole[1],pole[2]]});
const both=(p,f,pa,pole)=>({armL:hand(1,p,f,pa,pole),armR:hand(-1,p,f,pa,pole)});
const tower=(y,yaw,z,att='rope',x={hands:true})=>({type:'cable-tower',pos:[0,0,z],yaw,pulleyY:y,attachment:att,...x});
// kneeling
const kn=(z,pitch,sf,nf,hipz=0)=>({root:{pos:[0,0.5,z],pitch},spine:{flex:sf,weights:[0,0.1,0.25,0.3,0.35]},neck:{flex:nf},
 legL:{pos:[0.12,0.2,z-0.37],anchor:'ankle',pole:[0,-1,0],pitch:80},legR:{pos:[-0.12,0.2,z-0.37],anchor:'ankle',pole:[0,-1,0],pitch:80}});
const kt=[tower(2,180,0.66)];
const ropeBeside=[0.1,0.9,0.5],ropeUp=[0.1,0.9,0.5];
save('cable-crunch',{az:60,el:8},kt,{
 start:{...kn(-0.25,-4,-6,-6),...both([0.13,1.3,0.22],[0,0.3,0.95],[-1,0,0],[0.4,-1,-0.3])},
 end:{...kn(-0.25,22,42,20),...both([0.13,0.95,0.38],[0,0.3,0.9],[-1,0,0],[0.4,-1,-0.3])}});
save('rope-crunch',{az:60,el:8},kt,{
 start:{...kn(-0.25,0,0,0),...both([0.08,1.38,0.2],[0,0.3,0.95],[-1,0,0],[0.4,-1,-0.3])},
 end:{...kn(-0.25,22,42,20),...both([0.13,0.95,0.38],[0,0.3,0.9],[-1,0,0],[0.4,-1,-0.3])}});
save('kneeling-cable-crunch-with-alternating-oblique-twists',{az:50,el:20},kt,{
 start:{...kn(-0.25,-2,-4,-4),...both([0.15,1.3,0.2],[0,0.3,0.95],[-1,0,0],[0.4,-1,-0.3])},
 mid:{...kn(-0.25,20,36,16),spine:{flex:36,twist:-28,weights:[0,0.1,0.25,0.3,0.35]},...both([0.2,0.98,0.34],[0,0.3,0.95],[-1,0,0],[0.4,-1,-0.3])},
 end:{...kn(-0.25,20,36,16),spine:{flex:36,twist:28,weights:[0,0.1,0.25,0.3,0.35]},...both([0.2,0.98,0.34],[0,0.3,0.95],[-1,0,0],[0.4,-1,-0.3])}});
// standing, back to tower
const stn=(pitch,sf,nf)=>({root:{pos:[0,0.92,0],pitch},spine:{flex:sf,weights:[0,0.1,0.25,0.3,0.35]},neck:{flex:nf},
 legL:{pos:[0.15,0,0],anchor:'sole',yaw:6},legR:{pos:[-0.15,0,0],anchor:'sole',yaw:-6}});
const bt=[tower(+process.env.PY||2,0,+process.env.TZ||-0.85)];
const SR=(process.env.SR||'0.26,0.18,0.1').split(',').map(Number);
const sh=()=>{const h=(sd)=>({pos:[sd*SR[0],SR[1],SR[2]],rel:'chest',contact:true,fingers:[-sd*(-0.3),0.8,0.2],palm:[-sd*0.9,0,+process.env.PZ||-0.2],curl:0.78,pole:[sd*0.5,-1,+0.4]});return {armL:h(1),armR:h(-1)};};
save('standing-rope-crunch',{az:115,el:8},bt,{
 start:{...stn(-4,-2,-4),...sh()},
 end:{...stn(18,40,18),...sh()}});
// seated on flat bench, back to the pulley
const sb=(pitch,sf,nf)=>({root:{pos:[0,0.54,0],pitch},spine:{flex:sf,weights:[0,0.1,0.25,0.3,0.35]},neck:{flex:nf},
 legL:{pos:[0.15,0,0.55],anchor:'sole',yaw:6},legR:{pos:[-0.15,0,0.55],anchor:'sole',yaw:-6}});
const sp=[{type:'flat-bench',pos:[0,0,-0.25]},tower(2,0,-0.95)];
DX=-0.03;save('cable-seated-crunch',{az:115,el:8},sp,{
 start:{...sb(-8,-6,-4),...both([0.14,1.3,0.26],[0,0.3,0.95],[-1,0,0],[0.4,-1,-0.3])},
 end:{...sb(16,38,18),...both([0.18,1.0,0.45],[0,0.3,0.9],[-1,0,0],[0.4,-1,-0.3])}});
// reverse crunch on floor
const P=+process.env.P||-30;const rv=(y,z,kz,ky,sf)=>({root:{pos:[0,y,z],pitch:-90},spine:{flex:sf},neck:{flex:+(process.env.NK??0)},
 legL:{pos:[0.1,ky,kz],anchor:'ankle',pole:[0.2,1,0.3],pitch:P},legR:{pos:[-0.1,ky,kz],anchor:'ankle',pole:[-0.2,1,0.3],pitch:P},
 armL:{fk:{flex:+process.env.AF||120,abd:+process.env.AA||40,rot:0,elbow:+process.env.AE||140},rel:'chest'},armR:{fk:{flex:120,abd:40,rot:0,elbow:140},rel:'chest'}});
DX=0.05;save('cable-reverse-crunch',{az:80,el:12},[tower(0.2,180,1.55,'ankle-strap',{foot:'L'})],{
 start:{...rv(0.12,-0.1,0.55,0.55,0),root:{pos:[0,0.12,-0.1],pitch:-90}},
 end:{...rv(0.15,-0.1,0.3,0.45,14),root:{pos:[0,0.2,-0.05],pitch:-100}}});
// bosu
const bo=(pitch,sf,side)=>({root:{pos:[0,0.3,0.26],pitch},spine:{flex:sf,side,weights:[0,0.15,0.25,0.3,0.3]},neck:{flex:12},
 legL:{pos:[0.25,0,0.74],anchor:'sole',yaw:8,pole:[0.3,0.5,0.7]},legR:{pos:[-0.25,0,0.74],anchor:'sole',yaw:-8,pole:[-0.3,0.5,0.7]}});
const bh=[{type:'bosu',pos:[0,0,0]},tower(0.2,180,1.5,'d-handle')];
const ba=(x,y=0.62,z=0.4)=>both([x,y,z],[0,0,1],[-1,0,0],[0.3,-1,-0.3]);
save('bosu-ball-cable-crunch-with-side-bends',{az:60,el:14},bh,{
 start:{...bo(-78,-14,0),...ba(0.09,+process.env.SY||0.62,+process.env.SZ||0.3)},
 mid:{...bo(-62,34,0),...ba(0.09)},
 end:{...bo(-62,34,18),...ba(0.09)}});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
