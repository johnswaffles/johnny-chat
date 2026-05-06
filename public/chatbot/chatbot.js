(function () {
  const profile = "gpt54";
  const apiBase = String(window.JOHNNY_CHAT_API_BASE_URL || "https://johnny-chat.onrender.com").replace(/\/+$/, "");
  const storeKey = "gpt54_convos_v1";
  const activeKey = `${storeKey}_active`;
  const projectStoreKey = "gpt54_projects_v1";
  const activeProjectKey = "gpt54_project_active";
  const maxHistory = 18;
  const imageDbName = "gpt54_images_v1";
  const imageStore = "images";
  const ttsStore = "tts_audio";
  const sessionCookieName = "gpt54_session";
  const ttsStoreKey = "gpt54_tts_enabled";
  const ttsVoiceKey = "gpt54_tts_voice";
  const defaultTtsVoice = "cedar";
  const ttsVoices = new Set(["alloy", "ash", "ballad", "cedar", "coral", "echo", "fable", "marin", "nova", "onyx", "sage", "shimmer", "verse"]);
  const ttsCacheVersion = "v1";
  const ttsCacheMax = 60;
  const workspaceContextMax = 24000;
  const libraryContextMax = 18000;
  const visualMemoryMax = 1800;

  const noopClassList = {
    add() {},
    remove() {},
    toggle() { return false; },
    contains() { return false; }
  };

  const noopElement = new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === "classList") return noopClassList;
      if (prop === "style") return {};
      if (prop === "dataset") return {};
      if (prop === "files") return [];
      if (prop === "value") return "";
      if (prop === "innerHTML") return "";
      if (prop === "textContent") return "";
      if (prop === "children") return [];
      if (prop === "childElementCount") return 0;
      if (prop === "scrollHeight" || prop === "scrollTop" || prop === "clientHeight" || prop === "offsetHeight" || prop === "offsetWidth") return 0;
      if (prop === "addEventListener" || prop === "removeEventListener" || prop === "appendChild" || prop === "prepend" || prop === "replaceChild" || prop === "removeChild" || prop === "setAttribute" || prop === "removeAttribute" || prop === "focus" || prop === "click" || prop === "scrollIntoView" || prop === "select" || prop === "setSelectionRange" || prop === "blur") {
        return () => {};
      }
      if (prop === "querySelector") return () => null;
      if (prop === "querySelectorAll") return () => [];
      if (prop === "closest") return () => null;
      return undefined;
    },
    set() {
      return true;
    }
  });

  function getEl(id) {
    return document.getElementById(id) || noopElement;
  }

  function readCookie(name) {
    const prefix = `${name}=`;
    const found = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix));
    if (!found) return "";
    try {
      return decodeURIComponent(found.slice(prefix.length));
    } catch {
      return found.slice(prefix.length);
    }
  }

  function authHeaders(headers = {}) {
    const next = new Headers(headers);
    const token = readCookie(sessionCookieName);
    if (token) next.set("Authorization", `Bearer ${token}`);
    return next;
  }

  function apiFetch(url, options = {}) {
    return fetch(url, {
      ...options,
      headers: authHeaders(options.headers)
    });
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isRetryableFetchError(err) {
    return err instanceof TypeError || /failed to fetch|network|load failed/i.test(String(err?.message || err || ""));
  }

  function isRetryableResponse(res) {
    return res && (res.status === 502 || res.status === 503 || res.status === 504);
  }

  async function apiFetchWithRetry(url, options = {}, attempts = 3) {
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const res = await apiFetch(url, options);
        if (!isRetryableResponse(res) || attempt === attempts - 1) return res;
        await wait(700 * (attempt + 1));
      } catch (err) {
        lastError = err;
        if (!isRetryableFetchError(err) || attempt === attempts - 1) throw err;
        await wait(700 * (attempt + 1));
      }
    }
    throw lastError || new Error("Request failed");
  }

  const el = {
    search: getEl("search"),
    clearSearch: getEl("clear-search"),
    promptDeck: getEl("prompt-deck"),
    recentImages: getEl("recent-images"),
    clearImages: getEl("clear-images"),
    conversationList: getEl("conversation-list"),
    messages: getEl("messages"),
    attachmentPreview: getEl("attachment-preview"),
    input: getEl("input"),
    sendBtn: getEl("send-btn"),
    attachBtn: getEl("attach-btn"),
    fileInput: getEl("file-input"),
    modal: getEl("modal"),
    modalImage: getEl("modal-image"),
    closeModal: getEl("close-modal"),
    newChatRail: getEl("new-chat-rail"),
    newChatRail2: getEl("new-chat-rail-2"),
    newChatMain: getEl("new-chat-main"),
    voiceToggle: getEl("voice-toggle"),
    voiceSelect: getEl("voice-select"),
    micBtn: getEl("mic-btn"),
    workspaceFiles: getEl("workspace-files"),
    clearWorkspace: getEl("clear-workspace"),
    statsToggle: getEl("stats-toggle"),
    statsPanel: getEl("stats-panel"),
    statsBody: getEl("stats-body"),
    closeStats: getEl("close-stats"),
    refreshStats: getEl("refresh-stats")
    ,projectSelect: getEl("project-select")
    ,newProject: getEl("new-project")
    ,projectNotes: getEl("project-notes")
    ,librarySearch: getEl("library-search")
    ,libraryList: getEl("library-list")
    ,addKnowledge: getEl("add-knowledge")
    ,researchToggle: getEl("research-toggle")
    ,actionsToggle: getEl("actions-toggle")
    ,actionsPanel: getEl("actions-panel")
    ,closeActions: getEl("close-actions")
  };

  document.title = "GPT 5.5";
  document.documentElement.dataset.profile = profile;
  window.JOHNNY_CHAT_PROFILE = profile;

  const promptIdeas = [
    "Help me shop for the top 5 best-reviewed options from reputable brands, compare price, key pros and cons, and recommend the best overall pick.",
    "Summarize a long message into bullets.",
    "Analyze a screenshot or PDF.",
    "Generate a fresh image concept."
  ];

  const db = {
    convos: readJSON(storeKey, []),
    activeId: localStorage.getItem(activeKey) || "",
    projects: normalizeProjects(readJSON(projectStoreKey, [])),
    activeProjectId: localStorage.getItem(activeProjectKey) || "",
    libraryItems: [],
    researchMode: false,
    imageDbPromise: null,
    currentMenu: null,
    pendingFiles: [],
    ttsEnabled: readJSON(ttsStoreKey, false) === true,
    ttsVoice: normalizeVoice(localStorage.getItem(ttsVoiceKey) || defaultTtsVoice),
    currentAudio: null,
    currentAudioUrl: "",
    currentSpeakButton: null,
    mediaRecorder: null,
    mediaStream: null,
    voiceChunks: [],
    isRecording: false
  };

  if (!Array.isArray(db.convos)) db.convos = [];
  if (!db.projects.some((project) => project.id === db.activeProjectId)) {
    db.activeProjectId = db.projects[0].id;
    localStorage.setItem(activeProjectKey, db.activeProjectId);
  }

  promptIdeas.forEach((text) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "prompt-chip";
    button.textContent = text;
    button.addEventListener("click", () => {
      el.input.value = text;
      el.input.focus();
      resizeInput();
    });
    el.promptDeck.appendChild(button);
  });

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function save() {
    localStorage.setItem(storeKey, JSON.stringify(db.convos));
    localStorage.setItem(projectStoreKey, JSON.stringify(db.projects));
    if (db.activeProjectId) localStorage.setItem(activeProjectKey, db.activeProjectId);
    if (db.activeId) localStorage.setItem(activeKey, db.activeId);
  }

  function normalizeProjects(projects) {
    const items = Array.isArray(projects) ? projects.filter(Boolean) : [];
    if (!items.length) {
      return [{
        id: "general",
        title: "General",
        notes: "",
        createdAt: nowISO(),
        updatedAt: nowISO()
      }];
    }
    return items.map((project) => ({
      id: String(project.id || uid()),
      title: String(project.title || "Untitled project").slice(0, 80),
      notes: String(project.notes || ""),
      createdAt: project.createdAt || nowISO(),
      updatedAt: project.updatedAt || nowISO()
    }));
  }

  function getActiveProject() {
    return db.projects.find((project) => project.id === db.activeProjectId) || db.projects[0];
  }

  function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : `gpt-${Math.random().toString(36).slice(2)}`;
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function newConversation(title) {
    return {
      id: uid(),
      title: title || "(new conversation)",
      createdAt: nowISO(),
      updatedAt: nowISO(),
      projectId: db?.activeProjectId || "general",
      greeted: false,
      files: [],
      messages: []
    };
  }

  function getActive() {
    if (db.activeId) {
      const found = db.convos.find((item) => item && item.id === db.activeId);
      if (found && ensureConversation(found).projectId === db.activeProjectId) return found;
    }
    const projectConvo = db.convos.find((item) => item && ensureConversation(item).projectId === db.activeProjectId);
    if (projectConvo) {
      db.activeId = projectConvo.id;
      save();
      return projectConvo;
    }
    db.convos.unshift(newConversation("GPT 5.5"));
    db.activeId = db.convos[0].id;
    save();
    return ensureConversation(db.convos[0]);
  }

  function ensureConversation(convo) {
    if (!convo.messages || !Array.isArray(convo.messages)) convo.messages = [];
    if (!convo.files || !Array.isArray(convo.files)) convo.files = [];
    if (!convo.projectId) convo.projectId = db.activeProjectId || "general";
    if (!convo.visualMemory || typeof convo.visualMemory !== "object") convo.visualMemory = null;
    return convo;
  }

  function setTitle(convo, firstText) {
    if (!convo || convo.title !== "(new conversation)") return;
    const value = String(firstText || "").trim().replace(/\s+/g, " ").slice(0, 60);
    if (value) convo.title = value;
  }

  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function pretty(text) {
    const s = esc(text)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    const lines = s.split(/\r?\n/).map((line) => line.trim());
    const parts = [];
    let bullets = [];

    const flushBullets = () => {
      if (!bullets.length) return;
      parts.push(`<ul>${bullets.map((item) => `<li>${item}</li>`).join("")}</ul>`);
      bullets = [];
    };

    lines.forEach((line) => {
      if (!line) {
        flushBullets();
        return;
      }
      if (/^[-•]\s+/.test(line)) {
        bullets.push(line.replace(/^[-•]\s+/, ""));
        return;
      }
      flushBullets();
      parts.push(`<p>${line}</p>`);
    });

    flushBullets();
    return parts.join("") || "<p></p>";
  }

  function normalizeVoice(value) {
    const voice = String(value || "").toLowerCase().trim();
    return ttsVoices.has(voice) ? voice : defaultTtsVoice;
  }

  function speechText(value) {
    return String(value || "")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/```[\s\S]*?```/g, " code block omitted ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/[#>*_~]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4096);
  }

  function updateVoiceToggle() {
    el.voiceToggle.textContent = db.ttsEnabled ? "AI voice on" : "AI voice off";
    el.voiceToggle.setAttribute("aria-pressed", db.ttsEnabled ? "true" : "false");
    el.voiceToggle.classList.toggle("active", db.ttsEnabled);
  }

  function resetSpeakButtons() {
    document.querySelectorAll(".speak-btn").forEach((button) => {
      button.disabled = false;
      button.classList.remove("playing");
      button.textContent = "▶";
      button.title = "Play AI voice";
    });
  }

  function stopSpeech() {
    if (db.currentAudio) {
      db.currentAudio.pause();
      db.currentAudio.src = "";
    }
    if (db.currentAudioUrl) URL.revokeObjectURL(db.currentAudioUrl);
    db.currentAudio = null;
    db.currentAudioUrl = "";
    db.currentSpeakButton = null;
    resetSpeakButtons();
  }

  async function speakText(content, button) {
    if (button && db.currentSpeakButton === button && db.currentAudio && !db.currentAudio.paused) {
      stopSpeech();
      return;
    }

    const text = speechText(content);
    if (!text) return;
    const cacheId = await speechCacheId(text);

    stopSpeech();
    if (button) {
      button.disabled = true;
      button.textContent = "...";
      button.title = "Preparing AI voice";
    }

    try {
      let blob = await getCachedSpeech(cacheId);
      if (!blob) {
        const res = await apiFetch(`${apiBase}/api/chatbot-tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: db.ttsVoice, profile })
        });
        const data = res.ok ? null : await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.detail || "AI voice failed");

        blob = await res.blob();
        await putCachedSpeech(cacheId, blob);
        await trimCachedSpeech(ttsCacheMax);
      }

      if (!blob.size) throw new Error("AI voice returned no audio");

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      db.currentAudio = audio;
      db.currentAudioUrl = url;
      db.currentSpeakButton = button || null;

      audio.addEventListener("ended", stopSpeech, { once: true });
      audio.addEventListener("error", stopSpeech, { once: true });

      if (button) {
        button.disabled = false;
        button.classList.add("playing");
        button.textContent = "■";
        button.title = "Stop AI voice";
      }

      await audio.play();
    } catch (err) {
      stopSpeech();
      if (button) {
        button.disabled = false;
        button.textContent = "!";
        button.title = err.message || "AI voice failed";
        setTimeout(() => {
          button.textContent = "▶";
          button.title = "Play AI voice";
        }, 1400);
      }
    }
  }

  function makeActionButton(label, title, onClick, extraClass = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `copy-btn${extraClass ? ` ${extraClass}` : ""}`;
    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.addEventListener("click", onClick);
    return button;
  }

  function appendMessageActions(bubble, content, meta = {}) {
    const actions = document.createElement("div");
    actions.className = "message-actions";

    const copy = makeActionButton("⧉", "Copy message", async () => {
      await navigator.clipboard.writeText(content || "");
      copy.textContent = "✓";
      setTimeout(() => {
        copy.textContent = "⧉";
      }, 1200);
    });

    if (meta.role === "assistant") {
      const speak = makeActionButton("▶", "Play AI voice", () => speakText(content, speak), "speak-btn");
      actions.append(speak);
    }

    actions.append(copy);

    if (Number.isInteger(meta.index)) {
      const edit = makeActionButton("✎", "Edit message", () => editMessage(meta.index));
      const retry = makeActionButton("↻", "Retry from here", () => retryFrom(meta.index));
      const branch = makeActionButton("⎇", "Branch from here", () => branchFrom(meta.index));
      const del = makeActionButton("×", "Delete message", () => deleteMessage(meta.index), "danger-btn");
      actions.append(edit, retry);
      if (meta.role === "assistant") {
        actions.append(makeActionButton("+", "Continue answer", () => continueFrom(meta.index)));
      }
      actions.append(branch, del);
    }

    bubble.appendChild(actions);
  }

  function appendCopyOnlyAction(bubble, content) {
    const actions = document.createElement("div");
    actions.className = "message-actions";
    const copy = makeActionButton("⧉", "Copy message", async () => {
      await navigator.clipboard.writeText(content || "");
      copy.textContent = "✓";
      setTimeout(() => {
        copy.textContent = "⧉";
      }, 1200);
    });
    actions.append(copy);
    bubble.appendChild(actions);
  }

  function closeMenus(except) {
    document.querySelectorAll(".menu.show").forEach((menu) => {
      if (menu !== except) menu.classList.remove("show");
    });
    if (!except) db.currentMenu = null;
  }

  function renderConversations() {
    const q = String(el.search.value || "").toLowerCase().trim();
    el.conversationList.innerHTML = "";

    db.convos
      .slice()
      .filter((conv) => ensureConversation(conv).projectId === db.activeProjectId)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .filter((conv) => {
        if (!q) return true;
        return (conv.title || "").toLowerCase().includes(q) || transcript(conv).toLowerCase().includes(q);
      })
      .forEach((conv) => {
        const row = document.createElement("div");
        row.className = `conversation-row${conv.id === db.activeId ? " active" : ""}`;

        const top = document.createElement("div");
        top.className = "conversation-row-top";

        const title = document.createElement("div");
        title.className = "conversation-title";
        title.textContent = conv.title || "(new conversation)";

        const menuWrap = document.createElement("div");
        menuWrap.className = "menu-wrap";

        const menuBtn = document.createElement("button");
        menuBtn.type = "button";
        menuBtn.className = "menu-button";
        menuBtn.textContent = "⋯";

        const menu = document.createElement("div");
        menu.className = "menu";

        const download = document.createElement("button");
        download.type = "button";
        download.textContent = "Download transcript";
        download.addEventListener("click", (event) => {
          event.stopPropagation();
          const blob = new Blob([transcript(conv)], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${(conv.title || "conversation").replace(/[^\w\-]+/g, "_")}.txt`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          menu.classList.remove("show");
        });

        const del = document.createElement("button");
        del.type = "button";
        del.className = "danger";
        del.textContent = "Delete conversation";
        del.addEventListener("click", (event) => {
          event.stopPropagation();
          db.convos = db.convos.filter((item) => item && item.id !== conv.id);
          if (db.activeId === conv.id) {
            db.activeId = db.convos[0]?.id || "";
            if (!db.activeId) {
              db.convos.unshift(newConversation("GPT 5.5"));
              db.activeId = db.convos[0].id;
            }
          }
          save();
          renderSidebar();
          renderChat();
          menu.classList.remove("show");
        });

        menu.append(download, del);
        menuBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          closeMenus(menu);
          menu.classList.toggle("show");
          db.currentMenu = menu;
        });

        menuWrap.append(menuBtn, menu);
        top.append(title, menuWrap);

        const meta = document.createElement("div");
        meta.className = "conversation-meta";
        meta.textContent = `${(conv.messages || []).length} messages • ${new Date(conv.updatedAt || conv.createdAt || Date.now()).toLocaleDateString()}`;

        row.append(top, meta);
        row.addEventListener("click", (event) => {
          if (event.target.closest(".menu-wrap")) return;
          db.activeId = conv.id;
          save();
          renderSidebar();
          renderChat();
        });

        el.conversationList.appendChild(row);
      });

    if (!el.conversationList.children.length) {
      const empty = document.createElement("div");
      empty.className = "conversation-row";
      empty.innerHTML = `<div class="conversation-title">No matches</div><div class="conversation-meta">Try a different search or start a new chat.</div>`;
      el.conversationList.appendChild(empty);
    }
  }

  function renderSidebar() {
    renderProjects();
    renderConversations();
    renderWorkspaceFiles();
  }

  function renderProjects() {
    el.projectSelect.innerHTML = "";
    db.projects.forEach((project) => {
      const option = document.createElement("option");
      option.value = project.id;
      option.textContent = project.title;
      el.projectSelect.appendChild(option);
    });
    el.projectSelect.value = db.activeProjectId;
    el.projectNotes.value = getActiveProject()?.notes || "";
  }

  function updateResearchToggle() {
    el.researchToggle.classList.toggle("active", db.researchMode);
    el.researchToggle.setAttribute("aria-pressed", db.researchMode ? "true" : "false");
  }

  function libraryText(items = []) {
    return items
      .map((item, index) => {
        const tags = Array.isArray(item.tags) && item.tags.length ? `\nTags: ${item.tags.join(", ")}` : "";
        return `Saved knowledge ${index + 1}: ${item.title}${tags}\n${String(item.content || "").slice(0, 5000)}`;
      })
      .join("\n\n")
      .slice(0, libraryContextMax);
  }

  function renderLibraryList() {
    el.libraryList.innerHTML = "";
    if (!db.libraryItems.length) {
      const empty = document.createElement("div");
      empty.className = "workspace-empty";
      empty.textContent = "No matching knowledge yet.";
      el.libraryList.appendChild(empty);
      return;
    }

    db.libraryItems.slice(0, 8).forEach((item) => {
      const row = document.createElement("div");
      row.className = "library-item";
      const copy = document.createElement("div");
      copy.innerHTML = `<strong>${esc(item.title || "Knowledge")}</strong><span>${esc(item.projectTitle || item.kind || "saved")}</span>`;

      const use = document.createElement("button");
      use.type = "button";
      use.className = "menu-button";
      use.textContent = "+";
      use.title = "Add to this chat";
      use.addEventListener("click", () => {
        const convo = getActive();
        ensureConversation(convo);
        convo.files.push({
          id: uid(),
          title: item.title,
          names: [item.title],
          createdAt: nowISO(),
          context: item.content || ""
        });
        save();
        renderWorkspaceFiles();
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "menu-button danger-btn";
      remove.textContent = "×";
      remove.title = "Delete knowledge";
      remove.addEventListener("click", async () => {
        await apiFetch(`${apiBase}/api/chatbot-library/${encodeURIComponent(item.id)}`, { method: "DELETE" });
        await loadLibrary();
      });

      row.append(copy, use, remove);
      el.libraryList.appendChild(row);
    });
  }

  async function loadLibrary(query = el.librarySearch.value || "") {
    const params = new URLSearchParams({
      q: query,
      projectId: db.activeProjectId,
      limit: "40"
    });
    const res = await apiFetch(`${apiBase}/api/chatbot-library?${params.toString()}`, { method: "GET" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Could not load library");
    db.libraryItems = Array.isArray(data.items) ? data.items : [];
    renderLibraryList();
    return db.libraryItems;
  }

  async function getLibraryContext(query) {
    try {
      const items = await loadLibrary(query);
      return libraryText(items.slice(0, 6));
    } catch {
      return "";
    }
  }

  function transcript(convo) {
    return (convo.messages || [])
      .map((msg) => `${String(msg.role || "assistant").toUpperCase()}: ${msg.content || ""}`)
      .join("\n\n");
  }

  async function addStoredImagePreview(bubble, imageId) {
    const item = await getStoredImage(imageId);
    if (!item?.url || !bubble.isConnected) return;

    const img = document.createElement("img");
    img.src = item.url;
    img.alt = item.prompt || "Generated image";
    img.style.width = "100%";
    img.style.borderRadius = "18px";
    img.style.cursor = "pointer";
    img.style.marginBottom = "12px";
    img.addEventListener("click", () => openModal(item.url));
    bubble.prepend(img);
  }

  function appendBubble(role, content, meta = {}) {
    const bubble = document.createElement("div");
    bubble.className = `message ${role}`;
    bubble.dataset.raw = content;
    bubble.innerHTML = pretty(content);
    if (role === "assistant" && meta.imageId) addStoredImagePreview(bubble, meta.imageId);

    if (role === "assistant" && Array.isArray(meta.sources) && meta.sources.length) {
      const sources = document.createElement("div");
      sources.className = "source-rail";
      meta.sources.forEach((source) => {
        if (!source || !source.url) return;
        const link = document.createElement("a");
        link.className = "source-chip";
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = source.title || source.url;
        sources.appendChild(link);
      });
      if (sources.childElementCount) bubble.appendChild(sources);
    }

    if (role === "assistant" || role === "user") {
      appendMessageActions(bubble, content, { ...meta, role });
    }

    el.messages.appendChild(bubble);
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  function appendSources(container, sources = []) {
    if (!Array.isArray(sources) || !sources.length || !container) return;
    const rail = document.createElement("div");
    rail.className = "source-rail";

    sources.forEach((source) => {
      if (!source || !source.url) return;
      const link = document.createElement("a");
      link.className = "source-chip";
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = source.title || source.url;
      rail.appendChild(link);
    });

    if (rail.childElementCount) container.appendChild(rail);
  }

  function showThinking(label) {
    const wrap = document.createElement("div");
    const bubble = document.createElement("div");
    bubble.className = "message assistant";
    bubble.innerHTML = `<div class="think"><span class="wave"><i></i><i></i><i></i></span><span>${esc(label || "Thinking...")}</span></div>`;
    wrap.appendChild(bubble);
    el.messages.appendChild(wrap);
    el.messages.scrollTop = el.messages.scrollHeight;
    return {
      wrap,
      replace(content, meta = {}) {
        bubble.dataset.raw = content;
        bubble.innerHTML = `<div>${pretty(content)}</div>`;
        appendSources(bubble, meta.sources);
        appendMessageActions(bubble, content, { ...meta, role: "assistant" });
      },
      update(content) {
        bubble.dataset.raw = content;
        bubble.innerHTML = `<div>${pretty(content || "Thinking...")}</div>`;
      }
    };
  }

  function showFileReview(label, detail) {
    const wrap = document.createElement("div");
    const bubble = document.createElement("div");
    bubble.className = "message assistant file-review";
    bubble.innerHTML = `
      <div class="file-review-orb" aria-hidden="true">
        <i></i><i></i><i></i><i></i>
      </div>
      <div class="file-review-copy">
        <div class="file-review-title">${esc(label || "Reading uploaded file")}</div>
        <div class="file-review-detail">${esc(detail || "Checking images, text, and structure...")}</div>
      </div>`;
    wrap.appendChild(bubble);
    el.messages.appendChild(wrap);
    el.messages.scrollTop = el.messages.scrollHeight;
    return {
      wrap,
      remove() {
        if (wrap.parentNode) wrap.remove();
      }
    };
  }

  function resizeInput() {
    el.input.style.height = "auto";
    el.input.style.height = `${Math.min(el.input.scrollHeight, 180)}px`;
  }

  function focusComposer() {
    try {
      el.input.focus({ preventScroll: true });
    } catch {
      el.input.focus();
    }
  }

  function openModal(src) {
    el.modalImage.src = src;
    el.modal.classList.add("show");
    el.modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    el.modal.classList.remove("show");
    el.modal.setAttribute("aria-hidden", "true");
    el.modalImage.src = "";
  }

  async function openImageDb() {
    if (!("indexedDB" in window)) return null;
    if (db.imageDbPromise) return db.imageDbPromise;
    db.imageDbPromise = new Promise((resolve) => {
      const req = indexedDB.open(imageDbName, 2);
      req.onupgradeneeded = (event) => {
        const database = event.target.result;
        if (!database.objectStoreNames.contains(imageStore)) {
          database.createObjectStore(imageStore, { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains(ttsStore)) {
          database.createObjectStore(ttsStore, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    return db.imageDbPromise;
  }

  async function speechCacheId(text) {
    const value = `${ttsCacheVersion}|${db.ttsVoice}|${text}`;
    if (window.crypto?.subtle && window.TextEncoder) {
      const bytes = new TextEncoder().encode(value);
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }
    return value.split("").reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0).toString(16);
  }

  async function getCachedSpeech(id) {
    const database = await openImageDb();
    if (!database || !database.objectStoreNames.contains(ttsStore)) return null;
    return new Promise((resolve) => {
      const tx = database.transaction(ttsStore, "readwrite");
      const store = tx.objectStore(ttsStore);
      const req = store.get(id);
      req.onsuccess = () => {
        const item = req.result;
        if (!item?.blob) {
          resolve(null);
          return;
        }
        item.lastUsedAt = nowISO();
        store.put(item);
        resolve(item.blob);
      };
      req.onerror = () => resolve(null);
    });
  }

  async function putCachedSpeech(id, blob) {
    const database = await openImageDb();
    if (!database || !database.objectStoreNames.contains(ttsStore)) return;
    return new Promise((resolve) => {
      const tx = database.transaction(ttsStore, "readwrite");
      tx.objectStore(ttsStore).put({
        id,
        blob,
        createdAt: nowISO(),
        lastUsedAt: nowISO()
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  async function trimCachedSpeech(max) {
    const database = await openImageDb();
    if (!database || !database.objectStoreNames.contains(ttsStore)) return;
    await new Promise((resolve) => {
      const tx = database.transaction(ttsStore, "readwrite");
      const store = tx.objectStore(ttsStore);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = req.result || [];
        items
          .sort((a, b) => new Date(b.lastUsedAt || b.createdAt || 0) - new Date(a.lastUsedAt || a.createdAt || 0))
          .slice(max)
          .forEach((item) => store.delete(item.id));
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  async function getStoredImages() {
    const database = await openImageDb();
    if (!database) return [];
    return new Promise((resolve) => {
      const tx = database.transaction(imageStore, "readonly");
      const req = tx.objectStore(imageStore).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async function getStoredImage(id) {
    if (!id) return null;
    const database = await openImageDb();
    if (!database) return null;
    return new Promise((resolve) => {
      const tx = database.transaction(imageStore, "readonly");
      const req = tx.objectStore(imageStore).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async function getLatestStoredImage() {
    const items = await getStoredImages();
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return items[0] || null;
  }

  async function putStoredImage(entry) {
    const database = await openImageDb();
    if (!database) return;
    return new Promise((resolve) => {
      const tx = database.transaction(imageStore, "readwrite");
      tx.objectStore(imageStore).put(entry);
      tx.oncomplete = () => resolve();
    });
  }

  async function clearStoredImages() {
    const database = await openImageDb();
    if (!database) return;
    return new Promise((resolve) => {
      const tx = database.transaction(imageStore, "readwrite");
      tx.objectStore(imageStore).clear();
      tx.oncomplete = () => resolve();
    });
  }

  async function trimStoredImages(max) {
    const database = await openImageDb();
    if (!database) return;
    const items = await getStoredImages();
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const overflow = items.slice(max);
    if (!overflow.length) return;
    await new Promise((resolve) => {
      const tx = database.transaction(imageStore, "readwrite");
      const store = tx.objectStore(imageStore);
      overflow.forEach((item) => store.delete(item.id));
      tx.oncomplete = () => resolve();
    });
  }

  async function renderRecentImages() {
    if (!el.recentImages) return;
    const items = await getStoredImages();
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    el.recentImages.innerHTML = "";

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "conversation-row";
      empty.innerHTML = `<div class="conversation-title">Nothing yet</div><div class="conversation-meta">Generated images will appear here.</div>`;
      el.recentImages.appendChild(empty);
      return;
    }

    items.slice(0, 8).forEach((item) => {
      const img = document.createElement("img");
      img.className = "recent-image";
      img.src = item.url;
      img.alt = item.prompt || "Recent generated image";
      img.addEventListener("click", () => openModal(item.url));
      el.recentImages.appendChild(img);
    });
  }

  async function rememberImage(url, meta = {}) {
    const entry = {
      id: uid(),
      url,
      prompt: String(meta.prompt || "").slice(0, 4000),
      sourcePrompt: String(meta.sourcePrompt || "").slice(0, 4000),
      revisionInstruction: String(meta.revisionInstruction || "").slice(0, 1200),
      createdAt: nowISO()
    };
    await putStoredImage(entry);
    await trimStoredImages(24);
    await renderRecentImages();
    return entry;
  }

  function renderAttachments() {
    el.attachmentPreview.innerHTML = "";
    if (!db.pendingFiles.length) {
      el.attachmentPreview.classList.remove("has-files");
      return;
    }

    el.attachmentPreview.classList.add("has-files");
    db.pendingFiles.forEach((file, index) => {
      const item = document.createElement("div");
      item.className = "attachment-item";

      if (file.type.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.alt = file.name;
        img.addEventListener("click", () => openModal(img.src));
        item.appendChild(img);
      } else {
        const icon = document.createElement("div");
        icon.className = "pdf-icon";
        icon.textContent = "PDF";
        item.appendChild(icon);
      }

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-attach";
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        db.pendingFiles.splice(index, 1);
        renderAttachments();
      });
      item.appendChild(remove);
      el.attachmentPreview.appendChild(item);
    });
  }

  function workspaceContext(convo) {
    ensureConversation(convo);
    const parts = (convo.files || [])
      .filter((file) => file && file.context)
      .slice(-8)
      .map((file, index) => {
        const title = file.title || (Array.isArray(file.names) ? file.names.join(", ") : "Uploaded file");
        return `File ${index + 1}: ${title}\nUploaded: ${file.createdAt || "unknown"}\n${String(file.context || "").slice(0, 10000)}`;
      });
    return parts.join("\n\n").slice(0, workspaceContextMax);
  }

  function rememberWorkspaceFiles(convo, files, uploaded) {
    ensureConversation(convo);
    const names = files.map((file) => file.name || "uploaded file");
    const context = String(uploaded?.context || "").trim();
    if (!context) return;
    convo.files.push({
      id: uid(),
      title: names.length === 1 ? names[0] : `${names.length} files`,
      names,
      bytes: files.reduce((sum, file) => sum + Number(file.size || 0), 0),
      createdAt: nowISO(),
      context: context.slice(0, 18000)
    });
    convo.files = convo.files.slice(-12);
    save();
    renderWorkspaceFiles();
  }

  function renderWorkspaceFiles() {
    const convo = getActive();
    ensureConversation(convo);
    el.workspaceFiles.innerHTML = "";

    if (!convo.files.length) {
      const empty = document.createElement("div");
      empty.className = "workspace-empty";
      empty.textContent = "No files in this chat.";
      el.workspaceFiles.appendChild(empty);
      return;
    }

    convo.files.slice().reverse().forEach((file) => {
      const item = document.createElement("div");
      item.className = "workspace-file";

      const copy = document.createElement("div");
      copy.innerHTML = `<strong>${esc(file.title || "Uploaded file")}</strong><span>${esc(new Date(file.createdAt || Date.now()).toLocaleDateString())}</span>`;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "menu-button";
      remove.textContent = "×";
      remove.title = "Remove file from chat";
      remove.addEventListener("click", () => {
        convo.files = convo.files.filter((itemFile) => itemFile.id !== file.id);
        save();
        renderWorkspaceFiles();
      });

      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "menu-button";
      saveBtn.textContent = "★";
      saveBtn.title = "Save file to library";
      saveBtn.addEventListener("click", async () => {
        try {
          await saveKnowledge({
            title: file.title || "Uploaded file",
            content: file.context || "",
            kind: "file",
            source: "chat upload",
            tags: ["upload"]
          });
        } catch (err) {
          appendBubble("assistant", `Could not save file to library: ${err.message || err}`);
        }
      });

      item.append(copy, saveBtn, remove);
      el.workspaceFiles.appendChild(item);
    });
  }

  async function extractPdfText(file) {
    const buffer = await file.arrayBuffer();
    if (!window.pdfjsLib) {
      await loadPdfJs();
    }
    if (!window.pdfjsLib) return "";
    const doc = await window.pdfjsLib.getDocument({ data: buffer }).promise;
    let text = "";
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      text += (content.items || []).map((item) => item.str || "").join(" ") + "\n";
    }
    return text.trim();
  }

  async function loadPdfJs() {
    if (window.pdfjsLib) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    }).catch(() => {});
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
  }

  async function uploadFiles(files) {
    const fd = new FormData();
    fd.append("profile", profile);
    files.forEach((file) => fd.append("files", file, file.name));

    const res = await apiFetch(`${apiBase}/upload`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Upload failed");

    const parts = [];
    if (data.summary) parts.push(`Summary:\n${data.summary}`);
    if (data.description) parts.push(`Visual notes:\n${data.description}`);
    if (data.text) parts.push(`Extracted text:\n${data.text}`);
    if (Array.isArray(data.imageAnalysis) && data.imageAnalysis.length) {
      const first = data.imageAnalysis[0] || {};
      const imageParts = [
        first.short_reply ? `Short reply: ${first.short_reply}` : "",
        first.scene_summary ? `Scene summary: ${first.scene_summary}` : "",
        first.likely_user_need ? `Likely user need: ${first.likely_user_need}` : ""
      ].filter(Boolean);
      if (imageParts.length) parts.push(`Image analysis:\n${imageParts.join("\n")}`);
    }

    return {
      raw: data,
      context: parts.join("\n\n").trim()
    };
  }

  async function readSseResponse(res, onDelta) {
    if (!res.body) {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Chat failed");
      return data;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || "Chat failed");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalData = { reply: "", sources: [] };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";

      chunks.forEach((chunk) => {
        const event = (chunk.match(/^event:\s*(.+)$/m) || [])[1] || "message";
        const dataLine = (chunk.match(/^data:\s*(.+)$/m) || [])[1] || "{}";
        const data = JSON.parse(dataLine);
        if (event === "delta" && data.delta) onDelta(data.delta);
        if (event === "done") finalData = data;
        if (event === "error") throw new Error(data.detail || "Streaming failed");
      });
    }

    return finalData;
  }

  function parseGeneratedImagePrompt(content) {
    const text = String(content || "");
    if (!/\[Generated Image\]/i.test(text)) return "";
    const match = text.match(/Prompt:\s*([\s\S]*?)(?:\n(?:Revision request|Previous prompt|Source prompt):|$)/i);
    return String(match?.[1] || "").trim();
  }

  function updateVisualMemory(convo, memory = {}) {
    ensureConversation(convo);
    convo.visualMemory = {
      kind: "generated-image",
      imageId: String(memory.imageId || ""),
      prompt: String(memory.prompt || "").slice(0, 4000),
      sourcePrompt: String(memory.sourcePrompt || "").slice(0, 4000),
      revisionInstruction: String(memory.revisionInstruction || "").slice(0, 1200),
      updatedAt: nowISO()
    };
  }

  function latestVisualMemory(convo) {
    ensureConversation(convo);
    for (let index = convo.messages.length - 1; index >= 0; index -= 1) {
      const msg = convo.messages[index];
      if (!msg || msg.role !== "assistant") continue;
      const prompt = String(msg.imagePrompt || parseGeneratedImagePrompt(msg.content) || "");
      if (!msg.imageId && !prompt) continue;
      return {
        imageId: String(msg.imageId || convo.visualMemory?.imageId || ""),
        prompt: (prompt || convo.visualMemory?.prompt || "").slice(0, 4000),
        sourcePrompt: String(msg.sourcePrompt || convo.visualMemory?.sourcePrompt || "").slice(0, 4000),
        revisionInstruction: String(msg.revisionInstruction || convo.visualMemory?.revisionInstruction || "").slice(0, 1200),
        index
      };
    }
    if (!convo.messages.length && (convo.visualMemory?.prompt || convo.visualMemory?.imageId)) {
      return {
        ...convo.visualMemory,
        index: -1
      };
    }
    return null;
  }

  function userTurnsSinceVisual(convo, memory) {
    if (!memory || !Number.isInteger(memory.index) || memory.index < 0) return 0;
    return convo.messages.slice(memory.index + 1).filter((msg) => msg?.role === "user").length;
  }

  function hasVisualReference(text) {
    return /\b(it|this|that|same|previous|last|image|picture|photo|scene|art|artwork|her|him|them|background|foreground)\b/i.test(String(text || ""));
  }

  function hasVisualEditIntent(text) {
    return /\b(add|remove|change|make|turn|replace|edit|revise|update|redo|regenerate|draw|create|put|place|give|keep|move|color|recolor|style|stylize|zoom|crop|blend|fix)\b/i.test(String(text || ""));
  }

  function hasStrongVisualEditIntent(text) {
    return /\b(add|remove|replace|edit|revise|redo|regenerate|draw|recolor|stylize|zoom|crop|blend)\b/i.test(String(text || ""));
  }

  function hasVisualSpecificDetail(text) {
    return /\b(background|foreground|hair|eyes|face|shirt|dress|hat|person|woman|man|girl|boy|cat|dog|color|lighting|pose|style|scene|watercolor|comic|cinematic|anime|pixel|noir|oil painting)\b/i.test(String(text || ""));
  }

  function hasLikelyVisualContextIntent(text) {
    return hasVisualReference(text) || hasStrongVisualEditIntent(text) || hasVisualSpecificDetail(text);
  }

  function looksLikeDiscussionOnly(text) {
    const value = String(text || "").trim();
    if (!/^(what|how|why|where|when|who|should)\b/i.test(value)) return false;
    return !/\b(add|remove|make|edit|revise|generate|draw|create|replace|redo|regenerate)\b/i.test(value);
  }

  function isImageRevisionRequest(promptText, convo) {
    const text = String(promptText || "").trim();
    if (!text || text.startsWith("/")) return false;
    if (looksLikeDiscussionOnly(text)) return false;
    const memory = latestVisualMemory(convo);
    if (!memory?.prompt && !memory?.imageId) return false;
    const turns = userTurnsSinceVisual(convo, memory);
    if (turns > 3 && !hasVisualReference(text)) return false;
    return hasVisualEditIntent(text) && (
      hasVisualReference(text)
      || hasStrongVisualEditIntent(text)
      || (turns <= 1 && hasVisualSpecificDetail(text))
    );
  }

  function buildVisualContext(convo, promptText) {
    const memory = latestVisualMemory(convo);
    if (!memory?.prompt && !memory?.imageId) return "";
    const turns = userTurnsSinceVisual(convo, memory);
    if (turns > 1 && !hasLikelyVisualContextIntent(promptText)) return "";
    if (turns > 3 && !hasVisualReference(promptText)) return "";

    return [
      "Recent visual context:",
      "The user may be referring to the latest generated image when they say it, this, that, the picture, the image, her, him, them, or the scene.",
      memory.prompt ? `Latest image prompt: ${memory.prompt.slice(0, visualMemoryMax)}` : "",
      memory.sourcePrompt ? `Previous prompt before the latest revision: ${memory.sourcePrompt.slice(0, visualMemoryMax)}` : "",
      memory.revisionInstruction ? `Most recent requested image change: ${memory.revisionInstruction}` : "",
      "If the current request is a visual follow-up, resolve short references against this latest image unless the user clearly changed topics."
    ].filter(Boolean).join("\n");
  }

  function generatedImageContent(prompt, revisionInstruction = "") {
    return [
      "[Generated Image]",
      `Prompt: ${prompt}`,
      revisionInstruction ? `Revision request: ${revisionInstruction}` : ""
    ].filter(Boolean).join("\n");
  }

  function buildRevisionPrompt(memory, instruction) {
    return [
      "Create a revised version of the latest generated image.",
      memory.prompt ? `Latest image prompt: ${memory.prompt}` : "",
      memory.sourcePrompt ? `Earlier source prompt: ${memory.sourcePrompt}` : "",
      `User's requested change: ${instruction}`,
      "Preserve the same main subject, composition, mood, and style unless the requested change explicitly says otherwise. Apply the requested change clearly."
    ].filter(Boolean).join("\n");
  }

  function dataUrlToBlob(dataUrl) {
    const match = String(dataUrl || "").match(/^data:([^;,]+)?(;base64)?,(.*)$/);
    if (!match) return null;
    const mime = match[1] || "image/png";
    const encoded = match[3] || "";
    if (match[2]) {
      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    }
    return new Blob([decodeURIComponent(encoded)], { type: mime });
  }

  async function composeAssistantInput(convo, promptText) {
    const project = getActiveProject();
    const filesContext = workspaceContext(convo);
    const knowledgeContext = await getLibraryContext(promptText || project?.title || "");
    const visualContext = buildVisualContext(convo, promptText);
    return [
      String(promptText || "Please continue.").trim(),
      visualContext,
      project ? `Project workspace:\nName: ${project.title}\nNotes: ${project.notes || "(none)"}` : "",
      filesContext ? `Conversation file workspace:\n${filesContext}` : "",
      knowledgeContext ? `Saved knowledge library:\n${knowledgeContext}` : ""
    ].filter(Boolean).join("\n\n");
  }

  async function runDeepResearch(convo, question, thinking) {
    const project = getActiveProject();
    const library = await getLibraryContext(question);
    const history = convo.messages.slice(-maxHistory, -1).map((msg) => ({ role: msg.role, content: msg.content }));
    const res = await apiFetch(`${apiBase}/api/deep-research`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        history,
        profile,
        projectId: db.activeProjectId,
        projectTitle: project?.title || "",
        projectNotes: project?.notes || "",
        library
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Deep research failed");
    const reply = data.reply || "(no report)";
    const assistantIndex = convo.messages.length;
    thinking.replace(reply, { index: assistantIndex, sources: data.sources || [] });
    convo.messages.push({ role: "assistant", content: reply, sources: data.sources || [] });
    convo.updatedAt = nowISO();
    save();
    renderSidebar();
    if (db.ttsEnabled) speakText(reply);
    return reply;
  }

  async function requestAssistant(convo, input, thinking) {
    const history = convo.messages.slice(-maxHistory, -1).map((msg) => ({ role: msg.role, content: msg.content }));
    let streamed = "";

    try {
      const res = await apiFetchWithRetry(`${apiBase}/api/chat-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, history, profile })
      });
      const data = await readSseResponse(res, (delta) => {
        streamed += delta;
        thinking.update(streamed);
      });
      const reply = data.reply || streamed || "(no reply)";
      const assistantIndex = convo.messages.length;
      thinking.replace(reply, { index: assistantIndex, sources: data.sources || [] });
      convo.messages.push({ role: "assistant", content: reply, sources: data.sources || [] });
      convo.updatedAt = nowISO();
      save();
      renderSidebar();
      if (db.ttsEnabled) speakText(reply);
      return reply;
    } catch (streamErr) {
      const res = await apiFetchWithRetry(`${apiBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, history, profile })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || streamErr.message || "Chat failed");
      const reply = data.reply || data.detail || "(no reply)";
      const assistantIndex = convo.messages.length;
      thinking.replace(reply, { index: assistantIndex, sources: data.sources || [] });
      convo.messages.push({ role: "assistant", content: reply, sources: data.sources || [] });
      convo.updatedAt = nowISO();
      save();
      renderSidebar();
      if (db.ttsEnabled) speakText(reply);
      return reply;
    }
  }

  async function readImagePayload(res, fallback = "Generation failed") {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || fallback);
    const b64 = String(data.image_b64 || "");
    if (!b64) throw new Error("The image service returned no image.");
    return b64;
  }

  function renderGeneratedImage(src, prompt, loader) {
    const bubble = document.createElement("div");
    bubble.className = "message assistant";
    const img = document.createElement("img");
    img.src = src;
    img.alt = prompt;
    img.style.width = "100%";
    img.style.borderRadius = "18px";
    img.style.cursor = "pointer";
    img.addEventListener("click", () => openModal(src));
    bubble.appendChild(img);
    el.messages.replaceChild(bubble, loader);
  }

  async function generateImage(prompt, convo) {
    const loader = document.createElement("div");
    loader.className = "message assistant";
    loader.innerHTML = `<strong>Generating image...</strong><div class="conversation-meta">Prompt: ${esc(prompt)}</div>`;
    el.messages.appendChild(loader);
    el.messages.scrollTop = el.messages.scrollHeight;

    try {
      const res = await apiFetchWithRetry(`${apiBase}/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, size: "1024x1024", profile })
      });
      const b64 = await readImagePayload(res);
      const src = `data:image/png;base64,${b64}`;
      const entry = await rememberImage(src, { prompt });

      renderGeneratedImage(src, prompt, loader);
      convo.messages.push({
        role: "assistant",
        content: generatedImageContent(prompt),
        imageId: entry.id,
        imagePrompt: prompt
      });
      updateVisualMemory(convo, { imageId: entry.id, prompt });
      convo.updatedAt = nowISO();
      save();
      renderSidebar();
    } catch (err) {
      loader.innerHTML = `<span style="color:#ffb9b9;">Generation failed: ${esc(err.message || err)}</span>`;
    }
  }

  async function generateImageRevision(instruction, convo) {
    const memory = latestVisualMemory(convo);
    const prompt = buildRevisionPrompt(memory || {}, instruction);
    const loader = document.createElement("div");
    loader.className = "message assistant";
    loader.innerHTML = `<strong>Editing image...</strong><div class="conversation-meta">${esc(instruction)}</div>`;
    el.messages.appendChild(loader);
    el.messages.scrollTop = el.messages.scrollHeight;

    try {
      let b64 = "";
      let editError = null;
      const reference = await getStoredImage(memory?.imageId) || await getLatestStoredImage();
      const referenceBlob = dataUrlToBlob(reference?.url);

      if (referenceBlob) {
        try {
          const fd = new FormData();
          fd.append("prompt", prompt);
          fd.append("size", "1024x1024");
          fd.append("quality", "high");
          fd.append("refs", referenceBlob, "latest-image.png");
          const editRes = await apiFetchWithRetry(`${apiBase}/generate-image-edit`, {
            method: "POST",
            body: fd
          });
          b64 = await readImagePayload(editRes, "Image edit failed");
        } catch (err) {
          editError = err;
        }
      }

      if (!b64) {
        const fallbackPrompt = [
          prompt,
          editError ? "Reference-image editing was unavailable, so recreate the scene from the prompt and requested change as closely as possible." : ""
        ].filter(Boolean).join("\n");
        const res = await apiFetchWithRetry(`${apiBase}/generate-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: fallbackPrompt, size: "1024x1024", profile })
        });
        b64 = await readImagePayload(res);
      }

      const src = `data:image/png;base64,${b64}`;
      const entry = await rememberImage(src, {
        prompt,
        sourcePrompt: memory?.prompt || "",
        revisionInstruction: instruction
      });

      renderGeneratedImage(src, prompt, loader);
      convo.messages.push({
        role: "assistant",
        content: generatedImageContent(prompt, instruction),
        imageId: entry.id,
        imagePrompt: prompt,
        sourcePrompt: memory?.prompt || "",
        revisionInstruction: instruction
      });
      updateVisualMemory(convo, {
        imageId: entry.id,
        prompt,
        sourcePrompt: memory?.prompt || "",
        revisionInstruction: instruction
      });
      convo.updatedAt = nowISO();
      save();
      renderSidebar();
    } catch (err) {
      loader.innerHTML = `<span style="color:#ffb9b9;">Image edit failed: ${esc(err.message || err)}</span>`;
    }
  }

  async function initialGreeting(convo) {
    if (!convo || convo.greeted) return;
    const thinking = showThinking("Thinking...");

    try {
      const res = await apiFetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: "[system_greet]",
          history: [],
          profile
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Please refresh and unlock the chatbot again.");
      const reply = data.reply || "Hello. How can I help today?";
      thinking.replace(reply, { index: convo.messages.length });
      convo.greeted = true;
      convo.messages.push({ role: "assistant", content: reply });
      convo.updatedAt = nowISO();
      save();
      renderSidebar();
    } catch (err) {
      convo.greeted = false;
      save();
      thinking.replace(`Error: ${err.message || "Please refresh and unlock the chatbot again."}`);
    }
  }

  function renderChat() {
    el.messages.innerHTML = "";
    const convo = getActive();
    if (!convo.messages || !convo.messages.length) {
      convo.greeted = false;
      save();
      initialGreeting(convo);
      return;
    }
    convo.messages.forEach((msg, index) => appendBubble(msg.role, msg.content, {
      index,
      sources: msg.sources || [],
      imageId: msg.imageId || ""
    }));
  }

  async function sendMessage() {
    const convo = getActive();
    const raw = String(el.input.value || "").trim();
    if (!raw && !db.pendingFiles.length) return;

    el.input.value = "";
    resizeInput();
    setTitle(convo, raw || db.pendingFiles.map((file) => file.name).join(", "));

    let displayText = raw;
    const hadPendingFiles = db.pendingFiles.length > 0;

    if (db.pendingFiles.length) {
      const filesForWorkspace = db.pendingFiles.slice();
      const fileNames = db.pendingFiles.map((file) => file.name).join(", ");
      displayText = displayText ? `${displayText}\n\n(Attached: ${fileNames})` : `[Attached: ${fileNames}]`;
      const fileReview = showFileReview(
        db.pendingFiles.length === 1 ? "Reading your file" : `Reading ${db.pendingFiles.length} files`,
        "Checking the upload before I answer..."
      );
      try {
        const uploaded = await uploadFiles(db.pendingFiles);
        rememberWorkspaceFiles(convo, filesForWorkspace, uploaded);
      } catch (err) {
        fileReview.remove();
        appendBubble("assistant", `Upload failed: ${err.message || err}`);
      } finally {
        fileReview.remove();
      }
      db.pendingFiles = [];
      renderAttachments();
    }

    if (raw.startsWith("/image ")) {
      appendBubble("user", raw, { index: convo.messages.length });
      convo.messages.push({ role: "user", content: raw });
      convo.updatedAt = nowISO();
      save();
      renderSidebar();
      await generateImage(raw.slice(7).trim(), convo);
      return;
    }

    const shouldReviseImage = raw && !hadPendingFiles && !db.researchMode && isImageRevisionRequest(raw, convo);

    appendBubble("user", displayText || "(attachment only)", { index: convo.messages.length });
    convo.messages.push({ role: "user", content: raw || "[attachment only]" });
    convo.updatedAt = nowISO();
    save();
    renderSidebar();

    if (shouldReviseImage) {
      await generateImageRevision(raw, convo);
      return;
    }

    const thinking = showThinking("Thinking...");
    try {
      const basePrompt = raw || "Please analyze the uploaded file or continue from the current context.";
      if (db.researchMode) {
        await runDeepResearch(convo, basePrompt, thinking);
      } else {
        const input = await composeAssistantInput(convo, basePrompt);
        await requestAssistant(convo, input, thinking);
      }
    } catch (err) {
      thinking.replace(`Error: ${err.message || err}`);
    }
  }

  async function regenerateFrom(index, instruction) {
    const convo = getActive();
    ensureConversation(convo);
    const lastUserIndex = (() => {
      for (let i = Math.min(index, convo.messages.length - 1); i >= 0; i -= 1) {
        if (convo.messages[i]?.role === "user") return i;
      }
      return -1;
    })();
    if (lastUserIndex < 0) return;

    const userText = instruction || convo.messages[lastUserIndex].content || "";
    convo.messages = convo.messages.slice(0, lastUserIndex + 1);
    convo.updatedAt = nowISO();
    save();
    renderChat();
    renderSidebar();

    const thinking = showThinking("Thinking...");
    try {
      const input = await composeAssistantInput(convo, userText);
      await requestAssistant(convo, input, thinking);
    } catch (err) {
      thinking.replace(`Error: ${err.message || err}`);
    }
  }

  function editMessage(index) {
    const convo = getActive();
    const msg = convo.messages[index];
    if (!msg) return;
    const next = window.prompt("Edit message", msg.content || "");
    if (next === null) return;
    msg.content = next.trim();
    msg.sources = [];
    convo.updatedAt = nowISO();
    save();

    if (msg.role === "user") {
      regenerateFrom(index, next.trim());
      return;
    }

    renderChat();
    renderSidebar();
  }

  function retryFrom(index) {
    regenerateFrom(index);
  }

  async function continueFrom(index) {
    const convo = getActive();
    ensureConversation(convo);
    convo.messages = convo.messages.slice(0, index + 1);
    convo.messages.push({ role: "user", content: "Continue from your previous answer." });
    convo.updatedAt = nowISO();
    save();
    renderChat();
    renderSidebar();

    const thinking = showThinking("Thinking...");
    try {
      const input = await composeAssistantInput(convo, "Continue from your previous answer.");
      await requestAssistant(convo, input, thinking);
    } catch (err) {
      thinking.replace(`Error: ${err.message || err}`);
    }
  }

  function branchFrom(index) {
    const source = getActive();
    ensureConversation(source);
    const convo = newConversation(`${source.title || "Chat"} branch`);
    convo.messages = source.messages.slice(0, index + 1).map((msg) => ({ ...msg }));
    convo.files = (source.files || []).map((file) => ({ ...file, names: Array.isArray(file.names) ? file.names.slice() : [] }));
    convo.greeted = true;
    db.convos.unshift(convo);
    db.activeId = convo.id;
    save();
    renderSidebar();
    renderChat();
  }

  function deleteMessage(index) {
    const convo = getActive();
    ensureConversation(convo);
    convo.messages.splice(index, 1);
    convo.updatedAt = nowISO();
    save();
    renderChat();
    renderSidebar();
  }

  function newChat() {
    const convo = newConversation("GPT 5.5");
    db.convos.unshift(convo);
    db.activeId = convo.id;
    save();
    renderSidebar();
    renderChat();
    focusComposer();
  }

  async function saveKnowledge({ title, content, kind = "note", source = "manual", tags = [] }) {
    const project = getActiveProject();
    const res = await apiFetch(`${apiBase}/api/chatbot-library`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        content,
        kind,
        source,
        tags,
        projectId: db.activeProjectId,
        projectTitle: project?.title || ""
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Could not save knowledge");
    await loadLibrary(title || "");
    return data.item;
  }

  async function addKnowledgeManually() {
    const title = window.prompt("Knowledge title");
    if (!title) return;
    const content = window.prompt("Knowledge text");
    if (!content) return;
    try {
      await saveKnowledge({ title, content, kind: "note", source: "manual" });
    } catch (err) {
      appendBubble("assistant", `Could not save knowledge: ${err.message || err}`);
    }
  }

  function downloadText(filename, text, type = "text/plain") {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportMarkdown() {
    const convo = getActive();
    const project = getActiveProject();
    const content = [
      `# ${convo.title || "JohnnyChat Conversation"}`,
      "",
      `Project: ${project?.title || "General"}`,
      `Exported: ${new Date().toLocaleString()}`,
      "",
      transcript(convo)
    ].join("\n");
    downloadText(`${(convo.title || "johnnychat").replace(/[^\w\-]+/g, "_")}.md`, content, "text/markdown");
  }

  function exportHtml() {
    const convo = getActive();
    const project = getActiveProject();
    const body = (convo.messages || []).map((msg) => `<section><h2>${esc(String(msg.role || "assistant").toUpperCase())}</h2>${pretty(msg.content || "")}</section>`).join("\n");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(convo.title || "JohnnyChat")}</title><style>body{font-family:Georgia,serif;max-width:820px;margin:40px auto;line-height:1.6;color:#1b1f24}section{border-top:1px solid #ddd;padding:18px 0}h1,h2{font-family:Arial,sans-serif}</style></head><body><h1>${esc(convo.title || "JohnnyChat")}</h1><p>Project: ${esc(project?.title || "General")}</p>${body}</body></html>`;
    downloadText(`${(convo.title || "johnnychat").replace(/[^\w\-]+/g, "_")}.html`, html, "text/html");
  }

  async function runAction(command) {
    const convo = getActive();
    apiFetch(`${apiBase}/api/chatbot-action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command })
    }).catch(() => {});
    const labels = {
      summary: "Summarize this conversation into a crisp executive summary with key decisions, useful details, and open questions.",
      tasks: "Turn this conversation into a prioritized task list with owners, next actions, and dependencies where obvious.",
      quote: "Draft a professional quote or estimate from this conversation. Include assumptions and a clear next-step section.",
      email: "Draft a polished email based on this conversation. Keep it useful, direct, and ready to send.",
      website: "Draft strong website copy from this conversation. Include headline options, service copy, FAQ ideas, and calls to action."
    };

    if (command === "markdown") return exportMarkdown();
    if (command === "html") return exportHtml();
    if (command === "library") {
      await saveKnowledge({
        title: convo.title || "Saved conversation",
        content: transcript(convo),
        kind: "conversation",
        source: "chat transcript",
        tags: ["conversation"]
      });
      const reply = "Saved this conversation to the knowledge library.";
      appendBubble("assistant", reply, { index: convo.messages.length });
      convo.messages.push({ role: "assistant", content: reply });
      save();
      return;
    }

    const prompt = labels[command];
    if (!prompt) return;

    appendBubble("user", `[Action] ${prompt}`, { index: convo.messages.length });
    convo.messages.push({ role: "user", content: `[Action] ${prompt}` });
    save();
    renderSidebar();

    const thinking = showThinking("Working...");
    try {
      const input = await composeAssistantInput(convo, `${prompt}\n\nConversation:\n${transcript(convo).slice(0, 24000)}`);
      await requestAssistant(convo, input, thinking);
    } catch (err) {
      thinking.replace(`Action failed: ${err.message || err}`);
    }
  }

  async function stopVoiceCapture() {
    if (db.mediaRecorder && db.mediaRecorder.state !== "inactive") {
      db.mediaRecorder.stop();
    }
  }

  async function startVoiceCapture() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      appendBubble("assistant", "Voice input is not available in this browser.");
      return;
    }

    if (db.isRecording) {
      await stopVoiceCapture();
      return;
    }

    try {
      db.voiceChunks = [];
      db.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      db.mediaRecorder = new MediaRecorder(db.mediaStream);
      db.isRecording = true;
      el.micBtn.classList.add("recording");
      el.micBtn.textContent = "■";
      el.micBtn.title = "Stop recording";

      db.mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data?.size) db.voiceChunks.push(event.data);
      });

      db.mediaRecorder.addEventListener("stop", async () => {
        db.isRecording = false;
        el.micBtn.classList.remove("recording");
        el.micBtn.textContent = "🎙";
        el.micBtn.title = "Record voice";
        db.mediaStream?.getTracks().forEach((track) => track.stop());
        db.mediaStream = null;

        const blob = new Blob(db.voiceChunks, { type: db.mediaRecorder?.mimeType || "audio/webm" });
        db.voiceChunks = [];
        if (!blob.size) return;

        el.micBtn.disabled = true;
        el.micBtn.textContent = "...";
        try {
          const fd = new FormData();
          fd.append("audio", blob, "voice.webm");
          const res = await apiFetch(`${apiBase}/api/chatbot-transcribe`, { method: "POST", body: fd });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.detail || "Transcription failed");
          const text = String(data.text || "").trim();
          if (text) {
            el.input.value = el.input.value ? `${el.input.value.trim()} ${text}` : text;
            resizeInput();
            focusComposer();
          }
        } catch (err) {
          appendBubble("assistant", `Voice input failed: ${err.message || err}`);
        } finally {
          el.micBtn.disabled = false;
          el.micBtn.textContent = "🎙";
        }
      });

      db.mediaRecorder.start();
    } catch (err) {
      db.isRecording = false;
      el.micBtn.classList.remove("recording");
      appendBubble("assistant", `Voice input failed: ${err.message || err}`);
    }
  }

  function formatNumber(value) {
    return new Intl.NumberFormat().format(Number(value || 0));
  }

  async function loadStats() {
    el.statsBody.innerHTML = `<div class="workspace-empty">Loading usage...</div>`;
    const res = await apiFetch(`${apiBase}/api/chatbot-usage`, { method: "GET" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Could not load stats");

    const totals = data.totals || {};
    const cards = [
      ["Sessions", totals.sessions],
      ["Chats", totals.chats],
      ["Streams", totals.streamedChats],
      ["TTS", totals.tts],
      ["Voice notes", totals.transcriptions],
      ["Uploads", totals.uploads],
      ["Images", totals.images],
      ["Library", totals.libraryItems],
      ["Research", totals.deepResearch],
      ["Actions", totals.actions],
      ["Errors", totals.errors]
    ];

    const recentErrors = (data.recentErrors || [])
      .slice(0, 5)
      .map((err) => `<div class="stats-error"><strong>${esc(err.route || "error")}</strong><span>${esc(err.message || "")}</span></div>`)
      .join("");

    el.statsBody.innerHTML = `
      <div class="stats-grid">
        ${cards.map(([label, value]) => `<div class="stats-card"><span>${esc(label)}</span><strong>${formatNumber(value)}</strong></div>`).join("")}
      </div>
      <div class="stats-meta">Updated ${esc(data.updatedAt ? new Date(data.updatedAt).toLocaleString() : "not yet")}</div>
      <h3>Recent errors</h3>
      ${recentErrors || `<div class="workspace-empty">No recent errors.</div>`}
    `;
  }

  async function openStats() {
    el.statsPanel.classList.add("show");
    el.statsPanel.setAttribute("aria-hidden", "false");
    try {
      await loadStats();
    } catch (err) {
      el.statsBody.innerHTML = `<div class="workspace-empty">Stats failed: ${esc(err.message || err)}</div>`;
    }
  }

  function closeStats() {
    el.statsPanel.classList.remove("show");
    el.statsPanel.setAttribute("aria-hidden", "true");
  }

  function clearProjectChats() {
    const projectId = db.activeProjectId || "general";
    const projectChats = db.convos.filter((conv) => conv && ensureConversation(conv).projectId === projectId);
    if (!projectChats.length && !el.search.value) return;

    const confirmed = window.confirm("Clear all chats in this project?");
    if (!confirmed) return;

    db.convos = db.convos.filter((conv) => conv && ensureConversation(conv).projectId !== projectId);
    const fresh = newConversation("GPT 5.5");
    fresh.projectId = projectId;
    db.convos.unshift(fresh);
    db.activeId = fresh.id;
    el.search.value = "";
    stopSpeech();
    save();
    renderSidebar();
    renderChat();
  }

  el.search.addEventListener("input", renderConversations);
  el.clearSearch.addEventListener("click", clearProjectChats);

  el.projectSelect.addEventListener("change", async () => {
    db.activeProjectId = el.projectSelect.value || db.projects[0].id;
    localStorage.setItem(activeProjectKey, db.activeProjectId);
    db.activeId = "";
    save();
    renderSidebar();
    renderChat();
    await loadLibrary().catch(() => {});
  });

  el.newProject.addEventListener("click", () => {
    const title = window.prompt("Project name");
    if (!title) return;
    const project = {
      id: uid(),
      title: title.trim().slice(0, 80) || "Untitled project",
      notes: "",
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    db.projects.unshift(project);
    db.activeProjectId = project.id;
    db.activeId = "";
    save();
    renderSidebar();
    renderChat();
  });

  el.projectNotes.addEventListener("input", () => {
    const project = getActiveProject();
    if (!project) return;
    project.notes = String(el.projectNotes.value || "");
    project.updatedAt = nowISO();
    save();
  });

  el.librarySearch.addEventListener("input", () => {
    clearTimeout(db.librarySearchTimer);
    db.librarySearchTimer = setTimeout(() => loadLibrary().catch(() => {}), 250);
  });

  el.addKnowledge.addEventListener("click", addKnowledgeManually);

  el.clearImages.addEventListener("click", async () => {
    await clearStoredImages();
    await renderRecentImages();
  });

  el.clearWorkspace.addEventListener("click", () => {
    const convo = getActive();
    convo.files = [];
    save();
    renderWorkspaceFiles();
  });

  el.voiceToggle.addEventListener("click", () => {
    db.ttsEnabled = !db.ttsEnabled;
    localStorage.setItem(ttsStoreKey, JSON.stringify(db.ttsEnabled));
    if (!db.ttsEnabled) stopSpeech();
    updateVoiceToggle();
  });

  el.voiceSelect.value = db.ttsVoice;
  el.voiceSelect.addEventListener("change", () => {
    db.ttsVoice = normalizeVoice(el.voiceSelect.value);
    el.voiceSelect.value = db.ttsVoice;
    localStorage.setItem(ttsVoiceKey, db.ttsVoice);
    stopSpeech();
  });

  el.researchToggle.addEventListener("click", () => {
    db.researchMode = !db.researchMode;
    updateResearchToggle();
  });

  el.sendBtn.addEventListener("click", sendMessage);
  el.attachBtn.addEventListener("click", () => el.fileInput.click());
  el.micBtn.addEventListener("click", startVoiceCapture);
  el.statsToggle.addEventListener("click", openStats);
  el.closeStats.addEventListener("click", closeStats);
  el.refreshStats.addEventListener("click", loadStats);
  el.actionsToggle.addEventListener("click", () => {
    el.actionsPanel.classList.add("show");
    el.actionsPanel.setAttribute("aria-hidden", "false");
  });
  el.closeActions.addEventListener("click", () => {
    el.actionsPanel.classList.remove("show");
    el.actionsPanel.setAttribute("aria-hidden", "true");
  });
  el.actionsPanel.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", () => runAction(button.getAttribute("data-command")));
  });
  el.fileInput.addEventListener("change", () => {
    const files = Array.from(el.fileInput.files || []);
    if (!files.length) return;
    db.pendingFiles = db.pendingFiles.concat(files);
    renderAttachments();
    el.fileInput.value = "";
  });

  el.input.addEventListener("input", resizeInput);
  el.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  el.modal.addEventListener("click", (event) => {
    if (event.target === el.modal || event.target === el.closeModal) closeModal();
  });
  el.closeModal.addEventListener("click", closeModal);

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.getAttribute("data-action");
      if (action === "new-chat") newChat();
      if (action === "attach") el.fileInput.click();
      if (action === "image") {
        el.input.value = "/image ";
        el.input.focus();
        resizeInput();
      }
    });
  });

  el.newChatRail.addEventListener("click", newChat);
  el.newChatRail2.addEventListener("click", newChat);
  el.newChatMain.addEventListener("click", newChat);

  document.addEventListener("click", () => closeMenus(null));

  async function initialize() {
    renderSidebar();
    await renderRecentImages();
    await loadLibrary().catch(() => {});
    renderChat();
    updateVoiceToggle();
    updateResearchToggle();
    resizeInput();
    requestAnimationFrame(() => focusComposer());
  }

  initialize();
})();
