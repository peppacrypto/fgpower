// Generator: reads base poses (home-program specs) from towel-base/, applies fixes, writes specs/<slug>.json
import fs from 'fs'; import path from 'path'; import {fileURLToPath} from 'url';
const d = path.dirname(fileURLToPath(import.meta.url));
const load = s => JSON.parse(fs.readFileSync(path.join(d,'towel-base',s+'.json'),'utf8'));
const fr = s => Object.values(s.frames);
const out = {};
const each = (s,f)=>fr(s).forEach(f);

// prone T / Y : raise body off floor sink, pull hands in slightly
for (const [slug,dz] of [['prone-t-raise',0],['prone-y-raise',0]]) {
  const s = load(slug);
  each(s,f=>{ f.root.pos[1]+=0.026; for(const a of ['armL','armR']){ f[a].pos[1]+=0.0; } });
  out[slug]=s;
}
// body pull / prone pulldown
for (const slug of ['towel-floor-body-pull','prone-towel-pulldown']) {
  const s = load(slug);
  each(s,f=>{ f.root.pos[1]+=0.015; });
  out[slug]=s;
}
for (const slug of ['towel-lateral-raise','towel-one-arm-pulldown','towel-overhead-triceps']) out[slug]=load(slug);

const patch = fs.existsSync(path.join(d,'towel-patch.mjs')) ? (await import('./towel-patch.mjs')).default : ()=>{};
patch(out);
// --- pass 2 (2026-11-13): textbook range, full reach (bar 0.62 m from the shoulder joint)
{ const sp=out['towel-lateral-raise']; const F=sp.frames; const base=F.mid; const fr={};
  const R=0.60, ang=[['start',8],['mid',30],['mid2',55],['mid3',75],['end',92]];
  for(const [k,th] of ang){ const t=th*Math.PI/180; const R=0.615; const f=JSON.parse(JSON.stringify(k=='start'?F.start:F.end));
    f.armL.pos=[+(0.19+R*Math.sin(t)).toFixed(3),+(1.38-R*Math.cos(t)).toFixed(3),0.06];
    f.armL.fingers=[+Math.sin(t).toFixed(3),+(-Math.cos(t)).toFixed(3),0]; f.armL.palm=[+(-Math.cos(t)).toFixed(3),+(-Math.sin(t)).toFixed(3),0];
    f.armL.pole=[Math.sin(t)*0.5, -Math.cos(t)*0.9-0.1, -0.4];
    if(k!='start'&&k!='end'){ f.armR.pos=[-0.31+0.4*th/92,0.915+0.2*th/92,0.2]; }
    fr[k]=f; }
  fr.start.armR.pos=[-0.31,0.915,0.15]; fr.end.armR.pos=[0.0,1.10,0.28];
  sp.frames=fr; }
{ const F=out['towel-overhead-triceps'].frames; F.end.armL.pos=[0.14,2.07,-0.04]; F.mid.armL.pos=[0.12,1.84,-0.17]; }
// prone T / Y: hands travel an arc (start on the floor, mid, end lifted) so the arms stay long in the in-betweens
for(const [slug,pts] of [['prone-t-raise',[[0.68,0.1,0.45],[0.68,0.26,0.45],[0.64,0.45,0.45]]],['prone-y-raise',[[0.58,0.09,0.82],[0.55,0.27,0.78],[0.50,0.50,0.72]]]]){
  const sp=out[slug], base=sp.frames.start, e=sp.frames.end, names=['start','mid','end'], F={};
  pts.forEach((p,i)=>{ const f=JSON.parse(JSON.stringify(i==0?base:e)); for(const [a,g] of [['armL',1],['armR',-1]]){ f[a].pos=[g*p[0],p[1],p[2]]; if(i==1){ const t=0.5; f[a].fingers=base[a].fingers.map((v,j)=>+(v*(1-t)+e[a].fingers[j]*t).toFixed(3)); } } F[names[i]]=f; });
  sp.frames=F;
}
// NEW: standing-towel-triceps-extension (partner holds the far end: drawn alone, see plan/cannot-show.json) - overhead-triceps geometry, both hands mirrored on one end
{ const sp=JSON.parse(JSON.stringify(out['towel-overhead-triceps'])); sp.slug='standing-towel-triceps-extension'; delete sp.muscleSide; sp.camera={az:35,el:8};
  const m=v=>[-v[0],v[1],v[2]];
  for(const f of Object.values(sp.frames)){ const L=f.armL; L.pos[0]=0.08; f.armR={...JSON.parse(JSON.stringify(L)),pos:m(L.pos),fingers:m(L.fingers),palm:m(L.palm),pole:[-L.pole[0],L.pole[1],L.pole[2]]}; f.props=[{type:'towel-strip',hands:true,length:0.2}]; }
  out[sp.slug]=sp; }

// --- pass 3 (2026-11-13, coach audit3): straight arms, taut towels, clear paths
const J=o=>JSON.parse(JSON.stringify(o)); const r3=v=>v.map(x=>+x.toFixed(3));
const reachTo=(sh,dir,R=0.615)=>{const n=Math.hypot(...dir);return r3(sh.map((c,i)=>c+R*dir[i]/n));};
// prone T raise: straight arms in line with the shoulders, both sides equal, forehead just off the floor, chest slightly up
{ const sp=out['prone-t-raise']; const F=sp.frames; const S=[0.19,0.2,0.46];
  [["start",4,2,-3],['mid',20,0,-8],['end',48,0,-12]].forEach(([k,el,_,sf])=>{ const f=F[k]; const e=el*Math.PI/180;
    for(const [a,g] of [['armL',1],['armR',-1]]){ f[a].pos=reachTo([g*S[0],S[1],S[2]],[g*Math.cos(e),Math.sin(e),k=='start'?0.25:k=='mid'?0.1:-0.05],k=='end'?0.56:0.52); f[a].pole=[0,-0.3,-1]; f[a].curl=0.3; }
    f.spine={flex:sf}; f.neck={flex:-4}; }); }
// prone Y raise: legs together, Y at ~30 deg to the head line, straight arms, side camera, one smooth lift
{ const sp=out['prone-y-raise']; sp.camera={az:78,el:10}; sp.tempo={lift:'there',up:1,down:1.8,squeeze:0.35,stretch:0.2}; const F=sp.frames; const S=[0.19,0.2,0.46];
  [['start',-10,-3],['mid',15,-7],['end',42,-12]].forEach(([k,el,sf])=>{ const f=F[k]; const e=el*Math.PI/180, y=45*Math.PI/180;
    for(const [a,g] of [['armL',1],['armR',-1]]){ f[a].pos=reachTo([g*S[0],S[1],S[2]],[g*Math.sin(y)*Math.cos(e),Math.sin(e),Math.cos(y)*Math.cos(e)],0.53); f[a].pole=[g*0.7,-0.3,-0.7]; }
    for(const l of ['legL','legR']) f[l].fk={flex:6,abd:0,knee:0};
    f.spine={flex:sf}; f.neck={flex:-4}; }); }
// prone towel pulldown: taut towel, long arms start, elbows to the ribs, chest barely off the floor
{ const sp=out['prone-towel-pulldown']; const F=sp.frames; sp.camera={az:75,el:10};
  const H={start:[[0.36,0.30,1.04],[0.1,0.1,1],[0.8,0.6,-0.3]],mid:[[0.36,0.28,0.78],[0,0,1],[1,0.5,-0.4]],end:[[0.38,0.19,0.58],[0,0,1],[1,0.3,-0.5]]};
  for(const k of ['start','mid','end']){ const f=F[k]; const [p,fi,po]=H[k]; f.spine={flex:-6}; f.neck={flex:-3};
    for(const [a,g] of [['armL',1],['armR',-1]]){ f[a].pos=[g*p[0],p[1],p[2]]; f[a].fingers=[g*fi[0],fi[1],fi[2]]; f[a].palm=[0,-1,0]; f[a].pole=[g*po[0],po[1],po[2]]; }
    f.props=[{type:'towel-strip',hands:true,length:0.72}]; } }
// floor body pull: towel clearly visible and wide under the hips and thighs, body travels, neck neutral
{ const sp=out['towel-floor-body-pull']; for(const [k,f] of Object.entries(sp.frames)){ f.spine={flex:-3}; f.neck={flex:-2}; f.props[0].width=0.62; f.props[0].depth=0.8; f.props[0].pos[2]+= -0.05; } }
// one-arm pulldown: towel clear of the face, elbow down and back to the ribs, hands to chest level
{ const sp=out['towel-one-arm-pulldown']; const F=sp.frames; sp.camera={az:55,el:6};
  const P={start:{L:[0.12,1.68,0.27],R:[0.0,1.90,0.27],pl:[1,0.4,-0.2]},mid:{L:[0.20,1.50,0.29],R:[0.10,1.76,0.29],pl:[1,-0.2,-0.6]},end:{L:[0.27,1.24,0.30],R:[0.17,1.50,0.30],pl:[0.5,-1,-1]}};
  for(const k of ['start','mid','end']){ const f=F[k]; f.neck={flex:0}; f.spine={flex:0};
    f.armL.pos=P[k].L; f.armL.pole=P[k].pl; f.armL.fingers=[-0.75,0.55,0.1]; f.armL.palm=[0.3,-0.3,0.9]; delete f.armL.scap;
    f.armR.pos=P[k].R; f.armR.pole=[-1,0.2,-0.1]; f.armR.fingers=[0.05,1,0.03]; f.armR.palm=[0.8,-0.1,0.2]; f.armR.scap={elev:k=='start'?20:0};
    f.props=[{type:'towel-strip',hands:true,length:0.28}]; } }
// lateral raise: resisting hand low by the hip, working arm 30 deg forward of the frontal plane, taut towel
{ const sp=out['towel-lateral-raise']; sp.camera={az:35,el:6}; const F=sp.frames;
  for(const [k,f] of Object.entries(F)){ const th=Math.atan2(f.armL.pos[0]-0.19,1.38-f.armL.pos[1]); const R=0.615;
    f.armL.pos=r3([0.19+R*Math.sin(th)*Math.cos(0.5),1.38-R*Math.cos(th),R*Math.sin(th)*Math.sin(0.5)+0.02]);
    const t=k=='start'?0:(Math.min(th,1.6)/1.6); f.armR.pos=r3([-0.2+0.06*t,0.84+0.1*t,0.12+0.06*t]); f.armR.pole=[-1,-0.7,-0.2]; if(th>1.2){f.armL.fingers=[0.87,0,0.5]; f.armL.palm=[0,-1,0];}
    f.props=[{type:'towel-strip',hands:true,length:0.5}]; } }
// overhead triceps: lower hand grips the towel, upper arm fixed by the ear, towel taut
{ const sp=out['towel-overhead-triceps']; const F=sp.frames; const len=0.8;
  const U={start:[0.10,1.56,-0.12],mid:[0.12,1.84,-0.17],end:[0.12,2.08,-0.02]}; const Rx={start:-0.12,mid:-0.10,end:-0.06};
  for(const k of ['start','mid','end']){ const f=F[k]; f.armL.pos=U[k]; f.armL.pole=k=='end'?[0.6,0.1,-0.3]:[0.15,1,0.1]; f.armL.hand='grip'; f.armL.grip=0.022;
    const RY={start:0.88,mid:1.012,end:1.21}, RF={start:[0.25,-0.9,-0.1],mid:[0.25,-0.6,-0.1],end:[0.25,-0.3,-0.1]}, RX={start:-0.126,mid:-0.085,end:-0.035};
    f.armR.pos=[RX[k],RY[k],-0.165]; f.armR.hand='grip'; f.armR.grip=0.022; f.armR.fingers=RF[k]; f.armR.palm=[0,0.1,-1]; f.armR.pole=[-1,-0.2,-0.5-0.1*['start','mid','end'].indexOf(k)];
    f.props=[{type:'towel-strip',hands:true,length:0.7}]; } }
// standing towel triceps extension: towel visible between spread hands, upper arms fixed by the ears, head neutral
{ const sp=out['standing-towel-triceps-extension']; const F=sp.frames; sp.camera={az:70,el:8};
  const U={start:[0.11,1.52,-0.19],mid:[0.12,1.84,-0.17],end:[0.12,2.08,0.0]};
  for(const k of ['start','mid','end']){ const f=F[k]; f.neck={flex:0}; const L=f.armL; L.pos=U[k]; L.hand='grip'; L.grip=0.022; L.pole=k=='end'?[0.8,0.1,-0.3]:[0.15,1,0.1]; if(k=='mid'){L.fingers=[-0.1,0.7,-0.7]; L.palm=[-0.5,-0.7,0.1];}
    f.armR={...J(L),pos:[-U[k][0],U[k][1],U[k][2]],fingers:[-L.fingers[0],L.fingers[1],L.fingers[2]],palm:[-L.palm[0],L.palm[1],L.palm[2]],pole:[-L.pole[0],L.pole[1],L.pole[2]]};
    f.props=[{type:'towel-strip',hands:true,length:0.22,tail:0.3}]; } }
for (const [slug,s] of Object.entries(out)) fs.writeFileSync(path.join(d,'..',slug+'.json'), JSON.stringify(s));
