/**
 * VOICE WIDGET LOGIC (OpenAI Realtime WebRTC)
 */

function normalizeJohnnyWidgetProfile(value) {
    const profile = String(value || "").toLowerCase().trim();
    if (profile === "mowing" || profile === "ai" || profile === "nova" || profile === "home") return profile;
    return "";
}

function detectJohnnyWidgetProfile() {
    const globalProfile = normalizeJohnnyWidgetProfile(window.JOHNNY_WIDGET_PROFILE || window.johnnyWidgetProfile || document.documentElement?.dataset?.johnnyWidgetProfile);
    if (globalProfile) return globalProfile;

    const searchProfile = normalizeJohnnyWidgetProfile(new URL(window.location.href).searchParams.get("profile"));
    if (searchProfile) return searchProfile;

    const scriptTag = document.querySelector('script[src*="voice-widget.js"]');
    if (scriptTag) {
        try {
            const scriptUrl = new URL(scriptTag.src, window.location.href);
            const scriptProfile = normalizeJohnnyWidgetProfile(scriptTag.dataset?.profile || scriptUrl.searchParams.get("profile"));
            if (scriptProfile) return scriptProfile;
        } catch (err) {
            console.warn("Could not parse Johnny widget profile from script tag", err);
        }
    }

    const host = String(window.location.hostname || "").toLowerCase();
    const path = String(window.location.pathname || "").toLowerCase();
    if (path.includes("/nova-chat")) return "nova";
    if (host.includes("618help.com")) return "mowing";
    return "ai";
}

class VoiceWidget {
    constructor() {
        this.pc = null;
        this.dc = null;
        this.stream = null;
        this.state = 'idle'; // idle, connecting, listening, speaking
        this.transcriptBuffer = "";
        this.activeAssistantBubble = null;
        this.activeUserBubble = null;
        this.itemBubbles = new Map(); // Link item IDs to message bubbles
        this.handledFunctionCalls = new Set();
        this.messages = [];
        this.isMuted = false;
        this.pendingUpload = null;
        this.isTextInitiated = false;
        this.pendingHangup = false;
        this.homeTurnCount = 0;
        this.homeTurnLimit = 16;
        this.remoteAudioEl = null;
        this.realtimeModel = "";
        this.profile = detectJohnnyWidgetProfile();
        this.allowUploads = this.profile === "ai" || this.profile === "nova";
        this.widgetTitleText = this.profile === "nova"
            ? "Nova Chat"
            : this.profile === "mowing"
                ? "Johnny - Mowing Assistant"
                : this.profile === "home"
                    ? "Ask the Workbench"
                    : "Johnny's AI Assistant";
        window.johnnyWidgetProfile = this.profile;

        if (this.isEditor()) {
            console.log("🛠️ Johnny: Editor mode detected. Disabling widget to avoid blocking tools.");
            return;
        }

        this.init();
    }

    getAuthHeaders(base = {}) {
        const token = String(
            window.JOHNNY_CHAT_SESSION_TOKEN ||
            window.johnnyChatSessionToken ||
            sessionStorage.getItem('johnny_nova_chat_token') ||
            ''
        ).trim();
        return token ? { ...base, Authorization: `Bearer ${token}` } : base;
    }

    isEditor() {
        const url = window.location.href;
        return url.includes('/config') || url.includes('squarespace.com/config') || url.includes('sqsp.net');
    }

    init() {
        console.log("🚀 Johnny Widget: Overlord Initializing...");
        this.createUI();
        this.attachEvents();
    }

    createUI() {
        if (document.getElementById('voice-widget-container')) return;

        const container = document.createElement('div');
        container.id = 'voice-widget-container';
        container.dataset.profile = this.profile;
        document.body.insertAdjacentElement('afterbegin', container);

        container.innerHTML = `
            <div class="widget-header" id="widget-header">
                <button class="widget-title-button" id="widget-title-button" type="button" aria-label="${this.profile === 'nova' ? 'Open Nova Chat' : this.profile === 'mowing' ? 'Open mowing chat' : this.profile === 'home' ? 'Open site guide' : 'Open AI chat'}">
                    <span class="status-dot"></span>
                    <span class="widget-title-text">${this.widgetTitleText}</span>
                    <span class="widget-title-icon" aria-hidden="true">💬</span>
                </button>
                <div class="widget-actions">
                    <button id="minimize-btn" title="Minimize/Maximize">_</button>
                </div>
            </div>
            <div class="voice-widget-card" id="voice-card" data-state="idle">
                <div class="glow-field"></div>
                <div class="face-layer">
                    <div class="eye left"></div>
                    <div class="eye right"></div>
                    <div class="mouth"></div>
                </div>
                
                <div class="status-indicator">
                    <span class="status-label" id="status-label">PRESS TO CHAT</span>
                    <div class="audio-visualizer" id="visualizer">
                        <div class="v-bar"></div><div class="v-bar"></div><div class="v-bar"></div>
                        <div class="v-bar"></div><div class="v-bar"></div><div class="v-bar"></div>
                    </div>
                </div>

                <button class="mic-button" id="start-btn"></button>
            </div>

            <div class="top-controls">
                <button class="top-control bottom-left" id="mute-btn" title="Mute/Unmute">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                    </svg>
                    <div class="mute-label">MUTED</div>
                </button>
                <button class="top-control bottom-right" id="new-btn">NEW</button>
            </div>
            
            <div class="bottom-area">
                <div class="chat-viewport" id="chat-viewport">
                    <div class="chat-history" id="chat-history"></div>
                </div>
                <div class="input-area">
                <div class="input-wrapper">
                        <label for="file-input" class="upload-btn" id="upload-label">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"></path>
                            </svg>
                        </label>
                        <input type="file" id="file-input" accept="image/*,application/pdf" hidden multiple>
                        <input type="text" id="voice-text-input" placeholder="Type a message..." autocomplete="off">
                    </div>
                </div>
            </div>
        `;

        this.card = document.getElementById('voice-card');
        this.btn = document.getElementById('start-btn');
        this.titleBtn = document.getElementById('widget-title-button');
        this.history = document.getElementById('chat-history');
        this.historyViewport = document.getElementById('chat-viewport');
        this.statusLabel = document.getElementById('status-label');
        this.visualizer = document.getElementById('visualizer');
        this.newBtn = document.getElementById('new-btn');
        this.muteBtn = document.getElementById('mute-btn');
        this.textInput = document.getElementById('voice-text-input');
        this.fileInput = document.getElementById('file-input');
        this.uploadLabel = document.getElementById('upload-label');

        if (this.fileInput && !this.allowUploads) {
            this.fileInput.disabled = true;
        }

        const configuredStartMinimized =
            window.JOHNNY_WIDGET_START_MINIMIZED ??
            window.johnnyWidgetStartMinimized ??
            document.documentElement?.dataset?.johnnyWidgetStartMinimized;
        const startMinimized = configuredStartMinimized === undefined
            ? true
            : configuredStartMinimized === true || String(configuredStartMinimized).toLowerCase() === "true";

        if (container && (startMinimized || window.matchMedia('(max-width: 600px)').matches)) {
            container.classList.add('minimized');
        }
    }

    attachEvents() {
        if (!this.btn) return;
        this.btn.onclick = () => {
            if (this.state === 'idle') this.startSession();
            else this.stopSession();
        };

        if (this.newBtn) {
            this.newBtn.onclick = (e) => {
                e.stopPropagation();
                this.resetChat();
            };
        }

        if (this.muteBtn) {
            this.muteBtn.onclick = (e) => {
                e.stopPropagation();
                this.toggleMute();
            };
        }

        if (this.textInput) {
            this.textInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const text = this.textInput.value.trim();
                    if (text) {
                        this.sendTextMessage(text);
                        this.textInput.value = "";
                    }
                }
            });
        }

        if (this.fileInput) {
            this.fileInput.onchange = this.allowUploads ? (e) => this.handleFileUpload(e) : null;
        }

        const minBtn = document.getElementById('minimize-btn');
        const titleBtn = document.getElementById('widget-title-button');
        const container = document.getElementById('voice-widget-container');
        const fitWidgetInViewport = () => {
            if (!container) return;
            if (container.classList.contains('minimized')) {
                this.restoreWidgetDock();
                return;
            }

            const margin = 12;
            const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
            const rect = container.getBoundingClientRect();

            if (!container.style.left && !container.style.top) return;

            const nextLeft = Math.min(Math.max(rect.left, margin), Math.max(margin, viewportWidth - rect.width - margin));
            const nextTop = Math.min(Math.max(rect.top, margin), Math.max(margin, viewportHeight - rect.height - margin));

            container.style.left = `${nextLeft}px`;
            container.style.top = `${nextTop}px`;
            container.style.right = 'auto';
            container.style.bottom = 'auto';
        };
        const openWidget = () => {
            if (!container) return;

            container.classList.remove('minimized');
            window.requestAnimationFrame(() => {
                fitWidgetInViewport();
                const focusTarget = this.textInput || this.btn;
                if (focusTarget && typeof focusTarget.focus === 'function') {
                    focusTarget.focus({ preventScroll: true });
                }
            });
        };
        const syncChrome = () => {
            if (!container || !minBtn) return;
            const minimized = container.classList.contains('minimized');
            minBtn.innerText = minimized ? '💬' : '_';
            minBtn.title = minimized ? 'Open chat' : 'Minimize';
            if (titleBtn) {
                titleBtn.setAttribute('aria-label', minimized ? (this.profile === 'mowing' ? 'Open mowing chat' : this.profile === 'home' ? 'Open site guide' : 'Open AI chat') : (this.profile === 'mowing' ? 'Mowing chat widget header' : this.profile === 'home' ? 'Site guide widget header' : 'AI chat widget header'));
            }
        };

        if (minBtn) {
            minBtn.onclick = (e) => {
                e.stopPropagation();
                if (container.classList.contains('minimized')) openWidget();
                else this.minimizeWidget();
                syncChrome();
            };
        }

        if (titleBtn) {
            titleBtn.onclick = (e) => {
                e.stopPropagation();
                if (!container.classList.contains('minimized')) return;
                openWidget();
                syncChrome();
            };
        }

        if (container) {
            container.addEventListener('click', (e) => {
                if (!container.classList.contains('minimized')) return;
                e.preventDefault();
                openWidget();
                syncChrome();
            });

            window.addEventListener('resize', fitWidgetInViewport);
            window.addEventListener('orientationchange', () => window.setTimeout(fitWidgetInViewport, 150));
        }

        syncChrome();

        const header = document.getElementById('widget-header');
        if (header) {
            let isDragging = false;
            let startX, startY, initialX, initialY;

            header.onmousedown = (e) => {
                if (container.classList.contains('minimized') || e.target.closest('button')) return;
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                const rect = container.getBoundingClientRect();
                initialX = rect.left;
                initialY = rect.top;
                
                container.style.right = 'auto';
                container.style.bottom = 'auto';
                container.style.left = initialX + 'px';
                container.style.top = initialY + 'px';
                container.style.transition = 'none';
            };

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                container.style.left = (initialX + dx) + 'px';
                container.style.top = (initialY + dy) + 'px';
            });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    container.style.transition = 'width 0.3s ease, height 0.3s ease, border-radius 0.3s ease, top 0.3s ease, left 0.3s ease, right 0.3s ease, bottom 0.3s ease';
                    fitWidgetInViewport();
                }
            });
        }
    }

    restoreWidgetDock() {
        const container = document.getElementById('voice-widget-container');
        if (!container) return;
        // Release drag coordinates so the responsive CSS corner and safe-area
        // spacing apply again, including after viewport or orientation changes.
        for (const property of ['left', 'top', 'right', 'bottom', 'transition']) {
            container.style.removeProperty(property);
        }
    }

    minimizeWidget() {
        const container = document.getElementById('voice-widget-container');
        if (!container) return;
        container.classList.add('minimized');
        this.restoreWidgetDock();
    }

    getBackendUrl() {
        const configuredUrl = String(window.JOHNNY_CHAT_API_BASE_URL || window.johnnyChatApiBaseUrl || "").trim();
        if (configuredUrl) return configuredUrl.replace(/\/+$/, "");
        const scriptTag = document.querySelector('script[src*="voice-widget.js"]');
        return scriptTag ? new URL(scriptTag.src).origin : window.location.origin;
    }

    escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => reject(reader.error || new Error("Could not read image"));
            reader.readAsDataURL(file);
        });
    }

    async buildRealtimeImageInputs(files) {
        const imageFiles = Array.from(files || [])
            .filter(file => file.type.startsWith("image/") && file.size <= 8 * 1024 * 1024)
            .slice(0, 2);

        const inputs = [];
        for (const file of imageFiles) {
            try {
                const imageUrl = await this.readFileAsDataUrl(file);
                if (imageUrl) inputs.push({ type: "input_image", image_url: imageUrl });
            } catch (err) {
                console.warn("Could not prepare direct Realtime image input", err);
            }
        }
        return inputs;
    }

    parseFunctionArguments(raw) {
        if (!raw) return {};
        if (typeof raw === "object") return raw;
        try {
            return JSON.parse(String(raw));
        } catch {
            return {};
        }
    }

    async handleFileUpload(e) {
        if (!this.allowUploads) {
            const noteBubble = this.createMessageBubble('assistant');
            noteBubble.innerHTML = `<i>For mowing photos, please use the contact form instead.</i>`;
            this.scrollToBottom();
            setTimeout(() => {
                const wrapper = noteBubble.parentElement;
                if (wrapper && wrapper.parentElement) {
                    wrapper.remove();
                }
            }, 3500);
            e.target.value = "";
            return;
        }

        const files = e.target.files;
        if (!files || files.length === 0) return;
        const fileList = Array.from(files);
        const hasImage = fileList.some(file => file.type.startsWith("image/"));
        const hasPdf = fileList.some(file => file.type === "application/pdf");

        const formData = new FormData();
        formData.append('profile', this.profile);
        for (const file of files) {
            formData.append('files', file);
        }

        const uploadBubble = this.createMessageBubble('assistant');
        uploadBubble.innerHTML = hasImage
            ? `<i>Checking your image...</i>`
            : hasPdf
                ? `<i>Processing document...</i>`
                : `<i>Processing upload...</i>`;
        this.scrollToBottom();

        try {
            const backendUrl = this.getBackendUrl();
            const imageInputs = hasImage ? await this.buildRealtimeImageInputs(fileList) : [];
            const res = await fetch(`${backendUrl}/upload`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || data.error || "Upload failed");

            const contentObj = {
                text: data.text || "None",
                description: data.description || "None",
                summary: data.summary || null,
                isPdf: (data.description || "").includes("PDF"),
                imageAnalysis: Array.isArray(data.imageAnalysis) ? data.imageAnalysis : [],
                imageInputs
            };
            this.pendingUpload = contentObj;

            if (this.state === 'idle') {
                await this.startSession();
            } else if (this.dc && this.dc.readyState === 'open') {
                this.processUploadResponse(contentObj);
                this.pendingUpload = null;
            }
        } catch (err) {
            console.error("Upload failed", err);
            uploadBubble.innerHTML = `<span style="color: #f87171;">Upload failed: ${err.message}</span>`;
        } finally {
            uploadBubble.remove();
            e.target.value = "";
        }
    }

    processUploadResponse(content) {
        let userMsg = "";

        let prompt = "Acknowledge the material.";
        if (content.isPdf && content.summary) {
            userMsg = `I've uploaded a document. Here is the context:\n[RAW DATA]: ${content.text}\n[VISUALS]: ${content.description}\n[SUMMARY]: ${content.summary}`;
            prompt = `Present the following detailed summary of the PDF with authority: ${content.summary}. Then ask 'What would you like me to do with this material?'. IMPORTANT: If the user asks you to read the PDF 'word for word', you MUST reply: 'I am unable to do word for word PDF, only summarize' (and spell 'summarize' exactly like that). Otherwise, answer questions using the provided context.`;
        } else {
            const analyses = Array.isArray(content.imageAnalysis) ? content.imageAnalysis : [];
            const bestAnalysis = analyses[0] || {};
            const isRelevantImage = Boolean(bestAnalysis.is_relevant_image);
            const imageType = bestAnalysis.image_type || "unknown";
            const keyObjects = Array.isArray(bestAnalysis.key_objects) ? bestAnalysis.key_objects.join(", ") : "";
            const sceneSummary = bestAnalysis.scene_summary || content.description || "No image summary available.";
            const shortReply = bestAnalysis.short_reply || "";
            const likelyNeed = bestAnalysis.likely_user_need || "";
            const confidence = bestAnalysis.confidence || "unknown";
            const followUp = bestAnalysis.follow_up || "";

            userMsg = `I've uploaded an image for a business demo. Please use it to help the customer understand what it appears to show and what they likely want next.\n[IS_RELEVANT_IMAGE]: ${isRelevantImage ? "yes" : "no"}\n[IMAGE_TYPE]: ${imageType}\n[KEY_OBJECTS]: ${keyObjects || "None noted"}\n[SCENE_SUMMARY]: ${sceneSummary}\n[LIKELY_USER_NEED]: ${likelyNeed || "Unknown"}\n[CONFIDENCE]: ${confidence}\n[SHORT_REPLY]: ${shortReply}\n[FOLLOW_UP]: ${followUp}`;

            if (isRelevantImage) {
                prompt = `You are Johnny's AI assistant in a business-demo role-play. Look at the image and respond like a smart assistant for the most likely business context. Describe what you can see, infer what the user likely wants, and make the response sound sharp, useful, and impressive. If the image seems like a furniture piece, product, room, storefront, menu item, or other business reference, speak naturally in that role without pretending to know exact facts. Keep it concise, confident, and sales-minded. End by asking what they want the assistant to do next.`;
            } else {
                prompt = `Reply with a clever but polite line telling the customer that the image does not give enough business context yet. Ask them to upload a clearer product, workspace, storefront, or reference image so you can show off the demo properly. Keep it short, friendly, and sales-minded.`;
            }
        }

        const supportsDirectImages = /^gpt-realtime(?:-2(?:\.\d+)?)?(?:-\d{4}-\d{2}-\d{2})?$/.test(this.realtimeModel);
        const directImageInputs = supportsDirectImages && Array.isArray(content.imageInputs) ? content.imageInputs : [];
        const contentParts = [
            { type: "input_text", text: userMsg },
            ...directImageInputs
        ];

        this.dc.send(JSON.stringify({
            type: "conversation.item.create",
            item: {
                type: "message",
                role: "user",
                content: contentParts
            }
        }));

        this.dc.send(JSON.stringify({
            type: "response.create",
            response: {
                instructions: prompt + " Stay in character as Johnny."
            }
        }));
    }

    getGreetingPrompt() {
        if (this.profile === "nova") {
            return "Say exactly: 'Hey Johnny. I am here, sharp, and ready. What are we figuring out first?' Do not add any other greeting text.";
        }

        if (this.profile === "mowing") {
            return "Say exactly: 'Hi, I'm Johnny's mowing assistant and am here to help. Now please press the red button above so we can talk. It starts off muted so you don't accidentally cut me off, and you can mute it at any time.' Do not add any other greeting text.";
        }

        if (this.profile === "home") {
            return "Say exactly: 'Hey, I can help you find your way around Johnny's site. Ask me what any app does, and I will try not to act too proud of the navigation bar.' Do not add any other greeting text.";
        }

        return "Say exactly: 'Hi, I'm Johnny's AI assistant and am here to help. Now please press the red button above so we can talk. It starts off muted so you don't accidentally cut me off, and you can mute it at any time.' Do not add any other greeting text.";
    }

    async sendTextMessage(text) {
        console.log("📤 Sending Text Message:", text);

        if (!this.allowHomeTurn()) return;

        // 1. Ensure session is active
        if (this.state === 'idle') {
            this.isTextInitiated = true;
            await this.startSession();
            // Wait for data channel
            const checkDC = setInterval(() => {
                if (this.dc && this.dc.readyState === 'open') {
                    clearInterval(checkDC);
                    this.dispatchText(text);
                }
            }, 100);
            return;
        }

        if (this.dc && this.dc.readyState === 'open') {
            this.dispatchText(text);
        }
    }

    dispatchText(text) {
        this.messages.push({ role: 'user', text: text });
        // Create the user message item
        this.dc.send(JSON.stringify({
            type: "conversation.item.create",
            item: {
                type: "message",
                role: "user",
                content: [{ type: "input_text", text: text }]
            }
        }));

        // Request a response
        this.dc.send(JSON.stringify({ type: "response.create" }));
    }

    allowHomeTurn() {
        if (this.profile !== "home") return true;
        if (this.homeTurnCount >= this.homeTurnLimit) {
            const bubble = this.createMessageBubble('assistant');
            bubble.textContent = "That is the Workbench limit for this visit. You can still explore the site, or use Contact if you need Johnny directly.";
            this.scrollToBottom();
            if (this.statusLabel) this.statusLabel.innerText = "VISIT LIMIT REACHED";
            return false;
        }
        this.homeTurnCount += 1;
        return true;
    }

    resetChat() {
        this.stopPlayback();
        if (this.history) this.history.innerHTML = "";
        this.messages = [];
        this.itemBubbles.clear();
        this.handledFunctionCalls.clear();
    }

    stopPlayback() {
        if (this.remoteAudioEl) {
            try {
                this.remoteAudioEl.pause();
                this.remoteAudioEl.srcObject = null;
                this.remoteAudioEl.removeAttribute('src');
                this.remoteAudioEl.load();
            } catch (err) {
                console.warn("Could not fully stop remote audio", err);
            }
            this.remoteAudioEl.remove();
            this.remoteAudioEl = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.dc) {
            try {
                if (this.dc.readyState === 'open') this.dc.close();
            } catch (err) {
                console.warn("Could not close Johnny data channel", err);
            }
            this.dc = null;
        }

        if (this.pc) {
            try {
                this.pc.getSenders().forEach(sender => sender.track?.stop());
                this.pc.close();
            } catch (err) {
                console.warn("Could not close Johnny peer connection", err);
            }
            this.pc = null;
        }

        this.activeAssistantBubble = null;
        this.activeUserBubble = null;
        this.updateState('idle');
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.stream) {
            this.stream.getAudioTracks().forEach(track => track.enabled = !this.isMuted);
        }
        if (this.muteBtn) this.muteBtn.dataset.muted = this.isMuted;
    }

    async startSession() {
        try {
            this.pendingHangup = false;
            this.updateState('connecting');
            const backendUrl = this.getBackendUrl();
            const tokenUrl = new URL(`${backendUrl}/api/realtime-token`);
            tokenUrl.searchParams.set("t", Date.now().toString());
            tokenUrl.searchParams.set("profile", this.profile);

            const tokenRes = await fetch(tokenUrl.toString(), {
                method: 'POST',
                headers: this.getAuthHeaders()
            });
            if (!tokenRes.ok) {
                const detail = await tokenRes.text().catch(() => "");
                if (tokenRes.status === 429 && this.statusLabel) {
                    this.statusLabel.innerText = "DAILY LIMIT REACHED";
                }
                throw new Error(`Token fetch failed${detail ? `: ${detail.slice(0, 240)}` : ""}`);
            }

            const data = await tokenRes.json();
            const EPHEMERAL_KEY = data.client_secret?.value || data.value;
            if (!EPHEMERAL_KEY) throw new Error("Token fetch failed: no ephemeral key returned");
            this.realtimeModel = String(data.model || data.session?.model || "");

            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    // Chrome/Android specific constraints for better AEC
                    googEchoCancellation: true,
                    googNoiseSuppression: true,
                    googAutoGainControl: true
                }
            });

            // START MUTED by default to prevent self-hearing during intro
            this.isMuted = true;
            this.stream.getAudioTracks().forEach(track => track.enabled = false);
            if (this.muteBtn) this.muteBtn.dataset.muted = "true";

            this.pc = new RTCPeerConnection();
            const audioEl = document.createElement('audio');
            audioEl.autoplay = true;
            audioEl.playsInline = true;
            audioEl.preload = 'auto';
            audioEl.muted = false;
            audioEl.setAttribute('aria-hidden', 'true');
            audioEl.style.display = 'none';
            document.body.appendChild(audioEl);
            this.remoteAudioEl = audioEl;

            this.pc.ontrack = async (e) => {
                audioEl.srcObject = e.streams[0];
                try {
                    await audioEl.play();
                } catch (playErr) {
                    console.warn("⚠️ Johnny audio playback retry needed:", playErr);
                }
            };
            this.pc.addTrack(this.stream.getAudioTracks()[0], this.stream);

            this.pc.onconnectionstatechange = () => {
                console.log("🔌 Johnny PeerConnection:", this.pc.connectionState);
                if (["failed", "disconnected", "closed"].includes(this.pc.connectionState)) {
                    this.updateState(this.pc.connectionState === "closed" ? "idle" : "error");
                }
            };
            this.pc.oniceconnectionstatechange = () => {
                console.log("🛰️ Johnny ICE:", this.pc.iceConnectionState);
            };

            this.dc = this.pc.createDataChannel('oai-events');
            this.dc.onopen = () => this.onDataChannelOpen();
            this.dc.onmessage = (e) => this.onDataChannelMessage(JSON.parse(e.data));

            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);

            const realtimeUrl = data.realtime_url || "https://api.openai.com/v1/realtime/calls";
            const realtimeRes = await fetch(realtimeUrl, {
                method: 'POST',
                body: offer.sdp,
                headers: { Authorization: `Bearer ${EPHEMERAL_KEY}`, "Content-Type": "application/sdp" }
            });

            if (!realtimeRes.ok) {
                const detail = await realtimeRes.text().catch(() => "");
                throw new Error(`OpenAI Handshake Error${detail ? `: ${detail.slice(0, 240)}` : ""}`);
            }
            const answerSdp = await realtimeRes.text();
            await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

            this.updateState('listening');
        } catch (err) {
            console.error("🔥 Johnny Error:", err);
            this.updateState('error');
            if (this.statusLabel) {
                this.statusLabel.innerText = String(err?.message || "").includes("visit limit")
                    ? "DAILY LIMIT REACHED"
                    : "CONNECTION ISSUE";
            }
        }
    }

    onDataChannelOpen() {
        console.log('✅ Johnny Live.');

        // 1. Inject History if it exists (for session continuity)
        if (this.messages.length > 0) {
            console.log(`📜 Restoring ${this.messages.length} messages to session.`);
            for (const msg of this.messages) {
                this.dc.send(JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                        type: "message",
                        role: msg.role,
                        content: [{ type: msg.role === "user" ? "input_text" : "text", text: msg.text }]
                    }
                }));
            }
        }

        // 2. Handle Pending Upload OR Automatic Introduction
        if (this.pendingUpload) {
            this.processUploadResponse(this.pendingUpload);
            this.pendingUpload = null;
        } else {
            // Always trigger an initial reaction so the user knows Johnny is connected
            const prompt = (this.messages.length > 0)
                ? "Briefly say 'I'm back' or ask 'Where were we?' to resume the session."
                : this.getGreetingPrompt();

            if (!this.isTextInitiated) {
                // 1s Delay for Mobile AEC Convergence
                setTimeout(() => {
                    this.dc.send(JSON.stringify({
                        type: "response.create",
                        response: { instructions: prompt }
                    }));
                }, 1000);
            }
        }

        this.isTextInitiated = false; // Reset flag
    }

    onDataChannelMessage(msg) {
        switch (msg.type) {
            case 'conversation.item.added':
            case 'conversation.item.created':
            case 'response.output_item.added':
            case 'response.output_item.created': {
                // PRE-CREATE bubbles for every item (User or Assistant)
                const item = msg.item || msg.output_item;
                if (item && !this.itemBubbles.has(item.id)) {
                    const role = item.role === 'user' ? 'user' : 'assistant';
                    // We don't create for 'function_call' items unless we want to log them
                    if (item.type === 'message') {
                        const bubble = this.createMessageBubble(role);
                        this.itemBubbles.set(item.id, bubble);

                        // If it's a text message that already has content (like text input), show it!
                        const textContent = item.content?.find(c => c.type === 'input_text' || c.type === 'text');
                        if (textContent) {
                            bubble.innerText = textContent.text;
                            this.scrollToBottom();
                        }
                    }
                }
                break;
            }
            case 'conversation.item.input_audio_transcription.completed': {
                const bubble = this.itemBubbles.get(msg.item_id);
                if (bubble && msg.transcript) {
                    bubble.innerText = msg.transcript;
                    this.messages.push({ role: 'user', text: msg.transcript });
                    this.scrollToBottom();
                }
                break;
            }
            case 'response.audio_transcript.delta':
            case 'response.output_audio_transcript.delta': {
                this.updateState('speaking');
                const bubble = this.itemBubbles.get(msg.item_id);
                if (bubble && msg.delta) {
                    bubble.innerText += msg.delta;
                    this.scrollToBottom();
                    this.updateSphereScale(bubble.innerText.length);
                }
                break;
            }
            case 'response.done':
                this.updateState('listening');
                // Capture the assistant response into messages
                if (msg.response && msg.response.output) {
                    msg.response.output.forEach(item => {
                        if (item.type === 'function_call') {
                            this.handleFunctionCall(item);
                            return;
                        }
                        if (item.type === 'message' && item.role === 'assistant') {
                            const bubble = this.itemBubbles.get(item.id);
                            if (bubble && bubble.innerText) {
                                this.messages.push({ role: 'assistant', text: bubble.innerText });

                                // PASSWORD LOCKOUT REMOVED
                            }
                        }
                    });
                }

                // Trigger event-based hangup
                if (this.pendingHangup) {
                    console.log("👋 Response done. Hanging up in 500ms...");
                    setTimeout(() => {
                        this.stopSession();
                        this.pendingHangup = false;
                    }, 500);
                }
                break;
            case 'response.function_call_arguments.done':
                this.handleFunctionCall(msg);
                break;
        }
    }

    async handleFunctionCall(msg) {
        const name = msg.name || msg.function?.name || "";
        const callId = msg.call_id || msg.callId || msg.id || "";
        const callKey = callId || `${name}:${msg.arguments || ""}`;
        if (this.handledFunctionCalls.has(callKey)) return;
        this.handledFunctionCalls.add(callKey);

        if (name === 'wait_for_user') {
            if (callId && this.dc?.readyState === 'open') {
                this.dc.send(JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                        type: "function_call_output",
                        call_id: callId,
                        output: JSON.stringify({ ok: true, action: "wait" })
                    }
                }));
            }
            return;
        }

        if (name === 'search_web' || name === 'web_search') {
            const searchBubble = this.createMessageBubble('assistant');
            searchBubble.innerHTML = `<i>Searching live web...</i>`;
            this.scrollToBottom();

            try {
                const args = this.parseFunctionArguments(msg.arguments);
                const query = String(args.query || args.search_query || args.q || "").trim();
                if (!query) throw new Error("Search query was empty");
                if (this.profile !== "ai" && this.profile !== "nova") throw new Error("Live search is not enabled for this widget");

                const recentContext = this.messages
                    .slice(-6)
                    .map(item => `${item.role}: ${item.text}`)
                    .join("\n")
                    .slice(0, 3000);
                const res = await fetch(`${this.getBackendUrl()}/api/realtime-search`, {
                    method: "POST",
                    headers: this.getAuthHeaders({ "Content-Type": "application/json" }),
                    body: JSON.stringify({ query, context: recentContext, profile: this.profile })
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || data.detail || "Search failed");

                const sources = Array.isArray(data.sources) ? data.sources.slice(0, 4) : [];
                const output = {
                    answer: data.result || "I searched, but I could not find a clear answer.",
                    sources
                };

                this.dc.send(JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                        type: "function_call_output",
                        call_id: callId,
                        output: JSON.stringify(output)
                    }
                }));

                if (sources.length) {
                    searchBubble.innerHTML = [
                        `<strong>Live sources</strong>`,
                        ...sources.map(source => `<a href="${this.escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(source.title || source.url)}</a>`)
                    ].join("<br>");
                } else {
                    searchBubble.innerHTML = `<i>Live search complete.</i>`;
                    setTimeout(() => {
                        const wrapper = searchBubble.parentElement;
                        if (wrapper && wrapper.parentElement) wrapper.remove();
                    }, 2500);
                }

                this.dc.send(JSON.stringify({
                    type: "response.create",
                    response: {
                        instructions: "Answer using the search_web result. Keep it concise and natural for voice. Do not read raw URLs aloud. Mention that sources are shown in the chat if sources were returned."
                    }
                }));
            } catch (err) {
                console.error("Live search failed", err);
                this.dc.send(JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                        type: "function_call_output",
                        call_id: callId,
                        output: JSON.stringify({
                            error: "Search failed",
                            message: err.message || "Live search was unavailable."
                        })
                    }
                }));
                searchBubble.innerHTML = `<i>Live search was unavailable.</i>`;
                this.dc.send(JSON.stringify({
                    type: "response.create",
                    response: {
                        instructions: "Briefly explain that live search was unavailable and offer to continue without it or use the contact form for follow-up."
                    }
                }));
            } finally {
                this.scrollToBottom();
            }
        }
    }

    createMessageBubble(role) {
        const wrapper = document.createElement('div');
        wrapper.className = `message-bubble-wrapper ${role}`;
        const label = document.createElement('div');
        label.className = 'message-bubble-label';
        label.innerText = role === 'user' ? 'YOU' : 'JOHNNY';
        const content = document.createElement('div');
        content.className = 'message-content';
        wrapper.appendChild(label);
        wrapper.appendChild(content);
        this.history.appendChild(wrapper);
        return content;
    }

    scrollToBottom() {
        if (this.historyViewport) {
            this.historyViewport.scrollTop = this.historyViewport.scrollHeight;
        }
    }

    updateSphereScale(charCount) {
        const minScale = 0.5;
        const scale = Math.max(minScale, 1 - (charCount / 800) * 0.5);
        if (this.card) this.card.style.setProperty('--sphere-scale', scale);
    }

    updateState(state) {
        this.state = state;
        if (this.card) this.card.dataset.state = state;
        if (this.statusLabel) {
            const labels = { idle: 'READY', connecting: 'BOOTING...', listening: 'REALTIME 2', speaking: 'JOHNNY SPEAKING', error: 'ERROR' };
            this.statusLabel.innerText = labels[state] || state.toUpperCase();
        }
    }

    async stopSession() {
        console.log("⏹️ Stopping Session...");
        // Send summary before stopping if we have messages
        if (this.messages.length > 0) {
            const backendUrl = this.getBackendUrl();

            // Fire and forget summary
            fetch(`${backendUrl}/api/record-call-summary`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript: this.messages })
            }).catch(e => console.error("Summary failed", e));
        }

        this.stopPlayback();
    }
}

/** Galaxy console shared by the homepage and the opt-in business demo. */
class HomeVoiceWidget extends VoiceWidget {
    createUI() {
        super.createUI();
        const container = document.getElementById('voice-widget-container');
        if (!container) return;
        this.homeTextGeneration = 0;
        this.homeTextPending = false;
        this.homeResponseActive = false;
        this.homeQueuedTexts = [];
        this.container = container;
        container.dataset.theme = 'galaxy-console-v1';
        container.setAttribute('role', 'complementary');
        container.setAttribute('aria-label', 'Johnny AI site guide');
        const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 17 10-10M7 7h10v10"/></svg>';
        const mic = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg>';
        container.innerHTML = `
            <div class="widget-header" id="widget-header">
                <button class="widget-title-button" id="widget-title-button" type="button" aria-label="Open Johnny, your AI site guide">
                    <span class="home-widget-avatar" aria-hidden="true"><img src="/home/galaxy.webp" alt="" width="44" height="44"><i></i></span>
                    <span class="home-widget-identity"><span class="widget-title-text">Ask Johnny<span class="home-widget-title-dot">.</span></span><span class="home-widget-subtitle">Your AI site guide</span></span>
                    <span class="home-widget-launch-arrow">${arrow}</span>
                </button>
                <span class="home-widget-drag-handle" aria-hidden="true">⠿</span>
                <div class="widget-actions"><button id="minimize-btn" type="button" aria-label="Minimize Johnny"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button></div>
            </div>
            <div class="voice-widget-card" id="voice-card" data-state="idle">
                <div class="home-widget-orbit" aria-hidden="true"><div class="home-widget-galaxy"><img src="/home/galaxy.webp" alt="" width="150" height="150"></div><span class="home-widget-orbit-dot"></span></div>
                <div class="status-indicator"><span class="status-label" id="status-label" role="status">A little help finding your next thing.</span><div class="audio-visualizer" id="visualizer" aria-hidden="true"><div class="v-bar"></div><div class="v-bar"></div><div class="v-bar"></div><div class="v-bar"></div><div class="v-bar"></div><div class="v-bar"></div></div></div>
                <button class="mic-button" id="start-btn" type="button">${mic}<span id="home-call-label">Start a conversation</span><span class="home-widget-stop-icon" aria-hidden="true"></span></button>
            </div>
            <div class="top-controls">
                <button class="top-control" id="mute-btn" type="button" aria-label="Unmute microphone" aria-pressed="true" disabled>${mic}<span class="home-mic-label">Mic off</span></button>
                <span class="home-widget-session-hint" id="home-session-hint">Voice & text</span>
                <button class="top-control" id="new-btn" type="button" aria-label="Start a new conversation"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10a9 9 0 1 1 2 9M3 4v6h6"/></svg><span>New chat</span></button>
            </div>
            <div class="bottom-area">
                <div class="chat-viewport" id="chat-viewport"><div class="home-widget-welcome" id="home-widget-welcome"><p>A question. An idea.<br>A good place to start.</p><span>Ask about the tools, find a game,<br>or let me point you in the right direction.</span></div><div class="chat-history" id="chat-history" role="log" aria-label="Conversation with Johnny" aria-live="polite" aria-relevant="additions text"></div></div>
                <div class="input-area"><label class="home-widget-input-label" for="voice-text-input">Message Johnny</label><div class="input-wrapper"><input type="text" id="voice-text-input" placeholder="What's on your mind?" autocomplete="off" enterkeyhint="send"><button id="home-send-btn" class="home-widget-send" type="button" aria-label="Send message"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button></div><p class="home-widget-footer"><span class="home-widget-ai-dot"></span>AI, with a little Johnny personality.</p></div>
            </div>`;
        for (const [property, id] of Object.entries({ card: 'voice-card', btn: 'start-btn', titleBtn: 'widget-title-button', history: 'chat-history', historyViewport: 'chat-viewport', statusLabel: 'status-label', visualizer: 'visualizer', newBtn: 'new-btn', muteBtn: 'mute-btn', textInput: 'voice-text-input' })) {
            this[property] = document.getElementById(id);
        }
        this.fileInput = null;
        this.uploadLabel = null;
        this.updateState('idle');
    }

    attachEvents() {
        super.attachEvents();
        this.btn.onclick = () => {
            if (this.state === 'idle' || this.state === 'error') {
                this.isTextInitiated = false;
                this.startSession();
            } else this.stopSession();
        };
        this.container.addEventListener('pointerdown', () => {
            if (this.remoteAudioEl?.paused && this.remoteAudioEl.srcObject) this.remoteAudioEl.play().catch(() => {});
        });
        document.getElementById('home-send-btn').onclick = () => {
            const text = this.textInput.value.trim();
            if (!text) return;
            this.textInput.value = '';
            this.sendTextMessage(text);
        };
        // Enter during IME composition must finish composing rather than send.
        this.textInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && event.isComposing) event.stopImmediatePropagation();
        }, true);
        this.container.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape' || this.container.classList.contains('minimized')) return;
            this.minimizeWidget();
            this.titleBtn.focus({ preventScroll: true });
        });
        const syncExpanded = () => {
            const expanded = !this.container.classList.contains('minimized');
            this.titleBtn.setAttribute('aria-expanded', String(expanded));
            this.titleBtn.setAttribute('aria-label', expanded ? 'Johnny AI site guide' : 'Open Johnny, your AI site guide');
            const min = document.getElementById('minimize-btn');
            min.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
            min.setAttribute('aria-label', 'Minimize Johnny');
        };
        new MutationObserver(syncExpanded).observe(this.container, { attributes: true, attributeFilter: ['class'] });
        syncExpanded();
    }

    updateState(state) {
        super.updateState(state);
        if (!this.container) return;
        this.container.dataset.state = state;
        const active = ['listening', 'speaking'].includes(state);
        const labels = { idle: 'A little help finding your next thing.', connecting: 'Connecting you to Johnny…', listening: this.isMuted ? 'Connected. Unmute when you’re ready.' : 'I’m listening. Take your time.', speaking: 'Johnny is speaking…', error: 'Couldn’t connect. Give it another try.' };
        this.statusLabel.innerText = labels[state] || labels.idle;
        const callLabel = document.getElementById('home-call-label');
        if (callLabel) callLabel.textContent = state === 'connecting' ? 'Cancel connection' : active ? 'End conversation' : state === 'error' ? 'Try connecting again' : 'Start a conversation';
        this.btn.setAttribute('aria-label', callLabel?.textContent || 'Start a conversation');
        this.muteBtn.disabled = !active;
        this.syncHomeMic();
        const sessionHint = document.getElementById('home-session-hint');
        if (sessionHint) sessionHint.textContent = active ? 'Connected' : state === 'connecting' ? 'Connecting' : 'Voice & text';
    }

    syncHomeMic() {
        if (!this.muteBtn) return;
        const muted = !this.stream || this.isMuted;
        this.muteBtn.setAttribute('aria-pressed', String(muted));
        this.muteBtn.setAttribute('aria-label', muted ? 'Unmute microphone' : 'Mute microphone');
        this.muteBtn.querySelector('.home-mic-label').textContent = muted ? 'Mic off' : 'Mic on';
    }

    toggleMute() {
        super.toggleMute();
        this.syncHomeMic();
        if (this.state === 'listening') this.updateState('listening');
    }

    // Keep the visual console steady while the transcript grows.
    updateSphereScale() {}

    createMessageBubble(role) {
        document.getElementById('home-widget-welcome').hidden = true;
        return super.createMessageBubble(role);
    }

    resetChat() {
        this.homeTextGeneration += 1;
        super.resetChat();
        document.getElementById('home-widget-welcome').hidden = false;
        this.textInput.focus({ preventScroll: true });
    }

    getGreetingPrompt() {
        return "Say exactly: 'Hey, welcome to my little corner of the internet. I can help you find a tool, pick a game, or figure out where to start. Your microphone starts off muted. Tap Mic off when you are ready to talk, or just type below.' Do not add any other greeting text.";
    }

    async startSession() {
        if (this.state === 'connecting') return this.homeConnecting;
        if (this.state === 'error') super.stopPlayback();
        const generation = (this.homeConnectionGeneration || 0) + 1;
        this.homeConnectionGeneration = generation;
        const controller = new AbortController();
        this.homeAbort = controller;
        const current = () => generation === this.homeConnectionGeneration;
        this.pendingHangup = false;
        this.updateState('connecting');
        const deadline = setTimeout(() => controller.abort(), 30000);
        this.homeConnecting = (async () => {
            try {
                const tokenUrl = new URL(`${this.getBackendUrl()}/api/realtime-token`);
                tokenUrl.searchParams.set('profile', this.profile);
                tokenUrl.searchParams.set('t', Date.now().toString());
                const tokenResponse = await fetch(tokenUrl, { method: 'POST', headers: this.getAuthHeaders(), signal: controller.signal });
                if (!tokenResponse.ok) throw new Error(tokenResponse.status === 429 ? 'visit limit' : 'Connection unavailable');
                const data = await tokenResponse.json();
                if (!current()) return;
                const key = data.client_secret?.value || data.value;
                if (!key) throw new Error('Connection unavailable');
                this.realtimeModel = String(data.model || data.session?.model || '');
                const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
                if (!current() || controller.signal.aborted) {
                    stream.getTracks().forEach(track => track.stop());
                    if (current()) throw new Error('Connection timed out');
                    return;
                }
                this.stream = stream;
                this.isMuted = true;
                stream.getAudioTracks().forEach(track => { track.enabled = false; });
                this.muteBtn.dataset.muted = 'true';
                const pc = new RTCPeerConnection();
                this.pc = pc;
                const audio = document.createElement('audio');
                audio.autoplay = true;
                audio.playsInline = true;
                audio.setAttribute('aria-hidden', 'true');
                audio.style.display = 'none';
                document.body.appendChild(audio);
                this.remoteAudioEl = audio;
                pc.ontrack = event => {
                    if (!current()) return;
                    audio.srcObject = event.streams[0];
                    audio.play().catch(() => { this.statusLabel.innerText = 'Tap the conversation to enable Johnny’s audio.'; });
                };
                pc.addTrack(stream.getAudioTracks()[0], stream);
                pc.onconnectionstatechange = () => {
                    if (!current()) return;
                    if (['failed', 'closed'].includes(pc.connectionState)) {
                        this.stopPlayback();
                        this.updateState('error');
                    }
                };
                const channel = pc.createDataChannel('oai-events');
                this.dc = channel;
                channel.onopen = () => { if (current()) { this.updateState('listening'); this.onDataChannelOpen(); } };
                channel.onmessage = event => {
                    if (!current()) return;
                    try { this.onDataChannelMessage(JSON.parse(event.data)); } catch { /* Ignore malformed events. */ }
                };
                channel.onclose = () => {
                    if (!current()) return;
                    this.stopPlayback();
                    this.updateState('error');
                };
                const offer = await pc.createOffer();
                if (!current()) return;
                await pc.setLocalDescription(offer);
                const response = await fetch(data.realtime_url || 'https://api.openai.com/v1/realtime/calls', {
                    method: 'POST', body: offer.sdp, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/sdp' }, signal: controller.signal
                });
                if (!response.ok) throw new Error('Connection unavailable');
                const sdp = await response.text();
                if (!current()) return;
                await pc.setRemoteDescription({ type: 'answer', sdp });
                if (channel.readyState !== 'open') {
                    await new Promise((resolve, reject) => {
                        const cleanup = () => { channel.removeEventListener('open', opened); channel.removeEventListener('close', closed); controller.signal.removeEventListener('abort', closed); };
                        const opened = () => { cleanup(); resolve(); };
                        const closed = () => { cleanup(); reject(new Error('Connection closed')); };
                        channel.addEventListener('open', opened, { once: true });
                        channel.addEventListener('close', closed, { once: true });
                        controller.signal.addEventListener('abort', closed, { once: true });
                        if (controller.signal.aborted) closed();
                    });
                }
            } catch (error) {
                if (!current()) return;
                super.stopPlayback();
                this.updateState('error');
                if (error.name === 'NotAllowedError') this.statusLabel.innerText = 'Microphone access is needed. Allow it, then try again.';
                else if (error.message.includes('visit limit')) this.statusLabel.innerText = 'Today’s visit limit is reached. You can still explore the site.';
            } finally {
                clearTimeout(deadline);
                if (current()) this.homeConnecting = null;
            }
        })();
        return this.homeConnecting;
    }

    onDataChannelOpen() {
        const channel = this.dc;
        for (const message of this.messages) {
            channel.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'message', role: message.role, content: [{ type: message.role === 'user' ? 'input_text' : 'text', text: message.text }] } }));
        }
        if (this.pendingUpload) {
            const upload = this.pendingUpload;
            this.pendingUpload = null;
            this.processUploadResponse(upload);
        } else if (!this.isTextInitiated) {
            const prompt = this.messages.length ? "Briefly say 'I'm back' or ask 'Where were we?' to resume the session." : this.getGreetingPrompt();
            this.homeGreetingTimer = setTimeout(() => {
                if (channel === this.dc && channel.readyState === 'open') {
                    this.homeResponseActive = true;
                    channel.send(JSON.stringify({ type: 'response.create', response: { instructions: prompt } }));
                }
            }, 800);
        }
        this.isTextInitiated = false;
    }

    stopPlayback() {
        this.homeConnectionGeneration = (this.homeConnectionGeneration || 0) + 1;
        this.homeAbort?.abort();
        clearTimeout(this.homeGreetingTimer);
        this.homeResponseActive = false;
        this.homeQueuedTexts = [];
        super.stopPlayback();
    }

    dispatchText(text) {
        clearTimeout(this.homeGreetingTimer);
        if (this.homeResponseActive) {
            this.homeQueuedTexts.push(text);
            this.statusLabel.innerText = 'Your message is next. Johnny is finishing a thought.';
            return;
        }
        this.homeResponseActive = true;
        super.dispatchText(text);
        this.statusLabel.innerText = 'Johnny is thinking…';
    }

    onDataChannelMessage(message) {
        if (message.type === 'response.created') this.homeResponseActive = true;
        super.onDataChannelMessage(message);
        if (['response.done', 'response.failed', 'response.cancelled'].includes(message.type)) {
            this.homeResponseActive = false;
            if (this.homeQueuedTexts.length && this.dc?.readyState === 'open') this.dispatchText(this.homeQueuedTexts.shift());
        }
    }

    async sendTextMessage(text) {
        // Wait for a bounded connection before dispatching or recovering a draft.
        if (this.homeTextPending) { this.textInput.value = text; return; }
        if (!this.allowHomeTurn()) return;
        this.homeTextPending = true;
        const generation = this.homeTextGeneration;
        const sendButton = document.getElementById('home-send-btn');
        sendButton.disabled = true;
        try {
            if (this.state === 'idle' || this.state === 'error') {
                this.isTextInitiated = true;
                await this.startSession();
            }
            if (generation !== this.homeTextGeneration) return;
            const channel = this.dc;
            if (!channel || this.state === 'error') throw new Error('Connection unavailable');
            if (channel.readyState !== 'open') {
                await new Promise((resolve, reject) => {
                    const cleanup = () => { clearTimeout(timer); channel.removeEventListener('open', opened); channel.removeEventListener('close', closed); };
                    const opened = () => { cleanup(); resolve(); };
                    const closed = () => { cleanup(); reject(new Error('Connection closed')); };
                    const timer = setTimeout(() => { cleanup(); reject(new Error('Connection timed out')); }, 15000);
                    channel.addEventListener('open', opened, { once: true });
                    channel.addEventListener('close', closed, { once: true });
                });
            }
            if (generation !== this.homeTextGeneration || channel !== this.dc) return;
            this.dispatchText(text);
        } catch {
            if (generation !== this.homeTextGeneration) return;
            if (!this.textInput.value) this.textInput.value = text;
            this.statusLabel.innerText = 'Your message is still here. Try connecting again.';
        } finally {
            this.homeTextPending = false;
            sendButton.disabled = false;
        }
    }
}

/** The business demo keeps uploads and live search inside the same response lifecycle. */
class BusinessVoiceWidget extends HomeVoiceWidget {
    createUI() {
        super.createUI();
        this.businessQueue = [];
        this.businessToolsPending = 0;
        this.businessContinuation = null;
        this.businessUploadGeneration = 0;
        this.container.setAttribute('aria-label', 'Johnny, your business AI assistant');
        this.container.querySelector('.home-widget-subtitle').textContent = 'Your business. A little more help.';
        const welcome = document.getElementById('home-widget-welcome');
        welcome.querySelector('p').innerHTML = 'Big idea?<br>Let’s talk business.';
        welcome.querySelector('span').textContent = 'Tell me what you do. Try a customer conversation, share an image or PDF, or ask me to search the web.';
        this.textInput.placeholder = 'Tell me about your business…';
        this.container.querySelector('.home-widget-footer').innerHTML = '<span class="home-widget-ai-dot"></span>Voice · text · images · PDFs · live search';
        this.textInput.insertAdjacentHTML('beforebegin', '<button class="business-attach" id="upload-label" type="button" aria-label="Attach images or PDFs" title="Attach images or PDFs"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 11-9 9a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9.1 9.1a2 2 0 0 1-2.8-2.8L15 6"/></svg></button><input type="file" id="file-input" accept="image/*,application/pdf" hidden multiple>');
        this.fileInput = document.getElementById('file-input');
        this.uploadLabel = document.getElementById('upload-label');
    }

    attachEvents() {
        super.attachEvents();
        this.uploadLabel.onclick = () => this.fileInput.click();
        const label = () => this.titleBtn.setAttribute('aria-label', this.container.classList.contains('minimized') ? 'Open Johnny, your business AI assistant' : 'Johnny, your business AI assistant');
        new MutationObserver(label).observe(this.container, { attributes: true, attributeFilter: ['class'] });
        label();
    }

    updateState(state) {
        super.updateState(state);
        if (state === 'idle' && this.statusLabel) this.statusLabel.innerText = 'Your next good idea starts here.';
    }

    getGreetingPrompt() {
        return "Say exactly: 'Hi, I’m Johnny’s AI assistant. Tell me what kind of business you run, and we can try a customer conversation together. Your microphone starts muted. Tap Mic off to talk, or type below. You can share an image or PDF, too.' Do not add any other greeting text.";
    }

    dispatchText(text) {
        clearTimeout(this.homeGreetingTimer);
        if (this.homeResponseActive || this.businessToolsPending || this.businessContinuation) {
            this.businessQueue.push({ type: 'text', text });
            this.statusLabel.innerText = 'Your message is next. Johnny is finishing a thought.';
            return;
        }
        this.homeResponseActive = true;
        VoiceWidget.prototype.dispatchText.call(this, text);
        this.statusLabel.innerText = 'Johnny is thinking…';
    }

    processUploadResponse(content) {
        clearTimeout(this.homeGreetingTimer);
        if (this.homeResponseActive || this.businessToolsPending || this.businessContinuation) {
            this.businessQueue.push({ type: 'upload', content });
            this.statusLabel.innerText = 'Your upload is ready. Johnny will look at it next.';
            return;
        }
        this.homeResponseActive = true;
        super.processUploadResponse(content);
        this.statusLabel.innerText = 'Johnny is looking at your material…';
    }

    flushBusinessQueue() {
        if (this.homeResponseActive || this.businessToolsPending || this.dc?.readyState !== 'open') return;
        if (this.businessContinuation) {
            const instructions = this.businessContinuation;
            this.businessContinuation = null;
            this.homeResponseActive = true;
            this.dc.send(JSON.stringify({ type: 'response.create', response: { instructions } }));
            return;
        }
        const next = this.businessQueue.shift();
        if (next?.type === 'text') this.dispatchText(next.text);
        else if (next?.type === 'upload') this.processUploadResponse(next.content);
    }

    onDataChannelMessage(message) {
        super.onDataChannelMessage(message);
        if (['response.done', 'response.failed', 'response.cancelled'].includes(message.type)) this.flushBusinessQueue();
    }

    async handleFileUpload(event) {
        const files = Array.from(event.target.files || []);
        if (!files.length || this.businessUploading) return;
        if (files.some(file => !file.type.startsWith('image/') && file.type !== 'application/pdf')) {
            this.createMessageBubble('assistant').textContent = 'Please choose images or PDF files.';
            event.target.value = '';
            return;
        }
        const generation = ++this.businessUploadGeneration;
        const current = () => generation === this.businessUploadGeneration;
        this.businessUploading = true;
        this.uploadLabel.disabled = true;
        this.uploadLabel.setAttribute('aria-busy', 'true');
        const bubble = this.createMessageBubble('assistant');
        bubble.textContent = 'Looking at your upload…';
        this.scrollToBottom();
        this.businessUploadAbort = new AbortController();
        const deadline = setTimeout(() => this.businessUploadAbort?.abort(), 60000);
        try {
            const images = await this.buildRealtimeImageInputs(files);
            if (!current()) return;
            const form = new FormData();
            form.append('profile', this.profile);
            files.forEach(file => form.append('files', file));
            const response = await fetch(`${this.getBackendUrl()}/upload`, { method: 'POST', headers: this.getAuthHeaders(), body: form, signal: this.businessUploadAbort.signal });
            const data = await response.json();
            if (!current()) return;
            if (!response.ok) throw new Error(data.detail || data.error || 'Please try again.');
            const content = { text: data.text || 'None', description: data.description || 'None', summary: data.summary || null, isPdf: files.some(file => file.type === 'application/pdf'), imageAnalysis: Array.isArray(data.imageAnalysis) ? data.imageAnalysis : [], imageInputs: images };
            this.pendingUpload = content;
            bubble.textContent = `Attached: ${files.map(file => file.name).join(', ')}`;
            this.messages.push({ role: 'user', text: `Attached material: ${content.summary || content.text}. ${content.description}` });
            if (this.state === 'idle' || this.state === 'error') await this.startSession();
            else if (this.dc?.readyState === 'open') {
                this.pendingUpload = null;
                this.processUploadResponse(content);
            }
            if (current() && this.state === 'error') bubble.textContent = 'Your upload is ready. Use Try connecting again to talk about it.';
        } catch (error) {
            if (current()) {
                bubble.textContent = error.name === 'AbortError' ? 'The upload took too long. Please try attaching it again.' : `Couldn’t upload: ${error.message}`;
                this.scrollToBottom();
            }
        } finally {
            clearTimeout(deadline);
            if (current()) {
                this.businessUploading = false;
                this.uploadLabel.disabled = false;
                this.uploadLabel.removeAttribute('aria-busy');
                event.target.value = '';
            }
        }
    }

    async handleFunctionCall(message) {
        const name = message.name || message.function?.name || '';
        if (name !== 'search_web' && name !== 'web_search') return super.handleFunctionCall(message);
        const callId = message.call_id || message.callId || message.id || '';
        const callKey = callId || `${name}:${message.arguments || ''}`;
        if (this.handledFunctionCalls.has(callKey)) return;
        this.handledFunctionCalls.add(callKey);
        const channel = this.dc;
        const generation = this.homeConnectionGeneration;
        const current = () => channel === this.dc && channel?.readyState === 'open' && generation === this.homeConnectionGeneration;
        if (!current()) return;
        this.businessToolsPending += 1;
        const bubble = this.createMessageBubble('assistant');
        bubble.textContent = 'Searching the live web…';
        this.scrollToBottom();
        let output;
        try {
            const args = this.parseFunctionArguments(message.arguments);
            const query = String(args.query || args.search_query || args.q || '').trim();
            if (!query) throw new Error('The search question was empty.');
            const context = this.messages.slice(-6).map(item => `${item.role}: ${item.text}`).join('\n').slice(0, 3000);
            const response = await fetch(`${this.getBackendUrl()}/api/realtime-search`, { method: 'POST', headers: this.getAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ query, context, profile: this.profile }), signal: this.homeAbort?.signal });
            const data = await response.json();
            if (!current()) return;
            if (!response.ok) throw new Error('Search is unavailable right now.');
            const sources = (Array.isArray(data.sources) ? data.sources : []).filter(source => {
                try { return ['https:', 'http:'].includes(new URL(source.url).protocol); } catch { return false; }
            }).slice(0, 4);
            output = { answer: data.result || 'No clear result was found.', sources };
            bubble.textContent = sources.length ? 'Live sources' : 'Live search complete.';
            for (const source of sources) {
                const link = document.createElement('a');
                link.href = source.url;
                link.textContent = source.title || source.url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                bubble.appendChild(document.createElement('br'));
                bubble.appendChild(link);
            }
        } catch (error) {
            if (!current()) return;
            output = { error: 'Search unavailable', message: error.message };
            bubble.textContent = 'Live search is unavailable right now. You can keep talking with Johnny.';
        } finally {
            if (current()) {
                this.businessToolsPending = Math.max(0, this.businessToolsPending - 1);
                if (output) {
                    channel.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(output) } }));
                    this.businessContinuation = 'Use the search tool results to answer naturally and concisely. Mention sources shown in the chat without reading URLs aloud. If search failed, explain briefly and offer to continue without it.';
                }
                this.flushBusinessQueue();
                this.scrollToBottom();
            }
        }
    }

    stopPlayback() {
        this.businessUploadGeneration = (this.businessUploadGeneration || 0) + 1;
        this.businessUploadAbort?.abort();
        this.businessQueue = [];
        this.businessToolsPending = 0;
        this.businessContinuation = null;
        this.businessUploading = false;
        this.pendingUpload = null;
        if (this.uploadLabel) {
            this.uploadLabel.disabled = false;
            this.uploadLabel.removeAttribute('aria-busy');
        }
        if (this.fileInput) this.fileInput.value = '';
        super.stopPlayback();
    }
}

// Global Init with Editor Protection
function initJohnny() {
    if (window.johnnyInitialized) return;
    window.johnnyInitialized = true;
    const profile = detectJohnnyWidgetProfile();
    const Widget = profile === "home" ? HomeVoiceWidget : profile === "ai" && window.JOHNNY_WIDGET_THEME === "galaxy" ? BusinessVoiceWidget : VoiceWidget;
    new Widget();
}

initJohnny();
setTimeout(initJohnny, 1000);
setTimeout(initJohnny, 3000);
window.addEventListener('load', initJohnny);
document.addEventListener('DOMContentLoaded', initJohnny);
