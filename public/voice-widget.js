/**
 * VOICE WIDGET LOGIC (OpenAI Realtime WebRTC)
 */

function normalizeJohnnyWidgetProfile(value) {
    const profile = String(value || "").toLowerCase().trim();
    if (profile === "mowing" || profile === "ai") return profile;
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
        this.messages = [];
        this.isMuted = false;
        this.pendingUpload = null;
        this.isTextInitiated = false;
        this.pendingHangup = false;
        this.remoteAudioEl = null;
        this.profile = detectJohnnyWidgetProfile();
        this.allowUploads = this.profile === "ai";
        this.widgetTitleText = this.profile === "mowing" ? "Johnny - Mowing Assistant" : "Johnny's AI Assistant";
        window.johnnyWidgetProfile = this.profile;

        if (this.isEditor()) {
            console.log("🛠️ Johnny: Editor mode detected. Disabling widget to avoid blocking tools.");
            return;
        }

        this.init();
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
                <button class="widget-title-button" id="widget-title-button" type="button" aria-label="${this.profile === 'mowing' ? 'Open mowing chat' : 'Open AI chat'}">
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

        if (container && window.matchMedia('(max-width: 600px)').matches) {
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
        const syncChrome = () => {
            if (!container || !minBtn) return;
            const minimized = container.classList.contains('minimized');
            minBtn.innerText = minimized ? '💬' : '_';
            minBtn.title = minimized ? 'Open chat' : 'Minimize';
            if (titleBtn) {
                titleBtn.setAttribute('aria-label', minimized ? (this.profile === 'mowing' ? 'Open mowing chat' : 'Open AI chat') : (this.profile === 'mowing' ? 'Mowing chat widget header' : 'AI chat widget header'));
            }
        };

        if (minBtn) {
            minBtn.onclick = () => {
                container.classList.toggle('minimized');
                syncChrome();
            };
        }

        if (titleBtn) {
            titleBtn.onclick = () => {
                if (!container.classList.contains('minimized')) return;
                container.classList.remove('minimized');
                syncChrome();
            };
        }

        syncChrome();

        const header = document.getElementById('widget-header');
        if (header) {
            let isDragging = false;
            let startX, startY, initialX, initialY;

            header.onmousedown = (e) => {
                if (e.target.closest('button')) return;
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
                    container.style.transition = 'height 0.3s ease, border-radius 0.3s ease';
                }
            });
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
            const scriptTag = document.querySelector('script[src*="voice-widget.js"]');
            const backendUrl = scriptTag ? new URL(scriptTag.src).origin : window.location.origin;
            const res = await fetch(`${backendUrl}/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || data.error || "Upload failed");

            const contentObj = {
                text: data.text || "None",
                description: data.description || "None",
                summary: data.summary || null,
                isPdf: (data.description || "").includes("PDF"),
                imageAnalysis: Array.isArray(data.imageAnalysis) ? data.imageAnalysis : []
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

        this.dc.send(JSON.stringify({
            type: "conversation.item.create",
            item: {
                type: "message",
                role: "user",
                content: [{ type: "input_text", text: userMsg }]
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
        if (this.profile === "mowing") {
            return "Say exactly: 'Hi, I'm Johnny's mowing assistant and am here to help. Now please press the red button above so we can talk. It starts off muted so you don't accidentally cut me off, and you can mute it at any time.' Do not add any other greeting text.";
        }

        return "Say exactly: 'Hi, I'm Johnny's AI assistant and am here to help. Now please press the red button above so we can talk. It starts off muted so you don't accidentally cut me off, and you can mute it at any time.' Do not add any other greeting text.";
    }

    async sendTextMessage(text) {
        console.log("📤 Sending Text Message:", text);

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

    resetChat() {
        if (this.history) this.history.innerHTML = "";
        this.messages = [];
        this.itemBubbles.clear();
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
            this.updateState('connecting');
            const scriptTag = document.querySelector('script[src*="voice-widget.js"]');
            const backendUrl = scriptTag ? new URL(scriptTag.src).origin : window.location.origin;
            const tokenUrl = new URL(`${backendUrl}/api/realtime-token`);
            tokenUrl.searchParams.set("t", Date.now().toString());
            tokenUrl.searchParams.set("profile", this.profile);

            const tokenRes = await fetch(tokenUrl.toString(), { method: 'POST' });
            if (!tokenRes.ok) throw new Error("Token fetch failed");

            const data = await tokenRes.json();
            const EPHEMERAL_KEY = data.client_secret.value;

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

            const model = data.model || "gpt-4o-realtime-preview";
            const realtimeRes = await fetch(`https://api.openai.com/v1/realtime?model=${model}`, {
                method: 'POST',
                body: offer.sdp,
                headers: { Authorization: `Bearer ${EPHEMERAL_KEY}`, "Content-Type": "application/sdp" }
            });

            if (!realtimeRes.ok) throw new Error("OpenAI Handshake Error");
            const answerSdp = await realtimeRes.text();
            await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

            this.updateState('listening');
        } catch (err) {
            console.error("🔥 Johnny Error:", err);
            this.updateState('error');
            if (this.statusLabel) this.statusLabel.innerText = "CONNECTION ISSUE";
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
                        content: [{ type: "text", text: msg.text }]
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
            case 'conversation.item.created':
                // PRE-CREATE bubbles for every item (User or Assistant)
                if (!this.itemBubbles.has(msg.item.id)) {
                    const role = msg.item.role === 'user' ? 'user' : 'assistant';
                    // We don't create for 'function_call' items unless we want to log them
                    if (msg.item.type === 'message') {
                        const bubble = this.createMessageBubble(role);
                        this.itemBubbles.set(msg.item.id, bubble);

                        // If it's a text message that already has content (like text input), show it!
                        const textContent = msg.item.content?.find(c => c.type === 'input_text' || c.type === 'text');
                        if (textContent) {
                            bubble.innerText = textContent.text;
                            this.scrollToBottom();
                        }
                    }
                }
                break;
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
        if (msg.name === 'web_search') {
            const searchBubble = this.createMessageBubble('assistant');
            searchBubble.innerHTML = `<i>Loading demo contact details...</i>`;
            this.scrollToBottom();

            try {
                this.dc.send(JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                        type: "function_call_output",
                        call_id: msg.call_id,
                        output: "Demo contact card:\nPhone: (555) 014-7823\nAddress: 100 Demo Plaza, Suite 200, Springfield, IL 62704\nHours: Mon-Fri 8:00 AM - 5:00 PM\n\nThis is a fictional placeholder for the demo. If you want real live contact lookup, directions, or hours, we can connect that in a custom version."
                    }
                }));
                this.dc.send(JSON.stringify({ type: "response.create" }));
            } catch (err) {
                console.error("Live-info guardrail failed", err);
                this.dc.send(JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                        type: "function_call_output",
                        call_id: msg.call_id,
                        output: "Demo contact card:\nPhone: (555) 014-7823\nAddress: 100 Demo Plaza, Suite 200, Springfield, IL 62704\nHours: Mon-Fri 8:00 AM - 5:00 PM\n\nThis is a fictional placeholder for the demo. If you want real live contact lookup, directions, or hours, we can connect that in a custom version."
                    }
                }));
                this.dc.send(JSON.stringify({ type: "response.create" }));
            } finally {
                searchBubble.remove();
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
            const labels = { idle: 'READY', connecting: 'BOOTING...', listening: 'REALTIME GPT5.4', speaking: 'JOHNNY SPEAKING', error: 'ERROR' };
            this.statusLabel.innerText = labels[state] || state.toUpperCase();
        }
    }

    async stopSession() {
        console.log("⏹️ Stopping Session...");
        // Send summary before stopping if we have messages
        if (this.messages.length > 0) {
            const scriptTag = document.querySelector('script[src*="voice-widget.js"]');
            const backendUrl = scriptTag ? new URL(scriptTag.src).origin : window.location.origin;

            // Fire and forget summary
            fetch(`${backendUrl}/api/record-call-summary`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript: this.messages })
            }).catch(e => console.error("Summary failed", e));
        }

        if (this.stream) this.stream.getTracks().forEach(t => t.stop());
        if (this.pc) this.pc.close();
        if (this.remoteAudioEl) {
            this.remoteAudioEl.srcObject = null;
            this.remoteAudioEl.remove();
            this.remoteAudioEl = null;
        }
        this.updateState('idle');
    }
}

// Global Init with Editor Protection
function initJohnny() {
    if (window.johnnyInitialized) return;
    window.johnnyInitialized = true;
    new VoiceWidget();
}

initJohnny();
setTimeout(initJohnny, 1000);
setTimeout(initJohnny, 3000);
window.addEventListener('load', initJohnny);
document.addEventListener('DOMContentLoaded', initJohnny);
