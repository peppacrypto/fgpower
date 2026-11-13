import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,muscles,frames,more={})=>{out[slug]={slug,camera,muscles,frames,...more};};
const H=(s,z,po=[0.55,0.35,-0.75],x=0.2)=>({pos:[s*x,0,z],contact:true,fingers:[s*0.12,0,1],palm:[0,-1,0],curl:-0.3,pole:[s*po[0],po[1],po[2]]});
const hands=(z,po,x)=>({armL:H(1,z,po,x),armR:H(-1,z,po,x)});
const F=(z,pitch,y=0.012,x=0.09)=>({legL:{pos:[x,y,z],anchor:'ball',pitch,toes:0,pole:[0.05,0,1]},legR:{pos:[-x,y,z],anchor:'ball',pitch,toes:0,pole:[-0.05,0,1]}});
// forearm hands: palms down on floor, elbows tucked back-down
const FA=(z)=>({armL:{pos:[0.12,0.04,z],contact:true,fingers:[0,0,1],palm:[0,-1,0],curl:0,pole:[0.1,-0.4,-1]},armR:{pos:[-0.12,0.04,z],contact:true,fingers:[0,0,1],palm:[0,-1,0],curl:0,pole:[-0.1,-0.4,-1]}});
const dd=(rz,ry,p)=>({root:{pos:[0,ry,rz],pitch:p},neck:{flex:-20},...hands(0.66),...F(-0.32,55)});
save('downward-dog',{az:72,el:6},['hamstrings'],{start:dd(0.09,0.91,139),end:dd(0.08,0.915,141)});
save('dolphin-pose',{az:72,el:6},['shoulders'],{
 start:{root:{pos:[0,0.82,-0.05],pitch:140},neck:{flex:-25},...FA(0.55),...F(-0.56,58)},
 end:{root:{pos:[0,0.84,-0.06],pitch:142},neck:{flex:-25},...FA(0.55),...F(-0.56,60)}});
save('butt-ups',{az:70,el:6},['abdominals'],{
 start:{root:{pos:[0,0.3,0],pitch:80},neck:{flex:-12},...FA(0.5),...F(-0.85,75,0.012,0.1)},
 end:{root:{pos:[0,0.5,-0.05],pitch:105},neck:{flex:-20},spine:{flex:12},...FA(0.5),...F(-0.85,75,0.012,0.1)}});
const U=(process.env.U||'0,0.25,0.5,0.75,1').split(',').map(Number);
 save('inchworm',{az:72,el:8},['hamstrings'],{
 start:{root:{pos:[0,0.8,0.1],pitch:125},neck:{flex:-10},...hands(0.45),legL:{pos:[0.1,0,-0.2],anchor:'sole',pitch:0,pole:[0,0,1]},legR:{pos:[-0.1,0,-0.2],anchor:'sole',pitch:0,pole:[0,0,1]}},
 mid:{root:{pos:[0,0.68,-0.12],pitch:106},neck:{flex:-15},...hands(0.62),legL:{pos:[0.1,0,-0.2],anchor:'sole',pitch:8,pole:[0,0,1]},legR:{pos:[-0.1,0,-0.2],anchor:'sole',pitch:8,pole:[0,0,1]}},
 mid2:{root:{pos:[0,0.55,-0.05],pitch:92},neck:{flex:-12},...hands(0.49),legL:{pos:[0.1,0,-0.55],anchor:'ball',pitch:55,toes:0,pole:[0,0,1]},legR:{pos:[-0.1,0,-0.55],anchor:'ball',pitch:55,toes:0,pole:[0,0,1]}},
 end:{root:{pos:[0,0.43,0],pitch:68},neck:{flex:-10},...hands(0.47),...F(-0.81,60)}.constructor===Object?{root:{pos:[0,0.43,0],pitch:68},neck:{flex:-10},...hands(0.49),legL:{pos:[0.09,0,-0.81],anchor:'ball',pitch:60,toes:0},legR:{pos:[-0.09,0,-0.81],anchor:'ball',pitch:60,toes:0}}:0});

const PZ=0.5;
const pl=(po)=>{const a=H(1,PZ,[0,0,0],0.2),b=H(-1,PZ,[0,0,0],0.2);if(po){a.pole=[0.55,0.35,-0.75];b.pole=[-0.55,0.35,-0.75];}else{delete a.pole;delete b.pole;}return {armL:a,armR:b};};
const bl=(z,y,pt,sg,x=0.09)=>({pos:[sg*x,y,z],anchor:'ball',pitch:pt,toes:0,yaw:z>-0.7?sg*+(process.env.YY||20):0,pole:[z>-0.7?sg*+(process.env.BX||0.5):sg*0.1,0,1]});
const mcF=(r,lz,ly,lp,rz,ry,rp)=>({root:r,neck:{flex:-10},...pl(),legL:bl(lz,ly,lp,1),legR:bl(rz,ry,rp,-1)});
const sol=(s,z=-0.2)=>({pos:[s*0.1,0,z],anchor:'sole',pitch:0,pole:[0,0,1]});
// spider-crawl: one knee to the same-side elbow, the other foot stays planted
{const base=(leg)=>({root:{pos:[0,0.3,0],pitch:78},neck:{flex:-10},...hands(0.5,[0.9,0.2,-0.5],0.3),legL:leg,legR:{pos:[-0.09,0,-0.84],anchor:'ball',pitch:70,toes:0}});
 const L0={pos:[0.09,0,-0.84],anchor:'ball',pitch:70,toes:0};
 save('spider-crawl',{az:50,el:20},['abdominals'],{start:base(L0),
  mid:base({pos:[0.14,0.1,-0.78],anchor:'ball',pitch:65,yaw:+(process.env.YM||0),toes:0,pole:[+(process.env.MQ||0.3),0,1]}),
  end:base({pos:[+(process.env.SX||0.3),+(process.env.SY||0.2),+(process.env.SZ||-0.35)],anchor:'ball',pitch:+(process.env.SP||85),yaw:+(process.env.YW||45),toes:0,pole:[+(process.env.SQ||0.8),+(process.env.SQY||0.2),+(process.env.SQZ||0.5)]})},{muscleSide:'L'});}
// groiners: plank -> jump the feet outside the hands -> plank
{const hz=0.5;
 const st={root:{pos:[0,0.43,0],pitch:68},neck:{flex:-20},...hands(hz),...F(-0.81,60)};
 const en={root:{pos:[0,+(process.env.RY2||0.56),+(process.env.RZ2||-0.02)],pitch:+(process.env.RP2||88)},neck:{flex:-5},...hands(hz),
  legL:{pos:[+(process.env.FX||0.3),0,+(process.env.FZ||0.0)],anchor:'ball',toes:0,pitch:15,pole:[0.3,0.3,1]},legR:{pos:[-(process.env.FX||0.3),0,+(process.env.FZ||0.0)],anchor:'ball',toes:0,pitch:15,pole:[-0.3,0.3,1]}};
 const ap=+(process.env.AP||70);const mk2=(z,y,ry,rz,rp,q=+(process.env.QP||0.2),qy=0.3,fx=0.3)=>({root:{pos:[0,ry,rz],pitch:rp},neck:{flex:-10},...hands(hz),legL:{pos:[fx,y,z],anchor:'ball',pitch:ap,toes:0,pole:[q,qy,1]},legR:{pos:[-fx,y,z],anchor:'ball',pitch:ap,toes:0,pole:[-q,qy,1]}});
 const mid=mk2(-0.55,+(process.env.M1Y||0.2),+(process.env.MY1||0.5),-0.08,85,0.05,0),mid2=mk2(+(process.env.M2Z||-0.12),+(process.env.M2Y||0.22),+(process.env.MY2||0.52),0,82,+(process.env.QP||0.2),0.3,+(process.env.M2X||0.2));
 save('groiners',{az:60,el:10},['adductors'],{start:st,mid,mid2,end:en},{floats:true});}
// mountain-climbers
{const LP=+(process.env.LP||90);
 save('mountain-climbers',{az:66,el:7},['quadriceps','abdominals'],{
 start:mcF({pos:[0,0.43,0],pitch:68},-0.1,0.1,LP,-0.81,0,60),
 mid:mcF({pos:[0,0.43,0],pitch:68},-0.62,0.2,LP,-0.81,0,60),
 mid2:mcF({pos:[0,0.43,0],pitch:68},-0.81,0,60,-0.62,0.2,LP),
 end:mcF({pos:[0,0.43,0],pitch:68},-0.81,0,60,-0.1,0.1,LP)},{});}
// step-back-burpee (5 frames max): stand -> fold -> L foot back -> R foot back -> plank
{const up=(s)=>({pos:[s*+(process.env.UX||0.2),+(process.env.UY||0.96),+(process.env.UZ||0.15)],fingers:[s*+(process.env.UFX||0),-1,+(process.env.UF||2)],palm:[s*+(process.env.UPX||0),+(process.env.UPY||-1),-1],curl:0.15,pole:[s*0.55,0.35,-0.75]});
 const fold={root:{pos:[0,+(process.env.FY||0.78),+(process.env.FZ2||0.06)],pitch:+(process.env.FP||127)},neck:{flex:-10},...pl(1),legL:sol(1),legR:sol(-1)};
 save('step-back-burpee',{az:66,el:6},['quadriceps','chest','abdominals'],{
 start:{root:{pos:[0,0.925,-0.2]},armL:up(1),armR:up(-1),legL:sol(1),legR:sol(-1)},
 mid:fold,
 mid2:{root:{pos:[0,+(process.env.R2Y||0.8),+(process.env.R2Z||0)],pitch:+(process.env.R2P||118)},neck:{flex:-10},...pl(1),legL:{pos:[0.1,0.25,-0.45],anchor:'ball',pitch:85,toes:0,pole:[0.05,0,1]},legR:sol(-1)},
 mid3:{root:{pos:[0,+(process.env.R3Y||0.55),+(process.env.R3Z||-0.2)],pitch:+(process.env.R3P||90)},neck:{flex:-10},...pl(1),legL:bl(-0.81,0,60,1),legR:{pos:[-0.1,+(process.env.M3Y||0.25),+(process.env.M3Z||-0.5)],anchor:'ball',pitch:+(process.env.M3P||95),toes:0,pole:[-0.05,0,1]}},
 end:mcF({pos:[0,0.43,0],pitch:68},-0.81,0,60,-0.81,0,60)},{});}
// inchworm: feet fixed, each hand takes one lifted step (5 frames max)
{const FZ=-0.81,L=0.86;
 const root=(u)=>{const ys=[[0,0.8,125],[0.33,0.68,106],[0.66,0.55,92],[1,0.43,68]];let a=ys[0],b=ys[3];for(let i=0;i<3;i++)if(u>=ys[i][0]&&u<=ys[i+1][0]){a=ys[i];b=ys[i+1];}
  const t=(u-a[0])/(b[0]-a[0]);const y=a[1]+(b[1]-a[1])*t,p=a[2]+(b[2]-a[2])*t;return {pos:[0,y,FZ+Math.sqrt(Math.max(0,L*L-y*y))],pitch:p};};
 const H0=+(process.env.H0||0.2),H1=0.49,LY=+(process.env.LY||0.2);
 const hand=(s,z,y)=>({...H(s,z,[0.55,0.35,-0.75],0.2),pos:[s*0.2,y,z],contact:y<0.01,...(y<0.01?{}:{hand:'flat',fingers:[s*0.12,+(process.env.FT||-0.2),1]})});
 const mk=(u,lz,ly,rz,ry)=>({root:root(u),neck:{flex:-10},armL:hand(1,lz,ly),armR:hand(-1,rz,ry),legL:{pos:[0.1,0,FZ],anchor:'ball',pitch:15+45*u,toes:0,pole:[0,0,1]},legR:{pos:[-0.1,0,FZ],anchor:'ball',pitch:15+45*u,toes:0,pole:[0,0,1]}});
 const M=(H0+H1)/2;
 const U=(process.env.U||'0,0.25,0.5,0.75,1').split(',').map(Number);
 save('inchworm',{az:72,el:8},['hamstrings'],{start:mk(0,H0,0,H0,0),mid:mk(U[1],M,LY,H0,0),mid2:mk(U[2],H1,0,H0,0),mid3:mk(U[3],H1,0,M,LY),end:mk(1,H1,0,H1,0)},{});}
for(const s of ['dolphin-pose','butt-ups'])for(const f of Object.values(out[s].frames)){f.armL.pos[1]=0.02;f.armR.pos[1]=0.02;}
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
