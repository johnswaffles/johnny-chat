import {catalog,artURL} from './art.js';
import {PaintingCanvas,previewURL,drawPuzzle,rgb} from './canvas.js';
import {getPainting,listCards,savePainting,allPaintings,readPreferences,writePreferences,deletePainting} from './store.js';
import {validPuzzle} from './engine.js';

const $=id=>document.getElementById(id),icon=id=>`<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const preferences={autoAdvance:true,highlight:true,numbers:true,contrast:false,sound:false,...readPreferences()};
let favorites=new Set(Array.isArray(preferences.favorites)?preferences.favorites:[]),cards=[],view='discover',filter='All pictures',active=null,filled=new Set(),selected=0,history=[],redo=[],saveTimer,saveChain=Promise.resolve(),toastTimer,opening=false,storageOK=true,completedShown=false,dirty=false,saveRevision=0;
const apiBase=String(window.JOHNNY_CHAT_API_BASE_URL||(['localhost','127.0.0.1'].includes(location.hostname)?location.origin:'https://johnny-chat.onrender.com')).replace(/\/+$/,'');
const api=path=>`${apiBase}/api/color-studio${path}`;
let aiAvailable=null;
const paintCanvas=new PaintingCanvas($('painting'),{paint:fillRegion,preferences,onZoom:z=>$('zoom-label').textContent=`${Math.round(z*100)}%`,onFocus:()=>{$('fill-found').hidden=false;}});
document.body.classList.toggle('contrast',!!preferences.contrast);

function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
function persistPreferences(){try{preferences.favorites=[...favorites];writePreferences(preferences);}catch{toast('Browser storage is unavailable. Export a backup to keep your work.');}}
function favorite(id){if(favorites.has(id))favorites.delete(id);else favorites.add(id);persistPreferences();renderGallery();if(active?.id===id)updateFavorite();}
function updateFavorite(){$('paint-favorite').classList.toggle('active',favorites.has(active?.id));$('paint-favorite').setAttribute('aria-label',favorites.has(active?.id)?'Remove favorite':'Favorite this picture');}
async function refreshCards(){try{cards=await listCards();}catch{storageOK=false;toast('Local saving is unavailable in this browser. You can still paint and export a backup.');}renderGallery();}
function setView(next){view=next;filter='All pictures';$('search').value='';document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false');});renderGallery();}
function renderGallery(){
  const studio=view==='studio',fav=view==='favorites';
  $('featured').hidden=studio||fav;
  $('view-title').innerHTML=studio?'Your colors.<br><em>Your quiet corner.</em>':fav?'Keep a little<br><em>inspiration close.</em>':'A little color.<br><em>A little calm.</em>';
  $('view-description').textContent=studio?'Pick up where you left off. Every little space is waiting for you.':fav?'All the pictures you’ve saved for a quieter moment.':'Find a picture you love. Bring it to life, one number at a time.';
  $('collection-title').innerHTML=studio?'A little collection of you<span>.</span>':fav?'The ones that caught your eye<span>.</span>':'Find your next little escape<span>.</span>';
  $('collection-kicker').textContent=studio?'MADE WITH YOUR OWN TWO HANDS':fav?'YOUR PERSONAL INSPIRATION SHELF':'A CANVAS FOR EVERY MOOD';
  const filters=studio?['All pictures','In progress','Completed','My photos','AI creations']:['All pictures','Landscapes','Botanical','Animals','Patterns','My photos','AI creations'];
  $('filters').innerHTML=filters.map(f=>`<button class="filter ${filter===f?'active':''}" aria-pressed="${filter===f}" data-filter="${f}">${f}</button>`).join('');
  const cardMap=new Map(cards.map(c=>[c.id,c]));
  let items=studio?cards.map(c=>({...catalog.find(a=>a.id===c.id),...c})).sort((a,b)=>b.updated-a.updated):[...catalog,...cards.filter(c=>c.custom)];
  if(fav)items=items.filter(a=>favorites.has(a.id));
  const search=$('search').value.toLowerCase().trim();
  items=items.filter(a=>{
    const c=cardMap.get(a.id);
    if(filter==='In progress'&&(!c||c.done===c.total))return false;
    if(filter==='Completed'&&(!c||c.done!==c.total))return false;
    if(filter!=='All pictures'&&!['In progress','Completed'].includes(filter)&&a.category!==filter)return false;
    return !search||`${a.title} ${a.category} ${a.description||''}`.toLowerCase().includes(search);
  });
  $('studio-stats').hidden=!studio;
  if(studio)$('studio-stats').innerHTML=`<div><strong>${cards.length}</strong><span>pictures started</span></div><div><strong>${cards.filter(c=>c.done===c.total).length}</strong><span>little masterpieces</span></div><div><strong>${cards.reduce((s,c)=>s+c.done,0).toLocaleString()}</strong><span>spaces brought to life</span></div>`;
  $('picture-grid').innerHTML=items.map(a=>{
    const c=cardMap.get(a.id),done=c?Math.round(c.done/c.total*100):0;
    // Sources are generated locally or validated during backup import.
    const source=c?.thumbnail||(a.custom?a.thumbnail:artURL(a));
    return `<article class="picture-card"><div class="picture-image"><button data-open="${escapeHTML(a.id)}" aria-label="${c?'Resume':'Color'} ${escapeHTML(a.title)}"><img src="${escapeHTML(source)}" alt="${escapeHTML(a.description||a.title)}" loading="lazy"><span class="image-overlay"><span>${c?'Keep coloring':'Start coloring'} ${icon('arrow')}</span></span></button><button class="favorite-button ${favorites.has(a.id)?'active':''}" data-favorite="${escapeHTML(a.id)}" aria-label="${favorites.has(a.id)?'Unfavorite':'Favorite'} ${escapeHTML(a.title)}" aria-pressed="${favorites.has(a.id)}">${icon('heart')}</button>${c?`<span class="card-progress">${done===100?'✓ Complete':`${done}% · Keep going`}</span>`:''}</div><h3 class="picture-title">${escapeHTML(a.title)}</h3><div class="picture-meta"><span>${escapeHTML(a.category)}</span><span>${c?`${c.total.toLocaleString()} spaces`:a.difficulty||'Your own creation'}</span></div></article>`;
  }).join('');
  $('empty-state').hidden=items.length>0;
  if(!items.length)$('empty-state').innerHTML=`<h3>${search?'Nothing here just yet.':studio?'Your first canvas is waiting.':fav?'A place for your favorites.':'A little room for something new.'}</h3><p>${search?'Try a different word or category.':studio?'Start any picture, and it will be saved here automatically.':fav?'Tap a heart on a picture to keep it here.':'Create a picture from your own photo or imagination.'}</p><button class="outline-button" data-action="${studio||fav?'discover':'upload'}">${studio||fav?'Explore pictures':'Create a picture'} ${icon('arrow')}</button>`;
}

function convert(image,options,onProgress){
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});creator.worker=worker;creator.reject=reject;
    const max=options.resolution||360,scale=max/Math.max(image.naturalWidth||image.width,image.naturalHeight||image.height),c=document.createElement('canvas');
    c.width=Math.max(1,Math.round((image.naturalWidth||image.width)*scale));c.height=Math.max(1,Math.round((image.naturalHeight||image.height)*scale));
    const ctx=c.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(image,0,0,c.width,c.height);const data=ctx.getImageData(0,0,c.width,c.height);
    worker.onmessage=({data})=>{if(data.error){worker.terminate();creator.worker=null;creator.reject=null;reject(new Error(data.error));}else if(data.puzzle){worker.terminate();creator.worker=null;creator.reject=null;resolve(data.puzzle);}else onProgress?.(data.label,data.progress);};
    worker.onerror=()=>{worker.terminate();creator.worker=null;creator.reject=null;reject(new Error('The converter could not finish this picture. Try a lower detail level.'));};
    worker.postMessage({buffer:data.data.buffer,width:c.width,height:c.height,options},[data.data.buffer]);
  });
}
async function loadImage(source){const image=new Image();image.decoding='async';image.src=source;await image.decode();return image;}
async function openPainting(id){
  if(opening)return;opening=true;
  try{
    let record;try{record=await getPainting(id);}catch{storageOK=false;}
    if(!record){const art=catalog.find(a=>a.id===id);if(!art)throw new Error('This picture could not be found.');toast('Laying out your colors…');const image=await loadImage(artURL(art));const puzzle=await convert(image,{colors:24,resolution:420,minArea:24,maxRegions:1500},label=>{$('toast').textContent=label+'…';});record={id:art.id,title:art.title,category:art.category,puzzle,filled:[],custom:false,thumbnail:artURL(art),updated:Date.now()};}
    activatePainting(record);
  }catch(error){toast(error.message);}finally{opening=false;}
}
function activatePainting(record){
  active=record;filled=new Set(record.filled||[]);selected=Math.max(0,Math.min(record.puzzle.palette.length-1,record.selected||0));history=[];redo=[];completedShown=filled.size===record.puzzle.regions.length;
  $('library-view').hidden=true;$('paint-view').hidden=false;document.body.style.overflow='hidden';$('painting-title').textContent=record.title;$('save-status').textContent=storageOK?'Saving on this device…':'Saving unavailable · export a backup';
  paintCanvas.load(record.puzzle,filled);paintCanvas.selected=selected;$('reference-toggle').setAttribute('aria-pressed','false');$('reference-toggle').textContent='Peek at the finished picture';$('canvas-stage').classList.remove('reference');$('fill-found').hidden=true;
  paintCanvas.dragMode=false;$('pan-tool').setAttribute('aria-pressed','false');$('canvas-stage').classList.remove('moving');updateFavorite();updatePainting();queueSave();$('painting').focus({preventScroll:true});clearTimeout(toastTimer);$('toast').hidden=true;
}
function counts(){const totals=new Array(active.puzzle.palette.length).fill(0),remaining=totals.slice();active.puzzle.regions.forEach((r,i)=>{totals[r.color]++;if(!filled.has(i))remaining[r.color]++;});return{totals,remaining};}
function chooseColor(color){if(!active)return;selected=color;paintCanvas.selected=color;paintCanvas.focused=-1;$('fill-found').hidden=true;updatePainting();queueSave();}
function updatePainting(){
  if(!active)return;const {remaining}=counts(),total=active.puzzle.regions.length,percent=Math.round(filled.size/total*100);
  $('progress-percent').innerHTML=`${percent}<span>%</span>`;$('progress-fill').style.width=`${filled.size/total*100}%`;$('progress-count').textContent=`${filled.size.toLocaleString()} of ${total.toLocaleString()} spaces colored`;$('color-count').textContent=`${remaining.length} colors`;
  $('palette-instruction').textContent=remaining[selected]?`Color ${selected+1} · ${remaining[selected]} little spaces waiting`:`Color ${selected+1} is complete. Beautifully done.`;
  const focused=document.activeElement?.dataset.color;
  $('palette').innerHTML=active.puzzle.palette.map((c,i)=>`<button class="color-swatch ${remaining[i]===0?'complete':''}" style="--swatch:${rgb(c)};--text:${c[0]*.299+c[1]*.587+c[2]*.114>148?'#293d38':'#fffdf7'}" data-color="${i}" aria-label="Color ${i+1}, ${remaining[i]} areas remaining" aria-pressed="${selected===i}">${i+1}${remaining[i]?`<span class="swatch-remaining" aria-hidden="true">${remaining[i]}</span>`:''}</button>`).join('');
  if(focused!==undefined)$('palette').querySelector(`[data-color="${focused}"]`)?.focus({preventScroll:true});
  $('undo').disabled=!history.length;$('redo').disabled=!redo.length;$('hint').disabled=filled.size===total||paintCanvas.reference;$('fill-found').disabled=paintCanvas.reference;
  $('painting').setAttribute('aria-label',`${active.title}. ${percent} percent complete. Color ${selected+1} selected. ${remaining[selected]} spaces remaining for this color. Use Find an area, then Fill found area, to paint with the keyboard.`);
  paintCanvas.schedule();
}
let audio;
function playTone(){if(!preferences.sound)return;try{audio ||= new(window.AudioContext||window.webkitAudioContext)();void audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=440+(selected%8)*55;g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.16);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.17);}catch{}}
function fillRegion(id){
  if(!active||paintCanvas.reference||filled.has(id))return;const r=active.puzzle.regions[id];if(!r)return;
  if(r.color!==selected){$('canvas-note').textContent=`This space is color ${r.color+1}. Choose ${r.color+1} in your palette.`;return;}
  filled.add(id);history.push({id,color:selected});redo=[];paintCanvas.focused=-1;$('fill-found').hidden=true;playTone();$('canvas-note').textContent='A little more color. A little more calm.';
  const {remaining}=counts();if(!remaining[selected]&&preferences.autoAdvance){const next=remaining.findIndex((n,i)=>n>0&&i>selected);selected=next>=0?next:Math.max(0,remaining.findIndex(n=>n>0));paintCanvas.selected=selected;requestAnimationFrame(()=>$('palette').querySelector(`[data-color="${selected}"]`)?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'}));}
  updatePainting();queueSave();if(filled.size===active.puzzle.regions.length&&!completedShown){completedShown=true;setTimeout(showCompletion,400);}
}
function undoFill(){const change=history.pop();if(!change)return;filled.delete(change.id);redo.push(change);selected=change.color;paintCanvas.selected=selected;updatePainting();queueSave();}
function redoFill(){const change=redo.pop();if(!change)return;filled.add(change.id);history.push(change);updatePainting();queueSave();}
function hint(){if(!active||paintCanvas.reference)return;let candidates=active.puzzle.regions.map((r,id)=>({...r,id})).filter(r=>!filled.has(r.id)&&r.color===selected);if(!candidates.length){const next=active.puzzle.regions.findIndex((r,id)=>!filled.has(id));if(next<0)return;chooseColor(active.puzzle.regions[next].color);candidates=active.puzzle.regions.map((r,id)=>({...r,id})).filter(r=>!filled.has(r.id)&&r.color===selected);}
  const logical=paintCanvas.logical({x:paintCanvas.w/2,y:paintCanvas.h/2});candidates.sort((a,b)=>Math.hypot(a.x-logical.x,a.y-logical.y)-Math.hypot(b.x-logical.x,b.y-logical.y));paintCanvas.focusRegion(candidates[0].id);$('canvas-note').textContent=`Here’s a space for color ${selected+1}. Tap it, or choose Fill found area.`;
}
function queueSave(){clearTimeout(saveTimer);if(!active)return;dirty=true;saveRevision++;$('save-status').textContent='Saving…';saveTimer=setTimeout(()=>void saveNow(),350);}
async function saveNow(){
  clearTimeout(saveTimer);if(!active)return;
  const revision=saveRevision,record={...active,filled:[...filled],selected,updated:Date.now()};
  record.thumbnail=previewURL(record.puzzle,filled,false,260);active=record;
  saveChain=saveChain.catch(()=>{}).then(()=>savePainting(record));
  try{await saveChain;storageOK=true;if(active?.id===record.id&&revision===saveRevision){dirty=false;$('save-status').textContent='✓ Saved on this device';}const c={id:record.id,title:record.title,category:record.category,custom:record.custom,thumbnail:record.thumbnail,updated:record.updated,total:record.puzzle.regions.length,done:record.filled.length};cards=[...cards.filter(a=>a.id!==record.id),c];}
  catch{storageOK=false;$('save-status').textContent='Saving unavailable · export a backup';toast('Your browser could not save this painting. Export a backup before leaving.');}
}
async function returnToLibrary(){await saveNow();$('paint-view').hidden=true;$('library-view').hidden=false;document.body.style.overflow='';renderGallery();}
function utility(title,html){$('utility-title').textContent=title;$('utility-content').innerHTML=html;if(!$('utility-dialog').open)$('utility-dialog').showModal();}
function help(){utility('One color at a time.',`<p>Welcome to your own little corner of calm.</p><ol class="help-steps"><li>Choose a picture, upload a photo, or create something with AI.</li><li>Pick a numbered color. Its spaces are gently highlighted.</li><li>Tap a matching space to fill it. There’s no penalty for a missed tap.</li><li>Pinch with two fingers to zoom up to 40×. Move with two fingers, or turn on the hand tool.</li><li>Use <strong>Find an area</strong> for tiny spaces. Keyboard players can then press Enter or choose <strong>Fill found area</strong>.</li></ol><p><strong>Keyboard:</strong> H finds an area, +/− zoom, 0 fits the canvas, Ctrl/⌘ Z undoes, and Shift Ctrl/⌘ Z redoes.</p><h3>Keep your quiet corner close.</h3><p>On iPad, open this page in Safari, tap Share, then Add to Home Screen. Open the studio online once to make the gallery and local photo converter available offline. AI creation needs an internet connection.</p><p class="backup-note">Progress and personal pictures stay in this browser on this device. Export a studio backup to move them to another device or keep a safe copy.</p><button class="outline-button" data-action="backup">Back up my studio ${icon('download')}</button>`);}
function settings(){utility('Make yourself comfortable.',[
  ['autoAdvance','Keep the colors flowing','Move to the next color when one is finished.'],['highlight','A gentle guide','Highlight spaces matching the selected color.'],['numbers','Show the numbers','Numbers appear as you zoom into smaller spaces.'],['contrast','A little more contrast','Darker outlines and more readable labels.'],['sound','A soft note','A quiet sound for every space you color.']
].map(([key,title,note])=>`<label class="setting-row"><span>${title}<small>${note}</small></span><input type="checkbox" data-setting="${key}" ${preferences[key]?'checked':''}></label>`).join('')+`<p>Your changes save automatically on this device.</p><button class="outline-button" data-action="help">How to play</button><button class="text-button danger-button" data-action="restart">Start this picture over</button>${active?.custom?'<br><button class="text-button danger-button" data-action="delete">Delete this personal picture</button>':''}`);}
function showCompletion(){if(!active||filled.size!==active.puzzle.regions.length)return;utility('You made something beautiful.',`<div class="completion-art">✳</div><div class="completion-copy"><h3>${escapeHTML(active.title)}</h3><p>${active.puzzle.regions.length.toLocaleString()} little spaces. One lovely picture.<br>Take a moment. This one’s yours.</p></div><button class="primary" data-action="download-finished">Save my finished picture ${icon('download')}</button><button class="outline-button" data-action="export">More ways to keep it</button><button class="outline-button" data-action="library">Find another little escape ${icon('arrow')}</button>`);}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
const filename=()=>active?.title.replace(/[^a-z0-9]+/gi,'-').toLowerCase()||'my-painting';
function exportPNG(finished=false){if(!active)return;const c=document.createElement('canvas'),s=2400/Math.max(active.puzzle.width,active.puzzle.height);c.width=Math.round(active.puzzle.width*s);c.height=Math.round(active.puzzle.height*s);const ctx=c.getContext('2d');ctx.scale(s,s);drawPuzzle(ctx,active.puzzle,filled,{scale:s,numbers:!finished,reference:finished});c.toBlob(blob=>{if(blob)download(blob,`${filename()}${finished?'-finished':''}.png`);else toast('Your browser could not export this picture.');},'image/png');}
function exportPrintable(){
  if(!active)return;const p=active.puzzle,w=p.width,h=p.height,cols=6,legendH=Math.ceil(p.palette.length/cols)*29+70;
  const paths=p.regions.map(r=>`<path d="${r.paths.map(loop=>'M'+loop.map(v=>v.join(' ')).join('L')+'Z').join('')}" fill="#fff" fill-rule="evenodd" stroke="#687461" stroke-width=".45"/>`).join('');
  const numbers=p.regions.map(r=>`<text x="${r.x}" y="${r.y}" font-size="${Math.max(1.8,Math.min(6,r.radius*1.25))}" text-anchor="middle" dominant-baseline="central" fill="#4a5844">${r.color+1}</text>`).join('');
  const legend=p.palette.map((c,i)=>{const x=(i%cols)*(w/cols),y=h+65+Math.floor(i/cols)*29;return `<rect x="${x+4}" y="${y-12}" width="17" height="17" rx="3" fill="${rgb(c)}" stroke="#98a38f" stroke-width=".5"/><text x="${x+27}" y="${y}" font-size="9">${i+1}</text><text x="${x+43}" y="${y}" font-size="5.5" fill="#687461">#${c.map(v=>v.toString(16).padStart(2,'0')).join('')}</text>`;}).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w*3}" height="${(h+legendH)*3}" viewBox="0 0 ${w} ${h+legendH}" font-family="Arial,sans-serif"><rect width="100%" height="100%" fill="white"/>${paths}${numbers}<text x="4" y="${h+25}" font-size="13" fill="#293d38">${escapeHTML(active.title)}</text><text x="4" y="${h+42}" font-size="7" fill="#687461">Color Studio by Johnny · Match each number to its color below</text>${legend}</svg>`;
  download(new Blob([svg],{type:'image/svg+xml'}),`${filename()}-printable.svg`);toast('Printable SVG saved. Open it in a browser to print.');
}
function exportMenu(){if(!active)return;utility('Keep a little color.',`<p>Save what you’ve made, or take a numbered canvas to paper.</p><button class="outline-button" data-action="download-current">Current painting · PNG ${icon('download')}</button><button class="outline-button" data-action="download-finished">Finished color reference · PNG ${icon('download')}</button><button class="outline-button" data-action="printable">Numbered canvas + palette · printable SVG ${icon('download')}</button><button class="outline-button" data-action="painting-backup">This painting + progress · backup ${icon('download')}</button><p>PNG exports are 2,400 pixels on the longest side. Printable SVG includes every numbered region and a color key.</p><button class="text-button" data-action="backup">Back up or restore the whole studio</button>`);}
function backupMenu(){utility('Your colors, safe and sound.',`<p>Browser storage belongs to this device. A backup carries your photos, paintings, favorites, and progress to another browser or iPad.</p><button class="primary" data-action="studio-backup">Download studio backup ${icon('download')}</button><button class="outline-button" data-action="restore">Restore a backup ${icon('plus')}</button><p>Restoring adds new paintings. For matching pictures, your existing progress is kept and combined with the backup.</p>`);}
async function exportBackup(single=false){
  try{await saveNow();const paintings=single&&active?[{...active,filled:[...filled]}]:await allPaintings();download(new Blob([JSON.stringify({format:'johnny-color-studio',version:1,created:new Date().toISOString(),paintings,preferences:{...preferences,favorites:[...favorites]}})],{type:'application/json'}),single?`${filename()}-backup.json`:'color-studio-backup.json');toast('Backup saved. Keep it somewhere you can find it again.');}catch{if(active){download(new Blob([JSON.stringify({format:'johnny-color-studio',version:1,paintings:[{...active,filled:[...filled]}]})],{type:'application/json'}),`${filename()}-backup.json`);toast('Local storage is unavailable. Your current painting was exported.');}else toast('Could not read studio storage. Please try again.');}
}
async function restoreBackup(file){
  if(!file)return;try{
    if(file.size>100*1024*1024)throw new Error('Please choose a studio backup smaller than 100 MB.');
    const data=JSON.parse(await file.text());if(data.format!=='johnny-color-studio'||data.version!==1||!Array.isArray(data.paintings)||data.paintings.length>100)throw new Error('This file is not a supported Color Studio backup.');
    for(const r of data.paintings){if(!r||typeof r.id!=='string'||r.id.length>100||typeof r.title!=='string'||r.title.length>160||!validPuzzle(r.puzzle)||!Array.isArray(r.filled)||r.filled.some(id=>!Number.isInteger(id)||id<0||id>=r.puzzle.regions.length))throw new Error('The backup contains a painting that cannot be read.');}
    await saveNow();
    for(const r of data.paintings){const existing=await getPainting(r.id),conflict=existing&&JSON.stringify(existing.puzzle)!==JSON.stringify(r.puzzle),id=conflict?`custom-${crypto.randomUUID()}`:r.id;const merged={id,puzzle:r.puzzle,custom:conflict||!catalog.some(a=>a.id===id),title:r.title,category:r.category==='AI creations'?'AI creations':catalog.find(a=>a.id===id)?.category||'My photos',filled:[...new Set([...(conflict?[]:existing?.filled||[]),...r.filled])],selected:0,updated:Date.now()};merged.thumbnail=previewURL(merged.puzzle,new Set(merged.filled),false,260);await savePainting(merged);}
    if(Array.isArray(data.preferences?.favorites))for(const id of data.preferences.favorites)if(typeof id==='string')favorites.add(id);persistPreferences();await refreshCards();
    if(active){const restored=await getPainting(active.id);if(restored)activatePainting(restored);}
    $('utility-dialog').close();setView('studio');toast(`${data.paintings.length} painting${data.paintings.length===1?'':'s'} restored. Welcome back.`);
  }catch(error){toast(error.message||'This backup could not be restored.');}finally{$('backup-input').value='';}
}

// Picture creator: AI image preparation and local numbered-region conversion.
const creator={mode:'photo',photo:null,photoURL:null,generated:null,puzzle:null,busy:false,worker:null,reject:null,job:null,token:0,controller:null};
function creatorMode(mode){if(creator.busy)return;creator.mode=mode;creator.generated=null;invalidatePreview();document.querySelectorAll('[data-create-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.createMode===mode)));$('prompt-field').hidden=mode!=='ai';$('photo-title-field').hidden=mode==='ai';$('ai-restyle-field').hidden=mode==='ai';$('style-field').hidden=mode==='photo'&&!$('ai-restyle').checked;$('drop-zone').hidden=mode==='ai'||!!creator.photo;$('preview-wrap').hidden=mode==='ai'||!creator.photo;$('ai-empty').hidden=mode!=='ai';if(creator.photo&&mode==='photo')$('source-preview').src=creator.photoURL;updateCreator();}
function openCreator(mode='photo'){if(opening)return;creatorMode(mode);if(!$('create-dialog').open)$('create-dialog').showModal();if(mode==='ai')setTimeout(()=>$('ai-prompt').focus(),100);}
function invalidatePreview(){creator.puzzle=null;$('preview-ready').hidden=true;$('conversion-preview').hidden=true;$('source-preview').hidden=false;$('show-original').setAttribute('aria-pressed','true');$('show-converted').setAttribute('aria-pressed','false');}
function updateCreator(){const ai=creator.mode==='ai'||$('ai-restyle').checked;const can=creator.mode==='photo'?!!creator.photo:!!$('ai-prompt').value.trim();$('create-painting').disabled=creator.busy||!can;$('color-output').textContent=`${$('color-range').value} colors`;$('style-field').hidden=!ai;$('creation-privacy').textContent=ai?'AI creation sends your description and selected photo to OpenAI to make the artwork. Your painting then saves on this device. This can take a few minutes.':'Direct conversion happens on your device. Your photo stays here.';$('create-painting').querySelector('span').textContent=creator.busy?'Making a little magic…':creator.generated?'Update painting preview':ai?'Create my artwork':'Prepare my picture';}
function creatorBusy(value){creator.busy=value;$('cancel-creation').hidden=!value;for(const id of ['photo-input','ai-prompt','photo-title','color-range','detail-level','ai-restyle','ai-style','replace-photo'])$(id).disabled=value;document.querySelectorAll('[data-create-mode]').forEach(b=>b.disabled=value);updateCreator();}
function creationStatus(label,progress){$('creation-status').hidden=false;$('creation-status-label').textContent=label;$('creation-progress').value=progress;}
async function choosePhoto(file){
  if(!file||creator.busy)return;try{
    if(file.size>20*1024*1024)throw new Error('Please choose a photo smaller than 20 MB.');
    const url=URL.createObjectURL(file);let image;try{image=await loadImage(url);}finally{URL.revokeObjectURL(url);}
    if(image.naturalWidth*image.naturalHeight>60e6)throw new Error('This photo is very large. Please choose a smaller copy.');
    const c=document.createElement('canvas'),s=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));c.width=Math.round(image.naturalWidth*s);c.height=Math.round(image.naturalHeight*s);const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(image,0,0,c.width,c.height);creator.photoURL=c.toDataURL('image/jpeg',.93);creator.photo=await loadImage(creator.photoURL);creator.generated=null;
    $('source-preview').src=creator.photoURL;$('photo-title').value=file.name.replace(/\.[^.]+$/,'').replace(/[_-]/g,' ').slice(0,80);$('drop-zone').hidden=true;$('preview-wrap').hidden=false;invalidatePreview();updateCreator();
  }catch(error){toast(error.message?.includes('decode')?'This browser could not open that photo. Try a JPEG, PNG, or WebP copy.':error.message);}
}
const detailOptions={relaxed:{resolution:240,minArea:75,maxRegions:350},balanced:{resolution:340,minArea:40,maxRegions:900},detailed:{resolution:440,minArea:23,maxRegions:1500},intricate:{resolution:540,minArea:16,maxRegions:2200}};
async function apiJSON(path,options={}){const response=await fetch(api(path),{...options,cache:'no-store'});let data;try{data=await response.json();}catch{throw new Error('The AI studio could not be reached. Please try again.');}if(!response.ok)throw new Error(data.detail||'The AI studio could not finish this request.');return data;}
async function aiArtwork(token){
  if(aiAvailable===false)throw new Error('AI artwork is not configured yet. Direct photo conversion is ready to use.');
  const data=new FormData();data.set('prompt',creator.mode==='ai'?$('ai-prompt').value.trim():'Make a faithful illustrated painting from this photograph.');data.set('style',$('ai-style').value);data.set('colors',$('color-range').value);data.set('detail',$('detail-level').value);
  if(creator.mode==='photo')data.set('image',await(await fetch(creator.photoURL)).blob(),'reference.jpg');
  creator.controller=new AbortController();const {id}=await apiJSON('/jobs',{method:'POST',body:data,signal:creator.controller.signal});creator.job=id;
  const deadline=Date.now()+10*60e3;
  while(token===creator.token){
    const job=await apiJSON(`/jobs/${encodeURIComponent(id)}`,{signal:creator.controller.signal});creationStatus(job.label,Math.min(.7,(job.progress||.1)*.7));
    if(job.status==='failed')throw new Error(job.label);
    if(job.status==='complete'){creator.generated=await loadImage(job.image);creator.generatedTitle=job.title;creator.generatedURL=job.image;creator.job=null;return creator.generated;}
    if(Date.now()>deadline)throw new Error('This creation took too long. Please try again.');
    await new Promise(resolve=>setTimeout(resolve,2500));
  }throw new Error('Creation canceled.');
}
async function preparePicture(){
  if(creator.busy)return;const token=++creator.token;creatorBusy(true);invalidatePreview();creationStatus('Getting your canvas ready',.03);
  try{
    const useAI=creator.mode==='ai'||$('ai-restyle').checked;
    const image=useAI?(creator.generated||await aiArtwork(token)):creator.photo;
    if(token!==creator.token)return;
    if(useAI){$('source-preview').src=creator.generatedURL;$('ai-empty').hidden=true;$('drop-zone').hidden=true;$('preview-wrap').hidden=false;}
    creator.puzzle=await convert(image,{...detailOptions[$('detail-level').value],colors:Number($('color-range').value)},(label,p)=>creationStatus(label,(useAI?.7:0)+p*(useAI?.3:1)));
    if(token!==creator.token)return;
    const p=creator.puzzle,c=$('conversion-preview'),scale=440/Math.max(p.width,p.height);c.width=Math.round(p.width*scale);c.height=Math.round(p.height*scale);const ctx=c.getContext('2d');ctx.scale(scale,scale);drawPuzzle(ctx,p,new Set(),{scale,numbers:false,reference:true});showConverted();
    $('preview-ready').hidden=false;$('preview-summary').textContent=`${p.palette.length} colors · ${p.regions.length.toLocaleString()} spaces · Your own creation`;
    creationStatus('Your picture is ready',1);$('preview-ready').scrollIntoView({block:'nearest',behavior:'smooth'});
  }catch(error){if(token===creator.token){creationStatus(error.name==='AbortError'?'Creation canceled.':error.message,0);if(creator.job)void fetch(api(`/jobs/${creator.job}`),{method:'DELETE'}).catch(()=>{});creator.job=null;}}
  finally{if(token===creator.token)creatorBusy(false);}
}
function showConverted(){$('conversion-preview').hidden=!creator.puzzle;$('source-preview').hidden=!!creator.puzzle;$('show-original').setAttribute('aria-pressed','false');$('show-converted').setAttribute('aria-pressed','true');}
function cancelCreation(){creator.token++;creator.controller?.abort();creator.worker?.terminate();creator.worker=null;creator.reject?.(new Error('Creation canceled.'));creator.reject=null;if(creator.job)void fetch(api(`/jobs/${creator.job}`),{method:'DELETE'}).catch(()=>{});creator.job=null;creatorBusy(false);$('creation-status').hidden=true;}
function startCustom(){if(!creator.puzzle)return;const ai=creator.mode==='ai'||$('ai-restyle').checked;const record={id:`custom-${crypto.randomUUID()}`,title:(ai?creator.generatedTitle:$('photo-title').value.trim())||'My little masterpiece',category:ai?'AI creations':'My photos',custom:true,puzzle:creator.puzzle,filled:[],selected:0,updated:Date.now(),thumbnail:previewURL(creator.puzzle,new Set(),true,300)};$('create-dialog').close();activatePainting(record);creator.puzzle=null;$('preview-ready').hidden=true;}

// UI event delegation keeps all gallery and dialog actions usable after updates.
document.addEventListener('click',async e=>{
  const button=e.target.closest('button');if(!button)return;
  if(button.dataset.view){setView(button.dataset.view);return;}
  if(button.dataset.filter){filter=button.dataset.filter;renderGallery();return;}
  if(button.dataset.open){void openPainting(button.dataset.open);return;}
  if(button.dataset.favorite){favorite(button.dataset.favorite);return;}
  if(button.dataset.color!==undefined){chooseColor(Number(button.dataset.color));return;}
  if(button.dataset.createMode){creatorMode(button.dataset.createMode);return;}
  const action=button.dataset.action;if(!action)return;
  switch(action){
    case 'upload':openCreator('photo');break;case 'ai':openCreator('ai');break;case 'help':help();break;case 'settings':settings();break;case 'export':exportMenu();break;case 'backup':backupMenu();break;
    case 'discover':setView('discover');break;case 'download-current':exportPNG(false);break;case 'download-finished':exportPNG(true);break;case 'printable':exportPrintable();break;case 'painting-backup':void exportBackup(true);break;case 'studio-backup':void exportBackup();break;case 'restore':$('backup-input').click();break;
    case 'library':$('utility-dialog').close();void returnToLibrary();break;
    case 'restart':utility('A fresh beginning?',`<p>Your current progress for this picture will be cleared. Export a backup first if you would like to keep it.</p><button class="primary" data-action="confirm-restart">Start over</button><button class="outline-button" data-action="settings">Keep my progress</button>`);break;
    case 'confirm-restart':filled.clear();history=[];redo=[];completedShown=false;paintCanvas.focused=-1;updatePainting();queueSave();$('utility-dialog').close();break;
    case 'delete':utility('Let this picture go?',`<p>This removes the personal picture and its progress from this browser. You can export a backup before deleting it.</p><button class="primary" data-action="confirm-delete">Delete this picture</button><button class="outline-button" data-action="settings">Keep this picture</button>`);break;
    case 'confirm-delete':if(active?.custom){clearTimeout(saveTimer);await saveChain.catch(()=>{});await deletePainting(active.id);favorites.delete(active.id);persistPreferences();active=null;$('utility-dialog').close();$('paint-view').hidden=true;$('library-view').hidden=false;document.body.style.overflow='';await refreshCards();setView('studio');toast('Picture removed from this studio.');}break;
  }
});
document.addEventListener('change',e=>{const key=e.target.dataset.setting;if(key){preferences[key]=e.target.checked;persistPreferences();document.body.classList.toggle('contrast',!!preferences.contrast);paintCanvas.schedule();}});
$('search').addEventListener('input',renderGallery);
$('featured-start').onclick=()=>void openPainting('alpine');$('feature-art').src=artURL(catalog[0]);
$('back-library').onclick=()=>void returnToLibrary();$('paint-favorite').onclick=()=>favorite(active.id);
$('zoom-in').onclick=()=>paintCanvas.zoomAt(paintCanvas.zoom*1.5);$('zoom-out').onclick=()=>paintCanvas.zoomAt(paintCanvas.zoom/1.5);$('zoom-fit').onclick=()=>paintCanvas.fit();
$('pan-tool').onclick=()=>{paintCanvas.dragMode=!paintCanvas.dragMode;$('pan-tool').setAttribute('aria-pressed',String(paintCanvas.dragMode));$('canvas-stage').classList.toggle('moving',paintCanvas.dragMode);};
$('undo').onclick=undoFill;$('redo').onclick=redoFill;$('hint').onclick=hint;$('fill-found').onclick=()=>{if(paintCanvas.focused>=0)fillRegion(paintCanvas.focused);};
$('reference-toggle').onclick=()=>{paintCanvas.reference=!paintCanvas.reference;$('reference-toggle').setAttribute('aria-pressed',String(paintCanvas.reference));$('reference-toggle').textContent=paintCanvas.reference?'Back to my painting':'Peek at the finished picture';$('canvas-stage').classList.toggle('reference',paintCanvas.reference);updatePainting();};
$('close-utility').onclick=()=>$('utility-dialog').close();$('close-create').onclick=()=>{cancelCreation();$('create-dialog').close();};$('create-dialog').addEventListener('cancel',cancelCreation);
$('photo-input').onchange=e=>void choosePhoto(e.target.files[0]);$('replace-photo').onclick=()=>$('photo-input').click();
for(const event of ['dragenter','dragover'])$('drop-zone').addEventListener(event,e=>{e.preventDefault();$('drop-zone').classList.add('dragging');});
$('drop-zone').addEventListener('dragleave',()=>$('drop-zone').classList.remove('dragging'));$('drop-zone').addEventListener('drop',e=>{e.preventDefault();$('drop-zone').classList.remove('dragging');void choosePhoto(e.dataTransfer.files[0]);});
for(const id of ['color-range','detail-level'])$(id).addEventListener('input',()=>{invalidatePreview();updateCreator();});
for(const id of ['ai-style','ai-prompt','ai-restyle'])$(id).addEventListener('input',()=>{creator.generated=null;invalidatePreview();updateCreator();});
$('create-painting').onclick=()=>void preparePicture();$('cancel-creation').onclick=cancelCreation;$('start-custom').onclick=startCustom;$('show-converted').onclick=showConverted;$('show-original').onclick=()=>{$('source-preview').hidden=false;$('conversion-preview').hidden=true;$('show-original').setAttribute('aria-pressed','true');$('show-converted').setAttribute('aria-pressed','false');};
$('backup-input').onchange=e=>void restoreBackup(e.target.files[0]);
document.addEventListener('keydown',e=>{if($('paint-view').hidden||$('utility-dialog').open||$('create-dialog').open||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redoFill();else undoFill();}if(e.key.toLowerCase()==='h'){e.preventDefault();hint();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)void saveNow();});
window.addEventListener('beforeunload',e=>{if(active&&(!storageOK||dirty)){e.preventDefault();e.returnValue='';}});
void refreshCards();
void apiJSON('/config').then(config=>{aiAvailable=!!config.enabled;}).catch(()=>{aiAvailable=null;});
if('serviceWorker'in navigator)window.addEventListener('load',()=>{void navigator.serviceWorker.register('./sw.js').catch(()=>{});});
