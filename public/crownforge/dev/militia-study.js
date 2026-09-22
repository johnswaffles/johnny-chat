import oldArt from './militia-study-original.js';
import art from './militia-study-art.js';
import {PaintedRosterRenderer} from '../src/painted-roster/painted-roster-renderer.js';
import {CHARACTER_RIGS} from '../src/character-rigs.js?v=20260921-steadyhealers1';
const old=new PaintedRosterRenderer(CHARACTER_RIGS.militia,oldArt);
const images={};for(const action of ['walk','attack']){const im=new Image();im.src=art[action].src;await im.decode();images[action]=im;}
let oldReady=false;
Promise.all(['walk','attack','idle'].map(action=>old.prepareAction('se',action))).then(results=>{oldReady=results.every(Boolean);});
// Align the pelvis to the same ground station rather than following the
// forward toe, which would slide the body from side to side each stride.
const anchors={walk:[218,583,944,1289,218,583,944,1289],attack:[200,573,940,1295,205,573,940,1295]};
for(const action of ['walk','attack'])art[action].frames.forEach((f,i)=>{f.pivot[0]=anchors[action][i]-f.rect[0];if(action==='walk')f.scaleBase=f.rect[3]-8;});
// One smooth mace arc per stride, matching the playable militia.
art.walk.frames=[0,2,1,3,5,6,7,4].map(i=>art.walk.frames[i]);
const before=document.querySelector('#before'),after=document.querySelector('#after'),status=document.querySelector('#status');
const media=matchMedia('(prefers-reduced-motion: reduce)');let action='walk',playing=!media.matches,time=0,last=performance.now();
const pause=document.querySelector('#pause');pause.textContent=playing?'Pause':'Play';
for(const b of document.querySelectorAll('[data-action]'))b.onclick=()=>{action=b.dataset.action;time=0;for(const c of document.querySelectorAll('[data-action]'))c.setAttribute('aria-pressed',String(c===b));};
pause.onclick=()=>{playing=!playing;pause.textContent=playing?'Pause':'Play';};document.querySelector('#step').onclick=()=>{playing=false;pause.textContent='Play';if(action==='attack'){const next=(attackFrame(time)+1)%8;time=durations.slice(0,next).reduce((a,b)=>a+b,0)+.001;}else if(action==='walk'){time=((Math.floor(time/1.55*8)+1)%8)*1.55/8+.001;}};
const durations=[.16,.12,.13,.065,.055,.15,.16,.26];
function attackFrame(t){let phase=t%1.1;for(let i=0;i<durations.length;i++){phase-=durations[i];if(phase<0)return i;}return 7;}
function floor(ctx){ctx.fillStyle='#030b0d55';ctx.beginPath();ctx.ellipse(550,855,105,20,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#a58c4e35';ctx.beginPath();ctx.ellipse(550,855,145,35,0,0,Math.PI*2);ctx.stroke();}
function frame(now){const dt=Math.max(0,Math.min(.06,(now-last)/1000));last=now;if(playing&&!document.hidden)time+=dt*Number(document.querySelector('#speed').value);const size=Number(document.querySelector('#scale').value)*2;const a=action==='idle'?'attack':action,index=action==='idle'?0:action==='attack'?attackFrame(time):Math.floor(time/1.55*8)%8;const f=art[a].frames[index],scale=size/f.scaleBase;
for(const canvas of [before,after]){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);floor(ctx);}
if(oldReady)old.draw(before.getContext('2d'),{type:'militia',paintedFacing:0,animationState:action,command:'idle'}, {x:550,y:855},size,1,time);
if(!oldReady){const g=before.getContext('2d');g.fillStyle='#bdc9c8';g.font='24px system-ui';g.textAlign='center';g.fillText('Loading original comparison…',550,450);}
const ctx=after.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.save();const breath=action==='idle'&&playing?Math.sin(time*2)*.002:0;ctx.translate(550,855);ctx.scale(1,1+breath);ctx.drawImage(images[a],...f.rect,-f.pivot[0]*scale,-f.pivot[1]*scale,f.rect[2]*scale,f.rect[3]*scale);ctx.restore();status.textContent=`${playing?'Playing':'Paused'} · ${action==='idle'?'ready stance':`pose ${index+1} / 8`}`;requestAnimationFrame(frame);}requestAnimationFrame(frame);
