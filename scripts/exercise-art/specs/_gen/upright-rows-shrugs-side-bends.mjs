import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify(s,null,1));
const legs = (w=0.12) => ({ legL:{pos:[w,0,0.0],anchor:'sole',yaw:6,pole:[0.15,0,1]}, legR:{pos:[-w,0,0.0],anchor:'sole',yaw:-6,pole:[-0.15,0,1]} });
const sc = (e,p=0)=>({elev:e,prot:p});
// barbell grips (hands on bar line, fingers down, palm toward thighs)
const bg = (s,x,y,z,pole,scap) => ({ pos:[x*s,y,z], contact:true, fingers:[0,-1,0], palm:[0,-0.05,-1], curl:0.85, pole:[pole[0]*s,pole[1],pole[2]], scap });
const stand = (arms, extra={}) => ({ root:{pos:[0,0.92,0],pitch:0}, spine:{flex:0}, neck:{flex:0}, ...legs(), ...arms, ...extra });

// ---- shrugs
const shrugBar = (slug, z, palm, fing, pole, cam) => {
  const f = (e)=>stand({armL:{...bg(1,0.26,0.8+0.0,z,pole,sc(e)),fingers:fing,palm}, armR:{...bg(-1,0.26,0.8,z,pole,sc(e)),fingers:[-fing[0],fing[1],fing[2]],palm:[-palm[0],palm[1],palm[2]]}});
  const fe=(e)=>{const o=f(e); o.armL.pos[1]=0.8+0.05; o.armR.pos[1]=0.8+0.05; return o;};
  W(slug,{slug,camera:cam,muscles:['traps'],props:[{type:'barbell',hands:true,plates:[20]}],frames:{start:f(0),end:fe(8)}});
};
shrugBar('barbell-shrug',0.2,[0,-0.05,-1],[0,-1,0],[0.3,0,-1],{az:25,el:6});
shrugBar('barbell-shrug-behind-the-back',-0.14,[0,-0.05,-1],[0,-1,0],[0.3,0,-1],{az:150,el:8});

const dbArm = (s,x,y,z,pole,scap,palmx=-1) => ({ pos:[x*s,y,z], contact:true, fingers:[0,-1,0], palm:[palmx*s,0,0.0], curl:0.85, pole:[pole[0]*s,pole[1],pole[2]], scap });
const dbProps = (hs)=>hs.map(h=>({type:'dumbbell',hand:h,kg:15}));
// dumbbell shrug
{ const f=(e)=>stand({armL:dbArm(1,0.28,0.80+0.06*e,0.02,[0.15,0,-1],sc(e*8)),armR:dbArm(-1,0.28,0.80+0.06*e,0.02,[0.15,0,-1],sc(e*8))});
  W('dumbbell-shrug',{slug:'dumbbell-shrug',camera:{az:25,el:6},muscles:['traps'],props:dbProps(['L','R']),frames:{start:f(0),end:f(1)}}); }

// ---- upright rows
// frame builder: hand pos in world, elbow leads outward-up
const ur = (x,y,z,pole,e=0,palm=[0,-0.05,-1],fing=[0,-1,0]) => ({
  armL:{pos:[x,y,z],contact:true,fingers:fing,palm,curl:0.85,pole:[pole[0],pole[1],pole[2]],scap:sc(e)},
  armR:{pos:[-x,y,z],contact:true,fingers:[-fing[0],fing[1],fing[2]],palm:[-palm[0],palm[1],palm[2]],curl:0.85,pole:[-pole[0],pole[1],pole[2]],scap:sc(e)} });
{ const slug='upright-barbell-row';
  W(slug,{slug,camera:{az:30,el:6},muscles:['shoulders','traps'],props:[{type:'barbell',hands:true,plates:[20]}],frames:{
   start:stand(ur(0.2,0.85,0.2,[0.4,-0.2,-1])),
   mid:stand(ur(0.22,1.02,0.19,[1,-0.3,-0.5],4,[0,-0.3,-1],[0,-0.95,0.3])),
   end:stand(ur(0.24,1.2,0.18,[1,-0.3,-0.5],8,[0,-0.5,-0.85],[0,-0.85,0.5]))}}); }
// dumbbell uprights: neutral-ish grip (palm toward thigh/body)
const dur = (x,y,z,pole,e,pal,fing)=>ur(x,y,z,pole,e,pal,fing);
const dbRow = (slug, startY, startZ, x0, xm, zm, pal, muscles, cam) => {
  W(slug,{slug,camera:cam,muscles,props:dbProps(['L','R']),frames:{
   start:stand(dur(x0,startY,startZ,[0.4,-0.2,-1],0,pal)),
   mid:stand(dur(xm,1.02,zm+0.04,[1,-0.3,-0.5],4,[0,-0.3,-1],[0,-0.95,0.3])),
   end:stand(dur(xm,1.2,0.18,[1,-0.3,-0.5],8,[0,-0.5,-0.85],[0,-0.85,0.5]))}});};
dbRow('standing-dumbbell-upright-row',0.85,0.22,0.17,0.24,0.2,[-0.2,-0.05,-1],['traps','shoulders'],{az:30,el:6});
// dumbbell-raise: weights at the sides, elbows lead, hands wide
dbRow('dumbbell-raise',0.82,0.06,0.30,0.28,0.12,[-0.8,-0.05,-0.6],['shoulders','lateral-deltoid'],{az:25,el:6});
// one-arm
{ const slug='dumbbell-one-arm-upright-row';
  const g=(y,z,x,pole,e,pr)=>({ ...stand({}), armL:{pos:[x,y,z],contact:true,fingers:[0,-1,0],palm:[0,-0.1,-1],curl:0.85,pole,scap:sc(e)}, armR:{pos:[-0.28,0.88,0.0],hand:'relaxed',pole:[-0.3,0,-1]} });
  W(slug,{slug,muscleSide:'L',camera:{az:30,el:6},muscles:['shoulders','traps'],props:dbProps(['L']),frames:{
   start:g(0.85,0.22,0.17,[0.4,-0.2,-1],0), mid:g(1.02,0.2,0.24,[1,-0.3,-0.5],4), end:g(1.2,0.18,0.24,[1,-0.3,-0.5],8)}}); }

// ---- side bends
const bar = (side) => ({ armL:{pos:[0.33,0.215,-0.015],rel:'chest',contact:true,fingers:[-0.3,0.45,-0.85],palm:[0,0.97,0.2],curl:0.85,pole:[0.5,-0.7,-0.6],scap:sc(0)},
  armR:{pos:[-0.33,0.215,-0.015],rel:'chest',contact:true,fingers:[0.3,0.45,-0.85],palm:[0,0.97,0.2],curl:0.85,pole:[-0.5,-0.7,-0.6],scap:sc(0)} });
{ const slug='barbell-side-bend';
  const f=(sd)=>({root:{pos:[0,0.92,-0.03],pitch:0},spine:{flex:0,side:sd},neck:{flex:0},...legs(0.15),...bar()});
  W(slug,{slug,camera:{az:15,el:5},muscles:['obliques','abdominals'],props:[{type:'barbell',hands:true,plates:[20]}],frames:{start:f(0),end:f(-28)}}); }
{ const slug='dumbbell-side-bend';
  const f=(sd)=>({root:{pos:[0,0.92,0],pitch:0},spine:{flex:0,side:sd},neck:{flex:0},...legs(0.15),
   armL:{pos:[0.26+0.14*sd/28,0.80,0.0],contact:true,fingers:[0,-1,0],palm:[-1,0,0],curl:0.85,pole:[0.15,0,-1]},
   armR:{pos:[-0.2,0.98,-0.02],contact:true,hand:'flat',fingers:[0.5,-0.3,0.8],palm:[0.3,0,-0.9],pole:[-1,0,-0.5]} });
  W(slug,{slug,camera:{az:15,el:5},muscles:['obliques','abdominals'],props:dbProps(['L']),frames:{start:f(0),end:f(28)}}); }

// ---- seated twist
{ const slug='seated-barbell-twist';
  const f=(tw)=>({root:{pos:[0,0.54,0.28],pitch:0},spine:{flex:0,twist:tw},neck:{flex:0},
   legL:{pos:[0.18,0,0.78],anchor:'sole',yaw:4,pole:[0.1,0,1]},legR:{pos:[-0.18,0,0.78],anchor:'sole',yaw:-4,pole:[-0.1,0,1]},...bar()});
  W(slug,{slug,camera:{az:20,el:25},muscles:['obliques','abdominals'],props:[{type:'flat-bench'},{type:'barbell',hands:true,plates:[10]}],floats:false,frames:{start:f(40),end:f(-40)}}); }
