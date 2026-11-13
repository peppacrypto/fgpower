import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const d2r = Math.PI/180;
const sh = (root, s) => { const p = root.pitch ?? 0; return [0.19*s, root.pos[1]+0.46*Math.cos(p*d2r), root.pos[2]+0.46*Math.sin(p*d2r)]; };
const R = (a) => a.map(v=>+v.toFixed(3));
// supine press hand: pos, palm in
const pressHand = (pos, s, bottom) => ({ pos:R(pos), contact:true, fingers:[0.05*s,1,0.0], palm:[-0.65*s,0.0,0.76], curl:0.85, pole:[bottom?0.7*s:0.8*s,bottom?-0.15:-0.1,bottom?0.1:-0.3] });
const kb = (hand, kg=16, mode='rack') => ({ type:'kettlebell', hand, kg, mode });
const base = { x:0, y:0.17, z:0.2 };
const supine = () => ({ pos:[0,base.y,base.z], pitch:-90 });
const bentLegs = (zf=0.62) => ({ legL:{pos:[0.15,0,zf],anchor:'sole',pole:[0.2,1,0.5]}, legR:{pos:[-0.15,0,zf],anchor:'sole',pole:[-0.2,1,0.5]} });
const freeFloor = s => ({ fk:{flex:0,abd:42,elbow:4}, curl:0.2 });
const lyingFree = { fk:{flex:0,abd:40,rot:0,elbow:5}, curl:0.2 };
const root = supine();
const shL = sh(root,1), shR = sh(root,-1);
const top = s => pressHand([ (s>0?shL:shR)[0]+0.0, (s>0?shL:shR)[1]+0.66, (s>0?shL:shR)[2]-0.0 ], s, false);
const low = s => pressHand([0.34*s, 0.36, shL[2]+0.0], s, true);
const press = (armL, armR, extra={}) => ({ root, neck:{flex:6}, ...bentLegs(), armL, armR, ...extra });
const cam = {az:40,el:10};
W('one-arm-kettlebell-floor-press', { camera:cam, muscles:['chest','triceps','anterior-deltoid'], muscleSide:'L', floats:true,
  props:[kb('L')], frames:{ start:press(low(1),lyingFree), end:press(top(1),lyingFree) } });
W('alternating-floor-press', { camera:{az:75,el:12}, tempo:{lift:'even',up:1.0,down:1.8,pauses:0.35}, muscles:['chest','triceps','anterior-deltoid'], floats:true,
  props:[kb('L'),kb('R')], frames:{ start:press(top(1),low(-1)), end:press(low(1),top(-1)) } });
// leg over: R straight on the floor, L leg straight crossed over it
const legOver = { legR:{pos:[-0.1,0,0.95],anchor:'heel',pitch:-70,pole:[0,1,0]}, legL:{pos:[-0.28,0,0.3],anchor:'sole',pole:[-0.3,1,0]} };
const lo = (arm) => ({ root, neck:{flex:6}, ...legOver, armL:arm, armR:{ fk:{flex:0,abd:75,elbow:4}, curl:0.2 } });
W('leg-over-floor-press', { camera:{az:75,el:14}, tempo:{lift:'even',up:1.0,down:1.8,pauses:0.3}, muscles:['chest','triceps','anterior-deltoid'], muscleSide:'L', floats:true,
  props:[kb('L')], frames:{ start:lo(low(1)), end:lo(top(1)) } });
// extended range: L knee crosses midline, torso turns
const extLow = (s) => { const h = low(s); return { ...h, pos:R([h.pos[0], 0.33, h.pos[2]]) }; };
const ext = (arm) => ({ root:{pos:[0,0.17,0.2],pitch:-90}, neck:{flex:6},
  legL:{pos:[0.08,0,0.62],anchor:'sole',pole:[-0.3,1,0.3]}, legR:{pos:[-0.22,0,0.62],anchor:'sole',pole:[-0.2,1,0.5]}, armL:arm, armR:{fk:{flex:0,abd:60,elbow:4},curl:0.2} });
W('extended-range-one-arm-kettlebell-floor-press', { camera:{az:75,el:14}, tempo:{lift:'even',up:1.0,down:1.8,pauses:0.3}, muscles:['chest','anterior-deltoid'], muscleSide:'L', floats:true,
  props:[kb('L')], frames:{ start:ext(extLow(1)), end:ext(top(1)) } });

// ---- Turkish get-ups: bell in LEFT hand, always vertical over the left shoulder
const gHand = (r) => { const p = sh(r,1); return { pos:R([p[0],p[1]+0.61,p[2]]), contact:true, fingers:[0,1,0.03], palm:[-0.5,0,0.87], curl:0.85, pole:[0.8,-0.1,-0.3] }; };
const floorHand = (p) => ({ pos:p, contact:true, hand:'flat', fingers:[-0.3,0,1], palm:[0,-1,0], pole:[-0.35,0.15,-0.9] });
const freeArm = (p) => ({ pos:p, rel:'world', hand:'flat', fingers:[-0.3,0,1], palm:[0,-1,0], pole:[-0.35,-0.1,-0.9], curl:0.2, roll:0 });
const gstart = { root:supine(), neck:{flex:6}, legL:{pos:[0.2,0,0.58],anchor:'sole',pole:[0.2,1,0.5]}, legR:{pos:[-0.2,0.015,0.95],anchor:'heel',pitch:-70,pole:[-0.1,1,0]}, armL:gHand(supine()), armR:floorHand([-0.32,0,0.05]) };
const r1 = { pos:[0,0.09,0.2], pitch:-60 };
const gelbow = { root:r1, neck:{flex:-4}, spine:{flex:0}, legL:{pos:[0.2,0,0.58],anchor:'sole',pole:[0.2,1,0.5]}, legR:{pos:[-0.2,0.015,0.95],anchor:'heel',pitch:-70,pole:[-0.1,1,0]}, armL:gHand(r1),
  armR:{ pos:[-0.32,0.0,0.05], contact:true, hand:'flat', fingers:[-0.2,0,1], palm:[0,-1,0], pole:[-0.35,-0.1,-0.9] } };
const r2 = { pos:[0,0.09,0.27], pitch:-34 };
const ghand = { root:r2, neck:{flex:-6}, legL:{pos:[0.2,0,0.58],anchor:'sole',pole:[0.2,1,0.5]}, legR:{pos:[-0.2,0.015,0.95],anchor:'heel',pitch:-70,pole:[-0.1,1,0]}, armL:gHand(r2), armR:floorHand([-0.32,0,0.05]) };
const stand = { root:{pos:[0,0.925,0.58],pitch:0}, neck:{flex:-6}, legL:{pos:[0.2,0,0.58],anchor:'sole',pole:[0.2,1,0.5]}, legR:{pos:[-0.2,0.03,0.58],anchor:'sole',yaw:-20,pole:[-0.1,0,1]}, armL:gHand({pos:[0,0.925,0.58],pitch:0}), armR:freeArm([-0.55,1.15,0.62]) };
const r3 = { pos:[0,0.5,0.15], pitch:0 };
const lunge = { root:r3, neck:{flex:-6}, legL:{pos:[0.2,0,0.58],anchor:'sole',pole:[0.2,1,0.5]}, legR:{pos:[-0.11,0.09,-0.42],anchor:'ball',pitch:80,pole:[0,-0.3,1]}, armL:gHand(r3), armR:freeArm([-0.45,0.8,0.22]) };
const r4 = { pos:[0,0.53,0.52], pitch:4 };
const squat = { root:r4, neck:{flex:-8}, legL:{pos:[0.2,0,0.58],anchor:'sole',pole:[0.2,1,0.5]}, legR:{pos:[-0.2,0,0.58],anchor:'sole',yaw:-20,pole:[-0.5,0.3,1]}, armL:gHand(r4), armR:freeArm([-0.45,0.7,0.8]) };
const gcommon = { camera:{az:90,el:8}, tempo:{lift:'even',up:1.6,down:2.2,pauses:0.45}, muscles:['shoulders','abdominals','glutes'], muscleSide:'L', floats:true, props:[kb('L')] };
const rb = { pos:[0,0.17,0.37], pitch:-38 };
const bridge = { ...ghand, root:rb, armL:gHand(rb), neck:{flex:-6}, legR:{pos:[-0.2,0.015,0.95],anchor:'heel',pitch:-70,pole:[-0.1,1,0]} };
const lift = (r, z) => ({ ...lunge, root:r, legR:{pos:[-0.2,0.2,z],anchor:'ball',pitch:20,pole:[-0.2,1,0.5]}, armL:gHand(r), armR:floorHand([-0.32,0,0.05]) });
const sweep = { ...lift({pos:[0,0.3,0.28],pitch:-15}, 0.8), armR:{...freeArm([-0.36,0.25,0.12]), fingers:[-0.3,-0.2,1]} };
const toStand = { ...stand, root:{pos:[0,0.75,0.42],pitch:6}, legR:{pos:[-0.2,0.35,0.58],anchor:'sole',yaw:-20,pole:[-0.1,0.2,1]}, armL:gHand({pos:[0,0.75,0.42],pitch:6}), armR:freeArm([-0.5,0.9,0.6]) };
const r4b = { pos:[0,0.54,0.5], pitch:4 };
const deepSquat = { ...squat, root:r4b, armL:gHand(r4b), legR:{...squat.legR, pos:[-0.2,0.03,0.58]} };
W('kettlebell-turkish-get-up-lunge-style', { ...gcommon, frames:{ start:gstart, mid:gelbow, mid2:ghand, mid3:bridge, mid4:sweep, mid5:lunge, mid6:toStand, end:stand } });
W('kettlebell-turkish-get-up-squat-style', { ...gcommon, frames:{ start:gstart, mid:gelbow, mid2:ghand, mid3:bridge, mid4:sweep, mid5:deepSquat, end:stand } });
