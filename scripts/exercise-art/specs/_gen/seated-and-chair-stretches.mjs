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
W('bound-angle-pose',{camera:{az:70,el:10},muscles:['adductors'],props:[mat],frames:{
  start:{root:sit(0),spine:{flex:22},neck:{flex:0},...fly(BP,0.5),armL:onFeet(1),armR:onFeet(-1)},
  end:{root:sit(6,0.125,0.0),spine:{flex:40},neck:{flex:10},...fly(BP,0.5),armL:onFeet(1),armR:onFeet(-1)}}});
W('groin-and-back-stretch',{camera:{az:70,el:10},muscles:['adductors'],props:[mat],frames:{
  start:{root:sit(0),neck:{flex:0},...fly(),armL:behindHead(1),armR:behindHead(-1)},
  end:{root:sit(6,0.125,0.0),spine:{flex:44},neck:{flex:12},...fly(),armL:behindHead(1),armR:behindHead(-1)}}});
// overhead: right hand behind head, elbow up, left hand on floor, bend left
const OHL=JSON.parse(process.env.OHL||'{"pos":[0.34,0.0,-0.1],"contact":true,"hand":"flat","fingers":[1,0,0.2],"palm":[0,-1,0],"pole":[0.5,0.2,-1]}');
W('seated-overhead-stretch',{camera:{az:20,el:8},muscles:['abdominals','obliques'],props:[mat],frames:{
  start:{root:{pos:[0,0.125,0],pitch:0,roll:8},spine:{side:26},...fly(),armL:OHL,
    armR:{...behindHead(-1),pole:[-1,0.6,-0.1]}},
  end:{root:{pos:[0,0.125,0],pitch:0,roll:8},spine:{side:32},...fly(),armL:OHL,
    armR:{...behindHead(-1),pole:[-1,0.8,-0.1]}}}});
// twist family: left leg long, right foot outside left thigh
const twistLegs = {legL:{pos:[+(process.env.LX||0.08),0.08,0.86],anchor:'ankle',pole:[0,1,0],pitch:-80},
  legR:{pos:[+(process.env.RX||0.36),0,+(process.env.RZ||0.5)],anchor:'sole',pole:JSON.parse(process.env.RP||'[-0.1,1,0.4]')}};
const twist = (tw, fl, lean=0) => ({root:{pos:[0,0.125,+(process.env.RTZ||0)],pitch:lean+(+process.env.LN||-19)},spine:{twist:tw,flex:fl},neck:{twist:tw*0.3},...twistLegs,
  armR:{pos:[-(process.env.AX||0.2),0.0,+(process.env.AZ||-0.12)],contact:true,hand:'flat',fingers:JSON.parse(process.env.AF||'[-0.9,0,-0.3]'),palm:JSON.parse(process.env.PM||'[0.5,-0.85,0]'),pole:JSON.parse(process.env.AP||'[-1,0.5,-0.2]')},
  armL:{pos:JSON.parse(process.env.LP||'[-0.05,0.46,0.36]'),hand:'relaxed',fingers:[-1,-0.3,0],palm:[0,-0.3,-1],curl:0.4,pole:[1,-0.3,-0.2]} });
W('seated-spinal-twist',{camera:{az:145,el:20},muscles:['spinal-erectors','obliques'],props:[mat],frames:{
  start:twist(-10,0),end:twist(+(process.env.T1||-56),+(process.env.F1||12),+(process.env.L1||4))}});
W('dancers-stretch',{camera:{az:145,el:20},muscles:['spinal-erectors','obliques'],props:[mat],frames:{
  start:twist(-10,0),end:twist(+(process.env.T2||-50),12,+(process.env.DL||4))}});
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
const seatHand = {pos:[+(process.env.SX||0.22),0.48,+(process.env.SZ||0)],contact:true,hand:'flat',fingers:JSON.parse(process.env.SF||'[1,0,0.3]'),palm:[0,-1,0],pole:[1,-0.2,-0.3],curl:0.2};
W('chair-lower-back-stretch',{camera:{az:15,el:8},muscles:['lats','obliques'],props:[chair],frames:{
  start:cr({root:{pos:[0,0.58,-0.15],roll:-12},spine:{side:-6},armR:{fk:{flex:172,abd:12,elbow:4},rel:'chest',curl:0.2},armL:seatHand}),
  end:cr({root:{pos:[+(process.env.EX||-0.03),0.58,-0.15],roll:+(process.env.ER||-20)},spine:{side:+(process.env.ES||-14)},armR:{fk:{flex:172,abd:12,elbow:4},rel:'chest',curl:0.2},armL:seatHand})}});
const PU=JSON.parse(process.env.PU||'[1,0.2,-0.5]');
const rail = s => ({pos:[0.2*s,0.87,-0.355],hand:'grip',grip:0.015,fingers:[0,-1,0.3],palm:[0,-0.3,-1],curl:0.85,pole:[PU[0]*s,PU[1],PU[2]]});
const bk = (fl,el) => ({fk:{flex:fl,abd:8,elbow:el},rel:'chest',hand:'grip',curl:0.8});
W('chair-upper-body-stretch',{camera:{az:60,el:8},muscles:['shoulders','anterior-deltoid'],props:[chair],frames:{
  start:cr({armL:bk(-50,70),armR:bk(-50,70)},0,-0.02),
  end:cr({neck:{flex:-8},armL:bk(-64,6),armR:bk(-64,6)},16,0.04)}});
