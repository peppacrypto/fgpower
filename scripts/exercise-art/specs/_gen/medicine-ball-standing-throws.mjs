import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const feet = (x=0.17, z=0.03, yaw=12) => ({ legL:{pos:[x,0,z],anchor:'sole',yaw,pitch:0,pole:[0.25,0,1]}, legR:{pos:[-x,0,z],anchor:'sole',yaw:-yaw,pitch:0,pole:[-0.25,0,1]} });
const hands = (y, z, fy=0.85, fz=0.5, x=0.125, curl=0.25, pole) => {
  const p = pole || [0.15,-0.3,1];
  return { armL:{pos:[x,y,z],contact:true,fingers:[0,fy,fz],palm:[-1,0,0],curl,pole:p},
           armR:{pos:[-x,y,z],contact:true,fingers:[0,fy,fz],palm:[1,0,0],curl,pole:[-p[0],p[1],p[2]]} }; };
const ball = { type:'medicine-ball', hands:true, kg:6 };
const F = (root, spine, neck, arms, leg) => ({ root, spine, neck, ...arms, ...(leg||feet()) });

// overhead slam
W('overhead-slam', { camera:{az:62,el:6}, muscles:['lats','abdominals'], props:[ball], frames:{
  start:F({pos:[0,0.93,-0.03],pitch:-4},{flex:-5},{flex:-14},hands(1.97,0.12),feet(0.2,0.03,12)),
  mid:F({pos:[0,0.93,0.0],pitch:4},{flex:5},{flex:-6},hands(1.75,0.4,0.6,0.8,0.125,0.25,[1,-0.4,0.1]),feet(0.2,0.03,12)),
  mid2:F({pos:[0,0.84,-0.1],pitch:25},{flex:12},{flex:-12},hands(1.2,0.62,0.0,1,0.125,0.25,[0.3,-0.2,-0.2]),feet(0.2,0.03,12)),
  end:F({pos:[0,0.62,-0.28],pitch:60},{flex:18},{flex:-20},hands(0.2,0.4,-0.7,0.7,0.125,0.25,[0.8,0.2,-0.6]),feet(0.2,0.03,12)) }});

// two-arm overhead throw: ball behind head, lean back, then throw forward (end = follow through, ball in flight)
const behind = hands(1.9,-0.2,0.95,-0.3,0.125,0.25,[0.15,-0.3,1]);
W('standing-two-arm-overhead-throw', { camera:{az:62,el:6}, muscles:['shoulders','lats'], props:[ball], frames:{
  start:F({pos:[0,0.89,-0.08],pitch:-12},{flex:-12},{flex:-8},behind,feet(0.17,0.03,12)),
  mid:F({pos:[0,0.93,0.0],pitch:0},{flex:0},{flex:-6},hands(2.0,0.15,0.95,0.3,0.125,0.25,[0.15,-0.3,1]),feet(0.17,0.03,12)),
  end:F({pos:[0,0.82,0.1],pitch:28},{flex:10},{flex:-8},hands(1.6,0.85,0.3,0.95,0.125,0.25,[1,-0.3,0.3]),feet(0.17,0.03,12)) }});
{ const o=JSON.parse(fs.readFileSync(new URL('../standing-two-arm-overhead-throw.json',import.meta.url))); delete o.slug; W('catch-and-overhead-throw',o); }

// backward throw: ball between legs (arms straight down between the knees), then extend and throw overhead backward
const sq = feet(0.26,0.0,25);
W('backward-medicine-ball-throw', { camera:{az:62,el:6}, muscles:['shoulders','glutes'], props:[ball], frames:{
  start:F({pos:[0,0.66,-0.2],pitch:45},{flex:8},{flex:-30},hands(0.5,0.3,-0.8,0.5,0.125,0.25,[0.8,-0.2,-0.6]),sq),
  mid:F({pos:[0,0.86,-0.06],pitch:10},{flex:0},{flex:-10},hands(1.0,0.3,0.1,1,0.125,0.25,[1,-0.4,0.1]),sq),
  mid2:F({pos:[0,0.92,-0.08],pitch:-6},{flex:-4},{flex:-8},hands(1.95,0.1,0.95,0.3,0.125,0.25,[1,-0.4,0.1]),sq),
  end:F({pos:[0,0.92,-0.12],pitch:-14},{flex:-8},{flex:-6},hands(1.95,-0.3,0.95,-0.3,0.125,0.25,[0.5,-0.3,0.6]),sq) }});

// scoop throw: semisquat, ball near feet, then hips forward and arms swing up and over
W('medicine-ball-scoop-throw', { camera:{az:62,el:6}, muscles:['shoulders','glutes'], props:[ball], frames:{
  start:F({pos:[0,0.68,-0.2],pitch:42},{flex:8},{flex:-30},hands(0.5,0.3,-0.8,0.5,0.125,0.25,[0.8,-0.2,-0.6]),sq),
  mid:F({pos:[0,0.88,-0.05],pitch:8},{flex:0},{flex:-10},hands(1.1,0.5,0.1,1,0.125,0.25,[1,-0.4,0.1]),sq),
  mid2:F({pos:[0,0.9,-0.06],pitch:0},{flex:0},{flex:-10},hands(1.7,0.3,0.8,0.5,0.125,0.25,[1,-0.4,0.1]),sq),
  end:F({pos:[0,0.92,-0.1],pitch:-12},{flex:-8},{flex:-8},hands(1.95,-0.3,0.95,-0.3,0.125,0.25,[0.5,-0.3,0.6]),sq) }});

// one-arm slam: ball in one hand (palm under it), staggered stance
const stag = { legL:{pos:[0.12,0,0.12],anchor:'sole',yaw:10,pitch:0,pole:[0.1,0,1]}, legR:{pos:[-0.14,0,-0.1],anchor:'ball',yaw:-10,pitch:15,pole:[-0.1,0,1]} };
const one = (y,z,fy,fz,pole) => ({ armL:{pos:[0.26,y,z],hand:'open',fingers:[0,fy,fz],palm:[-1,0,0],curl:0.1,pole}, armR:{fk:{flex:25,abd:25,elbow:20},hand:'relaxed'} });
const oneF = (root,sp,nk,arm) => F(root,sp,nk,arm,stag);
W('one-arm-medicine-ball-slam', { camera:{az:62,el:6}, muscles:['abdominals','lats'], muscleSide:'L', props:[{type:'medicine-ball',hand:'L',kg:4}], frames:{
  start:oneF({pos:[0,0.92,0],pitch:-6},{flex:-5},{flex:-12},one(1.88,0.0,0.9,0.4,[0.5,-0.3,0.6])),
  mid:oneF({pos:[0,0.9,0.0],pitch:12},{flex:6},{flex:-12},one(1.6,0.45,0.2,0.98,[0.9,-0.3,0.3])),
  end:oneF({pos:[0,0.7,0.0],pitch:45},{flex:18},{flex:-20},one(0.4,0.5,-0.85,0.5,[0.15,0.3,-0.7])) }});

// full twist: ball at chest, rotate the trunk fully to one side
const twist = (t, yawr) => F({pos:[0,0.93,0],pitch:0,yaw:yawr},{flex:2,twist:t},{flex:0,twist:-t/2},hands(1.2,0.32,0.2,0.95,0.125,0.25,[0.3,-0.4,-0.3]));
W('medicine-ball-full-twist', { camera:{az:30,el:8}, muscles:['obliques','abdominals'], props:[ball], frames:{
  start:twist(-45,-25), mid:twist(0,0), end:twist(45,25) }});
