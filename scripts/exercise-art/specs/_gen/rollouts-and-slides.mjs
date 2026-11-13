import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const rd=s=>JSON.parse(fs.readFileSync(W+s+'.json','utf8'));
const cp=o=>JSON.parse(JSON.stringify(o));
const out={};
// keep the three towel specs as they are (they already have good specs)
for(const s of ['kneeling-towel-rollout','kneeling-towel-chest-slide','towel-body-saw'])out[s]=rd(s);
const BY=0.115; // bar axle height with small plates
const grip=(side,x,y,z,pole)=>{const s=side==='L'?1:-1;return {pos:[s*x,y,z],hand:'grip',grip:0.014,fingers:[0,-0.5,0.87],palm:[0,-0.87,-0.5],pole:pole||[s*0.4,0.3,-1]};};
const tw=rd('kneeling-towel-rollout').frames;
const kneel=(src,hy,mk)=>{const f=cp(src);delete f.props;
 const z=src.armL.pos[2];
 for(const [k,s] of [['armL',1],['armR',-1]])f[k]=mk(s,z,hy,src[k]);
 return f;};
// ---- kneeling rollouts
const barArm=(s,z,hy)=>({pos:[s*0.2,hy,z],hand:'grip',grip:0.014,fingers:[0,-0.5,0.87],palm:[0,-0.87,-0.5],pole:[s*0.5,0.1,-1]});
const wheelArm=(s,z,hy)=>({pos:[s*0.115,hy,z],fingers:[0,-0.4983,0.867],palm:[0,-0.867,-0.4983],curl:0.8,pole:[s*0.6,0.1,-0.8]});
const build=(slug,prop,mk,hy,muscles)=>{const fr={};
 for(const k of ['start','mid','mid2','mid3','end'])if(tw[k]){fr[k]=kneel(tw[k],hy,mk);fr[k].root=cp(tw[k].root);fr[k].root.pos[1]+=0.02;for(const l of ['legL','legR']){fr[k][l].pitch=150;fr[k][l].pos[1]=0.06;}if(slug==='ab-roller'&&k==='end'){fr[k].armL.pos[2]-=0.03;fr[k].armR.pos[2]-=0.03;}}
 out[slug]={slug,camera:{az:70,el:8},muscles,props:[prop],frames:fr};};
build('barbell-ab-rollout-on-knees',{type:'barbell',hands:true,plates:[2.5]},barArm,BY,['abdominals','lats']);
build('ab-roller',{type:'ab-wheel',hands:true,radius:0.09},wheelArm,0.1409,['abdominals','lats']);
// ---- barbell rollout from toes: plank (bar out front) -> hips up, bar rolls to feet
const wh=rd('_gallery/ab-wheel').frames;
const toes=(src,z,pole)=>{const f=cp(src);for(const [k,s] of [['armL',1],['armR',-1]])f[k]={pos:[s*0.2,BY,z],hand:'grip',grip:0.014,fingers:[0,-0.5,0.87],palm:[0,-0.87,-0.5],pole:[s*0.15,0.1,-0.5]};return f;};
out['barbell-ab-rollout']={slug:'barbell-ab-rollout',camera:{az:70,el:8},muscles:['abdominals','lats'],props:[{type:'barbell',hands:true,plates:[2.5]}],
 frames:{start:toes(wh.end,0.9916),mid0:toes(wh.start,0.78),mid:toes(wh.start,0.55),end:toes(wh.start,0.1716)}};
const b0=out['barbell-ab-rollout'].frames.mid0;b0.root={pos:[0,0.36,-0.04],pitch:73};b0.spine={flex:7};b0.neck={flex:-25};
const bm=out['barbell-ab-rollout'].frames.mid;bm.root={pos:[0,0.43,-0.1],pitch:68};bm.spine={flex:10};bm.neck={flex:-22};

// ---- barbell rollout from bench
const bg=(hz,pole)=>({L:{pos:[0.2,BY,hz],hand:'grip',grip:0.014,fingers:[0,-0.5,0.87],palm:[0,-0.87,-0.5],pole:pole||[0.5,0.1,-1]},R:{pos:[-0.2,BY,hz],hand:'grip',grip:0.014,fingers:[0,-0.5,0.87],palm:[0,-0.87,-0.5],pole:[-(pole?pole[0]:0.5),0.1,-1]}});
const bf=(rootPos,pitch,hz,flex,neck)=>{const g=bg(hz);return {root:{pos:rootPos,pitch},spine:{flex},neck:{flex:neck},armL:g.L,armR:g.R,
 legL:{pos:[0.1,0.52,0.06],anchor:'ankle',pitch:150,pole:[0,-1,0.3]},legR:{pos:[-0.1,0.52,0.06],anchor:'ankle',pitch:150,pole:[0,-1,0.05]}};};
out['barbell-rollout-from-bench']={slug:'barbell-rollout-from-bench',camera:{az:70,el:8},muscles:['abdominals','lats'],floats:true,
 props:[{type:'flat-bench',height:0.32},{type:'barbell',hands:true,plates:[2.5]}],
 frames:{start:bf([0,0.8,0.42],121,0.78,0,-10),mid:bf([0,0.9,0.5],110,0.98,0,-14),mid2:bf([0,0.84,0.72],104,1.25,3,-16),end:bf([0,0.64,0.9],80,1.5,2,-18)}};
// ---- bodyweight flyes on two rolling EZ bars
const fly=(hx,rootY,rz)=>{const arm=s=>({pos:[s*hx,0.03,0.5],hand:'grip',grip:0.014,fingers:[s,0,0],palm:[0,-1,0],pole:[s*(0.6+hx),0.3,-0.3]});
 const leg=s=>({pos:[s*0.1,0,-0.8],anchor:'ball',pitch:76,toes:0});
 return {props:[{type:'ez-bar',pos:[hx,0,0.5],yaw:90,plates:[]},{type:'ez-bar',pos:[-hx,0,0.5],yaw:90,plates:[]}],root:{pos:[0,rootY,rz],pitch:72},neck:{flex:-14},armL:arm(1),armR:arm(-1),legL:leg(1),legR:leg(-1)};};
out['bodyweight-flyes']={slug:'bodyweight-flyes',camera:{az:30,el:14},muscles:['chest'],frames:{start:fly(0.22,0.42,0.05),end:fly(0.55,0.27,0.07)}};

// ---- repairs of the three towel specs (the generator re-reads its own output: all values absolute)
{const t=out['kneeling-towel-rollout'].frames;
 if(t.mid3){t.end=t.mid3;delete t.mid3;}
 for(const f of Object.values(t))for(const l of ['legL','legR']){f[l].pitch=150;f[l].pos[1]=0.06;}
 const c=out['kneeling-towel-chest-slide'].frames;
 for(const f of Object.values(c)){for(const l of ['legL','legR']){f[l].pitch=158;f[l].pos[1]=0.07;}f.armL.pos[2]=0.44;}
 c.start.root.pos=[0,0.31,0.02];c.end.root.pos=[0,0.19,0.059];c.end.root.pitch=88;for(const l of ['legL','legR'])c.end[l].pos[1]=0.15;
 const b=out['towel-body-saw'].frames;
 delete b.mid;
 b.start.root.pos=[0,0.33,-0.177];b.end.root.pos=[0,0.285,-0.39];
 for(const l of ['legL','legR']){b.start[l].pos[2]=-1.0;b.end[l].pos[2]=-1.24;}
 b.start.props[0].pos[2]=-0.985;b.end.props[0].pos[2]=-1.225;
}
fs.writeFileSync(W+'_tmp.json','{}');fs.unlinkSync(W+'_tmp.json');
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
