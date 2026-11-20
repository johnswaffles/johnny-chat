// Each route begins at staff height and leads onto an existing upper ledge.
export const trails = [
  { name: 'The Stag', color: '#ffe2a0', stars: [[382, 524], [491, 432], [614, 399]],
    figure: [[-43,14],[-33,-6],[-9,-10],[8,-6],[18,-22],[12,-35],[1,-40],[11,-39],[8,-48],[18,-33],[22,-42],[20,-53],[25,-46],[31,-52],[26,-39],[25,-26],[41,-19],[31,-15],[22,-16],[13,2],[26,15],[39,13],[24,20],[5,9],[-16,6],[-34,22],[-49,24],[-36,17],[-30,4]] },
  { name: 'The Heron', color: '#a6f8e7', stars: [[2840, 509], [2950, 421], [3110, 367]],
    figure: [[-61,-20],[-35,-12],[-12,-9],[4,0],[18,-21],[33,-23],[47,-18],[30,-16],[15,7],[-5,12],[-25,7],[-49,17],[-26,-1],[-61,-20]] },
  { name: 'The Crown', color: '#ddc6ff', stars: [[5255, 514], [5375, 430], [5530, 373]],
    figure: [[-45,-18],[-23,0],[0,-32],[20,0],[43,-20],[31,22],[-32,22],[-45,-18]] }
];

const TAU = Math.PI * 2;

export function followTrails(game) {
  const player = game.player;
  for (const [index, trail] of trails.entries()) {
    const count = game.trailCounts[index];
    if (count === trail.stars.length) continue;
    const [x, y] = trail.stars[count];
    if (Math.abs(player.x - x) > 32 || Math.abs(player.y - 53 - y) > 42) continue;
    game.trailCounts[index]++;
    const complete = count + 1 === trail.stars.length;
    game.event('trail-note', { x, y, count, complete });
    if (complete) {
      game.arcade.score += 500;
      game.arcade.overdrive = Math.max(game.arcade.overdrive, 8);
      game.event('toast', { text: trail.name + ' awakened · +500 · Overdrive' });
    } else {
      game.numbers.push({ x, y: y - 18, text: trail.name + '  ' + (count + 1) + '/3', life: 1, color: trail.color });
    }
  }
}

function drawFigure(renderer, trail, x, y, scale) {
  const c = renderer.ctx;
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  c.strokeStyle = trail.color;
  c.lineWidth = 0.9;
  c.beginPath();
  for (const [i, point] of trail.figure.entries()) {
    if (i === 0) c.moveTo(...point);
    else c.lineTo(...point);
  }
  c.stroke();
  for (const [i, point] of trail.figure.entries()) {
    renderer.star(...point, i % 3 === 0 ? 3.6 : 1.7, trail.color);
  }
  c.restore();
}

// A shallow curtain of northern light. Bake the fine vertical folds once.
function paintAurora() {
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 150;
  const c = canvas.getContext('2d');
  for (let x = 0; x < canvas.width; x += 2) {
    const u = x / canvas.width;
    const hem = 88 + 24 * Math.sin(u * 10) + 10 * Math.sin(u * 29);
    const length = 43 + 22 * Math.sin(u * 13) + 9 * Math.sin(x * .7);
    const ramp = c.createLinearGradient(0, hem - length, 0, hem + 10);
    ramp.addColorStop(0, '#b59cf000');
    ramp.addColorStop(.76, '#8cbacf34');
    ramp.addColorStop(.87, '#a6f9df70');
    ramp.addColorStop(1, '#73d8cf00');
    c.globalAlpha = Math.sin(Math.PI * u) ** 2;
    c.fillStyle = ramp;
    c.fillRect(x, hem - length, 2, length + 10);
  }
  return canvas;
}

export function drawSealSky(r, game) {
  if (!game.checkpoint) return;
  const c = r.ctx;
  r.sealAurora ||= paintAurora();
  c.save();
  const drift = r.gentle ? 0 : Math.sin(r.time * .17) * 15;
  c.globalAlpha = .25 + .12 * game.checkpoint;
  c.drawImage(r.sealAurora, -r.w * .1 + drift, 78, r.w * 1.2, 150);
  c.globalAlpha = .82;
  for (let i = 0; i < game.checkpoint; i++) {
    const x = r.w * (.29 + i * .19) - r.camera * .009;
    drawFigure(r, trails[i], x, 166 - i * 15, .68);
  }
  c.restore();
}

export function drawStarTrails(r, game) {
  const c = r.ctx;
  for (const [index, trail] of trails.entries()) {
    const count = game.trailCounts[index];
    if (count === 3 || trail.stars[2][0] < r.camera - 50 || trail.stars[0][0] > r.camera + r.w + 50) continue;
    c.save();
    c.translate(-r.camera, 0);
    for (let i = count; i < 3; i++) {
      const [x, y] = trail.stars[i];
      const active = i === count;
      if (i < 2) {
        const [nx, ny] = trail.stars[i + 1];
        c.globalAlpha = active ? .46 : .23;
        c.strokeStyle = trail.color;
        c.lineWidth = 1.3;
        c.setLineDash([1, 7]);
        c.beginPath(); c.moveTo(x,y); c.quadraticCurveTo((x+nx)/2, Math.min(y,ny)-23,nx,ny); c.stroke();
        c.setLineDash([]);
      }
      c.globalAlpha = active ? 1 : .48;
      if (active) {
        r.glow(x, y, 73, 'gold', .58);
        c.save(); c.translate(x,y); c.rotate(r.gentle ? .5 : r.time*.6);
        c.strokeStyle=trail.color; c.beginPath(); c.arc(0,0,14,0,TAU*.36); c.stroke();
        c.beginPath(); c.arc(0,0,14,Math.PI,Math.PI+TAU*.36); c.stroke(); c.restore();
      }
      r.star(x, y, active ? 10 : 6, trail.color);
      r.star(x, y, active ? 4 : 2, '#ffffef');
    }
    c.restore();
  }
}

// Reward a blink through a bolt that would reach the wizard within a quarter second.
export function catchIncomingStar(game, from, landing) {
  const centerY = from.y - 55;
  const direction = Math.sign(landing.x - from.x);
  const index = game.projectiles.findIndex(shot => {
    if (shot.owner !== 'enemy' || shot.vx * direction >= 0) return false;
    const seconds = (from.x - shot.x) / shot.vx;
    return seconds > 0 && seconds <= .25 &&
      Math.abs(shot.y + shot.vy * seconds - centerY) <= 35 &&
      Math.abs(shot.x - from.x) < Math.abs(landing.x - from.x);
  });
  if (index < 0) return;
  const [shot] = game.projectiles.splice(index, 1);
  game.arcade.score += 150;
  game.numbers.push({x:shot.x,y:shot.y-18,text:'Starcatch +150',color:'#ffe2a0',life:1.1});
  game.event('trail-note',{x:shot.x,y:shot.y,count:2,complete:false});
}

// A brief illuminated crest rises out of the first relic as the seal wakes.
export function drawWoodlandSign(r, game) {
  const elapsed = game.time - game.firstSealTime;
  const art = r.art.woodlandSign;
  if (!art || !Number.isFinite(elapsed) || elapsed < 0 || elapsed >= 4) return;
  const progress = elapsed / 4;
  const alpha = Math.min(1, elapsed * 3, (4 - elapsed) * 1.7);
  const x = 820 - r.camera + (r.gentle ? 0 : 60 * progress);
  const y = 337 - (r.gentle ? 0 : Math.sin(progress * Math.PI / 2) * 60);
  const c = r.ctx;
  c.save();
  c.globalAlpha = alpha;
  r.glow(x, y, 195, 'gold', .48 * alpha);
  const height = 148, width = height * art.width / art.height;
  c.drawImage(art, x-width/2, y-height/2, width, height);
  for (let i = 0; i < (r.gentle ? 4 : 13); i++) {
    const rise = (progress + i / 13) % 1;
    const xx = x + Math.sin(i * 2.4 + rise) * (20 + rise * 65);
    c.globalAlpha = alpha * Math.sin(rise * Math.PI);
    r.star(xx, 431 - rise * 173, 2 + (i % 3), '#ffe6aa');
  }
  c.restore();
}
