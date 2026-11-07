import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const rad = d => d*Math.PI/180, C = Math.cos, S = Math.sin;
const mir = (v, s) => s>0 ? v : [-v[0], v[1], v[2]];
// prone on bench with back rising toward +Z (bench yaw 180); angle a deg
const proneRoot = (a, t=0) => { const n=[C(rad(a)),-S(rad(a))], d=[S(rad(a)),C(rad(a))];
  return { pos:[0, 0.475+0.175*n[0]+t*d[0], 0.009+0.175*n[1]+t*d[1]], pitch:90-a }; };
const shoulder = (r, s) => { const p=rad(r.pitch); return [0.19*s, r.pos[1]+0.46*C(p), r.pos[2]+0.46*S(p)]; };
const legsProne = (r) => { const z=r.pos[2]-0.52; const f = s => ({ pos:[0.36*s,0,z], anchor:'ball', pitch:35, pole:[0.6*s,-1,0.3] });
  return { legL:f(1), legR:f(-1) }; };
const arm = (pos, s, fing, palm, pole, extra={}) => ({ pos:mir(pos,s), contact:true, fingers:mir(fing,s), palm:mir(palm,s), curl:0.85, pole:mir(pole,s), ...extra });
const HANG=[[0,-1,0],[-1,0,0]], DOWN=[[1,0.3,0],[0.3,-0.95,0]];
const db = kg => [{type:'dumbbell',hand:'L',kg},{type:'dumbbell',hand:'R',kg}];
const rel = (sh, s, dx, dy, dz) => [sh[0]+dx*s, sh[1]+dy, sh[2]+dz];
const nrm=v=>{const l=Math.hypot(...v);return v.map(x=>x/l)};
const lerp=(a,b,k)=>nrm(a.map((x,i)=>x+(b[i]-x)*k));
const RR=+(process.env.RR||0.55);const arcP=(sh,k)=>{const th=rad(15+72*k);return [sh[0]+RR*S(th),sh[1]-RR*C(th),sh[2]+0.02]};
const PV=JSON.parse(process.env.PV||"[0,-0.4,-1,0,-0.4,-1]");const POLE=k=>[PV[0]*(1-k)+PV[3]*k,PV[1]*(1-k)+PV[4]*k,PV[2]*(1-k)+PV[5]*k];
const ori=(keys,k)=>{const n=keys.length-1,x=Math.min(k*n,n-1e-9),i=Math.floor(x);return [lerp(keys[i][0],keys[i+1][0],x-i),lerp(keys[i][1],keys[i+1][1],x-i)]};
const armK=(sh,s,k,o0,o1,mid)=>{const o=ori(mid?[o0,mid,o1]:[o0,o1],mid?k:Math.min(1,k/0.5));return arm(arcP(sh,k),s,o[0],o[1],POLE(k))};
const incl = a => ({ type:'adjustable-bench', angle:a, yaw:180 });


const frames3 = (mk) => ({ start:mk(0), mid:mk(.25), mid2:mk(.5), mid3:mk(.75), end:mk(1) });
const both = (sh,k,o0,o1,one,m) => ({ armL:armK(sh,1,k,o0,o1,m), armR: one ? arm(arcP(sh,0),-1,HANG[0],HANG[1],POLE(0)) : armK(sh,-1,k,o0,o1,m) });
function flye(slug, a, muscles, {o0=HANG, o1=DOWN, one=false, m}={}) {
  const r = proneRoot(a,0.16), sh = shoulder(r,1);
  const mk = k => ({ root:r, neck:{flex:-20}, ...legsProne(r), ...both(sh,k,o0,o1,one,m) });
  W(slug, { camera:{az:one?60:140,el:12}, muscles, ...(one?{muscleSide:'L'}:{}), props:[incl(a),...(one?[{type:'dumbbell',hand:'L',kg:5}]:db(5))], frames:frames3(mk) });
}
flye('reverse-flyes',30,['posterior-deltoid','rhomboids']);
flye('reverse-flyes-with-external-rotation',30,['posterior-deltoid','rhomboids'],{o0:[[0,-1,0],[0,0,-1]],o1:[[1,0,0],[0,0.5,0.85]],m:[[0.85,-0.5,0],[-0.5,-0.85,0]]});
flye('dumbbell-lying-rear-lateral-raise',15,['posterior-deltoid','rhomboids']);
flye('dumbbell-lying-one-arm-rear-lateral-raise',15,['posterior-deltoid'],{one:true});
const flatRoot = {pos:[0,0.63,0.12],pitch:90};
function flat(slug, one) { const r=flatRoot, sh=shoulder(r,1);
  const lg=s=>({pos:[0.1*s,0.6,-0.7],anchor:'ball',pitch:85,pole:[0,-1,0.05]});
  const mk = k => ({ root:r, neck:{flex:-20}, legL:lg(1), legR:lg(-1), ...both(sh,k,HANG,DOWN,one) });
  W(slug,{floats:true,camera:{az:one?60:140,el:12},muscles:['posterior-deltoid'],...(one?{muscleSide:'L'}:{}),props:[{type:'flat-bench',height:0.44,yaw:0},...(one?[{type:'dumbbell',hand:'L',kg:5}]:db(5))], frames:frames3(mk)}); }
flat('lying-rear-delt-raise',false); flat('lying-one-arm-lateral-raise',true);
{ const a=30, r=proneRoot(a,0.16), sh=shoulder(r,1);
  const mk = p => ({ root:r, neck:{flex:-20}, ...legsProne(r), armL:arm(rel(arcP(sh,0),1,0,0.04*-p,-0.03*-p),1,HANG[0],HANG[1],POLE(0),{scap:{prot:p,elev:0}}), armR:arm(rel(arcP(sh,0),1,0,0.04*-p,-0.03*-p),-1,HANG[0],HANG[1],POLE(0),{scap:{prot:p,elev:0}}) });
  W('middle-back-shrug',{camera:{az:140,el:15},muscles:['middle-back','rhomboids'],props:[incl(a),...db(8)],frames:{start:mk(1),end:mk(-1)}}); }
{ const r={pos:[0,0.92,-0.1],pitch:80}, sh=shoulder(r,1);
  const mk = k => ({ root:r, neck:{flex:-25}, legL:{pos:[0.15,0,-0.1],anchor:'sole',pole:[0.1,0.2,1]}, legR:{pos:[-0.15,0,-0.1],anchor:'sole',pole:[-0.1,0.2,1]}, ...both(sh,k,HANG,DOWN,false) });
  W('bent-over-dumbbell-rear-delt-raise-with-head-on-bench',{camera:{az:140,el:10},muscles:['posterior-deltoid','rhomboids'],props:[{type:'adjustable-bench',angle:60,yaw:180,pos:[0,0,0.5]},...db(5)],frames:frames3(mk)}); }
{ const r={pos:[0,0.54,0.5],pitch:45}, sh=shoulder(r,1);
  const lg=s=>({pos:[0.12*s,0,0.95],anchor:'sole',pole:[0.1*s,0.2,1]});
  const mk = k => ({ root:r, neck:{flex:-30}, legL:lg(1), legR:lg(-1), ...both(sh,k,HANG,DOWN,false) });
  W('seated-bent-over-rear-delt-raise',{camera:{az:140,el:12},muscles:['posterior-deltoid','rhomboids'],props:[{type:'flat-bench',height:0.44,yaw:0},...db(5)],frames:frames3(mk)}); }
const bar={type:'barbell',hands:true,plates:[5]};
function prBar(slug, a, bent) { const r=proneRoot(a,0.16), sh=shoulder(r,1);
  const g=(s,P,k)=>({ pos:mir(P,s), contact:true, hand:'grip', grip:0.014, fingers:mir(lerp([0,-0.8,0.6],[0,-0.5,0.87],bent?k:Math.min(1,k*1.6)),s), palm:mir(lerp([0,-0.6,-0.8],[0,-0.87,-0.5],bent?k:Math.min(1,k*1.6)),s), curl:0.5, pole:mir([0.3,-0.3,-1],s) });
  const mk = k => { const P = bent ? [0.2,-0.28+0.26*k,0.3+0.25*k] : [0.13,-0.46+0.44*k,0.12+0.38*k];
    const Q=[sh[0]+P[0]-0.19,sh[1]+P[1],sh[2]+P[2]];
    return {root:r,neck:{flex:-20},...legsProne(r),armL:g(1,Q,k),armR:g(-1,Q,k)}; };
  W(slug,{camera:{az:55,el:12},muscles:['posterior-deltoid','anterior-deltoid'],props:[incl(a),bar],frames:frames3(mk)}); }
prBar('straight-raises-on-incline-bench',40,false); prBar('anti-gravity-press',40,true);
