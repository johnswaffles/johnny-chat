import ashenHearthkin from './surface-calibration/ashen-hearthkin.js?v=20260905-rosterfit1';
import crownMilitary from './surface-calibration/crown-military.js?v=20260905-rosterfit1';
import ashenMilitary from './surface-calibration/ashen-military.js?v=20260905-rosterfit1';
import mounted from './surface-calibration/mounted.js?v=20260905-rosterfit1';

export const CHARACTER_SURFACE_CALIBRATIONS={...ashenHearthkin,...crownMilitary,...ashenMilitary,...mounted};
const normalize=(point,rect)=>[(point[0]-rect[0])/rect[2],(point[1]-rect[1])/rect[3]];
const absolute=(point,rect)=>[rect[0]+point[0]*rect[2],rect[1]+point[1]*rect[3]];

// Clone surfaces first: several identities share a hand atlas but have
// different armor, wrist widths and palm reach. Never mutate those exports.
export function calibrateCharacterSurfaces(definition) {
  const calibration=CHARACTER_SURFACE_CALIBRATIONS[definition.id];
  if(!calibration)return definition;
  const views=structuredClone(definition.views),arms=structuredClone(definition.arms),hands=structuredClone(definition.hands);
  for(const [view,sides] of Object.entries(calibration.views))for(const [side,fit] of Object.entries(sides)) {
    const hand=hands[view][side],art=views[hand.key],rect=art.parts[hand.index];
    const grip=absolute(hand.grip,rect);
    hand.root=normalize(fit.hand.root,rect);hand.grip=normalize(grip,rect);
    hand.width=fit.hand.width;hand.palmLength=fit.hand.palmLength;
    const lateral=(hand.grip[0]-hand.root[0])*hand.width;
    hand.height=Math.sqrt(Math.max(.001,hand.palmLength**2-lateral**2))/(hand.grip[1]-hand.root[1]);
    // Retain proximal pixels for diagonally authored wrists. The renderer
    // clips against the actual wrist plane, so a horizontal crop cannot
    // cut a triangular hole into the joint or expose a duplicate bracer.
    hand.clipAtWrist=true;
    art.anchors??={};art.anchors[hand.index]={root:hand.root,grip:hand.grip};
    const chain=arms[view][side];chain.sleeveOverForearm=fit.sleeveOverForearm;
    for(const segment of ['upper','lower']) {
      const part=chain[segment],surface=views[part.key],oldRect=surface.parts[part.index];
      const spec=fit[segment]??{},root=spec.root??absolute(part.root,oldRect),tip=spec.tip??absolute(part.tip,oldRect);
      const newRect=spec.endY?[oldRect[0],oldRect[1],oldRect[2],spec.endY-oldRect[1]]:oldRect;
      surface.parts[part.index]=newRect;part.root=normalize(root,newRect);part.tip=normalize(tip,newRect);
      if(spec.width!==undefined)part.width=spec.width;
      if(spec.sourceClip) {
        surface.sourceClips??={};surface.sourceClips[part.index]=structuredClone(spec.sourceClip);
      }
      if(segment==='lower')part.clipAtWrist=true;
      surface.anchors??={};surface.anchors[part.index]={root:part.root,tip:part.tip};
    }
  }
  const profileSockets={};
  for(const [view,point] of Object.entries(calibration.profileSockets)) {
    const replacement=views[view].overrides?.[1];
    const rect=replacement?views[replacement.key].parts[replacement.index]:views[view].parts[1];
    profileSockets[view]=normalize(point,rect);
  }
  return {...definition,views,arms,hands,surfaceCalibration:{profileSockets}};
}
