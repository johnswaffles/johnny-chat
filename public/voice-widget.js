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
                <div class="visor">
                    <div class="eye-strip"></div>
                </div>
                <div class="jaw"></div>
                
                <button class="mic-button" id="start-btn"></button>
            </div>

            <div class="captions-area" id="captions">BOOTING SYSTEM...</div>
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
                this.captions.innerText = "SYSTEM ONLINE // CLICK TO INITIALIZE";
                break;
            case 'connecting':
                this.captions.innerText = "INITIALIZING CORE...";
                break;
            case 'listening':
                this.captions.innerText = "LISTENING...";
                break;
            case 'speaking':
                this.captions.innerText = "TRANSMITTING...";
                break;
            case 'error':
                this.captions.innerText = "SYSTEM ERROR // CHECK CONSOLE";
                break;
        }
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

            this.updateState('listening');
            this.captions.innerText = "Listening...";

        } catch (err) {
            console.error(err);
            this.updateState('error');
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
                voice: "verse", // Switched to Verse as requested
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
                this.updateState('listening');
                break;
            case 'response.audio_transcript.delta':
                this.captions.innerText = msg.delta;
                break;
            case 'response.audio_transcript.done':
                this.updateState('speaking');
                break;
            case 'response.done':
                this.updateState('listening');
                break;
        }
    }

    stopSession() {
        if (this.stream) this.stream.getTracks().forEach(t => t.stop());
        if (this.pc) this.pc.close();
        this.updateState('idle');
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
