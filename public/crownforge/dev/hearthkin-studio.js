import { UNIT_TYPES } from '../src/config.js';
import { CHARACTER_RIGS, createCharacterRigs } from '../src/character-rigs.js?v=20260905-wristfit3';
import { drawHearthkinWard } from '../src/hearthkin-rig.js?v=20260905-wristfit3';
import { fitHearthkinProfile } from '../src/hearthkin-surface-fit.js?v=20260905-wristfit3';

const canvas = document.querySelector('#stage');
const ctx = canvas.getContext('2d');
const action = document.querySelector('#action');
const play = document.querySelector('#play');
const scrub = document.querySelector('#scrub');
const speed = document.querySelector('#speed');
const ward = document.querySelector('#ward');
const joints = document.querySelector('#joints');
const detail = document.querySelector('#detail');
const status = document.querySelector('#status');
const progress = document.querySelector('#progress');
const character=document.querySelector('#character');
const rigs=createCharacterRigs();
for(const [type,definition] of Object.entries(CHARACTER_RIGS)) {
  const option=document.createElement('option');option.value=type;option.textContent=definition.label;character.append(option);
}
const reviewParams=new URLSearchParams(location.search);
character.value=CHARACTER_RIGS[reviewParams.get('unit')]?reviewParams.get('unit'):'villager';
let rig=rigs.get(character.value),ACTIONS=CHARACTER_RIGS[character.value].actions;
function selectCharacter(requested) {
  rig=rigs.get(character.value);ACTIONS=CHARACTER_RIGS[character.value].actions;
  action.replaceChildren();
  for(const [key,value] of Object.entries(ACTIONS)) {
    if(key.startsWith('attack_'))continue;
    const option=document.createElement('option');option.value=key;option.textContent=value.label??key.replaceAll('_',' ');action.append(option);
  }
  action.value=ACTIONS[requested]&&!requested.startsWith('attack_')?requested:'walk';
  const name=CHARACTER_RIGS[character.value].label;
  document.querySelector('#character-name').textContent=name;
  document.title=name+' · Crownforge Character Studio';
  const worker=CHARACTER_RIGS[character.value].family==='worker';
  ward.closest('label').hidden=!worker;if(!worker)ward.checked=false;
  document.querySelector('#impact').textContent=worker?'Block a blow':'Take a hit';
}
selectCharacter(reviewParams.get('action')??'walk');
character.addEventListener('change',()=>{
  selectCharacter(action.value);clock=0;
  const url=new URL(location.href);url.searchParams.set('unit',character.value);url.searchParams.set('action',action.value);history.replaceState(null,'',url);
});
let clock = 0, playing = true, previous = performance.now(), impact = 0;
const setPlaying = value => { playing = value;play.textContent = playing ? 'Pause' : 'Play';play.setAttribute('aria-pressed', String(playing)); };
const review = new URLSearchParams(location.search);
detail.checked = review.get('detail') === 'arms';
detail.addEventListener('change', () => {
  const url=new URL(location.href);
  if(detail.checked)url.searchParams.set('detail','arms');else url.searchParams.delete('detail');
  history.replaceState(null,'',url);
});
if (review.has('pose')) {
  const pose = Number(review.get('pose'));
  if (Number.isFinite(pose)) clock = Math.max(0, Math.min(1, pose)) * ACTIONS[action.value].duration;
  setPlaying(false);
}
play.addEventListener('click', () => {
  if (!playing && ACTIONS[action.value].loop === false && clock >= ACTIONS[action.value].duration) clock = 0;
  setPlaying(!playing);
});
action.addEventListener('change', () => { clock = 0;const url = new URL(location.href);url.searchParams.set('action', action.value);history.replaceState(null, '', url); });
scrub.addEventListener('input', () => {setPlaying(false);clock = Number(scrub.value) / 1000 * ACTIONS[action.value].duration;});
document.querySelector('#impact').addEventListener('click', () => {
  if(CHARACTER_RIGS[character.value].family==='worker'){ward.checked=true;impact=.42;action.value='ward_block';}
  else action.value='hit';
  clock=0;setPlaying(true);
});

function shadow(x, y, size) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * .29);
  gradient.addColorStop(0, '#07191572');gradient.addColorStop(1, '#07191500');
  ctx.save();ctx.translate(x, y);ctx.scale(1, .24);ctx.fillStyle=gradient;
  ctx.restore();ctx.fillStyle='rgba(2,13,10,.25)';ctx.beginPath();ctx.ellipse(x,y,size*.22,size*.038,0,0,Math.PI*2);ctx.fill();
}
function drawJointGuide(pose, x, y, size) {
  ctx.save();ctx.translate(x,y);ctx.scale(size/100,size/100);ctx.strokeStyle='#79ded1';ctx.fillStyle='#fff0be';ctx.lineWidth=.4;
  for (const names of [['leftHip','leftKnee','leftFoot'],['rightHip','rightKnee','rightFoot'],['leftShoulder','leftElbow','leftHand'],['rightShoulder','rightElbow','rightHand']]) {
    ctx.beginPath();for(let i=0;i<names.length;i++){const a=pose[names[i]].point??pose[names[i]];if(!i)ctx.moveTo(a.x,a.y);else ctx.lineTo(a.x,a.y);}ctx.stroke();
    for(const name of names){const a=pose[name].point??pose[name];ctx.beginPath();ctx.arc(a.x,a.y,.85,0,Math.PI*2);ctx.fill();}
  }
  ctx.restore();
}
function frame(now) {
  const mountedSamples=CHARACTER_RIGS[character.value].family==='mounted'&&!detail.checked;
  const stageHeight=mountedSamples?920:660;
  if(canvas.height!==stageHeight)canvas.height=stageHeight;
  const delta = Math.min(.05, (now - previous) / 1000);previous=now;
  const definition = ACTIONS[action.value];
  if(playing)clock+=delta*Number(speed.value);
  if(definition.loop===false&&clock>=definition.duration){clock=definition.duration;setPlaying(false);}
  const t = definition.loop === false ? Math.min(clock,definition.duration) : clock % definition.duration;
  impact=Math.max(0,impact-delta);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const ready=rig.readiness().filter(image=>image.complete&&image.naturalWidth).length;
  const actionLabel=definition.label??action.value.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
  const message=ready===rig.readiness().length ? `${actionLabel} · continuous motion · all four views loaded` : `Preparing artwork · ${ready}/${rig.readiness().length}`;
  if(status.textContent!==message)status.textContent=message;
  canvas.dataset.ready=String(ready===rig.readiness().length);
  canvas.dataset.action=action.value;
  canvas.dataset.character=character.value;
  canvas.dataset.view=detail.checked?'arms':'full';
  for(let direction=0;direction<4;direction++) {
    const x=180+direction*360,y=detail.checked?725:438,size=detail.checked?700:338;
    const unit={id:1,type:character.value,facing:direction,animationState:action.value,animationTime:t,lastLightWardTimer:ward.checked?60:0,wardBlockedPulse:impact};
    ctx.save();
    if(detail.checked){ctx.beginPath();ctx.rect(x-165,36,330,564);ctx.clip();}
    if(ready===rig.readiness().length){shadow(x,y,size);drawHearthkinWard(ctx,unit,{x,y},size,now,true);rig.draw(ctx,unit,{x,y},size,1,t);drawHearthkinWard(ctx,unit,{x,y},size,now);}
    if(joints.checked){
      let pose=CHARACTER_RIGS[character.value].samplePose(action.value,t,direction);
      if(character.value==='villager')pose=fitHearthkinProfile(pose);
      drawJointGuide(pose,x,y,size*(CHARACTER_RIGS[character.value].renderScale??1));
    }
    ctx.restore();
    ctx.textAlign='center';ctx.fillStyle='#d3c4a7';ctx.font='20px Georgia,serif';ctx.fillText(['Front','Right','Back','Left'][direction],x,detail.checked?632:483);
    if(detail.checked)continue;
    ctx.strokeStyle='#aac0aa22';ctx.beginPath();ctx.moveTo(x-112,512);ctx.lineTo(x+112,512);ctx.stroke();
    const displayScale=Math.min(canvas.clientWidth/canvas.width,canvas.clientHeight/canvas.height)||1;
    if(ready===rig.readiness().length)for(const [dx,scale] of [[-35,UNIT_TYPES[character.value].renderSize*.28/displayScale],[35,UNIT_TYPES[character.value].renderSize*.7/displayScale]]) {const p={x:x+dx,y:mountedSamples?885:625};shadow(p.x,p.y,scale);rig.draw(ctx,unit,p,scale,1,t);drawHearthkinWard(ctx,unit,p,scale,now);}
    ctx.fillStyle='#91a99b';ctx.font='14px system-ui';ctx.fillText('28%  /  70% ZOOM',x,mountedSamples?912:652);
  }
  scrub.value=String(Math.round(t/definition.duration*1000));progress.value=`${Math.round(t/definition.duration*100)}%`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
