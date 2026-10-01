const apiBase = String(window.JOHNNY_CHAT_API_BASE_URL || location.origin).replace(/\/+$/, '');
const $ = id => document.getElementById(id);
let projectId = '', book = null, selected = 0, epoch = 0, controller = null, audioUrl = '', playing = false;
const audio = $('reader-audio');
function headers(json = false) {
  const cookie = document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('gpt54_session='));
  return { ...(cookie ? {Authorization:`Bearer ${decodeURIComponent(cookie.slice('gpt54_session='.length))}`} : {}), ...(json ? {'Content-Type':'application/json'} : {}) };
}
function stop(message = '') {
  epoch++; controller?.abort(); controller = null; playing = false;
  audio.pause(); audio.removeAttribute('src'); audio.load(); audio.hidden = true;
  if (audioUrl) URL.revokeObjectURL(audioUrl); audioUrl = '';
  $('reader-stop').hidden = true; $('reader-listen').disabled = false;
  $('reader-status').textContent = message;
}
function chapterView() {
  stop(); const chapter = book?.chapters[selected];
  if (!chapter) return;
  $('reader-chapter').value = String(selected);
  $('reader-prev').disabled = selected === 0;
  $('reader-next').disabled = selected === book.chapters.length - 1;
  $('reader-listen-next').hidden = selected === book.chapters.length - 1;
  $('reader-pages').replaceChildren();
  const heading = document.createElement('h3'); heading.textContent = chapter.title; $('reader-pages').append(heading);
  for (const block of chapter.blocks) {
    const paragraph = document.createElement(block.kind === 'scene' ? 'h4' : 'p');
    paragraph.textContent = block.text; $('reader-pages').append(paragraph);
  }
}
async function openBook() {
  stop(); const id = projectId, ticket = epoch; $('reader-open').disabled = true;
  $('reader-body').hidden = false; $('reader-status').textContent = 'Opening your finished draft…';
  for (const id of ['reader-chapter','reader-prev','reader-next','reader-listen','reader-listen-next']) $(id).disabled = true;
  try {
    const response = await fetch(`${apiBase}/api/story-editor/projects/${encodeURIComponent(id)}/reader`, {headers:headers()});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The book could not be opened.');
    if (ticket !== epoch || id !== projectId) return;
    if (!data.completed) throw new Error('The manuscript is still being edited.');
    book = data; selected = 0;
    $('reader-chapter').replaceChildren(...data.chapters.map((c,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=c.title;return option;}));
    if (!data.chapters.length) throw new Error('This book has no readable chapters.');
    $('reader-chapter').disabled = false; $('reader-listen-next').disabled = false;
    chapterView(); $('reader-open').textContent = 'Reopen book';
  } catch(error) { if(ticket===epoch) $('reader-status').textContent=error.message; }
  finally { $('reader-open').disabled=false; }
}
async function playPart(part, ticket) {
  const chapter = book.chapters[selected];
  $('reader-status').textContent = `Preparing ${chapter.title}${chapter.partCount > 1 ? ` · part ${part+1} of ${chapter.partCount}` : ''}…`;
  controller = new AbortController();
  try {
    const response = await fetch(`${apiBase}/api/story-editor/projects/${encodeURIComponent(projectId)}/chapters/${chapter.index}/speech`, {method:'POST',headers:headers(true),signal:controller.signal,body:JSON.stringify({part,revision:chapter.revision})});
    if (!response.ok) {const data=await response.json();throw new Error(data.error || 'Narration could not be loaded.');}
    const blob = await response.blob();
    if(ticket!==epoch) return;
    if(audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl=URL.createObjectURL(blob);audio.src=audioUrl;audio.hidden=false;
    audio.onended=()=>{
      if(ticket!==epoch || !playing) return;
      if(part+1 < chapter.partCount) void playPart(part+1,ticket);
      else {playing=false;$('reader-stop').hidden=true;$('reader-listen').disabled=false;$('reader-status').textContent=`${chapter.title} finished. Choose “Listen to next chapter” when you’re ready.`;if(selected===book.chapters.length-1)$('reader-status').textContent='You’ve reached the end of the book.';}
    };
    $('reader-status').textContent=`${chapter.title}${chapter.partCount>1 ? ` · part ${part+1} of ${chapter.partCount}` : ''}. Playback stops at the end of this chapter.`;
    try {await audio.play();} catch { $('reader-status').textContent='Your chapter is ready. Press Play in the audio controls to listen.'; }
  } catch(error) {
    if(ticket!==epoch || error.name==='AbortError') return;
    stop(error.message + ' Choose “Listen to this chapter” to retry.');
  }
}
function listen() {
  if(!book?.chapters[selected]) return;
  stop(); playing=true;$('reader-stop').hidden=false;$('reader-listen').disabled=true;
  void playPart(0,epoch);
}
document.addEventListener('story-reader-project', event=>{
  const {id,completed}=event.detail;
  if(id!==projectId || !completed) {stop();book=null;selected=0;$('reader-body').hidden=true;$('reader-pages').replaceChildren();$('reader-open').textContent='Open book';}
  projectId=id || '';$('book-reader').hidden=!completed;
});
$('reader-open').addEventListener('click',openBook);
$('reader-chapter').addEventListener('change',()=>{selected=Number($('reader-chapter').value);chapterView();});
$('reader-prev').addEventListener('click',()=>{selected--;chapterView();});
$('reader-next').addEventListener('click',()=>{selected++;chapterView();});
$('reader-listen').addEventListener('click',listen);
$('reader-stop').addEventListener('click',()=>stop('Listening stopped.'));
$('reader-listen-next').addEventListener('click',()=>{if(book && selected+1<book.chapters.length){selected++;chapterView();listen();}});
audio.addEventListener('error',()=>{if(playing)stop('Audio playback failed. Choose “Listen to this chapter” to retry.');});
window.addEventListener('pagehide',()=>stop());

$('author-request-submit').addEventListener('click',()=>{
  const request=$('author-request-text').value.trim();
  const scope=$('author-request-scope').value;
  if(!request) {$('author-request-status').textContent='Describe the change you want first.';return;}
  if(scope==='chapter' && !book?.chapters[selected]) {$('author-request-status').textContent='Open the book and select the chapter first.';return;}
  stop();
  document.dispatchEvent(new CustomEvent('story-author-request',{detail:{projectId,request,chapter:scope==='chapter'?book.chapters[selected].index:undefined}}));
});
document.addEventListener('story-author-request-result',event=>{
  $('author-request-status').textContent=event.detail.message;
  $('author-request-submit').disabled=event.detail.busy;
});
