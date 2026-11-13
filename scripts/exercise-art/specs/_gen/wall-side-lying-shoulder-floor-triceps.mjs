import fs from 'fs';
const ld = n => JSON.parse(fs.readFileSync(new URL(`./orig/wsl/${n}.json`, import.meta.url)));
const W = (s) => fs.writeFileSync(new URL(`../${s.slug}.json`, import.meta.url), JSON.stringify(s, null, 1));
const P = JSON.parse(process.env.WSL_TUNE || '{}');
const all = f => Object.values(f.frames);
// 1 lean raise: feet apart so thighs clear
{ const s = ld('wall-lateral-lean-raise');
  for (const f of all(s)) { f.legL.pos[0] = 0.06; f.legR.pos[0] = -0.06; }
  W(s); }
// 2 elbow push-off: unchanged
{ const s = ld('wall-elbow-push-off'); const a = s.frames.start, b = s.frames.end; b.root.pos = [0, 0.86, -0.185]; b.root.pitch = -23; a.root.pos[2] += (+process.env.S||0);  const m = JSON.parse(JSON.stringify(a));
  const av = (x, y) => x.map((v, i) => (v + y[i]) / 2);
  m.root.pos = av(a.root.pos, b.root.pos); m.root.pos[2] += 0; m.root.pitch = (a.root.pitch + b.root.pitch) / 2; m.neck.flex = (a.neck.flex + b.neck.flex) / 2;
  for (const k of ['armL','armR']) { m[k].pos = av(a[k].pos, b[k].pos); m[k].pole = av(a[k].pole, b[k].pole); m[k].scap = { prot: (a[k].scap.prot + b[k].scap.prot) / 2 }; }
  s.frames = { start: a, mid: m, end: b }; W(s); }
// 3 kneeling forearm press
{ const s = ld('kneeling-forearm-press');
  for (const f of all(s)) for (const l of ['legL','legR']) { f[l].pitch = 156; }
  s.frames.start.root.pos[1] += 0.05; s.frames.end.root.pos[1] += 0.009; for (const k of ['start','end']) for (const l of ['legL','legR']) s.frames[k][l].pos[1] = 0.092;
  W(s); }
// 4 side-lying
{ const s = ld('side-lying-elbow-press');
  for (const f of all(s)) { f.legL.pos[1] = 0.085; f.legR.pos[1] = 0.185; f.root.pos[1] = 0.185;
    f.armR.pos[1] = 0.17; f.armR.fingers = [0,-0.5,0.9]; }
  s.frames.end.spine.side = -12;
  W(s); }
// 5 hold
{ const s = ld('wall-lateral-press-hold'); s.props[0].pos[0] = 0.51; W(s); }
// 6 body-up
{ const s = ld('body-up'); s.frames.start.root.pos[1] += 0.05; for (const l of ['legL','legR']) s.frames.start[l].pos[2] = s.frames.end[l].pos[2] = -0.93; W(s); }
