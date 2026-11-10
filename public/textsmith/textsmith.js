(function () {
  const state = { mode: 'single', busy: false, request: 0, controller: null };
  const formats = {
    single: { limit: 159, budget: '159 characters max', description: 'One complete message, up to 159 characters.' },
    split: { limit: 160, budget: '160 per message', description: 'Two complete messages, up to 160 characters each.' },
    professional: { limit: null, budget: 'No character cap', description: 'One polished professional statement with no character cap on the result.' }
  };
  const host = location.hostname.toLowerCase();
  const apiBase = String(window.JOHNNY_CHAT_API_BASE_URL || (['localhost','127.0.0.1'].includes(host) ? location.origin : 'https://johnny-chat.onrender.com')).replace(/\/+$/, '');
  const el = {
    source: document.getElementById('source-text'), count: document.getElementById('input-count'),
    budget: document.getElementById('mode-budget'), description: document.getElementById('mode-description'),
    modes: [...document.querySelectorAll('[data-mode]')], rewrite: document.getElementById('rewrite-button'),
    result: document.getElementById('result-area'), status: document.getElementById('status-pill'),
    tone: document.getElementById('tone'), toneField: document.querySelector('.tone-field'), model: document.getElementById('model-label'),
    clear: document.getElementById('clear-button'), reset: document.getElementById('new-message-button'), emptyTemplate: document.getElementById('empty-state-template')
  };
  const count = value => Array.from(value).length;
  function status(text, kind = '') { el.status.textContent = text; el.status.className = `status-pill ${kind}`; }
  function empty() {
    const content = el.emptyTemplate.content.cloneNode(true);
    const descriptions = {
      split: 'Two thoughtful texts, ready to review and copy separately.',
      single: 'Your polished text will appear here, ready for a final touch.',
      professional: 'Your professional statement will appear here, ready to edit and copy.'
    };
    content.querySelector('.empty-description').textContent = descriptions[state.mode];
    el.result.replaceChildren(content);
    el.model.textContent = 'Your words. Thoughtfully refined.';
    status('Awaiting your draft');
  }
  function setMode(mode) {
    if (state.busy) return;
    const changed = state.mode !== mode;
    state.mode = mode;
    el.budget.textContent = formats[mode].budget;
    el.description.textContent = formats[mode].description;
    el.toneField.hidden = mode === 'professional';
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
      const label=document.createElement('label');label.className='message-label';label.htmlFor=`message-${index}`;label.textContent=mode==='split'?`Message ${index+1}`:mode==='professional'?'Your statement':'Your message';
      const stats=document.createElement('span');stats.className='message-stats';stats.setAttribute('aria-live','polite');
      const field=document.createElement('textarea');field.id=`message-${index}`;field.className='message-copy';field.value=text;field.rows=4;field.spellcheck=true;
      const actions=document.createElement('div');actions.className='message-actions';
      const copy=document.createElement('button');copy.type='button';copy.className='copy-button';copy.textContent=mode==='split'?`Copy message ${index+1}`:mode==='professional'?'Copy statement':'Copy message';
      const limit = formats[mode].limit;
      const update = () => {
        const length = count(field.value);
        const overLimit = limit !== null && length > limit;
        stats.textContent = limit === null ? `${length} characters` : `${length} / ${limit} characters`;
        copy.disabled = !field.value.trim() || overLimit;
        stats.classList.toggle('over-limit', overLimit);
        field.setAttribute('aria-invalid', String(overLimit));
      };
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
      if (mode === 'professional' && data.mode !== mode) {
        throw new Error('Professional format is temporarily unavailable. Please try again shortly.');
      }
      const limit = formats[mode].limit;
      if (!Array.isArray(data.messages) || data.messages.length !== (mode === 'split' ? 2 : 1)
        || data.messages.some(text => typeof text !== 'string' || !text.trim())) {
        throw new Error('TextSmith returned an incomplete result. Please try again.');
      }
      if (limit !== null && data.messages.some(text => count(text) > limit)) {
        throw new Error('The result did not meet the message limit. Please try again.');
      }
      render(data.messages,mode);
      el.model.textContent = limit === null ? 'Ready for your final review' : 'Length checked · Ready for your final touch';
      status(mode==='split'?'Two texts ready':'Ready to copy','ready');
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
