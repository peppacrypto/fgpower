import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const rd=s=>JSON.parse(fs.readFileSync(W+s+'.json','utf8'));
const out={};
for(const s of ['plank','side-bridge','side-plank-hip-dip','side-lying-hip-abduction'])out[s]=rd(s);
// side plank + top leg up
const sb=rd('side-bridge');const mk=(y,x)=>{const f=JSON.parse(JSON.stringify(sb.frames.start));f.legL={pos:[x,y,-0.78+ (y>0.3?0.1:0)],anchor:'ankle',yaw:90,roll:76,pole:[1,0,0]};return f;};
out['side-plank-hip-abduction']={...sb,slug:'side-plank-hip-abduction',muscles:['abductors','glutes'],camera:{az:70,el:10},frames:{start:mk(0.175,0),end:mk(0.52,0.12)}};
// push-up to side plank
const cp=rd('clock-push-up').frames.start;
const arm=(x)=>({pos:[x,0,0.5],hand:'flat',contact:true,fingers:[0,0,1],palm:[0,-1,0],spread:1,pole:[x*2.7,0.55,-0.45]});
const leg=(x,y,z)=>({pos:[x,y,z],anchor:'ball',pitch:76,toes:0});
const top={root:{pos:[0,0.42,0.05],pitch:72},neck:{flex:-14},armL:{...arm(0.27),pos:[0.27,0,0.5]},armR:{...arm(-0.27),pos:[-0.27,0,0.5]},legL:leg(0.1,0,-0.8),legR:leg(-0.1,0,-0.8)};
const down={...cp};
const end={root:{pos:[0,0.5,0.05],yaw:90,roll:78},neck:{side:-6},spine:{flex:3},armR:{pos:[0.1,0,0.52],hand:'flat',contact:true,fingers:[1,0,0],palm:[0,-1,0],spread:1,pole:[-1,0.2,0]},armL:{pos:[0.2,1.05,0.5],hand:'open',fingers:[0,1,0],palm:[-1,0,0],pole:[1,0.3,0]},legL:{pos:[0,0.14,-0.72],anchor:'ankle',yaw:90,roll:76,pole:[1,0,0]},legR:{pos:[0,0.06,-0.72],anchor:'ankle',yaw:90,roll:76,pole:[1,0,0]}};
const pf={mid2:{root:{pos:[0,0.48,0.05],yaw:72,roll:64},neck:{side:-5},armR:{pos:[0.04,0,0.515],hand:'flat',contact:true,fingers:[0.9,0,0.45],palm:[0,-1,0],spread:1,pole:[-1,0.2,0]},armL:{pos:[0.22,0.85,0.5],hand:'open',fingers:[0,1,0],palm:[-1,0,0],pole:[1,0.3,0]},legL:{pos:[0,0.1,-0.73],anchor:'ankle',yaw:72,roll:64,pole:[1,0,0]},legR:{pos:[0,0.05,-0.73],anchor:'ankle',yaw:72,roll:64,pole:[1,0,0]}}};
end.legL.pos=[0.03,0.155,-0.70];end.legR.pos=[-0.03,0.06,-0.70];end.legR.pole=[1,-0.4,0];end.legL.pole=[1,0.2,0];
const m2={root:{pos:[0,0.36,0.05],yaw:55,roll:55,pitch:50},neck:{side:-4,flex:-8},armR:{pos:[0.1,0,0.52],hand:'flat',contact:true,fingers:[0.5,0,0.87],palm:[0,-1,0],spread:1,pole:[-1,0.3,-0.1]},armL:{pos:[0.24,0.6,0.5],hand:'open',fingers:[0,0.5,0.85],palm:[-0.15,-0.95,0.15],pole:[0.9,0.4,-0.2]},legL:{pos:[0.05,0.16,-0.74],anchor:'ankle',yaw:55,roll:55,pole:[1,0,0]},legR:{pos:[-0.05,0.08,-0.72],anchor:'ankle',yaw:55,roll:55,pole:[1,-0.4,0]}};
out['push-up-to-side-plank']={slug:'push-up-to-side-plank',camera:{az:40,el:10},muscles:['chest','obliques'],floats:true,frames:{start:down,mid:top,mid2:m2,end}};
// repairs (absolute values: the generator re-reads its own output)
const P=(f,l,v)=>{f[l].pos=v;};
const sbs=out['side-bridge'].frames.start;sbs.root.pos[1]=0.384;sbs.armL.pos=[0.2,0.2,0.04];sbs.armL.pos=[0.2,0.2,0.04];
P(sbs,"legL",[0,0.158,-0.795]);P(sbs,'legR',[0,0.06,-0.788]);
const sa=out['side-plank-hip-abduction'].frames;
for(const f of Object.values(sa)){f.root.pos[1]=0.384;f.armL.pos=[0.2,0.2,0.04];f.legR.pos=[0,0.06,-0.788];f.legL.pos[2]+=0;}
for(const f of Object.values(out['side-lying-hip-abduction'].frames))if(f.armR){f.armR.pole=[0.6,1,0];f.armR.palm=[-0.5,-0.85,0];}
const dp=out['side-plank-hip-dip'].frames;
for(const f of Object.values(dp))f.armL.pos=[0.2,0.2,0.04];
dp.start.spine={...dp.start.spine,side:28,flex:-15};dp.start.root.pos[1]=0.235;dp.start.neck={side:-40,flex:-30};dp.start.root.roll=78;dp.start.armL.fingers=[0,0.2,1];
dp.end.legL.pos=[0,0.175,-0.80];dp.end.legR.pos=[0,0.06,-0.765];
dp.mid=JSON.parse(JSON.stringify(dp.end));dp.mid.root.pos[1]=0.34;dp.mid.spine={side:4};dp.mid.neck={side:0};
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
