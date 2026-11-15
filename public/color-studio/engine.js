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
// Trace each shared boundary exactly once. Both adjoining regions reuse the
// SAME simplified points in opposite directions, including junction endpoints.
export function repairGeometry(puzzle) {
  const {width:w,height:h,map,regions}=puzzle,edges=[],vertices=new Map();
  const point=(x,y)=>y*(w+1)+x,xy=id=>[id%(w+1),Math.floor(id/(w+1))];
  function add(a,b,right,left){const id=edges.length;edges.push({a,b,right,left,used:false});for(const v of [a,b]){if(!vertices.has(v))vertices.set(v,[]);vertices.get(v).push(id);}}
  for(let y=0;y<=h;y++)for(let x=0;x<w;x++){const above=y?map[(y-1)*w+x]:-1,below=y<h?map[y*w+x]:-1;if(above!==below)add(point(x,y),point(x+1,y),below,above);}
  for(let x=0;x<=w;x++)for(let y=0;y<h;y++){const left=x?map[y*w+x-1]:-1,right=x<w?map[y*w+x]:-1;if(left!==right)add(point(x,y),point(x,y+1),left,right);}
  const chains=[],byRegion=regions.map(()=>[]);
  function trace(id,start){
    const first=edges[id],right=first.a===start?first.right:first.left,left=first.a===start?first.left:first.right;
    const points=[xy(start)];let v=start;
    while(true){const e=edges[id];if(e.used)break;e.used=true;v=e.a===v?e.b:e.a;points.push(xy(v));const adjacent=vertices.get(v);if(v===start||adjacent.length!==2)break;const next=adjacent.find(i=>!edges[i].used);if(next===undefined)break;id=next;}
    // Closed boundaries use the same canonical two halves for every owner.
    let clean;
    if(v===start){let split=1,far=0;points.forEach((p,i)=>{const d=(p[0]-points[0][0])**2+(p[1]-points[0][1])**2;if(d>far){far=d;split=i;}});clean=[...simplifyChain(points.slice(0,split+1)).slice(0,-1),...simplifyChain(points.slice(split))];}
    else clean=simplifyChain(points);
    if(v===start&&new Set(clean.map(p=>p.join(','))).size<3)clean=points;
    const chain={points:clean,right,left};chains.push(chain);
    if(right>=0)byRegion[right].push({start,end:v,points:clean});
    if(left>=0)byRegion[left].push({start:v,end:start,points:[...clean].reverse()});
  }
  for(const [v,adjacent]of vertices)if(adjacent.length!==2)for(const id of adjacent)if(!edges[id].used)trace(id,v);
  edges.forEach((e,id)=>{if(!e.used)trace(id,e.a);});
  regions.forEach((r,id)=>{
    r.paths=[];delete r.edges;r.radius=0;
    const outgoing=new Map();for(const c of byRegion[id]){if(!outgoing.has(c.start))outgoing.set(c.start,[]);outgoing.get(c.start).push(c);}
    while(outgoing.size){const start=outgoing.keys().next().value;let v=start,loop=[];
      do{const list=outgoing.get(v);if(!list)throw new Error('An artwork boundary is open.');const c=list.pop();if(!list.length)outgoing.delete(v);loop.push(...c.points.slice(0,-1));v=c.end;}while(v!==start);
      if(loop.length>=3)r.paths.push(loop);
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
    const radius=distances[i];if(radius<=1&&!pointInRegion(r,x+.5,y+.5))continue;if(radius>r.radius){r.radius=radius;r.x=x+.5;r.y=y+.5;}
    const tile=Math.floor(y/12)*Math.ceil(w/12)+Math.floor(x/12),old=anchors[id].get(tile);
    if(!old||radius>old.radius)anchors[id].set(tile,{x:x+.5,y:y+.5,radius});
  }
  regions.forEach((r,id)=>{r.labels=[...anchors[id].values()];});
  puzzle.boundaries=chains;puzzle.geometryVersion=3;return puzzle;
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
  if(options.smooth !== false) {
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
    const id=components.length, color=labels[start]; let head=0,tail=1;
    queue[0]=start;regionMap[start]=id;
    while(head<tail){
      const p=queue[head++], x=p%width;
      for(const q of [x>0?p-1:-1,x<width-1?p+1:-1,p>=width?p-width:-1,p<n-width?p+width:-1]){
        if(q>=0&&regionMap[q]===-1&&labels[q]===color){regionMap[q]=id;queue[tail++]=q;}
      }
    }
    components.push({id,color,size:tail,adj:new Map()});
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
    if(c.size>=minimum&&remaining<=maxRegions)continue;
    const adjacent=new Map();for(const [b,edge] of c.adj){const r=root(b);if(r!==a)adjacent.set(r,(adjacent.get(r)||0)+edge);}
    let target=-1,score=Infinity;
    for(const [b,edge] of adjacent){
      const p=palette[c.color],q=palette[components[b].color];
      const delta=(p[0]-q[0])**2*.3+(p[1]-q[1])**2*.59+(p[2]-q[2])**2*.11;
      const s=(delta+60)/Math.sqrt(edge);if(s<score){score=s;target=b;}
    }
    if(target<0)continue;
    parent[a]=target;components[target].size+=c.size;remaining--;
    for(const [b,edge] of adjacent)if(b!==target){
      components[target].adj.set(b,(components[target].adj.get(b)||0)+edge);
      components[b].adj.set(target,(components[b].adj.get(target)||0)+edge);
    }
    c.adj.clear();
  }
  report('Drawing the outlines', .72);
  const compact=new Map(),regions=[];
  for(let i=0;i<n;i++){
    const r=root(regionMap[i]);
    if(!compact.has(r)){compact.set(r,regions.length);regions.push({color:components[r].color,size:0,x:0,y:0,radius:0,paths:[],edges:[]});}
    const id=compact.get(r);regionMap[i]=id;regions[id].size++;
  }
  const used=[...new Set(regions.map(r=>r.color))].sort((a,b)=>a-b),colorIndex=new Map(used.map((c,i)=>[c,i]));
  regions.forEach(r=>r.color=colorIndex.get(r.color));
  const puzzle={version:1,width,height,palette:used.map(c=>palette[c]),regions,map:Array.from(regionMap)};
  repairGeometry(puzzle);
  report('Your canvas is ready',1);
  return puzzle;
}

export function validPuzzle(p) {
  return !!p && p.version===1 && Number.isInteger(p.width)&&p.width>0&&p.width<=640&&Number.isInteger(p.height)&&p.height>0&&p.height<=640&&
    Array.isArray(p.palette)&&p.palette.length>0&&p.palette.length<=48&&p.palette.every(c=>Array.isArray(c)&&c.length===3&&c.every(v=>Number.isFinite(v)&&v>=0&&v<=255))&&
    Array.isArray(p.regions)&&p.regions.length>0&&p.regions.length<=3000&&p.regions.every(r=>Number.isInteger(r.color)&&r.color>=0&&r.color<p.palette.length&&Number.isFinite(r.x)&&Number.isFinite(r.y)&&Number.isFinite(r.radius)&&Number.isFinite(r.size)&&Array.isArray(r.paths)&&r.paths.every(path=>Array.isArray(path)&&path.length<=100000&&path.every(v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite))))&&
    Array.isArray(p.map)&&p.map.length===p.width*p.height&&p.map.every(v=>Number.isInteger(v)&&v>=0&&v<p.regions.length);
}
