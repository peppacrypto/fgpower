// Generator: reads base poses (home-program specs) from towel-base/, applies fixes, writes specs/<slug>.json
import fs from 'fs'; import path from 'path'; import {fileURLToPath} from 'url';
const d = path.dirname(fileURLToPath(import.meta.url));
const load = s => JSON.parse(fs.readFileSync(path.join(d,'towel-base',s+'.json'),'utf8'));
const fr = s => Object.values(s.frames);
const out = {};
const each = (s,f)=>fr(s).forEach(f);

// prone T / Y : raise body off floor sink, pull hands in slightly
for (const [slug,dz] of [['prone-t-raise',0],['prone-y-raise',0]]) {
  const s = load(slug);
  each(s,f=>{ f.root.pos[1]+=0.026; for(const a of ['armL','armR']){ f[a].pos[1]+=0.0; } });
  out[slug]=s;
}
// body pull / prone pulldown
for (const slug of ['towel-floor-body-pull','prone-towel-pulldown']) {
  const s = load(slug);
  each(s,f=>{ f.root.pos[1]+=0.015; });
  out[slug]=s;
}
for (const slug of ['towel-lateral-raise','towel-one-arm-pulldown','towel-overhead-triceps']) out[slug]=load(slug);

const patch = fs.existsSync(path.join(d,'towel-patch.mjs')) ? (await import('./towel-patch.mjs')).default : ()=>{};
patch(out);
for (const [slug,s] of Object.entries(out)) fs.writeFileSync(path.join(d,'..',slug+'.json'), JSON.stringify(s));
