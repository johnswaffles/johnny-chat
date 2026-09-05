import { CHARACTER_RIGS,createCharacterRigs } from '../src/character-rigs.js?v=20260905-softelbow1';
const canvas=document.querySelector('#horses'),ctx=canvas.getContext('2d'),rigs=createCharacterRigs({lazy:true}),types=['scout','ashenOutrider'];
const direction=document.querySelector('#direction'),action=document.querySelector('#action'),phase=document.querySelector('#phase'),play=document.querySelector('#play'),params=new URLSearchParams(location.search);
for(const [key,a] of Object.entries(CHARACTER_RIGS.scout.actions)){const o=document.createElement('option');o.value=key;o.textContent=a.label;action.append(o);}
direction.value=params.get('direction')??'1';action.value=params.get('action')??'idle';phase.value=String(Number(params.get('phase')??.25)*1000);
let playing=false,previous=performance.now(),clock=Number(phase.value)/1000;
play.onclick=()=>{playing=!playing;play.textContent=playing?'Pause':'Play';};phase.oninput=()=>{playing=false;play.textContent='Play';clock=Number(phase.value)/1000;};
function frame(now){if(playing){clock=(clock+(now-previous)/1000/2)%1;phase.value=String(Math.round(clock*1000));}previous=now;
  const ready=types.every(type=>rigs.get(type).readiness().every(i=>i.complete&&i.naturalWidth));
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.textAlign='center';ctx.font='26px Georgia';
  for(const [i,type] of types.entries()){const x=350+i*700,y=560;ctx.fillStyle='#182d2e';ctx.fillRect(i*700+10,10,680,640);ctx.fillStyle='#ecdbb9';ctx.fillText(CHARACTER_RIGS[type].label,x,55);ctx.fillStyle='#081719';ctx.beginPath();ctx.ellipse(x,y,180,24,0,0,Math.PI*2);ctx.fill();
    if(ready){const t=clock*CHARACTER_RIGS[type].actions[action.value].duration;rigs.get(type).draw(ctx,{id:i+1,type,facing:Number(direction.value),animationState:action.value,animationTime:t},{x,y},430,1,t);}
  }
  canvas.dataset.ready=String(ready);canvas.dataset.direction=direction.value;canvas.dataset.action=action.value;canvas.dataset.phase=String(clock);document.querySelector('#status').textContent=ready?'Both horses ready':'Loading artwork';requestAnimationFrame(frame);
}requestAnimationFrame(frame);
