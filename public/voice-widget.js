/**
 * VOICE WIDGET LOGIC (ElevenLabs Conversational AI)
 */

class VoiceWidget {
    constructor() {
        this.conversation = null;
        this.state = 'idle';
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
                this.captions.innerText = "INITIALIZING ELEVENLABS...";
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
                this.captions.innerText = "CONNECTION ERROR // RETRY";
                break;
        }
    }

    resetInactivityTimer() {
        this.clearTimers();
        if (this.state === 'idle') return;

        // 30 Seconds Inactivity - Prompt user
        this.inactivityTimer = setTimeout(() => {
            if (this.conversation) {
                console.log("⏱️ 30s Silence: Prompting user via ElevenLabs...");
                // Note: We can send a text message to trigger a response if the SDK supports it,
                // or just notify the UI. For ElevenLabs, we'll notify the UI first.
                this.captions.innerText = "STILL THERE?";

                // Final Shutdown after 15 more seconds of silence
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

            // 1. Get Signed URL from Backend
            const scriptTag = document.querySelector('script[src*="voice-widget.js"]');
            const backendUrl = scriptTag ? new URL(scriptTag.src).origin : window.location.origin;

            const res = await fetch(`${backendUrl}/elevenlabs-token`);
            if (!res.ok) throw new Error('Failed to get ElevenLabs token');
            const { signed_url } = await res.json();

            // 2. Initialize ElevenLabs Conversation
            if (!window.ElevenLabsClient) throw new Error('ElevenLabs SDK not loaded');

            this.conversation = await window.ElevenLabsClient.Conversation.startSession({
                signedUrl: signed_url,
                onConnect: () => {
                    console.log("✅ ElevenLabs Connected");
                    this.updateState('listening');
                },
                onDisconnect: () => {
                    console.log("❌ ElevenLabs Disconnected");
                    this.updateState('idle');
                },
                onError: (err) => {
                    console.error("ElevenLabs SDK Error:", err);
                    this.updateState('error');
                },
                onMessage: (message) => {
                    this.handleMessage(message);
                },
                onModeChange: (mode) => {
                    // mode.mode can be 'speaking' or 'listening'
                    this.updateState(mode.mode);
                }
            });

        } catch (err) {
            console.error("🔥 ElevenLabs Boot Error:", err);
            this.updateState('error');
            this.captions.innerText = `ERROR: ${err.message.slice(0, 50)}... Check Console.`;
        }
    }

    handleMessage(message) {
        // Handle transcripts for captions
        if (message.type === 'transcript') {
            const text = message.transcript;
            this.captions.innerText = text.toUpperCase();
            this.resetInactivityTimer();
        }
    }

    async stopSession() {
        this.clearTimers();
        if (this.conversation) {
            await this.conversation.endSession();
            this.conversation = null;
        }
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
