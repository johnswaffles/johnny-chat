import { projectHearthkin } from './hearthkin-locomotion.js?v=20260904-rosterkin1';

// Equipment is solid in the same anatomical space as its owner. A blade
// viewed down its plane exposes its bevel and thickness, not a flipped icon.
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const add = (a, b) => v(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a, b) => v(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a, n) => v(a.x * n, a.y * n, a.z * n);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const unit = a => mul(a, 1 / Math.max(.000001, Math.hypot(a.x, a.y, a.z)));
const center = points => mul(points.reduce(add, v()), 1 / points.length);
const mix = (a, b, t) => add(mul(a, 1 - t), mul(b, t));
const TAU = Math.PI * 2;
const PALETTE = {
  wood: [149, 99, 51], heartwood: [108, 68, 35], endgrain: [166, 119, 66],
  steel: [134, 146, 142], darkSteel: [70, 83, 81], edge: [192, 207, 201],
  leather: [76, 54, 34], brass: [167, 132, 70],
};

let materialImage=null,materialTiles=null;
export function equipmentReadiness() {
  if(!materialImage&&typeof Image!=='undefined') {
    materialImage=new Image();
    materialImage.src=new URL('../assets/characters-v3/shared/equipment-materials.png',import.meta.url).href;
  }
  return materialImage?[materialImage]:[];
}
function textures() {
  equipmentReadiness();
  if(materialTiles)return materialTiles;
  if(!materialImage?.complete||!materialImage.naturalWidth||typeof document==='undefined')return null;
  materialTiles=Array.from({length:4},(_,index)=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d'),w=materialImage.naturalWidth/2,h=materialImage.naturalHeight/2;
    ctx.drawImage(materialImage,index%2*w,Math.floor(index/2)*h,w,h,0,0,256,256);
    return canvas;
  });
  return materialTiles;
}

function textureFace(ctx,face,direction,offset,tiles) {
  if(!tiles||!ctx.createPattern)return;
  const tile=tiles[{wood:0,heartwood:0,endgrain:0,steel:1,darkSteel:1,edge:1,brass:2,leather:3}[face.material]??1];
  const pattern=ctx.createPattern(tile,'repeat');
  if(!pattern)return;
  const origin=face.world[0],u=unit(sub(face.world[1],origin)),w=unit(cross(face.normal,u));
  const up=projectHearthkin(u,direction),wp=projectHearthkin(w,direction),anchor=face.points[0];
  const uv=face.world.map(p=>({u:dot(sub(p,origin),u),v:dot(sub(p,origin),w)}));
  const minU=Math.min(...uv.map(p=>p.u)),maxU=Math.max(...uv.map(p=>p.u));
  const minV=Math.min(...uv.map(p=>p.v)),maxV=Math.max(...uv.map(p=>p.v));
  ctx.save();ctx.clip();
  ctx.transform(up.x/8,up.y/8,wp.x/8,wp.y/8,anchor.x+offset.x,anchor.y+offset.y);
  ctx.globalAlpha*=face.material==='wood'||face.material==='heartwood'?.58:.38;
  ctx.globalCompositeOperation='soft-light';ctx.fillStyle=pattern;
  ctx.fillRect(minU*8-1,minV*8-1,(maxU-minU)*8+2,(maxV-minV)*8+2);
  ctx.restore();
}

const colour = (material, light, variation = 0) => {
  const base = PALETTE[material] ?? PALETTE.steel;
  return `rgb(${base.map(c => Math.round(Math.max(0, Math.min(255, c * light + variation)))).join(',')})`;
};

/**
 * Project a held tool. The frame's grip is its actual hand attachment;
 * shaft points toward the head and edge gives the working face direction.
 * Faces retain world vertices and normals for geometry/occlusion checks.
 */
export function equipmentGeometry(frame, direction = 0) {
  const tool = frame?.tool;
  if (!tool) return { faces: [], tool: null };
  const scale = Math.max(.01, frame.scale ?? 1);
  const shaft = unit(frame.shaft ?? v(0, -1, 0));
  const edgeInput = frame.edge ?? v(0, 0, -1);
  const rejectedEdge = sub(edgeInput, mul(shaft, dot(edgeInput, shaft)));
  const fallback = Math.abs(shaft.y) < .9 ? v(0, 1, 0) : v(0, 0, 1);
  const edge = unit(Math.hypot(rejectedEdge.x, rejectedEdge.y, rejectedEdge.z) > .00001
    ? rejectedEdge : sub(fallback, mul(shaft, dot(fallback, shaft))));
  const thicknessAxis = unit(cross(shaft, edge));
  const grip = frame.grip ?? v();
  const gripFraction = Math.max(0, Math.min(1, frame.gripFraction ?? .8));
  const length = frame.length ?? 33 * scale;
  const head = add(grip, mul(shaft, length * gripFraction));
  const butt = sub(grip, mul(shaft, length * (1 - gripFraction)));
  const faceList = [];
  let serial = 0;
  const depthVector = unit(v(projectHearthkin(v(1, 0, 0), direction).depth,
    projectHearthkin(v(0, 1, 0), direction).depth, projectHearthkin(v(0, 0, 1), direction).depth));
  const horizontal = [v(-1), v(0, 0, 1), v(1), v(0, 0, -1)][direction];
  const screenUp = cross(horizontal, depthVector);
  const lightDirection = unit(add(mul(horizontal, -.5), add(mul(screenUp, .9), mul(depthVector, .75))));
  const local = (a, b = 0, c = 0) => add(grip, add(mul(shaft, a * scale), add(mul(edge, b * scale), mul(thicknessAxis, c * scale))));
  const headA = length / scale * gripFraction;
  const buttA = -length / scale * (1 - gripFraction);

  const face = (world, material, outward, kind, details = []) => {
    if (world.length < 3) return;
    let normal = unit(cross(sub(world[1], world[0]), sub(world[2], world[0])));
    if (outward && dot(normal, outward) < 0) { world = [...world].reverse(); normal = mul(normal, -1); }
    // Opaque convex surfaces facing away cannot contribute to this view.
    if (dot(normal, depthVector) <= .000001) return;
    const points = world.map(p => projectHearthkin(p, direction));
    const illumination = .61 + Math.max(0, dot(normal, lightDirection)) * .52;
    faceList.push({
      id: `${tool}:${kind}:${serial++}`, kind, material, world, points, normal,
      depth: points.reduce((sum, p) => sum + p.depth, 0) / points.length,
      fill: colour(material, illumination),
      stroke: material === 'edge' ? 'rgba(213,222,209,.52)' : 'rgba(27,32,27,.38)',
      lineWidth: (material === 'edge' ? .16 : .2) * scale,
      details: details.map(detail => ({ ...detail, points: detail.world.map(p => projectHearthkin(p, direction)) })),
    });
  };

  // An eight-sided shaft has an actual round cross section. Grain follows
  // each visible face, so it is covered naturally by a hand, band, or head.
  const prism = (origin, axis, u, w, start, end, radiusStart, radiusEnd, material, kind, grain = false, sides = 8) => {
    const at = (t, angle, radius) => add(origin, add(mul(axis, t), add(mul(u, Math.cos(angle) * radius), mul(w, Math.sin(angle) * radius))));
    const ring0 = [], ring1 = [];
    for (let i = 0; i < sides; i++) {
      ring0.push(at(start, i * TAU / sides, radiusStart));
      ring1.push(at(end, i * TAU / sides, radiusEnd));
    }
    for (let i = 0; i < sides; i++) {
      const next = (i + 1) % sides;
      const normal = add(mul(u, Math.cos((i + .5) * TAU / sides)), mul(w, Math.sin((i + .5) * TAU / sides)));
      const world = [ring0[i], ring0[next], ring1[next], ring1[i]];
      const details = grain ? [.28, .69].map((t, line) => ({
        world: [mix(mix(world[0], world[1], t), mix(world[3], world[2], t), .08 + line * .13),
          mix(mix(world[0], world[1], t + .025), mix(world[3], world[2], t - .04), .52),
          mix(mix(world[0], world[1], t - .025), mix(world[3], world[2], t + .02), .91 - line * .09)],
        colour: line ? 'rgba(220,170,96,.3)' : 'rgba(58,35,18,.36)', width: .14 * scale,
      })) : [];
      face(world, material, normal, kind, details);
    }
    face([...ring0].reverse(), material === 'wood' ? 'endgrain' : material, mul(axis, -1), `${kind}-butt`);
    face(ring1, material === 'wood' ? 'endgrain' : material, axis, `${kind}-end`);
  };
  const shaftPrism = (start, end, r0, r1, material, kind, grain = false) =>
    prism(grip, shaft, edge, thicknessAxis, start * scale, end * scale, r0 * scale, r1 * scale, material, kind, grain);

  // Bevelled plate in any tool-local plane. A narrow rim joins its front
  // and back; it remains visible when the broad faces are edge-on.
  const plate = (polygon, normal, halfThickness, material, kind, bevel = .12) => {
    const centroid = center(polygon);
    const ring = polygon.map(p => mix(p, centroid, bevel));
    const front = ring.map(p => add(p, mul(normal, halfThickness)));
    const back = ring.map(p => sub(p, mul(normal, halfThickness)));
    face(front, material, normal, `${kind}-face`);
    face(back, material, mul(normal, -1), `${kind}-back`);
    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      const rim = [polygon[i], polygon[j]];
      const outward = sub(mix(rim[0], rim[1], .5), centroid);
      face([front[i], front[j], rim[1], rim[0]], 'edge', add(normal, unit(outward)), `${kind}-bevel`);
      face([rim[0], rim[1], back[j], back[i]], 'darkSteel', add(mul(normal, -1), unit(outward)), `${kind}-reverse-bevel`);
    }
  };

  const handleEnd = tool === 'sword' ? 3 : headA + 1.4;
  shaftPrism(buttA, handleEnd, .73, tool === 'spear' ? .69 : .92, 'wood', 'handle', true);
  shaftPrism(buttA, buttA + .58, .81, .81, 'heartwood', 'handle-end');
  // Three leather wraps around the grip, rather than screen-painted bands.
  for (let i = 0; i < 3; i++) {
    const a = -1.8 + i * 1.3;
    shaftPrism(a, a + .65, .88, .88, 'leather', 'grip-wrap');
  }

  let cuttingPoint = head;
  let headThickness = 0;
  if (tool === 'axe') {
    const outline = [[-1.15, 1.8], [1.9, 1.8], [6.6, 3.1], [7.1, 2.6],
      [6.6, -3.8], [4.7, -4.7], [3.1, -1.3], [-1.15, -1.6]];
    plate(outline.map(([b, a]) => local(headA + a, b)), thicknessAxis, .69 * scale, 'steel', 'axe-head', .085);
    shaftPrism(headA - 1.6, headA + 1.8, 1.28, 1.28, 'darkSteel', 'axe-eye');
    cuttingPoint = local(headA - .55, 6.9);
    headThickness = 1.38 * scale;
  } else if (tool === 'hammer') {
    // The mallet crossbar follows the striking vector. Its circular ends
    // face the viewer in the front/back views rather than showing its side.
    prism(head, edge, shaft, thicknessAxis, -5.2 * scale, 5.2 * scale, 3.55 * scale, 3.55 * scale, 'wood', 'hammer-head', true);
    for (const b of [-3.65, 2.75]) prism(head, edge, shaft, thicknessAxis, b * scale, (b + .9) * scale, 3.7 * scale, 3.7 * scale, 'darkSteel', 'hammer-band');
    // The working face has a shallow burnished rim, leaving wood grain.
    prism(head, edge, shaft, thicknessAxis, 5.19 * scale, 5.34 * scale, 3.56 * scale, 3.44 * scale, 'heartwood', 'hammer-striking-face');
    cuttingPoint = add(head, mul(edge, 5.34 * scale));
    headThickness = 7.4 * scale;
  } else if (tool === 'pick') {
    const outline = [[-11, -3.2], [-7, .35], [-2, 1.65], [2, 1.65], [7, .35], [11, -3.2],
      [6.3, -.85], [1.65, -.5], [-1.65, -.5], [-6.3, -.85]];
    plate(outline.map(([b, a]) => local(headA + a, b)), thicknessAxis, .7 * scale, 'steel', 'pick-head', .105);
    shaftPrism(headA - 1.3, headA + 1.6, 1.36, 1.36, 'darkSteel', 'pick-eye');
    cuttingPoint = local(headA - 3.2, 11);
    headThickness = 1.4 * scale;
  } else if (tool === 'hoe') {
    // Hoe blade width runs across the worker, while its sharp edge points
    // down/back along frame.edge. It is a different plane from an axe.
    const outline = [[.6, -1.15], [.6, 1.15], [2.4, 4.5], [6.2, 5.05], [6.2, -5.05], [2.4, -4.5]];
    plate(outline.map(([b, c]) => local(headA, b, c)), shaft, .28 * scale, 'steel', 'hoe-blade', .08);
    shaftPrism(headA - 1.45, headA + .75, 1.13, 1.13, 'darkSteel', 'hoe-eye');
    cuttingPoint = local(headA, 6.2);
    headThickness = .56 * scale;
  } else if (tool === 'sword') {
    const outline = [[-1.5, 3.4], [-1.9, 5.2], [-1.15, headA - 4], [0, headA],
      [1.15, headA - 4], [1.9, 5.2], [1.5, 3.4]];
    plate(outline.map(([b, a]) => local(a, b)), thicknessAxis, .43 * scale, 'steel', 'sword-blade', .38);
    prism(local(3.2), edge, shaft, thicknessAxis, -4.5 * scale, 4.5 * scale, .72 * scale, .72 * scale, 'brass', 'sword-guard', false, 6);
    shaftPrism(buttA, buttA + 1.1, 1.18, 1.18, 'brass', 'sword-pommel');
    cuttingPoint = head;
    headThickness = .86 * scale;
  } else if (tool === 'spear') {
    const outline = [[0, headA + 7.5], [2.15, headA], [1.1, headA - 4], [-1.1, headA - 4], [-2.15, headA]];
    plate(outline.map(([b, a]) => local(a, b)), thicknessAxis, .52 * scale, 'steel', 'spear-head', .35);
    shaftPrism(headA - 4.1, headA - 1.2, 1.05, .83, 'darkSteel', 'spear-socket');
    cuttingPoint = local(headA + 7.5);
    headThickness = 1.04 * scale;
  } else if (tool === 'mace') {
    shaftPrism(headA - 5.5, headA + 2, 1.8, 2.1, 'darkSteel', 'mace-core');
    for(let i=0;i<6;i++) {
      const radial=add(mul(edge,Math.cos(i*TAU/6)),mul(thicknessAxis,Math.sin(i*TAU/6)));
      const tangent=unit(cross(shaft,radial));
      const outline=[[-5,1.6],[-3.5,3.7],[.5,4.1],[2,2],[-.5,1.6]];
      plate(outline.map(([a,b])=>add(local(headA+a),mul(radial,b*scale))),tangent,.28*scale,'steel','mace-flange',.13);
    }
    shaftPrism(headA-5.9,headA-5.2,2.15,2.15,'brass','mace-collar');
    shaftPrism(headA+1.7,headA+2.6,2.1,.8,'steel','mace-crown');
    cuttingPoint=local(headA+2.6);headThickness=8.2*scale;
  } else if (tool === 'club') {
    shaftPrism(headA - 7, headA + 2.5, 2.1, 3.1, 'heartwood', 'club-head', true);
    shaftPrism(headA - 4.5, headA - 3.6, 2.48, 2.57, 'darkSteel', 'club-band');
    shaftPrism(headA + .6, headA + 1.45, 3.06, 3.15, 'darkSteel', 'club-band');
    cuttingPoint = local(headA + 2.5);
    headThickness = 6.3 * scale;
  }

  faceList.sort((a, b) => a.depth - b.depth);
  return {
    tool, scale, length, gripFraction, faces: faceList,
    grip: projectHearthkin(grip, direction), head: projectHearthkin(head, direction), butt: projectHearthkin(butt, direction),
    cuttingPoint: projectHearthkin(cuttingPoint, direction),
    cuttingDirection: projectHearthkin(edge, direction), thicknessAxis: projectHearthkin(thicknessAxis, direction),
    headThickness, world: { grip, head, butt, shaft, edge, thicknessAxis, cuttingPoint },
  };
}

function paintCharacterEquipment(ctx, frame, direction = 0, offset = { x: 0, y: 0 }) {
  const geometry = equipmentGeometry(frame, direction);
  const materials=textures();
  const ox = offset.x ?? 0, oy = offset.y ?? 0;
  for (const face of geometry.faces) {
    ctx.beginPath();
    face.points.forEach((point, index) => {
      if (index) ctx.lineTo(point.x + ox, point.y + oy);
      else ctx.moveTo(point.x + ox, point.y + oy);
    });
    ctx.closePath(); ctx.fillStyle = face.fill; ctx.fill();
    textureFace(ctx,face,direction,{x:ox,y:oy},materials);
    ctx.lineWidth = face.lineWidth; ctx.strokeStyle = face.stroke; ctx.stroke();
    for (const detail of face.details) {
      ctx.beginPath();
      detail.points.forEach((point, index) => {
        if (index) ctx.lineTo(point.x + ox, point.y + oy);
        else ctx.moveTo(point.x + ox, point.y + oy);
      });
      ctx.strokeStyle = detail.colour; ctx.lineWidth = detail.width; ctx.stroke();
    }
  }
  return geometry;
}


// At settlement scale many units share nearly identical tool orientations.
// Cache only the equipment surface, never a whole animated character. The
// exact grip remains live; enlarged inspection continues drawing full detail.
const equipmentCache=new Map();let equipmentCacheBytes=0;
export function drawCharacterEquipment(ctx,frame,direction=0,offset={x:0,y:0}) {
  const matrix=ctx.getTransform?.(),pixelScale=matrix?Math.max(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d)):Infinity;
  if(pixelScale>2.3||typeof document==='undefined'||!equipmentReadiness().every(i=>i.complete&&i.naturalWidth))return paintCharacterEquipment(ctx,frame,direction,offset);
  const quantize=v=>({x:Math.round(v.x*50)/50,y:Math.round(v.y*50)/50,z:Math.round(v.z*50)/50});
  const local={...frame,grip:{x:0,y:0,z:0},shaft:quantize(frame.shaft),edge:quantize(frame.edge)};
  const key=JSON.stringify([frame.tool,frame.scale,frame.length,frame.gripFraction,direction,local.shaft,local.edge]);
  let entry=equipmentCache.get(key);
  if(!entry) {
    const g=equipmentGeometry(local,direction),points=g.faces.flatMap(f=>f.points),padding=1.5;
    const minX=Math.min(...points.map(p=>p.x))-padding,minY=Math.min(...points.map(p=>p.y))-padding;
    const width=Math.max(...points.map(p=>p.x))-minX+padding,height=Math.max(...points.map(p=>p.y))-minY+padding;
    const image=document.createElement('canvas'),resolution=3;image.width=Math.ceil(width*resolution);image.height=Math.ceil(height*resolution);
    const paint=image.getContext('2d');paint.scale(resolution,resolution);paint.translate(-minX,-minY);paintCharacterEquipment(paint,local,direction);
    entry={image,minX,minY,width:image.width/resolution,height:image.height/resolution};equipmentCache.set(key,entry);
    equipmentCacheBytes+=image.width*image.height*4;
    while(equipmentCache.size>1024||equipmentCacheBytes>40*1024*1024) {const oldest=equipmentCache.keys().next().value,old=equipmentCache.get(oldest);equipmentCacheBytes-=old.image.width*old.image.height*4;equipmentCache.delete(oldest);}
  } else {equipmentCache.delete(key);equipmentCache.set(key,entry);}
  const grip=projectHearthkin(frame.grip,direction);
  ctx.drawImage(entry.image,grip.x+(offset.x??0)+entry.minX,grip.y+(offset.y??0)+entry.minY,entry.width,entry.height);
}
