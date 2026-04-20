import { useState, useRef, useEffect, useCallback } from 'react';
import { useInfographicStore, type InfographicItem } from '../../store/infographicStore';
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

The JSON schema is: { "title": string, "subtitle"?: string, "points": [{ "stat": string, "label": string, "detail"?: string }] }`;

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

export default function InfographicsPanel() {
  const { items, update, remove } = useInfographicStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const selected = items.find(i => i.id === selectedId) || items[0] || null;
  useEffect(() => { if (!selectedId && items.length) setSelectedId(items[0].id); }, [items, selectedId]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { setMessages([]); }, [selectedId]);

  const getSvg = (item: InfographicItem) => {
    const data = parseInfographicData(item.json);
    return data ? renderSVG(data) : null;
  };

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading || !selected) return;
    if (!text) setInput('');
    const next: ChatMsg[] = [...messages, { role: 'user', text: msg }];
    setMessages(next);
    setLoading(true);
    abortRef.current = new AbortController();
    try {
      const reply = await chatEdit(next, selected.json, abortRef.current.signal);
      const cleaned = reply.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = parseInfographicData(cleaned);
      if (parsed && parsed.points?.length) {
        update(selected.id, cleaned);
        setMessages(m => [...m, { role: 'assistant', text: 'Done! I\'ve updated the infographic. Anything else?' }]);
      } else {
        setMessages(m => [...m, { role: 'assistant', text: reply }]);
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') setMessages(m => [...m, { role: 'assistant', text: `Error: ${e.message}` }]);
    } finally { setLoading(false); }
  }, [input, loading, messages, selected, update]);

  const exportPng = async () => {
    const el = document.getElementById('ig-panel-preview');
    if (!el) return;
    const { toPng } = await import('html-to-image');
    const url = await toPng(el, { pixelRatio: 3 });
    const a = document.createElement('a'); a.href = url; a.download = 'infographic.png'; a.click();
  };

  const exportSvg = () => {
    if (!selected) return;
    const data = parseInfographicData(selected.json);
    if (!data) return;
    const svg = renderSVG(data);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'infographic.svg'; a.click();
  };

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--color-bg)' }}>
      {/* Left — Infographic Canvas */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top Bar */}
        <div style={{ padding: 'var(--space-3) var(--space-6)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h1 style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0 }}>Infographics</h1>
          {selected && (
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button onClick={exportPng} className="btn btn-sm btn-ghost">Export PNG</button>
              <button onClick={exportSvg} className="btn btn-sm btn-ghost">Export SVG</button>
            </div>
          )}
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6) var(--space-8)' }}>
          {items.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'var(--space-10)', minHeight: 300 }}>
              <div style={{ width: 'var(--space-12)', height: 'var(--space-12)', borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-5)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 5 4-9"/></svg>
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>No infographics yet</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', maxWidth: 280, lineHeight: 'var(--leading-snug)' }}>Generate an infographic in a workflow, then click it and send it here</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {items.map(item => {
                const svg = getSvg(item);
                const isSelected = selected?.id === item.id;
                return (
                  <div key={item.id} onClick={() => setSelectedId(item.id)} id={isSelected ? 'ig-panel-preview' : undefined}
                    style={{
                      borderRadius: 'var(--radius-lg)', overflow: 'hidden', cursor: 'pointer',
                      border: `2px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border-default)'}`,
                      boxShadow: isSelected ? 'var(--shadow-md)' : 'none',
                      transition: 'border-color 150ms, box-shadow 150ms',
                      position: 'relative',
                    }}>
                    {svg && <div dangerouslySetInnerHTML={{ __html: svg }} style={{ width: '100%', lineHeight: 0 }} />}
                    <button onClick={e => { e.stopPropagation(); remove(item.id); }}
                      style={{ position: 'absolute', top: 'var(--space-2)', right: 'var(--space-2)', width: 24, height: 24, borderRadius: 'var(--radius-md)', background: 'var(--color-overlay-light)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', opacity: 0, transition: 'opacity 150ms' }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '0'; }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right — Chat */}
      <div style={{ width: 340, flexShrink: 0, borderLeft: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-card)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>Edit with AI</div>
          <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>
            {selected ? 'Describe changes to your infographic' : 'Select an infographic to start'}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* AI Greeting */}
          {messages.length === 0 && selected && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                maxWidth: '85%', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)',
                background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)',
                fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)',
                lineHeight: 'var(--leading-relaxed)',
              }}>
                I can edit this infographic for you. Try changing the title, adding data points, updating stats, or adjusting the layout. What would you like to change?
              </div>
            </div>
          )}

          {messages.length === 0 && !selected && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'var(--space-6)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)', lineHeight: 'var(--leading-snug)' }}>
                Send an infographic here from a workflow to start editing
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '85%', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)',
                background: msg.role === 'user' ? 'var(--color-bg-surface)' : 'var(--color-bg-card)',
                border: msg.role === 'assistant' ? '1px solid var(--color-border-subtle)' : 'none',
                fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)',
                lineHeight: 'var(--leading-relaxed)', whiteSpace: 'pre-wrap',
              }}>{msg.text}</div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', gap: 'var(--space-1)', padding: 'var(--space-3)' }}>
              {[0, 1, 2].map(i => <div key={i} style={{ width: 'var(--size-status-dot)', height: 'var(--size-status-dot)', borderRadius: 'var(--radius-full)', background: 'var(--color-text-disabled)', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
            </div>
          )}

          {/* Suggestion Chips */}
          {!loading && selected && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              {SUGGESTION_CHIPS.map(chip => (
                <button key={chip} onClick={() => send(chip)}
                  style={{
                    padding: 'var(--space-1) var(--space-3)', borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--color-border-default)', background: 'var(--color-bg-card)',
                    fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)',
                    cursor: 'pointer', transition: 'border-color 150ms, background 150ms',
                  }}
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
              placeholder={selected ? 'Describe what to change…' : 'Send an infographic first'}
              disabled={!selected} rows={1}
              style={{
                flex: 1, resize: 'none', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)',
                padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)',
                color: 'var(--color-text-primary)', background: 'var(--color-bg-card)', outline: 'none',
                lineHeight: 'var(--leading-relaxed)',
              }} />
            <button onClick={() => send()} disabled={loading || !input.trim() || !selected}
              style={{
                width: 'var(--size-control-md)', height: 'var(--size-control-md)', borderRadius: 'var(--radius-md)',
                border: 'none', background: input.trim() && selected ? 'var(--color-accent)' : 'var(--color-bg-surface)',
                color: input.trim() && selected ? 'var(--color-text-inverse)' : 'var(--color-text-disabled)',
                cursor: input.trim() && selected ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background var(--duration-base) var(--ease-default)',
              }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4z"/><path d="m22 2-11 11"/></svg>
            </button>
          </div>
          <div style={{ marginTop: 'var(--space-2)', fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)', textAlign: 'right' }}>⏎ Enter to send</div>
        </div>
      </div>
    </div>
  );
}
