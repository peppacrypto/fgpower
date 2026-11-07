// per-exercise differences applied on top of the base poses
const rotAbout=(v,k,deg)=>{const t=deg*Math.PI/180,c=Math.cos(t),s=Math.sin(t);const n=Math.hypot(...k);k=k.map(x=>x/n);
 const d=k[0]*v[0]+k[1]*v[1]+k[2]*v[2];const cr=[k[1]*v[2]-k[2]*v[1],k[2]*v[0]-k[0]*v[2],k[0]*v[1]-k[1]*v[0]];
 return v.map((x,i)=>+(x*c+cr[i]*s+k[i]*d*(1-c)).toFixed(3));};
// spin a hand's fingers+palm about the palm normal
const spin=(a,deg)=>{const f=a.fingers;a.fingers=rotAbout(a.fingers,a.palm,deg);};
export const SPIN = {'towel-one-arm-pulldown:mid:armL':45}; // "slug:frame:arm": deg
export default function(o){
 // prone T / Y: hands closer to the shoulders
 for(const s of ['prone-t-raise','prone-y-raise']) for(const f of Object.values(o[s].frames)) for(const a of ['armL','armR']){f[a].pos[0]*=0.96;f[a].pos[2]*=0.96;}
 for(const f of Object.values(o['towel-floor-body-pull'].frames)) for(const a of ['armL','armR']) f[a].pos[2]=1.04;
 // prone pulldown: one towel length, held by both hands
 for(const f of Object.values(o['prone-towel-pulldown'].frames)) f.props=[{type:'towel-strip',hands:true,length:0.72}];
 // lateral raise: resisting hand stays in front of the body
 { const fr=o['towel-lateral-raise'].frames;
   for(const k of ['mid','end']){ fr[k].armR.pos[2]+=0.09; fr[k].armR.pole=[-1,-0.7,0.1]; }
   for(const f of Object.values(fr)) f.props=[{type:'towel-strip',hands:true,length:0.72}];
 }
 // one-arm pulldown: towel and hands further in front of the face
 { const fr=o['towel-one-arm-pulldown'].frames;
   for(const k of ['end']){ for(const a of ['armL','armR']) fr[k][a].pos[2]+=0.1; }
   fr.end.armR.pole=[-1,0.1,-0.2]; fr.end.armR.pos[1]=1.70; fr.end.armR.pos[0]-=0.06; fr.end.neck.flex=0;
   for(const f of Object.values(fr)) f.props=[{type:'towel-strip',hands:true,length:0.4}];
 }
 // overhead triceps: hand behind the neck, not inside the head; head up
 { const fr=o['towel-overhead-triceps'].frames;
   for(const f of Object.values(fr)){ f.neck.flex=-4; }
   fr.mid.armR.fingers=[0.25,-0.6,-0.1]; fr.end.armR.fingers=[0.25,-0.3,-0.1];
   fr.start.armL.pos=[0.06,1.56,-0.12];
   for(const f of Object.values(fr)) f.props=[{type:'towel-strip',hands:true,length:0.8}];
 }
 for(const [k,deg] of Object.entries(SPIN)){const [s,f,a]=k.split(':');spin(o[s].frames[f][a],deg);}
}
