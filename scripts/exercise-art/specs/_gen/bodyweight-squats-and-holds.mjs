import fs from 'fs';
const D='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const rd=s=>JSON.parse(fs.readFileSync(D+s+'.json','utf8'));
const cp=o=>JSON.parse(JSON.stringify(o));
const out={};
// keep proven specs as the base (rewritten for a stable generator)
const bw=rd('bodyweight-squat'), tempo=rd('tempo-squat'), wall=rd('wall-sissy-squat'), sit=rd('chair-sit-to-stand');
for(const k of ['start','end'])for(const [a,x,fx] of [['armL',0.06,-0.1],['armR',-0.06,0.1]]){const A=bw.frames[k][a];A.pos=[x,0.07,0.3];A.fingers=[fx,0.9,0.4];}
out['bodyweight-squat']=bw; out['tempo-squat']=tempo; out['wall-sissy-squat']=wall;wall.frames.end.root.pitch=-24;wall.props[0].pos=[-0.325,0,0.1];for(const k of ['start','end']){const a=wall.frames[k].armR;a.pos=[-0.29,1,0.1];a.fingers=[-0.7,-0.71,0];a.pole=[-0.5,-1,-0.87];}wall.frames.end.armR.pos=[-0.29,0.93,0.1];for(const k of ['start'])wall.frames[k].armR.pos=[-0.29,0.93,0.1]; out['chair-sit-to-stand']=sit;
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

// --- coach audit 2026-11-13 fixes ---
{ // bodyweight squat deeper
 bw.frames.end.root={pos:[0,0.40,-0.25],pitch:34};for(const a of ['armL','armR']){bw.frames.end[a].pos[2]=0.34;bw.frames.end[a].pos[1]=0.16;}
 // sit squats: near parallel, quick
 ss.frames.end.root={pos:[0,0.52,-0.2],pitch:30}; ss.muscles=['quadriceps','glutes']; ss.tempo={lift:'back'}; ss.timing={there:0.8,holdEnd:0,back:0.6,holdStart:0};
 // chair pose: arms vertical, trunk upright, subtle sink
 const up2={fk:{flex:180,abd:0,elbow:0},curl:0.3};
 const cpz=out['chair-pose']; cpz.muscles=['glutes','quadriceps']; cpz.camera={az:90,el:6};
 cpz.frames.start.root={pos:[0,0.66,-0.2],pitch:20}; cpz.frames.start.spine={flex:-4}; cpz.frames.start.neck={flex:-6};
 cpz.frames.start.armL=cp(up2); cpz.frames.start.armR=cp(up2);
 cpz.frames.end=cp(cpz.frames.start); cpz.frames.end.root={pos:[0,0.62,-0.23],pitch:23};
 // garland: enter from a high squat into the deep one, heels flat, knees wide
 const g=out['garland-pose']; g.muscles=['adductors','glutes']; g.camera={az:50,el:8};
 g.frames.end=cp(g.frames.start); g.frames.start.root={pos:[0,0.5,-0.08],pitch:30};
 for(const k of ['start','end']){g.frames[k].legL.pole=[1,0,0.8];g.frames[k].legR.pole=[-1,0,0.8];}
 // chair sit-to-stand: straight side view
 sit.camera={az:90,el:5};
 // wall sissy: frame in front of the hip, heels up, knees far forward
 wall.camera={az:90,el:4}; wall.props[0].pos=[-0.325,0,0.195];
 wall.frames.start.root={pos:[0.04,1,0.3],pitch:-2}; wall.frames.end.root={pos:[0.04,0.76,0.48],pitch:-28};
 for(const k of ['start','end']){const a=wall.frames[k].armR;a.hand='flat';a.contact=true;a.pos=[-0.29,0.93,0.18];a.fingers=[-0.7,-0.71,0];a.palm=[0,0,-1];a.pole=[-0.5,-1,-0.87];
  for(const l of ['legL','legR'])wall.frames[k][l].pos[2]=0.34;}
 for(const l of ['legL','legR']){wall.frames.start[l].pitch=45;wall.frames.end[l].pitch=62;}
}

// weighted sissy: wall-sissy with plate on chest + rack upright
const w=cp(wall); w.slug='weighted-sissy-squat';w.camera={az:40,el:8};
w.props=[{type:'power-rack',width:0.46,depth:0.7,pos:[-0.46,0,0.25],frameIgnore:true},{type:'weight-plate',kg:10,follow:true,hand:'L'}];
for(const k of ['start','end']){const f=w.frames[k];f.armR.pos=[-0.27,1.05,0.6];f.armR.hand='flat';f.armR.fingers=[0,0,1];f.armR.palm=[1,0,0];f.armR.pole=[-0.5,-1,-0.1];
 f.armL={fk:{flex:70,abd:10,elbow:120},curl:0.5};}
for(const k of ['start','end']){const f=w.frames[k];f.armR.pos=[-0.23,1.05,0.6];f.armR.hand='grip';f.armR.fingers=[-1,0,0];f.armR.palm=[0,0,1];f.armR.pole=[-1,-0.4,0];f.armR.grip=0.04;f.armR.pos=[-0.23,1.1,0.5];f.armR.pole=[-0.5,-1,-0.2];delete f.armR.contact;f.armL={fk:{flex:25,abd:12,elbow:105},curl:0.5};}
out['weighted-sissy-squat']=w;
for(const [k,v] of Object.entries(out)){v.slug=k;fs.writeFileSync(D+k+'.json',JSON.stringify(v,null,1));}
console.log(Object.keys(out).join(' '));
