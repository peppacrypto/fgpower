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
// --- pass 2 (2026-11-13): textbook range, full reach (bar 0.62 m from the shoulder joint)
{ const sp=out['towel-lateral-raise']; const F=sp.frames; const base=F.mid; const fr={};
  const R=0.60, ang=[['start',8],['mid',30],['mid2',55],['mid3',75],['end',92]];
  for(const [k,th] of ang){ const t=th*Math.PI/180; const R=0.615; const f=JSON.parse(JSON.stringify(k=='start'?F.start:F.end));
    f.armL.pos=[+(0.19+R*Math.sin(t)).toFixed(3),+(1.38-R*Math.cos(t)).toFixed(3),0.06];
    f.armL.fingers=[+Math.sin(t).toFixed(3),+(-Math.cos(t)).toFixed(3),0]; f.armL.palm=[+(-Math.cos(t)).toFixed(3),+(-Math.sin(t)).toFixed(3),0];
    f.armL.pole=[Math.sin(t)*0.5, -Math.cos(t)*0.9-0.1, -0.4];
    if(k!='start'&&k!='end'){ f.armR.pos=[-0.31+0.4*th/92,0.915+0.2*th/92,0.2]; }
    fr[k]=f; }
  fr.start.armR.pos=[-0.31,0.915,0.15]; fr.end.armR.pos=[0.0,1.10,0.28];
  sp.frames=fr; }
{ const F=out['towel-overhead-triceps'].frames; F.end.armL.pos=[0.14,2.07,-0.04]; F.mid.armL.pos=[0.12,1.84,-0.17]; }
// prone T / Y: hands travel an arc (start on the floor, mid, end lifted) so the arms stay long in the in-betweens
for(const [slug,pts] of [['prone-t-raise',[[0.68,0.1,0.45],[0.68,0.26,0.45],[0.64,0.45,0.45]]],['prone-y-raise',[[0.58,0.09,0.82],[0.55,0.27,0.78],[0.50,0.50,0.72]]]]){
  const sp=out[slug], base=sp.frames.start, e=sp.frames.end, names=['start','mid','end'], F={};
  pts.forEach((p,i)=>{ const f=JSON.parse(JSON.stringify(i==0?base:e)); for(const [a,g] of [['armL',1],['armR',-1]]){ f[a].pos=[g*p[0],p[1],p[2]]; if(i==1){ const t=0.5; f[a].fingers=base[a].fingers.map((v,j)=>+(v*(1-t)+e[a].fingers[j]*t).toFixed(3)); } } F[names[i]]=f; });
  sp.frames=F;
}
// NEW: standing-towel-triceps-extension (partner holds the far end: drawn alone, see plan/cannot-show.json) - overhead-triceps geometry, both hands mirrored on one end
{ const sp=JSON.parse(JSON.stringify(out['towel-overhead-triceps'])); sp.slug='standing-towel-triceps-extension'; delete sp.muscleSide; sp.camera={az:35,el:8};
  const m=v=>[-v[0],v[1],v[2]];
  for(const f of Object.values(sp.frames)){ const L=f.armL; L.pos[0]=0.08; f.armR={...JSON.parse(JSON.stringify(L)),pos:m(L.pos),fingers:m(L.fingers),palm:m(L.palm),pole:[-L.pole[0],L.pole[1],L.pole[2]]}; f.props=[{type:'towel-strip',hands:true,length:0.2}]; }
  out[sp.slug]=sp; }
for (const [slug,s] of Object.entries(out)) fs.writeFileSync(path.join(d,'..',slug+'.json'), JSON.stringify(s));
