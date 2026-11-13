import fs from 'fs';
const D='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const cp=o=>JSON.parse(JSON.stringify(o));
const base=JSON.parse(fs.readFileSync(D+'freehand-jump-squat.json','utf8'));
const out={};
const AIR=1.225;
const mk=(slug,muscles,cam,frames)=>{out[slug]={slug,camera:cam,muscles,floats:true,frames};};
const sq=cp(base.frames.start), jmp=cp(base.frames.end);
const fkArm=(flex,abd,elbow,rot=0)=>({fk:{flex,abd,rot,elbow},rel:'chest',curl:0.3});
const arms=(a)=>({armL:cp(a),armR:cp(a)});
const side=(flex,abd,elbow)=>({armL:fkArm(flex,abd,elbow),armR:fkArm(flex,abd,elbow)});
const legsAir=(x,y,z,yaw=8)=>({legL:{pos:[x,y,z],anchor:'ball',pitch:55,yaw,pole:[0.3,0,1]},legR:{pos:[-x,y,z],anchor:'ball',pitch:55,yaw:-yaw,pole:[-0.3,0,1]}});
// freehand
const xa=(a,z)=>({fk:{flex:50+z,abd:a,rot:0,elbow:135},rel:'chest',hand:'relaxed'});
for(const f of [sq,jmp]){f.armL=xa(-25,0);f.armR=xa(-25,8);}
mk('freehand-jump-squat',['quadriceps'],{az:50,el:8},{start:sq,end:jmp});
// rocket
{const s=cp(sq),e=cp(jmp);s.root={pos:[0,0.62,-0.15],pitch:25};s.spine={flex:-4};Object.assign(s,side(-20,25,10));
 Object.assign(e,arms(fkArm(172,6,4)));e.root={pos:[0,AIR,0.0],pitch:0};
 mk('rocket-jump',['quadriceps'],{az:40,el:8},{start:s,end:e});}
// star
{const s=cp(sq);s.root={pos:[0,0.62,-0.15],pitch:25};Object.assign(s,side(0,12,8));
 const e=cp(jmp);e.root={pos:[0,AIR,0],pitch:0};Object.assign(e,legsAir(0.4,0.3,0,40));
 e.legL.pole=[0.8,0,0.6];e.legR.pole=[-0.8,0,0.6];
 Object.assign(e,side(0,150,6));
 mk('star-jump',['quadriceps'],{az:25,el:8},{start:s,end:e});}
// knee tuck
{const hands=(x)=>({pos:[x,0.12,0.42],rel:'chest',fingers:[0,0,1],palm:[0,-1,0],hand:'flat',pole:[x*4,-1,-0.3]});
 const s=cp(sq);s.root={pos:[0,0.72,-0.1],pitch:20};s.spine={flex:-4};s.armL=hands(0.06);s.armR=hands(-0.06);
 const e=cp(jmp);e.root={pos:[0,AIR,0],pitch:5};e.armL=hands(0.06);e.armR=hands(-0.06);
 e.legL={pos:[0.11,1.0,0.3],anchor:'ankle',pole:[0.1,0.3,1]};e.legR={pos:[-0.11,1.0,0.3],anchor:'ankle',pole:[-0.1,0.3,1]};
 mk('knee-tuck-jump',['hamstrings'],{az:70,el:6},{start:s,end:e});}
// butt kick
{const s=cp(sq);s.root={pos:[0,0.72,-0.1],pitch:20};Object.assign(s,side(15,12,40));
 const e=cp(jmp);e.root={pos:[0,AIR,0],pitch:0};Object.assign(e,side(10,12,40));
 e.legL={pos:[0.11,1.0,-0.3],anchor:'ankle',pitch:70,pole:[0.1,-0.3,1]};e.legR={pos:[-0.11,1.0,-0.3],anchor:'ankle',pitch:70,pole:[-0.1,-0.3,1]};
 mk('double-leg-butt-kick',['quadriceps'],{az:90,el:6},{start:s,end:e});}
// frog hops
{const head=(sg)=>({fk:{flex:40,abd:85,rot:0,elbow:140},rel:'chest',curl:0.4});
 const s=cp(sq);Object.assign(s,{armL:head(1),armR:head(-1)});
 const e=cp(jmp);e.root.pos=[0,1.1,0.5];Object.assign(e,{armL:head(1),armR:head(-1)});
 for(const l of ['legL','legR'])e[l].pos[2]=0.55;
 // take-off: straight up first (feet leave the floor on the spot), then forward
 const m=cp(jmp);m.root.pos=[0,1.0,0.0];Object.assign(m,{armL:head(1),armR:head(-1)});
 for(const l of ['legL','legR'])m[l].pos[2]=s[l].pos[2];
 mk('frog-hops',['quadriceps'],{az:90,el:6},{start:s,mid:m,end:e});}
// lunge family
const lunge=(front)=>{const f=front==='L'?1:-1;const F=front==='L'?'legL':'legR',B=front==='L'?'legR':'legL';
 const r={root:{pos:[0,0.6,0],pitch:0},spine:{flex:0},...side(15,12,40)};
 r[F]={pos:[0.11*f,0,0.42],anchor:'sole',pole:[0,0,1]};
 r[B]={pos:[-0.11*f,0.03,-0.55],anchor:'ball',pitch:55,pole:[0,-0.3,1]};return r;};
const airT=()=>{const e={root:{pos:[0,AIR,0],pitch:0},...side(50,12,60)};
 e.legL={pos:[0.1,0.45,0.05],anchor:'ankle',pitch:20,pole:[0.1,0,1]};e.legR={pos:[-0.1,0.45,0.05],anchor:'ankle',pitch:20,pole:[-0.1,0,1]};return e;};
const airS=()=>{const e={root:{pos:[0,AIR,0],pitch:0},...side(50,12,60)};
 e.legL={pos:[0.11,0.5,0.3],anchor:'ankle',pole:[0.1,0,1]};e.legR={pos:[-0.11,0.5,-0.3],anchor:'ankle',pole:[-0.1,0,1]};return e;};
mk('scissors-jump',['quadriceps'],{az:90,el:6},{start:lunge('L'),mid:airS(),end:lunge('R')});
mk('split-jump',['quadriceps'],{az:90,el:6},{start:lunge('L'),mid:airT(),end:lunge('L')});
mk('split-squats',['quadriceps'],{az:90,el:6},{start:lunge('L'),mid:airS(),end:lunge('R')});
{const ZF=0.34,ZB=-0.45;const fix=(fr,f)=>{const F=f==='L'?'legL':'legR',B=f==='L'?'legR':'legL';fr[F].pos[2]=ZF;fr[B].pos[2]=ZB;};
 const tall=(f)=>{const t=lunge(f);t.root.pos=[0,0.88,0];const F=f==='L'?'legL':'legR',B=f==='L'?'legR':'legL';t[F].pos[2]=ZF;t[B].pos[2]=ZB;return t;};
 const o=out['split-squats'].frames;
 fix(o.start,'L');fix(o.end,'R');
 out['split-squats'].frames={start:tall('L'),mid:o.start,mid2:o.mid,mid3:o.end,end:tall('R')};}
out['split-squats'].muscles=['hamstrings','quadriceps'];
for(const [k,v] of Object.entries(out))fs.writeFileSync(D+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).map(k=>'specs/'+k+'.json').join(' '));
