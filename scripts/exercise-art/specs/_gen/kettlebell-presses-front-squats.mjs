import fs from 'fs';
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const neg=(v,s)=>s>0?v:[-v[0],v[1],v[2]];
// rack (t=0) -> overhead (t=1) poses for the left hand, from specs/_gallery/kettlebell-rack.json
const R0={pos:[0.25,1.44,0.2],f:[0,1,0.12],p:[-0.9,-0.05,-0.45],pole:[0.25,-1,-0.15]};
const R1={pos:[0.25,2.05,0.07],f:[0,1,0.03],p:[-0.5,0,0.87],pole:[0.8,-0.1,-0.3]};
const arm=(s,o)=>({pos:neg(o.pos,s),contact:true,fingers:neg(o.f,s),palm:neg(o.p,s),curl:0.85,pole:neg(o.pole,s)});
// t: press fraction; d=[dx,dy,dz] shift of the shoulder from standing
const press=(s,t,d=[0,0,0],base=[R0,R1])=>{const [a,b]=base;
  return arm(s,{pos:lerp(a.pos,b.pos,t).map((v,i)=>v+d[i]),f:lerp(a.f,b.f,t),p:lerp(a.p,b.p,t),pole:lerp(a.pole,b.pole,t)});};
const M={pos:[0.27,1.72,0.2],f:[0,1,0.08],p:[-0.7,-0.02,0.1],pole:[0.55,-0.7,-0.15]};
const hang={fk:{flex:0,abd:8,elbow:14},curl:0.3};
const stand=(w=0.13)=>({legL:{pos:[w,0,0.03],anchor:'sole',yaw:8,pitch:0,pole:[0.1,0,1]},legR:{pos:[-w,0,0.03],anchor:'sole',yaw:-8,pitch:0,pole:[-0.1,0,1]}});
const squatLegs={legL:{pos:[0.2,0,0.02],anchor:'sole',yaw:22,pitch:0,pole:[0.5,0,1]},legR:{pos:[-0.2,0,0.02],anchor:'sole',yaw:-22,pitch:0,pole:[-0.5,0,1]}};
const SQ={root:{pos:[0,0.43,-0.2],pitch:14},spine:{flex:0},neck:{flex:-6}};
const SQd=[0,-0.45,-0.0];
const STAND={root:{pos:[0,0.925,0]},neck:{twist:0}};
const fr=(base,legs,L,R)=>({...base,...legs,armL:L,armR:R});
const props2=[{type:'kettlebell',hand:'L',kg:16,mode:'rack'},{type:'kettlebell',hand:'R',kg:16,mode:'rack'}];
const out={};
const mk=(slug,muscles,cam,props,frames,extra={})=>{out[slug]={slug,camera:cam,muscles,...extra,props,frames};};
const S=(L,R,b=STAND,legs=stand())=>fr(b,legs,L,R);

mk('two-arm-kettlebell-military-press',['anterior-deltoid','lateral-deltoid','triceps'],{az:40,el:6},props2,{
  start:S(press(1,0),press(-1,0)), mid:S(arm(1,M),arm(-1,M)), end:S(press(1,1),press(-1,1))});
mk('alternating-kettlebell-press',['anterior-deltoid','lateral-deltoid','triceps'],{az:35,el:6},props2,{
  start:S(press(1,0),press(-1,0)), mid:S(press(1,1),press(-1,0)), mid2:S(press(1,0),press(-1,0)), end:S(press(1,0),press(-1,1))});
mk('kettlebell-seesaw-press',['anterior-deltoid','lateral-deltoid','triceps'],{az:35,el:6},props2,{
  start:S(press(1,1),press(-1,0)), end:S(press(1,0),press(-1,1))});
const one=(muscles,cam,frames,legs=stand())=>{};
const single=(slug,cam,A,B,mid)=>mk(slug,['anterior-deltoid','lateral-deltoid','triceps'],cam,[{type:'kettlebell',hand:'L',kg:16,mode:'rack'}],
  {start:S(arm(1,A),hang), ...(mid?{mid:S(arm(1,mid),hang)}:{}), end:S(arm(1,B),hang)},{muscleSide:'L'});
single('one-arm-kettlebell-military-press-to-the-side',{az:62,el:6},R0,R1);
// para press: elbow out, palm forward
const P0={pos:[0.3,1.44,0.2],f:[0,1,0.1],p:[-0.95,-0.05,-0.3],pole:[0.8,-0.55,-0.2]};
const P1={pos:[0.3,2.05,0.07],f:[0,1,0.03],p:[-0.1,0,0.99],pole:[0.8,-0.1,-0.3]};
single('one-arm-kettlebell-para-press',{az:35,el:6},P0,P1,{pos:[0.32,1.7,0.14],f:[0,1,0.06],p:[-0.2,0,0.98],pole:[1,-0.2,-0.2]});
// arnold: palm toward face -> palm forward
const A0={pos:[0.14,1.45,0.22],f:[0,1,0.15],p:[-0.85,-0.05,-0.5],pole:[0.2,-1,-0.1]};
single('kettlebell-arnold-press',{az:40,el:6},A0,R1,{pos:[0.26,1.72,0.22],f:[0,1,0.08],p:[-0.6,-0.02,0.4],pole:[0.55,-0.7,-0.15]});
// seated on the floor, legs spread
const seat={root:{pos:[0,0.115,0],pitch:0},neck:{flex:0}};
const seatLegs={legL:{pos:[0.38,0.0,0.7],anchor:'heel',yaw:15,pitch:-20,pole:[0.2,1,0.2]},legR:{pos:[-0.38,0.0,0.7],anchor:'heel',yaw:-15,pitch:-20,pole:[-0.2,1,0.2]}};
const hang2={fk:{flex:0,abd:38,elbow:25},curl:0.3};
mk('kettlebell-seated-press',['anterior-deltoid','lateral-deltoid','triceps'],{az:55,el:8},[{type:'kettlebell',hand:'L',kg:16,mode:'rack'}],{
  start:fr(seat,seatLegs,press(1,0,[0,-0.81,0]),hang2), end:fr(seat,seatLegs,press(1,1,[0,-0.81,0]),hang2)},{muscleSide:'L',floats:true});
// squats: shoulders drop with the root
const sqD=[0,-0.5,-0.1];
const sqArm=(s,t=0)=>press(s,t,sqD);
mk('front-squats-with-two-kettlebells',['quadriceps','glutes'],{az:60,el:6},props2,{
  start:S(press(1,0),press(-1,0),STAND,squatLegs), end:S(sqArm(1),sqArm(-1),SQ,squatLegs)});
mk('kettlebell-thruster',['quadriceps','shoulders','glutes'],{az:50,el:6},props2,{
  start:S(press(1,0),press(-1,0),STAND,squatLegs), mid:S(sqArm(1),sqArm(-1),SQ,squatLegs),
  mid2:S(press(1,0.15,[0,-0.1,0]),press(-1,0.15,[0,-0.1,0]),{root:{pos:[0,0.8,-0.05],pitch:4},neck:{}},squatLegs),
  mid3:S(arm(1,M),arm(-1,M),STAND,squatLegs),
  end:S(press(1,1),press(-1,1),STAND,squatLegs)});
for(const [k,v] of Object.entries(out)) fs.writeFileSync(new URL(`../${k}.json`,import.meta.url),JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
