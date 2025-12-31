/**
 * VOICE WIDGET LOGIC (OpenAI Realtime WebRTC)
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
        this.messages = [];
        this.isMuted = false;
        this.init();
    }

    init() {
        console.log("🚀 Johnny Widget: Initializing...");
        this.createUI();
        this.attachEvents();
    }

    createUI() {
        const container = document.createElement('div');
        container.id = 'voice-widget-container';

        // Ensure it's prepended or appended specifically to avoid z-index traps on some sites
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
                </button>
                <button class="top-control bottom-right" id="new-btn">NEW</button>
            </div>
            
            <div class="bottom-area">
                <div class="chat-viewport" id="chat-viewport">
                    <div class="chat-history" id="chat-history"></div>
                </div>
            </div>
        `;
        // document.body.appendChild(container); // Moved to afterbegin

        this.card = document.getElementById('voice-card');
        this.btn = document.getElementById('start-btn');
        this.history = document.getElementById('chat-history');
        this.historyViewport = document.getElementById('chat-viewport');
        this.statusLabel = document.getElementById('status-label');
        this.visualizer = document.getElementById('visualizer');
        this.newBtn = document.getElementById('new-btn');
        this.muteBtn = document.getElementById('mute-btn');

        // Fix for missing reference
        this.captionArea = this.history;
    }

    updateState(state) {
        this.state = state;
        if (this.card) this.card.dataset.state = state;

        switch (state) {
            case 'idle':
                this.statusLabel.innerText = "READY";
                // Persistence: Don't clear history or messages here
                break;
            case 'connecting':
                this.statusLabel.innerText = "BOOTING...";
                break;
            case 'listening':
                this.statusLabel.innerText = "LISTENING";
                break;
            case 'speaking':
                this.statusLabel.innerText = "JOHNNY SPEAKING";
                break;
            case 'error':
                this.statusLabel.innerText = "ERROR";
                break;
        }
    }

    attachEvents() {
        if (!this.btn) return;
        this.btn.addEventListener('click', () => {
            console.log("👆 Sphere clicked, current state:", this.state);
            if (this.state === 'idle') {
                this.startSession();
            } else {
                this.stopSession();
            }
        });

        if (this.newBtn) {
            this.newBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.resetChat();
            });
        }

        if (this.muteBtn) {
            this.muteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMute();
            });
        }
    }

    resetChat() {
        console.log("🧹 Resetting chat history...");
        if (this.history) this.history.innerHTML = "";
        this.messages = [];
        this.activeAssistantBubble = null;
        this.activeUserBubble = null;
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        console.log("🎤 Mic Muted:", this.isMuted);

        if (this.stream) {
            this.stream.getAudioTracks().forEach(track => {
                track.enabled = !this.isMuted;
            });
        }

        if (this.muteBtn) {
            this.muteBtn.dataset.muted = this.isMuted;
        }
    }

    async startSession() {
        try {
            this.updateState('connecting');
            console.log("📥 1. Requesting Ephemeral Token from Server...");
            const scriptTag = document.querySelector('script[src*="voice-widget.js"]');
            const backendUrl = scriptTag ? new URL(scriptTag.src).origin : window.location.origin;

            // Use /api/realtime-token and add a cache-buster
            const tokenRes = await fetch(`${backendUrl}/api/realtime-token?t=${Date.now()}`, { method: 'POST' });
            if (!tokenRes.ok) {
                const errText = await tokenRes.text();
                throw new Error(`Token fetch failed: ${tokenRes.status} ${errText}`);
            }
            const data = await tokenRes.json();
            const EPHEMERAL_KEY = data.client_secret.value;
            console.log("✅ 2. Token received:", EPHEMERAL_KEY.substring(0, 10) + "...");

            // 2. Get Microphone
            console.log("🎤 3. Accessing Microphone...");
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // 3. Create Peer Connection
            console.log("📡 4. Creating RTCPeerConnection...");
            this.pc = new RTCPeerConnection();

            // 4. Audio Handlers
            const audioEl = document.createElement('audio');
            audioEl.autoplay = true;
            this.pc.ontrack = (e) => {
                console.log("🔊 5. Remote audio track received");
                audioEl.srcObject = e.streams[0];
            };

            // Add local track
            this.pc.addTrack(this.stream.getTracks()[0]);

            // 5. Data Channel
            console.log("💬 6. Creating Data Channel...");
            this.dc = this.pc.createDataChannel('oai-events');
            this.dc.onopen = () => this.onDataChannelOpen();
            this.dc.onmessage = (e) => this.onDataChannelMessage(JSON.parse(e.data));

            // 6. SDP Handshake (Direct to OpenAI with Token)
            console.log("🤝 7. Starting SDP Handshake with OpenAI...");
            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);

            // Important: gpt-4o-realtime-preview often requires specific suffix for WebRTC in some docs
            const model = data.model || "gpt-4o-realtime-preview";
            const baseUrl = `https://api.openai.com/v1/realtime?model=${model}`;

            const realtimeRes = await fetch(baseUrl, {
                method: 'POST',
                body: offer.sdp,
                headers: {
                    Authorization: `Bearer ${EPHEMERAL_KEY}`,
                    "Content-Type": "application/sdp"
                }
            });

            if (!realtimeRes.ok) {
                const errText = await realtimeRes.text();
                throw new Error(`OpenAI Handshake Error: ${realtimeRes.status} ${errText}`);
            }

            console.log("✅ 8. SDP Answer received from OpenAI");
            const answerSdp = await realtimeRes.text();
            await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

            this.updateState('listening');

        } catch (err) {
            console.error("🔥 OpenAI Realtime Boot Error:", err);
            this.updateState('error');
            if (this.statusLabel) {
                this.statusLabel.innerText = "ERROR: " + (err.message || "Boot Failed");
            }
        }
    }

    onDataChannelOpen() {
        console.log('✅ OpenAI Realtime Data Channel Open. Johnny is live.');

        // Request an initial response to force Johnny to introduce himself
        this.dc.send(JSON.stringify({
            type: "response.create",
            response: {
                instructions: "Introduce yourself briefly as Johnny from JustAskJohnny.com. Be sharp and slightly sarcastic. Do not use any generic assistant language."
            }
        }));
    }

    onDataChannelMessage(msg) {
        console.log("📥 Johnny -> UI:", msg.type, msg);

        switch (msg.type) {
            case 'session.created':
                console.log("🛠️ Johnny -> UI: Session Created", msg.session);
                break;

            case 'session.updated':
                console.log("✅ Johnny -> UI: Persona applied successfully!", msg.session);
                break;

            case 'input_audio_buffer.speech_started':
                this.updateState('listening');
                this.activeUserBubble = this.createMessageBubble('user');
                this.activeAssistantBubble = null; // Close assistant bubble if any
                break;

            case 'conversation.item.input_audio_transcription.delta':
            case 'conversation.item.input_audio_transcription.completed':
                if (this.activeUserBubble) {
                    const text = msg.delta || msg.transcript || "";
                    if (msg.delta) {
                        this.activeUserBubble.innerText += text;
                    } else if (msg.transcript) {
                        this.activeUserBubble.innerText = msg.transcript;
                    }
                    this.scrollToBottom();
                }
                break;

            case 'response.audio_transcript.delta':
            case 'response.output_audio_transcript.delta':
                this.updateState('speaking');
                if (!this.activeAssistantBubble) {
                    this.activeAssistantBubble = this.createMessageBubble('assistant');
                    this.activeUserBubble = null;
                }
                if (msg.delta) {
                    this.activeAssistantBubble.innerText += msg.delta;
                    this.scrollToBottom();
                    this.updateSphereScale(this.activeAssistantBubble.innerText.length);
                }
                break;

            case 'response.audio_transcript.done':
            case 'response.output_audio_transcript.done':
                this.activeAssistantBubble = null;
                break;

            case 'response.done':
                this.updateState('listening');
                break;

            case 'response.function_call_arguments.done':
                this.handleFunctionCall(msg);
                break;
        }
    }

    async handleFunctionCall(msg) {
        if (msg.name === 'web_search') {
            const args = JSON.parse(msg.arguments || "{}");
            const query = args.query || "";

            console.log(`🔍 Johnny calling web_search for: "${query}"`);

            // Optional: User feedback in chat
            const searchBubble = this.createMessageBubble('assistant');
            searchBubble.innerHTML = `<i>Searching for "${query}"...</i>`;
            this.scrollToBottom();

            try {
                // Call our new server endpoint
                const scriptTag = document.querySelector('script[src*="voice-widget.js"]');
                const backendUrl = scriptTag ? new URL(scriptTag.src).origin : window.location.origin;

                const res = await fetch(`${backendUrl}/api/voice-search`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query })
                });

                const data = await res.json();
                const result = data.result || "I couldn't find any information on that right now.";

                // 1. Submit the tool output
                this.dc.send(JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                        type: "function_call_output",
                        call_id: msg.call_id,
                        output: result
                    }
                }));

                // 2. Request a new response from Johnny to speak the answer
                this.dc.send(JSON.stringify({ type: "response.create" }));

                // Clean up the "Searching..." bubble by adding the result or removing it
                // For now, let's just let it be replaced by the actual spoken transcript delta
                searchBubble.remove();

            } catch (err) {
                console.error("❌ web_search execution failed:", err);
                this.dc.send(JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                        type: "function_call_output",
                        call_id: msg.call_id,
                        output: "I'm sorry, I'm having trouble connecting to my search engine right now."
                    }
                }));
                this.dc.send(JSON.stringify({ type: "response.create" }));
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
            const threshold = 100; // px from bottom to trigger auto-scroll
            const isAtBottom = this.historyViewport.scrollHeight - this.historyViewport.scrollTop - this.historyViewport.clientHeight <= threshold;

            if (isAtBottom) {
                this.historyViewport.scrollTop = this.historyViewport.scrollHeight;
            }
        }
    }

    updateSphereScale(charCount) {
        const minScale = 0.5;
        const maxChars = 800;
        const scale = Math.max(minScale, 1 - (charCount / maxChars) * (1 - minScale));
        if (this.card) {
            this.card.style.setProperty('--sphere-scale', scale);
        }
    }

    renderPersistentText(text) {
        // Obsolete but kept for safety if called elsewhere temporarily
        console.log("Legacy renderPersistentText called with:", text);
    }


    stopSession() {
        if (this.stream) this.stream.getTracks().forEach(t => t.stop());
        if (this.pc) this.pc.close();
        this.updateState('idle');
    }
}

// Auto-init for Squarespace
function initJohnny() {
    if (window.johnnyInitialized) return;
    window.johnnyInitialized = true;
    new VoiceWidget();
}

// Brute force initialization
initJohnny();
setTimeout(initJohnny, 1000);
setTimeout(initJohnny, 3000);
window.addEventListener('load', initJohnny);
document.addEventListener('DOMContentLoaded', initJohnny);
