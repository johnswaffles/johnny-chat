/**
 * VOICE WIDGET LOGIC (OpenAI Realtime WebRTC)
 */

class VoiceWidget {
    constructor() {
        this.pc = null;
        this.dc = null;
        this.stream = null;
        this.state = 'idle'; // idle, connecting, listening, speaking
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
                <div class="status-indicator">
                    <div class="status-dot"></div>
                    <span id="status-text">Disconnected</span>
                </div>
                
                <button class="mic-button" id="start-btn">
                    <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                </button>

                <div class="waveform">
                    <div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div>
                </div>

                <div class="captions-area" id="captions">Ready to talk? Click the mic.</div>
            </div>
        `;
        document.body.appendChild(container);

        this.card = document.getElementById('voice-card');
        this.btn = document.getElementById('start-btn');
        this.statusText = document.getElementById('status-text');
        this.captions = document.getElementById('captions');
    }

    attachEvents() {
        this.btn.addEventListener('click', () => {
            if (this.state === 'idle') {
                this.startSession();
            } else {
                this.stopSession();
            }
        });
    }

    updateState(state, text) {
        this.state = state;
        this.card.dataset.state = state;
        if (text) this.statusText.innerText = text;

        switch (state) {
            case 'idle':
                this.statusText.style.color = '#cbd5e1';
                break;
            case 'connecting':
                this.statusText.style.color = '#f59e0b';
                break;
            case 'listening':
                this.statusText.style.color = '#10b981';
                break;
            case 'speaking':
                this.statusText.style.color = '#3b82f6';
                break;
        }
    }

    async startSession() {
        try {
            this.updateState('connecting', 'Connecting...');

            // 1. Get Microphone
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

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

            // Determine Backend URL (Either from script tag or fallback)
            const scriptTag = document.querySelector('script[src*="voice-widget.js"]');
            const backendUrl = scriptTag ? new URL(scriptTag.src).origin : window.location.origin;

            console.log("🔗 Connecting to backend:", backendUrl);

            const res = await fetch(`${backendUrl}/session`, {
                method: 'POST',
                body: offer.sdp,
                headers: { 'Content-Type': 'application/sdp' }
            });

            if (!res.ok) throw new Error('SDP Handshake failed');

            const answerSdp = await res.text();
            await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

            this.updateState('listening', 'Connected');
            this.captions.innerText = "Listening...";

        } catch (err) {
            console.error(err);
            this.updateState('idle', 'Error');
            this.captions.innerText = "Microphone access or connection failed.";
        }
    }

    onDataChannelOpen() {
        console.log('OpenAI Realtime Data Channel Open');
        // Initial Session Configuration
        const event = {
            type: "session.update",
            session: {
                modalities: ["text", "audio"],
                instructions: "You are Johnny, a friendly and helpful assistant. Your responses are concise and tailored for a voice conversation. Use natural pacing.",
                voice: "ash", // Ash, Ballad, Coral, Echo, Sage, Shimmer
                input_audio_transcription: { model: "whisper-1" },
                turn_taking: { type: "server_vad" }
            }
        };
        this.dc.send(JSON.stringify(event));
    }

    onDataChannelMessage(msg) {
        // console.log('OAI Msg:', msg.type, msg);

        switch (msg.type) {
            case 'input_audio_buffer.speech_started':
                this.updateState('listening', 'Listening');
                break;
            case 'response.audio_transcript.delta':
                this.captions.innerText = msg.delta;
                break;
            case 'response.audio_transcript.done':
                this.updateState('speaking', 'Speaking');
                break;
            case 'response.done':
                this.updateState('listening', 'Listening');
                break;
        }
    }

    stopSession() {
        if (this.stream) this.stream.getTracks().forEach(t => t.stop());
        if (this.pc) this.pc.close();
        this.updateState('idle', 'Disconnected');
        this.captions.innerText = "Ready to talk? Click the mic.";
    }
}

// Auto-init for Squarespace with diagnostic logs
function initJohnny() {
    console.log("🚀 Johnny Voice Widget: Initializing...");
    try {
        if (window.johnnyInitialized) return;
        window.johnnyInitialized = true;
        new VoiceWidget();
        console.log("✅ Johnny Voice Widget: Successfully injected.");
    } catch (e) {
        console.error("❌ Johnny Voice Widget Error:", e);
    }
}

if (document.readyState === 'complete') {
    initJohnny();
} else {
    window.addEventListener('load', initJohnny);
}
