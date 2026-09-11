import { RESOURCE_SIZE_TIERS } from './config.js?v=20260911-pause1';

// At strategic zoom, cache tree strips by world depth. Any strip containing
// another kind of entity remains individually painted, preserving the exact
// painter order around workers, buildings, selected trees and other resources.
export const FOREST_CACHE_LIMITS=Object.freeze({depthSpan:16,maxBytes:48*1024*1024,maxBands:96,maxBuildsPerFrame:2});

export class ForestCache {
  constructor(renderer) { this.renderer=renderer;this.layers=new Map();this.bytes=0;this.builds=0; }

  prepare(simulation,entities,grass=[]) {
    const r=this.renderer;
    this.active=r.camera.zoom*r.resolutionScale<.145;
    this.builtThisFrame=0;
    // One physical detail level covers strategic zoom without repeatedly
    // replacing the strip cache at each wheel step.
    this.zoom=.125/r.resolutionScale;
    const key=[r.landscape.revision,r.resolutionScale].join('|');
    if(key!==this.key||this.resources!==simulation.resourcesNodes){
      this.layers.clear();this.bytes=0;this.key=key;this.resources=simulation.resourcesNodes;
      this.groups=new Map();
      for(const node of simulation.resourcesNodes){
        if(node.type!=='tree'||node.amount<=0)continue;
        const band=Math.floor((node.x+node.z+.3)/FOREST_CACHE_LIMITS.depthSpan);
        if(!this.groups.has(band))this.groups.set(band,[]);
        this.groups.get(band).push(node);
      }
      for(const nodes of this.groups.values())nodes.sort((a,b)=>a.x+a.z-b.x-b.z||a.id-b.id);
    }
    this.blocked=new Set();
    for(const tuft of grass)this.blocked.add(Math.floor(tuft.depth/FOREST_CACHE_LIMITS.depthSpan));
    for(const entity of entities){
      if(entity.kind!=='resource'||entity.resource.type!=='tree'||entity.resource.selected)
        this.blocked.add(Math.floor(entity.depth/FOREST_CACHE_LIMITS.depthSpan));
    }
    this.drawn=new Set();
    // Warm distant strips gradually while the player is close to the town.
    if(!this.active){
      const next=[...this.groups.keys()].find(band=>!this.layers.has(band));
      if(next!==undefined)this.store(next,this.bake(this.groups.get(next)));
    }
  }

  store(band,layer){
    this.layers.set(band,layer);this.bytes+=layer.bytes;this.builds++;
    while(this.bytes>FOREST_CACHE_LIMITS.maxBytes||this.layers.size>FOREST_CACHE_LIMITS.maxBands){const first=this.layers.keys().next().value;this.bytes-=this.layers.get(first).bytes;this.layers.delete(first);}
  }

  draw(ctx,entity) {
    if(!this.active||entity.kind!=='resource'||entity.resource.type!=='tree')return false;
    const band=Math.floor(entity.depth/FOREST_CACHE_LIMITS.depthSpan);
    if(this.blocked.has(band))return false;
    if(this.drawn.has(band))return true;
    const nodes=this.groups.get(band);
    let layer=this.layers.get(band);
    if(!layer){
      if(this.builtThisFrame>=FOREST_CACHE_LIMITS.maxBuildsPerFrame)return false;
      layer=this.bake(nodes);this.builtThisFrame++;this.store(band,layer);
    }
    const r=this.renderer,scale=r.camera.zoom/this.zoom;
    ctx.drawImage(layer.image,r.width/2+r.camera.x+layer.x*scale,r.height/2+r.camera.y+layer.y*scale,layer.width*scale,layer.height*scale);
    this.drawn.add(band);return true;
  }

  bake(nodes) {
    const r=this.renderer,zoom=this.zoom;
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    const points=nodes.map(node=>{
      const look=r.landscape.resourceVisual(node),p=r.worldToScreen(node);
      const x=(p.x-r.width/2-r.camera.x)/r.camera.zoom*zoom;
      const y=(p.y-r.height/2-r.camera.y)/r.camera.zoom*zoom;
      const tier=RESOURCE_SIZE_TIERS[node.sizeTier??'small']?.renderScale??1;
      const w=look.width*zoom*tier,h=look.height*zoom*tier;
      minX=Math.min(minX,x-w*look.sprite.root[0],x-w*.21);
      maxX=Math.max(maxX,x+w*(1-look.sprite.root[0]),x+w*.31);
      minY=Math.min(minY,y-h*look.sprite.root[1]);
      maxY=Math.max(maxY,y+h*(1-look.sprite.root[1]),y+w*.09);
      return {node,x,y,tier};
    });
    const x=Math.floor(minX)-2,y=Math.floor(minY)-2,width=Math.ceil(maxX)-x+2,height=Math.ceil(maxY)-y+2;
    const image=document.createElement('canvas'),ratio=r.resolutionScale;
    image.width=Math.ceil(width*ratio);image.height=Math.ceil(height*ratio);
    const ctx=image.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);
    // An isolated view supplies the bucket zoom without moving the camera or
    // touching live resource state. Sway is subpixel at this distance.
    const view=Object.create(r);view.camera={...r.camera,zoom};
    const landscape=Object.create(r.landscape);landscape.renderer=view;
    for(const p of points)landscape.drawResource(ctx,p.node,{x:p.x-x,y:p.y-y},p.tier,0);
    return {image,x,y,width,height,bytes:image.width*image.height*4};
  }
}
