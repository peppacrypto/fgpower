import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const stand={root:{pos:[0,0.92,0],pitch:2},spine:{flex:0},neck:{flex:-4},legL:{pos:[0.17,0,0.02],anchor:'sole',pitch:0,yaw:6},legR:{pos:[-0.17,0,0.02],anchor:'sole',pitch:0,yaw:-6}};
const sit={root:{pos:[0,0.54,0.4],pitch:0},spine:{flex:0},neck:{flex:-4},legL:{pos:[0.15,0,0.85],anchor:'sole',pitch:0,yaw:6},legR:{pos:[-0.15,0,0.85],anchor:'sole',pitch:0,yaw:-6}};
const dbs=[{type:'dumbbell',hand:'L',kg:8},{type:'dumbbell',hand:'R',kg:8}];
const arm=(flex,abd,elbow,pron,rot=0)=>({fk:{flex,abd,rot,elbow},rel:'chest',hand:'grip',grip:0.016,pron});
// pose: [flex,abd,elbow,pron,rot]
const P=(a,b)=>({armL:arm(...a),armR:arm(...b)});
const NEU=-90,SUP=0,PRO=90;
const rest=(p,r=0)=>[0,15,8,p,r], top=(p,r=0)=>[8,10,140,p,r];
const save=(slug,cam,props,frames,more={})=>{out[slug]={slug,camera:cam,muscles:['biceps'],props,frames,...more};};
const F=(base,l,r)=>({...base,...P(l,r)});
const mir=(a)=>[a[0],a[1],a[2],-a[3],a[4]];
const both=(base,a)=>F(base,a,mir(a));
const cam={az:50,el:8};
for(const [slug,pr] of [['hammer-curls',NEU]]){}
const S=stand;
save('hammer-curls',cam,dbs,{start:both(S,rest(NEU)),mid:both(S,[4,10,75,NEU]),end:both(S,top(NEU))});
save('dumbbell-bicep-curl',cam,dbs,{start:both(S,rest(SUP)),mid:both(S,[4,10,75,SUP]),end:both(S,top(SUP))});
save('alternate-hammer-curl',cam,dbs,{start:both(S,rest(NEU)),mid:F(S,top(NEU),rest(NEU)),mid2:both(S,rest(NEU)),end:F(S,rest(NEU),top(NEU))},{tempo:{up:1,down:1.8,maxLoop:8}});
// dumbbell alternate: palms in at start, supinate while curling
save('dumbbell-alternate-bicep-curl',cam,dbs,{start:both(S,rest(NEU)),mid:F(S,top(SUP),rest(NEU)),mid2:both(S,rest(NEU)),end:F(S,rest(NEU),top(SUP))},{tempo:{up:1,down:1.8,maxLoop:8}});
save('seated-dumbbell-curl',cam,[...dbs,{type:'flat-bench'}],{start:both(sit,rest(NEU)),mid:both(sit,[2,24,80,-45]),end:both(sit,top(SUP))});
// inner: forearms open outward in line with side delt, palms out/up
const innerTop=[0,40,135,-10,0];
save('standing-inner-biceps-curl',{az:20,el:8},dbs,{start:both(S,rest(NEU)),mid:both(S,[0,25,80,-45]),end:both(S,innerTop)});
save('seated-dumbbell-inner-biceps-curl',{az:20,el:8},[...dbs,{type:'flat-bench'}],{start:both(sit,rest(NEU)),mid:both(sit,[0,25,80,-45]),end:both(sit,innerTop)});
save('standing-dumbbell-reverse-curl',cam,dbs,{start:both(S,rest(PRO)),mid:both(S,[4,10,75,PRO]),end:both(S,top(PRO))});
// zottman: neutral start, curl supinated, rotate to pronated at top, lower pronated
save('zottman-curl',cam,dbs,{start:both(S,rest(NEU)),mid:both(S,[6,10,80,SUP]),mid2:both(S,top(SUP)),end:both(S,top(PRO)),mid3:both(S,[4,10,75,PRO])},{tempo:{up:1,down:1.8,maxLoop:8}});
// cross body: right dumbbell toward left shoulder (figure's left = +x); working arm = armR
const cross=[30,-22,135,NEU];
const cr=(w)=>({...S,armL:arm(...rest(NEU)),armR:arm(...w)});
save('cross-body-hammer-curl',{az:20,el:8},dbs,{start:cr(rest(NEU)),mid:cr([18,-12,80,NEU]),end:cr(cross)});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
