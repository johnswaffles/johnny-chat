/** Decoded atlas memory and concurrent requests are shared by the whole roster. */
export class AtlasImageCache {
  constructor({maxBytes=48*1024*1024,maxEntries=12,maxPending=4,retryAfter=30000,now=()=>performance.now(),loader=decodeImage}={}){
    Object.assign(this,{maxBytes,maxEntries,maxPending,retryAfter,now,loader});
    this.entries=new Map();this.bytes=0;this.pending=0;
  }
  stats(){return {images:[...this.entries.values()].filter(e=>e.image).length,bytes:this.bytes,budget:this.maxBytes,pending:this.pending,failures:[...this.entries.values()].filter(e=>e.error).length};}
  touch(src,entry){this.entries.delete(src);this.entries.set(src,entry);return entry;}
  trim(){
    while(this.bytes>this.maxBytes||this.entries.size-this.pending>this.maxEntries){
      const oldest=[...this.entries].find(([,entry])=>!entry.promise);
      if(!oldest)break;
      this.entries.delete(oldest[0]);this.bytes-=oldest[1].bytes??0;
    }
  }
  request(src){
    let entry=this.entries.get(src);
    if(entry){
      this.touch(src,entry);
      if(entry.image||entry.promise||this.now()-entry.failedAt<this.retryAfter)return entry;
      this.entries.delete(src);
    }
    if(this.pending>=this.maxPending)return null;
    entry={};this.entries.set(src,entry);this.pending++;
    // Defer the loader so synchronous failures take the same bounded path.
    entry.promise=Promise.resolve().then(()=>this.loader(src)).then(image=>{
      const bytes=image.naturalWidth*image.naturalHeight*4;
      if(!bytes||bytes>this.maxBytes)throw new Error('Atlas exceeds decoded image budget: '+src);
      entry.image=image;entry.bytes=bytes;this.bytes+=bytes;return image;
    }).catch(error=>{entry.error=error;entry.failedAt=this.now();throw error;}).finally(()=>{
      this.pending--;entry.promise=null;this.touch(src,entry);this.trim();
    });
    // Rendering requests are intentionally nonblocking. Explicit load callers
    // still receive a rejection; unobserved draw requests never leak one.
    entry.promise.catch(()=>{});
    return entry;
  }
  get(src){return this.request(src)?.image??null;}
  async load(src){
    let entry=this.request(src);
    while(!entry){
      await Promise.race([...this.entries.values()].flatMap(e=>e.promise?[e.promise.catch(()=>null)]:[]));
      entry=this.request(src);
    }
    if(entry.image)return entry.image;
    if(entry.promise)return entry.promise;
    throw entry.error;
  }
}
async function decodeImage(src){
  const image=new Image();image.decoding='async';image.src=src;await image.decode();return image;
}
