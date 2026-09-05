import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CHARACTER_RIGS} from '../src/character-rigs.js';
import {HearthkinRig} from '../src/hearthkin-rig.js';
import {HEARTHKIN_RIG_ART,HEARTHKIN_ARM_PARTS,HEARTHKIN_HAND_PARTS} from '../src/hearthkin-rig-art.js';
import {projectHearthkin} from '../src/hearthkin-locomotion.js';
import {fitHearthkinProfile} from '../src/hearthkin-surface-fit.js';
import {fitCharacterSurfaces} from '../src/character-surface-fit.js';

const crown=CHARACTER_RIGS.villager,views=['front','right','back','left'];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z??0)-(b.z??0));
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const mul=(a,n)=>({x:a.x*n,y:a.y*n,z:a.z*n});
const vector=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const close=(a,b,label,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${label}: ${a} versus ${b}`);
const near=(a,b,label,tolerance=1e-7)=>close(distance(a,b),0,label,tolerance);
const sample=(state,phase,direction)=>crown.samplePose(state,crown.actions[state].duration*phase,direction,{id:5,moving:true});
const sourceSocket=direction=>direction===1?[(325-176)/546,(245-27)/950]:[(1260-863)/533,(255-28)/953];

// Independently map the measured source point through the renderer's
// torso basis, including the body-plane transform used during death.
function paintedSocket(pose){
  const [u,v]=sourceSocket(pose.direction);
  if(pose.bodyFrame){
    const frame=pose.bodyFrame,origin=projectHearthkin(add(pose.anatomical.neck,frame.up),pose.direction);
    const across=projectHearthkin(mul(frame.forward,pose.direction===1?1:-1),pose.direction);
    const down=projectHearthkin(mul(frame.up,-1),pose.direction);
    return{x:origin.x+across.x*(u-.5)*20+down.x*v*31,y:origin.y+across.y*(u-.5)*20+down.y*v*31};
  }
  const dx=pose.waist.x-pose.neck.x,dy=pose.waist.y-pose.neck.y;
  const height=Math.hypot(dx,dy)+3,angle=Math.atan2(dy,dx)-Math.PI/2;
  return{x:pose.neck.x+Math.cos(angle)*(u-.5)*20-Math.sin(angle)*v*height,
    y:pose.neck.y-1+Math.sin(angle)*(u-.5)*20+Math.cos(angle)*v*height};
}

test('all 23 Crown actions retain physical limbs, fixed work palms and measured profile sockets',()=>{
  assert.equal(Object.keys(crown.actions).length,23);
  let fitted=0,fixed=0;
  for(const state of Object.keys(crown.actions))for(let direction=0;direction<4;direction++)for(let n=0;n<81;n++){
    const pose=sample(state,n/81,direction),snapshot=structuredClone(pose),fit=fitHearthkinProfile(pose);
    const label=`${state}/${views[direction]}/${n}`;
    assert.deepEqual(pose,snapshot,`${label} fitting does not mutate canonical motion`);
    if(!pose.sideView){assert.equal(fit,pose,`${label} front and back need no profile fit`);continue;}
    fitted++;
    const side=direction===1?'right':'left',far=side==='right'?'left':'right',j=fit.anatomical,old=pose.anatomical;
    const fixedPalm=pose.projectedWork&&!['hit','death'].includes(pose.state);
    for(const point of Object.values(j))assert.ok(['x','y','z'].every(axis=>Number.isFinite(point[axis])),`${label} finite anatomical point`);
    assert.deepEqual(j[far+'Shoulder'],old[far+'Shoulder'],`${label} far shoulder remains unchanged`);
    for(const arm of ['left','right']){
      for(const joint of ['Shoulder','Elbow','Hand','Palm'])if(j[arm+joint]){
        const p=projectHearthkin(j[arm+joint],direction);
        near(fit[arm+joint],p,`${label}/${arm} fitted ${joint} projection`);
      }
      close(distance(j[arm+'Shoulder'],j[arm+'Elbow']),17,`${label}/${arm} upper arm length`);
      close(distance(j[arm+'Elbow'],j[arm+'Hand']),16,`${label}/${arm} forearm length`);
    }
    const socket=paintedSocket(pose),shoulder=fit[side+'Shoulder'],error=Math.hypot(socket.x-shoulder.x,socket.y-shoulder.y);
    assert.ok(error<=.2,`${label} shoulder remains within .2 units of painted socket (${error})`);
    if(error>1e-7)assert.ok(pose.state.startsWith('attack'),`${label} only maximum attack extension needs a small socket accommodation`);
    if(fixedPalm){
      fixed++;
      for(const arm of ['left','right']){
        near(j[arm+'Palm'],old[arm+'Palm'],`${label}/${arm} physical work palm remains on target`);
        close(distance(j[arm+'Hand'],j[arm+'Palm']),4.4,`${label}/${arm} physical palm link`);
        assert.ok(distance(j[arm+'Shoulder'],j[arm+'Palm'])<=37.391,`${label}/${arm} fixed palm is reachable without stretching`);
      }
      assert.deepEqual(fit.toolFrame,pose.toolFrame,`${label} tool contact and orientation remain unchanged`);
    }else{
      for(const arm of ['left','right']){
        for(const [a,b]of [['Elbow','Shoulder'],['Hand','Elbow']])near(vector(j[arm+a],j[arm+b]),vector(old[arm+a],old[arm+b]),`${label}/${arm} free ${a} vector`);
        if(j[arm+'Palm'])near(vector(j[arm+'Palm'],j[arm+'Hand']),mul(vector(j[arm+'Hand'],j[arm+'Elbow']),4.4/16),`${label}/${arm} free palm extends 4.4 beyond the wrist`);
      }
      if(pose.toolFrame){
        near(vector(fit.toolFrame.grip,j.rightHand),mul(vector(j.rightHand,j.rightElbow),4.4/16),`${label} free tool follows the enlarged right palm`);
        for(const key of Object.keys(pose.toolFrame))if(key!=='grip')assert.deepEqual(fit.toolFrame[key],pose.toolFrame[key],`${label} free tool ${key} retained`);
      }
    }
  }
  assert.equal(fitted,3726);assert.ok(fixed>2000);
});

test('fitting stays on the torso when a transition has blended screen joints and unblended anatomy',()=>{
  for(const direction of [1,3])for(const fraction of [0,.125,.25,.5,.75,.875,1]){
    const pose=sample('walk',.25,direction),from=sample('walk',.75,0);
    for(const key of ['hip','waist','neck','shoulder','head','leftShoulder','rightShoulder','leftElbow','rightElbow','leftHip','rightHip','leftKnee','rightKnee','leftHand','rightHand']){
      pose[key]={x:from[key].x+(pose[key].x-from[key].x)*fraction,y:from[key].y+(pose[key].y-from[key].y)*fraction};
    }
    const expected=paintedSocket(pose),fit=fitHearthkinProfile(pose),actual=fit[direction===1?'rightShoulder':'leftShoulder'];
    assert.ok(Math.hypot(expected.x-actual.x,expected.y-actual.y)<1e-7,'fitted shoulder comes from anatomical root, not stale blended screen root');
  }
});

function recordingContext(){
  let matrix=[1,0,0,1,0,0];const stack=[],draws=[];
  const finite=(...numbers)=>assert.ok(numbers.every(Number.isFinite),'renderer emits finite numeric geometry');
  const ctx={globalAlpha:1,
    save(){stack.push([...matrix]);},restore(){matrix=stack.pop();assert.ok(matrix,'balanced canvas transforms');},
    transform(a,b,c,d,e,f){finite(a,b,c,d,e,f);const[aa,bb,cc,dd,ee,ff]=matrix;matrix=[aa*a+cc*b,bb*a+dd*b,aa*c+cc*d,bb*c+dd*d,aa*e+cc*f+ee,bb*e+dd*f+ff];},
    translate(x,y){this.transform(1,0,0,1,x,y);},scale(x,y){this.transform(x,0,0,y,0,0);},
    rotate(a){this.transform(Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0);},
    beginPath(){},closePath(){},clip(){},fill(){},stroke(){},
    moveTo:finite,lineTo:finite,quadraticCurveTo:finite,bezierCurveTo:finite,
    rect:finite,fillRect:finite,strokeRect:finite,
    arc(...args){finite(...args.filter(arg=>typeof arg==='number'));},
    ellipse(...args){finite(...args.filter(arg=>typeof arg==='number'));},
    drawImage(image,x,y,width,height){finite(x,y,width,height,...matrix);draws.push({key:image.key,index:image.index,x,y,width,height,matrix:[...matrix]});},
  };
  return{ctx,draws};
}
function pointOnDraw(draw,u,v){
  const x=draw.x+u*draw.width,y=draw.y+v*draw.height,[a,b,c,d,e,f]=draw.matrix;
  return{x:a*x+c*y+e,y:b*x+d*y+f};
}
function recordingRig(type){
  const definition=CHARACTER_RIGS[type],art=definition.views?{...definition.views,props:HEARTHKIN_RIG_ART.props}:HEARTHKIN_RIG_ART;
  if(definition.mount)for(const [view,entry]of Object.entries(definition.mount.views))art['mount-'+view]=entry;
  const cache=new Map();
  return Object.assign(Object.create(HearthkinRig.prototype),{
    definition,art,armParts:definition.arms??HEARTHKIN_ARM_PARTS,handFrames:definition.hands??HEARTHKIN_HAND_PARTS,transitions:new WeakMap(),
    part(key,index){const k=`${key}/${index}`;if(!cache.has(k))cache.set(k,Array(4).fill({key,index}));return cache.get(k);},
  });
}

test('production draw uses the fitted Crown source socket across actions and transition cache reuse',()=>{
  const rig=recordingRig('villager'),unit={type:'villager',id:5};
  for(const state of Object.keys(crown.actions))for(const direction of [1,3])for(const phase of [0,.25,.5,.75,.9]){
    const {ctx,draws}=recordingContext();Object.assign(unit,{animationState:state,facing:direction});
    assert.ok(rig.draw(ctx,unit,{x:0,y:0},100,1,crown.actions[state].duration*phase));
    const side=direction===1?'right':'left',upper=HEARTHKIN_ARM_PARTS[views[direction]][side].upper;
    const sleeve=draws.find(d=>d.key===upper.key&&d.index===upper.index),torso=draws.find(d=>d.key==='profileTorsos');
    assert.ok(sleeve&&torso,'actual sleeve and replaced torso draw calls exist');
    const a=pointOnDraw(sleeve,...upper.root),b=pointOnDraw(torso,...sourceSocket(direction));
    assert.ok(distance(a,b)<=.2,`${state}/${direction}/${phase} drawn cuff chain begins at painted torso socket`);
  }
  for(const direction of [1,3]){
    Object.assign(unit,{animationState:'idle',facing:direction,animationTime:0,animClock:0});
    rig.draw(recordingContext().ctx,unit,{x:0,y:0},100);
    for(const t of [0,.02,.055,.09,.12]){
      Object.assign(unit,{animationState:'walk',animationTime:t,animClock:1+t});const {ctx,draws}=recordingContext();
      rig.draw(ctx,unit,{x:0,y:0},100);
      const side=direction===1?'right':'left',upper=HEARTHKIN_ARM_PARTS[views[direction]][side].upper;
      const a=pointOnDraw(draws.find(d=>d.key===upper.key&&d.index===upper.index),...upper.root);
      const b=pointOnDraw(draws.find(d=>d.key==='profileTorsos'),...sourceSocket(direction));
      near(a,b,'reused production transition cache does not accumulate fit offsets');
    }
  }
});

test('all eleven other identities render their own calibrated shoulder sockets without moving far shoulders',()=>{
  let identities=0,sockets=0;
  for(const[type,definition]of Object.entries(CHARACTER_RIGS)){
    if(type==='villager')continue;
    identities++;assert.ok(definition.surfaceCalibration,`${type} owns a source calibration`);
    const rig=recordingRig(type);
    for(let direction=0;direction<4;direction++)for(const phase of [0,.125,.25,.5,.75]){
      const time=definition.actions.walk.duration*phase,pose=definition.samplePose('walk',time,direction,{id:5,moving:true});
      const snapshot=structuredClone(pose),fit=fitCharacterSurfaces(pose,definition);
      assert.deepEqual(pose,snapshot,`${type} fitting leaves canonical sampling unchanged`);
      const{ctx,draws}=recordingContext();assert.ok(rig.draw(ctx,{type,id:5,animationState:'walk',facing:direction},{x:0,y:0},100,1,time));
      for(const side of ['left','right']){
        const upper=definition.arms[views[direction]][side].upper,draw=draws.find(d=>d.key===upper.key&&d.index===upper.index);
        assert.ok(draw,`${type}/${direction}/${side} upper arm is rendered`);
        const shoulder=fit[side+'Shoulder'],scale=definition.renderScale??1;
        near(pointOnDraw(draw,...upper.root),{x:shoulder.x*scale,y:shoulder.y*scale},`${type}/${direction}/${side} draws its fitted shoulder`);
        const nearSide=direction===1?'right':'left',socket=definition.surfaceCalibration.profileSockets[views[direction]];
        if(socket&&side===nearSide){
          const replacement=definition.views[views[direction]].overrides?.[1];
          const torso=draws.find(d=>d.key===(replacement?.key??views[direction])&&d.index===(replacement?.index??1));
          assert.ok(torso,`${type}/${direction} torso is rendered`);
          near(pointOnDraw(draw,...upper.root),pointOnDraw(torso,...socket),`${type}/${direction} shoulder aligns with its own painted socket`);
          sockets++;
        }else near(fit[side+'Shoulder'],pose[side+'Shoulder'],`${type}/${direction}/${side} uncalibrated shoulder remains at its canonical position`);
      }
    }
  }
  assert.equal(identities,11);assert.equal(sockets,110,'both authored profile sockets checked at five walk phases for every other identity');
});
