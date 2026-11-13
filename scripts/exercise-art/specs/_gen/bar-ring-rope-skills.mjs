import fs from 'fs';
const RF=[0,0.92,0.39];
// ONLY=slug[,slug] writes just those specs.
const W = (slug, s) => { if (process.env.ONLY && !process.env.ONLY.split(',').includes(slug)) return; fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1)); };
const rad = d => d*Math.PI/180;
const R = v => v.map(x=>Math.round(x*1000)/1000);
// ---------- bar ----------
const bar = { type:'pull-up-bar', height:2.25 };
const barArm = (s,pl=[s,0,-0.3]) => ({ pos:[0.33*s,2.25,0], contact:true, fingers:[0,1,0], palm:[0,0,1], pole:pl, curl:0.82 });
// root from shoulder-centre target S and torso pitch p
const rootFor = (S, p) => R([S[0], S[1]-0.46*Math.cos(rad(p)), S[2]-0.46*Math.sin(rad(p))]);
function legs(flex, knee, foot=28, abd=2, rel='world') { return { legL:{fk:{flex,abd,knee},rel,foot:{pitch:foot}}, legR:{fk:{flex,abd,knee},rel,foot:{pitch:foot}} }; }
const legsP = (flex, knee, foot=28) => legs(flex, knee, foot, 2, 'pelvis');
const legsDown = (p, knee, foot=28) => { const c=Math.cos(rad(p)), sn=Math.sin(rad(p)); // down.cont=c? cont=(0,-c,-sn) belly=(0,-sn,c)
  const dc = c, db = sn; return legsP(Math.round(Math.atan2(db,dc)*180/Math.PI), knee, foot); };
const hang = (p, sz, lg, neck, sy=1.645, pz=-0.3) => ({ root:{pos:rootFor([0,sy,sz],p), pitch:p}, neck:{flex:neck}, armL:barArm(1,Array.isArray(pz)?pz:[1,0,pz]), armR:barArm(-1,Array.isArray(pz)?[-pz[0],pz[1],pz[2]]:[-1,0,pz]), ...lg });
// Skin the cat: arms straight the whole way (elbows about 7 deg in the keys, under 20 between them, the grip on the bar).
// stc(p, b, r, ...): p the trunk's pitch, b the shoulders' angle around the bar (+ toward +Z), r the bar to the top of the trunk
// line in the side view, which puts the shoulder joint at arm's length. The body turns about the shoulders while the root only
// blends in straight lines, so the five keys were searched with the rig (every eighth of each segment) for straight arms between
// them too: the shoulders pass under the bar as the body inverts, and the German hang ends with the shoulders in front of it.
const stcArm = (s) => ({ pos:[0.33*s,2.25,0], contact:true, fingers:[0,1,0], palm:[0,0,1], pole:[s,0,-0.3], curl:0.82 });
const stc = (p, b, r, hip, knee, foot, neck) => { const c=Math.cos(rad(p)), sn=Math.sin(rad(p)), S=[2.25-r*Math.cos(rad(b)), r*Math.sin(rad(b))];
  return { root:{pos:R([0, S[0]-0.46*c+0.02*sn, S[1]-0.46*sn-0.02*c]), pitch:p}, neck:{flex:neck}, armL:stcArm(1), armR:stcArm(-1), ...legsP(hip, knee, foot) }; };
const E=(process.env.GE||'-285,23,0.6309,70,15,30,-10').split(',').map(Number);
const M3=(process.env.M3||'-203,-27.5,0.6212,110,60,30,25').split(',').map(Number);
const M4=(process.env.M4||'-244,-2,0.626,90,40,30,20').split(',').map(Number);
const stcFrames = { start:stc(-3,0,0.6611,5,15,28,-6), mid:stc(-20,-12,0.6536,105,120,35,10), mid2:stc(-153,17.5,0.6108,135,130,40,25), mid3:stc(...M3), mid4:stc(...M4), end:stc(...E) };
W('skin-the-cat', { camera:{az:50,el:6,pad:-0.1}, muscles:['lats','shoulders'], floats:true, props:[bar],
  tempo:{ lift:'even', even:2.0, hold:0.6 },  // slow roll, a pause at the German hang
  frames:stcFrames });
W('german-hang-hold', { camera:{az:65,el:6,pad:-0.1}, muscles:['shoulders','lats'], floats:true, props:[bar], tempo:{ lift:'there', up:2.4, down:2.4, pauses:2.0 }, frames:stcFrames });
// front lever: shoulders stay under the bar (arms straight), the body swings from a hang up to horizontal on its back
const lv = (p, lg) => ({ root:{pos:rootFor([0,1.635,0],p), pitch:p}, neck:{flex:-4}, armL:barArm(1), armR:barArm(-1), ...lg });
const LH=process.env.LH||'0';
W('tuck-front-lever', { camera:{az:55,el:6,pad:-0.05}, muscles:['lats','abdominals'], floats:true, props:[bar], tempo:{ lift:'there', up:2.0, down:2.2, pauses:2.0 },
  frames:{ start:lv(-2,legsP(10,20,35)), mid:lv(-45,legsP(95,120,30)), end:lv(-90,legsP(120,130,30)) } });
W('advanced-tuck-front-lever', { camera:{az:55,el:6,pad:-0.05}, muscles:['lats','abdominals'], floats:true, props:[bar], tempo:{ lift:'there', up:2.0, down:2.2, pauses:2.0 },
  frames:{ start:lv(-2,legsP(10,20,35)), mid:lv(-45,legsP(80,100,30)), end:lv(-90,legsP(95,95,30)) } });
// ---------- rings ----------
const rings = { type:'gym-rings', anchorL:[0.3,3,0], anchorR:[-0.3,3,0], hands:true, frameIgnore:true };
const PB=(process.env.PB||'-0.6,-0.7,0').split(',').map(Number);
const orth0 = (f,p) => { const d=f[0]*p[0]+f[1]*p[1]+f[2]*p[2], n=f.reduce((a,b)=>a+b*b,0); const q=p.map((v,i)=>v-d/n*f[i]); const m=Math.hypot(...q); return q.map(v=>Math.round(v/m*1000)/1000); };
const rArm = (s,y,z,f=[0.28,-0.82,0.5]) => { const fi=[f[0]*s,f[1],f[2]]; return { pos:[0.255*s,y,z], contact:true, fingers:fi, palm:orth0(fi,[PB[0]*s,PB[1],PB[2]]), pole:[TP*s,0,-1], curl:0.82 }; };
const orth = (f,p) => { const d=f[0]*p[0]+f[1]*p[1]+f[2]*p[2], n=f.reduce((a,b)=>a+b*b,0); const q=p.map((v,i)=>v-d/n*f[i]); const m=Math.hypot(...q); return R(q.map(v=>v/m)); };
const HF = s => (process.env.HF||'0.1,0.75,0.5').split(',').map((v,i)=>i==0?+v*s:+v);
const FH=(process.env.FH||'0.1,0.75,0.5').split(',').map(Number);
const rHang = (s,y,pl=[s,+(process.env.HP||0),-0.3],f=HF(s)) => ({ pos:[0.255*s,y,0], contact:true, fingers:f, palm:orth(f,[PB[0]*s,PB[1],PB[2]]), pole:pl, curl:0.82 });
const rf = (root, neck, aL, aR, lg) => ({ root, neck:{flex:neck}, armL:aL, armR:aR, ...lg });
const MUF = (o)=>{ const RS=process.env.RS; if(RS){ for(const k in o) for(const a of ['armL','armR']){ o[k][a].roll=+RS.split(',')[0]; o[k][a].swivel=+RS.split(',')[1]; } } return o; };
const FP=(process.env.FP||'0.1,0.2,0.95').split(',').map(Number), FT=(process.env.FT||'0.2,-0.5,0.8').split(',').map(Number);
const PM=(process.env.PM||'1,-0.4,-0.8').split(',').map(Number), TP=+(process.env.TP||-0.3);
const HY=+(process.env.HY||1.8);
const RS=process.env.RS||'';
const MURS=process.env.MURS||'';
const KY=+(process.env.KY||1.78);
const mu = (kip) => {
  const fx=(o)=>{ if(RS){ for(const a of ['armL','armR']){ o[a].roll=+RS.split(',')[0]; o[a].swivel=+RS.split(',')[1]; } } return o; };
  const hangF = (p, lg, hy=2.16) => rf({pos:[0,1.14+0.03,p<0?0.1:-0.05],pitch:p}, -4, rHang(1,hy), rHang(-1,hy), lg);
  const pull = rf({pos:[0,1.43,-0.08],pitch:-8}, -6, rArm(1,1.55,0.16,FP), rArm(-1,1.55,0.16,FP), legs(10,50,30));
  const trans = rf({pos:[0,1.12,0.04],pitch:25}, -2, rArm(1,1.12,0.17,FT), rArm(-1,1.12,0.17,FT), legs(6,50,30));
  const top = rf({pos:[0,1.3,-0.02],pitch:3}, -2, rArm(1,1.22,0.02), rArm(-1,1.22,0.02), legs(14,64,28));
  const half = rf({pos:[0,1.3,0.0],pitch:-6}, -10, rHang(1,HY,PM,[FH[0],FH[1],FH[2]]), rHang(-1,HY,[-PM[0],PM[1],PM[2]],[-FH[0],FH[1],FH[2]]), legs(8,35,30));
  const nz=v=>{const m=Math.hypot(...v);return R(v.map(x=>x/m));};
  const avg=(A,B)=>({...A, pos:A.pos.map((x,i)=>R([ (x+B.pos[i])/2 ])[0]), fingers:nz(A.fingers.map((x,i)=>x+B.fingers[i])), palm:nz(A.palm.map((x,i)=>x+B.palm[i])), pole:nz(A.pole.map((x,i)=>x+B.pole[i]))});
  const mbA=(A,B,y)=>{const m=avg(A,B); m.pos=[m.pos[0],y,0.08]; return m;};
  const mb = rf({pos:[0,1.365,-0.04],pitch:-7}, -12, mbA(half.armL,pull.armL,1.72), mbA(half.armR,pull.armR,1.72), legs(9,42,30));
  const pt = rf({pos:[0,1.275,-0.02],pitch:8}, -4, avg(pull.armL,trans.armL), avg(pull.armR,trans.armR), legs(8,50,30));
  const bt=(A,B,rt)=>rf({pos:A.root.pos.map((x,i)=>R([(x+B.root.pos[i])/2])[0]),pitch:(A.root.pitch+B.root.pitch)/2}, (A.neck.flex+B.neck.flex)/2, avg(A.armL,B.armL), avg(A.armR,B.armR), rt);
  const kmid={...hangF(-22,kip?legs(60,10,30):legs(25,25,30)), armL:rHang(1,KY,PM,[FH[0],FH[1],FH[2]]), armR:rHang(-1,KY,[-PM[0],PM[1],PM[2]],[-FH[0],FH[1],FH[2]])};
  return { start:kip?hangF(2,legs(-25,30,40)):hangF(2,legs(5,22)), mid:kmid, midc:bt(kmid,pull,legs(30,30,30)), mid2:pull, mid2b:pt, mid3:trans, end:top };
};
W('muscle-up', { camera:{az:70,el:6}, tempo:{ lift:'there', up:1.1, down:2.6 }, muscles:['lats','triceps','chest'], floats:true, props:[rings], frames:(()=>{const o=mu(false);for(const k in o)for(const a of ['armL','armR']){o[k][a].roll=30;o[k][a].swivel=10;}return o;})() });
W('kipping-muscle-up', { camera:{az:70,el:6}, tempo:{ lift:'there', up:0.8, down:2.0 }, muscles:['lats','triceps','chest'], floats:true, props:[rings], frames:(()=>{const o=mu(true);for(const k in o)for(const a of ['armL','armR']){o[k][a].roll=30;o[k][a].swivel=10;}return o;})() });
// ---------- rope ----------
const g = JSON.parse(fs.readFileSync(new URL('../_gallery/climb-rope.json', import.meta.url)));
delete g.slug; g.floats=true;
// rope grip: fingers wrap the rope (vertical axis = fingers x palm), hands at the rope z
const RZ=0.08, LDY=+(process.env.LDY||-0.28);
g.props[0].pos=[0,RZ];
const rotY=(v,a)=>{a*=Math.PI/180;return [v[0]*Math.cos(a)+v[2]*Math.sin(a),v[1],-v[0]*Math.sin(a)+v[2]*Math.cos(a)].map(x=>Math.round(x*1000)/1000)};
const RFa=rotY([-0.4,0.1,0.9],+(process.env.AL||-60)), RPa=rotY([0.9,0,0.4],+(process.env.AL||-60));
const RFb=rotY([-0.4,0.1,0.9],-60), RPb=rotY([0.9,0,0.4],-60);
for (const k of ['start','end']) { const f=g.frames[k]; f.armL.pos[2]=RZ; f.armR.pos[2]=RZ; f.armL.pos[1]+=LDY; f.armR.pos[1]+=+(process.env.RDY||-0.14);
  f.armL.fingers=RFa; f.armL.palm=RPa; f.armR.fingers=[-RFb[0],RFb[1],RFb[2]]; f.armR.palm=[-RPb[0],RPb[1],RPb[2]]; }
// feet locked on the rope in every frame (J-hook): ankles beside the rope, one above the other
const DX=+(process.env.DX||0.035),DZ=+(process.env.DZ||-0.05);
const lock=(f,dy)=>{ f.legL.pos=[DX,f.legL.pos[1]+dy,RZ+DZ]; f.legR.pos=[-DX,f.legR.pos[1]+dy,RZ+DZ]; f.legL.pole=[0.5,0.3,1]; f.legR.pole=[-0.5,0.3,1]; f.legL.yaw=12; f.legR.yaw=-12; };
lock(g.frames.start,0); lock(g.frames.end,0.02);
g.frames.mid=JSON.parse(JSON.stringify(g.frames.start)); { const m=g.frames.mid; for(const a of ['armL','armR']) m[a].pos[1]=g.frames.start[a].pos[1]; m.root.pos[1]+=0.1; m.legL.pos[1]+=0.3; m.legR.pos[1]+=0.3; }
g.tempo={lift:'there',up:1.6,down:2.0};
 W('rope-climb', g);
// london bridges: box stands in for the locked smith bar
const BH = 0.5, ZF = 0.1;
const LA=+(process.env.LA||-80), LB=+(process.env.LB||-100);
const rh = (y, s) => { const a=s==-1?LA:LB, f=rotY([-0.4,0.1,0.9],a), p=rotY([0.9,0,0.4],a); return { pos:[-0.255*s,y,0.07], contact:true, fingers:s==-1?f:[-f[0],f[1],f[2]], palm:s==-1?p:[-p[0],p[1],p[2]], pole:[-(+(s==1?(process.env.PXR||process.env.PX||0.8):(process.env.PX||0.8)))*s,-0.7,0.45], curl:0.82 }; };
const RZL=+(process.env.RZL||0.2);
const lb = (phi, yL, yR) => {
  const hipY = BH+0.92*Math.cos(rad(phi)), hipZ = ZF-0.92*Math.sin(rad(phi));
  return { root:{pos:R([0,hipY,hipZ]), pitch:-phi}, neck:{flex:0},
    armL:{...rHang(1,yL),pos:[0.255,yL,RZL]}, armR:{...rHang(-1,yR),pos:[-0.255,yR,RZL]},
    legL:{pos:[0.12,BH,ZF],anchor:'sole',pitch:0,yaw:5,pole:[0.1,0.2,1]}, legR:{pos:[-0.12,BH,ZF],anchor:'sole',pitch:0,yaw:5,pole:[-0.1,0.2,1]} };
};
W('london-bridges', { camera:{az:110,el:6,pad:0.03}, muscles:['lats','biceps','forearms'],
  props:[{type:'plyo-box',height:BH,width:0.6,depth:0.5,pos:[0,0,0.1]}, {type:'gym-rings',anchorL:[0.255,3.0,RZL],anchorR:[-0.255,3.0,RZL],hands:true,frameIgnore:true}],
  frames:{ start:lb(6,+(process.env.S1||1.9),+(process.env.S1||1.9)), end:lb(12,+(process.env.E1||1.7),+(process.env.E1||1.7)) } });
