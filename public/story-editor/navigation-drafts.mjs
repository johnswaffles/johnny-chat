// Unsent fields belong to a manuscript, never to whichever file opens next.
export const NAVIGATION_FIELDS=['studio-input','studio-note','studio-goal','author-request-text','autopilot-intent','edit-note','suggestion-text','bible-characters','bible-settings','bible-timeline','bible-plot','bible-tone','bible-continuity'];
export function createNavigationDrafts(storage){
 const memory=new Map(),baseline=new Map();const key=id=>'johnny-story-unsent:'+id;
 function read(id){if(memory.has(id))return memory.get(id);try{const value=JSON.parse(storage?.getItem(key(id))||'{}');if(value&&typeof value==='object'&&!Array.isArray(value)){const safe=Object.fromEntries(NAVIGATION_FIELDS.filter(k=>typeof value[k]==='string').map(k=>[k,value[k]]));memory.set(id,safe);return safe;}}catch{}return {};}
 return {read,baseline(id,values){baseline.set(id,{...values});},capture(id,values){if(!id)return true;const clean=baseline.get(id)||{},draft=Object.fromEntries(Object.entries(values).filter(([k,v])=>NAVIGATION_FIELDS.includes(k)&&typeof v==='string'&&v!==(clean[k]??'')));memory.set(id,draft);try{storage?.setItem(key(id),JSON.stringify(draft));return !!storage;}catch{return false;}},clear(id){memory.delete(id);baseline.delete(id);try{storage?.removeItem(key(id));}catch{try{storage?.setItem(key(id),'{}');}catch{}}}};
}
