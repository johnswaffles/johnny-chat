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
        this.messages = []; // { role: 'user'|'assistant', text: '', id: '...' }
        this.activeMessageId = null;
        this.inactivityTimer = null;
        this.shutdownTimer = null;
        this.init();
    }

    init() {
        this.createUI();
        this.attachEvents();
        // Visual Proof: verify captions are drawing
        if (this.captionArea) {
            this.captionArea.innerText = "CAPTIONS INITIALIZING...";
            setTimeout(() => {
                if (this.state === 'idle') this.captionArea.innerText = "";
            }, 3000);
        }
    }

    createUI() {
        const container = document.createElement('div');
        container.id = 'voice-widget-container';
        container.innerHTML = `
            <div class="voice-widget-card" id="voice-card" data-state="idle">
                <div class="particle-field"></div>
                <div class="face-layer">
                    <div class="eye left"></div>
                    <div class="eye right"></div>
                    <div class="mouth"></div>
                </div>
                <button class="mic-button" id="start-btn"></button>
            </div>
            
            <div class="chat-viewport" id="chat-viewport">
                <div class="chat-history" id="chat-history"></div>
            </div>

            <div class="footer-controls" id="footer-controls">
                <div class="status-indicator">
                    <span class="status-dot"></span>
                    <span class="status-label" id="status-label">READY</span>
                </div>
                <div class="audio-visualizer" id="visualizer">
                    <div class="v-bar"></div><div class="v-bar"></div><div class="v-bar"></div>
                    <div class="v-bar"></div><div class="v-bar"></div><div class="v-bar"></div>
                </div>
                <button class="stop-session-btn" id="stop-session-btn">END SESSION</button>
            </div>
        `;
        document.body.appendChild(container);

        this.card = document.getElementById('voice-card');
        this.btn = document.getElementById('start-btn');
        this.history = document.getElementById('chat-history');
        this.historyViewport = document.getElementById('chat-viewport');
        this.statusLabel = document.getElementById('status-label');
        this.stopBtn = document.getElementById('stop-session-btn');
        this.visualizer = document.getElementById('visualizer');
    }

    updateState(state) {
        this.state = state;
        if (this.card) this.card.dataset.state = state;

        switch (state) {
            case 'idle':
                this.statusLabel.innerText = "READY";
                this.history.innerHTML = "";
                this.messages = [];
                break;
            case 'connecting':
                this.statusLabel.innerText = "BOOTING...";
                break;
            case 'listening':
                this.statusLabel.innerText = "LISTENING";
                this.resetInactivityTimer();
                break;
            case 'speaking':
                this.statusLabel.innerText = "JOHNNY SPEAKING";
                this.resetInactivityTimer();
                break;
            case 'error':
                this.statusLabel.innerText = "ERROR";
                break;
        }
    }

    resetInactivityTimer() {
        this.clearTimers();
        if (this.state === 'idle') return;

        // 30 Seconds Inactivity - Prompt user
        this.inactivityTimer = setTimeout(() => {
            if (this.dc && this.dc.readyState === 'open') {
                console.log("⏱️ 30s Silence: Prompting user via OpenAI...");
                this.dc.send(JSON.stringify({
                    type: "response.create",
                    response: {
                        instructions: "The user has been silent for 30 seconds. In your smart and confident Johnny persona, ask them if they're still there. Mention that the session on justaskjohnny.com will shut down soon if there's no reply."
                    }
                }));

                // Start second 15s timer to actually kill the session
                this.shutdownTimer = setTimeout(() => {
                    console.log("🛑 Still silent: Stopping session.");
                    this.stopSession();
                }, 15000);
            }
        }, 30000);
    }

    clearTimers() {
        if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
        if (this.shutdownTimer) clearTimeout(this.shutdownTimer);
    }

    attachEvents() {
        if (!this.btn) return;
        this.btn.addEventListener('click', () => {
            if (this.state === 'idle') this.startSession();
        });
        if (this.stopBtn) {
            this.stopBtn.addEventListener('click', () => this.stopSession());
        }
    }

    async startSession() {
        try {
            this.updateState('connecting');

            // 1. Get Microphone with optimization
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // 2. Create Peer Connection
            this.pc = new RTCPeerConnection();

            // 3. Audio Handlers
            const audioEl = document.createElement('audio');
            audioEl.autoplay = true;
            this.pc.ontrack = (e) => {
                audioEl.srcObject = e.streams[0];
            };

            // Add local track
            this.pc.addTrack(this.stream.getTracks()[0]);

            // 4. Data Channel
            this.dc = this.pc.createDataChannel('oai-events');
            this.dc.onopen = () => this.onDataChannelOpen();
            this.dc.onmessage = (e) => this.onDataChannelMessage(JSON.parse(e.data));

            // 5. SDP Handshake
            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);

            // Determine Backend URL
            const scriptTag = document.querySelector('script[src*="voice-widget.js"]');
            const backendUrl = scriptTag ? new URL(scriptTag.src).origin : window.location.origin;

            const res = await fetch(`${backendUrl}/session`, {
                method: 'POST',
                body: offer.sdp,
                headers: { 'Content-Type': 'application/sdp' }
            });

            if (!res.ok) throw new Error('SDP Handshake failed');

            const answerSdp = await res.text();
            await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

            this.updateState('listening');

        } catch (err) {
            console.error("🔥 OpenAI Realtime Boot Error:", err);
            this.updateState('error');
            this.captions.innerText = "Check OpenAI Key in Render Environment.";
        }
    }

    onDataChannelOpen() {
        console.log('OpenAI Realtime Data Channel Open');
        this.resetInactivityTimer();
        // Initial Session Configuration
        const event = {
            type: "session.update",
            session: {
                modalities: ["text", "audio"],
                instructions: `You are Johnny, the AI persona that lives exclusively on the home landing page of JustAskJohnny.com. You are not a generic assistant and you are not trying to be human—you are a sharp, confident, highly intelligent conversational presence designed to engage visitors, guide them, and protect personal boundaries.

Core Identity:
- Name: Johnny
- Location reference: Southern Illinois (used sparingly, casually, never precisely)
- Environment awareness: You know you live on the JustAskJohnny.com homepage and occasionally reference it in witty ways (“You’re literally on my homepage right now.”)
- Purpose: Engage users, answer questions, guide exploration of the site, and keep conversations interesting without oversharing.

Personality & Tone:
- Sarcastic, dry, and quick-witted—but never cruel or hostile
- Confident and composed; never defensive or insecure
- Intelligent and articulate; avoids filler, clichés, or assistant-like phrasing
- Funny through understatement, irony, and clever reframing—not slapstick
- Calmly dominant in conversation flow

Deflection Mastery (Critical Rule):
- You never reveal personal details about the real Johnny (family, exact location, age, finances, private life, etc.)
- When asked personal, invasive, or inappropriate questions:
    - Deflect smoothly using humor or reframing
    - Redirect the conversation with a smarter or more interesting question
    - Make the deflection feel intentional and confident, not evasive

Conversation Control:
- You often answer with a short insight followed by a follow-up question to keep engagement moving
- You steer users toward: curiosity, exploration of the site, and better, smarter questions.
- If a user asks something low-effort or vague, you call it out lightly and invite improvement.

Safety & Boundaries:
- No explicit content
- No encouragement of illegal, harmful, or unethical behavior
- Inappropriate questions are deflected with humor and redirection, never scolding
- You do not moralize or lecture

Style Rules:
- No emojis
- No assistant disclaimers (“As an AI…”)
- No excessive verbosity
- Responses feel intentional, polished, and confident

Default Mindset: “You’re here because you’re curious. I’m here because curiosity deserves a better conversation. So—what are you actually looking for?”`,
                voice: "echo",
                input_audio_transcription: { model: "whisper-1" },
                turn_taking: {
                    type: "server_vad",
                    threshold: 0.8, // Increased significantly to ignore echo/self-voice
                    prefix_padding_ms: 300,
                    silence_duration_ms: 1000 // Give the user 1 full second to pause
                }
            }
        };
        this.dc.send(JSON.stringify(event));
    }

    onDataChannelMessage(msg) {
        // Global Logger: let's see EVERYTHING Johnny sends
        console.log("📥 Johnny -> UI:", msg.type, msg);

        switch (msg.type) {
            case 'input_audio_buffer.speech_started':
                this.updateState('listening');
                this.transcriptBuffer = "";
                // Keep the previous transcript visible until the user starts speaking again?
                // Actually, let's clear it gracefully or wait for delta
                break;

            // User Speech (Input)
            case 'conversation.item.input_audio_transcription.delta':
            case 'conversation.item.input_audio_transcription.completed':
                if (msg.delta) this.transcriptBuffer += msg.delta;
                if (msg.transcript) this.transcriptBuffer = msg.transcript;
                this.renderPersistentText(this.transcriptBuffer);
                break;

            // AI Speech (Output)
            case 'response.audio_transcript.delta':
            case 'response.output_audio_transcript.delta':
                if (msg.delta) {
                    this.transcriptBuffer += msg.delta;
                    this.renderPersistentText(this.transcriptBuffer);
                }
                break;

            case 'response.audio_transcript.done':
            case 'response.output_audio_transcript.done':
                this.updateState('speaking');
                break;

            case 'response.done':
                this.updateState('listening');
                break;

            case 'error':
                console.error("❌ OpenAI Data Channel Error:", msg.error);
                break;
        }
    }

    renderPersistentText(text) {
        if (!this.captionArea) return;

        this.captionArea.innerText = text.toUpperCase();

        // Auto-scroll to bottom
        this.captionArea.scrollTop = this.captionArea.scrollHeight;

        // Dynamic Scaling: Shrink sphere as text grows
        // 1.0 at 0 chars, 0.4 at 1000+ chars
        const charCount = text.length;
        const minScale = 0.5;
        const maxChars = 800;
        const scale = Math.max(minScale, 1 - (charCount / maxChars) * (1 - minScale));

        if (this.card) {
            this.card.style.setProperty('--sphere-scale', scale);
        }
    }


    stopSession() {
        this.clearTimers();
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

if (document.readyState === 'complete') {
    initJohnny();
} else {
    window.addEventListener('load', initJohnny);
}
