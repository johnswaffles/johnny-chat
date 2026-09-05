import { projectHearthkin } from './hearthkin-locomotion.js';

const VIEWS=['front','right','back','left'];
const distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
const angle=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x);
const normalise=(p,r)=>[(p[0]-r[0])/r[2],(p[1]-r[1])/r[3]];

// Pixel landmarks inspected on the original, independently painted sheets.
// The profile socket lies inside the painted occipital/upper-neck overlap,
// behind the jaw. The rear head includes a long neck stub: its bottom is a
// NECK JOIN, not the invisible muzzle. Front sockets sit behind the face.
// Keeping these distinct avoids shrinking the rear skull to the projected
// length of its almost end-on muzzle axis.
export const HORSE_ASSEMBLY_LANDMARKS=Object.freeze({
  scout:{
    front:{poll:[133,82],muzzle:[134,310],headJoin:[133,154],neckBase:[383,308],neckJoin:[374,26],maneBase:[610,1491],maneJoin:[611,1206],headHeight:22,neckWidth:11,maneWidth:5},
    right:{poll:[144,76],muzzle:[225,222],headJoin:[87,130],neckDorsalBase:[291,242],headManeJoin:[67,95],neckBase:[359,271],neckJoin:[431,40],maneBase:[574,1481],maneJoin:[574,1203],neckWidth:22,maneWidth:8},
    back:{poll:[148,95],headJoin:[147,322],neckBase:[359,318],neckJoin:[359,43],maneBase:[576,1488],maneJoin:[575,1207],headHeight:22,neckWidth:12,maneWidth:7},
    left:{poll:[130,80],muzzle:[64,228],headJoin:[205,125],neckDorsalBase:[426,232],headManeJoin:[220,95],neckBase:[359,265],neckJoin:[296,43],maneBase:[573,1482],maneJoin:[573,1176],neckWidth:22,maneWidth:8},
  },
  ashenOutrider:{
    front:{poll:[137,97],muzzle:[137,328],headJoin:[137,181],neckBase:[390,319],neckJoin:[391,54],maneBase:[635,1496],maneJoin:[635,1240],headHeight:22,neckWidth:11.5,maneWidth:5},
    right:{poll:[144,90],muzzle:[221,277],headJoin:[72,150],neckDorsalBase:[325,270],headManeJoin:[62,95],neckBase:[365,265],neckJoin:[434,49],maneBase:[595,1487],maneJoin:[595,1215],neckWidth:23,maneWidth:8.5},
    back:{poll:[146,88],headJoin:[146,324],neckBase:[389,323],neckJoin:[389,52],maneBase:[623,1494],maneJoin:[623,1225],headHeight:22,neckWidth:12.5,maneWidth:7.5},
    left:{poll:[151,98],muzzle:[67,272],headJoin:[204,146],neckDorsalBase:[422,255],headManeJoin:[206,95],neckBase:[370,260],neckJoin:[338,77],maneBase:[581,1470],maneJoin:[580,1198],neckWidth:23,maneWidth:8.5},
  },
});

export function horseAssemblyPoint(transform,source) {
  const x=(source[0]-transform.root[0])*transform.width;
  const y=(source[1]-transform.root[1])*transform.height;
  const c=Math.cos(transform.angle),s=Math.sin(transform.angle);
  return {x:transform.origin.x+x*c-y*s,y:transform.origin.y+x*s+y*c};
}

// Fit two source attachments without letting foreshortening collapse the
// transverse volume. The slight width clamp is only needed during a fall
// when the two attachment points can overlap in the viewing plane.
function attachedTransform(rect,sourceBase,sourceTip,base,tip,width) {
  const root=normalise(sourceBase,rect),end=normalise(sourceTip,rect);
  const length=distance(base,tip),du=end[0]-root[0],dv=end[1]-root[1];
  width=Math.min(width,length*.96/Math.max(.001,Math.abs(du)));
  const sourceX=du*width;
  const sourceY=Math.sign(dv)*Math.sqrt(Math.max(1e-10,length*length-sourceX*sourceX));
  const height=sourceY/dv;
  return {origin:base,width,height,angle:angle(base,tip)-Math.atan2(sourceY,sourceX),root,sourceJoin:end,targetJoin:tip};
}

/** Draw parts 0/1/18 with the returned drawImage-style transforms.
 * Source PNGs stay unchanged. Bone lengths, collision and rider pose stay
 * unchanged. Neck and mane now follow the actual painted skull attachment.
 */
export function horseAssemblyTransforms(pose,horseArt,type) {
  const view=VIEWS[pose.direction],landmarks=HORSE_ASSEMBLY_LANDMARKS[type]?.[view];
  if(!landmarks)throw new RangeError(`No horse assembly landmarks for ${type}/${view}`);
  const h=pose.mount.projected,scale=pose.mount.scale,rect=horseArt.parts[0];
  const root=normalise(landmarks.poll,rect);
  let pixelScale,rotation;
  if(pose.sideView) {
    const source={x:landmarks.muzzle[0]-landmarks.poll[0],y:landmarks.muzzle[1]-landmarks.poll[1]};
    // Calibrate from the actual unforeshortened profile skull. Animation
    // rotates this volume; it never resizes the complete head from a short
    // screen projection as a horse turns/falls.
    const reference=projectHearthkin({x:0,y:-9/Math.hypot(9,16)*18*scale,z:16/Math.hypot(9,16)*18*scale},1);
    pixelScale=Math.hypot(reference.x,reference.y)/Math.hypot(source.x,source.y);
    rotation=angle(h.poll,h.muzzle)-Math.atan2(source.y,source.x);
  }else{
    pixelScale=landmarks.headHeight*scale/rect[3];
    const right=projectHearthkin(pose.mount.bodyFrame.right,pose.direction),sign=pose.direction===0?-1:1;
    rotation=Math.atan2(right.y*sign,right.x*sign);
  }
  const head={origin:h.poll,width:rect[2]*pixelScale,height:rect[3]*pixelScale,angle:rotation,root,sourceJoin:normalise(landmarks.headJoin,rect)};
  head.targetJoin=horseAssemblyPoint(head,head.sourceJoin);
  const neck=attachedTransform(horseArt.parts[1],landmarks.neckBase,landmarks.neckJoin,h.neckRoot,head.targetJoin,landmarks.neckWidth*scale);
  let maneBase=h.neckRoot,maneJoin=head.targetJoin;
  if(pose.sideView) {
    // Match the painted crest on each independent profile, rather than
    // offsetting the whole mane by a bounding-box width.
    maneBase=horseAssemblyPoint(neck,normalise(landmarks.neckDorsalBase,horseArt.parts[1]));
    maneJoin=horseAssemblyPoint(head,normalise(landmarks.headManeJoin,rect));
  }
  const mane=attachedTransform(horseArt.parts[18],landmarks.maneBase,landmarks.maneJoin,maneBase,maneJoin,landmarks.maneWidth*scale);
  return {0:head,1:neck,18:mane};
}
