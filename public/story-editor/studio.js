import {comparePassages} from './review-model.mjs?v=20261026-comfort1';
import {initReadingComfort} from './reading-comfort.mjs?v=20261026-comfort1';
import {renderChapterTree} from './chapter-tree.mjs?v=20261025-tree1';
import {NarrationBuffer} from './narration-buffer.mjs?v=20261025-realtime1';
import {NARRATION_PRESETS,narrationOptions,narrationSignature} from './narration-model.mjs?v=20261025-realtime1';
import {editorialQualityLabel} from './quality-label.mjs?v=20261024-sol-pro-xhigh1';
import {renderRevisionTracker} from './revision-tracker.mjs?v=20261025-tracker-reader1';
import {notebookJourney,notebookReference} from './notebook-model.mjs?v=20261024-background1';
import {speechParts} from './reader-model.mjs?v=20261025-paragraph1';
import {chapterAudio} from './reader-speech.mjs?v=20261025-realtime1';
import {StudioVoice} from './studio-voice.mjs?v=20261021-journey3';
const $=id=>document.getElementById(id);
const origin=String(window.JOHNNY_CHAT_API_BASE_URL||location.origin).replace(/\/+$/,'');
const state={id:'',data:null,sectionId:'',original:false,epoch:0,audioEpoch:0,reading:false,readPhase:'idle',audioFlight:'',task:null,polling:false,lastTask:null,resume:null,audioUrl:'',loadedAudio:null,scope:'book',requestMode:'discuss',manualSaving:false,requestStarting:false,flowJob:null,walkthrough:false,proposal:null,ignoredProposal:'',proposalApplying:false,connection:'connected',authRequired:false,authEpoch:0,accessChecking:false,bookSaving:false,bookOpen:false,bookCreating:false,savedChapter:null};
const treeOpen=new Map();
const readingComfort=initReadingComfort($);
const audio=$('studio-audio');let speechController,taskController,contextController,voiceStarting=false,lastBookmark=0;
const phaseLabels={reading:'Reading the current manuscript and rebuilding only changed continuity notes…',queued:'Waiting for the editor…',planning:'Understanding your intent and the scene’s place in the story…',drafting:'Writing the passage with character, voice, and emotional depth…',reviewing:'Independently checking depth, continuity, subtext, and what changed…',refining:'Refining the prose against the critique before saving…'};
const status=text=>$('studio-status').textContent=text;
function auth(){const cookie=document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('gpt54_session='));return cookie?{Authorization:`Bearer ${decodeURIComponent(cookie.slice(14))}`}:{ };}
const base=(id=state.id)=>`${origin}/api/story-editor/projects/${encodeURIComponent(id)}/studio`;
const accessError=()=>Object.assign(new Error('Your private session needs unlocking. Use Unlock again; your saved draft and unsent text stay safe.'),{code:'AUTH_REQUIRED',status:401});
async function api(path='',{method='GET',body,signal,id=state.id,allowLocked=false}={}){
 if(state.authRequired&&!allowLocked)throw accessError();const authEpoch=state.authEpoch,workspaceEpoch=state.epoch;
 const response=await fetch(base(id)+path,{method,headers:{...auth(),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),keepalive:path==='/bookmark',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});
 if(response.status===401){if(authEpoch===state.authEpoch&&workspaceEpoch===state.epoch&&id===state.id)requireUnlock();throw accessError();}
 const data=await response.json().catch(()=>({error:'The studio returned an unreadable response. Your saved draft is safe; refresh to reconnect.'}));
 if(!response.ok)throw Error(data.error||data.detail||'The studio could not connect. Refresh to try again.');return data;
}
const chapters=()=>state.data?.chapters||[];
const allPassages=()=>chapters().flatMap(c=>c.passages);
const passage=()=>allPassages().find(p=>p.id===state.sectionId);
const chapter=()=>chapters().find(c=>c.passages.some(p=>p.id===state.sectionId));
function saveBookmark(){
 const p=passage();if(!p||!state.id||state.original||state.authRequired)return;
 const position=state.loadedAudio?.sectionId===p.id&&state.loadedAudio.revision===p.revision?{...state.loadedAudio,seconds:audio.currentTime||0}:state.resume||{sectionId:p.id,revision:p.revision,part:0,seconds:0};
 if(!position||position.sectionId!==p.id||position.revision!==p.revision)return;
 position.narration=state.readSettings||readingSettings();state.resume={...position};const id=state.id,ticket=state.epoch;void api('/bookmark',{method:'PUT',body:position}).then(()=>{if(id===state.id&&ticket===state.epoch)$('studio-bookmark-warning').hidden=true;}).catch(error=>{if(id!==state.id||ticket!==state.epoch||error.code==='AUTH_REQUIRED')return;$('studio-bookmark-warning').textContent='Your listening position has not synced. Your saved manuscript is safe; keep this tab open. It will retry while you listen.';$('studio-bookmark-warning').hidden=false;});
}
const narrationBuffer=new NarrationBuffer(async(target,signal)=>{const ticket=state.epoch,authTicket=state.authEpoch;try{return await chapterAudio(base(target.id)+'/speech',{sectionId:target.sectionId,part:target.part,revision:target.revision,narration:target.settings,headers:{...auth(),'Content-Type':'application/json'},signal,onPending:()=>{if(state.reading&&state.sectionId===target.sectionId)status('Preparing a short part of your saved passage…');}});}catch(error){if(error.code==='AUTH_REQUIRED'&&ticket===state.epoch&&authTicket===state.authEpoch&&target.id===state.id)requireUnlock();throw error;}});

function changeReadingSettings(){pause('Reading style changed. Press Read to hear it from this passage; your manuscript is unchanged.');state.resume=null;state.readSettings=null;}
function readingSettings(){return narrationOptions({voice:$('studio-narration-voice').value||'marin',direction:$('studio-narration-direction').value||NARRATION_PRESETS.natural});}
function audioTarget(p,part){const settings=state.readSettings||readingSettings();return {id:state.id,sectionId:p.id,revision:p.revision,part,settings,key:JSON.stringify([state.id,p.id,p.revision,part,settings])};}
function nextAudioTarget(p,part){if(part+1<speechParts(p.text).length)return audioTarget(p,part+1);const all=allPassages(),next=all[all.findIndex(item=>item.id===p.id)+1];return next?audioTarget(next,0):null;}
function pauseReading(){
 if(state.readPhase==='paused'){void run(()=>read());return;}
 if(!state.reading)return;
 saveBookmark();state.reading=false;state.readPhase='paused';audio.pause();voice.interrupt();renderControls();status('Paused. Resume keeps this audio and your place; no further parts are requested while paused.');
}
async function resumeReading(){
 if(state.readPhase!=='paused'||state.authRequired)return;
 const ticket=state.audioEpoch,projectTicket=state.epoch;state.reading=true;state.readPhase=state.loadedAudio?'playing':'preparing';renderControls();
 if(state.loadedAudio){try{await audio.play();}catch(error){if(ticket!==state.audioEpoch||projectTicket!==state.epoch||!state.reading)return;if(error.name==='NotAllowedError'){state.readPhase='ready';renderControls();status('Your audio is still ready. Use Play in the audio controls to resume.');}else pause('Playback could not resume. Press Read to try again.');}}
 // A pending current part will load and play when it completes; never submit twice.
}
function pause(message='Paused here. Tell Johnny what you want to explore or change.',interrupt=true){
 saveBookmark();narrationBuffer.clear();state.reading=false;state.readPhase='idle';state.audioFlight='';state.audioEpoch++;speechController?.abort();speechController=null;resetAudio();if(interrupt)voice.interrupt();renderControls();if(message)status(message);
}
function resetAudio(){audio.pause();audio.removeAttribute('src');audio.load();audio.hidden=true;if(state.audioUrl)URL.revokeObjectURL(state.audioUrl);state.audioUrl='';state.loadedAudio=null;}
function renderConversation(){
 const container=$('studio-messages');container.replaceChildren();
 if(!state.data?.messages.length){const p=document.createElement('p');p.className='studio-empty';p.textContent='Tell me what you see in your mind. We can explore it before we change a word.';container.append(p);}
 for(const message of state.data?.messages||[]){const div=document.createElement('div');div.className='studio-message';div.dataset.role=message.role;const label=document.createElement('strong');label.textContent=message.role==='user'?'You':'Johnny';const text=document.createElement('span');appendReferencedText(text,message.text,message.role==='assistant');div.append(label,text);container.append(div);}container.scrollTop=container.scrollHeight;
}
function appendReferencedText(container,text,linkable){
 let offset=0;const pattern=/\[Chapter (\d+), passage (\d+)\]/g;
 for(const match of text.matchAll(pattern)){const target=linkable?notebookReference(chapters(),Number(match[1]),Number(match[2])):null;if(!target)continue;const before=document.createElement('span');before.textContent=text.slice(offset,match.index);const button=document.createElement('button');button.type='button';button.className='source-reference';button.textContent=match[0];button.addEventListener('click',()=>{selectSection(target);setNotebookView('draft');});container.append(before,button);offset=match.index+match[0].length;}
 const tail=document.createElement('span');tail.textContent=text.slice(offset);container.append(tail);
}
function setNotebookView(view){$('book-reader').dataset.view=view;$('notebook-chat-tab').setAttribute('aria-pressed',String(view==='chat'));$('notebook-draft-tab').setAttribute('aria-pressed',String(view==='draft'));}
function dismissProposal(){if(state.proposal){state.ignoredProposal=state.proposal.id;try{window.localStorage?.setItem('johnny-notebook-dismissed-'+state.id,state.ignoredProposal);}catch{}}state.proposal=null;state.proposalApplying=false;renderNotebook();}
function renderEditorialProgress(){
 const key=state.flowJob?.id||null;if(state.progressJobId!==key){state.progressJobId=key;state.progressExpanded=false;}
 const view=renderRevisionTracker($,{job:state.flowJob,connection:state.authRequired?'auth':state.connection}),completed=view.state==='complete';
 $('notebook-progress-toggle').hidden=!completed;$('notebook-progress-toggle').setAttribute('aria-expanded',String(!!state.progressExpanded));
 $('notebook-progress-toggle').textContent=state.progressExpanded?'Hide revision details':'Revision ready · Details';
 if(completed)$('notebook-job-progress').hidden=!state.progressExpanded;
 return view;
}
$('notebook-progress-toggle').addEventListener('click',()=>{state.progressExpanded=!state.progressExpanded;renderEditorialProgress();});
function renderNotebook(){
 const data=state.data,p=passage(),c=chapter(),hasRevision=allPassages().some(p=>p.original!==p.text);
 const flow=notebookJourney({job:state.flowJob,busy:data?.busy,bookmark:data?.bookmark,hasRevision,walkthrough:state.walkthrough});
 $('notebook-step-title').textContent=flow.title;$('notebook-step-copy').textContent=flow.copy;$('notebook-next').textContent=flow.label;$('notebook-next').disabled=!p||flow.action==='working'||!!state.task;$('notebook-next').dataset.action=flow.action;
 for(const step of ['source','revision','together']){const node=$('notebook-stage-'+step);node.setAttribute('aria-current',flow.step===step?'step':'false');node.classList.toggle('done',['source','revision','together'].indexOf(step)<['source','revision','together'].indexOf(flow.step));}
 $('notebook-next').hidden=flow.action==='working';renderEditorialProgress();
 $('notebook-source').hidden=!data;$('notebook-source-name').textContent=data?.title||'';$('notebook-scope').value=state.scope;renderRequestTarget();
 $('notebook-chat-intro').hidden=!!data?.messages.length||!!state.task;$('notebook-saved').textContent=state.task||data?.busy?'Editing…':state.manualSaving?'Saving…':'Working draft saved';renderSaveStatus();
 renderChapterTree($('notebook-outline'),{chapters:chapters(),originalChapters:data?.originalChapters||chapters().map(item=>({index:item.index,title:item.title,text:item.passages.map(p=>p.original).join('\n\n')})),book:data?.bookDrafts?.book,activeChapter:c?.index,original:state.original,originalChapter:state.originalChapter??null,openState:treeOpen},selection=>void run(()=>navigateTree(selection)));

 const proposal=state.proposal;$('notebook-proposal').hidden=!proposal;$('notebook-proposal-copy').textContent=proposal?.request||'';$('notebook-proposal-apply').disabled=state.proposalApplying||!!data?.busy||!!state.task;
}
function rememberTreeSelection(){if(!state.id)return;try{window.sessionStorage?.setItem('johnny-story-tree:'+state.id,JSON.stringify({original:state.original,chapter:state.original?state.originalChapter:chapter()?.index,sectionId:state.sectionId}));}catch{}}
function restoreTreeSelection(){try{const saved=JSON.parse(window.sessionStorage?.getItem('johnny-story-tree:'+state.id)||'null');if(!saved)return;if(saved.original&&(saved.chapter==null||state.data.originalChapters?.some(c=>c.index===saved.chapter))){state.original=true;state.originalChapter=saved.chapter??null;}else if(!saved.original){const c=chapters().find(c=>c.index===saved.chapter),p=c?.passages.find(p=>p.id===saved.sectionId)||c?.passages[0];if(p)state.sectionId=p.id;}}catch{}}
async function navigateTree(selection){
 if(selection.version==='saved'){pause('Viewing a saved book chapter. Your working draft stays unchanged.');await openSavedChapter(selection.chapterId);return;}
 const check={allowed:true};document.dispatchEvent(new CustomEvent('story-before-navigate',{detail:check}));if(!check.allowed)return;
 if(selection.version==='original'){voice.close();pause('Viewing the preserved original. Editing and reading use the revised draft.');state.original=true;state.originalChapter=selection.chapter;renderDraft();renderControls();}
 else{const item=chapters().find(c=>c.index===selection.chapter);if(item?.passages[0])selectSection(item.passages[0].id);}
 rememberTreeSelection();setNotebookView('draft');$('library-rail').classList.remove('open');$('rail-open').setAttribute('aria-expanded','false');
}
function restoreNavigationDrafts(values){for(const [id,value] of Object.entries(values||{})){const field=$(id);if(field)field.value=value;}if(Object.hasOwn(values||{},'studio-goal'))state.goalDirty=true;}
function renderNotes(){
 $('studio-notes-count').textContent=state.data?.notes.length?`(${state.data.notes.length})`:'';$('studio-notes-list').replaceChildren();
 for(const note of state.data?.notes||[]){const li=document.createElement('li'),text=document.createElement('span'),button=document.createElement('button');text.textContent=note.text;button.type='button';button.textContent='Remove';button.setAttribute('aria-label','Remove this story note');button.addEventListener('click',()=>void run(async()=>{await api('/notes/'+encodeURIComponent(note.id),{method:'DELETE'});await refresh();status('Story note removed.');}));li.append(text,button);$('studio-notes-list').append(li);}
}
function renderHistory(){
 const versions=(state.data?.versions||[]).filter(v=>v.sectionId===state.sectionId),container=$('studio-versions');container.replaceChildren();
 for(const version of versions){const p=document.createElement('p');p.textContent=`${new Date(version.createdAt).toLocaleString()} · ${version.undoneAt?'Undone · ':''}${version.instruction}`;container.append(p);}
 if(!versions.length)container.textContent='Studio changes will appear here. Your imported original remains available in its own tab.';
 const last=versions.find(v=>!v.undoneAt),busy=state.authRequired||state.manualSaving||state.requestStarting||!!state.task||!!state.data?.busy;
 $('studio-undo').disabled=!last||busy||!!(last.afterRevision&&last.afterRevision!==passage()?.revision);
 $('studio-undo-visible').disabled=state.original||$('studio-undo').disabled;
 $('studio-compare-undo').disabled=$('studio-undo-visible').disabled;
 $('studio-compare').disabled=!passage()||state.original;
 $('studio-edit-text').disabled=!passage()||state.original||busy;
}
function renderRequestTarget(){
 const c=chapter(),p=passage(),editing=state.requestMode==='edit',target=state.scope==='book'?'the whole manuscript':state.scope==='chapter'?(c?.title||'this chapter'):`${c?.title||'This chapter'} · passage ${c?c.passages.indexOf(p)+1:1}`;
 $('studio-request-mode').value=editing?'edit':'discuss';
 $('studio-target').textContent=`${editing?'Revising':'Discussing'} ${target}. ${editing?(state.scope==='passage'?'Saves a recoverable passage change.':'Starts a revision of this scope; your original stays saved.'):'Your draft stays unchanged.'}`;
 $('studio-send').textContent=editing?'Revise →':'Discuss ↑';
 $('studio-input').placeholder=editing?'Describe what you want to change, and what to keep…':'Ask a question, explore an idea, or think it through with Johnny…';
 $('studio-readback').disabled=!editing;
}
function renderSaveStatus(){
 const c=chapter(),saved=state.data?.bookDrafts?.book?.chapters.find(item=>item.sourceProjectId===state.id&&item.sourceChapterIndex===c?.index);
 $('studio-save-status').textContent=state.original?'Imported original · preserved, read only':!c?'':state.task||state.data?.busy?'Revision in progress · completed changes are saved':saved?`Working draft saved · Book version ${saved.version}${saved.sourceRevision?(saved.sourceRevision===c.revision?' · Up to date':' · Changed since saved version'):''}`:'Working draft saved · No version saved to book yet';
}
async function submitComposer(){
 const field=$('studio-input'),text=field.value;if(!text.trim()){field.focus();return;}
 if(state.manualSaving||state.requestStarting||state.task||state.data?.busy||state.authRequired||state.original)return;
 if(state.requestMode==='edit'&&state.scope!=='passage'){
  if(state.scope==='chapter'&&chapters().length<2){status('This import has one chapter. Organize chapters first, or choose Whole manuscript.');return;}
  state.requestStarting=true;renderControls();pause('Starting your requested revision…');
  document.dispatchEvent(new CustomEvent('story-author-request',{detail:{projectId:state.id,request:text,chapter:state.scope==='chapter'?chapter()?.index:undefined,composer:true}}));return;
 }
 const id=state.id,ticket=state.epoch,result=await sendRequest(text,crypto.randomUUID(),state.requestMode,state.scope);
 if(result?.ok&&id===state.id&&ticket===state.epoch&&field.value===text)field.value='';
}
let comparisonEpoch=0,manualTarget=null;
const manualDrafts=new Map();
const manualKey=target=>`johnny-story-manual:${target.id}:${target.sectionId}`;
function storedManualDraft(target){const key=manualKey(target);if(manualDrafts.has(key))return manualDrafts.get(key);try{const saved=JSON.parse(window.sessionStorage?.getItem(key)||'null');return saved&&typeof saved.text==='string'&&typeof saved.revision==='string'?saved:null;}catch{return null;}}
function persistManualDraft(){
 if(!manualTarget)return;const draft={text:$('studio-manual-text').value,revision:manualTarget.revision},key=manualKey(manualTarget);manualDrafts.set(key,draft);
 try{window.sessionStorage?.setItem(key,JSON.stringify(draft));}catch{$('studio-manual-status').textContent='This unsaved edit is held in this open page. Keep the tab open until you save it.';}
}
function forgetManualDraft(target){const key=manualKey(target);manualDrafts.delete(key);try{window.sessionStorage?.removeItem(key);}catch{}}
function closeReviewDialogs(){persistManualDraft();comparisonEpoch++;$('studio-compare-dialog').close();$('studio-edit-dialog').close();manualTarget=null;}
function openManualEdit(){
 const p=passage();if(!p||state.original||state.manualSaving||state.task||state.data?.busy||state.authRequired)return;pause('Editing this passage in your own words.');
 manualTarget={id:state.id,sectionId:p.id,revision:p.revision};const saved=storedManualDraft(manualTarget);
 if(saved)manualTarget.revision=saved.revision;
 $('studio-manual-text').value=saved?.text??p.text;
 $('studio-edit-title').textContent=`Edit ${chapter().title} · passage ${chapter().passages.indexOf(p)+1}`;
 $('studio-manual-status').textContent=saved&&saved.revision!==p.revision?'The saved passage changed since this unsent edit. Copy any wording you need, then discard this unsent edit and reopen the latest version.':saved?'Your unsent edit is restored. Save it when you’re ready.':'Unsent edits stay in this tab until you save or discard them.';
 $('studio-manual-save').disabled=!!saved&&saved.revision!==p.revision;$('studio-manual-text').disabled=false;$('studio-manual-discard').disabled=false;
 $('studio-edit-dialog').showModal();$('studio-manual-text').focus();
}
async function saveManualEdit(){
 if(!manualTarget||state.manualSaving||$('studio-manual-save').disabled)return;const target={...manualTarget},text=$('studio-manual-text').value,ticket=state.epoch;
 if(!text.trim()){$('studio-manual-status').textContent='Keep some text in this passage before saving.';return;}
 persistManualDraft();state.manualSaving=true;$('studio-manual-save').disabled=true;$('studio-manual-text').disabled=true;$('studio-manual-discard').disabled=true;$('studio-manual-status').textContent='Saving your words…';renderControls();
 try{const result=await api('/passage',{id:target.id,method:'PUT',body:{sectionId:target.sectionId,revision:target.revision,text}});forgetManualDraft(target);
  if(ticket!==state.epoch||target.id!==state.id)return;
  manualTarget=null;$('studio-edit-dialog').close();state.resume=null;await refresh();
  document.dispatchEvent(new CustomEvent('story-studio-saved',{detail:{projectId:target.id}}));status(result.changed?'Your words are saved. Compare or Undo is available beside the passage.':'This passage already matches your saved draft.');void updateVoiceContext();
 }catch(error){if(ticket===state.epoch&&target.id===state.id)$('studio-manual-status').textContent=error.message+' Your unsent text is still here.';}
 finally{if(ticket===state.epoch&&target.id===state.id){state.manualSaving=false;$('studio-manual-text').disabled=false;$('studio-manual-discard').disabled=false;$('studio-manual-save').disabled=false;renderControls();}}
}
function appendComparedText(container,tokens,type){container.replaceChildren();for(const token of tokens){const node=document.createElement(token.changed?(type==='before'?'del':'ins'):'span');node.textContent=token.text;container.append(node);}}
async function renderComparison(){
 const p=passage();if(!p)return;const ticket=++comparisonEpoch,workspace=state.epoch,id=state.id,section=p.id,choice=$('studio-compare-source').value;
 let before=p.original,after=p.text,request='Compared with the preserved imported passage.';
 $('studio-compare-summary').textContent='Opening comparison…';$('studio-compare-before').replaceChildren();$('studio-compare-after').replaceChildren();$('studio-compare-request').textContent='';
 try{
  if(choice!=='original'){const data=await api('/versions/'+encodeURIComponent(choice));if(ticket!==comparisonEpoch||workspace!==state.epoch||id!==state.id||section!==state.sectionId)return;if(data.version.sectionId!==section)throw Error('That version belongs to another passage.');before=data.version.beforeText;after=data.version.afterText;request=`${data.version.explanation?data.version.explanation+'\n':''}Edit request: ${data.version.instruction}${data.version.undoneAt?' · This change was undone.':''}`;}
  if(ticket!==comparisonEpoch)return;const diff=comparePassages(before,after);
  $('studio-compare-before-label').textContent=choice==='original'?'Imported original':'Before this change';$('studio-compare-after-label').textContent=choice==='original'?'Working draft':'After this change';
  appendComparedText($('studio-compare-before'),diff.left,'before');appendComparedText($('studio-compare-after'),diff.right,'after');
  $('studio-compare-summary').textContent=diff.changed?`${diff.added} words added · ${diff.removed} removed${diff.coarse?' · Long changed sections are highlighted together.':''}`:'No differences in this comparison.';$('studio-compare-request').textContent=request;
 }catch(error){if(ticket===comparisonEpoch)$('studio-compare-summary').textContent=error.message;}
}
function openComparison(){
 const p=passage();if(!p)return;const select=$('studio-compare-source');select.replaceChildren();const original=document.createElement('option');original.value='original';original.textContent='Imported original → working draft';select.append(original);
 const versions=(state.data?.versions||[]).filter(v=>v.sectionId===p.id);
 for(const v of versions){const option=document.createElement('option');option.value=v.id;option.textContent=`${new Date(v.createdAt).toLocaleString()} · ${v.undoneAt?'Undone · ':''}${v.instruction.length>70?v.instruction.slice(0,70)+'…':v.instruction}`;select.append(option);}
 const latest=versions.find(v=>!v.undoneAt&&v.afterRevision===p.revision);select.value=latest?.id||'original';$('studio-compare-title').textContent=`${chapter().title} · passage ${chapter().passages.indexOf(p)+1}`;$('studio-compare-dialog').showModal();void renderComparison();
}
$('studio-compare').addEventListener('click',openComparison);
$('studio-compare-source').addEventListener('change',()=>void renderComparison());
for(const id of ['studio-compare-close','studio-compare-done'])$(id).addEventListener('click',()=>{comparisonEpoch++;$('studio-compare-dialog').close();});
$('studio-compare-dialog').addEventListener('cancel',()=>comparisonEpoch++);
$('studio-undo-visible').addEventListener('click',()=>void run(undo));
$('studio-compare-undo').addEventListener('click',()=>void run(async()=>{await undo();openComparison();}));
$('studio-edit-text').addEventListener('click',openManualEdit);
$('studio-manual-text').addEventListener('input',persistManualDraft);
$('studio-edit-close').addEventListener('click',()=>{persistManualDraft();$('studio-edit-dialog').close();});
$('studio-edit-dialog').addEventListener('cancel',persistManualDraft);
$('studio-manual-save').addEventListener('click',()=>void saveManualEdit());
$('studio-manual-discard').addEventListener('click',()=>{if(manualTarget)forgetManualDraft(manualTarget);manualTarget=null;$('studio-edit-dialog').close();});
document.addEventListener('story-author-request-result',event=>{if(event.detail.projectId!==state.id)return;state.requestStarting=!!event.detail.busy;status(event.detail.message);renderControls();});

function renderDraft({scroll=false}={}){
 const p=passage(),c=chapter(),container=$('studio-pages');
 $('studio-current').setAttribute('aria-pressed',String(!state.original));$('studio-original').setAttribute('aria-pressed',String(state.original));
 $('studio-navigation').hidden=state.original;$('studio-original-export').hidden=!state.original;
 $('reader-title').textContent=state.original?(state.originalChapter==null?'Original upload':state.data?.originalChapters?.find(c=>c.index===state.originalChapter)?.title||'Original chapter'):(c?.title||state.data?.title||'Your draft');
 $('studio-version-hint').textContent=state.original?'Your imported original, preserved separately from the current draft.':'Choose any passage to work on it. The highlighted passage is where Johnny is listening with you.';
 container.replaceChildren();
 if(state.original){const text=document.createElement('div');text.className='studio-original-text';text.textContent=state.originalChapter==null?state.data?.original||'':state.data?.originalChapters?.find(c=>c.index===state.originalChapter)?.text||chapters().find(c=>c.index===state.originalChapter)?.passages.map(p=>p.original).join('\n\n')||'';container.append(text);return;}
 if(!p||!c){container.textContent='There are no readable passages in this manuscript yet.';return;}
 $('studio-chapter').replaceChildren(...chapters().map(ch=>{const option=document.createElement('option');option.value=String(ch.index);option.textContent=ch.title;return option;}));$('studio-chapter').value=String(c.index);
 const index=c.passages.indexOf(p);$('studio-location').textContent=`${index+1} / ${c.passages.length}`;
 const all=allPassages(),position=all.indexOf(p);$('studio-prev').disabled=position===0;$('studio-next').disabled=position===all.length-1;
 const h=document.createElement('h3');h.textContent=c.title;container.append(h);
 for(const [i,item] of c.passages.entries()){
  const block=document.createElement('section');block.className='studio-passage';block.tabIndex=0;block.setAttribute('role','button');block.setAttribute('aria-label',`Work on passage ${i+1}`);block.setAttribute('aria-current',String(item.id===p.id));
  const label=document.createElement('small');label.textContent=item.id===p.id?'WORKING HERE':`PASSAGE ${i+1}`;
  const text=document.createElement(item.kind==='scene'?'h4':'p');text.textContent=item.text;block.append(label,text);
  const choose=()=>selectSection(item.id,{scroll:false});block.addEventListener('click',choose);block.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose();}});container.append(block);
  if(item.id===p.id&&scroll)requestAnimationFrame(()=>block.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));
 }
 renderHistory();
}
function renderJourney(){
 const p=passage(),c=chapter(),all=allPassages(),index=all.indexOf(p),saved=state.data?.bookmark;
 $('studio-return-title').textContent=saved?'Your story is waiting right here.':'Let’s work toward your finished manuscript.';
 $('studio-return-copy').textContent=p?`${c.title} · passage ${c.passages.indexOf(p)+1} of ${c.passages.length}. ${saved?'Your place is saved. Continue here, or listen one passage earlier for context.':'We’ll move through the entire story together, at your pace. Your place will be saved as you work.'}`:'';
 $('studio-recap-read').disabled=index<1;
 const previous=all[index-1];$('studio-recap').textContent=previous?`Immediately before this passage, in your saved draft: “${previous.text.slice(-420)}”`:(p?`At the start of your saved draft: “${p.text.slice(0,420)}”`:'');
 const goal=state.data?.goal||'Your finished manuscript';$('studio-goal-copy').textContent=goal.length>140?goal.slice(0,140)+'…':goal;
 if(!state.goalDirty&&document.activeElement!==$('studio-goal'))$('studio-goal').value=state.data?.goal||'';
 $('studio-goal-save').disabled=state.authRequired||!!state.task||!!state.data?.busy;
}
function renderControls(){renderBookDrafts();$('studio-quality').title=editorialQualityLabel(state.data?.quality);renderJourney();renderNotebook();const ready=!!passage()&&!state.authRequired&&!state.original;$('studio-read').disabled=!ready||state.reading;$('studio-read').textContent=state.reading?(state.readPhase==='preparing'?'Preparing audio…':state.readPhase==='ready'?'Audio ready · use Play':'Reading…'):state.readPhase==='paused'?'▶ Resume reading':'▶ Read from here';$('studio-pause').textContent=state.readPhase==='paused'?'▶ Resume':'Pause / interrupt';$('studio-stop').disabled=!state.reading&&state.readPhase!=='paused';$('studio-read').setAttribute('aria-busy',String(state.reading&&state.readPhase==='preparing'));$('studio-send').disabled=state.original||!ready||state.manualSaving||state.requestStarting||!!state.task||!!state.data?.busy;$('studio-input').disabled=state.authRequired||state.manualSaving||state.requestStarting||!!state.task||!!state.data?.busy;$('studio-voice').disabled=!ready||voiceStarting;$('studio-progress').hidden=!state.task;$('studio-retry').hidden=!state.lastTask||!!state.task;renderHistory();}
function setBookOpen(open){state.bookOpen=!!open;$('book-drafts-panel').hidden=!open;$('book-toggle').setAttribute('aria-expanded',String(!!open));if(open)$('book-close').focus();}
function bookNotice(text){$('book-drafts-status').textContent=text;}
function bookButton(text,action,label=text){const b=document.createElement('button');b.type='button';b.className='ghost-button';b.textContent=text;b.setAttribute('aria-label',label);b.disabled=state.bookSaving||!!state.task||!!state.data?.busy;b.addEventListener('click',()=>void bookAction(action));return b;}
function renderBookDrafts(){
 const data=state.data?.bookDrafts||{books:[],book:null},book=data.book,c=chapter(),busy=state.authRequired||state.bookSaving||!!state.task||!!state.data?.busy;
 $('book-save-chapter').disabled=!c||busy||state.original;$('book-toggle').disabled=!state.id;$('book-save-chapter').textContent=state.bookSaving?'Saving version…':'Save version to book';$('book-drafts-count').textContent=book?.chapters.length?`(${book.chapters.length})`:'';
 const select=$('book-select');select.replaceChildren();const option=document.createElement('option');option.value='';option.textContent='Create a new book…';select.append(option);for(const item of data.books){const option=document.createElement('option');option.value=item.id;option.textContent=item.title;select.append(option);}select.value=state.bookCreating?'':book?.id||'';select.disabled=busy;
 $('book-create-form').hidden=!!book&&!state.bookCreating;$('book-existing-controls').hidden=!book||state.bookCreating;$('book-create').disabled=busy;$('book-name').disabled=busy;$('book-use-continuity').checked=!!book?.useContinuity;$('book-use-continuity').disabled=busy;
 if(!book&&!$('book-name').value)$('book-name').value=state.data?.title||'My book';
 $('book-drafts-title').textContent=book?.title||'Book drafts';$('book-empty').hidden=!!book?.chapters.length;$('book-export').disabled=!book?.chapters.length||state.bookSaving;
 const list=$('book-drafts-list');list.replaceChildren();for(const [i,item] of (book?.chapters||[]).entries()){
  const li=document.createElement('li'),head=document.createElement('div'),title=document.createElement('strong'),meta=document.createElement('small'),actions=document.createElement('div');title.textContent=`${i+1}. ${item.title}`;meta.textContent=`Reference version ${item.version} · ${new Date(item.savedAt).toLocaleDateString()}`;head.append(title,meta);
  const view=bookButton('Open',()=>openSavedChapter(item.id),`Open saved ${item.title}`);view.disabled=state.bookSaving;actions.append(view);
  for(const [direction,label] of [[-1,'↑'],[1,'↓']]){const move=bookButton(label,async()=>{const order=book.chapters.map(c=>c.id);[order[i],order[i+direction]]=[order[i+direction],order[i]];await changeBook({revision:book.revision,order});bookNotice('Book order saved. This order now controls earlier-chapter continuity.');},`Move ${item.title} ${direction<0?'earlier':'later'} in the book`);move.disabled=busy||i+direction<0||i+direction>=book.chapters.length;actions.append(move);}li.append(head,actions);list.append(li);
 }
}
async function bookAction(fn){if(state.bookSaving)return;const id=state.id,ticket=state.epoch;state.bookSaving=true;renderBookDrafts();try{await fn();}catch(error){if(id===state.id&&ticket===state.epoch){bookNotice(error.message||'Could not save. Your working draft and saved chapters are unchanged.');$('book-version-status').textContent=error.message||'Could not load this version.';}}finally{if(id===state.id&&ticket===state.epoch){state.bookSaving=false;renderBookDrafts();}}}
async function acceptBookResponse(path,options){const id=state.id,ticket=state.epoch;const data=await api(path,options);if(id!==state.id||ticket!==state.epoch)return false;state.data.bookDrafts=data;if(path==='/book/link')state.bookCreating=false;renderBookDrafts();renderNotebook();return true;}
async function changeBook(body){return acceptBookResponse('/book',{method:'PUT',body});}
async function saveChapter(){const c=chapter(),book=state.data?.bookDrafts?.book;if(!c)return;if(!book||state.bookCreating){setBookOpen(true);bookNotice('Name a new book, or select an existing one. Then save this version.');$('book-name').focus();return;}if(await acceptBookResponse('/book/chapters',{method:'POST',body:{chapterIndex:c.index,chapterRevision:c.revision,bookRevision:book.revision}})){setBookOpen(true);bookNotice('Book version saved for continuity. Your working draft and original are preserved.');}}
async function openSavedChapter(chapterId,versionId){const id=state.id,ticket=state.epoch;const data=await api('/book/chapters/'+encodeURIComponent(chapterId)+(versionId?'?'+new URLSearchParams({versionId}):''));if(id!==state.id||ticket!==state.epoch)return;state.savedChapter=data;$('book-version-title').textContent=data.content.title;$('book-version-text').textContent=data.content.passages.map(p=>p.text).join('\n\n');$('book-version-meta').textContent=`Version ${data.version} · ${new Date(data.savedAt).toLocaleString()} · ${data.versionId===data.approvedVersionId?'Current continuity reference':'Historical version'}`;$('book-version-status').textContent='';const select=$('book-version-select');select.replaceChildren();for(const version of data.versions){const option=document.createElement('option');option.value=version.id;option.textContent=`Version ${version.number} · ${new Date(version.savedAt).toLocaleString()}`;select.append(option);}select.value=data.versionId;$('book-version-approve').disabled=data.versionId===data.approvedVersionId||!!state.task||!!state.data?.busy;if(!$('book-version-dialog').open)$('book-version-dialog').showModal();}
function downloadBookText(title,text){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=title.replace(/[^a-zA-Z0-9 _-]/g,'_')+'.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('book-toggle').addEventListener('click',()=>setBookOpen(!state.bookOpen));$('book-close').addEventListener('click',()=>{setBookOpen(false);$('book-toggle').focus();});
$('book-save-chapter').addEventListener('click',()=>void bookAction(saveChapter));
$('book-create-form').addEventListener('submit',event=>{event.preventDefault();const title=$('book-name').value.trim();if(title)void bookAction(async()=>{if(await acceptBookResponse('/book/link',{method:'PUT',body:{title,useContinuity:true}}))await saveChapter();});});
$('book-select').addEventListener('change',event=>{const bookId=event.target.value;if(!bookId){state.bookCreating=true;renderBookDrafts();$('book-name').value='';$('book-name').focus();return;}void bookAction(async()=>{if(await acceptBookResponse('/book/link',{method:'PUT',body:{bookId,useContinuity:true}}))bookNotice('Book connected. Save this chapter when ready; earlier saved chapters will inform your next edit.');});});
$('book-use-continuity').addEventListener('change',()=>{const useContinuity=$('book-use-continuity').checked;void bookAction(async()=>{await changeBook({revision:state.data.bookDrafts.book.revision,useContinuity});bookNotice(useContinuity?'Saved chapter references will be included in future editing requests.':'Saved chapter continuity is off for this manuscript. Your saved chapters remain intact.');});});
$('book-version-close').addEventListener('click',()=>$('book-version-dialog').close());
$('book-version-select').addEventListener('change',()=>void bookAction(()=>openSavedChapter(state.savedChapter.chapterId,$('book-version-select').value)));
$('book-version-approve').addEventListener('click',()=>void bookAction(async()=>{const v=state.savedChapter;if(await changeBook({revision:state.data.bookDrafts.book.revision,chapterId:v.chapterId,versionId:v.versionId})){await openSavedChapter(v.chapterId,v.versionId);$('book-version-status').textContent='Continuity reference changed. The working draft was not replaced.';}}));
$('book-version-download').addEventListener('click',()=>{const v=state.savedChapter;if(v)downloadBookText(v.content.title+' version '+v.version,v.content.title+'\n\n'+v.content.passages.map(p=>p.text).join('\n\n'));});
$('book-export').addEventListener('click',()=>void bookAction(async()=>{const book=state.data.bookDrafts.book,id=state.id,ticket=state.epoch,revision=book.revision;const chapters=[];for(const c of book.chapters){const v=await api('/book/chapters/'+encodeURIComponent(c.id)+'?'+new URLSearchParams({versionId:c.versionId}));if(id!==state.id||ticket!==state.epoch)return;chapters.push(v.content.title+'\n\n'+v.content.passages.map(p=>p.text).join('\n\n'));}const current=await api('/book');if(id!==state.id||ticket!==state.epoch)return;if(current.book?.revision!==revision)throw Error('Book references changed while assembling. Refresh and download again.');downloadBookText(book.title,chapters.join('\n\n\n'));bookNotice('Downloaded the complete saved reference versions in book order.');}));
function renderAccess(){const banner=$('studio-auth-banner');banner.hidden=!state.authRequired;$('studio-auth-check').disabled=state.accessChecking;$('studio-auth-check').textContent=state.accessChecking?'Checking access…':'Check access';}
function requireUnlock(){
 if(state.authRequired){renderAccess();return;}
 state.authRequired=true;state.connection='auth';pause('Your session needs unlocking. Open Unlock again in a new tab, then return here. Your saved revisions and unsent text are safe.');voice.close();voiceStarting=false;$('studio-voice').setAttribute('aria-pressed','false');$('studio-voice').textContent='◉ Talk with Johnny';$('studio-voice-status').textContent='Voice is off · unlock to reconnect';taskController?.abort();contextController?.abort();
 $('studio-auth-copy').textContent='Your private session needs unlocking. Saved revisions are safe. Unsent text stays in this tab; keep it open.';renderAccess();renderControls();$('studio-auth-banner').focus();$('studio-auth-banner').scrollIntoView({block:'nearest'});document.dispatchEvent(new CustomEvent('story-auth-required',{detail:{source:'studio'}}));
}
async function checkAccess(){
 if(state.accessChecking)return;const id=state.id,ticket=state.epoch;state.accessChecking=true;renderAccess();
 try{
  if(id)await refresh({resumePending:false,allowLocked:true});
  else{const response=await fetch(origin+'/api/story-editor/projects',{headers:auth(),signal:AbortSignal.timeout(20000)});if(response.status===401)throw accessError();if(!response.ok)throw Error('The studio could not verify access just now.');}
  if(id!==state.id||ticket!==state.epoch)return;
  state.authRequired=false;state.authEpoch++;state.connection='connected';renderAccess();renderControls();document.dispatchEvent(new CustomEvent('story-auth-restored'));status('Unlocked. Your saved draft is refreshed. Press Read when you are ready; nothing was restarted.');
  if(state.data?.task||state.task)void resumeTask(state.data?.task?.id||state.task);
 }catch(error){if(id!==state.id||ticket!==state.epoch)return;if(error.code==='AUTH_REQUIRED'){requireUnlock();$('studio-auth-copy').textContent='Access is still locked. Use Unlock again in the new tab, finish signing in, then return here. Your text stays open.';}else{$('studio-auth-copy').textContent='Could not reconnect just now. Keep this tab open to preserve unsent text, then try Check access again.';status(error.message||'The connection could not be verified.');}}
 finally{if(id===state.id&&ticket===state.epoch){state.accessChecking=false;renderAccess();}}
}
$('studio-auth-check').addEventListener('click',()=>void checkAccess());
document.addEventListener('story-auth-required',()=>requireUnlock());
window.addEventListener('focus',()=>{if(state.authRequired)void checkAccess();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.authRequired)void checkAccess();});
async function updateVoiceContext(){if(!voice.connected||!passage())return;const id=state.id,sectionId=state.sectionId,ticket=state.epoch;contextController?.abort();contextController=new AbortController();try{const data=await api('/context?'+new URLSearchParams({sectionId}),{signal:contextController.signal});if(ticket===state.epoch&&sectionId===state.sectionId&&id===state.id)voice.updateContext(data.instructions);}catch(error){if(error.name!=='AbortError')status('The draft is open, but voice context could not refresh. Reconnect voice before asking for another edit.');}}
function selectSection(id,{scroll=true,stop=true}={}){if(id!==state.sectionId)closeReviewDialogs();if(!allPassages().some(p=>p.id===id))throw Error('That passage is not in this manuscript.');if(stop){pause('');state.scope='passage';}state.original=false;state.originalChapter=null;state.sectionId=id;state.resume=null;state.loadedAudio=null;rememberTreeSelection();renderDraft({scroll});renderControls();void updateVoiceContext();saveBookmark();}
async function refresh({initial=false,resumePending=true,fromTask=false,allowLocked=false}={}){
 const id=state.id,ticket=state.epoch;if(!id)return;const data=await api('',{id,allowLocked});if(ticket!==state.epoch||id!==state.id)return;
 const before=passage()?.revision;state.data=data;if(data.lastTask?.result?.action==='revise_book'&&data.lastTask.id!==state.ignoredProposal)state.proposal={id:data.lastTask.id,...data.lastTask.result};
 if(!allPassages().some(p=>p.id===state.sectionId))state.sectionId=data.bookmark?.sectionId&&allPassages().some(p=>p.id===data.bookmark.sectionId)?data.bookmark.sectionId:allPassages()[0]?.id||'';
 if(initial)restoreTreeSelection();
 if(initial&&data.bookmark?.sectionId===state.sectionId&&passage())state.resume={...data.bookmark,revision:passage().revision,...(data.bookmark.revision!==passage().revision||data.bookmark.audioIdentity!==narrationSignature(readingSettings())?{part:0,seconds:0}:{})};
 if(before&&passage()?.revision!==before){if(fromTask){state.reading=false;state.readPhase='idle';state.audioFlight='';speechController?.abort();}else pause('The draft was updated. Read from here to hear the saved version.');state.resume=null;resetAudio();}
 renderDraft();renderConversation();renderNotes();renderControls();
 if(resumePending){if(data.task&&(!state.task||!state.polling))void resumeTask(data.task.id);else if(state.task&&!state.polling)void resumeTask(state.task);}
 if(initial&&data.lastTask&&['failed','cancelled'].includes(data.lastTask.status)){state.lastTask=data.lastTask.id;renderControls();status(data.lastTask.error||'An earlier request stopped. Retry can resume its completed passes.');}
 if(state.pendingNavigationDrafts){restoreNavigationDrafts(state.pendingNavigationDrafts);state.pendingNavigationDrafts=null;}
 if(initial&&!data.task&&!state.lastTask)status(data.busy?'Your full edit is working. You can read the draft; passage changes will be available when it finishes or is paused.':(data.bookmark?'Welcome back. Your saved place is open; continue here or read one passage earlier.':'Your draft is open. We’ll work through your whole story toward the finished work you want.'));
 void updateVoiceContext();
}
async function run(fn){try{await fn();}catch(error){if(error.name!=='AbortError')status(error.message||'That action could not finish. Your saved draft is safe.');}}
async function playPart(part,ticket,seek=0){
 const p=passage(),c=chapter(),id=state.id,projectTicket=state.epoch;if(!p||!state.reading)return;
 const flight=JSON.stringify([id,p.id,p.revision,part,ticket]);if(state.audioFlight===flight)return;state.audioFlight=flight;state.readPhase='preparing';renderControls();
 const parts=speechParts(p.text);state.resume={sectionId:p.id,revision:p.revision,part,seconds:seek};resetAudio();speechController=new AbortController();status(`Preparing ${c.title} · passage ${c.passages.indexOf(p)+1}…`);
 try{
  const blob=await narrationBuffer.get(audioTarget(p,part));
  if(ticket!==state.audioEpoch||projectTicket!==state.epoch||(!state.reading&&state.readPhase!=='paused')||state.sectionId!==p.id)return;
  state.audioUrl=URL.createObjectURL(blob);audio.src=state.audioUrl;audio.hidden=false;state.loadedAudio={sectionId:p.id,revision:p.revision,part,seconds:seek};
  if(seek)audio.addEventListener('loadedmetadata',()=>{if(ticket===state.audioEpoch)audio.currentTime=Math.min(seek,Number.isFinite(audio.duration)?Math.max(0,audio.duration-0.1):seek);},{once:true});
  let advanced=false;audio.onended=()=>{
   if(advanced||ticket!==state.audioEpoch||!state.reading)return;advanced=true;
   if(part+1<parts.length)void playPart(part+1,ticket);
   else{const all=allPassages(),next=all[all.findIndex(item=>item.id===p.id)+1];if(next){selectSection(next.id,{stop:false});void playPart(0,ticket);}else{pause('You’ve reached the end of the current draft. Your place is saved. We can review, revise, or discuss what it needs before you call it finished.');state.resume=null;}}
  };
  if(!state.reading){renderControls();return;}
  status(`Reading ${c.title} · passage ${c.passages.indexOf(p)+1}. ${voice.connected?'Speak to interrupt.':'Press Pause to stop here.'}`);
  try{await audio.play();if(ticket===state.audioEpoch&&projectTicket===state.epoch&&state.sectionId===p.id&&state.loadedAudio?.part===part){state.readPhase='playing';renderControls();}}catch(error){if(ticket!==state.audioEpoch||projectTicket!==state.epoch)return;if(error.name==='NotAllowedError'){state.readPhase='ready';renderControls();status('Your passage is ready. Press Play in the audio controls to listen, or Pause to choose another starting point.');}else pause('Playback could not start. Press Read to retry this saved passage.');}
 }catch(error){if(ticket!==state.audioEpoch||projectTicket!==state.epoch)return;if(error.code==='AUTH_REQUIRED'){requireUnlock();return;}pause((error.message||'Audio preparation was interrupted.')+' Press Read to retry this passage.');}
 finally{if(state.audioFlight===flight)state.audioFlight='';}
}
async function read({restart=false}={}){if(state.authRequired){status(accessError().message);return;}if(state.readPhase==='paused')return resumeReading();if(!passage()||state.reading)return;state.readSettings=readingSettings();setNotebookView('draft');pause('');state.original=false;renderDraft({scroll:true});const p=passage(),resume=!restart&&state.resume?.sectionId===p.id&&state.resume?.revision===p.revision?state.resume:null;state.reading=true;state.readPhase='preparing';renderControls();await playPart(resume?.part||0,state.audioEpoch,resume?.seconds||0);}
function renderPhase(task){$('studio-progress-copy').textContent=phaseLabels[task.phase]||phaseLabels.queued;const names=['planning','drafting','reviewing','refining'],index=names.indexOf(task.phase);for(const li of $('studio-progress').querySelectorAll('li')){li.classList.toggle('current',li.dataset.pass===task.phase);li.classList.toggle('done',names.indexOf(li.dataset.pass)<index);}status(phaseLabels[task.phase]||phaseLabels.queued);}
async function pollTask(taskId,{readTicket=state.audioEpoch,requestedSection=state.sectionId}={}){
 const ticket=state.epoch,id=state.id;taskController?.abort();taskController=new AbortController();const signal=taskController.signal;let failures=0;
 const end=Date.now()+46*60*1000;state.polling=true;
 try{while(Date.now()<end){
  if(ticket!==state.epoch||signal.aborted)return;
  let data;try{data=await api('/tasks/'+encodeURIComponent(taskId),{id,signal});failures=0;}catch(error){if(signal.aborted)return;if(error.code==='AUTH_REQUIRED')throw error;if(++failures>=3)throw Error('The connection was interrupted. Your request is saved; Refresh draft will reconnect without starting another edit.');await delay(2000,signal);continue;}
  if(ticket!==state.epoch)return;
  const task=data.task;renderPhase(task);
  if(['failed','cancelled'].includes(task.status)){state.task=null;state.lastTask=taskId;renderControls();await refresh();status(task.error||'This request stopped. Retry can resume completed passes.');return {ok:false,error:task.error};}
  if(task.status==='done'){
   state.task=null;state.lastTask=null;await refresh({resumePending:false,fromTask:true});if(ticket!==state.epoch)return;
   const result=task.result;status(result.reply);if(readTicket!==-1)document.dispatchEvent(new CustomEvent('story-studio-saved',{detail:{projectId:id}}));
   if(result.action==='navigate')selectSection(result.sectionId);
   const shouldRead=result.action==='read'||(result.action==='revise'&&$('studio-readback').checked);
   if(shouldRead&&readTicket===state.audioEpoch&&requestedSection===state.sectionId){void read({restart:result.action==='revise'});return {ok:true,narrating:true,...result};}
   return {ok:true,...result};
  }
  await delay(1200,signal);
 }
 throw Error('This request is taking longer than expected. Refresh draft to check its saved status.');
 }finally{if(ticket===state.epoch)state.polling=false;}
}
function delay(ms,signal){return new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(signal.reason);};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});}
async function resumeTask(id){if(state.task&&state.polling)return;state.task=id;renderControls();try{return await pollTask(id,{readTicket:-1});}catch(error){if(error.name!=='AbortError')status(error.message);}}
async function sendRequest(message,requestId=crypto.randomUUID(),mode='auto',scope=state.scope){
 if(state.task)throw Error('The editor is still working on your earlier request. You can keep discussing ideas by voice, or stop that edit first.');
 const p=passage();if(!p)throw Error('Choose a passage first.');pause('');const id=state.id,ticket=state.epoch,readTicket=state.audioEpoch;
 state.task='starting';renderControls();let data;
 try{data=await api('/tasks',{method:'POST',body:{requestId,sectionId:p.id,revision:p.revision,message,mode,scope,...(state.resume?.sectionId===p.id?{cursor:{part:state.resume.part,seconds:state.resume.seconds}}:{})}});}catch(error){if(ticket===state.epoch){state.task=null;renderControls();}throw error;}if(ticket!==state.epoch||id!==state.id)return;
 state.task=data.task.id;state.lastTask=null;renderControls();await refresh({resumePending:false,fromTask:true});
 try{return await pollTask(data.task.id,{readTicket,requestedSection:p.id});}catch(error){if(ticket===state.epoch&&error.name!=='AbortError')status(error.message);return {ok:false,error:error.message};}
}
async function undo(){const p=passage();if(!p)return;pause('');await api('/undo',{method:'POST',body:{sectionId:p.id,revision:p.revision}});await refresh();state.resume=null;document.dispatchEvent(new CustomEvent('story-studio-saved',{detail:{projectId:state.id}}));status('Restored the previous saved passage. Your original remains unchanged.');void updateVoiceContext();}
const voice=new StudioVoice({
 token:signal=>{const p=passage();return api('/voice',{method:'POST',body:{sectionId:p.id,revision:p.revision},signal});},
 onSpeech:()=>{pause('Paused here. Listening to what you want to change…',false);},
 onStatus:text=>{if(!state.id)return;voiceStarting=false;$('studio-voice-status').textContent=text;$('studio-voice').setAttribute('aria-pressed',String(voice.connected));$('studio-voice').textContent=voice.connected?'◉ End voice':'◉ Talk with Johnny';renderControls();},
 onError:error=>{if(!state.id)return;voiceStarting=false;$('studio-voice-status').textContent='Voice is off · typing works too';$('studio-voice').setAttribute('aria-pressed','false');$('studio-voice').textContent='◉ Talk with Johnny';renderControls();status(error.message);},
 onTranscript:(role,text,itemId)=>{
  if(!state.data||!text.trim())return;const messageId=`voice-${voiceSession}-${role}-${itemId}`;
  if(state.data.messages.some(m=>m.id===messageId))return;
  state.data.messages.push({id:messageId,role,text});renderConversation();void api('/messages',{method:'POST',body:{role,text,messageId}}).catch(()=>status('The voice turn was heard, but could not be saved to conversation. Refresh before leaving.'));
 },
 makeAudio:()=>{const element=document.createElement('audio');element.controls=true;element.hidden=true;element.setAttribute('aria-label','Johnny’s live voice');$('book-reader').append(element);return element;},
 tool:async(name,args,callId)=>{
  if(name==='set_manuscript_goal'){await api('/goal',{method:'PUT',body:{goal:args.goal}});await refresh();return {ok:true,saved:true,goal:state.data.goal};}
  if(name==='think_about_story'){if(typeof args.question!=='string'||!args.question.trim())throw Error('Ask a story question first.');return sendRequest(args.question,'voice-'+voiceSession+'-'+callId,'discuss','book');}
  if(name==='stop_editorial_work'){if(state.task&&state.task!=='starting')await api('/tasks/'+encodeURIComponent(state.task)+'/cancel',{method:'POST',body:{}});return {ok:true,stopped:true};}
  if(name==='edit_manuscript'){if(typeof args.instruction!=='string'||!args.instruction.trim())throw Error('Describe the whole-manuscript change first.');return sendRequest(args.instruction,'voice-'+voiceSession+'-'+callId,'auto','book');}
  if(name==='edit_passage'){if(typeof args.instruction!=='string'||!args.instruction.trim())throw Error('Describe the change first.');return sendRequest(args.instruction,'voice-'+voiceSession+'-'+callId,'edit','passage');}
  if(name==='read_passage'){void read();return {ok:true,narrating:true};}
  if(name==='navigate_story'){const c=chapters().find(c=>c.index===args.chapter);if(!Number.isInteger(args.passage)||!c?.passages[args.passage-1])throw Error('That chapter or passage does not exist.');selectSection(c.passages[args.passage-1].id);return {ok:true,chapter:c.title,passage:args.passage,text:passage().text.slice(0,12000)};}
  if(name==='remember_story_note'){await api('/notes',{method:'POST',body:{note:args.note}});await refresh();return {ok:true,saved:true};}
  if(name==='undo_passage_edit'){await undo();return {ok:true,restored:true};}
  throw Error('That action is not available in the writing studio.');
 }
});
let voiceSession='';
$('studio-continue').addEventListener('click',()=>{setNotebookView('draft');state.scope='passage';state.original=false;renderDraft({scroll:true});status('We’re back at your saved passage. Press Read, or tell Johnny what you want to work on.');});
$('studio-recap-read').addEventListener('click',()=>void run(async()=>{const all=allPassages(),index=all.findIndex(p=>p.id===state.sectionId);if(index>0){selectSection(all[index-1].id);await read({restart:true});}}));
$('studio-goal-form').addEventListener('submit',event=>{event.preventDefault();void run(async()=>{await api('/goal',{method:'PUT',body:{goal:$('studio-goal').value}});state.goalDirty=false;await refresh();status('Your destination is saved for this whole manuscript. We’ll keep working toward it when you return.');});});
$('studio-read').addEventListener('click',()=>void run(()=>read()));
$('studio-pause').addEventListener('click',()=>pauseReading());
$('studio-stop').addEventListener('click',()=>pause('Stopped. Press Read to start from your saved place.'));
$('studio-narration-preset').addEventListener('change',()=>{const preset=$('studio-narration-preset').value;if(NARRATION_PRESETS[preset])$('studio-narration-direction').value=NARRATION_PRESETS[preset];changeReadingSettings();});
for(const name of ['studio-narration-voice','studio-narration-direction'])$(name).addEventListener('change',()=>changeReadingSettings());
$('studio-narration-direction').addEventListener('input',()=>{if(state.reading||state.readPhase==='paused')changeReadingSettings();$('studio-narration-preset').value='custom';});
$('studio-voice').addEventListener('click',()=>{if(voice.connected||voiceStarting){pause('Voice ended. Your draft and conversation stay saved.');voice.close();voiceStarting=false;$('studio-voice').setAttribute('aria-pressed','false');$('studio-voice').textContent='◉ Talk with Johnny';$('studio-voice-status').textContent='Voice is off · typing works too';renderControls();}else{pause('Narration paused. Connecting voice…');voiceSession=crypto.randomUUID();voiceStarting=true;renderControls();void voice.connect();}});
$('studio-current').addEventListener('click',()=>{state.original=false;state.originalChapter=null;rememberTreeSelection();renderDraft();renderControls();});
$('studio-original').addEventListener('click',()=>{voice.close();pause('Your original is preserved here. Switch to Current draft to continue the collaboration.');state.original=true;state.originalChapter=null;rememberTreeSelection();renderDraft();renderControls();});
$('studio-original-export').addEventListener('click',()=>$('download-original').click());
$('studio-chapter').addEventListener('change',()=>{const c=chapters().find(c=>c.index===Number($('studio-chapter').value));if(c)selectSection(c.passages[0].id);});
for(const [id,direction] of [['studio-prev',-1],['studio-next',1]])$(id).addEventListener('click',()=>{const all=allPassages(),index=all.findIndex(p=>p.id===state.sectionId);if(all[index+direction])selectSection(all[index+direction].id);});
$('studio-refresh').addEventListener('click',()=>void run(async()=>{await refresh();if(!state.task)status('Your saved draft is up to date.');}));
$('studio-compose').addEventListener('submit',event=>{event.preventDefault();void run(submitComposer);});
$('studio-undo').addEventListener('click',()=>void run(undo));
$('studio-cancel').addEventListener('click',()=>void run(async()=>{pause('Stopping this edit…');if(state.task)await api('/tasks/'+encodeURIComponent(state.task)+'/cancel',{method:'POST',body:{}});}));
$('studio-retry').addEventListener('click',()=>void run(async()=>{const id=state.lastTask;if(!id)return;pause('');const data=await api('/tasks/'+encodeURIComponent(id)+'/retry',{method:'POST',body:{}});state.lastTask=null;state.task=data.task.id;renderControls();await pollTask(data.task.id);}));
$('studio-note-form').addEventListener('submit',event=>{event.preventDefault();const note=$('studio-note').value.trim();if(note)void run(async()=>{await api('/notes',{method:'POST',body:{note}});$('studio-note').value='';await refresh();status('Story note saved for this manuscript.');});});
audio.addEventListener('play',()=>{if((state.reading||state.readPhase==='paused')&&state.loadedAudio?.sectionId===state.sectionId&&state.loadedAudio?.revision===passage()?.revision){state.reading=true;state.readPhase='playing';renderControls();}});
audio.addEventListener('pause',()=>{if(state.reading&&state.readPhase==='playing'&&!audio.ended)pauseReading();});
audio.addEventListener('timeupdate',()=>{if(state.reading&&state.readPhase==='playing'&&Number.isFinite(audio.duration)&&audio.duration-audio.currentTime>0&&audio.duration-audio.currentTime<=8&&state.loadedAudio){narrationBuffer.prepare(nextAudioTarget(passage(),state.loadedAudio.part));}if(Date.now()-lastBookmark>5000){lastBookmark=Date.now();saveBookmark();}});
audio.addEventListener('error',()=>{if(state.reading&&state.loadedAudio)pause('Audio playback failed. Press Read to retry the saved passage.');});
function resetWorkspace(){
 closeReviewDialogs();readingComfort.setFocus(false);pause('');voice.close();voiceStarting=false;taskController?.abort();contextController?.abort();
 setBookOpen(false);state.bookSaving=false;state.bookCreating=false;state.accessChecking=false;state.authEpoch++;state.savedChapter=null;if($('book-version-dialog').open)$('book-version-dialog').close();$('book-name').value='';bookNotice('');
 state.goalDirty=false;state.pendingNavigationDrafts=null;state.originalChapter=null;state.epoch++;Object.assign(state,{id:'',data:null,sectionId:'',original:false,reading:false,task:null,polling:false,lastTask:null,resume:null,scope:'book',requestMode:'discuss',manualSaving:false,requestStarting:false,flowJob:null,walkthrough:false,proposal:null,ignoredProposal:'',proposalApplying:false});
 resetAudio();setNotebookView('chat');$('book-reader').hidden=true;
 for(const id of ['studio-pages','studio-messages','studio-versions','studio-notes-list','studio-chapter','notebook-outline'])$(id).replaceChildren();
 for(const id of ['studio-input','studio-note','studio-goal','author-request-text'])$(id).value='';
 for(const id of ['studio-status','studio-location','studio-recap','studio-return-copy','studio-return-title','notebook-job-copy','author-request-status','notebook-source-name'])$(id).textContent='';
 $('studio-narration-voice').value='marin';$('studio-narration-preset').value='natural';$('studio-narration-direction').value=NARRATION_PRESETS.natural;state.readSettings=null;$('studio-readback').checked=true;$('author-request-scope').value='book';$('studio-voice-status').textContent='Voice is off · typing works too';$('studio-voice').setAttribute('aria-pressed','false');$('studio-voice').textContent='◉ Talk with Johnny';
 $('studio-bookmark-warning').hidden=true;$('studio-bookmark-warning').textContent='';
 $('notebook-source').hidden=true;$('notebook-job-progress').hidden=true;$('notebook-proposal').hidden=true;$('studio-progress').hidden=true;$('studio-retry').hidden=true;
 renderControls();
}
$('studio-goal').addEventListener('input',()=>{state.goalDirty=true;});
document.addEventListener('story-restore-navigation-drafts',event=>{if(event.detail.projectId!==state.id)return;if(state.data)restoreNavigationDrafts(event.detail.values);else state.pendingNavigationDrafts=event.detail.values;});
document.addEventListener('story-add-chapter-context',event=>{event.detail.bookId=state.data?.bookDrafts?.book?.id||null;});
document.addEventListener('story-workspace-check',event=>{if(state.task==='starting')event.detail.starting=true;});
document.addEventListener('story-workspace-reset',resetWorkspace);
document.addEventListener('story-reader-connection',event=>{if(event.detail.id!==state.id)return;state.connection=event.detail.state;renderEditorialProgress();});
document.addEventListener('story-reader-project',event=>{
 const {id,busy}=event.detail;state.connection='connected';state.flowJob=event.detail.job||null;
 if(id!==state.id){closeReviewDialogs();state.manualSaving=false;state.requestStarting=false;setBookOpen(false);state.bookSaving=false;state.bookCreating=false;state.accessChecking=false;state.authEpoch++;state.savedChapter=null;if($('book-version-dialog').open)$('book-version-dialog').close();$('book-name').value='';bookNotice('');pause('');voice.close();voiceStarting=false;taskController?.abort();contextController?.abort();state.epoch++;state.goalDirty=false;state.pendingNavigationDrafts=null;state.originalChapter=null;state.id=id||'';state.flowJob=event.detail.job||null;state.walkthrough=false;state.scope='book';state.requestMode='discuss';state.proposal=null;state.proposalApplying=false;state.ignoredProposal='';try{state.ignoredProposal=window.localStorage?.getItem('johnny-notebook-dismissed-'+state.id)||'';}catch{}setNotebookView('chat');state.data=null;state.sectionId='';state.task=null;state.polling=false;state.lastTask=null;state.original=false;state.resume=null;resetAudio();$('book-reader').hidden=!id;$('studio-voice-status').textContent='Voice is off · typing works too';$('studio-voice').setAttribute('aria-pressed','false');$('studio-voice').textContent='◉ Talk with Johnny';renderControls();if(id)void run(()=>refresh({initial:true}));}
 else if(state.data&&state.data.busy!==!!busy)void run(()=>refresh());
 renderNotebook();
});
document.addEventListener('story-chapters-saved',event=>{if(event.detail.projectId===state.id){pause('Chapter structure updated. Opening the current draft…');void run(()=>refresh());}});
window.addEventListener('pagehide',()=>{persistManualDraft();pause('');voice.close();taskController?.abort();});
$('author-request-submit').addEventListener('click',()=>{
 const request=$('author-request-text').value,scope=$('author-request-scope').value;
 if(!request){$('author-request-status').textContent='Describe the change you want first.';return;}
 if(scope==='chapter'&&chapters().length<2){$('author-request-status').textContent='This import has one chapter. Organize chapters first, or explicitly choose Whole book.';return;}
 pause('');document.dispatchEvent(new CustomEvent('story-author-request',{detail:{projectId:state.id,request,chapter:scope==='chapter'?chapter()?.index:undefined}}));
});
document.addEventListener('story-author-request-result',event=>{$('author-request-status').textContent=event.detail.message;$('author-request-submit').disabled=event.detail.busy;});
$('notebook-tools').addEventListener('click',()=>$('notebook-tools-dialog').showModal());
$('notebook-chat-tab').addEventListener('click',()=>setNotebookView('chat'));
$('notebook-draft-tab').addEventListener('click',()=>setNotebookView('draft'));
$('notebook-original').addEventListener('click',()=>{pause('Your imported original is preserved here.');state.original=true;state.originalChapter=null;renderDraft();renderControls();setNotebookView('draft');$('library-rail').classList.remove('open');$('rail-open').setAttribute('aria-expanded','false');});
$('notebook-scope').addEventListener('change',()=>{state.scope=['passage','chapter','book'].includes($('notebook-scope').value)?$('notebook-scope').value:'book';renderControls();});
$('studio-request-mode').addEventListener('change',()=>{state.requestMode=$('studio-request-mode').value==='edit'?'edit':'discuss';renderControls();});
$('notebook-next').addEventListener('click',()=>{const action=$('notebook-next').dataset.action;if(['create','resume'].includes(action)){document.dispatchEvent(new CustomEvent('story-notebook-revise',{detail:{projectId:state.id,intent:state.data.goal,resume:action==='resume'}}));return;}state.walkthrough=true;state.scope='passage';if(action==='begin'&&allPassages()[0])selectSection(allPassages()[0].id);else renderControls();setNotebookView('draft');status('We’ll work through the manuscript together. Press Read, or tell Johnny what you want to change here.');});
$('notebook-stop-full').addEventListener('click',()=>$('autopilot-pause').click());
$('notebook-proposal-cancel').addEventListener('click',dismissProposal);
$('notebook-proposal-apply').addEventListener('click',()=>{if(!state.proposal||state.proposalApplying)return;state.proposalApplying=true;renderNotebook();document.dispatchEvent(new CustomEvent('story-author-request',{detail:{projectId:state.id,request:state.proposal.request}}));});
for(const [id,text] of [['notebook-suggest-story','What does this manuscript need most to become a strong, finished work?'],['notebook-suggest-arc','Help me think through the emotional arc of this manuscript. Do not change the draft yet.']])$(id).addEventListener('click',()=>{state.scope='book';state.requestMode='discuss';renderControls();$('studio-input').value=text;$('studio-input').focus();});
document.addEventListener('story-author-request-result',event=>{if(event.detail.projectId&&event.detail.projectId!==state.id)return;if(event.detail.started)dismissProposal();else if(event.detail.busy===false){state.proposalApplying=false;renderNotebook();}});
setNotebookView('chat');renderAccess();
document.dispatchEvent(new CustomEvent('story-studio-ready'));
