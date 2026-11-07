import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify(s,null,1));
const legs = (x=0.14,z=-0.05,p=0.5) => ({ legL:{pos:[x,0,z],anchor:'sole',yaw:6,pole:[0.2,0.5,1]}, legR:{pos:[-x,0,z],anchor:'sole',yaw:-6,pole:[-0.2,0.5,1]} });
// arm: fingers down, palm direction pd, elbows pole
const arm = (s,x,y,z,pd,pole=[0.3,0.2,-1]) => ({pos:[x*s,y,z],contact:true,fingers:[0,-1,0],palm:[pd[0]*s,pd[1],pd[2]],pole:[pole[0]*s,pole[1],pole[2]],curl:0.85});
const both = (x,y,z,pd,pole) => ({armL:arm(1,x,y,z,pd,pole),armR:arm(-1,x,y,z,pd,pole)});
const fr = (rootY,rootZ,pitch,arms,lg={}) => ({ root:{pos:[0,rootY,rootZ],pitch}, neck:{flex:-35}, ...arms, ...legs(lg.x,lg.z) });
const mk = (slug, props, start, end, muscles, cam={az:100,el:8}, mid) => W(slug,{slug,camera:cam,muscles,props,frames:{start,...(mid?{mid}:{}),end}});
const bar = {type:'barbell',hands:true,plates:[20]};
const dbs = [{type:'dumbbell',hand:'L',kg:15},{type:'dumbbell',hand:'R',kg:15}];
const DX=0.26;
const PR=[0,0,-1], SU=[0,0,1], NE=[-1,0,0];
const R = (x,pd,top=[0.80,-0.19],pole,mid,sy=0.40,sz=0.12) => [fr(0.80,-0.30,65,both(x,sy,sz,pd,[0.3,0.2,-1])), fr(0.80,-0.30,65,both(x,top[0],top[1],pd,pole??[0.5,0.3,-1])), mid&&fr(0.80,-0.30,65,both(x,mid[0],mid[1],pd,pole??[0.4,0.25,-1]))];
let [a,b,m]=R(0.235,PR,[0.74,0.0],undefined,[0.62,0.14]); mk('bent-over-barbell-row',[bar],a,b,['middle-back'],undefined,m);
[a,b,m]=R(0.235,SU,[0.74,0.0],[0.2,0.1,-1],[0.62,0.14]); mk('reverse-grip-bent-over-rows',[bar],a,b,['middle-back'],undefined,m);
// rear delt: wide, elbows flared
[a,b]=R(0.42,PR,[0.84,0.16],[1,0.1,0],undefined,0.46); mk('barbell-rear-delt-row',[bar],a,b,['shoulders'],{az:70,el:14});
[a,b,m]=R(DX,PR,[0.74,0.0],undefined,[0.60,0.12],0.42,0.22); mk('bent-over-two-dumbbell-row',dbs,a,b,['middle-back'],undefined,m);
[a,b,m]=R(DX,NE,[0.74,0.0],undefined,[0.60,0.12],0.42,0.22); mk('bent-over-two-dumbbell-row-with-palms-in',dbs,a,b,['middle-back'],undefined,m);
// kettlebells: bell on floor in front of feet
const kb = (hand) => ({type:'kettlebell',kg:16,mode:'hang',...(hand?{hand}:{hands:true})});
const K = (zf) => fr(0.72,-0.35,62,{}).root;
const kfr = (up2) => { const y2=up2?0.75:0.31, z2=up2?-0.05:0.14;
  return (L,Rr)=>({root:{pos:[0,0.72,-0.35],pitch:62},neck:{flex:-35},armL:L(y2,z2),armR:Rr(y2,z2),...legs(0.15,-0.2)}); };
const kA = (x)=>(y,z)=>arm(1,x,y,z,NE,up(y)), kB=(x)=>(y,z)=>arm(-1,x,y,z,NE,up(y));
function up(y){return y>0.5?[0.6,0.3,-1]:[0.3,0.2,-1];}
const rest=(y,z)=>({pos:[-0.24,0.58,0.0],contact:true,fingers:[0,-0.3,0.95],palm:[0,-1,0],pole:[-0.5,0,-1],curl:0.8});
const Lc=(y,z)=>arm(1,0.12,y,z,NE,up(y)); const Rc=(y,z)=>arm(-1,0.12,y,z,NE,up(y));
mk('one-arm-kettlebell-row',[kb('L')],kfr(0)(Lc,rest),kfr(1)(Lc,rest),['middle-back']);
mk('two-arm-kettlebell-row',[kb()],kfr(0)(Lc,Rc),kfr(1)(Lc,Rc),['middle-back']);
{ const lo=(y,z)=>arm(1,0.12,y,z,NE,up(y)), hi=kfr(1), lw=kfr(0);
  const s1=lw(Lc,Rc), e1=hi(Lc,(y,z)=>arm(-1,0.12,0.31,0.14,NE)), e2=lw(Lc,Rc);
  const e3=lw((y,z)=>arm(1,0.12,0.31,0.14,NE),(y,z)=>arm(-1,0.12,0.75,-0.05,NE,up(0.75)));
  W('alternating-kettlebell-row',{slug:'alternating-kettlebell-row',camera:{az:100,el:8},muscles:['middle-back'],props:[kb('L'),kb('R')],frames:{start:s1,end:e1,mid:e3}}); }
// one-arm dumbbell row: right knee and hand on bench, left arm rows
{ const E=process.env, ex=+(E.EX||0.44), ey=+(E.EY||0.82), ez=+(E.EZ||-0.05), fp=+(E.FP||70), hy=+(E.HY||0.47);
  const f=(hx,hy_,hz,pole)=>({root:{pos:[0.12,0.92,-0.25],pitch:90},neck:{flex:-30},
   armL:arm(1,hx,hy_,hz,NE,pole), armR:{pos:[0.0,hy,0.22],contact:true,fingers:[0,0,1],palm:[0,-1,0],pole:[-0.3,0.3,-1],curl:0.4},
   legL:{pos:[0.30,0,-0.35],anchor:'sole',pole:[0.2,0.4,1]}, legR:{pos:[0.04,0.50,-0.62],anchor:'ankle',pitch:fp,pole:[0,-1,0.2]} });
  mk('one-arm-dumbbell-row',[{type:'flat-bench'},{type:'dumbbell',hand:'L',kg:15}],f(0.36,0.45,0.22,[0.3,0.2,-1]),f(ex,ey,ez,[0.5,0.3,-1]),['middle-back'],{az:100,el:8}); }
// prone on 30 deg incline, head toward -Z (yaw 180): figure left is world -X, so armL/legL use mirrored sign
{ const E=process.env, fy=+(E.FY||180), fpt=+(E.FPT||30), fa=E.FA||'ball';
  const SH=+(E.SH||0), dz=-SH*0.866, dy=SH*0.5;
  const f=(x,y,z,pd,pole)=>({root:{pos:[0,0.66+dy,-0.05+dz],yaw:180,pitch:60},neck:{flex:+(E.NK||-5)},
   armL:arm(-1,x,y+dy,z+dz,pd,pole), armR:arm(1,x,y+dy,z+dz,pd,pole),
   legL:{pos:[-(+(E.LX||0.5)),0,+(E.LZ||0.42)],anchor:fa,yaw:fy,pitch:fpt,pole:[-0.1,-1,0.3]},legR:{pos:[+(E.LX||0.5),0,+(E.LZ||0.42)],anchor:fa,yaw:fy,pitch:fpt,pole:[0.1,-1,0.3]}});
  const P={ camera:{az:60,el:10},props:[{type:'incline-bench',angle:30},...dbs]};
  const PD=[0,0,1];
  W('incline-bench-pull',{slug:'incline-bench-pull',...P,muscles:['middle-back'],frames:{start:f(0.28,0.40,-0.49,PD,[1,0.2,0]),mid:f(0.42,0.62,-0.49,PD,[1,0.2,0]),end:f(0.46,0.84,-0.49,PD,[1,0.2,0])}});
  W('dumbbell-incline-row',{slug:'dumbbell-incline-row',...P,muscles:['middle-back'],frames:{start:f(0.27,0.40,-0.49,NE,[0.3,0.2,0]),end:f(0.30,0.80,-0.27,NE,[0.3,0.4,1])}}); }
