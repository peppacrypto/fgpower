import fs from 'fs';
const leg = (s,o,dy=0,dz=0) => ({ pos:[o.sx*s,dy,0.02+dz], anchor:'sole', yaw:o.yaw*s, pitch:0, pole:[o.px*s,0,1] });
const arm = s => ({ pos:[0.33*s,0.215,-0.015], rel:'chest', contact:true, fingers:[-0.3*s,0.45,-0.85], palm:[0,0.97,0.2],
  curl:0.85, pole:[0.5*s,-0.7,-0.6], scap:{elev:0,prot:0} });
const std = {sx:0.2,yaw:18,px:0.38};
const fr = (o,p) => ({ root:{pos:[0,p.y,p.z],pitch:p.pitch}, spine:{flex:p.sp??0}, neck:{flex:p.nk??0},
  legL:leg(1,o,p.ly,p.lz), legR:leg(-1,o,p.ly,p.lz), armL:arm(1), armR:arm(-1) });
const up = {y:0.915,z:-0.03,pitch:4,nk:-3};
const par = {y:0.5,z:-0.3,pitch:36,sp:-4,nk:-8};
const BOX = 0.38;
const box = {type:'plyo-box',pos:[0,0,-0.4],height:BOX,width:0.6,depth:0.36,style:'wood'};
const bench = {type:'flat-bench',pos:[0,0,-0.4],height:BOX,yaw:90};
const bar = {type:'barbell',hands:true,plates:[20,10]};
const bandsF = {type:'bar-bands',hands:true,to:'floor',x:0.95,pegs:[[0.95,0.039,-0.15],[-0.95,0.039,-0.15]],rest:0.52};
const rack = {type:'power-rack',pos:[0,0,0.24]};
const bandsR = {type:'bar-bands',hands:true,to:'top',x:0.69,pegs:[[0.6875,2.18,-0.06],[-0.6875,2.18,-0.06]],rest:0.42};
const chains = {type:'chains',hands:true,x:0.97,base:[[0.97,0,-0.15],[-0.97,0,-0.15]]};
const write = (slug,props,frames,extra={}) => {
  const s = {slug,camera:{az:55,el:8},muscles:['quadriceps','glutes'],props:[...props],frames,...extra};
  fs.writeFileSync(new URL(`../${slug}.json`,import.meta.url),JSON.stringify(s,null,1));
};
const sq = (slug,props,extra={},bot=par) => {
  const f = {start:fr(std,up),end:fr(std,bot)};
  if (extra.mid) f.mid = fr(std,extra.mid);
  write(slug,[bar,...props],f,extra.spec);
};
const mid = {y:0.7,z:-0.17,pitch:20,sp:-2,nk:-6};
sq('box-squat',[box],{mid});
sq('barbell-squat-to-a-bench',[bench],{mid});
sq('box-squat-with-bands',[box,bandsF],{mid});
sq('box-squat-with-chains',[box,chains],{mid});
sq('speed-box-squat',[box,bandsF],{mid});
sq('reverse-band-box-squat',[rack,box,bandsR],{mid,spec:{camera:{az:42,el:8}}});
sq('reverse-band-power-squat',[rack,bandsR],{mid,spec:{camera:{az:42,el:8}}},{y:0.5,z:-0.3,pitch:36,sp:-4,nk:-8});
sq('squat-with-bands',[bandsF],{mid});
sq('squat-with-chains',[chains],{mid});
// kneeling
const FP = +(process.env.FP ?? 66);
const kn = (F,K,hy,hz,pitch,sp=0,nk=-3) => {
  const L = s => ({fk:{flex:F,abd:s*3,rot:0,knee:K},rel:'world',foot:{pitch:FP}});
  return { root:{pos:[0,hy,hz],pitch}, spine:{flex:sp}, neck:{flex:nk}, legL:L(1), legR:L(-1), armL:arm(1), armR:arm(-1) };
};
const kUp = kn(0,90,+(process.env.UY??0.485),0.0,2), kDn = kn(+(process.env.KF??70),+(process.env.KK??152),+(process.env.KY??0.25),-0.392,22,-4,-8), kMid = kn(30,115,+(process.env.MY??0.47),+(process.env.MZ??-0.215),12,-2,-6);
const kMid2 = kn(50,135,+(process.env.M2Y??0.38),-0.33,17,-3,-7);
write('kneeling-squat',[bar],{start:kUp,mid:kMid,mid2:kMid2,end:kDn},{muscles:['glutes','quadriceps'],camera:{az:60,el:8},qaAllow:{'rom:squat.top':'kneeling squat: the top is the tall kneel (hips over the knees), the shins stay on the floor, the rep never stands','rom:squat.depth':'kneeling squat ends with the glutes on the calves; the hip joint cannot drop to the knee joint with the shins on the floor'}});
// jump: sit on calves, explode to tall kneel, land feet flat, stand
const landF = kn(55,80,0.8,-0.14,22,-3,-6); landF.legL.foot.pitch=-25; landF.legR.foot.pitch=-25;
const standF = kn(0,0,0.93,-0.03,4,0,-3); standF.legL.foot.pitch=0; standF.legR.foot.pitch=0;
const air = kn(20,100,0.78,-0.05,6,0,-4); air.legL.foot.pitch=10; air.legR.foot.pitch=10;
const land=landF; land.legL.foot.pitch=+(process.env.LP??-25); land.legR.foot.pitch=land.legL.foot.pitch; const stand=standF; stand.root.pos[2]=+(process.env.SZ??0.04);
write('kneeling-jump-squat',[bar],{start:kDn,mid:kMid,mid2:air,mid3:land,end:stand},{muscles:['glutes','quadriceps'],camera:{az:60,el:8}});
