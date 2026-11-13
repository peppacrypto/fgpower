import fs from 'fs';
import * as THREE from '../../vendor/three.module.js';
import { Body } from '../../rig.js';
import { createChecker } from '../../qa-lib.mjs';
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

// ===== Windmill family, solved on the rig (2026-11-13 fix2). Bell in the LEFT hand, locked straight overhead in every frame.
// Feet turned 45 deg away from the bell (toes to the figure's right). The hips push back and out over the left foot, the
// trunk hinges toward the right foot with a long spine and turns open (twist +, toward the bell), so the bell arm stays
// vertical over its shoulder; the head turns to look at the bell. The bell sits 0.625 straight above the shoulder joint.
const BODY = new Body(JSON.parse(fs.readFileSync(new URL('../../build/body-real.json', import.meta.url), 'utf8')));
const DG = Math.PI / 180, V = (a) => new THREE.Vector3(...a), AX = V([1,0,0]), AY = V([0,1,0]), AZ = V([0,0,1]);
const rq = (ax, d) => new THREE.Quaternion().setFromAxisAngle(ax, d * DG);
const segs = (n, f, s, t) => { const q = new THREE.Quaternion(); for (let i = 0; i < n; i++) q.multiply(rq(AX, f / n).multiply(rq(AZ, -s / n)).multiply(rq(AY, t / n))); return q; };
const n1 = (x) => Math.round(x * 10) / 10, n3 = (a) => a.map((x) => Math.round(x * 1000) / 1000);
const chestQ = (u, n) => { const Y = V(u).normalize(), X = new THREE.Vector3().crossVectors(Y, V(n)).normalize(), Z = new THREE.Vector3().crossVectors(X, Y); return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z)); };
const rootFor = (qc, sp) => { const e = new THREE.Euler().setFromQuaternion(qc.clone().multiply(segs(5, sp.flex, sp.side, sp.twist).invert()), 'YXZ'); return { yaw: n1(e.y / DG), pitch: n1(e.x / DG), roll: n1(e.z / DG) }; };
// The neck that turns the face to a point with the least effort; the eyes take the last 15 degrees. The head tips a little
// away from the bell and lifts the chin a little, so the chin never sinks onto the chest or the raised shoulder.
const gaze = (qc, eye, target) => {
  const want = V(target).sub(V(eye)).normalize(); let best = null;
  for (let f = -9; f <= -3; f += 3) for (let s = -12; s <= -6; s += 3) for (let t = -30; t <= 27; t += 3) {
    const face = AZ.clone().applyQuaternion(qc.clone().multiply(segs(4, f, s, t)));
    const c = Math.max(0, Math.acos(Math.min(1, face.dot(want))) / DG - 15) ** 2 + 0.01 * (f * f + 2 * s * s + t * t);
    if (!best || c < best.c) best = { c, flex: f, side: s, twist: t };
  }
  return { flex: best.flex, side: best.side, twist: best.twist };
};
const T45 = (w = 0.23) => ({ legL:{pos:[w,0,0.03],anchor:'sole',yaw:-45,pitch:0,pole:[-0.71,0,0.71]}, legR:{pos:[-w,0,0.03],anchor:'sole',yaw:-45,pitch:0,pole:[-0.71,0,0.71]} });
const flat = (v) => V([v[0], 0, v[2]]).normalize();
// locked-out bell arm: palm forward and a little in, the elbow pit forward
// tilt: the arm a few degrees out to the side of the chest standing tall (a straight up arm over a trunk that starts to hinge
// would point back past the shoulder's range), vertical at the bottom
const lockout = (S, n, lift = 0.625, tilt = 0) => { const nh = flat(n); const out = nh.clone().applyAxisAngle(AY, 90 * DG);
  const d = AY.clone().addScaledVector(out, tilt).normalize();
  return { pos: n3(V(S).addScaledVector(d, lift).toArray()), contact: true, fingers: [0, 1, 0], palm: n3(nh.clone().applyAxisAngle(AY, -30 * DG).toArray()), curl: 0.85,
    pole: n3(out.multiplyScalar(0.8).addScaledVector(nh, -0.3).add(V([0, -0.1, 0])).toArray()), scap: { elev: -0.5 } }; };
// A windmill moment s (0 standing tall .. 1 the deepest): the pelvis turns toward the feet, hinges and tips toward the right foot
// while it travels back and out over the left foot; the chest turns open toward the bell. B: the deepest moment (yaw, pitch,
// roll of the pelvis, its x/z travel, the spine's twist), found by a search over the rig's hip and knee ranges (2026-11-13).
const pose = (s, B) => { const e = 1 - (1 - s) ** 2;
  return { s, yaw: -15 + (B.yaw + 15) * s, pitch: B.pitch * s ** 1.25, roll: B.roll * s, twist: 15 + (B.twist - 15) * e, P: [B.px * e, 0.92, B.pz * e], knee: B.knee, w: B.w }; };
const solveWM = (st, armR, armL = null) => {
  const sp = { flex: 0, side: 0, twist: n1(st.twist) };
  const f = { root: { pos: n3(st.P), yaw: n1(st.yaw), pitch: n1(st.pitch), roll: n1(st.roll) }, spine: sp, neck: { flex: 0, side: 0, twist: 0 },
    armL: { fk: { flex: 170, abd: 20, elbow: 5 } }, armR: { fk: { flex: 0, abd: 10, elbow: 10 } }, ...T45(st.w) };
  // the pelvis height: the left (bell-side) leg long, or the right knee bent as asked (bent press)
  // both legs must reach: the lower of the two heights (left knee 6, right knee 3 or as asked)
  const height = (side, want) => { let lo = 0.6, hi = 0.95;
    for (let i = 0; i < 9; i++) { const m = (lo + hi) / 2; f.root.pos[1] = m; const { report: r } = BODY.solve(f); if ((r.angles['knee' + side] ?? 0) > want) lo = m; else hi = m; }
    return lo; };
  f.root.pos[1] = n3([Math.min(height('L', 6), height('R', st.knee && st.s > 0 ? st.knee * st.s * st.s : 8))])[0];
  for (let k = 0; k < 3; k++) {
    const { report: r } = BODY.solve(f);
    f.armL = armL ? armL(r, st) : lockout(r.joints['upperarm01.L'], AZ.clone().applyQuaternion(new THREE.Quaternion(...r.frames.chest.quat)).toArray(), 0.618, 0.18 * (1 - st.s));
    f.armR = typeof armR === 'function' ? armR(r, st) : armR;
    const qh = new THREE.Quaternion(...r.frames.head.quat);
    f.neck = gaze(new THREE.Quaternion(...r.frames.chest.quat), V(r.frames.head.pos).add(V([0, 0.07, 0.09]).applyQuaternion(qh)).toArray(), f.armL.pos);
  }
  return f;
};
const chestN = (r) => AZ.clone().applyQuaternion(new THREE.Quaternion(...r.frames.chest.quat));
const rightOf = (r) => AX.clone().applyQuaternion(new THREE.Quaternion(...r.frames.chest.quat)).negate().setY(0).normalize();
const shR = (r) => r.joints['upperarm01.R'];
// free hand: hangs long at the side, then straight down toward the front foot
const hangFree = (r, st) => { const S = V(shR(r)).addScaledVector(rightOf(r), 0.1 * (1 - st.s)); S.y -= 0.49;
  return { pos: n3(S.toArray()), hand: 'relaxed', fingers: [0, -1, 0], palm: n3(flat(chestN(r).toArray()).negate().toArray()), pole: n3(chestN(r).negate().toArray()) }; };
const reachFree = (r, st) => { const S = V(shR(r)); S.y -= 0.505;
  return { pos: n3(S.toArray()), hand: 'open', fingers: [0, -1, 0], palm: n3(flat(chestN(r).toArray()).negate().toArray()), pole: n3(chestN(r).negate().toArray()) }; };
const wmFrames = (B, free) => Object.fromEntries([['start', 0], ['mid', 1 / 3], ['mid2', 2 / 3], ['end', 1]].map(([k, s]) => [k, solveWM(pose(s, B), free(s))]));
const WM = { yaw: -15, pitch: 84, roll: 30, px: 0.08, pz: -0.03, twist: 50 };
W('kettlebell-windmill', { camera:{az:25,el:6}, muscles:['abdominals','obliques'], muscleSide:'L', props:[KB],
  frames: wmFrames(WM, (s) => (s < 1 ? hangFree : reachFree)) });

// ---- advanced: the free hand behind the lower back (back of the hand to it), no floor touch; as low as the hips allow
const behindBack = { pos: [-0.1, 0.12, -0.17], rel: 'pelvis', hand: 'relaxed', fingers: [0.86, -0.5, 0], palm: [0, 0, -1], pole: [-1, 0, -0.5] };
W('advanced-kettlebell-windmill', { camera:{az:25,el:6}, muscles:['abdominals','obliques'], muscleSide:'L', props:[KB],
  frames: wmFrames({ ...WM, pitch: 80, pz: -0.05 }, () => behindBack) });

// ---- double: the second bell hangs in the free hand outside the leg and is set down in front of the front foot
const bellFree = (r, st) => { const S = V(shR(r)).addScaledVector(rightOf(r), 0.15 * (1 - st.s)); S.y = Math.max(S.y - 0.6, 0.245);
  return { pos: n3(S.toArray()), contact: true, hand: 'grip', grip: 0.0165, fingers: [0, -1, 0], palm: n3(rightOf(r).applyAxisAngle(AY, -90 * DG).toArray()), curl: 0.85, pole: n3(chestN(r).negate().toArray()) }; };
W('double-kettlebell-windmill', { camera:{az:25,el:6}, muscles:['abdominals','obliques'], muscleSide:'L', props:[KB, {type:'kettlebell', hand:'R', kg:16, mode:'hang'}],
  frames: wmFrames({ ...WM, pitch: 80, pz: -0.05 }, () => bellFree) });

// ---- bent press: from the rack the trunk leans away and turns under the bell, the forearm vertical, the elbow opening until
// the arm is locked over the shoulder; the right knee bends and the free hand's fingers reach the floor. The bell rises little.
const pressArm = (phi, ang) => (r) => {
  const S = V(r.joints['upperarm01.L']), qc = new THREE.Quaternion(...r.frames.chest.quat);
  const left = AX.clone().applyQuaternion(qc).setY(0).normalize(), d0 = V([0.1, -0.95, 0.3]).normalize();
  const d = d0.multiplyScalar(Math.cos(phi * DG)).addScaledVector(left, Math.sin(phi * DG)).normalize();
  const E = S.clone().addScaledVector(d, 0.279), palm = V([Math.sin(ang * DG), 0, Math.cos(ang * DG)]);
  const T = E.clone().add(V([0, 0.341, 0])).addScaledVector(palm, 0.036);
  return { pos: n3(T.toArray()), contact: true, fingers: [0, 1, 0], palm: n3(palm.toArray()), curl: 0.85, pole: n3(E.clone().sub(S.clone().add(T).multiplyScalar(0.5)).normalize().toArray()), scap: { elev: -0.5 } };
};
{ const BP = WM;   // the windmill's path (a deeper, knee-bent bottom put the head into the chest on this rig)
  const st = [0, 1 / 3, 2 / 3, 1].map((s) => pose(s, BP));
  W('bent-press', { camera:{az:25,el:6}, muscles:['abdominals','obliques','shoulders'], muscleSide:'L', props:[KB],
    frames: { start: solveWM(st[0], hangFree, () => rackArm), mid: solveWM(st[1], hangFree, pressArm(70, -70)),
      mid2: solveWM(st[2], hangFree, pressArm(130, -25)), end: solveWM(st[3], reachFree) } }); }

// Eyes on the bell: per key frame, the neck turns (and lifts) the face toward the bell, the eyes taking the last 20 degrees;
// of the candidates, ordered by how well they look and how little the neck works, the first that keeps the whole loop clean
// in check.mjs wins (a chin or the back of the head that sinks into the chest or a shoulder is refused), else the safe one.
const CHK = await createChecker();
const lookAtBell = (slug) => {
  const url = new URL(`../${slug}.json`, import.meta.url), spec = JSON.parse(fs.readFileSync(url, 'utf8'));
  const log = [];
  // the hardest moment first (mid2: the trunk half down), then its neighbours close to it, so the head moves smoothly
  const near = { mid2: null, mid: 'mid2', end: 'mid2', start: 'mid' };
  for (const k of ['mid2', 'mid', 'end', 'start'].filter((q) => spec.frames[q])) {
    const f = spec.frames[k], { report: r } = BODY.solve(f), prev = near[k] && spec.frames[near[k]].neck;
    const qc = new THREE.Quaternion(...r.frames.chest.quat), qh = new THREE.Quaternion(...r.frames.head.quat);
    const eye = V(r.frames.head.pos).add(V([0, 0.07, 0.09]).applyQuaternion(qh)), want = V(r.hands.L.centre).sub(eye).normalize();
    const errOf = (n) => Math.acos(Math.min(1, AZ.clone().applyQuaternion(qc.clone().multiply(segs(4, n.flex, n.side, n.twist))).dot(want))) / DG;
    const cands = [];
    for (let fl = -45; fl <= 6; fl += 3) for (let sd = -15; sd <= 12; sd += 3) for (let tw = 0; tw <= 84; tw += 3) {
      if (prev && (k === 'end' ? tw < prev.twist : tw > prev.twist)) continue;   // the head only ever turns further toward the bell on the way down
      const n = { flex: fl, side: sd, twist: tw };
      cands.push({ c: Math.max(0, errOf(n) - 20) ** 2 + 0.004 * (fl * fl + sd * sd + tw * tw) + (prev ? 0.1 * ((fl - prev.flex) ** 2 + (sd - prev.side) ** 2 + (tw - prev.twist) ** 2) : 0), n });
    }
    cands.sort((a, b) => a.c - b.c);
    const keep = f.neck; let ok = false;
    for (const cd of cands.slice(0, 220)) { f.neck = cd.n; const res = CHK.check(spec); if (!res.errors && !res.warnings) { ok = true; break; } }
    // none clean: go from the safe neck toward the best look as far as the loop stays clean
    if (!ok) { const best = cands[0].n; f.neck = keep;
      if (prev && (k === 'end' ? keep.twist < prev.twist : keep.twist > prev.twist)) keep.twist = prev.twist;
      for (let lam = 0.9; lam > 0.05; lam -= 0.1) { const n = Object.fromEntries(['flex', 'side', 'twist'].map((q) => [q, Math.round(keep[q] + (best[q] - keep[q]) * lam)]));
        f.neck = n; const res = CHK.check(spec); if (!res.errors && !res.warnings) { ok = true; break; } f.neck = keep; } }
    log.push(`${k} ${Math.round(errOf(f.neck))}deg${ok ? '' : ' (kept)'} ${JSON.stringify(f.neck)}`);
  }
  fs.writeFileSync(url, JSON.stringify(spec, null, 1));
  console.log(`${slug}: face to bell ${log.join(', ')}`);
};
for (const slug of ['kettlebell-windmill', 'advanced-kettlebell-windmill', 'double-kettlebell-windmill', 'bent-press']) lookAtBell(slug);

const sq = (y,z,pitch,bell,fx) => ({ root:{pos:[0,y,z],pitch}, spine:{flex:0}, neck:{flex:-pitch*0.4},
  armL:up(bell), armR:{fk:{flex:10,abd:fx,elbow:15},curl:0.3}, ...feet(0.2,22) });
W('one-arm-overhead-kettlebell-squats', { camera:{az:50,el:6}, muscles:['quadriceps','glutes'], muscleSide:'L', props:[KB],
  frames:{ start:sq(0.925,0,0,[0.2,1.96,0.05],15), end:sq(0.42,-0.28,25,[0.2,1.38,0.05],40) } });

const X=0.11;
const horns = (y,z,pl) => ({ armL:{pos:[X+0.095,y,z],contact:true,fingers:[0,0,1],palm:[-1,0,0],curl:0.85,pole:[0.4+pl,-1,-0.5+pl*-0.2]},
                          armR:{pos:[X-0.095,y,z],contact:true,fingers:[0,0,1],palm:[1,0,0],curl:0.85,pole:[-0.4-pl,-1,-0.5+pl*-0.2]} });
const stand = {pos:[X,0,0.03],anchor:'sole',yaw:0,pitch:0,pole:[0.1,0,1]};
const free = (y,z) => ({pos:[-0.11,y,z],anchor:'heel',yaw:0,pitch:20,pole:[-0.1,1,0]});
W('kettlebell-pistol-squat', { camera:{az:60,el:6}, muscles:['quadriceps','glutes'], props:[{type:'kettlebell',hands:true,kg:16,mode:'horns'}],
  frames:{ start:{ root:{pos:[X,0.925,0]}, ...horns(1.2,0.2,0), legL:stand, legR:free(0.3,0.5) },
    end:{ root:{pos:[X,0.42,-0.16],pitch:18}, spine:{flex:4}, neck:{flex:-14}, ...horns(0.77,0.24,0.1), legL:stand, legR:free(0.2,0.55) } } });

// ---- lunge pass-through (2026-11-13 fix2): the left foot steps forward into a lunge (a lift-off and a landing frame keep the
// foot from skating), the weight stays over the right foot while the left is in the air, the back heel rises over its ball.
// At the bottom the right hand brings the bell under the front (left) thigh from the inside, the left hand comes from the
// outside and takes it (both hands on the handle at the hand-over): the bell's handle runs along the thigh, the right hand behind, the left in front (both thumbs forward:
// the left's handle frame flipped, so one shift serves both and the hand-over does not jump; the ball hangs plumb, `up`).
const kbR = { type:'kettlebell', kg:16, mode:'hang', hand:'R', shift:0.046, up:[0, 1, 0] }, kbL = { ...kbR, hand:'L', flip:true };
const rleg = (pitch) => ({ pos:[-0.12, 0, 0.13], anchor:'ball', pitch, toes:0, pole:[-0.1, -0.2, 1] });
const sideR = (p, f = [0, -1, 0], n = [1, 0, 0]) => ({ pos:p, contact:true, hand:'grip', grip:0.0165, fingers:f, palm:n, curl:0.85, pole:[-0.4, 0, -1] });
const relL = (p, f = [0, -1, 0], n = [-1, 0, 0]) => ({ pos:p, hand:'relaxed', fingers:f, palm:n, pole:[1, 0, -0.2] });
const HY = 0.335, HZ = 0.595;   // the handle's middle under the front thigh
const underR = { pos:[0.12, HY, HZ - 0.046], contact:true, hand:'grip', grip:0.0165, fingers:[0.6, -0.8, 0], palm:[0.8, 0.6, 0], curl:0.85, pole:[-0.8, 0, 0.6] };
const underL = { pos:[0.12, HY, HZ + 0.046], contact:true, hand:'grip', grip:0.0165, fingers:[-0.6, -0.8, 0], palm:[-0.8, 0.6, 0], curl:0.85, pole:[1, 0, 0.2] };
const bottomL = { root:{pos:[-0.015, 0.49, 0.39], pitch:28}, spine:{flex:6, twist:20}, neck:{flex:10, twist:-6} };
const landed = { pos:[0.12, 0, 0.66], anchor:'heel', pitch:0, yaw:2, pole:[0.1, 0.5, 1] };
W('lunge-pass-through', { camera:{az:50,el:6}, muscles:['quadriceps','glutes','hamstrings'],
  frames:{ start:{ root:{pos:[-0.03, 0.925, 0.03]}, armR:sideR([-0.36, 0.8, 0.04]), armL:relL([0.27, 0.9, 0.03]), legL:{ pos:[0.12, 0, 0.04], anchor:'sole', pole:[0.1, 0.5, 1] }, legR:rleg(0), props:[kbR] },
    mid:{ root:{pos:[-0.09, 0.9, 0.05]}, armR:sideR([-0.37, 0.78, 0.07]), armL:relL([0.25, 0.88, 0.06]), legL:{ pos:[0.12, 0.16, 0.07], anchor:'ankle', pitch:0, pole:[0.1, 0.5, 1] }, legR:rleg(0), props:[kbR] },
    mid2:{ root:{pos:[-0.1, 0.6, 0.03], pitch:8}, armR:{ ...sideR([-0.3, 0.68, 0.45], [0.45, -0.89, 0], [0.89, 0.45, 0]), pole:[-1, 0, 0] }, armL:relL([0.3, 0.7, 0.3], [-0.3, -0.95, 0], [-0.95, 0.3, 0]), legL:{ pos:[0.12, 0.03, 0.66], anchor:'heel', pitch:-12, yaw:2, pole:[0.1, 0.5, 1] }, legR:rleg(12), props:[kbR] },
    mid3:{ ...bottomL, armR:underR, armL:underL, legL:landed, legR:rleg(50), props:[kbR] },
    end:{ ...bottomL, armR:underR, armL:{ ...underL, pos:[0.14, HY, HZ + 0.046] }, legL:landed, legR:rleg(50), props:[kbL] } } });
