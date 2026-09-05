import { CONFIG, FIRST_AGE_ASSETS } from './config.js?v=20260904-naturalwalk1';

export function setupPresentation({ renderer, simulation, input, announce }) {
  const shell = document.querySelector('.game-shell');
  const viewButton = document.querySelector('#view-mode');
  const settingsButton = document.querySelector('#view-settings');
  const settings = document.querySelector('#view-settings-panel');
  const mini = document.querySelector('#kingdom-map');
  const mapCtx = mini.getContext('2d');
  const mapBase = document.createElement('canvas');
  mapBase.width = mini.width;
  mapBase.height = mini.height;
  const mapBaseCtx = mapBase.getContext('2d');
  const zoomLabel = document.querySelector('#view-zoom');
  const homeButton = document.querySelector('#view-home');
  const motion = document.querySelector('#reduced-motion');
  const systemMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let cinematic = false;
  let mapTime = -Infinity;
  let terrainTime = -Infinity;
  let mapResourceCount = -1;
  let mapSeed = null;
  let motionOverride = false;
  const intel = document.querySelector('.intel-panel');
  const intelToggle = document.querySelector('#intel-toggle');
  function collapseIntel(value) {
    intel.classList.toggle('is-compact', value);
    intelToggle.setAttribute('aria-expanded', String(!value));
  }
  collapseIntel(window.innerWidth <= 760);
  intelToggle.addEventListener('click', () => collapseIntel(!intel.classList.contains('is-compact')));

  function setCinematic(value) {
    cinematic = value;
    shell.classList.toggle('is-cinematic', value);
    viewButton.setAttribute('aria-pressed', String(value));
    viewButton.textContent = value ? 'RETURN TO COMMAND' : 'FULL VIEW';
    if (value) {
      settings.hidden = true;
      settingsButton.setAttribute('aria-expanded', 'false');
      document.querySelector('#build-menu').hidden = true;
      document.querySelector('#train-menu').hidden = true;
      input.cancelBuildMode();
      input.cancelDemolitionMode();
      input.cancelGuardMode();
      input.cancelRallyMode();
      input.cancelPatrolMode();
    }
  }
  viewButton.addEventListener('click', () => setCinematic(!cinematic));
  settingsButton.addEventListener('click', () => {
    settings.hidden = !settings.hidden;
    settingsButton.setAttribute('aria-expanded', String(!settings.hidden));
  });
  function focusHome() {
    const hall = simulation.buildings.find((b) => b.type === 'townCenter' && b.faction === 'player' && !b.destroyed);
    const center = hall ? { x: hall.x + 4, z: hall.z + 8 } : CONFIG.initialCameraWorld;
    renderer.camera.zoom = CONFIG.initialZoom;
    const p = renderer.worldToScreen(center);
    renderer.panBy(renderer.width * 0.53 - p.x, renderer.height * 0.48 - p.y);
  }
  homeButton.addEventListener('click', focusHome);
  document.querySelector('#view-zoom-in').addEventListener('click', () => renderer.zoomAt(1.25, { x: renderer.width / 2, y: renderer.height / 2 }));
  document.querySelector('#view-zoom-out').addEventListener('click', () => renderer.zoomAt(0.8, { x: renderer.width / 2, y: renderer.height / 2 }));
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (cinematic) setCinematic(false);
      settings.hidden = true;
      settingsButton.setAttribute('aria-expanded', 'false');
      return;
    }
    if (event.target.closest?.('button, input, select, textarea') || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key.toLowerCase() === 'f' && !event.repeat) { event.preventDefault(); setCinematic(!cinematic); }
    if (event.key === 'Home') { event.preventDefault(); focusHome(); }
    if (cinematic && event.key.toLowerCase() === 'b') setCinematic(false);
  });
  document.querySelectorAll('[data-light]').forEach((button) => {
    button.addEventListener('click', () => {
      renderer.atmosphere.mode = button.dataset.light;
      document.querySelectorAll('[data-light]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      document.querySelector('#light-name').textContent = button.textContent;
    });
  });
  document.querySelector('#ambient-effects').addEventListener('change', (event) => {
    renderer.atmosphere.enabled = event.target.checked;
  });
  function applyMotion(value) {
    motion.checked = value;
    renderer.atmosphere.reducedMotion = value;
    input.setReducedMotion(value);
  }
  applyMotion(systemMotion.matches);
  motion.addEventListener('change', () => { motionOverride = true; applyMotion(motion.checked); });
  systemMotion.addEventListener('change', (event) => { if (!motionOverride) applyMotion(event.matches); });

  // These are the actual building images, not generic menu symbols.
  document.querySelectorAll('[data-build-type]').forEach((button) => {
    const type = button.dataset.buildType;
    const asset = FIRST_AGE_ASSETS[type];
    if (!asset?.src) return;
    const image = document.createElement('img');
    image.src = asset.src;
    image.alt = '';
    image.className = 'blueprint-art';
    image.loading = 'lazy';
    image.decoding = 'async';
    button.querySelector('.action-mark')?.replaceWith(image);
  });

  const pad = 12;
  const mw = mini.width - pad * 2;
  const mh = mini.height - pad * 2;
  const project = (p) => ({ x: pad + p.x / CONFIG.mapWidth * mw, y: pad + p.z / CONFIG.mapHeight * mh });
  mini.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const rect = mini.getBoundingClientRect();
    const world = {
      x: Math.max(0, Math.min(CONFIG.mapWidth, ((event.clientX - rect.left) / rect.width * mini.width - pad) / mw * CONFIG.mapWidth)),
      z: Math.max(0, Math.min(CONFIG.mapHeight, ((event.clientY - rect.top) / rect.height * mini.height - pad) / mh * CONFIG.mapHeight)),
    };
    const p = renderer.worldToScreen(world);
    renderer.panBy(renderer.width / 2 - p.x, renderer.height / 2 - p.y);
  });
  mini.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); focusHome(); }
  });
  // Collapsed utility panels keep map commands unobstructed.
  document.querySelector('#speed-controls-toggle').addEventListener('click', () => {
    const panel = document.querySelector('#dev-speed-panel');
    panel.hidden = !panel.hidden;
    document.querySelector('#speed-controls-toggle').setAttribute('aria-expanded', String(!panel.hidden));
  });
  document.querySelector('#field-log-toggle').addEventListener('click', (event) => {
    const panel = document.querySelector('.history-panel');
    const open = panel.classList.toggle('is-open');
    event.currentTarget.setAttribute('aria-expanded', String(open));
  });

  function updateMap(now) {
    if (cinematic || now - mapTime < 250) return;
    mapTime = now;
    const worldSeed = simulation.activeWorldSeed ?? simulation.worldSeed;
    if (now - terrainTime > 5000 || mapResourceCount !== simulation.resourcesNodes.length || mapSeed !== worldSeed) {
      terrainTime = now;
      mapResourceCount = simulation.resourcesNodes.length;
      mapSeed = worldSeed;
      mapBaseCtx.fillStyle = '#354c39';
      mapBaseCtx.fillRect(0, 0, mini.width, mini.height);
      mapBaseCtx.strokeStyle = '#c3ad7220';
      mapBaseCtx.lineWidth = 1;
      for (let i = 1; i < 6; i++) {
        mapBaseCtx.beginPath(); mapBaseCtx.moveTo(i * mini.width / 6, 0); mapBaseCtx.lineTo(i * mini.width / 6, mini.height); mapBaseCtx.stroke();
      }
      for (const node of simulation.resourcesNodes) {
        if (node.amount <= 0) continue;
        const p = project(node);
        mapBaseCtx.fillStyle = node.resourceType === 'wood' ? '#1b342a' : node.resourceType === 'gold' ? '#b89b58' : node.resourceType === 'stone' ? '#829188' : '#728952';
        const radius = node.sizeTier === 'wildwood' ? 2 : 1.2;
        mapBaseCtx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
      }
    }
    mapCtx.drawImage(mapBase, 0, 0);
    const exploration = simulation.getExplorationSnapshot?.();
    const explored = exploration?.enabled ? new Set(exploration.cells) : null;
    if (explored) {
      const size = exploration.cellSize;
      mapCtx.fillStyle = '#122923';
      for (let x = 0; x < CONFIG.mapWidth; x += size) for (let z = 0; z < CONFIG.mapHeight; z += size) {
        if (explored.has(`${Math.floor(x / size)}:${Math.floor(z / size)}`)) continue;
        const p = project({ x, z });
        mapCtx.fillRect(p.x, p.y, size / CONFIG.mapWidth * mw + 1, size / CONFIG.mapHeight * mh + 1);
      }
    }
    for (const entity of [...simulation.buildings, ...simulation.units]) {
      if (entity.dead || entity.destroyed) continue;
      if (entity.faction === 'enemy' && explored && !explored.has(`${Math.floor(entity.x / exploration.cellSize)}:${Math.floor(entity.z / exploration.cellSize)}`)) continue;
      const p = project(entity);
      const size = entity.kind === 'building' ? 3.5 : 1.8;
      mapCtx.fillStyle = entity.faction === 'enemy' ? '#d78c63' : '#eee1a7';
      mapCtx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    }
    const corners = [{ x: 0, y: 0 }, { x: renderer.width, y: 0 }, { x: renderer.width, y: renderer.height }, { x: 0, y: renderer.height }].map((p) => project(renderer.screenToWorld(p)));
    mapCtx.strokeStyle = '#f3d793';
    mapCtx.lineWidth = 1.5;
    mapCtx.beginPath();
    corners.forEach((p, i) => i ? mapCtx.lineTo(p.x, p.y) : mapCtx.moveTo(p.x, p.y));
    mapCtx.closePath(); mapCtx.stroke();
    zoomLabel.textContent = `${Math.round(renderer.camera.zoom * 100)}%`;
  }
  return { update: updateMap, focusHome };
}
