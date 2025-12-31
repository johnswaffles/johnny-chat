(function () {
  const CONSENT_KEY = 'jj_legal_consent_v6_storyforge';
  const CONSENT_MAX_AGE_DAYS = 1;

  console.log("🚀 Legal Modal: Script Loaded.");

  // Inject CSS
  const style = document.createElement('style');
  style.textContent = `
    :root{
      --overlay: rgba(0,0,0,.85);
      --card:#fff;
      --text:#111;
      --muted:#555;
      --brand:#0a66c2;
      --brand-2:#084f96;
    }

    #legalModal{
      display:none;
      position:fixed !important;
      inset:0 !important;
      background:var(--overlay);
      z-index:9999999999 !important;
      isolation:isolate;
      font-family:system-ui, -apple-system, sans-serif;
      padding:1rem;
      box-sizing:border-box;
      overflow:auto;
      align-items:center;
      justify-content:center;
    }

    #legalModal.jj-show{
      display:flex !important;
    }

    #legalModal .box{
      background:var(--card);
      color:var(--text);
      width:100%;
      max-width:640px;
      max-height:90vh;
      margin:auto;
      padding:2rem;
      border-radius:16px;
      box-shadow:0 20px 60px rgba(0,0,0,.5);
      overflow-y:auto;
      position:relative;
    }

    #legalModal h2{ margin:0 0 1rem; font-size:1.8rem; text-align:center; }
    #legalModal p{ margin:.8rem 0; line-height:1.6; font-size:1rem; }
    #legalModal .muted{ color:var(--muted); font-size:.9rem; }
    #legalModal .actions{ display:flex; justify-content:center; margin-top:2rem; }
    #legalModal .btn-primary{
      padding:.8rem 2rem;
      background:var(--brand);
      color:#fff;
      border:none;
      border-radius:8px;
      cursor:pointer;
      font-weight:700;
      font-size:1.1rem;
    }
    #legalModal .btn-primary:hover{ background:var(--brand-2); }
  `;
  document.head.appendChild(style);

  const modalHtml = `
  <div id="legalModal" role="dialog" aria-modal="true">
    <div class="box">
      <h2>Before You Continue</h2>
      <p class="muted">Please read and accept our terms to use JustAskJohnny, StoryForge, and related apps.</p>
      <p>These tools use AI and may produce errors or unexpected content. Everything here is for <strong>entertainment only</strong>, not professional advice.</p>
      <p><strong>StoryForge Notice:</strong> Plots, characters, and tone can shift suddenly. If anything makes you uncomfortable, stop immediately or refresh.</p>
      <p><strong>Your Control:</strong> If the AI feels "off the rails," you must stop and reset. Do not continue if you are uncomfortable.</p>
      <p><strong>Mood Advisory:</strong> If you feel distressed or emotionally unstable, do not use this service.</p>
      <p><strong>Age Requirement:</strong> By continuing, you confirm you are at least <strong>30 years old</strong>. AI content can be intense, and this threshold helps ensure responsible management.</p>
      <p class="muted">By continuing, you accept our <a href="/terms" target="_blank">Terms</a> and <a href="/privacy" target="_blank">Privacy</a>.</p>
      <div class="actions">
        <button type="button" class="btn-primary" id="acceptBtn">Accept & Continue</button>
      </div>
    </div>
  </div>`;

  function storedConsentValid() {
    try {
      const raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      const daysSince = Math.floor((new Date() - new Date(data.ts)) / (1000 * 60 * 60 * 24));
      return daysSince < CONSENT_MAX_AGE_DAYS;
    } catch (e) { return false; }
  }

  function initModal() {
    if (storedConsentValid()) {
      console.log("✅ Legal Modal: Valid consent exists.");
      return;
    }

    console.log("☝️ Legal Modal: Showing modal.");
    const div = document.createElement('div');
    div.innerHTML = modalHtml;
    const modal = div.querySelector('#legalModal');
    document.body.appendChild(modal);

    modal.classList.add('jj-show');
    document.documentElement.style.overflow = 'hidden';

    modal.querySelector('#acceptBtn').onclick = () => {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({ ts: new Date().toISOString() }));
      modal.classList.remove('jj-show');
      document.documentElement.style.overflow = '';
      console.log("✅ Legal Modal: Consent Accepted.");
    };
  }

  if (document.readyState === 'loading') {
    window.addEventListener('load', initModal);
  } else {
    initModal();
  }
})();
