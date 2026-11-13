import fs from 'fs';
const W=(slug,s)=>fs.writeFileSync(new URL(`../${slug}.json`,import.meta.url),JSON.stringify({slug,...s},null,1));
const v=(a,s)=>[a[0]*s,a[1],a[2]];
// hands behind the head (from old crunches spec)
const head=s=>({pos:[0.13*s,0.03,0.04],rel:'head',fingers:[0.546*s,0.584,-0.6],palm:[-0.827*s,0.265,-0.495],pole:[0.576*s,0.361,0.278],curl:0.3});
const feet=(z=0.64,x=0.14)=>({legL:{pos:[x,0,z],anchor:'sole',pole:[0,1,0.2]},legR:{pos:[-x,0,z],anchor:'sole',pole:[0,1,0.2]}});
const WT=[0,0.1,0.3,0.3,0.3];
const hd=()=>({armL:head(1),armR:head(-1)});
const fr=(pitch,flex,neck,o={})=>({root:{pos:[0,0.1,0],pitch},spine:{flex,weights:WT},neck:{flex:neck},...o});
const cam={az:88,el:20};
// crunch
W('crunches',{camera:cam,muscles:['abdominals'],frames:{start:fr(-90,0,6,{...hd(),...feet()}),end:fr(-86,24,10,{...hd(),...feet()})}});
// sit-ups
const su=(p,f,n)=>fr(p,f,n,{...hd(),...feet()});
W('sit-up',{camera:{az:88,el:12},muscles:['abdominals'],frames:{start:su(-90,0,6),mid:su(-62,14,8),end:su(-30,32,12)}});
W('3-4-sit-up',{camera:{az:88,el:12},muscles:['abdominals'],frames:{start:su(-34,32,12),mid:su(-58,16,10),end:su(-62,10,8)}});
W('janda-sit-up',{camera:{az:88,el:12},muscles:['abdominals'],frames:{start:{},mid:{},end:{}}});
{ const cr=s=>({pos:[-0.05*s,0.05,s>0?0.27:0.33],rel:'chest',fingers:[-0.65*s,0.7,s>0?0.2:0.05],palm:[0,-0.3,-1],pole:[s,-0.4,-0.2],curl:0.3});
  const j=(p,f,n)=>fr(p,f,n,{armL:cr(1),armR:cr(-1),...feet(0.62,0.14)});
  W('janda-sit-up',{camera:{az:88,el:12},muscles:['abdominals'],frames:{start:j(-90,0,6),mid:j(-62,14,8),end:j(-48,24,12)}}); }
// crunch hands overhead: arms aligned with head
{ const A=()=>({armL:{fk:{flex:172,abd:6,rot:0,elbow:4},curl:0.2},armR:{fk:{flex:172,abd:6,rot:0,elbow:4},curl:0.2}});
  W('crunch-hands-overhead',{camera:cam,muscles:['abdominals'],frames:{start:fr(-90,0,6,{...A(),...feet(0.5)}),end:fr(-86,22,10,{...A(),...feet(0.5)})}}); }
// weighted crunches: plate at chest (nearest to medicine ball)
{ const ar=s=>({pos:[0.17*s,0.03,0.2],rel:'chest',contact:true,fingers:[-0.25*s,0.1,0.95],palm:[-1*s,0,0],curl:0.7,pole:[s,-0.5,-0.3]});
  const w=(p,f,n)=>fr(p,f,n,{armL:ar(1),armR:ar(-1),...feet()});
  W('weighted-crunches',{camera:{az:70,el:12},muscles:['abdominals'],props:[{type:'weight-plate',follow:'chest',kg:10,at:[0,0.03,0.2],normal:[0,0,1]}],frames:{start:w(-90,0,10),end:w(-86,26,8)}}); }
// legs on ball, knees 90
{ const lg=(x)=>({legL:{pos:[x,0.55,0.43],anchor:'ankle',pitch:-65,pole:[0.1,1,0]},legR:{pos:[-x,0.55,0.43],anchor:'ankle',pitch:-65,pole:[-0.1,1,0]}});
  const b=(p,f,n)=>fr(p,f,n,{...hd(),...lg(0.06)});
  W('crunch-legs-on-exercise-ball',{camera:cam,muscles:['abdominals'],props:[{type:'stability-ball',pos:[0,0,0.55],radius:0.325,load:0.3}],frames:{start:b(-90,0,6),end:b(-86,24,10)}}); }
// tuck crunch: legs crossed up, thighs vertical, arms at sides
{ const ar=s=>({pos:[0.27*s,0,0.11],contact:true,hand:'flat',fingers:[0.08*s,0,1],palm:[0,-1,0],pole:[s,0.5,-0.2],curl:-0.3});
  const L=(fl,kn,ab)=>({legL:{fk:{flex:fl,abd:-ab,knee:kn},foot:{pitch:20}},legR:{fk:{flex:fl,abd:ab,knee:kn},foot:{pitch:20}}});
  const t=(p,f,n,fl,kn)=>fr(p,f,n,{armL:ar(1),armR:ar(-1),...L(fl,kn,2)});
  W('tuck-crunch',{camera:cam,muscles:['abdominals'],floats:true,frames:{start:t(-90,0,0,50,15),end:t(-92,26,8,105,105)}}); }
// frog sit-ups: knees open, soles together
{ const RL=+(process.env.RL||-50), FY=+(process.env.FY||0.1);const fg=(z)=>({legL:{pos:[0.065,FY,z],anchor:'ankle',roll:RL,pole:[1,0.1,-0.3]},legR:{pos:[-0.065,FY,z],anchor:'ankle',roll:-RL,pole:[-1,0.1,-0.3]}});
  const f=(p,fx,n)=>fr(p,fx,n,{...hd(),...fg(0.4)});
  W('frog-sit-ups',{camera:{az:70,el:30},muscles:['abdominals'],frames:{start:f(-90,0,6),end:f(-62,30,10)}}); }
// otis-up: medicine ball (nearest to plate) at chest, pressed overhead at the top
{ const ar=(s,y,z)=>({pos:[0.125*s,y,z],rel:'chest',contact:true,fingers:[0,0.8,0.6],palm:[-1*s,0,0],curl:0.4,pole:[s,-0.2*(1-0)+0.1*(y>0.3?1:0),0.2*(y>0.3?1:0)]});
  const o=(p,f,n,y,z)=>fr(p,f,n,{armL:ar(1,y,z),armR:ar(-1,y,z),...feet()});
  W('otis-up',{camera:{az:70,el:12},muscles:['abdominals'],props:[{type:'medicine-ball',hands:true,kg:6}],frames:{start:o(-90,0,10,0.1,0.3),mid:o(-60,16,8,0.25,0.34),end:o(-30,30,4,0.42,0.33)}}); }
