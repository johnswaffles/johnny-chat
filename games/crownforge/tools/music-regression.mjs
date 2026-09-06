import assert from 'node:assert/strict';
import {test} from 'node:test';
import {stat} from 'node:fs/promises';
import {CrownforgeAudio,CROWNFORGE_MUSIC} from '../src/audio.js';

class Media extends EventTarget {
  constructor(){super();this.paused=true;this.ended=false;this.currentTime=0;this.playCalls=0;this.sources=[];}
  set src(value){this._src=value;this.sources.push(value);this.currentTime=0;this.ended=false;this.paused=true;}
  get src(){return this._src;}
  pause(){this.paused=true;}
  play(){
    this.playCalls++;
    if(this.rejectNext){const error=this.rejectNext;this.rejectNext=null;return Promise.reject(error);}
    this.paused=false;this.dispatchEvent(new Event('playing'));return Promise.resolve();
  }
  finish(){this.paused=true;this.ended=true;this.dispatchEvent(new Event('ended'));}
}
const storage=(value=null)=>({getItem:()=>value,setItem:(_key,next)=>{value=next;}});
function player(saved=null){globalThis.Audio=Media;return new CrownforgeAudio({storage:storage(saved)});}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('default album plays every song exactly once before repeating, using one media element',async()=>{
  const audio=player(),media=audio.music,played=[];
  assert.equal(audio.selection,'all');assert.equal(media.loop,false);assert.equal(media.playCalls,0);
  assert.equal(audio.startMusic(),false,'no autoplay before a user gesture');
  audio.unlock();
  for(let cycle=0;cycle<3;cycle++)for(const track of CROWNFORGE_MUSIC){
    assert.equal(audio.music,media);assert.equal(audio.currentTrack.id,track.id);
    assert.equal(media.src,track.src);assert.equal(media.loop,false);
    played.push(audio.currentTrack.id);media.finish();await settle();
    assert.equal(media.paused,false,'next track starts without another click');
  }
  assert.deepEqual(played,[...CROWNFORGE_MUSIC,...CROWNFORGE_MUSIC,...CROWNFORGE_MUSIC].map(t=>t.id));
  assert.equal(audio.currentTrack.id,CROWNFORGE_MUSIC[0].id);
});

test('every dropdown song replaces playback and uses native single-song looping',()=>{
  const audio=player();audio.unlock();
  for(const track of CROWNFORGE_MUSIC){
    audio.music.currentTime=43;
    assert.equal(audio.selectMusic(track.id),true);
    assert.equal(audio.currentTrack.id,track.id);assert.equal(audio.music.loop,true);
    assert.equal(audio.music.currentTime,0);assert.equal(audio.music.paused,false);
    audio.music.finish();assert.equal(audio.currentTrack.id,track.id,'a song cannot advance in single-song mode');
  }
  audio.selectMusic('all');assert.equal(audio.music.loop,false);assert.equal(audio.trackIndex,0);
  assert.equal(audio.selectMusic('missing-track'),false);assert.equal(audio.selection,'all');
});

test('selection persists safely and invalid or inaccessible storage falls back to all songs',()=>{
  globalThis.Audio=Media;
  const prefs=storage(),first=new CrownforgeAudio({storage:prefs});first.selectMusic('the-last-rune');
  const second=new CrownforgeAudio({storage:prefs});
  assert.equal(second.currentTrack.id,'the-last-rune');assert.equal(second.music.loop,true);assert.equal(second.music.playCalls,0);
  second.selectMusic('all');assert.equal(new CrownforgeAudio({storage:prefs}).selection,'all');
  assert.equal(player('obsolete-song').selection,'all');
  const denied=new CrownforgeAudio({storage:{getItem(){throw Error('denied');},setItem(){throw Error('denied');}}});
  assert.equal(denied.selection,'all');assert.doesNotThrow(()=>denied.selectMusic('cavernous-wonder'));
});

test('mute pauses, switching while muted stays silent, and reset does not restart songs',()=>{
  const audio=player();audio.unlock();audio.music.currentTime=42;
  const sources=audio.music.sources.length;
  audio.reset({phase:'playing'});audio.sync({phase:'victory'});
  assert.equal(audio.music.currentTime,42);assert.equal(audio.music.sources.length,sources);
  audio.setMusicMuted(true);assert.equal(audio.music.paused,true);assert.equal(audio.music.currentTime,42);
  audio.setMusicMuted(false);assert.equal(audio.music.paused,false);assert.equal(audio.music.currentTime,42);
  audio.setMusicMuted(true);const calls=audio.music.playCalls;
  audio.selectMusic('the-forgotten-stair');audio.unlock();audio.reset();
  assert.equal(audio.music.playCalls,calls);assert.equal(audio.music.paused,true);
  audio.setMasterVolume(.23);audio.setMusicMuted(false);
  assert.equal(audio.music.volume,.23);assert.equal(audio.currentTrack.id,'the-forgotten-stair');
  assert.equal(audio.music.paused,false);
});

test('autoplay denial is handled and the next gesture retries without losing the selected song',async()=>{
  const audio=player('cavernous-wonder');
  audio.music.rejectNext=Object.assign(Error('gesture required'),{name:'NotAllowedError'});
  audio.unlock();await settle();assert.equal(audio.playbackStatus,'ready');assert.equal(audio.musicStarted,false);
  audio.unlock();await settle();assert.equal(audio.playbackStatus,'playing');assert.equal(audio.musicStarted,true);
  assert.equal(audio.currentTrack.id,'cavernous-wonder');
});

test('the shipped playlist contains all five original recordings',async()=>{
  assert.deepEqual(CROWNFORGE_MUSIC.map(t=>t.title),['The Door Beneath the World','The Forgotten Stair','The Last Rune','Cavernous Wonder','Lantern Under Stone']);
  for(const track of CROWNFORGE_MUSIC){
    const info=await stat(new URL(track.src));assert.ok(info.size>1000000,`${track.title} contains a full recording`);
  }
});
