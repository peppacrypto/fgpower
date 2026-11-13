import fs from 'fs';
const n = v => { const l = Math.hypot(...v); return v.map(x => x/l); };
const out = (slug, s) => { s.slug = slug; fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify(s,null,1)); };
const leg = s => ({ pos:[0.13*s,0,0], anchor:'sole', pitch:0, yaw:7*s });
const grip = (s, x, y, z, f, p, pole, g=0.015) => ({ pos:[x*s,y,z], contact:true, hand:'grip', grip:g,
  fingers:[f[0]*s,f[1],f[2]], palm:[p[0]*s,p[1],p[2]], pole:[pole[0]*s,pole[1],pole[2]] });
const stand = (armL, armR) => ({ root:{pos:[0,0.93,0],pitch:-2}, spine:{flex:-2}, neck:{flex:8}, legL:leg(1), legR:leg(-1), armL, armR });
// standing curl family: ph = bot/mid/top, kind under/over/hammer
const O = {
  under:  { bot:[[0,-0.954,0.301],[0,0.3,0.954]], mid:[[0,0.3,0.954],[0,0.954,-0.3]], top:[[0,0.5,0.85],[0,0.85,-0.5]] },
  over:   { bot:[[0,-1,0],[0,0,-1]], mid:[[0,0,1],[0,-1,0]], top:[[0,0.5,0.85],[0,-0.85,0.5]] },
  hammer: { bot:[[0,-1,0.1],[-1,0,0]], mid:[[0,0.2,1],[-1,0,0]], top:[[0,0.6,0.8],[-1,0,0]] },
};
const P = { bot:[0.80,0.16], mid:[1.1,0.29], top:[1.33,0.235] };
const POLE = { bot:[0.25,-0.2,-1], mid:[0.25,-0.3,-1], top:[0.25,-0.5,-1] };
const std = (slug, kind, x, att, opt={}) => {
  const fr = ph => { const PP = (ph==='top'&&opt.top)||(ph==='bot'&&opt.bot)||P[ph]; const a = grip(1, x, PP[0], PP[1], ...O[kind][ph], POLE[ph], att==='rope'?0.018:0.015);
    return stand(a, opt.one ? { pos:[-0.3,1.0,0.0], rel:'world', pole:[-1,-0.2,-0.6], hand:'fist' } : grip(-1, x, PP[0], PP[1], ...O[kind][ph], POLE[ph], att==='rope'?0.018:0.015)); };
  const prop = { type:'cable-tower', pos:[0,0,0.7], yaw:180, pulleyY:0.22, attachment:att };
  if (opt.one) prop.hand='L'; else prop.hands=true;
  const s = { camera:{az:55,el:8}, muscles:['biceps'], props:[prop], frames:{ start:fr('bot'), mid:fr('mid'), end:fr('top') } };
  if (opt.one) s.muscleSide='L';
  out(slug, s);
};
std('standing-biceps-cable-curl','under',0.2,'straight-bar');
std('reverse-cable-curl','over',0.2,'straight-bar');
std('cable-hammer-curls-rope-attachment','hammer',0.12,'rope',{top:[1.27,0.30],bot:[0.82,0.21]});
std('standing-one-arm-cable-curl','under',0.2,'d-handle',{one:true});

// T-pose curls between two high pulleys (fk arms)
const high = (slug, abd, pY) => {
  const fr = el => { const a = s => ({ fk:{flex:0,abd,rot:s*0,elbow:el}, rel:'chest', pron:-90 }); 
    return { root:{pos:[0,0.93,0]}, neck:{flex:0}, legL:leg(1), legR:leg(-1), armL:{fk:{flex:0,abd,rot:0,elbow:el},rel:'chest',hand:'grip',grip:0.015}, armR:{fk:{flex:0,abd,rot:0,elbow:el},rel:'chest',hand:'grip',grip:0.015} }; };
  const s = { camera:{az:12,el:12}, muscles:['biceps'], props:[
    {type:'cable-tower',pos:[1.3,0,0],yaw:-90,pulleyY:pY,hand:'L',attachment:'d-handle'},
    {type:'cable-tower',pos:[-1.3,0,0],yaw:90,pulleyY:pY,hand:'R',attachment:'d-handle'}],
    frames:{ start:fr(25), mid:fr(80), end:fr(140) } };
  out(slug, s);
};
high('high-cable-curls', 90, 1.9);
high('overhead-cable-curl', 105, 2.3);

// lying cable curl: on mat, feet on machine frame, bar over thighs
const lying = () => {
  const fr = ph => { const P2 = { bot:[0.34,0.12], mid:[0.42,-0.17], top:[0.38,-0.37] }[ph];
    const [f,p] = ph==='bot' ? [[0,0.3,0.95],[0,0.95,-0.3]] : ph==='mid' ? [[0,0.9,0.3],[0,0.3,-0.9]] : [[0,0.4,-0.9],[0,-0.9,-0.4]];
    return { root:{pos:[0,0.14,0],pitch:-90}, neck:{flex:5}, legL:{pos:[0.12,0.07,0.80],anchor:'ankle',pitch:-90,yaw:0}, legR:{pos:[-0.12,0.07,0.80],anchor:'ankle',pitch:-90,yaw:0},
      armL:grip(1,0.2,P2[0],P2[1],f,p,[0.3,-1,0]), armR:grip(-1,0.2,P2[0],P2[1],f,p,[0.3,-1,0]) }; };
  out('lying-cable-curl', { camera:{az:70,el:10}, muscles:['biceps'], props:[ {type:'floor-mat',pos:[0,0,0]},
    {type:'cable-tower',pos:[0,0,1.3],yaw:180,pulleyY:0.22,hands:true,attachment:'straight-bar'} ],
    frames:{ start:fr('bot'), mid:fr('mid'), end:fr('top') } });
};
lying();

// lying close-grip bar curl: flat bench, head past end, high pulley behind head
const bench = () => {
  const fr = ph => { const hy = { bot:[1.17,-0.2], mid:[1.05,-0.32], top:[0.88,-0.48] }[ph];
    const [f,p] = ph==='top' ? [[0,0.3,-0.95],[0,-0.95,-0.3]] : ph==='mid' ? [[0,0.7,-0.7],[0,-0.7,-0.7]] : [[0,0.95,0.3],[0,0.3,-0.95]];
    return { root:{pos:[0,0.532,0.20],pitch:-90}, neck:{flex:0}, legL:{pos:[0.32,0,0.85],anchor:'sole',pitch:0}, legR:{pos:[-0.32,0,0.85],anchor:'sole',pitch:0},
      armL:grip(1,0.08,hy[0],hy[1],f,p,[0.3,-0.2,1]), armR:grip(-1,0.08,hy[0],hy[1],f,p,[0.3,-0.2,1]) }; };
  out('lying-close-grip-bar-curl-on-high-pulley', { camera:{az:60,el:10}, muscles:['biceps'], props:[ {type:'flat-bench',pos:[0,0,0.30]},
    {type:'cable-tower',pos:[0,0,-1.0],yaw:0,pulleyY:2.0,hands:true,attachment:'straight-bar'} ],
    frames:{ start:fr('bot'), mid:fr('mid'), end:fr('top') } });
};
bench();
