import fs from 'fs';
const G = n => JSON.parse(fs.readFileSync(new URL(`../_gallery/${n}.json`, import.meta.url)));
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({...s, slug}, null, 1));
const F = s => Object.values(s.frames);

// balance board
{ const s = G('balance-board'); s.muscles=['calves','quadriceps']; W('balance-board', s); }
// battling ropes
{ const s = G('battling-ropes'); for (const f of F(s)) for (const [k,sg] of [['armL',-1],['armR',1]]) { const a=f[k]; a.hand='grip'; a.grip=0.018; a.fingers=[0,-0.3,0.95]; a.palm=[sg,0,0]; } W('battling-ropes', s); }
// bicycling
{ const s = G('road-bike');
  for (const f of F(s)) { f.root.pos[1]+=0.095; for (const [k,sg] of [['armL',1],['armR',-1]]) { const a=f[k]; a.pos=[sg*0.12,0.885,0.46]; a.fingers=[0,-0.2,1]; a.palm=[0,-1,-0.2]; a.pole=[sg*0.6,0.4,-0.5]; } }
  W('bicycling', s); }
// heavy bag
{ const s = G('heavy-bag');
  for (const f of F(s)) { f.armR.fingers=[0.1,0.95,0.3]; f.armR.palm=[0,-0.3,0.95]; }
  s.frames.end.armR.pos=[-0.06,1.3,-0.02]; s.frames.start.armR.pos=[-0.06,1.3,-0.2]; s.frames.start.root.pos[2]=-0.70; s.frames.end.root.pos[2]=-0.54; for (const f of F(s)) { f.legR.pos[2]+=0.04; f.legL.pos[2]+=0.04; }
  W('heavy-bag-thrust', s); }
// rope jumping
{ const s = G('jump-rope');
  for (const k of ['legL','legR']) { s.frames.mid[k].pos[1]=0; s.frames.mid[k].pitch=0; }
  W('rope-jumping', s); }
// skating
{ const s = G('inline-skate'); for (const f of F(s)) { f.armL.fk.abd=26; f.armR.fk.abd=26; } W('skating', s); }
// sledgehammer
const PLL=+(process.env.PLL||-1);const PR=+(process.env.PR||-1);const FL=+(process.env.FL||1);const OFF=+(process.env.OFF||0.145);const RP=JSON.parse(process.env.RP||'[-1,1,1]');const PS=+(process.env.PS||-1);const FS=+(process.env.FS||1);
{ const s = G('sledgehammer'); const base = s.frames.start;
  const lerp=(a,b,t)=>a+(b-a)*t;
  const K = [[-39.98615913394418, [0.07, 1.7399117511050899, 0.2072430691028086], 20.104698398042707, 0.9064952370354716, -8.295422876228795, [0.4962329561440693, 0.40483365103352087, 0.5533801325418095]], [19.407462889000875, [0.07, 1.416258222861604, 0.39228698044537713], 12.599204871362682, 0.8697455514256818, -6.7397007041528285, [0.42091712503800394, 0.8703219381881512, -0.2825294302394744]], [60.62834760676782, [0.07, 1.1424471516178802, 0.4812032387185604], 17.680681026493254, 0.8834786873683292, 8.590894899032042, [0.4045950815187068, 0.17513720997522764, -0.4527785544321972]], [98.42619839537083, [0.06, 0.7472626927799163, 0.48267458697570936], 43.43799655095744, 0.7863337580798659, 10.855595689513258, [0.5316551522239514, 0.9155147867858502, -0.22825041232724436]]];
  const fr = ([deg,L,pitch,ry,fl,pole]) => { const r=deg*Math.PI/180, d=[0,Math.cos(r),Math.sin(r)], f=[0,-Math.sin(r),Math.cos(r)];
    const R=L.map((x,i)=>x+OFF*d[i]); R[0]=L[0]; const r3=v=>v.map(x=>+x.toFixed(3));
    const arm=(pos,sg,pl)=>({pos:r3(pos),hand:'grip',grip:0.0185,fingers:r3(f.map(x=>x*FL)),palm:[-sg*PS*FL*(sg>0?PR:PLL),0,0],pole:pl});
    return { ...JSON.parse(JSON.stringify(base)), root:{pos:[0,ry,-0.1],pitch}, spine:{flex:fl}, armL:arm(L,-1,pole), armR:arm(R,1,[pole[0]*RP[0],pole[1]*RP[1],pole[2]*RP[2]]) }; };
  const KK=process.env.KJSON?JSON.parse(process.env.KJSON):K;const [a,b,c,d]=KK.map(fr);
  s.frames={start:a,mid:b,mid2:c,end:d};
  W('sledgehammer-swings', s); }
// trail running
{ const s = G('trail-slope'); W('trail-running-walking', s); }
