import fs from 'fs';
const J = f => JSON.parse(fs.readFileSync(new URL(`../${f}.json`, import.meta.url)));
const out = s => fs.writeFileSync(new URL(`../${s.slug}.json`, import.meta.url), JSON.stringify(s, null, 1));
const cp = o => JSON.parse(JSON.stringify(o));
// bar on the rear shoulders (hands at the sides)
const back = s => ({ pos:[0.33*s,0.215,-0.015], rel:'chest', contact:true, fingers:[-0.3*s,0.45,-0.85], palm:[0,0.97,0.2],
  curl:0.85, pole:[0.5*s,-0.7,-0.6], scap:{elev:0,prot:0} });
const leg = (s, x, z, o={}) => ({ pos:[x*s,o.y??0,z], anchor:o.anchor??'sole', yaw:(o.yaw??0)*s, pitch:o.pitch??0, pole:[(o.px??0.1)*s,o.py??0,1], ...(o.toes!==undefined?{toes:o.toes}:{}) });
const sq = (y, z, pitch, sp, nk, fz, o={}) => ({ root:{pos:[0,y,z],pitch}, spine:{flex:sp}, neck:{flex:nk},
  legL:leg(1,o.sx??0.2,fz,{yaw:o.yaw??16,px:o.px??0.38}), legR:leg(-1,o.sx??0.2,fz,{yaw:o.yaw??16,px:o.px??0.38}), armL:back(1), armR:back(-1) });
const spec = (slug, cam, muscles, props, frames, extra={}) => out({ slug, camera:cam, muscles, props, frames, ...extra });
const bar = [{type:'barbell',hands:true,plates:[20,10]}];

// 1 Smith squat: feet slightly ahead of the bar, vertical bar path, thighs below parallel
spec('smith-machine-squat',{az:55,el:8},['quadriceps','glutes'],bar,{
  start:sq(0.9,-0.03,3,0,-3,0.1), mid:sq(0.66,-0.03,16,-2,-5,0.1), end:sq(0.46,-0.03,26,-4,-8,0.1)});

// 2 Chair squat: feet 45 cm ahead of the bar, trunk vertical, thighs below parallel
spec('chair-squat',{az:60,el:8},['quadriceps'],bar,{
  start:sq(0.74,-0.03,0,0,0,0.4,{sx:0.16,yaw:14,px:0.3}),
  mid:sq(0.58,-0.03,0,0,0,0.4,{sx:0.16,yaw:14,px:0.3}),
  end:sq(0.4,-0.03,2,0,0,0.4,{sx:0.16,yaw:14,px:0.3})});

// 3 Lunge sprint: jump lunge, legs swap in the air
{ const lu = (a) => { const f = { root:{pos:[0,0.6,0.0],pitch:0}, spine:{flex:0}, neck:{flex:0}, armL:back(1), armR:back(-1) };
    const fr = leg(1,0.11,0.45,{px:0.1,py:0.3}), bk = {pos:[0.11,0.03,-0.55],anchor:'ball',pitch:55,pole:[0.1,-0.3,1]};
    const fr2 = {...leg(-1,0.11,0.45,{px:0.1,py:0.3})}, bk2 = {pos:[-0.11,0.03,-0.55],anchor:'ball',pitch:55,pole:[-0.1,-0.3,1]};
    f.legL = a? fr : bk; f.legR = a? bk2 : fr2; return f; };
  const air = { root:{pos:[0,1.2,0],pitch:0}, spine:{flex:0}, neck:{flex:0}, armL:back(1), armR:back(-1),
    legL:{pos:[0.1,0.42,0.1],anchor:'ankle',pitch:20,pole:[0.1,0,1]}, legR:{pos:[-0.1,0.42,-0.1],anchor:'ankle',pitch:20,pole:[-0.1,0,1]} };
  spec('lunge-sprint',{az:80,el:8},['quadriceps','glutes'],bar,{start:lu(true),mid:air,end:lu(false)},{floats:true}); }

// 4 Behind the back shrug
{ const b = JSON.parse(JSON.stringify(J('barbell-shrug-behind-the-back'))); b.slug='smith-machine-behind-the-back-shrug'; out(b); }

// 5 Bent over row
{ const b = J('bent-over-barbell-row'); b.slug='smith-machine-bent-over-row'; out(b); }

// 6 Calf raise: balls on a block under the bar
{ const bk = (y,ry,p,off) => ({ root:{pos:[0,y,-0.07-0.0],pitch:2}, spine:{flex:0}, neck:{flex:0}, armL:back(1), armR:back(-1),
    legL:{pos:[0.11,0.1,-0.07],anchor:'ball',pitch:p,toes:0,pole:[0.05,0,1]}, legR:{pos:[-0.11,0.1,-0.07],anchor:'ball',pitch:p,toes:0,pole:[-0.05,0,1]} });
  spec('smith-machine-calf-raise',{az:60,el:8},['calves'],[...bar,{type:'calf-block',height:0.1}],{start:bk(0.97,0,-14),end:bk(1.095,0,50)},{floats:true}); }

// 7 Reverse calf raise: heels on the platform, balls off the edge, toes rise
{ const rc = (p,y) => ({ root:{pos:[0,y,0.0],pitch:2}, spine:{flex:0}, neck:{flex:0}, armL:back(1), armR:back(-1),
    legL:{pos:[0.11,0.112,-0.03],anchor:'heel',pitch:p,pole:[0.05,0,1]}, legR:{pos:[-0.11,0.112,-0.03],anchor:'heel',pitch:p,pole:[-0.05,0,1]} });
  spec('smith-machine-reverse-calf-raises',{az:60,el:8},['calves'],[...bar,{type:'calf-block',height:0.1,pos:[0,0,0.0]}],{start:rc(-18,1.0),end:rc(18,1.0)},{floats:true}); }

// 8 Hang power clean
{ const gr = (s,y,z) => ({ pos:[0.3*s,y,z], contact:true, fingers:[0,-1,0], palm:[0,0,-1], pole:[0.4*s,0,-0.6], curl:0.82 });
  const ft = (anch,p,z,y=0) => ({ L:{pos:[0.14,y,z],anchor:anch,pitch:p,yaw:6,pole:[0.15,0,1]}, R:{pos:[-0.14,y,z],anchor:anch,pitch:p,yaw:-6,pole:[-0.15,0,1]} });
  const mk = (root, arm, f, neck=0) => ({ root, spine:{flex:0}, neck:{flex:neck}, armL:arm(1), armR:arm(-1), legL:f.L, legR:f.R });
  const hand = (y,z,fing,palm,pole,el) => s => ({ pos:[0.3*s,y,z], contact:true, curl:0.82, fingers:fing, palm, pole:[pole[0]*s,pole[1],pole[2]], scap:{elev:el,prot:0} });
  const flat = ft('sole',0,0);
  // convert world-frame arm to chest frame (chest origin ~ root + 0.275 up the torso)
  const toChest = (root, w) => { const a=root.pitch*Math.PI/180, c=Math.cos(a), sn=Math.sin(a);
    const ch=[root.pos[0], root.pos[1]+0.275*c, root.pos[2]+0.275*sn];
    const L=(v,off=[0,0,0])=>{ const y=v[1]-off[1], z=v[2]-off[2]; return [v[0]-off[0], y*c+z*sn, -y*sn+z*c]; };
    return { ...w, pos:L(w.pos,ch).map(x=>+x.toFixed(3)), fingers:L(w.fingers).map(x=>+x.toFixed(3)), palm:L(w.palm).map(x=>+x.toFixed(3)), pole:L(w.pole).map(x=>+x.toFixed(3)), rel:'chest' }; };
  const chestFrame = (f) => { const r=f.root; f.armL=toChest(r,f.armL); f.armR=toChest(r,f.armR); return f; };
  const hang = mk({pos:[0,0.84,-0.27],pitch:48}, s=>gr(s,0.6,0.11), flat, -30);
  const top = mk({pos:[0,0.93,0],pitch:0}, hand(1.02,0.19,[0,-0.95,0.3],[0,-0.3,-1],[1,-0.3,-0.5],6), flat);
  const turn = mk({pos:[0,0.88,0],pitch:0}, s=>({pos:[0.22*s,0.08,0.17],rel:'chest',contact:true,curl:0.82,fingers:[0.02*s,-0.45,-0.9],palm:[0,0.9,-0.45],pole:[0.3*s,-0.7,0.6],scap:{elev:2,prot:0.3}}), flat);
  const rackA = s => ({ pos:[0.2*s,0.2,0.13],rel:'chest',contact:true,curl:0.82,fingers:[0.02*s,0.1,-1],palm:[0,1,0.1],pole:[0.3*s,-0.6,1],scap:{elev:0,prot:0.5} });
  const catchW = mk({pos:[0,0.82,-0.04],pitch:5}, hand(1.17,0.2,[0,-0.85,0.5],[0,-0.5,-0.85],[0.6,-0.5,-0.8],8), flat);
  const catchF = mk({pos:[0,0.8,-0.05],pitch:6}, rackA, flat);
  spec('smith-machine-hang-power-clean',{az:60,el:8},['hamstrings','glutes'],[{type:'barbell',hands:true,plates:[20,10]}],{start:chestFrame(hang),mid:chestFrame(top),end:chestFrame(catchW)}); }

// 9 One-arm upright row (free hand off the bar, left arm works)
{ const b = J('upright-barbell-row'); b.slug='smith-machine-one-arm-upright-row'; b.muscles=['shoulders']; out(b); }

// 10 Pistol squat under the bar
{ const p = J('pistol-squat'); p.slug='smith-machine-pistol-squat'; p.props=bar;
  for (const k of Object.keys(p.frames)) { p.frames[k].armL=back(1); p.frames[k].armR=back(-1); }
  out(p); }

// 11 Stiff-legged deadlift
{ const b = J('stiff-legged-barbell-deadlift'); b.slug='smith-machine-stiff-legged-deadlift'; out(b); }

// 12 Upright row
{ const b = J('upright-barbell-row'); b.slug='smith-machine-upright-row'; b.muscles=['traps','shoulders']; out(b); }

// 13 Split squat, rear foot on a flat bench
{ const rear = {pos:[-0.11,0.485,-0.66],anchor:'ankle',pitch:170,toes:170};
  const f = (y,z,pitch) => ({ root:{pos:[0,y,z],pitch}, spine:{flex:0}, neck:{flex:0}, armL:back(1), armR:back(-1),
    legL:{pos:[0.11,0,0.3],anchor:'sole'}, legR:rear });
  spec('smith-single-leg-split-squat',{az:70,el:6},['quadriceps','glutes'],[...bar,{type:'flat-bench',height:0.45,pos:[0,0,-1.3]}],
    {start:f(0.85,-0.03,3),end:f(0.5,-0.03,8)},{muscleSide:'L'}); }
