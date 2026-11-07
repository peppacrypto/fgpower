import fs from 'fs';
const R=d=>d*Math.PI/180;
const out=(slug,s)=>fs.writeFileSync(new URL(`../${slug}.json`,import.meta.url),JSON.stringify(s,null,1));
const leg=s=>({pos:[0.22*s,0,0.74],anchor:'sole',pole:[0.3*s,1,0.3]});
const SY=0.567, SZ=-0.30; // flat bench shoulder reference (k=0, hd=0)
const W=(a,k,hd)=>[SY+k*Math.cos(R(a))+hd*Math.sin(R(a)), SZ+k*Math.sin(R(a))-hd*Math.cos(R(a))];
// body-plane direction: angle th from the normal toward the head
const dir=th=>[Math.cos(R(th)),Math.sin(R(th))]; // (k,hd)
// one arm in sagittal plane: upper arm psi, forearm th. returns {y,z,fin,palm}
function pt(a,psi,th,{hd0=-0.05,k0=0.03,U=0.279,F=0.225}={}){
  const u=dir(psi),f=dir(th);
  const k=k0+U*u[0]+F*f[0], hd=hd0+U*u[1]+F*f[1];
  const [y,z]=W(a,k,hd);
  const ek=k0+U*u[0], ehd=hd0+U*u[1];
  const [ey,ez]=W(a,ek,ehd);
  const fy=Math.cos(R(a))*f[0]+Math.sin(R(a))*f[1], fz=Math.sin(R(a))*f[0]-Math.cos(R(a))*f[1];
  const pyv=Math.cos(R(a))*(-f[1])*-1; // placeholder
  // palm = fingers rotated 90 deg toward feet: perpendicular in plane, pointing toward +feet side at th=0
  const p=[f[1]*-1*-1, 0];
  const py=Math.cos(R(a))*f[1]+Math.sin(R(a))*(-f[0]), pz=Math.sin(R(a))*f[1]-Math.cos(R(a))*(-f[0]);
  return {y,z,fy,fz,py,pz,ey,ez};
}
function build(slug,o){
  const {a=0,x=0.1,bar,db=0,psi=0,ths,mus=['triceps'],pole,neutral=false,one=false,camera={az:40,el:8},legs=true,fk=0}=o;
  const frames={};
  const mk=(th,xx)=>{
    const g=pt(a,psi,th); const h=o.adj?pt(a,psi,th+o.adj):g; g.fy=h.fy;g.fz=h.fz;g.py=h.py;g.pz=h.pz;
    const fr={root:{pos:[0,SY+0.0,0.2],pitch:-(90-a)},neck:{flex:6},spine:{flex:-4},legL:leg(1),legR:leg(-1)};
    if(a!==0){fr.root.pos=[0,o.hipY,0.2];fr.legL={pos:[0.22,o.legY,o.legZ],anchor:'sole',pole:[0.3,1,0.3]};fr.legR={pos:[-0.22,o.legY,o.legZ],anchor:'sole',pole:[-0.3,1,0.3]};}
    const arm=s=>{
      const fingers=neutral?[0,g.fy,g.fz]:[0.05*s,g.fy,g.fz];
      let palm=neutral?[-s,0,0]:[0,g.py,g.pz]; if(o.sup)palm=palm.map(v=>-v);
      return {pos:[xx*s,g.y,g.z],contact:true,hand:'grip',grip:db?0.0155:0.014,fingers,palm,
        pole:[(pole?.[0]??0.2)*s,pole?.[1]??1,pole?.[2]??0.3],curl:o.curl??0.82};
    };
    fr.armL=arm(1);
    if(one){ const [sy,sz]=W(a,0.2,-0.02); fr.armR={pos:[-0.13,sy,sz],hand:'flat',contact:false,pole:[-1,0.3,0.2]}; }
    else fr.armR=arm(-1);
    return fr;
  };
  ths.forEach((th,i)=>{ frames[['start','mid','mid2','end'][ths.length===2?(i?3:0):ths.length===3?[0,1,3][i]:i]]=mk(th,o.xs?o.xs[i]:x); });
  const props=[{type:o.bench||'flat-bench',...(o.benchOpt||{})}];
  if(bar) props.push({type:bar.type,hands:true,...bar.opt});
  if(db){ props.push({type:'dumbbell',kg:db,hand:'L'}); if(!one) props.push({type:'dumbbell',kg:db,hand:'R'}); }
  out(slug,{slug,camera,muscles:mus,floats:true,props,frames});
}
const ez=g=>({type:'ez-bar',opt:{grip:g,plates:[10]}});
build('ez-bar-skullcrusher',{x:0.1,bar:ez('inner'),ths:[0,45,100],camera:{az:70,el:6}});
build('lying-triceps-press',{x:0.2325,bar:ez('outer'),ths:[0,45,100],camera:{az:70,el:6}});
build('lying-close-grip-barbell-triceps-press-to-chin',{x:0.1,bar:ez('inner'),ths:[0,50,112],camera:{az:70,el:6}});
build('lying-close-grip-barbell-triceps-extension-behind-the-head',{x:0.1,bar:ez('inner'),psi:50,adj:30,curl:0.5,ths:[50,70,100,140],camera:{az:70,el:10}});
build('lying-dumbbell-tricep-extension',{x:0.17,db:10,neutral:true,ths:[0,45,100],camera:{az:70,el:6}});
build('dumbbell-tricep-extension-pronated-grip',{x:0.22,db:10,ths:[0,45,100],camera:{az:70,el:6}});
build('decline-dumbbell-triceps-extension',{a:-20,hipY:0.73,legZ:0.66,legY:0.3,bench:'decline-bench',x:0.17,db:10,neutral:true,ths:[0,45,100],camera:{az:70,el:6}});
build('one-arm-pronated-dumbbell-triceps-extension',{x:0.19,db:10,one:true,ths:[0,45,100],camera:{az:70,el:6}});
build('one-arm-supinated-dumbbell-triceps-extension',{sup:true,pole:[-0.2,0.8,0.6],x:0.19,db:10,one:true,ths:[0,45,100],camera:{az:70,el:6}});
