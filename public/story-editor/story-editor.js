(function () {
  const apiBase = String(window.JOHNNY_CHAT_API_BASE_URL || window.location.origin).replace(/\/+$/, "");
  const sessionCookieName = "gpt54_session";
  const modeDescriptions = {
    line: "Sharper sentences, stronger rhythm, and clearer imagery.",
    grammar: "Correct grammar, punctuation, and tense with the lightest touch.",
    deepen: "Add sensory detail, emotional texture, and subtext.",
    expand: "Give the moment more room without inventing major plot events.",
    dialogue: "Strengthen voice, cadence, subtext, and attribution.",
    pacing: "Tighten or relax the passage so the scene moves naturally.",
    continuity: "Check this passage against nearby context and your Story Bible."
  };

  const state = {
    projects: [],
    project: null,
    sections: [],
    bible: null,
    edits: [],
    selectedId: "",
    sectionFilter: "all",
    pendingEdit: null,
    previewEdit: null,
    toastTimer: null,
    startupBusy: false,
    autopilotJob: null,
    autopilotTimer: null
  };

  const el = {
    libraryRail: document.getElementById("library-rail"),
    railOpen: document.getElementById("rail-open"),
    railClose: document.getElementById("rail-close"),
    railScrim: document.getElementById("rail-scrim"),
    openUpload: document.getElementById("open-upload"),
    welcomeUpload: document.getElementById("welcome-upload"),
    uploadDialog: document.getElementById("upload-dialog"),
    uploadForm: document.getElementById("upload-form"),
    uploadSubmit: document.getElementById("upload-submit"),
    fileDrop: document.getElementById("file-drop"),
    fileInput: document.getElementById("file-input"),
    filePrompt: document.getElementById("file-prompt"),
    fileDetail: document.getElementById("file-detail"),
    titleInput: document.getElementById("title-input"),
    intentInput: document.getElementById("intent-input"),
    uploadStatus: document.getElementById("upload-status"),
    refreshProjects: document.getElementById("refresh-projects"),
    projectFilter: document.getElementById("project-filter"),
    projectList: document.getElementById("project-list"),
    projectTitle: document.getElementById("project-title"),
    projectFilename: document.getElementById("project-filename"),
    loadingView: document.getElementById("loading-view"),
    problemView: document.getElementById("problem-view"),
    problemTitle: document.getElementById("problem-title"),
    problemMessage: document.getElementById("problem-message"),
    retryStartup: document.getElementById("retry-startup"),
    reauthLink: document.getElementById("reauth-link"),
    welcomeView: document.getElementById("welcome-view"),
    workspaceView: document.getElementById("workspace-view"),
    overviewTitle: document.getElementById("overview-title"),
    projectMeta: document.getElementById("project-meta"),
    progressValue: document.getElementById("progress-value"),
    progressTrack: document.getElementById("progress-track"),
    progressFill: document.getElementById("progress-fill"),
    progressDetail: document.getElementById("progress-detail"),
    autopilotIntent: document.getElementById("autopilot-intent"),
    autopilotStart: document.getElementById("autopilot-start"),
    autopilotProgress: document.getElementById("autopilot-progress"),
    autopilotPhase: document.getElementById("autopilot-phase"),
    autopilotPercent: document.getElementById("autopilot-percent"),
    autopilotTrack: document.getElementById("autopilot-track"),
    autopilotFill: document.getElementById("autopilot-fill"),
    autopilotMessage: document.getElementById("autopilot-message"),
    autopilotDetail: document.getElementById("autopilot-detail"),
    openBible: document.getElementById("open-bible"),
    bibleDialog: document.getElementById("bible-dialog"),
    exportDocx: document.getElementById("export-docx"),
    sectionFilter: document.getElementById("section-filter"),
    sectionFilterButtons: Array.from(document.querySelectorAll("[data-section-filter]")),
    sectionList: document.getElementById("section-list"),
    passageCount: document.getElementById("passage-count"),
    passagePosition: document.getElementById("passage-position"),
    passageHeading: document.getElementById("passage-heading"),
    previousSection: document.getElementById("previous-section"),
    nextSection: document.getElementById("next-section"),
    editingStage: document.getElementById("editing-stage"),
    originalText: document.getElementById("original-text"),
    currentWordCount: document.getElementById("current-word-count"),
    suggestionText: document.getElementById("suggestion-text"),
    suggestionHeading: document.getElementById("suggestion-heading"),
    suggestionStatus: document.getElementById("suggestion-status"),
    mode: document.getElementById("mode-select"),
    modeDescription: document.getElementById("mode-description"),
    editNote: document.getElementById("edit-note"),
    requestEdit: document.getElementById("request-edit"),
    decisionBar: document.getElementById("decision-bar"),
    acceptEdit: document.getElementById("accept-edit"),
    rejectEdit: document.getElementById("reject-edit"),
    versionsPanel: document.getElementById("versions-panel"),
    versionCount: document.getElementById("version-count"),
    versionList: document.getElementById("version-list"),
    saveBible: document.getElementById("save-bible"),
    bibleSaveState: document.getElementById("bible-save-state"),
    bibleCharacters: document.getElementById("bible-characters"),
    bibleSettings: document.getElementById("bible-settings"),
    bibleTimeline: document.getElementById("bible-timeline"),
    biblePlot: document.getElementById("bible-plot"),
    bibleTone: document.getElementById("bible-tone"),
    bibleContinuity: document.getElementById("bible-continuity"),
    toast: document.getElementById("toast"),
    toastMessage: document.getElementById("toast-message"),
    toastClose: document.getElementById("toast-close")
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
      credentials: "same-origin",
      headers: authHeaders(options.headers)
    });
    if (response.status === 401) {
      const error = new Error("Your private session needs to be unlocked again.");
      error.code = "AUTH_REQUIRED";
      throw error;
    }
    return response;
  }

  async function readJsonResponse(response) {
    const raw = await response.text();
    if (!raw.trim()) {
      throw new Error(response.ok ? "The manuscript service returned an empty response." : `The manuscript service returned HTTP ${response.status}.`);
    }
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error(response.ok ? "The manuscript service returned an unreadable response." : `The manuscript service returned HTTP ${response.status}.`);
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function wordCount(value) {
    return (String(value || "").trim().match(/\S+/g) || []).length;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat().format(Number(value) || 0);
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Recently updated";
    return `Updated ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date)}`;
  }

  function formatRelativeDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Recently";
    const diff = Date.now() - date.getTime();
    if (diff < 60 * 1000) return "Just now";
    if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
  }

  function formatFileSize(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
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

  function paragraphSections() {
    return state.sections.filter((section) => section.kind === "paragraph");
  }

  function textFor(section) {
    return section?.editedText || section?.originalText || "";
  }

  function sectionDisplay(section, absoluteIndex, total) {
    const parts = String(section?.label || "").split("/").map((part) => part.trim()).filter(Boolean);
    const chapter = parts[0] || `Chapter ${section?.chapterIndex || 1}`;
    const namedScene = parts[1] && !/^scene\s+\d+$/i.test(parts[1]) ? parts[1] : "";
    return {
      position: `${chapter} · Scene ${section?.sceneIndex || 1} · Passage ${absoluteIndex + 1} of ${total}`,
      heading: namedScene ? `${namedScene} · Passage ${section?.paragraphIndex || absoluteIndex + 1}` : `Passage ${section?.paragraphIndex || absoluteIndex + 1}`
    };
  }

  function showToast(message, error = false) {
    window.clearTimeout(state.toastTimer);
    el.toastMessage.textContent = message;
    el.toast.classList.toggle("error", error);
    el.toast.querySelector(".toast-icon").textContent = error ? "!" : "✓";
    el.toast.hidden = false;
    state.toastTimer = window.setTimeout(() => {
      el.toast.hidden = true;
    }, error ? 6500 : 4200);
  }

  function setUploadStatus(message, error = false) {
    el.uploadStatus.textContent = message || "";
    el.uploadStatus.classList.toggle("error", error);
  }

  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function setLibraryOpen(open) {
    el.libraryRail.classList.toggle("open", Boolean(open));
    el.railOpen.setAttribute("aria-expanded", String(Boolean(open)));
  }

  function renderProjects() {
    const query = String(el.projectFilter.value || "").trim().toLowerCase();
    const projects = state.projects.filter((project) => !query || `${project.title} ${project.filename || ""}`.toLowerCase().includes(query));
    el.projectList.innerHTML = "";
    if (!projects.length) {
      el.projectList.innerHTML = `<div class="library-empty">${state.projects.length ? "No manuscripts match that search." : "Your manuscript library is ready for its first story."}</div>`;
      return;
    }
    projects.forEach((project) => {
      const button = document.createElement("button");
      const initial = String(project.title || "S").trim().charAt(0).toUpperCase() || "S";
      button.type = "button";
      button.className = `project-item${state.project?.id === project.id ? " active" : ""}`;
      button.dataset.projectId = project.id;
      if (state.project?.id === project.id) button.setAttribute("aria-current", "true");
      button.innerHTML = `
        <span class="project-cover" aria-hidden="true">${escapeHtml(initial)}</span>
        <span class="project-copy"><strong>${escapeHtml(project.title)}</strong><small>${escapeHtml(project.filename || formatDate(project.updatedAt))}</small></span>
        <span class="project-arrow" aria-hidden="true">›</span>`;
      button.addEventListener("click", () => loadProject(project.id).catch(handleError));
      el.projectList.appendChild(button);
    });
  }

  function renderOverview() {
    if (!state.project) return;
    const paragraphs = paragraphSections();
    const revised = paragraphs.filter((section) => section.editedText).length;
    const totalWords = paragraphs.reduce((sum, section) => sum + wordCount(textFor(section)), 0);
    const percent = paragraphs.length ? Math.round((revised / paragraphs.length) * 100) : 0;
    el.projectTitle.textContent = state.project.title;
    el.projectFilename.textContent = state.project.filename || "Current manuscript";
    el.overviewTitle.textContent = state.project.title;
    el.projectMeta.innerHTML = `
      <span>${formatNumber(totalWords)} words</span>
      <span>${formatNumber(paragraphs.length)} passages</span>
      <span>${escapeHtml(formatDate(state.project.updatedAt))}</span>`;
    el.progressValue.textContent = `${percent}%`;
    el.progressFill.style.width = `${percent}%`;
    el.progressTrack.setAttribute("aria-valuenow", String(percent));
    el.progressDetail.textContent = revised
      ? `${revised} of ${paragraphs.length} passages revised`
      : "No passages revised yet";
    if (el.autopilotIntent && document.activeElement !== el.autopilotIntent) {
      el.autopilotIntent.value = state.project.userIntent || "Edit this manuscript for clarity, coherence, and stronger prose while preserving the author's voice.";
    }
    renderAutopilot();
    el.openBible.disabled = false;
    el.exportDocx.disabled = false;
  }

  function autopilotPercent(job) {
    if (!job) return 0;
    if (job.status === "completed") return 100;
    if (job.status === "failed") return job.totalChunks ? Math.round((job.completedChunks / job.totalChunks) * 100) : 0;
    if (job.phase === "planning") return job.totalChunks ? 8 : 3;
    if (job.phase === "review") return 95;
    return job.totalChunks ? Math.min(92, Math.round((job.completedChunks / job.totalChunks) * 92)) : 12;
  }

  function renderAutopilot() {
    const job = state.autopilotJob;
    if (!job) {
      el.autopilotProgress.hidden = true;
      el.autopilotStart.disabled = false;
      el.autopilotStart.textContent = "Start full-manuscript edit";
      return;
    }
    const percent = autopilotPercent(job);
    const running = job.status === "queued" || job.status === "running";
    const phaseLabels = {
      queued: "Queued for manuscript planning",
      planning: "Building the editorial and continuity plan",
      editing: `Editing connected chunk ${job.currentChunk || 1} of ${job.totalChunks || "…"}`,
      review: "Checking continuity and story endings",
      complete: "Full-manuscript edit complete",
      error: "Autopilot stopped safely"
    };
    el.autopilotProgress.hidden = false;
    el.autopilotStart.disabled = running;
    el.autopilotStart.textContent = running ? "Autopilot is working…" : job.status === "completed" ? "Run another full edit" : "Try Autopilot again";
    el.autopilotPhase.textContent = phaseLabels[job.phase] || "Working through the manuscript";
    el.autopilotPercent.textContent = `${percent}%`;
    el.autopilotFill.style.width = `${percent}%`;
    el.autopilotTrack.setAttribute("aria-valuenow", String(percent));
    el.autopilotMessage.textContent = job.message || "The model is carrying the manuscript forward.";
    const report = job.report || {};
    const review = report.finalReview || {};
    el.autopilotDetail.textContent = job.status === "completed"
      ? `${job.completedChunks} chunks complete · ${report.paragraphsRevised || 0} passages revised${report.paragraphsPreserved ? ` · ${report.paragraphsPreserved} passages preserved verbatim` : ""}${review.overall ? ` · ${review.overall}` : ""}`
      : job.status === "failed"
        ? (job.error || "The original manuscript was kept intact.")
        : "The page can stay open while the model works; progress is saved between chunks.";
  }

  function filteredParagraphs() {
    const query = String(el.sectionFilter.value || "").trim().toLowerCase();
    return paragraphSections().filter((section) => {
      const matchesQuery = !query || `${section.label || ""} ${section.originalText || ""} ${section.editedText || ""}`.toLowerCase().includes(query);
      const matchesStatus = state.sectionFilter === "all"
        || (state.sectionFilter === "edited" && section.editedText)
        || (state.sectionFilter === "todo" && !section.editedText);
      return matchesQuery && matchesStatus;
    });
  }

  function renderSections() {
    const paragraphs = paragraphSections();
    const visible = filteredParagraphs();
    el.passageCount.textContent = String(paragraphs.length);
    el.sectionList.innerHTML = "";
    if (!visible.length) {
      el.sectionList.innerHTML = '<div class="section-empty">No passages match this view.<br>Try another filter or search.</div>';
      return;
    }
    visible.forEach((section) => {
      const absoluteIndex = paragraphs.findIndex((item) => item.id === section.id) + 1;
      const preview = textFor(section).replace(/\s+/g, " ").trim().slice(0, 150) || section.label;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `section-item${section.id === state.selectedId ? " active" : ""}`;
      button.dataset.sectionId = section.id;
      if (section.id === state.selectedId) button.setAttribute("aria-current", "true");
      button.innerHTML = `
        <span class="section-number">${absoluteIndex}</span>
        <span class="section-copy">
          <span class="section-preview">${escapeHtml(preview)}</span>
          <span class="section-meta"><span>Ch ${section.chapterIndex} · Scene ${section.sceneIndex}</span>${section.preserveVerbatim ? '<span class="protected-badge">[Preserved]</span>' : section.editedText ? '<span class="edited-badge">Revised</span>' : ""}</span>
        </span>`;
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
    el.bibleSaveState.textContent = "All notes are up to date.";
    el.bibleSaveState.classList.remove("unsaved");
  }

  function emptyPane(container, icon, title, copy, sparkle = false) {
    container.className = "manuscript-text empty";
    container.innerHTML = `<div class="empty-pane-icon${sparkle ? " sparkle" : ""}">${escapeHtml(icon)}</div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(copy)}</span>`;
  }

  function tokenize(value) {
    return String(value || "").match(/\s+|[\p{L}\p{N}_’'\-]+|[^\s\p{L}\p{N}_]/gu) || [];
  }

  function diffTokens(before, after) {
    const left = tokenize(before);
    const right = tokenize(after);
    if (!left.length || !right.length || left.length * right.length > 180000) {
      return {
        left: left.map((text) => ({ text, changed: false })),
        right: right.map((text) => ({ text, changed: false }))
      };
    }
    const rows = Array.from({ length: left.length + 1 }, () => new Uint16Array(right.length + 1));
    for (let i = left.length - 1; i >= 0; i -= 1) {
      for (let j = right.length - 1; j >= 0; j -= 1) {
        rows[i][j] = left[i] === right[j] ? rows[i + 1][j + 1] + 1 : Math.max(rows[i + 1][j], rows[i][j + 1]);
      }
    }
    const leftResult = [];
    const rightResult = [];
    let i = 0;
    let j = 0;
    while (i < left.length && j < right.length) {
      if (left[i] === right[j]) {
        leftResult.push({ text: left[i], changed: false });
        rightResult.push({ text: right[j], changed: false });
        i += 1;
        j += 1;
      } else if (rows[i + 1][j] >= rows[i][j + 1]) {
        leftResult.push({ text: left[i], changed: !/^\s+$/.test(left[i]) });
        i += 1;
      } else {
        rightResult.push({ text: right[j], changed: !/^\s+$/.test(right[j]) });
        j += 1;
      }
    }
    while (i < left.length) {
      leftResult.push({ text: left[i], changed: !/^\s+$/.test(left[i]) });
      i += 1;
    }
    while (j < right.length) {
      rightResult.push({ text: right[j], changed: !/^\s+$/.test(right[j]) });
      j += 1;
    }
    return { left: leftResult, right: rightResult };
  }

  function appendDiff(container, tokens, className) {
    container.innerHTML = "";
    tokens.forEach((token) => {
      if (!token.changed) {
        container.appendChild(document.createTextNode(token.text));
        return;
      }
      const mark = document.createElement("mark");
      mark.className = className;
      mark.textContent = token.text;
      container.appendChild(mark);
    });
  }

  function renderSuggestion(edit) {
    const section = selectedSection();
    const currentText = textFor(section);
    if (section?.preserveVerbatim) {
      el.originalText.className = "manuscript-text protected-text";
      el.originalText.innerHTML = `<div class="protected-banner">[PRESERVED VERBATIM]</div><div class="protected-copy">${escapeHtml(currentText)}</div><small>${escapeHtml(section.preserveReason || "This passage was kept outside model rewriting.")}</small>`;
      emptyPane(el.suggestionText, "—", "No model revision requested", "The surrounding manuscript can still be edited while this passage remains unchanged.");
      el.suggestionHeading.textContent = "Protected passage";
      el.suggestionStatus.textContent = "Preserved";
      el.decisionBar.hidden = true;
      el.acceptEdit.disabled = true;
      el.rejectEdit.disabled = true;
      return;
    }
    if (!section || !edit?.suggestion) {
      el.originalText.className = "manuscript-text";
      el.originalText.textContent = currentText;
      emptyPane(el.suggestionText, "✦", "Your revision will appear here.", "Choose an editing lens and generate a suggestion.", true);
      el.suggestionHeading.textContent = "Proposed revision";
      el.suggestionStatus.textContent = "Waiting";
      el.decisionBar.hidden = true;
      el.acceptEdit.disabled = true;
      el.rejectEdit.disabled = true;
      return;
    }
    const diff = diffTokens(currentText, edit.suggestion);
    el.originalText.className = "manuscript-text";
    el.suggestionText.className = "manuscript-text";
    appendDiff(el.originalText, diff.left, "diff-removed");
    appendDiff(el.suggestionText, diff.right, "diff-added");
    const modeLabel = el.mode.querySelector(`option[value="${edit.mode}"]`)?.textContent || edit.mode || "Revision";
    el.suggestionHeading.textContent = state.pendingEdit?.id === edit.id ? "Proposed revision" : "Revision preview";
    el.suggestionStatus.textContent = edit.status === "pending" ? modeLabel : `${modeLabel} · ${edit.status}`;
    const actionable = edit.status === "pending";
    el.decisionBar.hidden = !actionable;
    el.acceptEdit.disabled = !actionable;
    el.rejectEdit.disabled = !actionable;
  }

  function renderEditor() {
    const section = selectedSection();
    const paragraphs = paragraphSections();
    const index = paragraphs.findIndex((item) => item.id === state.selectedId);
    el.requestEdit.disabled = !section || Boolean(section?.preserveVerbatim);
    el.previousSection.disabled = index <= 0;
    el.nextSection.disabled = index < 0 || index >= paragraphs.length - 1;
    if (!section) {
      el.passagePosition.textContent = "Choose a passage";
      el.passageHeading.textContent = "Ready when you are";
      el.currentWordCount.textContent = "0 words";
      emptyPane(el.originalText, "Aa", "Select a passage to begin.", "Your current draft will appear here.");
      emptyPane(el.suggestionText, "✦", "Your revision will appear here.", "Choose an editing lens and generate a suggestion.", true);
      el.suggestionHeading.textContent = "Proposed revision";
      el.suggestionStatus.textContent = "Waiting";
      el.decisionBar.hidden = true;
      renderVersions();
      return;
    }
    const currentText = textFor(section);
    const display = sectionDisplay(section, index, paragraphs.length);
    el.passagePosition.textContent = display.position;
    el.passageHeading.textContent = display.heading;
    el.currentWordCount.textContent = `${wordCount(currentText)} ${wordCount(currentText) === 1 ? "word" : "words"}`;
    const latestPending = state.edits.find((edit) => edit.sectionId === section.id && edit.status === "pending") || null;
    state.pendingEdit = latestPending;
    if (!state.previewEdit || state.previewEdit.sectionId !== section.id) state.previewEdit = latestPending;
    renderSuggestion(state.previewEdit);
    renderVersions();
  }

  function renderVersions() {
    const section = selectedSection();
    const edits = section ? state.edits.filter((edit) => edit.sectionId === section.id) : [];
    el.versionCount.textContent = String(edits.length);
    el.versionList.innerHTML = "";
    if (!edits.length) {
      el.versionList.innerHTML = '<div class="version-empty">No revisions for this passage yet.</div>';
      return;
    }
    edits.forEach((edit) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "version-item";
      item.innerHTML = `
        <span class="version-status ${escapeHtml(edit.status)}">${escapeHtml(edit.status)}</span>
        <span class="version-copy"><strong>${escapeHtml(edit.mode || "Revision")}</strong><small>${escapeHtml(String(edit.suggestion || "").replace(/\s+/g, " ").slice(0, 140))}</small></span>
        <span class="version-time">${escapeHtml(formatRelativeDate(edit.createdAt))}</span>`;
      item.addEventListener("click", () => {
        state.previewEdit = edit;
        state.pendingEdit = edit.status === "pending" ? edit : null;
        renderSuggestion(edit);
        el.versionsPanel.open = false;
        el.suggestionText.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      el.versionList.appendChild(item);
    });
  }

  function selectSection(id) {
    state.selectedId = id;
    state.previewEdit = null;
    state.pendingEdit = null;
    renderSections();
    renderEditor();
    const selected = el.sectionList.querySelector(`[data-section-id="${window.CSS?.escape ? window.CSS.escape(id) : id}"]`);
    selected?.scrollIntoView({ block: "nearest" });
    if (window.innerWidth <= 760) el.editingStage.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function moveSection(direction) {
    const paragraphs = paragraphSections();
    const index = paragraphs.findIndex((section) => section.id === state.selectedId);
    const next = paragraphs[index + direction];
    if (next) selectSection(next.id);
  }

  function showProjectState() {
    el.loadingView.hidden = true;
    el.problemView.hidden = true;
    el.welcomeView.hidden = Boolean(state.project);
    el.workspaceView.hidden = !state.project;
  }

  function showStartupProblem(error) {
    const authRequired = error?.code === "AUTH_REQUIRED";
    el.loadingView.hidden = true;
    el.welcomeView.hidden = true;
    el.workspaceView.hidden = true;
    el.problemView.hidden = false;
    el.problemTitle.textContent = authRequired
      ? "Your private session needs a quick reset."
      : "Story Editor could not connect just now.";
    el.problemMessage.textContent = authRequired
      ? "Your manuscript was not changed. Unlock the studio again to reconnect the private page with the manuscript service."
      : "Your manuscript was not changed. Check the connection and try again when you’re ready.";
    el.reauthLink.hidden = !authRequired;
    el.retryStartup.textContent = authRequired ? "Try once more" : "Try connecting again";
  }

  async function retryStartup() {
    if (state.startupBusy) return;
    state.startupBusy = true;
    el.retryStartup.disabled = true;
    el.problemView.hidden = true;
    el.welcomeView.hidden = true;
    el.workspaceView.hidden = true;
    el.loadingView.hidden = false;
    try {
      await loadProjects();
    } catch (error) {
      showStartupProblem(error);
    } finally {
      state.startupBusy = false;
      el.retryStartup.disabled = false;
    }
  }

  async function loadProjects() {
    const response = await apiFetch("/api/story-editor/projects");
    const data = await readJsonResponse(response);
    if (!response.ok || data.ok !== true) throw new Error(data.error || "Could not load your manuscripts.");
    state.projects = data.projects || [];
    renderProjects();
    if (!state.projects.length) {
      state.project = null;
      state.autopilotJob = null;
      window.clearTimeout(state.autopilotTimer);
      showProjectState();
      return;
    }
    const currentStillExists = state.projects.some((project) => project.id === state.project?.id);
    await loadProject(currentStillExists ? state.project.id : state.projects[0].id);
  }

  async function loadProject(id) {
    const previousSelection = state.project?.id === id ? state.selectedId : "";
    el.editingStage.classList.add("is-busy");
    try {
      const response = await apiFetch(`/api/story-editor/projects/${encodeURIComponent(id)}`);
      const data = await readJsonResponse(response);
      if (!response.ok || data.ok !== true) throw new Error(data.error || "Could not open that manuscript.");
      state.project = data.project;
      state.sections = data.sections || [];
      state.bible = data.bible || {};
      state.edits = data.edits || [];
      state.autopilotJob = data.autopilot || null;
      const paragraphs = paragraphSections();
      state.selectedId = paragraphs.some((section) => section.id === previousSelection) ? previousSelection : (paragraphs[0]?.id || "");
      state.pendingEdit = null;
      state.previewEdit = null;
      renderProjects();
      renderOverview();
      renderBible();
      renderSections();
      renderEditor();
      showProjectState();
      setLibraryOpen(false);
      if (state.autopilotJob?.status === "queued" || state.autopilotJob?.status === "running") pollAutopilot();
    } finally {
      el.editingStage.classList.remove("is-busy");
    }
  }

  async function uploadManuscript(event) {
    event.preventDefault();
    const file = el.fileInput.files?.[0];
    const intent = String(el.intentInput.value || "").trim();
    if (!file) {
      setUploadStatus("Choose a manuscript before importing.", true);
      return;
    }
    if (!intent) {
      setUploadStatus("Tell the editor what you want done before importing.", true);
      el.intentInput.focus();
      return;
    }
    if (file.size > 80 * 1024 * 1024) {
      setUploadStatus("That file is larger than 80 MB. Please choose a smaller manuscript.", true);
      return;
    }
    el.uploadSubmit.disabled = true;
    el.uploadSubmit.textContent = "Organizing manuscript…";
    setUploadStatus("Extracting the text and organizing it into passages…");
    try {
      const formData = new FormData();
      formData.append("title", el.titleInput.value || file.name);
      formData.append("intent", intent);
      formData.append("manuscript", file);
      const response = await apiFetch("/api/story-editor/upload", { method: "POST", body: formData });
      const data = await readJsonResponse(response);
      if (!response.ok || data.ok !== true) throw new Error(data.error || "The manuscript could not be imported.");
      setUploadStatus(`Ready — ${data.sections} passages found.`);
      await loadProjects();
      await loadProject(data.projectId);
      closeDialog(el.uploadDialog);
      el.uploadForm.reset();
      updateSelectedFile();
      showToast(`${data.title} is ready to edit.`);
    } catch (error) {
      setUploadStatus(error.message || "The manuscript could not be imported.", true);
    } finally {
      el.uploadSubmit.disabled = false;
      el.uploadSubmit.textContent = "Import manuscript";
    }
  }

  async function pollAutopilot() {
    window.clearTimeout(state.autopilotTimer);
    if (!state.project || !state.autopilotJob?.id) return;
    try {
      const response = await apiFetch(`/api/story-editor/projects/${encodeURIComponent(state.project.id)}/autopilot/${encodeURIComponent(state.autopilotJob.id)}`);
      const data = await readJsonResponse(response);
      if (!response.ok || data.ok !== true) throw new Error(data.error || "Could not read Autopilot progress.");
      state.autopilotJob = data.job;
      renderAutopilot();
      if (data.job.status === "queued" || data.job.status === "running") {
        state.autopilotTimer = window.setTimeout(pollAutopilot, 1600);
        return;
      }
      if (data.job.status === "completed") {
        await loadProject(state.project.id);
        state.autopilotJob = data.job;
        renderOverview();
        showToast("Autopilot finished the manuscript and its continuity review.");
      } else if (data.job.status === "failed") {
        showToast(data.job.error || "Autopilot stopped before it could finish.", true);
      }
    } catch (error) {
      showToast(error.message || "Could not read Autopilot progress.", true);
    }
  }

  async function startAutopilot() {
    if (!state.project || el.autopilotStart.disabled) return;
    const intent = String(el.autopilotIntent.value || "").trim();
    if (!intent) {
      showToast("Tell the editor what you want done before starting Autopilot.", true);
      el.autopilotIntent.focus();
      return;
    }
    el.autopilotStart.disabled = true;
    try {
      const response = await apiFetch(`/api/story-editor/projects/${encodeURIComponent(state.project.id)}/autopilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent })
      });
      const data = await readJsonResponse(response);
      if (!response.ok || data.ok !== true) throw new Error(data.error || "Autopilot could not start.");
      state.project.userIntent = intent;
      state.autopilotJob = data.job;
      renderAutopilot();
      showToast(data.alreadyRunning ? "Autopilot is already working on this manuscript." : "Autopilot started. Your original draft is preserved.");
      await pollAutopilot();
    } catch (error) {
      el.autopilotStart.disabled = false;
      showToast(error.message || "Autopilot could not start.", true);
    }
  }

  async function saveBible() {
    if (!state.project) return;
    el.saveBible.disabled = true;
    el.saveBible.textContent = "Saving…";
    el.bibleSaveState.textContent = "Saving your continuity notes…";
    try {
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
      const data = await readJsonResponse(response);
      if (!response.ok || data.ok !== true) throw new Error(data.error || "Could not save your Story Bible.");
      state.bible = data.bible;
      el.bibleSaveState.textContent = "All notes are up to date.";
      el.bibleSaveState.classList.remove("unsaved");
      showToast("Story Bible saved.");
    } catch (error) {
      el.bibleSaveState.textContent = error.message || "Could not save your Story Bible.";
      el.bibleSaveState.classList.add("unsaved");
      showToast(error.message || "Could not save your Story Bible.", true);
    } finally {
      el.saveBible.disabled = false;
      el.saveBible.textContent = "Save Story Bible";
    }
  }

  async function requestEdit() {
    const section = selectedSection();
    if (!state.project || !section || el.requestEdit.disabled) return;
    el.requestEdit.disabled = true;
    el.requestEdit.classList.add("is-loading");
    el.requestEdit.querySelector("span").textContent = "Crafting revision…";
    el.suggestionText.className = "manuscript-text empty";
    el.suggestionText.innerHTML = '<div class="loading-mark" aria-hidden="true"><i></i><i></i><i></i></div><strong>Reading the scene around this passage…</strong><span>Preserving voice, point of view, and continuity.</span>';
    el.suggestionStatus.textContent = "Working";
    el.decisionBar.hidden = true;
    try {
      const response = await apiFetch(`/api/story-editor/projects/${encodeURIComponent(state.project.id)}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId: section.id, mode: el.mode.value, note: el.editNote.value })
      });
      const data = await readJsonResponse(response);
      if (!response.ok || data.ok !== true) throw new Error(data.error || "The revision could not be generated.");
      if (data.protected) {
        renderEditor();
        showToast(data.message || "This passage was preserved verbatim.");
        return;
      }
      state.pendingEdit = data.edit;
      state.previewEdit = data.edit;
      state.edits.unshift(data.edit);
      renderSuggestion(data.edit);
      renderVersions();
      showToast("Your revision is ready to review.");
    } catch (error) {
      state.pendingEdit = null;
      state.previewEdit = null;
      renderSuggestion(null);
      showToast(error.message || "The revision could not be generated.", true);
    } finally {
      el.requestEdit.disabled = false;
      el.requestEdit.classList.remove("is-loading");
      el.requestEdit.querySelector("span").textContent = "Generate revision";
    }
  }

  async function decideEdit(decision) {
    if (!state.pendingEdit || !state.project) return;
    el.acceptEdit.disabled = true;
    el.rejectEdit.disabled = true;
    try {
      const response = await apiFetch(`/api/story-editor/edits/${encodeURIComponent(state.pendingEdit.id)}/${decision}`, { method: "POST" });
      const data = await readJsonResponse(response);
      if (!response.ok || data.ok !== true) throw new Error(data.error || "That decision could not be saved.");
      showToast(decision === "accept" ? "Revision accepted into your manuscript." : "Revision discarded.");
      await loadProject(state.project.id);
    } catch (error) {
      el.acceptEdit.disabled = false;
      el.rejectEdit.disabled = false;
      showToast(error.message || "That decision could not be saved.", true);
    }
  }

  async function exportDocx() {
    if (!state.project) return;
    el.exportDocx.disabled = true;
    try {
      const token = readCookie(sessionCookieName);
      const response = await fetch(`${apiBase}/api/story-editor/projects/${encodeURIComponent(state.project.id)}/export.docx`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error("The DOCX export could not be created.");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${state.project.title.replace(/[^a-z0-9_-]+/gi, "-") || "manuscript"}-edited.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      showToast("Your edited manuscript is downloading.");
    } catch (error) {
      showToast(error.message || "The DOCX export could not be created.", true);
    } finally {
      el.exportDocx.disabled = false;
    }
  }

  function updateSelectedFile() {
    const file = el.fileInput.files?.[0];
    el.fileDrop.classList.toggle("has-file", Boolean(file));
    if (!file) {
      el.filePrompt.textContent = "Drop your manuscript here";
      el.fileDetail.textContent = "or click to choose a TXT, DOCX, or PDF";
      setUploadStatus("");
      return;
    }
    el.filePrompt.textContent = file.name;
    el.fileDetail.textContent = `${formatFileSize(file.size)} · Ready to import`;
    if (!el.titleInput.value.trim()) el.titleInput.value = file.name.replace(/\.(txt|docx|pdf)$/i, "");
    setUploadStatus("");
  }

  function handleError(error) {
    if (!state.project) {
      showStartupProblem(error);
      return;
    }
    showToast(error?.message || "Something went wrong in Story Editor.", true);
  }

  el.openUpload.addEventListener("click", () => openDialog(el.uploadDialog));
  el.welcomeUpload.addEventListener("click", () => openDialog(el.uploadDialog));
  el.retryStartup.addEventListener("click", retryStartup);
  el.openBible.addEventListener("click", () => openDialog(el.bibleDialog));
  el.autopilotStart.addEventListener("click", startAutopilot);
  el.railOpen.addEventListener("click", () => setLibraryOpen(true));
  el.railClose.addEventListener("click", () => setLibraryOpen(false));
  el.railScrim.addEventListener("click", () => setLibraryOpen(false));
  el.uploadForm.addEventListener("submit", uploadManuscript);
  el.fileInput.addEventListener("change", updateSelectedFile);
  el.projectFilter.addEventListener("input", renderProjects);
  el.refreshProjects.addEventListener("click", () => loadProjects().then(() => showToast("Manuscript library refreshed.")).catch(handleError));
  el.sectionFilter.addEventListener("input", renderSections);
  el.sectionFilterButtons.forEach((button) => button.addEventListener("click", () => {
    state.sectionFilter = button.dataset.sectionFilter;
    el.sectionFilterButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderSections();
  }));
  el.previousSection.addEventListener("click", () => moveSection(-1));
  el.nextSection.addEventListener("click", () => moveSection(1));
  el.mode.addEventListener("change", () => {
    el.modeDescription.textContent = modeDescriptions[el.mode.value] || modeDescriptions.line;
  });
  el.saveBible.addEventListener("click", saveBible);
  el.requestEdit.addEventListener("click", requestEdit);
  el.acceptEdit.addEventListener("click", () => decideEdit("accept"));
  el.rejectEdit.addEventListener("click", () => decideEdit("reject"));
  el.exportDocx.addEventListener("click", exportDocx);
  el.toastClose.addEventListener("click", () => {
    el.toast.hidden = true;
    window.clearTimeout(state.toastTimer);
  });

  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => closeDialog(button.closest("dialog"))));
  document.querySelectorAll("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog(dialog);
  }));

  ["dragenter", "dragover"].forEach((name) => el.fileDrop.addEventListener(name, (event) => {
    event.preventDefault();
    el.fileDrop.classList.add("is-dragging");
  }));
  ["dragleave", "drop"].forEach((name) => el.fileDrop.addEventListener(name, (event) => {
    event.preventDefault();
    el.fileDrop.classList.remove("is-dragging");
  }));
  el.fileDrop.addEventListener("drop", (event) => {
    const files = event.dataTransfer?.files;
    if (!files?.length) return;
    const transfer = new DataTransfer();
    transfer.items.add(files[0]);
    el.fileInput.files = transfer.files;
    updateSelectedFile();
  });

  [el.bibleCharacters, el.bibleSettings, el.bibleTimeline, el.biblePlot, el.bibleTone, el.bibleContinuity].forEach((textarea) => {
    textarea.addEventListener("input", () => {
      el.bibleSaveState.textContent = "You have unsaved Story Bible changes.";
      el.bibleSaveState.classList.add("unsaved");
    });
  });

  window.addEventListener("keydown", (event) => {
    const dialogOpen = document.querySelector("dialog[open]");
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !dialogOpen) {
      event.preventDefault();
      requestEdit();
      return;
    }
    if (event.altKey && event.key === "ArrowLeft" && !dialogOpen) {
      event.preventDefault();
      moveSection(-1);
    }
    if (event.altKey && event.key === "ArrowRight" && !dialogOpen) {
      event.preventDefault();
      moveSection(1);
    }
  });

  retryStartup();
})();
