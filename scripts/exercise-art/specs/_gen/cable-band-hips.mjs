import fs from 'fs';
const W = (slug, s) => fs.writeFileSync(new URL(`../${slug}.json`, import.meta.url), JSON.stringify({slug, ...s}, null, 1));
const ld = n => JSON.parse(fs.readFileSync(new URL(`../${n}.json`, import.meta.url)));
const stance = (x=0.1, z=0.02) => ({ pos:[x,0,z], anchor:'sole', pitch:0, yaw:6 });
const post = (s, yTop=1.3, zp=0.5, dz=0.0, dx=0.04) => ({ pos:[dx*s, yTop, zp-dz], contact:true, hand:'flat', fingers:[0,0,1], palm:[-s,0,0], pole:[s,-0.6,-0.2] });

// ---- facing a post / cable, working leg L kicks back
const facing = (rz, rp, leg, sp, nk, zp, dz=0.02) => ({ root:{pos:[-0.06,0.91,rz],pitch:rp}, spine:{flex:sp}, neck:{flex:nk},
  legR:{pos:[-0.1,0,0.02],anchor:'sole',pitch:0,yaw:-6}, legL:leg, armL:post(1,1.42,zp,dz), armR:post(-1,1.34,zp,dz) });
const ankL = (y,z,p,pz=0.5) => ({ pos:[0.1,y,z], anchor:'ankle', pitch:p, pole:[0,0,1] });
W('one-legged-cable-kickback', { camera:{az:100,el:8}, muscles:['glutes'], muscleSide:'L',
  props:[{type:'cable-tower',pos:[0,0,0.72],yaw:180,pulleyY:0.2,foot:'L',attachment:'ankle-strap'}],
  frames:{ start:facing(0.03,8,ankL(0.1,0.06,8),8,-8,0.70), mid:facing(-0.02,8,ankL(0.2,-0.3,28),9,-11,0.70),
           end:facing(0.0,10,ankL(0.45,-0.6,50),10,-14,0.70) } });
const bandPost = z => ({ type:'anchor-post', pos:[0,0,z], yaw:180, bandY:0.2 });
const bandA = z => [0,0.2,z-0.06];
const bandProp = (z,rest=0.5) => ({ type:'band', follow:'pelvis', a:bandA(z), b:{ankle:'L'}, rest, width:0.03 });
const hf = (rz,rp,leg,sp,nk) => facing(rz,rp,leg,sp,nk,0.70);
W('hip-extension-with-bands', { camera:{az:100,el:8}, muscles:['glutes'], muscleSide:'L',
  props:[bandPost(0.70), bandProp(0.70,0.3)],
  frames:{ start:hf(0.03,10,ankL(0.3,0.5,-30),8,-8), mid:hf(0.03,10,ankL(0.2,0.1,-5),8,-8), mid2:hf(0.05,11,ankL(0.28,-0.3,28),9,-11),
           end:hf(0.08,14,ankL(0.45,-0.6,50),10,-14) } });

// ---- hip flexion with band: facing away from the post, knee to 90
const arms = s => ({ fk:{flex:0,abd:18,elbow:10}, curl:0.2 });
const flex = (y,z,p,pr,pit) => ({ root:{pos:[0,0.92,0],pitch:pit}, neck:{flex:0}, armL:arms(1), armR:arms(-1),
  legR:{pos:[-0.1,0,0.02],anchor:'sole',pitch:0,yaw:-6}, legL:{pos:[0.1,y,z],anchor:'ankle',pitch:p,pole:[0,pr,1]} });
W('hip-flexion-with-band', { camera:{az:95,el:8}, muscles:['quadriceps'], muscleSide:'L',
  props:[{type:'anchor-post',pos:[0.1,0,-0.85],yaw:0,bandY:0.2},{type:'band',follow:'pelvis',a:[0.1,0.2,-0.79],b:{ankle:'L'},rest:0.5,width:0.03}],
  frames:{ start:flex(0.1,-0.06,-5,0,2), mid:flex(0.3,0.2,-10,0.2,2), end:flex(0.5,0.4,-12,0.3,0) } });

// ---- hip adduction, side on, machine/post at the figure's left (+X)
const addF = (ax,ay,az_,p,rz=0) => ({ root:{pos:[-0.09,0.92,rz],pitch:2}, neck:{flex:0},
  armL:{fk:{flex:0,abd:25,elbow:10},curl:0.2}, armR:{fk:{flex:0,abd:25,elbow:10},curl:0.2},
  legR:{pos:[-0.12,0,0.0],anchor:'sole',pitch:0,yaw:-4}, legL:{pos:[ax,ay,az_],anchor:'ankle',pitch:p,pole:[0,0.1,1]} });
const hold = { pos:[0.55,1.15,0.08], fingers:[1,0,0], palm:[0,0,1], curl:0.7, pole:[0,-1,0.2] };
const addFr0 = { start:addF(0.38,0.14,0.0,-4), mid:addF(0.12,0.2,0.06,-6), end:addF(-0.1,0.16,0.2,-8) };
const addFr = addFr0, addFrH = JSON.parse(JSON.stringify(addFr0)); for (const k in addFrH) addFrH[k].armL = hold;
W('cable-hip-adduction', { camera:{az:25,el:8}, muscles:['adductors'], muscleSide:'L',
  props:[{type:'cable-tower',pos:[0.68,0,0],yaw:-90,pulleyY:0.2,foot:'L',attachment:'ankle-strap'}], frames:addFrH });
W('band-hip-adductions', { camera:{az:25,el:8}, muscles:['adductors'], muscleSide:'L',
  props:[{type:'anchor-post',pos:[0.8,0,0],yaw:-90,bandY:0.2},{type:'band',follow:'pelvis',a:[0.74,0.2,0],b:{ankle:'L'},rest:0.5,width:0.03}], frames:addFr });

// ---- monster walk: half cycle, right foot steps through; mid lifts the foot
const bl = ld('_gallery/band-legs');
const handArm = s => ({ fk:{flex:25,abd:18,elbow:70}, curl:0.25 });
const mw = (rz, lz, rzf, ry, lw=0.2, rw=0.2) => ({ root:{pos:[0,0.8,rz],pitch:14}, neck:{flex:-10}, armL:handArm(1), armR:handArm(-1),
  legL:{pos:[lw,0,lz],anchor:'sole',yaw:6,pitch:0,pole:[0.5,0,1]}, legR:{pos:[-rw,rz===undefined?0:0,rzf],anchor:'sole',yaw:-6,pitch:0,pole:[-0.5,0,1]} });
const mwR = (rz, lz, rzf, ry, rw) => { const f = mw(rz,lz,rzf); f.legR.pos=[-rw,ry,rzf]; return f; };
W('monster-walk', { camera:{az:65,el:8}, muscles:['abductors','glutes'], props:bl.props,
  frames:{ start:mwR(-0.05,0.12,-0.12,0,0.22), mid:mwR(-0.05,0.12,-0.1,0.07,0.24), mid2:mwR(-0.05,0.12,0.04,0.12,0.3), mid3:mwR(-0.05,0.12,0.28,0.07,0.24), end:mwR(-0.05,0.12,0.3,0,0.22) } });

// ---- pull-through: back to a low cable, rope between the legs
const pt = (rz, ry, pit, sp, nk, hand) => { const a = s => ({ pos:[hand[0]*s,hand[1],hand[2]], contact:true, fingers:[0,-1,0.15], palm:[-s,0,0.05], curl:0.78, pole:[s*0.3,-0.2,-1] });
  return { root:{pos:[0,ry,rz],pitch:pit}, spine:{flex:sp}, neck:{flex:nk}, armL:a(1), armR:a(-1),
  legL:{pos:[0.3,0,0],anchor:'sole',pitch:0,yaw:12,pole:[0.5,0,1]}, legR:{pos:[-0.3,0,0],anchor:'sole',pitch:0,yaw:-12,pole:[-0.5,0,1]} }; };
W('pull-through', { camera:{az:70,el:8}, muscles:['glutes','hamstrings'],
  props:[{type:'cable-tower',pos:[0,0,-0.55],yaw:0,pulleyY:0.2,hands:true,attachment:'rope'}],
  frames:{ start:pt(-0.28,0.84,55,0,-15,[0.05,0.62,-0.02]), mid:pt(-0.14,0.9,28,0,-8,[0.05,0.78,0.08]), end:pt(0,0.9,6,0,-2,[0.05,0.92,0.17]) } });

// ---- band good morning variants, from the barbell good-morning hinge
const gm = ld('good-morning');
const neckBand = { type:'band', follow:'chest', a:{foot:'L',at:'sole'}, b:{follow:'chest',at:[0,0.2,-0.04]}, rest:0.55, width:0.03 };
const mid = (f) => ({ ...f, root:{pos:[0,0.86,-0.15],pitch:38}, neck:{flex:-15} });
const gmFrames = (props) => { const s=JSON.parse(JSON.stringify(gm.frames)); for (const k of ['start','end']) for (const a of ['armL','armR']) {  } s.mid = mid(JSON.parse(JSON.stringify(s.start))); return s; };
const gf = gmFrames();
W('band-good-morning', { camera:{az:100,el:8}, muscles:['hamstrings','spinal-erectors'],
  props:[ {type:'band',follow:'chest',a:{foot:'L',at:'sole'},b:{follow:'chest',at:[0,0.2,-0.04]},rest:0.5,width:0.03},
          {type:'band',follow:'chest',a:{foot:'R',at:'sole'},b:{follow:'chest',at:[0,0.2,-0.04]},rest:0.5,width:0.03} ], frames:gf });
W('band-good-morning-pull-through', { camera:{az:100,el:8}, muscles:['hamstrings','glutes'],
  props:[ {type:'anchor-post',pos:[0,0,-1.0],yaw:0,bandY:0.25}, {type:'band',follow:'chest',a:[0,0.25,-0.94],b:{follow:'chest',at:[0,0.2,-0.04]},rest:0.6,width:0.03} ], frames:gf });

// ---- seated band hamstring curl
const sc = (y,z,p,rootz=-0.05) => ({ root:{pos:[0,0.52,rootz],pitch:0}, neck:{flex:0},
  armL:{pos:[0.17,0.38,rootz-0.08],contact:true,fingers:[0,-1,0.2],palm:[-1,0,0],curl:0.6,pole:[1,-0.3,-0.6]},
  armR:{pos:[-0.17,0.38,rootz-0.08],contact:true,fingers:[0,-1,0.2],palm:[1,0,0],curl:0.6,pole:[-1,-0.3,-0.6]},
  legL:{pos:[0.1,y,z],anchor:'ankle',pitch:p,pole:[0,0.3,1]}, legR:{pos:[-0.1,y,z],anchor:'ankle',pitch:p,pole:[0,0.3,1]} });
W('seated-band-hamstring-curl', { floats:true, camera:{az:90,el:8}, muscles:['hamstrings'],
  props:[{type:'flat-bench',pos:[0,0,-0.4],height:0.42},{type:'anchor-post',pos:[0,0,1.5],yaw:180,bandY:0.2},
         {type:'band',follow:'pelvis',a:[0,0.2,1.44],b:{ankle:'L'},rest:0.5,width:0.03},{type:'band',follow:'pelvis',a:[0,0.2,1.44],b:{ankle:'R'},rest:0.5,width:0.03}],
  frames:{ start:sc(0.5,0.8,-10), mid:sc(0.3,0.72,-30), end:sc(0.12,0.36,-20) } });
