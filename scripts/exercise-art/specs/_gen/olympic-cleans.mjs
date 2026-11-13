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
const go=(s,x,y,z,pl=[0.9,-0.35,-0.3])=>({pos:[x*s,y,z],hand:'grip',grip:0.014,fingers:ang(+process.env.GO||30).f,palm:ang(+process.env.GO||30).p,pole:[pl[0]*s,pl[1],pl[2]],scap:{elev:1,prot:0}});
const stance=(w=0.17,yaw=12,z=0.12,y=0,p=0)=>({legL:{pos:[w,y,z],anchor:'ball',yaw,pitch:p,pole:[w*1.8,0,1]},legR:{pos:[-w,y,z],anchor:'ball',yaw:-yaw,pitch:p,pole:[-w*1.8,0,1]}});
const toes=()=>stance(0.17,12,0.12,0,28);
const F=(root,sp,nk,arms,legs)=>({root,spine:{flex:sp},neck:{flex:nk},armL:arms(1),armR:arms(-1),...legs});
const X=0.33;
const wa=(y,z,o)=>s=>gw(s,X,y,z,o);
const BY=(b)=>b; // bar axis height
const P={
 floor:(h=0)=>F({pos:[0,0.52+h*0.6,-0.25],pitch:62-h*30},4,-25,wa(0.225+h,0.12+h*0.3),stance()),
 knee:(h=0)=>F({pos:[0,0.64+h*0.2,-0.2],pitch:48-h*14},3,-14,wa(0.5+h*0.2,0.25),stance()),
 thigh:()=>F({pos:[0,0.84,-0.16],pitch:34},2,-8,wa(0.7,0.15),stance()),
 below:()=>F({pos:[0,0.7,-0.22],pitch:46},3,-12,wa(0.44,0.2),stance()),
 hips:()=>F({pos:[0,0.915,-0.02],pitch:-2},-2,2,wa(0.86,0.13,{px:0.8}),stance()),
 ext:()=>F({pos:[0,0.96,0.0],pitch:-4},-2,1,wa(1.0,0.14,{el:1,px:0.9}),toes()),
 pull:()=>F({pos:[0,0.97,0.0],pitch:-4},-3,0,s=>gp(s,0.28,1.2,0.2),toes()),
 rackfull:()=>F({pos:[0,0.54,-0.2],pitch:20},-2,-6,s=>gc(s,0.28,1.0,0.31),stance()),
 rackpower:()=>F({pos:[0,0.7,-0.12],pitch:14},-2,-4,s=>gc(s,0.28,1.2,0.31,{a:+process.env.PA||48.6,py:+(process.env.PP??1)}),stance()),
 rackstand:()=>F({pos:[0,0.92,0],pitch:0},0,-2,s=>gc(s,0.28,+process.env.RY||1.43,+process.env.RZ||0.27,{a:+process.env.GA||48.6,py:+(process.env.RP??0.4),px:+(process.env.RX||0.7),pz:+(process.env.RPZ||1)}),stance()),
 press:()=>F({pos:[0,0.92,0],pitch:0},0,-12,s=>go(s,0.30,1.68,0.27,JSON.parse(process.env.PL||"[0.7,0.4,1]")),stance()),
 rackstandw:()=>F({pos:[0,0.915,-0.03],pitch:4},0,-3,s=>gc(s),stance()),
 split:()=>{const f=F({pos:[0,0.66,0.0],pitch:2},-2,-3,s=>gc(s,0.28,1.18,0.31,{a:+process.env.SA||48.6,py:+(process.env.PP??1)}),{legL:{pos:[0.12,0,0.45],anchor:'sole',yaw:2,pole:[0.1,0.5,1]},legR:{pos:[-0.12,0.05,-0.6],anchor:'ball',pole:[-0.1,-0.2,1],pitch:60}});return f},
 
 over:()=>F({pos:[0,0.92,0],pitch:0},0,-2,s=>go(s,0.30,1.86,0.03,JSON.parse(process.env.PL||"[0.7,0.4,1]")),stance())
,overs:()=>F({pos:[0,0.8,0],pitch:0},0,-2,s=>go(s,0.30,1.84,0.03,[0.7,0.4,1]),{legL:{pos:[0.12,0,0.5],anchor:'ball',yaw:2,pitch:0,pole:[0.1,0.3,1]},legR:{pos:[-0.12,0.05,-0.55],anchor:'ball',pitch:55,pole:[-0.1,-0.2,1]}}),
};
const save=(slug,cam,muscles,frames,props,more={})=>{
 const fr={};const keys=['start','mid','mid2','mid3','end'];
 const arr=frames.map(f=>typeof f==='function'?f():f);
 arr.forEach((f,i)=>{fr[keys[i===arr.length-1?4:i]]=f});
 fs.writeFileSync(new URL(slug+'.json',W),JSON.stringify({slug,camera:cam,muscles,props:props||[{type:'barbell',hands:true,plates:[20,10]}],frames:fr,...more},null,1));
};
const cam={az:50,el:8};
const H=['quadriceps','glutes','hamstrings'];
const blocks=[{type:'pull-blocks',height:0.3},{type:'barbell',hands:true,kind:'bumper',plates:[25]}];
const fl=()=>P.floor(),kn=()=>P.knee();
save('clean',cam,['quadriceps','glutes','hamstrings'],[fl,kn,P.ext,P.pull,P.rackfull]);
save('power-clean',cam,['hamstrings','glutes','quadriceps'],[fl,kn,P.ext,P.pull,P.rackpower]);
save('split-clean',{az:75,el:8},['quadriceps','glutes','hamstrings'],[fl,kn,P.ext,P.pull,P.split]);
save('hang-clean',cam,['quadriceps','glutes'],[P.thigh,P.ext,P.pull,P.rackfull]);
save('hang-clean-below-the-knees',cam,['quadriceps','glutes'],[P.below,P.thigh,P.ext,P.pull,P.rackfull]);
// blocks: bar axis 0.3+0.225=0.525
const bf=()=>P.floor(0.3), bk=()=>P.knee(0.3);
save('clean-from-blocks',cam,['quadriceps','glutes'],[bf,bk,P.ext,P.pull,P.rackfull],blocks);
save('power-clean-from-blocks',cam,['hamstrings','glutes'],[bf,bk,P.ext,P.pull,P.rackpower],blocks);
save('clean-deadlift',cam,['hamstrings','glutes','spinal-erectors'],[fl,kn,P.hips]);
save('clean-pull',cam,['quadriceps','glutes','traps'],[fl,kn,P.thigh,P.ext,P.pull]);
save('clean-shrug',{az:55,el:8},['traps'],[P.thigh,P.ext]);
save('clean-and-press',cam,['shoulders','triceps','quadriceps'],(process.env.CP==='d'?[fl,P.pull,P.rackpower,P.over]:process.env.CP==='e'?[fl,P.pull,P.rackpower,P.press,P.over]:process.env.CP==='f'?[fl,P.pull,P.rackpower,P.rackstand,P.over]:process.env.CP==='b'?[fl,P.ext,P.pull,P.rackstand,P.over]:process.env.CP==='c'?[fl,P.pull,P.rackstand,P.press,P.over]:[fl,kn,P.rackstand,P.press,P.over]));
save('clean-and-jerk',cam,['shoulders','triceps','quadriceps'],(process.env.CP==='d'?[fl,P.pull,P.rackpower,P.overs]:process.env.CP==='e'?[fl,P.pull,P.rackpower,P.press,P.overs]:process.env.CP==='f'?[fl,P.pull,P.rackpower,P.rackstand,P.overs]:process.env.CP==='b'?[fl,P.ext,P.pull,P.rackstand,P.overs]:process.env.CP==='c'?[fl,P.pull,P.rackstand,P.press,P.overs]:[fl,kn,P.rackstand,P.press,P.overs]));
