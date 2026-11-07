import fs from 'fs';
const R=d=>d*Math.PI/180;
const out=(slug,s)=>fs.writeFileSync(new URL(`../${slug}.json`,import.meta.url),JSON.stringify(s,null,1));
const leg=(s,z=0.74,y=0)=>({pos:[0.22*s,y,z],anchor:'sole',pole:[0.3*s,1,0.3]});
// a = bench angle deg (0 flat), neutral = palms facing
function build(slug,{a=0,neutral=false,prop='flat-bench',bench={},muscles=['chest'],hipY=0.567,hipZ=0.2,x=0.37,px=0.7,pey=-0.5,legZ=0.74,legY=0,one=false,floor=false,cam={az:40,el:8}}){
  const n=[Math.sin(R(a)),Math.cos(R(a))], f=[Math.cos(R(a)),-Math.sin(R(a))]; // (z,y)
  const L=0.5, Sz=hipZ-L*Math.cos(R(a)), Sy=hipY+L*Math.sin(R(a));
  const at=(k,m)=>[Sy+k*n[1]+m*f[1], Sz+k*n[0]+m*f[0]];
  const arm=(s,y,z,pz2)=>({pos:[x*s,y,z],contact:true,hand:'grip',grip:0.014,
    fingers:neutral?[0,n[1],n[0]]:[0.05*s,n[1],n[0]-0.12],
    palm:neutral?[-s,0,0.0]:[0,-n[0]*0.0+(f[1]*0+0.12),0]&&[0,f[1]+0.1,f[0]],
    pole:[px*s,pey,pz2],curl:0.82});
  const frame=(k,m,pz2)=>{const[y,z]=at(k,m);const fr={root:{pos:[0,hipY,hipZ],pitch:-(90-a)},neck:{flex:6},spine:{flex:-4},legL:leg(1,legZ,legY),legR:leg(-1,legZ,legY)};
    fr.armL=arm(1,y,z,pz2); if(!one) fr.armR=arm(-1,y,z,pz2); else fr.armR={pos:[-0.5,hipY+0.1,hipZ-0.15],pole:[-1,-0.5,0.2]};return fr;};
  const dbs=[{type:'dumbbell',kg:15,hand:'L'}]; if(!one)dbs.push({type:'dumbbell',kg:15,hand:'R'});
  out(slug,{slug,camera:cam,muscles,floats:true,props:[{type:prop,...bench},...dbs],
    frames:{start:frame(0.54,0.06,-0.1),end:frame(0.13,0.14,0.2)}});
}
const inc={a:30,prop:'incline-bench',bench:{angle:30},hipY:0.53};
build('incline-dumbbell-press',inc);
build('hammer-grip-incline-db-bench-press',{...inc,neutral:true});
build('incline-dumbbell-bench-with-palms-facing-in',{...inc,neutral:true});
build('dumbbell-bench-press',{});
build('dumbbell-bench-press-with-neutral-grip',{neutral:true});
build('one-arm-dumbbell-bench-press',{one:true});
build('decline-dumbbell-bench-press',{a:-20,prop:'decline-bench',hipY:0.73,legZ:0.66,legY:0.3,muscles:['chest']});
// floor press: on the floor, knees bent
{ const slug='dumbbell-floor-press';
  const arm=(s,y,z,px,pz)=>({pos:[0.34*s,y,z],contact:true,hand:'grip',grip:0.014,fingers:[0.05*s,1,-0.12],palm:[0,0.12,1],pole:[px*s,-0.4,pz],curl:0.82});
  const fr=(y,z,px,pz)=>({root:{pos:[0,0.17,0.2],pitch:-90},neck:{flex:6},legL:{pos:[0.15,0,0.62],anchor:'sole',pole:[0.2,1,0.5]},legR:{pos:[-0.15,0,0.62],anchor:'sole',pole:[-0.2,1,0.5]},armL:arm(1,y,z,px,pz),armR:arm(-1,y,z,px,pz)});
  out(slug,{slug,camera:{az:40,el:10},muscles:['triceps'],floats:true,props:[{type:'dumbbell',kg:15,hand:'L'},{type:'dumbbell',kg:15,hand:'R'}],
   frames:{start:fr(0.78,-0.2,0.6,-0.1),end:fr(0.36,-0.22,0.7,0.2)}}); }
// close-grip: dumbbell upright, both palms under top plate, shoulders across bench, hips below
{ const slug='close-grip-dumbbell-press';
  const arm=(s)=>(y)=>({pos:[0,y,-0.045*s],contact:true,fingers:[-1,0,0],palm:[0,1,0.6*s],curl:0.5,pole:[0.2,-1,-1.3*s]});
  const fr=y=>({root:{pos:[0.58,0.485,0],yaw:90,pitch:-85},neck:{flex:6},legL:{pos:[0.95,0,-0.15],anchor:'sole',pole:[0,1,-0.2]},legR:{pos:[0.95,0,0.15],anchor:'sole',pole:[0,1,0.2]},armL:arm(1)(y),armR:arm(-1)(y)});
  out(slug,{slug,camera:{az:40,el:10},muscles:['triceps'],floats:true,props:[{type:'flat-bench'},{type:'dumbbell',kg:20,hold:'goblet',hands:true,dir:[0,1,0]}],
   frames:{start:fr(1.02),end:fr(0.95)}}); }
