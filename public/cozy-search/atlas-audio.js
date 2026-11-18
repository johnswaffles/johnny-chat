(() => {
  "use strict";
  const music = document.getElementById("game-music");
  const musicButton = document.getElementById("music-button");
  const musicButtonLabel = document.getElementById("music-button-label");
  const soundtrackSelect = document.getElementById("soundtrack-select");
  const SOUNDTRACKS = {
    cozy: { src: "/home/cozy-builder-theme.mp3", label: "Johnny's Cozy Theme" },
    "dreamy-clouds": {
      src: "/tetris/audio/dreamy-clouds.mp3",
      label: "Dreamy Clouds",
      loopTrimSeconds: 2,
    },
    "neon-dreams": {
      src: "/tetris/audio/neon-dreams.mp3",
      label: "Neon Dreams",
    },
    "whimsical-waltz": {
      src: "/tetris/audio/whimsical-waltz.mp3",
      label: "Whimsical Waltz",
    },
    "crownforge-rp": {
      src: "/crownforge/assets/lantern-under-stone.mp3",
      label: "Johnny's RP",
    },
    "nocturnal-calm": {
      src: "/tetris/audio/nocturnal-calm.mp3",
      label: "Nocturnal Calm",
      loopTrimSeconds: 1,
    },
  };
  const LOOP_ALL_ID = "loop-all";
  const SOUNDTRACK_ORDER = Object.keys(SOUNDTRACKS);
  const SOUNDTRACK_STORAGE_KEY = "johnny-tetris-soundtrack";

  let musicEnabled = false;
  try {
    musicEnabled = localStorage.getItem("cozy-atlas-music") === "on";
  } catch (_) {}
  let audioContext = null;
  let musicError = false;
  let soundtrackId = "cozy";
  let activeTrackId = "cozy";
  let loopAllIndex = 0;
  const startMusic = () => {
    if (!musicEnabled) return;
    // A selection starts with a pointerdown on the grid. Re-claiming audio
    // focus for every pointerdown briefly pauses the track on mobile, so only
    // claim when this app actually needs to start (or resume) its audio.
    if (music.paused) window.JohnnyAudioFocus?.claim("cozy-search");
    if (music.paused) music.play().catch(() => {});
  };

  const updateMusicButton = () => {
    const playing = musicEnabled && !music.paused;
    if (musicButtonLabel)
      musicButtonLabel.textContent = musicError
        ? "Track unavailable"
        : playing
          ? "Music: on"
          : musicEnabled
            ? "Music: paused"
            : "Music: off";
    musicButton.dataset.playing = String(playing);
    musicButton.setAttribute("aria-pressed", String(musicEnabled));
    musicButton
      .closest(".music-card")
      ?.setAttribute("data-playing", String(playing));
  };

  const updateSoundtrackControl = () => {
    soundtrackSelect.value = soundtrackId;
    music.dataset.track = activeTrackId;
    music.dataset.playlist = soundtrackId === LOOP_ALL_ID ? "all" : "single";
  };

  const activeTrack = () => SOUNDTRACKS[activeTrackId] || SOUNDTRACKS.cozy;

  const keepTrackLoopTight = () => {
    if (soundtrackId === LOOP_ALL_ID) return;
    const trimSeconds = activeTrack().loopTrimSeconds || 0;
    if (!trimSeconds || music.paused || !Number.isFinite(music.duration))
      return;
    if (
      music.duration > trimSeconds &&
      music.currentTime >= music.duration - trimSeconds
    )
      music.currentTime = 0;
  };

  const loadTrack = (trackId, resume = false) => {
    const track = SOUNDTRACKS[trackId];
    if (!track) return;
    activeTrackId = trackId;
    musicError = false;
    music.pause();
    music.loop = soundtrackId !== LOOP_ALL_ID;
    if (music.getAttribute("src") !== track.src) {
      music.src = track.src;
      music.load();
    }
    try {
      music.currentTime = 0;
    } catch (_) {}
    music.setAttribute("aria-label", `${track.label} soundtrack`);
    updateSoundtrackControl();
    if (resume && musicEnabled) {
      window.JohnnyAudioFocus?.claim("cozy-search");
      music.play().catch(() => {});
    } else updateMusicButton();
  };

  const setSoundtrack = (nextId) => {
    if (nextId !== LOOP_ALL_ID && !SOUNDTRACKS[nextId]) return;
    const resume = musicEnabled && !music.paused;
    soundtrackId = nextId;
    try {
      localStorage.setItem(SOUNDTRACK_STORAGE_KEY, soundtrackId);
    } catch (_) {}
    if (nextId === LOOP_ALL_ID) {
      loopAllIndex = 0;
      loadTrack(SOUNDTRACK_ORDER[loopAllIndex], resume);
      return;
    }
    loopAllIndex = Math.max(0, SOUNDTRACK_ORDER.indexOf(nextId));
    loadTrack(nextId, resume);
  };

  const advanceLoopAll = () => {
    if (soundtrackId !== LOOP_ALL_ID) return;
    loopAllIndex = (loopAllIndex + 1) % SOUNDTRACK_ORDER.length;
    loadTrack(SOUNDTRACK_ORDER[loopAllIndex], musicEnabled);
  };

  const playTone = (finalWord = false) => {
    if (!musicEnabled) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === "suspended")
        audioContext.resume().catch(() => {});
      const now = audioContext.currentTime;
      const notes = finalWord
        ? [392, 523, 659, 784]
        : [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, now + index * 0.085);
        gain.gain.exponentialRampToValueAtTime(
          finalWord ? 0.045 : 0.03,
          now + index * 0.085 + 0.025,
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          now + index * 0.085 + 0.34,
        );
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start(now + index * 0.085);
        oscillator.stop(now + index * 0.085 + 0.36);
      });
    } catch (_) {}
  };

  document.getElementById("board").addEventListener("pointerdown", startMusic);
  document.getElementById("board").addEventListener("keydown", startMusic);
  window.addEventListener("cozy:found", (event) =>
    playTone(event.detail.complete),
  );

  musicButton.addEventListener("click", () => {
    musicEnabled = !musicEnabled;
    try {
      localStorage.setItem("cozy-atlas-music", musicEnabled ? "on" : "off");
    } catch (_) {}
    musicError = false;
    if (musicEnabled) startMusic();
    else music.pause();
    updateMusicButton();
  });
  soundtrackSelect.addEventListener("change", (event) => {
    startMusic();
    setSoundtrack(event.target.value);
  });
  music.addEventListener("play", updateMusicButton);
  music.addEventListener("pause", updateMusicButton);
  music.addEventListener("canplay", () => {
    musicError = false;
    updateMusicButton();
  });
  music.addEventListener("error", () => {
    musicError = true;
    updateMusicButton();
  });
  music.addEventListener("timeupdate", keepTrackLoopTight);
  music.addEventListener("ended", advanceLoopAll);
  window.addEventListener("pagehide", () => music.pause());
  window.addEventListener("johnny:music-focus", updateMusicButton);
  let storedSoundtrack = "cozy";
  try {
    storedSoundtrack = localStorage.getItem(SOUNDTRACK_STORAGE_KEY) || "cozy";
  } catch (_) {}
  soundtrackId =
    storedSoundtrack === LOOP_ALL_ID || SOUNDTRACKS[storedSoundtrack]
      ? storedSoundtrack
      : "cozy";
  activeTrackId =
    soundtrackId === LOOP_ALL_ID ? SOUNDTRACK_ORDER[0] : soundtrackId;
  loopAllIndex = Math.max(0, SOUNDTRACK_ORDER.indexOf(activeTrackId));
  setSoundtrack(soundtrackId);
  updateMusicButton();
})();
