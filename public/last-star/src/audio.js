// Original Crownforge RTS theme plus synthesized spell effects. Starts on interaction.
export class Soundscape {
  constructor(){this.enabled=true;this.started=false;this.lastTone=0;this.musicVolume=.38;this.sfxVolume=.28;this.voices=new Set();}
  start(){
    if(!this.enabled)return;
    if(!this.music){
      this.music=document.createElement('audio');this.music.id='level-theme';
      this.music.src=new URL('../assets/the-door-beneath-the-world.mp3',import.meta.url).href;
      this.music.loop=true;this.music.preload='auto';this.music.volume=this.musicVolume;
      this.music.setAttribute('aria-label','The Door Beneath the World');document.body.append(this.music);
    }
    if(this.music.paused&&!this.musicPending){
      this.musicPending=true;
      this.music.play().catch(()=>{}).finally(()=>{this.musicPending=false;});
    }
    if(this.ctx){this.ctx.resume().catch(()=>{});return;}
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
    this.ctx=new Audio();this.master=this.ctx.createGain();this.master.gain.value=this.sfxVolume;this.master.connect(this.ctx.destination);
    this.delay=this.ctx.createDelay(1);this.delay.delayTime.value=.32;const feed=this.ctx.createGain();feed.gain.value=.24;this.delay.connect(feed);feed.connect(this.delay);this.delay.connect(this.master);
    // Reusable filtered noise gives attacks a physical crack without audio downloads.
    this.noiseBuffer=this.ctx.createBuffer(1,this.ctx.sampleRate*.6,this.ctx.sampleRate);const samples=this.noiseBuffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
    const compressor=this.ctx.createDynamicsCompressor();compressor.threshold.value=-18;compressor.ratio.value=5;this.master.disconnect();this.master.connect(compressor);compressor.connect(this.ctx.destination);
    this.started=true;
  }
  setEnabled(on){this.enabled=on;if(on)this.start();else if(this.music)this.music.pause();if(this.master)this.master.gain.setTargetAtTime(on?this.sfxVolume:0,this.ctx.currentTime,.25);}
  setVolumes(music,sfx){this.musicVolume=music;this.sfxVolume=sfx;if(this.music)this.music.volume=music;if(this.master)this.master.gain.setTargetAtTime(this.enabled?sfx:0,this.ctx.currentTime,.05);}
  reset(){for(const source of this.voices){try{source.stop();}catch{}}this.voices.clear();}
  track(source,nodes){this.voices.add(source);source.onended=()=>{this.voices.delete(source);for(const node of [source,...nodes])node.disconnect();};}
  tone(freq,duration=.3,gain=.15,type='sine',end=null,offset=0){
    if(!this.ctx||!this.enabled||this.voices.size>=32)return;const t=this.ctx.currentTime+offset,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(end)o.frequency.exponentialRampToValueAtTime(end,t+duration);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(this.master);g.connect(this.delay);this.track(o,[g]);o.start(t);o.stop(t+duration+.02);
  }
  crack(duration=.14,volume=.13,frequency=1600){
    if(!this.ctx||!this.enabled||!this.noiseBuffer||this.voices.size>=32)return;const t=this.ctx.currentTime,n=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();n.buffer=this.noiseBuffer;f.type='lowpass';f.frequency.setValueAtTime(frequency,t);f.frequency.exponentialRampToValueAtTime(100,t+duration);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);n.connect(f);f.connect(g);g.connect(this.master);this.track(n,[f,g]);n.start();n.stop(t+duration);
  }
  event(e){
    if(e.type==='unavailable'&&this.ctx&&this.ctx.currentTime-(this.lastUnavailable||-1)>.25){this.lastUnavailable=this.ctx.currentTime;this.tone(150,.08,.05,'triangle',110);}
    if(e.type==='special-cast'){this.tone(e.kind==='ember'?220:e.kind==='frost'?1300:750,.2,.1,'sine',e.kind==='ember'?70:1900);}
    if(e.type==='selection')this.tone(720,.07,.05,'sine',900);
    if(e.type==='ember-impact'){this.crack(.38,.2,1300);this.tone(75,.35,.2,'triangle',35);}
    if(e.type==='freeze'){this.tone(1300,.32,.07,'sine',2100);this.tone(1900,.4,.04);}
    if(e.type==='shatter'){this.crack(.18,.1,6500);this.tone(2400,.17,.06,'triangle',1100);}
    if(e.type==='chain-arc'){this.crack(.12,.09,4200);this.tone(400,.12,.06,'sawtooth',1200);}
    if(e.type==='heal'){this.tone(440,.45,.1,'sine',880);this.tone(660,.55,.08);}
    if(e.type==='treasure'||e.type==='chest'){this.tone(880,.16,.09);this.tone(1320,.3,.06,'sine',null,.08);}

    if(e.type==='crystal'&&this.ctx&&this.ctx.currentTime-(this.lastPickup||-1)>.045){this.lastPickup=this.ctx.currentTime;this.tone(660*Math.pow(2,(e.n%9)/12),.14,.09,'sine',1300);}
    if(e.type==='power-rank'){[523,659,784,1046].forEach((f,i)=>this.tone(f,.4,.13,'sine',null,i*.08));this.crack(.2,.1,2800);}
    if(e.type==='overdrive'){this.tone(110,.7,.2,'sawtooth',880);this.tone(1320,1,.08);this.crack(.5,.18,4000);}
    if(e.type==='cast')this.crack(.12,.07,3200);
    if(e.type==='hit')this.crack(.1,.12,2000);
    if(e.type==='enemy-death'){this.crack(.32,.18,3000);this.tone(100,.22,.18,'triangle',38);}

    if(e.type==='cast')this.tone(650,.22,.12,'sine',220);
    if(e.type==='hit')this.tone(180,.16,.08,'triangle',75);
    if(e.type==='blink'){this.tone(180,.4,.17,'sine',1000);this.tone(880,.6,.07);}
    if(e.type==='jump')this.tone(e.second?660:330,.18,.045,'sine',e.second?880:450);
    if(e.type==='meteor-hit'){this.tone(70,.8,.25,'triangle',35);this.tone(740,.7,.1);}
    if(e.type==='seal'||e.type==='won'){[440,554.37,659.25,880].forEach((f,i)=>this.tone(f,1.4,.13,'sine',null,i*.16));}
    if(e.type==='hurt')this.tone(85,.2,.2,'triangle',40);
    if(e.type==='dragon'){this.tone(55,2,.23,'triangle',110);this.tone(220,2,.1,'sine',880);}
    if(e.type==='lightning')this.tone(95,.25,.15,'triangle',40);
    if(e.type==='enemy-death')this.tone(330,.6,.09,'sine',660);
  }
  update(){}
}
