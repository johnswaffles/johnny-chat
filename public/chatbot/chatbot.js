(function () {
  const host = String(window.location.hostname || "").toLowerCase();
  const profile = host.includes("618help.com") ? "mowing" : "ai";
  const apiBase = String(window.JOHNNY_CHAT_API_BASE_URL || "https://johnny-chat.onrender.com").replace(/\/+$/, "");
  const storeKey = `johnny_chatbot_${profile}_convos_v1`;
  const activeKey = `${storeKey}_active`;
  const maxHistory = 18;

  const config = profile === "mowing"
    ? {
        brand: "618help.com",
        homeHref: "https://618help.com",
        chatHref: "/chatbot/",
        mowingHref: "https://618help.com",
        title: "Ask about mowing, quotes, and yard details.",
        lead: "This dedicated chatbot keeps the mowing conversation in one clean place, with file uploads, saved threads, and quick follow-up questions.",
        modeTitle: "Mowing mode",
        modeCopy: "Best for mowing quotes, service questions, property photos, and quick scheduling help.",
        sidebarTitle: "Mowing chats",
        sidebarNote: "Share the basics, and the chatbot will help narrow down the property details before you contact Johnny.",
        heroTiles: [
          ["Quote ready", "Collect the basics needed for mowing estimates and service questions."],
          ["Yard photos", "Upload a picture if it helps explain the property or the obstacle layout."],
          ["Saved threads", "Keep a few chats on this device while you compare options."],
          ["Fast follow-up", "Ask short questions and get a practical answer right away."]
        ],
        prompts: [
          "How much is mowing?",
          "Can you help with a 5 acre yard?",
          "Do you offer weed eating?",
          "Tell me about the 3-weeks-upfront deal"
        ],
        footer: "Tip: use the chat to ask your mowing question first, then jump to the contact form if you want a quote.",
        status: "Mowing assistant"
      }
    : {
        brand: "justaskjohnny.com",
        homeHref: "https://justaskjohnny.com",
        chatHref: "/chatbot/",
        mowingHref: "https://618help.com",
        title: "A chatbot that feels like a product, not a widget.",
        lead: "Use this page to demo custom assistants, file-aware chat, and role-play conversations that help sell the build.",
        modeTitle: "AI demo mode",
        modeCopy: "Best for chatbot demos, role-play prompts, file uploads, and custom business assistant ideas.",
        sidebarTitle: "AI chats",
        sidebarNote: "Use the page to demo a business idea, upload a file, or practice a customer conversation.",
        heroTiles: [
          ["Role-play", "Practice business conversations and let the bot act like a real front desk assistant."],
          ["File aware", "Upload screenshots, PDFs, or reference docs and let the bot use that context."],
          ["Saved threads", "Keep a few chats on this device while you test different demos."],
          ["Glass polish", "A translucent frosted layout that feels more like a product than a page."]
        ],
        prompts: [
          "What can a custom chatbot do for my business?",
          "Role-play a pizza shop assistant.",
          "How would this work for an art app?",
          "Give me a demo of a lead intake bot"
        ],
        footer: "Tip: type /image before a prompt if you want the assistant to generate an image instead of a reply.",
        status: "AI assistant"
      };

  const el = {
    brand: document.getElementById("site-brand"),
    navHome: document.getElementById("nav-home"),
    navChatbots: document.getElementById("nav-chatbots"),
    navMowing: document.getElementById("nav-mowing"),
    navCozy: document.getElementById("nav-cozy"),
    navContact: document.getElementById("nav-contact"),
    heroEyebrow: document.getElementById("hero-eyebrow"),
    heroTitle: document.getElementById("hero-title"),
    heroLead: document.getElementById("hero-lead"),
    modeTitle: document.getElementById("mode-title"),
    modeCopy: document.getElementById("mode-copy"),
    sidebarTitle: document.getElementById("sidebar-title"),
    sidebarNote: document.getElementById("sidebar-note"),
    statusChip: document.getElementById("status-chip"),
    statusChip2: document.getElementById("status-chip-2"),
    chatKicker: document.getElementById("chat-kicker"),
    chatTitle: document.getElementById("chat-title"),
    footerNote: document.getElementById("footer-note"),
    recentImages: document.getElementById("recent-images"),
    clearImages: document.getElementById("clear-images"),
    promptDeck: document.getElementById("prompt-deck"),
    conversationList: document.getElementById("conversation-list"),
    messages: document.getElementById("messages"),
    attachmentPreview: document.getElementById("attachment-preview"),
    search: document.getElementById("search"),
    clearSearch: document.getElementById("clearSearch"),
    input: document.getElementById("input"),
    sendBtn: document.getElementById("send-btn"),
    attachBtn: document.getElementById("attach-btn"),
    fileInput: document.getElementById("file-input"),
    modal: document.getElementById("modal"),
    modalImage: document.getElementById("modal-image"),
    closeModal: document.getElementById("close-modal")
  };

  document.title = profile === "mowing" ? "Johnny Chat · Mowing" : "Johnny Chat · AI";
  document.documentElement.dataset.profile = profile;

  if (el.brand) {
    el.brand.textContent = config.brand;
    el.brand.href = config.homeHref;
  }
  if (el.navHome) el.navHome.href = config.homeHref;
  if (el.navChatbots) el.navChatbots.href = config.chatHref;
  if (el.navMowing) el.navMowing.href = config.mowingHref;
  if (el.navCozy) el.navCozy.href = "/cozy-builder/";
  if (el.navContact) el.navContact.href = "/contact/";

  el.heroEyebrow.textContent = profile === "mowing" ? "Mowing chatbot" : "AI chatbot";
  el.heroTitle.textContent = config.title;
  el.heroLead.textContent = config.lead;
  el.modeTitle.textContent = config.modeTitle;
  el.modeCopy.textContent = config.modeCopy;
  el.sidebarTitle.textContent = config.sidebarTitle;
  el.sidebarNote.textContent = config.sidebarNote;
  el.statusChip.textContent = config.status;
  el.chatKicker.textContent = config.brand;
  el.chatTitle.textContent = profile === "mowing" ? "Mowing chat" : "AI chat";
  el.footerNote.innerHTML = config.footer;

  config.heroTiles.forEach((tile, idx) => {
    const titleEl = document.getElementById(`tile-${idx + 1}-title`);
    const copyEl = document.getElementById(`tile-${idx + 1}-copy`);
    if (titleEl) titleEl.textContent = tile[0];
    if (copyEl) copyEl.textContent = tile[1];
  });

  config.prompts.forEach((text) => {
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

  const DB_KEY = `${storeKey}_v1`;
  let convos = readJSON(DB_KEY, []);
  if (!Array.isArray(convos)) convos = [];
  let activeId = localStorage.getItem(activeKey) || "";
  let currentMenu = null;
  let pendingFiles = [];
  const imageDbName = `${storeKey}_images_v1`;
  const imageStore = "images";
  let imageDbPromise = null;

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function openImageDb() {
    if (!("indexedDB" in window)) return Promise.resolve(null);
    if (imageDbPromise) return imageDbPromise;
    imageDbPromise = new Promise((resolve) => {
      const req = indexedDB.open(imageDbName, 1);
      req.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(imageStore)) {
          db.createObjectStore(imageStore, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    return imageDbPromise;
  }

  async function getStoredImages() {
    const db = await openImageDb();
    if (!db) return [];
    return new Promise((resolve) => {
      const tx = db.transaction(imageStore, "readonly");
      const req = tx.objectStore(imageStore).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async function putStoredImage(entry) {
    const db = await openImageDb();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(imageStore, "readwrite");
      tx.objectStore(imageStore).put(entry);
      tx.oncomplete = () => resolve();
    });
  }

  async function clearStoredImages() {
    const db = await openImageDb();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(imageStore, "readwrite");
      tx.objectStore(imageStore).clear();
      tx.oncomplete = () => resolve();
    });
  }

  async function trimStoredImages(max) {
    const db = await openImageDb();
    if (!db) return;
    const items = await getStoredImages();
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const overflow = items.slice(max);
    if (!overflow.length) return;
    await new Promise((resolve) => {
      const tx = db.transaction(imageStore, "readwrite");
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
      empty.className = "sidebar-note";
      empty.style.margin = "0";
      empty.style.padding = "12px";
      empty.textContent = "Your generated images will appear here.";
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

  function save() {
    localStorage.setItem(DB_KEY, JSON.stringify(convos));
    if (activeId) localStorage.setItem(activeKey, activeId);
  }

  function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : `chat-${Math.random().toString(36).slice(2)}`;
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
    if (activeId) {
      const found = convos.find((c) => c && c.id === activeId);
      if (found) return found;
    }
    if (!convos.length) {
      convos.unshift(newConversation());
    }
    activeId = convos[0].id;
    save();
    return convos[0];
  }

  function setTitle(c, firstText) {
    if (!c || c.title !== "(new conversation)") return;
    const t = String(firstText || "").trim().replace(/\s+/g, " ").slice(0, 60);
    if (t) c.title = t;
  }

  function esc(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function pretty(text) {
    let s = esc(text);
    s = s
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    return s.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
      if (/^[-•]\s+/.test(line)) return `<li>${line.replace(/^[-•]\s+/, "")}</li>`;
      return `<p>${line}</p>`;
    }).join("").replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");
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
      bubble,
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
          setTimeout(() => { copy.textContent = "⧉"; }, 1200);
        });
        actions.appendChild(copy);
        bubble.appendChild(actions);
      }
    };
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
        setTimeout(() => { copy.textContent = "⧉"; }, 1200);
      });
      actions.appendChild(copy);
      bubble.appendChild(actions);
    }
    el.messages.appendChild(bubble);
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  function transcript(c) {
    return (c.messages || []).map((m) => `${String(m.role || "assistant").toUpperCase()}: ${m.content || ""}`).join("\n\n");
  }

  function renderConversations() {
    const q = String(el.search.value || "").toLowerCase().trim();
    el.conversationList.innerHTML = "";
    convos
      .slice()
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .filter((c) => !q || (c.title || "").toLowerCase().includes(q) || transcript(c).toLowerCase().includes(q))
      .forEach((c) => {
        const row = document.createElement("div");
        row.className = `conversation-row${c.id === activeId ? " active" : ""}`;

        const top = document.createElement("div");
        top.className = "conversation-row-top";

        const title = document.createElement("div");
        title.className = "conversation-title";
        title.textContent = c.title || "(new conversation)";

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
        download.addEventListener("click", (e) => {
          e.stopPropagation();
          const blob = new Blob([transcript(c)], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${(c.title || "conversation").replace(/[^\w\-]+/g, "_")}.txt`;
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
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          convos = convos.filter((x) => x && x.id !== c.id);
          if (activeId === c.id) {
            activeId = convos[0]?.id || "";
            if (!activeId) {
              convos.unshift(newConversation());
              activeId = convos[0].id;
            }
          }
          save();
          renderSidebar();
          renderChat();
          menu.classList.remove("show");
        });

        menu.appendChild(download);
        menu.appendChild(del);
        menuBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          closeMenus(menu);
          menu.classList.toggle("show");
          currentMenu = menu;
        });
        menuWrap.appendChild(menuBtn);
        menuWrap.appendChild(menu);

        top.appendChild(title);
        top.appendChild(menuWrap);

        const meta = document.createElement("div");
        meta.className = "conversation-meta";
        meta.textContent = `${(c.messages || []).length} messages • ${new Date(c.updatedAt || c.createdAt || Date.now()).toLocaleDateString()}`;

        row.appendChild(top);
        row.appendChild(meta);
        row.addEventListener("click", (e) => {
          if (e.target.closest(".menu-wrap")) return;
          activeId = c.id;
          save();
          renderSidebar();
          renderChat();
        });

        el.conversationList.appendChild(row);
      });
  }

  function closeMenus(except) {
    document.querySelectorAll(".menu.show").forEach((m) => {
      if (m !== except) m.classList.remove("show");
    });
    if (!except) currentMenu = null;
  }

  function resizeInput() {
    el.input.style.height = "auto";
    el.input.style.height = `${Math.min(el.input.scrollHeight, 160)}px`;
  }

  function renderAttachments() {
    el.attachmentPreview.innerHTML = "";
    if (!pendingFiles.length) {
      el.attachmentPreview.classList.remove("has-files");
      return;
    }
    el.attachmentPreview.classList.add("has-files");
    pendingFiles.forEach((file, idx) => {
      const item = document.createElement("div");
      item.className = "attachment-item";
      if (file.type.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.addEventListener("click", () => openModal(img.src));
        item.appendChild(img);
      } else {
        const pdf = document.createElement("div");
        pdf.className = "pdf-icon";
        pdf.textContent = "PDF";
        item.appendChild(pdf);
      }
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-attach";
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        pendingFiles.splice(idx, 1);
        renderAttachments();
      });
      item.appendChild(remove);
      el.attachmentPreview.appendChild(item);
    });
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

  async function uploadFiles(files) {
    const fd = new FormData();
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

  async function generateImage(prompt, convo, thinking) {
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
      img.style.borderRadius = "16px";
      img.style.cursor = "pointer";
      img.addEventListener("click", () => openModal(src));
      bubble.appendChild(img);
      el.messages.replaceChild(bubble, loader);
      convo.messages.push({ role: "assistant", content: "[Generated Image]" });
      save();
      renderSidebar();
    } catch (err) {
      loader.innerHTML = `<span style="color:#b42318;">Generation failed: ${esc(err.message || err)}</span>`;
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
    if (!raw && !pendingFiles.length) return;

    el.input.value = "";
    resizeInput();

    setTitle(convo, raw || pendingFiles.map((f) => f.name).join(", "));

    let displayText = raw;
    let context = "";

    if (pendingFiles.length) {
      const fileNames = pendingFiles.map((f) => f.name).join(", ");
      displayText = displayText ? `${displayText}\n\n(Attached: ${fileNames})` : `[Attached: ${fileNames}]`;
      try {
        const uploaded = await uploadFiles(pendingFiles);
        context = uploaded.context ? `\n\nAttachment context:\n${uploaded.context}` : "";
      } catch (err) {
        appendBubble("assistant", `Upload failed: ${err.message || err}`);
      }
      pendingFiles = [];
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
      const history = convo.messages.slice(-maxHistory).map((m) => ({ role: m.role, content: m.content }));
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
    const convo = newConversation();
    convos.unshift(convo);
    activeId = convo.id;
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

  el.sendBtn.addEventListener("click", sendMessage);
  el.attachBtn.addEventListener("click", () => el.fileInput.click());
  el.fileInput.addEventListener("change", () => {
    const files = Array.from(el.fileInput.files || []);
    if (!files.length) return;
    pendingFiles = pendingFiles.concat(files);
    renderAttachments();
    el.fileInput.value = "";
  });

  el.input.addEventListener("input", resizeInput);
  el.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  el.modal.addEventListener("click", (e) => {
    if (e.target === el.modal || e.target === el.closeModal) closeModal();
  });
  el.closeModal.addEventListener("click", closeModal);
  if (el.clearImages) {
    el.clearImages.addEventListener("click", async () => {
      await clearStoredImages();
      await renderRecentImages();
    });
  }

  document.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-action");
      if (action === "new-chat") newChat();
      if (action === "attach") el.fileInput.click();
      if (action === "image") {
        el.input.value = "/image ";
        el.input.focus();
        resizeInput();
      }
    });
  });

  document.addEventListener("click", () => closeMenus(null));

  function renderSidebar() {
    renderConversations();
  }

  const existing = getActive();
  if (!existing.messages.length) {
    initialGreeting(existing);
  }
  renderSidebar();
  renderRecentImages();
  renderChat();
  resizeInput();
})();
