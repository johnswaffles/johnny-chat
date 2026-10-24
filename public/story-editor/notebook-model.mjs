// A single next step, derived from saved manuscript/job state, never a second queue.
export function notebookJourney({job=null,busy=false,bookmark=null,hasRevision=false,walkthrough=false}={}){
 if(busy||['queued','running'].includes(job?.status)){
  const total=Math.max(1,job?.totalChunks||1),current=job?.currentChunk||1;
  const progress=job?.phase==='reading'?Math.round(15*Math.max(0,current-1)/total):job?.phase==='planning'?15:job?.phase==='polishing'?Math.round(70+24*Math.max(0,current-1)/total):job?.phase==='review'?95:Math.min(70,20+Math.round((job?.completedChunks||0)/total*50));
  return {step:'revision',title:'Your revision is taking shape.',copy:'Johnny is working through the entire manuscript with your direction. You can leave and return; each section is saved.',action:'working',label:'Revision in progress',progress,detail:`${job?.completedChunks||0}/${job?.totalChunks||'…'} revision sections saved · ${job?.savedStageResults||0} stage results checkpointed. ${job?.provider?`Provider: ${job.provider.state} (${job.provider.model} / ${job.provider.effort} / ${job.provider.mode}), checked ${job.provider.checkedAt}. `:''}${job?.message||'Reading, revising, and checking the manuscript…'}`};
 }
 if(job?.status==='failed')return {step:'revision',title:'Your revision is safely paused.',copy:job.error||'Your original and completed sections are saved. Resume the unfinished work, or change direction in More.',action:'resume',label:'Resume revision',progress:0};
 if(hasRevision||job?.status==='completed')return {step:'together',title:walkthrough||bookmark?'Pick up where your story left off.':'Your revision is ready. Now make it yours.',copy:walkthrough||bookmark?'Continue at your saved passage. Read, interrupt, and shape the story together.':'Work through the revised manuscript from beginning to end. Your original remains available for comparison.',action:walkthrough||bookmark?'continue':'begin',label:walkthrough||bookmark?'Continue together':'Start at the beginning',progress:100};
 return {step:'source',title:'What would you like this to become?',copy:'Set your direction in the manuscript sidebar, then create a complete first revision. You can also discuss the story before changing it.',action:'create',label:'Create first revision',progress:0};
}
export function notebookReference(chapters,chapter,passage){
 if(!Number.isInteger(chapter)||!Number.isInteger(passage)||passage<1)return null;
 return chapters.find(c=>c.index===chapter)?.passages[passage-1]?.id||null;
}
