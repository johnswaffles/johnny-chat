// Shared chapter boundaries keep displayed and narrated text identical.
export function bookChapters(sections, names = []) {
  const chapters = [];
  for (const section of sections) {
    if (!['chapter', 'scene', 'paragraph'].includes(section.kind)) continue;
    const index = Number(section.chapterIndex) || 1;
    let chapter = chapters.find(c => c.index === index);
    if (!chapter) { chapter = { index, title: index===1 && sections.some(s=>s.kind==='chapter' && Number(s.chapterIndex)>1) ? 'Front matter' : `Chapter ${index}`, blocks: [] }; chapters.push(chapter); }
    const text = String(section.editedText || section.originalText || '').trim();
    if (section.kind === 'chapter') chapter.title = text || chapter.title;
    else if (text) chapter.blocks.push({ kind: section.kind, text });
  }
  for (const chapter of chapters) chapter.title = names.find(n=>Number(n.chapterIndex)===chapter.index)?.title || chapter.title;
  return chapters.filter(c => c.blocks.length).map(c => ({ ...c, text: [c.title, ...c.blocks.map(b => b.text)].join('\n\n') }));
}

export function speechParts(text, limit = 3800) {
  const parts = [];
  let remaining = String(text || '');
  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf('\n\n', limit);
    if (cut < limit / 2) {
      const sentences = [...remaining.slice(0, limit).matchAll(/[.!?]["”’']?\s+/g)];
      cut = sentences.length ? sentences.at(-1).index + sentences.at(-1)[0].length : -1;
    }
    if (cut < limit / 2) cut = remaining.lastIndexOf(' ', limit);
    if (cut < 1) cut = limit;
    // Avoid splitting a Unicode surrogate pair at the provider limit.
    if (/[\uD800-\uDBFF]/.test(remaining[cut - 1])) cut--;
    parts.push(remaining.slice(0, cut)); remaining = remaining.slice(cut);
  }
  if (remaining) parts.push(remaining);
  return parts;
}
