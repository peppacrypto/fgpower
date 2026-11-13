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
// knee: reuse existing numbers, hands flat
const kf=f=>{const r=JSON.parse(JSON.stringify(f));r.root.pitch+=0.8;for(const a of ['armL','armR'])r[a].pos[2]+=0.0;for(const a of ['armL','armR']){r[a].hand='flat';r[a].spread=1;delete r[a].curl;}for(const l of ['legL','legR']){r[l].pos[1]+=0.04;r[l].pitch=160;}return r;};
save('knee-push-up',{az:55,el:6},['chest','triceps'],{start:kf(knee.frames.start),end:kf(knee.frames.end)});
// plyo: bottom -> airborne top (hands off floor)
save('plyo-push-up',{az:52,el:5},['chest','triceps'],{start:frame(DN),end:frame(UP,{dy:0.28,hl:0.28})},{floats:true});
// clock: bottom, airborne mid, bottom shifted 0.38 and turned 30
save('clock-push-up',{az:60,el:8},['chest','triceps'],{
 start:frame(DN),
 mid:frame(UP,{dx:0.19,yaw:15,dy:0.3,hl:0.3,hx:0.3}),
 end:frame(DN,{dx:0.34,yaw:7})},{floats:true});
for(const[k,v]of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
