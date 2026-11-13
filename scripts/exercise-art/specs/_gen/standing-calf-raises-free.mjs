import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const put=(slug,spec)=>{out[slug]={slug,...spec};};
const clone=o=>JSON.parse(JSON.stringify(o));
const fl=(a,b)=>fs.existsSync(W+a)?clone(JSON.parse(fs.readFileSync(W+a,'utf8'))):null;
const wall=[{type:'wall',pos:[0,0,0.703],width:0.8}];
const wallArm=(x,dy=0,dz=0)=>({pos:[x,1.2+dy,0.49+dz],fingers:[0,0.45,0.89],palm:[0,-0.89,0.45],pole:[x>0?0.3:-0.3,-1,-0.3],curl:0.12});
// both legs, wall
const bw=(dy,dz,up)=>({root:{pos:[0,0.925+dy,dz]},armL:wallArm(0.2),armR:wallArm(-0.2),
 legL:up?{pos:[0.1,0,0.13],anchor:'ball',pitch:50,toes:0}:{pos:[0.1,0,0.04],anchor:'sole'},
 legR:up?{pos:[-0.1,0,0.13],anchor:'ball',pitch:50,toes:0}:{pos:[-0.1,0,0.04],anchor:'sole'}});
put('bodyweight-calf-raise',{camera:{az:80,el:6},muscles:['calves'],props:wall,frames:{start:bw(0,0,false),end:bw(0.08,0.07,true)}});
// single leg, wall
const sl=(dy,dz,up)=>{const f=bw(dy,dz,up);f.root.pos[0]=0.05;f.legL.pos[0]=0.1;
 f.legR={fk:{flex:-2,abd:0,knee:85},foot:{pitch:30}};return f;};
put('single-leg-calf-raise',{camera:{az:80,el:6},muscles:['calves'],muscleSide:'L',props:wall,frames:{start:sl(0,0,false),end:sl(0.08,0.07,true)}});
// step single leg: ball on board 0.065, heel drops below in start
const H=0.065;
const st=(dy,dz,pitch)=>({root:{pos:[0.05,0.925+H+dy,dz]},armL:wallArm(0.2,H+dy,dz),armR:wallArm(-0.2,H+dy,dz),
 legL:{pos:[0.1,H,0.03],anchor:'ball',pitch,toes:0},legR:{fk:{flex:-2,abd:0,knee:85},foot:{pitch:30}}});
put('step-single-leg-calf-raise',{camera:{az:80,el:6},floats:true,muscles:['calves'],muscleSide:'L',
 props:[...wall,{type:'calf-block',height:H,style:'board',pos:[0.1,0,0.03]}],
 frames:{start:st(-0.045,-0.04,-18),mid:st(0.015,-0.04,16),end:st(0.07,-0.04,50)}});
// dumbbells at sides, on board
const dbf=(dy,dz,pitch)=>({root:{pos:[0,0.925+H+dy,dz]},
 armL:{pos:[0.3,0.825+H+dy,0.09+dz],contact:true,fingers:[0,-1,0],palm:[-1,0,0],curl:0.85,pole:[0.15,0,-1]},
 armR:{pos:[-0.3,0.825+H+dy,0.09+dz],contact:true,fingers:[0,-1,0],palm:[1,0,0],curl:0.85,pole:[-0.15,0,-1]},
 legL:{pos:[0.11,H,0.03],anchor:'ball',pitch,toes:0},legR:{pos:[-0.11,H,0.03],anchor:'ball',pitch,toes:0}});
put('standing-dumbbell-calf-raise',{camera:{az:58,el:8},floats:true,muscles:['calves'],
 props:[{type:'calf-block',height:H,style:'board',width:0.5,pos:[0,0,0.03]},{type:'dumbbell',kg:15,hand:'L'},{type:'dumbbell',kg:15,hand:'R'}],
 frames:{start:dbf(0,0,0),end:dbf(0.08,0.05,50)}});
// bands under feet, handles at shoulders
const bd=(dy,dz,up)=>({root:{pos:[0,0.925+dy,dz]},
 armL:{pos:[0.3,1.46+dy,0.1+dz],contact:true,fingers:[0,1,0.1],palm:[0,-0.05,1],curl:0.85,pole:[1,-0.8,-0.2]},
 armR:{pos:[-0.3,1.46+dy,0.1+dz],contact:true,fingers:[0,1,0.1],palm:[0,-0.05,1],curl:0.85,pole:[-1,-0.8,-0.2]},
 legL:up?{pos:[0.11,0,0.13],anchor:'ball',pitch:50,toes:0}:{pos:[0.11,0,0.03],anchor:'sole'},
 legR:up?{pos:[-0.11,0,0.13],anchor:'ball',pitch:50,toes:0}:{pos:[-0.11,0,0.03],anchor:'sole'}});
put('calf-raises-with-bands',{camera:{az:30,el:6},muscles:['calves'],
 props:[{type:'band-tube',hands:true,via:[{foot:'L',edge:'out'},{foot:'L',edge:'in'},{foot:'R',edge:'in'},{foot:'R',edge:'out'}],rest:1.9}],
 frames:{start:bd(0,0,false),end:bd(0.08,0.07,true)}});
// foot arch on a dumbbell handle (one per foot), hand on wall
const DY=0.0625;
const dd=(dy,dz,pitch)=>({root:{pos:[0,0.925+DY+dy,dz]},armL:wallArm(0.2,DY+dy,dz),armR:wallArm(-0.2,DY+dy,dz),
 legL:{pos:[0.11,DY,0.04],anchor:'ball',pitch,toes:0},legR:{pos:[-0.11,DY,0.04],anchor:'ball',pitch,toes:0}});
put('calf-raise-on-a-dumbbell',{camera:{az:80,el:6},floats:true,muscles:['calves'],
 props:[...wall,{type:'dumbbell',kg:5,pos:[0.11,0,0.04]},{type:'dumbbell',kg:5,pos:[-0.11,0,0.04]}],
 frames:{start:dd(-0.04,-0.04,-18),mid:dd(0.015,-0.04,16),end:dd(0.07,-0.04,50)}});
// barbell on back
const BASE=0.02;const bb=(dy,dz,leg)=>{const f={root:{pos:[0,0.915+dy,BASE+dz],pitch:4},neck:{flex:-3},
 armL:{pos:[0.33,0.215,-0.015],rel:'chest',contact:true,fingers:[-0.3,0.45,-0.85],palm:[0,0.97,0.2],curl:0.85,pole:[0.5,-0.7,-0.6],scap:{elev:0,prot:0}},
 armR:{pos:[-0.33,0.215,-0.015],rel:'chest',contact:true,fingers:[0.3,0.45,-0.85],palm:[0,0.97,0.2],curl:0.85,pole:[-0.5,-0.7,-0.6],scap:{elev:0,prot:0}}};
 f.legL={...leg,pos:[0.12,leg.y||0,leg.z],pole:[0.1,0,1]};f.legR={...leg,pos:[-0.12,leg.y||0,leg.z],pole:[-0.1,0,1]};delete f.legL.y;delete f.legL.z;delete f.legR.y;delete f.legR.z;return f;};
const flat={anchor:'sole',pitch:0,z:0.04};
const up={anchor:'ball',pitch:50,toes:0,z:0.13};
const props=[{type:'barbell',hands:true,plates:[20,10]}];
put('standing-barbell-calf-raise',{camera:{az:58,el:8},muscles:['calves'],props,frames:{start:bb(0,0,flat),end:bb(0.08,0.10,up)}});
const back={anchor:'heel',pitch:-12,z:-0.06};
put('rocking-standing-calf-raise',{camera:{az:70,el:8},muscles:['calves'],props,frames:{start:bb(0,0,flat),mid:bb(0.08,0.10,up),end:bb(-0.02,-0.04,back)}});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
