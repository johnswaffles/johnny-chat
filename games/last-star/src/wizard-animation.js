// The top row shares one stance. Reverse through it instead of jumping to
// the differently drawn bottom row; hold the extremes for a soft breathing beat.
const IDLE_SEQUENCE=[0,0,1,2,3,3,2,1];
const idleFrameAt=(time,gentle=false)=>IDLE_SEQUENCE[Math.floor(time*(gentle?1.8:2.6))%IDLE_SEQUENCE.length];
// Distance-driven steps and time-driven airborne cloth; never fade body poses.
export const newWizardAnimation=()=>({phase:0,time:0,bob:0,weights:null,airTime:0,wasGrounded:true,landing:0,airFrame:0,walking:false,airborne:false,idle:false,idleTime:0,idleFrame:0});
export function advanceWizardAnimation(state,p,dt){
 if(dt===0&&state.weights)return state;
 const moving=p.onGround&&Math.abs(p.vx)>22;
 state.phase=(state.phase+(moving?Math.abs(p.vx)*dt/170:0))%1;
 state.walking=moving&&p.cast<=0;
 state.idle=p.onGround&&!moving&&p.cast<=0;
 state.idleTime=state.idle?state.idleTime+dt:0;
 state.idleFrame=idleFrameAt(state.idleTime);
 state.walkFrame=Math.floor(state.phase*8)%8;
 state.airborne=!p.onGround;
 if(state.airborne){
  state.airTime+=dt;
  state.airFrame=3; // One tucked jump pose; cloth moves independently.
  state.landing=0;
 }else{
  if(!state.wasGrounded)state.landing=.13;
  state.airTime=0;state.landing=Math.max(0,state.landing-dt);
 }
 state.wasGrounded=p.onGround;
 let index=state.airborne?7:4;
 if(p.cast>0&&!state.airborne)index=p.cast>.19?5:6;
 state.weights=Array.from({length:8},(_,i)=>i===index?1:0);
 // Foot-registered ground poses already contain the step rise; no extra bouncing.
 state.bob=0;
 state.time+=dt;
 return state;
}
// Hand-registered hips/foot baselines keep drawings from sliding between frames.
export function motionPose(animation){
 const air=animation.airborne,f=air?animation.airFrame:animation.walkFrame;
 const col=f%4,row=Math.floor(f/4),scale=.27;
 const runX=[250,251,228,225,239,249,230,237];
 const feet=[460,460,460,460,450,450,451,450];
 const airX=[277,265,262,268,264,266,262,264];
 const hips=[210,200,197,195,188,185,188,194];
 const runTips=[[332,94],[316,96],[288,89],[298,90],[312,87],[307,78],[293,81],[306,83]];
 const airTips=[[353,83],[333,77],[336,73],[337,69],[329,66],[318,67],[333,78],[331,78]];
 return {source:[col*384,row*512,384,512],scale,left:-(air?airX[f]:runX[f])*scale,top:air?-66-hips[f]*scale:-feet[f]*scale,tip:(air?airTips:runTips)[f],key:air?'wizardAir':'wizardWalk'};
}

// Only the trailing region is warped. Head, torso, staff and legs stay untouched.
export function drawAirCloth(ctx,art,s,left,top,scale,time){
 const split=185;
 ctx.drawImage(art,s[0]+split,s[1],s[2]-split,s[3],left+split*scale,top,(s[2]-split)*scale,s[3]*scale);
 for(let y=0;y<s[3];y+=16){
  const height=Math.min(16,s[3]-y),center=y+height/2;
  const envelope=center>32&&center<384?Math.sin((center-32)/352*Math.PI):0;
  const flutter=Math.sin(time*6-center*.025)*12*envelope*scale;
  ctx.drawImage(art,s[0],s[1]+y,split,height,left+flutter,top+y*scale,split*scale-flutter,height*scale);
 }
}

export function idlePose(animation,gentle=false){
 const frame=idleFrameAt(animation.idleTime,gentle);
 const scale=.245,feet=[499,499,499,499,492,492,492,492],pivots=[219,220,216,212,218,217,214,214];
 const tips=[[316,81],[315,81],[313,81],[311,77],[318,76],[315,73],[314,72],[313,74]];
 return {source:[frame%4*384,Math.floor(frame/4)*512,384,512],scale,left:-pivots[frame]*scale,top:-feet[frame]*scale,tip:tips[frame],key:'wizardIdle'};
}
