import fs from 'fs';
const arm=(s,x,y,z,o={})=>({pos:[x*s,y,z],contact:true,fingers:[0,-1,0],palm:[0,o.py??-0.05,-1],curl:o.curl??0.85,
  pole:[(o.px??0.3)*s,0,o.pz??-1],scap:{elev:o.el??0,prot:o.pr??0}});
const leg=(s,x,z,yaw,py,pole,y=0)=>({pos:[x*s,y,z],anchor:'sole',yaw:yaw*s,pitch:0,pole:pole.map((v,i)=>i==0?v*s:v)});
const conv=(o={})=>{const y0=o.y0??0, hy=o.hy??0.225;
 const f=(root,spine,neck,hand,el,pr)=>({root,spine,neck,armL:arm(1,o.hx??0.27,hand[0],hand[1],{el,pr,curl:o.curl,px:0.8,pz:-0.3}),armR:arm(-1,o.hx??0.27,hand[0],hand[1],{el,pr,curl:o.curl,px:0.8,pz:-0.3}),
  legL:leg(1,0.135,0.02,8,0,[0.25,0,1],y0),legR:leg(-1,0.135,0.02,8,0,[0.25,0,1],y0)});
 return {start:f({pos:[0,0.52+y0,-0.25],pitch:62},{flex:4},{flex:-30},[hy,0.12],0,0),
         mid:f({pos:[0,0.62+y0,-0.2],pitch:46},{flex:2},{flex:-12},[0.46+y0,0.25],1,0),
         end:f({pos:[0,0.915+y0,-0.02],pitch:-2},{flex:-2},{flex:2},[0.86+y0,0.13],0,0)};};
const sumo=(o={})=>{const f=(root,spine,neck,h,el,px=0.1)=>({root,spine,neck,
  armL:arm(1,0.13,h[0],h[1],{el,px,pz:-0.3,curl:o.curl}),armR:arm(-1,0.13,h[0],h[1],{el,px,pz:-0.3,curl:o.curl}),
  legL:leg(1,0.42,0.02,42,0,[0.9,0,1]),legR:leg(-1,0.42,0.02,42,0,[0.9,0,1])});
 return {mid:f({pos:[0,0.62,-0.16],pitch:38},{flex:2},{flex:-10},[0.48,0.27],1),start:f({pos:[0,0.54,-0.1],pitch:60},{flex:4},{flex:-20},[0.225,0.17],0,-0.2),
         end:f({pos:[0,0.855,-0.02],pitch:-2},{flex:-2},{flex:2},[0.82,0.2],2,0.7)};};
// rack pull: bar on pins at knee height
const rack=(py)=>{const f=(root,spine,neck,hy,hz,el)=>({root,spine,neck,armL:arm(1,0.235,hy,hz,{el}),armR:arm(-1,0.235,hy,hz,{el}),
  legL:leg(1,0.135,0.02,8,0,[0.25,0,1]),legR:leg(-1,0.135,0.02,8,0,[0.25,0,1])});
 return {start:f({pos:[0,0.76,-0.14],pitch:38},{flex:2},{flex:-10},py,0.27,2),
         mid:f({pos:[0,0.82,-0.08],pitch:26},{flex:0},{flex:-6},0.66,0.21,2),
         end:f({pos:[0,0.915,-0.02],pitch:-2},{flex:-2},{flex:2},0.86,0.14,2)};};
const M=['spinal-erectors','glutes','hamstrings'], MS=['hamstrings','glutes','quadriceps'];
const bar=(p=[20])=>({type:'barbell',hands:true,plates:p});
const out=(slug,camera,muscles,props,frames,extra={})=>fs.writeFileSync(new URL(`../${slug}.json`,import.meta.url),JSON.stringify({slug,camera,muscles,floats:true,props,frames,...extra},null,1));
const C={az:50,el:8}, C2={az:60,el:8};
out('barbell-deadlift',C,M,[bar()],conv());
out('axle-deadlift',C,M,[{type:'axle-bar',hands:true}],conv({curl:0.8}));
out('deadlift-with-bands',{az:30,el:10},M,[bar([20,10]),{type:'bar-bands',hands:true,to:'floor',drawPeg:false,pegs:[[0.42,0.03,0.14],[-0.42,0.03,0.14]],x:0.42,width:0.09,thick:0.014,rest:0.3}],conv());
out('deadlift-with-chains',{az:48,el:10},M,[bar([20,10]),{type:'chains',hands:true,x:0.97,base:[[0.97,0,0],[-0.97,0,0]]}],conv());
out('deficit-deadlift',{az:118,el:12},M,[{type:'deficit-platform',height:0.075},bar()],conv({y0:0.075,hy:0.225,hx:0.30}));
out('sumo-deadlift',C2,MS,[bar()],sumo());
out('sumo-deadlift-with-bands',C2,MS,[bar([20,10]),{type:'bar-bands',hands:true,to:'feet',x:0.3,width:0.08,thick:0.012,rest:0.42}],sumo());
out('sumo-deadlift-with-chains',C2,MS,[bar([20,10]),{type:'chains',hands:true,x:0.97,base:[[0.97,0,0],[-0.97,0,0]]}],sumo());
const rk=(py)=>[{type:'power-rack',pos:[0,0,0.24],pinY:py},bar()];
out('rack-pulls',C,M,rk(0.56),rack(0.56));
out('rack-pull-with-bands',C,M,[{type:'power-rack',pos:[0,0,0.24],pinY:0.56},bar([20,10]),{type:'bar-bands',hands:true,to:'floor',drawPeg:false,pegs:[[0.6875,0.039,0.54],[-0.6875,0.039,0.54]],x:0.69,width:0.09,thick:0.014,rest:0.3}],rack(0.56));
const rb=(f)=>[{type:'power-rack',pos:[0,0,0.24]},bar([20,10]),{type:'bar-bands',hands:true,to:'top',x:0.69,pegs:[[0.6875,2.18,-0.06],[-0.6875,2.18,-0.06]],rest:0.42}];
out('reverse-band-deadlift',C,M,rb(),conv());
out('reverse-band-sumo-deadlift',C2,MS,rb(),sumo());
