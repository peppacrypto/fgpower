import fs from 'fs';
const leg = (s,o,dz=0) => ({ pos:[o.sx*s,0,0.02+dz], anchor:'sole', yaw:o.yaw*s, pitch:0, pole:[o.px*s,0,1] });
const std = {sx:0.2,yaw:18,px:0.38};
const up = {y:0.915,z:-0.03,pitch:4,nk:-3,sp:0};
const low = {y:0.5,z:-0.2,pitch:24,sp:-2,nk:-6};
const root = p => ({ pos:[0,p.y,p.z], pitch:p.pitch });
// front rack: clean grip, fingers under the bar, elbows high
const V=JSON.parse(process.env.V||'{}');
const rack = s => ({ pos:(V.pos||[0.2,0.2,0.13]).map((v,i)=>i==0?v*s:v), rel:'chest', fingers:(V.f||[0,0.1,-1]), palm:(V.p||[0,1,0.1]), hand:'grip', grip:0.014,
  pole:(V.pole||[0.1,-0.2,1]).map((v,i)=>i==0?v*s:v), scap:{elev:0,prot:0.5} });
const frame = (p,o,armFn) => ({ root:root(p), spine:{flex:p.sp}, neck:{flex:p.nk}, legL:leg(1,o), legR:leg(-1,o), ...armFn(p) });
const write = s => fs.writeFileSync(new URL(`../${s.slug}.json`, import.meta.url), JSON.stringify(s,null,1));
const rackArms = () => ({ armL:rack(1), armR:rack(-1) });
const bar = [{type:'barbell',hands:true,plates:[20,10]}];
const M = ['quadriceps','glutes'];

write({ slug:'front-barbell-squat', camera:{az:45,el:6}, muscles:M, props:bar,
  frames:{ start:frame(up,std,rackArms), end:frame(low,std,rackArms) } });
write({ slug:'front-squat-clean-grip', camera:{az:45,el:6}, muscles:M, props:bar,
  frames:{ start:frame(up,std,rackArms), end:frame(low,std,rackArms) } });

// to a bench: bench behind, touch it
const lowB = {...low, y:0.52, z:-0.24};
write({ slug:'front-barbell-squat-to-a-bench', camera:{az:50,el:6}, muscles:M,
  props:[...bar,{type:'flat-bench',pos:[0,0,-0.4],yaw:90,height:0.42}],
  frames:{ start:frame(up,std,rackArms), end:frame(lowB,std,rackArms) } });

// frankenstein: arms straight out, bar across the front of the shoulders and throat
const fk = s => ({ fk:{flex:80,abd:8*1,rot:0,elbow:0}, rel:'chest', hand:'relaxed' });
const frArms = () => ({ armL:fk(1), armR:fk(-1) });
write({ slug:'frankenstein-squat', camera:{az:50,el:6}, muscles:M,
  props:[{type:'barbell',follow:'chest',at:[0,0.2,0.16],dir:[1,0,0],up:[0,1,0],plates:[20,10]}],
  frames:{ start:frame(up,std,frArms), end:frame(low,std,frArms) } });

// zercher: bar in the crook of the elbows, hands clasped at the chest
const zarm = s => ({ fk:{flex:40,abd:-10,rot:0,elbow:140}, rel:'chest', hand:'fist' });
const zArms = () => ({ armL:zarm(1), armR:zarm(-1) });
write({ slug:'zercher-squats', camera:{az:40,el:8}, muscles:M,
  props:[{type:'barbell',follow:'chest',at:[0,-0.1,0.2],dir:[1,0,0],up:[0,1,0],plates:[20,10]}],
  frames:{ start:frame(up,std,zArms), end:frame({...low,pitch:28},std,zArms) } });

// overhead squat: wide snatch grip, locked arms, bar over mid foot (world coordinates)
const oh = (s,y) => ({ pos:[0.46*s,y,-0.02], rel:'world', fingers:[0,0.55,-0.83].map((v,i)=>i==0?0:v), palm:[0,0.83,0.55],
  hand:'grip', grip:0.014, pole:[s,0.2,0] });
const ohF = (p,y,o) => frame(p,o,() => ({ armL:oh(1,y), armR:oh(-1,y) }));
const wide = {sx:0.3,yaw:28,px:0.55};
write({ slug:'overhead-squat', camera:{az:40,el:8}, muscles:['quadriceps','shoulders','glutes'], props:bar,
  frames:{ start:ohF(up,1.78,wide), end:ohF({y:0.46,z:-0.2,pitch:28,sp:-2,nk:-6},1.27,wide) } });
