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
save('tuck-l-sit',{az:75,el:6},['abdominals'],P,{start:(()=>{const o=clone(gs);for(const l of['legL','legR']){o[l].fk.flex=+(process.env.TLF??118);o[l].fk.knee=+(process.env.TLK??140);}return o;})(),end:clone(gs)},{floats:true,tempo:{lift:'there',up:1.0,down:1.8,squeeze:0.35}});
save('l-sit',{az:75,el:6},['abdominals'],P,{start:clone(gs),end:clone(ge)},{floats:true,tempo:{lift:'there',up:1.0,down:1.8,squeeze:0.35}});
// parallette hands
const ph=(x,y,z,s)=>({pos:[x,y,z],fingers:[0.8*s,-0.6,0],palm:[-0.6*s,-0.8,0],curl:0.8,pole:[0.3*s,0,-1]});

const tp=(rootY,rootZ,pitch,sflex,legfl,knee,hz=0.1,ab=3,ft=30,nk=-10)=>({root:{pos:[0,rootY,rootZ],pitch},spine:{flex:sflex},neck:{flex:nk},
 armL:ph(HX,0.254,hz,1),armR:ph(-HX,0.254,hz,-1),
 legL:{fk:{flex:legfl,abd:ab,knee},foot:{pitch:ft}},legR:{fk:{flex:legfl,abd:ab,knee},foot:{pitch:ft}}});
const E=(k,d)=>+(process.env[k]??d);
const lowT=()=>tp(E('TY0',0.52),E('TZ0',-0.2),55,14,115,140);
const tuckH=()=>tp(E('TY',0.92),E('TZ',-0.3),E('TP',84),E('TS',16),E('TF',120),140,0.1,3,30,-10);
const advH=()=>tp(E('AY',0.92),E('AZ',-0.4),E('AP',90),E('AS',2),E('AF',95),E('AK',120),0.1,3,30,-10);
const lift={lift:'there',up:1.4,down:2.0,squeeze:1.0,stretch:0.3};
save('tuck-planche',{az:75,el:6},['shoulders','abdominals'],P,{start:lowT(),mid:tp(E('TYm',0.66),E('TZm',-0.2),70,15,118,140),end:tuckH()},{floats:true,tempo:lift});
save('advanced-tuck-planche',{az:75,el:6},['shoulders','abdominals'],P,{start:lowT(),mid:tuckH(),end:advH()},{floats:true,tempo:lift});
function pf(y,z,p,n,hz,hy,fz,fp,sp=0,pole=0){
 const arm=k=>({pos:[k*E('HW',0.26),0,hz],hand:'flat',contact:true,pole:[k*pole,0,-1],fingers:[k*E('FX',0.9),0,E('FZ',-0.6)],palm:[0,-1,0],spread:1});
 const leg=k=>({pos:[k*0.1,0,fz],anchor:'ball',pitch:fp,yaw:0,toes:0});
 return {root:{pos:[0,y,z],pitch:p},spine:{flex:sp},neck:{flex:n},armL:arm(1),armR:arm(-1),legL:leg(1),legR:leg(-1)};}
const HZ=E('HZ',0.38);
save('planche-lean',{az:75,el:6},['shoulders'],[],{start:pf(E('LY',0.42),E('LZ',0.06),E('LP',74),-12,HZ,0,-0.74,E('LF',72),-8)});
const PH=E('PHZ',0.3);
save('pseudo-planche-push-up',{az:75,el:6},['shoulders','triceps','chest'],[],{start:pf(E('LY2',0.38),E('LZ2',0.05),72,-8,PH,0,-0.74,62,-6,0.1),mid:pf(E('MY',0.30),E('MZ',0.09),72,-13,PH,0,-0.74,69,-5,0.1),end:pf(E('EY',0.17),E('EZ',0.12),72,-18,PH,0,-0.74,76,-4,0.1)},{tempo:{lift:'back',up:1.0,down:1.8,squeeze:0.35,stretch:0.2}});
const cr=(y,z,p,sf,legfl,knee,hy,nk,ftp)=>({root:{pos:[0,y,z],pitch:p},spine:{flex:sf},neck:{flex:nk},
 armL:{pos:[0.2,0,0.5],hand:'flat',contact:true,fingers:[0,0,1],palm:[0,-1,0],spread:1,pole:[0.5,0,-1]},armR:{pos:[-0.2,0,0.5],hand:'flat',contact:true,fingers:[0,0,1],palm:[0,-1,0],spread:1,pole:[-0.5,0,-1]},
 legL:{fk:{flex:legfl,abd:E('CA',32),knee},foot:{pitch:ftp}},legR:{fk:{flex:legfl,abd:E('CA',32),knee},foot:{pitch:ftp}}});
save('crow-pose',{az:90,el:6},['shoulders','abdominals','forearms'],[],{start:cr(E('CY0',0.5),E('CZ0',-0.1),E('CP0',60),30,E('CF0',110),150,0,-15,40),end:cr(E('CY',0.72),E('CZ',0.0),E('CP',96),E('CS',32),E('CF',135),150,0,E('CN',-50),40)},{floats:true,tempo:{lift:'there',up:1.4,down:2.0,squeeze:1.0,stretch:0.3}});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
