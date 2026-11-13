import fs from 'fs';
const W=(slug,s)=>fs.writeFileSync(new URL(`../${slug}.json`,import.meta.url),JSON.stringify({slug,...s},null,1));
const BALL={type:'medicine-ball',kg:6,hands:true};
const at=p=>({type:'medicine-ball',kg:6,at:p});
const hb=(s,c,f=[0,0.6,0.8],pole=[0.6,-0.8,-0.2],palm=[-s,0,0])=>({pos:[s*0.125+c[0],c[1],c[2]],contact:true,fingers:[s*f[0],f[1],f[2]],palm:[palm[0],palm[1],palm[2]],curl:0.25,pole:[s*pole[0],pole[1],pole[2]]});
const hold=(c,f,p,palm)=>({armL:hb(1,c,f,p,palm&&[palm[0],palm[1],palm[2]]),armR:hb(-1,c,f,p,palm&&[-palm[0],palm[1],palm[2]])});
const rel=(c,f=[0,0.1,1],p=[0.6,-0.8,-0.2],q=[-1,0,0])=>({armL:{pos:[0.17+c[0],c[1],c[2]],hand:'open',fingers:f,palm:q,pole:p},armR:{pos:[-0.17+c[0],c[1],c[2]],hand:'open',fingers:[-f[0],f[1],f[2]],palm:[-q[0],q[1],q[2]],pole:[-p[0],p[1],p[2]]}});
const stand=(zl=0.03,zr=0.03)=>({legL:{pos:[0.17,0,zl],anchor:'sole',yaw:12,pole:[0.25,0,1]},legR:{pos:[-0.17,0,zr],anchor:'sole',yaw:-12,pole:[-0.25,0,1]}});
const kleg=(z=-0.37)=>({legL:{pos:[0.12,0.2,z],anchor:'ankle',pole:[0,-1,0],pitch:80},legR:{pos:[-0.12,0.2,z],anchor:'ankle',pole:[0,-1,0],pitch:80}});
const fh=(s,x,z)=>({pos:[s*x,0,z],contact:true,hand:'flat',fingers:[0,0,1],palm:[0,-1,0],pole:[s,0.3,-0.4]});
const floors=z=>({armL:fh(1,0.2,z),armR:fh(-1,0.2,z)});
const sup=(r,sp,nk=8)=>({root:r,spine:sp,neck:{flex:nk},legL:{pos:[0.15,0,0.52],anchor:'sole',pole:[0.1,1,0.3]},legR:{pos:[-0.15,0,0.52],anchor:'sole',pole:[-0.1,1,0.3]}});
const P=(f,...props)=>({...f,props});

// 1 standing chest pass
W('medicine-ball-chest-pass',{camera:{az:90,el:6},tempo:{lift:'there',up:0.45,down:0.9},muscles:['chest','triceps'],frames:{
 start:P({root:{pos:[0,0.88,0],pitch:-2},...hold([0,1.2,0.27]),...stand(0.2,-0.2)},BALL),
 mid:P({root:{pos:[0,0.88,0],pitch:1},...hold([0,1.3,0.43],[0,0.4,0.9],[0.5,-0.5,-0.3]),...stand(0.2,-0.2)},BALL),
 end:P({root:{pos:[0,0.88,0],pitch:1},...rel([0,1.4,0.5]),...stand(0.2,-0.2)},at([0,1.45,0.95]))}});

// 2/3 kneeling chest push: explode, fall onto hands
const kl=()=>kleg(-0.4);
const KL=(y=0.2)=>({legL:{pos:[0.12,y,-0.4],anchor:'ankle',pole:[0,-1,0],pitch:80},legR:{pos:[-0.12,y,-0.4],anchor:'ankle',pole:[0,-1,0],pitch:80}});
const reach=(c)=>({armL:{pos:[0.2,c[0],c[1]],hand:'open',fingers:[0,-0.5,0.85],palm:[0,-0.85,-0.5],pole:[1,0.3,-0.4]},armR:{pos:[-0.2,c[0],c[1]],hand:'open',fingers:[0,-0.5,0.85],palm:[0,-0.85,-0.5],pole:[-1,0.3,-0.4]}});
const kfall=(slug,top,b2,b3)=>W(slug,{camera:{az:90,el:8},tempo:{lift:'there',up:0.5,down:1.6},muscles:['chest','triceps'],...top,frames:{
 start:P({root:{pos:[0,0.5,0.03],pitch:0},spine:{flex:0},...KL(),...hold([0,0.9,0.33])},BALL),
 mid:P({root:{pos:[0,0.5,0.06],pitch:14},spine:{flex:-4},...KL(),...hold([0,1.0,0.6],[0,0.4,0.9],[0.5,-0.5,-0.3])},BALL),
 mid2:P({root:{pos:[0,0.5,0.2],pitch:24},...KL(0.2),...rel([0,1.05,0.95],[0,-0.1,1],[0.6,-0.8,-0.2],[-1,0.2,0])},at(b2)),
 end:P({root:{pos:[0,0.5,0.2],pitch:30},...KL(0.2),...rel([0,0.8,0.7],[0,-0.1,1],[0.6,-0.8,-0.2],[-1,0.2,0])},at(b3))}});
kfall('chest-push-single-response',{},[0,1.4,1.3],[0,1.0,2.0]);
kfall('chest-push-multiple-response',{props:[{type:'wall',pos:[0,0,2.5],height:1.4,width:1.4,skirting:false}]},[0,1.4,1.3],[0,1.0,1.9]);

// 4 supine chest throw
{ const R={pos:[0,0.09,0],pitch:-90};
  W('supine-chest-throw',{camera:{az:75,el:12},muscles:['triceps','chest'],frames:{
   start:P({...sup(R,{flex:0}),...hold([0,0.34,-0.3],[0,0.65,-0.75],[1,-0.2,0.3])},BALL),
   mid:P({...sup(R,{flex:0}),...hold([0,0.5,-0.38],[0,0.8,-0.6],[1,-0.1,0.2])},BALL),
   end:P({...sup(R,{flex:0}),...rel([0,0.57,-0.4],[0,1,-0.2],[1,-0.3,0])},at([0,1.15,-0.4]))}}); }

// 5 supine two-arm overhead throw: arms behind head, sit up, throw forward
const ohA=(c)=>hold(c,[0,0.1,-1],[0.4,0.1,-0.6],[-1,0,0]);
W('supine-two-arm-overhead-throw',{camera:{az:90,el:10},tempo:{lift:'there',up:0.45,down:1.4},muscles:['abdominals'],frames:{
 start:P({...sup({pos:[0,0.115,0],pitch:-90},{flex:0},0),...ohA([0,0.16,-0.93])},BALL),
 mid:P({...sup({pos:[0,0.115,0],pitch:-86},{flex:2},2),...hold([0,0.62,-0.8],[0,0.6,-0.8],[0.4,-0.2,-0.3],[-1,0,0])},BALL),
 mid2:P({...sup({pos:[0,0.1,0],pitch:-76},{flex:8},4),...hold([0,0.8,-0.5],[0,1,0.1],[0.4,-0.4,-0.2],[-1,-0.3,0])},BALL),
 end:P({...sup({pos:[0,0.11,0],pitch:-45},{flex:10},2),...rel([0,0.95,-0.1],[0,0.3,1],[0.3,-0.9,-0.1],[-1,0.6,0])},at([0,1.15,0.9]))}});

// 6 supine one-arm overhead throw (left arm; right arm counterbalances)
{ const BL={type:'medicine-ball',kg:6,hand:'L'};
  const A=(flex,elbow,pron=0)=>({armL:{fk:{flex,abd:8,elbow},rel:'chest',hand:'open',pron}});
  const B=(flex,abd)=>({armR:{fk:{flex,abd,elbow:8},rel:'chest'}});
  W('supine-one-arm-overhead-throw',{camera:{az:90,el:10},tempo:{lift:'there',up:0.45,down:1.4},muscles:['abdominals','shoulders'],frames:{
   start:P({...sup({pos:[0,0.115,0],pitch:-90},{flex:0},0),...A(172,3),...B(10,20)},BL),
   mid:P({...sup({pos:[0,0.115,0],pitch:-86},{flex:2},2),...A(140,3),...B(30,20)},BL),
   mid2:P({...sup({pos:[0,0.1,0],pitch:-75},{flex:6},4),...A(110,5),...B(50,22)},BL),
   end:P({...sup({pos:[0,0.11,0],pitch:-45},{flex:10},2),...A(85,5),...B(60,22)},at([0,1.1,1.5]))}}); }

// chest-relative ball centre for a leaning torso
const cb=(z,y,pitch,up=0.3,fw=0.26)=>{const a=pitch*Math.PI/180;return [0,+(y+up*Math.cos(a)-fw*Math.sin(a)).toFixed(3),+(z+up*Math.sin(a)+fw*Math.cos(a)).toFixed(3)];};
const FP=[0.5,-0.7,-0.2];
// 7 return push from stance: catch then throw back (no partner drawn)
{ const st=(y,pitch)=>({root:{pos:[0,y,0],pitch},legL:{pos:[0.17,0,0.14],anchor:'sole',yaw:8,pole:[0.2,0.3,1]},legR:{pos:[-0.17,0,-0.14],anchor:'sole',yaw:-8,pole:[-0.2,0.3,1]},spine:{flex:6}});
  const cup=(z)=>({armL:{pos:[0.17,1.15,z],hand:'open',fingers:[0,0.4,0.9],palm:[-1,0.2,0.2],pole:[0.5,-0.7,-0.2]},armR:{pos:[-0.17,1.15,z],hand:'open',fingers:[0,0.4,0.9],palm:[1,0.2,0.2],pole:[-0.5,-0.7,-0.2]}});
  W('return-push-from-stance',{camera:{az:90,el:6},tempo:{lift:'there',up:0.4,down:1.2},muscles:['shoulders','chest'],frames:{
   start:P({...st(0.8,14),...cup(0.55)},at([0,1.15,1.4])),
   mid:P({...st(0.78,16),...hold(cb(0,0.78,16),[0,0.5,0.85],FP)},BALL),
   end:P({...st(0.82,12),...rel(cb(0,0.82,12,0.3,0.55),[0,0.2,1],[0.3,-0.9,-0.1],[-1,-0.9,0.3])},at([0,1.4,1.0]))}}); }

const wide=(h,d)=>({armL:{...h.armL,pos:[h.armL.pos[0]+d,h.armL.pos[1],h.armL.pos[2]]},armR:{...h.armR,pos:[h.armR.pos[0]-d,h.armR.pos[1],h.armR.pos[2]]}});
const ath=(z,y,pitch,fl,fr,sp=0)=>({root:{pos:[0,y,z],pitch},spine:{flex:sp},legL:fl,legR:fr});
const ft=(x,y,z,pitch=0,yaw=0)=>({pos:[x,y,z],anchor:'sole',pitch,yaw,pole:[x*1.6,0.4,1]});
// 8 chest push from 3 point stance: first step (R) draws ball to chest, second step (L) pushes; planted feet keep one spot, steps have a lifted frame (a foot that is lifted moves under 20 cm between key frames)
W('chest-push-from-3-point-stance',{camera:{az:90,el:8},tempo:{lift:'there',up:0.5,down:1.4},muscles:['chest','triceps'],frames:{
   start:P({...ath(0.0,0.48,68,ft(0.5,0,0.1,0,20),ft(-0.5,0,0.1,0,-20),22),neck:{flex:-35},armL:{pos:[0.3,0,0.4],contact:true,hand:'flat',fingers:[0.35,0,0.94],palm:[0,-1,0],pole:[0.6,-0.5,-0.3]},armR:{pos:[-0.03,0.253,0.56],contact:true,hand:'flat',fingers:[0,0,1],palm:[0,-1,0],pole:[-1,0.3,-0.3]}},at([0,0.125,0.56])),
   mid:P({...ath(0.03,0.66,52,ft(0.5,0,0.1,0,20),ft(-0.5,0.15,0.2,25)),...wide(hold([0,0.45,0.56],[0,-0.2,1],FP,[-1,-0.5,0]),0.015)},BALL),
   mid2:P({...ath(0.15,0.66,45,ft(0.5,0,0.1,0,20),ft(-0.5,0,0.35),8),...hold(cb(0.15,0.66,45,0.3,0.32),[0,0.3,1],FP,[-1,-0.4,0])},BALL),
   mid3:P({...ath(0.26,0.78,25,ft(0.45,0.2,0.28),ft(-0.5,0,0.35)),...hold(cb(0.26,0.78,25,0.3,0.4),[0,0.3,1],FP,[-1,-0.4,0])},BALL),
   end:P({...ath(0.36,0.8,12,ft(0.4,0,0.45),ft(-0.5,0,0.35)),...rel(cb(0.36,0.8,12,0.3,0.45),[0,0.2,1],[0.3,-0.9,-0.1],[-1,0,0])},at([0,1.5,1.5]))}});

// 9 chest push with run release: step 1 (R) draws to chest, step 2 (L) pushes, sprint away
W('chest-push-with-run-release',{camera:{az:90,el:8},tempo:{lift:'there',up:0.45,down:1.4},muscles:['chest','triceps'],frames:{
   start:P({...ath(0,0.74,32,ft(0.25,0,0.2),ft(-0.25,0,-0.1)),...hold([0,0.72,0.33],[0,-0.1,1],FP,[-1,-0.3,0])},BALL),
   mid:P({...ath(0.1,0.75,28,ft(0.25,0,0.2),ft(-0.25,0.2,0.05,25)),...hold(cb(0.1,0.75,28),[0,0.3,0.95],FP)},BALL),
   mid2:P({...ath(0.22,0.76,22,ft(0.25,0,0.2),ft(-0.25,0,0.25)),...hold(cb(0.22,0.76,22),[0,0.3,0.95],FP)},BALL),
   mid3:P({...ath(0.32,0.78,16,ft(0.25,0.25,0.38),ft(-0.25,0,0.25)),...hold(cb(0.32,0.78,16,0.3,0.42),[0,0.3,1],FP)},BALL),
   end:P({...ath(0.4,0.8,14,ft(0.25,0,0.55),ft(-0.25,0,0.25)),...rel(cb(0.4,0.8,14,0.3,0.4),[0,0.2,1],[0.3,-0.9,-0.1])},at([0,1.45,1.5]))}});
