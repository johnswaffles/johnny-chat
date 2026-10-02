// Conservative structural parsing: never infer chapters from length or prose.
const ones = '(?:one|two|three|four|five|six|seven|eight|nine)';
const small = `(?:${ones}|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[- ]${ones})?)`;
const numbers = `(?:[0-9]{1,3}|[IVXLCDM]+|${small}|${ones} hundred(?: (?:and )?${small})?)`;
const chapter = new RegExp(`^chapter\\s+${numbers}(?:\\s*[.:—–-]\\s*[^\\n]{1,80}|[.:])?$`, 'i');
export function chapterHeading(line) {
 const value=String(line).trim().replace(/^#{1,3}\s+/, '');
 if(value.length>110 || /\.{2,}|\t/.test(value)) return '';
 return chapter.test(value) || /^(?:prologue|epilogue)(?:\s*[:—–-]\s*[^\n]{1,80})?$/i.test(value) ? value : '';
}
export function manuscriptBlocks(text) {
 // Isolate explicit heading lines even when PDF extraction has no blank lines.
 const out=[]; let prose=[];
 const flush=()=>{if(prose.length){out.push(prose.join('\n'));prose=[];}};
 const lines=String(text).split('\n');
 for(let i=0;i<lines.length;i++) {
  let line=lines[i];
  if(/^chapter$/i.test(line.trim()) && chapterHeading(`${line} ${lines[i+1]?.trim()}`)) line+='\n'+lines[++i];
  if(!line.trim()){flush();continue;}
  if(chapterHeading(line)){flush();out.push(line.trim());} else prose.push(line);
 }
 flush();return out;
}
export function pdfPageText(items) {
 let result='',lastY;
 for(const item of items) {
  if(typeof item.str!=='string') continue;
  const y=item.transform?.[5];
  if(result && Number.isFinite(y) && Number.isFinite(lastY) && Math.abs(y-lastY)>2 && !result.endsWith('\n')) result+='\n';
  if(result && !/[\s]$/.test(result) && item.str && !/^\s/.test(item.str)) result+=' ';
  result+=item.str;
  if(item.hasEOL) result+='\n';
  lastY=y;
 }
 return result;
}
export function validateChapterLayout(sections, boundaries) {
 const top=sections.filter(s=>['chapter','scene','paragraph'].includes(s.kind));
 if(!Array.isArray(boundaries) || !boundaries.length || boundaries.length>500) throw new Error('Choose at least one chapter and at most 500.');
 let previous=-1;
 const plan=boundaries.map((b,i)=>{
  if(!b || typeof b!=='object') throw new Error('Choose a valid chapter start.');
  const position=top.findIndex(s=>s.id===b.startId);
  if(position<0 || position<=previous || (i===0 && position!==0)) throw new Error('Chapter starts must be unique, in manuscript order, and include the beginning.');
  const title=typeof b.title==='string'?b.title.trim():'';
  if(!title || title.length>110 || /[\r\n\x00-\x1f]/.test(title)) throw new Error('Give each chapter a single-line name of at most 110 characters.');
  previous=position;return {startId:b.startId,title,position,index:i+1};
 });
 for(let i=0;i<plan.length;i++) {
  const end=plan[i+1]?.position??top.length;
  if(!top.slice(plan[i].position,end).some(s=>s.kind==='paragraph')) throw new Error('Every chapter must contain a saved passage.');
 }
 return plan;
}

export function splitStoryManuscript(text,makeId) {
  const blocks = manuscriptBlocks(text);
  const sections = [];
  let chapterIndex = 1;
  let sceneIndex = 1;
  let paragraphIndex = 0;
  let currentChapterTitle = blocks.some(block=>chapterHeading(block)) ? "Front matter" : "Chapter 1";
  let previousChapterHeading = "";
  let currentSceneTitle = "Scene 1";

  for (const block of blocks) {
    if (chapterHeading(block)) {
      // Repeated PDF running headings stay saved, without opening another chapter.
      if (sections.length && chapterHeading(block).replace(/\s+/g,' ').toLowerCase() === previousChapterHeading) {
        sections.push({id:makeId(),kind:"scene",chapterIndex,sceneIndex:++sceneIndex,paragraphIndex:0,lineIndex:0,label:block,originalText:block});
        paragraphIndex=0;
        continue;
      }
      currentChapterTitle = block;
      previousChapterHeading = chapterHeading(block).replace(/\s+/g,' ').toLowerCase();
      chapterIndex += sections.length ? 1 : 0;
      sceneIndex = 1;
      paragraphIndex = 0;
      sections.push({
        id: makeId(),
        kind: "chapter",
        chapterIndex,
        sceneIndex,
        paragraphIndex: 0,
        lineIndex: 0,
        label: currentChapterTitle,
        originalText: block
      });
      continue;
    }

    if (/^(\*\s*){3,}$|^#{1,3}\s|^scene\b/i.test(block) && block.length < 160) {
      currentSceneTitle = /^#{1,3}\s/.test(block) ? block.replace(/^#{1,3}\s*/, "") : block;
      sceneIndex += paragraphIndex ? 1 : 0;
      paragraphIndex = 0;
      sections.push({
        id: makeId(),
        kind: "scene",
        chapterIndex,
        sceneIndex,
        paragraphIndex: 0,
        lineIndex: 0,
        label: currentSceneTitle,
        originalText: block
      });
      continue;
    }

    paragraphIndex += 1;
    sections.push({
      id: makeId(),
      kind: "paragraph",
      chapterIndex,
      sceneIndex,
      paragraphIndex,
      lineIndex: 0,
      label: `${currentChapterTitle} / ${currentSceneTitle} / P${paragraphIndex}`,
      originalText: block
    });
  }

  return sections;
}
