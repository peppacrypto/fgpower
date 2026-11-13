import fs from 'fs';
const W=new URL('../',import.meta.url);
const C=(o)=>JSON.parse(JSON.stringify(o));
// world grip (deadlift family)
const gw=(s,x,y,z,o={})=>({pos:[x*s,y,z],hand:'grip',grip:0.014,fingers:[0,-1,0],palm:[0,0,-1],pole:[(o.px??0.9)*s,o.py??0,o.pz??0],scap:{elev:o.el??0,prot:0}});
// rack grip rel chest (front squat clean grip)
const gc=(s,x=0.22,y=1.45,z=0.14,o={})=>({pos:[x*s,y,z],fingers:[0,-0.5,-0.85],palm:[0,0.85,-0.5],hand:'grip',grip:0.014,pole:[(o.px??0.7)*s,o.py??0.4,1],scap:{elev:0,prot:0.5}});
const gp=(s,x,y,z)=>({pos:[x*s,y,z],hand:'grip',grip:0.014,fingers:[0,-1,0],palm:[0,0,-1],pole:[1.0*s,0.3,0.0],scap:{elev:1,prot:0}});
// overhead grip
const go=(s,x,y,z,pl=[0.9,-0.35,-0.3])=>({pos:[x*s,y,z],hand:'grip',grip:0.014,fingers:[0,-0.5,-0.85],palm:[0,0.85,-0.5],pole:[pl[0]*s,pl[1],pl[2]],scap:{elev:1,prot:0}});
const stance=(w=0.17,yaw=12,z=0.12,y=0,p=0)=>({legL:{pos:[w,y,z],anchor:'ball',yaw,pitch:p,pole:[w*1.8,0,1]},legR:{pos:[-w,y,z],anchor:'ball',yaw:-yaw,pitch:p,pole:[-w*1.8,0,1]}});
const toes=()=>stance(0.17,12,0.12,0,28);
const F=(root,sp,nk,arms,legs)=>({root,spine:{flex:sp},neck:{flex:nk},armL:arms(1),armR:arms(-1),...legs});
const X=0.46;
const wa=(y,z,o)=>s=>gw(s,X,y,z,o);
const BY=(b)=>b; // bar axis height

const oh=(s,y,z=-0.02)=>({pos:[0.46*s,y,z],rel:'world',fingers:[0,0.94,-0.34],palm:[0,0.34,0.94],hand:'grip',grip:0.014,pole:[s,0.2,0]});
const wl=(sx,yaw,px,z=0.02)=>({legL:{pos:[sx,0,z],anchor:'sole',yaw,pitch:0,pole:[px,0,1]},legR:{pos:[-sx,0,z],anchor:'sole',yaw:-yaw,pitch:0,pole:[-px,0,1]}});
const wide=()=>wl(0.3,28,0.55);
const OF=(root,sp,nk,y,legs,z)=>({root,spine:{flex:sp},neck:{flex:nk},armL:oh(1,y,z),armR:oh(-1,y,z),...legs});
const P={
 floor:(h=0)=>F({pos:[0,0.52+h*0.6,-0.25],pitch:62-h*30},4,-25,wa(0.225+h,0.12+h*0.3),stance()),
 knee:(h=0)=>F({pos:[0,0.64+h*0.2,-0.2],pitch:48-h*14},3,-14,wa(0.5+h*0.2,0.25),stance()),
 thigh:()=>F({pos:[0,0.84,-0.16],pitch:34},2,-8,wa(0.7,0.15),stance()),
 below:()=>F({pos:[0,0.7,-0.22],pitch:46},3,-12,wa(0.48,0.2),stance()),
 hips:()=>F({pos:[0,0.915,-0.02],pitch:-2},-2,2,wa(0.86,0.13,{px:0.8}),stance()),
 ext:()=>F({pos:[0,0.96,0.0],pitch:-4},-2,1,wa(1.0,0.14,{el:1,px:0.9}),toes()),
 pull:()=>{const T={th:10,y:1.25,z:0.2,pole:[1,0.1,0],...JSON.parse(process.env.U||'{}')};const c=Math.cos(T.th*Math.PI/180),n=Math.sin(T.th*Math.PI/180);return F({pos:[0,0.97,0.0],pitch:-4},-3,0,s=>({pos:[0.5*s,T.y,T.z],hand:'grip',grip:0.014,fingers:[0,-c,n],palm:[0,-n,-c],pole:[T.pole[0]*s,T.pole[1],T.pole[2]],scap:{elev:1,prot:0}}),toes())},
 up:()=>OF({pos:[0,0.915,-0.03],pitch:4},0,-3,1.78,wide()),
 powercatch:()=>OF({pos:[0,0.68,-0.12],pitch:14},-2,-4,1.62,wide()),
 deep:()=>OF({pos:[0,0.46,-0.2],pitch:28},-2,-6,1.27,wide()),
 splitc:()=>OF({pos:[0,0.66,0.0],pitch:2},-2,-3,1.68,{legL:{pos:[0.12,0,0.45],anchor:'sole',yaw:2,pole:[0.1,0.5,1]},legR:{pos:[-0.12,0.05,-0.6],anchor:'ball',pole:[-0.1,-0.2,1],pitch:60}}),
 turn:()=>{const T={th:100,y:1.4,z:0.25,x:0.5,pole:[1,-1,0.2],...JSON.parse(process.env.T||'{}')};const c=Math.cos(T.th*Math.PI/180),n=Math.sin(T.th*Math.PI/180);return F({pos:[0,0.97,0.0],pitch:-4},-2,T.nk??-6,s=>({pos:[T.x*s,T.y,T.z],hand:'grip',grip:0.014,fingers:[0,-c,n],palm:[0,-n,-c],pole:[T.pole[0]*s,T.pole[1],T.pole[2]],scap:{elev:1,prot:0}}),toes())},
 muscle:()=>OF({pos:[0,0.96,0],pitch:-4},-2,0,1.8,toes()),
 mhigh:()=>F({pos:[0,0.96,0],pitch:-4},-2,0,s=>gp(s,0.5,1.45,0.2),toes()),
};
const save=(slug,cam,muscles,frames,props,more={})=>{
 const fr={};const keys=['start','mid','mid2','mid3','end'];
 const arr=frames.map(f=>f());
 arr.forEach((f,i)=>{fr[keys[i===arr.length-1?4:i]]=f});
 fs.writeFileSync(new URL(slug+'.json',W),JSON.stringify({slug,camera:cam,muscles,props:props||[{type:'barbell',hands:true,plates:[20,10]}],frames:fr,...more},null,1));
};
const cam={az:50,el:8};
const blocks=[{type:'pull-blocks',height:0.3},{type:'barbell',hands:true,kind:'bumper',plates:[25]}];
const fl=()=>P.floor(),kn=()=>P.knee();
const bf=()=>P.floor(0.3), bk=()=>P.knee(0.3);
const H=['hamstrings','glutes','quadriceps'];
save('snatch',cam,['quadriceps','glutes','shoulders'],[fl,kn,P.pull,P.turn,P.deep]);
save('power-snatch',cam,H,[fl,kn,P.pull,P.turn,P.powercatch]);
save('split-snatch',{az:75,el:8},H,[fl,kn,P.pull,P.turn,P.splitc]);
save('hang-snatch',cam,H,[P.thigh,P.pull,P.turn,P.deep,P.up]);
save('hang-snatch-below-knees',cam,H,[P.below,P.thigh,P.pull,P.turn,P.deep]);
save('snatch-from-blocks',cam,['quadriceps','glutes'],[bf,bk,P.pull,P.turn,P.deep],blocks);
save('power-snatch-from-blocks',cam,['quadriceps','glutes'],[bf,bk,P.pull,P.turn,P.powercatch],blocks);
save('muscle-snatch',cam,['shoulders','traps','hamstrings'],[P.thigh,P.pull,P.turn,P.muscle]);
save('snatch-deadlift',cam,['hamstrings','glutes','spinal-erectors'],[fl,kn,P.hips]);
save('snatch-pull',cam,['hamstrings','glutes','traps'],[fl,kn,P.thigh,P.ext,P.pull]);
save('snatch-shrug',{az:55,el:8},['traps'],[P.thigh,P.ext]);
