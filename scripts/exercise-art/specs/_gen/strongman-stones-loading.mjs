import fs from 'fs';
const G=n=>JSON.parse(fs.readFileSync(new URL(`../_gallery/${n}.json`,import.meta.url)));
const out=(slug,g,over={})=>fs.writeFileSync(new URL(`../${slug}.json`,import.meta.url),JSON.stringify({...g,slug,...over},null,1));
out('atlas-stones',G('atlas-stone'));
// trainer: nearest prop is the atlas stone (no pipe-with-plates prop)
out('atlas-stone-trainer',G('atlas-stone'),{muscles:['spinal-erectors','glutes','hamstrings']});
out('circus-bell',G('circus-dumbbell'));
out('keg-load',G('keg'));
out('log-lift',G('log-bar'));
out('sandbag-load',G('loading-sandbag'));
out('tire-flip',G('tractor-tire'));
// power stairs: tire swung up onto a platform, nearest = tire lift
out('power-stairs',G('tractor-tire'),{muscles:['hamstrings','glutes','quadriceps']});
// ---- keg: wider stance, keg held farther forward, same feet start/end
{ const g=G('keg'); const f=g.frames;
  const X=0.34, Z=0.0;
  for (const k of ['start','end']) { f[k].legL.pos=[X,0,Z]; f[k].legR.pos=[-X,0,Z]; f[k].legL.pole=[0.4,0,1]; f[k].legR.pole=[-0.4,0,1];
    f[k].legL.yaw=12; f[k].legR.yaw=-12; }
  f.start.props[0].at[2]=0.46; f.start.armL.pos[2]=0.46; f.start.armR.pos[2]=0.46;
  f.end.root.pos[1]=0.895; f.end.props[0].at[2]=0.36; f.end.armL.pos[2]=0.36; f.end.armR.pos[2]=0.36;
  { const cl=o=>JSON.parse(JSON.stringify(o)); const E=f.end;
    const pose=(b,rootPos,pitch,y,z,pole)=>{ b.root={pos:rootPos,pitch}; b.props[0].at=[0,y,z]; for (const [k,m] of [['armL',1],['armR',-1]]) { b[k].pos=[0.3*m,+(y-0.06).toFixed(3),z]; if (y>1.3) { b[k].fingers=[-0.3*m,0,0.95]; b[k].palm=[0,1,0]; } b[k].pole=y>1.3?[0,-1,-0.2]:[pole[0]*m,pole[1],pole[2]]; } return b; };
    const hug=pose(cl(E),[0,0.9,-0.04],-4,1.14,0.29,[0.9,-0.6,-0.5]);
    const lift=pose(cl(E),[0,0.9,0.0],2,1.5,0.5,[0.9,-0.5,-0.4]);
    pose(E,[0,0.88,0.04],16,1.41,0.74,[0.9,-0.3,-0.3]);
    g.props[0].pos=[0,0,0.82];
    const pull=pose(cl(E),[0,0.72,-0.14],42,0.72,0.58,[0.9,0.2,-0.4]); for (const k of ['armL','armR']) Object.assign(pull[k],{fingers:f.start[k].fingers,palm:f.start[k].palm,pos:[pull[k].pos[0],0.66,0.58]});
    g.frames={start:f.start,pull,mid:hug,mid2:lift,end:E}; }
  out('keg-load',g); }
// ---- sandbag: bag farther forward, feet fixed
{ const g=G('loading-sandbag'); const f=g.frames; const X=0.36;
  for (const k of ['start','end']) { f[k].legL.pos=[X,0,0]; f[k].legR.pos=[-X,0,0]; f[k].legL.yaw=12; f[k].legR.yaw=-12; }
  f.start.props[0].at[2]=0.30; f.start.armL.pos[2]=0.34; f.start.armR.pos[2]=0.34;
  f.end.root.pos[1]=0.9; f.end.props[0].at[2]=0.30; f.end.armL.pos[2]=0.34; f.end.armR.pos[2]=0.34;
  for (const k of ['start','end']) { f[k].legL.pole=[1,0,0.9]; f[k].legR.pole=[-1,0,0.9]; f[k].legL.yaw=25; f[k].legR.yaw=-25; }
  {const SP=JSON.parse(process.env.SP||'[1.6,1.4,-0.2]'); f.start.armL.pole=SP; f.start.armR.pole=[-SP[0],SP[1],SP[2]];} f.end.armL.pos[2]=0.31; f.end.armR.pos[2]=0.31; f.end.props[0].at[2]=0.27;
  for (const k of ['start','end']) for (const a of ['armL','armR']) { delete f[k][a].contact; f[k][a].hand='hook'; }
  { const cl=o=>JSON.parse(JSON.stringify(o)); const E=f.end;
    const pose=(b,rootPos,pitch,y,z,hz,pole)=>{ b.root={pos:rootPos,pitch}; b.props[0].at=[0,y,z]; for (const [k,m] of [['armL',1],['armR',-1]]) { b[k].pos=[0.2*m,+(y-0.13).toFixed(3),hz]; if (y>1.15) { b[k].fingers=[-0.12*m,0,0.97]; b[k].palm=[0,1,0]; b[k].curl=0.5; delete b[k].hand; } b[k].pole=y>1.4?[0,-1,-0.2]:[pole[0]*m,pole[1],pole[2]]; } return b; };
    const hug=pose(cl(E),[0,0.9,-0.04],-4,1.2,0.3,0.32,[0.9,-0.6,-0.5]);
    const lift=pose(cl(E),[0,0.9,0.0],2,1.6,0.48,0.5,[0.9,-0.5,-0.4]);
    pose(E,[0,0.88,0.03],18,1.48,0.71,0.73,[0.9,-0.3,-0.3]);
    g.props[0].pos=[0,0,0.8];
    g.frames={start:f.start,mid:hug,mid2:lift,end:E}; }
  out('sandbag-load',g); }
// ---- atlas stones: platform back 0.2, wide stance, lap frame between floor and chest
function atlas(slug, over={}) {
  const g=G('atlas-stone'); const f=g.frames; const cl=o=>JSON.parse(JSON.stringify(o));
  g.props[0].pos=[0,0,0.98];
  const X=0.44;
  for (const k of ['start','mid']) { f[k].legL.pos=[X,0,0]; f[k].legR.pos=[-X,0,0]; f[k].legL.pole=[0.8,0,1]; f[k].legR.pole=[-0.8,0,1]; f[k].legL.yaw=18; f[k].legR.yaw=-18; }
  const setStone=(fr,y,z,hx=0.225)=>{ fr.props[0].at=[0,y,z];
    for (const [k,m] of [['armL',1],['armR',-1]]) { const o=[hx,-0.11,-0.09], r=Math.hypot(...o), n=o.map(v=>v/r);
      const up=[0,1,0], d=n[1]; const dn=up.map((v,i)=>-(v-d*n[i])), dl=Math.hypot(...dn);
      const nx=v=>[v[0]*m,v[1],v[2]];
      Object.assign(fr[k],{pos:[o[0]*m,y+o[1],z+o[2]],fingers:nx(dn.map((v,i)=>v/dl+0.35*n[i])),palm:nx(n.map(v=>-v)),curl:0.3}); } };
  setStone(f.start,0.238,0.12,0.244);
  {const SP=JSON.parse(process.env.SP||'[1.6,1.4,-0.2]'); f.start.armL.pole=SP; f.start.armR.pole=[-SP[0],SP[1],SP[2]];} f.start.root.pos[1]+=0.02;
  // lap: stone on the thighs
  const lap=cl(f.mid); lap.root={pos:[0,0.66,-0.2],pitch:48}; lap.spine={flex:10}; lap.neck={flex:-25}; setStone(lap,0.64,0.40);
  lap.armL.pole=[0.3,0.2,-1]; lap.armR.pole=[-0.3,0.2,-1];
  // chest: standing, stone high
  const ch=cl(f.mid); ch.root={pos:[0,0.875,-0.02],pitch:-6}; ch.spine={flex:-4}; ch.neck={flex:-4};
    setStone(ch,1.0,0.34);
  f.end.root.pos[2]=0.0; f.end.root.pos[1]=0.86; for (const k of ['legL','legR']) { f.end[k].pos=[(k=='legL'?1:-1)*0.44,0,0]; f.end[k].yaw=(k=='legL'?18:-18); f.end[k].pole=[(k=='legL'?0.8:-0.8),0,1]; }
  setStone(f.end,1.36,0.66);
  for (const [k,m] of [['armL',1],['armR',-1]]) Object.assign(f.end[k],{pos:[0.255*m,1.26,0.66],fingers:[-0.13*m*0-0.0*m+(-0.13*m)*-1*-1,-0.314,0.941],palm:[-0.992*m,0.041,-0.123],curl:0.3});
  const e=f.end; const EP=JSON.parse(process.env.EP||'[0.9,-0.3,-0.3]'); e.armL.pole=EP; e.armR.pole=[-EP[0],EP[1],EP[2]];
  const lift=cl(lap); lift.root={pos:[0,0.69,-0.2],pitch:57}; lift.spine={flex:14}; lift.neck={flex:-32}; setStone(lift,0.45,0.40);
  const LP=JSON.parse(process.env.LP||'[1,0.8,-0.3]'); lift.armL.pole=LP; lift.armR.pole=[-LP[0],LP[1],LP[2]];
  const m3=cl(f.end); m3.root.pos[2]=0.0; m3.root.pos[1]=0.86; m3.props[0].at=[0,1.5,0.56]; m3.armL.pos=[0.255,1.4,0.56]; m3.armR.pos=[-0.255,1.4,0.56]; m3.armL.pole=[0.6,-0.3,-0.5]; m3.armR.pole=[-0.6,-0.3,-0.5];
  f.end.props[0].at=[0,1.4,0.66]; f.end.armL.pos[1]=1.3; f.end.armR.pos[1]=1.3; f.end.armL.pos[2]=0.66; f.end.armR.pos[2]=0.66;
  f.end.root={pos:[0,0.86,-0.02],pitch:22}; f.end.props[0].at=[0,1.37,0.8]; g.props[0].pos=[0,0,0.94]; for (const [k,m] of [['armL',1],['armR',-1]]) { f.end[k].pos=[0.26*m,1.27,0.76]; f.end[k].pole=[0.9*m,-0.3,-0.3]; f.end[k].pole=[0.9*m,-0.3,-0.3]; }
  const lerp=(a,b,t)=>Array.isArray(a)?a.map((v,i)=>lerp(v,b[i],t)):(a&&typeof a=='object')?Object.fromEntries(Object.keys(a).map(k=>[k,k in b?lerp(a[k],b[k],t):a[k]])):(typeof a=='number'&&typeof b=='number')?a+(b-a)*t:a;
  const PW=JSON.parse(process.env.PW||'[1.6,0.9,0.1]'); const pre=lerp(f.start,lift,0.5); pre.armL.pole=PW; pre.armR.pole=[-PW[0],PW[1],PW[2]];
  g.frames={start:f.start,pre,mid:lift,mid2:lap,mid3:ch,mid4:m3,end:f.end};
  out(slug,g,over);
}
atlas('atlas-stones'); atlas('atlas-stone-trainer');
// ---- log lift
{ const g=G('log-bar'); const f=g.frames; const W=0.3;
  for (const k of ['start','mid','end']) { f[k].armL.pos[0]=W; f[k].armR.pos[0]=-W; }
  { const [fi,po,y,z]=JSON.parse(process.env.LM||'[[0,0.57,0.82],[-0.55,-1,0.1],1.2,0.3]'); for (const [k,m] of [['armL',1],['armR',-1]]) { f.mid[k].fingers=fi; f.mid[k].pole=[po[0]*m,po[1],po[2]]; f.mid[k].pos[1]=y; f.mid[k].pos[2]=z; } }
  for (const a of ['armL','armR']) { f.start[a].pos[2]=+(process.env.SZ||0.4); }
  const EY=+(process.env.EY||2.03); for (const a of ['armL','armR']) f.end[a].pos[1]=EY;
  const PF=JSON.parse(process.env.PF||'[0,-0.5,0.85]'), PY=+(process.env.PY||0.72);
  const pull=JSON.parse(JSON.stringify(f.mid)); pull.root={pos:[0,0.8,-0.05],pitch:20}; pull.spine={flex:3}; pull.neck={flex:-26};
  for (const [a,m] of [['armL',1],['armR',-1]]) { Object.assign(pull[a],{fingers:PF,pos:[0.3*m,PY,+(process.env.PZ||0.34)],pole:JSON.parse(process.env.PP||'[0.6,0.2,-0.6]').map((v,i)=>i==0?v*m:v)}); }
  const L2=(a,b,t)=>Array.isArray(a)?a.map((v,i)=>L2(v,b[i],t)):(a&&typeof a=='object')?Object.fromEntries(Object.keys(a).map(k=>[k,k in b?L2(a[k],b[k],t):a[k]])):(typeof a=='number'&&typeof b=='number')?a+(b-a)*t:a;
  const pull2=L2(pull,f.mid,0.5); { const P2=JSON.parse(process.env.P2||'null'); if (P2) for (const [a,m] of [['armL',1],['armR',-1]]) pull2[a].pole=[P2[0]*m,P2[1],P2[2]]; const F2=JSON.parse(process.env.F2||'null'); if (F2) for (const a of ['armL','armR']) pull2[a].fingers=F2; }
  const press=L2(f.mid,f.end,0.5); { const [PYY,PZZ,pf]=JSON.parse(process.env.PR||'[1.7,0.3,[0,0.9,0.4]]'); for (const [a,m] of [['armL',1],['armR',-1]]) { press[a].pos=[0.3*m,PYY,PZZ]; press[a].fingers=pf; } }
  g.frames={start:f.start,pull,pull2,mid:f.mid,press,end:f.end};
  g.qaAllow={'prop:log-bar':'the hands sit in the log handle windows; the check boxes the whole solid cheek around the window, so any real grip counts as inside'};
  out('log-lift',g); }

// ---- tire flip: the tire tilts about its far edge, explicit tilt per frame. The hands stay under the near lip of the tread (palms up,
// fingers along the bottom face; the lip at the hands' x, where the round tire's edge is): the drive with long arms and the chest at
// the tire, the L knee driving up (foot in the air) as it passes 40, the L foot landing forward, and the push through with long arms
// as the body stands tall into it. The R ball of the foot stays on its spot, its heel rising.
function tireFlip() {
  const P={T:[0, 25, 40, 45, 58],HX:0.28,FX:0.13,FZ:-0.2,LZ:0.18,yaw:6,kx:0.12,
    start:{root: [0, 0.555, -0.47], pitch: 65, flex: 12, neck: -34, pole: [0.3, -0.4, -1]},
    mid:{root: [-0.13, 0.79, -0.36], pitch: 45, flex: 5, neck: -26, pole: [0.3, -0.5, -1]},
    mid2:{root: [-0.13, 0.8, -0.36], pitch: 38, flex: 3, neck: -18, foot: [0.13, 0.24, 0.06], fpitch: 30, pole: [0.3, -0.6, -1]},
    mid3:{root: [-0.13, 0.78, -0.33], pitch: 40, flex: 3, neck: -16, pole: [0.3, -0.6, -1]},
    end:{root: [0, 0.86, 0.0], pitch: 22, flex: 3, neck: -10, pole: [0.3, -0.6, -1]},
    out:0.0,curl:0.8,flat:false,rpitch:[0, 0, 0, 0, 35],...JSON.parse(process.env.TF||'{}')};
  const g=G('tractor-tire'); const R=d=>d*Math.PI/180, rd=x=>Math.round(x*1000)/1000;
  const se=0.725+Math.sqrt(0.725*0.725-P.HX*P.HX); // the near edge's distance from the pivot at the hands' x
  const lip=a=>[0.06*Math.cos(R(a))+se*Math.sin(R(a)),1.45-se*Math.cos(R(a))+0.06*Math.sin(R(a))];
  const ball=(m,z,o2={})=>({pos:[P.FX*m,0,z],anchor:'ball',pitch:0,yaw:P.yaw*m,pole:[P.kx*m,0,1],...o2});
  const body=q=>({root:{pos:q.root,pitch:q.pitch},spine:{flex:q.flex},neck:{flex:q.neck}});
  const under=(f,a,po)=>{ const [y,z]=lip(a), s=Math.sin(R(a)), c=Math.cos(R(a));
    for (const [k,m] of [['armL',1],['armR',-1]]) f[k]={pos:[P.HX*m,rd(y-P.out*c),rd(z-P.out*s)],contact:true,fingers:[0,rd(-s),rd(c)],palm:[0,rd(c),rd(s)],...(P.flat?{hand:'flat'}:{curl:P.curl}),pole:[po[0]*m,po[1],po[2]]}; };
  const start={...body(P.start),legL:ball(1,P.FZ),legR:ball(-1,P.FZ)};
  const mid={...body(P.mid),legL:ball(1,P.FZ),legR:ball(-1,P.FZ)};
  const mid2={...body(P.mid2),legL:{pos:P.mid2.foot,anchor:'ball',pitch:P.mid2.fpitch,yaw:6,pole:[0.12,0.3,1]},legR:ball(-1,P.FZ,{pitch:P.rpitch[2]})};
  const mid3={...body(P.mid3),legL:ball(1,P.LZ),legR:ball(-1,P.FZ,{pitch:P.rpitch[3]})};
  const end={...body(P.end),legL:ball(1,P.LZ),legR:ball(-1,P.FZ,{pitch:P.rpitch[4]})};
  const F=[start,mid,mid2,mid3,end], N=['start','mid','mid2','mid3','end'];
  F.forEach((f,i)=>{ under(f,P.T[i],P[N[i]].pole); f.props=[{type:'tractor-tire',pos:[0,0,0.725],tilt:P.T[i]}]; });
  g.props=[]; g.camera={az:62,el:10}; g.muscles=['quadriceps','glutes','hamstrings']; g.tempo={lift:'there'}; // one drive: the knee lifting is not a lowering
  g.frames={start,mid,mid2,mid3,end}; out('tire-flip',g);
}
tireFlip();

// ---- power stairs: wide stance at the foot of the stairs, the implement between the feet; hips and knees stand it up, the arms
// pull it up past the first step's edge, and it is set on the step with long arms. Feet stay planted.
function powerStairsSpec() {
  const P={FX:0.34,FZ:-0.3,yaw:22,pole:[0.8,0.2,-0.6],
    start:{root:[0,0.82,-0.64],pitch:35,flex:8,neck:-30,h:[0.56,-0.36]},
    mid:{root:[0,0.9,-0.46],pitch:4,flex:0,neck:-6,h:[0.84,-0.2]},
    mid2:{root:[0,0.905,-0.5],pitch:-4,flex:-3,neck:0,h:[1.0,-0.15]},
    end:{root:[0,0.9,-0.4],pitch:12,flex:2,neck:4,h:[0.98,0.15]},
    ...JSON.parse(process.env.PS||'{}')};
  const g=G('power-stairs');
  g.props=[{type:'power-stairs',pos:[0,0,0],steps:3},{type:'power-stairs-weight',hands:true}];
  const foot=m=>({pos:[P.FX*m,0,P.FZ],anchor:'ball',pitch:0,yaw:P.yaw*m,pole:[0.6*m,0,1]});
  const fr=q=>{ const f={root:{pos:q.root,pitch:q.pitch},spine:{flex:q.flex},neck:{flex:q.neck},legL:foot(1),legR:foot(-1)};
    for (const [k,m] of [['armL',1],['armR',-1]]) f[k]={pos:[0.055*m,q.h[0],q.h[1]],hand:'grip',grip:0.022,fingers:q.fi||[0,-1,0],palm:q.pa||[0,0,-1],pole:[(q.pole||P.pole)[0]*m,(q.pole||P.pole)[1],(q.pole||P.pole)[2]]};
    return f; };
  g.camera={az:70,el:10}; g.muscles=['hamstrings','glutes','quadriceps']; g.tempo={lift:'there'}; // pull and set on the step: one lift
  g.frames={start:fr(P.start),mid:fr(P.mid),mid2:fr(P.mid2),end:fr(P.end)}; out('power-stairs',g);
}
powerStairsSpec();

// ---- circus bell: the bell between the feet, axis forward; both hands on the handle (the R hand on the thumb side, the bell held
// off-centre by half a hand so the L hand fits beside it), cleaned up in front of the body with a hammer-curl turn to the R
// shoulder, the thumb-side head up behind the shoulder; the L hand lets go, the bell centres in the R hand, a dip and a drive to
// a one-arm lockout overhead (neutral grip, axis front to back). Feet planted.
function circusBell() {
  const P={d:0.24,FX:0.3,off:0.035,gap:0.085,kx:0.7,
    start:{root:[0,0.52,-0.32],pitch:50,flex:15,neck:-30,R:[0,0.135,0.09],f:[0,-1,0],p:[1,0,0],two:true,pR:[-1,0,-0.3],pL:[1,0,-0.3]},
    mid:{root:[0,0.78,-0.12],pitch:20,flex:5,neck:-10,R:[-0.08,0.75,0.42],f:[0.19,-0.78,0.6],p:[0.984,0.152,-0.114],two:true,pR:[-0.8,-0.3,-0.5],pL:[0.8,-0.3,-0.5]},
    mid2:{root:[0,0.915,-0.02],pitch:-3,flex:-4,neck:2,R:[-0.25,1.45,0.2],f:[0,0.87,0.5],p:[1,0,0],two:true,pR:[-0.5,-1,0.5],pL:[0.3,-1,0.3]},
    mid3:{root:[0,0.85,-0.04],pitch:4,flex:-2,neck:0,R:[-0.25,1.385,0.18],f:[0,0.87,0.5],p:[1,0,0],L:[0.22,1.05,0.3],fL:[0,0.25,0.97],pR:[-0.5,-1,0.5],pL:[0.5,-1,-0.2]},
    end:{root:[0,0.915,0],pitch:0,flex:-2,neck:0,R:[-0.2,1.98,0.02],f:[0,1,0],p:[1,0,0],L:[0.3,0.9,0.1],fL:[0,-0.7,0.7],pR:[-1,0,0.2],pL:[0.5,-1,-0.2]},
    ...JSON.parse(process.env.CB||'{}')};
  const g={slug:'circus-bell',camera:{az:34,el:8},muscles:['shoulders','triceps','quadriceps'],props:[],tempo:{lift:'there',up:1.6}}; // clean, rack, dip and drive: one lift (the folding elbow is not a lowering), long enough to read each phase
  const nrm=v=>{const l=Math.hypot(...v); return v.map(x=>x/l);}, cr=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const rd=x=>Math.round(x*1000)/1000, add=(a,b,k)=>a.map((x,i)=>rd(x+k*b[i]));
  const foot=m=>({pos:[P.FX*m,0,0],anchor:'sole',pitch:0,yaw:18*m,pole:[P.kx*m,0,1]});
  const fr=q=>{ const f=nrm(q.f), t=nrm(cr(f,nrm(q.p))); // the R hand's thumb: the bell's axis
    const o={root:{pos:q.root,pitch:q.pitch},spine:{flex:q.flex},neck:{flex:q.neck},legL:foot(1),legR:foot(-1),
      armR:{pos:q.R,hand:'grip',grip:0.03,fingers:f.map(rd),palm:nrm(q.p).map(rd),pole:q.pR},
      props:[{type:'circus-dumbbell',d:P.d,hand:'R',offset:q.two?t.map(x=>rd(-P.off*x)):[0,0,0]}]};
    if (q.two) { const fl=q.fL||f; o.armL={pos:add(q.R,t,-P.gap),hand:'grip',grip:0.03,fingers:fl.map(rd),palm:nrm(cr(fl,t)).map(rd),pole:q.pL}; }
    else o.armL={pos:q.L,hand:'relaxed',fingers:q.fL,palm:[-1,0,0],pole:q.pL};
    return o; };
  g.frames={start:fr(P.start),mid:fr(P.mid),mid2:fr(P.mid2),mid3:fr(P.mid3),end:fr(P.end)}; out('circus-bell',g);
}
circusBell();

// ---- tempo, muscles (coach review 2026-11-13)
for (const [slug,patch] of Object.entries({
  'atlas-stones':{tempo:{lift:'there',up:1.0,down:1.8}}, 'atlas-stone-trainer':{tempo:{lift:'there',up:1.0,down:1.8}},
  'keg-load':{tempo:{lift:'there',up:1.0,down:1.8}}, 'sandbag-load':{tempo:{lift:'there',up:1.0,down:1.8}},
  'log-lift':{tempo:{lift:'there',up:1.0,down:1.8},muscles:['shoulders','quadriceps','glutes','spinal-erectors']} })) {
  const u=new URL(`../${slug}.json`,import.meta.url); fs.writeFileSync(u,JSON.stringify({...JSON.parse(fs.readFileSync(u)),...patch},null,1)); }
