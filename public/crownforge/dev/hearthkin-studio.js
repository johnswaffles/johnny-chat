import { HearthkinRig, HEARTHKIN_ACTIONS, hearthkinPose, drawHearthkinWard } from '../src/hearthkin-rig.js?v=20260904-naturalwalk1';

const canvas = document.querySelector('#stage');
const ctx = canvas.getContext('2d');
const action = document.querySelector('#action');
const play = document.querySelector('#play');
const scrub = document.querySelector('#scrub');
const speed = document.querySelector('#speed');
const ward = document.querySelector('#ward');
const joints = document.querySelector('#joints');
const status = document.querySelector('#status');
const progress = document.querySelector('#progress');
const rig = new HearthkinRig();
for (const [key, value] of Object.entries(HEARTHKIN_ACTIONS)) {
  if (key.startsWith('attack_')) continue;
  const option = document.createElement('option');option.value = key;option.textContent = value.label;action.append(option);
}
const requested = new URLSearchParams(location.search).get('action');
action.value = HEARTHKIN_ACTIONS[requested] && !requested.startsWith('attack_') ? requested : 'walk';
let clock = 0, playing = true, previous = performance.now(), impact = 0;
const setPlaying = value => { playing = value;play.textContent = playing ? 'Pause' : 'Play';play.setAttribute('aria-pressed', String(playing)); };
const review = new URLSearchParams(location.search);
if (review.has('pose')) {
  const pose = Number(review.get('pose'));
  if (Number.isFinite(pose)) clock = Math.max(0, Math.min(1, pose)) * HEARTHKIN_ACTIONS[action.value].duration;
  setPlaying(false);
}
play.addEventListener('click', () => {
  if (!playing && HEARTHKIN_ACTIONS[action.value].loop === false && clock >= HEARTHKIN_ACTIONS[action.value].duration) clock = 0;
  setPlaying(!playing);
});
action.addEventListener('change', () => { clock = 0;const url = new URL(location.href);url.searchParams.set('action', action.value);history.replaceState(null, '', url); });
scrub.addEventListener('input', () => {setPlaying(false);clock = Number(scrub.value) / 1000 * HEARTHKIN_ACTIONS[action.value].duration;});
document.querySelector('#impact').addEventListener('click', () => {ward.checked = true;impact = .42;});

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
  const delta = Math.min(.05, (now - previous) / 1000);previous=now;
  const definition = HEARTHKIN_ACTIONS[action.value];
  if(playing)clock+=delta*Number(speed.value);
  if(definition.loop===false&&clock>=definition.duration){clock=definition.duration;setPlaying(false);}
  const t = definition.loop === false ? Math.min(clock,definition.duration) : clock % definition.duration;
  impact=Math.max(0,impact-delta);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const ready=rig.readiness().filter(image=>image.complete&&image.naturalWidth).length;
  const message=ready===rig.readiness().length ? `${definition.label} · continuous motion · all four views loaded` : `Preparing artwork · ${ready}/${rig.readiness().length}`;
  if(status.textContent!==message)status.textContent=message;
  canvas.dataset.ready=String(ready===rig.readiness().length);
  canvas.dataset.action=action.value;
  for(let direction=0;direction<4;direction++) {
    const x=180+direction*360,y=438,size=338;
    const unit={id:1,facing:direction,animationState:action.value,animationTime:t,lastLightWardTimer:ward.checked?60:0,wardBlockedPulse:impact};
    shadow(x,y,size);drawHearthkinWard(ctx,unit,{x,y},size,now,true);rig.draw(ctx,unit,{x,y},size,1,t);drawHearthkinWard(ctx,unit,{x,y},size,now);
    if(joints.checked)drawJointGuide(hearthkinPose(action.value,t,direction),x,y,size);
    ctx.textAlign='center';ctx.fillStyle='#d3c4a7';ctx.font='20px Georgia,serif';ctx.fillText(['Front','Right','Back','Left'][direction],x,483);
    ctx.strokeStyle='#aac0aa22';ctx.beginPath();ctx.moveTo(x-112,512);ctx.lineTo(x+112,512);ctx.stroke();
    const displayScale=Math.min(canvas.clientWidth/canvas.width,canvas.clientHeight/canvas.height)||1;
    for(const [dx,scale] of [[-35,100*.28/displayScale],[35,100*.7/displayScale]]) {const p={x:x+dx,y:625};shadow(p.x,p.y,scale);rig.draw(ctx,unit,p,scale,1,t);drawHearthkinWard(ctx,unit,p,scale,now);}
    ctx.fillStyle='#91a99b';ctx.font='14px system-ui';ctx.fillText('28%  /  70% ZOOM',x,652);
  }
  scrub.value=String(Math.round(t/definition.duration*1000));progress.value=`${Math.round(t/definition.duration*100)}%`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
