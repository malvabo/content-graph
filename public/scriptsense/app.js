(() => {
  const canvas = document.getElementById('canvas');
  const svg = document.getElementById('wires');
  const NS = 'http://www.w3.org/2000/svg';

  // SVG gradient for mixed wires
  const defs = document.createElementNS(NS, 'defs');
  defs.innerHTML = `<linearGradient id="wireGradient" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="#3e57da"/><stop offset="100%" stop-color="#7c3aed"/></linearGradient>`;
  svg.appendChild(defs);

  const ICONS = {
    'text-source':'Tx','image-source':'Im','url-source':'Ur',
    instruction:'In',splitter:'Sp',
    'linkedin-post':'Li','twitter-thread':'Tw','twitter-single':'Ts',
    'ig-carousel':'Ig','blog-article':'Bl',newsletter:'Nw',
    infographic:'If','quote-card':'Qc','image-prompt':'Ip',
    'ai-claude':'Cl','ai-gpt':'Gp','ai-nano':'Nb',export:'Ex'
  };
  const WIRE_TYPE = {
    'text-source':'text','image-source':'image','url-source':'text',
    instruction:'text',splitter:'text',
    'linkedin-post':'text','twitter-thread':'text','twitter-single':'text',
    'ig-carousel':'text','blog-article':'text',newsletter:'text',
    infographic:'text','quote-card':'text','image-prompt':'text',
    'ai-claude':'text','ai-gpt':'text','ai-nano':'image',export:'text'
  };
  const LABELS = {
    'text-source':'Text','image-source':'Image','url-source':'URL',
    instruction:'Instruction',splitter:'Splitter',
    'linkedin-post':'LinkedIn Post','twitter-thread':'Twitter Thread',
    'twitter-single':'Twitter Single','ig-carousel':'IG Carousel',
    'blog-article':'Blog Article',newsletter:'Newsletter Digest',
    infographic:'Infographic Brief','quote-card':'Quote Card',
    'image-prompt':'Image Prompt',
    'ai-claude':'Claude','ai-gpt':'GPT-4o','ai-nano':'Nano Banana Pro',
    export:'Export'
  };

  // Rive config — update these to match your exported .riv
  const RIVE_SRC = 'popover.riv';           // Place your exported .riv here
  const RIVE_ARTBOARD = null;               // null = first artboard
  const RIVE_STATE_MACHINE = 'State Machine 1'; // Update to your SM name

  let nodes = [], wires = [], nextId = 0;
  let dragging = null, wiring = null, activeWirePath = null;

  // --- Rive popover attachment ---

  function attachRivePopover(node) {
    const pop = document.createElement('div');
    pop.className = 'node-popover';

    // Rive canvas
    const riveCanvas = document.createElement('canvas');
    riveCanvas.className = 'rive-popover';
    riveCanvas.width = 480; riveCanvas.height = 500;
    pop.appendChild(riveCanvas);

    // Action buttons — contextual per node type
    const actions = document.createElement('div');
    actions.className = 'popover-actions';
    if (node.subtype === 'text-source') {
      actions.innerHTML = `
        <label class="popover-action-btn" style="cursor:pointer">Upload<input type="file" accept=".pdf,.doc,.docx,.md,.txt" hidden></label>
        <button class="popover-action-btn popover-paste-btn">Paste text</button>
        <button class="popover-action-btn">Settings</button>`;
    } else {
      actions.innerHTML = `
        <div class="popover-dropdown">
          <button class="popover-action-btn popover-dropdown-trigger">Model</button>
          <div class="popover-dropdown-menu">
            <div class="dd-search"><span class="dd-search-icon">⌕</span><input placeholder="Search compatible models"></div>
            <div class="dd-toggle-row">Auto select model <span class="dd-info">ⓘ</span><div class="dd-toggle"></div></div>
            <div class="dd-toggle-row">Use multiple models <span class="dd-info">ⓘ</span><div class="dd-toggle"></div></div>
            <div class="dd-sep"></div>
            <div class="dd-section">Pinned models <span class="dd-info">ⓘ</span></div>
            <div class="dd-hint">Models you favorite will appear here</div>
            <div class="dd-sep"></div>
            <div class="dd-section">Featured models <span class="dd-info">ⓘ</span></div>
            <div class="dd-model active" data-model="Claude Sonnet 4.6">
              <div class="dd-model-icon">✦</div>
              <div class="dd-model-info">
                <div class="dd-model-name">Claude Sonnet 4.6 <span class="dd-model-badges"><span>8</span><span>8s</span></span></div>
                <div class="dd-model-desc">Balanced speed and intelligence.</div>
              </div>
              <span class="dd-model-check">✓</span>
            </div>
            <div class="dd-model" data-model="GPT-4o">
              <div class="dd-model-icon">◎</div>
              <div class="dd-model-info">
                <div class="dd-model-name">GPT-4o</div>
                <div class="dd-model-desc">Fast multimodal reasoning.</div>
              </div>
              <span class="dd-model-check"> </span>
            </div>
            <div class="dd-model" data-model="Gemini Pro">
              <div class="dd-model-icon">◆</div>
              <div class="dd-model-info">
                <div class="dd-model-name">Gemini Pro</div>
                <div class="dd-model-desc">Long context, strong analysis.</div>
              </div>
              <span class="dd-model-check"> </span>
            </div>
            <div class="dd-sep"></div>
            <div class="dd-section">Providers <span class="dd-info">ⓘ</span></div>
            <div class="dd-provider"><div class="dd-provider-left"><div class="dd-model-icon">✦</div>Anthropic</div><span class="dd-provider-chevron">›</span></div>
            <div class="dd-provider"><div class="dd-provider-left"><div class="dd-model-icon">◎</div>OpenAI</div><span class="dd-provider-chevron">›</span></div>
          </div>
        </div>
        <button class="popover-action-btn">Size</button>
        <button class="popover-action-btn">Settings</button>`;
    }
    pop.appendChild(actions);
    node.el.appendChild(pop);

    // Dropdown logic
    const dd = pop.querySelector('.popover-dropdown');
    if (dd) {
      dd.querySelector('.popover-dropdown-trigger').addEventListener('click', e => {
        e.stopPropagation();
        dd.classList.toggle('open');
      });
      // Model selection
      dd.querySelectorAll('.dd-model').forEach(item => {
        item.addEventListener('click', e => {
          e.stopPropagation();
          dd.querySelectorAll('.dd-model').forEach(i => { i.classList.remove('active'); i.querySelector('.dd-model-check').textContent = ' '; });
          item.classList.add('active');
          item.querySelector('.dd-model-check').textContent = '✓';
          const trigger = dd.querySelector('.popover-dropdown-trigger');
          trigger.textContent = item.dataset.model;
          // Re-add chevron via CSS ::after, textContent is enough
          dd.classList.remove('open');
        });
      });
      // Toggles
      dd.querySelectorAll('.dd-toggle').forEach(t => {
        t.addEventListener('click', e => { e.stopPropagation(); t.classList.toggle('on'); });
      });
      // Prevent menu clicks from closing
      dd.querySelector('.popover-dropdown-menu').addEventListener('click', e => e.stopPropagation());
    }

    // Document-specific handlers
    if (node.subtype === 'text-source') {
      const fileInput = actions.querySelector('input[type="file"]');
      fileInput.addEventListener('change', () => {
        if (fileInput.files.length) node.el.querySelector('.node-subtitle').textContent = fileInput.files[0].name;
      });
      actions.querySelector('.popover-paste-btn').addEventListener('click', () => {
        const text = prompt('Paste your text:');
        if (text) node.el.querySelector('.node-subtitle').textContent = text.slice(0, 60) + '…';
      });
    }

    // Hover zone — stays open while mouse is over node OR popover
    let hoverTimeout = null;
    function showPop() { clearTimeout(hoverTimeout); pop.classList.add('visible'); if (showTrigger) showTrigger.fire(); }
    function scheduleHide() { hoverTimeout = setTimeout(() => { pop.classList.remove('visible'); if (dd) dd.classList.remove('open'); if (hideTrigger) hideTrigger.fire(); }, 120); }

    node.el.addEventListener('pointerenter', () => { if (!dragging) showPop(); });
    node.el.addEventListener('pointerleave', () => { if (!dragging) scheduleHide(); });
    pop.addEventListener('pointerenter', showPop);
    pop.addEventListener('pointerleave', scheduleHide);

    // Rive — State Machine 1 with Show/Hide triggers
    let riveInstance = null, showTrigger = null, hideTrigger = null;
    try {
      riveInstance = new rive.Rive({
        src: RIVE_SRC, canvas: riveCanvas, artboard: RIVE_ARTBOARD,
        stateMachines: RIVE_STATE_MACHINE, autoplay: true,
        onLoad: () => {
          try {
            riveInstance.resizeDrawingSurfaceToCanvas();
            const inputs = riveInstance.stateMachineInputs(RIVE_STATE_MACHINE);
            if (inputs) { showTrigger = inputs.find(i => i.name === 'Show'); hideTrigger = inputs.find(i => i.name === 'Hide'); }
          } catch(e){}
        },
        onLoadError: () => { riveCanvas.style.display = 'none'; }
      });
    } catch (e) { riveCanvas.style.display = 'none'; }
    node.riveInstance = riveInstance;
  }

  const DESCS = {
    'text-source':'Raw content, transcript, notes',
    'image-source':'Product photo, diagram',
    'url-source':'Scrape content from a link',
    instruction:'Directive for what to extract or change',
    splitter:'Auto-create N variations by rule',
    'linkedin-post':'150-300 word hook post, end with question',
    'twitter-thread':'5-10 tweet thread, each < 280 chars',
    'twitter-single':'Most quotable insight, max 280 chars',
    'ig-carousel':'5-10 slides, max 30 words per slide',
    'blog-article':'800-1500 word post with H2 sections',
    newsletter:'300-500 word conversational digest',
    infographic:'Data points, stats as visual spec',
    'quote-card':'Strongest quote with attribution',
    'image-prompt':'Subject, mood, style, aspect ratio',
    'ai-claude':'Anthropic text generation',
    'ai-gpt':'OpenAI multimodal reasoning',
    'ai-nano':'Image generation model',
    export:'Platform-ready content package'
  };

  function createNode(type, subtype, x, y) {
    const id = nextId++;
    const el = document.createElement('div');
    el.className = `node ${type}`;
    el.dataset.id = id;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.innerHTML = `
      <div class="port input" data-id="${id}" data-dir="in"></div>
      <div class="node-body">
        <div class="node-header">
          <div class="node-title">${LABELS[subtype] || subtype}</div>
          <div class="node-icon">${ICONS[subtype] || '⚡'}</div>
        </div>
        <div class="node-subtitle">${DESCS[subtype] || type}</div>
      </div>
      <div class="port output" data-id="${id}" data-dir="out"></div>`;
    canvas.appendChild(el);
    const node = { id, type, subtype, el, x, y, riveInstance: null, riveInputs: null };
    nodes.push(node);
    bindNodeDrag(node);
    bindPorts(el, id);
    attachRivePopover(node);
    return node;
  }

  function cleanupNode(node) {
    try { if (node.riveInstance) node.riveInstance.cleanup(); } catch(e){}
    node.riveInstance = null;
    node.el.remove();
  }

  function bindNodeDrag(node) {
    let ox, oy, sx, sy;
    node.el.addEventListener('pointerdown', e => {
      if (e.target.classList.contains('port') || e.target.tagName === 'CANVAS') return;
      e.preventDefault();
      ox = node.x; oy = node.y; sx = e.clientX; sy = e.clientY;
      dragging = node;
      node.el.classList.add('selected');
      node.el.setPointerCapture(e.pointerId);
    });
    node.el.addEventListener('pointermove', e => {
      if (dragging !== node) return;
      node.x = ox + (e.clientX - sx);
      node.y = oy + (e.clientY - sy);
      node.el.style.left = node.x + 'px';
      node.el.style.top = node.y + 'px';
      updateWires();
    });
    node.el.addEventListener('pointerup', () => {
      if (dragging === node) { dragging = null; node.el.classList.remove('selected'); }
    });
  }

  function bindPorts(el, nodeId) {
    el.querySelectorAll('.port').forEach(port => {
      port.addEventListener('pointerdown', e => {
        e.stopPropagation();
        if (port.dataset.dir !== 'out') return;
        wiring = { fromId: nodeId, fromPort: port };
        activeWirePath = document.createElementNS(NS, 'path');
        activeWirePath.classList.add('wire-active');
        svg.appendChild(activeWirePath);
        document.addEventListener('pointermove', onWireMove);
        document.addEventListener('pointerup', onWireEnd, { once: true });
      });
      port.addEventListener('pointerup', () => {
        if (!wiring || port.dataset.dir !== 'in') return;
        const toId = +port.dataset.id;
        if (wiring.fromId !== toId && !wires.find(w => w.from === wiring.fromId && w.to === toId))
          addWire(wiring.fromId, toId);
      });
    });
  }

  function onWireMove(e) {
    if (!wiring) return;
    const r = wiring.fromPort.getBoundingClientRect();
    const cr = svg.getBoundingClientRect();
    activeWirePath.setAttribute('d', bezier(
      r.left + r.width/2 - cr.left, r.top + r.height/2 - cr.top,
      e.clientX - cr.left, e.clientY - cr.top));
  }

  function onWireEnd() {
    document.removeEventListener('pointermove', onWireMove);
    if (activeWirePath) { activeWirePath.remove(); activeWirePath = null; }
    wiring = null;
  }

  function addWire(fromId, toId) {
    const path = document.createElementNS(NS, 'path');
    const fromNode = nodes.find(n => n.id === fromId);
    const wireType = WIRE_TYPE[fromNode.subtype] || 'mixed';
    path.classList.add('wire', wireType);
    svg.appendChild(path);
    wires.push({ from: fromId, to: toId, path, wireType });
    updateWires();
  }

  function updateWires() {
    const cr = svg.getBoundingClientRect();
    wires.forEach(w => {
      const fromEl = nodes.find(n => n.id === w.from)?.el.querySelector('.port.output');
      const toEl = nodes.find(n => n.id === w.to)?.el.querySelector('.port.input');
      if (!fromEl || !toEl) return;
      const r1 = fromEl.getBoundingClientRect(), r2 = toEl.getBoundingClientRect();
      w.path.setAttribute('d', bezier(
        r1.left + r1.width/2 - cr.left, r1.top + r1.height/2 - cr.top,
        r2.left + r2.width/2 - cr.left, r2.top + r2.height/2 - cr.top));
    });
  }

  function bezier(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1) * .5;
    return `M${x1},${y1} C${x1+dx},${y1} ${x2-dx},${y2} ${x2},${y2}`;
  }

  // Palette drag-and-drop
  document.querySelectorAll('.palette-node').forEach(pn => {
    pn.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', JSON.stringify({
        type: pn.dataset.type, subtype: pn.dataset.subtype
      }));
    });
  });
  canvas.parentElement.addEventListener('dragover', e => e.preventDefault());
  canvas.parentElement.addEventListener('drop', e => {
    e.preventDefault();
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    const rect = canvas.getBoundingClientRect();
    createNode(data.type, data.subtype, e.clientX - rect.left - 82, e.clientY - rect.top - 40);
  });

  // Demo workflow
  document.getElementById('demo-btn').addEventListener('click', () => {
    nodes.forEach(n => cleanupNode(n));
    wires.forEach(w => w.path.remove());
    nodes = []; wires = []; nextId = 0; selectedNodes.clear(); updateNodeToolbar();

    const cx = 60, cy = 120, gx = 260, gy = 110;

    // Sources
    const txt = createNode('source', 'text-source', cx, cy);
    const img = createNode('source', 'image-source', cx, cy + gy);

    // Transform
    const instr = createNode('transform', 'instruction', cx + gx, cy + gy/2);

    // Specifics — fan out
    const li = createNode('specifics', 'linkedin-post', cx + gx*2, cy - 40);
    const tw = createNode('specifics', 'twitter-thread', cx + gx*2, cy + 60);
    const ig = createNode('specifics', 'ig-carousel', cx + gx*2, cy + 160);
    const qc = createNode('specifics', 'quote-card', cx + gx*2, cy + 260);

    // Output models
    const c1 = createNode('output', 'ai-claude', cx + gx*3, cy - 40);
    const c2 = createNode('output', 'ai-claude', cx + gx*3, cy + 60);
    const gp = createNode('output', 'ai-gpt', cx + gx*3, cy + 160);
    const nb = createNode('output', 'ai-nano', cx + gx*3, cy + 260);

    const wireList = [
      [txt.id, instr.id], [img.id, instr.id],
      [instr.id, li.id], [instr.id, tw.id], [instr.id, ig.id], [instr.id, qc.id],
      [li.id, c1.id], [tw.id, c2.id], [ig.id, gp.id], [qc.id, nb.id]
    ];
    wireList.forEach(([f, t], i) => setTimeout(() => addWire(f, t), i * 90));
  });

  // Node multi-select (click or Shift+click)
  const selectedNodes = new Set();
  const ntb = document.getElementById('node-toolbar');
  const ntbCount = document.getElementById('node-toolbar-count');
  let activeNode = null;

  canvas.addEventListener('click', e => {
    const nodeEl = e.target.closest('.node');
    if (!nodeEl || e.target.closest('.port') || e.target.closest('.popover-action-btn') || e.target.closest('.popover-paste-btn') || e.target.tagName === 'INPUT') return;
    const id = +nodeEl.dataset.id;
    if (e.shiftKey) {
      if (selectedNodes.has(id)) { selectedNodes.delete(id); nodeEl.classList.remove('multi-selected'); }
      else { selectedNodes.add(id); nodeEl.classList.add('multi-selected'); }
    } else {
      // Single select — clear others
      document.querySelectorAll('.node.multi-selected').forEach(n => n.classList.remove('multi-selected'));
      selectedNodes.clear();
      selectedNodes.add(id);
      nodeEl.classList.add('multi-selected');
    }
    activeNode = id;
    updateNodeToolbar();
  });

  // Click canvas background to deselect
  canvas.parentElement.addEventListener('click', e => {
    if (e.target === canvas || e.target === canvas.parentElement || e.target.tagName === 'svg') {
      selectedNodes.clear();
      document.querySelectorAll('.node.multi-selected').forEach(n => n.classList.remove('multi-selected'));
      updateNodeToolbar();
    }
  });

  function updateNodeToolbar() {
    ntb.classList.add('hidden');
  }

  document.getElementById('node-toolbar-clear').addEventListener('click', () => {
    selectedNodes.clear(); activeNode = null;
    document.querySelectorAll('.node.multi-selected').forEach(n => n.classList.remove('multi-selected'));
    updateNodeToolbar();
  });

  // Delete selected nodes with Delete or Backspace
  document.addEventListener('keydown', e => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodes.size > 0 && document.activeElement === document.body) {
      e.preventDefault();
      [...selectedNodes].forEach(id => {
        const idx = nodes.findIndex(n => n.id === id);
        if (idx === -1) return;
        const node = nodes[idx];
        // Remove connected wires
        wires = wires.filter(w => {
          if (w.from === id || w.to === id) { w.path.remove(); return false; }
          return true;
        });
        cleanupNode(node);
        nodes.splice(idx, 1);
      });
      selectedNodes.clear(); activeNode = null;
      updateNodeToolbar();
    }
  });

  document.getElementById('node-toolbar-group').addEventListener('click', () => {
    const names = [...selectedNodes].map(id => {
      const n = nodes.find(n => n.id === id);
      return n ? LABELS[n.subtype] || n.subtype : id;
    });
    alert(`Grouped: ${names.join(', ')}`);
  });

  document.getElementById('node-toolbar-run').addEventListener('click', () => {
    const names = [...selectedNodes].map(id => {
      const n = nodes.find(n => n.id === id);
      return n ? LABELS[n.subtype] || n.subtype : id;
    });
    alert(`Running workflow: ${names.join(' → ')}`);
  });
})();
