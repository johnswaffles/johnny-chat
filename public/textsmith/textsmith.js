(function () {
  const state = { mode: "single", busy: false };
  const host = String(window.location.hostname || "").toLowerCase();
  const apiBase = String(window.JOHNNY_CHAT_API_BASE_URL || (host === "localhost" || host === "127.0.0.1" ? window.location.origin : "https://johnny-chat.onrender.com")).replace(/\/+$/, "");
  const el = {
    source: document.getElementById("source-text"),
    inputCount: document.getElementById("input-count"),
    modeBudget: document.getElementById("mode-budget"),
    modeDescription: document.getElementById("mode-description"),
    modeOptions: Array.from(document.querySelectorAll("[data-mode]")),
    rewrite: document.getElementById("rewrite-button"),
    result: document.getElementById("result-area"),
    status: document.getElementById("status-pill")
  };

  const modeCopy = {
    single: {
      budget: "One SMS",
      description: "One complete message. TextSmith preserves detail and trims only what is necessary."
    },
    split: {
      budget: "Two SMS",
      description: "Two coherent messages. TextSmith finds a natural break and preserves the full thought."
    }
  };

  function setStatus(text, kind) {
    el.status.textContent = text;
    el.status.className = `status-pill${kind ? ` ${kind}` : ""}`;
  }

  function updateInputCount() {
    el.inputCount.textContent = `${el.source.value.length.toLocaleString()} / 6,000`;
  }

  function setMode(mode) {
    state.mode = mode === "split" ? "split" : "single";
    const copy = modeCopy[state.mode];
    el.modeBudget.textContent = copy.budget;
    el.modeDescription.textContent = copy.description;
    el.modeOptions.forEach((button) => {
      const active = button.dataset.mode === state.mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function escapeText(value) {
    return String(value || "");
  }

  function formatStats(stat) {
    const unit = stat.encoding === "GSM-7" ? "SMS units" : "Unicode chars";
    return `${stat.units} / ${stat.limit} ${unit}`;
  }

  function renderMessages(messages, stats) {
    el.result.innerHTML = "";
    messages.forEach((message, index) => {
      const card = document.createElement("article");
      card.className = "message-card";

      const header = document.createElement("div");
      header.className = "message-card-header";
      const label = document.createElement("span");
      label.className = "message-label";
      label.textContent = state.mode === "split" ? `Part ${index + 1} of ${messages.length}` : "Final message";
      const stat = document.createElement("span");
      stat.className = "message-stats";
      stat.textContent = formatStats(stats[index]);
      header.append(label, stat);

      const copy = document.createElement("p");
      copy.className = "message-copy";
      copy.textContent = escapeText(message);

      const actions = document.createElement("div");
      actions.className = "message-actions";
      const copyButton = document.createElement("button");
      copyButton.className = "copy-button";
      copyButton.type = "button";
      copyButton.textContent = "Copy";
      copyButton.addEventListener("click", () => copyText(message, copyButton));
      actions.appendChild(copyButton);

      card.append(header, copy, actions);
      el.result.appendChild(card);
    });

    if (messages.length > 1) {
      const allButton = document.createElement("button");
      allButton.className = "copy-button";
      allButton.type = "button";
      allButton.textContent = "Copy both messages";
      allButton.addEventListener("click", () => copyText(messages.join("\n\n"), allButton));
      el.result.appendChild(allButton);
    }
  }

  async function copyText(value, button) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const helper = document.createElement("textarea");
      helper.value = value;
      helper.setAttribute("readonly", "");
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.appendChild(helper);
      helper.select();
      document.execCommand("copy");
      helper.remove();
    }
    const original = button.textContent;
    button.textContent = "Copied";
    window.setTimeout(() => { button.textContent = original; }, 1400);
  }

  function showError(message) {
    el.result.innerHTML = "";
    const error = document.createElement("p");
    error.className = "error-message";
    error.textContent = message;
    el.result.appendChild(error);
  }

  async function refine() {
    const input = el.source.value.trim();
    if (!input || state.busy) {
      if (!input) {
        el.source.focus();
        setStatus("Add source text", "error");
      }
      return;
    }

    state.busy = true;
    el.rewrite.disabled = true;
    el.rewrite.querySelector("span").textContent = "Refining...";
    setStatus("Working", "working");
    try {
      const response = await fetch(`${apiBase}/api/textsmith`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, mode: state.mode })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || "TextSmith could not prepare that message.");
      renderMessages(payload.messages || [], payload.stats || []);
      setStatus("Ready", "ready");
    } catch (error) {
      showError(error.message || "TextSmith could not prepare that message.");
      setStatus("Try again", "error");
    } finally {
      state.busy = false;
      el.rewrite.disabled = false;
      el.rewrite.querySelector("span").textContent = "Refine message";
    }
  }

  el.source.addEventListener("input", updateInputCount);
  el.modeOptions.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
  el.rewrite.addEventListener("click", refine);
  el.source.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      refine();
    }
  });
  document.querySelectorAll("[data-example]").forEach((button) => {
    button.addEventListener("click", () => {
      el.source.value = button.dataset.example || "";
      updateInputCount();
      el.source.focus();
    });
  });

  updateInputCount();
  setMode("single");
})();
