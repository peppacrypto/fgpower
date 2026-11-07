import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,muscles,frames,more={})=>{out[slug]={slug,camera,muscles,frames,...more};};
const H=(s,z,po=[0.55,0.35,-0.75],x=0.2)=>({pos:[s*x,0,z],contact:true,fingers:[s*0.12,0,1],palm:[0,-1,0],curl:-0.3,pole:[s*po[0],po[1],po[2]]});
const hands=(z,po,x)=>({armL:H(1,z,po,x),armR:H(-1,z,po,x)});
const F=(z,pitch,y=0.012,x=0.09)=>({legL:{pos:[x,y,z],anchor:'ball',pitch,toes:0,pole:[0.05,0,1]},legR:{pos:[-x,y,z],anchor:'ball',pitch,toes:0,pole:[-0.05,0,1]}});
// forearm hands: palms down on floor, elbows tucked back-down
const FA=(z)=>({armL:{pos:[0.12,0.04,z],contact:true,fingers:[0,0,1],palm:[0,-1,0],curl:0,pole:[0.1,-0.4,-1]},armR:{pos:[-0.12,0.04,z],contact:true,fingers:[0,0,1],palm:[0,-1,0],curl:0,pole:[-0.1,-0.4,-1]}});
const dd=(rz,ry,p)=>({root:{pos:[0,ry,rz],pitch:p},neck:{flex:-20},...hands(0.66),...F(-0.32,55)});
save('downward-dog',{az:72,el:6},['hamstrings'],{start:dd(0.09,0.91,139),end:dd(0.08,0.915,141)});
save('dolphin-pose',{az:72,el:6},['shoulders'],{
 start:{root:{pos:[0,0.82,-0.05],pitch:140},neck:{flex:-25},...FA(0.55),...F(-0.56,58)},
 end:{root:{pos:[0,0.84,-0.06],pitch:142},neck:{flex:-25},...FA(0.55),...F(-0.56,60)}});
save('butt-ups',{az:70,el:6},['abdominals'],{
 start:{root:{pos:[0,0.3,0],pitch:80},neck:{flex:-12},...FA(0.5),...F(-0.85,75,0.012,0.1)},
 end:{root:{pos:[0,0.5,-0.05],pitch:105},neck:{flex:-20},spine:{flex:12},...FA(0.5),...F(-0.85,75,0.012,0.1)}});
save('inchworm',{az:72,el:8},['hamstrings'],{
 start:{root:{pos:[0,0.8,0.1],pitch:125},neck:{flex:-10},...hands(0.45),legL:{pos:[0.1,0,-0.2],anchor:'sole',pitch:0,pole:[0,0,1]},legR:{pos:[-0.1,0,-0.2],anchor:'sole',pitch:0,pole:[0,0,1]}},
 mid:{root:{pos:[0,0.68,-0.12],pitch:106},neck:{flex:-15},...hands(0.62),legL:{pos:[0.1,0,-0.2],anchor:'sole',pitch:8,pole:[0,0,1]},legR:{pos:[-0.1,0,-0.2],anchor:'sole',pitch:8,pole:[0,0,1]}},
 mid2:{root:{pos:[0,0.55,-0.05],pitch:92},neck:{flex:-12},...hands(0.49),legL:{pos:[0.1,0,-0.55],anchor:'ball',pitch:55,toes:0,pole:[0,0,1]},legR:{pos:[-0.1,0,-0.55],anchor:'ball',pitch:55,toes:0,pole:[0,0,1]}},
 end:{root:{pos:[0,0.43,0],pitch:68},neck:{flex:-10},...hands(0.47),...F(-0.81,60)}.constructor===Object?{root:{pos:[0,0.43,0],pitch:68},neck:{flex:-10},...hands(0.49),legL:{pos:[0.09,0,-0.81],anchor:'ball',pitch:60,toes:0},legR:{pos:[-0.09,0,-0.81],anchor:'ball',pitch:60,toes:0}}:0});
const sp=(k)=>({root:{pos:[0,0.3,0],pitch:78},neck:{flex:-10},...hands(0.5,[0.9,0.2,-0.5],0.3),legL:k?{pos:[0.3,0.2,0.2],anchor:'ball',pitch:80,toes:0,pole:[0.3,0.5,1]}:{pos:[0.09,0,-0.84],anchor:'ball',pitch:70,toes:0},legR:{pos:[-0.09,0,-0.84],anchor:'ball',pitch:70,toes:0}});
save('spider-crawl',{az:50,el:20},['abdominals'],{start:sp(0),end:sp(1)},{muscleSide:'L'});
const gr=(i)=>i?{root:{pos:[0,+(process.env.RY2||0.66),+(process.env.RZ2||0)],pitch:+(process.env.RP2||85)},neck:{flex:-5},...hands(+(process.env.HZ||0.5),[0.55,0.35,-0.75],0.2),legL:{pos:[+(process.env.FX||0.36),0,+(process.env.FZ||0.3)],anchor:'ball',toes:0,pitch:+(process.env.EP||15),pole:[+(process.env.QX||0.3),+(process.env.QY||0.3),+(process.env.QZ||1)]},legR:{pos:[-(process.env.FX||0.36),0,+(process.env.FZ||0.3)],anchor:'ball',toes:0,pitch:+(process.env.EP||15),pole:[-(process.env.QX||0.3),+(process.env.QY||0.3),+(process.env.QZ||1)]}}:{root:{pos:[0,0.43,0],pitch:68},neck:{flex:-20},...hands(+(process.env.HZ||0.5),[0.55,0.35,-0.75],0.2),...F(-0.81,60)};
const E=process.env;
const gmid={root:{pos:[0,+(E.MY||0.62),+(E.MZ||-0.1)],pitch:+(E.MP||85)},neck:{flex:-10},...hands(+(process.env.HZ||0.5),[0.55,0.35,-0.75],0.2),
 legL:{pos:[0.3,+(E.MFY||0.18),+(E.MFZ||-0.25)],anchor:'ball',pitch:+(E.MFP||35),toes:0,pole:[0.5,0.3,1]},legR:{pos:[-0.3,+(E.MFY||0.18),+(E.MFZ||-0.25)],anchor:'ball',pitch:+(E.MFP||35),toes:0,pole:[-0.5,0.3,1]}};
save('groiners',{az:60,el:10},['adductors'],{start:gr(0),end:gr(1)});
const PZ=+(process.env.PZ||0.5);
const pl=(po)=>{const a=H(1,PZ,[0,0,0],0.2),b=H(-1,PZ,[0,0,0],0.2);if(po){a.pole=[0.55,0.35,-0.75];b.pole=[-0.55,0.35,-0.75];}else{delete a.pole;delete b.pole;}return {armL:a,armR:b};};
const fw=(sg,y,z)=>({pos:[sg*0.22,y,z],fingers:[sg*0.06,-0.3,0.95],palm:[0,-0.95,-0.3],curl:0.1,pole:[sg*0.7,0,-0.2],contact:true});
const bl=(z,y,pt,sg,x=0.09)=>({pos:[sg*x,y,z],anchor:'ball',pitch:pt,toes:0,pole:[z>-0.7?sg*+(process.env.PX||0.5):sg*0.1,z>-0.7?+(process.env.PY||0):-0.15,1]});
const mcF=(r,lz,ly,lp,rz,ry,rp)=>({root:r,neck:{flex:-10},...pl(),legL:bl(lz,ly,lp,1),legR:bl(rz,ry,rp,-1)});
save('mountain-climbers',{az:66,el:7},['quadriceps','abdominals'],{
 start:mcF({pos:[0,0.43,0],pitch:68},-0.1,0,62,-0.81,0,60),
 mid:mcF({pos:[0,+(process.env.RY||0.43),0],pitch:68},(+process.env.LZ||-0.55),+(process.env.LY||0.12),(+process.env.LP||90),-0.81,0,60),
 mid2:mcF({pos:[0,+(process.env.RY||0.43),0],pitch:68},-0.81,0,60,(+process.env.LZ||-0.55),+(process.env.LY||0.12),(+process.env.LP||90)),
 end:mcF({pos:[0,0.43,0],pitch:68},-0.81,0,60,-0.1,0,62)},{});
const hd=(z)=>pl();
const fold=()=>({root:{pos:[0,0.8,0.1],pitch:125},neck:{flex:-10},...pl(1),legL:{pos:[0.1,0,-0.2],anchor:'sole',pitch:0,pole:[0,0,1]},legR:{pos:[-0.1,0,-0.2],anchor:'sole',pitch:0,pole:[0,0,1]}});
save('step-back-burpee',{az:66,el:6},['quadriceps','chest','abdominals'],{
 start:{root:{pos:[0,0.925,-0.2]},armL:{pos:[0.22,2,-0.15],fingers:[0,1,0],palm:[0,0,1],curl:0.15,pole:[0.7,0,-0.2],contact:true},armR:{pos:[-0.22,2,-0.15],fingers:[0,1,0],palm:[0,0,1],curl:0.15,pole:[-0.7,0,-0.2],contact:true},legL:{pos:[0.1,0,-0.2],anchor:'sole',pitch:0,pole:[0,0,1]},legR:{pos:[-0.1,0,-0.2],anchor:'sole',pitch:0,pole:[0,0,1]}},
 mid0:{root:{pos:[0,0.93,-0.15],pitch:20},neck:{flex:-4},armL:{pos:[0.22,1.5,0.1],fingers:[0.03,0.6,0.8],palm:[0,-0.8,0.6],curl:0.12,pole:[0.7,0,-0.2],contact:true},armR:{pos:[-0.22,1.5,0.1],fingers:[-0.03,0.6,0.8],palm:[0,-0.8,0.6],curl:0.12,pole:[-0.7,0,-0.2],contact:true},legL:{pos:[0.1,0,-0.2],anchor:'sole',pitch:0,pole:[0,0,1]},legR:{pos:[-0.1,0,-0.2],anchor:'sole',pitch:0,pole:[0,0,1]}},
 mid:{root:{pos:[0,0.9,-0.1],pitch:40},neck:{flex:-8},armL:{...fw(1,1.0,0.5),pole:[0.55,0.35,-0.75]},armR:{...fw(-1,1.0,0.5),pole:[-0.55,0.35,-0.75]},legL:{pos:[0.1,0,-0.2],anchor:'sole',pitch:0,pole:[0,0,1]},legR:{pos:[-0.1,0,-0.2],anchor:'sole',pitch:0,pole:[0,0,1]}},
 mid2:fold(),
 mid3:{root:{pos:[0,0.43,0],pitch:68},neck:{flex:-10},...pl(1),legL:bl(-0.6,0.09,64,1),legR:bl(-0.81,0,60,-1)},
 end:mcF({pos:[0,0.43,0],pitch:68},-0.81,0,60,-0.81,0,60)},{});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
