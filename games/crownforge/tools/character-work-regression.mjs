// Focused geometric evidence for the reported Hearthkin tool/work defects.
// These checks cannot certify painted anatomy or visual quality; review the
// actual production character in all four directions before acceptance.
import assert from 'node:assert/strict';
import { HEARTHKIN_ACTIONS, HearthkinRig, hearthkinPose, hearthkinHandFrame } from '../src/hearthkin-rig.js';
import { projectHearthkin } from '../src/hearthkin-locomotion.js';
import { equipmentGeometry } from '../src/character-equipment.js';

const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:(a.z??0)+(b.z??0)});
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:(a.z??0)-(b.z??0)});
const mul=(a,n)=>({x:a.x*n,y:a.y*n,z:(a.z??0)*n});
const dot=(a,b)=>a.x*b.x+a.y*b.y+(a.z??0)*(b.z??0);
const length=a=>Math.hypot(a.x,a.y,a.z??0);
const distance=(a,b)=>length(sub(a,b));
const screenDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const near=(a,b,tolerance,label)=>assert.ok(Math.abs(a-b)<=tolerance,`${label}: ${a} versus ${b} (tolerance ${tolerance})`);
const poseAt=(state,phase,direction=0)=>hearthkinPose(state,HEARTHKIN_ACTIONS[state].duration*phase,direction);
const geometryAt=(state,phase,direction=0)=>equipmentGeometry(poseAt(state,phase,direction).toolFrame,direction);
const phases=Array.from({length:81},(_,i)=>i/80);
const reports=[];
function check(name,fn) {
  try { fn(); reports.push({name,pass:true}); }
  catch(error) { reports.push({name,pass:false,message:error.message}); }
}
function samePoint(a,b,label,tolerance=1e-7) { near(distance(a,b),0,tolerance,label); }
function palm(joints,side) {
  const wrist=joints[`${side}Hand`],forearm=sub(wrist,joints[`${side}Elbow`]);
  return add(wrist,mul(forearm,3.65/length(forearm)));
}
function lineDistance(point,a,b,screen=false) {
  const delta=sub(b,a),relative=sub(point,a);
  if(screen) { delta.z=0;relative.z=0; }
  const t=dot(relative,delta)/dot(delta,delta);
  return {t,distance:length(sub(relative,mul(delta,t)))};
}
function headWidth(geometry,kind) {
  const points=geometry.faces.filter(face=>face.kind.startsWith(kind)).flatMap(face=>face.points);
  assert.ok(points.length,`${geometry.tool} has visible solid head surfaces`);
  return Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x));
}

check('Every view observes the same anatomical work, hands and solid tool',()=>{
  for(const state of ['construct','repair','demolish','gather_wood','gather_stone','gather_gold','field_work','attack','attack_anticipation','attack_contact','attack_recovery']) {
    for(const phase of phases) {
      const front=poseAt(state,phase,0),frontGeometry=equipmentGeometry(front.toolFrame,0);
      assert.ok(front.anatomical&&front.toolFrame,`${state} exposes anatomical joints and a tool frame`);
      for(let direction=0;direction<4;direction++) {
        const pose=poseAt(state,phase,direction),geometry=equipmentGeometry(pose.toolFrame,direction);
        for(const key of Object.keys(front.anatomical))samePoint(pose.anatomical[key],front.anatomical[key],`${state} ${phase} view ${direction} anatomical ${key}`);
        for(const key of ['grip','head','butt','shaft','edge','thicknessAxis','cuttingPoint'])samePoint(geometry.world[key],frontGeometry.world[key],`${state} ${phase} view ${direction} physical ${key}`);
        for(const key of ['grip','head','butt','cuttingPoint'])samePoint(geometry[key],projectHearthkin(geometry.world[key],direction),`${state} projected ${key}`);
        for(const axis of ['shaft','edge','thicknessAxis'])near(length(geometry.world[axis]),1,1e-7,`${state} ${axis} is a unit vector`);
        near(dot(geometry.world.shaft,geometry.world.edge),0,1e-7,`${state} shaft and working direction are orthogonal`);
        samePoint(geometry.world.grip,palm(pose.anatomical,'right'),`${state} primary tool grip is in the anatomical palm`);
        assert.ok(geometry.faces.length>0,`${state} direction ${direction} retains visible solid equipment`);
        for(const face of geometry.faces) {
          assert.ok(face.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.depth)),`${state} tool face is finite`);
          near(length(face.normal),1,1e-6,`${state} equipment face normal is valid`);
        }
      }
    }
  }
});

check('Anatomical elbows keep their lengths while front/back forearms foreshorten',()=>{
  let shortened=false;
  for(const state of ['construct','repair','gather_wood','gather_stone','field_work','attack'])for(const phase of phases)for(let direction=0;direction<4;direction++) {
    const p=poseAt(state,phase,direction),j=p.anatomical;
    for(const side of ['left','right']) {
      for(const [start,end,expected] of [['Shoulder','Elbow',17],['Elbow','Hand',16]]) {
        near(distance(j[side+start],j[side+end]),expected,1e-5,`${state} ${phase} ${side} ${start}-${end} anatomical length`);
        const projected=screenDistance(p[side+start],p[side+end]);
        assert.ok(projected<=expected+1e-6,`${state} projection cannot stretch ${side} ${start}-${end}`);
        if((direction===0||direction===2)&&end==='Hand'&&projected<expected*.8)shortened=true;
      }
      assert.ok(distance(j[side+'Shoulder'],j[side+'Hand'])<33,`${state} ${phase} wrist is within two-bone reach`);
    }
  }
  assert.ok(shortened,'front/back work must actually contain foreshortened forearms, not a forced constant 2D length');
});

check('Front/back building and repair hammer move down and forward from wind-up to contact',()=>{
  for(const state of ['construct','repair','demolish'])for(const direction of [0,2]) {
    const raised=geometryAt(state,.4,direction),hit=geometryAt(state,.6,direction);
    assert.equal(hit.tool,'hammer');
    assert.ok(hit.world.grip.y<raised.world.grip.y-15,`${state} right hand descends into the strike`);
    // Wrist advance may be small in a hinged tool stroke; the head and
    // working face below must still travel substantially toward the work.
    assert.ok(hit.world.grip.z>raised.world.grip.z,`${state} right hand advances toward work in front of the actor`);
    assert.ok(hit.world.cuttingPoint.y<raised.world.cuttingPoint.y-30,`${state} hammer's working end strikes downward`);
    assert.ok(hit.world.cuttingPoint.z>raised.world.cuttingPoint.z+25,`${state} hammer's working end strikes forward`);
    assert.ok(hit.world.edge.y<-.5,`${state} striking face points into the downward blow`);
    for(const phase of [.4,.45,.5,.55,.6]) {
      const p=poseAt(state,phase,direction);
      assert.ok(p.anatomical.rightElbow.x>0,`${state} right elbow does not turn through the body's midline`);
    }
    const earlier=geometryAt(state,.55,direction),later=geometryAt(state,.65,direction);
    assert.ok(hit.world.cuttingPoint.y<earlier.world.cuttingPoint.y&&hit.world.cuttingPoint.y<later.world.cuttingPoint.y,`${state} physical contact is the stroke's low point at .6`);
  }
});

check('Walking/idle front and back expose axe thickness while profiles expose the blade',()=>{
  for(const state of ['walk','idle'])for(const phase of phases) {
    const views=[0,1,2,3].map(direction=>geometryAt(state,phase,direction));
    const widths=views.map(geometry=>headWidth(geometry,'axe-head'));
    for(const direction of [0,2]) {
      assert.ok(widths[direction]<Math.min(widths[1],widths[3])*.3,`${state} ${phase} direction ${direction}: edge-on axe width ${widths[direction]} versus profiles ${widths[1]}, ${widths[3]}`);
      near(widths[direction],views[direction].headThickness,.02,`${state} head-on width is actual head thickness`);
    }
    near(widths[0],widths[2],1e-6,'front and back see the same axe thickness');
    near(widths[1],widths[3],1e-6,'opposite profiles see the same physical axe width');
  }
});

check('Front/back wood chopping uses one sagittal cutting plane and a downward-forward contact',()=>{
  for(const direction of [0,2]) {
    const raised=geometryAt('gather_wood',.4,direction),hit=geometryAt('gather_wood',.6,direction);
    assert.equal(hit.tool,'axe');
    assert.ok(hit.world.cuttingPoint.y<raised.world.cuttingPoint.y-35,'chopping cutting edge descends from wind-up');
    assert.ok(hit.world.cuttingPoint.z>raised.world.cuttingPoint.z+30,'chopping cutting edge travels into work ahead of the actor');
    assert.ok(hit.world.edge.y<-.7,'axe cutting edge, not its poll, meets the downward stroke');
    for(const phase of phases) {
      const g=geometryAt('gather_wood',phase,direction);
      near(g.world.shaft.x,0,1e-7,'chopping shaft stays in its sagittal swing plane');
      near(g.world.edge.x,0,1e-7,'chopping cutting direction stays in the same swing plane');
    }
  }
});

check('Striking faces point down/forward and cutting points do not retract before contact',()=>{
  for(const state of ['construct','repair','demolish','gather_wood','gather_stone','gather_gold'])for(const direction of [0,2]) {
    const hit=geometryAt(state,.6,direction);
    assert.ok(hit.world.edge.y<0&&hit.world.edge.z>0,`${state}: the working edge points downward and forward at contact`);
    let previous=geometryAt(state,.4,direction);
    for(let i=1;i<=40;i++) {
      const phase=.4+i*.005,current=geometryAt(state,phase,direction);
      assert.ok(current.world.cuttingPoint.z>=previous.world.cuttingPoint.z-.0001,`${state} ${phase}: cutting point retracts before contact (${previous.world.cuttingPoint.z} → ${current.world.cuttingPoint.z})`);
      previous=current;
    }
  }
});

check('Hoe blade is transverse, touches soil, pulls toward the body, and lifts for return',()=>{
  for(let direction=0;direction<4;direction++) {
    for(const phase of phases) {
      const g=geometryAt('field_work',phase,direction);
      assert.equal(g.tool,'hoe');
      assert.ok(g.world.shaft.y<0&&g.world.shaft.z>0,'hoe shaft runs down and forward from the hands');
      assert.ok(g.world.edge.y<0&&g.world.edge.z<0,'hoe blade faces down and toward the worker, not backwards');
    }
    const extended=geometryAt('field_work',.4,direction),pulled=geometryAt('field_work',.7,direction);
    assert.ok(pulled.world.cuttingPoint.z<extended.world.cuttingPoint.z-3,'working hoe blade pulls toward the body through soil');
    for(const phase of [.4,.5,.6,.7])near(geometryAt('field_work',phase,direction).world.cuttingPoint.y,0,.15,`hoe ground contact throughout pull at ${phase}`);
    assert.ok(geometryAt('field_work',.15,direction).world.cuttingPoint.y>2,'outward return clears the soil');
    assert.ok(geometryAt('field_work',.9,direction).world.cuttingPoint.y>2,'hoe lifts after the pull');
    samePoint(geometryAt('field_work',1-1e-6,direction).world.cuttingPoint,geometryAt('field_work',1e-6,direction).world.cuttingPoint,'hoe recovery arc stays continuous across the loop',.01);
  }
  for(const phase of phases) {
    const widths=[0,1,2,3].map(direction=>headWidth(geometryAt('field_work',phase,direction),'hoe-blade'));
    assert.ok(Math.min(widths[0],widths[2])>Math.max(widths[1],widths[3])*1.8,'transverse hoe blade is broad in front/back and foreshortened in profiles');
  }
});

check('Both anatomical palms stay on the finite two-handed tool shaft',()=>{
  for(const state of ['field_work','gather_wood','gather_stone','gather_gold'])for(const phase of phases) {
    const p=poseAt(state,phase),g=equipmentGeometry(p.toolFrame,0);
    const secondary=palm(p.anatomical,'left'),line=lineDistance(secondary,g.world.butt,g.world.head);
    assert.ok(line.distance<.15,`${state} ${phase} secondary anatomical palm is off the shaft by ${line.distance}`);
    assert.ok(line.t>=0&&line.t<=1,`${state} ${phase} secondary anatomical palm lies beyond the finite handle (fraction ${line.t})`);
  }
});

// A recording Canvas context exercises actual production draw ordering and
// source hand transforms. It does not infer painter order from source text.
function capture(state,phase,direction) {
  let matrix=[1,0,0,1,0,0],path=[];
  const stack=[],events=[];
  const apply=(x,y)=>({x:matrix[0]*x+matrix[2]*y+matrix[4],y:matrix[1]*x+matrix[3]*y+matrix[5]});
  const ctx={globalAlpha:1,
    save(){stack.push([...matrix]);},restore(){matrix=stack.pop();},
    translate(x,y){matrix[4]+=matrix[0]*x+matrix[2]*y;matrix[5]+=matrix[1]*x+matrix[3]*y;},
    scale(x,y){matrix[0]*=x;matrix[1]*=x;matrix[2]*=y;matrix[3]*=y;},
    rotate(angle){const[a,b,c,d,e,f]=matrix,cos=Math.cos(angle),sin=Math.sin(angle);matrix=[a*cos+c*sin,b*cos+d*sin,-a*sin+c*cos,-b*sin+d*cos,e,f];},
    transform(a,b,c,d,e,f){const[A,B,C,D,E,F]=matrix;matrix=[A*a+C*b,B*a+D*b,A*c+C*d,B*c+D*d,A*e+C*f+E,B*e+D*f+F];},
    beginPath(){path=[];},moveTo(x,y){path.push(apply(x,y));},lineTo(x,y){path.push(apply(x,y));},closePath(){},rect(){},clip(){},
    fill(){events.push({kind:'tool-face',points:path.map(p=>({...p}))});},stroke(){},
    drawImage(image,x,y,width,height){events.push({kind:'art',image,x,y,width,height,matrix:[...matrix]});},
  };
  const rig=Object.assign(Object.create(HearthkinRig.prototype),{part(key,index){return Array(4).fill({key,index});}});
  const time=HEARTHKIN_ACTIONS[state].duration*phase;
  assert.ok(rig.draw(ctx,{animationState:state,facing:direction},{x:0,y:0},100,1,time),'production rig draws the requested work');
  return events;
}
function renderedHandPoint(draw,uv) {
  const[a,b,c,d,e,f]=draw.matrix,x=draw.x+draw.width*uv[0],y=draw.y+draw.height*uv[1];
  return {x:a*x+c*y+e,y:b*x+d*y+f};
}

check('Both painted hand grips, not just anatomical targets, enclose the rendered shaft',()=>{
  for(const state of ['field_work','gather_wood','gather_stone','gather_gold'])for(let direction=0;direction<4;direction++)for(const phase of [0,.2,.4,.5,.6,.7,.85]) {
    const p=poseAt(state,phase,direction),g=equipmentGeometry(p.toolFrame,direction),events=capture(state,phase,direction);
    const faces=events.filter(event=>event.kind==='tool-face');
    assert.equal(faces.length,g.faces.length,'all tool faces are rendered through the production solid-equipment path');
    const offset=sub(faces[0].points[0],g.faces[0].points[0]);
    const head=add(g.head,offset),butt=add(g.butt,offset),grip=add(g.grip,offset);
    for(const [side,left] of [['right',false],['left',true]]) {
      const frame=hearthkinHandFrame(p,left),hand=events.find(event=>event.kind==='art'&&event.image.key===frame.key&&event.image.index===frame.index);
      assert.ok(hand,`${state} ${direction} ${side} hand artwork is actually drawn`);
      const actual=renderedHandPoint(hand,frame.grip);
      if(side==='right')near(screenDistance(actual,grip),0,.02,`${state} primary painted grip encloses the rendered handle`);
      else {
        const line=lineDistance(actual,butt,head,true);
        assert.ok(line.distance<=g.scale,`${state} ${phase} view ${direction}: secondary painted palm misses rendered shaft by ${line.distance} (allowed shaft radius ${g.scale})`);
        assert.ok(line.t>=0&&line.t<=1,`${state} ${phase} view ${direction}: secondary painted grip lies beyond the rendered finite handle (${line.t})`);
      }
    }
  }
});

check('Back-facing hoe stays physically ahead of the torso and is overdrawn by the torso',()=>{
  for(const phase of phases) {
    const p=poseAt('field_work',phase,2),g=equipmentGeometry(p.toolFrame,2),j=p.anatomical;
    // Conservative trunk volume: only shaft points between waist and neck,
    // within the body's half-width, require forward depth clearance.
    for(let i=0;i<=40;i++) {
      const q=add(g.world.butt,mul(sub(g.world.head,g.world.butt),i/40));
      if(q.y<j.waist.y||q.y>j.neck.y||Math.abs(q.x)>12.5)continue;
      const t=(q.y-j.waist.y)/(j.neck.y-j.waist.y),bodyZ=j.waist.z+(j.neck.z-j.waist.z)*t;
      assert.ok(q.z>bodyZ+5+g.scale,`hoe shaft enters torso volume at phase ${phase}`);
    }
  }
  for(const phase of [0,.2,.4,.6,.8]) {
    const events=capture('field_work',phase,2),lastFace=events.findLastIndex(event=>event.kind==='tool-face');
    const torso=events.findIndex(event=>event.kind==='art'&&event.image.key==='back'&&event.image.index===1);
    const coat=events.findIndex(event=>event.kind==='art'&&event.image.key==='back'&&event.image.index===2);
    assert.ok(lastFace>=0&&torso>lastFace&&coat>lastFace,'actual back body/coat drawing must cover the forward tool, never show it through the character');
  }
});

for(const result of reports)console.log(`${result.pass?'PASS':'FAIL'}: ${result.name}${result.pass?'':`\n  ${result.message}`}`);
const failed=reports.filter(result=>!result.pass);
console.log(`${reports.length-failed.length}/${reports.length} focused work/equipment checks passed. Full four-view visual review remains required.`);
if(failed.length)process.exitCode=1;
