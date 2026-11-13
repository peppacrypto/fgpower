import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const ball = (extra={}) => ({ type:'stability-ball', pos:[0,0,0], radius:0.325, load:0.8, ...extra });
const sole = (x,z,pole,extra={}) => ({ pos:[x,0,z], anchor:'sole', yaw:0, pitch:0, pole, ...extra });

// 1. crunch: lower back on the ball, hands crossed on chest
const crX = s => ({ pos:[0.14*s,0.05,0.215], rel:'chest', hand:'flat', fingers:[-0.25*s,0.8,0.4], palm:[0,-0.8,-0.6], pole:[s,-0.2,0.4], curl:0.3 });
const cr = (pitch, flex, y, nk) => ({ root:{pos:[0,y,-0.1],pitch}, spine:{flex}, neck:{flex:nk}, armL:crX(1), armR:crX(-1),
  legL:sole(0.2,0.57,[0.2,1,0.4]), legR:sole(-0.2,0.57,[-0.2,1,0.4]) });
W('exercise-ball-crunch', { camera:{az:70,el:8}, muscles:['abdominals'], props:[ball()],
  frames:{ start:cr(-96,-12,0.66,-10), end:cr(-66,28,0.66,18) } });

// 2. weighted ball hyperextension: belly on ball, plate behind the head
const hyArm = s => ({ pos:[0.07*s,0.07,-0.165], rel:'head', contact:true, fingers:[-s,0.25,0], palm:[0,0,1], curl:0.5, pole:[s,0,-0.2] });
const hy = (pitch, flex, nk, y=0.72) => ({ root:{pos:[0,y,-0.05],pitch}, spine:{flex}, neck:{flex:nk}, armL:hyArm(1), armR:hyArm(-1),
  legL:{pos:[0.1,0,-0.52],anchor:'ball',pitch:40,pole:[0.1,-1,0]}, legR:{pos:[-0.1,0,-0.52],anchor:'ball',pitch:40,pole:[-0.1,-1,0]} });
W('weighted-ball-hyperextension', { camera:{az:70,el:8}, muscles:['spinal-erectors','glutes'],
  props:[ball(), {type:'weight-plate', follow:'head', kg:10, at:[0,0.06,-0.094-0.02], normal:[0,0,-1]}],
  frames:{ start:hy(150,6,0,0.8), end:hy(86,-4,0,0.74) } });

// 3. weighted side bend: left side on the ball, feet crossed on the floor
const sbArmF = s => ({ pos:[0.07*s,0.07,0.15], rel:'head', contact:true, fingers:[-0.7*s,0.7,0], palm:[0,-0.3,-1], curl:0.5, pole:[0.6*s,-0.3,1] });
const sbL = { pos:[0.0,0.0,0.1], rel:'chest', contact:true, hand:'flat', fingers:[-1,0,0], palm:[0,-0.3,-1], pole:[0.3,-0.5,0.8], curl:0.3 };
const sb = (flex) => ({ root:{pos:[0,0.66,0],pitch:0,roll:90}, spine:{side:flex}, neck:{flex:0}, armR:sbArmF(-1), armL:sbArmF(1),
  legL:sole(0.2,0.4,[0.3,-0.3,1]), legR:sole(0.36,-0.36,[0.3,-0.2,0.8],{pitch:18,toes:0}) });
W('weighted-ball-side-bend', { camera:{az:15,el:8}, muscles:['obliques','abdominals'], tempo:{lift:'there',up:1.0,down:1.8}, qaAllow:{'rom:trunk-flexion.range':'lateral bend: the trunk side-flexes (about 56 deg total), it does not curl forward'},
  props:[ball(), {type:'weight-plate', follow:'head', kg:5, at:[0,0.07,0.109+0.02], normal:[0,0,1]}],
  frames:{ start:sb(-28), end:sb(28) } });

// 4. pull-in: shins on the ball
const pa = s => ({ pos:[0.21*s,0,0.7], contact:true, fingers:[0.08*s,0,1], palm:[0,-1,0], curl:-0.3, pole:[0.5*s,0.3,-0.8] });
const pull = (root, spine, nk, lz, ly, lp, pz) => ({ root, spine, neck:{flex:nk}, armL:pa(1), armR:pa(-1),
  legL:{pos:[0.09,ly,lz],pitch:lp,pole:[0.05,-1,pz]}, legR:{pos:[-0.09,ly,lz],pitch:lp,pole:[-0.05,-1,pz]} });
W('exercise-ball-pull-in', { camera:{az:70,el:8}, muscles:['abdominals'], floats:true,
  props:[{type:'stability-ball',radius:0.275,follow:{on:['lowerleg01','foot'],side:'both',clear:0.042,at:0.72}}],
  frames:{ start:pull({pos:[0,0.6,0.12],pitch:92},{flex:0},-8,-0.72,0.61,112,0.02),
           end:pull({pos:[0,0.8,0.25],pitch:102},{flex:30},-12,-0.2,0.56,96,0.5) } });

// 5. downward-facing balance: hands walked out, ball under the thighs, legs lifted
const dfA = z => (s,y=0) => ({ pos:[0.2*s,y,z], contact:true, fingers:[0.05*s,0,1], palm:[0,-1,0], curl:-0.3, pole:[0.5*s,0.3,-0.8] });
W('downward-facing-balance', { camera:{az:70,el:8}, muscles:['glutes','spinal-erectors'], floats:true,
  props:[ball({follow:{on:['upperleg01','spine01'],clear:0.12}})],
  frames:{ start:{ root:{pos:[0,0.7,-0.1],pitch:100}, spine:{flex:5}, neck:{flex:-6}, armL:dfA(0.52)(1), armR:dfA(0.52)(-1),
      legL:{pos:[0.1,0,-0.55],anchor:'ball',pitch:40,pole:[0.1,-1,0]}, legR:{pos:[-0.1,0,-0.55],anchor:'ball',pitch:40,pole:[-0.1,-1,0]} },
    mid:{ root:{pos:[0,0.56,0.08],pitch:104}, spine:{flex:0}, neck:{flex:-6}, armL:dfA(0.52)(1,0), armR:dfA(0.52)(-1,0),
      legL:{pos:[0.1,0.3,-0.6],pitch:70,pole:[0.1,-1,0]}, legR:{pos:[-0.1,0.3,-0.6],pitch:70,pole:[-0.1,-1,0]} },
    end:{ root:{pos:[0,0.58,0.15],pitch:105}, spine:{flex:-6}, neck:{flex:-6}, armL:dfA(0.52)(1), armR:dfA(0.52)(-1),
      legL:{pos:[0.1,0.55,-0.68],pitch:85,pole:[0.1,-1,0]}, legR:{pos:[-0.1,0.55,-0.68],pitch:85,pole:[-0.1,-1,0]} } } });

// 6. pyramid: hips on top, hands and feet on the floor
const py = (pitch, flex, hz) => ({ root:{pos:[0,0.72,0],pitch}, spine:{flex}, neck:{flex:-6}, armL:dfA(hz)(1), armR:dfA(hz)(-1),
  legL:{pos:[0.12,0,-0.5],anchor:'ball',pitch:40,pole:[0.1,-1,0]}, legR:{pos:[-0.12,0,-0.5],anchor:'ball',pitch:40,pole:[-0.1,-1,0]} });
W('pyramid', { camera:{az:85,el:6}, muscles:['spinal-erectors'], props:[ball()],
  frames:{ start:py(106,2,0.55), end:py(122,16,0.55) } });

// 7. hug a ball: seated, straddling the ball, arms around it
const hug = (pitch, hz, hy, fl) => ({ root:{pos:[0,0.12,-0.2],pitch}, spine:{flex:fl}, neck:{flex:0},
  armL:{ pos:[0.295,hy,hz], hand:'flat', fingers:[-0.3,0,1], palm:[-1,0,0.1], pole:[1,-0.3,-0.5], curl:0.3 },
  armR:{ pos:[-0.295,hy,hz], hand:'flat', fingers:[0.3,0,1], palm:[1,0,0.1], pole:[-1,-0.3,-0.5], curl:0.3 },
  legL:sole(0.55,0.5,[0.3,1,0.3]), legR:sole(-0.55,0.5,[-0.3,1,0.3]) });
W('hug-a-ball', { camera:{az:60,el:10}, muscles:['spinal-erectors'], props:[ball({pos:[0,0,0.5], load:0.4})],
  frames:{ start:hug(11,0.52,0.4,22), end:hug(18,0.52,0.4,36) } });

// 8. chest stretch: kneeling, left elbow on the ball at the side
W('chest-stretch-on-stability-ball', { camera:{az:30,el:12}, muscles:['chest'], muscleSide:'L', props:[ball({pos:[0.5,0,0.05], load:0.3})],
  frames:{ start:{ root:{pos:[0,0.5,-0.1],pitch:78}, spine:{flex:5}, neck:{flex:-10},
    armL:{ pos:[0.5,0.56,0.3], hand:'flat', fingers:[0,-0.6,1], palm:[0,-1,-0.6], pole:[1,1,-0.3] },
    armR:{ pos:[-0.19,0,0.42], contact:true, hand:'flat', fingers:[0,0,1], palm:[0,-1,0], pole:[-0.5,0.3,-0.8] },
    legL:{ pos:[0.11,0.075,-0.5], anchor:'ankle', pitch:160, pole:[0,-1,0.05] }, legR:{ pos:[-0.11,0.075,-0.5], anchor:'ankle', pitch:160, pole:[0,-1,0.05] } },
  end:{ root:{pos:[0,0.5,-0.1],pitch:78}, spine:{flex:-2}, neck:{flex:0},
    armL:{ pos:[0.5,0.56,0.38], hand:'flat', fingers:[0,-0.6,1], palm:[0,-1,-0.6], pole:[1,1,-0.3] },
    armR:{ pos:[-0.19,0,0.42], contact:true, hand:'flat', fingers:[0,0,1], palm:[0,-1,0], pole:[-0.5,0.3,-0.8] },
    legL:{ pos:[0.11,0.075,-0.5], anchor:'ankle', pitch:160, pole:[0,-1,0.05] }, legR:{ pos:[-0.11,0.075,-0.5], anchor:'ankle', pitch:160, pole:[0,-1,0.05] } } } });

// 9. torso rotation: standing, arms straight, ball held, trunk turns
const tr = (tw) => ({ root:{pos:[0,0.925,0],pitch:0}, spine:{twist:tw,weights:[0.1,0.2,0.3,0.4,0.5]}, neck:{twist:-tw*0.3},
  armL:{ pos:[0.2,0.0,0.58], rel:'chest', fingers:[0.1,0.2,1], palm:[-1,0,0], curl:0.25, pole:[0.2,-0.5,0.3] },
  armR:{ pos:[-0.2,0.0,0.58], rel:'chest', fingers:[-0.1,0.2,1], palm:[1,0,0], curl:0.25, pole:[-0.2,-0.5,0.3] },
  legL:sole(0.17,0.03,[0.2,0,1],{yaw:10}), legR:sole(-0.17,0.03,[-0.2,0,1],{yaw:-10}) });
W('torso-rotation', { camera:{az:35,el:10}, muscles:['obliques','abdominals'], props:[{type:'stability-ball',hands:true,radius:0.275}],
  frames:{ start:tr(45), mid:tr(0), end:tr(-45) } });
