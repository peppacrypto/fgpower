import fs from 'fs';
const G=n=>JSON.parse(fs.readFileSync(new URL(`../_gallery/${n}.json`,import.meta.url)));
const cl=o=>JSON.parse(JSON.stringify(o));
const out=(slug,g,frames,over={})=>fs.writeFileSync(new URL(`../${slug}.json`,import.meta.url),JSON.stringify({...g,slug,...over,frames},null,1));
// lift = start (bent) -> mid -> end (standing)
const lift=(g,mr,mid)=>{const s=cl(g.frames.start),e=cl(g.frames.end),m=cl(s);
 m.root=mr;m.spine={flex:3};m.neck={flex:-10};
 for(const k of['armL','armR'])m[k].pos=[s[k].pos[0],mid,(s[k].pos[2]+e[k].pos[2])/2];
 return {start:s,mid:m,end:e};};
// walk: foot-forward frames; carried items stay in the hands
const walk=(base,o={})=>{
 const mk=(fwdL)=>{const f=cl(base);const a=fwdL?1:-1;
  f.legL={pos:[0.13,fwdL?0:0.02,fwdL?0.2:-0.16],anchor:fwdL?'sole':'ball',pitch:fwdL?0:22,toes:0,yaw:5};
  f.legR={pos:[-0.13,fwdL?0.02:0,fwdL?-0.16:0.2],anchor:fwdL?'ball':'sole',pitch:fwdL?22:0,toes:0,yaw:-5};
  f.root={...f.root,pos:[0,f.root.pos[1],f.root.pos[2]]};return f;};
 const s=mk(true),e=mk(false),m=cl(s);
 m.legL={pos:[0.1,0,0.02],anchor:'sole',pitch:0,yaw:5};m.legR={pos:[-0.1,0.07,0.05],anchor:'ball',pitch:30,toes:0,yaw:-5};
 m.root={...s.root,pos:[0,s.root.pos[1]+0.012,s.root.pos[2]]};
 const m2=cl(m);m2.legL=cl(m.legR);m2.legL.pos[0]=0.1;m2.legR=cl(m.legL);m2.legR.pos[0]=-0.1;m2.legL.yaw=5;m2.legR.yaw=-5;
 return {start:s,mid:m,mid2:m2,end:e};};
const standBase=(g,pairs)=>cl(g.frames.end);

// farmers walk
{const g=G('farmers-handle');const b=cl(g.frames.end);
 const w=walk(b);out('farmers-walk',g,w,{floats:undefined});}
// rickshaw
{const g=G('rickshaw');
 out('rickshaw-deadlift',g,lift(g,{pos:[0,0.68,-0.12],pitch:30},0.62),{muscles:['quadriceps','glutes','spinal-erectors']});
 const w=walk(cl(g.frames.end));out('rickshaw-carry',g,w,{muscles:['forearms','traps']});}
// car deadlift
{const g=G('car-deadlift');
 out('car-deadlift',g,lift(g,{pos:[0,0.72,-0.12],pitch:26},0.64));}
// yoke
{const g=G('yoke');const b=cl(g.frames.end);
 for(const [k,m] of [['armL',1],['armR',-1]])Object.assign(b[k],{pos:[0.5*m,1.25,0.04],pole:[0.3*m,-1,-0.5],fingers:[0,1,0],palm:[m,0,0],curl:0.12});
 const w=walk(b);out('yoke-walk',g,w);}
// conans wheel (zercher, bar in the elbow crooks, walking the arc)
{const g=G('conans-wheel');const b=cl(g.frames.start);
 for(const [k,m] of [['armL',1],['armR',-1]])Object.assign(b[k],{pos:[0.22*m,1.44,0.31],pole:[0.5*m,-0.3,0],fingers:[-0.5*m,0.75,0.2]});
 const w=walk(b);
 out('conans-wheel',g,w);}
// crucifix: static hold
{const g=G('strongman-axe');out('crucifix',g,{start:cl(g.frames.start)},{muscles:['shoulders']});}
