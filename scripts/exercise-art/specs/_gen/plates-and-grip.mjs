import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const legs = (w=0.12) => ({ legL:{pos:[w,0,0.03],anchor:'sole',yaw:8,pitch:0,pole:[0.1,0,1]}, legR:{pos:[-w,0,0.03],anchor:'sole',yaw:-8,pitch:0,pole:[-0.1,0,1]} });
const lerp = (a,b,t)=>a+(b-a)*t;
const unit = v => { const n=Math.hypot(...v); return v.map(x=>x/n); };
// plate held at 3 and 9 o'clock, centre c, turned by th degrees about Z, arms nearly straight
const plateArms = (c, th, pole=[0.3,-1,-0.2], r=0.213, fy=0.12, tk=0) => {
  const t = th*Math.PI/180, cs=Math.cos(t), sn=Math.sin(t);
  const mk = s => ({ pos:[s*r*cs, c[1]+s*r*sn, c[2]], contact:true, fingers:unit([-s*sn*tk*0.5,fy+cs*0+s*cs*tk*0.0,0.99]), palm:[-s*cs,-s*sn,0], curl:0.85, pole:[s*pole[0],pole[1],pole[2]] });
  return { armL:mk(1), armR:mk(-1) };
};
const fr = (arms, extra={}) => ({ root:{pos:[0,0.925,0]}, ...arms, ...legs(), ...extra });

// front-plate-raise (gallery weight-plate numbers)
{
  const g = (y,z,fy,pole,sp=0) => fr(plateArms([0,y,z],0,pole,0.213,fy), sp?{spine:{flex:sp}}:{});
  const sp = (y,z,fy,pole) => { const f=g(y,z,fy,pole); for (const k of ['armL','armR']) f[k].fingers=unit([0,fy,0.99]); return f; };
  const a = (y,z,fy,pole)=>{const f=g(y,z,fy,pole); f.armL.pos[1]=y; f.armR.pos[1]=y; f.armL.pos[2]=z; f.armR.pos[2]=z; return f;};
  W('front-plate-raise',{camera:{az:60,el:6},muscles:['anterior-deltoid','shoulders'],props:[{type:'weight-plate',hands:true,kg:20}],
    frames:{ start:a(0.92,0.33,-0.45,[0.25,-0.2,-1]), mid:a(1.25,0.5,-0.2,[0.3,-0.6,-0.6]), end:a(1.53,0.56,0.12,[0.3,-1,-0.2]) }});
}
// car-drivers: plate at shoulder height, turned like a wheel
{
  const c=[0,1.38,0.5], f = th => fr(plateArms(c,th,[+(process.env.PX??0.8),+(process.env.PY??-1),+(process.env.PZ??-0.2)],0.213,0.05,+(process.env.TK??0)));
  W('car-drivers',{camera:{az:30,el:6},muscles:['shoulders','anterior-deltoid'],props:[{type:'weight-plate',hands:true,kg:15}],
    frames:{ start:f(+(process.env.A??36)), mid:f(+(process.env.A??36)/2), mid2:f(0), mid3:f(-(process.env.A??36)/2), end:f(-(process.env.A??36)) }});
}
// svend press
{
  const a = (y,z,pole) => ({ armL:{pos:[0.031,y,z],contact:true,fingers:[0,0.15,1],palm:[-1,0,0],curl:0.05,pole:[pole[0],pole[1],-0.2]}, armR:{pos:[-0.031,y,z],contact:true,fingers:[0,0.15,1],palm:[1,0,0],curl:0.05,pole:[-pole[0],pole[1],-0.2]} });
  W('svend-press',{camera:{az:58,el:6},muscles:['chest','anterior-deltoid'],props:[{type:'weight-plate',hands:true,hold:'squeeze',kg:5,count:2}],
    frames:{ start:fr(a(1.25,0.3,[0.8,-0.6])), mid:fr(a(1.28,0.46,[0.65,-0.7])), end:fr(a(1.3,0.62,[0.5,-0.8])) }});
}
// reverse plate curls: overhand on the top rim (11 and 1 o'clock), plate hangs below the hands
{
  const f = (hy,hz,pole,fing,palm,pc) => ({ root:{pos:[0,0.925,0]}, ...legs(),
    armL:{pos:[0.11,hy,hz],contact:true,hand:'grip',grip:0.02,fingers:fing,palm,pole:[pole[0],pole[1],pole[2]]},
    armR:{pos:[-0.11,hy,hz],contact:true,hand:'grip',grip:0.02,fingers:[-fing[0],fing[1],fing[2]],palm:[-palm[0],palm[1],palm[2]],pole:[-pole[0],pole[1],pole[2]]},
    props:[{type:'weight-plate',kg:20,at:[0,hy-0.196,hz],normal:[0,0,1]}] });
  W('reverse-plate-curls',{camera:{az:55,el:6},muscles:['biceps','forearms'],
    props:[],frames:{
      start:f(0.95,0.36,[0.8,-0.3,-0.6],[0,0.05,1],[0,-1,0.05]),
      mid:f(1.02,0.44,[0.8,-0.4,-0.6],[0,0.07,1],[0,-1,0.07]),
      mid2:f(1.15,0.4,[0.3,-0.5,-1],[0,0.1,1],[0,-1,0.1]),
      end:f(1.32,0.3,[0.3,-0.8,-1],[0,0.3,0.95],[0,-0.95,0.3]) }});
}
// plate pinch (hold) and plate hand squeeze
{
  const arm = { fk:{flex:0,abd:8,elbow:14}, curl:0.3 };
  W('plate-pinch',{camera:{az:62,el:6},muscles:['forearms'],props:[{type:'weight-plate',hand:'L',kg:10,count:2}],
    frames:{ start:{ root:{pos:[0,0.925,0]}, armL:{pos:[0.3,0.86,0.02],contact:true,fingers:[0.02,-1,0],palm:[-1,0,0],curl:0.7,pole:[0.5,0,-1]}, armR:arm, ...legs() }}});
  const h = (s,curl) => ({pos:[s*0.3,0.86,0.02],contact:true,fingers:[s*0.02,-1,0],palm:[-s,0,0],curl,pole:[s*0.5,0,-1]});
  const f = curl => ({ root:{pos:[0,0.925,0]}, armL:h(1,curl), armR:h(-1,curl), ...legs() });
  W('standing-olympic-plate-hand-squeeze',{camera:{az:62,el:6},muscles:['forearms'],props:[{type:'weight-plate',hand:'L',kg:10},{type:'weight-plate',hand:'R',kg:10}],
    frames:{ start:f(0.3), end:f(0.85) }});
}
// wrist roller
{
  const a = (fy,pm,drop) => ({ root:{pos:[0,0.925,0]}, ...legs(0.11),
    armL:{pos:[0.14,1.34,0.6],contact:true,fingers:[0,fy,1],palm:[0,-1,pm],curl:0.85,pole:[0.4,-0.8,-0.3]},
    armR:{pos:[-0.14,1.34,0.6],contact:true,fingers:[0,fy,1],palm:[0,-1,pm],curl:0.85,pole:[-0.4,-0.8,-0.3]},
    props:[{type:'wrist-roller',hands:true,kg:5,drop,ropeLength:1.15}] });
  W('wrist-roller',{camera:{az:62,el:6},muscles:['forearms'],frames:{ start:a(-0.1,-0.1,1.08), mid:a(0.07,0.07,0.8), end:a(0.25,0.25,0.55) }});
}
// wrist rotations with straight bar: palms down, hands see-saw alternately
{
  const hand = (s,e) => { const t=e*Math.PI/180; return { pos:[s*0.2,1.3+0.07*Math.sin(t),0.5+0.02*Math.cos(t)-0.02], contact:true,hand:'grip',grip:0.014, fingers:[0,Math.sin(t),Math.cos(t)], palm:[0,-Math.cos(t),Math.sin(t)], pole:[s*0.3,-1,-0.3] }; };
  const f = (eL,eR) => ({ root:{pos:[0,0.925,0]}, armL:hand(1,eL), armR:hand(-1,eR), ...legs() });
  W('wrist-rotations-with-straight-bar',{camera:{az:55,el:8},muscles:['forearms'],props:[{type:'barbell',hands:true,plates:[]}],
    frames:{ start:f(30,-30), mid:f(0,0), end:f(-30,30) }});
}
// behind-the-back wrist curl: palms back, bar behind the glutes, wrists only
{
  const hand = (s,a) => { const t=a*Math.PI/180, fi=[0,-Math.cos(t),-Math.sin(t)], pa=[0,Math.sin(t),-Math.cos(t)];
    return { pos:[s*0.21, 0.92+0.08*fi[1]+0.03*pa[1], -0.2+0.08*fi[2]+0.03*pa[2]], contact:true,hand:'grip',grip:0.014, fingers:[0,fi[1],fi[2]], palm:[0,pa[1],pa[2]], pole:[s*0.3,0.3,-1] }; };
  const f = a => ({ root:{pos:[0,0.925,0]}, armL:hand(1,a), armR:hand(-1,a), ...legs() });
  W('standing-palms-up-barbell-behind-the-back-wrist-curl',{camera:{az:125,el:10},muscles:['forearms'],props:[{type:'barbell',hands:true,plates:[]}],
    frames:{ start:f(-25), end:f(55) }});
}
