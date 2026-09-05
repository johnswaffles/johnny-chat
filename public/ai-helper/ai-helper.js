(() => {
  'use strict';
  const scenarios = {
    restaurant: {
      orbit: '“A table for six. Friday at seven?”',
      question: 'Can I book a table for six Friday night? And do you have gluten-free options?',
      reply: 'Let’s get your request together. What time would you prefer, and what name and number should the restaurant use to confirm? I’ll flag the gluten-free question for the team, too.',
      outcome: 'Party size, preferred time, contact details, and dietary questions — ready for the restaurant to follow up.',
      prompt: "I run a restaurant. Let's role-play: be my restaurant's assistant while I ask a sample customer question. Use example details and make clear that bookings need the restaurant's confirmation."
    },
    appointments: {
      orbit: '“Any openings for a haircut this week?”',
      question: 'I’m looking for a haircut and color this week. Do you have anything after work?',
      reply: 'Let’s narrow it down. Which days work for you, and what time do you finish work? I can collect your details so the salon can check availability and confirm a time.',
      outcome: 'Requested service, preferred days, after-work timing, and contact details — a clear starting point for your team.',
      prompt: "I run a salon. Let's role-play: be my salon's assistant while I ask a customer question about a haircut and color. Use example details, collect preferences, and make clear that availability and bookings need confirmation."
    },
    local: {
      orbit: '“Can you help with this repair?”',
      question: 'My kitchen faucet has been leaking. Can someone come out this week? I have a photo.',
      reply: 'Tell me a little about the leak, your area, and a good time to reach you. You can share the photo, too. That gives the repair team useful context before they call you back.',
      outcome: 'A description of the problem, service area, photo context, and callback preferences — fewer details to chase down.',
      prompt: "I run a local home-repair business. Let's role-play: be my business's assistant while I ask a sample customer question. Help collect the job details and callback preferences without promising a price or a confirmed visit."
    }
  };
  const tabs = [...document.querySelectorAll('[data-scenario]')];
  function selectScenario(tab) {
    const scenario = scenarios[tab.dataset.scenario];
    if (!scenario) return;
    for (const item of tabs) {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    }
    document.getElementById('business-example').setAttribute('aria-labelledby', tab.id);
    for (const [id, value] of Object.entries({ 'orbit-question': scenario.orbit, 'example-question': scenario.question, 'example-reply': scenario.reply, 'example-outcome': scenario.outcome })) document.getElementById(id).textContent = value;
    document.getElementById('try-scenario').dataset.johnnyPrompt = scenario.prompt;
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectScenario(tab));
    tab.addEventListener('keydown', event => {
      let next = index;
      if (['ArrowDown', 'ArrowRight'].includes(event.key)) next = (index + 1) % tabs.length;
      else if (['ArrowUp', 'ArrowLeft'].includes(event.key)) next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      tabs[next].focus();
      selectScenario(tabs[next]);
    });
  });
  function openJohnny(trigger, attempt = 0) {
    const widget = document.getElementById('voice-widget-container');
    if (!widget) {
      if (attempt < 20) setTimeout(() => openJohnny(trigger, attempt + 1), 100);
      return;
    }
    widget.classList.remove('minimized');
    widget.classList.add('widget-spotlight');
    setTimeout(() => widget.classList.remove('widget-spotlight'), 1000);
    const input = document.getElementById('voice-text-input');
    if (trigger?.dataset.johnnyPrompt && input && !input.value.trim()) input.value = trigger.dataset.johnnyPrompt;
    // Opening a demo never sends a message or requests the microphone.
    const target = trigger?.hasAttribute('data-johnny-attach') ? document.getElementById('upload-label') : input;
    setTimeout(() => target?.focus({ preventScroll: true }), 100);
  }
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-johnny-open-widget]');
    if (!trigger) return;
    event.preventDefault();
    openJohnny(trigger);
  });
  window.johnnyOpenInlineAssistant = event => {
    event?.preventDefault?.();
    openJohnny(event?.currentTarget);
  };
})();
