// Painting boundaries expressed as normalized time, leaving room for weight
// before the short strike and a longer recovery. Walk cadence stays separate.
export const ACTION_TIMING={
 idle:{seconds:3.6,starts:[0,.25,.5,.75],labels:['Rest','Inhale','Full breath','Exhale']},
 swipe:{seconds:1.65,starts:[0,.18,.32,.46,.56,.63,.75,.89],labels:['Ready','Brace','Draw back','Wind-up','Strike','Follow-through','Recover','Settle']},
 rear:{seconds:2.4,starts:[0,.16,.29,.43,.59,.68,.78,.92],labels:['Ready','Gather weight','Rise','Towering wind-up','Standing strike','Follow-through','Lower','Settle']}
};
export function actionFrame(action,phase){
 const starts=ACTION_TIMING[action]?.starts;if(!starts)return 0;
 const p=phase-Math.floor(phase);let index=0;
 for(let i=1;i<starts.length;i++){if(p<starts[i])break;index=i;}
 return index;
}
export function framePhase(action,index,count){
 return ACTION_TIMING[action]?ACTION_TIMING[action].starts[index]+.0001:(index+.01)/count;
}
export function advanceAction(action,phase,dt,once=false){
 const value=phase+Math.max(0,dt)/ACTION_TIMING[action].seconds;
 return once&&value>=1?{phase:0,action:'idle',done:true}:{phase:value%1,action,done:false};
}
