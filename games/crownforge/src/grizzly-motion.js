// Actor coordinates: x right, y up, z forward. Feet follow a four-beat walk.
export const GRIZZLY_MOTION = Object.freeze({ modelSize:200, strideLength:1.8, stance:.72 });
export const GRIZZLY_ATTACKS = Object.freeze({
  swipe:Object.freeze({duration:1.45,anticipation:.28,contact:.30,recovery:.42}),
  rear:Object.freeze({duration:2.2,anticipation:.40,contact:.18,recovery:.42}),
});
const CONTACT={hindLeft:0,frontLeft:.25,hindRight:.5,frontRight:.75};
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
const v=(x=0,y=0,z=0)=>({x,y,z});
const add=(a,b)=>v(a.x+b.x,a.y+b.y,a.z+b.z);
const sub=(a,b)=>v(a.x-b.x,a.y-b.y,a.z-b.z);
const mul=(a,s)=>v(a.x*s,a.y*s,a.z*s);
const length=a=>Math.hypot(a.x,a.y,a.z);
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const lerp=(a,b,t)=>add(a,mul(sub(b,a),t));
const fraction=t=>t-Math.floor(t);

export function grizzlyAttackDefinition(unit){return GRIZZLY_ATTACKS[unit.grizzlyAttackVariant]??GRIZZLY_ATTACKS.swipe;}
export function grizzlyAttackClock(unit){
  if(!unit.attackPhase||unit.attackPhase==='approach')return null;
  const d=grizzlyAttackDefinition(unit),wind=d.duration*d.anticipation,contact=d.duration*d.contact;
  return (unit.attackPhase==='contact'?wind:unit.attackPhase==='recovery'?wind+contact:0)+(unit.attackPhaseElapsed??0);
}

// No wall-clock sprite loop: a blocked bear advances no stride distance.
export function updateGrizzlyMotion(unit,dt,travelled){
  const moving=travelled>1e-5&&unit.attackPhase==='approach';
  unit.grizzlyTravel=(unit.grizzlyTravel??0)+(moving?travelled:0);
  const goal=moving?1:0,rate=Math.min(1,dt/(moving?.16:.12));
  unit.grizzlyWalkBlend=mix(unit.grizzlyWalkBlend??0,goal,rate);
  if(!moving&&unit.grizzlyWalkBlend<.001)unit.grizzlyWalkBlend=0;
}

export function grizzlyProjection(p,direction=0){
  const right=[[1,-1],[1,1],[-1,-1],[-1,1]][direction];
  const forward=[[1,1],[-1,1],[1,-1],[-1,-1]][direction];
  const k=Math.SQRT1_2;
  return {x:k*(p.x*right[0]+p.z*forward[0]),y:k*.5*(p.x*right[1]+p.z*forward[1])-p.y};
}

function joint(root,foot,upper,lower,pole){
  const delta=sub(foot,root),span=length(delta),axis=mul(delta,1/Math.max(span,1e-8));
  const reach=clamp(span,Math.abs(upper-lower)+.01,upper+lower-.01);
  const along=(upper*upper-lower*lower+reach*reach)/(2*reach);
  const bend=Math.sqrt(Math.max(0,upper*upper-along*along));
  let normal=sub(pole,mul(axis,dot(pole,axis)));
  if(length(normal)<1e-6)normal=v(1,0,0);
  normal=mul(normal,1/length(normal));
  return {middle:add(root,add(mul(axis,along),mul(normal,bend))),foot:add(root,mul(axis,reach))};
}

function choreograph(t,d,ready,windup,hit,follow){
  const wind=d.duration*d.anticipation,impact=wind+d.duration*d.contact*.2,end=wind+d.duration*d.contact;
  if(t<wind)return lerp(ready,windup,ease(t/wind));
  if(t<impact)return lerp(windup,hit,ease((t-wind)/(impact-wind)));
  if(t<end)return lerp(hit,follow,ease((t-impact)/(end-impact)));
  return lerp(follow,ready,ease((t-end)/(d.duration-end)));
}

export function grizzlyRearAmount(attack,time){
  if(attack!=='rear')return 0;
  const d=GRIZZLY_ATTACKS.rear,wind=d.duration*d.anticipation,end=wind+d.duration*d.contact;
  return time<wind?ease(time/wind):time<end?1:1-ease((time-end)/(d.duration-end));
}

export function grizzlyPose({direction=0,travel=0,walking=0,idleTime=0,attack=null,attackTime=0,side=1,death=0,moveX=0,moveZ=1}={}){
  const d=GRIZZLY_ATTACKS[attack]??GRIZZLY_ATTACKS.swipe;
  const rear=grizzlyRearAmount(attack,attackTime);
  const gait=travel/GRIZZLY_MOTION.strideLength;
  const breath=Math.sin(idleTime*1.8)*.45*(1-walking)*(attack?0:1);
  const fall=ease(death/1.05);
  const hip=v(mix(0,19,fall),mix(mix(69,66,rear),18,fall),-40);
  const shoulder=v(mix(0,27,fall),mix(mix(84,143,rear)+breath,21,fall),mix(36,-15,rear));
  const head=v(mix(0,36,fall),mix(mix(94,156,rear)+breath,23,fall),mix(66,-10,rear));
  if(attack==='swipe'){
    const shift=choreograph(attackTime,d,v(),v(-side*2,3,-5),v(side*2,-7,8),v(side*3,-4,5));
    Object.assign(shoulder,add(shoulder,shift));Object.assign(head,add(head,shift));
  }
  // Convert one world step into model units. The renderer scales this model
  // by renderSize / modelSize, so stance paws cancel actual ground travel.
  const modelPerWorld=26/Math.SQRT1_2/(218/GRIZZLY_MOTION.modelSize);
  const stride=GRIZZLY_MOTION.strideLength*GRIZZLY_MOTION.stance*.5*modelPerWorld;
  const legs={};
  for(const name of ['hindLeft','hindRight','frontLeft','frontRight']){
    const front=name.startsWith('front'),sign=name.endsWith('Right')?1:-1;
    const phase=fraction(gait-CONTACT[name]);
    const planted=phase<GRIZZLY_MOTION.stance;
    const q=planted?phase/GRIZZLY_MOTION.stance:(phase-GRIZZLY_MOTION.stance)/(1-GRIZZLY_MOTION.stance);
    const tangent=-2*(1-GRIZZLY_MOTION.stance)/GRIZZLY_MOTION.stance;
    const sweep=(planted?1-2*q:-1+2*ease(q)+tangent*(2*q*q*q-3*q*q+q))*stride*walking*(1-rear);
    const lift=planted?0:7*Math.sin(q*Math.PI)**2*walking*(1-rear);
    const root=add(front?shoulder:hip,v(sign*(front?24:22),front?-4:0,0));
    let foot=v(sign*(front?29:25)+sweep*moveX,4+lift,(front?45:-48)+sweep*moveZ);
    if(attack){
      const active=sign===side;
      if(front&&attack==='swipe'&&active)foot=choreograph(attackTime,d,foot,v(sign*36,62,29),v(-sign*8,31,100),v(-sign*21,22,81));
      if(front&&attack==='rear')foot=choreograph(attackTime,d,foot,v(sign*(active?40:31),active?162:128,active?8:24),v(active?-sign*14:sign*32,active?70:125,active?84:27),v(active?-sign*20:sign*31,active?58:107,active?65:30));
    }
    if(fall)foot=lerp(foot,v(sign*35+17,4,front?50:-50),fall);
    const upper=front?32:34,lower=front?44:40;
    const solved=joint(root,add(foot,v(0,12,0)),upper,lower,v(0,0,front?-1:1));
    legs[name]={root,knee:solved.middle,ankle:solved.foot,paw:sub(solved.foot,v(0,12,0)),planted:planted&&(!attack||!front||attack==='swipe'&&sign!==side),front,sign,upper,lower};
  }
  return {direction,hip,shoulder,head,legs,rear,fall,attack,bodyThickness:mix(96,44,fall),headSize:62};
}
