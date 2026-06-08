(function () {
  const apiBase = String(window.JOHNNY_CHAT_API_BASE_URL || "https://johnny-chat.onrender.com").replace(/\/+$/, "");
  const sessionCookieName = "gpt54_session";
  const state = {
    projects: [],
    project: null,
    sections: [],
    bible: null,
    edits: [],
    selectedId: "",
    pendingEdit: null
  };

  const el = {
    uploadForm: document.getElementById("upload-form"),
    fileInput: document.getElementById("file-input"),
    titleInput: document.getElementById("title-input"),
    uploadStatus: document.getElementById("upload-status"),
    refreshProjects: document.getElementById("refresh-projects"),
    projectList: document.getElementById("project-list"),
    projectTitle: document.getElementById("project-title"),
    mode: document.getElementById("mode-select"),
    exportDocx: document.getElementById("export-docx"),
    sectionFilter: document.getElementById("section-filter"),
    sectionList: document.getElementById("section-list"),
    originalText: document.getElementById("original-text"),
    suggestionText: document.getElementById("suggestion-text"),
    editNote: document.getElementById("edit-note"),
    requestEdit: document.getElementById("request-edit"),
    acceptEdit: document.getElementById("accept-edit"),
    rejectEdit: document.getElementById("reject-edit"),
    versionList: document.getElementById("version-list"),
    saveBible: document.getElementById("save-bible"),
    bibleCharacters: document.getElementById("bible-characters"),
    bibleSettings: document.getElementById("bible-settings"),
    bibleTimeline: document.getElementById("bible-timeline"),
    biblePlot: document.getElementById("bible-plot"),
    bibleTone: document.getElementById("bible-tone"),
    bibleContinuity: document.getElementById("bible-continuity")
  };

  function readCookie(name) {
    const prefix = `${name}=`;
    const found = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
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

  async function apiFetch(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: authHeaders(options.headers)
    });
    if (response.status === 401) {
      window.location.reload();
      throw new Error("Session expired.");
    }
    return response;
  }

  function setStatus(text, error = false) {
    el.uploadStatus.textContent = text || "";
    el.uploadStatus.style.color = error ? "#9c2f2f" : "";
  }

  function linesToArray(value) {
    return String(value || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function arrayToLines(value) {
    return Array.isArray(value) ? value.join("\n") : "";
  }

  function selectedSection() {
    return state.sections.find((section) => section.id === state.selectedId) || null;
  }

  function textFor(section) {
    return section?.editedText || section?.originalText || "";
  }

  function renderProjects() {
    el.projectList.innerHTML = "";
    if (!state.projects.length) {
      el.projectList.innerHTML = '<div class="status">Upload a manuscript to start.</div>';
      return;
    }
    state.projects.forEach((project) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "project-item";
      button.innerHTML = `${escapeHtml(project.title)}<span class="section-meta">${escapeHtml(project.filename || "")}</span>`;
      button.addEventListener("click", () => loadProject(project.id));
      el.projectList.appendChild(button);
    });
  }

  function renderSections() {
    const query = String(el.sectionFilter.value || "").toLowerCase();
    const paragraphSections = state.sections.filter((section) => section.kind === "paragraph");
    el.sectionList.innerHTML = "";
    paragraphSections
      .filter((section) => !query || `${section.label} ${section.originalText} ${section.editedText || ""}`.toLowerCase().includes(query))
      .forEach((section) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `section-item ${section.id === state.selectedId ? "active" : ""}`;
        const preview = textFor(section).replace(/\s+/g, " ").slice(0, 150);
        button.innerHTML = `${escapeHtml(preview || section.label)}<span class="section-meta">Chapter ${section.chapterIndex} / Scene ${section.sceneIndex} / Paragraph ${section.paragraphIndex}${section.editedText ? " / edited" : ""}</span>`;
        button.addEventListener("click", () => selectSection(section.id));
        el.sectionList.appendChild(button);
      });
  }

  function renderBible() {
    const bible = state.bible || {};
    el.bibleCharacters.value = arrayToLines(bible.characters);
    el.bibleSettings.value = arrayToLines(bible.settings);
    el.bibleTimeline.value = arrayToLines(bible.timeline);
    el.biblePlot.value = arrayToLines(bible.plotThreads);
    el.bibleTone.value = arrayToLines(bible.toneRules);
    el.bibleContinuity.value = arrayToLines(bible.continuityNotes);
  }

  function renderEditor() {
    const section = selectedSection();
    state.pendingEdit = null;
    el.acceptEdit.disabled = true;
    el.rejectEdit.disabled = true;
    if (!section) {
      el.originalText.className = "manuscript-text empty";
      el.originalText.textContent = "Select a paragraph to begin.";
      el.suggestionText.className = "manuscript-text empty";
      el.suggestionText.textContent = "Suggestions appear here.";
      renderVersions();
      return;
    }
    el.originalText.className = "manuscript-text";
    el.originalText.textContent = textFor(section);
    el.suggestionText.className = "manuscript-text empty";
    el.suggestionText.textContent = "Choose a mode and request an edit for this paragraph only.";
    renderVersions();
  }

  function renderVersions() {
    const section = selectedSection();
    const edits = section ? state.edits.filter((edit) => edit.sectionId === section.id) : [];
    el.versionList.innerHTML = "";
    if (!edits.length) {
      el.versionList.innerHTML = '<div class="status">No versions for this paragraph yet.</div>';
      return;
    }
    edits.forEach((edit) => {
      const item = document.createElement("div");
      item.className = "version-item";
      item.innerHTML = `${escapeHtml(edit.suggestion.slice(0, 260))}<span class="version-meta">${escapeHtml(edit.mode)} / ${escapeHtml(edit.status)} / ${new Date(edit.createdAt).toLocaleString()}</span>`;
      el.versionList.appendChild(item);
    });
  }

  function selectSection(id) {
    state.selectedId = id;
    renderSections();
    renderEditor();
  }

  async function loadProjects() {
    const response = await apiFetch("/api/story-editor/projects");
    const data = await response.json();
    if (!response.ok || data.ok !== true) throw new Error(data.error || "Could not load projects.");
    state.projects = data.projects || [];
    renderProjects();
    if (!state.project && state.projects[0]) await loadProject(state.projects[0].id);
  }

  async function loadProject(id) {
    setStatus("Loading project...");
    const response = await apiFetch(`/api/story-editor/projects/${encodeURIComponent(id)}`);
    const data = await response.json();
    if (!response.ok || data.ok !== true) throw new Error(data.error || "Could not load project.");
    state.project = data.project;
    state.sections = data.sections || [];
    state.bible = data.bible || {};
    state.edits = data.edits || [];
    state.selectedId = state.sections.find((section) => section.kind === "paragraph")?.id || "";
    el.projectTitle.textContent = state.project.title;
    renderBible();
    renderSections();
    renderEditor();
    setStatus("");
  }

  async function uploadManuscript(event) {
    event.preventDefault();
    const file = el.fileInput.files?.[0];
    if (!file) return;
    setStatus("Extracting and splitting manuscript...");
    const formData = new FormData();
    formData.append("title", el.titleInput.value || file.name);
    formData.append("manuscript", file);
    const response = await apiFetch("/api/story-editor/upload", {
      method: "POST",
      body: formData
    });
    const data = await response.json();
    if (!response.ok || data.ok !== true) {
      setStatus(data.error || "Upload failed.", true);
      return;
    }
    setStatus(`Loaded ${data.sections} paragraphs/scenes from ${data.title}.`);
    await loadProjects();
    await loadProject(data.projectId);
  }

  async function saveBible() {
    if (!state.project) return;
    setStatus("Saving Story Bible...");
    const payload = {
      characters: linesToArray(el.bibleCharacters.value),
      settings: linesToArray(el.bibleSettings.value),
      timeline: linesToArray(el.bibleTimeline.value),
      plotThreads: linesToArray(el.biblePlot.value),
      toneRules: linesToArray(el.bibleTone.value),
      continuityNotes: linesToArray(el.bibleContinuity.value)
    };
    const response = await apiFetch(`/api/story-editor/projects/${encodeURIComponent(state.project.id)}/bible`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok || data.ok !== true) {
      setStatus(data.error || "Could not save Story Bible.", true);
      return;
    }
    state.bible = data.bible;
    setStatus("Story Bible saved.");
  }

  async function requestEdit() {
    const section = selectedSection();
    if (!state.project || !section) return;
    el.requestEdit.disabled = true;
    el.suggestionText.className = "manuscript-text empty";
    el.suggestionText.textContent = "Editing this paragraph with nearby context...";
    try {
      const response = await apiFetch(`/api/story-editor/projects/${encodeURIComponent(state.project.id)}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: section.id,
          mode: el.mode.value,
          note: el.editNote.value
        })
      });
      const data = await response.json();
      if (!response.ok || data.ok !== true) throw new Error(data.error || "Edit failed.");
      state.pendingEdit = data.edit;
      state.edits.unshift(data.edit);
      el.suggestionText.className = "manuscript-text";
      el.suggestionText.textContent = data.edit.suggestion;
      el.acceptEdit.disabled = false;
      el.rejectEdit.disabled = false;
      renderVersions();
      setStatus("Suggestion ready.");
    } catch (err) {
      el.suggestionText.className = "manuscript-text empty";
      el.suggestionText.textContent = err.message || "Edit failed.";
      setStatus(err.message || "Edit failed.", true);
    } finally {
      el.requestEdit.disabled = false;
    }
  }

  async function decideEdit(decision) {
    if (!state.pendingEdit) return;
    const response = await apiFetch(`/api/story-editor/edits/${encodeURIComponent(state.pendingEdit.id)}/${decision}`, { method: "POST" });
    const data = await response.json();
    if (!response.ok || data.ok !== true) {
      setStatus(data.error || "Could not save decision.", true);
      return;
    }
    setStatus(decision === "accept" ? "Edit accepted and saved." : "Edit rejected.");
    await loadProject(state.project.id);
  }

  function exportDocx() {
    if (!state.project) return;
    const token = readCookie(sessionCookieName);
    const url = new URL(`${apiBase}/api/story-editor/projects/${state.project.id}/export.docx`);
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then((response) => {
        if (!response.ok) throw new Error("Export failed.");
        return response.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${state.project.title.replace(/[^a-z0-9_-]+/gi, "-") || "manuscript"}-edited.docx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      })
      .catch((err) => setStatus(err.message || "Export failed.", true));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  el.uploadForm.addEventListener("submit", uploadManuscript);
  el.refreshProjects.addEventListener("click", () => loadProjects().catch((err) => setStatus(err.message, true)));
  el.sectionFilter.addEventListener("input", renderSections);
  el.saveBible.addEventListener("click", saveBible);
  el.requestEdit.addEventListener("click", requestEdit);
  el.acceptEdit.addEventListener("click", () => decideEdit("accept"));
  el.rejectEdit.addEventListener("click", () => decideEdit("reject"));
  el.exportDocx.addEventListener("click", exportDocx);

  loadProjects().catch((err) => setStatus(err.message || "Could not load Story Editor.", true));
})();
