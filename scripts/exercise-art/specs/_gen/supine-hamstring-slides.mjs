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
