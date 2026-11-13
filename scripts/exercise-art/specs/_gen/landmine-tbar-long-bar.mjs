import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const G=W+'_gallery/';
const out={};
const save=(slug,o)=>{out[slug]={...o,slug};};
const clone=o=>JSON.parse(JSON.stringify(o));
const gal=n=>JSON.parse(fs.readFileSync(G+n+'.json','utf8'));
const cr=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nz=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);};
// grip frame: bar unit b (hand to P direction irrelevant), arm direction ad -> fingers perpendicular to b, palm so fingers x palm = bar axis
function gripFrame(b,ad,side){const dd=ad[0]*b[0]+ad[1]*b[1]+ad[2]*b[2];const f=nz(ad.map((v,i)=>v-dd*b[i]));let pm=nz(cr(b,f));if(pm[0]*side>0)pm=pm.map(v=>-v);return {fingers:f,palm:pm};}
// ---- lying t-bar (gallery copy)
{const g=gal('lying-t-bar');const E=process.env;for(const s of ['armL','armR'])for(const k of ['start']){g.frames[k][s].pos[1]+=+(E.TY||-0.07);g.frames[k][s].pos[2]+=+(E.TZ||0.02);}
 save('lying-t-bar-row',{...g,muscles:['middle-back','lats']});}
// ---- cambered
{const g=gal('cambered-bar');const E=process.env;const BH=+(E.BH||0.62);for(const p of g.props)if(p.type==='flat-bench')p.height=BH;
 for(const k of ['start','end']){const f=g.frames[k];f.root.pos=[0,0.595+BH-0.44,0.02];}
 for(const s of ['armL','armR']){const x=s==='armL'?1:-1;for(const k of ['start','end'])g.frames[k]['leg'+s[3]].pos[1]+=BH-0.44;g.frames.start[s].pos=[x*0.4,+(E.CY||0.15),0.42];g.frames.end[s].pos=[x*0.4,+(E.CE||0.45),0.4];}
 save('lying-cambered-barbell-row',{...g,muscles:['middle-back','lats']});}
// ---- jammers
{const g=gal('landmine-jammer');{const E=process.env;const e=g.frames.end;e.root.pos=[0,+(E.JR||0.92),0];for(const s of ['armL','armR']){const x=s==='armL'?1:-1;e[s].pos=[x*0.22,+(E.JY||1.92),+(E.JZ||0.45)];e[s].fingers=[0,+(E.JF||0.5),0.7];}}save('landmine-linear-jammer',{...g,muscles:['shoulders','triceps','quadriceps']});}
{const g=gal('landmine');
 for(const k of ['start','end']){g.frames[k].legL.pos=[0.22,0,-0.2];g.frames[k].legR.pos=[-0.22,0,0.25];}
 g.frames.start.root.pos=[0,0.8,0];g.frames.end.root.pos=[0,+(process.env.SR||0.87),0.05];g.frames.end.root.pitch=8;
 {const P=[0,0.11,1.75];
 for(const k of ['start','end']){const h=g.frames[k].armL;const b=nz([P[0]-h.pos[0],P[1]-h.pos[1],P[2]-h.pos[2]]);if(k==='end')h.pos=[+(process.env.SX||0.1),+(process.env.SY||1.87),+(process.env.SZ||0.5)];if(k==='start')h.pos=[h.pos[0],h.pos[1]+0.03,h.pos[2]+0.02];const gf=gripFrame(b,[h.pos[0]-0.19,h.pos[1]-1.38,h.pos[2]-0.05],1);Object.assign(h,gf);}}
 save('single-arm-linear-jammer',{...g,muscles:['shoulders','triceps','quadriceps']});}
// ---- t-bar family
const PZ=-1.5, zOf=y=>PZ+Math.sqrt(1.7*1.7-(y-0.11)**2);
const legs=(x=0.2,z=0)=>({legL:{pos:[x,0,z],anchor:'sole',yaw:14,pitch:0,pole:[0.4,0,1]},legR:{pos:[-x,0,z],anchor:'sole',yaw:-14,pitch:0,pole:[-0.4,0,1]}});
const two=(y,pitch,neck,pole,rz=-0.25)=>{const z=zOf(y)-0.0;const a=s=>({pos:[s*0.055,y,z],contact:true,fingers:[0,-1,0.05],palm:[-s,0,0],curl:0.85,pole:[s*pole[0],pole[1],pole[2]]});
 return {root:{pos:[0,0.76,rz],pitch},neck:{flex:neck},armL:a(1),armR:a(-1),...legs()};};
const RZ=+process.env.RZ||-0.40;
const tb=(slug,more={})=>save(slug,{camera:{az:66,el:14},muscles:['middle-back','lats'],props:[{type:'t-bar-row',pos:[0,0,PZ],yaw:0,hands:true,plates:[20]}],
 frames:{start:two(0.46,52,-30,[0.5,0.2,-0.5],RZ),end:two(0.64,50,-26,[0.6,0.65,-0.55])},...more});
tb('t-bar-row-with-handle');
// two-arm long bar: same bar, handle used as the nearest prop
tb('bent-over-two-arm-long-bar-row',{camera:{az:70,el:12}});
// ---- one-arm long bar
const one=(slug,pitch,rootY,rz,legz,leg2,DZ=-0.15)=>{
 const rx=-0.3;
 const arm=(y,pole)=>({pos:[0,y,zOf(y)],hand:'grip',grip:0.014,fingers:[0,-1,0],palm:[-1,0,0],pole});
 const fr=(y,p,pole,neck,dz=0)=>({root:{pos:[rx,rootY,rz+dz],pitch:p},neck:{flex:neck},armL:arm(y,pole),armR:{fk:{flex:10,abd:38,elbow:20},curl:0.3},
  legL:{pos:[rx+0.16,0,legz],anchor:'sole',yaw:14,pitch:0,pole:[0.4,0,1]},legR:{pos:[rx-0.16,0,leg2],anchor:'sole',yaw:-14,pitch:0,pole:[-0.4,0,1]}});
 save(slug,{camera:{az:55,el:12},muscles:['middle-back','lats'],muscleSide:'L',props:[{type:'landmine',pos:[0,0,PZ],yaw:0,hand:'L',plates:[20]}],
  frames:{start:fr(0.46,pitch,[0.5,0.2,-0.5],-26,DZ),end:fr(0.72,pitch-5,[0.6,0.65,-0.55],-24)}});};
one('bent-over-one-arm-long-bar-row',+process.env.P||58,+process.env.Y||0.84,-0.25,+process.env.L||0,+process.env.L||0,+process.env.D||-0.1);
one('one-arm-long-bar-row',55,0.78,-0.22,0,-0.1);
// ---- 180s
{const R=2.1,P=[0,0.11,2.1];
 const hp=d=>{const u=nz(d);return {c:[P[0]+R*u[0],P[1]+R*u[1],P[2]+R*u[2]],u};};
 const frame=(d,yaw,twist)=>{const {c,u}=hp(d);
  const mk=(s,off)=>{const pos=[c[0]+off*u[0],c[1]+off*u[1],c[2]+off*u[2]];const ad=[pos[0]-s*0.5,pos[1]-1.3,pos[2]-0.05];const g=gripFrame(u,ad,s);
   return {pos,contact:true,...g,curl:0.85,pole:[s*0.9,-0.5,-0.3]};};
  return {root:{pos:[0,0.8,0],yaw,pitch:6},spine:{flex:2,twist},neck:{flex:-4},armL:mk(1,0.07),armR:mk(-1,-0.07),
   legL:{pos:[0.3,0,0],anchor:'sole',yaw:20,pitch:0,pole:[0.5,0,1]},legR:{pos:[-0.3,0,0],anchor:'sole',yaw:-20,pitch:0,pole:[-0.5,0,1]}};};
 save('landmine-180s',{camera:{az:20,el:10},muscles:['abdominals','obliques'],props:[{type:'landmine',pos:[P[0],0,P[2]],yaw:0,hands:true,plates:[5]}],
  frames:Object.fromEntries([-1,-.75,-.5,-.25,0,.25,.5,.75,1].map((t,i)=>[i==0?'start':i==8?'end':'k'+i,frame([0.26*t,1.4-0.15*t*t,-1.65-0.1*t*t],(t<-0.9?13*t:14*t),(t<-0.9?15*t:22*t))]))});}
// ---- bench mid rows
{const bar=(y,z)=>({pos:[0,y,z]});
 const fr=(y,z,p,sf)=>{const a=s=>({pos:[s*0.25,y,z],contact:true,fingers:[0,-1,0],palm:[0,0,-1],curl:0.85,pole:[s*0.6,0.2,-0.6]});
  return {root:{pos:[0,0.44+0.8,-0.05],pitch:p},spine:{flex:sf},neck:{flex:-20},armL:a(1),armR:a(-1),
  legL:{pos:[0.15,0.44,-0.05],anchor:'sole',yaw:8,pitch:0,pole:[0.2,0,1]},legR:{pos:[-0.15,0.44,-0.05],anchor:'sole',yaw:-8,pitch:0,pole:[-0.2,0,1]}};};
 save('straight-bar-bench-mid-rows',{floats:true,camera:{az:70,el:10},muscles:['middle-back','lats'],props:[{type:'flat-bench',pos:[0,0,0]},{type:'barbell',hands:true,plates:[10]}],
  frames:{start:fr(+(process.env.MY||0.86),0.3,50,6),end:fr(1.22,0.16,46,6)}});}
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
