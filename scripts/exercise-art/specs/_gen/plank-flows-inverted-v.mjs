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
const gr=(i)=>i?{root:{pos:[0,0.55,0.0],pitch:95},neck:{flex:-5},...hands(0.47,[0.6,0.2,-0.6],0.2),legL:{pos:[0.36,0,0.2],anchor:'sole',pitch:0,pole:[0.5,0.3,1]},legR:{pos:[-0.36,0,0.2],anchor:'sole',pitch:0,pole:[-0.5,0.3,1]}}:{root:{pos:[0,0.43,0],pitch:68},neck:{flex:-20},...hands(0.47,[0.6,0.2,-0.6],0.2),...F(-0.81,60)};
save('groiners',{az:60,el:10},['adductors'],{start:gr(0),end:gr(1)});
for(const s of ['mountain-climbers','step-back-burpee']){const j=JSON.parse(fs.readFileSync(W+s+'.json'));out[s]=j;}
for(const f of Object.values(out.__p||{}));
{const sb=out['step-back-burpee'].frames;
for(const a of ['armL','armR'])sb.start[a].pos[1]=2.0;
{const m=sb.mid2;m.root.pos=[0,0.59,-0.06];m.root.pitch=88;delete sb.mid2b;
 for(const [l,sg] of [['legL',1],['legR',-1]]){m[l].pos=[sg*0.1,0,0.15];m[l].pitch=0;m[l].pole=[sg*0.25,0,1];}
 sb.mid3.legL.pole=[0.1,0,1];sb.mid3.legL.pitch=64;}
delete sb.mid2b;
for(const [l,sg] of [['legL',1],['legR',-1]]){sb.mid2[l].pole=[sg*0.45,0,1];}
sb.mid2.root.pos=[0,0.59,-0.06];
const mc=out['mountain-climbers'];
for(const [fk,f] of Object.entries(mc.frames)){for(const a of ['armL','armR'])f[a].pos[2]=0.5;
 if(fk==='mid'||fk==='mid2'){for(const l of ['legL','legR']){const q=f[l];q.pitch=Math.max(q.pitch,75);q.pos[1]=Math.max(q.pos[1],0.1);q.pole[1]=-0.15;if(q.pos[2]>-0.5){q.pos[1]=0.3;q.pitch=90;q.pole[1]=-0.1;q.pos[0]*=1.9;}else q.pos[1]=0.17;}}}}
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
