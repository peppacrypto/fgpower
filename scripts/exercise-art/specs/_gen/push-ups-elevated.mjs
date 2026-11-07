import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/', O=W+'_gen/orig/pue-';
const R=Math.PI/180, rd=s=>JSON.parse(fs.readFileSync(O+s+'.json'));
const wr=o=>fs.writeFileSync(W+o.slug+'.json',JSON.stringify(o,null,1));
// body-frame hand offset from root (a along body, b perpendicular), calibrated on the floor push-up
const AB={up:[0.475,0.61],dn:[0.55,0.26]};
const rootFor=(P,hz,hy,[a,b])=>{const s=Math.sin(P*R),c=Math.cos(P*R);return [hz-a*s-b*c,hy-a*c+b*s];};
const LEG=0.855;
const feet=(P,r)=>{const f=(P-8.3)*R;return [r[0]-LEG*Math.sin(f),r[1]-LEG*Math.cos(f)];};
function solveStart(hz,hy,fy,ab){let best=[9,0];for(let P=8;P<100;P+=0.05){const F=feet(P,rootFor(P,hz,hy,ab));const e=Math.abs(F[1]-fy);if(e<best[0])best=[e,P];}return best[1];}
function solveEnd(hz,hy,F0,ab){let best=[9,0];for(let P=8;P<125;P+=0.05){const F=feet(P,rootFor(P,hz,hy,ab));const e=Math.hypot(F[0]-F0[0],F[1]-F0[1]);if(e<best[0])best=[e,P];}return best[1];}
const adj=(ab,lat)=>[ab[0],Math.sqrt(Math.max(ab[1]**2+0.0064-lat**2,0.01))];
// build both frames. hand(k)->arm object, hx lateral, H=[hz,hy], fy feet height, fpOff foot pitch offset
function build({hx,H,fy,fpOff,hand,poleEnd,abEnd,neck=[-10,-22],abStart,poleStart}){
 const lat=Math.max(hx-0.19,0)+0.0, ab0=adj(AB.up,Math.abs(hx-0.19)+(typeof abStart==='number'?abStart:0)), ab1=adj(abEnd||AB.dn,Math.abs(hx-0.19));
 const P0=solveStart(H[0],H[1],fy,ab0), r0=rootFor(P0,H[0],H[1],ab0), F0=feet(P0,r0);
 const P1=solveEnd(H[0],H[1],F0,ab1), r1=rootFor(P1,H[0],H[1],ab1);
 const fr=(P,r,n,end)=>{const o={root:{pos:[0,+r[1].toFixed(3),+r[0].toFixed(3)],pitch:+P.toFixed(2)},neck:{flex:n}};
  for(const [s,k] of [['L',1],['R',-1]]){const a=hand(k,hx);if(end&&poleEnd)a.pole=poleEnd.map((v,i)=>i==0?v*k:v);if(!end&&poleStart)a.pole=poleStart.map((v,i)=>i==0?v*k:v);o['arm'+s]=a;
   o['leg'+s]={pos:[k*0.1,fy,+F0[0].toFixed(3)],anchor:'ball',pitch:+(P-fpOff).toFixed(1),toes:0};}
  return o;};
 return {start:fr(P0,r0,neck[0],false),end:fr(P1,r1,neck[1],true),F0,P0,P1};
}
const bar=(barY,fingers,palm)=>(k,hx)=>({pos:[k*hx,barY,0],hand:'grip',grip:0.014,fingers:fingers.map((v,i)=>i==0?v*k:v),palm:palm.map((v,i)=>i==0?v*k:v)});
const OVER=[[0,-0.45,0.89],[0,-0.89,-0.45]], UNDER=[[0,0.15,0.99],[0,0.99,-0.15]];
const floor=(k,hx)=>({pos:[k*hx,0,0],contact:true,hand:'flat',fingers:[k*0.12,0,1],palm:[0,-1,0]});
function smith(slug,hx,[f,p],muscles,pe=[0.3,0.2,-0.9],bEnd=0.32,ps=null,barY=0.95,extra={}){
 const b=build({hx,H:[0,barY],fy:0,fpOff:5,hand:bar(barY,f,p),poleEnd:pe,abEnd:[0.5,bEnd],poleStart:ps});
 wr({slug,camera:{az:75,el:6},muscles,props:[{type:'smith',barY,plates:[]}],...extra,frames:{start:b.start,end:b.end}});
}
smith('incline-push-up-close-grip',0.06,OVER,['triceps','chest'],[0.55,0.4,-0.7],0.56);
smith('incline-push-up-medium',0.20,OVER,['chest','triceps']);
smith('incline-push-up-reverse-grip',0.20,UNDER,['chest','triceps'],[0.2,-0.3,-0.9],0.32,[-0.5,0,-0.85]);
smith('incline-push-up-wide',0.40,OVER,['chest','triceps']);
// body tricep press: bar at chest height, elbows go forward
{const barY=1.12,hx=0.19;const b=build({hx,H:[0,barY],fy:0,fpOff:5,hand:bar(barY,OVER[0],OVER[1]),poleEnd:[0.1,-1,0.3],abEnd:[0.5,0.3]});
 wr({slug:'body-tricep-press',camera:{az:75,el:6},muscles:['triceps','chest'],props:[{type:'smith',barY,plates:[]}],frames:{start:b.start,end:b.end}});}
// feet raised
{const hx=0.45,hz=0.0;
 const hand=(k,h)=>({pos:[k*h,0,0],contact:true,hand:'flat',fingers:[k*0.12,0,1],palm:[0,-1,0]});
 // decline: hands floor at z 0, feet on bench y .48
 let b=build({hx,H:[0,0],fy:0.48,fpOff:17,hand,poleEnd:[0.65,0.4,-0.65],abEnd:[0.52,0.36],abStart:0.08});
 wr({slug:'decline-push-up',camera:{az:58,el:6},muscles:['chest','anterior-deltoid','triceps'],floats:true,props:[{type:'flat-bench',height:0.47,pos:[0,0,+(b.F0[0]-0.75).toFixed(3)]}],frames:{start:b.start,end:b.end}});
 b=build({hx,H:[0,0],fy:0.60,fpOff:17,hand,poleEnd:[0.65,0.4,-0.65],abEnd:[0.52,0.36],abStart:0.08});
 wr({slug:'push-ups-with-feet-on-an-exercise-ball',camera:{az:58,el:6},muscles:['chest','anterior-deltoid','triceps'],floats:true,props:[{type:'stability-ball',pos:[0,0,+(b.F0[0]-0.12).toFixed(3)],radius:0.325,load:0.5}],frames:{start:b.start,end:b.end}});}
// reused, already clean
for(const s of ['push-ups-with-feet-elevated','wall-push-up']){wr(rd(s));}
// hands were 2 cm into the cushion crown: rest them on it
for(const s of ['incline-push-up','sofa-triceps-extension']){const o=rd(s);for(const f of Object.values(o.frames))for(const a of ['armL','armR']){f[a].pos[1]=0.434;f[a].curl=-0.3;}wr(o);}
