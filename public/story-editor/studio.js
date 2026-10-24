import {notebookJourney,notebookReference} from './notebook-model.mjs?v=20261021-notebook1';
import {speechParts} from './reader-model.mjs';
import {chapterAudio} from './reader-speech.mjs?v=20261021-journey3';
import {StudioVoice} from './studio-voice.mjs?v=20261021-journey3';
const $=id=>document.getElementById(id);
const origin=String(window.JOHNNY_CHAT_API_BASE_URL||location.origin).replace(/\/+$/,'');
const state={id:'',data:null,sectionId:'',original:false,epoch:0,audioEpoch:0,reading:false,task:null,polling:false,lastTask:null,resume:null,audioUrl:'',loadedAudio:null,scope:'book',flowJob:null,walkthrough:false,proposal:null,ignoredProposal:'',proposalApplying:false};
const audio=$('studio-audio');let speechController,taskController,contextController,voiceStarting=false,lastBookmark=0;
const phaseLabels={reading:'Reading the current manuscript and rebuilding only changed continuity notes…',queued:'Waiting for the editor…',planning:'Understanding your intent and the scene’s place in the story…',drafting:'Writing the passage with character, voice, and emotional depth…',reviewing:'Independently checking depth, continuity, subtext, and what changed…',refining:'Refining the prose against the critique before saving…'};
const status=text=>$('studio-status').textContent=text;
function auth(){const cookie=document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('gpt54_session='));return cookie?{Authorization:`Bearer ${decodeURIComponent(cookie.slice(14))}`}:{ };}
const base=(id=state.id)=>`${origin}/api/story-editor/projects/${encodeURIComponent(id)}/studio`;
async function api(path='',{method='GET',body,signal,id=state.id}={}){
 const response=await fetch(base(id)+path,{method,headers:{...auth(),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),keepalive:path==='/bookmark',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});
 const data=await response.json().catch(()=>({error:'The studio returned an unreadable response. Your saved draft is safe; refresh to reconnect.'}));
 if(!response.ok)throw Error(data.error||'The studio could not connect. Refresh to try again.');return data;
}
const chapters=()=>state.data?.chapters||[];
const allPassages=()=>chapters().flatMap(c=>c.passages);
const passage=()=>allPassages().find(p=>p.id===state.sectionId);
const chapter=()=>chapters().find(c=>c.passages.some(p=>p.id===state.sectionId));
function saveBookmark(){
 const p=passage();if(!p||!state.id||state.original)return;
 const position=state.loadedAudio?.sectionId===p.id&&state.loadedAudio.revision===p.revision?{...state.loadedAudio,seconds:audio.currentTime||0}:state.resume||{sectionId:p.id,revision:p.revision,part:0,seconds:0};
 if(!position||position.sectionId!==p.id||position.revision!==p.revision)return;
 state.resume={...position};void api('/bookmark',{method:'PUT',body:position}).catch(()=>{});
}
function pause(message='Paused here. Tell Johnny what you want to explore or change.',interrupt=true){
 saveBookmark();state.reading=false;state.audioEpoch++;speechController?.abort();speechController=null;audio.pause();if(interrupt)voice.interrupt();renderControls();if(message)status(message);
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
function renderNotebook(){
 const data=state.data,p=passage(),c=chapter(),hasRevision=allPassages().some(p=>p.original!==p.text);
 const flow=notebookJourney({job:state.flowJob,busy:data?.busy,bookmark:data?.bookmark,hasRevision,walkthrough:state.walkthrough});
 $('notebook-step-title').textContent=flow.title;$('notebook-step-copy').textContent=flow.copy;$('notebook-next').textContent=flow.label;$('notebook-next').disabled=!p||flow.action==='working'||!!state.task;$('notebook-next').dataset.action=flow.action;
 for(const step of ['source','revision','together']){const node=$('notebook-stage-'+step);node.setAttribute('aria-current',flow.step===step?'step':'false');node.classList.toggle('done',['source','revision','together'].indexOf(step)<['source','revision','together'].indexOf(flow.step));}
 $('notebook-job-progress').hidden=flow.action!=='working';$('notebook-job-meter').value=flow.progress;$('notebook-job-copy').textContent=flow.detail||'';
 $('notebook-source').hidden=!data;$('notebook-source-name').textContent=data?.title||'';$('notebook-scope').value=state.scope;$('studio-input').placeholder=state.scope==='book'?'Ask about the whole manuscript, or describe a change throughout…':'Tell Johnny what you want to change in this passage…';
 $('notebook-chat-intro').hidden=!!data?.messages.length||!!state.task;$('notebook-saved').textContent=state.task?'Editing…':'Saved';
 const outline=$('notebook-outline');outline.replaceChildren();for(const item of chapters()){const button=document.createElement('button');button.type='button';button.textContent=item.title;button.setAttribute('aria-current',String(c?.index===item.index));button.addEventListener('click',()=>{selectSection(item.passages[0].id);setNotebookView('draft');$('library-rail').classList.remove('open');$('rail-open').setAttribute('aria-expanded','false');});outline.append(button);}
 const proposal=state.proposal;$('notebook-proposal').hidden=!proposal;$('notebook-proposal-copy').textContent=proposal?.request||'';$('notebook-proposal-apply').disabled=state.proposalApplying||!!data?.busy||!!state.task;
}
function renderNotes(){
 $('studio-notes-count').textContent=state.data?.notes.length?`(${state.data.notes.length})`:'';$('studio-notes-list').replaceChildren();
 for(const note of state.data?.notes||[]){const li=document.createElement('li'),text=document.createElement('span'),button=document.createElement('button');text.textContent=note.text;button.type='button';button.textContent='Remove';button.setAttribute('aria-label','Remove this story note');button.addEventListener('click',()=>void run(async()=>{await api('/notes/'+encodeURIComponent(note.id),{method:'DELETE'});await refresh();status('Story note removed.');}));li.append(text,button);$('studio-notes-list').append(li);}
}
function renderHistory(){
 const versions=(state.data?.versions||[]).filter(v=>v.sectionId===state.sectionId),container=$('studio-versions');container.replaceChildren();
 for(const version of versions){const p=document.createElement('p');p.textContent=`${new Date(version.createdAt).toLocaleString()} · ${version.undoneAt?'Undone · ':''}${version.instruction}`;container.append(p);}
 if(!versions.length)container.textContent='Studio changes will appear here. Your imported original remains available in its own tab.';
 $('studio-undo').disabled=!versions.some(v=>!v.undoneAt)||!!state.task||!!state.data?.busy;
}
function renderDraft({scroll=false}={}){
 const p=passage(),c=chapter(),container=$('studio-pages');
 $('studio-current').setAttribute('aria-pressed',String(!state.original));$('studio-original').setAttribute('aria-pressed',String(state.original));
 $('studio-navigation').hidden=state.original;$('studio-original-export').hidden=!state.original;
 $('studio-version-hint').textContent=state.original?'Your imported original, preserved separately from the current draft.':'Choose any passage to work on it. The highlighted passage is where Johnny is listening with you.';
 container.replaceChildren();
 if(state.original){const text=document.createElement('div');text.className='studio-original-text';text.textContent=state.data?.original||'';container.append(text);return;}
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
 if(document.activeElement!==$('studio-goal'))$('studio-goal').value=state.data?.goal||'';
 $('studio-goal-save').disabled=!!state.task||!!state.data?.busy;
}
function renderControls(){renderJourney();renderNotebook();const ready=!!passage();$('studio-read').disabled=!ready||state.reading;$('studio-send').disabled=!ready||!!state.task||!!state.data?.busy;$('studio-input').disabled=!!state.task||!!state.data?.busy;$('studio-voice').disabled=!ready||voiceStarting;$('studio-progress').hidden=!state.task;$('studio-retry').hidden=!state.lastTask||!!state.task;renderHistory();}
async function updateVoiceContext(){if(!voice.connected||!passage())return;const id=state.id,sectionId=state.sectionId,ticket=state.epoch;contextController?.abort();contextController=new AbortController();try{const data=await api('/context?'+new URLSearchParams({sectionId}),{signal:contextController.signal});if(ticket===state.epoch&&sectionId===state.sectionId&&id===state.id)voice.updateContext(data.instructions);}catch(error){if(error.name!=='AbortError')status('The draft is open, but voice context could not refresh. Reconnect voice before asking for another edit.');}}
function selectSection(id,{scroll=true,stop=true}={}){if(!allPassages().some(p=>p.id===id))throw Error('That passage is not in this manuscript.');if(stop){pause('');state.scope='passage';}state.original=false;state.sectionId=id;state.resume=null;state.loadedAudio=null;renderDraft({scroll});renderControls();void updateVoiceContext();const p=passage();void api('/bookmark',{method:'PUT',body:{sectionId:id,revision:p.revision,part:0,seconds:0}}).catch(()=>{});}
async function refresh({initial=false,resumePending=true,fromTask=false}={}){
 const id=state.id,ticket=state.epoch;if(!id)return;const data=await api('',{id});if(ticket!==state.epoch||id!==state.id)return;
 const before=passage()?.revision;state.data=data;if(data.lastTask?.result?.action==='revise_book'&&data.lastTask.id!==state.ignoredProposal)state.proposal={id:data.lastTask.id,...data.lastTask.result};
 if(!allPassages().some(p=>p.id===state.sectionId))state.sectionId=data.bookmark?.sectionId&&allPassages().some(p=>p.id===data.bookmark.sectionId)?data.bookmark.sectionId:allPassages()[0]?.id||'';
 if(initial&&data.bookmark?.sectionId===state.sectionId&&passage())state.resume={...data.bookmark,revision:passage().revision,...(data.bookmark.revision!==passage().revision?{part:0,seconds:0}:{})};
 if(before&&passage()?.revision!==before){if(fromTask){state.reading=false;speechController?.abort();}else pause('The draft was updated. Read from here to hear the saved version.');state.resume=null;resetAudio();}
 renderDraft();renderConversation();renderNotes();renderControls();
 if(resumePending){if(data.task&&(!state.task||!state.polling))void resumeTask(data.task.id);else if(state.task&&!state.polling)void resumeTask(state.task);}
 if(initial&&data.lastTask&&['failed','cancelled'].includes(data.lastTask.status)){state.lastTask=data.lastTask.id;renderControls();status(data.lastTask.error||'An earlier request stopped. Retry can resume its completed passes.');}
 if(initial&&!data.task&&!state.lastTask)status(data.busy?'Your full edit is working. You can read the draft; passage changes will be available when it finishes or is paused.':(data.bookmark?'Welcome back. Your saved place is open; continue here or read one passage earlier.':'Your draft is open. We’ll work through your whole story toward the finished work you want.'));
 void updateVoiceContext();
}
async function run(fn){try{await fn();}catch(error){if(error.name!=='AbortError')status(error.message||'That action could not finish. Your saved draft is safe.');}}
async function playPart(part,ticket,seek=0){
 const p=passage(),c=chapter(),id=state.id,projectTicket=state.epoch;if(!p||!state.reading)return;
 const parts=speechParts(p.text);state.resume={sectionId:p.id,revision:p.revision,part,seconds:seek};resetAudio();speechController=new AbortController();status(`Preparing ${c.title} · passage ${c.passages.indexOf(p)+1}…`);
 try{
  const blob=await chapterAudio(base(id)+'/speech',{sectionId:p.id,part,revision:p.revision,headers:{...auth(),'Content-Type':'application/json'},signal:speechController.signal,onPending:()=>{if(ticket===state.audioEpoch)status(`Preparing the saved passage for reading… You can pause at any time.`);}});
  if(ticket!==state.audioEpoch||projectTicket!==state.epoch||!state.reading||state.sectionId!==p.id)return;
  state.audioUrl=URL.createObjectURL(blob);audio.src=state.audioUrl;audio.hidden=false;state.loadedAudio={sectionId:p.id,revision:p.revision,part,seconds:seek};
  if(seek)audio.addEventListener('loadedmetadata',()=>{if(ticket===state.audioEpoch)audio.currentTime=Math.min(seek,Number.isFinite(audio.duration)?Math.max(0,audio.duration-0.1):seek);},{once:true});
  audio.onended=()=>{
   if(ticket!==state.audioEpoch||!state.reading)return;
   if(part+1<parts.length)void playPart(part+1,ticket);
   else{const all=allPassages(),next=all[all.findIndex(item=>item.id===p.id)+1];if(next){selectSection(next.id,{stop:false});void playPart(0,ticket);}else{pause('You’ve reached the end of the current draft. Your place is saved. We can review, revise, or discuss what it needs before you call it finished.');state.resume=null;}}
  };
  status(`Reading ${c.title} · passage ${c.passages.indexOf(p)+1}. ${voice.connected?'Speak to interrupt.':'Press Pause to stop here.'}`);
  try{await audio.play();}catch{status('Your passage is ready. Press Play in the audio controls to listen.');}
 }catch(error){if(ticket!==state.audioEpoch||projectTicket!==state.epoch||error.name==='AbortError')return;pause(error.message+' Press Read to retry this passage.');}
}
async function read({restart=false}={}){if(!passage()||state.reading)return;setNotebookView('draft');pause('');state.original=false;renderDraft({scroll:true});const p=passage(),resume=!restart&&state.resume?.sectionId===p.id&&state.resume?.revision===p.revision?state.resume:null;state.reading=true;renderControls();await playPart(resume?.part||0,state.audioEpoch,resume?.seconds||0);}
function renderPhase(task){$('studio-progress-copy').textContent=phaseLabels[task.phase]||phaseLabels.queued;const names=['planning','drafting','reviewing','refining'],index=names.indexOf(task.phase);for(const li of $('studio-progress').querySelectorAll('li')){li.classList.toggle('current',li.dataset.pass===task.phase);li.classList.toggle('done',names.indexOf(li.dataset.pass)<index);}status(phaseLabels[task.phase]||phaseLabels.queued);}
async function pollTask(taskId,{readTicket=state.audioEpoch,requestedSection=state.sectionId}={}){
 const ticket=state.epoch,id=state.id;taskController?.abort();taskController=new AbortController();const signal=taskController.signal;let failures=0;
 const end=Date.now()+46*60*1000;state.polling=true;
 try{while(Date.now()<end){
  if(ticket!==state.epoch||signal.aborted)return;
  let data;try{data=await api('/tasks/'+encodeURIComponent(taskId),{id,signal});failures=0;}catch(error){if(signal.aborted)return;if(++failures>=3)throw Error('The connection was interrupted. Your request is saved; Refresh draft will reconnect without starting another edit.');await delay(2000,signal);continue;}
  if(ticket!==state.epoch)return;
  const task=data.task;renderPhase(task);
  if(['failed','cancelled'].includes(task.status)){state.task=null;state.lastTask=taskId;renderControls();await refresh();status(task.error||'This request stopped. Retry can resume completed passes.');return {ok:false,error:task.error};}
  if(task.status==='done'){
   state.task=null;state.lastTask=null;await refresh({resumePending:false,fromTask:true});if(ticket!==state.epoch)return;
   const result=task.result;status(result.reply);document.dispatchEvent(new CustomEvent('story-studio-saved',{detail:{projectId:id}}));
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
 onStatus:text=>{voiceStarting=false;$('studio-voice-status').textContent=text;$('studio-voice').setAttribute('aria-pressed',String(voice.connected));$('studio-voice').textContent=voice.connected?'◉ End voice':'◉ Talk with Johnny';renderControls();},
 onError:error=>{voiceStarting=false;$('studio-voice-status').textContent='Voice is off · typing works too';$('studio-voice').setAttribute('aria-pressed','false');$('studio-voice').textContent='◉ Talk with Johnny';renderControls();status(error.message);},
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
$('studio-goal-form').addEventListener('submit',event=>{event.preventDefault();void run(async()=>{await api('/goal',{method:'PUT',body:{goal:$('studio-goal').value}});await refresh();status('Your destination is saved for this whole manuscript. We’ll keep working toward it when you return.');});});
$('studio-read').addEventListener('click',()=>void run(()=>read()));
$('studio-pause').addEventListener('click',()=>pause());
$('studio-voice').addEventListener('click',()=>{if(voice.connected||voiceStarting){pause('Voice ended. Your draft and conversation stay saved.');voice.close();voiceStarting=false;$('studio-voice').setAttribute('aria-pressed','false');$('studio-voice').textContent='◉ Talk with Johnny';$('studio-voice-status').textContent='Voice is off · typing works too';renderControls();}else{pause('Narration paused. Connecting voice…');voiceSession=crypto.randomUUID();voiceStarting=true;renderControls();void voice.connect();}});
$('studio-current').addEventListener('click',()=>{state.original=false;renderDraft();});
$('studio-original').addEventListener('click',()=>{pause('Your original is preserved here. Switch to Current draft to continue the collaboration.');state.original=true;renderDraft();});
$('studio-original-export').addEventListener('click',()=>$('download-original').click());
$('studio-chapter').addEventListener('change',()=>{const c=chapters().find(c=>c.index===Number($('studio-chapter').value));if(c)selectSection(c.passages[0].id);});
for(const [id,direction] of [['studio-prev',-1],['studio-next',1]])$(id).addEventListener('click',()=>{const all=allPassages(),index=all.findIndex(p=>p.id===state.sectionId);if(all[index+direction])selectSection(all[index+direction].id);});
$('studio-refresh').addEventListener('click',()=>void run(async()=>{await refresh();if(!state.task)status('Your saved draft is up to date.');}));
$('studio-compose').addEventListener('submit',event=>{event.preventDefault();const text=$('studio-input').value;if(!text.trim()){$('studio-input').focus();return;}void run(async()=>{const result=await sendRequest(text);if(result?.ok)$('studio-input').value='';});});
$('studio-undo').addEventListener('click',()=>void run(undo));
$('studio-cancel').addEventListener('click',()=>void run(async()=>{pause('Stopping this edit…');if(state.task)await api('/tasks/'+encodeURIComponent(state.task)+'/cancel',{method:'POST',body:{}});}));
$('studio-retry').addEventListener('click',()=>void run(async()=>{const id=state.lastTask;if(!id)return;pause('');const data=await api('/tasks/'+encodeURIComponent(id)+'/retry',{method:'POST',body:{}});state.lastTask=null;state.task=data.task.id;renderControls();await pollTask(data.task.id);}));
$('studio-note-form').addEventListener('submit',event=>{event.preventDefault();const note=$('studio-note').value.trim();if(note)void run(async()=>{await api('/notes',{method:'POST',body:{note}});$('studio-note').value='';await refresh();status('Story note saved for this manuscript.');});});
audio.addEventListener('timeupdate',()=>{if(Date.now()-lastBookmark>5000){lastBookmark=Date.now();saveBookmark();}});
audio.addEventListener('error',()=>{if(state.reading&&state.loadedAudio)pause('Audio playback failed. Press Read to retry the saved passage.');});
document.addEventListener('story-reader-project',event=>{
 const {id,busy}=event.detail;state.flowJob=event.detail.job||null;
 if(id!==state.id){pause('');voice.close();voiceStarting=false;taskController?.abort();contextController?.abort();state.epoch++;state.id=id||'';state.flowJob=event.detail.job||null;state.walkthrough=false;state.scope='book';state.proposal=null;state.proposalApplying=false;state.ignoredProposal='';try{state.ignoredProposal=window.localStorage?.getItem('johnny-notebook-dismissed-'+state.id)||'';}catch{}setNotebookView('chat');state.data=null;state.sectionId='';state.task=null;state.polling=false;state.lastTask=null;state.original=false;state.resume=null;resetAudio();$('book-reader').hidden=!id;$('studio-voice-status').textContent='Voice is off · typing works too';$('studio-voice').setAttribute('aria-pressed','false');$('studio-voice').textContent='◉ Talk with Johnny';renderControls();if(id)void run(()=>refresh({initial:true}));}
 else if(state.data&&state.data.busy!==!!busy)void run(()=>refresh());
 renderNotebook();
});
document.addEventListener('story-chapters-saved',event=>{if(event.detail.projectId===state.id){pause('Chapter structure updated. Opening the current draft…');void run(()=>refresh());}});
window.addEventListener('pagehide',()=>{pause('');voice.close();taskController?.abort();});
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
$('notebook-original').addEventListener('click',()=>{pause('Your imported original is preserved here.');state.original=true;renderDraft();setNotebookView('draft');$('library-rail').classList.remove('open');$('rail-open').setAttribute('aria-expanded','false');});
$('notebook-scope').addEventListener('change',()=>{state.scope=$('notebook-scope').value==='passage'?'passage':'book';renderControls();});
$('notebook-next').addEventListener('click',()=>{const action=$('notebook-next').dataset.action;if(['create','resume'].includes(action)){document.dispatchEvent(new CustomEvent('story-notebook-revise',{detail:{projectId:state.id,intent:state.data.goal,resume:action==='resume'}}));return;}state.walkthrough=true;state.scope='passage';if(action==='begin'&&allPassages()[0])selectSection(allPassages()[0].id);else renderControls();setNotebookView('draft');status('We’ll work through the manuscript together. Press Read, or tell Johnny what you want to change here.');});
$('notebook-stop-full').addEventListener('click',()=>$('autopilot-pause').click());
$('notebook-proposal-cancel').addEventListener('click',dismissProposal);
$('notebook-proposal-apply').addEventListener('click',()=>{if(!state.proposal||state.proposalApplying)return;state.proposalApplying=true;renderNotebook();document.dispatchEvent(new CustomEvent('story-author-request',{detail:{projectId:state.id,request:state.proposal.request}}));});
for(const [id,text] of [['notebook-suggest-story','What does this manuscript need most to become a strong, finished work?'],['notebook-suggest-arc','Help me think through the emotional arc of this manuscript. Do not change the draft yet.']])$(id).addEventListener('click',()=>{state.scope='book';$('notebook-scope').value='book';$('studio-input').value=text;$('studio-input').focus();});
document.addEventListener('story-author-request-result',event=>{if(event.detail.projectId&&event.detail.projectId!==state.id)return;if(event.detail.started)dismissProposal();else if(event.detail.busy===false){state.proposalApplying=false;renderNotebook();}});
setNotebookView('chat');
document.dispatchEvent(new CustomEvent('story-studio-ready'));
