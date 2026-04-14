(() => {
  const editor = document.getElementById('editor');
  const output = document.getElementById('output');
  const stats = document.getElementById('stats');
  const diffSummary = document.getElementById('diff-summary');
  const outputActions = document.getElementById('output-actions');

  function updateStats() {
    const text = editor.innerText.trim();
    const words = text ? text.split(/\s+/).length : 0;
    stats.textContent = `${words} words · ${text.length} chars`;
  }
  editor.addEventListener('input', updateStats);

  const RULES = {
    improve: [[/\bvery\s+/gi,''],[/\breally\s+/gi,''],[/\bjust\s+/gi,''],[/\bin order to\b/gi,'to'],[/\bdue to the fact that\b/gi,'because'],[/\bat this point in time\b/gi,'now'],[/\bhas the ability to\b/gi,'can'],[/\ba large number of\b/gi,'many']],
    clarity: [[/\butilize\b/gi,'use'],[/\bfacilitate\b/gi,'help'],[/\bleverage\b/gi,'use'],[/\boptimal\b/gi,'best'],[/\bcommence\b/gi,'start'],[/\bterminate\b/gi,'end']],
    concise: [[/\bbasically,?\s*/gi,''],[/\bactually,?\s*/gi,''],[/\bhonestly,?\s*/gi,''],[/\bin my opinion,?\s*/gi,''],[/\bneedless to say,?\s*/gi,'']],
    tone: [[/\bhey\b/gi,'Hello'],[/\bguys\b/gi,'team'],[/\bstuff\b/gi,'materials'],[/\bcool\b/gi,'excellent'],[/\bgot\b/gi,'received'],[/\bwanna\b/gi,'want to'],[/\bgonna\b/gi,'going to']],
    grammar: [[/\bi\b/g,'I'],[/\bdont\b/gi,"don't"],[/\bcant\b/gi,"can't"],[/\bwont\b/gi,"won't"],[/\bteh\b/gi,'the'],[/\brecieve\b/gi,'receive'],[/\s{2,}/g,' ']]
  };

  function improveText(text, mode) {
    let r = text;
    (RULES[mode]||RULES.improve).forEach(([p,s])=>{r=r.replace(p,s)});
    return r.replace(/\s{2,}/g,' ').replace(/(^|[.!?]\s+)([a-z])/g,(m,p,c)=>p+c.toUpperCase()).trim();
  }

  function highlightDiff(orig, imp) {
    const o=orig.split(/(\s+)/), n=imp.split(/(\s+)/);
    let h='';
    for(let i=0;i<Math.max(o.length,n.length);i++){
      if((o[i]||'')===(n[i]||''))h+=n[i]||'';
      else if(n[i])h+=`<span class="changed">${n[i]}</span>`;
    }
    return h||imp;
  }

  function run(mode, e) {
    const text=editor.innerText.trim();
    if(!text)return;
    output.innerHTML='';output.classList.add('improving');
    outputActions.classList.add('hidden');diffSummary.classList.add('hidden');
    document.querySelectorAll('#input-actions .action-btn').forEach(b=>b.classList.remove('active'));
    e.target.classList.add('active');
    setTimeout(()=>{
      const imp=improveText(text,mode);
      output.innerHTML=highlightDiff(text,imp);
      output.classList.remove('improving');
      outputActions.classList.remove('hidden');
      const ow=text.split(/\s+/).length,nw=imp.split(/\s+/).length,d=ow-nw;
      diffSummary.classList.remove('hidden');
      diffSummary.innerHTML=`<strong>${Math.abs(d)}</strong> words ${d>0?'removed':'added'} · <strong>${ow}</strong> → <strong>${nw}</strong> words`;
    },800);
  }

  document.getElementById('btn-improve').addEventListener('click',e=>run('improve',e));
  document.getElementById('btn-clarity').addEventListener('click',e=>run('clarity',e));
  document.getElementById('btn-concise').addEventListener('click',e=>run('concise',e));
  document.getElementById('btn-tone').addEventListener('click',e=>run('tone',e));
  document.getElementById('btn-grammar').addEventListener('click',e=>run('grammar',e));

  document.getElementById('btn-copy').addEventListener('click',()=>{
    navigator.clipboard.writeText(output.innerText);
    document.getElementById('btn-copy').textContent='Copied!';
    setTimeout(()=>{document.getElementById('btn-copy').textContent='Copy'},1500);
  });
  document.getElementById('btn-use').addEventListener('click',()=>{
    editor.innerText=output.innerText;output.innerHTML='';
    outputActions.classList.add('hidden');diffSummary.classList.add('hidden');updateStats();
  });

  // Load transcript from voice or chat
  const content = localStorage.getItem('scriptsense-content') || localStorage.getItem('clade-transcript');
  if (content) {
    editor.innerText = content;
    localStorage.removeItem('scriptsense-content');
    localStorage.removeItem('clade-transcript');
    updateStats();
  }
})();
