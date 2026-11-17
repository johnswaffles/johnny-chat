const small = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
const tens = 'twenty thirty forty fifty sixty seventy eighty ninety'.split(' ');
const roman = {i:1,v:5,x:10,l:50,c:100,d:500,m:1000};

function numberIn(name) {
  const stem = name.replace(/\.(txt|docx|pdf)$/i, '').toLowerCase().replace(/[_–—-]+/g, ' ').trim();
  if (/\bprologue\b/.test(stem)) return -1;
  if (/\bepilogue\b/.test(stem)) return Infinity;
  const match = stem.match(/\b(?:chapter|ch\.?)\s*(\d+|[a-z]+)(?:\s+([a-z]+))?\b/) || stem.match(/^(\d+)\b/) || stem.match(/\b(\d+)$/);
  if (!match) return null;
  const [, first, second] = match;
  if (/^\d+$/.test(first)) return Number(first);
  if (small.includes(first)) return small.indexOf(first);
  if (tens.includes(first)) return (tens.indexOf(first)+2)*10 + (small.indexOf(second)>0 && small.indexOf(second)<10 ? small.indexOf(second) : 0);
  if (/^(?=[ivxlcdm]+$)m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/.test(first)) {
    return [...first].reduce((sum, digit, i) => sum + (roman[digit] < roman[first[i+1]] ? -roman[digit] : roman[digit]), 0);
  }
  return null;
}

export function orderChapterFiles(files) {
  // Keep unnumbered chapters in their selection order, before any epilogue.
  const rank = file => numberIn(file.name) ?? Number.MAX_SAFE_INTEGER;
  return Array.from(files).sort((a,b) => rank(a)-rank(b));
}
