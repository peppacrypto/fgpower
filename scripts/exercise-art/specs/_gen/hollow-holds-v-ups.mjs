import fs from 'fs';
const W='/home/dev-peppa/fgpower/scripts/exercise-art/specs/';
const out={};
const save=(slug,camera,frames,more={})=>{out[slug]={slug,camera,muscles:['abdominals'],frames,...more};};
const A=(flex,elbow=3,abd=4,extra={})=>({fk:{flex,abd,rot:0,elbow},curl:0.2,...extra});
const L=(flex,knee=3,abd=1)=>({fk:{flex,abd,knee},foot:{pitch:0}});
const lie=(y=0.10,pitch=-90)=>({root:{pos:[0,y,0],pitch}});
const fr=(root,al,ar,ll,lr,extra={})=>({...root,...extra,armL:al,armR:ar,legL:ll,legR:lr});
const both=(a,l)=>[a,{...a},l,{...l}];
// dead bug
const db=(aL,aR,lL,lR)=>fr(lie(),A(aL),A(aR),L(lL,lL>60?90:3),L(lR,lR>60?90:3),{neck:{flex:4}});
save('dead-bug',{az:76,el:20},{start:db(90,90,90,90),end:db(172,90,90,5)});
// hollow
const hol=(sf)=>fr(lie(0.1),A(168,3,6,{hand:'relaxed'}),A(168,3,6),L(10,3,3),L(10,3,3),{spine:{flex:sf},neck:{flex:18}});
save('hollow-body-hold',{az:70,el:10},{start:hol(16)});
// boat
save('boat-pose',{az:80,el:8},{start:fr({root:{pos:[0,0.087,0],pitch:-38},},{...A(130,3,6),rel:'world'},{...A(130,3,6),rel:'world'},L(97,3,2),L(97,3,2),{spine:{flex:-4},neck:{flex:-6}})});
// jackknife
save('jackknife-sit-up',{az:80,el:10},{
 start:fr(lie(0.1),A(168,3,6),A(168,3,6),L(5,3,3),L(5,3,3),{neck:{flex:8}}),
 end:fr({root:{pos:[0,0.086,0],pitch:-45}},A(125,3,4),A(125,3,4),L(80,3,2),L(80,3,2),{spine:{flex:12},neck:{flex:12}})});
// cocoons
save('cocoons',{az:76,el:12},{
 start:fr(lie(),A(168,3,6),A(168,3,6),L(5,3,3),L(5,3,3),{neck:{flex:4}}),
 end:fr(lie(0.12,-110),A(85,10,6),A(85,10,6),L(115,125,5),L(115,125,5),{spine:{flex:30},neck:{flex:20}})});
// bottoms up
const bt=(y,p,lf,kn)=>fr(lie(y,p),A(8,3,12),A(8,3,12),L(lf,kn),L(lf,kn),{neck:{flex:4}});
save('bottoms-up',{az:76,el:12},{
 start:bt(0.1,-90,5,3),mid:bt(0.12,-92,105,120),mid2:bt(0.12,-92,90,4),end:bt(0.22,-104,76,4)});
for(const [k,v] of Object.entries(out))fs.writeFileSync(W+k+'.json',JSON.stringify(v,null,1));
console.log(Object.keys(out).join(' '));
