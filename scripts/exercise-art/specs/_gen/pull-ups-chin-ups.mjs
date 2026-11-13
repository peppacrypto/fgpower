import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};const Y=2.25;
const leg={fk:{flex:5,abd:2,knee:22},foot:{pitch:28}};
const legs=(k=22,f=5)=>({legL:{fk:{flex:f,abd:2,knee:k},foot:{pitch:28}},legR:{fk:{flex:f,abd:2,knee:k},foot:{pitch:28}}});
// s: +1 left. x half-width, mode over/under
const UP=[0,-1,0.3];
const hand=(s,x,mode='over',pole=[1,-0.6,-0.3],extra={})=>({pos:[s*x,Y,0],contact:true,fingers:[0,1,0],palm:[0,0,mode==='over'?1:-1],pole:[s*pole[0],pole[1],pole[2]],curl:0.82,...extra});
const arms=(x,mode,pole,e)=>({armL:hand(1,x,mode,pole,e),armR:hand(-1,x,mode,pole,e)});
const fr=(y,z,pitch,neck,A,o={})=>({root:{pos:[o.x||0,y,z],pitch,...(o.roll?{roll:o.roll}:{}),...(o.yaw?{yaw:o.yaw}:{})},neck:{flex:neck},...(o.spine?{spine:o.spine}:{}),...A,...(o.legs||legs())});
const save=(slug,camera,props,frames,muscles=['lats','biceps'],more={})=>{out[slug]={slug,camera,muscles,floats:true,props,frames,...more};};
const bar=[{type:'pull-up-bar',height:Y}];const wbar=[{type:'pull-up-bar',height:Y,width:1.8}];
const cam={az:148,el:8};
const A=arms(0.4,'over'),A3=arms(0.33,'over'),C=arms(0.17,'under',UP);
save('pullups',cam,bar,{start:fr(1.175,-0.03,-4,-6,A),end:fr(1.67,-0.1,-12,-14,A)});
save('chin-up',cam,bar,{start:fr(1.12,-0.03,-4,-6,C),end:fr(1.69,-0.1,-10,-14,C)},['lats','biceps']);
save('weighted-pull-ups',{az:135,el:8},[...bar,{type:'dip-belt',follow:true,kg:20,chain:0.3}],{start:fr(1.14,-0.03,-4,-6,arms(0.33,'over'),{legs:legs(60,-15)}),end:fr(1.69,-0.1,-12,-14,arms(0.33,'over'),{legs:legs(60,-15)})});
const VB=(()=>{const h=s=>({pos:[s*0.2,Y,0.13],contact:true,fingers:[0,1,0],palm:[-s,0,0],pole:[s*0.3,-1,0.3],curl:0.82});return {armL:h(1),armR:h(-1)};})();
save('v-bar-pullup',{az:130,el:8},[{type:'pull-up-bar',height:Y,multi:true}],{start:fr(1.16,-0.03,-4,-6,VB),end:fr(1.7,-0.1,-10,-12,VB)});
// wide grip rear
const R=arms(0.4,'over',[1,-1,0.5]);
save('wide-grip-rear-pull-up',{az:60,el:8},wbar,{start:fr(1.24,0.12,6,10,R),end:fr(1.55,0.14,8,18,R)},['lats','biceps'],{qaAllow:{'rom:vertical-pull.chin':'rear pull-up: the bar stops at the back of the neck, the head stays forward of it'}});
// mixed grip
const M={armL:hand(1,0.3,'over',[0.3,-1,0.3]),armR:hand(-1,0.24,'under',UP)};
save('mixed-grip-chin',cam,bar,{start:fr(1.14,-0.03,-4,-6,M,{roll:-4}),end:fr(1.69,-0.1,-10,-14,M)},['middle-back','biceps']);
// gironda
const G=arms(0.2,'under',UP);
save('gironda-sternum-chins',{az:80,el:8},bar,{start:fr(1.3,-0.1,-20,-18,G,{spine:{flex:-8}}),end:fr(1.8,-0.1,-30,-24,G,{spine:{flex:-10}})},['lats','biceps'],{qaAllow:{'rom:vertical-pull.chin':'Gironda: the head stays leaned back, the bar meets the sternum, not the chin'}});
// side to side
const S=arms(0.42,'over',[1.2,-1,-0.1]);
save('side-to-side-chins',{az:170,el:6},wbar,{start:fr(1.18,-0.03,-4,-6,S),mid:fr(1.68,-0.08,-8,-10,S,{x:0.05,roll:-5}),mid2:fr(1.18,-0.03,-4,-6,S),end:fr(1.68,-0.08,-8,-10,S,{x:-0.05,roll:5})},['lats','biceps'],{});
// archer: L working, R straight
const Ar=arms(0.42,'over',[1.4,-1,-0.1]);
save('archer-pull-up',{az:170,el:6},wbar,{start:fr(1.19,-0.03,-4,-6,Ar),end:fr(1.7,-0.08,-8,-10,Ar,{x:0.04,roll:-4})},['lats','biceps'],{muscleSide:'L'});
// rocky: front then behind
const Rk=arms(0.4,'over',[1.5,-0.5,-0.2]);
save('rocky-pull-ups-pulldowns',{az:60,el:8},wbar,{start:fr(1.175,-0.03,-4,-6,Rk),mid:fr(1.7,-0.2,-22,-16,Rk,{spine:{flex:-6}}),mid2:fr(1.24,0.12,6,10,R),end:fr(1.55,0.14,8,18,R)},['lats','biceps'],{qaAllow:{'rom:vertical-pull.chin':'second half of the rep is behind the neck, the bar stops at the back of the neck'}});
// scapular
save('scapular-pull-up',cam,bar,{start:fr(1.185,-0.03,-4,-6,A3),end:fr(1.27,-0.03,-4,-6,A3)},['traps','lats']);
// one-arm
const T={armL:hand(1,0.1,'under',UP),armR:{pos:[-0.1,Y-0.12,0.02],contact:true,fingers:[0,1,0],palm:[0,0,-1],pole:[0,-1,0.3],curl:0.82,grip:0.022}};
save('one-arm-chin-up',{az:150,el:8},[...bar,{type:'towel-strip',hand:'R',points:[[-0.1,Y+0.04,0],[-0.1,Y-0.04,-0.12]]}],{start:fr(1.17,-0.03,-14,-6,T),end:fr(1.69,-0.12,-14,-14,T)},['middle-back','biceps'],{muscleSide:'L'});
// band assisted
const Bd=[...bar,{type:'band',a:{pos:[0,Y,0],axis:[1,0,0],r:0.02},b:{knee:'L'},width:0.05,rest:0.6,follow:'pelvis'}];
const bl=(k)=>({legL:{fk:{flex:30,abd:2,knee:k},foot:{pitch:28}},legR:{fk:{flex:5,abd:2,knee:22},foot:{pitch:28}}});
save('band-assisted-pull-up',cam,Bd,{start:fr(1.17,-0.03,-4,-6,A,{legs:bl(95)}),end:fr(1.67,-0.1,-12,-14,A,{legs:bl(95)})});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
