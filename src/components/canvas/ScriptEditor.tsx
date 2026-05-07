import { useState, useRef, useEffect, useCallback } from 'react';
import { useScriptStore } from '../../store/scriptStore';
import { useCardsStore } from '../../store/cardsStore';
import { useSettingsStore } from '../../store/settingsStore';

async function scriptToCards(script: string, signal: AbortSignal): Promise<string> {
  const { anthropicKey, groqKey } = useSettingsStore.getState();
  const prompt = `You are breaking a talk script into memory cards for a speaker.

Each card = one major section of the talk.
If the talk has 5 sections, return 5 cards. No more.

Each card contains only what the speaker needs to glance at to unlock that section.
Not a summary. Not the full content. Just the anchor.

## Card format

---
[SECTION TITLE]
[one sentence — the core idea that unlocks this section]
[word] · [word] · [word]
---

## Rules
- Title: 2–4 words
- Anchor sentence: one line only
- Keywords: 2–4 load-bearing words, dot-separated
- Verbatim sections (hook, close): mark with ★
- No explanations, no elaboration, no extras

## Script
${script}`;

  if (anthropicKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text ?? '';
  }
  if (groqKey) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }
  throw new Error('No API key configured. Add one in Settings.');
}

function parseCards(raw: string) {
  const sections = raw.split('---').map(s => s.trim()).filter(Boolean);
  return sections.map((section, i) => {
    const lines = section.split('\n').map(l => l.trim()).filter(Boolean);
    const title = lines[0] ?? `Card ${i + 1}`;
    const anchor = lines[1] ?? '';
    const keywords = lines[2] ?? '';
    const body = [anchor, keywords ? `<span style="opacity:0.6;font-size:0.9em">${keywords}</span>` : ''].filter(Boolean).join('<br>');
    return { id: `c${Date.now().toString(36)}-${i}`, headline: title, body };
  });
}

export default function ScriptEditor({ scriptId, onBack }: { scriptId: string; onBack: () => void }) {
  const script = useScriptStore(s => s.scripts.find(sc => sc.id === scriptId));
  const updateScript = useScriptStore(s => s.updateScript);
  const addCardSet = useCardsStore(s => s.add);
  const [content, setContent] = useState(script?.content ?? '');
  const [pushing, setPushing] = useState(false);
  const [pushed, setPushed] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  const handleChange = useCallback((val: string) => {
    setContent(val);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => updateScript(scriptId, { content: val }), 400);
  }, [scriptId, updateScript]);

  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  }, [content]);

  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const pushToCards = useCallback(async () => {
    if (!content.trim() || pushing) return;
    setPushing(true);
    abortRef.current = new AbortController();
    try {
      const raw = await scriptToCards(content, abortRef.current.signal);
      const cards = parseCards(raw);
      if (cards.length > 0) {
        const setId = `cards-${Date.now()}`;
        addCardSet({ id: setId, name: script?.title || 'Untitled', cards, createdAt: new Date().toISOString() });
        setPushed(true);
        setTimeout(() => setPushed(false), 3000);
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') alert(e.message);
    } finally {
      setPushing(false);
    }
  }, [content, pushing, script?.title, addCardSet]);

  if (!script) return null;

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>
      <div className="p-4 md:px-8 md:py-6" style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          <button onClick={onBack} className="btn btn-ghost" style={{ padding: 'var(--space-1) var(--space-2)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          </button>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Scripts</span>
          <span style={{ flex: 1 }} />
          <button
            onClick={pushToCards}
            disabled={pushing || !content.trim()}
            className="btn btn-sm btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 110 }}
          >
            {pushing ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'btn-spin .65s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Generating…
              </>
            ) : pushed ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Pushed!
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="7" height="7" rx="1"/><rect x="15" y="3" width="7" height="7" rx="1"/><rect x="2" y="14" width="7" height="7" rx="1"/><rect x="15" y="14" width="7" height="7" rx="1"/></svg>
                Push to Cards
              </>
            )}
          </button>
        </div>

        {/* Title */}
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
          {script.title || 'Untitled'}
        </div>

        {/* Editor */}
        <textarea ref={ref} value={content} onChange={e => handleChange(e.target.value)}
          placeholder="Start writing…"
          style={{
            width: '100%', flex: 1, minHeight: 400,
            background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', outline: 'none', resize: 'none',
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-normal)',
            color: 'var(--color-text-primary)', overflow: 'hidden',
          }} />
      </div>
    </div>
  );
}
