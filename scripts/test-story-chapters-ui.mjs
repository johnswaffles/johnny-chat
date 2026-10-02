import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
// DOM event harness runs the actual chapter controller without opening a browser.
class Element {
 constructor(tag='div') {this.tag=tag;this.children=[];this.handlers={};this.disabled=false;this.open=false;this.value='';}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children;}
 addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);}
 async fire(type){for(const fn of this.handlers[type]||[]) await fn({preventDefault(){}});}
 showModal(){this.open=true;}
 close(){this.open=false;}
 querySelectorAll(){return this.children.flatMap(c=>[c,...c.querySelectorAll()]).filter(c=>['button','input','select'].includes(c.tag));}
}
function harness() {
 const ids={};for(const id of ['open','dialog','form','rows','save','add','cancel','message'])ids['chapter-layout-'+id]=new Element(id==='save'||id==='add'||id==='cancel'?'button':'div');
 ids['chapter-layout-form'].append(ids['chapter-layout-rows'],ids['chapter-layout-save'],ids['chapter-layout-add'],ids['chapter-layout-cancel']);
 for(const id of ['passage-split-history','passage-split-history-items','passage-split-select','passage-split-open','passage-split-dialog','passage-split-form','passage-split-cancel','passage-split-save','passage-split-name','passage-split-message','passage-original','passage-revised','passage-revised-group','original-split-mark','revised-split-mark','original-split-before','original-split-after','revised-split-before','revised-split-after'])ids[id]=new Element();
 const doc=new Element();doc.cookie='gpt54_session=test-token';doc.getElementById=id=>ids[id];doc.createElement=tag=>new Element(tag);
 doc.dispatchEvent=event=>{for(const fn of doc.handlers[event.type]||[]) fn(event);};
 const layout={revision:'r1',boundaries:[{startId:'a',title:'Chapter 1'}],passages:[{id:'a',kind:'paragraph',preview:'First saved paragraph'},{id:'b',kind:'paragraph',preview:'Second saved paragraph'},{id:'c',kind:'paragraph',preview:'Last saved paragraph'}]};
 const calls=[];let fail=false;
 const fetch=async(url,options={})=>{calls.push({url,...options});return {ok:!fail,json:async()=>fail?{error:'The manuscript changed.'}:options.method?{ok:true}:url.includes('/passage-split/')?{revision:'r1',sectionId:'a',originalText:'Opening prose. CHAPTER TWO Closing prose.',revisedText:'A quieter opening. CHAPTER TWO Revised closing.',hasRevision:true}:structuredClone(layout)};};
 vm.runInNewContext(readFileSync(new URL('../public/story-editor/chapters.js',import.meta.url),'utf8'),{document:doc,location:{origin:'http://local.test'},window:{},fetch,CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}}});
 doc.dispatchEvent({type:'story-reader-project',detail:{id:'project',busy:false}});
 return {ids,doc,calls,setFailure:value=>{fail=value;}};
}
test('cancel/reopen drops draft changes and makes no save request',async()=>{
 const {ids,calls}=harness();await ids['chapter-layout-open'].fire('click');
 await ids['chapter-layout-add'].fire('click');assert.equal(ids['chapter-layout-rows'].children.length,2);
 await ids['chapter-layout-cancel'].fire('click');assert.equal(ids['chapter-layout-dialog'].open,false);
 await ids['chapter-layout-open'].fire('click');assert.equal(ids['chapter-layout-rows'].children.length,1);
 assert.ok(calls.every(c=>!c.method));
});
test('split/rename saves reviewed boundaries and reopening works after success',async()=>{
 const {ids,doc,calls}=harness();let saved=0;doc.addEventListener('story-chapters-saved',()=>saved++);
 await ids['chapter-layout-open'].fire('click');await ids['chapter-layout-add'].fire('click');
 const second=ids['chapter-layout-rows'].children[1];const name=second.children[0].children[0];name.value='Homecoming';await name.fire('input');
 await ids['chapter-layout-form'].fire('submit');
 const body=JSON.parse(calls.at(-1).body);assert.equal(body.boundaries[1].startId,'b');assert.equal(body.boundaries[1].title,'Homecoming');assert.equal(body.revision,'r1');assert.equal(saved,1);
 assert.equal(ids['chapter-layout-dialog'].open,false);
 await ids['chapter-layout-open'].fire('click');assert.equal(ids['chapter-layout-cancel'].disabled,false);
});
test('failed save keeps dialog and recovery instruction; cancel and retry work',async()=>{
 const {ids,calls,setFailure}=harness();await ids['chapter-layout-open'].fire('click');setFailure(true);
 await ids['chapter-layout-form'].fire('submit');assert.equal(ids['chapter-layout-dialog'].open,true);assert.match(ids['chapter-layout-message'].textContent,/Cancel and reopen/);
 assert.equal(ids['chapter-layout-cancel'].disabled,false);await ids['chapter-layout-cancel'].fire('click');setFailure(false);
 await ids['chapter-layout-open'].fire('click');assert.equal(ids['chapter-layout-save'].disabled,false);
 assert.equal(calls.filter(c=>c.method==='PUT').length,1);
});
test('project change discards old draft and busy editing disables organization',async()=>{
 const {ids,doc,calls}=harness();await ids['chapter-layout-open'].fire('click');
 doc.dispatchEvent({type:'story-reader-project',detail:{id:'other',busy:true}});assert.equal(ids['chapter-layout-dialog'].open,false);assert.equal(ids['chapter-layout-open'].disabled,true);
 assert.ok(calls.every(c=>!c.method));
});

test('within-passage preview needs matched original/revised starts and cancellation makes no write',async()=>{
 const {ids,calls}=harness();await ids['chapter-layout-open'].fire('click');ids['passage-split-select'].value='a';await ids['passage-split-open'].fire('click');
 assert.equal(ids['passage-split-dialog'].open,true);
 ids['passage-original'].selectionStart=3;await ids['original-split-mark'].fire('click');assert.equal(ids['passage-split-save'].disabled,true);
 ids['passage-original'].selectionStart=ids['passage-original'].value.indexOf('CHAPTER');await ids['original-split-mark'].fire('click');assert.equal(ids['passage-split-save'].disabled,true);
 ids['passage-revised'].selectionStart=ids['passage-revised'].value.indexOf('CHAPTER');await ids['revised-split-mark'].fire('click');assert.equal(ids['passage-split-save'].disabled,false);
 assert.match(ids['original-split-after'].textContent,/CHAPTER TWO/);assert.match(ids['revised-split-after'].textContent,/CHAPTER TWO/);
 await ids['passage-split-cancel'].fire('click');assert.equal(ids['passage-split-dialog'].open,false);assert.ok(calls.every(c=>!c.method));
});
test('split submits reviewed independent offsets once and failure keeps a cancel path',async()=>{
 const {ids,calls,setFailure}=harness();await ids['chapter-layout-open'].fire('click');ids['passage-split-select'].value='a';await ids['passage-split-open'].fire('click');
 ids['passage-original'].selectionStart=ids['passage-original'].value.indexOf('CHAPTER');await ids['original-split-mark'].fire('click');
 ids['passage-revised'].selectionStart=ids['passage-revised'].value.indexOf('CHAPTER');await ids['revised-split-mark'].fire('click');ids['passage-split-name'].value='Return';setFailure(true);
 await ids['passage-split-form'].fire('submit');const body=JSON.parse(calls.at(-1).body);assert.notEqual(body.originalOffset,body.revisedOffset);assert.equal(body.chapterTitle,'Return');assert.equal(body.sectionId,'a');
 assert.equal(ids['passage-split-dialog'].open,true);assert.equal(ids['passage-split-cancel'].disabled,false);assert.match(ids['passage-split-message'].textContent,/save could not be confirmed/);
 await ids['passage-split-cancel'].fire('click');assert.equal(calls.filter(c=>c.method==='POST').length,1);
});
