(() => {
  'use strict';

  const stage = document.getElementById('galaxy-stage');
  const canvas = document.getElementById('galaxy-canvas');
  const motionButton = document.getElementById('motion-control');
  const hint = document.getElementById('galaxy-hint');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const readPreference = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const savePreference = (key, value) => { try { localStorage.setItem(key, value); } catch { /* Private browsing still works. */ } };
  let paused = reducedMotion.matches || readPreference('johnny-home-motion') === 'paused';
  let visible = true;
  let draw = () => {};
  let raf = 0;
  let ready = false;
  let previousFrame = 0;
  let elapsed = 0;
  let orbitOffset = 0;
  let dragging = false;
  let lastPointerX = 0;
  const pointer = { x: 0, y: 0, smoothX: 0, smoothY: 0 };
  const frameInterval = coarsePointer ? 1000 / 24 : 1000 / 30;

  function syncMotion() {
    stage.classList.toggle('is-paused', paused || !visible || document.hidden);
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.querySelector('.control-label').textContent = paused ? 'Resume motion' : 'Pause motion';
    motionButton.querySelector('.motion-icon').textContent = paused ? '▷' : 'Ⅱ';
    hint.textContent = paused ? 'A moment of stillness' : ready ? (coarsePointer ? 'A universe in motion' : 'Move to explore · drag to orbit') : 'A universe in motion';
    cancelAnimationFrame(raf);
    previousFrame = 0;
    if (ready) {
      draw();
      if (!paused && visible && !document.hidden) raf = requestAnimationFrame(animate);
    }
  }

  function animate(now) {
    raf = requestAnimationFrame(animate);
    if (previousFrame && now - previousFrame < frameInterval) return;
    const delta = previousFrame ? Math.min((now - previousFrame) / 1000, 0.08) : 0;
    previousFrame = now;
    elapsed += delta;
    pointer.smoothX += (pointer.x - pointer.smoothX) * 0.055;
    pointer.smoothY += (pointer.y - pointer.smoothY) * 0.055;
    draw();
  }

  motionButton.hidden = false;
  motionButton.addEventListener('click', () => {
    paused = !paused;
    savePreference('johnny-home-motion', paused ? 'paused' : 'playing');
    syncMotion();
  });
  reducedMotion.addEventListener('change', (event) => {
    paused = event.matches || readPreference('johnny-home-motion') === 'paused';
    syncMotion();
  });
  document.addEventListener('visibilitychange', syncMotion);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; syncMotion(); }, { threshold: 0 }).observe(stage);
  }
  stage.addEventListener('pointermove', (event) => {
    if (paused || coarsePointer) return;
    const rect = stage.getBoundingClientRect();
    pointer.x = (event.clientX - rect.left) / rect.width - 0.5;
    pointer.y = (event.clientY - rect.top) / rect.height - 0.5;
    if (dragging) orbitOffset += (event.clientX - lastPointerX) * 0.005;
    lastPointerX = event.clientX;
  });
  stage.addEventListener('pointerdown', (event) => {
    if (paused || coarsePointer || event.button !== 0) return;
    dragging = true;
    lastPointerX = event.clientX;
    stage.setPointerCapture(event.pointerId);
  });
  const endDrag = () => { dragging = false; };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('lostpointercapture', endDrag);
  stage.addEventListener('pointerleave', () => { pointer.x = 0; pointer.y = 0; });
  syncMotion();

  // The generated artwork is the texture. The shader supplies continuous orbit,
  // differential rotation and perspective without a rendering-library download.
  function startGalaxy() {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
    if (!gl) return;
    const vertexSource = `
      attribute vec2 position;
      varying vec2 uv;
      void main() { uv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }
    `;
    const fragmentSource = `
      precision mediump float;
      varying vec2 uv;
      uniform sampler2D galaxy;
      uniform vec2 resolution;
      uniform vec2 pointer;
      uniform float time;
      uniform float orbit;
      mat2 rotate(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }
      void main() {
        vec2 p = (uv - 0.5) * resolution / min(resolution.x, resolution.y);
        p -= pointer * 0.032;
        p = rotate(-0.34 + pointer.x * 0.11) * p;
        p.y *= 1.35 + pointer.y * 0.17;
        p *= 0.88;
        float radius = length(p);
        float angle = time * 0.038 + orbit + time * 0.0025 * exp(-radius * 5.0);
        vec2 sampleUV = rotate(angle) * p + 0.5;
        vec3 col = texture2D(galaxy, clamp(sampleUV, 0.001, 0.999)).rgb;
        float mask = 1.0 - smoothstep(0.41, 0.53, radius);
        vec3 background = vec3(0.02745, 0.03529, 0.04314);
        col = max(col - vec3(0.012), vec3(0.0));
        col *= vec3(0.90, 1.05, 1.05) * 1.16;
        gl_FragColor = vec4(background + col * mask, 1.0);
      }
    `;
    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        throw new Error('Galaxy shader unavailable');
      }
      return shader;
    }
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Galaxy renderer unavailable');
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniforms = Object.fromEntries(['resolution', 'pointer', 'time', 'orbit', 'galaxy'].map((name) => [name, gl.getUniformLocation(program, name)]));
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const artwork = new Image();
    artwork.onload = () => {
      if (gl.isContextLost()) return;
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, artwork);
      gl.uniform1i(uniforms.galaxy, 0);
      draw = () => {
        gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
        gl.uniform2f(uniforms.pointer, pointer.smoothX, pointer.smoothY);
        gl.uniform1f(uniforms.time, elapsed);
        gl.uniform1f(uniforms.orbit, orbitOffset);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      };
      const resize = () => {
        const rect = stage.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, coarsePointer ? 1.25 : 1.5);
        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));
        gl.viewport(0, 0, canvas.width, canvas.height);
        draw();
      };
      ready = true;
      resize();
      if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
      else window.addEventListener('resize', resize);
      stage.classList.add('is-ready');
      syncMotion();
    };
    artwork.src = '/home/galaxy.webp';
    canvas.addEventListener('webglcontextlost', () => {
      ready = false;
      cancelAnimationFrame(raf);
      draw = () => {};
      stage.classList.remove('is-ready');
      syncMotion();
    });
  }
  try { startGalaxy(); } catch { /* The original artwork remains an animated fallback. */ }

  // Sound is a deliberate choice and never starts on an unrelated click.
  const music = document.getElementById('home-music');
  const musicButton = document.getElementById('music-control');
  music.volume = 0.22;
  musicButton.hidden = false;
  function syncSound() {
    const playing = !music.paused;
    musicButton.setAttribute('aria-pressed', String(playing));
    musicButton.querySelector('.control-label').textContent = playing ? 'Sound on' : 'Sound off';
  }
  let pendingPlay = false;
  musicButton.addEventListener('click', async () => {
    if (pendingPlay) return;
    if (!music.paused) { music.pause(); return; }
    pendingPlay = true;
    musicButton.querySelector('.control-label').textContent = 'Starting…';
    try { await music.play(); } catch { musicButton.querySelector('.control-label').textContent = 'Try sound again'; }
    finally { pendingPlay = false; }
  });
  music.addEventListener('play', syncSound);
  music.addEventListener('pause', syncSound);
  music.addEventListener('error', () => { musicButton.querySelector('.control-label').textContent = 'Sound unavailable'; });
})();
