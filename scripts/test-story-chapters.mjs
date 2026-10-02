import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {chapterHeading,manuscriptBlocks,pdfPageText,validateChapterLayout,splitStoryManuscript} from '../lib/story-chapters.mjs';
import {readChapterLayout,saveChapterLayout,readPassageSplit,splitSavedPassage} from '../lib/story-layout.mjs';
test('explicit headings: digits, Roman/word numbers, titles, Markdown and split PDF lines',()=>{
 for(const value of ['CHAPTER 1','Chapter IV','Chapter Thirty-One','Chapter one hundred and two','Chapter 12: The Return','Chapter 1.','Prologue','Epilogue — Home','## Chapter Two']) assert.ok(chapterHeading(value),value);
 assert.deepEqual(manuscriptBlocks('Front matter\nCHAPTER\nONE\nFirst paragraph.\nCHAPTER II\nSecond paragraph.'),['Front matter','CHAPTER\nONE','First paragraph.','CHAPTER II','Second paragraph.']);
});
test('ordinary prose, table of contents and ambiguous unnumbered headings are left alone',()=>{
 for(const line of ['Chapter one was difficult.','CHAPTER 1 ........ 12','Chapter 1\t12','1','The Return','Chapter 1 12']) assert.equal(chapterHeading(line),'',line);
 const text='One long unheaded paragraph.\nMore prose.\n\nAnother paragraph.';
 assert.deepEqual(manuscriptBlocks(text),['One long unheaded paragraph.\nMore prose.','Another paragraph.']);
});
test('PDF fragment geometry and EOL preserve heading lines and every text fragment',()=>{
 const items=[{str:'CHAPTER',transform:[1,0,0,1,10,700]},{str:'ONE',transform:[1,0,0,1,100,700],hasEOL:true},{str:'First line.',transform:[1,0,0,1,10,680]},{str:'Second line.',transform:[1,0,0,1,10,660]}];
 assert.equal(pdfPageText(items),'CHAPTER ONE\nFirst line.\nSecond line.');
 assert.deepEqual(manuscriptBlocks(pdfPageText(items)),['CHAPTER ONE','First line.\nSecond line.']);
});
test('boundary validation rejects empty chapters, unordered starts, missing first and bad names',()=>{
 const sections=[{id:'h',kind:'chapter'},{id:'a',kind:'paragraph'},{id:'b',kind:'paragraph'}];
 for(const boundaries of [[],[null],[{startId:'a',title:'One'}],[{startId:'h',title:'One'},{startId:'a',title:'Two'}],[{startId:'h',title:'One'},{startId:'h',title:'Two'}],[{startId:'h',title:'One'},{startId:'b',title:'Bad\nName'}]])assert.throws(()=>validateChapterLayout(sections,boundaries));
 assert.equal(validateChapterLayout(sections,[{startId:'h',title:'One'},{startId:'b',title:'Two'}]).length,2);
});
function fixture(t) {
 const dir=mkdtempSync(tmpdir()+'/story-layout-unit-'),path=dir+'/test.sqlite';
 const db=new DatabaseSync(path);
 db.exec(`CREATE TABLE story_projects(id TEXT PRIMARY KEY,updated_at TEXT);
 CREATE TABLE story_sections(id TEXT PRIMARY KEY,project_id TEXT,chapter_index INTEGER,scene_index INTEGER,paragraph_index INTEGER,line_index INTEGER,kind TEXT,label TEXT,original_text TEXT,edited_text TEXT,preserve_verbatim INTEGER,summary TEXT,updated_at TEXT);
 CREATE TABLE story_original_snapshots(project_id TEXT PRIMARY KEY,sections_json TEXT NOT NULL);
 CREATE TABLE story_passage_splits(parent_id TEXT PRIMARY KEY,project_id TEXT,child_ids TEXT,created_at TEXT);
 CREATE TABLE story_chapter_names(project_id TEXT,chapter_index INTEGER,title TEXT,PRIMARY KEY(project_id,chapter_index));
 CREATE TABLE story_autopilot_jobs(id TEXT PRIMARY KEY,project_id TEXT,status TEXT,plan_json TEXT);
 CREATE TABLE story_edits(id TEXT,section_id TEXT,suggestion TEXT);
 CREATE TABLE story_bible(project_id TEXT,continuity_notes TEXT);
 INSERT INTO story_projects VALUES('p','2026-01-01');
 INSERT INTO story_autopilot_jobs VALUES('job','p','completed','saved continuity');
 INSERT INTO story_edits VALUES('edit','a','saved version');
 INSERT INTO story_bible VALUES('p','saved notes');`);
 const insert=db.prepare("INSERT INTO story_sections VALUES(?,'p',1,1,?,0,'paragraph',?, ?,?,1,'saved summary','2026-01-01')");
 ['a','b','c'].forEach((id,i)=>insert.run(id,i+1,'Chapter 1 / P'+(i+1),'Original '+id,'Revised '+id));
 t.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});return {db,path};
}
test('manual split/rename is atomic and keeps IDs, source/revisions, history, continuity and passage order',t=>{
 const {db,path}=fixture(t);
 const immutable=()=>db.prepare('SELECT id,original_text,edited_text,preserve_verbatim,summary FROM story_sections ORDER BY chapter_index,scene_index,paragraph_index').all();
 const before=immutable();const layout=readChapterLayout(path,'p');
 // Opening/cancelling uses reads only.
 assert.deepEqual(immutable(),before);assert.equal(readChapterLayout(path,'p').revision,layout.revision);
 const boundaries=[{startId:'a',title:'Departure'},{startId:'b',title:'Homecoming'}];
 assert.equal(saveChapterLayout(path,'p',{revision:layout.revision,boundaries}).changed,true);
 assert.deepEqual(immutable(),before);
 assert.deepEqual(db.prepare('SELECT chapter_index FROM story_sections ORDER BY chapter_index,paragraph_index').all().map(r=>r.chapter_index),[1,2,2]);
 assert.equal(db.prepare('SELECT suggestion FROM story_edits').get().suggestion,'saved version');
 assert.equal(db.prepare('SELECT continuity_notes FROM story_bible').get().continuity_notes,'saved notes');
 assert.equal(db.prepare('SELECT plan_json FROM story_autopilot_jobs').get().plan_json,'saved continuity');
 assert.throws(()=>saveChapterLayout(path,'p',{revision:layout.revision,boundaries}),e=>e.status===409);
 const latest=readChapterLayout(path,'p');
 assert.equal(saveChapterLayout(path,'p',{revision:latest.revision,boundaries}).changed,false,'Repeated save is a no-op');
 assert.equal(readChapterLayout(path,'p').revision,latest.revision);
 assert.throws(()=>saveChapterLayout(path,'p',{revision:latest.revision,boundaries:[{startId:'b',title:'Lost start'}]}),e=>e.status===400);
 assert.equal(readChapterLayout(path,'p').revision,latest.revision,'Invalid save changes nothing');
});
test('layout rejects active editing, stale prose and missing projects',t=>{
 const {db,path}=fixture(t);const layout=readChapterLayout(path,'p');
 db.exec("UPDATE story_autopilot_jobs SET status='running'");assert.equal(readChapterLayout(path,'p').busy,true);
 assert.throws(()=>saveChapterLayout(path,'p',{revision:layout.revision,boundaries:[{startId:'a',title:'New'}]}),e=>e.status===409);
 db.exec("UPDATE story_autopilot_jobs SET status='completed';UPDATE story_sections SET edited_text='Changed elsewhere' WHERE id='a'");
 assert.throws(()=>saveChapterLayout(path,'p',{revision:layout.revision,boundaries:layout.boundaries}),e=>e.status===409);
 assert.throws(()=>readChapterLayout(path,'missing'),e=>e.status===404);
});

test('actual import parser preserves front matter, repeated headings and no-heading source',()=>{
 let id=0;const sections=splitStoryManuscript('A dedication.\nCHAPTER 1\nFirst prose.\nCHAPTER 1\nMore prose.\nCHAPTER II\nSecond prose.',()=>String(++id));
 assert.deepEqual(sections.filter(s=>s.kind==='paragraph').map(s=>[s.chapterIndex,s.originalText]),[[1,'A dedication.'],[2,'First prose.'],[2,'More prose.'],[3,'Second prose.']]);
 assert.equal(sections.filter(s=>s.kind==='chapter').length,2);
 assert.equal(sections.filter(s=>s.originalText==='CHAPTER 1').length,2,'Repeated heading text stays saved');
 assert.equal(new Set(sections.map(s=>s.id)).size,sections.length);
 const simple=splitStoryManuscript('Chapter 1\nProse.\nChapter 2\nMore prose.',()=>String(++id));
 assert.equal(simple[0].kind,'chapter','Default Chapter 1 is recognized as a structural heading');
 const plain=splitStoryManuscript('One long paragraph.\nMore prose.\n\nAnother paragraph.',()=>String(++id));
 assert.deepEqual(plain.map(s=>s.chapterIndex),[1,1]);
 assert.equal(plain[0].originalText,'One long paragraph.\nMore prose.');
});

test('scene divisions and child line rows stay attached when chapters move',t=>{
 const {db,path}=fixture(t);
 db.exec("UPDATE story_sections SET scene_index=2,paragraph_index=1 WHERE id='c'; INSERT INTO story_sections VALUES('h','p',1,2,0,0,'scene','Scene','Scene break',NULL,0,'','2026-01-01'); INSERT INTO story_sections VALUES('line','p',1,2,1,1,'line','Line','Original line','Revised line',1,'','2026-01-01');");
 const layout=readChapterLayout(path,'p');
 saveChapterLayout(path,'p',{revision:layout.revision,boundaries:[{startId:'a',title:'Departure'},{startId:'b',title:'Homecoming'}]});
 const parent=db.prepare("SELECT chapter_index,scene_index,paragraph_index FROM story_sections WHERE id='c'").get();
 const line=db.prepare("SELECT chapter_index,scene_index,paragraph_index FROM story_sections WHERE id='line'").get();
 assert.deepEqual(line,parent);assert.equal(parent.chapter_index,2);assert.equal(parent.scene_index,2);
 assert.equal(db.prepare("SELECT original_text FROM story_sections WHERE id='h'").get().original_text,'Scene break');
});

test('within-passage split preserves exact source/revised strings, original export snapshot and parent history',t=>{
 const {db,path}=fixture(t);
 const original='Opening scene. CHAPTER TWO The return home.';
 const revised='The opening scene is warmer. CHAPTER TWO She returns home quietly.';
 db.prepare("UPDATE story_sections SET original_text=?,edited_text=? WHERE id='b'").run(original,revised);
 const preview=readPassageSplit(path,'p','b');
 const saved=splitSavedPassage(path,'p',{revision:preview.revision,sectionId:'b',originalOffset:original.indexOf('CHAPTER'),revisedOffset:revised.indexOf('CHAPTER'),chapterTitle:'The return'});
 const children=saved.childIds.map(id=>db.prepare('SELECT * FROM story_sections WHERE id=?').get(id));
 assert.equal(children.map(s=>s.original_text).join(''),original);assert.equal(children.map(s=>s.edited_text).join(''),revised);
 assert.equal(children[0].chapter_index,1);assert.equal(children[1].chapter_index,2);
 const parent=db.prepare("SELECT * FROM story_sections WHERE id='b'").get();assert.equal(parent.kind,'split-source');assert.equal(parent.original_text,original);assert.equal(parent.edited_text,revised);
 const snapshot=JSON.parse(db.prepare("SELECT sections_json FROM story_original_snapshots WHERE project_id='p'").get().sections_json);
 assert.equal(snapshot.find(s=>s.id==='b').original_text,original);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM story_edits').get().n,1);
 const before=readChapterLayout(path,'p').revision;
 assert.throws(()=>splitSavedPassage(path,'p',{revision:preview.revision,sectionId:'b',originalOffset:5,revisedOffset:5,chapterTitle:'Repeat'}),e=>e.status===409);
 assert.equal(readChapterLayout(path,'p').revision,before);
 // A second split archives the child too, while the first original snapshot stays intact.
 const child=children[1];const p=readPassageSplit(path,'p',child.id);
 splitSavedPassage(path,'p',{revision:p.revision,sectionId:child.id,originalOffset:child.original_text.indexOf('The'),revisedOffset:child.edited_text.indexOf('She'),chapterTitle:'Further on'});
 assert.equal(JSON.parse(db.prepare("SELECT sections_json FROM story_original_snapshots WHERE project_id='p'").get().sections_json).find(s=>s.id==='b').original_text,original);
});
test('invalid split offsets/title roll back all rows and split records; active editing blocks split',t=>{
 const {db,path}=fixture(t);const preview=readPassageSplit(path,'p','b');
 for(const input of [{originalOffset:3,revisedOffset:3,chapterTitle:'Two'},{originalOffset:0,revisedOffset:8,chapterTitle:'Two'},{originalOffset:9,revisedOffset:8,chapterTitle:''}]) {
  assert.throws(()=>splitSavedPassage(path,'p',{revision:preview.revision,sectionId:'b',...input}),e=>e.status===400);
  assert.equal(readChapterLayout(path,'p').revision,preview.revision);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM story_passage_splits').get().n,0);
 }
 db.exec("UPDATE story_autopilot_jobs SET status='running'");
 assert.throws(()=>splitSavedPassage(path,'p',{revision:preview.revision,sectionId:'b',originalOffset:9,revisedOffset:8,chapterTitle:'Two'}),e=>e.status===409);
});

test('unrevised passage split keeps preservation holds and needs only the original boundary',t=>{
 const {db,path}=fixture(t);db.exec("UPDATE story_sections SET edited_text=NULL WHERE id='b'");
 const preview=readPassageSplit(path,'p','b');assert.equal(preview.hasRevision,false);
 const saved=splitSavedPassage(path,'p',{revision:preview.revision,sectionId:'b',originalOffset:9,chapterTitle:'Second chapter'});
 const children=saved.childIds.map(id=>db.prepare('SELECT * FROM story_sections WHERE id=?').get(id));
 assert.equal(children.map(c=>c.original_text).join(''),'Original b');assert.ok(children.every(c=>c.edited_text===null && c.preserve_verbatim===1));
});
test('passages with child-line edits are rejected without changing saved source or metadata',t=>{
 const {db,path}=fixture(t);
 db.exec("INSERT INTO story_sections VALUES('line-b','p',1,1,2,1,'line','Saved line','Original line','Revised line',1,'','2026-01-01')");
 const preview=readPassageSplit(path,'p','b');
 assert.throws(()=>splitSavedPassage(path,'p',{revision:preview.revision,sectionId:'b',originalOffset:9,revisedOffset:8,chapterTitle:'Second'}),e=>e.status===409 && /line edits/.test(e.message));
 assert.equal(readChapterLayout(path,'p').revision,preview.revision);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM story_original_snapshots').get().n,0);
});
