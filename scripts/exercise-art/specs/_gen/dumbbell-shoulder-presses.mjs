import fs from 'fs';
const out=(slug,s)=>fs.writeFileSync(new URL(`../${slug}.json`,import.meta.url),JSON.stringify(s,null,1));
const R=d=>d*Math.PI/180;
// torso: seated (backrest 80) or standing. sh = shoulder centre height, sz = shoulder z
const SEAT={root:{pos:[0,0.55,0.15],pitch:-10},sy:0.55+0.46*Math.cos(R(10)),sz:0.15-0.46*Math.sin(R(10)),
  legs:{legL:{pos:[0.17,0,0.62],anchor:'sole',pole:[0.1,1,0.6]},legR:{pos:[-0.17,0,0.62],anchor:'sole',pole:[-0.1,1,0.6]}}};
const STAND={root:{pos:[0,0.92,0]},sy:1.38,sz:0,
  legs:{legL:{pos:[0.12,0,0],anchor:'sole',pole:[0.1,0.3,1]},legR:{pos:[-0.12,0,0],anchor:'sole',pole:[-0.1,0.3,1]}}};
// hand poses (left hand; right mirrored). dy,dz relative to shoulder.
const P={
  // Rule (2026-11-07): the hand directly above the elbow, forearm vertical under the dumbbell seen from the front, elbows a
  // little in front of the trunk (scapular plane), palms forward, handle level side to side, wrist only slightly back.
  // The old poses had the palm facing up (wrist bent back ~90) and the hands inside the elbows: crooked wrists.
  ear:  {x:0.44,dy:0.25,dz:0.13,f:[0,1,-0.15],p:[0,0.15,1],pole:[0.4,-0.9,0.1]},
  up:   {x:0.22,dy:0.675,dz:0.06,f:[0,1,-0.1],p:[0,0.1,1],pole:[1,-0.2,0]}, // near lockout: the arm itself is the line
  midp: {x:0.45,dy:0.36,dz:0.10,f:[0,1,-0.15],p:[0,0.15,1],pole:[0.55,-0.83,0.05]},
  chest:{x:0.16,dy:0.0,dz:0.30,f:[0,0.5,0.85],p:[0,0.85,-0.5],pole:[0.5,-1,0.2]},
  half: {x:0.27,dy:0.18,dz:0.2,f:[0,0.8,0.1],p:[-0.6,0.1,0.0],pole:[0.9,-0.6,0.1]},
  nin:  {x:0.30,dy:0.10,dz:0.04,f:[0,1,0],p:[-1,0,0],pole:[0.5,-0.7,-0.3]},
  upS:  {x:0.22,dy:0.685,dz:0.06,f:[0,1,-0.1],p:[0,0.1,1],pole:[1,-0.2,0]},
  nup:  {x:0.20,dy:0.68,dz:0.0, f:[0,1,0],p:[-1,0,0],pole:[0.9,-0.3,-0.3]},
};
const TH=+(process.env.TH||0);
const rot=(f,p,t)=>{const c=Math.cos(R(t)),s=Math.sin(R(t));const k=[p[1]*f[2]-p[2]*f[1],p[2]*f[0]-p[0]*f[2],p[0]*f[1]-p[1]*f[0]];return f.map((a,i)=>a*c+k[i]*s)};
for(const k of ['ear','up','upS','midp']){P[k].f=rot(P[k].f,P[k].p,TH);}
P.chest.f=rot(P.chest.f,P.chest.p,+(process.env.TC||-10));
const norm=v=>{const l=Math.hypot(...v);return v.map(a=>a/l)};
function arm(T,k,s,over={}){const h=P[k];const m=a=>[a[0]*s,a[1],a[2]];
  return {pos:[h.x*s,T.sy+h.dy,T.sz+h.dz],contact:true,hand:'grip',grip:0.016,fingers:m(h.f),palm:m(h.p),pole:m(h.pole),...over};}
function frame(T,L,R_,extra={}){return {root:{...T.root,...(extra.root||{})},neck:{flex:3},spine:extra.spine||{flex:0},...T.legs,armL:arm(T,L,1),armR:arm(T,R_,-1),...(extra.more||{})};}
const dbs=(n=2)=>[{type:'dumbbell',kg:15,hand:'L'},...(n>1?[{type:'dumbbell',kg:15,hand:'R'}]:[])];
const seatProps=[{type:'adjustable-bench',angle:80},...dbs()];
const cam={az:40,el:6};
// seated
for(const slug of ['seated-dumbbell-press','dumbbell-shoulder-press'])
 out(slug,{slug,camera:cam,muscles:['shoulders','triceps'],floats:true,props:seatProps,frames:{start:frame(SEAT,'ear','ear'),mid:frame(SEAT,'midp','midp'),end:frame(SEAT,'up','up')}});
// standing
out('standing-dumbbell-press',{slug:'standing-dumbbell-press',camera:cam,muscles:['shoulders','triceps'],props:dbs(),frames:{start:frame(STAND,'ear','ear'),mid:frame(STAND,'midp','midp'),end:frame(STAND,'up','up')}});
out('standing-palms-in-dumbbell-press',{slug:'standing-palms-in-dumbbell-press',camera:cam,muscles:['shoulders','triceps'],props:dbs(),frames:{start:frame(STAND,'nin','nin'),end:frame(STAND,'nup','nup')}});
// arnold
out('arnold-dumbbell-press',{slug:'arnold-dumbbell-press',camera:{az:35,el:6},muscles:['shoulders','triceps'],floats:true,props:seatProps,
  frames:{start:frame(SEAT,'chest','chest'),mid:frame(SEAT,'half','half'),end:frame(SEAT,'up','up')}});
// one arm seated: right hand rests on thigh
const restR={pos:[-0.2,0.635,0.25],contact:true,hand:'flat',fingers:[0,0.2,1],palm:[0,-1,0],pole:[-1,-0.5,-0.3]};
function one(slug,T,props,a,b,rest,extra={}){
  const f=k=>({root:{...T.root},neck:{flex:3},spine:{flex:0},...T.legs,armL:arm(T,k,1),armR:rest});
  out(slug,{slug,camera:cam,muscles:['shoulders','triceps'],muscleSide:'L',floats:!!extra.floats,props,frames:{start:f(a),end:f(b)}});}
one('dumbbell-one-arm-shoulder-press',SEAT,[{type:'adjustable-bench',angle:80},...dbs(1)],'ear','up',restR,{floats:true});
// standing palm-in one arm: right hand holds an incline bench beside the body
const bench={type:'adjustable-bench',angle:45,pos:[-0.95,0,0.0],yaw:-90};
one('standing-palm-in-one-arm-dumbbell-press',STAND,[bench,...dbs(1)],'nin','nup',{pos:[-0.36,1.05,0.0],contact:true,hand:'flat',fingers:[0,0,1],palm:[0,-1,0],pole:[-1,-0.3,-0.3]});
// alternating
{const slug='standing-alternating-dumbbell-press';const s=frame(STAND,'ear','ear');
 out(slug,{slug,camera:cam,muscles:['shoulders','triceps'],props:dbs(),frames:{start:s,mid:frame(STAND,'up','ear'),mid1:frame(STAND,'up','ear'),mid2:frame(STAND,'ear','up'),mid3:frame(STAND,'ear','up'),end:frame(STAND,'ear','ear')}});}
// see-saw: press left while bending right (away from working arm)
{const slug='see-saw-press-alternating-side-press';
 out(slug,{slug,camera:{az:20,el:6},muscles:['shoulders','obliques'],props:dbs(),
  frames:{start:frame(STAND,'chest','chest'),mid:frame(STAND,'half','chest',{spine:{side:-2}}),end:frame(STAND,'upS','chest',{spine:{side:-4}})}});}
