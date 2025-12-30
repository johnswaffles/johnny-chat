        document.addEventListener("DOMContentLoaded", function () {
            if (window.pdfjsLib) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            }
        });
    </script>
    <script>
        (function () {
            'use strict';
            var $ = function (id) { return document.getElementById(id) };
            document.querySelectorAll('.gen-overlay').forEach(function (n) { n.remove() });

            /* ---------- Endpoints ---------- */
            var API_BASE = "https://johnny-chat.onrender.com";
            var URLS = { CHAT: API_BASE + "/api/chat", BEAUTIFY: API_BASE + "/api/beautify", UPLOAD: API_BASE + "/upload", SUM: API_BASE + "/summarize-text", QUERY: API_BASE + "/query", GEN: API_BASE + "/generate-image", GEN_EDIT: API_BASE + "/generate-image-edit" };

            /* ---------- Utils ---------- */
            function escapeHTML(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") }
            function stripCites(s) { return String(s || "").replace(/\[[0-9]+\]/g, "").replace(/\((?:source|sources):.*?\)/gi, "").replace(/https?:\/\/\S+/gi, "") }
            function prettyHTML(t) {
                var L = String(t || "").split(/\r?\n/).map(function (l) { return l.trim() });
                var h = "", ul = false; function end() { if (ul) { h += "</ul>"; ul = false } }
                for (var i = 0; i < L.length; i++) {
                    var l = L[i]; if (!l) { end(); continue }
                    if (/^[-•]\s+/.test(l)) { if (!ul) { h += "<ul>"; ul = true } h += "<li>" + escapeHTML(l.replace(/^[-•]\s+/, "")) + "</li>"; }
                    else { end(); h += "<p>" + escapeHTML(l) + "</p>"; }
                }
                end(); return h || "<p></p>";
            }
            function autoResize(ta) { if (!ta) return; ta.style.height = "auto"; ta.style.height = (ta.scrollHeight + 2) + "px" }
            function uid() { return (crypto.randomUUID ? crypto.randomUUID() : ("id-" + Math.random().toString(36).slice(2))) }
            function nowISO() { return new Date().toISOString() }
            function safeParse(raw, fb) { try { var v = JSON.parse(raw); return (v === null ? fb : v) } catch (_) { return fb } }

            /* ---------- Image quota (10/day) ---------- */
            var QUOTA_KEY = "johnny_img_quota_v1", DAILY_LIMIT = 10;
            function today() { return new Date().toISOString().slice(0, 10) }
            function quotaRead() { var raw = localStorage.getItem(QUOTA_KEY), d = null; try { d = JSON.parse(raw) } catch (e) { } var t = today(); if (!d || d.date !== t) { d = { date: t, count: 0 }; localStorage.setItem(QUOTA_KEY, JSON.stringify(d)) } return d }
            function quotaCanGenerate() { return quotaRead().count < DAILY_LIMIT }
            function quotaInc() { var d = quotaRead(); d.count += 1; localStorage.setItem(QUOTA_KEY, JSON.stringify(d)) }
            function showQuota() { var q = $("quota"); q.classList.add("show"); q.setAttribute("aria-hidden", "false") }
            function hideQuota() { var q = $("quota"); q.classList.remove("show"); q.setAttribute("aria-hidden", "true") }
            $("quotaClose").addEventListener("click", hideQuota);
            $("quotaPro").addEventListener("click", function () { hideQuota(); window.scrollTo({ top: 0, behavior: "smooth" }); var pro = document.querySelector("[data-pro-button], #pro, #proButton"); if (pro) { pro.classList.add("pulse"); setTimeout(function () { pro.classList.remove("pulse") }, 1600) } });

            /* ---------- IndexedDB image cache ---------- */
            var dbPromise = null;
            function idbOpen() { if (!window.indexedDB) return Promise.resolve(null); if (dbPromise) return dbPromise; dbPromise = new Promise(function (res) { var r = indexedDB.open("johnny_images_db", 1); r.onupgradeneeded = function (e) { var db = e.target.result; if (!db.objectStoreNames.contains("images")) db.createObjectStore("images", { keyPath: "id" }) }; r.onsuccess = function () { res(r.result) }; r.onerror = function () { res(null) } }); return dbPromise }
            async function idbPut(img) { var db = await idbOpen(); if (!db) return; return new Promise(function (resolve) { var tx = db.transaction("images", "readwrite"); tx.objectStore("images").put(img); tx.oncomplete = function () { resolve() } }) }
            async function idbGetAll() { var db = await idbOpen(); if (!db) return []; return new Promise(function (resolve) { var tx = db.transaction("images", "readonly"); var req = tx.objectStore("images").getAll(); req.onsuccess = function () { resolve(req.result || []) }; req.onerror = function () { resolve([]) } }) }
            async function idbTrim(max) { var db = await idbOpen(); if (!db) return; var items = await idbGetAll(); items.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt) }); if (items.length <= max) return; var toDelete = items.slice(max); await new Promise(function (resolve) { var tx = db.transaction("images", "readwrite"); var st = tx.objectStore("images"); toDelete.forEach(function (x) { st.delete(x.id) }); tx.oncomplete = function () { resolve() } }) }
            async function idbClear() { var db = await idbOpen(); if (!db) return; return new Promise(function (resolve) { var tx = db.transaction("images", "readwrite"); tx.objectStore("images").clear(); tx.oncomplete = function () { resolve() } }) }
            var imagesCache = [];
            async function loadImages() { var all = await idbGetAll(); all.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt) }); imagesCache = all.slice(0, 300); renderImages() }
            function renderImages() { var grid = $("imgGrid"); grid.innerHTML = ""; imagesCache.forEach(function (it) { var im = document.createElement("img"); im.className = "mini"; im.src = it.url; im.addEventListener("click", function () { openFullscreen(it.url) }); grid.appendChild(im) }) }
            async function addImage(url) { await idbPut({ id: uid(), url, createdAt: nowISO() }); await idbTrim(300); await loadImages() }
            $("clearRecentImages").addEventListener("click", async function () { await idbClear(); imagesCache = []; renderImages() });

            /* ---------- Chat state ---------- */
            var STORE_KEY = "johnny_convos_v33";
            var convos = safeParse(localStorage.getItem(STORE_KEY) || "[]", []); if (!Array.isArray(convos)) convos = [];
            var activeId = localStorage.getItem("johnny_active_id") || "";
            var sessionContext = safeParse(localStorage.getItem("johnny_session_ctx") || "{}", {}); // {last_city:"St. Louis, MO"}

            function newConvo(t) { return { id: uid(), title: t || "(new conversation)", createdAt: nowISO(), updatedAt: nowISO(), messages: [], memory: "", memoryUpdatedAt: "", greeted: false } }
            function findConvo(id) { return (convos || []).find(function (c) { return c && c.id === id }) }
            function ensureActive() { if (activeId && findConvo(activeId)) return activeId; if (!convos.length) { convos.unshift(newConvo("(new conversation)")) } activeId = convos[0].id; localStorage.setItem("johnny_active_id", activeId); return activeId }
            function stripDisplayDeep(arr) { return (arr || []).map(function (c) { if (!c) return null; var cc = { id: c.id, title: c.title, createdAt: c.createdAt, updatedAt: c.updatedAt, messages: [], memory: c.memory || "", memoryUpdatedAt: c.memoryUpdatedAt || "", greeted: !!c.greeted }; (c.messages || []).forEach(function (m) { cc.messages.push({ role: m.role, content: m.content }) }); return cc }).filter(Boolean) }
            function tryStore(obj) { try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); return true } catch (_) { return false } }
            function saveConvos() {
                var sorted = (convos || []).filter(Boolean).slice().sort(function (a, b) { return new Date(b.updatedAt) - new Date(a.updatedAt) });
                var base = stripDisplayDeep(sorted); if (tryStore(base)) return;
                var keepMsgs = 120; while (keepMsgs >= 20) { var trimmed = base.map(function (c) { return Object.assign({}, c, { messages: c.messages.slice(-keepMsgs) }) }); if (tryStore(trimmed)) { convos = trimmed; return; } keepMsgs -= 20 }
                var limits = [30, 25, 20, 15, 10, 5, 3, 1]; for (var i = 0; i < limits.length; i++) { var limited = base.slice(0, limits[i]).map(function (c) { return Object.assign({}, c, { messages: c.messages.slice(-40) }) }); if (tryStore(limited)) { convos = limited; return; } }
                localStorage.removeItem(STORE_KEY); localStorage.setItem(STORE_KEY, "[]"); convos = [];
            }
            function saveSessionCtx() { localStorage.setItem("johnny_session_ctx", JSON.stringify(sessionContext || {})) }

            /* ---------- UI ---------- */
            var messagesEl = $("messages");
            function appendBubble(role, text) {
                var wrap = document.createElement("div"); var b = document.createElement("div");
                b.className = "bubble" + (role === "user" ? " user" : ""); wrap.appendChild(b);
                if (role === "user") { b.textContent = text }
                else {
                    b.dataset.raw = text; b.innerHTML = prettyHTML(stripCites(text));
                    var tip = document.createElement("div"); tip.className = "copy-tip"; tip.textContent = "Copied!";
                    var btn = document.createElement("button"); btn.className = "copy-btn"; btn.textContent = "⧉";
                    btn.addEventListener("click", function () { navigator.clipboard.writeText(b.dataset.raw || b.textContent || "").then(function () { tip.style.display = "inline-block"; btn.textContent = "✓"; setTimeout(function () { tip.style.display = "none"; btn.textContent = "⧉" }, 1200) }) });
                    b.appendChild(btn); b.appendChild(tip)
                }
                messagesEl.appendChild(wrap); messagesEl.scrollTop = messagesEl.scrollHeight
            }
            function showThinking() { var wrap = document.createElement("div"); var b = document.createElement("div"); b.className = "bubble"; b.innerHTML = '<span class="think"><span class="orbit"></span><span>Thinking…</span></span>'; wrap.appendChild(b); messagesEl.appendChild(wrap); messagesEl.scrollTop = messagesEl.scrollHeight; return { replace: function (txt) { b.dataset.raw = txt; b.innerHTML = prettyHTML(stripCites(txt)) }, container: wrap } }
            function setTitleIfPlaceholder(c, firstUserText) { if (!c) return; if (!c.title || c.title === "(new conversation)") { var t = String(firstUserText || "").trim().replace(/\s+/g, " ").slice(0, 60); c.title = t.length ? t : "(new conversation)" } }
            function transcriptText(c) { var lines = []; (c.messages || []).forEach(function (m) { lines.push((m.role || "assistant").toUpperCase() + ": " + String(m.content || "")) }); return lines.join("\n\n") }

            function renderSidebar() {
                var cont = $("convos"); cont.innerHTML = "";
                (convos || []).slice().sort(function (a, b) { return new Date(b.updatedAt) - new Date(a.updatedAt) }).forEach(function (c) {
                    if (!c) return; var row = document.createElement("div"); row.className = "row" + (c.id === activeId ? " active" : "");
                    var t = document.createElement("div"); t.className = "title"; t.textContent = c.title || "(new conversation)";
                    var keb = document.createElement("button"); keb.className = "kebab"; keb.textContent = "⋯";
                    var menu = document.createElement("div"); menu.className = "menu";
                    var dl = document.createElement("button"); dl.textContent = "Download transcript";
                    var del = document.createElement("button"); del.className = "danger"; del.textContent = "Delete conversation";
                    menu.appendChild(dl); menu.appendChild(del);
                    row.appendChild(t); row.appendChild(keb); row.appendChild(menu);
                    row.addEventListener("click", function (e) { if (e.target === keb || menu.contains(e.target)) return; activeId = c.id; localStorage.setItem("johnny_active_id", activeId); renderChat(); renderSidebar() });
                    keb.addEventListener("click", function (e) { e.stopPropagation(); document.querySelectorAll(".menu.show").forEach(function (m) { m.classList.remove("show") }); menu.classList.toggle("show") });
                    dl.addEventListener("click", function (e) { e.stopPropagation(); menu.classList.remove("show"); var txt = transcriptText(c); var blob = new Blob([txt], { type: "text/plain" }); var url = URL.createObjectURL(blob); var a = document.createElement("a"); a.href = url; a.download = (c.title || "conversation") + ".txt"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url) });
                    del.addEventListener("click", function (e) { e.stopPropagation(); menu.classList.remove("show"); convos = (convos || []).filter(function (x) { return x && x.id !== c.id }); if (activeId === c.id) { activeId = ""; ensureActive() } saveConvos(); renderSidebar(); renderChat() });
                    cont.appendChild(row);
                });
            }

            function renderChat() {
                messagesEl.innerHTML = "";
                var c = findConvo(ensureActive());
                if (!c || !Array.isArray(c.messages) || !c.messages.length) { initialGreeting(c); return }
                c.messages.forEach(function (m) { appendBubble(m.role, m.content || "") });
            }

            /* ---------- Memory (rolling) ---------- */
            async function maybeUpdateMemory(c) {
                try {
                    var msgCount = (c.messages || []).length;
                    var lastUpdate = c.memoryUpdatedAt ? new Date(c.memoryUpdatedAt).getTime() : 0;
                    var stale = Date.now() - lastUpdate > 1000 * 60 * 5;
                    if (msgCount >= 16 && stale) {
                        var recent = c.messages.slice(-60).map(function (m) { return (m.role || "assistant") + ": " + (m.content || "") }).join("\n");
                        var r = await fetch(URLS.SUM, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: recent, purpose: "conversation memory (compact facts, preferences, unresolved tasks)" }) });
                        var j = await r.json(); var memo = (j && j.summary ? String(j.summary) : "").slice(0, 1200);
                        if (memo) { c.memory = memo; c.memoryUpdatedAt = nowISO(); saveConvos(); }
                    }
                } catch (_) { }
            }

            /* ---------- City capture ---------- */
            function updateLastCityIfPresent(text) {
                var m = String(text || "").match(/\b(?:in|at|for)\s+([A-Za-z\s\.-]+?,\s*[A-Z]{2})\b/)
                    || String(text || "").match(/\b(?:in|at|for)\s+([A-Za-z\s\.-]+)\b/);
                if (m && m[1] && !/that city|this city/i.test(m[1])) {
                    sessionContext.last_city = m[1].trim(); saveSessionCtx();
                }
            }

            /* ---------- System/Directives ---------- */
            function buildSystemMessages(userText, c) {
                var t = String(userText || "");
                var wantsWeather = /\b(weather|forecast|temperature|temp|wind|humidity|conditions)\b/i.test(t);
                var currentish = /\b(current|right now|now|today|outside|this (?:morning|afternoon|evening)|tonight)\b/i.test(t);
                var msgs = [];
                msgs.push({
                    role: "system", content: [
                        "Policy:",
                        "• Ask at most ONE follow-up question only if essential to proceed. Otherwise answer directly.",
                        "• After that single follow-up (if any), answer decisively.",
                        "• IMPORTANT: If the user asks to generate/create/draw an image or picture, DO NOT generate ASCII art or SVG code.",
                        "• Instead, reply ONLY with the command: /image <detailed_prompt_describing_the_scene>",
                        "Weather defaults:",
                        "• Use America/Chicago timezone for any times you mention.",
                        "• Use imperial units (°F, mph) and never show Celsius unless explicitly requested.",
                        (wantsWeather && currentish ? "• If user asks for current weather today, add a short 1960s-weatherman style day report at the end." : "")
                    ].filter(Boolean).join("\n")
                });
                if (c && c.memory) { msgs.push({ role: "system", content: "Conversation memory (use to personalize; don't parrot):\n" + c.memory }); }
                if (sessionContext.last_city) { msgs.push({ role: "system", content: "Last referenced city this session: " + sessionContext.last_city }); }
                return msgs;
            }

            /* ---------- Mobile Sidebar Toggle ---------- */
            var hamburger = $("hamburger");
            var sideOverlay = $("sideOverlay");
            var sidebar = $("sidebar");

            function toggleSidebar() {
                hamburger.classList.toggle("active");
                sidebar.classList.toggle("open");
                sideOverlay.classList.toggle("show");
            }

            hamburger.addEventListener("click", toggleSidebar);
            sideOverlay.addEventListener("click", toggleSidebar);

            /* ---------- Chat Attachments & Commands ---------- */
            var btnAttach = $("btnAttach");
            var chatFiles = $("chatFiles");
            var attachPreview = $("attachPreview");
            var cmdHint = $("cmdHint");
            var pendingAttachments = [];

            btnAttach.addEventListener("click", function () { chatFiles.click() });

            chatFiles.addEventListener("change", function () {
                var files = Array.from(chatFiles.files || []);
                pendingAttachments = pendingAttachments.concat(files);
                renderAttachments();
                chatFiles.value = ""; // reset
            });

            function renderAttachments() {
                attachPreview.innerHTML = "";
                if (!pendingAttachments.length) {
                    attachPreview.classList.remove("has-files");
                    return;
                }
                attachPreview.classList.add("has-files");

                pendingAttachments.forEach(function (f, idx) {
                    var item = document.createElement("div");
                    item.className = "attachment-item";

                    if (f.type.startsWith("image/")) {
                        var img = document.createElement("img");
                        img.src = URL.createObjectURL(f);
                        item.appendChild(img);
                    } else {
                        var icon = document.createElement("div");
                        icon.className = "pdf-icon";
                        icon.textContent = "PDF";
                        item.appendChild(icon);
                    }

                    var del = document.createElement("button");
                    del.className = "remove-attach";
                    del.textContent = "×";
                    del.addEventListener("click", function () {
                        pendingAttachments.splice(idx, 1);
                        renderAttachments();
                    });
                    item.appendChild(del);

                    attachPreview.appendChild(item);
                });
            }

            // Command detection
            $("input").addEventListener("input", function (e) {
                var val = e.target.value.trim();
                if (val.startsWith("/")) {
                    if (val.startsWith("/image")) {
                        cmdHint.innerHTML = "Generating image: <strong>" + escapeHTML(val.slice(6).trim() || "...") + "</strong>";
                        cmdHint.classList.add("show");
                    } else {
                        cmdHint.classList.remove("show");
                    }
                } else {
                    cmdHint.classList.remove("show");
                }
            });

            /* ---------- Unified Send Message ---------- */

            // Shared image generation logic
            async function performImageGeneration(prompt, c, container) {
                // container is the div wrapper where we should show status/result
                container.innerHTML = '<div class="generating-indicator"><div class="orbit"></div><span>Generating canvas...</span></div>';
                messagesEl.scrollTop = messagesEl.scrollHeight;

                try {
                    if (!quotaCanGenerate()) {
                        container.innerHTML = '<div class="bubble">Daily image limit reached. Check top right for Pro.</div>';
                        showQuota();
                        return;
                    }

                    var r = await fetch(URLS.GEN, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: prompt, size: "1024x1024" }) });
                    var j = await r.json();

                    if (!r.ok) throw new Error(j.detail || "Generation failed");

                    var url = "data:image/png;base64," + j.image_b64;
                    addImage(url);
                    quotaInc();

                    container.innerHTML = '';
                    var imgBubble = document.createElement("img");
                    imgBubble.className = "bubble-image";
                    imgBubble.src = url;
                    imgBubble.onclick = function () { openFullscreen(url) };
                    container.appendChild(imgBubble);

                    // Add generic placeholder to history so we know an image was here
                    // (Note: we don't store the base64 in conversation history to save space)
                    if (!c.messages.some(function (m) { return m.content === "[Generated Image]" && m.role === "assistant" })) {
                        c.messages.push({ role: "assistant", content: "[Generated Image]" });
                        saveConvos();
                    }

                } catch (e) {
                    container.innerHTML = '<div class="bubble">Generation failed: ' + e.message + '</div>';
                }
            }

            async function sendMessage() {
                var inputDom = $("input");
                var txt = String(inputDom.value || "").trim();

                // 1. Handle Commands (Manual)
                if (txt.startsWith("/image ")) {
                    var prompt = txt.slice(7).trim();
                    if (!prompt) return;

                    inputDom.value = "";
                    cmdHint.classList.remove("show");

                    var c = findConvo(ensureActive());
                    if (!c) { c = newConvo("Image Generation"); convos.unshift(c); activeId = c.id; }

                    appendBubble("user", "/image " + prompt);
                    c.messages.push({ role: "user", content: "Generate image: " + prompt });
                    saveConvos();

                    var wrap = document.createElement("div");
                    messagesEl.appendChild(wrap);
                    performImageGeneration(prompt, c, wrap);
                    return;
                }

                if (!txt && !pendingAttachments.length) return;

                inputDom.value = "";
                updateLastCityIfPresent(txt);

                var c = findConvo(ensureActive());
                if (!c) { c = newConvo("(new conversation)"); convos.unshift(c); activeId = c.id }
                c.messages = Array.isArray(c.messages) ? c.messages : [];
                setTitleIfPlaceholder(c, txt);

                // 2. Handle Attachments
                var contextText = "";
                if (pendingAttachments.length) {
                    var attachMsg = "Attaching " + pendingAttachments.length + " file" + (pendingAttachments.length > 1 ? "s" : "") + "...";
                    appendBubble("user", txt ? txt + "\n\n(" + attachMsg + ")" : attachMsg);

                    var pdfTextParts = [];
                    var imgFiles = [];

                    for (var i = 0; i < pendingAttachments.length; i++) {
                        var f = pendingAttachments[i];
                        if (f.type === "application/pdf") {
                            var t = await extractPdfTextFile(f);
                            if (t) pdfTextParts.push(t);
                        } else if (f.type.startsWith("image/")) {
                            imgFiles.push(f);
                        }
                    }

                    var visionDesc = "";
                    if (imgFiles.length) {
                        var fd = new FormData();
                        for (var j = 0; j < imgFiles.length; j++) fd.append("files", imgFiles[j], imgFiles[j].name);
                        try {
                            var r = await fetch(URLS.UPLOAD, { method: "POST", body: fd });
                            var jj = await r.json();
                            if (r.ok) visionDesc = jj.description || "";
                        } catch (e) { console.error(e); }
                    }

                    contextText = (pdfTextParts.join("\n\n") + "\n" + visionDesc).trim();
                    c.messages.push({ role: "user", content: txt + "\n[System: User attached files. Analysis content: " + contextText.slice(0, 2000) + "]" });
                    pendingAttachments = [];
                    renderAttachments();
                } else {
                    appendBubble("user", txt);
                    c.messages.push({ role: "user", content: txt });
                }

                c.updatedAt = nowISO();
                saveConvos();
                renderSidebar();

                // 3. Normal Chat Flow
                var thinking = showThinking();
                var hist = (c.messages || []).slice(0, -1).slice(-20).map(function (m) { return { role: m.role, content: m.content } });
                var sys = buildSystemMessages(txt, c);

                if (contextText) {
                    sys.push({ role: "system", content: "The user has attached files. Here is the extracted text/visual analysis:\n" + contextText });
                }

                var fullInput = txt;
                if (contextText) {
                    fullInput = txt + "\n[System: User attached files. Analysis content: " + contextText.slice(0, 2000) + "]";
                }

                var payload = {
                    input: fullInput || "Analyze these files",
                    history: [].concat(sys, hist),
                    directives: {
                        policy: { followups: "one_if_needed", max_followups: 1 },
                        weather: { timezone: "America/Chicago", units: "imperial", suppress_celsius: true, day_report_style_1960s: true }
                    },
                    context: { last_city: sessionContext.last_city || null }
                };

                maybeUpdateMemory(c);

                fetch(URLS.CHAT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
                    .then(function (r) { return r.json() })
                    .then(function (j) {
                        var raw = j && j.reply ? j.reply : (j && j.detail ? ("Error: " + j.detail) : "(no reply)");
                        appendAssistant(raw, thinking, c);
                    })
                    .catch(function (e) { thinking.replace("Error: " + (e && e.message ? e.message : e)) });
            }

            function appendAssistant(raw, thinking, c) {
                // Intercept LLM commands
                if (raw.startsWith("/image ")) {
                    var prompt = raw.slice(7).trim();
                    // 'thinking' is the object { replace: fn, container: div }
                    // We need to verify showThinking provides 'container'

                    if (thinking.container) {
                        performImageGeneration(prompt, c, thinking.container);
                    } else {
                        // Fallback in case showThinking isn't updated properly yet
                        thinking.replace("Generating image: " + prompt);
                        var wrap = document.createElement("div");
                        messagesEl.appendChild(wrap);
                        performImageGeneration(prompt, c, wrap);
                    }
                    return;
                }

                thinking.replace(raw);
                c.messages.push({ role: "assistant", content: raw }); c.updatedAt = nowISO(); saveConvos(); renderSidebar();
                updateLastCityIfPresent(raw);
            }

            // ENTER to send (unless Shift+Enter)
            $("input").addEventListener("keydown", function (e) { if (e.isComposing) return; if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() } });
            $("send").addEventListener("click", sendMessage);
            $("newChatMain").addEventListener("click", function () { var c = newConvo("(new conversation)"); convos.unshift(c); activeId = c.id; renderSidebar(); renderChat() });
            $("newChatSide").addEventListener("click", function () { var c = newConvo("(new conversation)"); convos.unshift(c); activeId = c.id; renderSidebar(); renderChat(); if (window.innerWidth <= 768) toggleSidebar(); }); // Close sidebar on mobile new chat
            $("clearSearch").addEventListener("click", function () { $("search").value = "" });

            /* ---------- Initial greeting ---------- */
            function initialGreeting(c) {
                if (!c || c.greeted) return;
                c.greeted = true; saveConvos();
                var thinking = showThinking();
                var sys = buildSystemMessages("Greeting", c);
                fetch(URLS.CHAT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: "[system_greet]", history: sys }) })
                    .then(function (r) { return r.json() })
                    .then(function (j) { var raw = j && j.reply ? j.reply : "Hello! How can I help today?"; appendAssistant(raw, thinking, c) })
                    .catch(function () { thinking.replace("Hello! How can I help today?") });
            }

            /* ---------- Docs & image analysis ---------- */
            var filesEl = $("files"), thumbsEl = $("thumbs"), currentDocText = "", currentImgDesc = "";
            $("clearUpload").addEventListener("click", function () { filesEl.value = ""; thumbsEl.innerHTML = ""; $("extracted").value = ""; $("answer").value = ""; $("question").value = ""; $("anStatus").textContent = ""; $("qStatus").textContent = ""; currentDocText = ""; currentImgDesc = ""; autoResize($("extracted")); autoResize($("answer")) });
            filesEl.addEventListener("change", function () { thumbsEl.innerHTML = ""; var files = filesEl.files || []; for (var i = 0; i < files.length; i++) { var f = files[i]; if (f.type.startsWith("image/")) { var img = document.createElement("img"); img.className = "thumb"; img.src = URL.createObjectURL(f); thumbsEl.appendChild(img) } else if (f.type === "application/pdf" && window.pdfjsLib) { var ccv = document.createElement("canvas"); ccv.className = "thumb pdf"; thumbsEl.appendChild(ccv); (function (c, f) { f.arrayBuffer().then(function (b) { return pdfjsLib.getDocument({ data: b }).promise }).then(function (doc) { return doc.getPage(1) }).then(function (p) { var vp = p.getViewport({ scale: .22 }); c.width = vp.width; c.height = vp.height; return p.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise }).catch(function () { c.textContent = "PDF" }) })(ccv, f) } else { var d = document.createElement("div"); d.className = "thumb pdf"; d.textContent = f.name; thumbsEl.appendChild(d) } } });
            function extractPdfTextFile(file) { return new Promise(function (resolve) { file.arrayBuffer().then(function (buffer) { return pdfjsLib.getDocument({ data: buffer }).promise }).then(async function (doc) { let all = ""; for (let p = 1; p <= doc.numPages; p++) { const page = await doc.getPage(p); const content = await page.getTextContent(); const s = (content.items || []).map(function (it) { return it.str || "" }).join(" "); all += s + "\n" } resolve(all.trim()) }).catch(function () { resolve("") }) }) }
            $("btnAnalyze").addEventListener("click", async function () { var files = filesEl.files || []; if (!files.length) { $("anStatus").textContent = "Choose files first."; return } $("btnAnalyze").disabled = true; $("anStatus").textContent = "Analyzing…"; var pdfTextParts = []; var imgFiles = []; for (var i = 0; i < files.length; i++) { var f = files[i]; if (f.type === "application/pdf") { var t = await extractPdfTextFile(f); if (t) pdfTextParts.push(t) } else if (f.type.startsWith("image/")) { imgFiles.push(f) } } var upText = "", upDesc = ""; if (imgFiles.length) { var fd = new FormData(); for (var j = 0; j < imgFiles.length; j++)fd.append("files", imgFiles[j], imgFiles[j].name); try { var r = await fetch(URLS.UPLOAD, { method: "POST", body: fd }); var jj = await r.json(); if (r.ok) { upText = jj.text || ""; upDesc = jj.description || "" } else { $("anStatus").textContent = jj.detail || "Upload failed"; $("btnAnalyze").disabled = false; return } } catch (e) { $("anStatus").textContent = "Error: " + (e && e.message ? e.message : e); $("btnAnalyze").disabled = false; return } } var combined = (pdfTextParts.join("\n\n") + "\n" + upText).trim(); currentDocText = combined; currentImgDesc = upDesc; var summary = ""; try { var rs = await fetch(URLS.SUM, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: combined, description: upDesc }) }); var js = await rs.json(); summary = js.summary || "" } catch (e) { summary = "" } $("extracted").value = (summary ? summary + "\n\n" : "") + (combined || "") + (upDesc ? ("\n\nVisual notes:\n" + upDesc) : ""); autoResize($("extracted")); $("anStatus").textContent = (combined || upDesc) ? "Done" : "No text found; included visual description."; $("btnAnalyze").disabled = false });
            $("btnClearSummary").addEventListener("click", function () { $("extracted").value = ""; autoResize($("extracted")) });
            $("btnAsk").addEventListener("click", function () { var q = $("question").value.trim(); if (!q) { $("qStatus").textContent = "Type a question"; return } $("btnAsk").disabled = true; $("qStatus").textContent = "Thinking…"; fetch(URLS.QUERY, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q, text: currentDocText, description: currentImgDesc }) }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, json: j } }) }).then(function (pair) { var j = pair.json; if (!pair.ok) throw new Error(j.detail || j.error || "Query failed"); $("answer").value = j.answer || "(no answer)"; autoResize($("answer")); $("qStatus").textContent = "Done" }).catch(function (e) { $("qStatus").textContent = "Error: " + (e && e.message ? e.message : e) }).finally(function () { $("btnAsk").disabled = false }) });

            /* ---------- Images ---------- */
            var genImg = $("genImg"), imgStatus = $("imgStatus");
            function showGen() { document.dispatchEvent(new CustomEvent("ai:image:started", { detail: { panel: document.querySelector(".docs-panel") } })) }
            function hideGen() { document.dispatchEvent(new CustomEvent("ai:image:done", { detail: { panel: document.querySelector(".docs-panel") } })) }
            function openFullscreen(url) { $("fsImg").src = url; $("fs").classList.add("show"); $("fs").setAttribute("aria-hidden", "false") }
            $("fsClose").addEventListener("click", function () { $("fs").classList.remove("show"); $("fs").setAttribute("aria-hidden", "true") });

            function generateNow() {
                if (!quotaCanGenerate()) { hideGen(); showQuota(); return }
                var base = $("imgPrompt").value.trim(); if (!base) { imgStatus.textContent = "Describe an image."; setTimeout(function () { imgStatus.textContent = "" }, 1400); return }
                var size = $("imgSize").value; showGen(); genImg.removeAttribute("src"); $("btnCopy").disabled = true; $("btnDownload").style.pointerEvents = "none"; $("btnDownload").style.opacity = "0.6";
                var refs = $("refFiles").files;
                if (refs && refs.length) {
                    var fd = new FormData(); fd.append("prompt", base); fd.append("size", size); var n = Math.min(refs.length, 5); for (var i = 0; i < n; i++) { fd.append("refs", refs[i], refs[i].name) }
                    fetch(URLS.GEN_EDIT, { method: "POST", body: fd }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, json: j } }) }).then(function (pair) { var j = pair.json; if (!pair.ok) throw new Error(j.detail || j.error || "Edit failed"); var url = "data:image/png;base64," + j.image_b64; genImg.src = url; $("btnCopy").disabled = false; $("btnDownload").href = url; $("btnDownload").style.pointerEvents = "auto"; $("btnDownload").style.opacity = "1"; addImage(url); quotaInc() }).catch(function (e) { imgStatus.textContent = "Error: " + (e && e.message ? e.message : e) }).finally(function () { hideGen() });
                } else {
                    fetch(URLS.GEN, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: base, size }) }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, json: j } }) }).then(function (pair) { var j = pair.json; if (!pair.ok) throw new Error(j.detail || j.error || "Generation failed"); var url = "data:image/png;base64," + j.image_b64; genImg.src = url; $("btnCopy").disabled = false; $("btnDownload").href = url; $("btnDownload").style.pointerEvents = "auto"; $("btnDownload").style.opacity = "1"; addImage(url); quotaInc() }).catch(function (e) { imgStatus.textContent = "Error: " + (e && e.message ? e.message : e) }).finally(function () { hideGen() });
                }
            }
            $("btnGen").addEventListener("click", function () { if (!quotaCanGenerate()) { showQuota(); return } $("builder").classList.add("show"); $("builder").setAttribute("aria-hidden", "false") });
            $("btnCopy").addEventListener("click", function () { if (!genImg.src) return; navigator.clipboard.writeText(genImg.src).then(function () { imgStatus.textContent = "Copied URL ✓"; setTimeout(function () { imgStatus.textContent = "" }, 1200) }) });
            $("btnFull").addEventListener("click", function () { if (!genImg.src) { imgStatus.textContent = "Generate an image first."; setTimeout(function () { imgStatus.textContent = "" }, 1200); return } openFullscreen(genImg.src) });

            /* ---------- Builder chips ---------- */
            var GROUPS = { Style: ["photorealistic", "cinematic", "studio portrait", "street", "documentary", "concept art", "anime", "isometric", "cubism", "surrealism", "minimalist", "baroque", "painterly", "noir", "retro futurism", "epic"], Medium: ["photo", "oil painting", "watercolor", "charcoal sketch", "3D render", "vector illustration", "ink drawing", "pastel", "mixed media", "collage"], Mood: ["serene", "dramatic", "whimsical", "epic", "cozy", "mysterious", "futuristic", "playful", "somber", "romantic", "bright and clean"], Lighting: ["golden hour", "soft light", "hard rim light", "volumetric light", "neon glow", "backlit", "spotlight", "overcast", "moody shadows", "studio softbox", "high key lighting"], Composition: ["rule of thirds", "close-up", "medium shot", "wide angle", "top-down", "symmetry", "minimal framing", "negative space", "leading lines", "centered subject"], Effects: ["bokeh", "motion blur", "depth of field", "HDR", "long exposure", "film grain", "vignette", "anamorphic flare", "tilt-shift", "particles", "lens flare", "light leaks", "glow"], Color: ["vibrant colors", "muted tones", "pastel palette", "high contrast", "black and white", "duotone", "monochrome", "neon palette", "earth tones", "bright whites"], Output: ["4K detail", "ultra-detailed", "high dynamic range", "sharp focus", "studio quality"] };
            var selected = { Style: new Set(), Medium: new Set(), Mood: new Set(), Lighting: new Set(), Composition: new Set(), Effects: new Set(), Color: new Set(), Output: new Set() };
            function renderGroup(id, key) { var host = $(id); host.innerHTML = ""; GROUPS[key].forEach(function (v) { var pill = document.createElement("button"); pill.className = "pill"; pill.textContent = v; pill.addEventListener("click", function () { if (selected[key].has(v)) { selected[key].delete(v); pill.classList.remove("active") } else { selected[key].add(v); pill.classList.add("active") } }); host.appendChild(pill) }) }
            function initBuilder() { renderGroup("gStyle", "Style"); renderGroup("gMedium", "Medium"); renderGroup("gMood", "Mood"); renderGroup("gLighting", "Lighting"); renderGroup("gComposition", "Composition"); renderGroup("gEffects", "Effects"); renderGroup("gColor", "Color"); renderGroup("gOutput", "Output") }
            $("builderClose").addEventListener("click", function () { $("builder").classList.remove("show"); $("builder").setAttribute("aria-hidden", "true") });
            $("builderReset").addEventListener("click", function () { Object.keys(selected).forEach(function (k) { selected[k].clear() });["gStyle", "gMedium", "gMood", "gLighting", "gComposition", "gEffects", "gColor", "gOutput"].forEach(function (id) { var host = $(id);[].slice.call(host.children).forEach(function (p) { p.classList.remove("active") }) }); $("builderNotes").value = "" });
            $("applyAndGenerate").addEventListener("click", function () { if (!quotaCanGenerate()) { $("builder").classList.remove("show"); $("builder").setAttribute("aria-hidden", "true"); showQuota(); return; } var bits = []; Object.keys(selected).forEach(function (k) { if (selected[k].size) bits.push([...selected[k]].join(", ")) }); var base = $("imgPrompt").value.trim(); var notes = $("builderNotes").value.trim(); var extra = bits.length ? (" in the style of " + bits.join("; ")) : ""; var finalPrompt = [base + extra, notes].filter(Boolean).join("; "); $("imgPrompt").value = finalPrompt; $("builder").classList.remove("show"); $("builder").setAttribute("aria-hidden", "true"); generateNow() });

            /* ---------- Init ---------- */
            ensureActive(); renderSidebar(); loadImages(); initBuilder(); renderChat();
        })();
