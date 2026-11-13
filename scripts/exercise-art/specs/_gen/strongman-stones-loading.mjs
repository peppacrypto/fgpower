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
  f.start.props[0].at[2]=0.40; f.start.armL.pos[2]=0.40; f.start.armR.pos[2]=0.40;
  f.end.root.pos[1]=0.895; f.end.props[0].at[2]=0.36; f.end.armL.pos[2]=0.36; f.end.armR.pos[2]=0.36;
  out('keg-load',g); }
// ---- sandbag: bag farther forward, feet fixed
{ const g=G('loading-sandbag'); const f=g.frames; const X=0.36;
  for (const k of ['start','end']) { f[k].legL.pos=[X,0,0]; f[k].legR.pos=[-X,0,0]; f[k].legL.yaw=12; f[k].legR.yaw=-12; }
  f.start.props[0].at[2]=0.30; f.start.armL.pos[2]=0.34; f.start.armR.pos[2]=0.34;
  f.end.root.pos[1]=0.9; f.end.props[0].at[2]=0.30; f.end.armL.pos[2]=0.34; f.end.armR.pos[2]=0.34;
  for (const k of ['start','end']) { f[k].legL.pole=[1,0,0.9]; f[k].legR.pole=[-1,0,0.9]; f[k].legL.yaw=25; f[k].legR.yaw=-25; }
  f.start.armL.pole=[-0.5,0.3,-1]; f.start.armR.pole=[0.5,0.3,-1]; f.end.armL.pos[2]=0.31; f.end.armR.pos[2]=0.31; f.end.props[0].at[2]=0.27;
  out('sandbag-load',g); }
// ---- atlas stones: platform back 0.2, wide stance, lap frame between floor and chest
function atlas(slug, over={}) {
  const g=G('atlas-stone'); const f=g.frames; const cl=o=>JSON.parse(JSON.stringify(o));
  g.props[0].pos=[0,0,0.92];
  const X=0.44;
  for (const k of ['start','mid']) { f[k].legL.pos=[X,0,0]; f[k].legR.pos=[-X,0,0]; f[k].legL.pole=[0.8,0,1]; f[k].legR.pole=[-0.8,0,1]; f[k].legL.yaw=18; f[k].legR.yaw=-18; }
  const setStone=(fr,y,z,hx=0.225)=>{ fr.props[0].at=[0,y,z];
    for (const [k,m] of [['armL',1],['armR',-1]]) { const o=[hx,-0.11,-0.09], r=Math.hypot(...o), n=o.map(v=>v/r);
      const up=[0,1,0], d=n[1]; const dn=up.map((v,i)=>-(v-d*n[i])), dl=Math.hypot(...dn);
      const nx=v=>[v[0]*m,v[1],v[2]];
      Object.assign(fr[k],{pos:[o[0]*m,y+o[1],z+o[2]],fingers:nx(dn.map((v,i)=>v/dl+0.35*n[i])),palm:nx(n.map(v=>-v)),curl:0.3}); } };
  setStone(f.start,0.235,0.12,0.29);
  f.start.armL.pole=[-0.5,0.3,-1]; f.start.armR.pole=[0.5,0.3,-1]; f.start.root.pos[1]+=0.02;
  // lap: stone on the thighs
  const lap=cl(f.mid); lap.root={pos:[0,0.66,-0.2],pitch:48}; lap.spine={flex:10}; lap.neck={flex:-25}; setStone(lap,0.64,0.40);
  lap.armL.pole=[0.3,0.2,-1]; lap.armR.pole=[-0.3,0.2,-1];
  // chest: standing, stone high
  const ch=cl(f.mid); ch.root={pos:[0,0.875,-0.02],pitch:-6}; ch.spine={flex:-4}; ch.neck={flex:-4};
    setStone(ch,1.0,0.34);
  f.end.root.pos[2]+=0.2; for (const k of ['legL','legR']) f.end[k].pos[2]+=0.2;
  setStone(f.end,1.36,0.8);
  for (const [k,m] of [['armL',1],['armR',-1]]) Object.assign(f.end[k],{pos:[0.255*m,1.26,0.8],fingers:[-0.13*m*0-0.0*m+(-0.13*m)*-1*-1,-0.314,0.941],palm:[-0.992*m,0.041,-0.123],curl:0.3});
  const e=f.end; const EP=JSON.parse(process.env.EP||'[0.9,-0.3,-0.3]'); e.armL.pole=EP; e.armR.pole=[-EP[0],EP[1],EP[2]];
  const lift=cl(lap); lift.root={pos:[0,0.69,-0.2],pitch:57}; lift.spine={flex:14}; lift.neck={flex:-32}; setStone(lift,0.45,0.40);
  const LP=JSON.parse(process.env.LP||'[-0.1,0.3,-1]'); lift.armL.pole=LP; lift.armR.pole=[-LP[0],LP[1],LP[2]];
  const m3=cl(f.end); m3.root.pos[2]=0.04; for (const k of ['legL','legR']) m3[k].pos[2]=0.2; m3.props[0].at=[0,1.55,0.62]; m3.armL.pos=[0.26,1.45,0.62]; m3.armR.pos=[-0.26,1.45,0.62];
  f.end.props[0].at=[0,1.4,0.9]; f.end.armL.pos[1]=1.3; f.end.armR.pos[1]=1.3; f.end.armL.pos[2]=0.9; f.end.armR.pos[2]=0.9;
  g.frames={start:f.start,mid:lift,mid2:lap,mid3:ch,mid4:m3,end:f.end};
  out(slug,g,over);
}
atlas('atlas-stones'); atlas('atlas-stone-trainer');
// ---- log lift
{ const g=G('log-bar'); const f=g.frames; const W=0.3;
  for (const k of ['start','mid','end']) { f[k].armL.pos[0]=W; f[k].armR.pos[0]=-W; }
  { const [fi,po,y,z]=JSON.parse(process.env.LM||'[[0,0.7,0.7],[0.3,-1,0.2],1.2,0.3]'); for (const [k,m] of [['armL',1],['armR',-1]]) { f.mid[k].fingers=fi; f.mid[k].pole=[po[0]*m,po[1],po[2]]; f.mid[k].pos[1]=y; f.mid[k].pos[2]=z; } }
  for (const a of ['armL','armR']) f.start[a].pos[2]=0.36;
  out('log-lift',g); }

// ---- tire flip / power stairs: hands under the tread, fingers forward, palms up
function tire(slug, over={}) {
  const g=G('tractor-tire'); const f=g.frames; const X=0.3; const TF=JSON.parse(process.env.TF||'[0,0.6,0.8]');
  const s=f.start; s.root.pos=[0,0.52,-0.56]; s.root.pitch=62;
  for (const [k,m] of [['armL',1],['armR',-1]]) { Object.assign(s[k],{pos:[0.26*m,0.072,-0.03],fingers:TF,palm:[0,-TF[2],TF[1]],pole:[0.9*m,0.1,-0.5]}); }
  for (const [k,m] of [['legL',1],['legR',-1]]) { s[k].pos=[X*m,0,-0.33]; s[k].pole=[0.8*m,0.1,1]; }
  g.frames.mid.legL.pos[0]=0.6; g.frames.mid.armL.pos[0]=0.32; g.frames.mid.armR.pos[0]=-0.29; g.frames.mid.legR.pos[0]=-0.2;
  out(slug,g,over);
}
tire('tire-flip'); tire('power-stairs',{muscles:['hamstrings','glutes','quadriceps']});

out('circus-bell',G('circus-dumbbell')); // unresolved: gallery pose kept
