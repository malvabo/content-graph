(() => {
  const cardsEl = document.getElementById('story-cards');
  const msgsEl = document.getElementById('chat-messages');
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');

  const CARDS = [
    { headline: 'In the View-Translator Information Ecosystem, every object nominated by a view will have a level of confidence.',
      body: 'The translator will multiply the object\'s confidence by the translator\'s own confidence to determine the <mark>graphical emphasis level</mark> in the destination view.<ul><li>Every topic is nominated with a level of confidence.</li><li>Translators produce dilution of confidence.</li><li>Views use confidence to determine the graphical emphasis of displayed objects.</li></ul>' },
    { headline: 'The user can give feedback on resulting views to enable backpropagation learning for the translator.',
      body: 'The problem is addressed through <mark>backpropagation of feedback</mark>. Feedback can be either explicit or implicit. This negative feedback is returned to the translator, resulting in low confidence in future matches.' },
    { headline: 'There are no officially canonized objects. Engineers will create more translators that output this schema.',
      body: 'When another provider develops a competing translator, it can follow the published protocol and produce compatible objects. This makes their new translator <mark>immediately compatible with existing views</mark>.' },
    { headline: 'No functionality is locked behind a UI. Translators have no end-user interface and are available to every view.',
      body: 'This platform enforces <mark>modularity between data and views</mark>. Unlike current systems, every service on this system is available to every view.' }
  ];

  const savedTranscript = localStorage.getItem('clade-transcript');
  if (savedTranscript) {
    CARDS.unshift({ headline: 'Voice Transcript', body: savedTranscript.replace(/\n/g, '<br>') });
    localStorage.removeItem('clade-transcript');
  }

  let dragCard = null;

  CARDS.forEach((c, i) => {
    const card = document.createElement('div');
    card.className = 'story-card';
    card.dataset.index = i;
    card.innerHTML = `
      <div class="card-actions">
        <button class="card-expand" title="Expand">⤢</button>
      </div>
      <div class="story-card-headline" draggable="true">${c.headline}</div>
      <div class="story-card-body">${c.body}</div>`;

    card.querySelector('.card-expand').addEventListener('click', e => {
      e.stopPropagation();
      showExpandedCard(c);
    });

    const headline = card.querySelector('.story-card-headline');
    headline.addEventListener('dragstart', e => {
      dragCard = card; card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    headline.addEventListener('dragend', () => { card.classList.remove('dragging'); dragCard = null; });
    card.addEventListener('dragover', e => {
      e.preventDefault();
      if (!dragCard || dragCard === card) return;
      const rect = card.getBoundingClientRect();
      if (e.clientX < rect.left + rect.width / 2) cardsEl.insertBefore(dragCard, card);
      else cardsEl.insertBefore(dragCard, card.nextSibling);
    });
    cardsEl.appendChild(card);
  });

  function showExpandedCard(c) {
    const overlay = document.createElement('div');
    overlay.className = 'card-modal-overlay';
    overlay.innerHTML = `<div class="card-modal" style="position:relative">
      <button class="card-modal-close">✕</button>
      <div class="story-card-headline">${c.headline}</div>
      <div class="story-card-body" style="margin-top:12px">${c.body}</div>
    </div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('.card-modal-close').addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
  }

  // Chat
  const AI_RESPONSES = [
    { text: 'The core idea is a system where <mark>confidence is a first-class property</mark> of every piece of information.<br><br>1. Graceful degradation — low-confidence items fade rather than vanish<br>2. Backpropagation learning — user feedback flows backward through the chain<br>3. Organic schema evolution — protocols emerge through usage, not gatekeeping' },
    { text: 'The translator model is a decentralized API layer. Each translator is a stateless function — no UI, no user-facing interface.<br><br>The <mark>market decides which translators survive</mark> based on output quality.' },
    { text: 'The backpropagation described here is implicit reinforcement learning embedded in the architecture.<br><br>The result is a system that <mark>tailors itself to the individual user</mark> without any explicit preferences panel.' }
  ];

  let responseIdx = 0, thinkingRive = null, isSending = false;

  function addMessage(role, content) {
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    div.innerHTML = `<span class="msg-sender">${role === 'user' ? 'You' : '✦ AI'}</span>
      <div class="msg-bubble">${content}</div>`;
    msgsEl.appendChild(div);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function showThinkingLoader() {
    removeThinkingLoader();
    const div = document.createElement('div');
    div.className = 'msg ai thinking-msg';
    const loader = document.createElement('div');
    loader.className = 'thinking-loader';
    const rc = document.createElement('canvas');
    rc.className = 'thinking-rive'; rc.width = 56; rc.height = 56;
    const label = document.createElement('span');
    label.className = 'thinking-label'; label.textContent = 'Thinking…';
    loader.append(rc, label);
    div.innerHTML = '<span class="msg-sender">✦ AI</span>';
    div.appendChild(loader);
    msgsEl.appendChild(div);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    try {
      thinkingRive = new rive.Rive({ src: 'logo.riv', canvas: rc, autoplay: true,
        onLoad: () => { try { thinkingRive.resizeDrawingSurfaceToCanvas(); } catch(e){} }
      });
    } catch(e){}
  }

  function removeThinkingLoader() {
    try { if (thinkingRive) thinkingRive.cleanup(); } catch(e){}
    thinkingRive = null;
    document.querySelector('.thinking-msg')?.remove();
  }

  function addAIMessage(resp) {
    removeThinkingLoader();
    const div = document.createElement('div');
    div.className = 'msg ai';
    div.innerHTML = `<span class="msg-sender">✦ AI</span>
      <div class="msg-bubble">${resp.text}</div>`;
    msgsEl.appendChild(div);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    isSending = false;
  }

  function send() {
    const text = input.value.trim();
    if (!text || isSending) return;
    isSending = true;
    addMessage('user', text);
    input.value = ''; input.style.height = '';
    requestAnimationFrame(() => { input.style.height = 'auto'; });
    showThinkingLoader();
    setTimeout(() => {
      addAIMessage(AI_RESPONSES[responseIdx % AI_RESPONSES.length]);
      responseIdx++;
    }, 1800);
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; });

  addAIMessage({
    text: 'I\'ve loaded your story about the View-Translator Information Ecosystem.<br><br>4 cards covering confidence-based rendering, backpropagation feedback, organic schema evolution, and data/UI separation.<br><br>Highlight text on any card, or ask me anything.'
  });

  document.getElementById('btn-scriptsense').addEventListener('click', () => {
    let content = '';
    document.querySelectorAll('.story-card').forEach(card => {
      const h = card.querySelector('.story-card-headline');
      const b = card.querySelector('.story-card-body');
      if (h) content += h.innerText + '\n\n';
      if (b) content += b.innerText + '\n\n';
    });
    document.querySelectorAll('.msg.ai .msg-bubble').forEach(bubble => {
      content += bubble.innerText + '\n\n';
    });
    localStorage.setItem('scriptsense-content', content.trim());
    window.location.href = 'scriptsense.html';
  });
})();
