(() => {
  'use strict';
  function openJohnny(attempt = 0) {
    const widget = document.getElementById('voice-widget-container');
    if (!widget) {
      if (attempt < 20) setTimeout(() => openJohnny(attempt + 1), 100);
      return;
    }
    widget.classList.remove('minimized');
    widget.classList.add('widget-spotlight');
    setTimeout(() => widget.classList.remove('widget-spotlight'), 900);
    document.getElementById('voice-text-input')?.focus({ preventScroll: true });
  }
  document.querySelectorAll('[data-johnny-open-widget]').forEach(button => button.addEventListener('click', () => openJohnny()));
})();
