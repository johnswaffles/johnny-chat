import {HEARTHKIN_BLENDER_ART} from './hearthkin-blender-art.js?v=20260911-worker-v010';
import {RESOURCE_TYPES,UNIT_TYPES} from './config.js?v=20260911-singleteam1';
const clamp=n=>Math.max(0,Math.min(.999999,n));
const cycle=n=>((n%1)+1)%1;
const cargo={wood:'Wood',food:'Berries',stone:'Stone',gold:'Gold',supplies:'Supplies'};
const actions={idle:'Idle',walk:'Walk',gather_wood:'Chop',gather_food:'PickBerries',gather_stone:'QuarryStone',gather_gold:'MineGold',construct:'Build',repair:'Repair',demolish:'Dismantle',field_work:'TendField',attack:'Defend',attack_anticipation:'DefendWindup',attack_contact:'DefendStrike',attack_recovery:'DefendRecover',hit:'Hit',stunned:'Stunned',ward_block:'WardBlock',ward_raise:'WardActivate',last_light:'LastLight',last_light_cursed:'Hit',death:'Fall'};
export function blenderHearthkinFrame(unit,timeOverride,reducedMotion=false,art=HEARTHKIN_BLENDER_ART){
 const view=['se','sw','ne','nw'][unit.paintedFacing]??['sw','se','ne','nw'][unit.facing??0]??'sw';
 let action=unit.animationState??'idle',phase=unit.animationPhase??0;
 const moving=(unit.motionSpeed??0)>.025,load=cargo[unit.carryType];
 if(unit.dead){action='death';phase=clamp((unit.deathAge??unit.animationTime??0)/1.6);}
 else if(unit.command==='attack'&&['anticipation','contact','recovery'].includes(unit.attackPhase)){
  action='attack_'+unit.attackPhase;
  const config=UNIT_TYPES[unit.type]??UNIT_TYPES.villager;const durations=config.attackTiming??{anticipation:.25,contact:.45,recovery:.3};phase=clamp((unit.attackPhaseElapsed??0)/(config.cooldown*durations[unit.attackPhase]));
 } else if(action==='idle')phase=reducedMotion?0:cycle((unit.animClock??unit.animationTime??0)/3.6);
 else if(action.startsWith('gather_'))phase=cycle((unit.gatherTimer??0)/(RESOURCE_TYPES[action.slice(7)]?.gatherTime??1.1));
 else if(['construct','repair','demolish','field_work'].includes(action))phase=cycle(unit.workCyclePhase??unit.animationPhase??0);
 else if(action==='ward_block')phase=clamp(1-(unit.wardBlockedPulse??0)/.42);
 if(!unit.dead&&!moving&&!action.startsWith('attack')&&timeOverride===undefined){
  const age=(unit.lastLightWardDuration??0)-(unit.lastLightWardTimer??0);
  if(unit.lastLightWardBlastTimer>0){action='last_light';phase=.6+.4*clamp(1-unit.lastLightWardBlastTimer/(unit.lastLightWardBlastDuration||.9));}
  else if(unit.lastLightWardTimer>0&&age>=0&&age<.8){action='ward_raise';phase=clamp(age/.8);}
  else if(unit.lastLightWardCurseDelayTimer>0){action='last_light';phase=.6*clamp((age-.8)/.7);}
 }
 let clip=actions[action]??(art[view][action]?action:'Idle');
 if(!unit.dead&&load&&unit.carryAmount>0&&(action==='idle'||action==='walk'||action.startsWith('carry_')))clip=(moving?'Carry':'Hold')+load;
 else if(action.startsWith('carry_')&&cargo[action.slice(6)])clip=(moving?'Carry':'Hold')+cargo[action.slice(6)];
 else if(action==='walk'&&!moving&&timeOverride===undefined){clip='Idle';phase=0;}
 if(!unit.dead&&clip==='Idle'&&unit.lastLightWardTimer>0)clip='WardSustain';
 if(clip.startsWith('Hold'))phase=reducedMotion?0:cycle((unit.animClock??unit.animationTime??0)/2.67);
 const sheet=art[view][clip];
 if(timeOverride!==undefined)phase=sheet.loop?cycle(timeOverride/sheet.seconds):clamp(timeOverride/sheet.seconds);
 // Match the authored contact pose to the simulation's existing 60% work event.
 if(['gather_wood','gather_stone','gather_gold','construct','repair','demolish','field_work'].includes(action)&&sheet.contact!=null)phase=phase<.6?phase/ .6*sheet.contact:sheet.contact+(phase-.6)/.4*(1-sheet.contact);
 const index=Math.min(sheet.frames.length-1,Math.floor(clamp(phase)*sheet.frames.length));
 return {view,clip,phase,index,sheet,frame:sheet.frames[index]};
}
export class BlenderHearthkinRenderer{
 constructor(){this.definition={id:'villager'};this.images=new Map();for(const views of Object.values(HEARTHKIN_BLENDER_ART))for(const sheet of Object.values(views)){const im=new Image();im.src=new URL('../'+sheet.src,import.meta.url).href;this.images.set(sheet.src,im);}}
 readiness(){return [...this.images.values()];}
 get ready(){return this.readiness().every(im=>im.complete&&im.naturalWidth>0);}
 draw(ctx,unit,point,size,alpha=1,timeOverride){const {sheet,frame}=blenderHearthkinFrame(unit,timeOverride,this.reducedMotion);const image=this.images.get(sheet.src);if(!image?.complete||!image.naturalWidth)return false;
 const scale=size*.94/sheet.scaleBase;ctx.save();ctx.globalAlpha*=alpha;ctx.fillStyle='rgba(13,23,17,.2)';ctx.beginPath();ctx.ellipse(point.x,point.y+1,size*.17,size*.035,0,0,Math.PI*2);ctx.fill();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,...frame.rect,point.x-frame.pivot[0]*scale,point.y-frame.pivot[1]*scale,frame.rect[2]*scale,frame.rect[3]*scale);ctx.restore();return true;}
}
