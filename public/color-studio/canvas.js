import {pointInRegion} from './engine.js?v=20261115-alpine-3';
export const rgb=c=>`rgb(${c.join(',')})`;
export function appendCommands(path,commands){for(const c of commands){if(c[0]==='M')path.moveTo(c[1],c[2]);else if(c[0]==='Q')path.quadraticCurveTo(c[1],c[2],c[3],c[4]);else path.lineTo(c[1],c[2]);}}
export const svgCommands=commands=>commands.map(c=>c[0]+c.slice(1).join(' ')).join('');
export function regionPath(r){const p=new Path2D();if(r.curves){for(const loop of r.curves){appendCommands(p,loop);p.closePath();}}else for(const loop of r.paths){if(!loop.length)continue;p.moveTo(...loop[0]);for(let i=1;i<loop.length;i++)p.lineTo(...loop[i]);p.closePath();}return p;}
export function boundaryPath(puzzle){const p=new Path2D();for(const chain of puzzle.boundaries||[]){if(chain.commands)appendCommands(p,chain.commands);else{p.moveTo(...chain.points[0]);for(let i=1;i<chain.points.length;i++)p.lineTo(...chain.points[i]);}}return p;}
const checkerPatterns=new WeakMap();
export function checkerPattern(ctx,scale,contrast=false){
  let cached=checkerPatterns.get(ctx);if(!cached){cached={};checkerPatterns.set(ctx,cached);}
  const key=contrast?'contrast':'soft';
  if(!cached[key]){
    const tile=typeof OffscreenCanvas==='function'?new OffscreenCanvas(8,8):document.createElement('canvas');
    tile.width=tile.height=8;const paint=tile.getContext('2d');
    paint.fillStyle=contrast?'#e2e5df':'#edf0e9';paint.fillRect(0,0,8,8);
    paint.fillStyle=contrast?'#899681':'#b6c1ad';paint.fillRect(0,0,4,4);paint.fillRect(4,4,4,4);
    cached[key]=ctx.createPattern(tile,'repeat');
  }
  // Four CSS pixels per check at every zoom, clipped by the actual region path.
  cached[key].setTransform({a:1/scale,b:0,c:0,d:1/scale,e:0,f:0});return cached[key];
}
export function labelPositions(puzzle,filled,{scale=1,selected=-1,viewport={x:0,y:0,width:puzzle.width,height:puzzle.height}}={}){
  const margin=7/scale,v=viewport,inView=p=>p.x>=v.x+margin&&p.x<=v.x+v.width-margin&&p.y>=v.y+margin&&p.y<=v.y+v.height-margin;
  const candidates=puzzle.regions.flatMap((r,id)=>{
    if(filled.has(id))return [];
    const active=r.color===selected;
    let best=inView(r)?r:null;
    if(!best)for(const p of r.labels||[])if(inView(p)&&(!best||p.radius>best.radius))best=p;
    if(!best)return [];
    const size=Math.min(10/scale,best.radius*1.1);
    if(size*scale<8)return [];
    return [{id,color:r.color,x:best.x,y:best.y,size,active,radius:best.radius}];
  });
  // Prioritize the selected color, then roomy spaces. Crowded labels emerge
  // as the player zooms or fills their neighbors, instead of obscuring them.
  candidates.sort((a,b)=>Number(b.active)-Number(a.active)||b.radius-a.radius||a.id-b.id);
  const placed=[];
  for(const l of candidates){
    const digits=String(l.color+1).length,width=l.size*scale*digits*.65,height=l.size*scale;
    const box={x:l.x*scale,y:l.y*scale,width,height};
    if(placed.some(p=>Math.abs(p.box.x-box.x)<(p.box.width+width)/2+3&&Math.abs(p.box.y-box.y)<(p.box.height+height)/2+3))continue;
    placed.push({...l,box});
  }
  return placed;
}
export function drawPuzzle(ctx,puzzle,filled,{scale=1,selected=-1,numbers=true,reference=false,contrast=false,focused=-1,paths=null,outline=null,empty=false,highlight=true,viewport}={}){
  const {width,height,regions,palette}=puzzle;
  ctx.fillStyle='#fffefa';ctx.fillRect(0,0,width,height);ctx.lineJoin='round';ctx.lineCap='round';
  const checker=selected>=0&&highlight&&!empty&&!reference?checkerPattern(ctx,scale,contrast):null;
  regions.forEach((r,i)=>{
    const path=paths?.[i]||regionPath(r),done=reference||filled.has(i);
    ctx.fillStyle=done?rgb(palette[r.color]):r.color===selected&&checker?checker:'#fffefa';
    ctx.fill(path,'evenodd');
  });
  // One stroke for the shared edge network, constant visual weight at any zoom.
  if(!reference){ctx.strokeStyle=contrast?'#455143':'#77816f';ctx.lineWidth=(contrast?1.3:1)/scale;ctx.stroke(outline||boundaryPath(puzzle));}
  if(numbers&&!reference){
    ctx.textAlign='center';ctx.textBaseline='middle';
    for(const label of labelPositions(puzzle,filled,{scale,selected,viewport})){
      ctx.font=`400 ${label.size}px system-ui,sans-serif`;
      ctx.fillStyle=contrast?'#34452b':'#6d7565';ctx.fillText(String(label.color+1),label.x,label.y);
    }
  }
  if(focused>=0&&!reference){ctx.strokeStyle='#b46a3f';ctx.lineWidth=2/scale;ctx.stroke(paths?.[focused]||regionPath(regions[focused]));}
}
export function previewURL(puzzle,filled=new Set(),reference=false,size=380){const c=document.createElement('canvas');const s=size/Math.max(puzzle.width,puzzle.height);c.width=Math.round(puzzle.width*s);c.height=Math.round(puzzle.height*s);const ctx=c.getContext('2d');ctx.scale(s,s);drawPuzzle(ctx,puzzle,filled,{scale:s,reference,numbers:!reference});return c.toDataURL('image/png');}

export class PaintingCanvas {
  constructor(canvas,{paint,onZoom,onFocus,onAim,preferences}){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.paint=paint;this.onZoom=onZoom;this.onFocus=onFocus;this.preferences=preferences;this.pointers=new Map();this.zoom=1;this.pan={x:0,y:0};this.dragMode=false;this.focused=-1;this.selected=0;this.reference=false;this.ready=false;this.lastTap=0;this.frame=0;
    this.onAim=onAim;this.aim=null;this.holdTimer=null;
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);
    canvas.addEventListener('pointerdown',e=>this.down(e));canvas.addEventListener('pointermove',e=>this.move(e));canvas.addEventListener('pointerup',e=>this.up(e));canvas.addEventListener('pointercancel',e=>this.cancel(e));canvas.addEventListener('lostpointercapture',e=>this.cancel(e));
    canvas.addEventListener('wheel',e=>{e.preventDefault();const p=this.point(e);this.zoomAt(this.zoom*Math.exp(-e.deltaY*.002),p);},{passive:false});
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('keydown',e=>{if(e.key==='+'||e.key==='='){e.preventDefault();this.zoomAt(this.zoom*1.4);}if(e.key==='-'){e.preventDefault();this.zoomAt(this.zoom/1.4);}if(e.key==='0'){e.preventDefault();this.fit();}if(e.key==='Enter'&&this.focused>=0){e.preventDefault();this.paint(this.focused);}});
  }
  load(puzzle,filled){this.cancelAim();this.puzzle=puzzle;this.filled=filled;this.paths=puzzle.regions.map(regionPath);this.outline=boundaryPath(puzzle);this.focused=-1;this.reference=false;this.ready=true;this.pointers.clear();
    this.hitCells=new Map();puzzle.regions.forEach((r,id)=>{let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;for(const loop of r.paths)for(const [x,y] of loop){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}const x0=Math.floor((left-.1)/24),x1=Math.floor((right+.1)/24),y0=Math.floor((top-.1)/24),y1=Math.floor((bottom+.1)/24);for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const key=`${x},${y}`;if(!this.hitCells.has(key))this.hitCells.set(key,[]);this.hitCells.get(key).push(id);}});this.fit();}
  resize(){const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;this.w=r.width;this.h=r.height;this.dpr=Math.min(devicePixelRatio||1,2.5);this.canvas.width=Math.round(this.w*this.dpr);this.canvas.height=Math.round(this.h*this.dpr);if(this.ready){this.base=Math.min((this.w-12)/this.puzzle.width,(this.h-12)/this.puzzle.height);this.constrain();this.schedule();}}
  fit(){this.zoom=1;this.pan={x:0,y:0};this.resize();this.onZoom?.(this.zoom);}
  point(e){const r=this.canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
  origin(){return{x:(this.w-this.puzzle.width*this.base*this.zoom)/2+this.pan.x,y:(this.h-this.puzzle.height*this.base*this.zoom)/2+this.pan.y};}
  logical(p){const o=this.origin(),s=this.base*this.zoom;return{x:(p.x-o.x)/s,y:(p.y-o.y)/s};}
  constrain(){const s=this.base*this.zoom;const limitX=Math.max(0,(this.puzzle.width*s-this.w)/2)+this.w*.22,limitY=Math.max(0,(this.puzzle.height*s-this.h)/2)+this.h*.22;this.pan.x=Math.max(-limitX,Math.min(limitX,this.pan.x));this.pan.y=Math.max(-limitY,Math.min(limitY,this.pan.y));}
  zoomAt(value,point={x:this.w/2,y:this.h/2}){if(!this.ready)return;const before=this.logical(point);this.zoom=Math.max(1,Math.min(40,value));const o=this.origin(),s=this.base*this.zoom;this.pan.x+=point.x-(o.x+before.x*s);this.pan.y+=point.y-(o.y+before.y*s);this.constrain();this.onZoom?.(this.zoom);this.schedule();}
  hitRegion(point){
    const l=this.logical(point);if(l.x<0||l.y<0||l.x>=this.puzzle.width||l.y>=this.puzzle.height)return -1;
    const candidates=this.hitCells.get(`${Math.floor(l.x/24)},${Math.floor(l.y/24)}`)||[],ctx=this.ctx;
    // Canvas hit-testing uses the exact same curved paths as the visible fills.
    if(ctx.isPointInPath){ctx.save();ctx.setTransform(1,0,0,1,0,0);const id=candidates.find(id=>ctx.isPointInPath(this.paths[id],l.x,l.y,'evenodd'));ctx.restore();return id??-1;}
    return candidates.find(id=>pointInRegion(this.puzzle.regions[id],l.x,l.y))??-1;
  }
  cancelAim(){clearTimeout(this.holdTimer);this.holdTimer=null;if(this.aim){this.aim=null;this.onAim?.(false);this.schedule();}}
  down(e){if(!this.ready||e.button>0)return;e.preventDefault();this.canvas.setPointerCapture(e.pointerId);const p=this.point(e);this.pointers.set(e.pointerId,{...p,start:p,moved:false});this.hadGesture=this.pointers.size>1;this.gesture=this.measure();this.cancelAim();
    if(this.pointers.size===1&&!this.reference&&!this.dragMode&&this.preferences.magnifier!==false)this.holdTimer=setTimeout(()=>{if(this.pointers.size===1&&!this.pointers.get(e.pointerId)?.moved){this.aim=this.point(e);this.lastTap=0;this.onAim?.(true);this.schedule();}},350);
  }
  measure(){const a=[...this.pointers.values()];return a.length>=2?{distance:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),center:{x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2}}:null;}
  move(e){const old=this.pointers.get(e.pointerId);if(!old)return;e.preventDefault();const p=this.point(e);this.pointers.set(e.pointerId,{...old,...p,moved:old.moved||Math.hypot(p.x-old.start.x,p.y-old.start.y)>8});
    if(this.pointers.size>=2){this.cancelAim();const next=this.measure();if(this.gesture&&next&&this.gesture.distance>0){this.pan.x+=next.center.x-this.gesture.center.x;this.pan.y+=next.center.y-this.gesture.center.y;this.zoomAt(this.zoom*next.distance/this.gesture.distance,next.center);}this.gesture=next;this.hadGesture=true;this.schedule();}
    else if(this.aim){this.aim=p;this.schedule();}
    else{if(Math.hypot(p.x-old.start.x,p.y-old.start.y)>8)this.cancelAim();if(this.dragMode||this.zoom>1.03){this.pan.x+=p.x-old.x;this.pan.y+=p.y-old.y;this.constrain();this.schedule();}}
  }
  up(e){const p=this.pointers.get(e.pointerId);if(!p)return;this.pointers.delete(e.pointerId);
    if(this.aim&&!this.hadGesture&&!this.reference){const id=this.hitRegion(this.point(e));this.cancelAim();if(id>=0)this.paint(id);this.gesture=this.measure();return;}
    this.cancelAim();
    if(!p.moved&&!this.hadGesture&&!this.dragMode&&!this.reference){const now=performance.now(),tap=this.point(e);
      if(now-this.lastTap<300&&this.previousTap&&Math.hypot(tap.x-this.previousTap.x,tap.y-this.previousTap.y)<24){this.zoomAt(this.zoom<3?this.zoom*2.5:1,tap);this.lastTap=0;}
      else{const id=this.hitRegion(tap);if(id>=0)this.paint(id);this.lastTap=now;this.previousTap=tap;}
    }if(!this.pointers.size)this.hadGesture=false;this.gesture=this.measure();}
  cancel(e){this.cancelAim();this.pointers.delete(e.pointerId);this.gesture=this.measure();if(!this.pointers.size)this.hadGesture=false;}
  visibleLabels(){const o=this.origin(),s=this.base*this.zoom;return labelPositions(this.puzzle,this.filled,{scale:s,selected:this.selected,viewport:{x:-o.x/s,y:-o.y/s,width:this.w/s,height:this.h/s}});}
  focusRegion(id){this.focused=id;const r=this.puzzle.regions[id];this.zoom=Math.max(2,Math.min(35,32/(Math.max(r.radius,1)*this.base)));const s=this.base*this.zoom;this.pan.x=(this.puzzle.width/2-r.x)*s;this.pan.y=(this.puzzle.height/2-r.y)*s;this.onZoom?.(this.zoom);this.onFocus?.(id);this.schedule();}
  schedule(){if(this.frame)return;this.frame=requestAnimationFrame(()=>{this.frame=0;this.draw();});}
  draw(){if(!this.ready||!this.w||!this.h)return;const ctx=this.ctx,dpr=this.dpr,o=this.origin(),s=this.base*this.zoom;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,this.w,this.h);ctx.save();ctx.translate(o.x,o.y);ctx.scale(s,s);ctx.shadowColor='#2b3d3218';ctx.shadowBlur=12/s;ctx.fillStyle='#fffefa';ctx.fillRect(0,0,this.puzzle.width,this.puzzle.height);ctx.shadowBlur=0;drawPuzzle(ctx,this.puzzle,this.filled,{scale:s,selected:this.selected,highlight:this.preferences.highlight,numbers:this.preferences.numbers,reference:this.reference,contrast:this.preferences.contrast,focused:this.focused,paths:this.paths,outline:this.outline,viewport:{x:-o.x/s,y:-o.y/s,width:this.w/s,height:this.h/s}});ctx.restore();if(this.aim)this.drawMagnifier();}
  drawMagnifier(){
    const ctx=this.ctx,r=66,x=Math.max(r+8,Math.min(this.w-r-8,this.aim.x)),y=this.aim.y>r*2+30?this.aim.y-r-38:Math.min(this.h-r-8,this.aim.y+r+38),point=this.logical(this.aim),scale=this.base*this.zoom*2.5,id=this.hitRegion(this.aim);
    ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.clip();ctx.fillStyle='#fffefa';ctx.fillRect(x-r,y-r,r*2,r*2);ctx.translate(x-point.x*scale,y-point.y*scale);ctx.scale(scale,scale);
    drawPuzzle(ctx,this.puzzle,this.filled,{scale,selected:this.selected,highlight:this.preferences.highlight,numbers:this.preferences.numbers,contrast:true,focused:id,paths:this.paths,outline:this.outline,viewport:{x:point.x-r/scale,y:point.y-r/scale,width:r*2/scale,height:r*2/scale}});ctx.restore();
    ctx.save();ctx.strokeStyle='#354e40';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#b46a3f';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-7,y);ctx.lineTo(x+7,y);ctx.moveTo(x,y-7);ctx.lineTo(x,y+7);ctx.stroke();ctx.restore();
  }
}
