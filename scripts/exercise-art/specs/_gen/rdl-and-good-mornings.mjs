import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify(s,null,1));
const legs = (o={}) => { const x=o.x??0.13, y=o.y??0, z=o.z??0, yw=o.yaw??6, p=o.p??0.2;
  return { legL:{pos:[x,y,z],anchor:'sole',yaw:yw,pole:[p,o.py??0,1]}, legR:{pos:[-x,y,z],anchor:'sole',yaw:-yw,pole:[-p,o.py??0,1]} }; };
const hands = (x,y,z,o={}) => { const a = s => ({pos:[x*s,y,z],contact:true,fingers:[0,-1,0],palm:[0,o.pyy??0,-1],pole:[0.4*s,0,-0.6],curl:0.82}); return {armL:a(1),armR:a(-1)}; };
// hinge frame: bar in hands. grip x
const hinge = (rootY, rootZ, pitch, hy, hz, lo={}, ho={}) => ({ root:{pos:[0,rootY,rootZ],pitch}, neck:{flex: pitch>30?-40:0}, ...hands(ho.x??0.235,hy,hz,ho), ...legs(lo) });
const stand = (hy=0.80, lo={}, ho={}) => hinge(lo.ry??0.925,0,0,hy,0.135,lo,ho);
// back-loaded: bar on rear shoulders (rel chest)
const back = (rootY, rootZ, pitch, lo={}) => { const a=s=>({pos:[0.33*s,0.215,-0.015],rel:'chest',contact:true,fingers:[0.02*s,0.97,-0.2],palm:[0,0.2,0.97],curl:0.85,pole:[0.1*s,-0.9,-1]});
  return { root:{pos:[0,rootY,rootZ],pitch}, neck:{flex: pitch>30?-30:0}, armL:a(1), armR:a(-1), ...legs(lo) }; };
const bb = {type:'barbell',hands:true,plates:[20]};
const barBack = {type:'barbell',follow:'chest',at:[0,0.215,-0.015],plates:[20]};
const mk = (slug, props, start, end, muscles, cam={az:90,el:8}, mid, extra={}) => W(slug, { slug, camera:cam, muscles, ...extra, props, frames:{start, ...(mid?{mid}:{}), end} });
const soft = {p:0.1};
mk('romanian-deadlift',[bb],stand(0.87,soft),hinge(0.86,-0.25,62,0.40,0.12,soft),['hamstrings','glutes'],undefined,hinge(0.89,-0.13,30,0.72,0.12,soft));
mk('stiff-legged-barbell-deadlift',[bb],stand(0.87,soft),hinge(0.885,-0.27,70,0.36,0.12,soft),['hamstrings','glutes'],undefined,hinge(0.90,-0.14,33,0.70,0.12,soft));
mk('romanian-deadlift-from-deficit',[{type:'deficit-platform',height:0.075},bb],stand(0.95,{y:0.075,ry:0.985,p:0.1}),hinge(0.965,-0.26,68,0.46,0.11,{y:0.075,p:0.1}),['hamstrings','glutes'],undefined,hinge(0.98,-0.14,33,0.79,0.13,{y:0.075,p:0.1}),{tempo:{lift:'back',up:1.0,down:1.8,squeeze:0.4,stretch:0.4}});
const ws={x:0.38,yaw:22,p:0.4};
mk('wide-stance-stiff-legs',[bb],stand(0.87,{...ws,ry:0.89}),hinge(0.86,-0.25,70,0.38,0.10,ws),['hamstrings','glutes'],undefined,hinge(0.88,-0.13,35,0.68,0.12,ws),{tempo:{lift:'back',up:1.0,down:1.8,squeeze:0.4,stretch:0.4}});
// dumbbells beside the legs
const dbh = (rootY,rootZ,pitch,hy,hz) => { const a=s=>({pos:[0.27*s,hy,hz],contact:true,fingers:[0,-1,0],palm:[-s,0,0],curl:0.85,pole:[0.15*s,0,-1]});
  return { root:{pos:[0,rootY,rootZ],pitch}, neck:{flex:pitch>30?-12:0}, armL:a(1), armR:a(-1), ...legs({x:0.11,p:0.1}) }; };
mk('stiff-legged-dumbbell-deadlift',[{type:'dumbbell',hand:'L',kg:15},{type:'dumbbell',hand:'R',kg:15}],dbh(0.925,0,0,0.88,0.09),dbh(0.885,-0.27,70,0.38,0.13),['hamstrings','glutes'],undefined,dbh(0.90,-0.14,35,0.70,0.10));
// good mornings
mk('good-morning',[barBack],back(0.915,0,3,soft),back(0.82,-0.36,85,soft),['hamstrings','spinal-erectors'],{az:90,el:8});
mk('stiff-leg-barbell-good-morning',[barBack],back(0.925,0,3,{p:0}),back(0.89,-0.30,85,{p:0}),['hamstrings','spinal-erectors']);
const rackP = [{type:'power-rack',barY:1.05,pinY:1.0},barBack];
mk('good-morning-off-pins',rackP,back(0.78,-0.30,75,soft),back(0.915,0,3,soft),['hamstrings','spinal-erectors'],{az:90,el:8});
mk('hanging-bar-good-morning',[...rackP,{type:'chains',hands:true}],back(0.78,-0.30,75,soft),back(0.915,0,3,soft),['hamstrings','spinal-erectors'],{az:90,el:8});
// seated on box
const seat = (pitch) => ({ root:{pos:[0,0.52,-0.15],pitch}, neck:{flex:pitch>30?-30:0}, ...back(0.52,-0.15,pitch).armL?{armL:back(0,0,0).armL,armR:back(0,0,0).armR}:{}, ...legs({x:0.17,z:0.30,yaw:12,p:0.4}) });
mk('seated-good-mornings',[{type:'squat-box',height:0.4,pos:[0,0,-0.15]},{type:'power-rack',barY:1.2,pinY:0.9},barBack],seat(2),seat(62),['spinal-erectors','glutes'],{az:90,el:8});
// kettlebell one-legged: copy single-leg-rdl, kettlebell in left hand
const sl = JSON.parse(fs.readFileSync(new URL('../single-leg-rdl.json', import.meta.url)));
sl.slug='kettlebell-one-legged-deadlift'; sl.props=[{type:'kettlebell',hand:'L',kg:12}];
const kb = (y,z)=>({pos:[0.29,y,z],contact:true,fingers:[0,-1,0],palm:[-0.3,0,1],curl:0.85,pole:[0.15,0,-1]});
sl.frames.start.armL=kb(0.86,0.09);
sl.frames.end.armL=kb(0.48,0.34);
sl.frames.mid={root:{pos:[0.035,0.92,-0.05],pitch:40},neck:{flex:-10},armL:kb(0.76,0.24),armR:sl.frames.start.armR,legL:sl.frames.start.legL,legR:{fk:{flex:-13,abd:0,knee:13},foot:{pitch:20}}};
W('kettlebell-one-legged-deadlift', sl);
