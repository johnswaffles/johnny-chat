/**
 * VOICE WIDGET LOGIC (OpenAI Realtime WebRTC)
 * Includes Integrated Legal Lockdown v9
 */

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

        // Legal & Editor Settings
        this.CONSENT_KEY = 'jj_legal_consent_v9_atomic';
        this.MODAL_ID = 'jj-legal-modal-atomic';

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

        // 1. Check Legal First
        if (!this.hasConsent()) {
            this.showLegalModal();
        } else {
            this.createUI();
            this.attachEvents();
        }
    }

    hasConsent() {
        try {
            const raw = localStorage.getItem(this.CONSENT_KEY);
            if (!raw) return false;
            const data = JSON.parse(raw);
            const daysSince = (new Date() - new Date(data.ts)) / (1000 * 60 * 60 * 24);
            return daysSince < 1; // 24-hour expiry
        } catch (e) { return false; }
    }

    showLegalModal() {
        console.log("⚖️ Johnny Legal: Mandatory intercept triggered.");

        // Inject Overlord CSS for Modal
        const style = document.createElement('style');
        style.id = 'jj-legal-styles';
        style.textContent = `
            #${this.MODAL_ID} {
                position: fixed !important;
                inset: 0 !important;
                background: rgba(0, 0, 0, 0.98) !important;
                z-index: 2147483647 !important;
                font-family: 'Inter', system-ui, sans-serif !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 20px !important;
                backdrop-filter: blur(15px) !important;
                color: #fff !important;
            }
            #${this.MODAL_ID} .box {
                background: #111 !important;
                width: 100% !important;
                max-width: 650px !important;
                padding: 40px !important;
                border-radius: 24px !important;
                border: 1px solid rgba(255, 255, 255, 0.1) !important;
                box-shadow: 0 50px 100px rgba(0,0,0,1) !important;
            }
            #${this.MODAL_ID} h2 { color: #fbbf24 !important; margin: 0 0 20px !important; font-size: 2rem !important; text-align: center !important; }
            #${this.MODAL_ID} .scrollbox { max-height: 50vh !important; overflow-y: auto !important; padding-right: 15px !important; margin-bottom: 30px !important; }
            #${this.MODAL_ID} p { margin: 0 0 1.2rem !important; line-height: 1.6 !important; font-size: 1.05rem !important; color: rgba(255,255,255,0.9) !important; }
            #${this.MODAL_ID} .highlight { background: rgba(251, 191, 36, 0.1) !important; border-left: 4px solid #fbbf24 !important; padding: 15px !important; margin: 20px 0 !important; }
            #${this.MODAL_ID} .btn {
                width: 100% !important;
                padding: 18px !important;
                background: #fbbf24 !important;
                color: #000 !important;
                border: none !important;
                border-radius: 12px !important;
                cursor: pointer !important;
                font-weight: 800 !important;
                font-size: 1.2rem !important;
                text-transform: uppercase !important;
            }
        `;
        document.head.appendChild(style);

        const modal = document.createElement('div');
        modal.id = this.MODAL_ID;
        modal.innerHTML = `
            <div class="box">
                <h2>Before You Continue</h2>
                <div class="scrollbox">
                    <p>Please read and accept our terms to use JustAskJohnny, StoryForge, and related apps.</p>
                    <p>These tools use AI and may produce errors or unexpected content. Everything here is for <strong>entertainment only</strong>, not professional advice.</p>
                    <div class="highlight">
                        <p><strong>StoryForge Notice:</strong> StoryForge is unpredictable. Plots, characters, and tone can shift suddenly. If anything makes you uncomfortable, stop immediately or refresh.</p>
                    </div>
                    <p><strong>Your Control:</strong> If the AI feels "off the rails," you must stop, reset, and restart. Do not continue if you are uncomfortable.</p>
                    <p><strong>Mood Advisory:</strong> If you feel depressed or emotionally unstable, do not use this service. AI content can amplify negative feelings. Only use when grounded.</p>
                    <p>You are responsible for how you use all outputs. <strong>JustAskJohnny and affiliates are not liable</strong> for any loss, injury, or damages.</p>
                    <div class="highlight">
                        <p><strong>Age Requirement:</strong> By continuing, you confirm you are <strong>at least 30 years old</strong>. AI content can be intense, and this threshold helps ensure responsible management.</p>
                    </div>
                    <p>By continuing, you accept our Terms and Privacy Policy. <strong>If you are under 30, please do not use this service.</strong></p>
                </div>
                <button class="btn" id="jjAcceptBtn">Accept & Continue</button>
            </div>
        `;

        document.documentElement.appendChild(modal);
        document.documentElement.style.overflow = 'hidden';

        modal.querySelector('#jjAcceptBtn').onclick = () => {
            localStorage.setItem(this.CONSENT_KEY, JSON.stringify({ ts: new Date().toISOString() }));
            modal.remove();
            document.documentElement.style.overflow = '';
            // Now start the actual widget
            this.createUI();
            this.attachEvents();
        };
    }

    createUI() {
        if (document.getElementById('voice-widget-container')) return;

        const container = document.createElement('div');
        container.id = 'voice-widget-container';
        document.body.insertAdjacentElement('afterbegin', container);

        container.innerHTML = `
            <div class="voice-widget-card" id="voice-card" data-state="idle">
                <div class="glow-field"></div>
                <div class="face-layer">
                    <div class="eye left"></div>
                    <div class="eye right"></div>
                    <div class="mouth"></div>
                </div>
                
                <div class="status-indicator">
                    <span class="status-label" id="status-label">PRESS TO START</span>
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
        this.history = document.getElementById('chat-history');
        this.historyViewport = document.getElementById('chat-viewport');
        this.statusLabel = document.getElementById('status-label');
        this.visualizer = document.getElementById('visualizer');
        this.newBtn = document.getElementById('new-btn');
        this.muteBtn = document.getElementById('mute-btn');
        this.textInput = document.getElementById('voice-text-input');
        this.fileInput = document.getElementById('file-input');
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
            this.fileInput.onchange = (e) => this.handleFileUpload(e);
        }
    }

    async handleFileUpload(e) {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const formData = new FormData();
        for (const file of files) {
            formData.append('files', file);
        }

        const uploadBubble = this.createMessageBubble('assistant');
        uploadBubble.innerHTML = `<i>Processing material...</i>`;
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
                isPdf: (data.description || "").includes("PDF")
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
        let userMsg = `I've uploaded some material. Here is the context:\n[RAW DATA]: ${content.text}\n[VISUALS]: ${content.description}`;
        if (content.summary) {
            userMsg += `\n[SUMMARY]: ${content.summary}`;
        }

        this.dc.send(JSON.stringify({
            type: "conversation.item.create",
            item: {
                type: "message",
                role: "user",
                content: [{ type: "input_text", text: userMsg }]
            }
        }));

        let prompt = "Acknowledge the material.";
        if (content.isPdf && content.summary) {
            prompt = `Present the following detailed summary of the PDF with authority: ${content.summary}. Then ask 'What would you like me to do with this material?'. IMPORTANT: If the user asks you to read the PDF 'word for word', you MUST reply: 'I am unable to do word for word PDF, only summarize' (and spell 'summarize' exactly like that). Otherwise, answer questions using the provided context.`;
        } else {
            prompt = "Acknowledge the material and ask 'What would you like me to do with this uploaded material?'. For pictures, you can answer any questions about them normally.";
        }

        this.dc.send(JSON.stringify({
            type: "response.create",
            response: {
                instructions: prompt + " Stay in character as Johnny."
            }
        }));
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

            const tokenRes = await fetch(`${backendUrl}/api/realtime-token?t=${Date.now()}`, { method: 'POST' });
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
            this.pc.ontrack = (e) => { audioEl.srcObject = e.streams[0]; };
            this.pc.addTrack(this.stream.getTracks()[0]);

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
                : "Introduce yourself. Be sharp and sarcastic as Johnny. Lead the conversation.";

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
                            }
                        }
                    });
                }
                break;
            case 'response.function_call_arguments.done':
                this.handleFunctionCall(msg);
                break;
        }
    }

    async handleFunctionCall(msg) {
        const args = JSON.parse(msg.arguments || "{}");
        const scriptTag = document.querySelector('script[src*="voice-widget.js"]');
        const backendUrl = scriptTag ? new URL(scriptTag.src).origin : window.location.origin;

        if (msg.name === 'web_search') {
            const query = args.query || "";
            const searchBubble = this.createMessageBubble('assistant');
            searchBubble.innerHTML = `<i>Searching for "${query}"...</i>`;
            this.scrollToBottom();

            try {
                const res = await fetch(`${backendUrl}/api/voice-search`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Search API Error");

                this.dc.send(JSON.stringify({
                    type: "conversation.item.create",
                    item: { type: "function_call_output", call_id: msg.call_id, output: data.result || "No info" }
                }));
                this.dc.send(JSON.stringify({ type: "response.create" }));
            } catch (err) {
                console.error("Search failed", err);
                this.dc.send(JSON.stringify({
                    type: "conversation.item.create",
                    item: { type: "function_call_output", call_id: msg.call_id, output: "I'm having trouble searching the web right now." }
                }));
                this.dc.send(JSON.stringify({ type: "response.create" }));
            } finally {
                searchBubble.remove();
            }
        } else if (msg.name === 'send_order_summary') {
            console.log("📧 Sending Kitchen Ticket via Widget...");
            try {
                const res = await fetch(`${backendUrl}/api/send-order-email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(args)
                });
                const data = await res.json();

                this.dc.send(JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                        type: "function_call_output",
                        call_id: msg.call_id,
                        output: JSON.stringify({ success: res.ok, message: data.message || data.error })
                    }
                }));
                this.dc.send(JSON.stringify({ type: "response.create" }));
            } catch (err) {
                console.error("Email failed", err);
                this.dc.send(JSON.stringify({
                    type: "conversation.item.create",
                    item: { type: "function_call_output", call_id: msg.call_id, output: JSON.stringify({ success: false, error: err.message }) }
                }));
                this.dc.send(JSON.stringify({ type: "response.create" }));
            }
        } else if (msg.name === 'end_call') {
            console.log("👋 Hanging up...");
            this.dc.send(JSON.stringify({
                type: "conversation.item.create",
                item: { type: "function_call_output", call_id: msg.call_id, output: JSON.stringify({ success: true }) }
            }));
            setTimeout(() => this.stopSession(), 1000);
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
            const labels = { idle: 'READY', connecting: 'BOOTING...', listening: 'REALTIME GPT5.2', speaking: 'JOHNNY SPEAKING', error: 'ERROR' };
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
