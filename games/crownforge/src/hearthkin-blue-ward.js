// Transparent sphere rendered from the approved blue Blender ward, without its owner.
let texture;
export function blueWardReadiness() {
  if (!texture && typeof Image !== 'undefined') {
    texture = new Image();
    texture.src = new URL('../assets/hearthkin-blue-ward-v1.png', import.meta.url).href;
  }
  return texture ? [texture] : [];
}
export function drawBlueWard(ctx, unit, anchor, size, time, behind = false, reducedMotion = false) {
  if (!(unit.lastLightWardTimer > 0) || !(size > 0)) return;
  blueWardReadiness();
  const impact = Math.max(0, Math.min(1, (unit.wardBlockedPulse ?? 0) / .42));
  const pulse = reducedMotion ? 0 : Math.sin(time * .0028 + (unit.id ?? 0)) * .015;
  const rx = size * (.39 + pulse + impact * .035), ry = size * .59;
  const x = anchor.x, y = anchor.y - size * .48;
  ctx.save();
  // The back pass sits behind the body; the lighter front veil preserves readability.
  ctx.globalAlpha *= behind ? .9 : .7 + impact * .25;
  if (texture?.complete && texture.naturalWidth) {
    // Rendered sphere fills 89% of the source height and 89% of its width.
    ctx.drawImage(texture, x - rx / .89, y - ry / .89, rx * 2 / .89, ry * 2 / .89);
  } else {
    const glow = ctx.createRadialGradient(x, y, size * .15, x, y, size * .64);
    glow.addColorStop(0, 'rgba(65,150,255,0)');
    glow.addColorStop(.75, 'rgba(80,170,255,.16)');
    glow.addColorStop(1, 'rgba(130,205,255,.38)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}
