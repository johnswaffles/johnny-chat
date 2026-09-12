import {UNIT_TYPES} from './config.js?v=20260911-heart10';
export const COMBAT_TRACK={id:'ancient-dungeon-siege',title:'Ancient Dungeon Siege',loopEndSeconds:130,src:new URL('../assets/ancient-dungeon-siege.mp3',import.meta.url).href};
export const isEncounterEnemy=u=>Boolean(u&&!u.dead&&(UNIT_TYPES[u.type]?.wildlife||UNIT_TYPES[u.type]?.boss||u.wildlife||u.boss));
export function engagedEnemies(sim){
 const live=new Map((sim?.units??[]).filter(u=>!u.dead&&u.hp>0).map(u=>[u.id,u])),ids=new Set();
 for(const u of live.values()){
  const target=live.get(u.attackTarget??u.teamAdvanceTargetId);
  if(!target)continue;
  if(u.faction==='player'&&isEncounterEnemy(target))ids.add(target.id);
  if(isEncounterEnemy(u)&&target.faction==='player')ids.add(u.id);
 }
 return ids;
}
// Decode once; trim only boundary silence and overlap the tail with the head.
// AudioBufferSourceNode.loop repeats on the audio clock without an ended-event gap.
export function seamlessCombatBuffer(context,input,{endSeconds=input.duration??input.length/input.sampleRate}={}){
 const channels=Array.from({length:input.numberOfChannels},(_,c)=>input.getChannelData(c));
 const window=Math.max(1,Math.floor(input.sampleRate*.01));
 const loud=(a,b)=>{let energy=0;for(const data of channels)for(let i=a;i<b;i++)energy+=data[i]*data[i];return Math.sqrt(energy/((b-a)*channels.length))>.002;};
 let start=0,end=Math.min(input.length,Math.floor(endSeconds*input.sampleRate));
 while(start+window<end&&!loud(start,start+window))start+=window;
 while(end-window>start&&!loud(end-window,end))end-=window;
 if(end-start<input.sampleRate)return input;
 const overlap=Math.min(Math.floor(input.sampleRate*.2),Math.floor((end-start)/4)),length=end-start-overlap;
 const output=context.createBuffer(input.numberOfChannels,length,input.sampleRate);
 for(let c=0;c<channels.length;c++){
  const data=channels[c],out=output.getChannelData(c),body=length-overlap;
  out.set(data.subarray(start+overlap,end-overlap),0);
  for(let i=0;i<overlap;i++){const t=i/(overlap-1);out[body+i]=data[end-overlap+i]*Math.cos(t*Math.PI/2)+data[start+i]*Math.sin(t*Math.PI/2);}
 }
 let peak=0;for(let c=0;c<output.numberOfChannels;c++)for(const v of output.getChannelData(c))peak=Math.max(peak,Math.abs(v));
 if(peak>.99)for(let c=0;c<output.numberOfChannels;c++){const data=output.getChannelData(c);for(let i=0;i<data.length;i++)data[i]*=.99/peak;}
 return output;
}
export class CombatMusic {
 constructor(owner){this.owner=owner;this.enemies=new Set();this.mix=0;this.active=false;this.context=null;this.source=null;this.lastTime=null;this.status='ready';}
 unlock(){
  const AudioContext=globalThis.AudioContext??globalThis.webkitAudioContext;
  if(!AudioContext)return;
  if(!this.context){this.context=new AudioContext();this.gain=this.context.createGain();this.gain.gain.value=0;this.gain.connect(this.context.destination);}
  this.context.resume().catch(()=>{});
  if(!this.loading)this.loading=fetch(COMBAT_TRACK.src).then(r=>{if(!r.ok)throw Error('Combat audio unavailable');return r.arrayBuffer();}).then(b=>this.context.decodeAudioData(b)).then(b=>{
   this.buffer=seamlessCombatBuffer(this.context,b,{endSeconds:COMBAT_TRACK.loopEndSeconds});this.status='ready';
  }).catch(()=>{this.status='error';this.loading=null;this.owner.notify();});
 }
 sync(sim){
  const live=new Map((sim?.units??[]).filter(u=>!u.dead&&u.hp>0).map(u=>[u.id,u]));
  for(const id of engagedEnemies(sim))this.enemies.add(id);
  for(const id of this.enemies)if(!live.has(id))this.enemies.delete(id);
  if(![...live.values()].some(u=>u.faction==='player'))this.enemies.clear();
  const active=this.enemies.size>0;
  if(active!==this.active){this.active=active;this.owner.notify();}
  if(active&&this.buffer&&!this.source&&this.owner.unlocked&&!this.owner.musicMuted){
   this.source=this.context.createBufferSource();this.source.buffer=this.buffer;this.source.loop=true;this.source.loopStart=0;this.source.loopEnd=this.buffer.duration;this.source.connect(this.gain);this.source.start();this.owner.notify();
  }
  const now=globalThis.performance?.now?.()??Date.now(),dt=this.lastTime===null?0:Math.min(.1,(now-this.lastTime)/1000);this.lastTime=now;
  const target=active&&this.source?1:0;
  this.mix+=Math.sign(target-this.mix)*Math.min(Math.abs(target-this.mix),dt/1.8);
  const volume=this.owner.musicMuted?0:this.owner.musicVolume;
  if(this.owner.music)this.owner.music.volume=volume*Math.cos(this.mix*Math.PI/2);
  const gainTarget=volume*Math.sin(this.mix*Math.PI/2);
  if(this.gain&&Math.abs(gainTarget-(this.lastGainTarget??-1))>1e-5){
   // Never append automation forever while a long track is at steady volume.
   const now=this.context.currentTime;this.gain.gain.cancelScheduledValues?.(now);
   this.gain.gain.setTargetAtTime(gainTarget,now,.04);this.lastGainTarget=gainTarget;
  }
  if(!active&&this.mix===0&&this.source){this.source.stop();this.source.disconnect();this.source=null;this.owner.notify();}
 }
 get playing(){return Boolean(this.source&&(this.active||this.mix>0));}
}
