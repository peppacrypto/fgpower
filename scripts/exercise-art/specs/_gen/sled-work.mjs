import fs from 'fs';
const G=n=>JSON.parse(fs.readFileSync(new URL(`../_gallery/${n}.json`,import.meta.url)));
const cl=o=>JSON.parse(JSON.stringify(o));
const out=(slug,o)=>fs.writeFileSync(new URL(`../${slug}.json`,import.meta.url),JSON.stringify({...o,slug},null,1));
// step helper: leg k lifts in place (a), swings (m), lands just above its new spot (c): no skating on the floor
const stepFr=(s,m,e,k,h=0.12)=>{const a=cl(s),c=cl(e);a[k].pos[1]=h;c[k].pos[1]=h;return{start:s,mid:a,mid2:m,mid3:c,end:e};};
const mir=(a)=>[-a[0],a[1],a[2]];
// ---- sled-push (gallery geometry, higher hips so the front thigh clears the chest) ----
{const g=G('sled');const s=cl(g.frames.start),e=cl(g.frames.end);
 for(const f of[s,e]){f.root.pos[1]=0.66;f.root.pitch=62;f.neck.flex=-56;f.spine.flex=0;}
 const m=cl(s);
 m.root.pos[2]=(s.root.pos[2]+e.root.pos[2])/2;
 for(const k of['armL','armR'])m[k].pos[2]=(s[k].pos[2]+e[k].pos[2])/2;
 // L foot stays planted flat; the R foot drives off its toes at the back, swings through in the air and lands ahead
 const Lp={pos:[0.12,0,-0.42],anchor:'sole',pitch:0,pole:[0.1,0,1]};
 s.legL=cl(Lp);m.legL=cl(Lp);e.legL=cl(Lp);
 s.legR={pos:[-0.12,0,-1.12],anchor:'ball',pitch:42,toes:0,pole:[-0.1,0,1]};
 m.legR={pos:[-0.12,0.16,-0.8],anchor:'ball',pitch:60,toes:0,pole:[-0.1,0,1]};
 e.legR={pos:[-0.12,0,-0.55],anchor:'ball',pitch:38,toes:0,pole:[-0.1,0,1]};
 s.root.pos[2]=-0.62;m.root.pos[2]=-0.56;e.root.pos[2]=-0.5;
 for(const k of['armL','armR']){s[k].pos[2]=0;m[k].pos[2]=0.06;e[k].pos[2]=0.12;}
 out('sled-push',{qaAllow:{'rom:carry.posture':'a sled push leans far forward by design, it is not a carry'},...g,slug:undefined,muscles:['quadriceps','glutes'],frames:stepFr(s,m,e,'legR')});}
// ---- prowler-sprint (gallery, higher handles, faster) ----
{const g=G('prowler');const s=g.frames.start,e=g.frames.end,m=cl(s);
 const dz=-0.17;for(const f of[s,m,e]){f.root.pos[2]+=dz;}
 m.root.pos[2]=(s.root.pos[2]+e.root.pos[2])/2;m.root.pos[1]=0.84;
 for(const k of['armL','armR'])m[k].pos[2]=(s[k].pos[2]+e[k].pos[2])/2;
 const Lp={pos:[0.12,0,-0.8],anchor:'sole',pitch:0,pole:[0.1,0,1]};
 s.legL=cl(Lp);m.legL=cl(Lp);e.legL=cl(Lp);
 s.legR={pos:[-0.12,0,-1.4],anchor:'ball',pitch:38,toes:0,pole:[-0.1,0,1]};
 m.legR={pos:[-0.12,0.14,-1.0],anchor:'ball',pitch:40,toes:0,pole:[-0.1,0,1]};
 e.legR={pos:[-0.12,0,-0.45],anchor:'sole',pitch:0,pole:[-0.1,0,1]};
 out('prowler-sprint',{...g,slug:undefined,qaAllow:{'rom:carry.posture':'a sled sprint leans forward by design','rom:horizontal-pull.stretch':'sprint on fixed handles, arms stay long and braced; it is not a row','rom:horizontal-pull.end':'sprint on fixed handles, not a row'},muscles:['hamstrings','quadriceps','glutes'],frames:stepFr(s,m,e,'legR')});}
// ---- sled-drag-harness (gallery) ----
{const g=G('harness');const s=g.frames.start,e=g.frames.end,m=cl(s);
 m.armL=cl(e.armL);m.armR=cl(e.armR);
 for(const k of['armL','armR']){m[k].fk.flex=8;}
 for(const f of[s,m,e])for(const k of['armL','armR'])f[k].fk.abd=24;
 // L foot stays planted; the R foot pushes off its toes behind, swings through and lands ahead
 const Lp={pos:[0.13,0,0.3],anchor:'sole',pitch:0,pole:[0.1,0,1]};
 s.legL=cl(Lp);m.legL=cl(Lp);e.legL=cl(Lp);
 s.legR={pos:[-0.13,0,-0.4],anchor:'ball',pitch:40,toes:0,pole:[-0.1,0,1]};
 m.legR={pos:[-0.13,0.14,0.0],anchor:'ball',pitch:35,toes:0,pole:[-0.1,0,1]};
 e.legR={pos:[-0.13,0,0.6],anchor:'sole',pitch:0,pole:[-0.1,0,1]};
 e.armL=cl(s.armL);e.armR=cl(s.armR);e.armL.fk.flex=46;e.armR.fk.flex=-30;
 out('sled-drag-harness',{...g,slug:undefined,qaAllow:{'rom:carry.posture':'a harness drag leans into the line by design'},muscles:['quadriceps','glutes'],frames:stepFr(s,m,e,'legR')});}
// ---- shared standing-facing-sled pieces ----
const hand=(s,pos,fing,palm,pole)=>({pos:[pos[0]*s,pos[1],pos[2]],contact:true,fingers:[fing[0]*s,fing[1],fing[2]],palm:[palm[0]*s,palm[1],palm[2]],curl:0.8,pole:[pole[0]*s,pole[1],pole[2]]});
const strap=(z)=>[{type:'sled',pos:[0,0,z],yaw:0,plates:2},{type:'sled-straps',hands:true,to:[0,0.13,z-0.53]}];
const stand=(root,spine,neck,legs,aL,aR)=>({root,spine,neck,...legs,armL:aL,armR:aR});
const stance=(zl,zr)=>({legL:{pos:[0.13,0,zl],anchor:'sole',pitch:0,yaw:6,pole:[0.2,0,1]},legR:{pos:[-0.13,0,zr],anchor:'sole',pitch:0,yaw:-6,pole:[-0.2,0,1]}});
// ---- backward-drag: lean back, arms out on straps, step backward ----
// R foot stays planted; the L foot lifts from in front, swings back past it and lands behind; the body and the strap hands travel with it
const bwFr=(rootPitch,handFn,bodyHands)=>{
 const mk=(rz,L)=>{const f=stand({pos:[0,0.89,rz],pitch:rootPitch},{flex:-3},{flex:6},{legL:L,legR:{pos:[-0.12,0,-0.06],anchor:'sole',pitch:0,yaw:-6,pole:[-0.2,0,1]}},handFn(1,rz),handFn(-1,rz));return f;};
 const s=mk(0.0,{pos:[0.12,0,0.18],anchor:'sole',pitch:0,yaw:6,pole:[0.2,0,1]});
 const m=mk(-0.1,{pos:[0.12,0.12,-0.1],anchor:'sole',pitch:8,yaw:6,pole:[0.2,0,1]});
 const e=mk(-0.2,{pos:[0.12,0,-0.34],anchor:'ball',pitch:20,toes:0,yaw:6,pole:[0.2,0,1]});
 const a=cl(s),c=cl(e);a.legL.pos[1]=0.1;c.legL.pos[1]=0.1;
 return{start:s,mid:a,mid2:m,mid3:c,end:e};};
{const arms=(s,rz)=>hand(s,[0.2,1.02,rz+0.3],[0,-0.6,0.8],[-1,0,0],[0.5,-0.6,-0.2]);
 out('backward-drag',{camera:{az:60,el:10},muscles:['quadriceps','glutes'],props:strap(2.3),frames:bwFr(-10,arms)});}
// ---- sled-row: hinge, arms long, pull elbows back ----
{const root={pos:[0,0.8,-0.05],pitch:22};
 const mk=(z,y,pole,ep,rp)=>stand({pos:[0,0.82,-0.05],pitch:rp},{flex:2},{flex:-12},stance(0.02,0.02),
   hand(1,[0.2,y,z],[0,-0.6,0.8],[-1,0,0],pole),hand(-1,[0.2,y,z],[0,-0.6,0.8],[-1,0,0],pole));
 const s=mk(0.62,0.85,[0.5,-0.6,-0.2],0,22);
 const e=mk(0.04,1.0,[0.5,0,-1],0,14);
 const m=mk(0.3,1.02,[0.5,-0.2,-0.8],0,18);
 out('sled-row',{camera:{az:60,el:11},muscles:['middle-back','lats','biceps'],props:strap(2.3),frames:{start:s,mid:m,end:e}});}
// ---- sled-reverse-flye: slight hinge, straight arms swept up and apart ----
{const arm=(fl,ab,el)=>({fk:{flex:fl,abd:ab,rot:0,elbow:el},rel:'chest',hand:'relaxed',curl:0.5,pron:0});
 const mk=(fl,ab)=>stand({pos:[0,0.84,-0.03],pitch:24},{flex:2},{flex:-14},stance(0.02,0.02),arm(fl,ab,10),arm(fl,ab,10));
 out('sled-reverse-flye',{camera:{az:150,el:14},muscles:['posterior-deltoid','rhomboids'],props:strap(2.3),
  frames:{start:mk(30,8),mid:mk(22,50),end:mk(8,88)}});}
// ---- sled-overhead-backward-walk: arms locked overhead, walk backward ----
{const arm=()=>({fk:{flex:172,abd:10,rot:0,elbow:4},rel:'chest',hand:'relaxed',curl:0.5,pron:0});
 out('sled-overhead-backward-walk',{camera:{az:60,el:10},muscles:['shoulders','traps'],props:strap(2.5),frames:bwFr(-3,()=>arm())});}
// ---- sled-overhead-triceps-extension: facing away, upper arms vertical, extend elbows ----
{const arm=(el)=>({fk:{flex:168,abd:6,rot:0,elbow:el},rel:'chest',hand:'relaxed',curl:0.5,pron:0});
 const mk=(el)=>stand({pos:[0,0.91,0],pitch:6},{flex:0},{flex:0},{legL:{pos:[0.13,0,0.14],anchor:'sole',pitch:0,yaw:6,pole:[0.2,0,1]},legR:{pos:[-0.13,0,-0.14],anchor:'sole',pitch:0,yaw:-6,pole:[-0.2,0,1]}},arm(el),arm(el));
 out('sled-overhead-triceps-extension',{camera:{az:55,el:10},muscles:['triceps'],props:[{type:'sled',pos:[0,0,-2.3],yaw:0,plates:2},{type:'sled-straps',hands:true,to:[0,0.13,-1.77]}],
  frames:{start:mk(125),mid:mk(65),end:mk(6)}});}
// ---- forward-drag-with-press: facing away from the sled, hands at chest then press forward ----
// L foot stays planted; the R foot steps forward through the air; the body and the hands travel with the step
{const h=(s,x,y,rz,dz)=>hand(s,[x,y,rz+dz],[0,0.15,1],[-1,0,0],[0.6,-0.8,-0.4]);
 const Lp={pos:[0.13,0,-0.05],anchor:'sole',pitch:0,yaw:6,pole:[0.2,0,1]};
 const R=(z,y=0,p=0)=>({pos:[-0.13,y,z],anchor:'sole',pitch:p,yaw:-6,pole:[-0.2,0,1]});
 const mk=(rz,r,x,y,dz)=>({root:{pos:[0,0.89,rz],pitch:14},spine:{flex:2},neck:{flex:-8},legL:cl(Lp),legR:r,armL:h(1,x,y,rz,dz),armR:h(-1,x,y,rz,dz)});
 const s=mk(-0.17,R(-0.3),0.28,1.28,0.3),m=mk(-0.17,R(-0.3),0.2,1.38,0.62),m2=mk(-0.17,R(-0.3),0.28,1.28,0.3),
  a=mk(-0.17,R(-0.3,0.14,0),0.28,1.28,0.3),b=mk(0,R(0.0,0.16,12),0.28,1.28,0.3),c=mk(0.08,R(0.3,0.14,0),0.28,1.28,0.3),e=mk(0.12,R(0.3),0.28,1.28,0.3);
 out('forward-drag-with-press',{camera:{az:55,el:10},muscles:['chest','triceps'],props:[{type:'sled',pos:[0,0,-2.6],yaw:0,plates:2},{type:'sled-straps',hands:true,to:[0,0.13,-2.07]}],
  frames:{start:s,mid:m,mid2:m2,mid3:a,mid4:b,mid5:c,end:e}});}
// ---- bear-crawl-sled-drags: hands and toes, belt chain to the sled behind ----
// a crawl step: the diagonal pair (R hand + L foot) lifts in place, reaches forward in the air and lands; the other pair stays planted
{const hnd=(s,z,y=0,c=true)=>({pos:[0.3*s,y,z],contact:c,fingers:[0.12*s,0,1],palm:[0,-1,0],curl:-0.3,pole:[0.9*s,0.2,-0.5]});
 const ft=(s,z,y=0)=>({pos:[0.12*s,y,z],anchor:'ball',pitch:y?62:70,toes:0,pole:[0.08*s,0.6,1]});
 const mk=(rz,hr,fl,yh=0)=>({root:{pos:[0,0.5,rz],pitch:78},spine:{flex:0},neck:{flex:-30},armL:hnd(1,0.58),armR:hnd(-1,hr,yh,yh===0),legL:ft(1,fl,yh),legR:ft(-1,-0.3)});
 const s=mk(0,0.46,-0.4),a=mk(0,0.46,-0.4,0.08),m=mk(0.07,0.58,-0.3,0.09),c=mk(0.13,0.71,-0.14,0.08),e=mk(0.13,0.71,-0.14);
 out('bear-crawl-sled-drags',{camera:{az:55,el:14},muscles:['quadriceps','shoulders'],props:[{type:'sled',pos:[0,0,-2.7],yaw:0,plates:3},{type:'harness',follow:true,to:[0,0.13,-2.17]}],
  frames:{start:s,mid:a,mid2:m,mid3:c,end:e}});}
