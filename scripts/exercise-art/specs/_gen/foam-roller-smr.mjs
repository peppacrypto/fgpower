import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const ld = n => JSON.parse(fs.readFileSync(new URL(`../_gallery/${n}.json`, import.meta.url)));
const flat = (x, y, z, s, f=[0,0,1]) => ({ pos:[x,y,z], contact:true, hand:'flat', fingers:[f[0]*s,f[1],f[2]], palm:[0,-1,0], curl:-0.3, pole:[0.5*s,0.3,-0.8] });
const roller = (x, z, extra={}) => ({ type:'foam-roller', pos:[x,0,z], length:0.9, ...extra });

// 1. quadriceps (gallery pose)
{ const g = ld('foam-roller'); for (const f of Object.values(g.frames)) { f.root.pos[1]+=0.055; for (const l of ['legL','legR']) f[l].pos[1]+=0.055; }
  W('quadriceps-smr', { camera:g.camera, muscles:['quadriceps'], floats:true, props:g.props, frames:g.frames }); }
// anterior tibialis: gallery stick roller on the shin
{ const g = ld('muscle-roller');
  for (const f of Object.values(g.frames)) { f.legL.pos[2]=0.78; f.legR={pos:[-0.15,0,0.78],anchor:'sole',pitch:0,pole:[0,1,0.2]}; for (const a of ['armL','armR']) f[a].pos[2]+=0.3; }
  W('anterior-tibialis-smr', { camera:g.camera, muscles:['calves'], muscleSide:'L', props:g.props, frames:g.frames }); }
// foot: gallery PVC roller
{ const g = ld('foot-roller');
  for (const f of Object.values(g.frames)) { f.armL={pos:[0.3,0.0,0.0],rel:'pelvis',contact:true,hand:'flat',fingers:[0,0,1],palm:[0,-1,0],curl:-0.3,pole:[1,0.2,-0.5]}; f.armR={...f.armL,pos:[-0.3,0,0],fingers:[0,0,1],pole:[-1,0.2,-0.5]}; }
  W('foot-smr', { camera:g.camera, muscles:['calves'], muscleSide:'L', floats:true, props:g.props, frames:g.frames }); }

// seated, hips raised, hands behind, legs forward: hamstring / calves
const seat = (rz, hy, pitch, legs, hz=-0.4) => ({ root:{pos:[0,hy,rz],pitch}, spine:{flex:-4}, neck:{flex:4},
  armL:flat(0.2,0,rz+hz,1,[0,0,1]), armR:flat(-0.2,0,rz+hz,-1,[0,0,1]), ...legs });
W('hamstring-smr', { camera:{az:62,el:10}, muscles:['hamstrings'], muscleSide:'L', props:[roller(0,0.3)], floats:false,
  frames:{ start:seat(-0.05,0.28,-60,{legL:{pos:[0.11,0.1,0.78],anchor:'ankle',pitch:-10,pole:[0,1,0]},legR:{pos:[-0.11,0.1,0.78],anchor:'ankle',pitch:-10,pole:[0,1,0]}}),
           end:seat(0.1,0.28,-60,{legL:{pos:[0.11,0.1,0.78],anchor:'ankle',pitch:-10,pole:[0,1,0]},legR:{pos:[-0.11,0.1,0.78],anchor:'ankle',pitch:-10,pole:[0,1,0]}}) } });
const cl = z => ({ legL:{pos:[0.11,0.24,z],anchor:'ankle',pitch:-10,pole:[0,1,0]}, legR:{pos:[-0.15,0,0.4],anchor:'sole',pitch:0,pole:[0,1,0.3]} });
W('calves-smr', { camera:{az:62,el:10}, muscles:['calves'], muscleSide:'L', props:[roller(0.11,0.62)],
  frames:{ start:seat(-0.05,0.34,-60,cl(0.75)), end:seat(0.1,0.34,-60,cl(0.9)) } });

// neck: stick behind the neck
const nk = (y, z) => { const a = s => ({ pos:[0.3*s,y,z], hand:'grip', grip:0.0155, fingers:[0,-1,0], palm:[0,0,-1], curl:0.8, pole:[s,0.2,0.3] }); return { root:{pos:[0,0.95,0]}, neck:{flex:6}, armL:a(1), armR:{...a(-1)} }; };
W('neck-smr', { camera:{az:140,el:10}, muscles:['traps'], props:[{type:'muscle-roller',hands:true,length:0.5}],
  frames:{ start:nk(1.52,-0.11), end:nk(1.42,-0.12) } });

// supine, hips raised, roller under back: rhomboids / lower back
const sup = (rz, ry, pitch, nkf) => ({ root:{pos:[0,ry,rz],pitch}, neck:{flex:nkf},
  armL:{pos:[-0.12,0.0,0.24],rel:'chest',pole:[1,0,0.3],hand:'relaxed'}, armR:{pos:[0.12,0.06,0.37],rel:'chest',pole:[-1,0,0.3],hand:'relaxed'},
  legL:{pos:[0.15,0,0.5],anchor:'sole',pitch:0,pole:[0.1,1,0.3]}, legR:{pos:[-0.15,0,0.5],anchor:'sole',pitch:0,pole:[-0.1,1,0.3]} });
W('rhomboids-smr', { camera:{az:70,el:10}, muscles:['middle-back'], props:[roller(0,-0.6)],
  frames:{ start:sup(0,0.3,-75,20), end:sup(0.1,0.3,-75,20) } });
W('lower-back-smr', { camera:{az:70,el:10}, muscles:['spinal-erectors'], props:[roller(0,-0.12)],
  frames:{ start:sup(0.02,0.27,-70,20), end:sup(0.12,0.27,-70,20) } });

// sitting on the roller, ankle on knee: piriformis
const pir = (rz, roll) => ({ root:{pos:[0,0.24,rz],pitch:-45,roll}, neck:{flex:4},
  armL:flat(0.2,0,-0.36,1,[0,0,1]), armR:flat(-0.2,0,-0.36,-1,[0,0,1]),
  legR:{pos:[-0.15,0,0.5],anchor:'sole',pitch:0,pole:[0,1,0.3]},
  legL:{fk:{flex:100,abd:40,rot:0,knee:120},foot:{pitch:20}} });
W('piriformis-smr', { camera:{az:60,el:10}, muscles:['glutes'], muscleSide:'L', props:[roller(0,-0.0)],
  frames:{ start:pir(0,0), end:pir(-0.03,0) } });

// prone, thigh abducted onto the roller: adductor
const ad = z => ({ root:{pos:[0,0.26,z],pitch:84}, neck:{flex:-20},
  armL:flat(0.12,0,z+0.4,1), armR:flat(-0.2,0,z+0.4,-1),
  legL:{fk:{flex:10,abd:80,rot:50,knee:85},foot:{pitch:60}}, legR:{fk:{flex:0,abd:3,knee:0},foot:{pitch:60}} });
W('adductor', { camera:{az:140,el:25}, muscles:['adductors'], muscleSide:'L', floats:false, props:[roller(0.3,0.0,{yaw:90})],
  frames:{ start:ad(-0.1), end:ad(0.1) } });


// side-lying on the figure's left, along X (head +X), roller axis along Z
const SIDE = (rx, o) => ({ root:{pos:[rx,o?.y??0.33,0],pitch:0,roll:-90}, neck:{flex:0}, armR:{fk:{flex:0,abd:10,elbow:15}},
  armL:{fk:{flex:0,abd:20,rot:0,elbow:90}}, legL:{fk:{flex:0,abd:0,knee:0}},
  legR:{fk:{flex:75,abd:0,knee:90},foot:{pitch:0}}, ...o });
const rl = (x, extra={}) => roller(x, 0, { yaw:90, ...extra });
const two = (slug, muscles, rollerPos, a, b, o={}, cam={az:10,el:22}) => W(slug, { camera:cam, muscles, muscleSide:'L', props:[rollerPos], frames:{ start:SIDE(a,o), end:SIDE(b,o) } });
two('iliotibial-tract-smr',['abductors'],rl(-0.25),-0.15,0.1);
two('peroneals-smr',['calves'],rl(-0.75),-0.25,0.05);
two('latissimus-dorsi-smr',['lats'],rl(0.0),-0.5,-0.35,{y:0.4,armL:{fk:{flex:175,abd:0,elbow:0}}});
two('brachialis-smr',['biceps'],rl(0.1,{length:0.45}),-0.2,0.0,{y:0.39,armL:{fk:{flex:0,abd:0,elbow:50}},legL:{fk:{flex:0,abd:14,knee:0}},legR:{fk:{flex:5,abd:12,knee:0}}});
