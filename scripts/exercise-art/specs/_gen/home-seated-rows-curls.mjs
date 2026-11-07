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
 if(s==='door-frame-deep-lean-row'){F.end.armL.pos=[...F.start.armL.pos];F.end.armL.pole=[0.9,0.5,0.3];F.end.armL.fingers=[...F.start.armL.fingers];F.end.armL.palm=[...F.start.armL.palm];F.start.armL.pos[0]+=0.025;F.end.armL.pos[0]+=0.025;}
 if(s==='door-frame-one-arm-row')F.end.armL.pos=[...F.start.armL.pos];
 if(s.startsWith('door-frame')) for(const f in F){F[f].armR.pos=[-0.23,-0.02,0.06];F[f].armR.pole=[-1,0,-0.4];}
 if(s==='door-frame-one-arm-curl')F.end.armL.pos[0]+=0.02;
 if(s==='seated-knee-grip-row'||s==='knee-grip-lean-back-curl') for(const f in F){F[f].armL.pos[0]+=0.02;F[f].armR.pos[0]-=0.02;F[f].armL.fingers=[-0.55,-0.75,0.15];F[f].armR.fingers=[0.55,-0.75,0.15];F[f].armL.palm=[0.05,0.5,-0.85];F[f].armR.palm=[-0.05,0.5,-0.85];}
 if(s==='hips-up-elbow-row'){F.start.neck.flex=36;
  F.end.armL.pos[0]=0.25;F.end.armR.pos[0]=-0.25;F.end.armL.fingers=[-0.35,1,0];F.end.armL.palm=[-1,-0.35,0];F.end.armR.fingers=[0.35,1,0];F.end.armR.palm=[1,-0.35,0];}
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
  F.start.armR.pos=[0,0.72,0.24];F.start.armR.pole=[-0.6,0.1,-1];F.start.armR.palm=[0.3,0.4,0.9];F.start.props[0].points[4]=[0.0,0.70,0.24];F.start.armL.pos[0]=0.21;F.start.armL.pos[2]=0.19;F.start.props[0].points[0]=[0.21,0.51,0.23];
  towelFix(j);}
 if(s==='seated-thigh-lift-curl'){F.end.legL.pos[2]+=0.12;F.end.legL.pos[1]-=0.04;for(const f in F){F[f].armL.pos[0]=0.24;F[f].armL.palm=[f==='start'?-0.4:0.05,1,0.15];F[f].armL.fingers=[0.4,F[f].armL.fingers[1],0.9];F[f].armR.pos[0]-=0.03;}
  F.end.armL.pos[2]-=0.06;F.end.armL.pos[1]-=0.04;}
 fs.writeFileSync(D+s+'.json',JSON.stringify(j,null,1));}
