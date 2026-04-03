(function () {
  const profile = "gpt54";
  const apiBase = String(window.JOHNNY_CHAT_API_BASE_URL || "https://johnny-chat.onrender.com").replace(/\/+$/, "");
  const storeKey = "gpt54_convos_v1";
  const activeKey = `${storeKey}_active`;
  const maxHistory = 18;
  const imageDbName = "gpt54_images_v1";
  const imageStore = "images";

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
    newChatMain: getEl("new-chat-main")
  };

  document.title = "GPT 5.4";
  document.documentElement.dataset.profile = profile;
  window.JOHNNY_CHAT_PROFILE = profile;

  const promptIdeas = [
    "Draft a polished reply to a customer.",
    "Summarize a long message into bullets.",
    "Analyze a screenshot or PDF.",
    "Generate a fresh image concept."
  ];

  const db = {
    convos: readJSON(storeKey, []),
    activeId: localStorage.getItem(activeKey) || "",
    imageDbPromise: null,
    currentMenu: null,
    pendingFiles: []
  };

  if (!Array.isArray(db.convos)) db.convos = [];

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
    if (db.activeId) localStorage.setItem(activeKey, db.activeId);
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
      greeted: false,
      messages: []
    };
  }

  function getActive() {
    if (db.activeId) {
      const found = db.convos.find((item) => item && item.id === db.activeId);
      if (found) return found;
    }
    if (!db.convos.length) {
      db.convos.unshift(newConversation("GPT 5.4"));
    }
    db.activeId = db.convos[0].id;
    save();
    return db.convos[0];
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
              db.convos.unshift(newConversation("GPT 5.4"));
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
    renderConversations();
  }

  function transcript(convo) {
    return (convo.messages || [])
      .map((msg) => `${String(msg.role || "assistant").toUpperCase()}: ${msg.content || ""}`)
      .join("\n\n");
  }

  function appendBubble(role, content) {
    const bubble = document.createElement("div");
    bubble.className = `message ${role}`;
    bubble.dataset.raw = content;
    bubble.innerHTML = pretty(content);

    if (role === "assistant") {
      const actions = document.createElement("div");
      actions.className = "message-actions";
      const copy = document.createElement("button");
      copy.type = "button";
      copy.className = "copy-btn";
      copy.textContent = "⧉";
      copy.addEventListener("click", async () => {
        await navigator.clipboard.writeText(content || "");
        copy.textContent = "✓";
        setTimeout(() => {
          copy.textContent = "⧉";
        }, 1200);
      });
      actions.appendChild(copy);
      bubble.appendChild(actions);
    }

    el.messages.appendChild(bubble);
    el.messages.scrollTop = el.messages.scrollHeight;
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
      replace(content) {
        bubble.dataset.raw = content;
        bubble.innerHTML = `<div>${pretty(content)}</div>`;
        const actions = document.createElement("div");
        actions.className = "message-actions";
        const copy = document.createElement("button");
        copy.type = "button";
        copy.className = "copy-btn";
        copy.textContent = "⧉";
        copy.addEventListener("click", async () => {
          await navigator.clipboard.writeText(content || "");
          copy.textContent = "✓";
          setTimeout(() => {
            copy.textContent = "⧉";
          }, 1200);
        });
        actions.appendChild(copy);
        bubble.appendChild(actions);
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
      const req = indexedDB.open(imageDbName, 1);
      req.onupgradeneeded = (event) => {
        const database = event.target.result;
        if (!database.objectStoreNames.contains(imageStore)) {
          database.createObjectStore(imageStore, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    return db.imageDbPromise;
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
      img.alt = "Recent generated image";
      img.addEventListener("click", () => openModal(item.url));
      el.recentImages.appendChild(img);
    });
  }

  async function rememberImage(url) {
    await putStoredImage({
      id: uid(),
      url,
      createdAt: nowISO()
    });
    await trimStoredImages(24);
    await renderRecentImages();
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

    const res = await fetch(`${apiBase}/upload`, { method: "POST", body: fd });
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

  async function generateImage(prompt, convo) {
    const loader = document.createElement("div");
    loader.className = "message assistant";
    loader.innerHTML = `<strong>Generating image...</strong><div class="conversation-meta">Prompt: ${esc(prompt)}</div>`;
    el.messages.appendChild(loader);
    el.messages.scrollTop = el.messages.scrollHeight;

    try {
      const res = await fetch(`${apiBase}/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, size: "1024x1024" })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Generation failed");
      const src = `data:image/png;base64,${data.image_b64}`;
      await rememberImage(src);

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
      convo.messages.push({ role: "assistant", content: "[Generated Image]" });
      convo.updatedAt = nowISO();
      save();
      renderSidebar();
    } catch (err) {
      loader.innerHTML = `<span style="color:#ffb9b9;">Generation failed: ${esc(err.message || err)}</span>`;
    }
  }

  async function initialGreeting(convo) {
    if (!convo || convo.greeted) return;
    convo.greeted = true;
    save();
    const thinking = showThinking("Thinking...");

    try {
      const res = await fetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: "[system_greet]",
          history: [],
          profile
        })
      });
      const data = await res.json().catch(() => ({}));
      const reply = data.reply || "Hello. How can I help today?";
      thinking.replace(reply);
      convo.messages.push({ role: "assistant", content: reply });
      convo.updatedAt = nowISO();
      save();
      renderSidebar();
    } catch {
      thinking.replace("Hello. How can I help today?");
    }
  }

  function renderChat() {
    el.messages.innerHTML = "";
    const convo = getActive();
    if (!convo.messages || !convo.messages.length) {
      initialGreeting(convo);
      return;
    }
    convo.messages.forEach((msg) => appendBubble(msg.role, msg.content));
  }

  async function sendMessage() {
    const convo = getActive();
    const raw = String(el.input.value || "").trim();
    if (!raw && !db.pendingFiles.length) return;

    el.input.value = "";
    resizeInput();
    setTitle(convo, raw || db.pendingFiles.map((file) => file.name).join(", "));

    let displayText = raw;
    let context = "";

    if (db.pendingFiles.length) {
      const fileNames = db.pendingFiles.map((file) => file.name).join(", ");
      displayText = displayText ? `${displayText}\n\n(Attached: ${fileNames})` : `[Attached: ${fileNames}]`;
      const fileReview = showFileReview(
        db.pendingFiles.length === 1 ? "Reading your file" : `Reading ${db.pendingFiles.length} files`,
        "Checking the upload before I answer..."
      );
      try {
        const uploaded = await uploadFiles(db.pendingFiles);
        context = uploaded.context ? `\n\nAttachment context:\n${uploaded.context}` : "";
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
      appendBubble("user", raw);
      convo.messages.push({ role: "user", content: raw });
      convo.updatedAt = nowISO();
      save();
      renderSidebar();
      await generateImage(raw.slice(7).trim(), convo);
      return;
    }

    appendBubble("user", displayText || "(attachment only)");
    convo.messages.push({ role: "user", content: raw || "[attachment only]" });
    convo.updatedAt = nowISO();
    save();
    renderSidebar();

    const thinking = showThinking("Thinking...");
    try {
      const history = convo.messages.slice(-maxHistory).map((msg) => ({ role: msg.role, content: msg.content }));
      const input = raw + context;
      const res = await fetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, history, profile })
      });
      const data = await res.json().catch(() => ({}));
      const reply = data.reply || data.detail || "(no reply)";
      thinking.replace(reply);
      convo.messages.push({ role: "assistant", content: reply });
      convo.updatedAt = nowISO();
      save();
      renderSidebar();
    } catch (err) {
      thinking.replace(`Error: ${err.message || err}`);
    }
  }

  function newChat() {
    const convo = newConversation("GPT 5.4");
    db.convos.unshift(convo);
    db.activeId = convo.id;
    save();
    renderSidebar();
    renderChat();
    el.input.focus();
  }

  el.search.addEventListener("input", renderConversations);
  el.clearSearch.addEventListener("click", () => {
    el.search.value = "";
    renderConversations();
  });

  el.clearImages.addEventListener("click", async () => {
    await clearStoredImages();
    await renderRecentImages();
  });

  el.sendBtn.addEventListener("click", sendMessage);
  el.attachBtn.addEventListener("click", () => el.fileInput.click());
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
    renderChat();
    resizeInput();
    const active = getActive();
    if (!active.messages.length) {
      initialGreeting(active);
    }
  }

  initialize();
})();
