export const VIEWS={sw:{label:'Southwest · front left',vector:[-1,.5]},se:{label:'Southeast · front right',vector:[1,.5]},nw:{label:'Northwest · rear left',vector:[-1,-.5]},ne:{label:'Northeast · rear right',vector:[1,-.5]}};
export const ACTIONS={walk:{seconds:1.25,labels:['Left contact','Left support','Right passing','Right reach','Right contact','Right support','Left passing','Left reach']},idle:{seconds:3.6,labels:['Rest','Inhale','Full breath','Exhale']}};
export const frameIndex=(phase,count)=>Math.floor((phase-Math.floor(phase))*count)%count;
export const directionFor=(dx,dy)=>dy<0?(dx<0?'nw':'ne'):(dx<0?'sw':'se');
export function advanceActor(actor,dt,speed=.3){const dx=actor.target.x-actor.x,dy=actor.target.y-actor.y,len=Math.hypot(dx,dy),step=Math.min(len,Math.max(0,dt)*speed);if(len<.0001)return 0;actor.x+=dx/len*step;actor.y+=dy/len*step;return step;}
