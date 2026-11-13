import fs from 'fs';
const G=n=>JSON.parse(fs.readFileSync(new URL(`../_gallery/${n}.json`,import.meta.url)));
const cl=o=>JSON.parse(JSON.stringify(o));
const out=(slug,g,frames,over={})=>fs.writeFileSync(new URL(`../${slug}.json`,import.meta.url),JSON.stringify({...g,slug,...over,frames},null,1));
// lift = start (bent) -> mid -> end (standing)
const lift=(g,mr,mid)=>{const s=cl(g.frames.start),e=cl(g.frames.end),m=cl(s);
 m.root=mr;m.spine={flex:3};m.neck={flex:-10};
 for(const k of['armL','armR'])m[k].pos=[s[k].pos[0],mid,(s[k].pos[2]+e[k].pos[2])/2];
 return {start:s,mid:m,end:e};};
// walk: world-fixed planted feet, the body advances; each swing foot is lifted on a mid frame
const walk=(base,o={})=>{
 const sh=(f,dz,dx=0)=>{f.root.pos=[dx,f.root.pos[1],f.root.pos[2]+dz];for(const k of['armL','armR'])f[k].pos=[f[k].pos[0]+dx,f[k].pos[1],f[k].pos[2]+dz];return f;};
 const s=cl(base);
 s.legL={pos:[0.13,0,0.2],anchor:'sole',pitch:0,toes:0,yaw:5};
 s.legR={pos:[-0.13,0,-0.14],anchor:'ball',pitch:22,toes:0,yaw:-5};
 const w0=sh(cl(s),0.03,0.11);
 const m=sh(cl(s),0.1,0.11);m.root.pos[1]+=0.01;
 m.legR={pos:[-0.1,0.1,-0.04],anchor:'ball',pitch:30,toes:0,yaw:-5};
 const m2=sh(cl(s),0.16,0.13);
 m2.legR={pos:[-0.13,0.06,0.36],anchor:'sole',pitch:-8,toes:0,yaw:-5};
 const e=sh(cl(s),0.26);
 e.legR={pos:[-0.13,0,0.4],anchor:'sole',pitch:0,toes:0,yaw:-5};
 const l=cl(e);l.legR=cl(e.legR);sh(l,0,0.09);l.root.pos[2]=0.22;
 for(const k of['armL','armR'])l[k].pos[2]=e[k].pos[2]-0.04;
 return {start:s,mid:w0,mid2:m,mid3:m2,mid4:l,end:e};};
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
 for(const [k,m] of [['armL',1],['armR',-1]])Object.assign(b[k],{contact:false,pos:[0.5*m,1.25,0.04],pole:[0.3*m,-1,-0.5],fingers:[0,1,0],palm:[m,0,0],curl:0.12});
 const w=walk(b);out('yoke-walk',g,w);}
// conans wheel (zercher, bar in the elbow crooks, walking the arc)
{const g=G('conans-wheel');const b=cl(g.frames.start);
 for(const [k,m] of [['armL',1],['armR',-1]])Object.assign(b[k],{pos:[0.22*m,1.44,0.31],pole:[0.5*m,-0.3,0],fingers:[-0.5*m,0.75,0.2]});
 const w=walk(b);
 out('conans-wheel',g,w);}
// crucifix: static hold
{const g=G('strongman-axe');out('crucifix',g,{start:cl(g.frames.start)},{muscles:['shoulders']});}
