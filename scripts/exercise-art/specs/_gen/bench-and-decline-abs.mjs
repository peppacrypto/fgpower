import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const R = Math.PI/180;
const add=(a,b,k=1)=>a.map((v,i)=>v+b[i]*k);
const mir = v => [-v[0], v[1], v[2]];
// ---------- decline ab bench (head low, feet hooked) ----------
const DB = {type:'decline-situp-bench', angle:30};
const dLegs = () => ({
  legL:{pos:[0.1,0.9364,0.4264],anchor:'ankle',pitch:-5,pole:[0.05,1,0.3]},
  legR:{pos:[-0.1,0.9364,0.4264],anchor:'ankle',pitch:-5,pole:[-0.05,1,0.3]}});
const headArm = (s, o={}) => ({pos:[(0.115+ +(process.env.DX??0.03))*s,-0.03,-0.02],rel:'head',fingers:[(+(process.env.FX??-0.6))*s,+(process.env.FY??0.3),+(process.env.FZ??-0.7)],palm:[+(process.env.PX??-0.7)*s,+(process.env.PY??0.3),+(process.env.PZ??0.6)],
  pole:[+(process.env.OX??0.2)*s,-0.3,+(process.env.OZ??1)],curl:0.3});
const dFrame = (pitch, flex, neck, o={}) => ({
  root:{pos:[0,0.7497,-0.1251],pitch}, neck:{flex:neck},
  spine:{flex, twist:o.twist??0, weights:[0,0.1,0.25,0.3,0.35]},
  armL:headArm(1), armR:headArm(-1), ...dLegs()});
const dcam = {az:62,el:14};
W('decline-crunch',{camera:dcam,muscles:['abdominals'],floats:true,props:[DB],
  frames:{start:dFrame(-120,0,14), end:dFrame(-114,56,26)}});
W('decline-oblique-crunch',{camera:{az:40,el:20},muscles:['abdominals','obliques'],floats:true,props:[DB],
  frames:{start:dFrame(-120,0,14), end:dFrame(-114,44,12,{twist:30})}});

// ---------- weighted sit-up with bands ----------
const bandProp = {type:'band-tube',hands:true,via:[{pos:[0.3,0.12,0.5]},{pos:[-0.3,0.12,0.5]}]};
const bArm = (s,out) => ({pos:[(0.08)*s,out.y,out.z],rel:'head',hand:'grip',grip:0.016,fingers:[0,1,0.3],palm:[-0.6*s,0.2,0.75],
  pole:[1.2*s,-0.5,0.3]});
const bFrame = (pitch,flex,neck,y,z) => ({root:{pos:[0,0.7497,-0.1251],pitch},neck:{flex:neck},
  spine:{flex,weights:[0,0.1,0.25,0.3,0.35]},armL:bArm(1,{y,z}),armR:bArm(-1,{y,z}),...dLegs()});
W('weighted-sit-ups-with-bands',{camera:{az:62,el:14},muscles:['abdominals'],floats:true,props:[DB,bandProp],
  frames:{start:bFrame(-120,0,14,-0.18,0.28), end:bFrame(-114,56,26,-0.18,0.28)}});

// ---------- reverse crunch: decline bench turned, head at the high end ----------
const RB = {type:'decline-bench', angle:20, yaw:180};
const rArm = s => ({pos:[0.17*s,+(process.env.HY??0.5),+(process.env.HZ??-0.42)],contact:true,hand:'grip',grip:0.02,fingers:[0,+(process.env.GY??-1),+(process.env.GZ??-0.3)],palm:[-1*s,0,0],pole:[+(process.env.RX??1)*s,+(process.env.RY??-1),+(process.env.RZ??0.5)]});
const rFrame = (pitch, y, z, ank) => ({root:{pos:[0,y,z],pitch}, neck:{flex:6},
  armL:rArm(1), armR:rArm(-1),
  legL:{pos:[0.09,...ank],anchor:'ankle',pole:[0.1,1,0.3]}, legR:{pos:[-0.09,...ank],anchor:'ankle',pole:[-0.1,1,0.3]}});
W('decline-reverse-crunch',{camera:{az:70,el:12},muscles:['abdominals'],floats:true,props:[RB],
  frames:{start:rFrame(-70,0.58,0.22,[0.56,1.0]), mid:rFrame(-66,0.56,0.22,[0.8,0.8]), end:rFrame(-68,0.56,0.22,[0.9,0.66])}});

// ---------- seated on flat bench ----------
const sArm = s => ({pos:[0.17*s,0.42,0.16],contact:true,hand:'grip',grip:0.02,fingers:[0,-1,0],palm:[-1*s,0,0],pole:[0.6*s,-0.4,-0.7]});
const sFrame = (pitch, flex, ank, kneeUp, fp) => ({root:{pos:[0,0.55,0.3],pitch}, neck:{flex:10}, spine:{flex},
  armL:sArm(1), armR:sArm(-1),
  legL:{pos:[0.1,...ank],anchor:'ankle',pitch:fp,pole:[0.1,1,kneeUp]}, legR:{pos:[-0.1,...ank],anchor:'ankle',pitch:fp,pole:[-0.1,1,kneeUp]}});
for (const slug of ['seated-flat-bench-leg-pull-in','seated-leg-tucks'])
  W(slug,{camera:{az:70,el:10},muscles:['abdominals'],floats:true,props:[{type:'flat-bench'}],
   frames:{start:sFrame(-45,0,[0.5,1.12],0.1,-70), mid:sFrame(-38,10,[0.62,0.9],0.2,-40), end:sFrame(-28,22,[0.55,0.66],0.3,-10)}});

// ---------- dragon flags on a bench ----------
const SH=[+(process.env.SHY??0.78),-0.27]; // shoulder pivot y,z
const dir = p => [0,-Math.cos(p*R),-Math.sin(p*R)];
const fwd = p => [0,-Math.sin(p*R),Math.cos(p*R)];
const dragon = (p, tuck) => {
  const d=dir(p), f=fwd(p);
  const root=[0,SH[0]+0.46*d[1],SH[1]+0.46*d[2]];
  const hip=(s)=>[0.11*s,root[1],root[2]];
  const o={root:{pos:root,pitch:p},neck:{flex:6+Math.max(0,Math.min(1,(-p-104)/60))*+(process.env.NA??10)},
    armL:{pos:[0.17,0.42,-0.45],hand:'grip',grip:0.02,fingers:[0,-1,0],palm:[-1,0,0],contact:true,pole:[0.8,-0.2,-0.3]},
    armR:{pos:[-0.17,0.42,-0.45],hand:'grip',grip:0.02,fingers:[0,-1,0],palm:[1,0,0],contact:true,pole:[-0.8,-0.2,-0.3]}};
  for (const [k,s] of [['legL',1],['legR',-1]]) {
    let ank, pole, toe;
    if (!tuck) { ank=add([0.1*s,root[1],root[2]],d,0.84); pole=f; toe=f; }
    else { const th=88*R; const t=add(d.map(v=>v*Math.cos(th)),f,Math.sin(th));
      const sh=add(d.map(v=>v*Math.sin(th)),f,-Math.cos(th));
      ank=add(add([0.1*s,root[1],root[2]],t,0.432),sh,0.428); pole=add(f.map(v=>v*0.2),t,1); toe=t; }
    o[k]={pos:ank,anchor:'ankle',pitch:((a)=>a>0?a-360:a)(-Math.atan2(toe[1],toe[2])/R),pole:[0.0,pole[1],pole[2]]};
  }
  return o;
};
for (const [slug,tuck] of [['dragon-flag',false],['tuck-dragon-flag',true]])
  W(slug,{camera:{az:75,el:10},muscles:['abdominals'],floats:true,props:[{type:'flat-bench'}],
    frames:{start:dragon(-172,tuck), mid:dragon(-154,tuck), mid2:dragon(-136,tuck), end:dragon(-104,tuck)}});

// ---------- press sit-up ----------
const pArm = (s,fl,ab,el) => ({fk:{flex:fl,abd:ab,rot:+(process.env.PR??0),elbow:el},rel:'chest',hand:'grip',grip:0.014,pron:+(process.env.PN??79)});
const pFrame = (pitch,flex,neck,fl,el) => ({root:{pos:[0,0.7497,-0.1251],pitch},neck:{flex:neck},
  spine:{flex,weights:[0,0.1,0.25,0.3,0.35]},armL:pArm(1,fl,+(process.env.AB??0),el),armR:pArm(-1,fl,+(process.env.AB??0),el),...dLegs()});
W('press-sit-up',{camera:{az:62,el:14},muscles:['abdominals','shoulders'],floats:true,
  props:[DB,{type:'barbell',hands:true,plates:[10]}],
  frames:{start:pFrame(-120,0,14,40,125), mid:pFrame(-117,28,20,100,60), end:pFrame(-114,60,26,165,5)}});
