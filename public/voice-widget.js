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
        this.inactivityTimer = null;
        this.shutdownTimer = null;
        this.init();
    }

    init() {
        this.createUI();
        this.attachEvents();
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
            <div class="captions-area" id="captions">READY TO SYNC // CLICK THE MIDDLE</div>
        `;
        document.body.appendChild(container);

        this.card = document.getElementById('voice-card');
        this.btn = document.getElementById('start-btn');
        this.captions = document.getElementById('captions');
    }

    updateState(state) {
        this.state = state;
        if (this.card) this.card.dataset.state = state;

        switch (state) {
            case 'idle':
                this.captions.innerText = "READY // CLICK THE MIDDLE";
                break;
            case 'connecting':
                this.captions.innerText = "INITIALIZING CORE...";
                break;
            case 'listening':
                this.captions.innerText = "LISTENING...";
                this.resetInactivityTimer();
                break;
            case 'speaking':
                this.captions.innerText = "JOHNNY SPEAKING...";
                this.resetInactivityTimer();
                break;
            case 'error':
                this.captions.innerText = "SYSTEM ERROR // CHECK CONSOLE";
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
            if (this.state === 'idle') {
                this.startSession();
            } else {
                this.stopSession();
            }
        });
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
                instructions: "You are Johnny, a confident and smart helpful chatbot that lives on justaskjohnny.com. Your responses are concise and tailored for a voice conversation. Use natural pacing.",
                voice: "echo",
                input_audio_transcription: { model: "whisper-1" },
                turn_taking: {
                    type: "server_vad",
                    threshold: 0.5, // Standard threshold
                    prefix_padding_ms: 300, // More breathing room
                    silence_duration_ms: 600 // Wait longer before interrupting
                }
            }
        };
        this.dc.send(JSON.stringify(event));
    }

    onDataChannelMessage(msg) {
        switch (msg.type) {
            case 'input_audio_buffer.speech_started':
                this.updateState('listening');
                this.transcriptBuffer = ""; // Reset on new speech
                break;
            case 'response.audio_transcript.delta':
                this.transcriptBuffer += msg.delta;
                this.captions.innerText = this.transcriptBuffer.toUpperCase();
                break;
            case 'response.audio_transcript.done':
                this.updateState('speaking');
                break;
            case 'response.done':
                this.updateState('listening');
                // Don't clear buffer here so user can read the final sentence
                break;
        }
    }

    stopSession() {
        this.clearTimers();
        if (this.stream) this.stream.getTracks().forEach(t => t.stop());
        if (this.pc) this.pc.close();
        this.updateState('idle');
        this.captions.innerText = "SYNC STOPPED // CLICK THE MIDDLE";
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
