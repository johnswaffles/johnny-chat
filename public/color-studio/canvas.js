export const rgb=c=>`rgb(${c.join(',')})`;
export function regionPath(r){const p=new Path2D();for(const loop of r.paths){if(!loop.length)continue;const corners=loop.map((v,i)=>{const a=loop[(i+loop.length-1)%loop.length],b=loop[(i+1)%loop.length],l=Math.hypot(a[0]-v[0],a[1]-v[1]),m=Math.hypot(b[0]-v[0],b[1]-v[1]),d=Math.min(.45,l/3,m/3);return{v,in:[v[0]+(a[0]-v[0])*d/(l||1),v[1]+(a[1]-v[1])*d/(l||1)],out:[v[0]+(b[0]-v[0])*d/(m||1),v[1]+(b[1]-v[1])*d/(m||1)]};});p.moveTo(...corners[0].in);for(const c of corners){p.lineTo(...c.in);p.quadraticCurveTo(...c.v,...c.out);}p.closePath();}return p;}
export function drawPuzzle(ctx,puzzle,filled,{scale=1,selected=-1,numbers=true,reference=false,contrast=false,focused=-1,paths=null,empty=false}={}){
  const {width,height,regions,palette}=puzzle;
  ctx.fillStyle='#fffefa';ctx.fillRect(0,0,width,height);ctx.lineJoin='round';
  const line=contrast?'#657260':'#b8bcae';
  regions.forEach((r,i)=>{
    const path=paths?.[i]||regionPath(r),done=reference||filled.has(i);
    ctx.fillStyle=done?rgb(palette[r.color]):r.color===selected&&!empty?(contrast?'#d1dbc4':'#e2e9d9'):'#fffefa';
    ctx.fill(path,'evenodd');
    if(!reference){ctx.strokeStyle=line;ctx.lineWidth=Math.max(.24,.65/scale);ctx.stroke(path);}
  });
  if(numbers&&!reference){
    ctx.textAlign='center';ctx.textBaseline='middle';
    regions.forEach((r,i)=>{
      if(filled.has(i))return;
      const size=Math.min(13/scale,r.radius*1.35);
      if(size*scale<7.5)return;
      ctx.font=`${r.color===selected?'600':'400'} ${size}px system-ui,sans-serif`;
      ctx.fillStyle=r.color===selected?'#2d543b':contrast?'#34452b':'#8a927e';ctx.fillText(String(r.color+1),r.x,r.y);
    });
  }
  if(focused>=0&&!reference){const r=regions[focused];ctx.strokeStyle='#ca7856';ctx.lineWidth=2.8/scale;ctx.stroke(paths?.[focused]||regionPath(r));ctx.beginPath();ctx.arc(r.x,r.y,Math.max(r.radius+2,15/scale),0,Math.PI*2);ctx.stroke();}
}
export function previewURL(puzzle,filled=new Set(),reference=false,size=380){const c=document.createElement('canvas');const s=size/Math.max(puzzle.width,puzzle.height);c.width=Math.round(puzzle.width*s);c.height=Math.round(puzzle.height*s);const ctx=c.getContext('2d');ctx.scale(s,s);drawPuzzle(ctx,puzzle,filled,{scale:s,reference,numbers:!reference});return c.toDataURL('image/png');}

export class PaintingCanvas {
  constructor(canvas,{paint,onZoom,onFocus,preferences}){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.paint=paint;this.onZoom=onZoom;this.onFocus=onFocus;this.preferences=preferences;this.pointers=new Map();this.zoom=1;this.pan={x:0,y:0};this.dragMode=false;this.focused=-1;this.selected=0;this.reference=false;this.ready=false;this.lastTap=0;this.frame=0;
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);
    canvas.addEventListener('pointerdown',e=>this.down(e));canvas.addEventListener('pointermove',e=>this.move(e));canvas.addEventListener('pointerup',e=>this.up(e));canvas.addEventListener('pointercancel',e=>this.cancel(e));canvas.addEventListener('lostpointercapture',e=>this.cancel(e));
    canvas.addEventListener('wheel',e=>{e.preventDefault();const p=this.point(e);this.zoomAt(this.zoom*Math.exp(-e.deltaY*.002),p);},{passive:false});
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('keydown',e=>{if(e.key==='+'||e.key==='='){e.preventDefault();this.zoomAt(this.zoom*1.4);}if(e.key==='-'){e.preventDefault();this.zoomAt(this.zoom/1.4);}if(e.key==='0'){e.preventDefault();this.fit();}if(e.key==='Enter'&&this.focused>=0){e.preventDefault();this.paint(this.focused);}});
  }
  load(puzzle,filled){this.puzzle=puzzle;this.filled=filled;this.paths=puzzle.regions.map(regionPath);this.focused=-1;this.reference=false;this.ready=true;this.pointers.clear();this.fit();}
  resize(){const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;this.w=r.width;this.h=r.height;this.dpr=Math.min(devicePixelRatio||1,2.5);this.canvas.width=Math.round(this.w*this.dpr);this.canvas.height=Math.round(this.h*this.dpr);if(this.ready){this.base=Math.min((this.w-28)/this.puzzle.width,(this.h-28)/this.puzzle.height);this.constrain();this.schedule();}}
  fit(){this.zoom=1;this.pan={x:0,y:0};this.resize();this.onZoom?.(this.zoom);}
  point(e){const r=this.canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
  origin(){return{x:(this.w-this.puzzle.width*this.base*this.zoom)/2+this.pan.x,y:(this.h-this.puzzle.height*this.base*this.zoom)/2+this.pan.y};}
  logical(p){const o=this.origin(),s=this.base*this.zoom;return{x:(p.x-o.x)/s,y:(p.y-o.y)/s};}
  constrain(){const s=this.base*this.zoom;const limitX=Math.max(0,(this.puzzle.width*s-this.w)/2)+this.w*.22,limitY=Math.max(0,(this.puzzle.height*s-this.h)/2)+this.h*.22;this.pan.x=Math.max(-limitX,Math.min(limitX,this.pan.x));this.pan.y=Math.max(-limitY,Math.min(limitY,this.pan.y));}
  zoomAt(value,point={x:this.w/2,y:this.h/2}){if(!this.ready)return;const before=this.logical(point);this.zoom=Math.max(1,Math.min(40,value));const o=this.origin(),s=this.base*this.zoom;this.pan.x+=point.x-(o.x+before.x*s);this.pan.y+=point.y-(o.y+before.y*s);this.constrain();this.onZoom?.(this.zoom);this.schedule();}
  down(e){if(!this.ready||e.button>0)return;e.preventDefault();this.canvas.setPointerCapture(e.pointerId);const p=this.point(e);this.pointers.set(e.pointerId,{...p,start:p,moved:false});this.hadGesture=this.pointers.size>1;this.gesture=this.measure();}
  measure(){const a=[...this.pointers.values()];return a.length>=2?{distance:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),center:{x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2}}:null;}
  move(e){const old=this.pointers.get(e.pointerId);if(!old)return;e.preventDefault();const p=this.point(e);this.pointers.set(e.pointerId,{...old,...p,moved:old.moved||Math.hypot(p.x-old.start.x,p.y-old.start.y)>8});
    if(this.pointers.size>=2){const next=this.measure();if(this.gesture&&next&&this.gesture.distance>0){this.pan.x+=next.center.x-this.gesture.center.x;this.pan.y+=next.center.y-this.gesture.center.y;this.zoomAt(this.zoom*next.distance/this.gesture.distance,next.center);}this.gesture=next;this.hadGesture=true;this.schedule();}
    else if(this.dragMode||this.zoom>1.03){this.pan.x+=p.x-old.x;this.pan.y+=p.y-old.y;this.constrain();this.schedule();}
  }
  up(e){const p=this.pointers.get(e.pointerId);if(!p)return;this.pointers.delete(e.pointerId);
    if(!p.moved&&!this.hadGesture&&!this.dragMode&&!this.reference){const now=performance.now(),tap=this.point(e);
      if(now-this.lastTap<300&&this.previousTap&&Math.hypot(tap.x-this.previousTap.x,tap.y-this.previousTap.y)<24){this.zoomAt(this.zoom<3?this.zoom*2.5:1,tap);this.lastTap=0;}
      else{const l=this.logical(tap),x=Math.floor(l.x),y=Math.floor(l.y);if(x>=0&&x<this.puzzle.width&&y>=0&&y<this.puzzle.height)this.paint(this.puzzle.map[y*this.puzzle.width+x]);this.lastTap=now;this.previousTap=tap;}
    }if(!this.pointers.size)this.hadGesture=false;this.gesture=this.measure();}
  cancel(e){this.pointers.delete(e.pointerId);this.gesture=this.measure();if(!this.pointers.size)this.hadGesture=false;}
  focusRegion(id){this.focused=id;const r=this.puzzle.regions[id];this.zoom=Math.max(2,Math.min(35,32/(Math.max(r.radius,1)*this.base)));const s=this.base*this.zoom;this.pan.x=(this.puzzle.width/2-r.x)*s;this.pan.y=(this.puzzle.height/2-r.y)*s;this.onZoom?.(this.zoom);this.onFocus?.(id);this.schedule();}
  schedule(){if(this.frame)return;this.frame=requestAnimationFrame(()=>{this.frame=0;this.draw();});}
  draw(){if(!this.ready||!this.w||!this.h)return;const ctx=this.ctx,dpr=this.dpr,o=this.origin(),s=this.base*this.zoom;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,this.w,this.h);ctx.save();ctx.translate(o.x,o.y);ctx.scale(s,s);ctx.shadowColor='#2b3d3218';ctx.shadowBlur=12/s;ctx.fillStyle='#fffefa';ctx.fillRect(0,0,this.puzzle.width,this.puzzle.height);ctx.shadowBlur=0;drawPuzzle(ctx,this.puzzle,this.filled,{scale:s,selected:this.preferences.highlight?this.selected:-1,numbers:this.preferences.numbers,reference:this.reference,contrast:this.preferences.contrast,focused:this.focused,paths:this.paths});ctx.restore();}
}
