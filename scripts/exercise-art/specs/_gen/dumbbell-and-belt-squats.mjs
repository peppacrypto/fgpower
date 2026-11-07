import fs from 'fs';
const D='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const cp=o=>JSON.parse(JSON.stringify(o));
const out={};
const leg=(x,yaw,y=0,z=0.02,pl=0.4,pitch=0)=>({legL:{pos:[x,y,z],anchor:'sole',yaw,pitch,pole:[pl,0,1]},legR:{pos:[-x,y,z],anchor:'sole',yaw:-yaw,pitch,pole:[-pl,0,1]}});
const standRoot=(dy=0)=>({root:{pos:[0,0.925+dy,0]}});
const botRoot=(dy=0,z=-0.2)=>({root:{pos:[0,0.46+dy,z],pitch:30},spine:{flex:-4},neck:{flex:-18}});
// goblet
const gob=(k)=>{const b=k==='end';const y=b?0.87:1.23;return {...(b?{root:{pos:[0,0.515,-0.2],pitch:18},spine:{flex:4},neck:{flex:-14}}:standRoot()),
 armL:{pos:[0.045,y,0.26],contact:true,fingers:[0,b?-0.3:0.3,1],palm:[-0.3,0.9,-0.3],curl:0.85,pole:[b?0.55:0.8,-1,b?-0.3:-0.4]},
 armR:{pos:[-0.045,y,0.26],contact:true,fingers:[0,b?-0.3:0.3,1],palm:[0.3,0.9,-0.3],curl:0.85,pole:[b?-0.55:-0.8,-1,b?-0.3:-0.4]},
 ...leg(0.2,22,0,0.02,0.5)};};
out['goblet-squat']={slug:'goblet-squat',camera:{az:40,el:6},muscles:['quadriceps'],props:[{type:'dumbbell',hands:true,hold:'goblet',kg:20}],frames:{start:gob('start'),end:gob('end')}};
// dumbbell squat: weights at sides
const sidesArm=(s,b,hy)=>({pos:[s*(b?0.42:0.28),hy,b?-0.08:0.04],contact:true,fingers:[0,-1,0],palm:[-s,0,0],curl:0.85,pole:[s*0.15,0,-1]});
const ds=(k,extra={})=>{const b=k==='end';return {...(b?botRoot():standRoot()),
 armL:sidesArm(1,b,b?0.62:0.825),armR:sidesArm(-1,b,b?0.62:0.825),...leg(0.2,18,0,0.02,0.45)};};
out['dumbbell-squat']={slug:'dumbbell-squat',camera:{az:40,el:6},muscles:['quadriceps'],props:[{type:'dumbbell',hand:'L',kg:15},{type:'dumbbell',hand:'R',kg:15}],frames:{start:ds('start'),end:ds('end')}};
// to bench
const sb=cp(out['dumbbell-squat']);sb.slug='dumbbell-squat-to-a-bench';sb.camera={az:70,el:6};
sb.props.push({type:'flat-bench',pos:[0,0,-0.5],yaw:90});
sb.frames.end.root.pos=[0,0.53,-0.2];sb.frames.end.root.pitch=26;
out['dumbbell-squat-to-a-bench']=sb;
// plie (dumbbell held low in both hands, wide toes-out stance)
const pl=(k)=>{const b=k==='end';const g=gob(k);return {...(b?{root:{pos:[0,0.52,-0.1],pitch:16},spine:{flex:2},neck:{flex:-12}}:{root:{pos:[0,0.89,0]}}),
 armL:{...g.armL,pos:[0.045,b?0.87:1.2,b?0.26:0.26]},armR:{...g.armR,pos:[-0.045,b?0.87:1.2,0.26]},
 ...leg(0.32,42,0,0.02,0.9)};};
out['plie-dumbbell-squat']={slug:'plie-dumbbell-squat',camera:{az:25,el:6},muscles:['quadriceps','adductors'],props:[{type:'dumbbell',hands:true,hold:'goblet',kg:20}],frames:{start:pl('start'),end:pl('end')}};
// bands
const bd=(k)=>{const b=k==='end';return {...(b?botRoot():standRoot()),
 armL:{pos:[0.24,b?1.0:1.3,b?0.25:0.18],contact:true,fingers:[0,0.5,0.85],palm:[-0.85,0.3,0.1],curl:0.85,pole:[0.4,-1,-0.6]},
 armR:{pos:[-0.24,b?1.0:1.3,b?0.25:0.18],contact:true,fingers:[0,0.5,0.85],palm:[0.85,0.3,0.1],curl:0.85,pole:[-0.4,-1,-0.6]},
 ...leg(0.14,8,0,0.02,0.2)};};
out['squats-with-bands']={slug:'squats-with-bands',camera:{az:35,el:6},muscles:['quadriceps'],props:[{type:'band-tube',hands:true,via:[{foot:'L',edge:'out'},{foot:'L',edge:'in'},{foot:'R',edge:'in'},{foot:'R',edge:'out'}]}],frames:{start:bd('start'),end:bd('end')}};
// belt squat on benches
const H=0.44;
const wq=(k)=>{const b=k==='end';return {root:{pos:[0,(b?0.5:0.91)+H,b?-0.18:0],pitch:b?26:0},spine:{flex:b?-4:0},neck:{flex:b?-16:0},
  armL:{fk:{flex:0,abd:32,elbow:6},rel:'chest'},armR:{fk:{flex:0,abd:32,elbow:6},rel:'chest'},
 ...leg(0.3,28,H,0.02,0.8)};};
out['weighted-squat']={slug:'weighted-squat',floats:true,camera:{az:30,el:6},muscles:['quadriceps'],props:[{type:'flat-bench',pos:[0.3,0,0]},{type:'flat-bench',pos:[-0.3,0,0]},{type:'dip-belt',follow:true,kg:20}],frames:{start:wq('start'),end:wq('end')}};
for(const [k,v] of Object.entries(out)){v.slug=k;fs.writeFileSync(D+k+'.json',JSON.stringify(v,null,1));}
console.log(Object.keys(out).join(' '));
