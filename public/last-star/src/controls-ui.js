import {ACTIONS,DEFAULT_KEYS,DEFAULT_PAD,buttonName,keyName,normalizeKey,validKey,rebind} from './controls.js';
export class ControlsUI {
 constructor(config,controller,onChange){
  this.config=config;this.controller=controller;this.onChange=onChange;this.capture=null;
  const rows=document.getElementById('binding-rows');
  for(const [action,label] of Object.entries(ACTIONS)){
   const row=document.createElement('div');row.className='binding-row';
   const name=document.createElement('span');name.textContent=label;row.append(name);
   for(const kind of ['keys','pad']){const b=document.createElement('button');b.dataset.kind=kind;b.dataset.action=action;b.onclick=()=>this.listen(kind,action);b.setAttribute('aria-label',`${label} ${kind==='keys'?'keyboard':'controller'} binding`);row.append(b);}rows.append(row);
  }
  document.getElementById('cancel-binding').onclick=()=>this.cancel();
  document.getElementById('reset-bindings').onclick=()=>{this.config.keys={...DEFAULT_KEYS};this.config.pad={...DEFAULT_PAD};this.config.deadzone=.18;this.cancel();this.changed();this.message('Default controls restored.');};
  const slider=document.getElementById('deadzone');slider.value=config.deadzone;slider.oninput=()=>{config.deadzone=Number(slider.value);this.changed();};slider.onchange=slider.oninput;
  this.render();
 }
 message(text){document.getElementById('binding-message').textContent=text;}
 listen(kind,action){this.capture={kind,action,until:performance.now()+15000};this.controller.clearEdges();this.render();this.message(`Press ${kind==='keys'?'a keyboard key':'the controller button'} for ${ACTIONS[action]}. Escape / Menu or Cancel to stop.`);}
 cancel(){this.capture=null;this.render();this.message('Select a binding to change it. Assigning a used button swaps the two actions.');}
 changed(){this.onChange();this.render();}
 assign(value){
  const {kind,action}=this.capture,result=rebind(this.config,kind,action,value);
  if(!result){this.message(kind==='pad'?'Menu and Guide are reserved. Press a different button.':'That key is reserved for menus. Choose a letter, number, arrow, modifier or punctuation key.');return;}
  this.capture=null;this.controller.clearEdges();this.changed();
  this.message(`${ACTIONS[action]} → ${kind==='keys'?keyName(value):buttonName(value,this.controller.standard)}. ${typeof result==='string'?`Swapped with ${ACTIONS[result]}.`:'Saved on this device.'}`);
 }
 key(e){if(!this.capture)return false;e.preventDefault();if(e.code==='Escape')this.cancel();else if(this.capture.kind==='keys'&&!e.repeat){const code=normalizeKey(e.code);if(validKey(code))this.assign(code);else this.message('That key is reserved. Choose a different key, or Escape to cancel.');}return true;}
 poll(now){
  if(this.capture&&now>this.capture.until){this.cancel();this.message('No input received. Select the action to try again.');}
  if(this.capture&&this.controller.edges.has(9)){this.cancel();this.controller.clearEdges();return true;}
  if(this.capture?.kind==='pad'){const button=[...this.controller.edges][0];if(button!==undefined)this.assign(button);return true;}
  return !!this.capture;
 }
 render(){
  for(const b of document.querySelectorAll('#binding-rows button')){
   const {kind,action}=b.dataset;b.textContent=this.capture?.kind===kind&&this.capture.action===action?'Press…':kind==='keys'?keyName(this.config.keys[action]):buttonName(this.config.pad[action],this.controller.standard);
   b.classList.toggle('listening',this.capture?.kind===kind&&this.capture.action===action);
  }
  document.getElementById('cancel-binding').hidden=!this.capture;
  document.getElementById('deadzone').value=this.config.deadzone;
  document.getElementById('deadzone-value').textContent=Math.round(this.config.deadzone*100)+'%';
 }
 status(error=''){
  const c=this.controller;
  document.getElementById('controller-status').textContent=error|| (c.connected?`${c.standard?'Controller ready':'Generic controller — check your bindings'} · ${c.name}`:'Connect a controller by USB or Bluetooth, then press a button to wake it.');
  document.getElementById('controller-light').classList.toggle('connected',c.connected);
 }
}
