import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const cp = o => JSON.parse(JSON.stringify(o));
const arm = (flex, elbow=90, abd=26) => ({ fk:{flex,abd,elbow}, rel:'chest', curl:0.5 });
const leg = (side, x, y, z, o={}) => ({ pos:[x,y,z], anchor:'sole', pole:[side*0.1,0,1], ...o });
const L = (x,y,z,o) => leg(1,x,y,z,o), R = (x,y,z,o) => leg(-1,x,y,z,o);
const fr = (root, pitch, aL, aR, legL, legR, neck=-4) => ({ root:{pos:root,pitch}, neck:{flex:neck}, armL:arm(...aL), armR:arm(...aR), legL, legR });
// mirror about x = cx: swap sides
const mir = (f, cx=0) => {
  const m = cp(f); const flip = l => { const n = cp(l); if (n.pos) n.pos[0] = 2*cx - n.pos[0]; if (n.pole) n.pole[0] = -n.pole[0]; return n; };
  m.root.pos[0] = 2*cx - f.root.pos[0];
  m.legL = flip(f.legR); m.legR = flip(f.legL); m.armL = cp(f.armR); m.armR = cp(f.armL); return m;
};
const BH = 0.3;
// vertical take-off / pre-landing: planted feet rise straight up (no skating), root follows
const lift = (f, dy=0.1) => { const m = cp(f); m.root.pos[1] += dy; for (const k of ['legL','legR']) if (m[k].pos[1] <= BH+0.04) m[k].pos[1] += dy; return m; };
const box = (z, x=0) => ({ type:'plyo-box', height:BH, width:0.6, depth:0.5, pos:[x,0,z] });
const base = { floats:true, muscleSide:'L', muscles:['quadriceps','glutes','calves'] };

// ---- foot on box, forward (push-off, bench sprint)
const BZ = 0.45;
const pStart = fr([0,0.84,0.1], 14, [-25,90], [45,90], L(0.11,BH+0.035,0.36,{pitch:12}), R(-0.11,0,0.0));
const pAir = fr([0,1.17,0.22], 4, [45,90], [-25,90], L(0.11,0.34,0.4,{anchor:'ball',pitch:50}), { pos:[-0.11,0.74,0.6], anchor:'ankle', pole:[-0.1,0.2,1] });
const pEnd = fr([0,0.84,0.1], 14, [-25,90], [45,90], L(0.11,BH+0.035,0.36,{pitch:12}), R(-0.11,0,0.0));
const pLift = fr([0,0.98,0.1], 10, [10,90], [10,90], L(0.11,BH+0.135,0.36,{pitch:12}), { pos:[-0.11,0.5,0.1], anchor:'ankle', pitch:30, pole:[-0.1,0.2,1] });
W('single-leg-push-off', { ...base, camera:{az:90,el:6}, props:[box(BZ)], frames:{ start:pStart, mid:pLift, mid2:pAir, mid3:pLift, end:pEnd } });
W('bench-sprint', { ...base, muscleSide:undefined, muscles:['quadriceps','glutes'], camera:{az:90,el:6}, props:[box(BZ)], frames:{ start:pStart, mid:pLift, mid2:pAir, mid3:mir(pLift), end:mir(pEnd) } });

// ---- beside the box, sideways
const CX = 0.45;
const sStart = fr([0.12,0.84,0], 6, [-25,90], [45,90], L(0.3,BH+0.035,0.0,{pitch:16}), R(0.0,0,0.0));
const sAir = fr([0.45,1.17,0], 4, [40,90], [-20,90], { pos:[0.5,0.72,0.2], anchor:'ankle', pole:[0.1,0.2,1] }, { pos:[0.2,0.85,-0.05], anchor:'ankle', pitch:20, pole:[-0.1,0,1] });
W('side-to-side-box-shuffle', { ...base, muscleSide:undefined, muscles:['quadriceps','adductors','glutes'], camera:{az:18,el:6}, props:[box(0,CX)], frames:{ start:sStart, mid:lift(sStart), mid2:sAir, mid3:lift(mir(sStart,CX)), end:mir(sStart,CX) } });

// ---- stride jumps: inside foot on box, jump with arm swing and opposite knee drive
const jStart = fr([0.15,0.84,0], 6, [-25,90], [-25,90], L(0.3,BH+0.035,0.0,{pitch:16}), R(0.0,0,0.0));
const jAir = fr([0.22,1.16,0.05], 2, [170,10], [170,10], L(0.3,0.38,-0.02,{anchor:'ball',pitch:50}), { pos:[0.1,0.78,0.4], anchor:'ankle', pole:[-0.1,0.2,1] });
W('single-leg-stride-jump', { ...base, camera:{az:50,el:6}, props:[box(0,CX)], frames:{ start:jStart, mid:lift(jStart), mid2:jAir, mid3:lift(jStart), end:cp(jStart) } });
W('stride-jump-crossover', { ...base, muscleSide:undefined, muscles:['quadriceps','glutes','adductors'], camera:{az:25,el:6}, props:[box(0,CX)],
  frames:{ start:jStart, mid:lift(jStart), mid2:{ ...jAir, root:{pos:[0.45,1.24,0.05],pitch:2}, legL:{ pos:[0.55,0.84,0.0], anchor:'ankle', pitch:40, pole:[0.1,0.2,1] }, legR:{ pos:[0.4,0.8,0.42], anchor:'ankle', pole:[-0.1,0.2,1] } }, mid3:lift(mir(jStart,CX)), end:mir(jStart,CX) } });

// ---- single-leg hops (left leg working, right knee raised)
const hStart = fr([0,0.86,0], 6, [-25,90], [45,90], L(0.11,0,0.0), { pos:[-0.11,0.5,0.36], anchor:'ankle', pole:[-0.1,0,1] });
const hLand = (x,z) => fr([x,0.8,z], 12, [-20,90], [40,90], L(x+0.11,0,z), { pos:[x-0.11,0.5,z+0.3], anchor:'ankle', pole:[-0.1,0,1] });
const hLift = (x,z) => fr([x,0.97,z], 8, [30,90], [10,90], L(x+0.11,0.1,z), { pos:[x-0.11,0.6,z+0.3], anchor:'ankle', pole:[-0.1,0,1] });
W('single-leg-hop-progression', { ...base, camera:{az:90,el:6}, props:[{type:'cone',pos:[0,0,0.65]}],
  frames:{ start:hStart, mid:hLift(0,0), mid2:fr([0,1.1,0.65], 6, [50,90], [-20,90], L(0.11,0.34,0.55,{anchor:'ankle',pitch:40}), { pos:[-0.11,0.7,0.95], anchor:'ankle', pole:[-0.1,0,1] }), mid3:hLift(0,1.3), end:hLand(0,1.3) } });
W('single-leg-lateral-hop', { ...base, camera:{az:22,el:6}, props:[{type:'cone',pos:[0.4,0,0]}],
  frames:{ start:hStart, mid:hLift(0,0), mid2:fr([0.4,1.1,0], 4, [40,90], [40,90], L(0.45,0.34,-0.02,{anchor:'ankle',pitch:30}), { pos:[0.3,0.55,0.15], anchor:'ankle', pole:[-0.1,0,1] }), mid3:hLift(0.8,0), end:hLand(0.8,0) } });
W('single-leg-butt-kick', { ...base, muscles:['quadriceps','hamstrings','calves'], camera:{az:90,el:6},
  frames:{ start:hStart, mid:fr([0,1.12,0], 2, [50,90], [-25,90], L(0.11,0.32,-0.05,{anchor:'ankle',pitch:45}), { pos:[-0.11,1.0,-0.22], anchor:'ankle', pitch:95, pole:[-0.1,-0.2,1] }), end:hLand(0,0) } });
