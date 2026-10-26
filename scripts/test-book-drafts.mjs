import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {createWritingStudio,STUDIO_FORMAT,STUDIO_INSTRUCTIONS,studioRevision} from '../lib/writing-studio.mjs';
import {createLayeredStudioEditor} from '../lib/studio-editor.mjs';
import {BOOK_LIMITS,bookContinuity} from '../lib/book-drafts.mjs';
function fixture(t,generate=async()=>({action:'discuss',reply:'Let’s check the established facts first.'})){
 const dir=mkdtempSync(tmpdir()+'/book-drafts-'),path=dir+'/sample.sqlite',db=new DatabaseSync(path);
 db.exec(`CREATE TABLE story_projects(id TEXT PRIMARY KEY,title TEXT,filename TEXT,user_intent TEXT,created_at TEXT,updated_at TEXT);
 CREATE TABLE story_sections(id TEXT PRIMARY KEY,project_id TEXT,chapter_index INTEGER,scene_index INTEGER,paragraph_index INTEGER,line_index INTEGER,kind TEXT,label TEXT,original_text TEXT,edited_text TEXT,summary TEXT,preserve_verbatim INTEGER,updated_at TEXT);
 CREATE TABLE story_chapter_names(project_id TEXT,chapter_index INTEGER,title TEXT);
 CREATE TABLE story_original_snapshots(project_id TEXT PRIMARY KEY,sections_json TEXT);
 CREATE TABLE story_autopilot_jobs(id TEXT PRIMARY KEY,project_id TEXT,status TEXT,plan_json TEXT,created_at TEXT);
 CREATE TABLE story_bible(project_id TEXT,characters TEXT,settings TEXT,timeline TEXT,plot_threads TEXT,tone_rules TEXT,continuity_notes TEXT);
 INSERT INTO story_projects VALUES('one','The Orchard','one.txt','','2026-01-01','2026-01-01'),('next','The next chapter','next.txt','','2026-01-01','2026-01-01'),('private','Another book','private.txt','','2026-01-01','2026-01-01');
 INSERT INTO story_sections VALUES('a','one',1,1,1,0,'paragraph','Opening','Original import.','Mara keeps the brass key beneath a blue bowl. She cannot swim.','',0,'2026-01-01'),('b','one',2,1,1,0,'paragraph','Next','Later chapter with a silver bridge.',NULL,'',0,'2026-01-01'),('c','next',1,1,1,0,'paragraph','Next','Mara approaches the flooded orchard.',NULL,'',0,'2026-01-01'),('z','private',1,1,1,0,'paragraph','Other','PRIVATE_OTHER_BOOK',NULL,'',0,'2026-01-01');
 INSERT INTO story_chapter_names VALUES('one',1,'The key'),('one',2,'The bridge'),('next',1,'The flood');`);
 const studio=createWritingStudio({path,generate});studio.init();
 const save=(id='one',index=1)=>{const snap=studio.snapshot(id),chapter=snap.chapters.find(c=>c.index===index);return studio.saveChapter(id,{chapterIndex:index,chapterRevision:chapter.revision,bookRevision:snap.bookDrafts.book.revision});};
 t.after(()=>{studio.stop();db.close();rmSync(dir,{recursive:true,force:true});});return {db,path,studio,save};
}
test('chapter snapshots are full, immutable, explicitly versioned and survive restart',t=>{
 const {studio,db,path,save}=fixture(t);assert.equal(studio.bookDrafts('one').book,null);
 studio.chooseBook('one',{title:'The assembled novel',useContinuity:true});const first=save(),chapter=first.book.chapters[0],version=studio.savedChapter('one',chapter.id);
 assert.match(version.content.passages[0].text,/blue bowl/);assert.equal(first.book.chapters.length,1);assert.equal(save().book.chapters[0].version,1);
 db.prepare("UPDATE story_sections SET edited_text='Mara carries the brass key in her pocket.' WHERE id='a'").run();assert.match(studio.savedChapter('one',chapter.id).content.passages[0].text,/blue bowl/);
 const second=save();assert.equal(second.book.chapters[0].version,2);assert.equal(studio.savedChapter('one',chapter.id,version.versionId).content.passages[0].text,version.content.passages[0].text);
 studio.updateBook('one',{revision:second.book.revision,chapterId:chapter.id,versionId:version.versionId});assert.equal(studio.bookDrafts('one').book.chapters[0].version,1);assert.match(studio.snapshot('one').chapters[0].passages[0].text,/pocket/);assert.equal(db.prepare("SELECT original_text FROM story_sections WHERE id='a'").get().original_text,'Original import.');
 const restarted=createWritingStudio({path,generate:()=>assert.fail('No model on reload')});restarted.init();assert.equal(restarted.savedChapter('one',chapter.id).versions.length,2);restarted.stop();
});
test('stale saves, ordering, and edits cannot overwrite a newer book or source',t=>{
 const {studio,db,save}=fixture(t);studio.chooseBook('one',{title:'Book'});const first=save();const stale=studio.snapshot('one');save('one',2);
 assert.throws(()=>studio.updateBook('one',{revision:first.book.revision,order:[]}),/another tab/);
 const snap=studio.bookDrafts('one'),order=snap.book.chapters.map(c=>c.id);assert.throws(()=>studio.updateBook('one',{revision:snap.book.revision,order:[order[0],order[0]]}),/exactly once/);
 const reversed=studio.updateBook('one',{revision:snap.book.revision,order:order.reverse()});assert.equal(reversed.book.chapters[0].sourceChapterIndex,2);
 db.prepare("UPDATE story_sections SET edited_text='Changed after the screen loaded.' WHERE id='a'").run();assert.throws(()=>studio.saveChapter('one',{chapterIndex:1,chapterRevision:stale.chapters[0].revision,bookRevision:reversed.book.revision}),/chapter changed/);assert.equal(studio.savedChapter('one',order[1]).versions.length,1);
});
test('linked later chapters receive approved canon, while future chapters and other books stay out',t=>{
 const {studio,save}=fixture(t);studio.chooseBook('one',{title:'Canon'});const first=save();save('one',2);studio.chooseBook('next',{bookId:first.book.id});
 const canon=studio.context('next','c',true,'Where does Mara keep the key?').savedBookContinuity;assert.equal(canon.chapters.length,2);assert.ok(canon.chapters.every(c=>c.complete));assert.match(JSON.stringify(canon),/blue bowl/);assert.ok(!JSON.stringify(canon).includes('PRIVATE_OTHER_BOOK'));
 const current=studio.context('one','b',true).savedBookContinuity;assert.equal(current.chapters.length,1);assert.equal(current.chapters[0].title,'The key');assert.equal(studio.context('one','a',true).savedBookContinuity.chapters.length,0);
 assert.throws(()=>studio.savedChapter('private',first.book.chapters[0].id),/not found/);studio.chooseBook('private',{title:'Independent book'});assert.throws(()=>studio.savedChapter('private',first.book.chapters[0].id),/not found/);
 const off=studio.updateBook('next',{revision:studio.bookDrafts('next').book.revision,useContinuity:false});assert.equal(off.book.useContinuity,false);assert.equal(studio.context('next','c',true).savedBookContinuity,null);
});
test('active jobs block book mutations across linked manuscripts; completed and paused jobs do not',t=>{
 const {studio,db,save}=fixture(t);studio.chooseBook('one',{title:'Book'});const snap=save();studio.chooseBook('next',{bookId:snap.book.id});
 db.prepare("INSERT INTO story_autopilot_jobs VALUES('run','next','running','{}','2026-01-01')").run();assert.throws(()=>save(),/active edit/);assert.throws(()=>studio.updateBook('one',{revision:snap.book.revision,useContinuity:false}),/active edit/);
 db.prepare("UPDATE story_autopilot_jobs SET status='paused' WHERE id='run'").run();assert.equal(save().book.chapters.length,1);db.prepare("UPDATE story_autopilot_jobs SET status='completed' WHERE id='run'").run();assert.equal(save().book.chapters.length,1);
});
test('bounded retrieval retains full snapshots, exact Unicode ranges, coverage, and source versions',t=>{
 const {studio,db,save}=fixture(t);const text='開く🌳 Mara carries the brass key.\n'.repeat(4000)+'END_WITH_BLUE_BOWL';db.prepare("UPDATE story_sections SET edited_text=? WHERE id='a'").run(text);studio.chooseBook('one',{title:'Long book'});const snap=save();studio.chooseBook('next',{bookId:snap.book.id});
 const canon=bookContinuity(db,'next',{chapterIndex:1,query:'blue bowl key',budget:6000});assert.ok(Buffer.byteLength(JSON.stringify(canon))<=6000);assert.equal(canon.chapters[0].complete,false);assert.equal(studio.savedChapter('one',snap.book.chapters[0].id).content.passages[0].text,text);
 const full='The key\n\n'+text;for(const excerpt of canon.chapters[0].excerpts){assert.equal(full.slice(excerpt.start,excerpt.end),excerpt.text);assert.ok(!/[\uD800-\uDBFF]$/.test(excerpt.text));}assert.match(JSON.stringify(canon),/END_WITH_BLUE_BOWL/);assert.throws(()=>bookContinuity(db,'next',{chapterIndex:1,budget:10}),/context budget/);
});
test('protected saved prose remains stored but never appears in model continuity',t=>{
 const {studio,db,save}=fixture(t);db.prepare("UPDATE story_sections SET preserve_verbatim=1 WHERE id='a'").run();studio.chooseBook('one',{title:'Protected'});const snap=save();studio.chooseBook('next',{bookId:snap.book.id});const canon=studio.context('next','c',true).savedBookContinuity;assert.ok(!JSON.stringify(canon).includes('blue bowl'));assert.equal(canon.chapters[0].protectedPassages,1);assert.equal(canon.chapters[0].complete,false);assert.match(studio.savedChapter('one',snap.book.chapters[0].id).content.passages[0].text,/blue bowl/);
});
test('oversized chapters fail transparently with no partial version and no prose clipping',t=>{
 const {studio,db,save}=fixture(t);studio.chooseBook('one',{title:'Limits'});db.prepare("UPDATE story_sections SET edited_text=? WHERE id='a'").run('x'.repeat(BOOK_LIMITS.chapterBytes+1));assert.throws(()=>save(),e=>e.status===413&&/nothing was truncated/.test(e.message));assert.equal(studio.bookDrafts('one').book.chapters.length,0);assert.equal(db.prepare('SELECT count(*) AS n FROM book_draft_versions').get().n,0);
});
test('a failed storage write rolls back the version, approval and book revision together',t=>{
 const {studio,db,save}=fixture(t);studio.chooseBook('one',{title:'Atomic save'});const before=studio.bookDrafts('one');
 db.exec("CREATE TRIGGER fail_book_save BEFORE INSERT ON book_draft_chapters BEGIN SELECT RAISE(ABORT,'synthetic disk failure'); END;");assert.throws(()=>save(),/synthetic disk failure/);assert.equal(db.prepare('SELECT count(*) AS n FROM book_draft_versions').get().n,0);assert.deepEqual(studio.bookDrafts('one'),before);
 db.exec('DROP TRIGGER fail_book_save');assert.equal(save().book.chapters.length,1);
});
test('book chapter and total version limits reject new data without dropping saved history',t=>{
 const {studio,db,save}=fixture(t);studio.chooseBook('one',{title:'Storage caps'});const first=save(),book=first.book;
 for(let i=3;i<=101;i++){db.prepare('INSERT INTO book_draft_versions VALUES(?,?,?,?,?,?)').run('v'+i,'c'+i,1,'r','{}','2026-01-01');db.prepare('INSERT INTO book_draft_chapters VALUES(?,?,?,?,?,?,?)').run('c'+i,book.id,i-1,'one',i,'Synthetic '+i,'v'+i);}
 assert.throws(()=>save('one',2),e=>e.status===413&&/100 saved chapters/.test(e.message));assert.equal(studio.bookDrafts('one').book.chapters.length,100);
 db.prepare('INSERT INTO book_draft_versions VALUES(?,?,?,?,?,?)').run('large-history',book.chapters[0].id,2,'r','x'.repeat(BOOK_LIMITS.bookBytes),'2026-01-01');db.prepare("UPDATE story_sections SET edited_text='A newly revised chapter.' WHERE id='a'").run();assert.throws(()=>save(),e=>e.status===413&&/20 MB/.test(e.message));assert.equal(studio.savedChapter('one',book.chapters[0].id).version,1);assert.match(studio.snapshot('one').chapters[0].passages[0].text,/newly revised/);
});
test('every real layered stage receives the approved continuity and its evidence limits',async t=>{
 const requests=[];const editor=createLayeredStudioEditor({decisionFormat:STUDIO_FORMAT,instructions:STUDIO_INSTRUCTIONS,call:async request=>{requests.push(request);switch(request.text.format.name){case 'writing_studio_turn':return {action:'revise',reply:'I’ll preserve the key location.',revisionText:'',note:'Preserve established canon.',chapter:0,passage:0};case 'studio_critique':return {strengths:[],issues:[],continuityRisks:[],authorIntentFit:'Aligned'};default:return {text:'Mara remembered the blue bowl as the orchard flooded.',craftNotes:'Grounded in the saved chapter.'};}}});
 const {studio,save}=fixture(t,editor);studio.chooseBook('one',{title:'Book'});const snap=save();studio.chooseBook('next',{bookId:snap.book.id});studio.start('next',{requestId:'canon-edit',sectionId:'c',revision:studioRevision('Mara approaches the flooded orchard.'),message:'Develop this scene, respecting where the key was left.',scope:'passage',mode:'edit'});await studio.tick();assert.equal(studio.task('next','canon-edit').status,'done');assert.equal(requests.length,4);
 for(const request of requests){assert.equal(request.model,'gpt-6.1-sol');assert.deepEqual(request.reasoning,{effort:'xhigh',mode:'pro'});assert.match(request.input[0].content,/incomplete evidence/);assert.match(request.input[1].content,/blue bowl/);assert.match(request.input[1].content,/savedBookContinuity/);}
 assert.match(studio.savedChapter('one',snap.book.chapters[0].id).content.passages[0].text,/blue bowl/);
});
test('Autopilot snapshots canon once, restores it on resume, and adds it before hashing every model stage',()=>{
 const code=readFileSync(new URL('../server.js',import.meta.url),'utf8');assert.match(code,/JSON\.stringify\(\{chapter:chapter \|\| null,request:intent,bookCanon\}\)/);assert.match(code,/storyTask\.getStore\(\)\.bookCanon=changeRequest\.bookCanon\|\|null/);const fn=code.slice(code.indexOf('async function storyModelJson'),code.indexOf('function buildStoryAutopilotChunks'));assert.ok(fn.indexOf('savedBookContinuity};')<fn.indexOf('storyEditorialCacheKey'));assert.match(fn,/system\+='\\n'\+BOOK_CANON_INSTRUCTIONS/);
});

test('adding empty book storage preserves pre-feature task revision identities',t=>{
 const {studio,db}=fixture(t);const rows=db.prepare("SELECT id,chapter_index,scene_index,paragraph_index,line_index,kind,original_text,edited_text FROM story_sections WHERE project_id=? ORDER BY id").all('next'),names=db.prepare('SELECT chapter_index,title FROM story_chapter_names WHERE project_id=? ORDER BY chapter_index').all('next');const expected=studioRevision(JSON.stringify({rows,names,goal:''}));studio.start('next',{requestId:'compatible-task',sectionId:'c',revision:studioRevision('Mara approaches the flooded orchard.'),message:'Discuss the scene.',mode:'discuss'});assert.equal(db.prepare('SELECT source_revision FROM studio_tasks WHERE id=?').get('compatible-task').source_revision,expected);
});

test('saved chapter source revision distinguishes an approved version from a changed working draft',t=>{
 const {studio,save}=fixture(t);studio.chooseBook('one',{title:'The approved book'});const before=studio.snapshot('one'),saved=save().book.chapters[0];assert.equal(saved.sourceRevision,before.chapters[0].revision);
 studio.savePassage('one',{sectionId:'a',revision:before.chapters[0].passages[0].revision,text:'The author changes the opening after approval.'});const changed=studio.snapshot('one');assert.notEqual(changed.chapters[0].revision,changed.bookDrafts.book.chapters[0].sourceRevision);assert.equal(changed.bookDrafts.book.chapters[0].sourceRevision,saved.sourceRevision);
 const refreshed=save();assert.equal(refreshed.book.chapters[0].sourceRevision,studio.snapshot('one').chapters[0].revision);assert.equal(refreshed.book.chapters[0].version,2);
});
