import fs from 'fs';
const W=new URL('../',import.meta.url);
const save=(slug,camera,muscles,props,frames,more={})=>fs.writeFileSync(new URL(slug+'.json',W),JSON.stringify({slug,camera,muscles,floats:true,props,frames,...more},null,1));
const M=['quadriceps','glutes','hamstrings'];
// side hands (contact hand on trap-bar / machine handle, palms in)
const sd=(s,x,y,z,pz=-0.6)=>({pos:[x*s,y,z],contact:true,fingers:[0,-1,0],palm:[-s,0,0],curl:0.85,pole:[0.5*s,0,pz]});
const legs=(y=0)=>({legL:{pos:[0.14,y,0],anchor:'sole',yaw:10,pitch:0,pole:[0.3,0,1]},legR:{pos:[-0.14,y,0],anchor:'sole',yaw:-10,pitch:0,pole:[-0.3,0,1]}});
const lift=(a,x,sp={})=>({start:{root:{pos:[0,0.53,-0.2],pitch:40},spine:{flex:2},neck:{flex:-22},armL:sd(1,x,0.29,0.06),armR:sd(-1,x,0.29,0.06),...legs()},
 mid:{root:{pos:[0,0.68,-0.14],pitch:26},spine:{flex:1},neck:{flex:-14},armL:sd(1,x,0.5,0.05),armR:sd(-1,x,0.5,0.05),...legs()},
 end:{root:{pos:[0,0.925,0],pitch:-1},spine:{flex:0},neck:{flex:2},armL:sd(1,x,0.83,0.06),armR:sd(-1,x,0.83,0.06),...legs()}});
save('trap-bar-deadlift',{az:38,el:14},M,[{type:'trap-bar',hands:true,plates:[20,10]}],lift(0,0.295));
// leverage machine
const lv=JSON.parse(fs.readFileSync(new URL('_gallery/leverage-lift.json',W)));
const lvs=JSON.parse(fs.readFileSync(new URL('_gallery/leverage-lift-shrug.json',W)));
const lvf={...lv.frames};
{const s=lv.frames.start,e=lv.frames.end;lvf.mid=JSON.parse(JSON.stringify(s));lvf.mid.root={pos:[0,0.84,-0.1],pitch:24};lvf.mid.neck={flex:-12};
 for(const k of ['armL','armR'])lvf.mid[k].pos[1]=0.69;}
lvf.end=JSON.parse(JSON.stringify(lvf.end));lvf.end.root={pos:[0,1.005,-0.01],pitch:-4};
save('leverage-deadlift',{az:62,el:8},M,lv.props,lvf);
{const f=JSON.parse(JSON.stringify(lvs.frames));
 for(const k of ['armL','armR']){f.end[k].pos[1]=f.start[k].pos[1]+0.06;f.end[k].scap={elev:26,prot:0};f.start[k].scap={elev:-4,prot:0};}
 f.start.neck={flex:0};f.end.neck={flex:3};
 save('leverage-shrug',{az:85,el:6},['traps'],lvs.props,f);}
// cable deadlifts
const tw=[{type:'cable-tower',pos:[0.75,0,0],yaw:-90,pulleyY:0.2,hand:'L',attachment:'d-handle'},{type:'cable-tower',pos:[-0.75,0,0],yaw:90,pulleyY:0.2,hand:'R',attachment:'d-handle'}];
const cl=lift(0,0.33);
cl.start.root={pos:[0,0.62,-0.26],pitch:52};cl.start.neck={flex:-34};cl.start.spine={flex:3};
for(const k of ['armL','armR'])cl.start[k]=sd(k==='armL'?1:-1,0.33,0.3,0.08);
cl.mid.neck={flex:-18};
save('cable-deadlifts',{az:62,el:12},M,tw,cl);
// barbell hack squat: bar behind thighs
const bh=(s,y,z)=>({pos:[0.22*s,y,z],hand:'grip',grip:0.014,fingers:[0,-1,0],palm:[0,0,-1],pole:[0.4*s,0,-1]});
const hf=(root,sp,nk,y,z)=>({root,spine:{flex:sp},neck:{flex:nk},armL:bh(1,y,z),armR:bh(-1,y,z),...legs()});
const hl=(o)=>({legL:{pos:[0.17,0,0],anchor:'sole',yaw:12,pitch:0,pole:[0.4,0,1]},legR:{pos:[-0.17,0,0],anchor:'sole',yaw:-12,pitch:0,pole:[-0.4,0,1]}});
const hf2=(root,sp,nk,y,z)=>({...hf(root,sp,nk,y,z),...hl()});
save('barbell-hack-squat',{az:60,el:8},['quadriceps','glutes'],[{type:'barbell',hands:true,plates:[20]}],{
 start:hf2({pos:[0,0.925,0],pitch:-1},0,2,0.85,-0.1),
 mid:hf2({pos:[0,0.72,-0.1],pitch:14},2,-4,0.6,-0.14),
 end:hf2({pos:[0,0.45,-0.3],pitch:32},2,-28,0.34,-0.33)});
// one-arm side deadlift
const oa=(root,sp,nk,y,z)=>({root,spine:{flex:sp},neck:{flex:nk},
 armL:sd(1,0.33,y,z),
 armR:{fk:{flex:0,abd:12,rot:0,elbow:10},rel:'world'},...legs()});
save('one-arm-side-deadlift',{az:-75,el:10},M,[{type:'barbell',hand:'L',plates:[20]}],{
 start:oa({pos:[0,0.62,-0.26],pitch:50},2,-32,0.3,0.06),
 mid:oa({pos:[0,0.68,-0.14],pitch:26},1,-14,0.5,0.05),
 end:oa({pos:[0,0.925,0],pitch:-1},0,2,0.83,0.06)},{muscleSide:'L'});
// jefferson: facing +X, bar along Z between the legs
const jl=(f)=>({legL:{pos:[f*0.3,0,-0.17],anchor:'sole',yaw:90,pitch:0,pole:[1,0,-0.3]},legR:{pos:[-f*0.56,0.035,0.17],anchor:'ball',yaw:90,pitch:52,pole:[1,0,0.3]}});
const jh=(y,x)=>({armL:{pos:[x,y,-0.38],hand:'grip',grip:0.014,fingers:[0,-1,0],palm:[-1,0,0],pole:[0,0,-1]},
 armR:{pos:[x,y,0.38],hand:'grip',grip:0.014,fingers:[0,-1,0],palm:[-1,0,0],pole:[0,0,1]}});
const jf=(root,sp,nk,y,x,f=1)=>({root,spine:{flex:sp},neck:{flex:nk},...jh(y,x),...jl(f)});
save('jefferson-squats',{az:30,el:10},['quadriceps','glutes'],[{type:'barbell',pos:[0.1,0,0],yaw:90,hands:true,plates:[20]}],{
 start:jf({pos:[-0.15,0.5,0],yaw:90,pitch:43},1,-30,0.225,0.1),
 mid:jf({pos:[-0.12,0.68,0],yaw:90,pitch:26},1,-10,0.5,0.1),
 end:jf({pos:[-0.04,0.84,0],yaw:90,pitch:3},0,2,0.7,0.0)});
