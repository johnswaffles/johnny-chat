import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
const pending=new Set(['queued','in_progress']);
const fail=(message,code,status)=>Object.assign(Error(message),{code,...(status?{status}:{})});
export const STORY_RESPONSE_SCHEMA=`CREATE TABLE IF NOT EXISTS story_provider_requests (
 job_id TEXT NOT NULL,stage_key TEXT NOT NULL,stage TEXT NOT NULL,state TEXT NOT NULL,
 response_id TEXT NOT NULL DEFAULT '',client_request_id TEXT NOT NULL,model TEXT NOT NULL,
 effort TEXT NOT NULL,mode TEXT NOT NULL,submitted_at TEXT NOT NULL,checked_at TEXT NOT NULL,
 completed_at TEXT NOT NULL DEFAULT '',reasoning_json TEXT NOT NULL DEFAULT '{}',usage_json TEXT NOT NULL DEFAULT '{}',
 response_json TEXT NOT NULL DEFAULT '',error_code TEXT NOT NULL DEFAULT '',PRIMARY KEY(job_id,stage_key));`;
export function createStoryResponses({path,client,guard=()=>{},pollMs=5000,windowMs=30*60*1000,now=()=>Date.now(),sleep=(ms,signal)=>new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(signal.reason||Error('Interrupted'));};const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();})}){
 const access=(fn,write=false)=>{const d=new DatabaseSync(path);d.exec('PRAGMA busy_timeout=5000');try{if(write){d.exec('BEGIN IMMEDIATE');guard(d);}const result=fn(d);if(write)d.exec('COMMIT');return result;}catch(e){if(write)try{d.exec('ROLLBACK');}catch{}throw e;}finally{d.close();}};
 const init=()=>access(d=>d.exec(STORY_RESPONSE_SCHEMA));
 const read=(job,key)=>access(d=>d.prepare('SELECT * FROM story_provider_requests WHERE job_id=? AND stage_key=?').get(job,key));
 const update=(job,key,values)=>access(d=>{const names=Object.keys(values);d.prepare('UPDATE story_provider_requests SET '+names.map(n=>n+'=?').join(',')+' WHERE job_id=? AND stage_key=?').run(...Object.values(values),job,key);},true);
 async function run(jobId,key,request,signal){
  signal?.throwIfAborted();let row=read(jobId,key),response;
  if(!row){
   const stamp=new Date(now()).toISOString(),clientId='johnny-'+createHash('sha256').update(jobId+':'+key).digest('hex').slice(0,48);
   access(d=>d.prepare("INSERT INTO story_provider_requests(job_id,stage_key,stage,state,client_request_id,model,effort,mode,submitted_at,checked_at) VALUES(?,?,?,'submitting',?,?,?,?,?,?)").run(jobId,key,request.text?.format?.name||'editorial',clientId,request.model,request.reasoning?.effort||'',request.reasoning?.mode||'',stamp,stamp),true);
   try{
    response=await client.create({...request,background:true,store:true,metadata:{...(request.metadata||{}),johnny_job_id:jobId,johnny_stage_key:key}},{signal,timeout:60000,maxRetries:0,headers:{'X-Client-Request-Id':clientId}});
   }catch(error){
    // No documented Responses create-idempotency guarantee is assumed. A lost
    // create reply may already have started paid work: never replay it blindly.
    const rejected=[400,401,403,404,422,429].includes(error.status);
    const rejectionCode=rejected?String(error.code||error.error?.code||error.status).replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80):'submission_unknown';
    update(jobId,key,{state:rejected?'rejected':'submission_unknown',error_code:rejectionCode,checked_at:new Date(now()).toISOString()});
    throw fail(rejected?`The provider rejected this editorial request (${rejectionCode}). Your saved work is safe; review the error before retrying.`:'The provider submission outcome is unknown. No duplicate generation was started. Your saved work is safe; this request needs review before another submission.','PROVIDER_SUBMISSION_UNKNOWN');
   }
   if(!response?.id){update(jobId,key,{state:'submission_unknown',error_code:'missing_response_id'});throw fail('The provider did not return a response ID. No duplicate generation was started.','PROVIDER_SUBMISSION_UNKNOWN');}
   update(jobId,key,{response_id:response.id,state:response.status||'queued',checked_at:new Date(now()).toISOString()});row=read(jobId,key);
  }
  if(!row.response_id)throw fail('This submission has no confirmed provider response ID. It will not be replayed automatically. Saved work is retained.','PROVIDER_SUBMISSION_UNKNOWN');
  if(row.state==='cancelled')throw fail('The provider response was cancelled. Your saved draft is unchanged.','PROVIDER_CANCELLED');
  if(row.response_json)return JSON.parse(row.response_json);
  const deadline=now()+windowMs;
  for(;;){
   signal?.throwIfAborted();
   if(!response){try{response=await client.retrieve(row.response_id,{}, {signal,timeout:60000,maxRetries:0});}catch(error){
    if(signal?.aborted)throw error;
    update(jobId,key,{error_code:error.status===404?'response_unavailable':'poll_interrupted',checked_at:new Date(now()).toISOString()});
    if(error.status===404)throw fail('The saved provider response is unavailable. No replacement was generated; review this request before resubmitting.','PROVIDER_RESPONSE_UNAVAILABLE');
    throw fail('The provider status check was interrupted. Its response ID is saved; reconnection will check the same generation.','PROVIDER_POLL_INTERRUPTED',503);
   }}
   if(response.id!==row.response_id)throw fail('The provider returned an unexpected response ID. Nothing was saved to your draft.','PROVIDER_RESPONSE_MISMATCH');
   const state=response.status||'unknown',terminal=!pending.has(state),stamp=new Date(now()).toISOString();
   if(terminal&&!['completed','incomplete','failed','cancelled'].includes(state))throw fail('The provider returned an unrecognized status. Nothing was saved to your draft.','PROVIDER_RESPONSE_INVALID');
   if((terminal&&!response.model)||(response.model&&response.model!==request.model&&!response.model.startsWith(request.model+'-'))){update(jobId,key,{state:'blocked',model:response.model||'unconfirmed',error_code:'model_mismatch',checked_at:stamp});throw fail('The provider model could not be verified as the requested model. Nothing was saved to your draft.','PROVIDER_MODEL_MISMATCH');}
   if(response.reasoning?.effort&&response.reasoning.effort!==request.reasoning?.effort){update(jobId,key,{state:'blocked',reasoning_json:JSON.stringify(response.reasoning),error_code:'reasoning_mismatch',checked_at:stamp});throw fail('The provider returned a different reasoning effort. Nothing was saved to your draft.','PROVIDER_REASONING_MISMATCH');}
   if(response.reasoning?.mode&&response.reasoning.mode!==request.reasoning?.mode){update(jobId,key,{state:'blocked',reasoning_json:JSON.stringify(response.reasoning),error_code:'reasoning_mismatch',checked_at:stamp});throw fail('The provider returned a different reasoning mode. Nothing was saved to your draft.','PROVIDER_REASONING_MISMATCH');}
   update(jobId,key,{state,reasoning_json:JSON.stringify(response.reasoning||{}),model:response.model||row.model,checked_at:stamp,completed_at:terminal?stamp:'',usage_json:JSON.stringify(response.usage||{}),error_code:response.error?.code||response.incomplete_details?.reason||'',...(terminal?{response_json:JSON.stringify(response)}:{})});
   if(terminal){if(state==='cancelled')throw fail('The provider response was cancelled. Your saved draft is unchanged.','PROVIDER_CANCELLED');return response;}
   if(now()>=deadline)throw fail('The provider is still working. Its response ID is saved; reconnection will continue checking it without another generation.','PROVIDER_STILL_WORKING',503);
   response=null;await sleep(pollMs,signal);
  }
 }
 function info(jobId){return access(d=>{let rows;try{rows=d.prepare('SELECT stage,state,response_id AS responseId,model,effort,mode,submitted_at AS submittedAt,checked_at AS checkedAt,completed_at AS completedAt,reasoning_json,usage_json,error_code AS errorCode FROM story_provider_requests WHERE job_id=? ORDER BY checked_at DESC,rowid DESC').all(jobId);}catch(e){if(/no such table/.test(e.message))return null;throw e;}if(!rows.length)return null;const {usage_json,reasoning_json,...last}=rows[0];return {...last,providerReasoning:JSON.parse(reasoning_json),usage:JSON.parse(usage_json),completedRequests:rows.filter(r=>r.state==='completed').length};});}
 // Called only after the worker lease is revoked. Never creates replacement work.
 async function cancelJob(jobId){
  const rows=access(d=>d.prepare("SELECT * FROM story_provider_requests WHERE job_id=? AND state IN ('queued','in_progress','submitting','submission_unknown')").all(jobId));
  for(const row of rows){
   if(!row.response_id)throw fail('The editor is stopped, but a provider submission has no confirmed response ID. Its outcome needs review before starting over. Saved work is safe.','PROVIDER_SUBMISSION_UNKNOWN',409);
   let response;
   try{
    response=await client.retrieve(row.response_id,{}, {timeout:60000,maxRetries:0});
    if(pending.has(response.status)){
     try{response=await client.cancel(row.response_id,{timeout:60000,maxRetries:0});}
     catch{response=await client.retrieve(row.response_id,{}, {timeout:60000,maxRetries:0});}
    }
   }catch{throw fail('Editing is stopped, but provider cancellation could not be confirmed. Keep this workspace open and try Start over again to check the same request.','PROVIDER_CANCEL_UNCONFIRMED',409);}
   if(response.id!==row.response_id||!['completed','incomplete','failed','cancelled'].includes(response.status))throw fail('The provider is still stopping. Saved work is safe. Try Start over again to check the same request.','PROVIDER_CANCEL_PENDING',409);
   const stamp=new Date(now()).toISOString();
   access(d=>d.prepare('UPDATE story_provider_requests SET state=?,checked_at=?,completed_at=?,response_json=?,usage_json=?,error_code=? WHERE job_id=? AND response_id=?').run(response.status,stamp,stamp,JSON.stringify(response),JSON.stringify(response.usage||{}),response.status==='cancelled'?'user_cancelled':'',jobId,row.response_id));
  }
  return {stopped:true};
 }
 return {init,run,info,cancelJob};
}
