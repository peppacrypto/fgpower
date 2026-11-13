import fs from 'fs';
const R = Math.PI/180, sd = d => Math.sin(d*R), cd = d => Math.cos(d*R);
const out = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const norm = v => { const l = Math.hypot(...v); return v.map(x => +(x/l).toFixed(4)); };
const r3 = v => v.map(x => +x.toFixed(4));
// shoulder joint (left, +x) for a supine root pose (figure yaw 0)
const shoulder = (root) => { const p = root.pitch;
  return [0.19, root.pos[1] + 0.46*cd(p) + 0.053*(-sd(p)), root.pos[2] + 0.46*sd(p) + 0.053*cd(p)]; };
const legs = (z, y=0, x=0.22) => ({ legL:{pos:[x,y,z],anchor:'sole',pole:[0.3,1,0.3]}, legR:{pos:[-x,y,z],anchor:'sole',pole:[-0.3,1,0.3]} });

// ---------- flyes: arms swing in the frontal (XY) plane about the shoulder
const flyHand = (s, sh, th, w, o) => {
  const r = o.r ?? 0.47, f = [s*sd(th), cd(th), 0], u = [-s*cd(th), sd(th), 0];
  const face = o.face ?? [0,0,-1]; const k = face[0]*f[0]+face[1]*f[1]+face[2]*f[2];
  const fc = norm(face.map((x,i)=>x-k*f[i]));
  const palm = norm([0,1,2].map(i => sd(w)*u[i] + cd(w)*fc[i]));
  return { pos: r3([s*sh[0] + s*r*sd(th), sh[1] + r*cd(th), sh[2] + (o.dz??0)]), contact:true, hand:'grip', grip:0.016,
    fingers: r3(f), palm, pole: norm([s*(o.polex??0.45), o.pey??-1, o.pz??0]), curl:0.82 };
};
const flye = (slug, o) => {
  const root = o.root, sh = shoulder(root);
  const fr = (th, w) => { const f = { root, neck:{flex:6}, spine:{flex:-4}, ...o.legs };
    f.armL = flyHand(1, sh, th, w, o); f.armR = flyHand(-1, sh, th, w, o); return f; };
  const A = o.arc ?? [10, 55, 82], W = o.w ?? [90, 90, 90];
  const s = { camera:o.camera ?? {az:30,el:22}, muscles:o.muscles ?? ['chest'], floats:true,
    props:[ o.bench, {type:'dumbbell',kg:12,hand:'L'}, {type:'dumbbell',kg:12,hand:'R'} ],
    frames:{ start: fr(A[0], W[0]), mid: fr(A[1], W[1]), end: fr(A[2], W[2]) } };
  if (o.oneArm) { s.props.splice(2,1); // other hand rests on the bench edge
    for (const k in s.frames) s.frames[k].armR = { pos:[-0.17,0.44,0.28], contact:true, hand:'flat', fingers:[0,0,1], palm:[0,-1,0] };
    s.muscleSide = 'L'; }
  out(slug, s);
};
const flatRoot = { pos:[0,0.567,0.2], pitch:-90 };
const incRoot = { pos:[0,0.53,0.2], pitch:-60 };
const decRoot = { pos:[0,0.73,0.2], pitch:-110 };
const incLegs = legs(0.74), flatLegs = legs(0.74);
const decLegs = { legL:{pos:[0.22,0.3,0.66],anchor:'sole',pole:[0.3,1,0.3]}, legR:{pos:[-0.22,0.3,0.66],anchor:'sole',pole:[-0.3,1,0.3]} };
flye('dumbbell-flyes', { root:flatRoot, legs:flatLegs, bench:{type:'flat-bench'} });
flye('one-arm-flat-bench-dumbbell-flye', { root:flatRoot, legs:flatLegs, bench:{type:'flat-bench'}, oneArm:true });
flye('incline-dumbbell-flyes', { root:incRoot, legs:incLegs, bench:{type:'incline-bench',angle:30}, camera:{az:35,el:18}, muscles:['chest','anterior-deltoid'] });
flye('incline-dumbbell-flyes-with-a-twist', { root:incRoot, legs:incLegs, bench:{type:'incline-bench',angle:30}, camera:{az:35,el:18}, muscles:['chest','anterior-deltoid'],
  face:[0,0.5,-0.866], w:[0,45,90], arc:[8,50,80], polex:0.3, pey:-0.5, pz:0.8 });
flye('decline-dumbbell-flyes', { root:decRoot, legs:decLegs, bench:{type:'decline-bench',angle:20}, camera:{az:30,el:20} });

// ---------- around the worlds: palms up, arms level, sweep from the thighs to overhead in a horizontal semicircle
{ const root = flatRoot, sh = shoulder(root), r = 0.48;
  const hand = (s, a) => ({ pos: r3([s*(sh[0] + r*sd(a)), sh[1] - 0.02, sh[2] + r*cd(a)]), contact:true, hand:'grip', grip:0.016,
    fingers: norm([s*sd(a), 0, cd(a)]), palm:[0,1,0], pole:[s*0.2,-1,0], curl:0.82 });
  const fr = a => ({ root, neck:{flex:6}, spine:{flex:-4}, ...flatLegs, armL:hand(1,a), armR:hand(-1,a) });
  out('around-the-worlds', { camera:{az:20,el:35}, muscles:['chest','anterior-deltoid'], floats:true,
    props:[{type:'flat-bench'},{type:'dumbbell',kg:10,hand:'L'},{type:'dumbbell',kg:10,hand:'R'}],
    frames:{ start:fr(35), mid:fr(70), mid2:fr(110), end:fr(145) } });
}
// ---------- dumbbell pullovers: across the bench (bench along Z, figure yaw 90, head toward -X), one dumbbell in both hands
const pullover = (slug, bent) => {
  const p = -70, root = { pos:[0.374,0.43,0], yaw:90, pitch:p };
  const sx = root.pos[0] + 0.46*sd(p) + 0.053*cd(p), sy = root.pos[1] + 0.46*cd(p) - 0.053*sd(p);
  const r = bent ? 0.45 : 0.5, hz = 0.07, rp = Math.sqrt(r*r - (0.19-hz)**2);
  const fr = ph => { const d = [-sd(ph), cd(ph)];
    const arm = s => ({ pos: r3([sx + rp*d[0], sy + rp*d[1], -s*hz]), contact:true,
      fingers: norm([-1, -0.35, 0]), palm: norm([0, 1, s*0.55]), curl:0.6, pole: [0.2, -1, -s*0.4] });
    return { root, neck:{flex:-45}, legL:{pos:[0.8,0,-0.18],anchor:'sole',pole:[1,1,-0.1]}, legR:{pos:[0.8,0,0.18],anchor:'sole',pole:[1,1,0.1]},
      armL:arm(1), armR:arm(-1) }; };
  const A = bent ? [-12,2,16,30] : [0,20,38,50];
  out(slug, { camera:{az:0,el:12}, muscles:['chest','lats'], floats:true,
    props:[{type:'flat-bench'},{type:'dumbbell',kg:10,hold:'goblet',hands:true,dir:[0,1,0]}], frames:{ start:fr(A[0]), mid:fr(A[1]), mid2:fr(A[2]), end:fr(A[3]) } });
};
pullover('straight-arm-dumbbell-pullover', false);
pullover('bent-arm-dumbbell-pullover', true);
// ---------- barbell pullovers: arc in the sagittal plane about the shoulders
const barArc = (slug, o) => { const root = o.root, sh = shoulder(root);
  const rp = Math.sqrt(o.r*o.r - (o.x-0.19)**2);
  const hand = (s, t) => ({ pos: r3([s*o.x, sh[1] + rp*cd(t), sh[2] - rp*sd(t)]), contact:true, hand:'grip', grip:0.014,
    fingers: norm([0, cd(t), -sd(t)]), palm: norm([0, sd(t), cd(t)]), pole: norm([s*(o.px??0.7), o.py??-0.4, o.pz??0.3]), curl:0.82 });
  const fr = t => ({ root, neck:{flex:6}, spine:{flex:-4}, ...o.legs, armL:hand(1,t), armR:hand(-1,t) });
  const T = o.t, k = ['start','mid','mid2','mid3','end'];
  const frames = {}; T.forEach((t,i) => frames[k[i === T.length-1 ? 4 : i]] = fr(t));
  out(slug, { camera:o.camera ?? {az:75,el:10}, muscles:o.muscles, floats:true,
    props:[o.bench, {type:'barbell',hands:true,plates:[10]}], frames });
};
barArc('bent-arm-barbell-pullover', { root:flatRoot, legs:flatLegs, bench:{type:'flat-bench'}, x:0.28, r:0.48, t:[0,25,50,72,95], muscles:['lats','chest'], px:0.3, pz:0.2 });
barArc('front-raise-and-pullover', { root:flatRoot, legs:flatLegs, bench:{type:'flat-bench'}, x:0.19, r:0.60, t:[-80,-40,0,35,62], muscles:['chest','anterior-deltoid'], px:0.2, pz:0, py:-1 });
barArc('wide-grip-decline-barbell-pullover', { root:decRoot, legs:decLegs, bench:{type:'decline-bench',angle:20}, x:0.38, r:0.60, t:[-25,15,55,95,115], muscles:['chest','lats'], px:0.3, pz:0 });
