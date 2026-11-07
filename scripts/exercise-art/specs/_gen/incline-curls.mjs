import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const base=(extra={})=>({root:{pos:[0,0.53,0.02],pitch:-45},neck:{flex:6},
 legL:{pos:[0.21,0,0.62],anchor:'sole',pole:[0.15,0.4,1]},legR:{pos:[-0.21,0,0.62],anchor:'sole',pole:[-0.15,0.4,1]},...extra});
const A=(s,p,f,pa,pole)=>({pos:[s*p[0],p[1],p[2]],hand:'grip',grip:0.016,fingers:[s*f[0],f[1],f[2]],palm:[s*pa[0],pa[1],pa[2]],pole:[s*pole[0],pole[1],pole[2]]});
const both=(p,f,pa,pole)=>({armL:A(1,p,f,pa,pole),armR:A(-1,p,f,pa,pole)});
const props=(extra={})=>[{type:'incline-bench',angle:40,uprights:true},{type:'dumbbell',kg:10,hand:'L',...extra},{type:'dumbbell',kg:10,hand:'R',...extra}];
const out={};
const save=(slug,cam,fr,pr=props(),more={})=>{out[slug]={slug,camera:cam,muscles:['biceps'],props:pr,frames:fr,...more};};
const low=[0.29,0.35,-0.30], top=[0.31,0.78,0.0];
const pole=[0.4,-0.5,-0.8];
// supinated down: palm forward (+Z)
const dF=[0,-1,0.1], dP=[-0.45,0.1,0.9], tF=[0,0.5,0.85], tP=[-0.4,0.85,-0.4];
const hF=[0,-1,0], hP=[-1,0,0], htF=[0,0.7,0.7], htP=[-1,0,0];
save('incline-dumbbell-curl',{az:70,el:10},{start:{...base(),...both(low,dF,dP,pole)},end:{...base(),...both(top,tF,tP,[0.3,-0.5,-0.9])}});
save('flexor-incline-dumbbell-curls',{az:70,el:10},{start:{...base(),...both(low,dF,dP,pole)},end:{...base(),...both(top,tF,tP,[0.3,-0.5,-0.9])}},props({offset:[0,0,0.05]}));
save('incline-hammer-curls',{az:70,el:10},{start:{...base(),...both(low,hF,hP,pole)},end:{...base(),...both(top,htF,htP,[0.3,-0.5,-0.9])}});
// alternate: left up, right down
save('alternate-incline-dumbbell-curl',{az:70,el:10},{
 start:{...base(),armL:A(1,low,dF,dP,pole),armR:A(-1,low,dF,dP,pole)},
 mid:{...base(),armL:A(1,top,tF,tP,[0.3,-0.5,-0.9]),armR:A(-1,low,dF,dP,pole)},
 end:{...base(),armL:A(1,low,dF,dP,pole),armR:A(-1,top,tF,tP,[0.3,-0.5,-0.9])}});
// inner: palms out, curl outward to side of deltoids
save('incline-inner-biceps-curl',{az:20,el:10},{
 start:{...base(),...both(low,dF,dP,pole)},
 end:{...base(),...both([0.62,0.85,-0.3],[0.5,0.8,-0.2],[0.3,0.2,0.9],[0.2,-1,-0.4])}});
// supine flat bench
const fl={root:{pos:[0,0.527,0.018],pitch:-45},neck:{flex:4},legL:{pos:[0.13,0,0.66],anchor:'sole',pole:[0,1,0.1]},legR:{pos:[-0.13,0,0.66],anchor:'sole',pole:[0,1,0.1]}};
save('lying-supine-dumbbell-curl',{az:75,el:10},{
 start:{...fl,...both([0.27,0.36,0.0],hF,hP,[0.3,-0.3,-0.5])},
 end:{...fl,...both([0.27,0.5,-0.25],[0,0.4,0.9],[-0.5,0.8,-0.3],[0.3,-0.5,-0.9])}},
 [{type:'adjustable-bench',angle:0},{type:'dumbbell',kg:10,hand:'L'},{type:'dumbbell',kg:10,hand:'R'}]);
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
