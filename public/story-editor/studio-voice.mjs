// Transport only. Literary revisions run through the durable deep editor tools.
export class StudioVoice {
 constructor({token,tool,onSpeech,onTranscript,onStatus,onError,mediaDevices=globalThis.navigator?.mediaDevices,Peer=globalThis.RTCPeerConnection,makeAudio=()=>new Audio(),fetcher=fetch}){
  Object.assign(this,{token,tool,onSpeech,onTranscript,onStatus,onError,mediaDevices,Peer,makeAudio,fetcher});this.epoch=0;this.handled=new Set();this.pendingTools=0;
 }
 get connected(){return this.dc?.readyState==='open';}
 send(event){if(this.connected)this.dc.send(JSON.stringify(event));}
 async connect(){
  this.close();const ticket=this.epoch;this.controller=new AbortController();this.onStatus('Connecting voice…');
  try{
   if(!this.mediaDevices?.getUserMedia||!this.Peer)throw Error('Live voice needs a supported browser with microphone access. You can still write to Mara below.');
   const stream=await this.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
   if(ticket!==this.epoch){stream.getTracks().forEach(t=>t.stop());return;}
   this.stream=stream;
   const data=await this.token(this.controller.signal);if(ticket!==this.epoch)return;
   this.pc=new this.Peer();this.audio=this.makeAudio();this.audio.autoplay=true;
   this.pc.ontrack=event=>{if(ticket!==this.epoch)return;this.audio.srcObject=event.streams[0];void this.audio.play().catch(()=>{if(ticket!==this.epoch||!this.audio)return;this.audio.hidden=false;this.onStatus('Voice is connected. Press Play in the voice audio controls to listen.');});};
   for(const track of stream.getTracks())this.pc.addTrack(track,stream);
   this.dc=this.pc.createDataChannel('studio-events');
   this.dc.onopen=()=>{if(ticket!==this.epoch)return;clearTimeout(this.connectTimer);this.onStatus('Voice is on · speak naturally to interrupt');this.send({type:'response.create',response:{instructions:'Greet the author briefly as their ongoing writing partner helping them finish the whole work they want. Use the supplied goal, saved position and recent conversation to orient them accurately; offer to continue there or recap from one passage earlier. If this is a new project, help establish their destination. Do not read or change anything yet.'}});};
   this.dc.onmessage=event=>{if(ticket!==this.epoch)return;try{void this.handle(JSON.parse(event.data),ticket);}catch{this.onError(Error('Voice received an unreadable event. Reconnect voice to continue.'));}};
   this.dc.onclose=()=>{if(ticket===this.epoch){this.close();this.onError(Error('Voice disconnected. Your draft and conversation are saved.'));}};
   this.pc.onconnectionstatechange=()=>{if(ticket===this.epoch&&this.pc?.connectionState==='failed'){this.close();this.onError(Error('Voice connection failed. Reconnect or use the text conversation.'));}};
   this.connectTimer=setTimeout(()=>{if(ticket===this.epoch&&!this.connected){this.close();this.onError(Error('Voice took too long to connect. Try again or use text.'));}},30000);
   const offer=await this.pc.createOffer();await this.pc.setLocalDescription(offer);
   const answer=await this.fetcher(data.realtimeUrl,{method:'POST',body:offer.sdp,headers:{Authorization:`Bearer ${data.value}`,'Content-Type':'application/sdp'},signal:AbortSignal.any([this.controller.signal,AbortSignal.timeout(25000)])});
   if(!answer.ok)throw Error('The live voice service could not connect. Please try again.');
   const sdp=await answer.text();if(ticket!==this.epoch)return;
   await this.pc.setRemoteDescription({type:'answer',sdp});
  }catch(error){if(ticket!==this.epoch)return;this.close();this.onError(error.name==='NotAllowedError'?Error('Microphone access was not granted. Allow it when you are ready, or keep using text.'):error);}
 }
 updateContext(instructions){this.send({type:'session.update',session:{type:'realtime',instructions}});}
 interrupt(){if(this.responseActive)this.send({type:'response.cancel'});this.send({type:'output_audio_buffer.clear'});}
 flush(){if(this.respond&&!this.responseActive&&!this.pendingTools){this.respond=false;this.send({type:'response.create',response:{instructions:'Briefly explain the actual tool outcome. Do not claim an edit was saved if the tool reported an error. Do not start narration unless the author asked for it.'}});}}
 async handle(event,ticket=this.epoch){
  if(ticket!==this.epoch)return;
  if(event.type==='input_audio_buffer.speech_started'){this.onSpeech();this.onStatus('Listening to you…');}
  if(event.type==='response.created')this.responseActive=true;
  if(event.type==='conversation.item.input_audio_transcription.completed'&&event.transcript)this.onTranscript('user',event.transcript,event.item_id);
  if(event.type==='response.output_audio_transcript.done'&&event.transcript)this.onTranscript('assistant',event.transcript,event.item_id);
  if(event.type==='error'&&!['response_cancel_not_active','response_already_done'].includes(event.error?.code)){this.close();this.onError(Error(event.error?.code==='session_expired'?'This voice session ended. Reconnect to continue.':'Voice encountered a problem. Your draft is safe; reconnect if needed.'));return;}
  if(event.type==='response.function_call_arguments.done')void this.handleTool(event,ticket);
  if(event.type==='response.done'){
   this.responseActive=false;
   for(const item of event.response?.output||[])if(item.type==='function_call')void this.handleTool(item,ticket);
   this.flush();
  }
 }
 async handleTool(event,ticket){
  const id=event.call_id;if(!id||this.handled.has(id)||ticket!==this.epoch)return;
  this.handled.add(id);this.pendingTools++;let output;
  try{
   const args=JSON.parse(event.arguments||'{}');
   output=await this.tool(event.name,args,id);
  }catch(error){output={ok:false,error:error.message||'That action could not be completed.'};}
  if(ticket!==this.epoch)return;
  this.pendingTools--;
  this.send({type:'conversation.item.create',item:{type:'function_call_output',call_id:id,output:JSON.stringify(output)}});
  if(!output?.narrating)this.respond=true;
  this.flush();
 }
 close(){
  this.epoch++;clearTimeout(this.connectTimer);this.controller?.abort();this.stream?.getTracks().forEach(t=>t.stop());
  const dc=this.dc,pc=this.pc;this.dc=null;this.pc=null;this.stream=null;dc?.close();pc?.close();
  if(this.audio){this.audio.pause();this.audio.srcObject=null;this.audio.remove?.();this.audio=null;}
  this.handled.clear();this.pendingTools=0;this.responseActive=false;this.respond=false;
 }
}
