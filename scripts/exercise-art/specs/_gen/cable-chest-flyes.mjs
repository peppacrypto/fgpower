import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const nrm=v=>{const l=Math.hypot(...v);return v.map(x=>+(x/l).toFixed(3));};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
// neutral grip: fingers follow shoulder->hand line, palm toward 'pw' (world hint, mirrored), orthogonalised
let FW=0.7;
const arm=(s,p,sh,pw,pole,sag=0.12)=>{const d0=nrm([p[0]-sh[0],p[1]-sh[1]-sag,p[2]-sh[2]]);const d=nrm([d0[0],d0[1],d0[2]+FW]);const h=[s*pw[0],pw[1],pw[2]];const k=dot(h,d);const pa=nrm([h[0]-k*d[0],h[1]-k*d[1],h[2]-k*d[2]]);
 return {pos:[s*p[0],p[1],p[2]],contact:true,fingers:[s*d[0],d[1],d[2]],palm:[pa[0],pa[1],pa[2]],curl:0.82,pole:[s*pole[0],pole[1],pole[2]]};};
const both=(p,sh,pw,pole,sag)=>({armL:arm(1,p,sh,pw,pole,sag),armR:arm(-1,p,sh,pw,pole,sag)});
// single arm: pos with its own shoulder
const out={};
const save=(slug,camera,props,frames,more={})=>{out[slug]={slug,camera,muscles:['chest'],props,frames,...more};};
const xo=(pulleyY,z=0,extra={})=>[{type:'cable-crossover',pos:[0,0,z],hands:true,pulleyY,attachment:'d-handle',...extra}];
const stag=(z,p,sf=6)=>({root:{pos:[0,0.9,z],pitch:p},spine:{flex:sf},neck:{flex:-10},legL:{pos:[0.13,0,z+0.25],anchor:'sole',yaw:5},legR:{pos:[-0.13,0,z-0.25],anchor:'ball',pitch:30,toes:0,yaw:-5}});
const IN=[-1,0,0],DN=[-0.9,-0.4,0],UP=[-0.5,0.85,0];
// shoulders: standing body leans a little; shoulder ~ (0.2, 1.42, z+0.1)
const SH=(z)=>[0.2,1.4,z+0.12];
FW=0.5;save('cable-crossover',{az:35,el:10},xo(2.3),{
 start:{...stag(0.3,18),...both([0.68,1.5,0.3],SH(0.3),[-0.5,-0.6,0.5],[1,-0.4,-0.5])},
 mid:{...stag(0.3,20),...both([0.55,1.11,0.58],SH(0.3),DN,[1,-0.5,-0.8])},
 end:{...stag(0.3,22),...both([0.07,0.98,0.72],SH(0.3),DN,[0.5,-1,-0.3])}});
FW=0;save('low-cable-crossover',{az:35,el:10},xo(0.2),{
 start:{...stag(0.3,15),...both([0.3,0.93,0.36],SH(0.3),[-0.6,0.2,0.8],[0.6,-0.4,-1])},
 end:{...stag(0.3,15),...both([0.07,1.2,0.68],SH(0.3),UP,[1,-0.6,-0.5])}});
FW=0.5;save('single-arm-cable-crossover',{az:35,el:10},xo(2.3),{
 start:{...stag(0.3,22),...both([0.07,1.0,0.72],SH(0.3),[-0.9,-0.2,0.3],[0.5,-1,-0.3])},
 mid:{...stag(0.3,21),armL:arm(1,[0.07,1.0,0.72],SH(0.3),DN,[0.5,-1,-0.3]),armR:arm(-1,[0.52,1.12,0.56],[0.2,1.4,0.42],[-0.9,-0.2,0.3],[1,-0.5,-0.5])},
 end:{...stag(0.3,20),armL:arm(1,[0.07,1.0,0.72],SH(0.3),DN,[0.5,-1,-0.3]),armR:arm(-1,[0.58,1.46,0.34],[0.2,1.4,0.42],[-0.9,-0.2,0.3],[1,-0.4,-0.5])}});
const up=(z)=>({root:{pos:[0,0.92,z],pitch:2},spine:{flex:0},neck:{flex:-2},legL:{pos:[0.13,0,z],anchor:'sole',yaw:5},legR:{pos:[-0.13,0,z],anchor:'sole',yaw:-5}});
FW=0.7;save('cable-iron-cross',{az:20,el:8},xo(2.0),{
 start:{...up(0.12),...both([0.7,1.5,0.12],[0.2,1.45,0.12],[0,-1,0],[1,-0.3,-1],0.02)},
 end:{...up(0.12),...both([0.3,0.85,0.12],[0.2,1.45,0.12],[-1,0,0],[1,-0.2,-1],0.02)}});
FW=0.7;save('standing-cable-chest-press',{az:60,el:8},xo(1.4),{
 start:{...stag(0.4,6,2),...both([0.32,1.3,0.7],SH(0.4),[-1,0,-0.3],[1,-0.2,0.4],0.0)},
 end:{...stag(0.4,8,2),...both([0.1,1.38,0.9],SH(0.4),IN,[0.6,-1,-0.2],0.05)}});
const inc=()=>({root:{pos:[0,0.542,0.0556],pitch:-60},neck:{flex:6},legL:{pos:[0.21,0,0.62],anchor:'sole',pole:[0.15,0.4,1]},legR:{pos:[-0.21,0,0.62],anchor:'sole',pole:[-0.15,0.4,1]}});
const ISH=[0.2,0.8,-0.3];
FW=0;save('incline-cable-flye',{az:50,el:12},[{type:'incline-bench',angle:30},...xo(0.2,0.1)],{
 start:{...inc(),...both([0.62,0.8,-0.2],ISH,UP,[1,-0.5,0.6])},
 end:{...inc(),...both([0.07,1.3,-0.15],ISH,[-1,0,0],[1,-0.7,-0.3],0.0)}});
const flat=()=>({root:{pos:[0,0.532,0.2],pitch:-90},neck:{flex:0},legL:{pos:[0.2,0,0.72],anchor:'sole'},legR:{pos:[-0.2,0,0.72],anchor:'sole'}});
const FSH=[0.2,0.62,-0.26];
FW=0;save('flat-bench-cable-flyes',{az:40,el:14},[{type:'flat-bench'},...xo(0.2,-0.38)],{
 start:{...flat(),...both([0.66,0.58,-0.26],FSH,[0,1,0],[1,-0.4,0.6],0.0)},
 end:{...flat(),...both([0.07,1.12,-0.24],FSH,[-1,0.2,0],[1,-0.7,-0.2],0.0)}});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
