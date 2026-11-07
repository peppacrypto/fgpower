import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const R = v => +v.toFixed(3);
// ---- Nordic family: kneeling, ankles under a foot-anchor behind, body straight from knee to head
const KY = 0.075, L = 0.432;
const nrow = (p, o = {}) => {
  const r = p * Math.PI / 180;
  return { root:{pos:[0, R(KY + L*Math.cos(r)), R(L*Math.sin(r))], pitch:p}, neck:{flex:-p*0.3}, ...o,
    legL:{pos:[0.11,0.1,-0.44],anchor:'ankle',pitch:160,pole:[0,-1,0.05]},
    legR:{pos:[-0.11,0.1,-0.44],anchor:'ankle',pitch:160,pole:[0,-1,0.05]} };
};
const CZ = +(process.env.CZ||0.22), CY = +(process.env.CY||0.1);
const cross = { armL:{pos:[0.13,CY,CZ],rel:"chest",fingers:[-0.5,0.8,0],palm:[0,-0.1,-1],pole:[1,-0.5,-0.3],curl:0.3},
                armR:{pos:[-0.13,CY,CZ],rel:"chest",fingers:[0.5,0.8,0],palm:[0,-0.1,-1],pole:[-1,-0.5,-0.3],curl:0.3} };
const front = (z, y=0.9) => ({
  armL:{pos:[0.23,y,z],fingers:[0,0.6,0.8],palm:[0,-0.8,0.6],pole:[0.2,-1,-0.35],curl:0.12},
  armR:{pos:[-0.23,y,z],fingers:[0,0.6,0.8],palm:[0,-0.8,0.6],pole:[-0.2,-1,-0.35],curl:0.12} });
const floorH = z => ({
  armL:{pos:[0.26,0,z],contact:true,hand:'flat',fingers:[0,0,1],palm:[0,-1,0],pole:[0.2,-1,-0.35]},
  armR:{pos:[-0.26,0,z],contact:true,hand:'flat',fingers:[0,0,1],palm:[0,-1,0],pole:[-0.2,-1,-0.35]} });
const nprops = [{type:'floor-mat'},{type:'foot-anchor',pos:[0,0,-0.52],yaw:180}];
const nord = (slug, camera, endP, midArms, endArms, startArms) => W(slug, { camera, muscles:['hamstrings'], props:nprops,
  frames:{ start:nrow(0,startArms), mid:nrow(endP*0.55,midArms), end:nrow(endP,endArms) } });
nord('assisted-nordic-curl', {az:78,el:12}, 65, front(0.7,0.55), floorH(0.98), front(0.3));
nord('floor-glute-ham-raise', {az:78,el:12}, 65, front(0.7,0.55), floorH(0.98), front(0.3));
nord('natural-glute-ham-raise', {az:78,el:12}, 72, cross, cross, cross);

// ---- GHD machine (gallery numbers)
{ const g = JSON.parse(fs.readFileSync(new URL('../_gallery/ghd.json', import.meta.url))); delete g.slug;
  for (const f of Object.values(g.frames)) { f.armL = cross.armL; f.armR = cross.armR;
    for (const l of ['legL','legR']) { f[l].pos[1] += +(process.env.GY||0); f[l].pos[2] += +(process.env.GZ||0); f[l].pitch = +(process.env.GP||102); f[l].toes = +(process.env.GT||90); } }
  g.frames.start.root.pos[1] += 0.02;
  W('glute-ham-raise', g); }
// ---- reverse hyper machine (gallery numbers)
{ const g = JSON.parse(fs.readFileSync(new URL('../_gallery/reverse-hyper.json', import.meta.url))); delete g.slug;
  for (const f of Object.values(g.frames)) { f.root.pos[1] += +(process.env.PY||0.03); f.root.pos[2] += +(process.env.PZ||-0.03); }
  g.frames.start.legL.fk.flex = g.frames.start.legR.fk.flex = +(process.env.PF||14); for (const f of [g.frames.end]) { f.legL.fk.flex = f.legR.fk.flex = -22; }
  for (const f of Object.values(g.frames)) { f.armL.pos[0] = 0.27; f.armR.pos[0] = -0.27; f.armL.pole = [1,0.1,0]; f.armR.pole = [-1,0.1,0]; }
  W('reverse-hyperextension', g); }

// ---- hyperextension bench 45 deg: hips on pad, ankles under rollers
{ const fr = (pitch, flex) => ({ root:{pos:[0,+(process.env.RY||0.97),+(process.env.RZ||-0.045)],pitch}, neck:{flex:flex>0?-10:0}, spine:{flex, weights:[0,0.1,0.25,0.3,0.35]}, ...cross,
    legL:{pos:[+(process.env.HX||0.1),+(process.env.HY||0.2),+(process.env.HZ||-0.6)],anchor:"sole",pitch:+(process.env.HP||70),pole:[0.05,-0.7,0.7]}, legR:{pos:[-(process.env.HX||0.1),+(process.env.HY||0.2),+(process.env.HZ||-0.6)],anchor:"sole",pitch:+(process.env.HP||70),pole:[-0.05,-0.7,0.7]} });
  W('hyperextensions-back-extensions', { camera:{az:90,el:8}, muscles:['spinal-erectors','glutes'], floats:true,
    props:[{type:'hyperextension-bench'}], frames:{ start:fr(45,0), mid:fr(64,16), end:fr(82,34) } }); }

// ---- flat bench, hips on the edge, legs held on the bench (the holder is not drawn)
{ const H = 0.7;
  const fr = flex => ({ root:{pos:[0,H+0.12,0.55],pitch:90}, neck:{flex:flex>0?-15:0}, spine:{flex, weights:[0,0.1,0.25,0.3,0.35]}, ...cross,
    legL:{fk:{flex:0,abd:1,knee:0},rel:'pelvis',foot:{pitch:30}}, legR:{fk:{flex:0,abd:1,knee:0},rel:'pelvis',foot:{pitch:30}} });
  W('hyperextensions-with-no-hyperextension-bench', { camera:{az:90,el:8}, muscles:['spinal-erectors'], floats:true,
    props:[{type:'flat-bench',height:H,pos:[0,0,0]}], frames:{ start:fr(0), mid:fr(35), end:fr(70) } }); }

// ---- sofa reverse hyperextension: prone on the seat, diagonal, hips at the front edge, legs swing up
{ const PSI = +(process.env.PSI||252), psi = PSI*Math.PI/180, f = [Math.sin(psi), Math.cos(psi)], lf = [Math.cos(psi), -Math.sin(psi)];
  const hip = [0, 0.48], hy = 0.6;
  const hand = side => [R(hip[0] + f[0]*0.4 + side*0.27*lf[0]), 0.43, R(hip[1] + f[1]*0.4 + side*0.27*lf[1])];
  const fr = fl => ({ root:{pos:[hip[0],hy,hip[1]],yaw:PSI,pitch:90}, neck:{flex:-15},
    armL:{pos:hand(1),contact:true,hand:'flat',fingers:[f[0]+(process.env.FW||0.2)*lf[0],0,f[1]+(process.env.FW||0.2)*lf[1]],palm:[0,-1,0],pole:[lf[0],0.4,lf[1]-0.3*f[1]]},
    armR:{pos:hand(-1),contact:true,hand:'flat',fingers:[f[0]-(process.env.FW||0.2)*lf[0],0,f[1]-(process.env.FW||0.2)*lf[1]],palm:[0,-1,0],pole:[-lf[0],0.4,-lf[1]-0.3*f[1]]},
    legL:{fk:{flex:fl,abd:1,knee:3},rel:'pelvis',foot:{pitch:30}}, legR:{fk:{flex:fl,abd:1,knee:3},rel:'pelvis',foot:{pitch:30}} });
  W('sofa-reverse-hyperextension', { camera:{az:60,el:14}, muscles:['glutes'], floats:true,
    props:[{type:'sofa',pos:[0,0,0],width:2.6}], frames:{ start:fr(28), end:fr(-5) } }); }
