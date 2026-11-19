import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const base=(extra={})=>({root:{pos:[0,0.53,0.02],pitch:-45},neck:{flex:6},
 legL:{pos:[0.21,0,0.62],anchor:'sole',pole:[0.15,0.4,1]},legR:{pos:[-0.21,0,0.62],anchor:'sole',pole:[-0.15,0.4,1]},...extra});
const A=(s,p,f,pa,pole)=>({pos:[s*p[0],p[1],p[2]],hand:'grip',grip:0.016,fingers:[s*f[0],f[1],f[2]],palm:[s*pa[0],pa[1],pa[2]],pole:[s*pole[0],pole[1],pole[2]]});
const both=(p,f,pa,pole)=>({armL:A(1,p,f,pa,pole),armR:A(-1,p,f,pa,pole)});
const props=(extra={})=>[{type:'incline-bench',angle:40,uprights:true},{type:'dumbbell',kg:10,hand:'L',...extra},{type:'dumbbell',kg:10,hand:'R',...extra}];
const out={};
const save=(slug,cam,fr,pr=props(),more={})=>{out[slug]={slug,camera:cam,muscles:['biceps'],props:pr,frames:fr,...more};};
const low=[0.30,0.24,-0.32], top=[0.33,0.90,0.10], mid=[0.35,0.58,-0.12];
const pole=[0.4,-0.5,-0.8];
// supinated down: palm forward (+Z)
const dF=[0,-1,0.1], dP=[-0.45,0.1,0.9], tF=[0,0.5,0.85], tP=[-0.4,0.85,-0.4];
const hF=[0,-1,0.3], hP=[-1,0,0];
// Incline dumbbell curl, the owner's review (2026-11-19). The old hand targets moved in straight lines, so the upper arm swung
// about 46 degrees (back first, then far forward) and the elbows stopped at 94: a front raise with a half curl.
// Now the arms are driven by their joints (fk): the upper arm hangs straight down to the floor (flex -50 on a back reclined 50)
// and drifts only 8 forward at the top, while the elbow goes 6 -> 135. The grip is supinated, palms forward as the catalog says:
// in rig.js pron 0 is NEUTRAL (palms toward the body) and -90 supinates; the first fix (f8) shipped pron 0, a hammer grip, by
// mistake. rot -22 turns the forearms a little out, so the dumbbells pass beside the hips and the inner heads stop in front of
// the shoulders, not in the chest (1.3 cm clear at the top).
// The back lies on the pad (props/benches.js: pitch = angle - 90, root y 0.542; z 0.065 is 1 cm ahead of the doc's 0.055 for
// angle 40, which keeps the shoulder blades out of the pad), the chin a little down (neck 26) instead of thrown back.
const onPad=(extra={})=>({root:{pos:[0,0.542,0.065],pitch:-50},neck:{flex:26},
 legL:{pos:[0.21,0,0.62],anchor:'sole',pole:[0.15,0.4,1]},legR:{pos:[-0.21,0,0.62],anchor:'sole',pole:[-0.15,0.4,1]},...extra});
const fkArm=(flex,abd,rot,elbow,pron=0)=>({fk:{flex,abd,rot,elbow},rel:'chest',hand:'grip',grip:0.016,pron});
const fkArms=(flex,abd,rot,elbow,pron=0)=>({armL:fkArm(flex,abd,rot,elbow,pron),armR:fkArm(flex,abd,rot,elbow,pron)});
save('incline-dumbbell-curl',{az:70,el:10},{start:{...onPad(),...fkArms(-50,12,-22,6,-90)},mid:{...onPad(),...fkArms(-46,11,-22,70,-90)},end:{...onPad(),...fkArms(-42,10,-22,135,-90)}});
save('flexor-incline-dumbbell-curls',{az:70,el:10},{start:{...base(),...both(low,dF,dP,pole)},mid:{...base(),...both(mid,[0,-0.2,1],[-0.4,0.9,0.1],[0.3,-0.5,-0.9])},end:{...base(),...both(top,tF,tP,[0.3,-0.5,-0.9])}},props({offset:[0,0,0.05]}));
// Incline hammer curl, fixed like incline-dumbbell-curl (2026-11-19). The old hand targets swung the upper arm about 96 degrees
// (74 behind the trunk to 22 in front of it), the elbow peaked at 106, and the back sat 5 degrees off the pad.
// Now the same body on the pad and fk arms: the upper arm hangs to the floor and drifts 8 forward (flex -50 -> -42), the elbow
// goes 6 -> 130, and the grip stays neutral: in rig.js pron 0 is the neutral grip (palms toward the body, thumbs forward, then
// up at the top; -90 supinates). rot -22 (not -15) turns the forearms out a little more, so the thumb-side heads stop in front
// of the shoulders, clear of the chest (0.6 cm at the hex corners); 130 is where a hammer curl's top head reaches the shoulder.
save('incline-hammer-curls',{az:70,el:10},{start:{...onPad(),...fkArms(-50,12,-22,6)},mid:{...onPad(),...fkArms(-46,11,-22,68)},end:{...onPad(),...fkArms(-42,10,-22,130)}});
// Alternate incline curl (left up, right down), fixed the same way (2026-11-19): the old hand targets swung each upper arm about
// 60 degrees forward and the elbow stopped at 106. Now fk arms on the pad: the working arm 6 -> 135 with the upper arm still
// (flex -50 -> -42), turning from the neutral hang (pron 0) to palm up at the top (pron -90), as the catalog says; the resting
// arm hangs still. rot -22 keeps the dumbbells' inner heads off the belly and the chest on the way up (1.3 cm at the top).
// The tops sit at the ends of the loop (start: left up, mid: both down, end: right up). The loop plays start -> end -> start, so
// the arms strictly alternate, one rep each per loop, the other arm still. With both down at the start, the middle of the loop
// was a seesaw (one arm lowering while the other lifted) and the left arm did two reps in a row across the seam.
// maxLoop 6.5 leaves room for the 1.0 s lift and the 1.8 s lowering.
const curlDown=()=>fkArm(-50,12,-22,6), curlUp=()=>fkArm(-42,10,-22,135,-90);
save('alternate-incline-dumbbell-curl',{az:70,el:10},{
 start:{...onPad(),armL:curlUp(),armR:curlDown()},
 mid:{...onPad(),armL:curlDown(),armR:curlDown()},
 end:{...onPad(),armL:curlDown(),armR:curlUp()}},props(),{tempo:{up:1.0,down:1.8,maxLoop:6.5}});
// inner: palms out, curl outward to side of deltoids
save('incline-inner-biceps-curl',{az:20,el:10},{
 start:{...base(),...both(low,dF,dP,pole)},
 mid:{...base(),...both([0.38,0.60,-0.06],[0.15,-0.2,1],[-0.2,0.4,0.85],[0.2,-0.6,-0.9])},
 end:{...base(),...both([0.37,0.94,0.10],[0.15,0.4,0.9],[0.1,0.3,0.95],[0.2,-0.6,-0.9])}});
// supine flat bench
const fl={root:{pos:[0,0.52,0.1],pitch:-88},neck:{flex:4},legL:{pos:[0.15,0,0.62],anchor:'sole',pole:[0,1,0.1]},legR:{pos:[-0.15,0,0.62],anchor:'sole',pole:[0,1,0.1]}};
save('lying-supine-dumbbell-curl',{az:50,el:20},{
 start:{...fl,...both([0.43,0.10,-0.04],hF,hP,[0.5,-1,-0.3])},
 mid:{...fl,...both([0.43,0.42,-0.04],[0,0.3,1],[-1,0,0],[0.5,-1,-0.3])},
 end:{...fl,...both([0.42,0.67,-0.16],[0,0.7,0.7],[-1,0,0],[0.5,-1,-0.3])}},
 [{type:'adjustable-bench',angle:0},{type:'dumbbell',kg:10,hand:'L'},{type:'dumbbell',kg:10,hand:'R'}]);
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
