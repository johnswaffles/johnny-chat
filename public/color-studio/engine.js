// Image-to-puzzle pipeline. All image processing runs locally in a Worker.
function simplifyChain(points,tolerance=.65){
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
function simplifyOutline(loop,map,width,height){
  // Junctions anchor shared edges, so neighboring shapes simplify identically.
  let anchors=[];
  loop.forEach(([x,y],i)=>{const around=new Set();for(const [dx,dy]of[[-1,-1],[0,-1],[-1,0],[0,0]]){const px=x+dx,py=y+dy;around.add(px<0||py<0||px>=width||py>=height?-1:map[py*width+px]);}if(around.size>2)anchors.push(i);});
  if(!anchors.length){let first=0;loop.forEach((p,i)=>{if(p[1]*1000+p[0]<loop[first][1]*1000+loop[first][0])first=i;});anchors=[first];}
  if(anchors.length===1){const a=loop[anchors[0]];let far=-1,index=0,key=Infinity;loop.forEach((p,i)=>{const d=(p[0]-a[0])**2+(p[1]-a[1])**2,k=p[1]*1000+p[0];if(d>far||(d===far&&k<key)){far=d;index=i;key=k;}});anchors.push(index);}
  anchors.sort((a,b)=>a-b);const out=[];
  for(let k=0;k<anchors.length;k++){const start=anchors[k],end=anchors[(k+1)%anchors.length],chain=[];let i=start;do{chain.push(loop[i]);i=(i+1)%loop.length;}while(i!==end);chain.push(loop[end]);out.push(...simplifyChain(chain).slice(0,-1));}
  return out.length>=3?out:loop;
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
  const point=(x,y)=>y*(width+1)+x;
  const dist=new Uint16Array(n).fill(65000);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x,id=regionMap[i],r=regions[id];let edge=false;
    if(y===0||regionMap[i-width]!==id){r.edges.push([point(x,y),point(x+1,y)]);edge=true;}
    if(x===width-1||regionMap[i+1]!==id){r.edges.push([point(x+1,y),point(x+1,y+1)]);edge=true;}
    if(y===height-1||regionMap[i+width]!==id){r.edges.push([point(x+1,y+1),point(x,y+1)]);edge=true;}
    if(x===0||regionMap[i-1]!==id){r.edges.push([point(x,y+1),point(x,y)]);edge=true;}
    if(edge)dist[i]=1;
    else dist[i]=Math.min(x?dist[i-1]+1:1,y?dist[i-width]+1:1);
  }
  for(let y=height-1;y>=0;y--)for(let x=width-1;x>=0;x--){
    const i=y*width+x,id=regionMap[i];
    if(x<width-1&&regionMap[i+1]===id)dist[i]=Math.min(dist[i],dist[i+1]+1);
    if(y<height-1&&regionMap[i+width]===id)dist[i]=Math.min(dist[i],dist[i+width]+1);
    const r=regions[id];if(dist[i]>r.radius){r.radius=dist[i];r.x=x+.5;r.y=y+.5;}
  }
  for(const r of regions){
    const next=new Map();for(const [a,b] of r.edges){if(!next.has(a))next.set(a,[]);next.get(a).push(b);}
    while(next.size){
      const start=next.keys().next().value;let a=start;const loop=[];
      do{
        loop.push([a%(width+1),Math.floor(a/(width+1))]);
        const list=next.get(a);if(!list)break;const b=list.pop();if(!list.length)next.delete(a);a=b;
      }while(a!==start);
      // Retain corners, remove straight-line vertices. Shared outlines remain identical.
      const simplified=loop.filter((p,i)=>{const prev=loop[(i+loop.length-1)%loop.length],q=loop[(i+1)%loop.length];return (p[0]-prev[0])*(q[1]-p[1])!==(p[1]-prev[1])*(q[0]-p[0]);});
      if(simplified.length>2)r.paths.push(simplifyOutline(simplified,regionMap,width,height));
    }
    delete r.edges;
  }
  report('Your canvas is ready',1);
  return {version:1,width,height,palette:used.map(c=>palette[c]),regions,map:Array.from(regionMap)};
}

export function validPuzzle(p) {
  return !!p && p.version===1 && Number.isInteger(p.width)&&p.width>0&&p.width<=640&&Number.isInteger(p.height)&&p.height>0&&p.height<=640&&
    Array.isArray(p.palette)&&p.palette.length>0&&p.palette.length<=48&&p.palette.every(c=>Array.isArray(c)&&c.length===3&&c.every(v=>Number.isFinite(v)&&v>=0&&v<=255))&&
    Array.isArray(p.regions)&&p.regions.length>0&&p.regions.length<=3000&&p.regions.every(r=>Number.isInteger(r.color)&&r.color>=0&&r.color<p.palette.length&&Number.isFinite(r.x)&&Number.isFinite(r.y)&&Number.isFinite(r.radius)&&Number.isFinite(r.size)&&Array.isArray(r.paths)&&r.paths.every(path=>Array.isArray(path)&&path.length<=100000&&path.every(v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite))))&&
    Array.isArray(p.map)&&p.map.length===p.width*p.height&&p.map.every(v=>Number.isInteger(v)&&v>=0&&v<p.regions.length);
}
