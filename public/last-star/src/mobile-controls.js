const HELD_ACTIONS=new Set(['left','right','bolt']);
const EDGE_ACTIONS=new Set(['jump','blink','use','interact']);
const ACTIONS=new Set([...HELD_ACTIONS,...EDGE_ACTIONS,'ring']);

// Input ownership follows pointer IDs, not the last finger that touched the UI.
// Keep this independent of the simulation so short taps can wait for its next tick.
export class TouchControls {
  constructor(root,{onActivity=()=>{},onRingToggle=()=>{},canPress=()=>true}={}){
    this.root=root;this.onActivity=onActivity;this.onRingToggle=onRingToggle;this.canPress=canPress;
    this.enabled=false;this.pointers=new Map();this.counts=new Map();this.pending=new Map();this.listeners=[];
    root.hidden=true;
    this.listen(root,'pointerdown',e=>this.press(e));
    for(const name of ['pointerup','pointercancel','lostpointercapture'])this.listen(root,name,e=>this.release(e.pointerId,name!=='pointerup'));
    // Pointer capture is unavailable in some embedded browsers and may fail if a
    // pointer ends before capture. Window release still prevents a stuck button.
    const view=root.ownerDocument?.defaultView;
    if(view){
      for(const name of ['pointerup','pointercancel'])this.listen(view,name,e=>this.release(e.pointerId,name==='pointercancel'));
      this.listen(view,'blur',()=>this.cancel());
      this.listen(root.ownerDocument,'visibilitychange',()=>{if(root.ownerDocument.hidden)this.cancel();});
    }
    this.listen(root,'contextmenu',e=>{if(this.buttonFor(e))e.preventDefault();});
    this.listen(root,'click',e=>this.click(e));
  }
  listen(target,type,handler){target.addEventListener(type,handler);this.listeners.push([target,type,handler]);}
  buttonFor(event){
    const button=event.target?.closest?.('[data-touch-action]');
    return button&&this.root.contains(button)&&ACTIONS.has(button.dataset.touchAction)?button:null;
  }
  allowed(button){return this.enabled&&!button.disabled&&this.canPress(button.dataset.touchAction);}
  press(event){
    const button=this.buttonFor(event);if(!button)return;
    event.preventDefault();
    if((event.pointerType==='mouse'&&event.button!==0)||!this.allowed(button)||this.pointers.has(event.pointerId))return;
    const action=button.dataset.touchAction,first=!this.counts.get(action);
    this.pointers.set(event.pointerId,{action,button});this.counts.set(action,(this.counts.get(action)||0)+1);
    button.classList.add('is-pressed');
    try{button.setPointerCapture(event.pointerId);}catch{}
    this.onActivity(action,event);
    if(!first||!this.enabled||!this.pointers.has(event.pointerId))return;
    if(action==='ring')this.onRingToggle(event);
    else if(EDGE_ACTIONS.has(action)||action==='bolt')this.pending.set(action,event.pointerId);
  }
  release(pointerId,cancelled=false){
    const pointer=this.pointers.get(pointerId);if(!pointer)return;
    this.pointers.delete(pointerId);
    if(cancelled&&this.pending.get(pointer.action)===pointerId)this.pending.delete(pointer.action);
    const remaining=(this.counts.get(pointer.action)||1)-1;
    if(remaining)this.counts.set(pointer.action,remaining);else this.counts.delete(pointer.action);
    if(![...this.pointers.values()].some(p=>p.button===pointer.button))pointer.button.classList.remove('is-pressed');
    try{if(pointer.button.hasPointerCapture(pointerId))pointer.button.releasePointerCapture(pointerId);}catch{}
  }
  click(event){
    const button=this.buttonFor(event);if(!button)return;
    event.preventDefault();
    // Pointer-generated clicks follow pointerdown; processing them would cast
    // twice. Detail zero is native keyboard/assistive button activation.
    if(event.detail!==0||event.pointerType||!this.allowed(button))return;
    const action=button.dataset.touchAction;
    if(action==='left'||action==='right')return;
    this.onActivity(action,event);
    if(action==='ring')this.onRingToggle(event);else if(this.enabled)this.pending.set(action,'keyboard');
  }
  consume(){
    const result={
      move:(this.counts.has('right')?1:0)-(this.counts.has('left')?1:0),
      jump:this.pending.has('jump'),bolt:this.counts.has('bolt')||this.pending.has('bolt'),
      blink:this.pending.has('blink'),use:this.pending.has('use'),interact:this.pending.has('interact')
    };
    this.pending.clear();return result;
  }
  cancel(){
    for(const pointerId of [...this.pointers.keys()])this.release(pointerId,true);
    this.counts.clear();this.pending.clear();
  }
  setEnabled(enabled){
    this.enabled=!!enabled;this.root.hidden=!this.enabled;
    if(!this.enabled)this.cancel();
  }
  destroy(){this.cancel();for(const [target,type,handler] of this.listeners)target.removeEventListener(type,handler);this.listeners=[];this.enabled=false;this.root.hidden=true;}
}
