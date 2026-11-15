let database;
function db(){return database ||= new Promise((resolve,reject)=>{
  const request=indexedDB.open('johnny-color-studio',1);
  request.onupgradeneeded=()=>{for(const name of ['paintings','cards'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name,{keyPath:'id'});};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>{database=null;reject(request.error);};
});}
async function transact(stores,mode,callback){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction(stores,mode);let result;try{result=callback(tx);}catch(e){reject(e);return;}tx.oncomplete=()=>resolve(result?.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Storage was interrupted'));});}
export const getPainting=id=>transact(['paintings'],'readonly',tx=>tx.objectStore('paintings').get(id));
export const listCards=()=>transact(['cards'],'readonly',tx=>tx.objectStore('cards').getAll());
export const allPaintings=()=>transact(['paintings'],'readonly',tx=>tx.objectStore('paintings').getAll());
export async function savePainting(record){
  const {id,title,category,thumbnail,updated,filled,puzzle,custom}=record;
  return transact(['paintings','cards'],'readwrite',tx=>{
    tx.objectStore('paintings').put(record);
    tx.objectStore('cards').put({id,title,category,thumbnail,updated,custom,total:puzzle.regions.length,done:filled.length});
  });
}
export async function saveUpgrade(previous,updated){
  const archive={...previous,id:updated.previousEditionId,title:`${previous.title} · previous edition`,custom:false,archived:true};
  return transact(['paintings','cards'],'readwrite',tx=>{
    for(const record of [archive,updated]){
      tx.objectStore('paintings').put(record);
      const {id,title,category,thumbnail,updated,custom,filled,puzzle}=record;
      tx.objectStore('cards').put({id,title,category,thumbnail,updated,custom,archived:!!record.archived,total:puzzle.regions.length,done:filled.length});
    }
  });
}
export const deletePainting=id=>transact(['paintings','cards'],'readwrite',tx=>{tx.objectStore('paintings').delete(id);tx.objectStore('cards').delete(id);});
export function readPreferences(){try{return JSON.parse(localStorage.getItem('color-studio-preferences')||'{}');}catch{return {};}}
export function writePreferences(p){localStorage.setItem('color-studio-preferences',JSON.stringify(p));}
