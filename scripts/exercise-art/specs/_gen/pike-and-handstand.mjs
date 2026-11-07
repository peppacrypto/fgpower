import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,muscles,frames,more={})=>{out[slug]={slug,camera,muscles,frames,...more};};
const H=(s,z,x=0.2,po=[0.55,0.35,-0.75],y=0)=>({pos:[s*x,y,z],contact:true,fingers:[s*0.12,0,1],palm:[0,-1,0],curl:-0.3,pole:[s*po[0],po[1],po[2]]});
const hands=(z,x,po,y)=>({armL:H(1,z,x,po,y),armR:H(-1,z,x,po,y)});
// handstand: ankles up; ztop = foot z
const hs=(ry,rz,pitch,hz,fz,fy,neck,x=0.2,po=[0.4,0.1,-0.9])=>({root:{pos:[0,ry,rz],pitch},neck:{flex:neck},...hands(hz,x,po),
 legL:{pos:[0.09,fy,fz],anchor:'ankle',pitch:180,pole:[0.1,0,-1]},legR:{pos:[-0.09,fy,fz],anchor:'ankle',pitch:180,pole:[-0.1,0,-1]}});
const wall={type:'wall',pos:[0,0,-0.38],width:1.4,height:2.4};
const hsA=hs(1.075,-0.03,180,0.03,-0.14,1.87,-10,0.2);
const hsB=hs(0.81,-0.04,180,0.03,-0.14,1.58,-10,0.2,[0.6,0.2,-0.7]);
save('handstand-push-ups',{az:72,el:6},['anterior-deltoid','triceps'],{start:hsA,end:hsB},{props:[wall]});
save('wall-handstand-push-up',{az:72,el:6},['anterior-deltoid','triceps'],{start:hsA,end:hsB},{props:[wall]});
save('wall-handstand-hold',{az:72,el:6},['anterior-deltoid'],{start:hsA},{props:[wall]});
const fs0=hs(1.075,0.0,180,0.0,0.0,1.87,-10);
save('freestanding-handstand-hold',{az:72,el:6},['anterior-deltoid'],{start:fs0});
const pk=(rz,ry,p,z,ph)=>({root:{pos:[0,ry,rz],pitch:p},neck:{flex:-20},...hands(0.69),legL:{pos:[0.09,0.012,-0.32],anchor:'ball',pitch:55,toes:0,pole:[0.05,0,1]},legR:{pos:[-0.09,0.012,-0.32],anchor:'ball',pitch:55,toes:0,pole:[-0.05,0,1]}});
for(const s of ['pike-push-up','incline-pike-push-up','feet-elevated-pike-push-up'])out[s]=JSON.parse(fs.readFileSync(W+s+'.json'));
const fix=(sl,f)=>{for(const fr of Object.values(out[sl].frames))f(fr);};
for(const sl of ['pike-push-up','incline-pike-push-up','feet-elevated-pike-push-up'])fix(sl,fr=>{
 if(fr.legL&&sl==='incline-pike-push-up'){fr.legL.pos[2]+=0.012;fr.legR.pos[2]+=0.012;}
  if(fr.legL&&sl!=='incline-pike-push-up'){fr.legL.pos[2]+=0.02;fr.legR.pos[2]+=0.02;}
 if(fr.legL){fr.legL.pole=[0.05,0,1];fr.legR.pole=[-0.05,0,1];}
 if(sl!=='incline-pike-push-up'){fr.armL.pos[2]-=0.012;fr.armR.pos[2]-=0.012;}
 if(sl==='incline-pike-push-up'){fr.root.pos[2]+=0.01;fr.armL.pos[1]=0.44;fr.armR.pos[1]=0.44;}
});
out['feet-elevated-pike-push-up'].frames.end.root.pos[1]+=0.02;
out['incline-pike-push-up'].props[0].pos=[0,0,1.05];
fix('freestanding-handstand-hold',fr=>{fr.root.pos[2]-=0.03;});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
