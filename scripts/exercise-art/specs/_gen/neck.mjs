import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const M = ['neck'];
const stand = { root:{pos:[0,0.92,0]},
  legL:{pos:[0.12,0,0],anchor:'sole',pole:[0.05,0,1]}, legR:{pos:[-0.12,0,0],anchor:'sole',pole:[-0.05,0,1]} };
const hang = s => ({ fk:{flex:0,abd:8,elbow:6}, curl:0.2 });
// head-relative hand on surface
const H = (s, pos, fingers, palm, pole, curl=0.5) => ({ pos:[pos[0]*s,pos[1],pos[2]], rel:'head', contact:true, hand:'flat',
  fingers:[fingers[0]*s,fingers[1],fingers[2]], palm:[palm[0]*s,palm[1],palm[2]], pole:[pole[0]*s,pole[1],pole[2]], curl });

// seated floor chin to chest, fingers interlocked behind head
const seat = nk => ({ root:{pos:[0,0.11,0]}, neck:{flex:nk}, spine:{flex:6},
  armL:{pos:[0.04,0.07,-0.115],rel:'head',contact:true,hand:'flat',fingers:[-0.5,-0.85,0.1],palm:[0,0,1],pole:[0.5,-0.1,1],curl:0.6},
  armR:{pos:[-0.04,0.07,-0.15],rel:'head',contact:true,hand:'flat',fingers:[0.5,-0.85,0.1],palm:[0,0,1],pole:[-0.5,-0.1,1],curl:0.6},
  legL:{pos:[0.14,0.07,0.75],anchor:'ankle',pole:[0.05,1,0]}, legR:{pos:[-0.14,0.07,0.75],anchor:'ankle',pole:[-0.05,1,0]} });
W('chin-to-chest-stretch', { camera:{az:70,el:8}, muscles:M, props:[{type:'floor-mat'}], frames:{ start:seat(46) } });

// side neck stretch
const sn = (nk, sd) => ({ ...stand, neck:{flex:2, side:sd},
  armL:H(1,[0.06,0.14,0],[-0.5,0.8,0.3],[-0.7,-0.7,0],[1,0.1,0]), armR:hang(-1) });
W('side-neck-stretch', { camera:{az:15,el:6}, muscles:M, frames:{ start:sn(0,0), end:sn(0,32) } });

// isometric front and back
const ifr = { ...stand, neck:{flex:0},
  armL:H(1,[0.04,0.075,0.108],[-1,0.1,0.1],[0,0,-1],[0.8,-0.4,0.5],0.2), armR:H(-1,[0.04,0.075,0.108],[-1,0.1,0.1],[0,0,-1],[0.8,-0.4,0.5],0.2) };
const ibk = { ...stand, neck:{flex:0},
  armL:H(1,[0.04,0.07,-0.115],[-0.3,-0.95,0.1],[0,0,1],[0.5,-0.1,1],0.6), armR:H(-1,[0.04,0.07,-0.17],[-0.2,-0.97,0.1],[0,0,1],[0.5,-0.1,1],0.6) };
const imid = { ...stand, neck:{flex:0},
  armL:H(1,[0.24,0.05,0.05],[0,1,0.3],[-1,0,0],[1,-0.3,0],0.3), armR:H(-1,[0.24,0.05,0.05],[0,1,0.3],[-1,0,0],[1,-0.3,0],0.3) };
const imid2 = { ...stand, neck:{flex:0},
  armL:H(1,[0.14,0.07,-0.13],[-0.3,-0.95,0.1],[0,0,1],[0.8,-0.2,0.6],0.5), armR:H(-1,[0.14,0.07,-0.17],[-0.3,-0.95,0.1],[0,0,1],[0.8,-0.2,0.6],0.5) };
W('isometric-neck-exercise-front-and-back', { camera:{az:50,el:6}, muscles:M, frames:{ start:ifr } });

// isometric sides: left hand on left side of head
W('isometric-neck-exercise-sides', { camera:{az:25,el:6}, muscles:M, frames:{ start:{ ...stand, neck:{flex:0},
  armL:H(1,[0.09,0.07,0],[0,1,0.2],[-1,0,0],[1,-0.1,0],0.5), armR:hang(-1) } } });

// lying plates
const bench = { type:'flat-bench' };
const armsP = (z, fing, pal, y=0.08) => [1,-1].map(s => H(s,[0.14,y,z],fing,pal,[1,0,-0.2],0.7));
// face up: shoulders at bench end, plate on forehead
const up = nk => ({ root:{pos:[0,0.542,-0.27],pitch:-90}, neck:{flex:nk},
  armL:H(1,[0.07,0.09,0.15],[-0.2,1,0.1],[0,0,-1],[0.3,-0.5,1],0.4), armR:H(-1,[0.07,0.09,0.15],[-0.2,1,0.1],[0,0,-1],[0.3,-0.5,1],0.4),
  legL:{pos:[0.26,0,0.3],anchor:'sole',pole:[0.2,1,0.4]}, legR:{pos:[-0.26,0,0.3],anchor:'sole',pole:[-0.2,1,0.4]} });
W('lying-face-up-plate-neck-resistance', { camera:{az:70,el:8}, muscles:M, floats:true,
  props:[{...bench,pos:[0,0,0]},{type:'weight-plate',follow:'head',kg:5,at:[0,0.07,0.124],normal:[0,0,1]}],
  frames:{ start:up(20), end:up(-40) } });
const dn = nk => ({ root:{pos:[0,0.64,0.27],pitch:90}, neck:{flex:nk},
  armL:H(1,[0.103,0.07,-0.124],[-0.1,0.1,-1],[-1,0,0],[1,0.5,0],0.75), armR:H(-1,[0.103,0.07,-0.124],[-0.1,0.1,-1],[-1,0,0],[1,0.5,0],0.75),
  legL:{pos:[0.1,0.72,-0.48],anchor:'ball',pitch:90,pole:[0,-1,0]}, legR:{pos:[-0.1,0.72,-0.48],anchor:'ball',pitch:90,pole:[0,-1,0]} });
W('lying-face-down-plate-neck-resistance', { camera:{az:70,el:8}, muscles:M, floats:true,
  props:[{...bench,pos:[0,0,0]},{type:'weight-plate',follow:'head',kg:5,at:[0,0.07,-0.124],normal:[0,0,-1]}],
  frames:{ start:dn(-30), end:dn(45) } });

// seated head harness (gallery neck-harness), hands on knees
const hs = nk => ({ root:{pos:[0,0.545,-0.2],pitch:42}, spine:{flex:8}, neck:{flex:nk},
  armL:{pos:[0.2,0.62,0.2],contact:true,hand:'flat',fingers:[0.1,0,1],palm:[0,-1,0],curl:0.3,pole:[1,0.3,-0.3]},
  armR:{pos:[-0.2,0.62,0.2],contact:true,hand:'flat',fingers:[-0.1,0,1],palm:[0,-1,0],curl:0.3,pole:[-1,0.3,-0.3]},
  legL:{pos:[0.28,0,0.32],anchor:'sole',yaw:20,pitch:0,pole:[0.5,1,0.5]}, legR:{pos:[-0.28,0,0.32],anchor:'sole',yaw:-20,pitch:0,pole:[-0.5,1,0.5]} });
W('seated-head-harness-neck-resistance', { camera:{az:48,el:8}, muscles:M,
  props:[{type:'flat-bench',pos:[0,0,-0.62]},{type:'neck-harness',follow:'head',kg:10}], frames:{ start:hs(42), end:hs(-30) } });
