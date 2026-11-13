import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const knee=JSON.parse(fs.readFileSync('/tmp/claude-1000/-home-dev-peppa/6cc91ee7-0982-44ea-9a8a-82820394b256/scratchpad/knee.json'));
const UP={y:0.441,z:-0.001,p:70.065,n:-8,fp:62}, DN={y:0.21,z:0.084,p:85.543,n:-18,fp:76};
// transform a floor point (x,y,z) by yaw about origin then shift
const T=(v,yaw,dx,dy)=>{const a=yaw*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [v[0]*c+v[2]*s+dx,v[1]+dy,-v[0]*s+v[2]*c];};
function frame(S,{hx=0.27,hz=0.5,yaw=0,dx=0,dy=0,hl=0,air=hl>0,pole=true}={}){
 const arm=k=>{const x=k*hx;const f=air?[k*0.12,-0.5,0.85]:[k*0.12,0,1];const pos=T([x,air?0.03:0,hz],yaw,dx,dy);const ff=T(f,yaw,0,0);
  const o={pos,hand:'flat',contact:!air,fingers:ff,palm:air?[0,-0.85,-0.5]:[0,-1,0],spread:1};
  if(air){o.contact=false;}
  if(S===DN&&pole)o.pole=[k*0.75,0.55,-0.45];return o;};
 const leg=k=>({pos:T([k*0.1,0,-0.81],yaw,dx,dy),anchor:'ball',pitch:S.fp+(air?25:0),yaw:0,toes:0});
 return {root:{pos:T([0,S.y,S.z],yaw,dx,dy),yaw,pitch:S.p},neck:{flex:S.n},armL:arm(1),armR:arm(-1),legL:leg(1),legR:leg(-1)};
}
const out={};
const save=(slug,camera,muscles,frames,more={})=>out[slug]={slug,camera,muscles,...more,frames};
save('pushups',{az:52,el:5},['chest','triceps'],{start:frame(UP),end:frame(DN)});
save('tempo-push-up',{az:52,el:5},['chest','triceps'],{start:frame(UP),end:frame(DN)},{timing:{there:4,holdEnd:2,back:1}});
save('push-up-wide',{az:45,el:6},['chest'],{start:frame(UP,{hx:0.27,hz:0.5}),end:frame(DN,{hx:0.27,hz:0.5})});
save('pushups-close-and-wide-hand-positions',{az:45,el:6},['chest'],{start:frame(UP,{hx:0.27,hz:0.5}),end:frame(DN,{hx:0.27,hz:0.5})});
save('push-ups-close-triceps-position',{az:60,el:6},['triceps','chest'],{start:frame(UP,{hx:0.15,hz:0.46}),end:frame(DN,{hx:0.15,hz:0.46,pole:false})});
// close: elbows tucked
out['push-ups-close-triceps-position'].frames.end.armL.pole=[0.75,0.5,-0.7];out['push-ups-close-triceps-position'].frames.end.armR.pole=[-0.75,0.5,-0.7];
// hands at x=k*hx, height hl (0 = planted); body pivots about the toes by yaw; feet stay put
const P=[0,0,-0.81];
const R=(v,yaw)=>{const a=yaw*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=v[0]-P[0],z=v[2]-P[2];return [x*c+z*s+P[0],v[1],-x*s+z*c+P[2]];};
function fr(S,{eq=false,hx=0.27,hz=0.5,yaw=0,hl=0,pole=null,dpitch=0,dy=0,H={},tilt=0}={}){
 const arm=(k,n)=>{const h={hx,hz,yaw,hl,...(H[n]||{})};const air=h.hl>0;
  const D=v=>R(v,h.yaw).map((x,i)=>x-R([0,0,0],h.yaw)[i]);
  const o={pos:R([k*h.hx,h.hl,h.hz],h.yaw),hand:'flat',contact:!air,fingers:D([k*(h.hx>0.3?0.3:0.12),air?tilt:0,1]),palm:[0,-1,0],spread:1};
  const P0=(S===DN||eq)?(pole?pole(k):[k*0.75,0.55,-0.45]):[k*0.4,0.55,-0.25];o.pole=R(P0,yaw).map((x,i)=>x-R([0,0,0],yaw)[i]);return o;};
 const leg=k=>({pos:R([k*0.1,0,-0.81],yaw),anchor:'ball',pitch:S.fp,yaw:0,toes:0});
 return {root:{pos:R([0,S.y+dy,S.z],yaw),yaw,pitch:S.p+dpitch},neck:{flex:S.n},armL:arm(1,'L'),armR:arm(-1,'R'),legL:leg(1),legR:leg(-1)};
}
// knee push-up: knees on the floor, shins back, straight line knees-hips-shoulders
const kn=(y,z,p,n)=>{const f=JSON.parse(JSON.stringify(knee.frames.start));f.root={pos:[0,y,z],pitch:p};f.neck={flex:n};
 for(const a of ['armL','armR']){f[a].hand='flat';f[a].spread=1;delete f[a].curl;f[a].pole=[(a==='armL'?1:-1)*0.75,0.5,-0.45];}
 for(const l of ['legL','legR']){f[l].pos=[l==='legL'?0.11:-0.11,0.115,-0.8];f[l].pitch=160;}return f;};
const ks=kn(0.35,0,58,-4),ke=kn(0.18,0.05,77,-12);delete ks.armL.pole;delete ks.armR.pole;
save('knee-push-up',{az:90,el:4},['chest','triceps'],{start:ks,end:ke},{tempo:{lift:'back'}});
// plyo: bottom -> flight: straight plank, hands 15 cm clear, toes planted
const FL={y:0.488,z:-0.0275,p:66.6,n:-8,fp:UP.fp};
save('plyo-push-up',{az:90,el:4},['chest','triceps'],{start:fr(DN),end:fr(FL,{hl:0.12,hz:0.38,tilt:-0.7})},{tempo:{lift:'back'}});
// one hand steps at a time (the other bears the weight); the loop ends with both hands back where it began
const L=0.12;
const seq=(A,B)=>{
 const U=(P,H)=>fr(UP,{...P,dy:(P.dy??-0.04),H}),Dn=(P,H)=>fr(DN,{...P,H});
 const wa=(hl)=>({hx:A.hx,hz:A.hz,yaw:0,hl}),wb=(hl)=>({hx:B.hx,hz:B.hz,yaw:B.yaw||0,hl});
 const half={...B,yaw:(B.yaw||0)/2,dy:B.dy??-0.04};
 return {start:U(A,{}),mid:Dn(A,{}),mid2:U(half,{L:wb(L),R:wa(0)}),mid3:Dn(half,{L:wb(0),R:wa(0)}),mid4:U(half,{L:wb(0),R:wa(0)}),mid5:U(half,{L:wa(L),R:wa(0)}),end:U(A,{L:wa(0),R:wa(0)})};
};
// body of the stepped frames carries the body pose of its own set (A or B); hands are listed per hand
save('clock-push-up',{az:60,el:8},['chest','triceps'],seq({hx:0.27,hz:0.5},{hx:0.27,hz:0.5,yaw:7}),{tempo:{lift:'back'}});
const tuck=k=>[k*0.75,0.5,-0.7];
save('pushups-close-and-wide-hand-positions',{az:45,el:6},['chest','triceps'],seq({hx:0.15,hz:0.46,eq:true},{hx:0.3,hz:0.5,eq:true,dy:-0.035}),{tempo:{lift:'back'}});
for(const[k,v]of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
