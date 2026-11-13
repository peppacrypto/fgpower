import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const mat = {type:'floor-mat'};
// butterfly legs: soles together, knees open
const FR=+(process.env.FR||-40);
const KP=JSON.parse(process.env.KP||'[0.6,0.8,0]');
const fly = (kp=KP,fz=0.42) => ({
  legL:{pos:[0.05,0.09,fz],anchor:'ankle',pole:kp,pitch:+(process.env.FP||0),roll:FR,yaw:+(process.env.FY||0)},
  legR:{pos:[-0.05,0.09,fz],anchor:'ankle',pole:[-kp[0],kp[1],kp[2]],pitch:+(process.env.FP||0),roll:-FR,yaw:-(process.env.FY||0)} });
const sit = (pitch=0, y=0.125, z=0) => ({pos:[0,y,z],pitch});
const BP=JSON.parse(process.env.BP||"[0.7,0.75,-0.1]");
const POLE=JSON.parse(process.env.POLE||'[0.6,0.9,-0.3]');
const onFeet = s => ({pos:[0.08*s,+(process.env.HY||0.22),0.47],hand:'relaxed',fingers:JSON.parse(process.env.OF||'[0,-0.8,1]'),palm:[0,-1,0],curl:0.4,pole:[POLE[0]*s,POLE[1],POLE[2]]});
const behindHead = s => ({pos:[0.11*s,0.0,-0.06],rel:'head',hand:'relaxed',fingers:[-s*0.3,0.2,-1],palm:[0,-0.3,1],curl:0.5,pole:[s,0.1,-0.1]});
// butterfly: heels ~25 cm from the groin, knees dropped out and down, hands on the feet, hinge from the hips
const KO=JSON.parse(process.env.KO||'[0.5,0.87,0]');
const onFeet2 = (s,z=0.36) => ({pos:[0.05*s,+(process.env.HY2||0.2),z+0.02],hand:'relaxed',fingers:[0,-0.8,1],palm:[0,-1,0],curl:0.4,pole:[s*1,-0.2,-0.2]});
const bf = (pitch,flex,nk,hz) => ({root:sit(pitch,0.125,0),spine:{flex},neck:{flex:nk},...fly(KO,+(process.env.FZ||0.4)),armL:{fk:{flex:0,abd:+(process.env.AB||50),elbow:+(process.env.EL||40)},rel:'chest',hand:'relaxed',pron:+(process.env.PRON||0)},armR:{fk:{flex:0,abd:+(process.env.AB||45),elbow:+(process.env.EL||40)},rel:'chest',hand:'relaxed',pron:+(process.env.PRON||0)}});
W('bound-angle-pose',{camera:{az:70,el:10},muscles:['adductors'],props:[mat],frames:{
  start:bf(0,0,0,0.36), end:bf(+(process.env.BP1||0),22,-10,0.36)}});
W('groin-and-back-stretch',{camera:{az:70,el:10},muscles:['adductors','spinal-erectors'],props:[mat],frames:{
  start:bf(0,0,0,0.36), end:bf(+(process.env.GP1||0),28,-12,0.36)}});
// overhead: right arm straight up by the ear, bend left, left hand on the floor
const OHL=JSON.parse(process.env.OHL||'{"pos":[0.42,0.0,0.0],"contact":true,"hand":"flat","fingers":[1,0,0.2],"palm":[0,-1,0],"pole":[1,0.2,-0.5]}');
const upArm = {fk:{flex:+(process.env.UF||172),abd:+(process.env.UA||14),elbow:4},rel:'chest',hand:'relaxed',curl:0.2};
W('seated-overhead-stretch',{camera:{az:+(process.env.OAZ||0),el:6},muscles:['obliques','abdominals'],props:[mat],frames:{
  start:{root:{pos:[0,0.125,0],pitch:0},spine:{side:+(process.env.OS0||14)},...fly(KO,+(process.env.FZ||0.4)),armL:OHL,armR:upArm},
  end:{root:{pos:[0,0.125,0],pitch:0},spine:{side:+(process.env.OS||26)},...fly(KO,+(process.env.FZ||0.4)),armL:OHL,armR:upArm}}});
// twist family: left leg long, right foot outside left thigh
const twistLegs = {legL:{pos:[+(process.env.LX||0.08),0.08,0.86],anchor:'ankle',pole:[0,1,0],pitch:-80},
  legR:{pos:[+(process.env.RX||0.36),0,+(process.env.RZ||0.5)],anchor:'sole',pole:JSON.parse(process.env.RP||'[-0.1,1,0.4]')}};
const twist = (tw, fl, lean=0) => ({root:{pos:[0,0.125,+(process.env.RTZ||0)],pitch:lean+(+process.env.LN||-19)},spine:{twist:tw,flex:fl},neck:{twist:tw*0.3},...twistLegs,
  armR:{pos:[-(process.env.AX||0.2),0.0,+(process.env.AZ||-0.12)],contact:true,hand:'flat',fingers:JSON.parse(process.env.AF||'[-0.9,0,-0.3]'),palm:JSON.parse(process.env.PM||'[0.5,-0.85,0]'),pole:JSON.parse(process.env.AP||'[-1,0.5,-0.2]')},
  armL:{pos:JSON.parse(process.env.LP||'[-0.05,0.46,0.36]'),hand:'relaxed',fingers:[-1,-0.3,0],palm:[0,-0.3,-1],curl:0.4,pole:[1,-0.3,-0.2]} });
W('seated-spinal-twist',{camera:{az:145,el:20},muscles:['spinal-erectors','obliques'],props:[mat],frames:{
  start:twist(-10,0),end:twist(+(process.env.T1||-56),+(process.env.F1||12),+(process.env.L1||4))}});
W('dancers-stretch',{camera:{az:125,el:18},muscles:['spinal-erectors','obliques'],props:[mat],frames:{
  start:twist(-10,0),end:twist(+(process.env.T2||-56),12,+(process.env.DL||4))}});
// chair
const chair = {type:'chair',pos:[0,0,-0.12]};
const feet = {legL:{pos:[0.14,0,0.28],anchor:'sole',pole:[0.07,0,1]},legR:{pos:[-0.14,0,0.28],anchor:'sole',pole:[-0.07,0,1]}};
const cr = (extra={},pitch=0,z=-0.15,y=0.58)=>({root:{pos:[0,y,z],pitch},...feet,...extra});
const headHands = (s,up=0.0)=>({pos:[0.12*s,0.0,-0.06],rel:'head',hand:'relaxed',fingers:[-s*0.3,0.2,-1],palm:[0,-0.3,1],curl:0.5,pole:[s,0.1,-0.1]});
W('spinal-stretch',{camera:{az:20,el:12},muscles:['middle-back','obliques'],props:[chair],frames:{
  start:cr({neck:{flex:0},armL:headHands(1),armR:headHands(-1)}),
  mid:cr({spine:{twist:45},neck:{flex:0},armL:headHands(1),armR:headHands(-1)}),
  end:cr({spine:{twist:40,flex:12},neck:{flex:3},armL:headHands(1),armR:headHands(-1)},+(process.env.SP||14),-0.12)}});
const lbArm = {fk:{flex:172,abd:12,elbow:4},rel:'chest',curl:0.2};
const seatHand = {pos:[+(process.env.SX||0.2),0.46,+(process.env.SZ||-0.05)],contact:true,hand:'flat',fingers:JSON.parse(process.env.SF||'[1,0,0.3]'),palm:[0,-1,0],pole:[1,-0.2,-0.3],curl:0.2};
const lbA = {fk:{flex:+(process.env.LF||172),abd:+(process.env.LA||14),elbow:4},rel:'chest',curl:0.2};
W('chair-lower-back-stretch',{camera:{az:+(process.env.CAZ||0),el:8},muscles:['lats','obliques'],props:[chair],frames:{
  start:cr({root:{pos:[0,0.58,-0.15]},spine:{side:10},armR:lbA,armL:seatHand}),
  end:cr({root:{pos:[0,0.58,-0.15],roll:+(process.env.ER||0)},spine:{side:+(process.env.ES||22)},armR:lbA,armL:seatHand})}});
const PU=JSON.parse(process.env.PU||'[1,0.2,-0.5]');
const rail = s => ({pos:[0.2*s,0.87,-0.355],hand:'grip',grip:0.015,fingers:[0,-1,0.3],palm:[0,-0.3,-1],curl:0.85,pole:[PU[0]*s,PU[1],PU[2]]});
const bk = (fl,el) => ({fk:{flex:fl,abd:8,elbow:el},rel:'chest',hand:'grip',curl:0.8});
const bk2 = (fl,el) => ({fk:{flex:fl,abd:8,elbow:el},rel:'chest',hand:'grip',curl:0.8});
W('chair-upper-body-stretch',{camera:{az:60,el:8},muscles:['anterior-deltoid','chest'],props:[chair],frames:{
  start:cr({neck:{flex:0},armL:bk2(-35,30),armR:bk2(-35,30)},0,-0.1),
  end:cr({neck:{flex:-4},armL:bk2(-55,5),armR:bk2(-55,5)},6,0.0)}});
