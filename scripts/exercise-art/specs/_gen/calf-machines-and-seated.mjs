import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const G=n=>JSON.parse(fs.readFileSync(W+'_gallery/'+n+'.json','utf8'));
const out={};
const put=(slug,spec)=>{out[slug]={slug,...spec};};
const SY=+(process.env.SY||0);
const SPF=+(process.env.SPF||-10);
const sc=G('standing-calf'), se=G('seated-calf'), dk=G('donkey-calf');
const TW=(f,fn)=>{for(const k of Object.keys(f))fn(f[k],k);return f;};
put('standing-calf-raises',{camera:{az:58,el:8},muscles:['calves'],props:sc.props,frames:TW(sc.frames,(f,k)=>{
 for(const [a,x] of [['armL',1],['armR',-1]]){f[a].pos[2]+=0.0;f[a].pos[0]=x*0.33;f[a].pos[1]-=0.03;f[a].pos[2]+=0.04;f[a].pole=[x*0.9,-0.4,-0.2];f[a].fingers=[0,0.7,0.7];f[a].palm=[0,-0.7,0.7];}
 f.spine={flex:SPF};})});
put('seated-calf-raise',{camera:{az:72,el:8},muscles:['calves'],props:se.props,frames:TW(se.frames,(f,k)=>{for(const a of ['armL','armR'])f[a].pos[1]+=0.04;if(k==='end'){for(const l of ['legL','legR']){f[l].pitch=24;f[l].pos[1]-=0.03;f[l].pos[2]+=0.02;}}})});
put('donkey-calf-raises',{camera:{az:102,el:12},muscles:['calves'],floats:true,props:dk.props,frames:dk.frames});
// shrug: feet flat, shoulders rise
const shr=(y,hy,hz,el)=>({root:{pos:[0,1.03,-0.04],pitch:0},spine:{flex:-19},neck:{flex:2},
 legL:{pos:[0.11,0.14,0.06],anchor:'ball',pitch:0,toes:0},legR:{pos:[-0.11,0.14,0.06],anchor:'ball',pitch:0,toes:0},
 ...Object.fromEntries([['armL',1],['armR',-1]].map(([k,s])=>[k,{pos:[s*0.301,hy,hz],contact:true,fingers:[0,0.95,0.3],palm:[0,-0.3,0.95],curl:0.75,pole:[s*0.8,-0.6,0.1],scap:{elev:el,prot:0}}]))});
put('calf-machine-shoulder-shrug',{camera:{az:88,el:5},floats:true,muscles:['traps'],props:sc.props,frames:{start:shr(0,1.59,0.07,0),end:shr(0,1.64,0.052,22)}});
// seated on bench, balls on block 30 cm ahead
const seat=(pitch,extra={})=>({root:{pos:[0,0.54,0],pitch:0},spine:{flex:8},neck:{flex:-6},
 legL:{pos:[0.11,0.1,0.63],anchor:'ball',pitch,toes:0,pole:[0.1,0.3,1]},legR:{pos:[-0.11,0.1,0.63],anchor:'ball',pitch,toes:0,pole:[-0.1,0.3,1]},...extra});
const bar=(pitch)=>{const s=seat(pitch);
 for(const [k,x] of [['armL',1],['armR',-1]]) s[k]={pos:[x*0.3,0.70,0.31],contact:true,fingers:[0,-0.2,1],palm:[0,-1,-0.2],curl:0.8,pole:[x*0.4,-0.6,-0.5]};
 return s;};
const props1=[{type:'flat-bench',pos:[0,0,-0.5]},{type:'calf-block',pos:[0,0,0.70]},{type:'barbell',hands:true,plates:[20]}];
put('barbell-seated-calf-raise',{camera:{az:75,el:8},floats:true,muscles:['calves'],props:props1,frames:{start:bar(-16),end:bar(32)}});
const db=(pitchL)=>{const s=seat(0);
 s.legL={pos:[0.14,pitchL>0?0.088:0.1,0.64],anchor:'ball',pitch:pitchL,toes:0,pole:[0.1,0.3,1]};
 s.legR={pos:[-0.14,0,0.5],anchor:'sole',pitch:0,toes:0,pole:[-0.1,0,1]};
 s.armL={pos:[0.14,0.735,0.33],fingers:[0,0,1],palm:[0,-1,0],curl:0.8,pole:[0.5,-0.7,-0.3]};
 s.armR={pos:[-0.14,0.71,0.2],contact:true,fingers:[0,0,1],palm:[0,-1,0],curl:0.7,pole:[-0.4,-0.6,-0.5]};
 return s;};
put('dumbbell-seated-one-leg-calf-raise',{camera:{az:75,el:8},muscles:['calves'],floats:true,muscleSide:'L',props:[{type:'flat-bench',pos:[0,0,-0.5]},{type:'calf-block',pos:[0.14,0,0.70],width:0.22},{type:'dumbbell',kg:20,hand:'L'}],frames:{start:db(-16),end:db(29)}});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
