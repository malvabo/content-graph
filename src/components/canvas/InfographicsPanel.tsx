import { useState, useRef, useEffect, useCallback } from 'react';
import { useInfographicStore } from '../../store/infographicStore';
import { useSettingsStore } from '../../store/settingsStore';
import { renderSVG, parseInfographicData } from '../nodes/InfographicNode';

interface ChatMsg { role: 'user' | 'assistant'; text: string }

const SUGGESTION_CHIPS = [
  'Change the title',
  'Add a new data point',
  'Make stats percentages',
  'Change color to warm tones',
  'Add a subtitle',
  'Remove last point',
];

async function chatEdit(messages: ChatMsg[], currentJson: string, signal?: AbortSignal): Promise<string> {
  const { anthropicKey, groqKey } = useSettingsStore.getState();
  const system = `You are an infographic editor. The user has an infographic defined as JSON. Apply their requested changes and return ONLY the updated JSON — no explanation, no markdown fences.

Current infographic JSON:
${currentJson}

The JSON schema is: { "title": string, "subtitle"?: string, "theme"?: { "bg"?: string, "accent"?: string, "text"?: string, "cardBg"?: string, "cardBorder"?: string }, "points": [{ "stat": string, "label": string, "detail"?: string, "color"?: string }] }`;

  const msgs = messages.map(m => ({ role: m.role, content: m.text }));

  if (anthropicKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2048, system, messages: msgs }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text ?? '';
  }
  if (groqKey) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 2048, messages: [{ role: 'system', content: system }, ...msgs] }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }
  throw new Error('No API key configured. Add one in Settings.');
}

const DEFAULT_JSON = JSON.stringify({ title: 'New Infographic', subtitle: 'Edit me with the chat panel', points: [{ stat: '0', label: 'Your first data point' }] });

export default function InfographicsPanel() {
  const { items, add, update, remove } = useInfographicStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMsg[]>(messages);
  messagesRef.current = messages;

  const editing = items.find(i => i.id === editingId) || null;

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { setMessages([]); }, [editingId]);
  useEffect(() => { return () => { abortRef.current?.abort(); }; }, []);

  const createNew = () => {
    const id = `ig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    add({ id, nodeId: id, label: 'New Infographic', json: DEFAULT_JSON });
    setEditingId(id);
  };

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading || !editing) return;
    if (!text) setInput('');
    const next: ChatMsg[] = [...messagesRef.current, { role: 'user', text: msg }];
    setMessages(next);
    setLoading(true);
    abortRef.current = new AbortController();
    try {
      const freshItem = useInfographicStore.getState().items.find(i => i.id === editing.id);
      if (!freshItem) { setMessages(m => [...m, { role: 'assistant', text: 'Infographic was removed.' }]); return; }
      const reply = await chatEdit(next, freshItem.json, abortRef.current.signal);
      const cleaned = reply.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      let jsonStr = cleaned;
      const start = cleaned.indexOf('{');
      if (start !== -1) {
        let depth = 0, end = start;
        for (let i = start; i < cleaned.length; i++) {
          if (cleaned[i] === '{') depth++;
          else if (cleaned[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
        }
        jsonStr = cleaned.slice(start, end + 1);
      }
      const parsed = parseInfographicData(jsonStr);
      if (parsed && parsed.points?.length) {
        update(editing.id, jsonStr);
        setMessages(m => [...m, { role: 'assistant', text: 'Done! I\'ve updated the infographic. Anything else?' }]);
      } else {
        setMessages(m => [...m, { role: 'assistant', text: reply }]);
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') setMessages(m => [...m, { role: 'assistant', text: `Error: ${e.message}` }]);
    } finally { setLoading(false); }
  }, [input, loading, editing, update]);

  // ─── HOME VIEW ───
  if (!editingId) {
    return (
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>
        <div style={{ padding: 'var(--space-6) var(--space-8)', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
              <h1 style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0 }}>Infographics</h1>
              {items.length > 0 && <span style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>{items.length}</span>}
            </div>
            <button className="btn btn-primary" onClick={createNew}>+ New infographic</button>
          </div>

          {items.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'var(--space-8)' }}>
              <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-xl)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-5)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 5 4-9"/></svg>
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>No infographics yet</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', maxWidth: 300, lineHeight: 1.5, marginBottom: 'var(--space-6)' }}>Create one from scratch or generate from a workflow.</div>
              <button className="btn btn-primary" onClick={createNew}>+ Create infographic</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
              {items.map(item => {
                const data = parseInfographicData(item.json);
                const title = data?.title || item.label || 'Untitled';
                const svgStr = data ? renderSVG(data) : null;
                return (
                  <div key={item.id} onClick={() => setEditingId(item.id)}
                    style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'transform 150ms ease-out, box-shadow 150ms ease-out, border-color 150ms ease-out' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = 'var(--color-border-strong)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--color-border-default)'; }}>
                    {/* SVG preview */}
                    <div style={{ height: 140, overflow: 'hidden', background: 'var(--color-bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      {svgStr ? (
                        <div dangerouslySetInnerHTML={{ __html: svgStr }} style={{ width: '100%', height: '100%', lineHeight: 0, transform: 'scale(0.5)', transformOrigin: 'top center' }} />
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-disabled)" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 5 4-9"/></svg>
                      )}
                    </div>
                    {/* Title + delete */}
                    <div style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{title}</span>
                      <button onClick={e => { e.stopPropagation(); remove(item.id); }}
                        style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-disabled)', padding: 4, borderRadius: 'var(--radius-sm)', opacity: 0, transition: 'opacity 100ms' }}
                        className="ig-card-delete">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <style>{`.ig-card-delete { opacity: 0 !important; } div:hover > div > .ig-card-delete { opacity: 1 !important; } @media (max-width: 639px) { div[style*="grid-template-columns: repeat(3"] { grid-template-columns: 1fr !important; } }`}</style>
      </div>
    );
  }

  // ─── EDITOR VIEW ───
  const svg = editing ? (() => { const d = parseInfographicData(editing.json); return d ? renderSVG(d) : null; })() : null;

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--color-bg)' }}>
      {/* Left — Full-width infographic */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-3) var(--space-6)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexShrink: 0 }}>
          <button onClick={() => setEditingId(null)} className="btn btn-ghost" style={{ padding: 'var(--space-1) var(--space-2)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          </button>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', flex: 1 }}>Infographics</span>
          <button onClick={async () => {
            const el = document.getElementById('ig-editor-preview');
            if (!el) return;
            const { toPng } = await import('html-to-image');
            const url = await toPng(el, { pixelRatio: 3 });
            const a = document.createElement('a'); a.href = url; a.download = 'infographic.png'; a.click();
          }} className="btn btn-sm btn-ghost">Export PNG</button>
          <button onClick={() => {
            if (!editing) return;
            const d = parseInfographicData(editing.json);
            if (!d) return;
            const s = renderSVG(d);
            const blob = new Blob([s], { type: 'image/svg+xml' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'infographic.svg'; a.click();
          }} className="btn btn-sm btn-ghost">Export SVG</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)' }}>
          {svg && <div id="ig-editor-preview" dangerouslySetInnerHTML={{ __html: svg }} style={{ width: '100%', maxWidth: 800, lineHeight: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }} />}
        </div>
      </div>

      {/* Right — Chat */}
      <div style={{ width: 360, flexShrink: 0, borderLeft: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-card)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: 'var(--space-4) var(--space-4) var(--space-3)', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 2 }}>
            <div style={{ width: 6, height: 6, borderRadius: 'var(--radius-full)', background: 'var(--color-success-text, #22c55e)' }} />
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>AI Editor</span>
          </div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', paddingLeft: 14 }}>Editing: {(() => { const d = editing ? parseInfographicData(editing.json) : null; return d?.title || 'Untitled'; })()}</div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* Welcome — only when no messages yet */}
          {messages.length === 0 && (
            <>
              <div style={{ padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-surface)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)', lineHeight: 'var(--leading-relaxed)' }}>
                Describe any change — I'll update the infographic instantly. Try one of the suggestions below.
              </div>
              {/* Contextual suggestions — shown prominently in empty state */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                {SUGGESTION_CHIPS.map(chip => (
                  <button key={chip} onClick={() => send(chip)}
                    style={{ textAlign: 'left', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-default)', background: 'var(--color-bg-card)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)', cursor: 'pointer', transition: 'border-color 120ms, background 120ms, transform 120ms', width: '100%' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.background = 'var(--color-bg-surface)'; e.currentTarget.style.transform = 'translateX(2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; e.currentTarget.style.background = 'var(--color-bg-card)'; e.currentTarget.style.transform = 'none'; }}
                  >→ {chip}</button>
                ))}
              </div>
            </>
          )}

          {/* Conversation */}
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
              {msg.role === 'assistant' && (
                <div style={{ width: 20, height: 20, borderRadius: 'var(--radius-full)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v4"/><path d="M22 12h-4"/><path d="M12 18v4"/><path d="M2 12h4"/></svg>
                </div>
              )}
              <div style={{
                maxWidth: '80%', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)',
                background: msg.role === 'user' ? 'var(--color-accent)' : 'var(--color-bg-surface)',
                fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)',
                color: msg.role === 'user' ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
                lineHeight: 'var(--leading-relaxed)', whiteSpace: 'pre-wrap',
              }}>{msg.text}</div>
            </div>
          ))}

          {/* Loading indicator with context */}
          {loading && (
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <div style={{ width: 20, height: 20, borderRadius: 'var(--radius-full)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M12 2v4"/><path d="M22 12h-4"/><path d="M12 18v4"/><path d="M2 12h4"/></svg>
              </div>
              <div style={{ padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-surface)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>
                Updating infographic…
              </div>
            </div>
          )}

          {/* Inline quick actions after conversation starts */}
          {!loading && messages.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'var(--space-1)' }}>
              {['Add point', 'Change colors', 'Edit title'].map(chip => (
                <button key={chip} onClick={() => send(chip)}
                  style={{ padding: '3px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border-default)', background: 'transparent', fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', cursor: 'pointer', transition: 'border-color 120ms' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; }}
                >{chip}</button>
              ))}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-card)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', background: 'var(--color-bg)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: '2px 2px 2px var(--space-3)', transition: 'border-color 150ms' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
              placeholder={messages.length === 0 ? 'Try "Change the title to…"' : 'What else to change?'}
              disabled={loading}
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', lineHeight: 'var(--leading-relaxed)' }} />
            <button onClick={() => send()} disabled={loading || !input.trim()}
              style={{ width: 28, height: 28, borderRadius: 'var(--radius-md)', border: 'none', background: input.trim() ? 'var(--color-accent)' : 'transparent', color: input.trim() ? 'var(--color-text-inverse)' : 'var(--color-text-disabled)', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 120ms', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
