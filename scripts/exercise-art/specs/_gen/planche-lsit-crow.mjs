import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,muscles,props,frames,more={})=>{out[slug]={slug,camera,muscles,props,frames,...more};};
const SP=+(process.env.SP??0.52),HX=SP/2-0.022;const P=[{type:'parallettes',pos:[0,0,0],height:0.2,spread:SP}];
const g=JSON.parse(fs.readFileSync(W+'_gallery/parallettes.json'));
const gs=g.frames.start, ge=g.frames.end;
const clone=o=>JSON.parse(JSON.stringify(o));
// L-sits from gallery
ge.root.pos[2]+=0.01;ge.root.pos[1]-=+(process.env.LD??0.008);gs.armL.pos[0]=ge.armL.pos[0]=HX;gs.armR.pos[0]=ge.armR.pos[0]=-HX;
for(const l of ['legL','legR']){gs[l].fk.abd=+(process.env.TA??-4);ge[l].fk.abd=+(process.env.LA??-4);}
save('tuck-l-sit',{az:58,el:8},['abdominals'],P,{start:clone(gs)},{floats:true});
save('l-sit',{az:58,el:8},['abdominals'],P,{start:clone(ge)},{floats:true});
// parallette hands
const ph=(x,y,z,s)=>({pos:[x,y,z],fingers:[0.8*s,-0.6,0],palm:[-0.6*s,-0.8,0],curl:0.8,pole:[0.3*s,0,-1]});
// planches on parallettes
const tp=(rootY,rootZ,pitch,sflex,legfl,knee,hz=0.1,ab=3)=>({root:{pos:[0,rootY,rootZ],pitch},spine:{flex:sflex},neck:{flex:-10},
 armL:ph(HX,0.254,hz,1),armR:ph(-HX,0.254,hz,-1),
 legL:{fk:{flex:legfl,abd:ab,knee},foot:{pitch:30}},legR:{fk:{flex:legfl,abd:ab,knee},foot:{pitch:30}}});
save('tuck-planche',{az:58,el:8},['shoulders'],P,{start:tp(+(process.env.TY??0.52),+(process.env.TZ??-0.2),+(process.env.TP??55),14,+(process.env.TF??115),140,0.1,+(process.env.TB??0))},{floats:true});
save('advanced-tuck-planche',{az:58,el:8},['shoulders'],P,{start:tp(+(process.env.AY??0.5),+(process.env.AZ??-0.25),+(process.env.AP??78),5,100,125)},{floats:true});
// floor planche lean / pseudo planche
const T=(v)=>v;
function pf(y,z,p,n,hz,hy,fz,fp,sp=0,fing='out'){
 const arm=k=>({pos:[k*+(process.env.HW??0.26),0,hz],hand:'flat',contact:true,...(process.env.PX!==undefined?{pole:[k*+process.env.PX,+(process.env.PY??0),+(process.env.PZ??-1)]}:{}),fingers:fing==='out'?[k*+(process.env.FX??1),0,+(process.env.FZ??-0.5)]:[0,0,-1],palm:[0,-1,0],spread:1});
 const leg=k=>({pos:[k*0.1,0,fz],anchor:'ball',pitch:fp,yaw:0,toes:0});
 return {root:{pos:[0,y,z],pitch:p},spine:{flex:sp},neck:{flex:n},armL:arm(1),armR:arm(-1),legL:leg(1),legR:leg(-1)};}
const LY=+(process.env.LY??0.415),LZ=+(process.env.LZ??0.05),LP=+(process.env.LP??72);
save('planche-lean',{az:58,el:6},['shoulders'],[],{start:pf(LY,LZ,LP,-8,+(process.env.HZ??0.38),0,-0.74,62,-6)});
save('pseudo-planche-push-up',{az:58,el:6},['shoulders'],[],{start:pf(LY,LZ,LP,-8,+(process.env.HZ??0.38),0,-0.74,62,-6),mid:pf(+(process.env.MY??0.37),+(process.env.MZ??0.09),+(process.env.MP??72),-13,+(process.env.HZ??0.38),0,-0.74,69,-5),end:pf(+(process.env.EY??0.3),+(process.env.EZ??0.12),+(process.env.EP??72),-18,+(process.env.HZ??0.38),0,-0.74,76,-4)});
// crow
const cr=(foot)=>({root:{pos:[0,+(process.env.CY??0.6),+(process.env.CZ??-0.05)],pitch:+(process.env.CP??80)},spine:{flex:28},neck:{flex:-12},
 armL:{pos:[0.2,0,0.5],hand:'flat',contact:true,fingers:[0,0,1],palm:[0,-1,0],spread:1},armR:{pos:[-0.2,0,0.5],hand:'flat',contact:true,fingers:[0,0,1],palm:[0,-1,0],spread:1},
 legL:{fk:{flex:+(process.env.CF??100),abd:+(process.env.CA??20),knee:150},foot:{pitch:40}},legR:{fk:{flex:+(process.env.CF??100),abd:+(process.env.CA??20),knee:150},foot:{pitch:40}}});
save('crow-pose',{az:60,el:8},['shoulders'],[],{start:cr()},{floats:true});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
