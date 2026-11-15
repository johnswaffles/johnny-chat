let database;
const savedPuzzles=new Map();
function remember(record,key){savedPuzzles.set(record.id,{puzzle:record.puzzle,geometryVersion:record.puzzle.geometryVersion,key});}
function merge(base,progress){if(!base)return undefined;const {_artworkKey,...state}=progress||{};return {...base,...state,puzzle:base.puzzle};}
function db(){return database ||= new Promise((resolve,reject)=>{
  const request=indexedDB.open('johnny-color-studio',2);let blocked=false;
  request.onblocked=()=>{blocked=true;database=null;const error=new Error('Close other Color Studio tabs, then reopen this picture. Your saved painting is still safe.');error.name='StorageBlockedError';reject(error);};
  request.onupgradeneeded=()=>{for(const name of ['paintings','cards','progress'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name,{keyPath:'id'});};
  request.onsuccess=()=>{const connection=request.result;if(blocked){connection.close();return;}connection.onversionchange=()=>{connection.close();database=null;savedPuzzles.clear();};resolve(connection);};
  request.onerror=()=>{database=null;reject(request.error);};
});}
async function transact(stores,mode,callback){const connection=await db();return new Promise((resolve,reject)=>{
  const tx=connection.transaction(stores,mode);let result,error;
  tx.oncomplete=()=>resolve(typeof result==='function'?result():result?.result);
  tx.onerror=()=>reject(error||tx.error);
  tx.onabort=()=>reject(error||tx.error||new Error('Storage was interrupted'));
  const fail=e=>{error=e;tx.abort();};
  try{result=callback(tx,fail);}catch(e){fail(e);}
});}
export async function getPainting(id){
  let key;const record=await transact(['paintings','progress'],'readonly',tx=>{
    const base=tx.objectStore('paintings').get(id),progress=tx.objectStore('progress').get(id);
    return()=>{key=progress.result?._artworkKey;return merge(base.result,progress.result);};
  });
  if(record)remember(record,key);return record;
}
export const listCards=()=>transact(['cards'],'readonly',tx=>tx.objectStore('cards').getAll());
// Backups remain portable, complete paintings, even though local progress is small.
export const allPaintings=()=>transact(['paintings','progress'],'readonly',tx=>{
  const bases=tx.objectStore('paintings').getAll(),progress=tx.objectStore('progress').getAll();
  return()=>{const byId=new Map(progress.result.map(r=>[r.id,r]));return bases.result.map(r=>merge(r,byId.get(r.id)));};
});
function writeProgress(tx,record,key){
  const {puzzle,...progress}=record;
  tx.objectStore('progress').put({...progress,_artworkKey:key});
  const {id,title,category,thumbnail,updated,custom,filled}=record;
  tx.objectStore('cards').put({id,title,category,thumbnail,updated,custom,archived:!!record.archived,total:puzzle.regions.length,done:filled.length});
}
export async function savePainting(record){
  let key;
  await transact(['paintings','progress','cards'],'readwrite',(tx,fail)=>{
    const request=tx.objectStore('progress').get(record.id);
    request.onsuccess=()=>{try{
      const saved=savedPuzzles.get(record.id);
      // Check a small revision as well as object identity: another tab may have
      // replaced or deleted the artwork since this tab last opened it.
      const reusable=saved?.puzzle===record.puzzle&&saved.geometryVersion===record.puzzle.geometryVersion&&saved.key&&saved.key===request.result?._artworkKey;
      key=reusable?saved.key:crypto.randomUUID();
      if(!reusable)tx.objectStore('paintings').put(record);
      writeProgress(tx,record,key);
    }catch(error){fail(error);}};
  });
  // Failed transactions must never mark an unsaved painting as safely stored.
  remember(record,key);
}
export async function saveUpgrade(previous,updated){
  const archive={...previous,id:updated.previousEditionId,title:`${previous.title} · previous edition`,custom:false,archived:true};
  const archiveKey=crypto.randomUUID(),updatedKey=crypto.randomUUID();
  await transact(['paintings','progress','cards'],'readwrite',tx=>{
    for(const [record,key] of [[archive,archiveKey],[updated,updatedKey]]){tx.objectStore('paintings').put(record);writeProgress(tx,record,key);}
  });
  remember(archive,archiveKey);remember(updated,updatedKey);
}
export async function deletePainting(id){await transact(['paintings','progress','cards'],'readwrite',tx=>{for(const name of ['paintings','progress','cards'])tx.objectStore(name).delete(id);});savedPuzzles.delete(id);}
export function readPreferences(){try{return JSON.parse(localStorage.getItem('color-studio-preferences')||'{}');}catch{return {};}}
export function writePreferences(p){localStorage.setItem('color-studio-preferences',JSON.stringify(p));}
