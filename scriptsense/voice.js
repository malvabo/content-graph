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

  // --- Animation state ---
  let t = 0;
  let stateBlend = 0;   // 0 = idle, 1 = listening
  let volume = 0;        // smoothed audio volume 0–1
  let rawVolume = 0;

  // --- Audio analyser ---
  let analyser = null;
  let analyserData = null;

  function initAudio(stream) {
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserData = new Uint8Array(analyser.frequencyBinCount);
  }

  function sampleVolume() {
    if (!analyser) return;
    analyser.getByteTimeDomainData(analyserData);
    let sum = 0;
    for (let i = 0; i < analyserData.length; i++) {
      const v = (analyserData[i] - 128) / 128;
      sum += v * v;
    }
    rawVolume = Math.min(Math.sqrt(sum / analyserData.length) * 3, 1);
  }

  // --- Canvas sizing ---
  function sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = orbEl.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  new ResizeObserver(sizeCanvas).observe(orbEl);
  sizeCanvas();

  // --- Draw ---
  function drawOrb() {
    const rect = orbEl.getBoundingClientRect();
    const w = rect.width, h = rect.height, cx = w / 2, cy = h / 2;

    // Smooth state + volume
    const targetState = listening ? 1 : 0;
    stateBlend += (targetState - stateBlend) * (targetState > stateBlend ? 0.05 : 0.03);
    sampleVolume();
    volume += (rawVolume - volume) * 0.15;

    // Breathing
    const breath = 1 + Math.sin(t * 0.7) * 0.02;
    orbEl.style.transform = `scale(${breath})`;

    // Clear
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    // Speed
    const speed = 0.03 + stateBlend * 0.015 + volume * 0.02;

    // 6 gradient blobs
    for (let i = 0; i < 6; i++) {
      const angle = t * 0.8 + i * 1.05;
      const spread = 60 + stateBlend * 10 + volume * 40;
      const r = spread + Math.sin(t * 0.5 + i) * (20 + volume * 30);
      const x = cx + Math.cos(angle) * r * 0.5;
      const y = cy + Math.sin(angle) * r * 0.4;
      const blobR = 80 + Math.sin(t + i) * 20 + volume * 30;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, blobR);

      // Hue: idle 220–270 cool blue/indigo → listening 260–360 purple/magenta/pink
      const idleHue = 220 + i * 10;
      const liveHue = 260 + i * 20;
      const hue = idleHue + (liveHue - idleHue) * stateBlend;
      const sat = 70 + stateBlend * 15;
      const light = 45 + volume * 15;
      const alpha = (0.2 + stateBlend * 0.25 + volume * 0.3) * (0.7 + i * 0.06);

      grad.addColorStop(0, `hsla(${hue},${sat}%,${light}%,${alpha})`);
      grad.addColorStop(0.5, `hsla(${hue + 30},${sat - 10}%,${light - 10}%,${alpha * 0.35})`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    // 3 layered accent waves
    const waves = [
      { freq: 0.02,  phase: t * 2,   alpha: 0.5 + stateBlend * 0.2, lw: 2,   hue: 280 },
      { freq: 0.035, phase: t * 1.4, alpha: 0.2 + stateBlend * 0.15, lw: 1.5, hue: 320 },
      { freq: 0.012, phase: t * 0.8, alpha: 0.1 + stateBlend * 0.1,  lw: 1,   hue: 240 },
    ];
    for (const wv of waves) {
      const amp = (20 + volume * 60) * (0.3 + stateBlend * 0.7);
      ctx.beginPath();
      ctx.strokeStyle = `hsla(${wv.hue},80%,70%,${wv.alpha})`;
      ctx.lineWidth = wv.lw;
      for (let x = 0; x < w; x += 2) {
        const y = cy + Math.sin(x * wv.freq + wv.phase) * amp * Math.sin(t * 0.7)
                     + Math.cos(x * wv.freq * 0.6 + wv.phase * 0.5) * amp * 0.4;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    t += speed;
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
      if (listening) {
        try { recognition.start(); } catch(e){}
      }
    };

    // Get mic stream for audio analysis
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      initAudio(stream);
      recognition.start();
    }).catch(() => {
      // Fall back to recognition without audio reactivity
      recognition.start();
    });
  }

  function stopListening() {
    listening = false;
    orbEl.classList.remove('listening');
    if (recognition) { recognition.stop(); recognition = null; }
    status.textContent = 'Session ended';
    voiceStatus.textContent = '🎙 Voice off';
  }

  orbEl.addEventListener('click', () => {
    if (!listening) startListening();
  });

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

  btnEnd.addEventListener('click', () => {
    stopListening();
    if (fullText.trim()) {
      localStorage.setItem('scriptsense-content', fullText.trim());
    }
    status.textContent = 'Processing transcript...';
    setTimeout(() => { window.location.href = 'scriptsense.html'; }, 800);
  });
})();
