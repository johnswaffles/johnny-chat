// One reset at a time. Verify server work before discarding any local state.
export function createWorkspaceReset({getWork,confirm,stop,clear,busy}){
 let running=false;
 return async()=>{
  if(running)return false;running=true;busy(true);
  try{
   const work=await getWork();
   if(!await confirm(work))return false;
   if(work.projectId){const result=await stop(work.projectId);if(!result.stopped)throw Error('Stopping could not be confirmed. Your workspace is still open.');}
   await clear();return true;
  }finally{running=false;busy(false);}
 };
}
