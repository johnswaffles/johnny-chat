// Visible, opt-in browser fixture. Never loaded on the normal player route.
export function virtualGamepad(panel){
 let enabled=false,used=false;const aim=[0,0];const until=new Map();
 const section=document.createElement('div');section.innerHTML='<hr><strong>Virtual controller · QA only</strong><button id="qa-pad-connect">Connect virtual Xbox</button><button id="qa-pad-disconnect">Disconnect virtual Xbox</button>';
 panel.append(section);
 section.querySelector('#qa-pad-connect').onclick=()=>{enabled=true;used=true;};
 section.querySelector('#qa-pad-disconnect').onclick=()=>{enabled=false;until.clear();aim[0]=aim[1]=0;};
 const hold=document.createElement('button');hold.textContent='Hold virtual LB';hold.onclick=()=>until.set(4,Infinity);section.append(hold);const release=document.createElement('button');release.textContent='Release virtual LB';release.onclick=()=>until.delete(4);section.append(release);
 for(const [name,index] of [['A',0],['B',1],['X',2],['Y',3],['LB',4],['RB',5],['RT',7],['Menu',9],['Up',12],['Down',13]]){
  const b=document.createElement('button');b.textContent='Virtual '+name;b.style.display='inline-block';b.style.marginRight='4px';b.onpointerdown=e=>e.preventDefault();b.onclick=()=>until.set(index,performance.now()+250);section.append(b);
 }
 for(const [name,x,y] of [['↑',0,-1],['→',1,0],['↓',0,1],['←',-1,0],['center',0,0]]){const b=document.createElement('button');b.textContent='Right stick '+name;b.onclick=()=>{aim[0]=x;aim[1]=y;};section.append(b);}
 return {sample(){if(!used)return null;if(!enabled)return [];return [{index:99,id:'Virtual Xbox test fixture',mapping:'standard',connected:true,axes:[0,0,...aim],buttons:Array.from({length:17},(_,i)=>({pressed:performance.now()<(until.get(i)||0),value:performance.now()<(until.get(i)||0)?1:0}))}];}};
}
