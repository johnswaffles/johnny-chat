import { CHARACTER_RIGS,createCharacterRigs } from '../src/character-rigs.js';
const params=new URLSearchParams(location.search),types=Object.keys(CHARACTER_RIGS),select=document.querySelector('#unit'),canvas=document.querySelector('#review'),ctx=canvas.getContext('2d'),rigs=createCharacterRigs();
for(const type of types){const o=document.createElement('option');o.value=type;o.textContent=CHARACTER_RIGS[type].label;select.append(o);}
select.value=CHARACTER_RIGS[params.get('unit')]?params.get('unit'):'villager';
let page=Number(params.get('page'))||0,phase=params.has('phase')?Number(params.get('phase')):null,playing=phase===null,clock=0,previous=performance.now();
const go=()=>{const url=new URL(location.href);url.searchParams.set('unit',select.value);url.searchParams.set('page',page);if(phase===null)url.searchParams.delete('phase');else url.searchParams.set('phase',phase);history.replaceState(null,'',url);document.querySelector('#title').textContent=CHARACTER_RIGS[select.value].label;document.querySelector('#studio').href='./hearthkin-studio.html?unit='+select.value;document.querySelector('#play').textContent=playing?'Pause':'Play';document.querySelector('#phase').value=phase===null?'':String(phase);};
select.onchange=()=>{page=0;clock=0;go();};
document.querySelector('#next').onclick=()=>{page=(page+1)%Math.ceil(Object.keys(CHARACTER_RIGS[select.value].actions).length/9);go();};
document.querySelector('#previous').onclick=()=>{const count=Math.ceil(Object.keys(CHARACTER_RIGS[select.value].actions).length/9);page=(page+count-1)%count;go();};
document.querySelector('#play').onclick=()=>{playing=!playing;if(playing)phase=null;go();};
document.querySelector('#phase').onchange=e=>{phase=e.target.value===''?null:Number(e.target.value);playing=phase===null;go();};go();
function frame(now){const dt=Math.min(.05,(now-previous)/1000);previous=now;if(playing)clock+=dt;
  const definition=CHARACTER_RIGS[select.value],rig=rigs.get(select.value),actions=Object.entries(definition.actions).slice(page*9,page*9+9);
  const ready=rig.readiness().every(i=>i.complete&&i.naturalWidth);canvas.dataset.ready=String(ready);canvas.dataset.character=select.value;canvas.dataset.states=actions.map(([s])=>s).join(',');canvas.dataset.phase=String(phase??clock);
  document.querySelector('#status').textContent=`${ready?'Artwork ready':'Loading artwork'} · ${page+1}/${Math.ceil(Object.keys(definition.actions).length/9)}`;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for(let i=0;i<actions.length;i++){
    const [state,a]=actions[i],x=i%3*533,y=Math.floor(i/3)*306;
    ctx.fillStyle='#192c2b';ctx.fillRect(x+4,y+4,525,298);
    ctx.fillStyle='#ebd9b3';ctx.textAlign='left';ctx.font='19px Georgia';ctx.fillText(a.label??state.replaceAll('_',' '),x+16,y+28);
    const local=phase===null?(a.loop===false?Math.min(clock%(a.duration+1),a.duration):clock%a.duration):phase*a.duration;
    const scale=165,baseline=y+236;
    for(let direction=0;direction<4;direction++){
      const anchor={x:x+70+direction*132,y:baseline};
      const unit={type:select.value,id:1,facing:direction,animationState:state,animationTime:local};
      ctx.fillStyle='#0b191a';ctx.beginPath();ctx.ellipse(anchor.x,anchor.y,30,7,0,0,Math.PI*2);ctx.fill();
      rig.draw(ctx,unit,anchor,scale,1,local);
      ctx.fillStyle='#aeb6a3';ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillText(['Front','Right','Back','Left'][direction],anchor.x,y+268);
    }
    ctx.fillStyle='#c8ad75';ctx.textAlign='right';ctx.font='12px system-ui';ctx.fillText(`${Math.round(local/a.duration*100)}%`,x+516,y+29);
  }
  requestAnimationFrame(frame);
}requestAnimationFrame(frame);
