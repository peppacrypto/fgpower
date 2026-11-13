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
 const w=walk(b);for(const f of Object.values(w))for(const k of['armL','armR'])f[k].scap={elev:-4,prot:0};out('farmers-walk',g,w,{floats:undefined,camera:{az:62,el:7},tempo:{lift:'even',even:0.7,hold:0}});}
// rickshaw
{const g=G('rickshaw');
 out('rickshaw-deadlift',g,lift(g,{pos:[0,0.76,-0.1],pitch:38},0.62),{muscles:['quadriceps','glutes','spinal-erectors']});
 const w=walk(cl(g.frames.end));out('rickshaw-carry',g,w,{muscles:['forearms','traps'],tempo:{lift:'even',even:0.7,hold:0}});}
// car deadlift
{const g=G('car-deadlift');
 out('car-deadlift',g,lift(g,{pos:[0,0.78,-0.1],pitch:36},0.64));}
// yoke
{const g=G('yoke');const b=cl(g.frames.end);
 const w=walk(b);for(const f of Object.values(w)){f.root.pos[0]=0;for(const [k,m] of [['armL',1],['armR',-1]])f[k].pos[0]=0.44*m;}
 out('yoke-walk',g,w,{camera:{az:55,el:8},tempo:{lift:'even',even:0.7,hold:0}});}
// conans wheel (zercher, bar in the elbow crooks, walking the arc)
{const g=G('conans-wheel');const b=cl(g.frames.start);
 for(const [k,m] of [['armL',1],['armR',-1]])Object.assign(b[k],{pos:[0.22*m,1.44,0.31],pole:[0.5*m,-0.3,0],fingers:[-0.5*m,0.75,0.2]});
 const w=walk(b);
 for(const f of Object.values(w))for(const k of['armL','armR'])f[k].hand='fist';out('conans-wheel',g,w,{muscles:['quadriceps','shoulders','forearms','obliques'],tempo:{lift:'even',even:0.8,hold:0}});}
// crucifix: raise from the sides to arms-out, hold, lower
{const g=G('strongman-axe');const e=cl(g.frames.start),st=cl(e),m=cl(e);
 for(const [k,x] of [['armL',1],['armR',-1]]){
  Object.assign(st[k],{pos:[0.34*x,0.815,0.02],fingers:[0,-1,0],palm:[-x,0,0],pole:[0.8*x,0.1,-0.4]});
  Object.assign(m[k],{pos:[0.6*x,1.08,0.02],fingers:[0.95*x,-0.3,0],palm:[0,0.1,1],pole:[0.1*x,-1,-0.1]});}
 out('crucifix',g,{start:st,mid:m,end:e},{muscles:['shoulders','traps','forearms'],tempo:{lift:'there'}});}
