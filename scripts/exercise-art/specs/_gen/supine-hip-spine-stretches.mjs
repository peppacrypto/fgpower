import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const D=Math.PI/180;
const FK=(flex,abd=0,rot=0,knee=0,pitch=0)=>({fk:{flex,abd,rot,knee},rel:'pelvis',foot:{pitch}});

const root=(extra={})=>({root:{pos:[0,0.1,0],pitch:-90,...extra}});
const leg=(s,p,pole=[0,1,0.2],extra={})=>{const {sa=0,...r}=extra;return {pos:[s*p[0],p[1],p[2]],anchor:'ankle',pole:[s*pole[0],pole[1],pole[2]],pitch:-(90+sa),...r};};
// sx: +1 = figure's left (x positive)
const flat=(s,p)=>({pos:[s*p[0],p[1],p[2]],contact:true,hand:'flat',fingers:[s*0.3,0,1],palm:[0,-1,0],pole:[s*0.5,-1,0],curl:0.2});
const PX=+(process.env.PX||1.7);const UP=JSON.parse(process.env.UP||'[1,-0.3,0]');const up=(s,p)=>({pos:[s*p[0],p[1],p[2]],hand:'relaxed',fingers:[0,0,1],palm:[-s*PX,1,0],pole:[s*UP[0],UP[1],UP[2]],curl:0.3});
const hold=(s,p,f,pa,g=0.035,pole=[0.6,-0.6,-0.3])=>({pos:[s*p[0],p[1],p[2]],hand:'grip',grip:g,fingers:[s*f[0],f[1],f[2]],palm:[s*pa[0],pa[1],pa[2]],curl:0.8,pole:[s*pole[0],pole[1],pole[2]]});
const PO=JSON.parse(process.env.PO||"[0.2,1,0.3]");
const PR=+(process.env.PR||0);const AB=+(process.env.AB||88);
const T=(s)=>({fk:{flex:0,abd:AB,rot:0,elbow:4},rel:'chest',hand:'relaxed',pron:PR});
const sideL=(s)=>flat(s,[0.27,0.04,0.0]);
const save=(slug,camera,muscles,frames,more={},props)=>{out[slug]={slug,camera,muscles,...(props?{props}:{}),frames,...more};};
const straight=(s,x=0.11)=>leg(s,[x,0.09,0.86],[0,1,0]);
const bentUp=(s,x=0.11)=>leg(s,[x,0.3,0.28],[0.1,1,-0.4],{sa:-30});
// twist
const RL=+(process.env.RL||-10);const FP=+(process.env.FP||0);
const twist=(arm)=>({...root({roll:-38}),spine:{twist:-5},neck:{twist:-40,flex:0},
 legL:leg(1,[-0.38,0.09,0.42],[-0.6,1,0],{roll:RL}),legR:{fk:{flex:0,abd:0,rot:0,knee:0},rel:'pelvis',foot:{pitch:FP}},...arm});
save('reclined-spinal-twist',{az:40,el:42},['spinal-erectors','obliques'],{
 start:{...root(),neck:{flex:0},legL:bentUp(1),legR:{fk:{flex:0,abd:0,rot:0,knee:0},rel:'pelvis',foot:{pitch:FP}},armL:T(1),armR:T(-1)},
 end:twist({armL:T(1),armR:T(-1)})});
const KF=+(process.env.KF||112),KA=+(process.env.KA||-30),KK=+(process.env.KK||105),KR=+(process.env.KR||-25),RS=+(process.env.RS||1),KH=+(process.env.KH||0.055);
const K0F=+(process.env.K0F||120),K0A=+(process.env.K0A||-10),K0R=+(process.env.K0R||-10);
const kneePt=(f,a,roll)=>{const c=Math.cos(a*D),d=[0.11+0.432*Math.sin(a*D)*Math.cos(f*D),0.432*Math.sin(f*D),0.432*Math.cos(f*D)*c];
 const r=RS*roll*D,x=d[0]-0.11+0.11-0,y=d[1];const X=0.11*0+ (d[0])*Math.cos(r)-(y)*Math.sin(r),Y=0.1+(d[0])*Math.sin(r)+(y)*Math.cos(r);return [X,Y,d[2]];};
const kh=(q)=>({pos:[q[0],q[1]+KH,q[2]],contact:true,hand:'flat',fingers:[1,0,0.3],palm:[0,-1,0],curl:0.3,pole:[-0.5,-0.2,-0.6]});
const sideArm=(s)=>({fk:{flex:0,abd:35,rot:0,elbow:4},rel:'chest',hand:'relaxed',pron:0});
save('knee-across-the-body',{az:40,el:42},['glutes'],{
 start:{...root({roll:K0R}),neck:{flex:0},legL:FK(K0F,K0A,0,KK),legR:FK(0),armL:sideArm(1),armR:kh(kneePt(K0F,K0A,K0R))},
 end:{...root({roll:KR}),neck:{twist:-35},legL:FK(KF,KA,0,KK),legR:FK(0),armL:sideArm(1),armR:kh(kneePt(KF,KA,KR))}});
save('corpse-pose',{az:60,el:24},[],{
 start:{...root(),neck:{flex:0},legL:leg(1,[0.22,0.09,0.845],[0.3,1,0],{yaw:12}),legR:leg(-1,[0.22,0.09,0.845],[-0.3,1,0],{yaw:-12}),
  armL:up(1,[0.33,0.055,0.0]),armR:up(-1,[0.33,0.055,0.0])}});
const wallz=0.12;
save('legs-up-the-wall',{az:115,el:14},['hamstrings'],{
 start:{...root({pos:[0,0.1,-0.04]}),neck:{flex:0},legL:leg(1,[0.11,0.94,0.06],[0,0,-1],{sa:90}),legR:leg(-1,[0.11,0.94,0.06],[0,0,-1],{sa:90}),
  armL:up(1,[0.3,0.055,-0.1]),armR:up(-1,[0.3,0.055,-0.1])}},{},[{type:'wall',pos:[0,0,wallz+0.1],width:2}]);
const HA=JSON.parse(process.env.HA||'[0.3,0.5,-0.3]'),HPO=JSON.parse(process.env.HPO||'[1,0.3,-0.6]'),HFP=+(process.env.HFP||0),HHO=+(process.env.HHO||0.078);
const HFL=+(process.env.HFL||110),HAB=+(process.env.HAB||45),HRO=+(process.env.HRO||0),HKN=+(process.env.HKN||110);
const HPI=+(process.env.HPI||-90),HV=+(process.env.HV||2),HYY=+(process.env.HYY||0.1);
const ank=(s)=>{const f=(HFL+(-90-HPI))*D,a=HAB*D,g=(HFL+(-90-HPI)-HKN)*D;
 const V=(ff)=>HV==2?[s*Math.sin(a),Math.cos(a)*Math.sin(ff),Math.cos(a)*Math.cos(ff)]:[s*Math.sin(a)*Math.cos(ff),Math.sin(ff),Math.cos(ff)*Math.cos(a)];
 const t=V(f),h=V(g);return [s*0.11+0.432*t[0]+0.428*h[0],HYY+0.432*t[1]+0.428*h[1],0.432*t[2]+0.428*h[2]];};
const AX=+(process.env.AX||0.422),AY=+(process.env.AY||0.511),AZ=+(process.env.AZ||0.139),SA=+(process.env.SA||70),KP=JSON.parse(process.env.KP||'[0.435,1.347,-0.595]');
const APv=JSON.parse(process.env.APV||'[0.176,-1.055,-1.424]');const APO=(s)=>[s*APv[0],APv[1],APv[2]];const HFGv=JSON.parse(process.env.HFGV||'[1.049,0.575,0.55]');const HFG=(s)=>[s*HFGv[0],HFGv[1],HFGv[2]];
const hb=(roll)=>({root:{pos:[0,HYY,+(process.env.RZ||0.096)],pitch:HPI,...(roll?{roll}:{})},neck:{flex:6},spine:{flex:+(process.env.SPF||22.515)},
 legL:leg(1,[AX,AY,AZ],KP,{sa:SA}),legR:leg(-1,[AX,AY,AZ],KP,{sa:SA}),
 armL:{pos:[AX+HHO,AY,AZ],hand:'grip',grip:0.02,fingers:HFG(1),palm:[-1,0,0],curl:0.8,pole:APO(1)},
 armR:{pos:[-AX-HHO,AY,AZ],hand:'grip',grip:0.02,fingers:HFG(-1),palm:[1,0,0],curl:0.8,pole:APO(-1)}});
save('happy-baby',{az:30,el:30},['adductors'],{start:hb(0),end:hb(+(process.env.HR||2.74))});
const HX=+(process.env.HX||0.11),SD=+(process.env.SD||0.12),AL=+(process.env.AL||0.07);
// leg bent at hip flex f and knee k (supine, pelvis frame); returns shin-axis hold point for the hand
const shinPt=(s,f,k,abd=0)=>{const x=s*(HX+0.0);const kn=[x,0.1+0.432*Math.sin(f*D),0.432*Math.cos(f*D)];const a=(f-k)*D;
 return [s*(Math.abs(kn[0])+AL),kn[1]+SD*Math.sin(a),kn[2]+SD*Math.cos(a)];};
const FG=JSON.parse(process.env.FG||'[0,1,-0.3]'),PA=JSON.parse(process.env.PA||'[-1,0,0]'),PL=JSON.parse(process.env.PL||'[0.8,-0.3,0.5]');
const hug=(s,f,k)=>{const q=shinPt(s,f,k);return {pos:q,contact:true,hand:'flat',fingers:[s*FG[0],FG[1],FG[2]],palm:[s*PA[0],PA[1],PA[2]],curl:0.3,pole:[s*PL[0],PL[1],PL[2]]};};
const HF=+(process.env.HF||112),HK=+(process.env.HK||120),HF2=+(process.env.HF2||122);
save('hug-knees-to-chest',{az:62,el:14},['spinal-erectors','glutes'],{
 start:{...root(),neck:{flex:8},legL:FK(HF,0,0,HK,0),legR:FK(HF,0,0,HK,0),armL:hug(1,HF,HK),armR:hug(-1,HF,HK)},
 end:{...root(),neck:{flex:6},legL:FK(HF2,0,0,HK,0),legR:FK(HF2,0,0,HK,0),armL:hug(1,HF2,HK),armR:hug(-1,HF2,HK)}});
save('one-knee-to-chest',{az:62,el:14},['glutes'],{
 start:{...root(),neck:{flex:4},legL:FK(HF,0,0,HK,0),legR:FK(0),armL:hug(1,HF,HK),armR:hug(-1,HF,HK)},
 end:{...root(),neck:{flex:6},legL:FK(HF2,0,0,HK,0),legR:FK(0),armL:hug(1,HF2,HK),armR:hug(-1,HF2,HK)}});
const AOK=JSON.parse(process.env.AOK||'[-0.13,0.262,0.333,-0.124,1.284,-0.764,0.123,0.828,0.176,0.486,0.275,-0.529,0.149,0.468,-0.257,0.391,0.543,-0.351,0.514,-0.843,-0.053,0.51,-0.574,0.118,0.043,-0.002,-0.177,-0.058,-0.133,0.139]');
const aok=(d)=>({...root(),neck:{flex:+(process.env.NF||2)+4*d},legR:leg(-1,[AOK[0],AOK[1]+AOK[24]*d,AOK[2]+AOK[25]*d],AOK.slice(3,6),{sa:AOK[28]||0,roll:AOK[29]||0}),legL:leg(1,[AOK[6],AOK[7]+AOK[24]*d,AOK[8]+AOK[25]*d],AOK.slice(9,12),{sa:AOK[26]||0,roll:AOK[27]||0}),
  armR:hold(-1,[AOK[12],AOK[13]+AOK[24]*d,AOK[14]+AOK[25]*d],[1,0,0],[0,1,0.3],0.035,AOK.slice(18,21)),armL:hold(1,[AOK[15],AOK[16]+AOK[24]*d,AOK[17]+AOK[25]*d],[1,0,0],[0,1,0.3],0.035,AOK.slice(21,24))});
save('ankle-on-the-knee',{az:50,el:20},['glutes'],{start:aok(0),end:aok(1)});
const WA=+(process.env.WA||-30),WF=+(process.env.WF||85),WR=+(process.env.WR||-25);
save('windmills',{az:30,el:40},['abductors'],{
 start:{...root(),neck:{flex:0},legL:FK(0),legR:FK(0),armL:T(1),armR:T(-1)},
 mid:{...root(),legL:FK(90),legR:FK(0),armL:T(1),armR:T(-1)},
 end:{...root({roll:WR}),legL:FK(WF,WA),legR:FK(0),armL:T(1),armR:T(-1)}},{muscleSide:'L'});
const P=(s)=>({fk:{flex:0,abd:AB,rot:0,elbow:4},rel:'chest',hand:'relaxed',pron:PR});
const IK=+(process.env.IK||80),IA=+(process.env.IA||-30),IP=+(process.env.IP||60),IR=+(process.env.IR||20),IY=+(process.env.IY||0.15);
const pr=(extra={})=>({pos:[0,IY,0],pitch:90,...extra});
save('iron-crosses-stretch',{az:30,el:40},['quadriceps'],{
 start:{root:pr(),neck:{twist:70},legL:FK(0,0,0,0,IP),legR:FK(0,0,0,0,IP),armL:P(1),armR:P(-1)},
 mid:{root:pr(),neck:{twist:70},legL:FK(0,0,0,IK,IP),legR:FK(0,0,0,0,IP),armL:P(1),armR:P(-1)},
 end:{root:pr({roll:IR}),neck:{twist:70},legL:FK(+(process.env.IF||-30),IA,0,IK,IP),legR:FK(0,+(process.env.RA||10),0,0,IP),armL:P(1),armR:P(-1)}},{muscleSide:'L'});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
