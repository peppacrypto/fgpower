import fs from 'fs';
const W=new URL('../',import.meta.url);
// arms (world)
const gc=(s,x,y,z)=>({pos:[x*s,y,z],rel:'world',fingers:[0,0.1,-1],palm:[0,1,0.1],hand:'grip',grip:0.014,pole:[0.1*s,-0.2,1],scap:{elev:0,prot:0.5}});
const go=(s,x,y,z,pl=[1,0.2,0])=>({pos:[x*s,y,z],rel:'world',hand:'grip',grip:0.014,fingers:[0,0.55,-0.83],palm:[0,0.83,0.55],pole:[pl[0]*s,pl[1],pl[2]],scap:{elev:1,prot:0}});
const gs=(s,x,y,z)=>go(s,x,y,z,[1,0.2,0]);
const back=(s,x,y,z)=>({pos:[x*s,y,z],rel:'world',hand:'grip',grip:0.014,fingers:[0.02*s,0.97,-0.2],palm:[0,0.2,0.97],pole:[0.6*s,-0.6,-0.6],scap:{elev:0,prot:-0.3}});
const sc=(s,x,y,z)=>({pos:[x*s,y,z],hand:'grip',grip:0.014,fingers:[0,-0.9,-0.1],palm:[0,0.1,-1],pole:[1*s,-0.1,-0.4],scap:{elev:0,prot:0}});
const st=(w=0.15,yaw=10,z=0.12,p=0,anc='sole')=>({legL:{pos:[w,0,z],anchor:anc,yaw,pitch:p,pole:[w*1.8,0,1]},legR:{pos:[-w,0,z],anchor:anc,yaw:-yaw,pitch:p,pole:[-w*1.8,0,1]}});
const F=(y,z,pitch,sp,nk,arms,legs)=>({root:{pos:[0,y,z],pitch},spine:{flex:sp},neck:{flex:nk},armL:arms(1),armR:arms(-1),...legs});
const split=(fz,rz,rp=55)=>({legL:{pos:[0.12,0,fz],anchor:'sole',yaw:2,pole:[0.1,0.4,1]},legR:{pos:[-0.12,0.03,rz],anchor:'ball',pitch:rp,pole:[-0.1,-0.2,1]}});
const X=0.24, XO=0.30;
const rack=(dy=0)=>s=>gc(s,X,1.45+dy,0.13);
const R={pos:[0,0.92,0]};
const stand=(arms,nk=-2,legs=st())=>F(0.92,0,0,0,nk,arms,legs);
const PL=[0.3,-0.5,0.5];
const dip=(d=0.12,legs=ST)=>F(0.92-d,0,0,0,-2,rack(-d),legs);
const drive=(by,bz,legs=ST)=>F(0.93,0,-3,-2,-10,s=>go(s,XO,by,bz,PL),legs);
const ohf=(y,z,legs,root=0.92)=>F(root,0,0,0,-4,s=>go(s,XO,y,z),legs);
const save=(slug,cam,muscles,frames,more={})=>{
  const keys=['start','mid','mid2','mid3','end']; const fr={};
  frames.forEach((f,i)=>{fr[keys[i===frames.length-1&&i>0?4:i]]=f});
  fs.writeFileSync(new URL(`${slug}.json`,W),JSON.stringify({slug,camera:cam,muscles,props:[{type:'barbell',hands:true,plates:[20,10]}],frames:fr,...more},null,1));
};
const cam={az:50,el:8};
const ST=st(0.13,12,0.1);
const rk=()=>stand(rack(),-2,ST);
const OZ=-0.05;
const fk=(fl,ab,el,rot=-30,pron=45)=>s=>({fk:{flex:fl,abd:ab,rot:rot,elbow:el},pron,rel:'chest',hand:'grip',grip:0.014});
save('rack-delivery',{az:55,el:8},['shoulders','anterior-deltoid'],[
  stand(fk(20,90,95,60,0),-2,ST), stand(fk(45,50,110,-30,45),-2,ST), stand(fk(80,15,145,-30,45),-2,ST)]);
save('jerk-dip-squat',cam,['quadriceps','glutes'],[rk(),dip(0.13)],{qaAllow:{'rom:squat.depth':'the jerk dip is a deliberate shallow quarter dip (knees bend about 15 percent of a squat), torso vertical'}});
const LO=1.97;
save('push-press',cam,['shoulders','triceps','quadriceps'],[rk(),dip(),drive(1.55,0.14),
  stand(s=>go(s,XO,1.78,0.06,[0.2,-0.2,0.3]),-12,ST),ohf(LO,OZ,ST)]);
save('power-jerk',cam,['quadriceps','shoulders','triceps'],[rk(),dip(),drive(1.6,0.1),ohf(1.74,OZ,ST,0.78),ohf(1.86,OZ,ST)]);
const lift=(l)=>({legL:{...l.legL,pos:[l.legL.pos[0],0.05,l.legL.pos[2]]},legR:{...l.legR,pos:[l.legR.pos[0],0.05,l.legR.pos[2]]}});
const splitL=split(0.5,-0.5);
const flight=(l)=>({legL:{...l.legL,pos:[l.legL.pos[0],0.06,l.legL.pos[2]]},legR:{...l.legR,pos:[l.legR.pos[0],l.legR.pos[1]+0.06,l.legR.pos[2]]}});
save('split-jerk',{az:50,el:8},['quadriceps','shoulders','triceps'],[rk(),dip(),F(0.97,0,-3,-2,-10,s=>go(s,XO,1.62,0.1,PL),flight(ST)),
  ohf(LO-0.12,OZ,flight(splitL),0.8),ohf(LO-0.16,OZ,splitL,0.76)]);
const WL=st(0.26,22,0.02);
const dipW=(d)=>F(0.92-d,0,0,0,-2,rack(-d),WL);
save('squat-jerk',{az:45,el:8},['quadriceps','glutes','shoulders'],[F(0.92,0,0,0,-2,rack(),WL),dipW(0.12),
  F(0.91,0,-3,-2,-10,s=>go(s,XO,1.6,0.1,PL),WL),
  F(0.42,-0.22,14,-2,-2,s=>go(s,XO,1.30,-0.08),WL),ohf(1.86,OZ,WL)]);
const RZ=-0.4;
const stepL=(z)=>({...split(z,RZ),legL:{pos:[0.12,0.06,z],anchor:'sole',yaw:2,pole:[0.1,0.4,1]}});
save('jerk-balance',{az:50,el:8},['shoulders','quadriceps'],[
  F(0.9,-0.1,0,0,-2,rack(-0.02),split(0.15,RZ)),
  F(0.8,-0.08,0,0,-2,rack(-0.12),split(0.15,RZ)),
  F(0.8,0.05,0,0,-8,s=>go(s,XO,1.62,0.2,PL),stepL(0.15)),
  F(0.78,0.12,0,0,-4,s=>go(s,XO,1.72,0.1,PL),stepL(0.62)),
  F(0.74,0.2,2,0,-3,s=>go(s,XO,LO-0.21,0.14),split(0.62,RZ))]);
const SX=0.5;
const backG=(s,dy=0)=>({pos:[SX*s,1.5+dy,-0.1],rel:'world',hand:'grip',grip:0.014,fingers:[0.02*s,0.97,-0.2],palm:[0,0.2,0.97],pole:[0.3*s,-1,-0.3],scap:{elev:0,prot:-0.3}});
const SL=st(0.26,24,0.04);
const bg=(dy)=>s=>backG(s,dy);
const snat=(slug,heave)=>save(slug,{az:45,el:8},['quadriceps','shoulders','glutes'],[
  F(0.92,0,0,0,0,backG,SL),
  F(0.82,0,0,0,0,backG,SL),
  ...(heave?[F(0.92,0,-1,0,0,bg(0.05),SL)]:[]),
  F(0.7,-0.1,10,0,-4,s=>gs(s,SX,1.55,-0.04),SL),
  F(0.46,-0.2,28,-2,-6,s=>gs(s,SX,1.30,-0.02),SL)]);
snat('snatch-balance',false);snat('heaving-snatch-balance',true);
// push-press-behind-the-neck: bar on the traps, dip, drive, lockout
const BX=0.46;
const btn=(y,z,sc2=-0.3)=>s=>({pos:[BX*s,y,z],rel:'world',hand:'grip',grip:0.014,fingers:[0.02*s,0.97,-0.2],palm:[0,0.2,0.97],pole:[0.3*s,-1,-0.3],scap:{elev:0,prot:sc2}});
save('push-press-behind-the-neck',cam,['shoulders','triceps','quadriceps'],[
  F(0.92,0,0,0,0,btn(1.50,-0.1),ST),
  F(0.80,0,0,0,0,btn(1.38,-0.1),ST),
  F(0.93,0,-2,-1,0,s=>go(s,BX,1.80,-0.08,PL),ST),
  F(0.93,0,-6,0,-2,s=>go(s,BX,LO-0.05,-0.10,[0.3,-0.4,0.4]),ST)]);
