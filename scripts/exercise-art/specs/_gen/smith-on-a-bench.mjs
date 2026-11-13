import fs from 'fs';
const out = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const FT = Number(process.env.FT ?? 0);
const SMF = {type:'smith', pos:[0,0,0], follow:'feet'};
const SM = {type:'smith', pos:[0,0,0], follow:true};
const hand = (s, x, y, o={}) => ({
  pos:[x*s,y,o.z??0], contact:true, hand:'grip', grip:0.014,
  fingers:[(o.fx??0)*s, o.fy??0.35, o.fz??-0.94], palm:[0,o.py??0.94,o.pz??0.35],
  pole:[(o.px??0.8)*s, o.pey??-0.5, o.pz2??0.1], curl:0.8, ...(o.extra||{}) });
const lyingLeg = (s, x, y, z, o={}) => ({ pos:[x*s,y,z], anchor:o.anchor??'sole', ...(o.pitch!=null?{pitch:o.pitch}:{}), pole:[0.2*s,0.5,0.6] , ...(o.toes!=null?{toes:o.toes}:{}) });

// generic press: bench = prop, root, legs given
function press(slug, cfg) {
  const fr = (y, o) => ({ root:cfg.root, neck:cfg.neck, ...(cfg.spine?{spine:cfg.spine}:{}),
    armL:hand(1,cfg.x,y,{...cfg.h,...o,extra:{...(cfg.extra||{}),...(o.extra||{})}}), armR:hand(-1,cfg.x,y,{...cfg.h,...o,extra:{...(cfg.extra||{}),...(o.extra||{})}}), legL:cfg.legs(1), legR:cfg.legs(-1) });
  const s = { camera:cfg.cam, muscles:cfg.muscles, floats:true, props:[SM, cfg.bench],
    frames:{ start:fr(cfg.top, cfg.ho?.top||{}), ...(cfg.mid?{mid:fr((cfg.top+cfg.bot)/2, cfg.ho.mid||cfg.ho.bot)}:{}), end:fr(cfg.bot, cfg.ho?.bot||{}) } };
  out(slug, s);
}
const flat = { root:{pos:[0,0.545,0.28],pitch:-90}, neck:{flex:4}, bench:{type:'flat-bench',pos:[0,0,0.08],yaw:0},
  legs:s=>({pos:[0.22*s,0,0.92],anchor:'sole',pitch:0,toes:0,pole:[0.2*s,0.5,0.6]}), cam:{az:50,el:14},
  h:{}, ho:{top:{pole:undefined},bot:{}}, top:1.14, bot:0.73 };
const poleTop = {px:0.8,pey:-0.5,pz2:0.1}, poleBot={px:0.9,pey:-0.4,pz2:0.15};
press('smith-machine-bench-press', {...flat, x:0.33, muscles:['chest','triceps'], ho:{top:poleTop,bot:poleBot}});
press('smith-machine-close-grip-bench-press', {...flat, x:0.18, muscles:['triceps','chest'], bot:0.75,
  ho:{top:{px:0.2,pey:-0.9,pz2:0.2}, bot:{px:0.1,pey:-0.9,pz2:0.4}}});

// decline: gallery shifted +0.32 in z so the hands sit under the vertical bar
const D=0.2;
const decl = { root:{pos:[0,0.6584,0.0556+D],pitch:-110}, neck:{flex:10}, bench:{type:'decline-bench',angle:20,pos:[0,0,D]},
  legs:s=>({pos:[0.12*s,0.405,0.5856+D],anchor:'ankle',pitch:25,pole:[0.05*s,1,0.4]}), cam:{az:40,el:18},
  x:0.37, muscles:['chest','triceps'], top:1.12, bot:0.691,
  h:{fx:0.05,fy:1,fz:-0.05,py:0.05,pz:1}, ho:{top:{px:0.7,pey:-0.5,pz2:0.5}, bot:{px:0.7,pey:-0.5,pz2:0.5}} };
press('decline-smith-press', {...decl, top:1.105});
press('smith-machine-decline-press', {...decl, x:0.36, top:1.12});

// incline: gallery shifted +0.17
const I=0.03;
const inc = { root:{pos:[0,0.542,0.0556+I],pitch:-50}, neck:{flex:6}, bench:{type:'incline-bench',angle:40,pos:[0,0,I]},
  legs:s=>({pos:[0.21*s,0,0.62+I],anchor:'sole',pole:[0.15*s,0.4,1]}), cam:{az:56,el:14},
  x:0.36, muscles:['chest','anterior-deltoid'], top:1.4027, bot:1.0377,
  h:{fx:0.05,fy:1,fz:-0.05,py:0.05,pz:1}, ho:{top:{px:0.75,pey:-0.5,pz2:0.8}, bot:{px:0.75,pey:-0.5,pz2:0.8}} };
press('smith-machine-incline-bench-press', {...inc, x:0.38});
// shoulder raise: shoulder-width grip, arms stay straight, protract the shoulder blades to push the bar up
press('smith-incline-shoulder-raise', {...inc, x:0.2, muscles:['shoulders','anterior-deltoid'], top:1.43, bot:1.34,
  ho:{top:{px:0.3,pey:-0.8,pz2:-0.1,extra:{scap:{prot:1}}}, bot:{px:0.3,pey:-0.8,pz2:-0.1,extra:{scap:{prot:-0.6}}}}});

// seated overhead press: bench shifted back so the bar line passes in front of the face
const S=-0.25;
press('smith-machine-overhead-shoulder-press', { root:{pos:[0,0.587,0.1545+S],pitch:-8}, neck:{flex:-2},
  bench:{type:'shoulder-press-bench',pos:[0,0,S]}, legs:s=>({pos:[0.22*s,0,0.58+S],anchor:'sole',pole:[0.2*s,0.4,1]}),
  cam:{az:44,el:8}, mid:true, extra:{swivel:0}, x:0.34, muscles:['anterior-deltoid','lateral-deltoid','triceps'], top:1.78, bot:1.0875,
  h:{fx:0.05,fy:1,fz:0.05,py:-0.05,pz:1}, ho:{top:{px:0.8,pey:-0.35,pz2:0.5,fy:0.7,fz:0.7,py:-0.7,pz:0.7}, mid:{px:0.8,pey:-0.35,pz2:0.5,fy:0.85,fz:0.5,py:-0.5,pz:0.85}, bot:{px:0.8,pey:-0.35,pz2:0.5,fy:0.95,fz:0.25,py:-0.25,pz:0.95}} });

// supine leg fk: thigh angle theta (deg, 0 = toward the feet, 90 = up, in the pelvis frame), solved so the ankle reaches the bar
function legFk(hipY, hipZ, ankY, ankZ, tilt) {
  const T=0.432, S=0.428, dy=ankY-hipY, dz=ankZ-hipZ, d=Math.min(Math.hypot(dy,dz), T+S-0.004);
  const ca = (T*T+d*d-S*S)/(2*T*d), a = Math.acos(Math.max(-1,Math.min(1,ca)));   // thigh to hip-ankle line
  const base = Math.atan2(dy,dz);   // world angle of the hip-ankle line (0 = toward feet)
  const thW = base + a;             // knee up (toward the ceiling): thigh above the line
  const kn = Math.acos(Math.max(-1,Math.min(1,(T*T+S*S-d*d)/(2*T*S))));
  return { flex:+(thW*180/Math.PI + tilt).toFixed(1), knee:+(180-kn*180/Math.PI).toFixed(1) };
}
const fkLeg = (s, hipY, hipZ, ankY, tilt, ft) => { const k = legFk(hipY,hipZ,ankY,0,tilt);
  return { fk:{flex:k.flex, abd:Number(process.env.ABD??12), rot:0, knee:k.knee}, rel:'pelvis', foot:{pitch:ft} }; };

// hip raise: supine on the bench, soles on the bar, legs nearly straight, pelvis rolls up
const flatH = (s,z) => ({ pos:[0.15*s,0.44,z], contact:true, hand:'flat', fingers:[0,0,1], palm:[0,-1,0] });
const hipFrame = (rootY, pitch, flex, footY) => ({ root:{pos:[0,rootY,0.2],pitch}, neck:{flex:4}, spine:{flex},
  armL:flatH(1,0), armR:flatH(-1,0),
  legL:fkLeg(1,rootY,0.2,footY-0.07,-(pitch+90),FT), legR:fkLeg(-1,rootY,0.2,footY-0.07,-(pitch+90),FT) });
out('smith-machine-hip-raise', { camera:{az:100,el:6}, muscles:['abdominals'], floats:true,
  props:[SMF, {type:'flat-bench',pos:[0,0,-0.05],yaw:0}],
  frames:{ start:hipFrame(0.545,-90,0,1.36), mid:hipFrame(0.58,-97,5,1.40), end:hipFrame(0.62,-104,10,1.44) } });

// leg press: on the floor under the bar, feet on the bar, knees to the chest at the start, drive up
const floorArm = (s,z) => ({ pos:[0.38*s,0.15,-0.1], hand:'relaxed', pole:[s,-0.4,-0.5] });
const lpFrame = (hz, ay, rootY) => ({ root:{pos:[0,rootY,hz],pitch:-90}, neck:{flex:4},
  armL:floorArm(1,-0.1), armR:floorArm(-1,-0.1),
  legL:fkLeg(1,rootY,hz,ay-0.07,0,FT), legR:fkLeg(-1,rootY,hz,ay-0.07,0,FT) });
out('smith-machine-leg-press', { camera:{az:95,el:6}, muscles:['quadriceps'], floats:true, props:[SMF],
  frames:{ start:lpFrame(0.3,0.9,0.13), end:lpFrame(0.14,1.04,0.13) } });
