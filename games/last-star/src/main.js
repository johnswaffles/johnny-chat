import {Game,SAVE_KEY,parseSave,SEALS,COOLDOWNS,missingHealthBonus,MEMORIES} from './game.js?arcade=1';
import {Renderer,loadArt} from './render.js?arcade=1';
import {Soundscape} from './audio.js?arcade=1';
import {Controller,readBindings,DEFAULT_KEYS,ACTIONS,keyName,buttonName,normalizeKey} from './controls.js';
import {ControlsUI} from './controls-ui.js';
const $=id=>document.getElementById(id);
const qa=new URLSearchParams(location.search).has('qa');
const storageKey=qa?SAVE_KEY+'-qa':SAVE_KEY;
const keys=new Set(),pressed=new Set();
let game=new Game(),renderer,mode='title',menuReturn='title',previous=0,accumulator=0,uiTimer=0,toastUntil=0,dialogueUntil=0,areaUntil=0,mouseDown=false,mouseAim=null,qaDriver=null,qaReplay=false;
const audio=new Soundscape();
const controller=new Controller();
let bindings;try{bindings=readBindings(localStorage.getItem(storageKey+'-bindings'));}catch{bindings=readBindings(null);}
let lastDevice='keyboard',menuDirection=0,menuRepeatAt=0,controllerError='',qaPadSource=null;
const controlsUI=new ControlsUI(bindings,controller,()=>{try{localStorage.setItem(storageKey+'-bindings',JSON.stringify(bindings));}catch{controlsUI.message('Controls changed for this session; browser storage is unavailable.');}});
let saved=null,settings={sound:true,gentle:matchMedia('(prefers-reduced-motion: reduce)').matches,quality:'high'};
try{saved=parseSave(localStorage.getItem(storageKey));const prefs=JSON.parse(localStorage.getItem(SAVE_KEY+'-settings'));if(prefs){settings.sound=prefs.sound!==false;settings.gentle=prefs.gentle===true;settings.quality=prefs.quality==='low'?'low':'high';}}catch{}
const zoneNames=['The Silverwood','The Broken Aqueduct','The Last Observatory'];
function showToast(text){$('toast').textContent=text;toastUntil=performance.now()+3000;$('toast').classList.add('visible');}
function save(){saved=game.save();try{localStorage.setItem(storageKey,JSON.stringify(saved));}catch{showToast('This browser cannot save. Keep this window open to continue.');}}
function showDialogue(text){$('dialogue').querySelector('p').textContent=text;dialogueUntil=performance.now()+Math.max(6200,text.length*48);$('dialogue').hidden=false;}
let memoryIndex=0,memoryPage=0;
function renderMemory(){
 const m=MEMORIES[memoryIndex];
 $('memory-title').textContent=m.title;$('memory-chapter').textContent=`MEMORY ${m.chapter} OF ${MEMORIES.length} · ${game.memories.size} FOUND`;
 $('memory-place').textContent=m.place;$('memory-art').src=`assets/${m.art}`;$('memory-art').alt=m.alt;
 $('memory-prose').textContent=m.paragraphs[memoryPage];$('memory-page').textContent=`${memoryPage+1} / ${m.paragraphs.length}`;
 $('memory-prev').disabled=memoryPage===0;$('memory-next').textContent=memoryPage===m.paragraphs.length-1?'Return to the journey':'Next page →';
}
function openMemory(index){memoryIndex=index;memoryPage=0;renderMemory();$('dialogue').hidden=true;setMode('memory');}
function closeMemory(){if(mode==='memory'){accumulator=0;setMode('playing');$('world').focus();}}
$('memory-prev').onclick=()=>{if(memoryPage>0){memoryPage--;renderMemory();}};
$('memory-next').onclick=()=>{if(memoryPage<MEMORIES[memoryIndex].paragraphs.length-1){memoryPage++;renderMemory();}else closeMemory();};
$('memory-close').onclick=closeMemory;
$('memory-screen').addEventListener('keydown',e=>{if(e.key!=='Tab')return;const buttons=[...$('memory-screen').querySelectorAll('button')].filter(b=>!b.disabled);const i=buttons.indexOf(document.activeElement);e.preventDefault();buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length].focus();});
function setMode(next){mode=next;$('hud').inert=next==='memory';keys.clear();pressed.clear();controller.clearEdges();mouseDown=false;mouseAim=null;for(const [id,name] of [['memory-screen','memory'],['title-screen','title'],['pause-screen','pause'],['bindings-screen','bindings'],['death-screen','dead'],['ending-screen','won']])$(id).hidden=next!==name;$('hud').hidden=next==='title'||(next==='bindings'&&menuReturn==='title');if(renderer)renderer.title=next==='title';if(next!=='playing')requestAnimationFrame(()=>{if(mode!==next)return;const target=next==='memory'?'memory-next':next==='pause'?'resume':next==='bindings'?'bindings-back':next==='dead'?'retry':next==='won'?'replay':saved&&!saved.completed?'continue':'begin';$(target)?.focus();});}
function start(resume=false){
  qaReplay=false;toastUntil=dialogueUntil=areaUntil=0;$('dialogue').hidden=true;$('toast').classList.remove('visible');$('area-title').classList.remove('visible');
  game=new Game(resume?saved:null);renderer.camera=Math.max(0,game.player.x-renderer.w*.37);renderer.particles=[];renderer.rings=[];renderer.arcs=[];renderer.echoes=[];renderer.arcadeWaves=[];
  setMode('playing');audio.start();accumulator=0;
  if(!resume){showDialogue('One ember survived the sealed night. Follow the starseals. Bring its light home.');}
  updateUI();
}
function pause(){if(mode==='memory'){closeMemory();return;}if(mode==='playing'||mode==='title'){menuReturn=mode;setMode('pause');if(menuReturn==='title')$('hud').hidden=true;}else if(mode==='pause')setMode(menuReturn);else if(mode==='bindings'){controlsUI.cancel();setMode('pause');}}
function applySettings(){
  settings={sound:$('sound').checked,gentle:$('gentle').checked,quality:$('quality').value};
  audio.setEnabled(settings.sound);if(renderer){renderer.gentle=settings.gentle;renderer.quality=settings.quality;}
  try{localStorage.setItem(SAVE_KEY+'-settings',JSON.stringify(settings));}catch{}
}
for(const [id,key] of [['sound','sound'],['gentle','gentle']]){$(id).checked=settings[key];$(id).addEventListener('change',applySettings);}
$('quality').value=settings.quality;$('quality').addEventListener('change',applySettings);
$('begin').addEventListener('click',()=>start(false));$('continue').addEventListener('click',()=>start(true));
$('pause-button').addEventListener('click',pause);$('resume').addEventListener('click',()=>setMode(menuReturn));
$('title-settings').addEventListener('click',()=>{menuReturn='title';setMode('pause');$('hud').hidden=true;});
$('customize-controls').addEventListener('click',()=>{setMode('bindings');controlsUI.cancel();controlsUI.status(controllerError);});
$('bindings-back').addEventListener('click',()=>{controlsUI.cancel();setMode('pause');if(menuReturn==='title')$('hud').hidden=true;});
function title(){setMode('title');$('continue').hidden=!saved||saved.completed;game=new Game();game.player.x=renderer.w*.72;game.player.y=580;}
$('back-title').addEventListener('click',()=>{if(menuReturn==='playing')save();title();});
$('ending-title').addEventListener('click',title);$('retry').addEventListener('click',()=>start(true));$('replay').addEventListener('click',()=>start(false));
for(const button of document.querySelectorAll('[data-spell]'))button.addEventListener('click',()=>{if(mode==='playing')game.spell(button.dataset.spell,{move:(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)});});
function actionKeys(action){
  const primary=bindings.keys[action];if(primary!==DEFAULT_KEYS[action])return [primary];
  const aliases={left:['ArrowLeft'],right:['ArrowRight'],jump:['KeyW','ArrowUp'],blink:['KeyK']};
  // A customized primary binding takes precedence over an old convenience alias.
  return [primary,...(aliases[action]||[]).filter(k=>!Object.values(bindings.keys).includes(k))];
}
window.addEventListener('keydown',e=>{
  if(controlsUI.key(e))return;
  const code=normalizeKey(e.code);lastDevice='keyboard';
  if(code!=='Escape'&&!Object.keys(DEFAULT_KEYS).some(a=>actionKeys(a).includes(code)))return;
  if(mode==='playing'||e.code==='Escape')e.preventDefault();
  if(e.code==='Escape'){if(!e.repeat)pause();return;}
  if(mode!=='playing')return;
  if(!keys.has(code))pressed.add(code);keys.add(code);
});
window.addEventListener('keyup',e=>keys.delete(normalizeKey(e.code)));
window.addEventListener('blur',()=>{keys.clear();pressed.clear();controller.clearEdges();controlsUI.cancel();mouseDown=false;if(mode==='playing')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')pause();});
function pointerWorld(e){const rect=$('world').getBoundingClientRect();return {aimX:(e.clientX-rect.left)/rect.width*renderer.w+renderer.camera,aimY:(e.clientY-rect.top)/rect.height*720};}
$('world').addEventListener('pointerdown',e=>{lastDevice='keyboard';if(mode!=='playing')return;e.preventDefault();mouseAim=pointerWorld(e);if(e.button===0)mouseDown=true;if(e.button===2)game.spell('constellation',mouseAim);});
$('world').addEventListener('pointermove',e=>{if(mouseDown)mouseAim=pointerWorld(e);});
window.addEventListener('pointerup',()=>{mouseDown=false;mouseAim=null;});
$('world').addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('resize',()=>renderer?.resize());
function input(){
  if(qaReplay&&qaDriver)return qaDriver(game);
  const has=a=>actionKeys(a).some(k=>keys.has(k)),edge=a=>actionKeys(a).some(k=>pressed.has(k));
  const pad=controller.consume(bindings);
  const r={move:(has('right')?1:0)-(has('left')?1:0)||pad.move,jump:edge('jump')||pad.jump,bolt:has('bolt')||mouseDown||pad.bolt,blink:edge('blink')||pad.blink,constellation:edge('constellation')||pad.constellation,dragon:edge('dragon')||pad.dragon,interact:edge('interact')||pad.interact};
  if(lastDevice==='controller'&&Math.hypot(controller.aim.x,controller.aim.y)>.1){r.aimX=game.player.x+controller.aim.x*600;r.aimY=game.player.y-68+controller.aim.y*600;}
  if(mouseDown&&mouseAim)Object.assign(r,mouseAim);pressed.clear();return r;
}
function pollController(now){
  let pads=[];try{pads=navigator.getGamepads?.()||[];}catch{controllerError='Controller access is unavailable in this browser. Try opening this local game in Chrome or Edge.';}
  if(qaPadSource){const virtual=qaPadSource.sample();if(virtual!==null)pads=virtual;}
  const change=controller.poll(pads,bindings);
  if(change.active)lastDevice='controller';
  if(change.changed){controlsUI.render();controlsUI.status(controllerError);}
  if(change.disconnected){controlsUI.cancel();controlsUI.status(controllerError);if(lastDevice==='controller'&&mode==='playing'){pause();showToast('Controller disconnected. Reconnect it or continue with the keyboard.');}lastDevice='keyboard';}
  if(controlsUI.poll(now)){controller.clearEdges();return;}
  if(controller.edges.has(9)){pause();controller.clearEdges();return;}
  if(mode==='playing'||!controller.connected)return;
  const screen=$(mode==='memory'?'memory-screen':mode==='bindings'?'bindings-screen':mode==='pause'?'pause-screen':mode==='dead'?'death-screen':mode==='won'?'ending-screen':'title-screen');
  const elements=[...screen.querySelectorAll('button,input,select')].filter(e=>!e.disabled&&e.getClientRects().length);
  if(!elements.length)return;
  let index=elements.indexOf(document.activeElement);
  const direction=controller.down.has(13)||controller.menuY>.5?1:controller.down.has(12)||controller.menuY<-.5?-1:0;
  if(direction&&(direction!==menuDirection||now>menuRepeatAt)){if(index<0)index=direction>0?-1:0;index=(index+direction+elements.length)%elements.length;elements[index].focus();elements[index].scrollIntoView({block:'nearest'});menuRepeatAt=now+(direction!==menuDirection?360:130);}
  menuDirection=direction;
  const horizontal=controller.edges.has(15)?1:controller.edges.has(14)?-1:0;
  let focused=elements[index]||elements[0];
  if(horizontal&&focused.tagName==='SELECT'){focused.selectedIndex=Math.max(0,Math.min(focused.options.length-1,focused.selectedIndex+horizontal));focused.dispatchEvent(new Event('change'));}
  if(horizontal&&focused.type==='range'){focused.value=String(Number(focused.value)+horizontal*Number(focused.step));focused.dispatchEvent(new Event('input'));}
  if(controller.edges.has(1)){if(mode==='memory')closeMemory();else if(mode==='bindings')$('bindings-back').click();else if(mode==='pause')setMode(menuReturn);}
  else if(controller.edges.has(0)){focused.focus();if(focused.tagName==='SELECT'){focused.selectedIndex=(focused.selectedIndex+1)%focused.options.length;focused.dispatchEvent(new Event('change'));}else focused.click();}
  controller.clearEdges();
}
function events(){
  for(const e of game.events){renderer.event(e);audio.event(e);
    if(e.type==='power-rank')showToast(`STAR POWER ${e.rank} · +${e.rank*10}% spell damage`);
    if(e.type==='overdrive')showToast('OVERDRIVE · +35% damage for 8 seconds');
    if(e.type==='toast')showToast(e.text);
    if(e.type==='dialogue')showDialogue(e.text);
    if(e.type==='memory')openMemory(e.index);
    if(e.type==='zone'){$('area-title').querySelector('strong').textContent=zoneNames[e.index];areaUntil=performance.now()+4200;$('area-title').classList.add('visible');}
    if(e.type==='save')save();
    if(e.type==='mantle')showToast('Astral Mantle · the last star shields you');
    if(e.type==='boss'){showDialogue('The Hollow Astronomer. Still guarding a sky that no longer exists.');showToast('Break the guardian’s hold. Call Vaelthryx with R.');}
    if(e.type==='dead'){save();setMode('dead');}
    if(e.type==='won'){$('ending-stats').textContent=`3 / 3 starseals restored · ${game.memories.size} / ${MEMORIES.length} memories found · ${game.arcade.score.toLocaleString()} points · best chain ×${game.arcade.bestCombo} · ${Math.floor(game.elapsed/60)}m ${Math.floor(game.elapsed%60)}s`;setMode('won');}
  }game.events=[];
}
function updateUI(){
  const p=game.player,a=game.arcade;
  $('run-score').textContent=String(a.score).padStart(6,'0');$('combo-label').textContent=a.combo?`×${a.combo} CHAIN · ${a.comboTime.toFixed(1)}s`:'CHAIN KILLS · BUILD YOUR MULTIPLIER';$('combo-fill').style.width=a.comboTime/8*100+'%';
  $('power-rank').textContent=`STAR POWER ${['○','I','II','III'][a.rank]} · +${a.rank*10}%`;$('crystal-count').textContent=`${a.crystals} ${a.crystals===1?'crystal':'crystals'}`;
  $('charge-fill').style.width=(a.overdrive>0?a.overdrive/8:a.charge/9)*100+'%';$('power-hud').classList.toggle('overdrive',a.overdrive>0);
  $('power-description').textContent=a.rank<3?`${[6,15,27][a.rank]-a.crystals} crystals to the next power rank`:'Maximum star power · keep charging Overdrive';
  $('overdrive-label').textContent=a.overdrive>0?`OVERDRIVE · ${a.overdrive.toFixed(1)}s · +35% DAMAGE`:`OVERDRIVE · ${a.charge} / 9`;
  $('health-text').textContent=`${Math.ceil(p.hp)} / 210`;$('health-fill').style.width=`${p.hp/210*100}%`;$('mana-fill').style.width=p.mana+'%';$('mana-text').textContent=Math.floor(p.mana);
  $('memory-count').textContent=`Memories ${game.memories.size} / ${MEMORIES.length}`;
  $('chapter').textContent=SEALS[p.x<2600?0:p.x<5100?1:2].chapter;
  $('seals').textContent=[0,1,2].map(i=>i<game.checkpoint?'◆':'◇').join(' ');
  $('objective').textContent=game.bossDefeated?'Return the ember to the Observatory':game.bossStarted?'Free the Hollow Astronomer':game.checkpoint===0?'Awaken the Silverwood starseal':game.checkpoint===1?'Find the aqueduct starseal':game.checkpoint===2?'Reach the Observatory starseal':'Enter the Observatory';
  const buffs=[`Missing health: +${Math.round(missingHealthBonus(p)*100)}% damage · 2% lifesteal`];if(p.mantle>0)buffs.push(`Astral Mantle ${Math.ceil(p.mantle)}s`);if(p.blinked)buffs.push(`Eventide ${p.rangeStacks} · Reckoning ×${(1+game.chain*.25).toFixed(2)}`);$('buffs').textContent=buffs.join('  /  ');
  const padMode=lastDevice==='controller'&&controller.connected;
  const prompt=a=>padMode?buttonName(bindings.pad[a],controller.standard):keyName(bindings.keys[a]);
  $('game').classList.toggle('controller-active',padMode);
  $('world').setAttribute('aria-label',`Game world. ${padMode?'Left stick':prompt('left')+' and '+prompt('right')} to move, ${prompt('jump')} to jump, ${prompt('bolt')} to cast, ${prompt('blink')} to teleport, ${prompt('interact')} to interact.`);
  const near=game.nearby();$('interaction').hidden=!near||mode!=='playing';if(near)$('interaction').innerHTML=`<kbd>${prompt('interact')}</kbd>${near.label}`;
  if((near&&performance.now()>dialogueUntil-3500)||(game.bossStarted&&!game.bossDefeated))$('dialogue').hidden=true;
  const boss=game.enemies.find(e=>e.type==='boss');$('boss-ui').hidden=!game.bossStarted||game.bossDefeated;$('boss-fill').style.width=Math.max(0,boss.hp/boss.maxHp*100)+'%';
  for(const button of document.querySelectorAll('[data-spell]')){const spell=button.dataset.spell,cd=p.cooldowns[spell],locked=spell==='dragon'&&game.checkpoint<2;button.style.setProperty('--ready',`${(1-cd/COOLDOWNS[spell])*100}%`);button.querySelector('kbd').textContent=prompt(spell);button.title=`${ACTIONS[spell]} · ${prompt(spell)}${spell==='bolt'?' · Hold to cast':''}`;button.querySelector('.cooldown').textContent=locked?'◇':cd>.1?(cd<1?cd.toFixed(1):Math.ceil(cd)):'';button.classList.toggle('unavailable',locked||(spell==='dragon'&&p.mana<60)||(spell==='constellation'&&p.mana<30));}
  const hints=document.querySelectorAll('.bottom-hint span');hints[0].textContent=padMode?`Left stick move · Right stick aim · ${prompt('jump')} double jump`:`${prompt('left')} / ${prompt('right')} move · ${prompt('jump')} jump / double jump`;hints[1].textContent=`${prompt('interact')} interact · ${padMode?'Menu':'ESC'} pause`;
  const help=document.querySelectorAll('.controls kbd');[`${prompt('left')} / ${prompt('right')}`,prompt('jump'),prompt('bolt'),prompt('blink'),prompt('constellation'),prompt('dragon'),prompt('interact')].forEach((v,i)=>{if(help[i])help[i].textContent=padMode&&i===0?'Left stick / D-pad':v;});
  controlsUI.status(controllerError);
  if(qa&&$('qa-state'))$('qa-state').textContent=JSON.stringify({mode,x:Math.round(p.x),y:Math.round(p.y),hp:Math.round(p.hp),score:game.arcade.score,crystals:game.arcade.crystals,power:game.arcade.rank,overdrive:game.arcade.overdrive,drops:game.arcade.drops.length,seals:game.checkpoint,kills:game.kills,elapsed:Math.round(game.elapsed),boss:game.bossStarted,bossHP:Math.round(boss.hp),dragon:!!game.dragon,memories:[...game.memories]});
}
function loop(now){
  const dt=Math.min((now-previous)/1000||0,.05);previous=now;
  pollController(now);
  if(mode==='playing'){
    accumulator+=dt;let first=true;
    while(accumulator>=1/60){const controls=input();if(!first){controls.jump=controls.blink=controls.constellation=controls.dragon=controls.interact=false;}game.update(1/60,controls);events();accumulator-=1/60;first=false;if(mode!=='playing'){accumulator=0;break;}}
    audio.update(game.time);
  }
  if(mode==='title'){game.player.x=renderer.w*.72;game.player.y=580;}
  renderer.draw(game,(mode==='playing'||mode==='title')?dt:0);
  uiTimer+=dt;if(uiTimer>.08){updateUI();uiTimer=0;}
  if(now>toastUntil)$('toast').classList.remove('visible');if(now>dialogueUntil)$('dialogue').hidden=true;if(now>areaUntil)$('area-title').classList.remove('visible');
  requestAnimationFrame(loop);
}
try{
  const art=await loadArt();renderer=new Renderer($('world'),art);renderer.gentle=settings.gentle;renderer.quality=settings.quality;audio.enabled=settings.sound;
  $('begin').disabled=false;$('begin').textContent='Begin the journey  →';$('continue').hidden=!saved||saved.completed;
  game.player.x=renderer.w*.72;renderer.camera=0;
  requestAnimationFrame(loop);
  // Local QA surface is opt-in and absent from the normal player route.
  if(qa){
    qaDriver=(await import('../tests/route-driver.mjs')).routeInput;
    const panel=document.createElement('details');panel.id='qa-panel';panel.open=true;
    panel.innerHTML='<summary>Local QA</summary><button id="qa-replay">Run input-only playthrough</button><button id="qa-stop">Take control</button><button id="qa-resume">Resume saved checkpoint</button><output id="qa-state"></output>';
    $('game').append(panel);
    qaPadSource=(await import('../tests/virtual-gamepad.js')).virtualGamepad(panel);
    for(const m of [...MEMORIES].sort((a,b)=>a.chapter-b.chapter)){const b=document.createElement('button');b.textContent=`Visit memory ${m.chapter}`;b.onclick=()=>{start(false);game.player.x=m.x;game.player.y=m.y;renderer.camera=Math.max(0,m.x-renderer.w*.37);};panel.append(b);}
    const arcadeButton=document.createElement('button');arcadeButton.textContent='Arcade reward demo';arcadeButton.onclick=()=>{start(false);game.player.x=1400;game.player.y=560;renderer.camera=1050;for(const [i,e] of game.enemies.slice(0,3).entries()){e.x=1460+i*22;e.y=560;game.damage(e,1000);}events();};panel.append(arcadeButton);
    $('qa-replay').onclick=()=>{start(false);qaReplay=true;};$('qa-stop').onclick=()=>{qaReplay=false;keys.clear();};$('qa-resume').onclick=()=>start(true);
    window.__lastStar={get game(){return game;},get renderer(){return renderer;},get mode(){return mode;},start,save,parseSave};
  }
}catch(error){$('load-error').hidden=false;$('load-error').textContent='The artwork could not load. Reload this page, or run the game through its local server. '+error.message;console.error(error);}
