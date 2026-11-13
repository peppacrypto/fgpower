import fs from 'fs';
const W=new URL('../',import.meta.url);
const C=(o)=>JSON.parse(JSON.stringify(o));
// world grip (deadlift family)
const gw=(s,x,y,z,o={})=>({pos:[x*s,y,z],hand:'grip',grip:0.014,fingers:[0,-1,0],palm:[0,0,-1],pole:[(o.px??0.9)*s,o.py??0,o.pz??0],scap:{elev:o.el??0,prot:0}});
// rack grip rel chest (front squat clean grip)
const ang=(d)=>{const r=d*Math.PI/180;return {f:[0,-Math.sin(r),-Math.cos(r)],p:[0,Math.cos(r),-Math.sin(r)]}};
const gc=(s,x=0.22,y=1.45,z=0.14,o={})=>({pos:[x*s,y,z],fingers:ang(o.a??48.6).f,palm:ang(o.a??48.6).p,hand:'grip',grip:0.014,pole:[(o.px??0.7)*s,o.py??0.4,o.pz??1],scap:{elev:0,prot:0.5}});
const gp=(s,x,y,z)=>({pos:[x*s,y,z],hand:'grip',grip:0.014,fingers:[0,-1,0],palm:[0,0,-1],pole:[1.0*s,0.3,0.0],scap:{elev:1,prot:0}});
// overhead grip
const go=(s,x,y,z,pl=[0.9,-0.35,-0.3])=>({pos:[x*s,y,z],hand:'grip',grip:0.014,fingers:ang(process.env.GO!==undefined?+process.env.GO:30).f,palm:ang(process.env.GO!==undefined?+process.env.GO:30).p,pole:[pl[0]*s,pl[1],pl[2]],scap:{elev:1,prot:0}});
const HA=(+process.env.HA||34)*Math.PI/180;
const gr=(s,y=1.45,z=0.13)=>({pos:[0.24*s,y,z],fingers:[0,0.1,-1],palm:[0,1,0.1],hand:'grip',grip:0.014,pole:[0.1*s,-0.2,1],scap:{elev:0,prot:0.5}});
const gh=(s,y,z,pl=[1,0.2,0],HA=34*Math.PI/180)=>({pos:[0.3*s,y,z],fingers:[0,Math.sin(HA),-Math.cos(HA)],palm:[0,Math.cos(HA),Math.sin(HA)],hand:'grip',grip:0.014,pole:[pl[0]*s,pl[1],pl[2]],scap:{elev:1,prot:0}});
const gm=(s,y,z,f,pl)=>({pos:[0.28*s,y,z],fingers:[0,Math.sin(f),-Math.cos(f)],palm:[0,Math.cos(f),Math.sin(f)],hand:'grip',grip:0.014,pole:[pl[0]*s,pl[1],pl[2]],scap:{elev:0.5,prot:0.2}});
const stance=(w=0.17,yaw=12,z=0.12,y=0,p=0)=>({legL:{pos:[w,y,z],anchor:'ball',yaw,pitch:p,pole:[w*1.8,0,1]},legR:{pos:[-w,y,z],anchor:'ball',yaw:-yaw,pitch:p,pole:[-w*1.8,0,1]}});
const toes=()=>stance(0.17,12,0.12,0,28);
const RL=process.env.ROLL;const F=(root,sp,nk,arms,legs)=>{const f={root,spine:{flex:sp},neck:{flex:nk},armL:arms(1),armR:arms(-1),...legs};if(RL!==undefined&&process.env.RF){f.armL.roll=+RL;f.armR.roll=-RL;}return f};
const X=0.33;
const wa=(y,z,o)=>s=>gw(s,X,y,z,o);
const air=()=>F({pos:[0,0.97,0],pitch:-1},0,-2,s=>gh(s,1.82,0.02),{legL:{pos:[0.14,0.08,0.28],anchor:'ball',yaw:2,pitch:25,pole:[0.1,0.3,1]},legR:{pos:[-0.14,0.1,-0.3],anchor:'ball',pitch:40,pole:[-0.1,-0.2,1]}});
const pullair=()=>F({pos:[0,0.99,0],pitch:-4},-3,0,s=>gp(s,0.28,1.2,0.2),{legL:{pos:[0.15,0.17,0.27],anchor:'ball',yaw:2,pitch:35,pole:[0.1,0.3,1]},legR:{pos:[-0.15,0.1,0.12],anchor:'ball',pitch:45,pole:[-0.1,-0.2,1]}});
const gH=(s,y,z,pl,f=0)=>{f=f*Math.PI/180;return {pos:[0.3*s,y,z],hand:'grip',grip:0.014,fingers:[0,Math.sin(f),-Math.cos(f)],palm:[0,Math.cos(f),Math.sin(f)],pole:[pl[0]*s,pl[1],pl[2]],scap:{elev:1,prot:0}}};
const lg=(z1,y1,z2,y2,p2=55)=>({legL:{pos:[0.12,y1,z1],anchor:'ball',yaw:2,pitch:0,pole:[0.1,0.4,1]},legR:{pos:[-0.12,y2,z2],anchor:'ball',pitch:p2,pole:[-0.1,-0.2,1]}});
const J={
 catch:()=>F({pos:[0,0.92,0],pitch:-2},-2,-4,s=>gm(s,1.3,0.18,-25*Math.PI/180,[0.1,-0.2,1]),stance()),
 dip:()=>F({pos:[0,0.8,0],pitch:0},0,-2,s=>gr(s,1.33,0.13),stance()),
 drive:()=>F({pos:[0,0.97,0],pitch:-3},-3,-8,s=>gH(s,1.62,0.14,[0.3,-0.5,0.5],34),{legL:{pos:[0.13,0.06,0.1],anchor:'sole',yaw:12,pole:[0.234,0,1]},legR:{pos:[-0.13,0.06,0.1],anchor:'sole',yaw:-12,pole:[-0.234,0,1]}}),
 splair:()=>F({pos:[0,0.8,0],pitch:0},0,-4,s=>gH(s,1.78,0.2,[1,0.2,0],34),{legL:{pos:[0.12,0.06,0.5],anchor:'sole',yaw:2,pole:[0.1,0.4,1]},legR:{pos:[-0.12,0.09,-0.5],anchor:'ball',pitch:55,pole:[-0.1,-0.2,1]}}),
 splland:()=>F({pos:[0,0.76,0],pitch:0},0,-4,s=>gH(s,1.82,-0.03,[1,0.2,0],34),{legL:{pos:[0.12,0,0.5],anchor:'sole',yaw:2,pole:[0.1,0.4,1]},legR:{pos:[-0.12,0.03,-0.5],anchor:'ball',pitch:55,pole:[-0.1,-0.2,1]}}),
 pressA:()=>F({pos:[0,0.93,0],pitch:-3},0,-6,s=>gH(s,1.62,0.1,[0.3,-0.5,0.5],+(process.env.PF||34)),stance()),
 lock:()=>F({pos:[0,0.92,0],pitch:0},0,-2,s=>gH(s,1.97,-0.03,[1,0.2,0],34),stance()),
}; // bar axis height
const P={
 floor:(h=0)=>F({pos:[0,0.56+h*0.5,-0.22],pitch:56-h*22},2,-12,wa(0.225+h,0.12+h*0.3),stance()),
 knee:(h=0)=>F({pos:[0,0.64+h*0.2,-0.2],pitch:48-h*14},3,-14,wa(0.5+h*0.2,0.3),stance()),
 thigh:()=>F({pos:[0,0.84,-0.16],pitch:34},2,-8,wa(0.7,0.15),stance()),
 below:()=>F({pos:[0,0.7,-0.22],pitch:46},3,-12,wa(0.44,0.2),stance()),
 hips:()=>F({pos:[0,0.915,-0.02],pitch:-2},-2,2,wa(0.86,0.13,{px:0.8}),stance()),
 ext:()=>F({pos:[0,0.96,0.0],pitch:-4},-2,1,wa(1.0,0.14,{el:1,px:0.9}),toes()),
 pull:()=>F({pos:[0,0.97,0.0],pitch:-4},-3,0,s=>gp(s,0.28,1.2,0.2),toes()),
 rackfull:()=>F({pos:[0,0.54,-0.2],pitch:20},-2,-6,s=>gc(s,0.28,1.0,0.31),stance()),
 rackpower:()=>F({pos:[0,0.76,-0.1],pitch:12},-2,-4,s=>gc(s,0.28,1.2,0.31,{a:+process.env.PA||48.6,py:+(process.env.PP??1)}),stance()),
 rackstand:()=>F({pos:[0,0.92,0],pitch:0},0,-2,s=>gr(s),stance()),
 press1:()=>F({pos:[0,0.93,0],pitch:-3},0,-6,s=>gh(s,1.6,0.1,[0.3,-0.5,0.5]),stance()),
 press2:()=>F({pos:[0,0.78,0],pitch:0},0,-4,s=>gh(s,1.74,-0.05,[1,0.2,0]),stance()),
 rackg:()=>F({pos:[0,0.92,0],pitch:0},0,-2,s=>gc(s,+(process.env.RX||0.28),+process.env.RY||1.36,+process.env.RZ||0.31,{a:+(process.env.RA||48.6),py:+(process.env.RPY||0.4),px:+(process.env.RPX||0.7),pz:+(process.env.RPZ||1)}),stance()),
 tmid:()=>F({pos:[0,0.97,0],pitch:-4},-3,0,s=>gm(s,+process.env.MY||1.3,+process.env.MZ||0.2,(+process.env.MF||-30)*Math.PI/180,JSON.parse(process.env.TP||'[0.3,0.0,0.9]')),toes()),
 press:()=>F({pos:[0,0.93,0],pitch:-3},0,-6,s=>gh(s,1.65,0.1,[+process.env.P0||0.3,-0.5,0.5],(+process.env.PH||0)*Math.PI/180),stance()),
 rackstandw:()=>F({pos:[0,0.915,-0.03],pitch:4},0,-3,s=>gc(s),stance()),
 split:()=>{const f=F({pos:[0,0.66,0.0],pitch:2},-2,-3,s=>gc(s,0.28,1.18,0.31,{a:+process.env.SA||48.6,py:+(process.env.PP??1)}),{legL:{pos:[0.12,0,0.45],anchor:'sole',yaw:2,pole:[0.1,0.5,1]},legR:{pos:[-0.12,0.05,-0.6],anchor:'ball',pole:[-0.1,-0.2,1],pitch:60}});return f},
 
 over:()=>F({pos:[0,0.92,0],pitch:0},0,-2,s=>gh(s,1.9,-0.03,[1,0.2,0],(process.env.OH?+process.env.OH:34)*Math.PI/180),stance())
,overs:()=>F({pos:[0,0.8,0],pitch:0},0,-2,s=>gh(s,1.84,-0.03),{legL:{pos:[0.12,0,0.5],anchor:'ball',yaw:2,pitch:0,pole:[0.1,0.3,1]},legR:{pos:[-0.12,0.05,-0.55],anchor:'ball',pitch:55,pole:[-0.1,-0.2,1]}}),
};
const save=(slug,cam,muscles,frames,props,more={})=>{
 const fr={};const keys=['start','mid','mid2','mid3','mid4','mid5','end'];
 const arr=frames.map(f=>typeof f==='function'?f():f);
 arr.forEach((f,i)=>{fr[keys[i===arr.length-1?6:i]]=f});
 fs.writeFileSync(new URL(slug+'.json',W),JSON.stringify({slug,camera:cam,muscles,props:props||[{type:'barbell',hands:true,plates:[20,10]}],frames:fr,...more},null,1));
};
const cam={az:50,el:8};
const H=['quadriceps','glutes','hamstrings'];
const blocks=[{type:'pull-blocks',height:0.3},{type:'barbell',hands:true,kind:'bumper',plates:[25]}];
const fl=()=>P.floor(),kn=()=>P.knee();
const T={tempo:{lift:'there',up:0.7,down:1.3,maxLoop:6}};
save('clean',cam,['quadriceps','glutes','hamstrings'],[fl,kn,P.ext,P.pull,P.tmid,P.rackfull],undefined,T);
save('power-clean',cam,['hamstrings','glutes','quadriceps'],[fl,kn,P.ext,P.pull,P.tmid,P.rackpower],undefined,T);
save('split-clean',{az:80,el:8},['quadriceps','glutes','hamstrings'],[fl,kn,P.ext,pullair,P.split],undefined,T);
save('hang-clean',cam,['quadriceps','glutes'],[P.thigh,P.ext,P.pull,P.tmid,P.rackfull],undefined,T);
save('hang-clean-below-the-knees',cam,['quadriceps','glutes'],[P.below,P.thigh,P.ext,P.pull,P.tmid,P.rackfull],undefined,T);
const bf=()=>P.floor(0.3), bk=()=>P.knee(0.3);
save('clean-from-blocks',cam,['quadriceps','glutes'],[bf,bk,P.ext,P.pull,P.tmid,P.rackfull],blocks,T);
save('power-clean-from-blocks',cam,['quadriceps','glutes','hamstrings'],[bf,bk,P.ext,P.pull,P.tmid,P.rackpower],blocks,T);
save('clean-deadlift',cam,['hamstrings','glutes','spinal-erectors'],[fl,kn,P.hips],undefined,{tempo:{lift:'there',up:0.9,down:1.8,squeeze:0.6}});
save('clean-pull',cam,['quadriceps','glutes','traps'],[fl,kn,P.thigh,P.ext,P.pull],undefined,T);
save('clean-shrug',{az:55,el:8},['traps'],[P.thigh,P.ext],undefined,T);
save('clean-and-press',cam,['shoulders','triceps','quadriceps'],[fl,kn,P.ext,P.pull,P.rackstand,J.pressA,J.lock],undefined,{tempo:{lift:'there',up:1.4,down:2.0,maxLoop:6.5}});
save('clean-and-jerk',cam,['shoulders','triceps','quadriceps'],[fl,kn,P.rackstand,J.dip,J.drive,J.splair,J.splland],undefined,{tempo:{lift:'there',up:1.0,down:1.8,maxLoop:6.5}});
