import fs from 'fs';
const leg = s => ({ pos:[0.22*s,0,0.74], anchor:'sole', pole:[0.3*s,1,0.3] });
const arm = (s, x, y, z, o={}) => ({
  pos:[x*s,y,z], contact:true, hand:'grip', grip:0.014,
  fingers:[(o.fx??0.05)*s, o.fy??1, o.fz??-0.12], palm:[0,o.py??0.12,o.pz??1],
  pole:[(o.px??0.7)*s, o.pey??-0.5, o.pz2??0.2], curl:0.82 });
const frame = (o) => { const f = { root:{pos:[0,0.567,0.2],pitch:-90}, neck:{flex:6}, spine:{flex:-4},
  legL:leg(1), legR:leg(-1) };
  f.armL = arm(1,o.x,o.y,o.z,o); f.armR = arm(-1,o.x,o.y,o.z,o); return f; };
const base = {x:0.37, top:[1.105,-0.24], bot:[0.70,-0.16]};
const mk = (slug, o, muscles, extra={}) => {
  const a = {...o};
  const s = { slug, camera:{az:40,el:8}, muscles, floats:true,
    props:[ {type:'flat-bench', ...(extra.noRack?{}:{barY:1.02})},
            extra.bar ?? {type:'barbell',hands:true,plates:[20]} ],
    frames:{ start: frame({...a, y:a.top[0], z:a.top[1], pz2:a.topPole??-0.1}),
             end: frame({...a, y:a.bot[0], z:a.bot[1], pz2:a.botPole??0.2}) } };
  if (extra.mid) s.frames.mid = frame({...a, ...extra.mid});
  fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify(s,null,1));
};
mk('barbell-bench-press-medium-grip', {...base}, ['chest','triceps']);
mk('close-grip-barbell-bench-press', {...base, x:0.22, px:0.0, pey:-0.9, bot:[0.73,-0.12], topPole:0.2, botPole:0.4}, ['triceps']);
mk('wide-grip-barbell-bench-press', {...base, x:0.45, px:0.9, pey:-0.3}, ['chest']);
mk('reverse-triceps-bench-press', {...base, x:0.22, px:0.1, pey:-0.9, bot:[0.73,-0.12], fx:0, fy:0.1, fz:-0.95, py:0.95, pz:-0.3}, ['triceps']);
mk('close-grip-ez-bar-press', {...base, x:0.1, px:0.25, pey:-0.6, bot:[0.70,-0.06], top:[1.105,-0.12], fx:-0.55, fy:0.83, fz:-0.1, py:0.1},
  ['triceps'], {noRack:true, bar:{type:'ez-bar',grip:'inner',hands:true,plates:[10]}});
mk('barbell-guillotine-bench-press', {...base, top:[1.105,-0.30], bot:[0.745,-0.30], px:0.9, pey:-0.15, topPole:-0.1, botPole:-0.1}, ['chest']);
mk('neck-press', {...base, top:[1.105,-0.30], bot:[0.72,-0.30], px:0.9, pey:-0.15, topPole:-0.1, botPole:-0.1}, ['chest']);
mk('jm-press', {...base, x:0.2, top:[1.105,-0.20], bot:[0.84,-0.24], px:0.25, pey:-0.5, topPole:0.2, botPole:1.0}, ['triceps'], {mid:{y:0.95,z:-0.22,pz2:0.5}});
