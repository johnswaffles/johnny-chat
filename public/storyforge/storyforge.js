(function () {
  const genres = [
    "Cyberpunk",
    "Fantasy",
    "Mystery",
    "Space Opera",
    "Cozy Adventure",
    "Horror",
    "Western",
    "Superhero"
  ];

  const styles = [
    "Watercolor",
    "Comic Book",
    "Cinematic",
    "Pixel Art",
    "Noir Ink",
    "Claymation",
    "Anime",
    "Oil Painting"
  ];

  const storageKey = "storyforge-state-v1";
  const defaultApiBase = "https://johnny-chat.onrender.com";
  const apiBase = getApiBase();
  const loadingMessages = [
    "Forging the next scene",
    "Creating your story",
    "Painting the next picture",
    "Weaving choices into place"
  ];
  const refs = {
    genreOptions: document.querySelector("[data-genre-options]"),
    styleOptions: document.querySelector("[data-style-options]"),
    openSeed: document.querySelector("[data-open-seed]"),
    seedModal: document.querySelector("[data-seed-modal]"),
    closeSeed: document.querySelector("[data-close-seed]"),
    seedInput: document.querySelector("[data-seed-input]"),
    aiStart: document.querySelector("[data-ai-start]"),
    seedStart: document.querySelector("[data-seed-start]"),
    genreTag: document.querySelector("[data-genre-tag]"),
    styleTag: document.querySelector("[data-style-tag]"),
    storyTitle: document.querySelector("[data-story-title]"),
    storyCopy: document.querySelector("[data-story-copy]"),
    choiceGrid: document.querySelector("[data-choice-grid]"),
    storyImage: document.querySelector("[data-story-image]"),
    artEmpty: document.querySelector("[data-art-empty]"),
    artStatus: document.querySelector("[data-art-status]"),
    timelineList: document.querySelector("[data-timeline-list]"),
    stepCount: document.querySelector("[data-step-count]"),
    back: document.querySelector("[data-back]"),
    remix: document.querySelector("[data-remix]"),
    clear: document.querySelector("[data-clear]")
  };

  let state = loadState();
  let loading = false;
  let loadingMessageIndex = 0;
  let loadingMessageTimer = null;

  function getApiBase() {
    const override = String(window.STORYFORGE_API_BASE_URL || "").replace(/\/+$/, "");
    if (override) return override;

    const host = String(window.location.hostname || "").toLowerCase();
    if (window.location.protocol === "file:") return defaultApiBase;
    if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".onrender.com")) return "";
    return defaultApiBase;
  }

  function defaultState() {
    return {
      genre: "Cyberpunk",
      artStyle: "Watercolor",
      seed: "",
      scenes: [],
      currentIndex: -1,
      error: ""
    };
  }

  function loadState() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "null");
      if (!parsed || typeof parsed !== "object") return defaultState();
      const scenes = Array.isArray(parsed.scenes) ? parsed.scenes.slice(0, 24) : [];
      const currentIndex = Number.isFinite(parsed.currentIndex)
        ? Math.min(Math.max(parsed.currentIndex, scenes.length ? 0 : -1), scenes.length - 1)
        : -1;
      return {
        ...defaultState(),
        ...parsed,
        genre: genres.includes(parsed.genre) ? parsed.genre : "Cyberpunk",
        artStyle: styles.includes(parsed.artStyle) ? parsed.artStyle : "Watercolor",
        scenes,
        currentIndex
      };
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    try {
      const scenes = state.scenes.map((scene) => ({
        ...scene,
        image: String(scene.image || "").startsWith("http") ? scene.image : ""
      }));
      window.localStorage.setItem(storageKey, JSON.stringify({ ...state, scenes }));
    } catch {
      // Local storage can fill quickly with generated art, so the app keeps running without persistence.
    }
  }

  function currentLoadingMessage() {
    return loadingMessages[loadingMessageIndex % loadingMessages.length];
  }

  function startLoadingMessages() {
    stopLoadingMessages();
    loadingMessageIndex = 0;
    loadingMessageTimer = window.setInterval(() => {
      if (!loading) {
        stopLoadingMessages();
        return;
      }
      loadingMessageIndex = (loadingMessageIndex + 1) % loadingMessages.length;
      render();
    }, 9000);
  }

  function stopLoadingMessages() {
    if (loadingMessageTimer) {
      window.clearInterval(loadingMessageTimer);
      loadingMessageTimer = null;
    }
    loadingMessageIndex = 0;
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `scene-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function activeScene() {
    return state.scenes[state.currentIndex] || null;
  }

  function createChip(value, kind) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "setup-chip";
    button.textContent = value;
    button.dataset.value = value;
    button.addEventListener("click", () => {
      if (kind === "genre") state.genre = value;
      if (kind === "style") state.artStyle = value;
      saveState();
      render();
    });
    return button;
  }

  function renderOptionRows() {
    refs.genreOptions.innerHTML = "";
    refs.styleOptions.innerHTML = "";
    genres.forEach((genre) => refs.genreOptions.appendChild(createChip(genre, "genre")));
    styles.forEach((style) => refs.styleOptions.appendChild(createChip(style, "style")));
  }

  function render() {
    document.body.classList.toggle("is-loading", loading);
    refs.genreTag.textContent = state.genre;
    refs.styleTag.textContent = state.artStyle;

    document.querySelectorAll("[data-genre-options] .setup-chip").forEach((button) => {
      button.classList.toggle("active", button.dataset.value === state.genre);
    });
    document.querySelectorAll("[data-style-options] .setup-chip").forEach((button) => {
      button.classList.toggle("active", button.dataset.value === state.artStyle);
    });

    const scene = activeScene();
    refs.back.disabled = loading || state.currentIndex <= 0;
    refs.openSeed.disabled = loading;
    refs.remix.disabled = loading;
    refs.clear.disabled = loading && !state.scenes.length;

    if (!scene) {
      refs.storyTitle.textContent = "StoryForge";
      setStoryParagraphs(state.error
        ? [state.error, "Try another spark or clear the path and begin again."]
        : [
            "A fresh story is waiting at the edge of the forge.",
            "Pick a world, pick an art style, and strike the first spark."
          ]);
      renderChoices([]);
      renderArt(null);
      renderTimeline();
      return;
    }

    refs.storyTitle.textContent = scene.title || "Untitled Story";
    setStoryParagraphs(splitParagraphs(scene.scene));
    renderChoices(scene.choices || []);
    renderArt(scene);
    renderTimeline();
  }

  function splitParagraphs(text) {
    return String(text || "")
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 3);
  }

  function setStoryParagraphs(paragraphs) {
    refs.storyCopy.innerHTML = "";
    paragraphs.forEach((paragraph) => {
      const p = document.createElement("p");
      p.textContent = paragraph;
      refs.storyCopy.appendChild(p);
    });
  }

  function renderChoices(choices) {
    refs.choiceGrid.innerHTML = "";

    if (loading) {
      const start = loadingMessageIndex % loadingMessages.length;
      [0, 1, 2].forEach((offset) => {
        const label = loadingMessages[(start + offset) % loadingMessages.length];
        const button = document.createElement("button");
        button.type = "button";
        button.className = "choice-button";
        button.textContent = label;
        button.disabled = true;
        refs.choiceGrid.appendChild(button);
      });
      return;
    }

    choices.slice(0, 3).forEach((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice-button";
      button.textContent = choice.label || "Continue";
      button.addEventListener("click", () => generateTurn(choice.prompt || choice.label, choice.label));
      refs.choiceGrid.appendChild(button);
    });
  }

  function renderArt(scene) {
    const image = scene && scene.image ? scene.image : "";
    refs.storyImage.hidden = !image;
    refs.artEmpty.hidden = Boolean(image);
    if (image) {
      refs.storyImage.src = image;
      refs.storyImage.alt = `${state.genre} story artwork in ${state.artStyle} style`;
    } else {
      refs.storyImage.removeAttribute("src");
    }

    if (loading) {
      refs.artStatus.textContent = currentLoadingMessage();
      return;
    }

    refs.artStatus.textContent = state.error || (scene ? `${state.genre} in ${state.artStyle}` : "Ready");
  }

  function renderTimeline() {
    refs.timelineList.innerHTML = "";
    refs.stepCount.textContent = `${state.scenes.length} ${state.scenes.length === 1 ? "scene" : "scenes"}`;

    if (!state.scenes.length) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "timeline-item active";
      button.textContent = "The beginning";
      refs.timelineList.appendChild(button);
      return;
    }

    state.scenes.forEach((scene, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "timeline-item";
      button.classList.toggle("active", index === state.currentIndex);
      button.textContent = scene.title || `Scene ${index + 1}`;
      button.addEventListener("click", () => {
        if (loading) return;
        state.currentIndex = index;
        saveState();
        render();
      });
      refs.timelineList.appendChild(button);
    });
  }

  function openSeedModal() {
    refs.seedInput.value = state.seed || "";
    refs.seedModal.hidden = false;
    window.setTimeout(() => refs.seedInput.focus(), 40);
  }

  function closeSeedModal() {
    refs.seedModal.hidden = true;
  }

  async function startStory(useSeed) {
    state.seed = useSeed ? refs.seedInput.value.trim() : "";
    state.scenes = [];
    state.currentIndex = -1;
    state.error = "";
    closeSeedModal();
    saveState();
    await generateTurn("", "");
  }

  async function generateTurn(choicePrompt, choiceLabel) {
    if (loading) return;
    loading = true;
    state.error = "";
    refs.artStatus.textContent = currentLoadingMessage();
    startLoadingMessages();
    if (state.currentIndex < state.scenes.length - 1) {
      state.scenes = state.scenes.slice(0, state.currentIndex + 1);
    }
    render();

    try {
      const history = state.scenes.slice(Math.max(0, state.scenes.length - 6)).map((scene) => ({
        title: scene.title,
        scene: scene.scene,
        selectedChoice: scene.selectedChoice || ""
      }));

      const response = await fetch(`${apiBase}/api/storyforge/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre: state.genre,
          artStyle: state.artStyle,
          seed: state.seed,
          choice: choicePrompt || "",
          history
        })
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.detail || "StoryForge could not create the next scene.");
      }

      const payload = await response.json();
      const story = payload.story || {};
      const image = payload.image_b64
        ? `data:image/png;base64,${payload.image_b64}`
        : String(payload.image_url || "");

      state.scenes.push({
        id: makeId(),
        title: story.title || "Untitled Story",
        scene: story.scene || "",
        image,
        choices: Array.isArray(story.choices) ? story.choices.slice(0, 3) : [],
        imagePrompt: story.imagePrompt || "",
        selectedChoice: choiceLabel || choicePrompt || "",
        createdAt: new Date().toISOString()
      });
      state.currentIndex = state.scenes.length - 1;
      saveState();
    } catch (err) {
      state.error = err.message || "StoryForge stalled.";
    } finally {
      loading = false;
      stopLoadingMessages();
      render();
    }
  }

  function remixSetup() {
    if (loading) return;
    state.genre = genres[Math.floor(Math.random() * genres.length)];
    state.artStyle = styles[Math.floor(Math.random() * styles.length)];
    saveState();
    render();
  }

  function clearStory() {
    if (loading) return;
    state.scenes = [];
    state.currentIndex = -1;
    state.seed = "";
    state.error = "";
    saveState();
    render();
  }

  refs.openSeed.addEventListener("click", openSeedModal);
  refs.closeSeed.addEventListener("click", closeSeedModal);
  refs.aiStart.addEventListener("click", () => startStory(false));
  refs.seedStart.addEventListener("click", () => startStory(true));
  refs.back.addEventListener("click", () => {
    if (state.currentIndex > 0 && !loading) {
      state.currentIndex -= 1;
      saveState();
      render();
    }
  });
  refs.remix.addEventListener("click", remixSetup);
  refs.clear.addEventListener("click", clearStory);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !refs.seedModal.hidden) closeSeedModal();
  });

  renderOptionRows();
  render();
}());
