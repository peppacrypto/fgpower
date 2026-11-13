import fs from 'fs';
const leg = s => ({ pos:[0.11*s,0,0.03], anchor:'sole', yaw:8*s, pitch:0, pole:[0.1*s,0,1] });
const n = v => { const l = Math.hypot(...v); return v.map(x => x/l); };
// hand orientation per phase; tilt t = ez slope (deg) along x
const orient = (kind, ph, t=0, tp) => {
  const st = Math.sin(t*Math.PI/180), ct = Math.cos(t*Math.PI/180);
  let u, p; // u = (y,z) direction of fingers
  if (kind==='under') {
    if (ph==='bot') { u=[-1,0.3]; p=[0,0.3,1]; }
    else if (ph==='mid') { u=[0.3,1]; p=[0,1,-0.3]; }
    else { u=tp?tp[0]:[0.6,0.8]; p=tp?tp[1]:[0,0.75,-0.6]; }
  } else {
    if (ph==='bot') { u=[-1,0]; p=[0,0,-1]; }
    else if (ph==='mid') { u=[0,1]; p=[0,-1,0]; }
    else { u=[0.5,0.85]; p=[0,-0.85,0.5]; }
  }
  const l = Math.hypot(...u);
  const f=[-st, ct*u[0]/l, ct*u[1]/l]; const pn=n(p); const d=f[0]*pn[0]+f[1]*pn[1]+f[2]*pn[2];
  return {f, p:n(pn.map((v,i)=>v-d*f[i]))};
};
const arm = (s, x, y, z, o, ph) => {
  const r = orient(o.kind, ph, o.tilt||0, o.topP);
  const fx = r.f[0], px = r.p[0];
  return { pos:[x*s,y,z], contact:true, hand:'grip', grip:0.014,
    fingers:[fx*s, r.f[1], r.f[2]], palm:[px*s, r.p[1], r.p[2]],
    curl:0.85, pole:[(typeof o.px==='object'?o.px[ph]:o.px)*s, o.py[ph], -1] };
};
const frame = (o, ph) => {
  const [y,z] = o.pos[ph];
  return { root:{pos:[0,0.925,0]}, neck:{flex:2}, spine: o.spine?{flex:o.spine[ph]}:undefined,
    armL: arm(1,o.x,y,z,o,ph), armR: arm(-1,o.x,y,z,o,ph), legL:leg(1), legR:leg(-1) };
};
const mk = (slug, o) => {
  const s = { slug, camera:{az:o.az??35,el:6}, muscles:['biceps'], props:o.props,
    frames:{ start:frame(o,'bot'), mid:frame(o,'mid'), end:frame(o,'top') } };
  for (const k in s.frames) for (const j in s.frames[k]) if (s.frames[k][j]===undefined) delete s.frames[k][j];
  fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify(s,null,1));
};
const base = { kind:'under', x:0.2325, px:0.15, py:{bot:0,mid:-0.15,top:-0.3},
  pos:{bot:[0.79,0.14], mid:[1.12,0.33], top:[1.33,0.235]} };
const bb = (extra={}) => ({type:'barbell',hands:true,plates:[20],...extra});
mk('barbell-curl', {...base, x:0.2, props:[bb()]});
mk('wide-grip-standing-barbell-curl', {...base, x:0.27, px:{bot:-0.15,mid:-0.15,top:0.3}, pos:{bot:[0.79,0.14],mid:[1.12,0.33],top:[1.33,0.235]}, props:[bb()]});
mk('close-grip-standing-barbell-curl', {...base, x:0.14, px:{bot:0.3,mid:0.6,top:0.8}, pos:{bot:[0.80,0.26],mid:[1.12,0.35],top:[1.31,0.30]}, props:[bb()]});
mk('reverse-barbell-curl', {...base, kind:'over', x:0.2, props:[bb()]});
mk('ez-bar-curl', {...base, tilt:17, props:[{type:'ez-bar',grip:'outer',hands:true,plates:[10]}]});
mk('close-grip-ez-bar-curl', {...base, x:0.12, px:{bot:0.2,mid:0.3,top:0.8}, tilt:20, pos:{bot:[0.80,0.20],mid:[1.12,0.33],top:[1.33,0.235]}, props:[{type:'ez-bar',grip:'inner',hands:true,plates:[10]}]});
mk('close-grip-ez-bar-curl-with-band', {...base, x:0.12, px:{bot:0.2,mid:0.3,top:0.8}, tilt:20, pos:{bot:[0.80,0.20],mid:[1.12,0.33],top:[1.33,0.235]}, props:[
  {type:'ez-bar',grip:'inner',hands:true,plates:[]},
  {type:'bar-bands',hands:true,to:'feet',x:0.11,width:0.044,rest:0.42}]});
// drag curl: elbows travel back, bar slides up the torso
mk('drag-curl', {...base, x:0.2, px:0.1, props:[bb()],
  py:{bot:-0.1,mid:-0.2,top:-0.3},
  pos:{bot:[0.79,0.14], mid:[1.05,0.14], top:[1.25,0.15]}, spine:{bot:0,mid:0,top:0}});
