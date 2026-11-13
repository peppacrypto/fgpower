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
const Ha=(h)=>{const o={...h,hand:'relaxed'};delete o.contact;return o;};
const UP=[0.7,0.4,-0.5], DN=[0.5,0.6,-0.6], DNin=[0.35,0.6,-0.7];
// 1 archer: keep existing hand-tuned spec
out['archer-push-up']=JSON.parse(fs.readFileSync(W+'archer-push-up.json'));
// pivot body: feet planted, rigid line of length L from foot ball to shoulder (no sag, no knee bend)
const pv=(shy,fz,fy,L,extra={})=>body(fz+Math.sqrt(L*L-(shy-fy)*(shy-fy)),shy,fz,fy,extra);
const LB=1.30;
// 2 isometric wipers: hold a half push-up, sweep the torso from over one hand to over the other
{const hx=0.28,z=0.5;
 const fr=(lo)=>{const yL=lo>0?0.36:0.54,yR=lo<0?0.36:0.54,m=(yL+yR)/2;
  const b=pv(m,-0.72,0.0,LB,{x:lo*0.09,roll:-lo*7});
  return {root:b,neck:{flex:-12},armL:Hf(1,hx,0,z,lo>0?DN:UP),armR:Hf(-1,hx,0,z,lo<0?DN:UP),...Fe(0.2,-0.72,0.0)};};
 save('isometric-wipers',{az:12,el:10},['chest','triceps'],{start:fr(1),mid:fr(0),end:fr(-1)},{tempo:{lift:'even',even:1.4,hold:0.8}});}
// 3 single-arm push-up: wide feet, working arm under shoulder, free hand behind the back, no twist
{const z=0.5,hx=0.19;
 const fr=(low)=>({root:pv(low?0.34:0.57,-0.72,0,LB,{x:0}),neck:{flex:-12},
  armL:Hf(1,hx,0,z,low?[0.45,0.6,-0.7]:[0.3,0.4,-0.6],0.05,-0.25),
  armR:{fk:{flex:-70,abd:10,rot:0,elbow:100},rel:'chest',hand:'relaxed'},...Fe(0.4,-0.72)});
 save('single-arm-push-up',{az:-50,el:10},['chest','triceps'],{start:fr(0),end:fr(1)},{muscleSide:'L'});}
// 4 close-grip push-up off a dumbbell: both hands touching on top of an upright bell, chest to the bell
{const z=0.62,top=0.3,L=1.38;
 const fr=(low)=>{const b=pv(low?0.5:0.87,-0.66,0,L);
  const A=(s)=>({pos:[s*0.08,top,z],contact:true,fingers:[0,0,1],palm:[-s*0.3,-1,0],curl:-0.3,pole:[s*(low?0.55:0.35),0.2,-0.4]});
  return {root:b,neck:{flex:-12},armL:A(1),armR:A(-1),...Fe(0.1,-0.66)};};
 save('close-grip-push-up-off-of-a-dumbbell',{az:70,el:8},['triceps','chest'],{start:fr(0),end:fr(1)},
  {props:[{type:'dumbbell',kg:10,at:[0,0.15,z],dir:[0,1,0]}]});}
// 5 alternating renegade row (one drawn side: a hanging bell cannot swap hands; the floor bell is the support)
{const z=0.5,bx=0.2,yG=0.237;
 const fr=(row)=>{const b=pv(0.8,-0.68,0,1.33,{x:0,yaw:row?-6:0,roll:row?4:0});
  const L=row?{pos:[0.3,0.58,0.2],grip:0.0165,fingers:[0,-1,-0.3],palm:[-1,0,0],pole:[0.5,0.6,-1],scap:{prot:-0.5}}:Hg(1,bx,yG,z,UP);
  return {root:b,neck:{flex:-8},armL:L,armR:Hg(-1,bx,yG,z,UP),...Fe(0.3,-0.68)};};
 save('alternating-renegade-row',{az:50,el:8},['middle-back','lats'],{start:fr(0),end:fr(1)},
  {props:[{type:'kettlebell',kg:16,at:[-bx,0,z]},{type:'kettlebell',kg:16,hand:'L',mode:'hang',roll:90}],muscleSide:'L'});}
// 6 plyo kettlebell push-ups: bell at x=0, hop across it
{const z=0.5,yG=0.237,hx=0.4;
 const st=(s,low)=>{const m=-s*0.19;
  const b=pv(low?0.45:0.57,-0.72,0,LB,{x:m});
  const onBell=(side)=>Hg(side,0,yG,z,low?DN:UP);
  const onFloor=(side)=>Hf(side,hx,0,z,low?DN:UP);
  return {root:b,neck:{flex:-12},armL:s>0?onBell(1):onFloor(1),armR:s>0?onFloor(-1):onBell(-1),...Fe(0.2,-0.72)};};
 const sA=st(1,0), sLow=st(1,1), sB=st(-1,0);
 const air={root:pv(0.7,-0.72,0,LB,{x:0}),neck:{flex:-12},
  armL:{pos:[0.2,0.18,z],hand:'relaxed',fingers:[0,0,1],palm:[0,-1,0],pole:UP},armR:{pos:[-0.2,0.18,z],hand:'relaxed',fingers:[0,0,1],palm:[0,-1,0],pole:[-0.7,0.4,-0.5]},...Fe(0.2,-0.72)};
 save('plyo-kettlebell-pushups',{az:25,el:8},['chest','triceps'],{start:sA,mid:sLow,mid2:air,end:sB},
  {props:[{type:'kettlebell',kg:16,at:[0,0,z]}],floats:true,tempo:{lift:'even',even:0.5,hold:0.12}});}
// 7 drop push: hands on two 20 cm boxes, drop to the floor between them, absorb, push back up onto the boxes
{const z=0.5,bh=0.2,L=1.30;
 const up={root:pv(bh+0.52,-0.63,0,L),neck:{flex:-12},armL:Hf(1,0.42,bh,z,UP),armR:Hf(-1,0.42,bh,z,UP),...Fe(0.1,-0.63)};
 const hop={root:pv(bh+0.57,-0.63,0,L),neck:{flex:-12},armL:Ha(Hf(1,0.42,bh+0.2,z,UP,0)),armR:Ha(Hf(-1,0.42,bh+0.2,z,UP,0)),...Fe(0.1,-0.63)};
 const air={root:pv(0.7,-0.63,0,L),neck:{flex:-12},armL:Ha({...Hf(1,0.22,0.14,z-0.05,UP,0),fingers:[0,-0.2,1]}),armR:Ha({...Hf(-1,0.22,0.14,z-0.05,UP,0),fingers:[0,-0.2,1]}),...Fe(0.1,-0.63)};
 const end={root:pv(0.44,-0.63,0,L),neck:{flex:-12},armL:Hf(1,0.22,0,z,DN),armR:Hf(-1,0.22,0,z,DN),...Fe(0.1,-0.63)};
 save('drop-push',{az:20,el:8},['chest','triceps'],{start:up,mid:hop,mid2:air,end},
  {props:[{type:'plyo-box',height:bh,width:0.3,depth:0.3,pos:[0.5,0,z]},{type:'plyo-box',height:bh,width:0.3,depth:0.3,pos:[-0.5,0,z]}],floats:true,tempo:{lift:'back',up:0.45,down:0.3,squeeze:0.15,stretch:0.3}});}
// 8 incline push-up depth jump: feet on 30 cm box (catalog), hop from the floor onto two steps outside the shoulders
{const z=0.5,bh=0.3,sx=0.5,sh=0.17,fz=-0.82,L=1.30;
 const fe=(p)=>Fe(0.1,fz,bh+0.02,80,[0,-0.6,1]);
 const fl=(low)=>({root:pv(low?0.3:0.57,fz,bh,L),neck:{flex:-12},armL:Hf(1,0.22,0,z,low?DNin:UP),armR:Hf(-1,0.22,0,z,low?DNin:UP),...fe(low?92:80)});
 const st={root:pv(sh+0.53,fz,bh,L),neck:{flex:-12},armL:Hf(1,sx-0.06,sh,z,UP),armR:Hf(-1,sx-0.06,sh,z,UP),...fe(80)};
 const air={root:pv(0.72,fz,bh,L),neck:{flex:-12},armL:Ha(Hf(1,0.42,0.3,z,UP,0)),armR:Ha(Hf(-1,0.42,0.3,z,UP,0)),...fe(80)};
 save('incline-push-up-depth-jump',{az:55,el:22},['chest','triceps'],{start:fl(0),mid:fl(1),mid2:air,end:st},
  {props:[{type:'plyo-box',height:bh,width:0.5,depth:0.5,pos:[0,0,-0.9]},{type:'step',pos:[sx+0.06,0,z],yaw:90},{type:'step',pos:[-sx-0.06,0,z],yaw:90}],floats:true,tempo:{lift:'back',up:0.45,down:0.5,squeeze:0.12,stretch:0.2}});}
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
