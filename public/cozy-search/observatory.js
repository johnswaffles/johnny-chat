(() => {
  "use strict";
  const stage = document.querySelector(".board-stage");
  const skyMap = document.querySelector(".sky-map");
  const sky = document.getElementById("observatory-sky");
  const canvas = document.getElementById("bloom-canvas");
  const caption = document.querySelector(".bloom-caption");
  const wordLabel = document.getElementById("bloom-word");
  const kicker = document.getElementById("bloom-kicker");
  const skyCount = document.getElementById("sky-count");
  if (!stage || !skyMap || !sky || !canvas) return;
  const context = canvas.getContext("2d");
  const skyContext = sky.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const GOLD = "#ffe3a2", IVORY = "#fff9dd", JADE = "#a4ead3";
  let width = 0, height = 0, skyWidth = 0, skyHeight = 0;
  let total = 5, count = 0, seed = 1, stars = [], effects = [], previewPoints = [];
  let frameId = 0, captionTimer = 0, skyOffset = {x:0,y:0};
  const animations = new Map();
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const noise = (i) => { const n = Math.sin(i * 127.1 + seed * 31.7) * 43758.5453; return n - Math.floor(n); };

  // Reuse soft light stamps; no image reads or large per-particle gradients in the animation loop.
  const lights = new Map();
  function lightStamp(color) {
    if (lights.has(color)) return lights.get(color);
    const stamp = document.createElement("canvas"); stamp.width = stamp.height = 64;
    const c = stamp.getContext("2d");
    const g = c.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,color); g.addColorStop(.12,color+"c9"); g.addColorStop(.4,color+"35"); g.addColorStop(1,color+"00");
    c.fillStyle = g; c.fillRect(0,0,64,64); lights.set(color,stamp); return stamp;
  }
  function glow(c,x,y,r,color,alpha=1) {
    c.save(); c.globalAlpha = clamp(alpha); c.drawImage(lightStamp(color),x-r,y-r,r*2,r*2); c.restore();
  }
  function star(c,x,y,r,color,alpha=1,rotation=0) {
    c.save(); c.globalAlpha=clamp(alpha); c.translate(x,y); c.rotate(rotation);
    c.fillStyle=color; c.beginPath();
    for(let i=0;i<8;i++){const a=i*Math.PI/4-Math.PI/2,rad=i%2?r*.18:r;const px=Math.cos(a)*rad,py=Math.sin(a)*rad;if(i===0)c.moveTo(px,py);else c.lineTo(px,py);}
    c.closePath(); c.fill(); c.restore();
  }
  function seedSky() {
    const margin = total > 10 ? 9 : 28;
    stars = Array.from({length:total},(_,i)=>({
      x: margin+(skyWidth-margin*2)*(total===1?.5:i/(total-1)),
      y: 32+noise(i)*Math.max(10,skyHeight-51),
      radius: total>15 ? 2.5 : 4.5
    }));
  }
  function paintSky() {
    if(!skyContext || !skyWidth)return;
    skyContext.clearRect(0,0,skyWidth,skyHeight);
    for(let i=0;i<24;i++){
      skyContext.fillStyle=i%3?"#cbe1d429":"#edcf903d";
      skyContext.beginPath();skyContext.arc(noise(i+60)*skyWidth,24+noise(i+100)*(skyHeight-28),i%7===0?1:.5,0,Math.PI*2);skyContext.fill();
    }
    const c=skyContext;
    stars.forEach((p,i)=>{
      if(i){const prev=stars[i-1];c.beginPath();c.moveTo(prev.x,prev.y);c.lineTo(p.x,p.y);c.lineWidth=.7;c.strokeStyle=i<count?"#f8d88d9c":"#c9dacf23";c.stroke();}
      if(i<count){glow(c,p.x,p.y,18,GOLD,.48);star(c,p.x,p.y,p.radius,GOLD);star(c,p.x,p.y,p.radius*.4,IVORY);}
      else {c.strokeStyle="#b7cfcf59";c.lineWidth=.8;c.beginPath();c.arc(p.x,p.y,2,0,Math.PI*2);c.stroke();}
    });
  }
  function updateCount() {
    skyCount.textContent=`${count} / ${total}`;
    skyMap.setAttribute("aria-label",`${count} of ${total} constellation stars lit${count===total?". Constellation complete":""}`);
  }
  function pointsFor(cells) {
    const bounds=stage.getBoundingClientRect();
    return cells.filter(c=>c.isConnected).map(cell=>{const r=cell.getBoundingClientRect();return {x:r.left-bounds.left+r.width/2,y:r.top-bounds.top+r.height/2};});
  }
  function drawPreview() {
    if(!context || previewPoints.length<2)return;
    const a=previewPoints[0],b=previewPoints.at(-1);
    context.save();context.strokeStyle="#fff1ba";context.globalAlpha=.68;context.lineWidth=2;context.lineCap="round";
    context.beginPath();context.moveTo(a.x,a.y);context.lineTo(b.x,b.y);context.stroke();
    glow(context,b.x,b.y,13,GOLD,.6);star(context,b.x,b.y,4,IVORY);context.restore();
  }
  function resize() {
    const rect=stage.getBoundingClientRect(),sr=skyMap.getBoundingClientRect();
    const changed=Math.round(rect.width)!==width||Math.round(rect.height)!==height;
    skyOffset={x:sr.left-rect.left,y:sr.top-rect.top};
    if(!changed && skyWidth===Math.round(sr.width))return;
    width=Math.round(rect.width);height=Math.round(rect.height);skyWidth=Math.round(sr.width);skyHeight=Math.round(sr.height);
    const dpr=Math.min(devicePixelRatio||1,innerWidth<=820?1.5:2);
    [[canvas,context,width,height],[sky,skyContext,skyWidth,skyHeight]].forEach(([c,ctx,w,h])=>{
      c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);ctx?.setTransform(dpr,0,0,dpr,0,0);
    });
    // A changed board geometry ends transient effects rather than leaving trails at old coordinates.
    clear();seedSky();paintSky();
  }
  function clear() {
    cancelAnimationFrame(frameId);frameId=0;clearTimeout(captionTimer);
    effects=[];previewPoints=[];animations.forEach(animation=>animation.cancel());animations.clear();
    context?.clearRect(0,0,width,height);caption.classList.remove("is-visible");stage.classList.remove("has-bloom","has-finale");
  }
  function reset(nextTotal,nextSeed) {
    clear();total=nextTotal;count=0;seed=nextSeed;resize();seedSky();updateCount();paintSky();
  }
  function animateCells(cells,finalWord) {
    if(reduced.matches)return;
    cells.forEach((cell,i)=>{
      animations.get(cell)?.cancel();
      const animation=cell.animate([
        {transform:"translateY(0)",filter:"brightness(1)"},
        {transform:"translateY(-3px)",filter:"brightness(1.2)",offset:.35},
        {transform:"translateY(0)",filter:"brightness(1)"}
      ],{duration:650,delay:Math.min(i*(finalWord?20:43),300),easing:"cubic-bezier(.2,.75,.3,1)"});
      animations.set(cell,animation);
      animation.finished.catch(()=>{}).finally(()=>{if(animations.get(cell)===animation)animations.delete(cell);});
    });
  }
  function bezier(from,to,p,bend=1) {
    const a=1-p,c1={x:from.x+width*.17*bend,y:from.y-35},c2={x:to.x-width*.13*bend,y:to.y+60};
    return {x:a*a*a*from.x+3*a*a*p*c1.x+3*a*p*p*c2.x+p*p*p*to.x,y:a*a*a*from.y+3*a*a*p*c1.y+3*a*p*p*c2.y+p*p*p*to.y};
  }
  function paintEffect(effect,age) {
    const c=context,points=effect.points,origin=points[Math.floor(points.length/2)],first=points[0],last=points.at(-1);
    const t=age/1000;
    // The light follows the actual letters, including vertical and reverse selections.
    if(t<.7){const p=clamp(t/.44),x=first.x+(last.x-first.x)*p,y=first.y+(last.y-first.y)*p;
      c.save();c.lineCap="round";c.strokeStyle=IVORY;c.lineWidth=2.5;c.globalAlpha=clamp(1-t/.7);
      c.beginPath();c.moveTo(first.x,first.y);c.lineTo(x,y);c.stroke();c.restore();glow(c,x,y,28,GOLD,.8);star(c,x,y,7,IVORY);}
    if(t>.16&&t<1.05){const p=(t-.16)/.89,fade=(1-p)*.52;
      c.save();c.strokeStyle=GOLD;c.globalAlpha=fade;c.lineWidth=1.3;c.beginPath();c.ellipse(origin.x,origin.y,16+p*width*.46,8+p*height*.19,-.13,0,Math.PI*2);c.stroke();
      c.globalAlpha=fade*.6;c.beginPath();c.ellipse(origin.x,origin.y,10+p*width*.4,5+p*height*.27,.18,0,Math.PI*2);c.stroke();c.restore();
      glow(c,origin.x,origin.y,100,GOLD,Math.sin(p*Math.PI)*.26);}
    if(t>.32&&t<1.36){const p=(t-.32)/1.04;
      for(let i=23;i>=0;i--){const q=clamp(p-i*.008),v=bezier(origin,effect.target,q,effect.bend);
        glow(c,v.x,v.y,9-(i/24)*5,i%4?GOLD:JADE,(1-i/24)*.6);
        if(i===0){star(c,v.x,v.y,8,IVORY,1,t*.8);glow(c,v.x,v.y,24,GOLD,.8);}
      }
    }
    for(const particle of effect.particles){const a=t-particle.delay;if(a<0||a>particle.life)continue;const q=a/particle.life,fade=Math.sin(Math.min(q*5,1)*Math.PI/2)*(1-q);
      const x=particle.x+particle.vx*a,y=particle.y+particle.vy*a+28*a*a;
      if(particle.spark){star(c,x,y,particle.size*(1-q*.4),particle.color,fade,particle.spin*a);if(particle.size>3)glow(c,x,y,10,particle.color,fade*.28);}
      else {c.save();c.globalAlpha=fade*.72;c.strokeStyle=particle.color;c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(x-particle.vx*.025,y-particle.vy*.025);c.stroke();c.restore();}
    }
    if(t>1.26&&t<2.15){const p=(t-1.26)/.89;glow(c,effect.target.x,effect.target.y,45,GOLD,(1-p)*.65);star(c,effect.target.x,effect.target.y,5+(1-p)*10,IVORY,1-p*.5);}
    if(effect.finalWord&&t>.45){
      const p=clamp((t-.45)/3.4),fade=Math.sin(p*Math.PI);
      c.save();c.globalCompositeOperation="screen";
      for(let i=0;i<11;i++){
        const y=skyOffset.y+25+i*4;
        c.strokeStyle=i<6?JADE:"#c1b2ef";c.globalAlpha=fade*(.048-i*.0018);c.lineWidth=16;
        c.beginPath();c.moveTo(-25,y+32);c.bezierCurveTo(width*.25,y-50+Math.sin(t)*12,width*.62,y+65,width+25,y-15);c.stroke();
      }
      c.restore();
      const lit=Math.min(stars.length,Math.ceil((t-.7)*stars.length/1.3));
      stars.slice(0,Math.max(0,lit)).forEach((p,i)=>{const pulse=clamp(1-(t-.7-i*1.3/stars.length));glow(c,p.x+skyOffset.x,p.y+skyOffset.y,24,GOLD,pulse*.55);});
    }
  }
  function frame(now) {
    frameId=0;if(!context)return;
    context.clearRect(0,0,width,height);drawPreview();
    effects=effects.filter(effect=>now-effect.started<effect.duration);
    effects.forEach(effect=>paintEffect(effect,now-effect.started));
    if(effects.length&&!document.hidden)frameId=requestAnimationFrame(frame);
  }
  function found({word,cells,color,revealed,finalWord,count:nextCount,total:nextTotal}) {
    if(!cells.length)return;
    resize();count=nextCount;total=nextTotal;updateCount();paintSky();
    clearTimeout(captionTimer);
    wordLabel.textContent=finalWord?"Your sky is alive":word;
    kicker.textContent=finalWord?"Constellation complete":revealed?"A little guidance":"Beautifully found";
    caption.classList.add("is-visible");stage.classList.add("has-bloom");stage.classList.toggle("has-finale",finalWord);
    captionTimer=setTimeout(()=>{caption.classList.remove("is-visible");stage.classList.remove("has-bloom","has-finale");},reduced.matches?1800:finalWord?4100:2050);
    animateCells(cells,finalWord);
    if(reduced.matches||document.hidden)return;
    const points=pointsFor(cells),targetStar=stars[Math.min(count-1,stars.length-1)];
    if(!points.length||!targetStar)return;
    const target={x:targetStar.x+skyOffset.x,y:targetStar.y+skyOffset.y};
    const number=innerWidth<=820?(finalWord?76:42):(finalWord?146:86);
    const particles=Array.from({length:number},(_,i)=>{
      const p=points[i%points.length],angle=i*2.3999632,speed=20+Math.random()*(finalWord?150:93),spread=finalWord&&i%3===0;
      return {x:spread?width*Math.random():p.x,y:spread?skyOffset.y+skyHeight:p.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-45,delay:.14+(i%cells.length)*.035,life:.65+Math.random()*(finalWord?1.6:.9),size:1.4+Math.random()*3.2,color:i%5===0?JADE:i%3===0?IVORY:GOLD,spark:i%3!==0,spin:Math.random()-.5};
    });
    effects.push({points,target,color,particles,finalWord,started:performance.now(),duration:finalWord?4100:2200,bend:count%2?1:-1});
    effects=effects.slice(-4);
    if(!frameId)frameId=requestAnimationFrame(frame);
  }
  function preview(cells) {
    previewPoints=reduced.matches?[]:pointsFor(cells);
    if(!frameId&&context){context.clearRect(0,0,width,height);drawPreview();}
  }
  document.addEventListener("visibilitychange",()=>{
    document.body.classList.toggle("is-backgrounded",document.hidden);
    if(document.hidden)clear();
  });
  if("IntersectionObserver" in window) new IntersectionObserver(([entry])=>{
    if(!entry.isIntersecting)clear();
  },{rootMargin:"100px"}).observe(stage);
  window.addEventListener("pagehide",clear);
  reduced.addEventListener("change",()=>{clear();paintSky();});
  new ResizeObserver(resize).observe(stage);
  window.CozyObservatory=Object.freeze({reset,clear,resize,found,preview});
  resize();seedSky();paintSky();
})();
