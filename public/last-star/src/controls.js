export const ACTIONS={left:'Move left',right:'Move right',jump:'Jump / double jump',bolt:'Starshard',blink:'Eventide Passage',constellation:'Falling Constellation',dragon:'Heavenrend',interact:'Interact / read'};
export const DEFAULT_KEYS={left:'KeyA',right:'KeyD',jump:'Space',bolt:'KeyJ',blink:'ShiftLeft',constellation:'KeyQ',dragon:'KeyR',interact:'KeyE'};
export const DEFAULT_PAD={left:14,right:15,jump:0,bolt:7,blink:1,constellation:2,dragon:3,interact:5};
export const BUTTON_NAMES=['A','B','X','Y','LB','RB','LT','RT','View','Menu','L stick','R stick','D-pad ↑','D-pad ↓','D-pad ←','D-pad →','Guide'];
export const buttonName=(n,standard=true)=>standard?(BUTTON_NAMES[n]??`Button ${n+1}`):`Button ${n+1}`;
export const keyName=k=>({Space:'Space',ShiftLeft:'Shift',ControlLeft:'Ctrl',AltLeft:'Alt',ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓',Backquote:'`',Minus:'−',Equal:'=',BracketLeft:'[',BracketRight:']',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/'}[k]||k.replace(/^Key|^Digit/,''));
export const normalizeKey=k=>k.replace(/(Shift|Control|Alt)Right/,'$1Left');
export const validKey=k=>typeof k==='string'&&/^(Key[A-Z]|Digit[0-9]|Space|ShiftLeft|ControlLeft|AltLeft|Arrow(Left|Right|Up|Down)|Backquote|Minus|Equal|BracketLeft|BracketRight|Semicolon|Quote|Comma|Period|Slash)$/.test(k);
export const validButton=n=>Number.isInteger(n)&&n>=0&&n<=31&&n!==9&&n!==16;
export function readBindings(raw){
  let v;try{v=typeof raw==='string'?JSON.parse(raw):raw;}catch{}
  const out={keys:{...DEFAULT_KEYS},pad:{...DEFAULT_PAD},deadzone:.18};
  for(const [kind,valid] of [['keys',validKey],['pad',validButton]]){
    if(v?.[kind]&&Object.keys(ACTIONS).every(a=>valid(v[kind][a]))&&new Set(Object.values(v[kind])).size===Object.keys(ACTIONS).length)out[kind]={...v[kind]};
  }
  if(Number.isFinite(v?.deadzone))out.deadzone=Math.max(.08,Math.min(.4,v.deadzone));return out;
}
export function rebind(config,kind,action,value){
  if(!ACTIONS[action]||!(kind==='keys'?validKey(value):kind==='pad'&&validButton(value)))return false;
  const other=Object.keys(ACTIONS).find(a=>a!==action&&config[kind][a]===value);
  if(other)config[kind][other]=config[kind][action];config[kind][action]=value;return other||true;
}
export function axis(value,deadzone){const n=Number.isFinite(value)?value:0;return Math.abs(n)<=deadzone?0:Math.sign(n)*Math.min(1,(Math.abs(n)-deadzone)/(1-deadzone));}
export class Controller {
  constructor(){this.index=null;this.signature='';this.down=new Set();this.edges=new Set();this.pending=new Set();this.connected=false;this.standard=true;this.name='';this.move=0;this.aim={x:0,y:0};}
  poll(pads,config){
    const list=Array.from(pads||[]).filter(p=>p&&p.connected!==false);
    const pad=list.find(p=>p.index===this.index)||list[0];const was=this.connected;
    this.edges.clear();
    if(!pad){this.connected=false;this.index=null;this.signature='';this.down.clear();this.pending.clear();this.move=0;this.aim={x:0,y:0};return {disconnected:was};}
    const sig=pad.index+':'+pad.id,changed=sig!==this.signature;
    this.connected=true;this.index=pad.index;this.signature=sig;this.name=pad.id||'Controller';this.standard=pad.mapping==='standard';
    const down=new Set();pad.buttons.forEach((b,i)=>{if(b.pressed||b.value>.55)down.add(i);});
    if(!changed){for(const i of down)if(!this.down.has(i)){this.edges.add(i);this.pending.add(i);}}
    else this.pending.clear();
    this.down=down;this.move=axis(pad.axes[0],config.deadzone);this.menuY=axis(pad.axes[1],config.deadzone);this.aim={x:axis(pad.axes[2],config.deadzone),y:axis(pad.axes[3],config.deadzone)};
    return {connected:!was,changed,active:this.edges.size>0||Math.abs(this.move)>.1||Math.hypot(this.aim.x,this.aim.y)>.1};
  }
  clearEdges(){this.pending.clear();}
  consume(config){
    const b=config.pad,held=a=>this.down.has(b[a]),edge=a=>this.pending.has(b[a]);
    const digital=(held('right')?1:0)-(held('left')?1:0);
    const result={move:digital||this.move,jump:edge('jump'),bolt:held('bolt'),blink:edge('blink'),constellation:edge('constellation'),dragon:edge('dragon'),interact:edge('interact')};
    this.pending.clear();return result;
  }
}
