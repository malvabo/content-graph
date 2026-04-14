(() => {
  const orbEl = document.getElementById('orb');
  const canvas = document.getElementById('orb-canvas');
  const ctx = canvas.getContext('2d');
  const status = document.getElementById('status');
  const transcript = document.getElementById('transcript');
  const transcriptArea = document.getElementById('transcript-area');
  const btnText = document.getElementById('btn-text');
  const btnEnd = document.getElementById('btn-end');
  const voiceStatus = document.getElementById('voice-status');
  const app = document.getElementById('app');

  let fullText = '';
  let recognition = null;
  let listening = false;

  // --- Animated orb ---
  let t = 0;
  function drawOrb() {
    const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2;
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 5; i++) {
      const angle = t * 0.8 + i * 1.3;
      const r = 60 + Math.sin(t * 0.5 + i) * 20;
      const x = cx + Math.cos(angle) * r * 0.5;
      const y = cy + Math.sin(angle) * r * 0.4;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 80 + Math.sin(t + i) * 20);
      const hue = listening ? 240 + i * 25 : 220 + i * 10;
      const alpha = listening ? 0.5 : 0.25;
      grad.addColorStop(0, `hsla(${hue},80%,60%,${alpha})`);
      grad.addColorStop(0.5, `hsla(${hue + 30},70%,40%,${alpha * 0.4})`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    // Bright accent line
    ctx.beginPath();
    ctx.strokeStyle = listening ? 'rgba(180,140,255,0.6)' : 'rgba(100,120,200,0.2)';
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 2) {
      const y = cy + Math.sin(x * 0.02 + t * 2) * 30 * Math.sin(t * 0.7) + Math.cos(x * 0.01 + t) * 20;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    t += 0.015;
    requestAnimationFrame(drawOrb);
  }
  drawOrb();

  // --- Speech Recognition ---
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    status.textContent = 'Speech recognition not supported in this browser';
    return;
  }

  function startListening() {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      listening = true;
      orbEl.classList.add('listening');
      status.textContent = 'Listening...';
      voiceStatus.textContent = '🎙 Voice on';
    };

    recognition.onresult = e => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t + ' ';
        else interim = t;
      }
      if (final) fullText += final;
      transcript.innerHTML = fullText + (interim ? `<span class="interim">${interim}</span>` : '');
      transcriptArea.scrollTop = transcriptArea.scrollHeight;
    };

    recognition.onerror = e => {
      if (e.error === 'no-speech') return;
      status.textContent = `Error: ${e.error}`;
    };

    recognition.onend = () => {
      // Auto-restart if still in listening mode
      if (listening) {
        try { recognition.start(); } catch(e){}
      }
    };

    recognition.start();
  }

  function stopListening() {
    listening = false;
    orbEl.classList.remove('listening');
    if (recognition) { recognition.stop(); recognition = null; }
    status.textContent = 'Session ended';
    voiceStatus.textContent = '🎙 Voice off';
  }

  // Click orb to start
  orbEl.addEventListener('click', () => {
    if (!listening) startListening();
  });

  // Show text
  btnText.addEventListener('click', () => {
    if (!app.classList.contains('showing-text')) {
      app.classList.add('showing-text');
      transcriptArea.classList.remove('hidden');
      btnText.textContent = 'Hide text';
    } else {
      app.classList.remove('showing-text');
      transcriptArea.classList.add('hidden');
      btnText.textContent = 'Show text';
    }
  });

  // End session → navigate to ScriptSense with transcript
  btnEnd.addEventListener('click', () => {
    stopListening();
    if (fullText.trim()) {
      localStorage.setItem('scriptsense-content', fullText.trim());
    }
    status.textContent = 'Processing transcript...';
    setTimeout(() => { window.location.href = 'scriptsense.html'; }, 800);
  });
})();
