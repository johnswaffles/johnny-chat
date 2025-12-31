(function () {
  // Use a completely unique key and ID to avoid any caching or conflict issues
  const CONSENT_KEY = 'jj_legal_consent_v8_final';
  const CONSENT_MAX_AGE_DAYS = 1;
  const MODAL_ID = 'jj-legal-modal-absolute';

  console.log("⚖️ Johnny Legal: Initializing Liability Shield v8...");

  // Inject High-Dominance CSS
  const style = document.createElement('style');
  style.textContent = `
    #${MODAL_ID} {
      display: none !important;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: rgba(0, 0, 0, 0.98) !important;
      z-index: 2147483647 !important;
      font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
      padding: 20px !important;
      box-sizing: border-box !important;
      overflow-y: auto !important;
      align-items: center !important;
      justify-content: center !important;
      backdrop-filter: blur(15px) !important;
      color: #fff !important;
    }

    #${MODAL_ID}.jj-active {
      display: flex !important;
    }

    #${MODAL_ID} .content-box {
      background: #111 !important;
      color: #eee !important;
      width: 100% !important;
      max-width: 650px !important;
      padding: 40px !important;
      border-radius: 24px !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      box-shadow: 0 30px 100px rgba(0, 0, 0, 1) !important;
      position: relative !important;
      text-align: left !important;
    }

    #${MODAL_ID} h2 {
      margin: 0 0 25px !important;
      font-size: 2rem !important;
      color: #fbbf24 !important;
      text-align: center !important;
      font-weight: 800 !important;
      line-height: 1.2 !important;
    }

    #${MODAL_ID} .legalese {
      max-height: 55vh !important;
      overflow-y: auto !important;
      padding-right: 15px !important;
      margin-bottom: 30px !important;
    }

    #${MODAL_ID} p {
      margin: 0 0 1.2rem !important;
      line-height: 1.7 !important;
      font-size: 1.05rem !important;
      color: rgba(255, 255, 255, 0.9) !important;
    }

    #${MODAL_ID} strong {
      color: #fff !important;
      font-weight: 700 !important;
    }

    #${MODAL_ID} .highlight-box {
      background: rgba(251, 191, 36, 0.1) !important;
      border-left: 4px solid #fbbf24 !important;
      padding: 15px 20px !important;
      margin: 20px 0 !important;
      border-radius: 4px !important;
    }

    #${MODAL_ID} .btn-accept {
      width: 100% !important;
      padding: 18px 30px !important;
      background: #fbbf24 !important;
      color: #000 !important;
      border: none !important;
      border-radius: 12px !important;
      cursor: pointer !important;
      font-weight: 800 !important;
      font-size: 1.2rem !important;
      text-transform: uppercase !important;
      letter-spacing: 1px !important;
      transition: all 0.2s ease !important;
    }

    #${MODAL_ID} .btn-accept:hover {
      background: #fcd34d !important;
      transform: scale(1.02) !important;
    }

    /* Force hide the widget until accepted */
    body.jj-legal-locked #voice-widget-container {
      display: none !important;
    }
  `;
  document.head.appendChild(style);

  const modalHtml = `
  <div id="${MODAL_ID}" role="dialog" aria-modal="true">
    <div class="content-box">
      <h2>Before You Continue</h2>
      
      <div class="legalese">
        <p>Please read and accept our terms to use JustAskJohnny, StoryForge, and related apps.</p>

        <p>These tools use AI and may produce errors or unexpected content. Everything here is for <strong>entertainment only</strong>, not professional advice.</p>

        <div class="highlight-box">
          <p><strong>StoryForge Notice:</strong> StoryForge is unpredictable. Plots, characters, and tone can shift suddenly or feel strange. If anything makes you uncomfortable, stop immediately and either click “New Story” or refresh the page.</p>
        </div>

        <p><strong>Your Control:</strong> If the AI feels wrong, overwhelming, offensive, or “off the rails,” you must stop, reset, and restart. Do not continue if you are uncomfortable.</p>

        <p><strong>Mood Advisory:</strong> If you feel depressed, distressed, or emotionally unstable, do not use this service. AI content can sometimes mirror or amplify negative feelings. Only use the app when you feel grounded and well.</p>

        <p>You are responsible for how you use all outputs. To the fullest extent allowed by law, <strong>JustAskJohnny and its affiliates are not liable for any loss, injury, or damages</strong> resulting from use of these tools.</p>

        <div class="highlight-box">
          <p><strong>Age Requirement:</strong> By continuing, you confirm you are <strong>at least 30 years old</strong>. This requirement is based on research showing that full adult cognitive and emotional maturity generally stabilizes around age 30. AI content can be intense, and this threshold helps ensure users can manage it responsibly.</p>
        </div>

        <p>By continuing, you accept our Terms of Use and Privacy Policy. <strong>If you are under 30, please do not use this service.</strong></p>
      </div>

      <div class="actions">
        <button type="button" class="btn-accept" id="jjAcceptBtn">Accept & Continue</button>
      </div>
    </div>
  </div>`;

  function storedConsentValid() {
    try {
      const raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      const daysSince = (new Date() - new Date(data.ts)) / (1000 * 60 * 60 * 24);
      return daysSince < CONSENT_MAX_AGE_DAYS;
    } catch (e) {
      return false;
    }
  }

  function initModal() {
    // If we already have a modal in the DOM, don't add another
    if (document.getElementById(MODAL_ID)) return;

    if (storedConsentValid()) {
      console.log("✅ Johnny Legal: Valid consent found.");
      return;
    }

    console.log("☝️ Johnny Legal: Mandatory show.");
    const div = document.createElement('div');
    div.innerHTML = modalHtml;
    const modal = div.querySelector(`#${MODAL_ID}`);

    // Append to documentElement for ultimate priority
    document.documentElement.appendChild(modal);

    // Show it
    requestAnimationFrame(() => {
      modal.classList.add('jj-active');
      document.body.classList.add('jj-legal-locked');
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    });

    const btn = modal.querySelector('#jjAcceptBtn');
    if (btn) {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        localStorage.setItem(CONSENT_KEY, JSON.stringify({ ts: new Date().toISOString() }));
        modal.classList.remove('jj-active');
        document.body.classList.remove('jj-legal-locked');
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        console.log("✅ Johnny Legal: Agreement confirmed.");
        setTimeout(() => modal.remove(), 500);
      };
    }
  }

  // Run as early and often as possible to catch Squarespace loading
  if (document.readyState === 'complete') {
    initModal();
  } else {
    window.addEventListener('load', initModal);
    document.addEventListener('DOMContentLoaded', initModal);
  }

  // Final safety check
  setTimeout(initModal, 1000);
  setTimeout(initModal, 3000);

})();
