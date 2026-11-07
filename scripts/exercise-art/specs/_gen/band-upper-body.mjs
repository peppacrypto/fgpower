import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,muscles,props,frames,more={})=>{out[slug]={slug,camera,muscles,props,frames,...more};};
const legs=(z=0.03)=>({legL:{pos:[0.11,0,z],anchor:'sole',yaw:8,pitch:0,pole:[0.1,0,1]},legR:{pos:[-0.11,0,z],anchor:'sole',yaw:-8,pitch:0,pole:[-0.1,0,1]}});
const stand=(z=0,extra={})=>({root:{pos:[0,0.925,z],...extra},...legs(z+0.03)});
const arm=(s,p,f,pa,pole,curl=0.85)=>({pos:[s*p[0],p[1],p[2]],contact:true,fingers:[s*f[0],f[1],f[2]],palm:[s*pa[0],pa[1],pa[2]],curl,pole:[s*pole[0],pole[1],pole[2]]});
const fk=(f,a,r,e,hand)=>({armL:{fk:{flex:f,abd:a,rot:r,elbow:e},rel:'chest',hand:hand||'relaxed'},armR:{fk:{flex:f,abd:a,rot:r,elbow:e},rel:'chest',hand:hand||'relaxed'}});
const both=(p,f,pa,pole,curl)=>({armL:arm(1,p,f,pa,pole,curl),armR:arm(-1,p,f,pa,pole,curl)});
const feetTube=(rest)=>[{type:'band-tube',hands:true,via:[{foot:'L',edge:'out'},{foot:'L',edge:'in'},{foot:'R',edge:'in'},{foot:'R',edge:'out'}],rest}];
// pull apart: gallery
save('band-pull-apart',{az:18,el:8},['posterior-deltoid','rhomboids'],
 [{type:'band',hands:true,a:{hand:'L',r:0.007,axis:[0,1,0]},b:{hand:'R',r:0.007,axis:[0,1,0]},width:0.032,rest:0.42}],{
 start:{...stand(0),...both([0.23,1.37,0.63],[0,0.02,1],[0,-1,0.02],[0.4,-0.8,-0.4])},
 end:{...stand(0),...both([0.73,1.38,0.24],[1,0.02,0.1],[0,-1,0.02],[0,-1,-0.5])}});
// upright row
save('upright-row-with-bands',{az:30,el:6},['traps','lateral-deltoid'],feetTube(1.9),{
 start:{...stand(),...fk(5,8,0,15)},
 end:{...stand(),...fk(25,75,0,125)}});
// lateral raise
save('lateral-raise-with-bands',{az:25,el:6},['lateral-deltoid'],feetTube(1.9),{
 start:{...stand(),...fk(0,10,0,15)},
 end:{...stand(),...fk(0,88,0,20)}});
// shoulder press
save('shoulder-press-with-bands',{az:30,el:6},['shoulders','triceps'],feetTube(1.9),{
 start:{...stand(),...both([0.34,1.57,0.08],[0,1,0.1],[0,-0.05,1],[1,-0.6,0.1])},
 mid:{...stand(),...both([0.27,1.8,0.06],[0,1,0.08],[0,-0.02,1],[0.5,-0.8,0.2])},
 end:{...stand(),...both([0.22,2,0.04],[0,1,0.05],[0,0,1],[1,-0.3,0.1])}});
// post work
const postBands=(pz)=>[{type:'anchor-post',pos:[0,0,pz-0.06],yaw:0,bandY:1.38},
 {type:'band',follow:'pelvis',a:[0,1.38,pz],b:{hand:'L'},rest:0.5,width:0.022},
 {type:'band',follow:'pelvis',a:[0,1.38,pz],b:{hand:'R'},rest:0.5,width:0.022}];
save('back-flyes-with-bands',{az:50,el:10},['posterior-deltoid','rhomboids'],postBands(1.5),{
 start:{...stand(-0.1),...both([0.12,1.38,0.5],[0,0.02,1],[0,-1,0.02],[0.4,-0.8,-0.4])},
 end:{...stand(-0.1),...both([0.62,1.38,0.2],[1,0.02,0.1],[0,-1,0.02],[0,-1,-0.5])}});
save('cross-over-with-bands',{az:40,el:8},['chest'],postBands(-1.2),{
 start:{...stand(0),...both([0.62,1.4,0.05],[1,0,0.2],[0,-1,0],[0.3,-0.6,-1])},
 end:{...stand(0),...both([0.1,1.25,0.52],[0,0.02,1],[0,-1,0.02],[0.5,-0.8,-0.3])}});
// bench
const bench=(z=0.2)=>({root:{pos:[0,0.532,z],pitch:-90},legL:{pos:[0.2,0,0.72],anchor:'sole',yaw:6},legR:{pos:[-0.2,0,0.72],anchor:'sole',yaw:-6}});
const benchTube=(x)=>[{type:'flat-bench',height:0.44},
 {type:'band-tube',hand:'L',via:[{pos:[0.18,0.04,-0.6]}],rest:1.0},
 {type:'band-tube',hand:'R',via:[{pos:[-0.18,0.04,-0.6]}],rest:1.0}];
save('bench-press-with-bands',{az:40,el:5},['chest','triceps'],benchTube(),{
 start:{...bench(),...both([0.2,0.78,-0.17],[-0.5,0.45,-0.75],[0,0.85,0.5],[1,-0.5,0.2])},
 end:{...bench(),...both([0.2,1.1,-0.24],[-0.5,0.45,-0.75],[0,0.85,0.5],[1,-0.2,0.2])}});
save('band-skull-crusher',{az:60,el:6},['triceps'],benchTube(),{
 start:{...bench(),...both([0.14,0.9,-0.52],[-0.5,0.45,-0.75],[0,0.85,0.5],[1,0.2,0.2])},
 end:{...bench(),...both([0.14,1.1,-0.26],[-0.5,0.45,-0.75],[0,0.85,0.5],[1,-0.2,0.2])}});
// overhead triceps
save('speed-band-overhead-triceps',{az:70,el:6},['triceps'],feetTube(1.9),{
 start:{...stand(),...fk(125,15,0,140)},
 end:{...stand(),...fk(160,10,0,8)}});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
