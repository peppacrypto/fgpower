import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify(s,null,1));
const arm = (s, x, y, z, o={}) => ({
  pos:[x*s,y,z], contact:true, hand:'grip', grip:0.014,
  fingers:[(o.fx??0.05)*s, o.fy??1, o.fz??-0.12], palm:[0,o.py??0.12,o.pz??1],
  pole:[(o.px??0.7)*s, o.pey??-0.5, o.pz2??0.2], curl:0.82 });
// bench frame; o.floor lowers the body to the floor
const frame = (o) => {
  const f = { root:{pos:[0,o.ry??0.567,o.rz??0.2],pitch:-90}, neck:{flex:6}, spine:{flex:o.arch??-4},
    legL:{ pos:[0.22,0,o.fz0??0.74], anchor:'sole', pole:[0.3,1,0.3] },
    legR:{ pos:[-0.22,0,o.fz0??0.74], anchor:'sole', pole:[-0.3,1,0.3] } };
  if (o.legs) { f.legL={...f.legL,...o.legs}; f.legR={...f.legR,...o.legs,pos:[-o.legs.pos[0],o.legs.pos[1],o.legs.pos[2]],pole:[-o.legs.pole[0],o.legs.pole[1],o.legs.pole[2]]}; }
  f.armL = arm(1,o.x,o.y,o.z,o); f.armR = arm(-1,o.x,o.y,o.z,o); return f; };
const tucked = { pos:[0.33,0,0.56], pole:[0.3,1,0.3] };
const rackAt = (extra) => ({type:'power-rack', pos:[0,0,0.23], yaw:180, frameIgnore:true, ...extra});
const mk = (slug, o, muscles, extra={}) => {
  const s = { slug, camera:extra.cam ?? {az:40,el:8}, muscles, floats:true,
    props: extra.props ?? [ {type:'flat-bench', barY:1.02}, {type:'barbell',hands:true,plates:[20]} ],
    frames:{ start: frame({...o, y:o.top[0], z:o.top[1], pz2:o.topPole??-0.1}),
             end: frame({...o, y:o.bot[0], z:o.bot[1], pz2:o.botPole??0.2}) } };
  if (extra.hold) delete s.frames.end;
  if (extra.swap) { const e = s.frames.start; s.frames.start = s.frames.end; s.frames.end = e; }
  if (extra.mid) s.frames.mid = frame({...o, ...extra.mid});
  W(slug, s);
};
const pl = {x:0.40, top:[1.17,-0.24], bot:[0.74,-0.16], arch:-14, legs:tucked, ry:0.60, px:0.9, pey:-0.3, topPole:-0.1, botPole:0.1};
mk('bench-press-powerlifting', pl, ['chest','triceps']);
const chainProps = (lo) => [ {type:'flat-bench', barY:1.02}, {type:'barbell',hands:true,plates:[20]},
  {type:'chains',hands:true,x:0.97,length:1.55,base:[[0.97,0,-0.2],[-0.97,0,-0.2]]} ];
mk('bench-press-with-chains', pl, ['chest','triceps'], {props:chainProps()});
mk('board-press', {...pl, bot:[0.81,-0.16]}, ['triceps','chest'], {props:[ {type:'flat-bench', barY:1.02},
  {type:'press-board', boards:3, follow:'chest'}, {type:'barbell',hands:true,plates:[20]} ]});
mk('pin-presses', {...pl, top:[0.80,-0.18], bot:[1.17,-0.24], topPole:0.1, botPole:-0.1}, ['triceps','chest'],
  {props:[ {type:'flat-bench'}, rackAt({pinY:0.80, barY:1.02}), {type:'barbell',hands:true,plates:[20]} ]});
mk('reverse-band-bench-press', pl, ['triceps','chest'], {props:[ {type:'flat-bench'}, rackAt({barY:1.02}),
  {type:'barbell',hands:true,plates:[20]},
  {type:'bar-bands',hands:true,to:'top',x:0.69,pegs:[[0.6875,2.18,-0.24],[-0.6875,2.18,-0.24]],rest:0.42} ]});
// floor press: body on the floor, root 0.447 lower than on the bench
const fl = {x:0.36, top:[0.74,-0.22], bot:[0.34,-0.17], ry:0.125, arch:-4, legs:{pos:[0.2,0,0.62],pole:[0.3,1,0.3]}, px:1.2, pey:-0.2, topPole:0, botPole:0.1};
const flProps = (more=[]) => [ rackAt({barY:0.76}), {type:'barbell',hands:true,plates:[20]}, ...more ];
mk('floor-press', fl, ['triceps','chest'], {props:flProps()});
mk('floor-press-with-chains', fl, ['triceps','chest'], {props:flProps([{type:'chains',hands:true,x:0.97,length:1.2,base:[[0.97,0,-0.2],[-0.97,0,-0.2]]}])});
// one arm floor press: bar in the left hand, neutral grip, right hand at the side
{
  const h = (y,z) => ({pos:[0.22,y,z],contact:true,hand:'grip',grip:0.014,fingers:[0,0.95,-0.3],palm:[-1,0,0],pole:[1,-0.3,0.1],curl:0.82});
  const fr = (y,z) => ({root:{pos:[0,0.125,0.2],pitch:-90},neck:{flex:6},spine:{flex:-3},
    armL:h(y,z),
    armR:{pos:[-0.26,0.03,0.3],rel:'world',contact:true,hand:'flat',fingers:[0,0,1],palm:[0,-1,0],pole:[-1,-0.3,0]},
    legL:{pos:[0.2,0,0.55],anchor:'sole',pole:[0.2,1,0.3]}, legR:{pos:[-0.2,0,0.55],anchor:'sole',pole:[-0.2,1,0.3]}});
  W('one-arm-floor-press',{slug:'one-arm-floor-press',camera:{az:50,el:10},muscles:['triceps','chest'],muscleSide:'L',floats:true,
    props:[{type:'dumbbell',hand:'L'}],
    frames:{start:fr(0.74,-0.20),end:fr(0.34,-0.17)}});
}
// chain press and chain handle extension: handles with chains, flat bench
const chainsH = [{type:'flat-bench',pos:[0,0,0]},{type:'chains',hands:true,onHands:true,length:1.3,base:[[0.3,0,-0.26],[-0.3,0,-0.26]]}];
{
  const a = (s,x,y,z,pz) => ({pos:[x*s,y,z],contact:true,fingers:[0,0.97,0.2],palm:[0,-0.2,0.97],curl:0.85,pole:[s*1,-0.3,pz]});
  const fr = (y,x,z,pz) => ({root:{pos:[0,0.528,0.2],pitch:-90},neck:{flex:6},armL:a(1,x,y,z,pz),armR:a(-1,x,y,z,pz),
    legL:{pos:[0.2,0,0.72],anchor:'sole',yaw:0,pitch:0,pole:[0.2,1,0.4]},legR:{pos:[-0.2,0,0.72],anchor:'sole',yaw:0,pitch:0,pole:[-0.2,1,0.4]}});
  W('chain-press',{slug:'chain-press',camera:{az:56,el:12},muscles:['chest','triceps'],floats:true,props:chainsH,
    frames:{start:fr(1.17,0.27,-0.24,-0.3),end:fr(0.82,0.36,-0.24,-0.1)}});
}
{
  // lying extension: upper arms vertical (fk flex 90 in chest frame = up), forearm folds toward the head
  const a = (s,el) => ({fk:{flex:88,abd:8,rot:0,elbow:el},rel:'chest',hand:'fist',pron:60});
  const fr = (el) => ({root:{pos:[0,0.528,0.2],pitch:-90},neck:{flex:6},armL:a(1,el),armR:a(-1,el),
    legL:{pos:[0.2,0,0.72],anchor:'sole',yaw:0,pitch:0,pole:[0.2,1,0.4]},legR:{pos:[-0.2,0,0.72],anchor:'sole',yaw:0,pitch:0,pole:[-0.2,1,0.4]}});
  W('chain-handle-extension',{slug:'chain-handle-extension',camera:{az:60,el:12},muscles:['triceps'],floats:true,
    props:[{type:'flat-bench',pos:[0,0,0]},{type:'chains',hands:true,onHands:true,length:1.3,base:[[0.1,0,-0.3],[-0.1,0,-0.3]]}],
    frames:{start:fr(2),end:fr(115)}});
}
