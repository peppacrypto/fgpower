import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,muscles,props,frames,more={})=>{out[slug]={slug,floats:true,camera,muscles,props,frames,...more};};
const leg=(s,y=0.343,b=0)=>({pos:[s*0.115,y,0.863+b],anchor:'sole',pitch:-70,pole:[s*0.15,1,0.3]});
const hand=(s,p,pa,pole,f=[0,0,1])=>({pos:[s*p[0],p[1],p[2]],contact:true,fingers:[s*f[0],f[1],f[2]],palm:[s*pa[0],pa[1],pa[2]],curl:0.78,pole:[s*pole[0],pole[1],pole[2]]});
const two=(p,pa,pole,f)=>({armL:hand(1,p,pa,pole,f),armR:hand(-1,p,pa,pole,f)});
const sit=(h,pitch,sf,nf)=>({root:{pos:[0,h+0.09,0],pitch},spine:{flex:sf},neck:{flex:nf},legL:leg(1,h-0.077+0.0),legR:leg(-1,h-0.077+0.0)});
const seat=(h,att,extra={})=>[{type:'seated-row',pos:[0,0,0],benchH:h,hands:true,attachment:att,...extra}];
const row=(slug,h,cam)=>save(slug,cam,['middle-back'],seat(h,'v-bar'),{
 start:{...sit(h,6,30,-24),...two([0.07,h+0.32,0.72],[-1,0,0],[0.5,-0.5,-0.2])},
 end:{...sit(h,-6,-4,4),...two([0.07,h+0.42,0.30],[-1,0,0],[0.5,-0.1,-1])}});
row('seated-cable-rows',0.42,{az:118,el:10});
// platform on the seat: raised hips, feet stay on plates (soles up with the seat)
row('elevated-cable-rows',0.55,{az:118,el:10});
save('seated-one-arm-cable-pulley-rows',{az:125,el:12},['middle-back'],[{type:'seated-row',pos:[0,0,0],benchH:0.42,hand:'L',attachment:'d-handle'}],{
 start:{...sit(0.42,6,30,-24),armL:hand(1,[0.07,0.74,0.72],[-1,0,0],[0.5,-0.5,-0.2]),armR:{fk:{flex:0,abd:12,rot:0,elbow:25},rel:'chest'}},
 end:{...sit(0.42,-6,-4,4),armL:hand(1,[0.12,0.84,0.30],[-1,0,0],[0.5,-0.1,-1]),armR:{fk:{flex:0,abd:12,rot:0,elbow:25},rel:'chest'}}},{muscleSide:'L'});
const rope=(slug,mus,endY,endZ,cam)=>save(slug,cam,mus,seat(0.42,'rope'),{
 start:{...sit(0.42,6,20,-12),...two([0.07,0.74,0.66],[-1,0,0],[1,0.1,-0.3])},
 end:{...sit(0.42,-4,-2,2),...two([0.2,endY,endZ],[-0.6,-0.8,0],[1,0.3,-0.6])}});
rope('cable-rope-rear-delt-rows',['shoulders'],1.0,0.3,{az:50,el:14});
rope('low-pulley-row-to-neck',['shoulders'],1.12,0.2,{az:60,el:12});
// kneeling at a high pulley
const kn={root:{pos:[0,0.5,-0.25],pitch:14},legL:{pos:[0.12,0.2,-0.62],anchor:"ankle",pole:[0,-1,0],pitch:80},legR:{pos:[-0.12,0.2,-0.62],anchor:"ankle",pole:[0,-1,0],pitch:80}};
const tw=att=>[{type:'cable-tower',pos:[0,0,0.66],yaw:180,pulleyY:2,hands:true,attachment:att}];
save('kneeling-high-pulley-row',{az:55,el:10},['lats'],tw('rope'),{
 start:{...kn,spine:{flex:4},neck:{flex:-6},...two([0.08,1.40,0.3],[-0.6,-0.8,0],[1,0,-0.2],[0,0.5,0.86])},
 end:{...kn,root:{pos:[0,0.5,-0.25],pitch:2},spine:{flex:-2},neck:{flex:0},...two([0.2,1.2,0.12],[-0.6,-0.8,0],[1,0.1,-1],[0,-0.3,0.95])}});
const ARM={fk:{flex:0,abd:12,rot:0,elbow:25},rel:'chest'};
save('kneeling-single-arm-high-pulley-row',{az:55,el:10},['lats'],[{type:'cable-tower',pos:[0,0,0.66],yaw:180,pulleyY:2,hand:'L',attachment:'d-handle'}],{
 start:{...kn,spine:{flex:4},neck:{flex:-6},armL:hand(1,[0.12,1.40,0.3],[0,0,1],[1,0,-0.2],[0,0.5,0.86]),armR:ARM},
 end:{...kn,root:{pos:[0,0.5,-0.25],pitch:2},spine:{flex:-2},neck:{flex:0},armL:hand(1,[0.24,1.0,0.1],[-0.8,-0.6,0],[0.5,-0.3,-1],[0,-0.2,1]),armR:ARM}},{muscleSide:'L'});
// shotgun row: wide split stance, low pulley
const sg={root:{pos:[0,0.8,-0.1],pitch:25},spine:{flex:6},neck:{flex:-18},legL:{pos:[0.15,0,0.40],anchor:'sole',yaw:8,pole:[0.1,0.5,1]},legR:{pos:[-0.15,0,-0.50],anchor:'sole',yaw:-8}};
save('shotgun-row',{az:60,el:10},['lats'],[{type:'cable-tower',pos:[0,0,1.2],yaw:180,pulleyY:0.2,hand:'L',attachment:'d-handle'}],{
 start:{...sg,armL:hand(1,[0.2,0.7,0.45],[0,-1,0],[0.4,-0.5,0.3],[0,-0.3,1]),armR:ARM},
 end:{...sg,root:{pos:[0,0.8,-0.1],pitch:22},armL:hand(1,[0.26,0.85,0.0],[-0.7,-0.7,0],[0.5,0.2,-1],[0,-0.2,1]),armR:ARM}},{muscleSide:'L'});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
