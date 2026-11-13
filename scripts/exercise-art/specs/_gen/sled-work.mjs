import fs from 'fs';
const G=n=>JSON.parse(fs.readFileSync(new URL(`../_gallery/${n}.json`,import.meta.url)));
const cl=o=>JSON.parse(JSON.stringify(o));
const out=(slug,o)=>fs.writeFileSync(new URL(`../${slug}.json`,import.meta.url),JSON.stringify({slug,...o},null,1));
const mir=(a)=>[-a[0],a[1],a[2]];
// ---- sled-push (gallery geometry, higher hips so the front thigh clears the chest) ----
{const g=G('sled');const s=cl(g.frames.start),e=cl(g.frames.end);
 for(const f of[s,e]){f.root.pos[1]=0.66;f.root.pitch=62;f.neck.flex=-56;f.spine.flex=0;}
 const m=cl(s);
 m.root.pos[2]=(s.root.pos[2]+e.root.pos[2])/2;
 for(const k of['armL','armR'])m[k].pos[2]=(s[k].pos[2]+e[k].pos[2])/2;
 const av=(a,b)=>({...cl(a),pos:a.pos.map((v,i)=>(v+b.pos[i])/2),pitch:(a.pitch+b.pitch)/2});
 m.legL=av(s.legL,e.legL);m.legR=av(s.legR,e.legR);m.legL.pos[1]=0;m.legR.pos[1]=0.1;m.legL.anchor='ball';m.legR.anchor='ball';m.legL.pitch=45;m.legR.pitch=50;m.legL.pos[1]=0.03;m.legL.pos[2]+=0.1;m.legL.toes=0;
 out('sled-push',{...g,slug:undefined,muscles:['quadriceps','glutes'],frames:{start:s,mid:m,end:e}});}
// ---- prowler-sprint (gallery, higher handles, faster) ----
{const g=G('prowler');const s=g.frames.start,e=g.frames.end,m=cl(s);
 m.root.pos[2]=(s.root.pos[2]+e.root.pos[2])/2;m.root.pos[1]=0.84;
 m.legL={pos:[0.12,0,-0.8],anchor:'sole',pitch:0,pole:[0.1,0,1]};
 m.legR={pos:[-0.12,0.12,-0.8],anchor:'ball',pitch:35,toes:0,pole:[-0.1,0,1]};
 for(const k of['armL','armR'])m[k].pos[2]=(s[k].pos[2]+e[k].pos[2])/2;
 out('prowler-sprint',{...g,slug:undefined,muscles:['hamstrings','quadriceps','glutes'],frames:{start:s,mid:m,end:e}});}
// ---- sled-drag-harness (gallery) ----
{const g=G('harness');const s=g.frames.start,e=g.frames.end,m=cl(s);
 m.legL={pos:[0.13,0,0.0],anchor:'sole',pitch:0,pole:[0.1,0,1]};
 m.legR={pos:[-0.13,0.1,0.0],anchor:'ball',pitch:35,toes:0,pole:[-0.1,0,1]};
 m.armL=cl(e.armL);m.armR=cl(e.armR);
 for(const k of['armL','armR']){m[k].fk.flex=8;}
 out('sled-drag-harness',{...g,slug:undefined,muscles:['quadriceps','glutes'],frames:{start:s,mid:m,end:e}});}
// ---- shared standing-facing-sled pieces ----
const hand=(s,pos,fing,palm,pole)=>({pos:[pos[0]*s,pos[1],pos[2]],contact:true,fingers:[fing[0]*s,fing[1],fing[2]],palm:[palm[0]*s,palm[1],palm[2]],curl:0.8,pole:[pole[0]*s,pole[1],pole[2]]});
const strap=(z)=>[{type:'sled',pos:[0,0,z],yaw:0,plates:2},{type:'sled-straps',hands:true,to:[0,0.13,z-0.53]}];
const stand=(root,spine,neck,legs,aL,aR)=>({root,spine,neck,...legs,armL:aL,armR:aR});
const stance=(zl,zr)=>({legL:{pos:[0.13,0,zl],anchor:'sole',pitch:0,yaw:6,pole:[0.2,0,1]},legR:{pos:[-0.13,0,zr],anchor:'sole',pitch:0,yaw:-6,pole:[-0.2,0,1]}});
// ---- backward-drag: lean back, arms out on straps, step backward ----
{const arms=(s)=>hand(s,[0.2,1.02,0.3],[0,-0.6,0.8],[-1,0,0],[0.5,-0.6,-0.2]);
 const mk=(fl,r)=>{const L=fl?{pos:[0.12,0,0.14],anchor:'sole',pitch:0,yaw:6,pole:[0.2,0,1]}:{pos:[0.12,0.02,-0.3],anchor:'ball',pitch:32,toes:0,yaw:6,pole:[0.2,0,1]};
  const R=!fl?{pos:[-0.12,0,0.14],anchor:'sole',pitch:0,yaw:-6,pole:[-0.2,0,1]}:{pos:[-0.12,0.02,-0.3],anchor:'ball',pitch:32,toes:0,yaw:-6,pole:[-0.2,0,1]};
  return stand({pos:[0,0.89,-0.12],pitch:-10},{flex:-3},{flex:6},{legL:L,legR:R},arms(1),arms(-1));};
 const s=mk(true),e=mk(false),m=cl(s);
 m.legL={pos:[0.12,0.09,-0.1],anchor:'sole',pitch:8,yaw:6,pole:[0.2,0,1]};
 m.legR={pos:[-0.12,0,-0.02],anchor:'sole',pitch:0,yaw:-6,pole:[-0.2,0,1]};
 // the lifted foot swings back past the planted one; second half mirrors it
 s.legL.pos[2]=0.1;
 out('backward-drag',{camera:{az:60,el:10},muscles:['quadriceps','glutes'],props:strap(2.3),frames:{start:s,mid:m,end:e}});}
// ---- sled-row: hinge, arms long, pull elbows back ----
{const root={pos:[0,0.8,-0.05],pitch:22};
 const mk=(z,y,pole,ep,rp)=>stand({pos:[0,0.82,-0.05],pitch:rp},{flex:2},{flex:-12},stance(0.02,0.02),
   hand(1,[0.2,y,z],[0,-0.6,0.8],[-1,0,0],pole),hand(-1,[0.2,y,z],[0,-0.6,0.8],[-1,0,0],pole));
 const s=mk(0.5,0.9,[0.5,-0.6,-0.2],0,22);
 const e=mk(0.04,1.0,[0.5,0,-1],0,14);
 const m=mk(0.3,1.02,[0.5,-0.2,-0.8],0,18);
 out('sled-row',{camera:{az:60,el:11},muscles:['middle-back','lats','biceps'],props:strap(2.3),frames:{start:s,mid:m,end:e}});}
// ---- sled-reverse-flye: slight hinge, straight arms swept up and apart ----
{const arm=(fl,ab,el)=>({fk:{flex:fl,abd:ab,rot:0,elbow:el},rel:'chest',hand:'relaxed',curl:0.5,pron:0});
 const mk=(fl,ab)=>stand({pos:[0,0.84,-0.03],pitch:24},{flex:2},{flex:-14},stance(0.02,0.02),arm(fl,ab,10),arm(fl,ab,10));
 out('sled-reverse-flye',{camera:{az:150,el:14},muscles:['posterior-deltoid','rhomboids'],props:strap(2.3),
  frames:{start:mk(30,8),mid:mk(22,50),end:mk(8,88)}});}
// ---- backward walk legs (shared) ----
const bwLegs=(fl)=>({legL:fl?{pos:[0.12,0,0.14],anchor:'sole',pitch:0,yaw:6,pole:[0.2,0,1]}:{pos:[0.12,0.02,-0.3],anchor:'ball',pitch:32,toes:0,yaw:6,pole:[0.2,0,1]},
  legR:!fl?{pos:[-0.12,0,0.14],anchor:'sole',pitch:0,yaw:-6,pole:[-0.2,0,1]}:{pos:[-0.12,0.02,-0.3],anchor:'ball',pitch:32,toes:0,yaw:-6,pole:[-0.2,0,1]}});
const bwMid={legL:{pos:[0.12,0.09,-0.1],anchor:'sole',pitch:8,yaw:6,pole:[0.2,0,1]},legR:{pos:[-0.12,0,-0.02],anchor:'sole',pitch:0,yaw:-6,pole:[-0.2,0,1]}};
// ---- sled-overhead-backward-walk: arms locked overhead, walk backward ----
{const arm=()=>({fk:{flex:172,abd:10,rot:0,elbow:4},rel:'chest',hand:'relaxed',curl:0.5,pron:0});
 const mk=(fl)=>stand({pos:[0,0.91,-0.1],pitch:-3},{flex:-2},{flex:0},bwLegs(fl),arm(),arm());
 const s=mk(true),e=mk(false),m={...cl(s),...cl(bwMid)};
 out('sled-overhead-backward-walk',{camera:{az:60,el:10},muscles:['shoulders','traps'],props:strap(2.5),frames:{start:s,mid:m,end:e}});}
// ---- sled-overhead-triceps-extension: facing away, upper arms vertical, extend elbows ----
{const arm=(el)=>({fk:{flex:168,abd:6,rot:0,elbow:el},rel:'chest',hand:'relaxed',curl:0.5,pron:0});
 const mk=(el)=>stand({pos:[0,0.91,0],pitch:6},{flex:0},{flex:0},{legL:{pos:[0.13,0,0.14],anchor:'sole',pitch:0,yaw:6,pole:[0.2,0,1]},legR:{pos:[-0.13,0,-0.14],anchor:'sole',pitch:0,yaw:-6,pole:[-0.2,0,1]}},arm(el),arm(el));
 out('sled-overhead-triceps-extension',{camera:{az:55,el:10},muscles:['triceps'],props:[{type:'sled',pos:[0,0,-2.3],yaw:0,plates:2},{type:'sled-straps',hands:true,to:[0,0.13,-1.77]}],
  frames:{start:mk(125),mid:mk(65),end:mk(6)}});}
// ---- forward-drag-with-press: facing away from the sled, hands at chest then press forward ----
{const h=(s,x,y,z)=>hand(s,[x,y,z],[0,0.15,1],[-1,0,0],[0.6,-0.8,-0.4]);
 const L=(zl,zr,lift)=>({legL:{pos:[0.13,0,zl],anchor:'sole',pitch:0,yaw:6,pole:[0.2,0,1]},legR:{pos:[-0.13,0,zr],anchor:'sole',pitch:0,yaw:-6,pole:[-0.2,0,1]}});
 const mk=(legs,x,y,z,pz=0)=>stand({pos:[0,0.89,pz],pitch:14},{flex:2},{flex:-8},legs,h(1,x,y,z),h(-1,x,y,z));
 const A=L(0.15,-0.15),B=L(-0.15,0.15);
 const stepMid={legL:{pos:[0.13,0,0.0],anchor:'sole',pitch:0,yaw:6,pole:[0.2,0,1]},legR:{pos:[-0.13,0.09,0.0],anchor:'sole',pitch:12,yaw:-6,pole:[-0.2,0,1]}};
 const s=mk(A,0.28,1.28,0.3),m=mk(A,0.2,1.38,0.62),m2=mk(stepMid,0.28,1.28,0.3,0),e=mk(B,0.28,1.28,0.3,0);
 out('forward-drag-with-press',{camera:{az:55,el:10},muscles:['chest','triceps'],props:[{type:'sled',pos:[0,0,-2.6],yaw:0,plates:2},{type:'sled-straps',hands:true,to:[0,0.13,-2.07]}],
  frames:{start:s,mid:m,mid2:m2,end:e}});}
// ---- bear-crawl-sled-drags: hands and toes, belt chain to the sled behind ----
{const hnd=(s,z)=>({pos:[0.3*s,0,z],contact:true,fingers:[0.12*s,0,1],palm:[0,-1,0],curl:-0.3,pole:[0.9*s,0.2,-0.5]});
 const ft=(s,z,y=0)=>({pos:[0.12*s,y,z],anchor:'ball',pitch:70,toes:0,pole:[0.08*s,0.6,1]});
 const mk=(rz,hl,hr,fl,fr)=>({root:{pos:[0,0.5,rz],pitch:78},spine:{flex:0},neck:{flex:-30},armL:hnd(1,hl),armR:hnd(-1,hr),legL:ft(1,fl),legR:ft(-1,fr)});
 // world positions: left hand + right foot planted, right hand + left foot swing forward, body advances
 const s=mk(0,0.58,0.46,-0.46,-0.30),m=mk(0.08,0.58,0.58,-0.30,-0.30),e=mk(0.13,0.58,0.71,-0.14,-0.30);
 m.armR.pos[1]=0.06;m.legL.pos[1]=0.07;
 out('bear-crawl-sled-drags',{camera:{az:55,el:14},muscles:['quadriceps','shoulders'],props:[{type:'sled',pos:[0,0,-2.7],yaw:0,plates:3},{type:'harness',follow:true,to:[0,0.13,-2.17]}],
  frames:{start:s,mid:m,end:e}});}
