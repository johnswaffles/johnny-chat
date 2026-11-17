import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {storySectionProtection} from './story-editor.mjs';

const fail = (message,status) => Object.assign(new Error(message),{status});

// Multer's ordinary memory storage limits each file individually. Share a byte
// budget across streams so a batch has the same memory ceiling as a manuscript.
export function manuscriptStorage(limit) {
  const totals = new WeakMap();
  return {
    _handleFile(req, file, done) {
      const chunks=[];
      let size=0, rejected=false;
      file.stream.on('data', chunk => {
        if(rejected) return;
        const total=(totals.get(req)||0)+chunk.length;
        totals.set(req,total);
        if(total>limit) {
          chunks.length=0; rejected=true;
          done(fail('The chapter files exceed the combined upload limit.',413));
          return;
        }
        size+=chunk.length; chunks.push(chunk);
      });
      file.stream.on('end',()=>{if(!rejected) done(null,{buffer:Buffer.concat(chunks,size),size});});
    },
    _removeFile(req,file,done) { delete file.buffer; done(null); }
  };
}

function readLibraryDrafts(db,ids,maxChars) {
  const files=[];
  let remaining=maxChars;
  for(const id of ids) {
    const project=db.prepare('SELECT title FROM story_projects WHERE id=?').get(id);
    if(!project) throw fail('A selected manuscript is no longer available. Refresh your library.',409);
    const rows="FROM story_sections WHERE project_id=? AND kind IN ('chapter','scene','paragraph')";
    const {characters}=db.prepare("SELECT SUM(length(COALESCE(NULLIF(edited_text,''),original_text))) AS characters "+rows).get(id);
    remaining-=characters||0;
    if(remaining<0) throw fail('The selected manuscripts exceed the combined text limit.',413);
    const sections=db.prepare("SELECT chapter_index AS chapterIndex,scene_index AS sceneIndex,paragraph_index AS paragraphIndex,line_index AS lineIndex,kind,label,COALESCE(NULLIF(edited_text,''),original_text) AS originalText,preserve_verbatim,preserve_reason "+rows+" ORDER BY chapter_index,scene_index,paragraph_index,line_index,rowid").all(id);
    for(const row of sections) row.id=randomUUID();
    const names=db.prepare('SELECT chapter_index AS chapter,title FROM story_chapter_names WHERE project_id=?').all(id);
    files.push({name:project.title,names,sections,characters});
  }
  return files;
}

export function importStoryFiles({path,projectId,append,title,files,sourceIds,intent,now,requestId,fingerprint,maxChars}) {
  const db=new DatabaseSync(path);
  try {
    db.exec('PRAGMA busy_timeout=5000; BEGIN IMMEDIATE');
    if(requestId) {
      const previous=db.prepare('SELECT fingerprint,result FROM story_import_receipts WHERE id=?').get(requestId);
      if(previous) {
        if(previous.fingerprint!==fingerprint) throw fail('This import request already used a different set of files.',409);
        return JSON.parse(previous.result);
      }
    }
    if(sourceIds) files=readLibraryDrafts(db,sourceIds,maxChars);
    let offset=0;
    if(append) {
      const project=db.prepare('SELECT title FROM story_projects WHERE id=?').get(projectId);
      if(!project) throw fail('This manuscript could not be found.',404);
      title=project.title;
      const busy=table=>db.prepare(`SELECT 1 FROM ${table} WHERE project_id=? AND status IN ('queued','running') LIMIT 1`).get(projectId);
      if(busy('story_autopilot_jobs') || (db.prepare("SELECT name FROM sqlite_master WHERE name='studio_tasks'").get() && busy('studio_tasks'))) throw fail('Finish or pause the current edit before adding chapters.',409);
      const current=db.prepare("SELECT MAX(chapter_index) AS last, SUM(length(original_text)) AS chars FROM story_sections WHERE project_id=? AND kind IN ('chapter','scene','paragraph')").get(projectId);
      if(current.chars+files.reduce((sum,file)=>sum+file.characters,0)>maxChars) throw fail('These chapters would exceed the manuscript text limit.',413);
      offset=current.last||0;
      db.prepare('UPDATE story_projects SET updated_at=? WHERE id=?').run(now,projectId);
    } else {
      db.prepare('INSERT INTO story_projects(id,title,filename,user_intent,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(projectId,title,files.length===1?files[0].name:files.length+' chapter files',intent,now,now);
      db.prepare('INSERT INTO story_bible(project_id,updated_at) VALUES(?,?)').run(projectId,now);
    }
    const insert=db.prepare('INSERT INTO story_sections(id,project_id,chapter_index,scene_index,paragraph_index,line_index,kind,label,original_text,preserve_verbatim,preserve_reason,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const nameChapter=db.prepare('INSERT INTO story_chapter_names(project_id,chapter_index,title) VALUES(?,?,?)');
    const original=append && db.prepare('SELECT sections_json FROM story_original_snapshots WHERE project_id=?').get(projectId);
    const snapshot=original ? JSON.parse(original.sections_json) : null;
    let originalOffset=snapshot?.reduce((n,row)=>Math.max(n,row.chapter_index),0)||0;
    const first=offset+1;
    let passages=0;
    for(const file of files) {
      const sections=file.sections;
      if(!sections.some(s=>s.kind==='paragraph')) throw fail(file.name+' contains no editable passages.',400);
      const count=sections.at(-1).chapterIndex;
      for(const item of file.names||[]) nameChapter.run(projectId,offset+item.chapter,item.title);
      if((append || files.length>1) && sections[0].kind!=='chapter' && !file.names?.some(n=>n.chapter===1)) {
        const name=file.name.replace(/\.(txt|docx|pdf)$/i,'').trim().slice(0,110);
        nameChapter.run(projectId,offset+1,name || 'Chapter '+(offset+1));
      }
      for(const section of sections) {
        for(const row of [section,...(section.lines||[])]) {
          const protection=storySectionProtection(row);
          insert.run(row.id,projectId,offset+row.chapterIndex,row.sceneIndex,row.paragraphIndex,row.lineIndex||0,row.kind,row.label,row.originalText,Number(protection.preserveVerbatim),protection.preserveReason,now,now);
        }
        if(snapshot) snapshot.push({kind:section.kind,chapter_index:originalOffset+section.chapterIndex,original_text:section.originalText});
        if(section.kind==='paragraph') passages++;
      }
      offset+=count; originalOffset+=count;
    }
    if(snapshot) db.prepare('UPDATE story_original_snapshots SET sections_json=? WHERE project_id=?').run(JSON.stringify(snapshot),projectId);
    const result={ok:true,projectId,title,sections:passages,chapters:offset-first+1,firstChapter:first,intent};
    if(requestId) db.prepare('INSERT INTO story_import_receipts VALUES(?,?,?,?)').run(requestId,projectId,fingerprint,JSON.stringify(result));
    db.exec('COMMIT'); return result;
  } finally {db.close();}
}
