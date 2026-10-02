const $=id=>document.getElementById(id);
const apiBase=String(window.JOHNNY_CHAT_API_BASE_URL || location.origin).replace(/\/+$/,'');
let projectId='',layout=null,draft=[],saving=false,epoch=0,split=null,splitSaving=false;
function headers() {
 const cookie=document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('gpt54_session='));
 return {'Content-Type':'application/json',...(cookie?{Authorization:`Bearer ${decodeURIComponent(cookie.slice(14))}`}:{})};
}
async function request(id,options={},suffix='/chapter-layout') {
 const r=await fetch(`${apiBase}/api/story-editor/projects/${encodeURIComponent(id)}${suffix}`,{headers:headers(),...options});
 const data=await r.json();if(!r.ok) throw new Error(data.error || 'Chapter organization could not be saved.');return data;
}
function render() {
 $('passage-split-select').replaceChildren(...layout.passages.filter(p=>p.kind==='paragraph').map(p=>{const option=document.createElement('option');option.value=p.id;option.textContent=p.preview.replace(/\s+/g,' ');return option;}));
 $('passage-split-open').disabled=false;
 const rows=$('chapter-layout-rows');rows.replaceChildren();
 draft.forEach((boundary,i)=>{
  const row=document.createElement('div');row.className='chapter-layout-row';
  const nameLabel=document.createElement('label');nameLabel.textContent=`Chapter ${i+1} name`;
  const name=document.createElement('input');name.value=boundary.title;name.maxLength=110;name.required=true;
  name.addEventListener('input',()=>boundary.title=name.value);nameLabel.append(name);row.append(nameLabel);
  const startLabel=document.createElement('label');startLabel.textContent='Starts before';
  const select=document.createElement('select');select.disabled=i===0;
  const previous=i?layout.passages.findIndex(p=>p.id===draft[i-1].startId):-1;
  const next=i+1<draft.length?layout.passages.findIndex(p=>p.id===draft[i+1].startId):layout.passages.length;
  layout.passages.forEach((passage,j)=>{
   if((j<=previous || j>=next) && passage.id!==boundary.startId)return;
   const option=document.createElement('option');option.value=passage.id;
   option.textContent=`${j+1}. ${passage.preview.replace(/\s+/g,' ')}`;
   option.disabled=j<=previous || j>=next;select.append(option);
  });
  select.value=boundary.startId;select.addEventListener('change',()=>{boundary.startId=select.value;render();});
  startLabel.append(select);row.append(startLabel);
  const from=layout.passages.findIndex(p=>p.id===boundary.startId);
  const summary=document.createElement('p');summary.className='chapter-layout-preview';
  summary.textContent=`${layout.passages.slice(from,next).filter(p=>p.kind==='paragraph').length} saved passages · starts: ${layout.passages[from]?.preview || ''}`;
  row.append(summary);
  if(i) {const remove=document.createElement('button');remove.type='button';remove.className='ghost-button';remove.textContent='Remove this break';remove.addEventListener('click',()=>{draft.splice(i,1);render();});row.append(remove);}
  rows.append(row);
 });
 $('chapter-layout-add').disabled=draft.length>=500 || !layout.passages.some((p,i)=>p.kind==='paragraph' && i>layout.passages.findIndex(s=>s.id===draft.at(-1).startId));
}
$('chapter-layout-open').addEventListener('click',async()=>{
 const id=projectId,ticket=++epoch;$('chapter-layout-open').disabled=true;
 $('chapter-layout-message').textContent='Loading saved chapter boundaries…';$('chapter-layout-rows').replaceChildren();
 $('chapter-layout-save').disabled=true;$('chapter-layout-add').disabled=true;$('passage-split-open').disabled=true;$('chapter-layout-cancel').disabled=false;$('chapter-layout-dialog').showModal();
 try {
  const data=await request(id);
  if(ticket!==epoch || id!==projectId || !$('chapter-layout-dialog').open)return;
  if(data.busy)throw new Error('Wait for editing to finish before changing chapters.');
  layout=data;draft=data.boundaries.map(b=>({...b}));render();$('chapter-layout-save').disabled=false;
  $('chapter-layout-message').textContent='Review each start below. Cancel keeps the saved chapters unchanged.';
 } catch(e) {if(ticket===epoch)$('chapter-layout-message').textContent=e.message;}
 finally {if(ticket===epoch)$('chapter-layout-open').disabled=false;}
});
$('chapter-layout-add').addEventListener('click',()=>{
 const last=layout.passages.findIndex(p=>p.id===draft.at(-1).startId);
 const next=layout.passages.find((p,i)=>i>last && p.kind==='paragraph');
 if(next) {draft.push({startId:next.id,title:`Chapter ${draft.length+1}`});render();}
});
function cancel() {if(saving || splitSaving)return;cancelSplit();epoch++;$('chapter-layout-dialog').close();$('chapter-layout-open').disabled=!projectId;layout=null;draft=[];}
$('chapter-layout-cancel').addEventListener('click',cancel);
$('chapter-layout-dialog').addEventListener('cancel',event=>{event.preventDefault();cancel();});
$('chapter-layout-form').addEventListener('submit',async event=>{
 event.preventDefault();if(saving || !layout)return;
 saving=true;const id=projectId;
 $('chapter-layout-form').querySelectorAll('button,input,select').forEach(el=>el.disabled=true);
 try {
  await request(id,{method:'PUT',body:JSON.stringify({revision:layout.revision,boundaries:draft})});
  saving=false;cancel();
  document.dispatchEvent(new CustomEvent('story-chapters-saved',{detail:{projectId:id}}));
 } catch(e) {
  saving=false;$('chapter-layout-message').textContent=e.message+' Your saved text is unchanged. Cancel and reopen to retry.';
  $('chapter-layout-cancel').disabled=false;
 }
});
document.addEventListener('story-reader-project',event=>{
 const id=event.detail.id || '';
 if(id!==projectId) {cancel();projectId=id;}
 $('chapter-layout-open').disabled=!id || event.detail.busy;
});

function cancelSplit() {
 if(splitSaving)return;
 split=null;$('passage-split-dialog').close();
}
function previewSplit() {
 if(!split)return;
 const sides=[['original',split.originalText,split.originalOffset],['revised',split.revisedText,split.hasRevision?split.revisedOffset:split.originalOffset]];
 let ready=true;
 for(const [name,text,offset] of sides) {
  const valid=Number.isInteger(offset)&&offset>0&&offset<text.length&&text.slice(0,offset).trim()&&text.slice(offset).trim()&&(/\s/.test(text[offset-1])||/\s/.test(text[offset]));
  if(!valid)ready=false;
  $(name+'-split-before').textContent=valid?'…'+text.slice(Math.max(0,offset-180),offset):'Choose the first word of the new chapter above.';
  $(name+'-split-after').textContent=valid?text.slice(offset,offset+220)+'…':'';
 }
 $('passage-split-save').disabled=!ready;
}
$('passage-split-open').addEventListener('click',async()=>{
 if(JSON.stringify(draft)!==JSON.stringify(layout?.boundaries)) {$('chapter-layout-message').textContent='Save or cancel your chapter changes before splitting a passage.';return;}
 const id=projectId,ticket=epoch;
 $('passage-split-open').disabled=true;
 try {
  const data=await request(id,{},'/passage-split/'+encodeURIComponent($('passage-split-select').value));
  if(id!==projectId || ticket!==epoch)return;
  if(data.revision!==layout.revision)throw new Error('The manuscript changed. Cancel and reopen chapter organization.');
  split={...data,originalOffset:null,revisedOffset:null};
  $('passage-original').value=data.originalText;$('passage-revised').value=data.revisedText;
  $('passage-revised-group').hidden=!data.hasRevision;
  $('passage-split-name').value='New chapter';$('passage-split-message').textContent='Choose the corresponding chapter start in each version, then review both previews. All words stay saved.';
  $('passage-split-form').querySelectorAll('button,input,textarea').forEach(el=>el.disabled=false);
  previewSplit();$('passage-split-dialog').showModal();
 } catch(e) {$('chapter-layout-message').textContent=e.message;}
 finally {$('passage-split-open').disabled=false;}
});
for(const name of ['original','revised']) $(name+'-split-mark').addEventListener('click',()=>{
 if(!split)return;split[name+'Offset']=$('passage-'+name).selectionStart;previewSplit();
});
$('passage-split-cancel').addEventListener('click',cancelSplit);
$('passage-split-dialog').addEventListener('cancel',event=>{event.preventDefault();cancelSplit();});
$('passage-split-form').addEventListener('submit',async event=>{
 event.preventDefault();if(!split || splitSaving)return;
 splitSaving=true;const id=projectId;
 $('passage-split-form').querySelectorAll('button,input,textarea').forEach(el=>el.disabled=true);
 try {
  await request(id,{method:'POST',body:JSON.stringify({revision:split.revision,sectionId:split.sectionId,originalOffset:split.originalOffset,revisedOffset:split.hasRevision?split.revisedOffset:split.originalOffset,chapterTitle:$('passage-split-name').value})},'/passage-split');
  splitSaving=false;cancelSplit();cancel();
  document.dispatchEvent(new CustomEvent('story-chapters-saved',{detail:{projectId:id}}));
 } catch(e) {splitSaving=false;$('passage-split-message').textContent=e.message+' The save could not be confirmed. Cancel and reopen to check saved chapters before retrying.';$('passage-split-cancel').disabled=false;}
});

document.addEventListener('story-split-history',event=>{
 const parents=event.detail.sections.filter(s=>s.kind==='split-source');
 $('passage-split-history').hidden=!parents.length;$('passage-split-history-items').replaceChildren();
 for(const parent of parents) {
  const item=document.createElement('details'),title=document.createElement('summary');title.textContent='Saved passage before a split';item.append(title);
  for(const [label,text] of [['Original text',parent.originalText],['Saved revised draft',parent.editedText],...event.detail.edits.filter(edit=>edit.sectionId===parent.id).map(edit=>['Earlier editorial version',edit.suggestion])]) {
   if(!text)continue;const h=document.createElement('h4'),p=document.createElement('pre');h.textContent=label;p.textContent=text;item.append(h,p);
  }
  $('passage-split-history-items').append(item);
 }
});
