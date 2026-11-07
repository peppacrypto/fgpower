import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,muscles,frames,more={})=>{out[slug]={slug,camera,muscles,frames,...more};};
const r=(x)=>Math.round(x*1000)/1000, D=Math.PI/180;
// body from shoulder-centre (z,y) and foot ball (z,y): straight line, hip 0.46 behind shoulder along torso
const body=(shz,shy,fz,fy,extra={})=>{const p=Math.atan2(shz-fz,shy-fy)/D+6;
 return {pos:[extra.x||0,r(shy-0.46*Math.cos(p*D)),r(shz-0.46*Math.sin(p*D))],pitch:r(p),...(extra.yaw?{yaw:extra.yaw}:{}),...(extra.roll?{roll:extra.roll}:{})};};
const Hf=(s,x,y,z,pole,fx=0.12,pa=0)=>({pos:[s*x,y,z],contact:true,fingers:[s*fx,0,1],palm:[s*pa,-1,0],curl:-0.3,pole:[s*pole[0],pole[1],pole[2]]});
const Hg=(s,x,y,z,pole)=>({pos:[s*x,y,z],grip:0.0165,fingers:[0,0,1],palm:[0,-1,0],pole:[s*pole[0],pole[1],pole[2]]});
const Fe=(x,z,y=0,pitch=66,pl=[0,0,1])=>({legL:{pos:[x,r(y+0.012),z],anchor:'ball',pitch,toes:0,pole:[0.05,pl[1],pl[2]]},legR:{pos:[-x,r(y+0.012),z],anchor:'ball',pitch,toes:0,pole:[-0.05,pl[1],pl[2]]}});
const UP=[0.7,0.4,-0.5], DN=[0.5,0.6,-0.6], DNin=[0.35,0.6,-0.7];
// 1 archer: keep existing hand-tuned spec
out['archer-push-up']=JSON.parse(fs.readFileSync(W+'archer-push-up.json'));
// 2 isometric wipers: shift to one side, elbow of that side bends; hands just outside shoulders
{const hx=0.28,z=0.5,sh=(sx,lo)=>{ // sx: body shift toward +x; lo: left lowered
  const shy=0.52;return {L:shy-(lo>0?0.2:0),R:shy-(lo<0?0.2:0)};};
 const fr=(k)=>{const lo=k; const yL=lo>0?0.33:0.52,yR=lo<0?0.33:0.52,m=(yL+yR)/2;
  const b=body(z-0.03,m,-0.72,0,{x:lo*0.1,roll:-lo*7});
  return {root:b,neck:{flex:-18},armL:Hf(1,hx,0,z,lo>0?DN:UP),armR:Hf(-1,hx,0,z,lo<0?DN:UP),...Fe(0.12,-0.72,0.02)};};
 save('isometric-wipers',{az:30,el:8},['chest','triceps'],{start:fr(1),mid:fr(0),end:fr(-1)});
 // centre frame is mid; fix its shoulder heights
 out['isometric-wipers'].frames.mid=fr(0);}
// 3 single-arm push-up
{const z=0.5,hx=0.2;
 const fr=(low)=>({root:body(z-0.03,low?0.29:0.52,-0.72,0,{x:0.07,yaw:low?6:0,roll:low?-5:-3}),neck:{flex:-18},
  armL:Hf(1,hx,0,z,low?[0.0,0.6,-0.8]:[0.2,0.4,-0.6],0.05,-0.25),
  armR:{fk:{flex:-35,abd:15,rot:0,elbow:105},rel:'chest',hand:'relaxed'},...Fe(0.32,-0.72)});
 save('single-arm-push-up',{az:35,el:8},['chest','triceps'],{start:fr(0),end:fr(1)},{muscleSide:'L'});}
// 4 close-grip push-up off a dumbbell (upright 20 kg, hands on top head)
{const z=0.5,top=0.3;
 const fr=(low)=>{const b=body(z-0.03,top+(low?0.38:0.5),-0.66,0);
  const A=(s)=>({pos:[s*0.06,top,z],contact:true,fingers:[s*0.2,0,1],palm:[0,-1,0],curl:-0.3,pole:[s*(low?0.3:0.35),0.4,-0.9]});
  return {root:b,neck:{flex:-18},armL:A(1),armR:A(-1),...Fe(0.1,-0.66)};};
 save('close-grip-push-up-off-of-a-dumbbell',{az:40,el:8},['triceps','chest'],{start:fr(0),end:fr(1)},
  {props:[{type:'dumbbell',kg:10,at:[0,0.15,z],dir:[0,1,0]}]});}
// 5 alternating renegade row: two kettlebells, left rows
{const z=0.5,bx=0.2,yG=0.237;
 const fr=(row)=>{const b=body(z-0.03,0.237+0.5,-0.68,0,{x:0,yaw:row?-6:0,roll:row?4:0});
  const L=row?{pos:[0.17,0.43,0.18],grip:0.0165,fingers:[0,-1,-0.3],palm:[-1,0,0],pole:[0.7,0.3,-1],scap:{prot:-0.5}}:Hg(1,bx,yG,z,UP);
  return {root:b,neck:{flex:-18},armL:L,armR:Hg(-1,bx,yG,z,UP),...Fe(0.25,-0.68)};};
 save('alternating-renegade-row',{az:50,el:8},['middle-back','lats'],{start:fr(0),end:fr(1)},
  {props:[{type:'kettlebell',kg:16,at:[-bx,0,z]},{type:'kettlebell',kg:16,hand:'L',mode:'hang',roll:90}],muscleSide:'L'});}
// 6 plyo kettlebell push-ups: bell at x=0, hop across it
{const z=0.5,yG=0.237,hx=0.4;
 const st=(s,low)=>{const m=-s*0.2; // s=1: left on bell, right on floor at -hx
  const b=body(z-0.03,low?0.47:0.52,-0.72,0,{x:m,roll:low?-s*4:0});
  const onBell=(side)=>Hf(side,0,yG+0.02,z,low?DN:UP,0);
  const onFloor=(side)=>Hf(side,hx,0,z,low?DN:UP);
  return {root:b,neck:{flex:-18},armL:s>0?onBell(1):onFloor(1),armR:s>0?Hf(-1,hx,0,z,low?DN:UP):onBell(-1),...Fe(0.17,-0.72)};};
 const sA=st(1,0), sLow=st(1,1), sB=st(-1,0);
 const air={root:{...body(z-0.03,0.6,-0.72,0.0),pos:[0,0.5,0.08]},neck:{flex:-18},
  armL:{pos:[0.16,0.36,z],contact:true,hand:'relaxed',fingers:[0,0,1],palm:[0,-1,0],pole:UP},armR:{pos:[-0.16,0.36,z],contact:true,hand:'relaxed',fingers:[0,0,1],palm:[0,-1,0],pole:[-0.7,0.4,-0.5]},...Fe(0.17,-0.72)};
 save('plyo-kettlebell-pushups',{az:25,el:8},['chest','triceps'],{start:sA,mid:sLow,mid2:air,end:sB},
  {props:[{type:'kettlebell',kg:16,at:[0,0,z]}],floats:true});}
// 7 drop push: hands on two 20 cm boxes, drop to floor between them
{const z=0.5,bh=0.2;
 const up={root:body(z-0.03,bh+0.5,-0.72,0),neck:{flex:-18},armL:Hf(1,0.5,bh,z,UP),armR:Hf(-1,0.5,bh,z,UP),...Fe(0.1,-0.72)};
 const mid={root:body(z-0.03,0.62,-0.72,0),neck:{flex:-18},armL:{...Hf(1,0.3,0.27,z,UP),hand:'relaxed'},armR:{...Hf(-1,0.3,0.27,z,UP),hand:'relaxed'},...Fe(0.1,-0.72)};
 const end={root:body(z-0.03,0.48,-0.72,0),neck:{flex:-18},armL:Hf(1,0.22,0,z,DN),armR:Hf(-1,0.22,0,z,DN),...Fe(0.1,-0.72)};
 save('drop-push',{az:20,el:8},['chest','triceps'],{start:up,mid,end},
  {props:[{type:'plyo-box',height:bh,width:0.3,depth:0.3,pos:[0.5,0,z]},{type:'plyo-box',height:bh,width:0.3,depth:0.3,pos:[-0.5,0,z]}],floats:true});}
// 8 incline push-up depth jump: feet on 30 cm box, hop from floor onto two steps outside shoulders
{const z=0.5,bh=0.3,sx=0.5,sh=0.17,fz=-0.7;
 const fl=(low)=>({root:body(z-0.03,low?0.29:0.52,fz,bh),neck:{flex:-18},armL:Hf(1,0.22,0,z,low?DN:UP),armR:Hf(-1,0.22,0,z,low?DN:UP),...Fe(0.1,fz,bh,low?92:80,[0,-0.6,1])});
 const st={root:body(z-0.03,sh+0.52,fz,bh),neck:{flex:-18},armL:Hf(1,sx-0.06,sh,z,UP),armR:Hf(-1,sx-0.06,sh,z,UP),...Fe(0.1,fz,bh,80,[0,-0.6,1])};
 const air={root:body(z-0.03,0.68,fz,bh),neck:{flex:-18},armL:{...Hf(1,0.34,0.3,z,UP),hand:'relaxed'},armR:{...Hf(-1,0.34,0.3,z,UP),hand:'relaxed'},...Fe(0.1,fz,bh,80,[0,-0.6,1])};
 save('incline-push-up-depth-jump',{az:25,el:8},['chest','triceps'],{start:fl(0),mid:fl(1),mid2:air,end:st},
  {props:[{type:'plyo-box',height:bh,width:0.5,depth:0.5,pos:[0,0,-0.9]},{type:'step',pos:[sx+0.06,0,z],yaw:90},{type:'step',pos:[-sx-0.06,0,z],yaw:90}],floats:true});}
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
