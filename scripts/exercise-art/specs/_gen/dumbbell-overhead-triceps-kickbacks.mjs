import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const M = ['triceps'];
// ---------- overhead, both hands cupped under one dumbbell (goblet hold, upright) ----------
const stdLegs = { legL:{pos:[0.13,0,0.02],anchor:'sole',yaw:6,pole:[0.1,0,1]}, legR:{pos:[-0.13,0,0.02],anchor:'sole',yaw:-6,pole:[-0.1,0,1]} };
const seatLegs = { legL:{pos:[0.21,0,0.62],anchor:'sole',pole:[0.2,0.4,1]}, legR:{pos:[-0.21,0,0.62],anchor:'sole',pole:[-0.2,0.4,1]} };
const fkA = (flex, el, abd=14, rot=0, hand='relaxed') => ({ fk:{flex,abd,rot,elbow:el}, rel:'chest', hand, pron:0 });
const ov = (rootF, flex, el, abd, rot, hd) => ({ ...rootF, armL:fkA(flex,el,abd,rot,hd), armR:fkA(flex,el,abd,rot,hd) });
const seatRoot = { root:{pos:[0,0.585,0.154],pitch:-8}, neck:{flex:-2} };
const standRoot = { root:{pos:[0,0.925,0]}, neck:{flex:0}, ...stdLegs };
const dbGoblet = { type:'dumbbell', hands:true, hold:'goblet', kg:15 };
W('seated-triceps-press', { camera:{az:62,el:8}, muscles:M, floats:true,
  props:[{type:'shoulder-press-bench'}, dbGoblet],
  frames:{ start:ov({...seatRoot,...seatLegs},168,8,-11,0,'grip'), mid:ov({...seatRoot,...seatLegs},176,65,-11,0,'grip'), end:ov({...seatRoot,...seatLegs},168,125,-9,0,'grip') } });
W('standing-dumbbell-triceps-extension', { camera:{az:62,el:8}, muscles:M, props:[dbGoblet],
  frames:{ start:ov(standRoot,168,8,-11,0,'grip'), mid:ov(standRoot,176,65,-11,0,'grip'), end:ov(standRoot,168,125,-9,0,'grip') } });
// ---------- kettlebell overhead ----------
const kb = (el) => ov(standRoot,168,el,-8,0,'grip');
W('kettlebell-overhead-triceps-extension', { camera:{az:62,el:8}, muscles:M,
  props:[{type:'kettlebell', kg:16, mode:'horns', hands:true, up:[0,1,0]}],
  frames:{ start:kb(8), mid:ov(standRoot,176,65,-9,0,'grip'), end:kb(125) } });
// ---------- one-arm overhead: neutral grip, upper arm beside the head ----------
const one = (el) => fkA(165,el,10,0,'grip');
const freeArm = { fk:{flex:0,abd:10,elbow:6}, rel:'chest', hand:'relaxed' };
W('standing-one-arm-dumbbell-triceps-extension', { camera:{az:62,el:8}, muscles:M, muscleSide:'L',
  props:[{type:'dumbbell', hand:'L', kg:10}],
  frames:{ start:{...standRoot, armL:one(8), armR:freeArm}, end:{...standRoot, armL:one(125), armR:freeArm} } });
W('dumbbell-one-arm-triceps-extension', { camera:{az:62,el:8}, muscles:M, muscleSide:'L', floats:true,
  props:[{type:'shoulder-press-bench'}, {type:'dumbbell', hand:'L', kg:10}],
  frames:{ start:{...seatRoot,...seatLegs, armL:one(8), armR:freeArm}, end:{...seatRoot,...seatLegs, armL:one(125), armR:freeArm} } });
// ---------- bent-over kickbacks (fk arms: upper arm fixed along the torso, forearm swings) ----------
const kickArm = (el) => ({ fk:{flex:-25,abd:27,rot:0,elbow:el}, rel:'chest', hand:'grip', pron:0 });
const restThigh = { fk:{flex:0,abd:24,elbow:8}, rel:'chest', hand:'relaxed' };
const bentRoot = { root:{pos:[0,0.8,-0.3],pitch:65}, neck:{flex:-35} };
const bentLegs = { legL:{pos:[0.14,0,-0.05],anchor:'sole',yaw:6,pole:[0.2,0.5,1]}, legR:{pos:[-0.14,0,-0.05],anchor:'sole',yaw:-6,pole:[-0.2,0.5,1]} };
const seatBenchRoot = { root:{pos:[0,0.54,0.33],pitch:63}, neck:{flex:-32} };
const seatBenchLegs = { legL:{pos:[0.21,0,0.97],anchor:'sole',pole:[0.5,0.5,1]}, legR:{pos:[-0.21,0,0.97],anchor:'sole',pole:[-0.5,0.5,1]} };
const bench = { type:'flat-bench' };
const kbk = (r, l, e, one2) => ({ ...r, ...l, armL:kickArm(e), armR: one2 ? one2 : kickArm(e) });
const dbs = [{type:'dumbbell',hand:'L',kg:8},{type:'dumbbell',hand:'R',kg:8}];
W('tricep-dumbbell-kickback', { camera:{az:95,el:8}, muscles:M, props:dbs,
  frames:{ start:kbk(bentRoot,bentLegs,90), end:kbk(bentRoot,bentLegs,6) } });
W('standing-bent-over-two-arm-dumbbell-triceps-extension', { camera:{az:95,el:8}, muscles:M, props:dbs,
  frames:{ start:kbk(bentRoot,bentLegs,90), end:kbk(bentRoot,bentLegs,6) } });
W('standing-bent-over-one-arm-dumbbell-triceps-extension', { camera:{az:95,el:8}, muscles:M, muscleSide:'L', props:[dbs[0]],
  frames:{ start:kbk(bentRoot,bentLegs,90,restThigh), end:kbk(bentRoot,bentLegs,6,restThigh) } });
W('seated-bent-over-two-arm-dumbbell-triceps-extension', { camera:{az:95,el:8}, muscles:M, floats:false, props:[bench,...dbs],
  frames:{ start:kbk(seatBenchRoot,seatBenchLegs,90), end:kbk(seatBenchRoot,seatBenchLegs,6) } });
W('seated-bent-over-one-arm-dumbbell-triceps-extension', { camera:{az:95,el:8}, muscles:M, muscleSide:'L', props:[bench,dbs[0]],
  frames:{ start:kbk(seatBenchRoot,seatBenchLegs,90,restThigh), end:kbk(seatBenchRoot,seatBenchLegs,6,restThigh) } });
