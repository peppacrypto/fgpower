import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({...s, slug}, null, 1));
const G = n => JSON.parse(fs.readFileSync(new URL(`../_gallery/${n}.json`, import.meta.url)));
const K = ['start','mid','mid2','mid3','end'];
const rad = d => d*Math.PI/180;

// ---- treadmill: walk, jog, run (jog/run = flight phase, more knee drive, bent elbows)
const tm = (slug, o) => {
  const s = G('treadmill'); s.props[0].feet = true; s.timing = {there:o.there, back:0};
  for (const k of K) {
    const f = s.frames[k];
    f.root.pitch = o.pitch; f.spine.flex = o.pitch/2+1;
    const air = (k==='mid'||k==='mid3');
    for (const a of ['legL','legR']) {
      const l = f[a];
      if (l.anchor==='ball'||l.anchor==='heel'||l.anchor==='sole') l.pos[1]+=0.012;
      
      if (l.anchor==='heel') { l.pos[2] += o.stride; }
      if (air) { // stance foot: leaves the belt in the flight phase; swing foot: higher knee drive
        if (l.anchor==='sole') { l.pos[1] += o.fly; }
        if (l.anchor==='ankle') { l.pos[1] += o.knee; l.pos[2] += o.knee*0.4; }
        if (l.anchor==='ankle') l.pitch = 62 - 0;
      }
    }
    if (air) f.root.pos[1] += o.fly;
    f.root.pos[1] += o.rootY;
    for (const a of ['armL','armR']) { const r=f[a].fk; r.elbow=o.elbow; r.abd=14; if (r.flex>10) r.flex=o.swing; else if (r.flex<-10) r.flex=-o.swing-2; }
  }
  W(slug, s);
};
tm('walking-treadmill', {there:1,   pitch:7,  stride:0,    fly:0,    knee:0,    rootY:0,    elbow:92, swing:30});
tm('jogging-treadmill', {there:0.75,pitch:9,  stride:0.02, fly:0.04, knee:0.05, rootY:0, elbow:90, swing:38});
tm('running-treadmill', {there:0.55,pitch:13, stride:0.03, fly:0.08, knee:0.10, rootY:0, elbow:85, swing:48});

const SW = {y:1.065,saddle:-0.05,p0:14,p1:-16,lift:0.03,px:1.2,z:-0.22};
// ---- cycling: feet (balls) on the crank circle
const cyc = (slug, g, ax, az, ay, rootY, pitchFn, pole, sw={}) => {
  const s = G(g); if (sw.saddle) s.props[0].saddle = sw.saddle;
  
  K.forEach((k, i) => {
    const f = s.frames[k]; const a = i*90;
    if (g==='upright-bike') f.root.pos = [0,sw.y??1.082,sw.z??-0.275];
    for (const [side, sg, off] of [['legL',1,0],['legR',-1,180]]) {
      const an = a+off;
      f[side] = { pos:[sg*0.122, ay+0.17*Math.cos(rad(an))+(sw.lift??0.012), az+0.17*Math.sin(rad(an))], anchor:'ball', pitch:pitchFn(an), yaw:0, pole:[sg*(sw.px??0.05), pole[0], pole[1]] };
    }
  });
  W(slug, s);
};
cyc('bicycling-stationary','upright-bike',0,0.07,0.315,1.122, an=>(SW.p0??-6)+(SW.p1??10)*Math.cos(rad(an)), [0.7,1], SW);
cyc('recumbent-bike','recumbent-bike',0,0.42,0.43,0, an=>-22+6*Math.sin(rad(an)), [0.4,1],{lift:0.035,px:0.05});

// ---- elliptical: hands are grips on the moving handles
{ const s = G('elliptical');
  for (const k of K) for (const a of ['armL','armR']) { const h=s.frames[k][a]; h.hand='grip'; h.grip=0.016; const sg=a==='armL'?1:-1; const u=(h.pos[2]-0.12)/0.36, fy=-0.5+0.7*u; h.fingers=[0,fy,Math.sqrt(1-fy*fy)]; h.palm=[-sg,0,0]; delete h.curl; delete h.contact; }
  for (const k of K) { s.frames[k].root.pos=[0,+(process.env.EY||1.17),+(process.env.EZ||0.02)]; s.frames[k].root.pitch=+(process.env.EP||10); s.frames[k].spine.flex=+(process.env.ES||6); }
  W('elliptical-trainer', s); }

// ---- stair climbers
{ const s=G('stair-climber'); for (const k of ['start','end']) { s.frames[k].root.pos[0]=0; s.frames[k].root.roll=0; s.frames[k].spine.side=0; } W('stairmaster', s); }
{ const s = G('step-mill'); for (const k of K) for (const a of ['legL','legR']) s.frames[k][a].pos[1]+=0.012; W('step-mill', s); }

// ---- rower: catch, drive, finish, recovery
{ const s = G('rower'); const F = s.frames;
  const catchF = JSON.parse(JSON.stringify(F.start));
  const R=(process.env.R||'0,6,2,0.66,0.27').split(',').map(Number);
  catchF.root.pos = [0,0.3+(R[0]+1.2)*0.066+0.165,R[0]]; catchF.root.pitch = R[1]; catchF.spine.flex = R[2];
  for (const a of ['armL','armR']) { catchF[a].pos[2] = R[3]; catchF[a].pos[0] = (a==='armL'?1:-1)*R[4]; catchF[a].pole=[(a==='armL'?1:-1)*0.9,-0.1,-0.2]; }
  const fin = F.end;
  const rec = JSON.parse(JSON.stringify(fin));
  rec.root.pos = [0,0.524,-0.31]; rec.root.pitch = -4; rec.spine.flex = 2; rec.neck.flex = 0;
  for (const a of ['armL','armR']) { rec[a].pos = [rec[a].pos[0],0.82,0.12]; rec[a].pole=[(a==='armL'?1:-1)*0.5,-0.2,-0.5]; }
  s.frames = { start:catchF, mid:F.mid, mid2:fin, mid3:rec, end:JSON.parse(JSON.stringify(catchF)) };
  W('rowing-stationary', s); }
