import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,muscles,props,frames,more={})=>{out[slug]={slug,camera,muscles,props,frames,floats:true,...more};};
const legs=(k=58,f=12)=>({legL:{fk:{flex:f,abd:2,knee:k},foot:{pitch:28}},legR:{fk:{flex:f,abd:2,knee:k},foot:{pitch:28}}});
const PX=+(process.env.PX??0.9);const bh=(x,y,sp,cv=0.6)=>({armL:{pos:[x,y,0],contact:true,fingers:[1,0,0],palm:[0,-1,0],pole:[PX,0,-1],curl:cv},armR:{pos:[-x,y,0],contact:true,fingers:[-1,0,0],palm:[0,-1,0],pole:[-PX,0,-1],curl:cv}});
const bars=[{type:'parallel-bars',height:1.3,spacing:0.56}];
const fr=(y,p,n,k=58)=>({root:{pos:[0,y,-0.02],pitch:p},neck:{flex:n},...legs(k),...bh(0.28,1.30,0.25)});
// parallel bar dip, support hold
save('parallel-bar-dip',{az:60,el:8},['triceps','chest'],bars,{start:fr(1.46,3,-2),end:fr(1.14,8,-6)});
save('dips-triceps-version',{az:60,el:8},['triceps'],bars,{start:fr(1.46,0,-2),end:fr(1.17,2,-4)});
save('dips-chest-version',{az:60,el:8},['chest'],bars,{start:fr(1.47,14,4),end:fr(1.12,32,14)});
save('parallel-bar-support-hold',{az:60,el:8},['shoulders'],bars,{start:fr(1.39,0,-2,40)});
// rings
const rg=(y,p,n)=>({root:{pos:[0,y,-0.02],pitch:p},neck:{flex:n},...legs(64,14),
 armL:{pos:[0.255,1.22,0.02],contact:true,fingers:[0.28,-0.82,0.5],palm:[-0.8,-0.5,-0.3],pole:[0.25,0,-1],curl:0.82},
 armR:{pos:[-0.255,1.22,0.02],contact:true,fingers:[-0.28,-0.82,0.5],palm:[0.8,-0.5,-0.3],pole:[-0.25,0,-1],curl:0.82}});
save('ring-dips',{az:60,el:8},['triceps','chest'],[{type:'gym-rings',anchorL:[0.3,3,0],anchorR:[-0.3,3,0],hands:true,frameIgnore:true}],{start:rg(1.37,3,-2),end:rg(1.08,9,-6)});
// bench dips: bench behind (-Z), hands on edge
const BZ=-0.45;
const bd=(y,z,p,kn,sh)=>({root:{pos:[0,y,z],pitch:p},neck:{flex:-4},
 legL:{pos:[0.12,0,0.56],anchor:'sole',pitch:0,yaw:4},legR:{pos:[-0.12,0,0.56],anchor:'sole',pitch:0,yaw:-4},
 armL:{pos:[0.2,0.46,-0.3],contact:true,fingers:[0,-0.3,1],palm:[0,-1,0],pole:[0.4,0.2,-1],curl:0.7},
 armR:{pos:[-0.2,0.46,-0.3],contact:true,fingers:[0,-0.3,1],palm:[0,-1,0],pole:[-0.4,0.2,-1],curl:0.7}});
save('bench-dips',{az:70,el:8},['triceps'],[{type:'flat-bench',pos:[0,0,BZ],yaw:90}],{start:bd(0.56,-0.17,-5),end:bd(0.40,-0.14,-5)},{floats:false});
// weighted: feet on second bench, db on lap
const wd=(y,z)=>({root:{pos:[0,y,z],pitch:-5},neck:{flex:-4},
 legL:{pos:[0.14,0.46,0.66],anchor:"heel",pitch:-15,pole:[0.3,1,0]},legR:{pos:[-0.14,0.46,0.66],anchor:"heel",pitch:-15,pole:[-0.3,1,0]},
 armL:{pos:[0.2,0.46,-0.3],contact:true,fingers:[0,-0.3,1],palm:[0,-1,0],pole:[0.4,0.2,-1],curl:0.7},
 armR:{pos:[-0.2,0.46,-0.3],contact:true,fingers:[0,-0.3,1],palm:[0,-1,0],pole:[-0.4,0.2,-1],curl:0.7}});
save('weighted-bench-dip',{az:70,el:8},['triceps'],[{type:'flat-bench',pos:[0,0,BZ],yaw:90},{type:'flat-bench',pos:[0,0,0.66],yaw:90},{type:'dumbbell',kg:20,pos:[0,0.66,0.22],yaw:90}],{start:wd(0.58,-0.17),end:wd(0.40,-0.14)},{floats:false});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
