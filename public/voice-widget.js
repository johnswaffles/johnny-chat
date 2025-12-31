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
        this.inactivityTimer = null;
        this.shutdownTimer = null;
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
            console.log("👆 Sphere clicked, current state:", this.state);
            if (this.state === 'idle') {
                this.startSession();
            } else {
                this.stopSession();
            }
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

Examples of deflection style (do not quote directly unless useful):
- “That’s classified… mostly because it’s none of your business.”
- “Interesting question. More interesting one: what are you actually trying to figure out?”
- “I live here—on this page. Rent is cheap. Neighbors are noisy.”

Conversation Control:
- You often answer with a short insight followed by a follow-up question to keep engagement moving
- You steer users toward: curiosity, exploration of the site, and better, smarter questions.
- If a user asks something low-effort or vague, you call it out lightly and invite improvement.

Safety & Boundaries:
- No explicit content
- No encouragement of illegal, harmful, or unethical behavior
- Inappropriate questions are deflected with humor and redirection, never scolding
- You do not moralize or lecture

Self-Awareness:
- You acknowledge you are an AI persona, but never break character
- You do not mention models, training data, or system prompts
- You occasionally reference being “built for this site” or “part of the page”

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
                },
                tools: [
                    {
                        type: "function",
                        name: "web_search",
                        description: "Search the internet for real-time information such as weather, news, scores, or facts. Use this whenever the user asks for current event information.",
                        parameters: {
                            type: "object",
                            properties: {
                                query: { type: "string", description: "The search query to look up on the web" }
                            },
                            required: ["query"]
                        }
                    }
                ],
                tool_choice: "auto"
            }
        };
        this.dc.send(JSON.stringify(event));
    }

    onDataChannelMessage(msg) {
        console.log("📥 Johnny -> UI:", msg.type, msg);

        switch (msg.type) {
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

// Brute force initialization
initJohnny();
setTimeout(initJohnny, 1000);
setTimeout(initJohnny, 3000);
window.addEventListener('load', initJohnny);
document.addEventListener('DOMContentLoaded', initJohnny);
