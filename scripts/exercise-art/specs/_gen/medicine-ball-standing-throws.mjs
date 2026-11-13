import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const feet = (x=0.17, z=0.03, yaw=12) => ({ legL:{pos:[x,0,z],anchor:'sole',yaw,pitch:0,pole:[0.25,0,1]}, legR:{pos:[-x,0,z],anchor:'sole',yaw:-yaw,pitch:0,pole:[-0.25,0,1]} });
const hands = (y, z, fy=0.85, fz=0.5, x=0.125, curl=0.25, pole) => {
  const p = pole || [0.15,-0.3,1];
  return { armL:{pos:[x,y,z],contact:true,fingers:[0,fy,fz],palm:[-1,0,0],curl,pole:p},
           armR:{pos:[-x,y,z],contact:true,fingers:[0,fy,fz],palm:[1,0,0],curl,pole:[-p[0],p[1],p[2]]} }; };
const bf = (x=0.17,z=0.03,yaw=12,p=0) => ({ legL:{pos:[x,0,z+0.15],anchor:'ball',yaw,pitch:p,pole:[0.25,0,1]}, legR:{pos:[-x,0,z+0.15],anchor:'ball',yaw:-yaw,pitch:p,pole:[-0.25,0,1]} });
const up = (x,z,yaw) => bf(x,z,yaw,28);
const ball = { type:'medicine-ball', hands:true, kg:6 };
const F = (root, spine, neck, arms, leg) => ({ root, spine, neck, ...arms, ...(leg||feet()) });

// overhead slam
W('overhead-slam', { camera:{az:62,el:6}, muscles:['lats','abdominals'], props:[ball], frames:{
  start:F({pos:[0,0.97,-0.03],pitch:-6},{flex:-6},{flex:-14},hands(1.97,0.12),up(0.2,0.03,12)),
  mid:F({pos:[0,0.93,0.0],pitch:4},{flex:5},{flex:-6},hands(1.75,0.4,0.6,0.8,0.125,0.25,[1,-0.4,0.1]),bf(0.2,0.03,12)),
  mid2:F({pos:[0,0.84,-0.1],pitch:25},{flex:12},{flex:-12},hands(1.2,0.62,0.0,1,0.125,0.25,[0.3,-0.2,-0.2]),bf(0.2,0.03,12)),
  end:F({pos:[0,0.6,-0.3],pitch:60},{flex:14},{flex:-10},hands(0.2,0.4,-0.7,0.7,0.125,0.25,[0.8,0.2,-0.6]),bf(0.2,0.03,12)) },
  tempo:{lift:'back',up:1.0,down:0.3,squeeze:0.2,stretch:0.15} });

// two-arm overhead throw: ball behind head, lean back, then throw forward (end = follow through, ball in flight)
const behind = hands(1.9,-0.2,0.95,-0.3,0.125,0.25,[0.15,-0.3,1]);
W('standing-two-arm-overhead-throw', { camera:{az:62,el:6}, muscles:['shoulders','lats'], props:[ball], frames:{
  start:F({pos:[0,0.89,-0.08],pitch:-12},{flex:-12},{flex:-8},behind,bf(0.17,0.03,12)),
  mid:F({pos:[0,0.93,0.0],pitch:0},{flex:0},{flex:-6},hands(2.0,0.15,0.95,0.3,0.125,0.25,[0.15,-0.3,1]),up(0.17,0.03,12)),
  end:F({pos:[0,0.82,0.1],pitch:28},{flex:8},{flex:-6},hands(1.6,0.85,0.3,0.95,0.125,0.25,[1,-0.3,0.3]),bf(0.17,0.03,12)) }, tempo:{lift:'there',up:0.4,down:0.9} });
{ const o=JSON.parse(fs.readFileSync(new URL('../standing-two-arm-overhead-throw.json',import.meta.url))); delete o.slug;
  const f=o.frames; o.frames={ start:F({pos:[0,0.78,0.1],pitch:28},{flex:8},{flex:-6},hands(1.56,0.85,0.3,0.95,0.125,0.25,[1,-0.3,0.3]),bf(0.17,0.03,12)), mid:f.start, mid2:f.mid, end:f.end };
  o.muscles=['lats','shoulders']; o.tempo={lift:'there',up:0.4,down:0.9}; W('catch-and-overhead-throw',o); }

// backward throw: ball between legs (arms straight down between the knees), then extend and throw overhead backward
const sq = bf(0.26,0.0,25);
W('backward-medicine-ball-throw', { camera:{az:62,el:6}, muscles:['shoulders','glutes'], props:[ball], frames:{
  start:F({pos:[0,0.66,-0.2],pitch:45},{flex:8},{flex:-30},hands(0.5,0.3,-0.8,0.5,0.125,0.25,[0.8,-0.2,-0.6]),sq),
  mid:F({pos:[0,0.86,-0.06],pitch:10},{flex:0},{flex:-10},hands(1.0,0.3,0.1,1,0.125,0.25,[1,-0.4,0.1]),sq),
  mid2:F({pos:[0,0.92,-0.08],pitch:-6},{flex:-4},{flex:-8},hands(1.95,0.1,0.95,0.3,0.125,0.25,[1,-0.4,0.1]),sq),
  end:F({pos:[0,0.92,-0.12],pitch:-14},{flex:-8},{flex:-6},hands(1.95,-0.3,0.95,-0.3,0.125,0.25,[0.5,-0.3,0.6]),up(0.26,0.0,25)) }, tempo:{lift:'there',up:0.4,down:1.0} });

// scoop throw: semisquat, ball near feet, then hips forward and arms swing up and over
W('medicine-ball-scoop-throw', { camera:{az:62,el:6}, muscles:['shoulders','glutes'], props:[ball], frames:{
  start:F({pos:[0,0.68,-0.2],pitch:42},{flex:8},{flex:-30},hands(0.5,0.3,-0.8,0.5,0.125,0.25,[0.8,-0.2,-0.6]),sq),
  mid:F({pos:[0,0.88,-0.05],pitch:8},{flex:0},{flex:-10},hands(1.1,0.5,0.1,1,0.125,0.25,[1,-0.4,0.1]),sq),
  mid2:F({pos:[0,0.9,-0.06],pitch:0},{flex:0},{flex:-10},hands(1.7,0.3,0.8,0.5,0.125,0.25,[1,-0.4,0.1]),sq),
  end:F({pos:[0,0.92,-0.1],pitch:-12},{flex:-8},{flex:-8},hands(1.95,-0.3,0.95,-0.3,0.125,0.25,[0.5,-0.3,0.6]),up(0.26,0.0,25)) }, tempo:{lift:'there',up:0.4,down:1.0} });

// one-arm slam: ball in one hand (palm under it), staggered stance
const stag = { legL:{pos:[0.15,0,0.12],anchor:'sole',yaw:10,pitch:0,pole:[0.1,0,1]}, legR:{pos:[-0.17,0,-0.1],anchor:'ball',yaw:-10,pitch:15,pole:[-0.1,0,1]} };
const one = (y,z,fy,fz,pole) => ({ armL:{pos:[0.26,y,z],hand:'open',fingers:[0,fy,fz],palm:[-1,0,0],curl:0.1,pole}, armR:{fk:{flex:25,abd:25,elbow:20},hand:'relaxed'} });
const oneF = (root,sp,nk,arm) => F(root,sp,nk,arm,stag);
W('one-arm-medicine-ball-slam', { camera:{az:62,el:6}, muscles:['abdominals','lats'], muscleSide:'L', props:[{type:'medicine-ball',hand:'L',kg:4}], frames:{
  start:oneF({pos:[0,0.92,0],pitch:-6},{flex:-5},{flex:-12},one(1.88,0.0,0.9,0.4,[0.5,-0.3,0.6])),
  mid:oneF({pos:[0,0.9,0.0],pitch:12},{flex:6},{flex:-12},one(1.6,0.45,0.2,0.98,[0.9,-0.3,0.3])),
  end:oneF({pos:[0,0.66,-0.1],pitch:45},{flex:14},{flex:-14},one(0.4,0.5,-0.85,0.5,[0.15,0.3,-0.7])) }, tempo:{lift:'back',up:1.0,down:0.3,squeeze:0.2,stretch:0.15} });

// full twist: ball at arm's length at chest height carried through a wide arc, hips quiet on planted feet
const twist = (t) => { const a=t*Math.PI/180*0.9, c=Math.cos(a), n=Math.sin(a), R=0.52, y=1.4, x=0.125;
  const h=(sg)=>({pos:[R*n+sg*x*c,y,R*c-sg*x*n],contact:true,fingers:[0.95*n,0.2,0.95*c],palm:[-sg*c,0,sg*n],curl:0.25,pole:[0.3*c,-0.4,-0.3*n]});
  return F({pos:[0,0.93,0],pitch:0,yaw:-t*0.12},{flex:0,twist:t},{flex:0,twist:-t/3},{armL:h(1),armR:h(-1)}); };
W('medicine-ball-full-twist', { camera:{az:20,el:10}, muscles:['obliques','abdominals'], props:[ball], frames:{
  start:twist(-65), mid:twist(-33), mid2:twist(0), mid3:twist(33), end:twist(65) }, tempo:{lift:'even',up:1.0,down:1.0} });
