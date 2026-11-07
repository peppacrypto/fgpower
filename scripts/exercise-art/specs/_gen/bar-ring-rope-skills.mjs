import fs from 'fs';
const P3=+(process.env.P3||-190);
const RF=[0,0.92,0.39];
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
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
W('skin-the-cat', { camera:{az:50,el:6,pad:-0.1}, muscles:['lats','shoulders'], floats:true, props:[bar],
  frames:{ start:hang(-4,0,legsP(5,22),-6),
           mid:hang(-50,0,legsP(105,115,40),10,1.70),
           mid2:hang(-125,0.05,legsP(75,20,40),20,+(process.env.S2||1.9)),
           mid3:hang(P3,+(process.env.Z3||-0.15),legsP(105,40,30),10,+(process.env.S3||1.96),process.env.PZ?process.env.PZ.split(',').map(Number):-0.3),
           end:hang(-350,0,legsDown(-350,10,35),-20,1.86,+(process.env.PE||-0.3)) } });
const german = hang(-350,0,legsDown(-350,10,35),-20,1.86);
W('german-hang-hold', { camera:{az:50,el:6}, muscles:['shoulders','lats'], floats:true, props:[bar], frames:{ start:german } });
const lever = (lg) => ({ root:{pos:rootFor([0,1.645,0],-90), pitch:-90}, neck:{flex:0}, armL:barArm(1), armR:barArm(-1), ...lg });
W('tuck-front-lever', { camera:{az:90,el:6}, muscles:['lats','abdominals'], floats:true, props:[bar],
  frames:{ start:lever(legs(110,130,30,2,'pelvis')) } });
W('advanced-tuck-front-lever', { camera:{az:90,el:6}, muscles:['lats','abdominals'], floats:true, props:[bar],
  frames:{ start:lever(legs(4,100,30,2,'pelvis')) } });
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
const KY=+(process.env.KY||1.78);
const mu = (kip) => {
  const fx=(o)=>{ if(RS){ for(const a of ['armL','armR']){ o[a].roll=+RS.split(',')[0]; o[a].swivel=+RS.split(',')[1]; } } return o; };
  const hangF = (p, lg, hy=2.16) => rf({pos:[0,1.14+0.03,p<0?0.1:-0.05],pitch:p}, -4, rHang(1,hy), rHang(-1,hy), lg);
  const pull = rf({pos:[0,1.43,-0.08],pitch:-8}, -14, rArm(1,1.55,0.16,FP), rArm(-1,1.55,0.16,FP), legs(10,50,30));
  const trans = rf({pos:[0,1.12,0.04],pitch:25}, 6, rArm(1,1.12,0.17,FT), rArm(-1,1.12,0.17,FT), legs(6,50,30));
  const top = rf({pos:[0,1.3,-0.02],pitch:3}, -2, rArm(1,1.22,0.02), rArm(-1,1.22,0.02), legs(14,64,28));
  const half = rf({pos:[0,1.3,0.0],pitch:-6}, -10, rHang(1,HY,PM,[FH[0],FH[1],FH[2]]), rHang(-1,HY,[-PM[0],PM[1],PM[2]],[-FH[0],FH[1],FH[2]]), legs(8,35,30));
  const mb = rf({pos:[0,1.365,-0.04],pitch:-7}, -12, rArm(1,1.72,0.08,[0.1,0.35,0.85]), rArm(-1,1.72,0.08,[0.1,0.35,0.85]), legs(9,42,30));
  const nz=v=>{const m=Math.hypot(...v);return R(v.map(x=>x/m));};
  const avg=(A,B)=>({...A, pos:A.pos.map((x,i)=>R([ (x+B.pos[i])/2 ])[0]), fingers:nz(A.fingers.map((x,i)=>x+B.fingers[i])), palm:nz(A.palm.map((x,i)=>x+B.palm[i])), pole:nz(A.pole.map((x,i)=>x+B.pole[i]))});
  const pt = rf({pos:[0,1.275,-0.02],pitch:8}, -4, avg(pull.armL,trans.armL), avg(pull.armR,trans.armR), legs(8,50,30));
  const bt=(A,B,rt)=>rf({pos:A.root.pos.map((x,i)=>R([(x+B.root.pos[i])/2])[0]),pitch:(A.root.pitch+B.root.pitch)/2}, (A.neck.flex+B.neck.flex)/2, avg(A.armL,B.armL), avg(A.armR,B.armR), rt);
  if (!kip) return { start:hangF(-4,legs(5,22)), mid:half, midb:mb, midc:bt(mb,pull,legs(9,45,30)), mid2:pull, mid2b:pt, mid3:trans, end:top };
  const kmid={...hangF(-22,legs(60,10,30)), armL:rHang(1,KY,PM,[FH[0],FH[1],FH[2]]), armR:rHang(-1,KY,[-PM[0],PM[1],PM[2]],[-FH[0],FH[1],FH[2]])};
  return { start:hangF(2,legs(-25,30,40)), mid:kmid, midc:bt(kmid,pull,legs(30,30,30)), mid2:pull, mid2b:pt, mid3:trans, end:top };
};
W('muscle-up', { camera:{az:70,el:6}, muscles:['lats','triceps','chest'], floats:true, props:[rings], frames:MUF(mu(false)) });
W('kipping-muscle-up', { camera:{az:70,el:6}, muscles:['lats','triceps','chest'], floats:true, props:[rings], frames:MUF(mu(true)) });
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
 W('rope-climb', g);
// london bridges: box stands in for the locked smith bar
const BH = 0.5, ZF = 0.1;
const LA=+(process.env.LA||-80), LB=+(process.env.LB||-100);
const rh = (y, s) => { const a=s==-1?LA:LB, f=rotY([-0.4,0.1,0.9],a), p=rotY([0.9,0,0.4],a); return { pos:[0,y,0.07], contact:true, fingers:s==-1?f:[-f[0],f[1],f[2]], palm:s==-1?p:[-p[0],p[1],p[2]], pole:[-(+(s==1?(process.env.PXR||process.env.PX||0.8):(process.env.PX||0.8)))*s,-0.7,0.45], curl:0.82 }; };
const lb = (phi, yL, yR) => {
  const hipY = BH+0.92*Math.cos(rad(phi)), hipZ = ZF-0.92*Math.sin(rad(phi));
  return { root:{pos:R([0,hipY,hipZ]), pitch:-phi}, neck:{flex:-phi*0.5},
    armL:rh(yL,-1), armR:rh(yR,1),
    legL:{pos:[0.12,BH,ZF],anchor:'sole',pitch:0,yaw:5,pole:[0.1,0.2,1]}, legR:{pos:[-0.12,BH,ZF],anchor:'sole',pitch:0,yaw:5,pole:[-0.1,0.2,1]} };
};
W('london-bridges', { camera:{az:110,el:6,pad:0.03}, muscles:['lats','biceps','forearms'],
  props:[{type:'plyo-box',height:BH,width:0.6,depth:0.5,pos:[0,0,0.1]}, {type:'climb-rope',pos:[0,0.07],top:3.2,hands:true,coil:false,frameIgnore:true}],
  frames:{ start:lb(14,+(process.env.S1||2.0)-0.2,+(process.env.S2b||1.95)-0.1), end:lb(24,+(process.env.E1||1.8)-0.2,+(process.env.E2||1.6)-0.1) } });
