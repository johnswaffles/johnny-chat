const stages=[['reading','Read'],['planning','Plan'],['editing','Revise'],['polishing','Polish'],['review','Review']];
const positive=value=>Number.isInteger(value)&&value>0?value:null;
const nonnegative=value=>Number.isInteger(value)&&value>=0?value:null;
const providerStage=stage=>({story_autopilot_read:'reading',story_autopilot_plan:'planning',story_autopilot_chunk:'editing',story_autopilot_polish:'polishing',story_autopilot_review:'review'}[stage]);
export function revisionTracker({job=null,connection='connected',now=Date.now()}={}){
 if(!job)return {visible:false};
 const running=['queued','running'].includes(job.status),done=job.status==='completed',paused=job.phase==='paused'||job.status==='paused'||job.status==='cancelled',failed=job.status==='failed'&&!paused;
 const phase=stages.some(([id])=>id===job.phase)?job.phase:providerStage(job.provider?.stage);
 const index=stages.findIndex(([id])=>id===phase),saved=nonnegative(job.completedChunks),reportedTotal=positive(job.totalChunks),total=reportedTotal&&!(saved>reportedTotal)?reportedTotal:null;
 const current=positive(job.currentChunk),position=current?` section ${current}${total?` of ${total}`:''}`:'';
 const check=Date.parse(job.provider?.checkedAt),checkAge=Number.isFinite(check)?Math.max(0,now-check):null;
 const disconnected=connection==='reconnecting'||connection==='auth'||(running&&checkAge!==null&&checkAge>90000);
 const elapsed=Date.parse(job.provider?.submittedAt),long=running&&Number.isFinite(elapsed)&&now-elapsed>=10*60*1000;
 const phaseTitles={reading:`Reading${position||' the manuscript'}`,planning:'Building the editorial plan',editing:`Revising${position||' the manuscript'}`,polishing:`Polishing${position||' the saved draft'}`,review:'Checking continuity and the ending'};
 const stageTitle=done?'Revision ready for your review':paused?'Paused · your saved work is safe':failed?'Editing stopped safely':!running?'Editorial status unavailable':job.status==='queued'?'Waiting for the editor':phaseTitles[phase]||'Checking editorial status';
 const state=done?'complete':paused?'paused':failed?'failed':disconnected?'reconnecting':running?(index<0&&job.status!=='queued'?'unknown':'active'):'unknown';
 const title=disconnected&&running?'Last known: '+stageTitle:stageTitle;
 const eyebrow=state==='unknown'?'CHECKING STATUS':['paused','failed','reconnecting'].includes(state)?'LAST CONFIRMED STAGE':done?'READY FOR REVIEW':'CURRENT STAGE';
 const provider=job.provider?.state;
 let providerLabel=({queued:'Provider queued',in_progress:'Model working',completed:'Provider response saved',cancelled:'Provider cancelled',failed:'Provider request failed',incomplete:'Provider response incomplete',submitting:'Submitting request',submission_unknown:'Submission needs review'}[provider]||'Provider status unavailable');
 if(disconnected)providerLabel=connection==='auth'?'Unlock to see updates':connection==='reconnecting'?'Reconnecting to saved progress':'Status check overdue';
 else if(!running&&!done&&['queued','in_progress','submitting'].includes(provider))providerLabel='Provider was active at last check';
 if(done)providerLabel='All editorial stages finished';
 const detail=done?'Read the revised draft and editorial notes. Retained passages may still need your attention.':paused?'Your original and completed revisions remain saved. Starting again requires an explicit action.':failed?(job.error||'Your original and completed revisions remain saved. Review the issue before retrying.'):!running?'This update does not establish whether editing is running. Refresh to check its saved status.':disconnected?'Showing the last saved update. This does not confirm whether the model is still working.':phase==='reading'?'Reading builds story notes. It does not mean any prose has been revised.':phase==='planning'?'Planning shapes the whole manuscript before revised sections are saved.':phase==='polishing'?'Polish is a separate pass over saved revisions; it is not counted as new revised sections.':phase==='review'?'The saved draft is being checked for continuity and an earned ending.':long?'This request is taking time. Another section counts only after it has been saved.':phase==='editing'?'Each completed section is saved before Mara moves to the next.':'Waiting for a confirmed editorial stage. Saved counts are shown separately.';
 const stamp=Number.isFinite(check)?`Provider checked ${new Date(check).toISOString().slice(11,19)} UTC`:'No provider check reported yet';
 return {visible:true,state,title,eyebrow,detail,providerLabel,stamp,saved,total,count:saved===null?'—':String(saved),countSuffix:total?` / ${total}`:'',meter:saved!==null&&total!==null?{value:saved,max:total}:null,canPause:running,motion:running&&!disconnected&&['queued','in_progress'].includes(provider),milestones:stages.map(([id,label],i)=>({id,label,state:done?'done':index<0?'unknown':i<index?'done':i===index?'current':'next',symbol:done||i<index?'✓':String(i+1)})),announcement:`${title}. ${saved===null?'Saved count unavailable':`${saved}${total?` of ${total}`:''} revision sections saved`}. ${providerLabel}.`};
}
export function renderRevisionTracker($,options){
 const view=revisionTracker(options),root=$('notebook-job-progress');root.hidden=!view.visible;if(!view.visible)return view;
 root.dataset.state=view.state;root.dataset.motion=String(view.motion);
 for(const [id,text] of Object.entries({'revision-tracker-eyebrow':view.eyebrow,'revision-tracker-title':view.title,'revision-tracker-detail':view.detail,'revision-tracker-count':view.count,'revision-tracker-total':view.countSuffix,'revision-tracker-provider':view.providerLabel,'revision-tracker-check':view.stamp,'notebook-job-copy':view.announcement}))$(id).textContent=text;
 const meter=$('notebook-job-meter');meter.setAttribute('aria-valuetext',view.saved===null?'Saved section count unavailable':`${view.saved}${view.total?` of ${view.total}`:''} revision sections saved`);
 for(const key of ['aria-valuenow','aria-valuemax'])meter.removeAttribute(key);
 if(view.meter){meter.setAttribute('aria-valuenow',String(view.meter.value));meter.setAttribute('aria-valuemax',String(view.meter.max));}
 $('revision-tracker-fill').style.width=view.meter?`${view.meter.value/view.meter.max*100}%`:'0%';
 for(const step of view.milestones){const node=$('revision-step-'+step.id);node.dataset.state=step.state;node.setAttribute('aria-label',`${step.label}: ${step.state==='done'?'complete':step.state==='current'?(view.state==='paused'?'paused at this stage':view.state==='failed'?'stopped at this stage':'current stage'):step.state==='unknown'?'not confirmed':'not started'}`);if(step.state==='current')node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');$('revision-icon-'+step.id).textContent=step.symbol;}
 $('notebook-stop-full').hidden=!view.canPause;
 // Announce semantic changes only, not every heartbeat/status timestamp.
 const live=$('revision-tracker-live');if(live.textContent!==view.announcement)live.textContent=view.announcement;
 return view;
}
