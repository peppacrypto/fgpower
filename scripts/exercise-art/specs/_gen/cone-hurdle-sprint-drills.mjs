import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const fk = (flex, abd=8, elbow=90) => ({ fk:{flex,abd,elbow}, rel:'chest', curl:0.5 });
const arms = (l, r) => ({ armL:l, armR:r });
const sym = (flex, elbow=16, abd=8) => arms(fk(flex,abd,elbow), fk(flex,abd,elbow));
const legs = (x, y, z, o={}) => ({ legL:{pos:[x,y,z],anchor:'sole',pole:[0.1,0,1],...o}, legR:{pos:[-x,y,z],anchor:'sole',pole:[-0.1,0,1],...o} });
const sq = (z, h, b, pitch, neck, flex, o={}) => ({ root:{pos:[0,h,z-b],pitch}, neck:{flex:neck}, ...sym(flex,o.el??16), ...legs(o.x??0.13, 0, z) });
const air = (y, z, pitch, flex, o={}) => ({ root:{pos:[0,y+0.93,z-0.02],pitch}, neck:{flex:-6}, ...sym(flex,o.el??30,6), ...legs(o.x??0.13, y, z, {pitch:o.fp??22}) });

// 1/2 front hops over a cone or hurdle: swing arms back, explode, arms forward, land soft
const front = (slug, mus, prop, oh) => W(slug, { camera:{az:90,el:8}, muscles:mus, floats:true, props:[prop], tempo:{lift:'even'},
  frames:{ start:sq(-0.6,0.7,0.1,24,-12,-45,{el:20}),
           mid:air(oh+0.14,0,-6,75,{fp:15,el:20}),
           end:sq(0.6,0.72,0.1,22,-12,50,{el:20}) } });
front('front-cone-hops-or-hurdle-hops',['quadriceps','glutes','calves'],{type:'cone',pos:[0,0,0]},0.2);
front('hurdle-hops',['quadriceps','glutes','calves','hamstrings'],{type:'hurdle',pos:[0,0,0]},0.28);

// 3/4 lateral hops: sideways (+x) over the obstacle
const lat = (slug, mus, prop, oh, ext) => {
  const dip = (x, p=22) => ({ root:{pos:[x,0.66,0],pitch:p}, neck:{flex:-12}, ...sym(-40,30), legL:{pos:[x+0.13,0,0],anchor:'sole',pole:[0.1,0,1]}, legR:{pos:[x-0.13,0,0],anchor:'sole',pole:[-0.1,0,1]} });
  const jmp = (x) => ({ root:{pos:[x,oh+0.74+0.14,0],pitch:6}, neck:{flex:-6}, ...sym(40,30,30), legL:{pos:[x+0.13,oh+0.14,0],anchor:'sole',pitch:20,pole:[0.1,0,1]}, legR:{pos:[x-0.13,oh+0.14,0],anchor:'sole',pitch:20,pole:[-0.1,0,1]} });
  const f = { start:dip(-0.4), mid:jmp(0), mid2:dip(0.4) };
  f.end = ext ? ext : dip(0.4);
  W(slug, { camera:{az:12,el:8}, muscles:mus, floats:true, props:[prop], frames:f });
};
lat('lateral-cone-hops',['adductors','glutes'],{type:'cone',pos:[0,0,0]},0.3);
// side hop then sprint: land and break into a running stride ahead
const run = { root:{pos:[0.4,0.93,0.35],pitch:25,yaw:-90*0}, neck:{flex:-12}, spine:{flex:6},
  armL:fk(60,22,90), armR:fk(-45,22,90),
  legL:{pos:[0.52,0.5,0.6],anchor:'sole',pitch:20,pole:[0.1,0,1]}, legR:{pos:[0.28,0.1,0.05],anchor:'ball',pitch:35,pole:[-0.1,0,1]} };
lat('side-hop-sprint',['quadriceps','glutes'],{type:'hurdle',pos:[0,0,0],yaw:90},0.28,run);

// 5 single cone sprint drill: acceleration strides toward the cone, feet clear of it
{ const st=(z,Lf)=>({ root:{pos:[0,0.92,z],pitch:22}, neck:{flex:-10},
    armL:fk(Lf?-45:70,22,90), armR:fk(Lf?70:-45,22,90),
    legL:Lf?{pos:[0.1,0.2,z-0.35],anchor:'ball',pitch:40,pole:[0.1,0,1]}:{pos:[0.1,0.28,z+0.2],anchor:'ball',pitch:30,pole:[0.1,0,1]},
    legR:Lf?{pos:[-0.1,0.28,z+0.2],anchor:'ball',pitch:30,pole:[-0.1,0,1]}:{pos:[-0.1,0.2,z-0.35],anchor:'ball',pitch:40,pole:[-0.1,0,1]} });
  W('single-cone-sprint-drill',{camera:{az:90,el:8},muscles:['quadriceps','calves'],floats:true,tempo:{lift:'even',even:0.3},props:[{type:'cone',pos:[0.6,0,1.9]}],frames:{start:st(-0.7,true),mid:st(0.2,false),end:st(1.1,true)}}); }

// 6 kneeling arm drill: half kneeling, upright trunk still, arms swing alternately at 90 degrees
{ const k=(aL,aR)=>({ root:{pos:[0,0.52,-0.03],pitch:2}, neck:{flex:0}, armL:fk(aL,14,90), armR:fk(aR,14,90),
    legL:{pos:[0.11,0,0.36],anchor:'sole',pole:[0.1,0,1]},
    legR:{pos:[-0.11,0.045,-0.42],anchor:'ball',pitch:75,pole:[-0.1,0,1]} });
  W('kneeling-arm-drill',{camera:{az:90,el:8},muscles:['shoulders','anterior-deltoid','posterior-deltoid'],props:[],tempo:{lift:'even',even:0.35},
    frames:{start:k(80,-50),end:k(-50,80)}}); }

// 7 wall drill: straight 45 degree line, hands on the wall, alternating knee drives, piston down
{ const hand=(x)=>({pos:[x,1.18,0.78],contact:true,hand:'flat',fingers:[0,1,0],palm:[0,0,1],pole:[x*5,-1,-0.3]});
  const w=(L,R)=>({ root:{pos:[0,0.84,-0.13],pitch:46}, neck:{flex:-10}, armL:hand(0.19), armR:hand(-0.19), legL:L, legR:R });
  const down=(x)=>({pos:[x,0,-0.45],anchor:'ball',pitch:30,pole:[x,0.2,1]});
  const knee=(x)=>({pos:[x,0.42,0.12],anchor:'ball',pitch:5,pole:[x,0.5,1]});
  W('linear-acceleration-wall-drill',{camera:{az:90,el:4},muscles:['quadriceps','glutes','abdominals'],props:[{type:'wall',pos:[0,0,0.82],width:4}],floats:true,
    frames:{start:w(knee(0.11),down(-0.11)),mid:w(down(0.11),down(-0.11)),end:w(down(0.11),knee(-0.11))}}); }

// 8 three-part start: set position -> push-off line -> first low step -> second step under the hips
{ const set={ root:{pos:[0,0.56,-0.2],pitch:60}, spine:{flex:0}, neck:{flex:-10},
    armR:fk(60,10,90), armL:fk(-50,24,90),
    legL:{pos:[0.1,0,0.0],anchor:'sole',pole:[0.1,0,1]}, legR:{pos:[-0.1,0,-0.28],anchor:'ball',pitch:40,pole:[-0.1,0,1]} };
  const drive={ root:{pos:[0,0.82,0.25],pitch:50}, neck:{flex:-18}, armL:fk(70,24,90), armR:fk(-50,6,90),
    legL:{pos:[0.1,0.1,0.05],anchor:'ball',pitch:40,pole:[0.1,0,1]}, legR:{pos:[-0.1,0.35,0.3],anchor:'ball',pitch:40,pole:[-0.1,0,1]} };
  const tall={ root:{pos:[0,0.9,0.7],pitch:32}, neck:{flex:-10}, armL:fk(-50,24,90), armR:fk(70,22,90),
    legR:{pos:[-0.1,0.0,0.55],anchor:'ball',pitch:30,pole:[-0.1,0,1]}, legL:{pos:[0.1,0.28,0.2],anchor:'ball',pitch:40,pole:[0.1,0,1]} };
  const end={ root:{pos:[0,0.93,1.15],pitch:20}, neck:{flex:-10}, armL:fk(70,24,90), armR:fk(-50,22,90),
    legL:{pos:[0.1,0.0,1.2],anchor:'ball',pitch:30,pole:[0.1,0,1]}, legR:{pos:[-0.1,0.25,0.65],anchor:'ball',pitch:40,pole:[-0.1,0,1]} };
  W('linear-3-part-start-technique',{camera:{az:90,el:8},muscles:['hamstrings','glutes'],floats:true,props:[],frames:{start:set,mid:{...set,legR:{...set.legR,pos:[-0.1,0.09,-0.28]}},mid2:drive,mid3:tall,end}}); }
