(function () {
    const CONSENT_KEY = 'jj_legal_consent_v6_storyforge';
    const CONSENT_MAX_AGE_DAYS = 1; // Updated to 1 day as requested

    // Inject CSS
    const style = document.createElement('style');
    style.textContent = `
    :root{
      --overlay: rgba(0,0,0,.75);
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
      z-index:2147483647 !important;
      isolation:isolate;
      font-family:system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
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
      margin:0 auto;
      padding:1.25rem 1rem;
      border-radius:12px;
      box-shadow:0 20px 60px rgba(0,0,0,.25);
      overflow-y:auto;
    }

    #legalModal h2{
      margin:.25rem 0 .5rem;
      font-size:1.4rem;
      text-align:center;
    }

    #legalModal p{
      margin:.5rem 0;
      line-height:1.5;
    }

    #legalModal .muted{
      color:var(--muted);
      font-size:.9rem;
    }

    #legalModal .actions{
      display:flex;
      justify-content:flex-end;
      margin-top:1rem;
    }

    #legalModal .actions button{
      padding:.55rem 1rem;
      border:none;
      border-radius:8px;
      cursor:pointer;
      font-weight:600;
    }

    #legalModal .btn-primary{
      background:var(--brand);
      color:#fff;
    }

    #legalModal .btn-primary:disabled{
      opacity:.55;
      cursor:not-allowed;
    }

    #legalModal :focus{
      outline:2px solid var(--brand-2);
      outline-offset:2px;
    }

    @media (max-height: 500px){
      #legalModal{
        align-items:flex-start;
      }
      #legalModal .box{
        max-height:100vh;
      }
    }
  `;
    document.head.appendChild(style);

    // Inject HTML
    const modalHtml = `
  <div id="legalModal" role="dialog" aria-modal="true" aria-labelledby="legalTitle" aria-describedby="legalDesc">
    <div class="box" tabindex="-1">
      <h2 id="legalTitle">Before You Continue</h2>

      <p id="legalDesc" class="muted">
        Please read and accept our terms to use JustAskJohnny, StoryForge, and related apps.
      </p>

      <p>
        These tools use AI and may produce errors or unexpected content. Everything here is for
        <strong>entertainment only</strong>, not professional advice.
      </p>

      <p>
        <strong>StoryForge Notice:</strong> StoryForge is unpredictable. Plots, characters, and tone can shift suddenly or feel strange.
        If anything makes you uncomfortable, stop immediately and either click <strong>“New Story”</strong> or refresh the page.
      </p>

      <p>
        <strong>Your Control:</strong> If the AI feels wrong, overwhelming, offensive, or “off the rails,” you must stop, reset, and restart.
        Do not continue if you are uncomfortable.
      </p>

      <p>
        <strong>Mood Advisory:</strong> If you feel depressed, distressed, or emotionally unstable, do not use this service.
        AI content can sometimes mirror or amplify negative feelings. Only use the app when you feel grounded and well.
      </p>

      <p>
        You are responsible for how you use all outputs. To the fullest extent allowed by law, JustAskJohnny and its affiliates
        are not liable for any loss, injury, or damages resulting from use of these tools.
      </p>

      <p>
        By continuing, you confirm you are at least <strong>30 years old</strong>. This age requirement is based on research showing that full adult
        cognitive and emotional maturity generally stabilizes around age 30. AI content can be intense, and this threshold helps ensure
        users can manage it responsibly.
      </p>

      <p class="muted">
        By continuing, you accept our
        <a href="/terms" target="_blank" rel="noopener">Terms of Use</a> and
        <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>.
        If you are under 30, please do not use this service.
      </p>

      <div class="actions">
        <button type="button" class="btn-primary" id="acceptBtn">Accept &amp; Continue</button>
      </div>
    </div>
  </div>`;

    const container = document.createElement('div');
    container.innerHTML = modalHtml;
    document.body.appendChild(container.firstElementChild);

    const modal = document.getElementById('legalModal');
    const box = modal.querySelector('.box');
    const acceptBtn = document.getElementById('acceptBtn');

    function daysBetween(a, b) {
        return Math.floor((b - a) / (1000 * 60 * 60 * 24));
    }

    function storedConsentValid() {
        try {
            const raw = localStorage.getItem(CONSENT_KEY);
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (!data || !data.ts) return false;
            return daysBetween(new Date(data.ts), new Date()) < CONSENT_MAX_AGE_DAYS;
        } catch (e) {
            return false;
        }
    }

    function showModal() {
        modal.classList.add('jj-show');
        document.documentElement.style.overflow = 'hidden';
        setTimeout(() => box.focus(), 0);
    }

    function hideModal() {
        modal.classList.remove('jj-show');
        document.documentElement.style.overflow = '';
    }

    function accept() {
        const payload = {
            ts: new Date().toISOString(),
            ua: navigator.userAgent,
            v: 'v6-storyforge'
        };
        try {
            localStorage.setItem(CONSENT_KEY, JSON.stringify(payload));
        } catch (e) { }
        hideModal();
        document.dispatchEvent(new CustomEvent('jj:legalAccepted', { detail: payload }));
    }

    acceptBtn.addEventListener('click', accept);

    modal.addEventListener('keydown', e => {
        if (e.key === 'Tab') {
            const focusables = modal.querySelectorAll('a,button');
            const list = Array.from(focusables).filter(el => !el.disabled && el.offsetParent !== null);
            if (!list.length) return;
            const first = list[0], last = list[list.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                last.focus();
                e.preventDefault();
            } else if (!e.shiftKey && document.activeElement === last) {
                first.focus();
                e.preventDefault();
            }
        }
    });

    if (!storedConsentValid()) {
        if (document.readyState === 'loading') {
            window.addEventListener('DOMContentLoaded', showModal);
        } else {
            showModal();
        }
    }
})();
