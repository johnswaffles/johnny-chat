(function () {
  "use strict";

  const CHANNEL_NAME = "johnny-audio-focus";
  const CLAIMS_KEY = "johnny-audio-focus-claims";
  const SIGNAL_KEY = "johnny-audio-focus-signal";
  const TAB_ID = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  const CLAIM_TTL = 9000;
  const GAME_PATHS = new Set([
    "/cozy-builder-game/",
    "/glade/",
    "/first-ember/",
    "/sim/",
    "/tetris/"
  ]);
  const musicSelector = "audio[data-johnny-music]";
  const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;
  let claimed = false;
  let claimName = "";
  let heartbeatTimer = 0;
  let resumeOnRelease = false;

  const readClaims = () => {
    try {
      const claims = JSON.parse(localStorage.getItem(CLAIMS_KEY) || "[]");
      return Array.isArray(claims) ? claims.filter((claim) => claim && claim.id) : [];
    } catch (_) {
      return [];
    }
  };

  const activeClaims = () => {
    const now = Date.now();
    const original = readClaims();
    const active = original.filter((claim) => now - Number(claim.updatedAt || 0) < CLAIM_TTL);
    if (active.length !== original.length) {
      try {
        localStorage.setItem(CLAIMS_KEY, JSON.stringify(active));
      } catch (_) {}
    }
    return active;
  };

  const signal = (message) => {
    const payload = { ...message, sentAt: Date.now() };
    try {
      channel?.postMessage(payload);
      localStorage.setItem(SIGNAL_KEY, JSON.stringify(payload));
    } catch (_) {}
  };

  const updateClaims = (nextClaims) => {
    try {
      localStorage.setItem(CLAIMS_KEY, JSON.stringify(nextClaims));
    } catch (_) {}
  };

  const pauseLocalMusic = () => {
    let pausedSomething = false;
    document.querySelectorAll(musicSelector).forEach((audio) => {
      if (!audio.paused) {
        resumeOnRelease = true;
        pausedSomething = true;
        audio.pause();
      }
    });
    if (pausedSomething) {
      window.dispatchEvent(new CustomEvent("johnny:music-focus", { detail: { state: "paused" } }));
    }
  };

  const resumeLocalMusic = () => {
    if (!resumeOnRelease || activeClaims().length > 0) return;
    resumeOnRelease = false;
    document.querySelectorAll(musicSelector).forEach((audio) => {
      audio.play().catch(() => {});
    });
    window.dispatchEvent(new CustomEvent("johnny:music-focus", { detail: { state: "resumed" } }));
  };

  const heartbeat = () => {
    const claims = activeClaims().filter((claim) => claim.id !== TAB_ID);
    claims.push({ id: TAB_ID, app: claimName, updatedAt: Date.now() });
    updateClaims(claims);
  };

  const claim = (appName) => {
    claimed = true;
    claimName = String(appName || "game");
    heartbeat();
    signal({ type: "claim", id: TAB_ID, app: claimName });
    pauseLocalMusic();
    if (!heartbeatTimer) heartbeatTimer = window.setInterval(heartbeat, 2500);
  };

  const release = () => {
    if (!claimed) return;
    claimed = false;
    if (heartbeatTimer) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = 0;
    }
    updateClaims(activeClaims().filter((claimItem) => claimItem.id !== TAB_ID));
    signal({ type: "release", id: TAB_ID, app: claimName });
  };

  const handleMessage = (message) => {
    if (!message || message.id === TAB_ID) return;
    if (message.type === "claim" || message.type === "launcher") {
      pauseLocalMusic();
    } else if (message.type === "release") {
      window.setTimeout(resumeLocalMusic, 80);
    }
  };

  channel?.addEventListener("message", (event) => handleMessage(event.data));
  window.addEventListener("storage", (event) => {
    if (event.key !== SIGNAL_KEY || !event.newValue) return;
    try {
      handleMessage(JSON.parse(event.newValue));
    } catch (_) {}
  });

  document.addEventListener("click", (event) => {
    const link = event.target?.closest?.("a[href]");
    if (!link) return;
    let destination;
    try {
      destination = new URL(link.href, window.location.href);
    } catch (_) {
      return;
    }
    if (destination.origin !== window.location.origin || !GAME_PATHS.has(destination.pathname)) return;
    signal({ type: "launcher", id: TAB_ID, app: destination.pathname });
    pauseLocalMusic();
  }, true);

  window.JohnnyAudioFocus = { claim, release, pause: pauseLocalMusic };
  window.addEventListener("pagehide", release, { once: true });
  window.addEventListener("pageshow", () => {
    if (claimed) claim(claimName);
  });
})();
