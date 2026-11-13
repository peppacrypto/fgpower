import fs from 'fs';
var NECK = {"towel-leg-curl":7,"single-leg-towel-leg-curl":7,"bridge-heel-walkout":7,"towel-leg-curl-eccentric":7};
var ARMZ=0.105, POLEY=0.5;
const P = n => new URL(`../${n}.json`, import.meta.url);
const ld = n => JSON.parse(fs.readFileSync(P(n)));
const sv = (n, o) => fs.writeFileSync(P(n), JSON.stringify({ slug: n, ...o }, null, 1));
// old floor-slide specs: keep, lift head off floor sink with more neck flex
for (const n of ['towel-leg-curl','single-leg-towel-leg-curl','bridge-heel-walkout','towel-leg-curl-eccentric']) {
  const o = ld(n);
  for (const f of Object.values(o.frames)) { f.root.pos[1] = Math.round((0.1+0.0073*(-f.root.pitch-90)+0.02)*1000)/1000; f.neck = { flex: Math.max(4, Math.round(10 + (-f.root.pitch-90)*0.6)) }; }
  if (n==='towel-leg-curl-eccentric') { const fr=o.frames; fr.start.legL=JSON.parse(JSON.stringify(fr.mid.legL)); fr.start.legR=JSON.parse(JSON.stringify(fr.mid.legR)); fr.start.props=JSON.parse(JSON.stringify(fr.mid.props)); if(fr.mid&&fr.mid2){ fr.mid2.legL=JSON.parse(JSON.stringify(fr.mid.legL)); fr.mid2.legR=JSON.parse(JSON.stringify(fr.mid.legR)); } }
  sv(n, o);
}
// patches (pass 2)
{ const T=process.env.TZ_END||'0.36';
  let o=ld('towel-leg-curl'); const e=o.frames.end; e.legL.pos[2]=e.legR.pos[2]=+T; e.legL.pitch=e.legR.pitch=-5; e.props[0].pos[2]=+T+0.05; sv('towel-leg-curl',o);
  o=ld('single-leg-towel-leg-curl'); const s0=o.frames.start; s0.legL.pos[2]=+T+0.01; s0.legL.pitch=-5; s0.props[0].pos[2]=+T+0.06; sv('single-leg-towel-leg-curl',o);
  // walkout: alternating steps with a lifted mid frame
  o=ld('bridge-heel-walkout'); const A=o.frames.start, Z=o.frames.end; const zs=[0.42,0.57,0.72,0.87]; const frames={};
  const mk=(p,lz,lyL,lzR,ryR,lp,rp)=>{const f=JSON.parse(JSON.stringify(A)); f.root={pos:[0,+(0.31-0.088*p).toFixed(3),+(-0.03*(1-p)).toFixed(3)],pitch:Math.round(-116+12*p)}; f.neck={flex:Math.round(26-8*p)};
   f.legL={pos:[0.11,lyL,lz],anchor:'heel',pitch:lp,pole:[0,1,0.2]}; f.legR={pos:[-0.11,ryR,lzR],anchor:'heel',pitch:rp,pole:[0,1,0.2]}; return f;};
  const pit=z=>Math.round(-(z-0.42)/0.45*55);
  const F=(p,lz,ly,rz,ry)=>mk(p,lz,ly,rz,ry,pit(lz),pit(rz));
  const fr={start:F(0,0.42,0,0.42,0), mid:F(0.3,0.645,0.14,0.42,0), mid2:F(0.85,0.87,0,0.42,0), mid3:F(0.92,0.87,0,0.645,0.14), end:F(1,0.87,0,0.87,0)};
  Object.assign(frames,fr);
  {const ks=Object.keys(frames),fr2={};ks.forEach((k,i)=>{fr2[i===0?'start':i===ks.length-1?'end':i===1?'mid':'mid'+i]=frames[k]});o.frames=fr2;} o.tempo={lift:'even',even:3.5,hold:0.4,maxLoop:8}; sv('bridge-heel-walkout',o);
}

const arm = s => ({ pos:[0.27*s,0,ARMZ], contact:true, fingers:[0.08*s,0,1], palm:[0,-1,0], pole:[s,POLEY,-0.2], curl:-0.3 });
const base = (root, nk, legL, legR, props) => ({ root, neck:{flex:nk}, armL:arm(1), armR:arm(-1), legL, legR, ...(props?{props}:{}) });
const heel = (x,y,z,p) => ({ pos:[x,y,z], anchor:'heel', pitch:p, pole:[0,1,0.2] });
// platform slides: hips down, one heel slides, other leg straight
sv('platform-hamstring-slides', { camera:{az:70,el:10}, muscles:['hamstrings'], muscleSide:'L', frames:{
  start: base({pos:[0,0.115,0],pitch:-90}, 2, heel(0.11,0.017,0.84,-60), heel(-0.11,0.017,0.84,-60), [{type:'towel',pos:[0.11,0,0.88],width:0.2,depth:0.3}]),
  end:   base({pos:[0,0.115,0],pitch:-90}, 2, heel(0.11,0.017,0.30,10), heel(-0.11,0.017,0.84,-60), [{type:'towel',pos:[0.11,0,0.34],width:0.2,depth:0.3}]) }});
ARMZ=0.0; POLEY=-0.3;
// ball leg curl
const ball = { type:'stability-ball', radius:0.325, feet:true, anchor:'heel', load:1 };
const bl = (z,y,p) => heel(0.11,y,z,p);
sv('ball-leg-curl', { camera:{az:70,el:10}, muscles:['hamstrings'], props:[ball], frames:{
  start: base({pos:[0,0.46,-0.1],pitch:-125}, 10, bl(0.62,0.6,-25), {...bl(0.62,0.6,-25), pos:[-0.11,0.6,0.62]}),
  end:   base({pos:[0,0.46,-0.1],pitch:-125}, 18, bl(0.2,0.55,10), {...bl(0.2,0.55,10), pos:[-0.11,0.55,0.2]}) }});

{ const T=1; let o;
  o=ld('platform-hamstring-slides'); const st=o.frames.start; for(const l of [st.legL,st.legR]){l.pos[2]=+(process.env.PZ||'0.88'); l.pitch=-65;} st.props[0].pos[2]=st.legL.pos[2]+0.04; o.frames.end.legR=JSON.parse(JSON.stringify(st.legR)); o.frames.end.legL.pos[2]=0.28; o.frames.end.props[0].pos[2]=0.32; sv('platform-hamstring-slides',o);
  o=ld('ball-leg-curl'); for(const l of [o.frames.start.legL,o.frames.start.legR]){l.pos[2]=+(process.env.BZ||'0.70'); l.pos[1]=+(process.env.BY||'0.62'); l.pitch=-35;} sv('ball-leg-curl',o);
}
