// Temporary single-picture preview. Turn this off when the collection is ready.
export const singlePicturePreview=true;
export const previewPaintingId='alpine-retreat-v2';
export const isPaintingAvailable=id=>!singlePicturePreview||id===previewPaintingId;

export function nextUnfinishedColor(remaining,current){
  for(let offset=1;offset<=remaining.length;offset++){
    const color=(current+offset)%remaining.length;if(remaining[color]>0)return color;
  }
  return current;
}

// Old backups have no history. Reject unsafe entries without touching their color.
export function paintingHistory(record){
  const filled=new Set(record.filled||[]),regions=record.puzzle.regions;
  const stack=(entries,painted)=>{
    if(!Array.isArray(entries)||entries.length>regions.length)return [];
    const seen=new Set();
    for(const entry of entries){
      if(!entry||!Number.isInteger(entry.id)||!regions[entry.id]||regions[entry.id].color!==entry.color||filled.has(entry.id)!==painted||seen.has(entry.id))return [];
      seen.add(entry.id);
    }
    return entries.map(({id,color})=>({id,color}));
  };
  return {history:stack(record.history,true),redo:stack(record.redo,false)};
}

// Match progress by painted area rather than old region IDs. The caller keeps
// the entire previous painting as a separate recoverable archive before saving.
export function upgradePainting(record,puzzle,edition){
  const old=record.puzzle,painted=new Set(record.filled||[]),coverage=new Uint32Array(puzzle.regions.length),total=new Uint32Array(puzzle.regions.length);
  for(let y=0;y<puzzle.height;y++)for(let x=0;x<puzzle.width;x++){
    const id=puzzle.map[y*puzzle.width+x],ox=Math.min(old.width-1,Math.floor((x+.5)*old.width/puzzle.width)),oy=Math.min(old.height-1,Math.floor((y+.5)*old.height/puzzle.height));
    total[id]++;if(painted.has(old.map[oy*old.width+ox]))coverage[id]++;
  }
  const filled=[];for(let id=0;id<total.length;id++)if(coverage[id]&&coverage[id]>=total[id]*.5)filled.push(id);
  const color=old.palette[record.selected||0];let selected=0,distance=Infinity;
  puzzle.palette.forEach((c,i)=>{const d=c.reduce((sum,v,k)=>sum+(v-color[k])**2,0);if(d<distance){distance=d;selected=i;}});
  return {...record,puzzle,filled,selected,history:[],redo:[],edition,previousEditionId:`${record.id}-archive-${record.edition||1}`,updated:Date.now()};
}
