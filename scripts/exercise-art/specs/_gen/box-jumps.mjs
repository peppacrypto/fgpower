import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const arms = (flex, elbow=16, abd=8) => ({ armL:{fk:{flex,abd,elbow},curl:0.5}, armR:{fk:{flex,abd,elbow},curl:0.5} });
const legs = (x, y, z, o={}) => ({ legL:{pos:[x,y,z],anchor:'sole',pole:[0.1,0,1],...o}, legR:{pos:[-x,y,z],anchor:'sole',pole:[-0.1,0,1],...o} });
// squat: feet at (y,z); hip height h above feet, hips back by b, torso lean pitch
const sq = (fy, fz, h, b, pitch, neck, flex, o={}) => ({ root:{pos:[0,fy+h,fz-b],pitch}, neck:{flex:neck}, ...arms(flex, o.el??16), ...legs(o.x??0.13, fy, fz, o.leg||{}) });
// flight: feet raised, tucked
const air = (fy, fz, h, pitch, flex, o={}) => ({ root:{pos:[0,fy+h,fz-(o.b??0.05)],pitch}, neck:{flex:o.neck??-6}, ...arms(flex, o.el??20, o.abd??6), ...legs(o.x??0.13, fy, fz, {pitch:o.fp??22}) });
const box = (h, z, x=0) => ({ type:'plyo-box', height:h, pos:[x,0,z] });
const BH = 0.5, BZ = 0.62;

// 1 front box jump
W('front-box-jump', { camera:{az:112,el:10}, muscles:['quadriceps','glutes','hamstrings'], floats:true, props:[box(BH,BZ)],
  frames:{ start:sq(0,-0.15,0.58,0.12,34,-24,-36),
           mid:air(BH+0.12,0.3,0.74,8,95),
           end:sq(BH,0.62,0.52,0.14,34,-20,62,{leg:{pitch:0}}) } });
// 3 multiple response: relaxed stance, arms down, legs slightly bent, jump and return
W('box-jump-multiple-response', { camera:{az:112,el:10}, muscles:['quadriceps','glutes','hamstrings'], floats:true, props:[box(0.4,0.55)],
  frames:{ start:sq(0,-0.1,0.8,0.05,16,-10,0,{el:8}),
           mid:air(0.4+0.12,0.2,0.74,8,70),
           end:sq(0.4,0.55,0.55,0.14,34,-20,50) } });
// 2 bench jump: over the bench and land on the far side
W('bench-jump', { camera:{az:112,el:10}, muscles:['quadriceps','glutes'], floats:true,
  props:[{type:'flat-bench', pos:[0,0,0.5], yaw:90, height:0.42}],
  frames:{ start:sq(0,-0.08,0.58,0.12,34,-24,-36),
           mid:air(0.42+0.12,0.5,0.74,8,95),
           end:sq(0,1.0,0.52,0.14,34,-20,62) } });
// 4 box skip: staggered start, drive off the rear leg, land on the box
const stag = (fy,fz,h,b,p,nk,fl,fo,ro) => ({ ...sq(fy,fz,h,b,p,nk,fl), legL:{pos:[0.12,fy,fz+0.28],anchor:'sole',pole:[0.1,0,1]}, legR:{pos:[-0.12,fy+(ro||0),fz-0.2],anchor:'sole',pitch:ro?0:25,pole:[-0.1,0,1]} });
W('box-skip', { camera:{az:112,el:10}, muscles:['quadriceps','glutes','hamstrings'], floats:true, props:[box(BH,0.95)],
  frames:{ start:{ ...sq(0,0,0.66,0.0,28,-14,-30), legL:{pos:[0.12,0,0.3],anchor:'sole',pole:[0.1,0,1]}, legR:{pos:[-0.12,0,-0.2],anchor:'ball',pitch:40,pole:[-0.1,0,1]},
                   armL:{fk:{flex:-30,abd:8,elbow:30},curl:0.5}, armR:{fk:{flex:30,abd:8,elbow:70},curl:0.5} },
           mid:{ root:{pos:[0,1.5,0.4],pitch:8}, neck:{flex:-6}, armL:{fk:{flex:70,abd:6,elbow:60},curl:0.5}, armR:{fk:{flex:-10,abd:6,elbow:60},curl:0.5},
                 legL:{pos:[0.12,0.74,0.6],anchor:'sole',pitch:15,pole:[0.1,0,1]}, legR:{pos:[-0.12,0.62,0.25],anchor:'sole',pitch:25,pole:[-0.1,0,1]} },
           end:sq(BH,0.95,0.52,0.14,34,-20,50) } });
// 5/6 depth jumps: drop off box A, land and rebound at once, land on box B
const depth = (slug, ah, bh, bz) => W(slug, { camera:{az:112,el:10}, muscles:['quadriceps','glutes','calves'], floats:true,
  props:[box(ah,-0.0), box(bh,bz)],
  frames:{ start:{ root:{pos:[0,ah+0.92,0]}, neck:{flex:0}, ...arms(0,8,8), ...legs(0.1,ah,0.18) },
           mid:air(0.14,0.5,0.8,12,10,{fp:10}),
           mid2:sq(0,0.55,0.5,0.14,36,-20,-30),
           mid3:air(bh+0.12,(0.55+bz)/2,0.74,8,95),
           end:sq(bh,bz,0.52,0.14,34,-20,62) } });
depth('depth-jump-leap', 0.35, 0.65, 1.35);
depth('linear-depth-jump', 0.45, 0.45, 1.3);
// 7 seated DB box jump: sit on bench, dumbbell at chest, jump up and forward onto box
const gob = { armL:{pos:[0.045,1.23,0.26],contact:true,fingers:[0,-0.5,1],palm:[-0.2,0.9,-0.3],curl:0.3,pole:[1.6,-1,0]},
              armR:{pos:[-0.045,1.23,0.26],contact:true,fingers:[0,-0.5,1],palm:[0.2,0.9,-0.3],curl:0.3,pole:[-1.6,-1,0]} };
const hold = f => { f.armL={...gob.armL,pos:[0.06,0.31,0.285],rel:'pelvis'}; f.armR={...gob.armR,pos:[-0.06,0.31,0.285],rel:'pelvis'}; return f; };
const noarm = f => { delete f.armL; delete f.armR; return f; };
W('dumbbell-seated-box-jump', { camera:{az:112,el:10}, muscles:['quadriceps','glutes'], floats:true,
  props:[{type:'flat-bench',pos:[0,0,-0.1],yaw:90,height:0.44}, box(BH,0.95), {type:'dumbbell',hands:true,hold:'goblet',kg:15}],
  frames:{ start:hold({ root:{pos:[0,0.54,-0.1],pitch:25}, neck:{flex:-10}, ...legs(0.14,0,0.25) }),
           mid:hold(noarm(air(BH+0.12,0.7,0.74,15,0))),
           end:hold(noarm(sq(BH,0.95,0.52,0.14,34,-20,0))) } });
// 8 lateral box jump: box beside, up and sideways onto it
W('lateral-box-jump', { camera:{az:15,el:8}, muscles:['adductors','glutes','quadriceps'], floats:true, props:[box(0.4,0,0.55)],
  frames:{ start:{...sq(0,0,0.68,0.1,26,-14,-30,{x:0.13}), root:{pos:[-0.05,0.68,-0.1],pitch:26}, legL:{pos:[0.08,0,0],anchor:'sole',pole:[0.1,0,1]}, legR:{pos:[-0.18,0,0],anchor:'sole',pole:[-0.1,0,1]}},
           mid:{ ...air(0.4+0.12,0,0.74,8,60,{x:0.13}), root:{pos:[0.3,1.4,0],pitch:8}, ...legs(0.13,0.75,0,{pitch:20}), legL:{pos:[0.43,0.88,0],anchor:'sole',pitch:20,pole:[0.1,0,1]}, legR:{pos:[0.17,0.88,0],anchor:'sole',pitch:20,pole:[-0.1,0,1]} },
           end:{ ...sq(0.4,0,0.52,0.12,34,-20,50), root:{pos:[0.55,0.4+0.52,-0.12],pitch:34}, legL:{pos:[0.68,0.4,0],anchor:'sole',pole:[0.1,0,1]}, legR:{pos:[0.42,0.4,0],anchor:'sole',pole:[-0.1,0,1]} } } });
// 9 quick leap: hop on, land squat, explode up with arms overhead
W('quick-leap', { camera:{az:112,el:10}, muscles:['quadriceps','glutes','calves'], floats:true, props:[box(BH,BZ)],
  frames:{ start:sq(0,-0.15,0.62,0.1,30,-20,-36),
           mid:air(BH+0.12,0.3,0.74,8,95),
           mid2:sq(BH,0.62,0.52,0.14,34,-20,40),
           end:{ root:{pos:[0,BH+0.98,0.6],pitch:0}, neck:{flex:-8}, ...arms(172,6,4), ...legs(0.1,BH+0.06,0.6,{pitch:30}) } } });
