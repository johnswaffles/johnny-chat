(function () {
  // Bump version to v7 to force the modal to show again for everyone
  const CONSENT_KEY = 'jj_legal_consent_v7_absolute';
  const CONSENT_MAX_AGE_DAYS = 1;

  console.log("⚖️ Johnny Legal: Initializing mandatory disclaimer...");

  // Inject High-Liability Dark Theme CSS
  const style = document.createElement('style');
  style.textContent = `
    #legalModal {
      display: none;
      position: fixed !important;
      inset: 0 !important;
      background: rgba(0, 0, 0, 0.95) !important;
      z-index: 2147483647 !important;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      padding: 20px;
      box-sizing: border-box;
      overflow-y: auto;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(10px);
    }

    #legalModal.show {
      display: flex !important;
    }

    #legalModal .content-box {
      background: #111;
      color: #eee;
      width: 100%;
      max-width: 650px;
      padding: 40px;
      border-radius: 24px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 30px 100px rgba(0, 0, 0, 1), 0 0 40px rgba(251, 191, 36, 0.1);
      position: relative;
    }

    #legalModal h2 {
      margin: 0 0 25px;
      font-size: 2rem;
      color: #fbbf24;
      text-align: center;
      font-weight: 800;
      letter-spacing: -0.5px;
    }

    #legalModal .legalese {
      max-height: 60vh;
      overflow-y: auto;
      padding-right: 15px;
      margin-bottom: 30px;
    }

    #legalModal .legalese::-webkit-scrollbar { width: 6px; }
    #legalModal .legalese::-webkit-scrollbar-track { background: transparent; }
    #legalModal .legalese::-webkit-scrollbar-thumb { background: rgba(251, 191, 36, 0.3); border-radius: 10px; }

    #legalModal p {
      margin: 0 0 1.2rem;
      line-height: 1.7;
      font-size: 1.05rem;
      color: rgba(255, 255, 255, 0.85);
    }

    #legalModal strong {
      color: #fff;
      font-weight: 700;
    }

    #legalModal .highlight-box {
      background: rgba(251, 191, 36, 0.05);
      border-left: 4px solid #fbbf24;
      padding: 15px 20px;
      margin: 20px 0;
      border-radius: 4px;
    }

    #legalModal .actions {
      display: flex;
      flex-direction: column;
      gap: 15px;
      align-items: center;
    }

    #legalModal .btn-accept {
      width: 100%;
      padding: 18px 30px;
      background: #fbbf24;
      color: #000;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      font-weight: 800;
      font-size: 1.15rem;
      transition: all 0.3s cubic-bezier(0.19, 1, 0.22, 1);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    #legalModal .btn-accept:hover {
      background: #fcd34d;
      transform: translateY(-2px);
      box-shadow: 0 10px 25px rgba(251, 191, 36, 0.3);
    }

    #legalModal .footer-note {
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.4);
      text-align: center;
    }

    @media (max-width: 600px) {
      #legalModal .content-box { padding: 30px 20px; }
      #legalModal h2 { font-size: 1.6rem; }
      #legalModal p { font-size: 0.95rem; }
    }
  `;
  document.head.appendChild(style);

  const modalHtml = `
  <div id="legalModal" role="dialog" aria-modal="true">
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
        <button type="button" class="btn-accept" id="acceptBtn">Accept & Continue</button>
        <div class="footer-note">By clicking, you acknowledge and agree to all terms above.</div>
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
    if (storedConsentValid()) {
      console.log("✅ Johnny Legal: Valid consent exists.");
      return;
    }

    const div = document.createElement('div');
    div.innerHTML = modalHtml;
    const modal = div.querySelector('#legalModal');
    document.body.appendChild(modal);

    // Fade in
    requestAnimationFrame(() => {
      modal.classList.add('show');
    });

    // Lock body scroll
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    modal.querySelector('#acceptBtn').onclick = () => {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({ ts: new Date().toISOString() }));
      modal.classList.remove('show');

      // Restore scroll
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';

      console.log("✅ Johnny Legal: Consent Accepted.");

      // Optional: Cleanup DOM
      setTimeout(() => modal.remove(), 500);
    };
  }

  // Use multiple check points to ensure it shows as early as possible
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initModal);
  } else {
    initModal();
  }

  // Backup if DOMContentLoaded missed
  window.addEventListener('load', initModal);

})();
