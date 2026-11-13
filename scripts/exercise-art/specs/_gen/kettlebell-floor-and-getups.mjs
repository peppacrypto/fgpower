import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const d2r = Math.PI/180;
const sh = (root, s) => { const p = root.pitch ?? 0; return [0.19*s, root.pos[1]+0.46*Math.cos(p*d2r), root.pos[2]+0.46*Math.sin(p*d2r)]; };
const R = (a) => a.map(v=>+v.toFixed(3));
// supine press hand: pos, palm in
const pressHand = (pos, s, bottom) => ({ pos:R(pos), contact:true, fingers:[0.05*s,1,0.0], palm:[-0.5*s,0.0,0.87], curl:0.85, pole:[bottom?0.7*s:0.8*s,bottom?-0.15:-0.1,bottom?0.1:-0.3] });
const kb = (hand, kg=16, mode='rack') => ({ type:'kettlebell', hand, kg, mode });
const base = { x:0, y:0.17, z:0.2 };
const supine = () => ({ pos:[0,base.y,base.z], pitch:-90 });
const bentLegs = (zf=0.62) => ({ legL:{pos:[0.15,0,zf],anchor:'sole',pole:[0.2,1,0.5]}, legR:{pos:[-0.15,0,zf],anchor:'sole',pole:[-0.2,1,0.5]} });
const freeFloor = s => ({ fk:{flex:0,abd:42,elbow:4}, curl:0.2 });
const lyingFree = { fk:{flex:0,abd:40,rot:0,elbow:5}, curl:0.2 };
const root = supine();
const shL = sh(root,1), shR = sh(root,-1);
const top = s => pressHand([ (s>0?shL:shR)[0]+0.0, (s>0?shL:shR)[1]+0.50, (s>0?shL:shR)[2]-0.0 ], s, false);
const low = s => pressHand([0.34*s, 0.36, shL[2]+0.0], s, true);
const press = (armL, armR, extra={}) => ({ root, neck:{flex:6}, ...bentLegs(), armL, armR, ...extra });
const cam = {az:40,el:10};
W('one-arm-kettlebell-floor-press', { camera:cam, muscles:['chest','triceps','anterior-deltoid'], muscleSide:'L', floats:true,
  props:[kb('L')], frames:{ start:press(low(1),lyingFree), end:press(top(1),lyingFree) } });
W('alternating-floor-press', { camera:{az:35,el:12}, muscles:['chest','triceps','anterior-deltoid'], floats:true,
  props:[kb('L'),kb('R')], frames:{ start:press(top(1),low(-1)), end:press(low(1),top(-1)) } });
// leg over: R straight on the floor, L leg straight crossed over it
const legOver = { legR:{pos:[-0.42,0.0,0.92],anchor:'heel',pitch:-70,pole:[0,1,0]}, legL:{pos:[-0.3,0.6,0.82],anchor:'ankle',pitch:-55,yaw:-15,pole:[0,1,0]} };
const lo = (arm) => ({ root, neck:{flex:6}, ...legOver, armL:arm, armR:{ fk:{flex:0,abd:75,elbow:4}, curl:0.2 } });
W('leg-over-floor-press', { camera:{az:45,el:14}, muscles:['chest','triceps','anterior-deltoid'], muscleSide:'L', floats:true,
  props:[kb('L')], frames:{ start:lo(low(1)), end:lo(top(1)) } });
// extended range: L knee crosses midline, torso turns
const ext = (arm) => ({ root:{pos:[0,0.17,0.2],pitch:-90}, spine:{twist:18,weights:[0,0,0.3,0.7,1]}, neck:{flex:6},
  legL:{pos:[0.0,0,0.6],anchor:'sole',pole:[-0.3,1,0]}, legR:{pos:[-0.5,0,0.85],anchor:'heel',pitch:-70,pole:[0,1,0]}, armL:arm, armR:{fk:{flex:0,abd:55,elbow:4},curl:0.2} });
W('extended-range-one-arm-kettlebell-floor-press', { camera:{az:30,el:14}, muscles:['chest','anterior-deltoid'], muscleSide:'L', floats:true,
  props:[kb('L')], frames:{ start:ext(low(1)), end:ext(top(1)) } });

// ---- Turkish get-ups: bell in LEFT hand, always vertical over the left shoulder
const gHand = (r) => { const p = sh(r,1); return { pos:R([p[0],p[1]+0.49,p[2]]), contact:true, fingers:[0,1,0.03], palm:[-0.5,0,0.87], curl:0.85, pole:[0.8,-0.1,-0.3] }; };
const floorHand = (p) => ({ pos:p, contact:true, hand:'flat', fingers:[-0.3,0,1], palm:[0,-1,0], pole:[-0.35,-0.1,-0.9] });
const freeArm = (p) => ({ pos:p, rel:'world', hand:'flat', fingers:[-0.3,0,1], palm:[0,-1,0], pole:[-0.35,-0.1,-0.9], curl:0.2, roll:0 });
const gstart = { root:supine(), neck:{flex:6}, legL:{pos:[0.2,0,0.58],anchor:'sole',pole:[0.2,1,0.5]}, legR:{pos:[-0.2,0.015,0.95],anchor:'heel',pitch:-70,pole:[-0.1,1,0]}, armL:gHand(supine()), armR:floorHand([-0.52,0,0.05]) };
const r1 = { pos:[0,0.09,0.2], pitch:-60 };
const gelbow = { root:r1, neck:{flex:-4}, spine:{flex:0}, legL:{pos:[0.2,0,0.58],anchor:'sole',pole:[0.2,1,0.5]}, legR:{pos:[-0.2,0.015,0.95],anchor:'heel',pitch:-70,pole:[-0.1,1,0]}, armL:gHand(r1),
  armR:{ pos:[-0.30,0.0,-0.02], contact:true, hand:'flat', fingers:[-0.2,0,1], palm:[0,-1,0], pole:[-0.35,-0.1,-0.9] } };
const r2 = { pos:[0,0.1,0.26], pitch:-25 };
const ghand = { root:r2, neck:{flex:-6}, legL:{pos:[0.2,0,0.58],anchor:'sole',pole:[0.2,1,0.5]}, legR:{pos:[-0.2,0.015,0.95],anchor:'heel',pitch:-70,pole:[-0.1,1,0]}, armL:gHand(r2), armR:floorHand([-0.3,0,0.14]) };
const stand = { root:{pos:[0,0.925,0.58],pitch:0}, neck:{flex:-6}, legL:{pos:[0.2,0,0.58],anchor:'sole',yaw:20,pole:[0.1,0,1]}, legR:{pos:[-0.2,0,0.58],anchor:'sole',yaw:-20,pole:[-0.1,0,1]}, armL:gHand({pos:[0,0.925,0.58],pitch:0}), armR:freeArm([-0.55,1.15,0.62]) };
const r3 = { pos:[0,0.5,0.15], pitch:0 };
const lunge = { root:r3, neck:{flex:-6}, legL:{pos:[0.2,0,0.58],anchor:'sole',pole:[0.1,0.3,1]}, legR:{pos:[-0.11,0.09,-0.42],anchor:'ball',pitch:80,pole:[0,-0.3,1]}, armL:gHand(r3), armR:freeArm([-0.55,1.1,0.2]) };
const r4 = { pos:[0,0.53,0.52], pitch:12 };
const squat = { root:r4, neck:{flex:-8}, legL:{pos:[0.2,0,0.58],anchor:'sole',yaw:20,pole:[0.5,0.3,1]}, legR:{pos:[-0.2,0,0.58],anchor:'sole',yaw:-20,pole:[-0.5,0.3,1]}, armL:gHand(r4), armR:freeArm([-0.45,0.7,0.8]) };
const gcommon = { camera:{az:55,el:10}, muscles:['shoulders','abdominals','glutes'], muscleSide:'L', floats:true, props:[kb('L')] };
W('kettlebell-turkish-get-up-lunge-style', { ...gcommon, frames:{ start:gstart, mid:gelbow, mid2:ghand, mid3:lunge, end:stand } });
W('kettlebell-turkish-get-up-squat-style', { ...gcommon, frames:{ start:gstart, mid:gelbow, mid2:ghand, mid3:squat, end:stand } });
