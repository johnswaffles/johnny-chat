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

export function colorProgress(puzzle,filled){
  const totals=new Array(puzzle.palette.length).fill(0),remaining=totals.slice();
  puzzle.regions.forEach((region,id)=>{totals[region.color]++;if(!filled.has(id))remaining[region.color]++;});
  const fractions=totals.map((total,color)=>total?(total-remaining[color])/total:0);
  return {totals,remaining,fractions,completed:totals.filter((total,color)=>total>0&&remaining[color]===0).length};
}

export function progressPercent(done,total){return total>0?(done>=total?100:Math.min(99,Math.round(done/total*100))):0;}

export function colorCompletionMessage(progress,color){
  if(!progress.totals[color]||progress.remaining[color])return '';
  return `Color ${color+1} complete · ${progress.completed} of ${progress.totals.filter(Boolean).length} colors finished`;
}

// Prefer a comfortable target already on screen; only move when one is needed.
// All anchors come from the same audited interior points used by number labels.
export function findHint(puzzle,filled,color,viewport,previous=-1){
  const {x,y,width,height,scale}=viewport,cx=x+width/2,cy=y+height/2,margin=18/scale;
  const visible=p=>p.x>=x+margin&&p.x<=x+width-margin&&p.y>=y+margin&&p.y<=y+height-margin;
  let candidates=puzzle.regions.flatMap((r,id)=>{
    if(r.color!==color||filled.has(id))return [];
    const anchors=[r,...(r.labels||[])].map(p=>({x:p.x,y:p.y,radius:p.radius}));
    const ranked=anchors.map(anchor=>({anchor,visible:visible(anchor),comfortable:visible(anchor)&&anchor.radius*scale>=10,distance:Math.hypot(anchor.x-cx,anchor.y-cy)/Math.max(width,height)}));
    ranked.sort((a,b)=>Number(b.comfortable)-Number(a.comfortable)||Number(b.visible)-Number(a.visible)||(a.comfortable?a.distance-b.distance:b.anchor.radius-a.anchor.radius));
    return [{id,...ranked[0]}];
  });
  if(candidates.some(c=>c.id!==previous))candidates=candidates.filter(c=>c.id!==previous);
  candidates.sort((a,b)=>Number(b.comfortable)-Number(a.comfortable)||Number(b.visible)-Number(a.visible)||(a.comfortable?a.distance-b.distance:(a.distance+2/Math.max(a.anchor.radius,1))-(b.distance+2/Math.max(b.anchor.radius,1)))||a.id-b.id);
  const best=candidates[0];return best?{id:best.id,anchor:best.anchor,keepView:best.comfortable}:null;
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
