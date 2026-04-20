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
        <div style={{ padding: 'var(--space-6) var(--space-8)', maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <h1 style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0 }}>Infographics</h1>
              {items.length > 0 && <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', background: 'var(--color-bg-surface)', padding: '2px 8px', borderRadius: 99 }}>{items.length}</span>}
            </div>
            <button onClick={createNew} className="btn btn-sm btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New
            </button>
          </div>

          {items.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', padding: 'var(--space-8) var(--space-6)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--color-border-strong)', background: 'var(--color-bg-card)', marginTop: 'calc(25vh - 80px)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--color-text-tertiary)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 5 4-9"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', marginBottom: 2 }}>No infographics yet</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Create one from scratch or generate from a workflow</div>
              </div>
              <button onClick={createNew} className="btn btn-sm btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Create
              </button>
            </div>
          ) : (
            <div style={{ background: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)', overflow: 'hidden' }}>
              {items.map((item, i) => {
                const data = parseInfographicData(item.json);
                const title = data?.title || item.label || 'Untitled';
                const pointCount = data?.points?.length || 0;
                return (
                  <div key={item.id} onClick={() => setEditingId(item.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', cursor: 'pointer', borderBottom: i < items.length - 1 ? '1px solid var(--color-border-subtle)' : 'none', transition: 'background 100ms' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                    <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'var(--color-bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--color-text-tertiary)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 5 4-9"/></svg>
                    </div>
                    <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', flexShrink: 0 }}>{pointCount} points</span>
                    <button onClick={e => { e.stopPropagation(); remove(item.id); }}
                      style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-disabled)', padding: 4, borderRadius: 'var(--radius-sm)', opacity: 0.4, transition: 'opacity 100ms' }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '0.4'; }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
      <div style={{ width: 340, flexShrink: 0, borderLeft: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-card)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>Edit with AI</div>
          <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>Describe changes to your infographic</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {messages.length === 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ maxWidth: '85%', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', lineHeight: 'var(--leading-relaxed)' }}>
                I can edit this infographic for you. Try changing the title, adding data points, updating stats, or adjusting colors. What would you like to change?
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '85%', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)', background: msg.role === 'user' ? 'var(--color-bg-surface)' : 'var(--color-bg-card)', border: msg.role === 'assistant' ? '1px solid var(--color-border-subtle)' : 'none', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', lineHeight: 'var(--leading-relaxed)', whiteSpace: 'pre-wrap' }}>{msg.text}</div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', gap: 'var(--space-1)', padding: 'var(--space-3)' }}>
              {[0, 1, 2].map(i => <div key={i} style={{ width: 'var(--size-status-dot)', height: 'var(--size-status-dot)', borderRadius: 'var(--radius-full)', background: 'var(--color-text-disabled)', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
            </div>
          )}

          {!loading && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              {SUGGESTION_CHIPS.map(chip => (
                <button key={chip} onClick={() => send(chip)}
                  style={{ padding: 'var(--space-1) var(--space-3)', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border-default)', background: 'var(--color-bg-card)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)', cursor: 'pointer', transition: 'border-color 150ms, background 150ms' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; e.currentTarget.style.background = 'var(--color-bg-card)'; }}
                >{chip}</button>
              ))}
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div style={{ padding: 'var(--space-3)', borderTop: '1px solid var(--color-border-subtle)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Describe what to change…" rows={1}
              style={{ flex: 1, resize: 'none', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', background: 'var(--color-bg-card)', outline: 'none', lineHeight: 'var(--leading-relaxed)' }} />
            <button onClick={() => send()} disabled={loading || !input.trim()}
              style={{ width: 'var(--size-control-md)', height: 'var(--size-control-md)', borderRadius: 'var(--radius-md)', border: 'none', background: input.trim() ? 'var(--color-accent)' : 'var(--color-bg-surface)', color: input.trim() ? 'var(--color-text-inverse)' : 'var(--color-text-disabled)', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background var(--duration-base) var(--ease-default)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4z"/><path d="m22 2-11 11"/></svg>
            </button>
          </div>
          <div style={{ marginTop: 'var(--space-2)', fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)', textAlign: 'right' }}>⏎ Enter to send</div>
        </div>
      </div>
    </div>
  );
}
