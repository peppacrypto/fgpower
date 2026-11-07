import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,frames,more={})=>{out[slug]={slug,camera,muscles:['spinal-erectors'],frames,...more};};
const legs=(fl=6,pitch=62,knee=0)=>({legL:{fk:{flex:fl,abd:3,knee},foot:{pitch}},legR:{fk:{flex:fl,abd:3,knee},foot:{pitch}}});
const R=(p,v=1)=>[v*p[0],p[1],p[2]];
const flat=(x,y,z,f=[0,0,1],po=[0.4,0.3,-1])=>({
 armL:{pos:[x,y,z],contact:true,hand:'flat',fingers:R(f),palm:[0,-1,0],pole:R(po),rel:'world'},
 armR:{pos:[-x,y,z],contact:true,hand:'flat',fingers:R(f,-1),palm:[0,-1,0],pole:R(po,-1),rel:'world'}});
const base=(pitch=90,y=0.178)=>({root:{pos:[0,y,0],pitch}});
const cam={az:80,el:12};
// cobra
save('cobra-pose',cam,{
 start:{...base(),neck:{flex:0},...flat(0.2,0.02,0.4),...legs()},
 end:{...base(92),spine:{flex:-30},neck:{flex:-8},...flat(0.2,0.02,0.4),...legs()}});
// sphinx: forearms
const fore=()=>flat(0.22,0.03,0.58,[-0.3,0,1],[1,0.3,-0.4]);
save('sphinx-pose',cam,{
 start:{...base(),...fore(),...legs()},
 end:{...base(92),spine:{flex:-22},neck:{flex:-6},...fore(),...legs()}});
// upward dog: arms straight, thighs up, feet tops on floor
save('upward-dog',cam,{
 start:{...base(),...flat(0.22,0.02,0.45,[0,0,1],[0.3,0,-1]),...legs()},
 end:{root:{pos:[0,0.3,0],pitch:80},spine:{flex:-34},neck:{flex:-10},...flat(0.22,0.02,0.45,[0,0,1],[0.3,0,-1]),...legs(-12,74)}});
// camel
const kn={legL:{fk:{flex:0,abd:3,knee:90},foot:{pitch:78}},legR:{fk:{flex:0,abd:3,knee:90},foot:{pitch:78}}};
const lb={armL:{pos:[0.17,0.66,-0.15],rel:'world',hand:'flat',contact:false,fingers:[0.15,-1,0],palm:[-0.8,0,0.5],pole:[1,0,-0.3]},armR:{pos:[-0.17,0.66,-0.15],rel:'world',hand:'flat',contact:false,fingers:[-0.15,-1,0],palm:[0.8,0,0.5],pole:[-1,0,-0.3]}};
save('camel-pose',{az:90,el:8},{
 start:{root:{pos:[0,0.5,0],pitch:0},...lb,...kn},
 end:{root:{pos:[0,0.54,0.06],pitch:-8},spine:{flex:-25},neck:{flex:-15},...lb,...kn}});
// overhead arms
const over={armL:{fk:{flex:170,abd:12,elbow:6},pron:-30,curl:0.3},armR:{fk:{flex:170,abd:12,elbow:6},pron:-30,curl:0.3}};
save('arch-body-hold',{az:125,el:16},{
 start:{...base(),neck:{flex:-4},...over,...legs()},
 end:{...base(92,0.15),spine:{flex:-26},neck:{flex:-6},...over,...legs(-16,60)}});
// locust: arms along body
const side=(f)=>({armL:{fk:{flex:f,abd:8,elbow:0},pron:90,curl:0.2},armR:{fk:{flex:f,abd:8,elbow:0},pron:90,curl:0.2}});
save('locust-pose',{az:125,el:16},{
 start:{...base(),neck:{flex:-2},...side(-5),...legs()},
 end:{...base(92,0.15),spine:{flex:-24},neck:{flex:-6},...side(-35),...legs(-18,60)}});
// bow: knees bent, hands hold ankles
const bowL=(lift)=>({legL:{fk:{flex:lift,abd:5,knee:150},foot:{pitch:40}},legR:{fk:{flex:lift,abd:5,knee:150},foot:{pitch:40}}});
const bowA={armL:{pos:[0.13,0.41,0.04],rel:'world',hand:'grip',fingers:[0,0,-1],palm:[-1,0,0],pole:[0.5,1,0]},armR:{pos:[-0.13,0.41,0.04],rel:'world',hand:'grip',fingers:[0,0,-1],palm:[1,0,0],pole:[-0.5,1,0]}};
const bowE=JSON.parse(JSON.stringify(bowA));bowE.armL.pos=[0.12,0.46,0.05];bowE.armR.pos=[-0.12,0.46,0.05];
save('bow-pose',cam,{
 start:{...base(),...bowA,...bowL(0)},
 end:{...base(92,0.15),spine:{flex:-35},neck:{flex:-12},...bowE,...bowL(-25)}});
// lower back curl: untouched arms out
for(const k of ['lower-back-curl','superman']){const o=JSON.parse(fs.readFileSync(W+'_gen/orig/'+k+'.json','utf8'));
 for(const f of Object.values(o.frames))if(f.root)f.root.pos[1]+=(f===o.frames.start?(k==="superman"?0.02:0.03):(k==='superman'?-0.017:(k==='lower-back-curl'?0.015:0)));
 if(k==='lower-back-curl')for(const f of Object.values(o.frames))for(const a of ['armL','armR'])if(f[a]){f[a].pos[0]*=0.92;f[a].pos[2]*=0.92;}
 out[k]=o;}
for(const k of ['arch-body-hold','locust-pose','bow-pose']){const m=JSON.parse(JSON.stringify(out[k].frames.end));m.root.pos[1]=0.14;m.root.pitch=91;if(m.spine)m.spine.flex*=0.5;if(m.neck)m.neck.flex*=0.5;if(k==='bow-pose'){const [MX,MY,MZ]=(process.env.MP||'0.16,0.42,0.12').split(',').map(Number);m.armL.pos=[MX,MY,MZ];m.armR.pos=[-MX,MY,MZ];}out[k].frames.mid=m;}
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
