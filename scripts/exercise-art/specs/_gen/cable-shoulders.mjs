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
save('cable-shrugs',{az:40,el:6},['traps'],front('straight-bar',0.2),{start:sh(0,0.8),end:sh(1,0.86)});
// rear delt fly
const cx=[{type:'cable-crossover',pos:[0,0,0.45],hands:true,pulleyY:2,cross:true,attachment:'d-handle'}];
const rd=(fl,ab,el)=>({...st(18),armL:{fk:{flex:fl,abd:ab,rot:0,elbow:el},rel:'chest',hand:'grip',pron:1},armR:{fk:{flex:fl,abd:ab,rot:0,elbow:el},rel:'chest',hand:'grip',pron:1}});
save('cable-rear-delt-fly',{az:35,el:8},['posterior-deltoid','rhomboids'],cx,{
 start:rd(75,-8,10),end:rd(5,82,10)});
// seated lateral raise (upright)
const seat=(abd)=>({root:{pos:[0,0.55,-0.05],pitch:5},spine:{flex:2},neck:{flex:0},
 legL:{pos:[0.15,0,0.3],anchor:'sole',pole:[0.1,1,0.4]},legR:{pos:[-0.15,0,0.3],anchor:'sole',pole:[-0.1,1,0.4]},
 armL:{fk:{flex:abd<30?5:0,abd,rot:0,elbow:20},rel:'chest',hand:'grip',pron:1},armR:{fk:{flex:abd<30?5:0,abd,rot:0,elbow:20},rel:'chest',hand:'grip',pron:1}});
save('cable-seated-lateral-raise',{az:25,el:6},['lateral-deltoid'],[{type:'flat-bench',yaw:90,pos:[0,0,-0.1]},{type:'cable-crossover',pos:[0,0,0.3],hands:true,pulleyY:0.2,attachment:'d-handle'}],{
 start:seat(12),end:seat(88)});
// front raise (back to tower)
const fr=(p,f,pa)=>({...st(0,0),armL:G(1,p,f,pa,[0.8,-0.3,-0.3]),armR:{fk:{flex:0,abd:10,rot:0,elbow:15},rel:'chest'}});
save('front-cable-raise',{az:60,el:6},['anterior-deltoid'],[{type:'cable-tower',pos:[0.35,0,-0.55],yaw:0,pulleyY:0.2,hand:'L',attachment:'d-handle'}],{
 start:fr([0.28,0.8,0.17],[-0.337,-0.941,0.106],[0,0.1,-1]),
 mid:fr([0.22,1.18,0.42],[-0.334,-0.206,0.941],[0,-1,0.1]),
 end:fr([0.22,1.38,0.5],[-0.342,0,0.94],[0,-1,0])},{muscleSide:'L'});
// standing low-pulley deltoid raise, machine at figure's left
const dr=(p,f,pa)=>({...st(0,0),armL:G(1,p,f,pa,[0.5,-0.5,-0.5]),armR:{pos:[-0.21,0.98,0.05],hand:'flat',contact:true,fingers:[0,-1,0.2],palm:[1,0,0],pole:[-0.3,-0.5,-0.4]}});
save('standing-low-pulley-deltoid-raise',{az:35,el:6},['lateral-deltoid','anterior-deltoid'],[{type:'cable-tower',pos:[0.75,0,0],yaw:-90,pulleyY:0.2,hand:'L',attachment:'d-handle'}],{
 start:dr([0.14,1.0,0.34],[0.07,-0.27,0.95],[0,-1,0.2]),
 mid:dr([0.12,1.2,0.4],[0.12,0,0.993],[0,-1,0]),
 end:dr([0.3,1.36,0.36],[0.393,0,0.92],[0,-1,0])},{muscleSide:'L'});
// bent-over low pulley side lateral
const bo=(p,f,pa)=>({root:{pos:[0,0.925,-0.15],pitch:75},spine:{flex:0},neck:{flex:-30},
 legL:{pos:[0.13,0,0],anchor:'sole',pole:[0,1,1]},legR:{pos:[-0.13,0,0],anchor:'sole',pole:[0,1,1]},
 armL:G(1,p,f,pa,[0.6,-0.2,-0.5]),armR:{pos:[-0.2,0.72,0.12],hand:'flat',contact:true,fingers:[0,-1,0.3],palm:[0,0.3,-1],pole:[-0.3,-0.3,-0.5]}});
save('bent-over-low-pulley-side-lateral',{az:50,el:8},['posterior-deltoid','lateral-deltoid'],[{type:'cable-tower',pos:[-0.75,0,0.1],yaw:90,pulleyY:0.2,hand:'L',attachment:'d-handle'}],{
 start:bo([0.08,0.6,0.38],[-0.338,-0.839,0.39],[0.1,0.4,-0.9]),
 mid:bo([0.4,0.78,0.38],[0.377,-0.371,0.787],[0,-1,0.1]),
 end:bo([0.68,0.98,0.34],[0.816,0,0.587],[0,-1,0])},{muscleSide:'L'});
// presses
const cp=(l,r)=>{const a=(s,y)=>{const t=Math.min(1,Math.max(0,(y-1.4)/0.52));const L=(u,v)=>{const w=u.map((x,i)=>x+(v[i]-x)*t);const n=Math.hypot(...w);return w.map(x=>+(x/n).toFixed(3));};
 return G(s,[+(process.env.HX||0.36)-0.05*t,y,0.12-0.07*t],L([0,1,-0.2],[0,0.55,-0.83]),L([0,0.2,1],[0,0.83,0.55]),[+(process.env.PX||0.3),-1,-0.3]);};
 return {...st(0,0.0),armL:a(1,l),armR:a(-1,r)};};
const pr=[{type:'cable-crossover',pos:[0,0,0.6],hands:true,pulleyY:0.2,attachment:'d-handle'}];
const top=1.92,sho=1.4;
const P=(l,r)=>({...cp(l,r)});
save('cable-shoulder-press',{az:30,el:6},['shoulders'],pr,{start:P(sho,sho),mid:P((sho+top)/2,(sho+top)/2),end:P(top,top)});
save('alternating-cable-shoulder-press',{az:30,el:6},['shoulders'],pr,{start:P(top,sho),mid:P((sho+top)/2,(sho+top)/2),end:P(sho,top)});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).length);
