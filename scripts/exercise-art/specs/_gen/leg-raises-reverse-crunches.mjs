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
  start:fl(R(0.105,0,-90),both(L(90,90))),
  end:fl(R(0.2,-0.02,-118),both(L(116,90)),{nk:0,sp:sp(26)}) }});
// lying leg raise
W('lying-leg-raise',{camera:{az:84,el:22},muscles:['abdominals'],frames:{
  start:fl(R(0.105,0,-90),both(L(20))),
  end:fl(R(0.15,0,-102),both(L(88)),{nk:0,sp:sp(8)}) }});
// bent knee hip raise
W('bent-knee-hip-raise',{camera:{az:100,el:16},muscles:['abdominals'],frames:{
  start:fl(R(0.105,0,-90),both(L(33,70,0))),
  end:fl(R(0.19,-0.01,-114),both(L(108,70,0)),{nk:0,sp:sp(22)}) }});
// leg pull-in (mat)
W('leg-pull-in',{camera:{az:90,el:14},muscles:['abdominals'],frames:{
  start:fl(R(0.105,0,-90),both(L(18))),
  end:fl(R(0.115,0,-95),both(L(95,115,0)),{nk:0,sp:sp(6)}) }});
// scissor kick
W('scissor-kick',{camera:{az:88,el:16},muscles:['abdominals'],frames:{
  start:fl(R(0.105,0,-90),[L(48,3),L(16,3)],{nk:8}),
  end:fl(R(0.105,0,-90),[L(16,3),L(48,3)],{nk:8}) }});
// toe touchers
const reach = s => ({ fk:{flex:90, abd:10, elbow:4}, rel:'chest', curl:0.2 });
W('toe-touchers',{camera:{az:90,el:18},muscles:['abdominals'],frames:{
  start:fl(R(0.105,0,-90),both(L(88,8)),{nk:8,armL:reach(1),armR:reach(-1)}),
  end:fl(R(0.1,0,-92),both(L(88,8)),{nk:20,sp:{flex:40,weights:[0,0.1,0.2,0.3,0.4]},armL:reach(1),armR:reach(-1)}) }});
// bench variants: legs off the end
const bench = {type:'flat-bench',height:0.44};
const bArm = s => ({ pos:[0.17*s,0.44,0.1], contact:true, fingers:[0.0,0,1], palm:[0,-1,0], pole:[s,0.5,-0.2], curl:-0.3 });
const bf = (z,lg,y,p,o={}) => fl(R(y??0.532,z,p??-90),lg,{...o,armL:bArm(1),armR:bArm(-1)});
W('flat-bench-lying-leg-raise',{camera:{az:84,el:14},muscles:['abdominals'],props:[bench],floats:true,frames:{
  start:bf(0.2,both(L(10,3))), end:bf(0.2,both(L(88,3)),0.55,-96,{nk:0,sp:sp(6)}) }});
W('flat-bench-leg-pull-in',{camera:{az:90,el:12},muscles:['abdominals'],props:[bench],floats:true,frames:{
  start:bf(0.2,both(L(8,3))), end:bf(0.2,both(L(95,115)),0.545,-95,{nk:0,sp:sp(6)}) }});
