import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const G = JSON.parse(fs.readFileSync(new URL('../_gallery/kettlebell.json', import.meta.url))).frames;
const cp = o => JSON.parse(JSON.stringify(o));
const legs = (x=0.2, z=0.02, yaw=14) => ({ legL:{pos:[x,0,z],anchor:'sole',yaw,pitch:0,pole:[0.3,0,1]}, legR:{pos:[-x,0,z],anchor:'sole',yaw:-yaw,pitch:0,pole:[-0.3,0,1]} });
const hand = (x,y,z,f,p,pole,s=1) => ({ pos:[x,y,z], contact:true, fingers:f, palm:p, curl:0.85, pole });
const two = (y,z,f,p,pole=[0.1,0,-1],hx=0.046) => ({ armL:hand(hx,y,z,f,p,pole), armR:hand(-hx,y,z,[-f[0],f[1],f[2]],[-p[0],p[1],p[2]],[-pole[0],pole[1],pole[2]]) });
const kb = (o={}) => ({ type:'kettlebell', kg:16, ...o });
const d2r=Math.PI/180;
const th = (t) => ({ f:[0,-Math.cos(t*d2r),Math.sin(t*d2r)], p:[0,-Math.sin(t*d2r),-Math.cos(t*d2r)] });
const arms = (y,z,t,pole=[0.1,0,-1],x=0.046) => { const a=th(t); return two(y,z,a.f,a.p,pole,x); };
const HR = {pos:[0,0.8,-0.27],pitch:52};
const hinge2 = (x=0.2) => ({ root:HR, neck:{flex:-30}, ...legs(x,0.02,14) });
const MID = { root:{pos:[0,0.86,-0.12],pitch:25}, neck:{flex:-14}, ...legs(0.2,0.02,14) };
const free = { fk:{flex:0,abd:20,elbow:5}, curl:0.2 };

// 1. one-arm swing: left hand, right arm free
{ const a0=th(5), a1=th(40), a2=th(90);
  const one=(base,x,y,z,a,pole,fl=10,ab=40)=>({ ...base, armL:hand(x,y,z,a.f,a.p,pole), armR:{fk:{flex:fl,abd:ab,elbow:5},curl:0.2} });
  const s=one(hinge2(),0.04,0.66,0.2,a0,[0.1,0,-1]);
  const m=one(MID,0.05,0.9,0.45,a1,[0.1,0,-1],20,55);
  const e=one({ root:{pos:[0,0.915,-0.01],pitch:-3}, neck:{flex:4}, ...legs()},0.05,1.32,0.56,a2,[0.1,-1,0],25,60);
  W('one-arm-kettlebell-swings', { camera:{az:75,el:8}, tempo:{lift:'there',up:0.7,down:0.7,squeeze:0.04,stretch:0.04}, muscles:['hamstrings','glutes','spinal-erectors'], muscleSide:'L',
    props:[kb({hand:'L'})], frames:{start:s, mid:m, end:e} }); }

// 2. vertical swing (kettlebell stands in for the dumbbell): between legs to overhead
{ const up=(phi,root)=>{ const r=phi*d2r, d=0.6; return { root, neck:{flex:0}, ...legs(0.2,0.02,14), ...arms(1.38-d*Math.cos(r), d*Math.sin(r), Math.min(phi,140), [0.15,-1,-0.1]) }; };
  W('vertical-swing', { camera:{az:90,el:6}, tempo:{lift:'there',up:0.6,down:1.2}, muscles:['hamstrings','glutes','shoulders'], props:[kb({hands:true})],
    frames:{start:{...hinge2(), ...arms(0.66,0.2,5)}, mid:{...MID, ...arms(0.9,0.36,40,[0.3,-0.4,-1])}, mid2:up(90,{pos:[0,0.915,0],pitch:0}), mid3:up(130,{pos:[0,0.915,0],pitch:0}), end:up(158,{pos:[0,0.915,0],pitch:0}) } }); }

// 3. sumo high pull
{ const lg=()=>({ legL:{pos:[0.3,0,0.0],anchor:'sole',yaw:35,pitch:0,pole:[0.8,0.3,1]}, legR:{pos:[-0.3,0,0.0],anchor:'sole',yaw:-35,pitch:0,pole:[-0.8,0.3,1]} });
  const s={ root:{pos:[0,0.6,-0.2],pitch:45}, neck:{flex:-20}, ...lg(), ...arms(0.54,0.28,0,[0.3,-0.2,-1]) };
  const m0={ root:{pos:[0,0.72,-0.14],pitch:30}, neck:{flex:-12}, ...lg(), ...arms(0.72,0.3,12,[0.4,0,-0.6]) };
  const m={ root:{pos:[0,0.88,-0.02],pitch:-2}, neck:{flex:-5}, ...lg(), ...arms(0.92,0.44,40,[0.5,0.3,-0.2]) };
  const m3={ root:{pos:[0,0.88,-0.02],pitch:-2}, neck:{flex:0}, ...lg(), ...arms(1.12,0.36,32,[0.5,0.7,0.0]) };
  const e={ root:{pos:[0,0.88,-0.02],pitch:-2}, neck:{flex:0}, ...lg(), ...arms(1.3,0.3,30,[0.5,1,0.1],0.046) };
  W('kettlebell-sumo-high-pull', { camera:{az:80,el:8}, muscles:['traps','shoulders','glutes'], props:[kb({hands:true})], frames:{start:s, mid:m0, mid2:m, end:e} }); }

// 4/5. pass between the legs, figure 8: the bell changes hands (per-frame props: L hand, both hands, R hand)
const pass = (slug, x, fig8) => {
  const L=(px,py,pz,t,pole)=>{ const q=th(t); return hand(px,py,pz,q.f,q.p,pole); };
  const hh = { root:{pos:[0,0.8,-0.27],pitch:50}, neck:{flex:-40}, ...legs(x,0.02,14) };
  const mk=(aL,aR)=>({ ...hh, armL:aL, armR:aR });
  const Rm=(px,py,pz,t,pole)=>{ const q=th(t); return hand(-px,py,pz,[-q.f[0],q.f[1],q.f[2]],[-q.p[0],q.p[1],q.p[2]],[-pole[0],pole[1],pole[2]]); };
  const kbf=(o)=>[kb(o)];
  const lf=fig8?0.12:0.1, ly=0.55;
  const F=[
    { ...mk(L(lf+0.04,ly,0.2,5,[0.5,0,-1]), Rm(0.06,0.55,0.0,20,[0.3,0,-1])), props:kbf({hand:'L'}) },
    { ...mk(L(0.046,0.5,0.04,12,[0.3,0,-1]), Rm(0.046,0.5,0.04,12,[0.3,0,-1])), props:kbf({hands:true}) },
    { ...mk(L(0.06,0.55,0.0,20,[0.3,0,-1]), Rm(lf+0.04,ly,0.2,5,[0.5,0,-1])), props:kbf({hand:'R'}) } ];
  W(slug, { camera:{az:fig8?70:80,el:10}, tempo:{lift:'even',even:1.4,squeeze:0.05,stretch:0.05}, muscles:['abdominals','obliques','hamstrings'], props:[ kb({hand:'L'}) ],
    frames:{ start:F[0], mid:F[1], end:F[2] } });
};
pass('kettlebell-pass-between-the-legs', 0.32, false);
pass('kettlebell-figure-8', 0.4, true);

// 6. pirate ships
{ const lg={ legL:{pos:[0.3,0,0.0],anchor:'sole',yaw:25,pitch:0,pole:[0.5,0.2,1]}, legR:{pos:[-0.3,0,0.0],anchor:'sole',yaw:-25,pitch:0,pole:[-0.5,0.2,1]} };
  const side = (a,cy=1.5,R=0.48) => { const r=a*Math.PI/180, sx=Math.sin(r), cz=Math.cos(r);
    const c=[R*sx, cy, R*cz], px=[0.06*cz,0,-0.06*sx]; const shx=[0.19*cz,1.38,-0.19*sx]; const fg=(h,sd)=>{ const v=[h[0]-sd*shx[0],h[1]-shx[1],h[2]-sd*shx[2]]; const n=Math.hypot(...v); return v.map(q=>q/n); };
    return { root:{pos:[0,0.9,0],pitch:4,yaw:a*0.3}, spine:{twist:a*0.7}, neck:{flex:0}, ...lg,
      armL:hand(c[0]+px[0],c[1],c[2]+px[2],fg([c[0]+px[0],c[1],c[2]+px[2]],1),[0,-1,0],[1,-1,0]), armR:hand(c[0]-px[0],c[1],c[2]-px[2],fg([c[0]-px[0],c[1],c[2]-px[2]],-1),[0,-1,0],[-1,-1,0]) }; };
  const low = side(0,1.0,0.42);
  W('kettlebell-pirate-ships', { camera:{az:35,el:10}, tempo:{lift:'even',even:1.5,squeeze:0.05,stretch:0.05}, muscles:['shoulders','obliques'], props:[kb({hands:true})],
    frames:{ start:side(-50), mid:low, mid2:side(50), end:low } }); }

// 7/8. halo: bell translates around the head, held by the horns, hands roll as it goes
{ const lg=legs(0.11,0.0,5), hx=0.095;
  const hnd=(sd,cx,cy,cz,phi,k)=>{ const r=phi*d2r;
    return hand(cx+sd*hx,cy,cz,[0,Math.sin(r),Math.cos(r)],[-sd,0,0],[sd*(0.8+0.2*k),-1+1.4*k,0.8*k]); };
  const at=(cx,cy,cz,phi,k,nf=0)=>({ root:{pos:[0,0.92,0]}, neck:{flex:nf}, ...lg, armL:hnd(1,cx,cy,cz,phi,k), armR:hnd(-1,cx,cy,cz,phi,k) });
  const ring=(a)=>{ const r=a*d2r, k=(1-Math.cos(r))/2; return at((Math.sin(r)<0?0.37:0.34)*Math.sin(r),1.6,0.03+(Math.cos(r)<0?0.38*Math.cos(r)+0.12*Math.sin(r)**2:0.30*Math.cos(r)+0.17*Math.sin(r)**2),10+70*(1-Math.cos(r)),Math.max(0.6,k),NF*Math.sin(r)**2+NF2*Math.max(0,-Math.cos(r))); };
  const NF=0, NF2=0;
  const front=at(0,1.25,0.36,10,0);
  const pr=[kb({hands:true,mode:'horns',up:[0,1,0]})];
  W('kettlebell-halo', { camera:{az:60,el:12}, tempo:{lift:'even',even:1.2,squeeze:0.05,stretch:0.05}, muscles:['shoulders','traps'], props:pr,
    frames:{ start:front, mid:ring(90), mid2:ring(180), mid3:ring(270), end:front } });
  W('kettlebell-halo-with-overhead-extension', { camera:{az:80,el:12}, muscles:['shoulders','triceps'], props:pr,
    frames:{ start:front, mid:ring(45), mid2:ring(90), mid3:ring(180), mid4:at(0,1.85,-0.2,90,0.8), end:at(0,2.06,-0.05,90,0.6) } }); }

// 9. spell caster: two dumbbells swing hip to hip, arms straight, trunk rotates
{ const lg={ legL:{pos:[0.28,0,0.0],anchor:'sole',yaw:20,pitch:0,pole:[0.4,0.2,1]}, legR:{pos:[-0.28,0,0.0],anchor:'sole',yaw:-20,pitch:0,pole:[-0.4,0.2,1]} };
  const f=(t,fl=38)=>({ root:{pos:[0,0.9,0],pitch:4,yaw:-t*0.35}, spine:{twist:t*0.65}, neck:{flex:0}, ...lg,
    armL:{fk:{flex:fl,abd:-6,rot:0,elbow:4},rel:'chest',curl:0.9}, armR:{fk:{flex:fl,abd:-6,rot:0,elbow:4},rel:'chest',curl:0.9} });
  W('spell-caster', { camera:{az:10,el:20}, muscles:['obliques','abdominals'], props:[{type:'dumbbell',hand:'L',kg:10},{type:'dumbbell',hand:'R',kg:10}],
    frames:{ start:f(75,40), mid:f(0,60), end:f(-75,40) } }); }
