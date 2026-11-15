// Image-to-puzzle pipeline. All image processing runs locally in a Worker.
function simplifyChain(points,tolerance=.9){
  if(points.length<3)return points;
  const a=points[0],b=points.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
  let far=tolerance*tolerance,index=-1,key=Infinity;
  for(let i=1;i<points.length-1;i++){
    const p=points[i],t=length?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)):0;
    const distance=(p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2,pointKey=p[1]*1000+p[0];
    if(distance>far+1e-9||(Math.abs(distance-far)<1e-9&&index>=0&&pointKey<key)){far=distance;index=i;key=pointKey;}
  }
  return index<0?[a,b]:[...simplifyChain(points.slice(0,index+1),tolerance).slice(0,-1),...simplifyChain(points.slice(index),tolerance)];
}
// Even-odd containment matches Canvas and SVG, including holes.
export function pointInRegion(region,x,y){
  let inside=false;
  for(const loop of region.paths)for(let i=0,j=loop.length-1;i<loop.length;j=i++){
    const a=loop[i],b=loop[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
// Curves are built once per shared edge; adjoining fills reverse that same edge.
export function pathCommands(points,curved=false){
  if(curved&&points.length>3&&points[0][0]===points.at(-1)[0]&&points[0][1]===points.at(-1)[1]){
    const a=points[0],b=points.at(-2),seam=[(a[0]+b[0])/2,(a[1]+b[1])/2];points=[seam,...points.slice(0,-1),seam];
  }
  const commands=[['M',...points[0]]];
  for(let i=1;i<points.length-1;i++){
    const a=points[i-1],b=points[i],c=points[i+1],u=Math.hypot(b[0]-a[0],b[1]-a[1]),v=Math.hypot(c[0]-b[0],c[1]-b[1]);
    const cosine=u&&v?((a[0]-b[0])*(c[0]-b[0])+(a[1]-b[1])*(c[1]-b[1]))/(u*v):-1;
    // Keep deliberate roof/window corners, and soften short tracing zigzags.
    const corner=u>7&&v>7&&cosine>-.35;
    if(!curved||corner||!u||!v){commands.push(['L',...b]);continue;}
    const cut=Math.min(3,u*.45,v*.45),before=[b[0]+(a[0]-b[0])*cut/u,b[1]+(a[1]-b[1])*cut/u],after=[b[0]+(c[0]-b[0])*cut/v,b[1]+(c[1]-b[1])*cut/v];
    commands.push(['L',...before],['Q',...b,...after]);
  }
  commands.push(['L',...points.at(-1)]);return commands;
}
export function flattenCommands(commands){
  const points=[];let previous;
  for(const command of commands){
    if(command[0]==='Q'){
      const [_,cx,cy,x,y]=command,a=previous;
      for(let i=1;i<=8;i++){const t=i/8,s=1-t;points.push([s*s*a[0]+2*s*t*cx+t*t*x,s*s*a[1]+2*s*t*cy+t*t*y]);}
      previous=[x,y];
    }else{previous=command.slice(1);points.push(previous);}
  }
  return points;
}
function reverseCommands(commands){
  const result=[['M',...commands.at(-1).slice(-2)]];
  for(let i=commands.length-1;i>0;i--){const c=commands[i],end=commands[i-1].slice(-2);result.push(c[0]==='Q'?['Q',c[1],c[2],...end]:['L',...end]);}
  return result;
}
// Trace each shared boundary exactly once. Both adjoining regions reuse the
// SAME simplified points in opposite directions, including junction endpoints.
export function repairGeometry(puzzle,{smooth=puzzle.geometryVersion===4}={}) {
  const {width:w,height:h,map,regions}=puzzle,edges=[],vertices=new Map();
  const point=(x,y)=>y*(w+1)+x,xy=id=>[id%(w+1),Math.floor(id/(w+1))];
  function add(a,b,right,left){const id=edges.length;edges.push({a,b,right,left,used:false});for(const v of [a,b]){if(!vertices.has(v))vertices.set(v,[]);vertices.get(v).push(id);}}
  for(let y=0;y<=h;y++)for(let x=0;x<w;x++){const above=y?map[(y-1)*w+x]:-1,below=y<h?map[y*w+x]:-1;if(above!==below)add(point(x,y),point(x+1,y),below,above);}
  for(let x=0;x<=w;x++)for(let y=0;y<h;y++){const left=x?map[y*w+x-1]:-1,right=x<w?map[y*w+x]:-1;if(left!==right)add(point(x,y),point(x,y+1),left,right);}
  const chains=[],byRegion=regions.map(()=>[]);
  function trace(id,start){
    const first=edges[id],right=first.a===start?first.right:first.left,left=first.a===start?first.left:first.right;
    let points=[xy(start)];let v=start;
    while(true){const e=edges[id];if(e.used)break;e.used=true;v=e.a===v?e.b:e.a;points.push(xy(v));const adjacent=vertices.get(v);if(v===start||adjacent.length!==2)break;const next=adjacent.find(i=>!edges[i].used);if(next===undefined)break;id=next;}
    if(smooth&&right>=0&&left>=0)for(let pass=0;pass<3;pass++){
      const closed=v===start,last=points.length-1;
      points=points.map((p,i)=>{if(!closed&&(i===0||i===last))return p;const a=points[i===0||i===last?last-1:i-1],b=points[i===last?1:i+1];return [(a[0]+2*p[0]+b[0])/4,(a[1]+2*p[1]+b[1])/4];});
    }
    const simplify=points=>simplifyChain(points,smooth?1.25:.9);
    // Closed boundaries use the same canonical two halves for every owner.
    let clean;
    if(v===start){let split=1,far=0;points.forEach((p,i)=>{const d=(p[0]-points[0][0])**2+(p[1]-points[0][1])**2;if(d>far){far=d;split=i;}});clean=[...simplify(points.slice(0,split+1)).slice(0,-1),...simplify(points.slice(split))];}
    else clean=simplify(points);
    if(v===start&&new Set(clean.map(p=>p.join(','))).size<3)clean=points;
    const commands=pathCommands(clean,smooth&&right>=0&&left>=0);
    if(smooth)clean=flattenCommands(commands);
    const chain={points:clean,right,left};if(smooth)chain.commands=commands;chains.push(chain);
    if(right>=0)byRegion[right].push({start,end:v,points:clean,commands});
    if(left>=0)byRegion[left].push({start:v,end:start,points:[...clean].reverse(),commands:reverseCommands(commands)});
  }
  for(const [v,adjacent]of vertices)if(adjacent.length!==2)for(const id of adjacent)if(!edges[id].used)trace(id,v);
  edges.forEach((e,id)=>{if(!e.used)trace(id,e.a);});
  regions.forEach((r,id)=>{
    r.paths=[];delete r.edges;r.radius=0;if(smooth)r.curves=[];else delete r.curves;
    const outgoing=new Map();for(const c of byRegion[id]){if(!outgoing.has(c.start))outgoing.set(c.start,[]);outgoing.get(c.start).push(c);}
    while(outgoing.size){const start=outgoing.keys().next().value;let v=start,loop=[],commands=[];
      do{const list=outgoing.get(v);if(!list)throw new Error('An artwork boundary is open.');const c=list.pop();if(!list.length)outgoing.delete(v);loop.push(...c.points.slice(0,-1));commands.push(...c.commands.slice(commands.length?1:0));v=c.end;}while(v!==start);
      if(loop.length>=3){r.paths.push(loop);if(smooth)r.curves.push(commands);}
    }
  });
  // Interior clearance and distributed anchors support viewport-aware labels.
  const distances=new Float32Array(w*h).fill(1e6);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x,id=map[i];
    if(x===0||y===0||x===w-1||y===h-1||map[i-1]!==id||map[i+1]!==id||map[i-w]!==id||map[i+w]!==id)distances[i]=.5;
    else distances[i]=Math.min(distances[i-1]+1,distances[i-w]+1,distances[i-w-1]+Math.SQRT2,distances[i-w+1]+Math.SQRT2);
  }
  const anchors=regions.map(()=>new Map());
  for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){
    const i=y*w+x,id=map[i],r=regions[id];
    if(x<w-1)distances[i]=Math.min(distances[i],distances[i+1]+1);
    if(y<h-1){distances[i]=Math.min(distances[i],distances[i+w]+1);if(x<w-1)distances[i]=Math.min(distances[i],distances[i+w+1]+Math.SQRT2);if(x)distances[i]=Math.min(distances[i],distances[i+w-1]+Math.SQRT2);}
    const radius=distances[i];if(radius<=(smooth?3:1)&&!pointInRegion(r,x+.5,y+.5))continue;if(radius>r.radius){r.radius=radius;r.x=x+.5;r.y=y+.5;}
    const tile=Math.floor(y/12)*Math.ceil(w/12)+Math.floor(x/12),old=anchors[id].get(tile);
    if(!old||radius>old.radius)anchors[id].set(tile,{x:x+.5,y:y+.5,radius});
  }
  regions.forEach((r,id)=>{r.labels=[...anchors[id].values()];});
  puzzle.boundaries=chains;puzzle.geometryVersion=smooth?4:3;return puzzle;
}

export function quantize(rgba, width, height, count, report = () => {}) {
  const n = width * height, samples = [], stride = Math.max(1, Math.floor(n / 6500));
  const rgb = (i) => { const a = rgba[i * 4 + 3] / 255; return [0, 1, 2].map(c => rgba[i * 4 + c] * a + 255 * (1 - a)); };
  for (let i = 0; i < n; i += stride) samples.push(rgb(i));
  const distance = (a, b) => (a[0]-b[0])**2*.30 + (a[1]-b[1])**2*.59 + (a[2]-b[2])**2*.11;
  const centers = [samples[Math.floor(samples.length / 2)]];
  // Deterministic farthest-point seeding avoids unstable previews.
  const nearest = new Float64Array(samples.length).fill(Infinity);
  while (centers.length < count) {
    let far = 0, index = 0;
    samples.forEach((s, i) => { nearest[i] = Math.min(nearest[i], distance(s, centers.at(-1))); if (nearest[i] > far) { far = nearest[i]; index = i; } });
    if (far < 36) break;
    centers.push(samples[index].slice());
  }
  for (let iteration = 0; iteration < 12; iteration++) {
    const sums = centers.map(() => [0,0,0,0]);
    for (const s of samples) {
      let best = 0, score = Infinity;
      centers.forEach((c, j) => { const d = distance(s,c); if (d < score) { score=d; best=j; } });
      const a = sums[best]; for (let c=0;c<3;c++) a[c]+=s[c]; a[3]++;
    }
    centers.forEach((c, j) => { if (sums[j][3]) for (let k=0;k<3;k++) c[k]=sums[j][k]/sums[j][3]; });
  }
  centers.sort((a,b) => (a[0]*.3+a[1]*.59+a[2]*.11) - (b[0]*.3+b[1]*.59+b[2]*.11));
  const labels = new Uint8Array(n);
  for (let i=0;i<n;i++) {
    const s = rgb(i); let best=0, score=Infinity;
    centers.forEach((c,j) => { const d=distance(s,c); if(d<score){score=d;best=j;} }); labels[i]=best;
  }
  report('Finding the shapes', .42);
  return {labels, palette:centers.map(c=>c.map(Math.round))};
}

export function makePuzzle(rgba, width, height, options = {}, report = () => {}) {
  const { labels, palette } = quantize(rgba,width,height,options.colors || 24,report);
  const n=width*height;
  // A conservative majority pass removes camera noise without making a grid.
  for(let pass=0;options.smooth!==false&&pass<(options.smoothPasses||1);pass++) {
    const copy=labels.slice(), votes=new Uint8Array(palette.length);
    for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
      const i=y*width+x; votes.fill(0);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)votes[copy[i+dy*width+dx]]++;
      let winner=copy[i]; for(let c=0;c<votes.length;c++)if(votes[c]>votes[winner])winner=c;
      if(votes[winner]>=5)labels[i]=winner;
    }
  }
  const regionMap=new Int32Array(n).fill(-1), components=[], queue=new Int32Array(n);
  for(let start=0;start<n;start++){
    if(regionMap[start]!==-1)continue;
    const id=components.length, color=labels[start]; let head=0,tail=1,x0=width,y0=height,x1=0,y1=0;
    queue[0]=start;regionMap[start]=id;
    while(head<tail){
      const p=queue[head++], x=p%width,y=Math.floor(p/width);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
      for(const q of [x>0?p-1:-1,x<width-1?p+1:-1,p>=width?p-width:-1,p<n-width?p+width:-1]){
        if(q>=0&&regionMap[q]===-1&&labels[q]===color){regionMap[q]=id;queue[tail++]=q;}
      }
    }
    const detail=options.detailBoxes?.some(([left,top,right,bottom])=>x0>=left&&x1<=right&&y0>=top&&y1<=bottom)||false;
    components.push({id,color,size:tail,radius:0,detail,adj:new Map()});
  }
  if(options.minimumRadius){
    const d=new Float32Array(n).fill(1e6);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=y*width+x,id=regionMap[i];
      if(!x||!y||x===width-1||y===height-1||regionMap[i-1]!==id||regionMap[i+1]!==id||regionMap[i-width]!==id||regionMap[i+width]!==id)d[i]=.5;
      else d[i]=Math.min(d[i-1]+1,d[i-width]+1,d[i-width-1]+Math.SQRT2,d[i-width+1]+Math.SQRT2);
    }
    for(let y=height-1;y>=0;y--)for(let x=width-1;x>=0;x--){const i=y*width+x;if(x<width-1)d[i]=Math.min(d[i],d[i+1]+1);if(y<height-1){d[i]=Math.min(d[i],d[i+width]+1);if(x)d[i]=Math.min(d[i],d[i+width-1]+Math.SQRT2);if(x<width-1)d[i]=Math.min(d[i],d[i+width+1]+Math.SQRT2);}const c=components[regionMap[i]];c.radius=Math.max(c.radius,d[i]);}
  }
  const parent=Int32Array.from(components, c=>c.id);
  const root=(a)=>{while(parent[a]!==a){parent[a]=parent[parent[a]];a=parent[a];}return a;};
  for(let i=0;i<n;i++)for(const j of [i%width<width-1?i+1:-1,i<n-width?i+width:-1]){
    if(j<0)continue;const a=regionMap[i],b=regionMap[j];if(a===b)continue;
    components[a].adj.set(b,(components[a].adj.get(b)||0)+1);
    components[b].adj.set(a,(components[b].adj.get(a)||0)+1);
  }
  let remaining=components.length;
  const minimum=options.minArea || 18, maxRegions=options.maxRegions || 1800;
  for(const c of [...components].sort((a,b)=>a.size-b.size)){
    const a=root(c.id);if(a!==c.id)continue;
    if(c.size>=(c.detail?12:minimum)&&remaining<=maxRegions&&c.radius>=(c.detail?1.5:options.minimumRadius||0))continue;
    const adjacent=new Map();for(const [b,edge] of c.adj){const r=root(b);if(r!==a)adjacent.set(r,(adjacent.get(r)||0)+edge);}
    let target=-1,score=Infinity;
    for(const [b,edge] of adjacent){
      const p=palette[c.color],q=palette[components[b].color];
      const delta=(p[0]-q[0])**2*.3+(p[1]-q[1])**2*.59+(p[2]-q[2])**2*.11;
      const s=(delta+60)/Math.sqrt(edge);if(s<score){score=s;target=b;}
    }
    if(target<0)continue;
    parent[a]=target;components[target].size+=c.size;components[target].radius=Math.max(components[target].radius,c.radius);components[target].detail ||= c.detail;remaining--;
    for(const [b,edge] of adjacent)if(b!==target){
      components[target].adj.set(b,(components[target].adj.get(b)||0)+edge);
      components[b].adj.set(target,(components[b].adj.get(target)||0)+edge);
    }
    c.adj.clear();
  }
  if(options.joinSameColors)for(let i=0;i<n;i++)for(const j of [i%width<width-1?i+1:-1,i<n-width?i+width:-1]){
    if(j<0)continue;const a=root(regionMap[i]),b=root(regionMap[j]);
    if(a!==b&&components[a].color===components[b].color){parent[b]=a;components[a].size+=components[b].size;}
  }
  report('Drawing the outlines', .72);
  const compact=new Map(),regions=[];
  for(let i=0;i<n;i++){
    const r=root(regionMap[i]);
    if(!compact.has(r)){compact.set(r,regions.length);const region={color:components[r].color,size:0,x:0,y:0,radius:0,paths:[],edges:[]};if(options.detailBoxes&&components[r].detail)region.detail=true;regions.push(region);}
    const id=compact.get(r);regionMap[i]=id;regions[id].size++;
  }
  const used=[...new Set(regions.map(r=>r.color))].sort((a,b)=>a-b),colorIndex=new Map(used.map((c,i)=>[c,i]));
  regions.forEach(r=>r.color=colorIndex.get(r.color));
  const puzzle={version:1,width,height,palette:used.map(c=>palette[c]),regions,map:Array.from(regionMap)};
  repairGeometry(puzzle,{smooth:!!options.curves});
  report('Your canvas is ready',1);
  return puzzle;
}

function validCommands(commands){return Array.isArray(commands)&&commands.length>1&&commands.every((c,i)=>Array.isArray(c)&&c[0]===(i===0?'M':c.length===5?'Q':'L')&&c.length===(c[0]==='Q'?5:3)&&c.slice(1).every(Number.isFinite));}
export function validPuzzle(p) {
  return !!p && p.version===1 && Number.isInteger(p.width)&&p.width>0&&p.width<=640&&Number.isInteger(p.height)&&p.height>0&&p.height<=640&&
    (p.geometryVersion!==4||(Array.isArray(p.boundaries)&&p.boundaries.every(c=>validCommands(c.commands))))&&
    Array.isArray(p.palette)&&p.palette.length>0&&p.palette.length<=48&&p.palette.every(c=>Array.isArray(c)&&c.length===3&&c.every(v=>Number.isFinite(v)&&v>=0&&v<=255))&&
    Array.isArray(p.regions)&&p.regions.length>0&&p.regions.length<=3000&&p.regions.every(r=>Number.isInteger(r.color)&&r.color>=0&&r.color<p.palette.length&&Number.isFinite(r.x)&&Number.isFinite(r.y)&&Number.isFinite(r.radius)&&Number.isFinite(r.size)&&Array.isArray(r.paths)&&r.paths.every(path=>Array.isArray(path)&&path.length<=100000&&path.every(v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)))&&(!r.curves||(Array.isArray(r.curves)&&r.curves.every(validCommands))))&&
    Array.isArray(p.map)&&p.map.length===p.width*p.height&&p.map.every(v=>Number.isInteger(v)&&v>=0&&v<p.regions.length);
}
