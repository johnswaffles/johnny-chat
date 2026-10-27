(function () {
  const state = { mode: 'single', busy: false, request: 0, controller: null };
  const host = location.hostname.toLowerCase();
  const apiBase = String(window.JOHNNY_CHAT_API_BASE_URL || (['localhost','127.0.0.1'].includes(host) ? location.origin : 'https://johnny-chat.onrender.com')).replace(/\/+$/, '');
  const el = {
    source: document.getElementById('source-text'), count: document.getElementById('input-count'),
    budget: document.getElementById('mode-budget'), description: document.getElementById('mode-description'),
    modes: [...document.querySelectorAll('[data-mode]')], rewrite: document.getElementById('rewrite-button'),
    result: document.getElementById('result-area'), status: document.getElementById('status-pill'),
    tone: document.getElementById('tone'), model: document.getElementById('model-label'),
    clear: document.getElementById('clear-button'), reset: document.getElementById('new-message-button'), emptyTemplate: document.getElementById('empty-state-template')
  };
  const count = value => Array.from(value).length;
  function status(text, kind = '') { el.status.textContent = text; el.status.className = `status-pill ${kind}`; }
  function empty() {
    const content = el.emptyTemplate.content.cloneNode(true);
    content.querySelector('.empty-description').textContent = state.mode === 'split'
      ? 'Two thoughtful texts, ready to review and copy separately.'
      : 'Your polished text will appear here, ready for a final touch.';
    el.result.replaceChildren(content);
    el.model.textContent = 'Your words. Thoughtfully refined.';
    status('Awaiting your draft');
  }
  function setMode(mode) {
    if (state.busy) return;
    const nextMode = mode === 'split' ? 'split' : 'single';
    const changed = state.mode !== nextMode;
    state.mode = nextMode;
    el.budget.textContent = state.mode === 'split' ? '160 per message' : '159 characters max';
    el.description.textContent = state.mode === 'split' ? 'Two complete messages, up to 160 characters each.' : 'One complete message, up to 159 characters.';
    el.modes.forEach(button => { const selected = button.dataset.mode === state.mode; button.classList.toggle('active',selected); button.setAttribute('aria-pressed',String(selected)); });
    if (changed) empty();
  }
  function sourceChanged() {
    el.count.textContent = `${el.source.value.length.toLocaleString()} / 6,000`;
    el.clear.disabled = state.busy || !el.source.value.length;
    empty();
  }
  function busy(value) {
    state.busy = value; el.rewrite.disabled = value; el.source.disabled = value; el.tone.disabled = value;
    el.clear.disabled = value || !el.source.value.length;
    [...el.modes,...document.querySelectorAll('[data-example]')].forEach(button => button.disabled = value);
    el.rewrite.querySelector('span').textContent = value ? 'Polishing…' : 'Polish message';
    el.result.setAttribute('aria-busy',String(value));
  }
  function newMessage() {
    state.request += 1;
    state.controller?.abort();
    state.controller = null;
    busy(false);
    el.source.value = '';
    el.source.style.height = '';
    el.tone.value = 'warm';
    setMode('single');
    sourceChanged();
    const help = document.querySelector('.message-help');
    if (help) help.open = false;
    el.source.scrollTop = 0;
    el.source.focus();
  }
  async function copyText(text, button) {
    try {
      try { await navigator.clipboard.writeText(text); }
      catch {
        const helper = document.createElement('textarea'); helper.value = text; helper.style.cssText='position:fixed;opacity:0'; document.body.append(helper);helper.select();
        const copied = document.execCommand('copy'); helper.remove(); if (!copied) throw new Error('Copy unavailable');
      }
      const label = button.textContent; button.textContent='Copied'; setTimeout(()=>{button.textContent=label;},1500);
    } catch { status('Select the text to copy', 'error'); }
  }
  function render(messages, mode) {
    el.result.replaceChildren();
    messages.forEach((text,index) => {
      const card=document.createElement('article');card.className='message-card';
      const header=document.createElement('div');header.className='message-card-header';
      const label=document.createElement('label');label.className='message-label';label.htmlFor=`message-${index}`;label.textContent=mode==='split'?`Message ${index+1}`:'Your message';
      const stats=document.createElement('span');stats.className='message-stats';stats.setAttribute('aria-live','polite');
      const field=document.createElement('textarea');field.id=`message-${index}`;field.className='message-copy';field.value=text;field.rows=4;field.spellcheck=true;
      const actions=document.createElement('div');actions.className='message-actions';
      const copy=document.createElement('button');copy.type='button';copy.className='copy-button';copy.textContent=mode==='split'?`Copy message ${index+1}`:'Copy message';
      const update=()=>{const n=count(field.value),limit=mode==='split'?160:159;stats.textContent=`${n} / ${limit} characters`;copy.disabled=!field.value.trim()||n>limit;stats.classList.toggle('over-limit',n>limit);field.setAttribute('aria-invalid',String(n>limit));};
      field.addEventListener('input',update);copy.addEventListener('click',()=>copyText(field.value,copy));update();
      header.append(label,stats);actions.append(copy);card.append(header,field,actions);el.result.append(card);
    });
  }
  async function refine() {
    const input=el.source.value.trim();if(state.busy)return;if(!input){el.source.focus();status('Add your rough note','error');return;}
    const mode=state.mode, request=++state.request;
    const controller=new AbortController();state.controller=controller;busy(true);status('Polishing','working');
    try {
      const response=await fetch(`${apiBase}/api/textsmith`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input,mode,tone:el.tone.value}),signal:controller.signal});
      const data=await response.json().catch(()=>({}));if(request!==state.request)return;if(!response.ok)throw new Error(data.detail||'Could not write your message. Please try again.');
      if(!Array.isArray(data.messages)||data.messages.length!==(mode==='split'?2:1)||data.messages.some(text=>typeof text!=='string'||!text.trim()||count(text)>(mode==='split'?160:159)))throw new Error('The result did not meet the message limit. Please try again.');
      render(data.messages,mode);el.model.textContent='Length checked · Ready for your final touch';status(mode==='split'?'Two texts ready':'Ready to copy','ready');
    }catch(error){if(request!==state.request)return;status('Try again','error');el.result.replaceChildren();const p=document.createElement('p');p.className='error-message';p.textContent=error.message;el.result.append(p);}
    finally{if(request===state.request){state.controller=null;busy(false);}}
  }
  el.source.addEventListener('input',sourceChanged);el.tone.addEventListener('change',empty);
  el.modes.forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.mode)));
  el.rewrite.addEventListener('click',refine);
  el.reset.addEventListener('click',newMessage);
  el.clear.addEventListener('click',()=>{if(state.busy)return;el.source.value='';sourceChanged();el.source.focus();});
  el.source.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();refine();}});
  document.querySelectorAll('[data-example]').forEach(button=>button.addEventListener('click',()=>{el.source.value=button.dataset.example;sourceChanged();el.source.focus();}));
  sourceChanged();setMode('single');
})();
