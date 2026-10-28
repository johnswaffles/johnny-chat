import test from 'node:test';
import assert from 'node:assert/strict';
import {TouchControls} from '../src/mobile-controls.js';

class Surface extends EventTarget {
  constructor(){super();this.hidden=false;}
  emit(type,properties={}){const event=new Event(type,{cancelable:true});Object.assign(event,properties);this.dispatchEvent(event);return event;}
}
function setup(options={}){
  const view=new Surface(),doc=new Surface(),root=new Surface();doc.defaultView=view;root.ownerDocument=doc;
  const buttons=Object.fromEntries(['left','right','bolt','jump','blink','use','interact','ring'].map(action=>{
    const classes=new Set(),captured=new Set();
    const button={dataset:{touchAction:action},disabled:false,classList:{add:v=>classes.add(v),remove:v=>classes.delete(v),contains:v=>classes.has(v)},setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id),closest(){return this;}};
    return [action,button];
  }));
  root.contains=button=>Object.values(buttons).includes(button);
  const controls=new TouchControls(root,options);controls.setEnabled(true);
  // Event.target is supplied by dispatchEvent and cannot be assigned. Model the
  // delegated event's composed target with an own property before dispatch.
  const dispatch=(surface,type,action,id=1,extra={})=>{
    const event=new Event(type,{cancelable:true});
    Object.defineProperty(event,'target',{value:buttons[action]||root});
    Object.assign(event,{pointerId:id,pointerType:'touch',button:0,...extra});surface.dispatchEvent(event);return event;
  };
  return {controls,root,view,doc,buttons,down:(action,id,extra)=>dispatch(root,'pointerdown',action,id,extra),up:id=>dispatch(root,'pointerup',null,id),cancel:id=>dispatch(root,'pointercancel',null,id),lost:id=>dispatch(root,'lostpointercapture',null,id),click:(action,extra={})=>dispatch(root,'click',action,1,{detail:1,...extra}),dispatch};
}
const idle={move:0,jump:false,bolt:false,blink:false,use:false,interact:false};

test('three fingers move, cast and jump together; either release order retains other fingers',()=>{
  for(const first of ['move','cast']){
    const s=setup();s.down('right',1);s.down('bolt',2);s.down('jump',3);
    assert.deepEqual(s.controls.consume(),{...idle,move:1,bolt:true,jump:true});
    assert.deepEqual(s.controls.consume(),{...idle,move:1,bolt:true});
    s.up(first==='move'?1:2);
    assert.deepEqual(s.controls.consume(),{...idle,move:first==='move'?0:1,bolt:first==='move'});
    s.up(first==='move'?2:1);s.up(3);assert.deepEqual(s.controls.consume(),idle);
  }
});
test('short taps survive release until consumed once, including a quick staff tap',()=>{
  const s=setup();for(const [i,action] of ['jump','blink','use','interact','bolt'].entries()){s.down(action,i);s.up(i);}
  assert.deepEqual(s.controls.consume(),{...idle,jump:true,blink:true,use:true,interact:true,bolt:true});
  assert.deepEqual(s.controls.consume(),idle);
});
test('second finger on the same action does not create another edge or release the first',()=>{
  const s=setup();s.down('jump',1);assert.equal(s.controls.consume().jump,true);
  s.down('jump',2);assert.equal(s.controls.consume().jump,false);s.up(1);
  assert.equal(s.buttons.jump.classList.contains('is-pressed'),true);assert.equal(s.controls.consume().jump,false);
  s.up(2);assert.equal(s.buttons.jump.classList.contains('is-pressed'),false);
  s.down('jump',3);assert.equal(s.controls.consume().jump,true);
  s.down('right',4);s.down('right',5);s.up(4);assert.equal(s.controls.consume().move,1);s.up(5);assert.equal(s.controls.consume().move,0);
});
test('opposing directions cancel and releasing either leaves the other direction active',()=>{
  const s=setup();s.down('left',1);s.down('right',2);assert.equal(s.controls.consume().move,0);
  s.up(2);assert.equal(s.controls.consume().move,-1);s.up(1);assert.equal(s.controls.consume().move,0);
});
test('pointer cancellation and lost capture release only their owner; unknown releases are harmless',()=>{
  const s=setup();s.down('left',1);s.down('bolt',2);s.controls.consume();
  s.cancel(1);assert.deepEqual(s.controls.consume(),{...idle,bolt:true});s.lost(999);s.lost(2);assert.deepEqual(s.controls.consume(),idle);
});
test('a cancelled tap is discarded without dropping another finger\'s buffered action',()=>{
  const s=setup();s.down('jump',1);s.down('blink',2);s.cancel(1);s.up(2);
  assert.deepEqual(s.controls.consume(),{...idle,blink:true});s.down('jump',3);s.lost(3);assert.deepEqual(s.controls.consume(),idle);
});
test('cancel clears held inputs, buffered taps and pressed appearance',()=>{
  const s=setup();s.down('right',1);s.down('bolt',2);s.down('jump',3);s.controls.cancel();
  assert.deepEqual(s.controls.consume(),idle);for(const b of Object.values(s.buttons))assert.equal(b.classList.contains('is-pressed'),false);
  s.up(1);s.up(2);s.up(3);assert.deepEqual(s.controls.consume(),idle);
});
test('disable hides controls and clears inputs; repeated enable preserves active holds',()=>{
  const s=setup();s.down('left');s.controls.setEnabled(true);assert.equal(s.controls.consume().move,-1);
  s.down('jump',2);s.controls.setEnabled(false);assert.equal(s.root.hidden,true);assert.deepEqual(s.controls.consume(),idle);
  s.down('bolt',3);assert.deepEqual(s.controls.consume(),idle);s.controls.setEnabled(true);assert.equal(s.root.hidden,false);assert.deepEqual(s.controls.consume(),idle);
});
test('blur, hidden document and outside release cannot leave a held control stuck',()=>{
  const s=setup();s.down('right');s.view.emit('blur');assert.deepEqual(s.controls.consume(),idle);
  s.down('bolt');s.doc.hidden=true;s.doc.emit('visibilitychange');assert.deepEqual(s.controls.consume(),idle);
  s.buttons.left.setPointerCapture=()=>{throw new Error('capture unavailable');};s.down('left');s.view.emit('pointerup',{pointerId:1});assert.deepEqual(s.controls.consume(),idle);
});
test('mouse pointers support input testing while secondary buttons are ignored',()=>{
  const s=setup();s.down('right',1,{pointerType:'mouse'});s.down('jump',2,{pointerType:'mouse'});
  assert.deepEqual(s.controls.consume(),{...idle,move:1,jump:true});s.down('bolt',3,{pointerType:'mouse',button:2});assert.equal(s.controls.consume().bolt,false);
});
test('generated click is suppressed; keyboard click queues one action without a stuck hold',()=>{
  const s=setup();s.down('bolt');assert.equal(s.controls.consume().bolt,true);s.up(1);const event=s.click('bolt');assert.equal(event.defaultPrevented,true);assert.deepEqual(s.controls.consume(),idle);
  s.click('jump',{detail:0,pointerType:''});s.click('bolt',{detail:0,pointerType:''});assert.deepEqual(s.controls.consume(),{...idle,jump:true,bolt:true});assert.deepEqual(s.controls.consume(),idle);
  s.click('bolt',{detail:0,pointerType:'touch'});assert.deepEqual(s.controls.consume(),idle);
});
test('ring toggles once per distinct press and never casts; disabled and gated actions are ignored',()=>{
  let toggles=0,activity=0;const s=setup({onRingToggle:()=>toggles++,onActivity:()=>activity++,canPress:action=>action!=='use'});
  s.down('ring',1);s.down('ring',2);assert.equal(toggles,1);assert.deepEqual(s.controls.consume(),idle);s.up(1);s.up(2);s.down('ring',3);assert.equal(toggles,2);
  s.click('ring');assert.equal(toggles,2);s.click('ring',{detail:0,pointerType:''});assert.equal(toggles,3);
  s.down('use',4);s.buttons.jump.disabled=true;s.down('jump',5);assert.deepEqual(s.controls.consume(),idle);assert.equal(activity,4);
});
test('destroy removes handlers, releases active captures and hides the surface',()=>{
  const s=setup();s.down('right');assert.equal(s.buttons.right.hasPointerCapture(1),true);s.controls.destroy();
  assert.equal(s.buttons.right.hasPointerCapture(1),false);assert.equal(s.root.hidden,true);s.down('jump');assert.deepEqual(s.controls.consume(),idle);
});
