import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,muscles,props,frames,more={})=>{out[slug]={slug,floats:true,camera,muscles,props,frames,...more};};
const leg=(s,y=0.343,b=0)=>({pos:[s*0.115,y,0.863+b],anchor:'sole',pitch:-70,pole:[s*0.15,1,0.3]});
const hand=(s,p,pa,pole,f=[0,0,1])=>({pos:[s*p[0],p[1],p[2]],contact:true,fingers:[s*f[0],f[1],f[2]],palm:[s*pa[0],pa[1],pa[2]],curl:0.78,pole:[s*pole[0],pole[1],pole[2]]});
const two=(p,pa,pole,f)=>({armL:hand(1,p,pa,pole,f),armR:hand(-1,p,pa,pole,f)});
const sit=(h,pitch,sf,nf)=>({root:{pos:[0,h+0.09,0],pitch},spine:{flex:sf},neck:{flex:nf},legL:leg(1,h-0.077+0.0),legR:leg(-1,h-0.077+0.0)});
const seat=(h,att,extra={})=>[{type:'seated-row',pos:[0,0,0],benchH:h,hands:true,attachment:att,...extra}];
const row=(slug,h,cam)=>save(slug,cam,['middle-back'],seat(h,'v-bar'),{
 start:{...sit(h,6,30,-24),...two([0.07,h+0.32,0.85],[-1,0,0],[0.5,-0.5,-0.2])},
 end:{...sit(h,-6,-4,4),...two([0.07,h+0.42,0.30],[-1,0,0],[0.5,-0.1,-1])}});
// Seated cable row, the owner's review (2026-11-19). The old pose rocked the trunk 46 degrees (back rounded forward at the start,
// leaning back at the end) while the V-bar stopped 15 cm short of the body, the elbows in front of the shoulders and flared.
// Now the trunk stays tall and nearly still (6 forward to 5 back, the spine neutral, chest up). Start: arms long along the
// cable, shoulder blades forward (scap prot 16). End: the V-bar at the upper abdomen, the elbows along the body and behind
// the trunk (shoulder extension about 17, elbows about 110), the blades squeezed (prot -15). The hands converge on the
// V-bar, so the fingers point forward and in. This figure's forearm cannot take the elbows further back with the
// hands still in front of the belly (abdomen front at z 0.115).
const rowStill=(slug,h,cam)=>{save(slug,cam,['middle-back'],seat(h,'v-bar'),{
 start:{...sit(h,6,0,-6),...two([0.07,h+0.27,0.67],[-1,0,0],[0.5,-0.5,-0.2],[-0.15,-0.45,0.88])},
 end:{...sit(h,-1,-4,2),...two([0.07,h+0.30,0.19],[-0.89,0,-0.45],[0.35,-0.7,-1],[-0.45,0,0.89])}});
 const f=out[slug].frames;for(const a of ['armL','armR']){f.start[a].scap={prot:16};f.end[a].scap={prot:-15};}};
rowStill('seated-cable-rows',0.42,{az:118,el:10});
// platform on the seat: raised hips, feet stay on plates (soles up with the seat)
row('elevated-cable-rows',0.42,{az:118,el:10});
{const o=out['elevated-cable-rows'];o.props=[{type:'plyo-box',pos:[0,0,0.64],height:0.3,width:0.45,depth:0.36},...o.props];
 const bx=s=>({pos:[s*0.115,0.3,0.66],anchor:'sole',pitch:0,pole:[s*0.12,1,0.3]});
 for(const f of ['start','end']){o.frames[f].legL=bx(1);o.frames[f].legR=bx(-1);}}
// Seated one-arm cable row, the owner's review (2026-11-19), to the two-arm row's standard above. The old pose rocked the trunk about
// 46 degrees (back rounded at the start, spine flex 30, leaning back at the end), kept the D-handle neutral all the way and stopped it
// in front of the chest with the elbow still in front of the shoulder (shoulder flexion +9) and the blade never squeezed.
// Now the trunk stays tall and nearly still (6 forward to 5 back, the spine neutral). Start: the left arm long along the cable (elbow
// 7), palm down, the blade forward (scap prot 16). End: the handle beside the lower ribs, the palm turned to face the torso (neutral
// grip), the elbow along the body (x 0.22) and well behind the trunk (shoulder extension about 37, elbow about 130), the blade squeezed
// (prot -15). The free right hand rests on the waist.
const rowOne=(slug,h,cam)=>{const FR={pos:[-0.165,0.18,0],rel:'pelvis',pole:[-1,-0.15,-0.6],fingers:[0.3,0,0.95],palm:[1,0,-0.1],curl:0.3,hand:'flat',contact:true};
 save(slug,cam,['middle-back'],[{type:'seated-row',pos:[0,0,0],benchH:h,hand:'L',attachment:'d-handle'}],{
 start:{...sit(h,6,0,-6),armL:hand(1,[0.08,0.68,0.66],[0.1,-0.88,-0.46],[0.5,-0.5,-0.2],[-0.19,-0.48,0.86]),armR:FR},
 end:{...sit(h,-1,-4,2),armL:hand(1,[0.16,0.76,0.14],[-1,0,0],[0.15,-0.7,-1],[0,0,1]),armR:FR}},{muscleSide:'L'});
 const f=out[slug].frames;f.start.armL.scap={prot:16};f.end.armL.scap={prot:-15};};
rowOne('seated-one-arm-cable-pulley-rows',0.42,{az:125,el:12});
const rope=(slug,mus,endY,endZ,cam)=>save(slug,cam,mus,seat(0.42,'rope'),{
 start:{...sit(0.42,6,20,-12),...two([0.07,0.74,0.80],[-1,0,0],[1,0.1,-0.3])},
 end:{...sit(0.42,-4,-2,2),...two([0.2,endY,endZ],[-0.85,-0.5,0],[1,0.3,-0.6])}});
// Cable rope rear-delt row, the owner's review (2026-11-19). The old pose rounded the back at the start (spine flex 20), rocked the
// trunk about 32 degrees and, with a neutral grip, ended with the hands 30 cm in front of the chest and the elbows above and in front
// of the shoulders. Now the trunk stays tall and still (5 forward to 5 back, the spine neutral), the grip overhand. Start: the arms
// long at shoulder height (elbows 7, upper arms level), the blades forward (scap prot 15). End: the rope to the upper chest just below
// the neck, the elbows wide at shoulder height and past the back, as the catalog asks (the elbow joint about 6.6 cm behind the
// back's surface, upper arms level, elbows about 139; a review found the first try stopped level with the back), the blades
// squeezed (prot -15). The mid frame turns the hands with the forearms (fingers forward and in) while the elbows flare, so the
// wrists stay straight. Its own function: rope() above stays as it was for low-pulley-row-to-neck. tempo lift "there": the lit
// 'shoulders' (arm elevation) hardly change in this row, so the loop could not tell the pull from the return.
const ropeRear=(slug,h,cam)=>{save(slug,cam,['shoulders'],seat(h,'rope'),{
 start:{...sit(h,5,0,-4),...two([0.09,0.85,0.71],[0,-0.98,-0.2],[1,0,-0.3],[-0.16,-0.2,0.97])},
 mid:{...sit(h,2,-1,-1),...two([0.19,0.93,0.43],[0,-1,0.05],[1,0,-0.2],[-0.75,0.05,0.66])},
 end:{...sit(h,-2,-3,2),...two([0.30,0.99,0.12],[0,-1,0.1],[1,0,-0.6],[-0.45,0.1,0.89])}},{tempo:{lift:'there'}});
 const f=out[slug].frames;for(const a of ['armL','armR']){f.start[a].scap={prot:15};f.mid[a].scap={prot:0};f.end[a].scap={prot:-15};}};
ropeRear('cable-rope-rear-delt-rows',0.42,{az:50,el:14});
rope('low-pulley-row-to-neck',['shoulders'],1.12,0.2,{az:60,el:12});
// kneeling at a high pulley
const kn={root:{pos:[0,0.5,-0.25],pitch:14},legL:{pos:[0.12,0.2,-0.62],anchor:"ankle",pole:[0,-1,0],pitch:80},legR:{pos:[-0.12,0.2,-0.62],anchor:"ankle",pole:[0,-1,0],pitch:80}};
const tw=att=>[{type:'cable-tower',pos:[0,0,0.66],yaw:180,pulleyY:2,hands:true,attachment:att}];
save('kneeling-high-pulley-row',{az:85,el:8},['lats'],tw('rope'),{
 start:{...kn,spine:{flex:4},neck:{flex:-6},...two([0.08,1.40,0.36],[-0.6,-0.8,0],[1,0,-0.2],[0,0.5,0.86])},
 end:{...kn,root:{pos:[0,0.5,-0.25],pitch:2},spine:{flex:-2},neck:{flex:0},...two([0.2,1.0,0.1],[-0.6,-0.8,0],[1,-0.5,-1],[0,-0.3,0.95])}});
const ARM={fk:{flex:0,abd:12,rot:0,elbow:25},rel:'chest'};
save('kneeling-single-arm-high-pulley-row',{az:85,el:8},['lats'],[{type:'cable-tower',pos:[0,0,0.66],yaw:180,pulleyY:2,hand:'L',attachment:'d-handle'}],{
 start:{...kn,spine:{flex:4},neck:{flex:-6},armL:hand(1,[0.12,1.40,0.36],[0,0,1],[1,0,-0.2],[0,0.5,0.86]),armR:ARM},
 end:{...kn,root:{pos:[0,0.5,-0.25],pitch:2},spine:{flex:-2},neck:{flex:0},armL:hand(1,[0.2,0.97,0.07],[-0.8,-0.6,0],[0.5,-0.6,-1],[0,-0.2,1]),armR:ARM}},{muscleSide:'L'});
// shotgun row: wide split stance, low pulley
const sg={root:{pos:[0,0.8,-0.1],pitch:25},spine:{flex:6},neck:{flex:-18},legL:{pos:[0.15,0,0.30],anchor:'sole',yaw:8,pole:[0.1,0.5,1]},legR:{pos:[-0.15,0,-0.38],anchor:'sole',yaw:-8}};
save('shotgun-row',{az:85,el:10},['lats'],[{type:'cable-tower',pos:[0.3,0,1.2],yaw:180,pulleyY:0.2,hand:'L',attachment:'d-handle'}],{
 start:{...sg,armL:hand(1,[0.2,0.7,0.585],[0,-1,0],[0.4,-0.5,0.3],[0,-0.3,1]),armR:ARM},
 end:{...sg,armL:hand(1,[0.26,0.85,0.0],[-0.7,-0.7,0],[0.5,0.2,-1],[0,-0.2,1]),armR:ARM}},{muscleSide:'L'});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
