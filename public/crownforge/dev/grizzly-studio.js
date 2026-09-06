import { GrizzlyRenderer } from '../src/grizzly-renderer.js?v=20260906-bearmotion1';
import { GRIZZLY_MOTION, GRIZZLY_ATTACKS, grizzlyProjection } from '../src/grizzly-motion.js?v=20260906-bearmotion1';
import { createCharacterRigs } from '../src/character-rigs.js?v=20260906-wildwoodwatch2';
const canvas=document.querySelector('#stage'),ctx=canvas.getContext('2d'),bear=new GrizzlyRenderer(),guard=createCharacterRigs({lazy:true}).get('soldier');
const action=document.querySelector('#action'),pause=document.querySelector('#pause'),slider=document.querySelector('#pose'),status=document.querySelector('#status'),bones=document.querySelector('#bones');
let clock=0,last=0,paused=false,frames=0;const errors=[];window.addEventListener('error',e=>errors.push(e.message));
pause.onclick=()=>{paused=!paused;pause.textContent=paused?'Play':'Pause'};action.onchange=()=>{clock=0};slider.oninput=()=>{paused=true;pause.textContent='Play';clock=slider.value/1000*duration()};
const duration=()=>GRIZZLY_ATTACKS[action.value]?.duration??(action.value==='death'?1.8:action.value==='walk'?GRIZZLY_MOTION.strideLength/2.85:4);
const params=new URLSearchParams(location.search);if(params.has('action'))action.value=params.get('action');if(params.has('pose')){paused=true;clock=Number(params.get('pose'))*duration();slider.value=Math.round(Number(params.get('pose'))*1000);pause.textContent='Play';}
const ground=new Image();ground.src='./assets/crownforge-grass-tile-v1.png';
function unit(direction){
 const d=GRIZZLY_ATTACKS[action.value],t=clock%duration(),wind=d?d.duration*d.anticipation:0,contact=d?d.duration*d.contact:0;
 const u={id:600+direction,type:'grizzly',facing:direction,animClock:clock,grizzlyTravel:t*2.85,grizzlyWalkBlend:action.value==='walk'?1:0,grizzlyAttackVariant:action.value,grizzlyAttackSide:1,attackPhase:'approach',attackPhaseElapsed:0,dead:action.value==='death',deathAge:t};
 const vector=[[1,0],[0,1],[0,-1],[-1,0]][direction];u.velocityX=action.value==='walk'?vector[0]*2.85:0;u.velocityZ=action.value==='walk'?vector[1]*2.85:0;
 if(d){u.attackPhase=t<wind?'anticipation':t<wind+contact?'contact':'recovery';u.attackPhaseElapsed=t-(t<wind?0:t<wind+contact?wind:wind+contact);}
 return u;
}
function tick(t){
 const dt=Math.min(.05,(t-(last||t))/1000);last=t;if(!paused)clock+=dt;
 const w=canvas.clientWidth,h=canvas.clientHeight,dpr=window.devicePixelRatio||1;
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#41543a';ctx.fillRect(0,0,w,h);
 if(ground.complete&&ground.naturalWidth){ctx.globalAlpha=.34;for(let y=0;y<h;y+=300)for(let x=0;x<w;x+=300)ctx.drawImage(ground,x,y,300,300);ctx.globalAlpha=1;}
 const size=Math.min(270,w*.26,h*.49),labels=['Southeast','Southwest','Northeast','Northwest'];
 for(let d=0;d<4;d++){
  const x=w*(d%2?.73:.27),y=h*(d<2?.47:.91),u=unit(d);
  bear.draw(ctx,u,{x,y},size,t,false,dpr);
  if(bones.checked){const p=bear.pose(u,t),k=size/GRIZZLY_MOTION.modelSize;ctx.strokeStyle='#ffcc62';ctx.lineWidth=2;for(const leg of Object.values(p.legs)){const q=[leg.root,leg.knee,leg.paw].map(j=>grizzlyProjection(j,d));ctx.beginPath();q.forEach((a,i)=>i?ctx.lineTo(x+a.x*k,y+a.y*k):ctx.moveTo(x+a.x*k,y+a.y*k));ctx.stroke();}}
  const ready=guard.readiness().every(i=>i.complete&&i.naturalWidth);if(ready)guard.draw(ctx,{id:20,kind:'unit',type:'soldier',facing:d,animationState:'idle',animationTime:clock,animClock:clock,motionSpeed:0},{x:x-size*.7,y},size*120/218);
  ctx.fillStyle='#f0e4c4';ctx.font='14px system-ui';ctx.textAlign='center';ctx.fillText(labels[d],x,y+25);
 }
 frames++;if(!paused)slider.value=Math.round((clock%duration())/duration()*1000);
 status.textContent=`${bear.frames.length===48?'Artwork ready':'Loading artwork'} · ${action.selectedOptions[0].text} · ${Math.round(clock%duration()/duration()*100)}% · ${frames} frames · ${errors.length} errors`;
 window.grizzlyReview={frames,errors,ready:bear.frames.length===48,action:action.value};requestAnimationFrame(tick);
}requestAnimationFrame(tick);
