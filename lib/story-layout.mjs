import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { validateChapterLayout } from './story-chapters.mjs';

function error(message, status) { return Object.assign(new Error(message), {status}); }
function snapshot(db, projectId) {
 if (!db.prepare('SELECT id FROM story_projects WHERE id=?').get(projectId)) throw error('Project not found.',404);
 const sections=db.prepare('SELECT * FROM story_sections WHERE project_id=? ORDER BY chapter_index,scene_index,paragraph_index,line_index').all(projectId);
 const names=db.prepare('SELECT chapter_index,title FROM story_chapter_names WHERE project_id=? ORDER BY chapter_index').all(projectId);
 const revision=createHash('sha256').update(JSON.stringify({sections,names})).digest('hex');
 const top=sections.filter(s=>['chapter','scene','paragraph'].includes(s.kind));
 const starts=top.filter((s,i)=>i===0 || s.chapter_index!==top[i-1].chapter_index);
 const boundaries=starts.map(s=>({startId:s.id,title:names.find(n=>n.chapter_index===s.chapter_index)?.title || (s.kind==='chapter'?s.original_text.replace(/\s+/g,' '):s.chapter_index===1 && top.some(t=>t.kind==='chapter')?'Front matter':`Chapter ${s.chapter_index}`)}));
 return {sections,top,revision,boundaries};
}
function connection(path) { const db=new DatabaseSync(path);db.exec('PRAGMA busy_timeout=5000');return db; }
export function readChapterLayout(path,projectId) {
 const db=connection(path);
 try {
  db.exec('BEGIN');
  const data=snapshot(db,projectId);
  const busy=Boolean(db.prepare("SELECT id FROM story_autopilot_jobs WHERE project_id=? AND status IN ('queued','running') LIMIT 1").get(projectId));
  db.exec('COMMIT');
  return {revision:data.revision,boundaries:data.boundaries,busy,passages:data.top.map(s=>({id:s.id,kind:s.kind,chapterIndex:s.chapter_index,preview:(s.edited_text || s.original_text).slice(0,180)}))};
 } finally {db.close();}
}
function preserveOriginal(db,projectId,data) {
 db.prepare('INSERT OR IGNORE INTO story_original_snapshots(project_id,sections_json) VALUES(?,?)').run(projectId,JSON.stringify(data.top));
}
function guard(db,projectId,data,revision) {
 if(typeof revision!=='string' || revision!==data.revision) throw error('The manuscript changed. Reopen chapter organization before saving.',409);
 if(db.prepare("SELECT id FROM story_autopilot_jobs WHERE project_id=? AND status IN ('queued','running') LIMIT 1").get(projectId)) throw error('Wait for editing to finish before changing chapters.',409);
}
function applyLayout(db,projectId,data,plan) {

  const now=new Date(data.sections.reduce((latest,s)=>Math.max(latest,Date.parse(s.updated_at)||0),Date.now())+1).toISOString();
  const update=db.prepare(`UPDATE story_sections SET chapter_index=?,scene_index=?,paragraph_index=?,label=?,updated_at=?,line_index=CASE WHEN kind IN ('chapter','scene','paragraph') THEN 0 ELSE line_index END WHERE project_id=? AND id=?`);
  const coordinates=new Map();let chapter=0,scene=1,position=0;
  for(let i=0;i<data.top.length;i++) {
   if(plan[chapter+1]?.position===i) {chapter++;scene=1;position=0;}
   const section=data.top[i];
   if(i>plan[chapter].position && ['chapter','scene'].includes(section.kind)) scene++;
   position++;
   coordinates.set(`${section.chapter_index}/${section.scene_index}/${section.paragraph_index}`,{chapter:chapter+1,scene,position,title:plan[chapter].title});
   update.run(chapter+1,scene,position,section.kind==='paragraph'?`${plan[chapter].title} / Passage ${position}`:section.label,now,projectId,section.id);
  }
  for(const section of data.sections.filter(s=>!['chapter','scene','paragraph','split-source'].includes(s.kind))) {
   const parent=coordinates.get(`${section.chapter_index}/${section.scene_index}/${section.paragraph_index}`);
   if(!parent) throw error('A saved passage could not be matched. No chapter changes were saved.',409);
   update.run(parent.chapter,parent.scene,parent.position,section.label,now,projectId,section.id);
  }
  db.prepare('DELETE FROM story_chapter_names WHERE project_id=?').run(projectId);
  const name=db.prepare('INSERT INTO story_chapter_names(project_id,chapter_index,title) VALUES(?,?,?)');
  for(const item of plan) name.run(projectId,item.index,item.title);
  db.prepare('UPDATE story_projects SET updated_at=? WHERE id=?').run(now,projectId);
}
export function saveChapterLayout(path,projectId,input={}) {
 if(!input || typeof input!=='object' || Array.isArray(input)) throw error('Choose valid chapter boundaries.',400);
 const {revision,boundaries}=input;
 const db=connection(path);
 try {
  db.exec('BEGIN IMMEDIATE');
  const data=snapshot(db,projectId);
  if(typeof revision!=='string' || revision!==data.revision) throw error('The manuscript changed. Reopen chapter organization before saving.',409);
  if(db.prepare("SELECT id FROM story_autopilot_jobs WHERE project_id=? AND status IN ('queued','running') LIMIT 1").get(projectId)) throw error('Wait for editing to finish before changing chapters.',409);
  let plan;
  try {plan=validateChapterLayout(data.top,boundaries);} catch(e) {throw error(e.message,400);}
  if(JSON.stringify(plan.map(({startId,title})=>({startId,title})))===JSON.stringify(data.boundaries)) {
   db.exec('COMMIT');return {changed:false};
  }
  preserveOriginal(db,projectId,data);
  applyLayout(db,projectId,data,plan);
  db.exec('COMMIT');return {changed:true};
 } catch(e) {try {db.exec('ROLLBACK');} catch {}throw e;}
 finally {db.close();}
}

export function readPassageSplit(path,projectId,sectionId) {
 const db=connection(path);
 try {
  db.exec('BEGIN');const data=snapshot(db,projectId);
  const section=data.top.find(s=>s.id===sectionId && s.kind==='paragraph');
  if(!section) throw error('Saved passage not found.',404);
  db.exec('COMMIT');
  return {revision:data.revision,sectionId,originalText:section.original_text,revisedText:section.edited_text || section.original_text,hasRevision:Boolean(section.edited_text)};
 } finally {db.close();}
}
export function passageSplitPieces(text,offset) {
 if(!Number.isInteger(offset) || offset<=0 || offset>=text.length || !text.slice(0,offset).trim() || !text.slice(offset).trim()) throw error('Choose a chapter start inside the passage, leaving text on both sides.',400);
 if(!/\s/.test(text[offset-1]) && !/\s/.test(text[offset])) throw error('Place the start between words, rather than inside a word.',400);
 return [text.slice(0,offset),text.slice(offset)];
}
export function splitSavedPassage(path,projectId,input={}) {
 if(!input || typeof input!=='object') throw error('Choose a saved passage and preview its split.',400);
 const db=connection(path);
 try {
  db.exec('BEGIN IMMEDIATE');const data=snapshot(db,projectId);guard(db,projectId,data,input.revision);
  const section=data.top.find(s=>s.id===input.sectionId && s.kind==='paragraph');
  if(!section) throw error('Saved passage not found.',404);
  if(data.sections.some(s=>s.kind==='line' && s.chapter_index===section.chapter_index && s.scene_index===section.scene_index && s.paragraph_index===section.paragraph_index)) throw error('This passage has saved line edits. Split at an existing passage boundary instead.',409);
  const original=passageSplitPieces(section.original_text,input.originalOffset);
  const revised=section.edited_text?passageSplitPieces(section.edited_text,input.revisedOffset):[null,null];
  preserveOriginal(db,projectId,data);
  const ids=[randomUUID(),randomUUID()];
  const now=new Date(Date.now()+1).toISOString();
  const columns=Object.keys(section);
  const insert=db.prepare(`INSERT INTO story_sections (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`);
  for(let i=0;i<2;i++) {
   const child={...section,id:ids[i],kind:'paragraph',original_text:original[i],edited_text:revised[i],summary:'',line_index:i,created_at:now,updated_at:now};
   insert.run(...columns.map(c=>child[c]));
  }
  // Keep the entire source/revision and all edit-history links on the archived parent.
  db.prepare("UPDATE story_sections SET kind='split-source',updated_at=? WHERE id=? AND project_id=?").run(now,section.id,projectId);
  db.prepare('INSERT INTO story_passage_splits(parent_id,project_id,child_ids,created_at) VALUES(?,?,?,?)').run(section.id,projectId,JSON.stringify(ids),now);
  const fresh=snapshot(db,projectId);
  const boundaries=data.boundaries.map(b=>({...b,startId:b.startId===section.id?ids[0]:b.startId}));
  boundaries.push({startId:ids[1],title:input.chapterTitle});
  boundaries.sort((a,b)=>fresh.top.findIndex(s=>s.id===a.startId)-fresh.top.findIndex(s=>s.id===b.startId));
  let plan;try {plan=validateChapterLayout(fresh.top,boundaries);}catch(e){throw error(e.message,400);}
  applyLayout(db,projectId,fresh,plan);
  db.exec('COMMIT');return {changed:true,parentId:section.id,childIds:ids};
 } catch(e) {try {db.exec('ROLLBACK');}catch{}throw e;}
 finally {db.close();}
}
