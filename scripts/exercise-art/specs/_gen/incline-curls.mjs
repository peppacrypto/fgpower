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
const hF=[0,-1,0.3], hP=[-1,0,0], htF=[0,0.4,0.9], htP=[-1,0,0];
save('incline-dumbbell-curl',{az:70,el:10},{start:{...base(),...both(low,dF,dP,pole)},mid:{...base(),...both(mid,[0,-0.2,1],[-0.4,0.9,0.1],[0.3,-0.5,-0.9])},end:{...base(),...both(top,tF,tP,[0.3,-0.5,-0.9])}});
save('flexor-incline-dumbbell-curls',{az:70,el:10},{start:{...base(),...both(low,dF,dP,pole)},mid:{...base(),...both(mid,[0,-0.2,1],[-0.4,0.9,0.1],[0.3,-0.5,-0.9])},end:{...base(),...both(top,tF,tP,[0.3,-0.5,-0.9])}},props({offset:[0,0,0.05]}));
const lowH=[0.31,0.26,-0.32], topH=[0.34,0.98,0.14], midH=[0.37,0.58,-0.12];
save('incline-hammer-curls',{az:70,el:10},{start:{...base(),...both(lowH,hF,hP,[0.2,-0.5,-0.8])},mid:{...base(),...both(midH,[0,0.2,1],hP,[0.2,-0.5,-0.9])},end:{...base(),...both(topH,htF,htP,[0.2,-0.5,-0.9])}});
// alternate: left up, right down
save('alternate-incline-dumbbell-curl',{az:70,el:10},{
 start:{...base(),armL:A(1,low,dF,dP,pole),armR:A(-1,low,dF,dP,pole)},
 mid:{...base(),armL:A(1,top,tF,tP,[0.3,-0.5,-0.9]),armR:A(-1,low,dF,dP,pole)},
 end:{...base(),armL:A(1,low,dF,dP,pole),armR:A(-1,top,tF,tP,[0.3,-0.5,-0.9])}});
// inner: palms out, curl outward to side of deltoids
save('incline-inner-biceps-curl',{az:20,el:10},{
 start:{...base(),...both(low,dF,dP,pole)},
 end:{...base(),...both([0.46,0.97,0.08],[0.3,0.4,0.85],[0.3,0.2,0.9],[0.2,-1,-0.4])}});
// supine flat bench
const fl={root:{pos:[0,0.52,0.1],pitch:-88},neck:{flex:4},legL:{pos:[0.15,0,0.62],anchor:'sole',pole:[0,1,0.1]},legR:{pos:[-0.15,0,0.62],anchor:'sole',pole:[0,1,0.1]}};
save('lying-supine-dumbbell-curl',{az:75,el:10},{
 start:{...fl,...both([0.43,0.10,-0.04],hF,hP,[0.5,-1,-0.3])},
 end:{...fl,...both([0.40,0.58,-0.30],[0,0.7,0.7],[-1,0,0],[0.5,-1,-0.3])}},
 [{type:'adjustable-bench',angle:0},{type:'dumbbell',kg:10,hand:'L'},{type:'dumbbell',kg:10,hand:'R'}]);
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
