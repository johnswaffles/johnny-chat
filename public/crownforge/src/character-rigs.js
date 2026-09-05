import { HearthkinRig, HEARTHKIN_ACTIONS, hearthkinPose } from './hearthkin-rig.js';
import ashenHearthkin from './roster-art/ashen-hearthkin.js';
import crownSpearwarden from './roster-art/crown-spearwarden.js';
import crownShieldbearer from './roster-art/crown-shieldbearer.js';
import crownGuard from './roster-art/crown-guard.js';
import crownScout from './roster-art/crown-scout.js';
import ashenOutrider from './roster-art/ashen-outrider.js';
import crownMilitia from './roster-art/crown-militia.js';
import thornSpear from './roster-art/thorn-spear.js';
import hearthLevy from './roster-art/hearth-levy.js';
import ashenHidewall from './roster-art/ashen-hidewall.js';
import ashenRaider from './roster-art/ashen-raider.js';
import { militaryActions, militaryPose, MILITARY_PROFILES } from './military-motion.js';
import { mountedActions, mountedPose } from './mounted-motion.js';
import { UNIT_TYPES } from './config.js';

function workerActions(type) {
  const unit=UNIT_TYPES[type],timing=unit.attackTiming??{anticipation:.25,contact:.45,recovery:.3};
  return Object.fromEntries(Object.entries(HEARTHKIN_ACTIONS).map(([state,action])=>[state,{...action,
    duration:state==='attack'?unit.cooldown:state.startsWith('attack_')?unit.cooldown*timing[state.slice(7)]:action.duration,
  }]));
}
function workerPose(type,state,time,direction,options={}) {
  const actions=workerActions(type),action=actions[state]??actions.idle;
  if(state==='death') {
    const pose=militaryPose('raider','death',time/action.duration*militaryActions('raider').death.duration,direction,{...options,profileOverride:{...MILITARY_PROFILES.raider,shoulders:12,hips:4.4,scale:1}});
    return {...pose,type,duration:action.duration};
  }
  if(state==='attack') {
    let elapsed=((time%action.duration)+action.duration)%action.duration;
    for(const phase of ['anticipation','contact','recovery']) {
      const key='attack_'+phase,span=actions[key].duration;
      if(elapsed<span||phase==='recovery') {
        const pose=hearthkinPose(key,elapsed/span*HEARTHKIN_ACTIONS[key].duration,direction,options);
        return {...pose,state:'attack',phase:time/action.duration%1};
      }
      elapsed-=span;
    }
  }
  const reference=HEARTHKIN_ACTIONS[state]??HEARTHKIN_ACTIONS.idle;
  return hearthkinPose(state,time/action.duration*reference.duration,direction,options);
}

// Entries are added only once the character owns four usable art views.
// The scope ledger retains every unfinished current-game character.
export const CHARACTER_RIGS={
  villager:{id:'villager',label:'Crownwarden Hearthkin',faction:'Crownwardens',family:'worker',actions:workerActions('villager'),samplePose:(...args)=>workerPose('villager',...args)},
  ashenForager:{...ashenHearthkin,id:'ashenForager',label:'Ashen Hearthkin',faction:'Ashen',family:'worker',actions:workerActions('ashenForager'),samplePose:(...args)=>workerPose('ashenForager',...args)},
  soldier:{...crownGuard,id:'soldier',label:'Crown Guard',faction:'Crownwardens',family:'foot',actions:militaryActions('soldier'),samplePose:(...args)=>militaryPose('soldier',...args),dimensions:{torso:28,upperArm:10.5,forearm:6.5,headHeight:28,cloakWidth:29,cloakHeight:43}},
  scout:{...crownScout,id:'scout',label:'Crown Scout',faction:'Crownwardens',family:'mounted',renderScale:120/UNIT_TYPES.scout.renderSize,actions:mountedActions('scout'),samplePose:(...args)=>mountedPose('scout',...args)},
  ashenOutrider:{...ashenOutrider,id:'ashenOutrider',label:'Ashen Outrider',faction:'Ashen',family:'mounted',renderScale:120/UNIT_TYPES.ashenOutrider.renderSize,actions:mountedActions('ashenOutrider'),samplePose:(...args)=>mountedPose('ashenOutrider',...args)},
  militia:{...crownMilitia,id:'militia',label:'Crown Militia',faction:'Crownwardens',family:'foot',actions:militaryActions('militia'),samplePose:(...args)=>militaryPose('militia',...args),dimensions:{torso:26,torsoSide:20,upperArm:9.5,forearm:6.3,headWidth:18,headHeight:26}},
  thornSpear:{...thornSpear,id:'thornSpear',label:'Ashen Thorn Spear',faction:'Ashen',family:'foot',actions:militaryActions('thornSpear'),samplePose:(...args)=>militaryPose('thornSpear',...args),dimensions:{torso:28,torsoSide:22,upperArm:10.5,forearm:6.7,headWidth:18,headHeight:25}},
  hearthLevy:{...hearthLevy,id:'hearthLevy',label:'Ashen Hearth Levy',faction:'Ashen',family:'foot',actions:militaryActions('hearthLevy'),samplePose:(...args)=>militaryPose('hearthLevy',...args),dimensions:{torso:28,torsoSide:22,upperArm:10.4,forearm:6.7,headWidth:18,headHeight:25}},
  spearwarden:{...crownSpearwarden,id:'spearwarden',label:'Crown Spearwarden',faction:'Crownwardens',family:'foot',actions:militaryActions('spearwarden'),samplePose:(...args)=>militaryPose('spearwarden',...args),dimensions:{torso:27,torsoSide:21,upperArm:10,forearm:6.6,headWidth:18,headHeight:26}},
  shieldbearer:{...crownShieldbearer,id:'shieldbearer',label:'Crown Shieldbearer',faction:'Crownwardens',family:'foot',actions:militaryActions('shieldbearer'),samplePose:(...args)=>militaryPose('shieldbearer',...args),dimensions:{torso:30,torsoSide:23,upperArm:10.5,forearm:7.1,headWidth:19,headHeight:26}},
  hidewall:{...ashenHidewall,id:'hidewall',label:'Ashen Hidewall',faction:'Ashen',family:'foot',actions:militaryActions('hidewall'),samplePose:(...args)=>militaryPose('hidewall',...args),dimensions:{torso:33,torsoSide:25,upperArm:12.5,forearm:8,headWidth:19,headHeight:26,cloakWidth:36,cloakHeight:40}},
  raider:{...ashenRaider,id:'raider',label:'Ashen Raider',faction:'Ashen',family:'foot',actions:militaryActions('raider'),samplePose:(...args)=>militaryPose('raider',...args),dimensions:{torso:31,torsoSide:23,upperArm:11.5,forearm:7.2,headWidth:19,headHeight:25,cloakWidth:32,cloakHeight:38}},
};

class LazyCharacterRigs extends Map {
  // Membership describes supported characters; iteration and size describe
  // the rigs actually requested so far. Inspection studios remain eager.
  has(type) { return Object.hasOwn(CHARACTER_RIGS,type); }
  get(type) {
    if(!this.has(type))return undefined;
    if(!super.has(type))super.set(type,new HearthkinRig(CHARACTER_RIGS[type]));
    return super.get(type);
  }
}

export function createCharacterRigs({lazy=false}={}) {
  return lazy?new LazyCharacterRigs():new Map(Object.entries(CHARACTER_RIGS).map(([type,definition])=>[type,new HearthkinRig(definition)]));
}
