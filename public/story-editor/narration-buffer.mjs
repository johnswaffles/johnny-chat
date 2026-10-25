// Holds only the playing part plus ONE lookahead. Completion never schedules work.
export class NarrationBuffer {
 constructor(load){this.load=load;this.current=null;this.next=null;}
 entry(target){const controller=new AbortController();const entry={key:target.key,target,controller};try{controller.signal.throwIfAborted();entry.promise=Promise.resolve(this.load(target,controller.signal));}catch(error){entry.promise=Promise.reject(error);}entry.promise.catch(()=>{});return entry;}
 get(target){
  if(this.current?.key===target.key)return this.current.promise;
  this.current?.controller.abort();
  if(this.next?.key===target.key){this.current=this.next;this.next=null;}
  else{this.next?.controller.abort();this.next=null;this.current=this.entry(target);}
  return this.current.promise;
 }
 prepare(target){if(!target||this.current?.key===target.key||this.next?.key===target.key)return;this.next?.controller.abort();this.next=this.entry(target);}
 clear(){this.current?.controller.abort();this.next?.controller.abort();this.current=null;this.next=null;}
}
