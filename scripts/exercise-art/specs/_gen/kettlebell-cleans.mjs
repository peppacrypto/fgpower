import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, tempo:{lift:'there',up:0.8,down:1.3,hold:0.4}, ...s}, null, 1));
const nrm = v => { const l=Math.hypot(...v); return v.map(x=>x/l); };
const legs = { legL:{pos:[0.2,0,0.02],anchor:'sole',yaw:14,pitch:0,pole:[0.3,0,1]}, legR:{pos:[-0.2,0,0.02],anchor:'sole',yaw:-14,pitch:0,pole:[-0.3,0,1]} };
const X = (v,s)=>[v[0]*s,v[1],v[2]];
const arm = (s,pos,f,p,pole)=>({pos:X(pos,s),contact:true,fingers:nrm(f),palm:nrm(X(p,s)),curl:0.85,pole:X(pole,s)});
const pose = {
  hang:  s=>arm(s,[0.12,0.6,0.15],[0,-1,0.17],[0,-0.17,-1],[0.3,-0.5,-1]),
  carry: s=>arm(s,[0.42,0.92,0.05],[0,-1,0.17],[0,-0.17,-1],[0.3,-0.5,-1]),
  hang3: s=>arm(s,[0.26,0.8,0.12],[0,-1,0.17],[0,-0.17,-1],[0.5,-0.5,-1]),
  hang4: s=>arm(s,[0.2,0.6,0.2],[0,-1,0.17],[0,-0.17,-1],[0.3,-0.5,-1]),
  hang2: s=>arm(s,[0.12,0.62,0.22],[0,-1,0.17],[0,-0.17,-1],[0.3,-0.5,-1]),
  low:   s=>arm(s,[0.12,0.42,0.12],[0,-1,0.17],[0,-0.17,-1],[0.3,-0.5,-1]),
  floor: s=>arm(s,[0.12,0.27,0.19],[0,-1,0.17],[0,-0.17,-1],[0.3,-0.5,-1]),
  pull:  s=>arm(s,[0.18,1.02,0.26],[0,-0.34,0.94],[0,-0.94,-0.34],[0.5,-0.8,-0.4]),
  catch: s=>arm(s,[0.18,1.31,0.22],[0,0.7,0.7],[-0.7,-0.5,0.3],[0.15,-1,-0.1]),
  rack:  s=>arm(s,[0.18,1.41,0.15],[0,1,0.12],[-0.9,-0.05,-0.45],[0.2,-1,-0.1]),
};
const rest = s=>({fk:{flex:8,abd:16,elbow:5},curl:0.2});
const body = {
  hinge:{root:{pos:[0,0.82,-0.27],pitch:50},neck:{flex:-42}},
  high: {root:{pos:[0,0.84,-0.2],pitch:42},neck:{flex:-34}},
  deep: {root:{pos:[0,0.64,-0.22],pitch:52},neck:{flex:-42}},
  pull: {root:{pos:[0,0.925,-0.02],pitch:0},neck:{flex:0}},
  stand:{root:{pos:[0,0.925,0],pitch:-2},neck:{flex:0}},
};
const kb2 = mode=>({type:'kettlebell',kg:16,hands:true,mode});
const kb = (hand,mode)=>({type:'kettlebell',kg:16,hand,mode});
const F = (b,aL,aR,props)=>({...body[b],...legs,armL:aL,armR:aR,props});
const R = s=>rest(s);
// two arms
const two = (st,startPose,mode0='hang')=>({camera:{az:50,el:8},muscles:['shoulders'],
  frames:{
   start:F(st,pose[startPose](1),pose[startPose](-1),[kb('L',mode0),kb('R',mode0)]),
   mid:F('pull',pose.pull(1),pose.pull(-1),[kb('L','hang'),kb('R','hang')]),
   mid2:F('stand',pose.catch(1),pose.catch(-1),[kb('L','rack'),kb('R','rack')]),
   end:F('stand',pose.rack(1),pose.rack(-1),[kb('L','rack'),kb('R','rack')])}});
W('two-arm-kettlebell-clean',two('hinge','hang'));
// one arm (left working)
const one = (st,sp,mus=['hamstrings'],ext=false)=>({camera:{az:50,el:8},muscles:mus,muscleSide:'L',
  frames: ext ? {
   start:F(st,pose[sp](1),R(-1),[kb('L','hang')]),
   mid:F('high',pose.hang2(1),R(-1),[kb('L','hang')]),
   mid2:F('pull',pose.pull(1),R(-1),[kb('L','hang')]),
   mid3:F('stand',pose.catch(1),R(-1),[kb('L','rack')]),
   end:F('stand',pose.rack(1),R(-1),[kb('L','rack')])} : {
   start:F(st,pose[sp](1),R(-1),[kb('L','hang')]),
   mid:F('pull',pose.pull(1),R(-1),[kb('L','hang')]),
   mid2:F('stand',pose.catch(1),R(-1),[kb('L','rack')]),
   end:F('stand',pose.rack(1),R(-1),[kb('L','rack')])}});
W('one-arm-kettlebell-clean',one('hinge','hang'));
W('kettlebell-hang-clean',one('high','hang2',['hamstrings'],true));
W('kettlebell-dead-clean',one('deep','floor',['hamstrings'],true));
// alternating: L rack + R hang  <->  R rack + L hang, via both hanging low
const altp=s=>arm(s,[0.22,1.15,0.38],[0,0.4,0.9],[-0.7,-0.6,0.1],[0.5,-0.9,-0.3]);
const lowm=s=>arm(s,[0.3,0.85,0.2],[0,-0.7,0.7],[0,-0.7,-0.7],[0.4,-0.9,-0.4]);
const pm=s=>arm(s,[0.18,1.17,0.24],[0,0.2,0.98],[-0.35,-0.8,0],[0.3,-0.95,-0.2]);
const alt = ()=>({camera:{az:50,el:8},muscles:['hamstrings'],
  frames:{
   start:F('high',pose.hang2(1),pose.hang2(-1),[kb('L','hang'),kb('R','hang')]),
   mid:F('hinge',pose.hang4(1),pose.hang4(-1),[kb('L','hang'),kb('R','hang')]),
   mid2:F('pull',pose.pull(1),pose.carry(-1),[kb('L','hang'),kb('R','hang')]),
   mid3:F('stand',pose.catch(1),pose.carry(-1),[kb('L','rack'),kb('R','hang')]),
   end:F('stand',pose.rack(1),pose.carry(-1),[kb('L','rack'),kb('R','hang')])}});
const dbl = ()=>({camera:{az:50,el:8},muscles:['hamstrings'],
  frames:{
   start:F('stand',pose.rack(1),pose.carry(-1),[kb('L','rack'),kb('R','hang')]),
   mid:F('stand',pose.catch(1),pose.carry(-1),[kb('L','rack'),kb('R','hang')]),
   mid2:F('pull',pose.pull(1),pose.pull(-1),[kb('L','hang'),kb('R','hang')]),
   mid3:F('stand',pose.carry(1),pose.catch(-1),[kb('L','hang'),kb('R','rack')]),
   end:F('stand',pose.carry(1),pose.rack(-1),[kb('L','hang'),kb('R','rack')])}});
W('alternating-hang-clean',alt());
W('double-kettlebell-alternating-hang-clean',dbl());
// bottoms-up: bell upside down above the fist
const bu = {pos:[0.17,1.38,0.13],contact:true,fingers:[0,1,0.05],palm:[-0.2,0.1,1],curl:0.9,pole:[0.2,-1,-0.1]};
const bk = pose.hang(1);
W('bottoms-up-clean-from-the-hang-position',{camera:{az:50,el:8},muscles:['forearms'],muscleSide:'L',
  frames:{
   start:F('hinge',bk,R(-1),[kb('L','hang')]),
   mid:F('pull',pose.pull(1),R(-1),[kb('L','hang')]),
   end:F('stand',bu,R(-1),[kb('L','hang')])}});
// open palm
const mid2p=s=>({pos:[0.15*s,1.2,0.36],contact:true,fingers:[0,0.6,0.8],palm:[0,0.5,-0.85],curl:0.5,pole:[0.5*s,-1,-0.3]});
const m3p=s=>({pos:[0.14*s,1.28,0.38],contact:true,fingers:[0,0.3,0.95],palm:[-0.6*s,0.65,-0.35],curl:0.4,pole:[0.5*s,-1,-0.3]});
const palm=(s)=>({pos:[0.12*s,1.3,0.4],contact:true,hand:'open',fingers:[0,0,1],palm:[0,1,0],curl:0.1,pole:[0.5*s,-1,-0.3]});
W('one-arm-open-palm-kettlebell-clean',{camera:{az:50,el:8},muscles:['hamstrings'],muscleSide:'L',
  frames:{
   start:F('hinge',pose.hang(1),R(-1),[kb('L','hang')]),
   mid:F('pull',pose.pull(1),R(-1),[kb('L','hang')]),
   mid2:F('stand',pose.catch(1),R(-1),[kb('L','rack')]),
   mid3:F('stand',m3p(1),R(-1),[kb('L','rack')]),
   end:F('stand',palm(1),R(-1),[kb('L','palm')])}});
const palmR={pos:[-0.12,1.2,0.38],hand:'open',fingers:[0,0,1],palm:[0,1,0],curl:0.1,pole:[-0.5,-1,-0.3]};
W('open-palm-kettlebell-clean',{camera:{az:50,el:8},muscles:['hamstrings'],muscleSide:'L',
  frames:{
   start:F('hinge',arm(1,[0.1,0.6,0.17],[0,-1,0.17],[0,-0.17,-1],[0.3,-0.5,-1]),arm(-1,[0.1,0.6,0.17],[0,-1,0.17],[0,-0.17,-1],[0.3,-0.5,-1]),[kb2('hang')]),
   mid:F('pull',pose.pull(1),pose.pull(-1),[kb2('hang')]),
   mid2:F('stand',pose.catch(1),pose.catch(-1),[kb('L','rack')]),
   mid3:F('stand',m3p(1),{...m3p(-1),contact:false},[kb('L','rack')]),
   end:F('stand',palm(1),palmR,[kb('L','palm')])}});
// dumbbell clean (neutral grip, from floor)
const db=(hand)=>({type:'dumbbell',kg:15,hand});
const dmd=s=>arm(s,[0.3,0.62,0.12],[0,-1,0.05],[-1,0,0],[0.5,-0.5,-1]);
const dfl=s=>arm(s,[0.35,0.32,0.1],[0,-1,0.05],[-1,0,0],[0.5,-0.5,-1]);
W('dumbbell-clean',{camera:{az:50,el:8},muscles:['hamstrings'],
  frames:{
   start:F('deep',dfl(1),dfl(-1),[db('L'),db('R')]),
   mid:F('high',dmd(1),dmd(-1),[db('L'),db('R')]),
   mid2:F('pull',pose.pull(1),pose.pull(-1),[db('L'),db('R')]),
   mid3:F('stand',pose.catch(1),pose.catch(-1),[db('L'),db('R')]),
   end:F('stand',pose.rack(1),pose.rack(-1),[db('L'),db('R')])}});
