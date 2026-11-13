import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const floorArm = s => ({ pos:[0.3*s,0.012,0.0], contact:true, fingers:[0.08*s,0,1], palm:[0,-1,0], pole:[s,0.1,0.2], curl:-0.3 });
const L = (flex, knee=2, pitch=0) => ({ fk:{flex, abd:1, knee}, foot:{pitch} });
const fl = (r, lg, o={}) => ({ root:r, neck:{flex:o.nk??0}, ...(o.sp?{spine:o.sp}:{}), armL:o.armL??floorArm(1), armR:o.armR??floorArm(-1),
  legL:lg[0], legR:lg[1] });
const both = (a,b=a)=>[a,b];
const R = (y,z,p)=>({pos:[0,y,z],pitch:p});
const sp = (f)=>({flex:f, weights:[0.4,0.3,0.2,0.1,0]});
// reverse crunch
W('reverse-crunch',{camera:{az:108,el:18},muscles:['abdominals'],frames:{
  start:fl(R(0.1,0,-90),both(L(90,90)),{armL:{...floorArm(1),pos:[0.33,0.012,0]},armR:{...floorArm(-1),pos:[-0.33,0.012,0]}}),
  end:fl(R(0.27,-0.04,-130),both({fk:{flex:127,abd:8,knee:125},foot:{pitch:0}}),{nk:0,sp:sp(24),armL:{...floorArm(1),pos:[0.33,0.012,0]},armR:{...floorArm(-1),pos:[-0.33,0.012,0]}}) }});
// lying leg raise
W('lying-leg-raise',{camera:{az:84,el:22},muscles:['abdominals'],frames:{
  start:fl(R(0.105,0,-90),both(L(20))),
  end:fl(R(0.15,0,-102),both(L(88)),{nk:0,sp:sp(8)}) }});
// bent knee hip raise
W('bent-knee-hip-raise',{camera:{az:100,el:16},muscles:['abdominals'],frames:{
  start:fl(R(0.1,0,-90),both(L(62,100,0))),
  end:fl(R(0.2,-0.03,-122),both(L(115,100,0)),{nk:0,sp:sp(22)}) }});
// leg pull-in (mat)
W('leg-pull-in',{camera:{az:90,el:14},muscles:['abdominals'],frames:{
  start:fl(R(0.105,0,-90),both(L(18))),
  end:fl(R(0.115,0,-95),both(L(95,115,0)),{nk:0,sp:sp(6)}) }});
// scissor kick
W('scissor-kick',{tempo:{lift:'even',up:0.8,down:0.8,pauses:0},timing:{there:0.8,holdEnd:0,back:0.8,holdStart:0},camera:{az:88,el:16},muscles:['abdominals'],frames:{
  start:fl(R(0.105,0,-90),[L(50,3),L(14,3)],{nk:8}),
  end:fl(R(0.105,0,-90),[L(14,3),L(50,3)],{nk:8}) }});
// toe touchers
const reach = s => ({ fk:{flex:90, abd:10, elbow:4}, rel:'chest', curl:0.2 });
const up = s => ({ fk:{flex:160, abd:10, elbow:4}, rel:'chest', curl:0.2 });
W('toe-touchers',{tempo:{lift:'there',up:1,down:1.8,pauses:0},timing:{there:1,holdEnd:0.2,back:1.8,holdStart:0.2},camera:{az:90,el:18},muscles:['abdominals'],frames:{
  start:fl(R(0.1,0,-90),both(L(90,0)),{nk:0,armL:up(1),armR:up(-1)}),
  end:fl(R(0.1,0,-92),both(L(90,0)),{nk:20,sp:{flex:40,weights:[0,0.1,0.2,0.3,0.4]},armL:reach(1),armR:reach(-1)}) }});
// bench variants: legs off the end
const bench = {type:'flat-bench',height:0.44};
const bArm = s => ({ pos:[0.17*s,0.44,0.1], contact:true, fingers:[0.0,0,1], palm:[0,-1,0], pole:[s,0.5,-0.2], curl:-0.6 });
const bf = (z,lg,y,p,o={}) => fl(R(y??0.532,z,p??-90),lg,{...o,armL:bArm(1),armR:bArm(-1)});
W('flat-bench-lying-leg-raise',{camera:{az:84,el:14},muscles:['abdominals'],props:[bench],floats:true,frames:{
  start:bf(0.2,both(L(10,3))), end:bf(0.2,both(L(88,3)),0.55,-96,{nk:0,sp:sp(6)}) }});
W('flat-bench-leg-pull-in',{camera:{az:90,el:12},muscles:['abdominals'],props:[bench],floats:true,frames:{
  start:bf(0.2,both(L(8,3))), end:bf(0.2,both(L(95,115)),0.545,-95,{nk:0,sp:sp(6)}) }});
