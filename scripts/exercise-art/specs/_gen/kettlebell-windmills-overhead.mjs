import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const feet = (x, yaw, z=0.02, pz=1) => ({
  legL:{pos:[x,0,z],anchor:'sole',yaw:yaw,pitch:0,pole:[-0.5,0,pz]},
  legR:{pos:[-x,0,z],anchor:'sole',yaw:-yaw,pitch:0,pole:[-0.5,0,pz]} });
const KB = {type:'kettlebell', hand:'L', kg:16, mode:'rack'};
// locked-out overhead arm, hand at world point p
const up = (p) => ({ pos:p, contact:true, fingers:[0,1,0.03], palm:[-0.5,0,0.87], curl:0.85, pole:[0.8,-0.1,-0.3], scap:{elev:-0.5} });
const rackArm = { pos:[0.25,1.44,0.2], contact:true, fingers:[0,1,0.12], palm:[-0.9,-0.05,-0.45], curl:0.85, pole:[0.25,-1,-0.15] };
const hang = s => ({ fk:{flex:0,abd:8*1,elbow:14}, curl:0.3 });
const behind = { pos:[-0.1,0.05,-0.14], rel:'pelvis', hand:'relaxed', pole:[-1,0,-0.3] };

// windmill frame: t 0 (upright) .. 1 (deep)
const wm = (o) => ({
  root:{pos:[o.hx,o.hy,0.0], pitch:o.pitch, roll:o.roll, yaw:o.ryaw||0},
  spine:{flex:o.sflex||0, side:o.side||0},
  neck:{twist:o.ntw||0, flex:o.nflex||0, side:o.nside||0},
  armL:up(o.bell), armR:o.free, ...o.legs });
const FL = (x,y,z,fx) => ({ pos:[x,y,z], contact:false, hand:'open', fingers:[0,-1,0.1], palm:[0.9,0,0.3], pole:[-1,-0.2,-0.3] });

const legsTurn = feet(0.25, -40);
const std = { hx:0, hy:0.88, pitch:0, roll:0, bell:[0.2,1.96,0.05], free:{pos:[-0.3,0.95,0.02],hand:'relaxed',pole:[-0.3,-1,-0.3]}, legs:feet(0.22,-40) };
W('kettlebell-windmill', { camera:{az:25,el:6}, muscles:['abdominals','obliques'], muscleSide:'L', props:[KB],
  frames:{ start:wm(std),
    mid:wm({hx:0.06,hy:0.88,pitch:0,roll:18,side:-16,nside:0,nflex:0,bell:[0.14,1.9,0.04],free:FL(-0.3,0.7,0.1),legs:feet(0.22,-40)}),
    end:wm({hx:0.06,hy:0.87,pitch:0,roll:32,side:-32,nside:0,nflex:0,sflex:0,bell:[0.02,1.76,0.08],free:FL(-0.32,0.5,0.15),legs:feet(0.22,-40)}) } });

// ---- advanced: free hand behind back
{ const base = JSON.parse(fs.readFileSync(new URL('../kettlebell-windmill.json', import.meta.url)));
  const f = base.frames; delete base.slug;
  for (const k of Object.keys(f)) f[k].armR = { pos:[-0.09,0.02,-0.13], rel:'pelvis', hand:'relaxed', pole:[-0.6,-0.4,-1] };
  f.end.root.pos[1]=0.88; f.end.root.roll=26; f.end.spine.side=-26; f.end.root.pitch=0; f.end.armL.pos=[0.04,1.8,0.06];
  f.mid.root.roll=14; f.mid.spine.side=-12;
  W('advanced-kettlebell-windmill', base); }

const deep = (o) => wm({hx:0.1,hy:0.66,pitch:24,roll:50,side:-40,sflex:0,nflex:0,bell:o.bell,free:o.free,legs:feet(0.22,-40,0.02,1)});
const floorH = (x,z) => ({ pos:[x,0,z], contact:true, hand:'flat', fingers:[0,0,1], palm:[0,-1,0], pole:[-1,0,0.2] });
const gripKB = (x,z) => ({ pos:[x,0.237,z], contact:true, hand:'grip', grip:0.0165, fingers:[0,-1,0], palm:[0,0,-1], curl:0.85, pole:[-1,0,0.2] });
const bell2 = {type:'kettlebell', kg:16, pos:[-0.38,0,0.3]};
const sw = (y,z) => ({pos:[-0.35,y,z],hand:'relaxed',pole:[-1,-0.2,0.1]});
W('double-kettlebell-windmill', { camera:{az:25,el:6}, muscles:['abdominals','obliques'], muscleSide:'L', props:[KB,bell2],
  frames:{ start:wm({...std,free:sw(0.95,0.05)}),
    mid:wm({hx:0.06,hy:0.8,pitch:15,roll:26,side:-16,bell:[0.12,1.9,0.04],free:sw(0.6,0.15),legs:feet(0.22,-40)}),
    end:deep({bell:[0.0,1.3,0.08],free:gripKB(-0.38,0.3)}) } });

const sp = {pos:[-0.3,0.95,0.1],hand:'relaxed',pole:[-1,-0.2,-0.3]};
W('bent-press', { camera:{az:25,el:6}, muscles:['abdominals','obliques'], muscleSide:'L', props:[KB],
  frames:{ start:{ root:{pos:[0,0.88,0]}, armL:rackArm, armR:sp, ...feet(0.22,-40) },
    mid:wm({hx:0.06,hy:0.8,pitch:15,roll:26,side:-16,bell:[0.2,1.55,0.15],free:sw(0.6,0.15),legs:feet(0.22,-40)}),
    end:deep({bell:[0.0,1.3,0.08],free:floorH(-0.38,0.3)}) } });
// bent-press mid: bell still near the shoulder, pressing
{ const o=JSON.parse(fs.readFileSync(new URL('../bent-press.json', import.meta.url))); o.frames.mid.armL={...rackArm,pos:[0.12,1.4,0.15]}; fs.writeFileSync(new URL('../bent-press.json', import.meta.url), JSON.stringify(o,null,1)); }

const sq = (y,z,pitch,bell,fx) => ({ root:{pos:[0,y,z],pitch}, spine:{flex:0}, neck:{flex:-pitch*0.4},
  armL:up(bell), armR:{fk:{flex:10,abd:fx,elbow:15},curl:0.3}, ...feet(0.2,22) });
W('one-arm-overhead-kettlebell-squats', { camera:{az:50,el:6}, muscles:['quadriceps','glutes'], muscleSide:'L', props:[KB],
  frames:{ start:sq(0.925,0,0,[0.2,1.96,0.05],15), end:sq(0.5,-0.2,15,[0.2,1.45,0.12],40) } });

const X=0.11;
const horns = (y,z,pl) => ({ armL:{pos:[X+0.095,y,z],contact:true,fingers:[0,0,1],palm:[-1,0,0],curl:0.85,pole:[0.4+pl,-1,-0.5+pl*-0.2]},
                          armR:{pos:[X-0.095,y,z],contact:true,fingers:[0,0,1],palm:[1,0,0],curl:0.85,pole:[-0.4-pl,-1,-0.5+pl*-0.2]} });
const stand = {pos:[X,0,0.03],anchor:'sole',yaw:0,pitch:0,pole:[0.1,0,1]};
const free = (y,z) => ({pos:[-0.11,y,z],anchor:'heel',yaw:0,pitch:20,pole:[-0.1,1,0]});
W('kettlebell-pistol-squat', { camera:{az:60,el:6}, muscles:['quadriceps','glutes'], props:[{type:'kettlebell',hands:true,kg:16,mode:'horns'}],
  frames:{ start:{ root:{pos:[X,0.925,0]}, ...horns(1.2,0.2,0), legL:stand, legR:free(0.3,0.5) },
    end:{ root:{pos:[X,0.42,-0.16],pitch:18}, spine:{flex:4}, neck:{flex:-14}, ...horns(0.77,0.24,0.1), legL:stand, legR:free(0.2,0.55) } } });

const gh = (p,pole,f=[0,-0.98,0.2],pm=[0,-0.2,-0.98]) => ({ pos:p, contact:true, hand:'grip', grip:0.0165, fingers:f, palm:pm, curl:0.85, pole });
const lgs = { legL:{pos:[0.3,0,0.62],anchor:'sole',pitch:0,pole:[0.2,0,1]}, legR:{pos:[-0.11,0,-0.3],anchor:'ball',pitch:38,pole:[-0.1,0,1]} };
const lun = (a) => ({ root:{pos:[0.05,0.58,0.15],pitch:46}, spine:{flex:4}, neck:{flex:-25}, ...a, ...lgs });
W('lunge-pass-through', { camera:{az:50,el:6}, muscles:['quadriceps','glutes','hamstrings'],
  props:[{type:'kettlebell',kg:16,hand:'L',mode:'hang'}],
  frames:{ start:{ root:{pos:[0,0.92,0]}, armL:gh([0.28,0.88,0.02],[1,0,-0.3]), armR:{pos:[-0.3,0.95,0.02],hand:'relaxed',pole:[-1,-0.2,-0.3]}, legL:{pos:[0.11,0,0.02],anchor:'sole',pitch:0,pole:[0.1,0,1]}, legR:{pos:[-0.11,0,0.02],anchor:'sole',pitch:0,pole:[-0.1,0,1]} },
    mid:lun({armL:gh([0.02,0.36,0.4],[0.3,0,-0.5]),armR:{pos:[-0.06,0.36,0.4],hand:'relaxed',pole:[-0.3,0,-0.5]}}),
    end:lun({armL:gh([0.02,0.36,0.4],[0.3,0,-0.5]),armR:{pos:[-0.06,0.36,0.4],hand:'relaxed',pole:[-0.3,0,-0.5]}}) } });
