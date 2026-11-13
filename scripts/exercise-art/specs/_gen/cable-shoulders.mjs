import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,muscles,props,frames,more={})=>{out[slug]={slug,camera,muscles,props,frames,...more};};
const G=(s,p,f,pa,pole,ex={})=>({pos:[s*p[0],p[1],p[2]],hand:'grip',grip:0.015,fingers:[s*f[0],f[1],f[2]],palm:[s*pa[0],pa[1],pa[2]],pole:[s*pole[0],pole[1],pole[2]],...ex});
const both=(p,f,pa,pole,ex)=>({armL:G(1,p,f,pa,pole,ex),armR:G(-1,p,f,pa,pole,ex)});
const st=(pitch=4,z=0)=>({root:{pos:[0,0.914,z],pitch},spine:{flex:3},neck:{flex:0},
 legL:{pos:[0.28,0,z],anchor:'sole',yaw:7},legR:{pos:[-0.28,0,z],anchor:'sole',yaw:-7}});
const front=(att,y)=>[{type:'cable-tower',pos:[0,0,0.66],yaw:180,pulleyY:y,hands:true,attachment:att}];
const neu=[[0,0.2,0.98],[-1,0,0]];
// face pull
save('face-pull',{az:55,el:6},['posterior-deltoid','rhomboids'],front('rope',1.75),{
 start:{...st(-2),...both([0.06,1.62,0.5],[0,0.5,0.87],[-0.7,-0.7,0.2],[0.5,-0.6,-0.2])},
 mid:{...st(-2),...both([0.1,1.6,0.45],[0.1,0.7,0.7],[-0.7,-0.7,0.2],[0.5,-0.4,-0.25])},
 end:{...st(-2),...both([0.15,1.55,0.3],[0.2,0.5,0.87],[-0.7,-0.7,0.2],[0.8,0.1,-0.2])}},{});
// shrugs
const sh=(e,y)=>({...st(0),...both([0.17,y,0.2],[0,-1,0],[0,0,-1],[0.3,-0.4,-1],{scap:{elev:e}})});
save('cable-shrugs',{az:40,el:6},['traps'],front('straight-bar',0.2),{start:sh(0,0.78),end:sh(2.5,0.88)},{tempo:{lift:'there',up:1.0,down:1.8,squeeze:0.35}});
// rear delt fly
const cx=[{type:'cable-crossover',pos:[0,0,0.45],hands:true,pulleyY:2,cross:true,attachment:'d-handle'}];
const rd=(fl,ab,el)=>({...st(18),armL:{fk:{flex:fl,abd:ab,rot:0,elbow:el},rel:'chest',hand:'grip',pron:1},armR:{fk:{flex:fl,abd:ab,rot:0,elbow:el},rel:'chest',hand:'grip',pron:1}});
save('cable-rear-delt-fly',{az:10,el:8},['posterior-deltoid','rhomboids'],cx,{
 start:rd(75,-8,10),end:rd(5,82,10)});
// seated lateral raise: seated upright, side-on to a low pulley, handle in the far (left) hand, cable across the front
const seat=(fl,abd)=>({root:{pos:[0,0.55,-0.05],pitch:3},spine:{flex:2},neck:{flex:0},
 legL:{pos:[0.2,0,0.3],anchor:'sole',pole:[0.1,1,0.4]},legR:{pos:[-0.2,0,0.3],anchor:'sole',pole:[-0.1,1,0.4]},
 armL:{fk:{flex:fl,abd,rot:0,elbow:15},rel:'chest',hand:'grip',pron:1},
 armR:{pos:[-0.24,0.17,0.03],rel:'pelvis',pole:[-1,-0.15,-0.6],fingers:[0.3,-0.1,0.9],palm:[1,0,-0.1],curl:0.3,hand:'flat',contact:true}});
save('cable-seated-lateral-raise',{az:25,el:6},['lateral-deltoid'],[{type:'flat-bench',yaw:90,pos:[0,0,-0.1]},{type:'cable-tower',pos:[-0.8,0,-0.7],yaw:90,pulleyY:0.2,hand:'L',attachment:'d-handle'}],{
 start:seat(6,24),mid:seat(4,55),end:seat(0,88)},{muscleSide:'L'});
// front raise (back to tower)
const fk1=(flex,abd,elbow,rot=0)=>({fk:{flex,abd,rot,elbow},rel:'chest',hand:'grip',pron:0.6});
const fr=(fl,el)=>({...st(0,0),armL:fk1(fl,6,el),armR:{fk:{flex:0,abd:8,rot:0,elbow:12},rel:'chest'}});
save('front-cable-raise',{az:60,el:6},['anterior-deltoid'],[{type:'cable-tower',pos:[0.35,0,-0.55],yaw:0,pulleyY:0.2,hand:'L',attachment:'d-handle'}],{
 start:fr(8,14),mid:fr(50,14),end:fr(90,14)},{muscleSide:'L'});
// standing low-pulley deltoid raise, machine at figure's left; hand crosses the body
const dr=(fl,ab,el)=>({...st(0,0),armL:{fk:{flex:fl,abd:ab,rot:0,elbow:el},rel:'chest',hand:'grip',pron:1},
 armR:{pos:[-0.24,0.17,0.03],rel:'pelvis',pole:[-1,-0.15,-0.6],fingers:[0.3,-0.1,0.9],palm:[1,0,-0.1],curl:0.3,hand:'flat',contact:true}});
save('standing-low-pulley-deltoid-raise',{az:35,el:6},['lateral-deltoid','anterior-deltoid'],[{type:'cable-tower',pos:[0.75,0,0],yaw:-90,pulleyY:0.2,hand:'L',attachment:'d-handle'}],{
 start:dr(32,-14,8),mid:dr(40,40,14),end:dr(35,88,14)},{muscleSide:'L'});
// bent-over low pulley side lateral
const bo=(fl,ab,el)=>({root:{pos:[0,0.925,-0.15],pitch:75},spine:{flex:0},neck:{flex:-30},
 legL:{pos:[0.13,0,0],anchor:'sole',pole:[0,1,1]},legR:{pos:[-0.13,0,0],anchor:'sole',pole:[0,1,1]},
 armL:{fk:{flex:fl,abd:ab,rot:0,elbow:el},rel:'chest',hand:'grip',pron:1},
 armR:{pos:[-0.24,0.17,0.03],rel:'pelvis',pole:[-1,-0.15,-0.6],fingers:[0.3,-0.1,0.9],palm:[1,0,-0.1],curl:0.3,hand:'flat',contact:true}});
save('bent-over-low-pulley-side-lateral',{az:50,el:8},['posterior-deltoid','lateral-deltoid'],[{type:'cable-tower',pos:[1.0,0,0.1],yaw:-90,pulleyY:0.2,hand:'L',attachment:'d-handle'}],{
 start:bo(80,4,14),mid:bo(40,45,14),end:bo(5,86,14)},{muscleSide:'L'});
// presses (fk arms: elbows out under the bar, forearms vertical, locking out overhead)
const pa=(abd,fl,el,rot)=>({fk:{flex:fl,abd,rot,elbow:el},rel:'chest',hand:'grip',pron:0});
const pf=(l,r)=>({...st(0,0),armL:pa(...l),armR:pa(...r)});
const lo=[62,12,118,0],mi=[118,10,55,0],hi=[168,5,6,0];
const pr=[{type:'cable-crossover',pos:[0,0,0.6],hands:true,pulleyY:0.2,attachment:'d-handle',span:3.2}];
save('cable-shoulder-press',{az:30,el:6},['shoulders'],pr,{start:pf(lo,lo),mid:pf(mi,mi),end:pf(hi,hi)});
save('alternating-cable-shoulder-press',{az:30,el:6},['shoulders'],pr,{start:pf(hi,lo),mid:pf(mi,mi),end:pf(lo,hi)});
// upright cable row: bar from the thighs to the chin, elbows lead and stay above the hands
const ur=(x,y,z,pole,fi,pa,sc)=>({...st(0),...both([x,y,z],fi,pa,pole,{scap:{elev:sc}})});
save('upright-cable-row',{az:40,el:6},['traps','lateral-deltoid'],front('straight-bar',0.2),{
 start:ur(0.2,0.78,0.2,[0.3,-0.4,-1],[0,-1,0],[0,0,-1],0),mid:ur(0.3,1.0,0.27,[0.5,0.1,-0.6],[0,-1,0.1],[0,0.1,-1],0.4),end:ur(0.36,1.22,0.31,[0.45,0.4,-0.5],[0,-0.8,0.6],[0,0.6,-0.8],0.8)},{});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).length);
