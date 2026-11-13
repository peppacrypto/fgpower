import fs from 'fs';
const D='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const L=s=>JSON.parse(fs.readFileSync(D+'_old_hsrc/'+s+'.json'));
const slugs='seated-towel-row hips-up-elbow-row knee-grip-lean-back-curl seated-towel-foot-curl door-frame-one-arm-curl door-frame-one-arm-row seated-thigh-lift-curl supine-elbow-row door-frame-deep-lean-row seated-knee-grip-row'.split(' ');
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
// make hand-end segments of the towel strip as long as in the start frame; hands follow
function towelFix(j,arms){const fr=j.frames,names=Object.keys(fr),s=fr.start.props[0].points;
 const n=s.length;
 for(const f of names){if(f==='start')continue;const P=fr[f].props[0].points;
  [[0,1,'armL'],[n-1,n-2,'armR']].forEach(([h,ft,arm])=>{
   const L0=dist(s[h],s[ft]);const d=P[h].map((v,i)=>v-P[ft][i]);const l=Math.hypot(...d);
   const np=P[ft].map((v,i)=>v+d[i]/l*L0);
   const a=fr[f][arm].pos;fr[f][arm].pos=a.map((v,i)=>v+np[i]-P[h][i]);P[h]=np.map(v=>+v.toFixed(4));});}}
for(const s of slugs){const j=L(s),F=j.frames;
 if(s==='supine-elbow-row')F.start.root.pos[1]+=0.02;
 if(s==='door-frame-deep-lean-row'){F.end.armL.pos=[...F.start.armL.pos];F.end.armL.pole=[0.9,0.5,0.3];F.end.armL.fingers=[0,0,1];F.end.armL.palm=[-1,0,0];F.start.armL.fingers=[0,0,1];F.start.armL.palm=[-1,0,0];F.start.armL.pos[0]+=0.025;F.end.armL.pos[0]+=0.025;}
 if(s==='door-frame-one-arm-row'||s==='door-frame-one-arm-curl'){F.end.armL.pos=[...F.start.armL.pos];F.end.armL.pos[0]+=0.02;F.start.armL.pos[0]+=0.02;F.end.armL.fingers=[0,0,1];F.end.armL.palm=[-1,0,0];F.start.armL.fingers=[0,0,1];F.start.armL.palm=[-1,0,0];}

 if(s.startsWith('door-frame'))for(const f in F)F[f].armL.pos[0]+=0.045;
 if(s.startsWith('door-frame')) for(const f in F){F[f].armR.pos=[-0.23,-0.02,0.06];F[f].armR.pole=[-1,0,-0.4];}
 if(s==='seated-knee-grip-row'||s==='knee-grip-lean-back-curl') for(const f in F){F[f].armL.pos[0]+=+(process.env.DX||0.05);F[f].armR.pos[0]-=+(process.env.DX||0.05);F[f].armL.pos[1]+=+(process.env.DY||0);F[f].armR.pos[1]+=+(process.env.DY||0);F[f].armL.pos[2]+=+(process.env.DZ||0);F[f].armR.pos[2]+=+(process.env.DZ||0);F[f].armL.fingers=[-0.55,-0.75,0.15];F[f].armR.fingers=[0.55,-0.75,0.15];F[f].armL.palm=[0.05,0.5,-0.85];F[f].armR.palm=[-0.05,0.5,-0.85];}
 if(s==='supine-elbow-row'){F.end.armL.fingers=[0,1,0.4];F.end.armR.fingers=[0,1,0.4];}
 if(s==='hips-up-elbow-row'){F.start.neck.flex=36;
  F.end.armL.pos[0]=0.25;F.end.armR.pos[0]=-0.25;F.end.armL.fingers=[-0.1,1,0.2];F.end.armL.palm=[-1,-0.35,0];F.end.armR.fingers=[0.1,1,0.2];F.end.armR.palm=[1,-0.35,0];}
 if(s==='seated-towel-row'){F.start.neck.flex=0;F.start.root.pitch=3;
  for(const k of ['armL','armR']){const sg=k==='armL'?1:-1;F.start[k].pos=[sg*0.2,0.42,0.52];}
  F.start.props[0].points[0]=[0.19,0.42,0.52];F.start.props[0].points[5]=[-0.19,0.42,0.52];
  for(const k of ['legL','legR']){F.end[k].pos[2]=0.56;}
  {const e=F.end,pt=e.props[0].points;pt[0]=[0.32,0.45,0.26];pt[5]=[-0.32,0.45,0.26];e.armL.pos=[0.32,0.45,0.17];e.armR.pos=[-0.32,0.45,0.17];}
  const pp=F.end.props[0].points;pp[1][2]=0.64;pp[2][2]=0.66;pp[3][2]=0.66;pp[4][2]=0.64;
  towelFix(j);}
 if(s==='seated-towel-foot-curl'){
  for(const f in F){if(f==='start')continue;const dz=0.12;
   F[f].legL.pos[2]+=dz;const p=F[f].props[0].points;for(const i of [0,1,2,3,4]){p[i][2]+=dz;}
   F[f].armL.pos[2]+=dz;F[f].armR.pos[2]+=dz;}
  const RX=+(process.env.RX||-0.08);F.start.armR.pos=[RX,0.72+(+(process.env.RY||0)),0.30];F.start.armR.pole=[-0.6,0.1,-1];F.start.armR.palm=[0.3,0.4,0.9];F.start.props[0].points[4]=[RX,0.70+(+(process.env.RY||0)),0.30];F.start.armL.pos[0]=0.21;F.start.armL.pos[2]=0.19;F.start.props[0].points[0]=[0.21,0.51,0.23];
  towelFix(j);}
 if(s==='seated-thigh-lift-curl'){F.end.legL.pos[2]+=0.12;F.end.legL.pos[1]-=0.04;for(const f in F){F[f].armL.pos[0]=0.24;F[f].armL.palm=[f==='start'?-0.4:0.05,1,0.15];F[f].armL.fingers=[0.4,F[f].armL.fingers[1],0.9];F[f].armR.pos[0]-=0.03;}
  F.end.armL.pos[2]-=0.06;F.end.armL.pos[1]-=0.04;}
 fix(s,j);post(s,j);
 fs.writeFileSync(D+s+'.json',JSON.stringify(j,null,1));}

function fix(s,j){const F=j.frames,N=(a,b)=>a.map((v,i)=>+(v+b[i]).toFixed(4));
 if(s==='supine-elbow-row'||s==='hips-up-elbow-row'){
  j.qaAllow={'rom:horizontal-pull.stretch':'floor elbow row is a bent-arm drive by design: the forearms stay vertical (about 90 deg) and the elbows press into the floor; there is no long-arm start'};}
 if(s==='seated-towel-row'){
  const fz=+(process.env.FZ||0.86),fz2=+(process.env.FZ2||0.76),ry=+(process.env.RY||0.11);
  const mk=(z,y,hz,hy,hx)=>({legL:{pos:[0.1,y,z]},legR:{pos:[-0.1,y,z]},hz,hy,hx});
  const set=(f,ankZ,ankY,hx,hy,hz)=>{const fr=F[f];fr.root.pos[1]=ry;
   for(const k of ['legL','legR']){fr[k].pos=[k==='legL'?0.1:-0.1,ankY,ankZ];}
   fr.armL.pos=[hx,hy,hz];fr.armR.pos=[-hx,hy,hz];
   const P=fr.props[0].points,fy=ankY+0.03,fzz=ankZ+0.08;
   P[0]=[hx,hy,hz];P[5]=[-hx,hy,hz];P[1]=[0.16,fy,fzz-0.02];P[2]=[0.1,fy,fzz];P[3]=[-0.1,fy,fzz];P[4]=[-0.16,fy,fzz-0.02];};
  const mid=JSON.parse(JSON.stringify(F.start));F.mid=mid;
  set('start',fz,0.07,0.2,+(process.env.HY||0.5),+(process.env.HZ||0.7));
  set('mid',(fz+fz2)/2,0.16,0.28,0.46,0.38);
  set('end',fz2,0.07,0.31,0.44,0.17);
  {const L0=dist(F.start.props[0].points[0],F.start.props[0].points[1]);
   for(const f of ['mid','end'])for(const [h,ft,arm,sg] of [[0,1,'armL',1],[5,4,'armR',-1]]){const P=F[f].props[0].points,d=P[h].map((v,i)=>v-P[ft][i]),l=Math.hypot(...d);
    P[h]=P[ft].map((v,i)=>+(v+d[i]/l*L0).toFixed(4));F[f][arm].pos=[...P[h]];}}
  F.mid.root.pitch=0;F.mid.spine={flex:-2};
  const o={};for(const k of ['start','mid','end'])o[k]=F[k];j.frames=o;
 }
 if(s==='knee-grip-lean-back-curl'){const a=+(process.env.SP||-22),b=+(process.env.EP||6);
  for(const f in F){F[f].armL.pos[1]+=0.1;F[f].armR.pos[1]+=0.1;}F.start.root.pitch=a;F.start.root.pos[2]=+(process.env.SZ||-0.08);F.end.root.pitch=b;F.end.root.pos[2]=+(process.env.EZ||0.04);}
 if(s==='door-frame-one-arm-row'||s==='door-frame-one-arm-curl'||s==='door-frame-deep-lean-row'){
  const dz=+(process.env.DZ0||-0.06),dp=+(process.env.DP0||-4);
  const fz=+(process.env.FZ0||-0.17),ry0=+(process.env.RY0||-0.03);
  for(const f in F){for(const k of ['legL','legR'])F[f][k].pos[2]+=fz;}
  F.start.root.pos[2]+=dz;F.start.root.pitch+=dp;F.start.root.pos[1]+=ry0;F.end.root.pos[2]+=+(process.env.EZ0||0);}
 if(s==='seated-thigh-lift-curl'){for(const f of ['start','end']){F[f].armL.contact=false;F[f].armR.contact=false;}
  F.end.root.pitch=+(process.env.EP||14);F.end.neck.flex=0;F.end.legL.pos[1]+=+(process.env.LY||-0.04);F.end.legL.pos[2]+=+(process.env.LZ||0);F.end.armL.pos[1]+=+(process.env.HY||0.03);F.end.armL.pos[2]+=+(process.env.HZ||-0.03);}
 if(s==='seated-towel-foot-curl'){const e=process.env;
  const hs={start:[0.25,+(e.HS||0.52),0.0],mid:[0.26,0.72,0.1],end:[0.26,+(e.HE||0.9),0.2]};
  const len=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  for(const f of ['start','mid','end'])F[f].legR.pos=[-0.24,0,0.3];
  let L0l,L0r;
  for(const f of ['start','mid','end']){const fr=F[f],P=fr.props[0].points,a=fr.legL.pos;
   P[1]=[a[0]+0.05,a[1]-0.07,a[2]+0.03];P[2]=[a[0],a[1]-0.09,a[2]+0.04];P[3]=[a[0]-0.06,a[1]-0.07,a[2]+0.03];
   const tl=hs[f],tr=[-tl[0],tl[1],tl[2]];
   if(f==='start'){P[0]=tl;P[4]=tr;L0l=len(tl,P[1]);L0r=len(tr,P[3]);}
   else{const adj=(h,ft,t,L)=>{const d=t.map((v,i)=>v-ft[i]),l=Math.hypot(...d);return ft.map((v,i)=>+(v+d[i]/l*L).toFixed(4));};
    P[0]=adj(0,P[1],tl,L0l);P[4]=adj(4,P[3],tr,L0r);}
   fr.armL.pos=[...P[0]];fr.armR.pos=[...P[4]];
   fr.armL.pole=[0.3,-0.3,-1];fr.armR.pole=[-0.3,-0.3,-1];
   fr.armL.palm=[-0.1,0.9,0.2];fr.armR.palm=[0.1,0.9,0.2];fr.armL.fingers=[0,0.2,1];fr.armR.fingers=[0,0.2,1];}}
}

function post(s,j){const F=j.frames;
 if(s==='hips-up-elbow-row'){F.end.root=JSON.parse(JSON.stringify(F.start.root));F.start.neck.flex=36;F.end.neck.flex=36;
  j.tempo={lift:'there',up:1.0,down:1.8,squeeze:0.5};}
 if(s==='knee-grip-lean-back-curl'){F.end.root.pitch=4;F.end.root.pos[2]=F.start.root.pos[2]+0.04;F.end.neck.flex=3;}
 if(s==='seated-knee-grip-row'){F.end.root.pitch=-8;F.end.neck.flex=14;delete F.end.spine;}
 if(s==='seated-towel-row'){F.end.root.pitch=-1;F.end.spine={flex:-1};}
 if(s==='seated-towel-foot-curl'){j.camera={az:70,el:8};j.muscleSide='L';}
 if(s==='door-frame-one-arm-curl'){j.camera={az:65,el:12};}
}
