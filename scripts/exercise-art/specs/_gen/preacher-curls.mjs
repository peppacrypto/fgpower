import fs from 'fs';
const P = { bot:[0.7738,0.3795], mid:[0.963,0.424], top:[1.2052,0.2495] };
const FP = { bot:[-0.6157,0.788], mid:[0,1], top:[0.866,0.5] }; // finger dir (y,z) along forearm
const SH = +(process.env.SH||0.045);
const n = v => { const l=Math.hypot(...v); return v.map(x=>x/l); };
const legs = () => ({ legL:{pos:[0.17,0,0.12],anchor:'sole',pole:[0.25,0.9,1]}, legR:{pos:[-0.17,0,0.12],anchor:'sole',pole:[-0.25,0.9,1]} });
// grip: 'under' | 'over' | 'hammer'; x hand x; tx finger x tilt
const arm = (s, ph, o) => {
  const [y0,z0] = P[ph], [fy,fz] = FP[ph]; const y=y0+SH, z=z0+SH;
  const fx = (o.tx||0)*s;
  let f = n([fx, fy, fz]), p;
  const up = n([0, fz, -fy]);            // palm-up normal (perp to forearm dir)
  if (o.grip==='under') p = up;
  else if (o.grip==='over') p = up.map(v=>-v);
  else p = [-1,0,0];
  if (o.grip!=='hammer') p = [ (o.px||0)*(o.grip==='over'?-1:1), p[1], p[2] ];
  const d = f[0]*p[0]+f[1]*p[1]+f[2]*p[2]; p = n(p.map((v,i)=>v-d*f[i]));
  const a = { pos:[o.x*s,y+(o.dy||0),z], contact:true, grip:o.r??0.014,
    fingers:[f[0]*s,f[1],f[2]], palm:[p[0]*s,p[1],p[2]], pole:[0.05*s,-1,0.3], curl:0.82 };
  if (o.mode?.(ph)) Object.assign(a, o.mode(ph));
  return a;
};
const body = () => ({ root:{pos:[0,0.72+SH,-0.27+SH],pitch:20}, neck:{flex:-4}, ...legs() });
const frameOf = (o, ph, extra={}) => {
  const f = body();
  f.armL = arm(1,ph,o); f.armR = arm(-1,ph,o);
  if (o.one) { f.armR = { fk:{flex:-8,abd:28,elbow:20}, rel:'world', hand:'relaxed' }; }
  return Object.assign(f, extra);
};
const write = (slug, spec) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug,camera:{az:72,el:12},muscles:['biceps'],floats:true,...spec},null,1));
const bench = {type:'preacher-bench'};
const ez = (grip='inner') => ({type:'ez-bar',hands:true,grip,plates:[10]});
const std = (slug, o, props, extra={}) => write(slug, { props, ...extra,
  frames:{ start:frameOf(o,'bot'), mid:frameOf(o,'mid'), end:frameOf(o,'top') } });
const dbs = (kg=10) => [{type:'dumbbell',hand:'L',kg},{type:'dumbbell',hand:'R',kg}];

std('preacher-curl', {grip:'under',x:0.15,tx:0.15,px:-0.25}, [bench, ez()]);
std('reverse-barbell-preacher-curls', {grip:'over',x:0.2325,tx:0.29,px:-0.2}, [bench, ez('outer')]);
std('cable-preacher-curl', {grip:'under',x:0.2}, [bench, {type:'cable-tower',pos:[0,0,1.45],yaw:180,pulleyY:0.2,hands:true,attachment:'straight-bar'}]);
std('two-arm-dumbbell-preacher-curl', {grip:'under',x:0.18,r:0.016}, [bench, ...dbs()]);
std('preacher-hammer-dumbbell-curl', {grip:'hammer',x:0.17,r:0.016}, [bench, ...dbs()]);
std('one-arm-dumbbell-preacher-curl', {grip:'under',x:0.12,r:0.016,one:true}, [bench, dbs()[0]], {muscleSide:'L'});

// zottman: up supinated, rotate at top, down pronated
{
  const hand = (s,ph,k) => { // k: 1 palm up, 0 neutral, -1 palm down
    const o={grip:'under',x:0.18,r:0.016};
    const a = arm(s,ph,o);
    const [fy,fz]=FP[ph]; const up=n([0,fz,-fy]); const side=[-s,0,0];
    const f=a.fingers; const sd=[-1,0,0];
    const w=0.5; const pal = n([ -s*w, k*up[1], k*up[2] ]);
    a.palm=[pal[0],pal[1],pal[2]]; return a;
  };
  const fr = (ph,k) => { const f=body(); f.armL=hand(1,ph,k); f.armR=hand(-1,ph,k); return f; };
  write('zottman-preacher-curl', { props:[bench,...dbs()],
    frames:{ start:fr('bot',0.8), mid:fr('top',1), mid2:fr('top',0), mid3:fr('top',-1), end:fr('bot',-0.8) } });
}

// machine: copy gallery
{
  const g = JSON.parse(fs.readFileSync(new URL('../_gallery/machine-preacher.json', import.meta.url)));
  delete g.slug; write('machine-preacher-curls', g);
}
// spider curl: prone on the slope, shoulders over the top edge, arms hang down the far side (nearest prop: preacher bench; bar hangs at full reach, the seat is out of reach)
{
  const sp = (e, k) => {
    const r=(e)*Math.PI/180; // forearm swing
    const fz=-Math.sin(r), fy=-Math.cos(r);
    const hand = s => ({ fk:{flex:42,abd:6,elbow:e}, rel:'chest', hand:'grip', grip:0.014, pron:90, curl:0.82 });
    return { root:{pos:[0,0.915,0.245],yaw:180,pitch:45}, neck:{flex:-25},
      armL:hand(1), armR:hand(-1),
      legL:{pos:[-0.2,0,0.5],anchor:'ball',yaw:180,pitch:35}, legR:{pos:[0.2,0,0.5],anchor:'ball',yaw:180,pitch:35} };
  };
  write('spider-curl', { camera:{az:100,el:10}, props:[bench, ez('inner')], frames:{ start:sp(5), mid:sp(65), end:sp(125) } });
}
