import fs from 'fs';
const D='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const rd=s=>JSON.parse(fs.readFileSync(D+s+'.json','utf8'));
const cp=o=>JSON.parse(JSON.stringify(o));
const out={};
// keep proven specs as the base (rewritten for a stable generator)
const bw=rd('bodyweight-squat'), tempo=rd('tempo-squat'), wall=rd('wall-sissy-squat'), sit=rd('chair-sit-to-stand');
for(const k of ['start','end'])for(const [a,x,fx] of [['armL',0.06,-0.1],['armR',-0.06,0.1]]){const A=bw.frames[k][a];A.pos=[x,0.07,0.3];A.fingers=[fx,0.9,0.4];}
out['bodyweight-squat']=bw; out['tempo-squat']=tempo; out['wall-sissy-squat']=wall;wall.props[0].pos=[-0.325,0,0.1];for(const k of ['start','end']){const a=wall.frames[k].armR;a.pos=[-0.29,1,0.1];a.fingers=[-0.7,-0.71,0];a.pole=[-0.5,-1,-0.87];} out['chair-sit-to-stand']=sit;
// sit-squats: partial depth
const ss=cp(bw); ss.slug='sit-squats'; ss.muscles=['quadriceps'];
ss.frames.end.root={pos:[0,0.68,-0.12],pitch:20}; ss.frames.end.spine={flex:-4}; ss.frames.end.neck={flex:-8};for(const k of ['start','end'])for(const [a,x] of [['armL',0.07],['armR',-0.07]])ss.frames[k][a].pos[0]=x;
out['sit-squats']=ss;
const legs=(x,yaw,z=0.02)=>({legL:{pos:[x,0,z],anchor:'sole',yaw,pole:[0.4,0,1]},legR:{pos:[-x,0,z],anchor:'sole',yaw:-yaw,pole:[-0.4,0,1]}});
// chair pose: static, arms overhead
const up={fk:{flex:172,abd:6,elbow:4},curl:0.3};
out['chair-pose']={slug:'chair-pose',camera:{az:60,el:8},muscles:['quadriceps','glutes'],frames:{start:{
 root:{pos:[0,0.62,-0.2],pitch:30},spine:{flex:-6},neck:{flex:-12},armL:cp(up),armR:cp(up),...legs(0.1,4)}}};
// garland: deep squat, palms together, elbows on inner knees
const hands=(s)=>({pos:[s*0.035,0.04,0.25],rel:'chest',fingers:[-s*0.1,0.95,0.3],palm:[-s,0,0.05],pole:[s,-0.8,-0.2],curl:0.4});
out['garland-pose']={slug:'garland-pose',camera:{az:35,el:10},muscles:['adductors'],frames:{start:{
 root:{pos:[0,0.36,-0.12],pitch:38},spine:{flex:-8},neck:{flex:-14},armL:hands(1),armR:hands(-1),
 legL:{pos:[0.3,0,0.02],anchor:'sole',yaw:35,pole:[0.9,0,0.9]},legR:{pos:[-0.3,0,0.02],anchor:'sole',yaw:-35,pole:[-0.9,0,0.9]}}}};
// weighted sissy: wall-sissy with plate on chest + rack upright
const w=cp(wall); w.slug='weighted-sissy-squat';w.camera={az:40,el:8};
w.props=[{type:'power-rack',width:0.9,depth:0.5,pos:[0,0,0],frameIgnore:true},{type:'weight-plate',kg:10,follow:true,hand:'L'}];
for(const k of ['start','end']){const f=w.frames[k];f.armR.pos=[-0.44,1.1,0.37];f.armR.fingers=[0,-0.2,1];f.armR.palm=[1,0,0];f.armR.pole=[1,-0.8,0];
 f.armL={fk:{flex:70,abd:10,elbow:120},curl:0.5};}
out['weighted-sissy-squat']=w;
for(const [k,v] of Object.entries(out)){v.slug=k;fs.writeFileSync(D+k+'.json',JSON.stringify(v,null,1));}
console.log(Object.keys(out).join(' '));
