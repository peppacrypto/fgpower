import fs from 'fs';
const leg = (s,o,dy=0,dz=0) => ({ pos:[o.sx*s,dy,0.02+dz], anchor:'sole', yaw:o.yaw*s, pitch:0, pole:[o.px*s,0,1] });
const arm = s => ({ pos:[0.33*s,0.215,-0.015], rel:'chest', contact:true, fingers:[-0.3*s,0.45,-0.85], palm:[0,0.97,0.2],
  curl:0.85, pole:[0.5*s,-0.7,-0.6], scap:{elev:0,prot:0} });
const fr = (o, p) => { const f = { root:{pos:[0,p.y,p.z],pitch:p.pitch}, spine:{flex:p.sp??0}, neck:{flex:p.nk??0},
  legL:leg(1,o,p.ly,p.lz), legR:leg(-1,o,p.ry??p.ly,p.lz), armL:arm(1), armR:arm(-1) }; return f; };
const onP = f => { f.legL.pos=[0.34,0.03,0.02]; return f; };
const std = {sx:0.2,yaw:18,px:0.38};
const mk = (slug, o, top, bot, extra={}) => {
  const s = { slug, camera:{az:48,el:8}, muscles:['quadriceps','glutes'],
    props:[{type:'barbell',hands:true,plates:[20,10]}, ...(extra.props??[])],
    frames:{ start:fr(o,top), end:fr(o,bot) } };
  if (slug==='squat-with-plate-movers') { onP(s.frames.start); onP(s.frames.end); }
  if (extra.mid) s.frames.mid = slug==='squat-with-plate-movers' ? onP(extra.mid) : extra.mid;
  if (extra.mid2) s.frames.mid2 = extra.mid2;
  if (extra.camera) s.camera = extra.camera;
  if (extra.tempo) s.tempo = extra.tempo;
  if (extra.floats) s.floats = true;
  fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify(s,null,1));
};
const up = {y:0.915,z:-0.03,pitch:4,nk:-3};
const par = {y:0.42,z:-0.2,pitch:30,sp:-4,nk:-8};
mk('barbell-squat', std, up, par);
mk('barbell-full-squat', std, up, {y:0.40,z:-0.24,pitch:36,sp:-4,nk:-10});
mk('speed-squats', std, up, par, {tempo:{lift:'back',up:0.5,down:1.1,squeeze:0.1,stretch:0.2}});
mk('narrow-stance-squats', {sx:0.08,yaw:8,px:0.3}, up, {...par,y:0.41,sp:-4,pitch:20});
mk('wide-stance-barbell-squat', {sx:0.34,yaw:35,px:0.7}, {...up,y:0.9}, {...par,y:0.42,pitch:26});
mk('olympic-squat', {sx:0.15,yaw:12,px:0.42}, up, {y:0.37,z:-0.14,pitch:18,sp:0,nk:-4});
{ const o={sx:0.22,yaw:15,px:0.35};
  const air=(root,ly,pit,zb=0)=>{const f=fr(o,{y:root.y,z:root.z,pitch:root.pitch,sp:root.sp??0,nk:root.nk??0});
    for(const [k,sg] of [['legL',1],['legR',-1]]) f[k]={pos:[o.sx*sg,ly,0.02+zb],anchor:'ball',pitch:pit,yaw:o.yaw*sg,pole:[o.px*sg,0,1]};return f;};
  mk('weighted-jump-squat', o, up, {y:1.2,z:0,pitch:0,nk:2}, {camera:{az:90,el:6},floats:true,
    tempo:{lift:'there',up:0.4,down:0.6,squeeze:0.12,stretch:0.18},
    mid:{...fr(o,{y:0.62,z:-0.14,pitch:22,sp:-3,nk:-6})},
    mid2:air({y:1.0,z:-0.04,pitch:6,nk:0},0.03,55,0.09)});
  const sp=JSON.parse(fs.readFileSync(new URL('../weighted-jump-squat.json',import.meta.url)));
  const a=air({y:1.2,z:0,pitch:0,nk:2},0.2,60); sp.frames.end=a;
  fs.writeFileSync(new URL('../weighted-jump-squat.json',import.meta.url),JSON.stringify(sp,null,1)); }
// plate movers: wide, left foot on a plate (top 0.044), side step pushes plate along
const wide = {sx:0.34,yaw:30,px:0.6};
const pm = (x, y, pitch) => { const f = fr(wide,{y,z:-0.15,pitch,sp:-4,nk:-6});
  return f; };
mk('squat-with-plate-movers', wide, {...up,y:0.9}, {y:0.6,z:-0.15,pitch:24,sp:-4,nk:-6}, { props:[{type:'weight-plate',kg:20,at:[0.34,0.022,-0.05]}],
  mid:pm(0,0.7,15), camera:{az:20,el:16} });
