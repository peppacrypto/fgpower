import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const A = (fl, el=16, abd=8) => ({ fk:{flex:fl,abd,elbow:el}, curl:0.5 });
const arms = (fl, el=16, abd=8) => ({ armL:A(fl,el,abd), armR:A(fl,el,abd) });
const leg = (x,y,z,o={}) => ({ pos:[x,y,z], anchor:'sole', pole:[Math.sign(x)*0.1,0,1], ...o });
const legs = (x,y,z,o={}) => ({ legL:leg(x,y,z,o), legR:leg(-x,y,z,o) });
const sq = (fy,fz,h,b,pitch,neck,fl,o={}) => ({ root:{pos:[o.rx??0,fy+h,fz-b],pitch}, neck:{flex:neck}, ...arms(fl,o.el??16), ...legs(o.x??0.13,fy,fz,o.leg||{}) });

// 1 standing long jump: countermovement with arms back, take-off at ~45 deg with forward lean, 1.9 m of travel, quick landing catch
W('standing-long-jump', { camera:{az:112,el:8}, muscles:['quadriceps','glutes','calves'], floats:true,
  tempo:{ up:1.0, down:0.25, squeeze:0.1, stretch:0.1 },
  frames:{ start:sq(0,-0.5,0.66,0.14,32,-18,-45,{leg:{anchor:'ball'}}),
           mid:{ root:{pos:[0,0.91,-0.4],pitch:32}, neck:{flex:-10}, ...arms(105,10,6), legL:leg(0.13,0.0,-0.5,{anchor:'ball',pitch:30}), legR:leg(-0.13,0.0,-0.5,{anchor:'ball',pitch:30}) },
           mid2:{ root:{pos:[0,1.15,0.6],pitch:26}, neck:{flex:-8}, ...arms(80,25,6), ...legs(0.13,0.5,0.9,{pitch:10}) },
           end:{ ...sq(0,1.45,0.62,0.2,28,-14,60), ...legs(0.13,0,1.45,{pitch:-8}) } } });

// 2 side standing long jump: travel to the figure's right (-x), facing +Z, camera in front
const P = (x)=>[Math.sign(x||1)*0.1,0,1];
const sd = (rx,fy,legx,h,pitch,fl,o={}) => ({ root:{pos:[rx,fy+h,o.rz??-0.1],pitch}, neck:{flex:-8}, ...arms(fl,o.el??25,o.abd??10),
  legL:leg(rx+legx,fy,0,{pole:[0.25,0,1],...(o.l||{})}), legR:leg(rx-legx,fy,0,{pole:[-0.25,0,1],...(o.r||{})}) });
W('side-standing-long-jump', { camera:{az:15,el:8}, muscles:['quadriceps','glutes','abductors'], floats:true,
  tempo:{ up:0.5, down:0.3, squeeze:0.1, stretch:0.1 },
  frames:{ start:sd(0.3,0,0.2,0.66,30,-30,{el:30,abd:10,l:{anchor:'ball'},r:{anchor:'ball'}}),
           mid:sd(0.3,0,0.2,0.6,34,-55,{rz:-0.2,el:30,abd:12,l:{anchor:'ball'},r:{anchor:'ball'}}),
           mid2:{ root:{pos:[0.3,0.95,-0.05],pitch:14,roll:-4}, neck:{flex:-6}, ...arms(120,20,40), legL:leg(0.5,0.0,0,{anchor:'ball',pitch:40,pole:[0.1,0,1]}), legR:leg(0.1,0.0,0,{anchor:'ball',pitch:40,pole:[-0.1,0,1]}) },
           mid3:{ root:{pos:[-0.55,1.22,-0.02],pitch:12,roll:-6}, neck:{flex:-6}, ...arms(90,30,50), legL:leg(-0.4,0.3,0,{pitch:5,pole:[0.15,0,1]}), legR:leg(-0.7,0.3,0,{pitch:5,pole:[-0.15,0,1]}) },
           end:sd(-0.9,0,0.2,0.6,30,50,{el:35,abd:25}) } });

// 3 lateral bound: load deep on the left leg, push to the right, land on the right leg only
W('lateral-bound', { camera:{az:15,el:8}, muscles:['adductors','glutes','quadriceps'], floats:true,
  tempo:{ up:0.45, down:0.35, squeeze:0.35, stretch:0.1 },
  frames:{ start:{ root:{pos:[0.3,0.68,0],pitch:20,roll:-6}, neck:{flex:-8}, armL:A(-25,50,25), armR:A(45,60,25),
                   legL:leg(0.3,0,0,{pitch:0,pole:[0.2,0,1]}), legR:leg(0.0,0.15,0.05,{pitch:15,pole:[-0.1,0,1]}) },
           mid:{ root:{pos:[0.38,0.66,-0.08],pitch:22,roll:-10}, neck:{flex:-8}, armL:A(-45,45,30), armR:A(60,60,30),
                 legL:leg(0.3,0,0,{pitch:0,pole:[0.2,0,1]}), legR:leg(0.0,0.2,0.05,{pitch:15,pole:[-0.1,0,1]}) },
           mid2:{ root:{pos:[0.0,1.0,0],pitch:8,roll:-6}, neck:{flex:-5}, armL:A(70,35,30), armR:A(-25,40,35),
                  legL:leg(0.25,0.15,-0.05,{anchor:'ball',pitch:45,pole:[0.1,0,1]}), legR:leg(-0.4,0.3,0.1,{pitch:20,pole:[-0.15,0,1]}) },
           mid3:{ root:{pos:[-0.7,1.0,0],pitch:12,roll:-4}, neck:{flex:-6}, armL:A(40,45,30), armR:A(10,45,30),
                  legL:leg(-0.4,0.3,-0.1,{pitch:30,pole:[0.1,0,0.8]}), legR:leg(-0.95,0.12,0.05,{pitch:15,pole:[-0.15,0,1]}) },
           end:{ root:{pos:[-1.0,0.66,0],pitch:22,roll:-2}, neck:{flex:-8}, armL:A(55,50,30), armR:A(15,50,30),
                 legL:leg(-0.7,0.2,-0.15,{pitch:35,pole:[0.1,0,0.6]}), legR:leg(-1.0,0,0,{pitch:0,pole:[-0.2,0,1]}) } } });

// 4 alternate-leg diagonal bound: drive off the rear leg, opposite knee high, fly, land on the opposite foot, diagonal forward and sideways
W('alternate-leg-diagonal-bound', { camera:{az:60,el:8}, muscles:['quadriceps','glutes','hamstrings'], floats:true,
  tempo:{ up:0.35, down:0.3, squeeze:0.1, stretch:0.1 },
  frames:{ start:{ root:{pos:[0.2,0.84,-0.5],pitch:14}, neck:{flex:-6}, armL:A(-15,80,25), armR:A(30,85,25),
                   legL:leg(0.31,0,-0.3,{pitch:0}), legR:leg(0.09,0,-0.7,{anchor:'ball',pitch:30}) },
           mid:{ root:{pos:[0.05,1.05,-0.15],pitch:12}, neck:{flex:-6}, armL:A(-45,80,30), armR:A(75,90,20),
                 legL:leg(0.2,0.55,0.2,{pitch:0,pole:[0.1,0,1]}), legR:leg(-0.02,0.2,-0.4,{anchor:'ball',pitch:40,pole:[-0.05,0,1]}) },
           mid2:{ root:{pos:[-0.15,1.15,0.35],pitch:10}, neck:{flex:-6}, armL:A(-30,80,12), armR:A(60,85,12),
                  legL:leg(0.0,0.4,0.7,{pitch:10,pole:[0.1,0,1]}), legR:leg(-0.2,0.5,-0.05,{pitch:20,pole:[-0.1,0,1]}) },
           end:{ root:{pos:[-0.4,0.84,0.85],pitch:14}, neck:{flex:-6}, armL:A(40,85,15), armR:A(-25,80,15),
                 legL:leg(-0.3,0,0.85,{anchor:'ball',pitch:15,pole:[0.05,0,1]}), legR:leg(-0.5,0.2,0.4,{pitch:35,pole:[-0.1,0,1]}) } } });

// 5 fast skipping: quick step-hop on the ball of the foot, knee to hip height, arms in opposition at 90 deg elbows
const skipPose = (kneeSide) => { const s = kneeSide, o = -s;
  const f = { root:{pos:[0,0.97,0],pitch:6}, neck:{flex:-4} };
  f['leg'+(s>0?'L':'R')] = { pos:[0.11*s,0.62,0.3], anchor:'sole', pitch:5, pole:[0.05*s,0,1] };
  f['leg'+(o>0?'L':'R')] = { pos:[0.11*o,0.0,0], anchor:'ball', pitch:30, pole:[0.05*o,0,1] };
  f['arm'+(s>0?'R':'L')] = A(70,90,15); f['arm'+(s>0?'L':'R')] = A(-40,90,30);
  return f; };
W('fast-skipping', { camera:{az:112,el:8}, muscles:['quadriceps','calves','glutes'], floats:true,
  tempo:{ up:0.3, down:0.3, squeeze:0.02, stretch:0.02 },
  frames:{ start:skipPose(1),
           mid:{ root:{pos:[0,0.99,0],pitch:4}, neck:{flex:-4}, armL:A(20,90,20), armR:A(20,90,20), legL:leg(0.11,0.03,0,{anchor:'ball',pitch:30}), legR:leg(-0.11,0.03,0,{anchor:'ball',pitch:30}) },
           end:skipPose(-1) } });

// 6 carioca: lateral run to the figure's right (-x); trail leg (left) crosses in front, side step, crosses behind; hips twist against square shoulders
const cr = (rx,yaw,legL,legR,aL,aR) => ({ root:{pos:[rx,0.82,0],pitch:6,yaw}, spine:{twist:-yaw}, neck:{flex:-2}, armL:aL, armR:aR, legL, legR });
const aF=A(60,90,12), aB=A(-30,90,25);
W('carioca-quick-step', { camera:{az:15,el:8}, muscles:['adductors','abductors','glutes'], muscleSide:'L', floats:true,
  tempo:{ up:0.5, down:0.5, squeeze:0.05, stretch:0.05 },
  frames:{ start:cr(0,0, leg(0.2,0,0,{pole:[0.1,0,1]}), leg(-0.2,0,0,{pole:[-0.1,0,1]}), aB, aF),
           mid:cr(-0.1,-25, leg(0.0,0.18,0.2,{pitch:15,pole:[0.1,0,1]}), leg(-0.2,0,0,{pole:[-0.1,0,1]}), aF, aB),
           mid2:cr(-0.2,-28, leg(-0.3,0,0.35,{pole:[0.15,0,1]}), leg(-0.2,0,0,{pole:[-0.1,0,1]}), aF, aB),
           mid3:cr(-0.35,0, leg(-0.3,0,0.35,{pole:[0.15,0,1]}), leg(-0.55,0.15,0,{pitch:10,pole:[-0.1,0,1]}), aB, aF),
           mid4:cr(-0.45,28, leg(-0.45,0.18,-0.1,{pitch:20,pole:[0.3,0,1]}), leg(-0.6,0,0,{pole:[-0.1,0,1]}), aF, aB),
           end:cr(-0.5,28, leg(-0.7,0,-0.25,{pole:[0.3,0,1]}), leg(-0.6,0,0,{pole:[-0.1,0,1]}), aB, aF) } });

// 7 moving claw series: knee up, foot dorsiflexed, then the foot sweeps down and back under the hip; tall torso, opposite arm punches
W('moving-claw-series', { camera:{az:112,el:8}, muscles:['hamstrings','glutes','quadriceps'], floats:true,
  tempo:{ up:0.5, down:0.2, squeeze:0.05, stretch:0.05 },
  frames:{ start:{ root:{pos:[0,0.93,0],pitch:5}, neck:{flex:-3}, armL:A(-40,90,25), armR:A(75,90,15),
                   legL:{fk:{flex:85,abd:3,rot:0,knee:95}, rel:'pelvis', foot:{pitch:-15}}, legR:leg(-0.11,0.0,0,{anchor:'ball',pitch:5}) },
           mid:{ root:{pos:[0,0.93,0],pitch:5}, neck:{flex:-3}, armL:A(10,90,20), armR:A(30,90,15),
                 legL:{fk:{flex:45,abd:3,rot:0,knee:55}, rel:'pelvis', foot:{pitch:-10}}, legR:leg(-0.11,0.0,0,{anchor:'ball',pitch:5}) },
           end:{ root:{pos:[0,0.93,0],pitch:5}, neck:{flex:-3}, armL:A(70,90,15), armR:A(-40,90,25),
                 legL:{fk:{flex:5,abd:3,rot:0,knee:50}, rel:'pelvis', foot:{pitch:5}}, legR:leg(-0.11,0.0,0,{anchor:'ball',pitch:5}) } } });
