import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const A = (fl, el=16, abd=8) => ({ fk:{flex:fl,abd,elbow:el}, curl:0.5 });
const arms = (fl, el=16, abd=8) => ({ armL:A(fl,el,abd), armR:A(fl,el,abd) });
const leg = (x,y,z,o={}) => ({ pos:[x,y,z], anchor:'sole', pole:[Math.sign(x)*0.1,0,1], ...o });
const legs = (x,y,z,o={}) => ({ legL:leg(x,y,z,o), legR:leg(-x,y,z,o) });
const sq = (fy,fz,h,b,pitch,neck,fl,o={}) => ({ root:{pos:[o.rx??0,fy+h,fz-b],pitch}, neck:{flex:neck}, ...arms(fl,o.el??16), ...legs(o.x??0.13,fy,fz,o.leg||{}) });
const air = (fy,fz,h,pitch,fl,o={}) => ({ root:{pos:[0,fy+h,fz-(o.b??0.05)],pitch}, neck:{flex:o.neck??-6}, ...arms(fl,o.el??20,o.abd??6), ...legs(o.x??0.13,fy,fz,{pitch:o.fp??22}) });

// 1 standing long jump
W('standing-long-jump', { camera:{az:112,el:8}, muscles:['quadriceps','glutes','calves'], floats:true,
  frames:{ start:sq(0,-0.5,0.66,0.14,32,-18,-45,{leg:{anchor:'ball'}}),
           mid:{ root:{pos:[0,0.94,-0.4],pitch:20}, neck:{flex:-8}, ...arms(150,10,6), legL:leg(0.13,0.0,-0.5,{anchor:'ball',pitch:30}), legR:leg(-0.13,0.0,-0.5,{anchor:'ball',pitch:30}) },
           mid2:{ root:{pos:[0,1.15,0.6],pitch:25}, neck:{flex:-6}, ...arms(110,20,6), ...legs(0.13,0.65,0.95,{pitch:10}) },
           end:{ ...sq(0,1.45,0.55,0.25,38,-18,60), ...legs(0.13,0,1.45,{pitch:-8}) } } });

// 2 side standing long jump: travel to figure's right (-x), facing +Z, camera in front
const sd = (rx,fy,legx,h,pitch,fl,o={}) => ({ root:{pos:[rx,fy+h,0],pitch}, neck:{flex:-8}, ...arms(fl,o.el??25,o.abd??10),
  legL:leg(rx+legx,fy,0,o.l||{}), legR:leg(rx-legx,fy,0,o.r||{}) });
W('side-standing-long-jump', { camera:{az:15,el:8}, muscles:['quadriceps','glutes','abductors'], floats:true,
  frames:{ start:sd(0.3,0,0.13,0.68,24,10),
           mid:{ root:{pos:[0.0,1.0,0],pitch:6,roll:-8}, neck:{flex:-4}, ...arms(60,40,25), legL:leg(0.1,0.18,0,{pitch:12}), legR:leg(-0.2,0.15,0,{pitch:12}) },
           end:sd(-0.9,0,0.13,0.72,18,50,{el:40,abd:20}) } });

// 3 lateral bound: single leg to the side, land on opposite leg, bend hip/knee
W('lateral-bound', { camera:{az:15,el:8}, muscles:['adductors','glutes','quadriceps'], floats:true,
  frames:{ start:{ root:{pos:[0.25,0.72,0],pitch:22,roll:6}, neck:{flex:-8}, ...arms(20,60,15),
                   legL:leg(0.25,0,0,{pitch:0}), legR:leg(0.0,0,0,{pitch:0}) },
           mid:{ root:{pos:[-0.05,1.0,0],pitch:12,roll:-8}, neck:{flex:-6}, ...arms(40,50,20), legL:leg(0.0,0.35,0,{pitch:15}), legR:leg(-0.2,0.05,0,{anchor:'ball',pitch:50}) },
           end:{ root:{pos:[-0.65,0.7,0],pitch:24,roll:-6}, neck:{flex:-8}, ...arms(20,60,15),
                 legL:leg(-0.35,0.12,0,{anchor:'ball',pitch:35}), legR:leg(-0.7,0,0,{pitch:0}) } } });

// 4 alternate-leg diagonal bound: drive off rear leg, opposite knee high, land diagonal
W('alternate-leg-diagonal-bound', { camera:{az:60,el:8}, muscles:['quadriceps','glutes','hamstrings'], floats:true,
  frames:{ start:{ root:{pos:[0,0.86,-0.5],pitch:10}, neck:{flex:-6}, armL:A(-30,70), armR:A(40,80),
                   legL:leg(0.11,0,-0.3,{pitch:0}), legR:leg(-0.11,0,-0.7,{anchor:'ball',pitch:30}) },
           mid:{ root:{pos:[-0.15,1.2,0.1],pitch:10}, neck:{flex:-6}, armL:A(-40,70), armR:A(70,80),
                 legL:leg(0.11,0.35,0.0,{pitch:10}), legR:leg(-0.11,0.35,-0.15,{anchor:'sole',pitch:0,pole:[-0.1,0,1]}) , },
           end:{ root:{pos:[-0.3,0.86,0.75],pitch:12}, neck:{flex:-6}, armL:{fk:{flex:-30,abd:30,elbow:70},curl:0.5}, armR:A(45,80),
                 legL:leg(0.11,0.1,0.35,{anchor:'ball',pitch:40}), legR:leg(-0.3,0,0.8,{pitch:0}) } } });

// 5 fast skipping: step-hop, opposite arm and knee rise together, low to the ground
const skipPose = (kneeSide) => { const s = kneeSide, o = -s;
  const f = { root:{pos:[0,0.93,0],pitch:6}, neck:{flex:-4} };
  f['leg'+(s>0?'L':'R')] = { pos:[0.11*s,0.62,0.3], anchor:'sole', pitch:5, pole:[0.05*s,0,1] };
  f['leg'+(o>0?'L':'R')] = { pos:[0.11*o,0.0,0], anchor:'ball', pitch:5, pole:[0.05*o,0,1] };
  f['arm'+(s>0?'R':'L')] = A(75,70); f['arm'+(s>0?'L':'R')] = A(-35,80);
  return f; };
W('fast-skipping', { camera:{az:112,el:8}, muscles:['quadriceps','calves','glutes'], floats:true,
  frames:{ start:skipPose(1),
           mid:{ root:{pos:[0,0.95,0.2],pitch:4}, neck:{flex:-4}, armL:A(20,80), armR:A(20,80), legL:leg(0.11,0.08,0.1,{anchor:'ball',pitch:25}), legR:leg(-0.11,0.08,-0.05,{anchor:'ball',pitch:25}) },
           end:skipPose(-1) } });

// 6 carioca quick step: sideways, trail foot steps behind with knee lifted, arms up
W('carioca-quick-step', { camera:{az:15,el:8}, muscles:['adductors','abductors','calves'], floats:true,
  frames:{ start:{ root:{pos:[0,0.9,0],pitch:6,yaw:0}, neck:{flex:-2}, armL:A(60,90), armR:A(30,80),
                   legL:leg(0.2,0,0,{pitch:0}), legR:leg(-0.2,0,0,{pitch:0}) },
           mid:{ root:{pos:[0.1,0.9,0],pitch:6}, neck:{flex:-2}, armL:A(70,95), armR:A(60,90),
                 legL:leg(0.2,0,0,{pitch:0}), legR:leg(0.0,0.35,-0.25,{pitch:40,pole:[0,0,1]}) },
           end:{ root:{pos:[0.1,0.86,0],pitch:6}, neck:{flex:-2}, armL:A(60,90), armR:A(30,80),
                 legL:leg(0.2,0,0,{pitch:0}), legR:leg(0.0,0,-0.25,{pitch:0}) } } });

// 7 moving claw series: run in place form, heel kick to glute, block arms
W('moving-claw-series', { camera:{az:112,el:8}, muscles:['hamstrings','glutes','quadriceps'], floats:true,
  frames:{ start:{ root:{pos:[0,0.9,0],pitch:8}, neck:{flex:-4}, armL:A(70,90), armR:A(-40,90),
                   legL:{fk:{flex:-10,abd:3,rot:0,knee:100}, rel:'pelvis'}, legR:leg(-0.11,0.0,0,{anchor:'ball',pitch:5}) },
           mid:{ root:{pos:[0,0.9,0],pitch:8}, neck:{flex:-4}, armL:A(10,90), armR:A(20,90),
                 legL:{fk:{flex:50,abd:3,rot:0,knee:90}, rel:'pelvis'}, legR:leg(-0.11,0.0,0,{anchor:'ball',pitch:5}) },
           end:{ root:{pos:[0,0.9,0],pitch:8}, neck:{flex:-4}, armL:{fk:{flex:-40,abd:30,elbow:90},curl:0.5}, armR:A(70,90),
                 legL:{fk:{flex:70,abd:3,rot:0,knee:5}, rel:'pelvis'}, legR:leg(-0.11,0.0,0,{anchor:'ball',pitch:5}) } } });
