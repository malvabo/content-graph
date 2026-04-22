import { useState, useRef, useEffect, useCallback } from 'react';
import { useInfographicStore } from '../../store/infographicStore';
import { useSettingsStore } from '../../store/settingsStore';
import { renderSVG, parseInfographicData } from '../nodes/InfographicNode';
import { diffInfographic } from '../../utils/infographicDiff';

interface ChatMsg { role: 'user' | 'assistant'; text: string }

interface PendingApply { json: string; short: string; labels: string[] }

const SUGGESTION_CHIPS = [
  'Rewrite the title to be punchier',
  'Add 2 more data points',
  'Convert stats to percentages',
  'Shorten all labels',
  'Add a subtitle',
  'Remove the last point',
];

async function chatEdit(messages: ChatMsg[], currentJson: string, signal?: AbortSignal): Promise<string> {
  const { anthropicKey, groqKey } = useSettingsStore.getState();
  const system = `You edit infographic content. Return ONLY valid JSON — no explanation, no markdown fences. Do not invent styling. Do not add or remove fields not mentioned.

Schema: { title, subtitle?, footer?, type?: "cards" | "bar" | "pie", points: [{ stat, label, detail?, icon?, max? }] }
- type: "cards" default, "bar" for horizontal bars, "pie" for pie chart with legend.
- points[].icon: emoji shown above the stat (optional).
- points[].max: when present, renders a progress bar for stat / max.

Current infographic JSON:
${currentJson}`;

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

export default function InfographicsPanel({ initialEditId }: { initialEditId?: string }) {
  const { items, add, update, remove } = useInfographicStore();
  const pushHistory = useInfographicStore(s => s.pushHistory);
  const undoStore = useInfographicStore(s => s.undo);
  const redoStore = useInfographicStore(s => s.redo);
  const restoreHistory = useInfographicStore(s => s.restoreHistory);
  const [editingId, setEditingId] = useState<string | null>(initialEditId || null);
  useEffect(() => { if (initialEditId) setEditingId(initialEditId); }, [initialEditId]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pending, setPending] = useState<PendingApply | null>(null);
  const [pendingJsonOpen, setPendingJsonOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMsg[]>(messages);
  messagesRef.current = messages;
  const [, setFontTick] = useState(0);
  const [editVersion, setEditVersion] = useState(0);

  const editing = items.find(i => i.id === editingId) || null;
  const settings = useSettingsStore.getState();
  const hasApiKey = !!(settings.anthropicKey || settings.groqKey);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { setMessages([]); setPending(null); setPendingJsonOpen(false); }, [editingId]);
  useEffect(() => { return () => { abortRef.current?.abort(); }; }, []);
  useEffect(() => {
    if (!menuId) return;
    const h = (e: Event) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuId]);
  useEffect(() => {
    if (!historyOpen) return;
    const h = (e: Event) => { if (historyRef.current && !historyRef.current.contains(e.target as Node)) setHistoryOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [historyOpen]);

  const createNew = () => {
    const id = `ig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    add({ id, nodeId: id, label: 'New Infographic', json: DEFAULT_JSON });
    setEditingId(id);
  };

  const applyParsed = useCallback((parsedJson: string, label: string, previousJson: string, id: string) => {
    pushHistory(id, label, previousJson);
    update(id, parsedJson);
    setEditVersion(v => v + 1);
  }, [pushHistory, update]);

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading || !editing) return;
    if (!text) setInput('');
    setPending(null);
    setPendingJsonOpen(false);
    const next: ChatMsg[] = [...messagesRef.current, { role: 'user', text: msg }];
    setMessages(next);
    setLoading(true);
    abortRef.current = new AbortController();
    try {
      const freshItem = useInfographicStore.getState().items.find(i => i.id === editing.id);
      if (!freshItem) { setMessages(m => [...m, { role: 'assistant', text: 'Infographic was removed.' }]); return; }
      const reply = await chatEdit(next, freshItem.json, abortRef.current.signal);
      const cleaned = reply.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      let parsed = parseInfographicData(cleaned);
      if (!parsed) {
        const start = cleaned.indexOf('{');
        if (start !== -1) {
          for (let end = cleaned.length - 1; end > start; end--) {
            if (cleaned[end] === '}') {
              parsed = parseInfographicData(cleaned.slice(start, end + 1));
              if (parsed) break;
            }
          }
        }
      }
      if (parsed && parsed.points?.length) {
        const previous = parseInfographicData(freshItem.json);
        const diff = previous ? diffInfographic(previous, parsed) : { labels: ['updated'], short: 'updated', large: false };
        const jsonStr = JSON.stringify(parsed);
        if (diff.large) {
          setPending({ json: jsonStr, labels: diff.labels, short: diff.short });
          setMessages(m => [...m, { role: 'assistant', text: `Proposed change: ${diff.short}. Review and apply below.` }]);
        } else {
          applyParsed(jsonStr, diff.short, freshItem.json, editing.id);
          setMessages(m => [...m, { role: 'assistant', text: `Applied (${diff.short}). Undo available if needed.` }]);
        }
      } else {
        setMessages(m => [...m, { role: 'assistant', text: 'I couldn\'t produce a valid update for that. Try rephrasing — e.g. "rewrite the title to be punchier" or "add 2 more points about X".' }]);
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') setMessages(m => [...m, { role: 'assistant', text: `Error: ${e.message}` }]);
    } finally { setLoading(false); }
  }, [input, loading, editing, applyParsed]);

  const applyPending = useCallback(() => {
    if (!pending || !editing) return;
    const fresh = useInfographicStore.getState().items.find(i => i.id === editing.id);
    if (!fresh) return;
    applyParsed(pending.json, pending.short, fresh.json, editing.id);
    setMessages(m => [...m, { role: 'assistant', text: 'Applied. Undo available if needed.' }]);
    setPending(null);
    setPendingJsonOpen(false);
  }, [pending, editing, applyParsed]);

  const discardPending = useCallback(() => {
    setPending(null);
    setPendingJsonOpen(false);
    setMessages(m => [...m, { role: 'assistant', text: 'Discarded.' }]);
  }, []);

  const undo = useCallback(() => {
    if (!editing) return;
    const entry = undoStore(editing.id);
    if (!entry) return;
    setEditVersion(v => v + 1);
    setMessages(m => [...m, { role: 'assistant', text: `Undid: ${entry.label}` }]);
  }, [editing, undoStore]);

  const redo = useCallback(() => {
    if (!editing) return;
    const entry = redoStore(editing.id);
    if (!entry) return;
    setEditVersion(v => v + 1);
    setMessages(m => [...m, { role: 'assistant', text: `Redid: ${entry.label}` }]);
  }, [editing, redoStore]);

  const fontRerender = useCallback(() => setFontTick(t => t + 1), []);
  const svg = editing ? (() => { const d = parseInfographicData(editing.json); return d ? renderSVG(d, fontRerender) : null; })() : null;

  // ─── HOME VIEW ───
  if (!editingId) {
    return (
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>
        {/* Hero banner — title, subtitle, then button below */}
        <div className="p-4 md:p-8" style={{ minHeight: '30vh', backgroundImage: 'url(/infographics-hero.png)', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'flex-end', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
            <div>
              <h1 style={{ fontWeight: 'var(--weight-medium)', fontSize: 28, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0, letterSpacing: '-0.02em' }}>Infographics</h1>
              {items.length > 0 && <p style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', margin: 'var(--space-1) 0 0' }}>{items.length} infographic{items.length !== 1 ? 's' : ''}</p>}
            </div>
            <button className="btn btn-primary" onClick={createNew}>+ New infographic</button>
          </div>
        </div>

        <div className="p-4 md:px-8 md:py-6" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
              {items.map(item => {
                const data = parseInfographicData(item.json);
                const title = data?.title || item.label || 'Untitled';
                const canRender = data && Array.isArray(data.points) && data.points.length > 0;
                let svg: string | null = null;
                if (canRender) try { svg = renderSVG(data); } catch { svg = null; }
                return (
                  <div key={item.id} style={{ position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--color-border-default)', background: 'var(--color-bg-card)', cursor: 'pointer', transition: 'border-color .15s, box-shadow .15s' }}
                    onMouseEnter={e => { setHoverId(item.id); e.currentTarget.style.borderColor = 'var(--color-border-strong)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                    onMouseLeave={e => { setHoverId(null); e.currentTarget.style.borderColor = 'var(--color-border-default)'; e.currentTarget.style.boxShadow = 'none'; }}
                    onClick={() => setEditingId(item.id)}>
                    {svg && <div dangerouslySetInnerHTML={{ __html: svg }} style={{ width: '100%', maxHeight: 200, overflow: 'hidden', lineHeight: 0, borderBottom: '1px solid var(--color-border-subtle)' }} />}
                    <div style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>{data?.points?.length || 0} points</div>
                    </div>
                    {/* 3-dot menu — matches WorkflowLibrary */}
                    <div style={{ position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)', opacity: hoverId === item.id || menuId === item.id ? 1 : 0, transition: 'opacity 150ms', zIndex: 2 }}>
                      <div role="button" tabIndex={0} aria-label="More options"
                        style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', background: 'transparent', cursor: 'pointer', transition: 'color 150ms, background 150ms' }}
                        onClick={e => { e.stopPropagation(); setMenuId(menuId === item.id ? null : item.id); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                      </div>
                      {menuId === item.id && (
                        <div ref={menuRef} onClick={e => e.stopPropagation()}
                          style={{ position: 'absolute', top: 28, left: 0, zIndex: 50, background: 'var(--color-bg-popover)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', padding: 'var(--space-2)', minWidth: 150 }}>
                          {[
                            { label: 'Rename', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>, action: () => { const name = prompt('Rename', title); if (name?.trim()) { const d = parseInfographicData(item.json); if (d) { d.title = name.trim(); update(item.id, JSON.stringify(d)); } } setMenuId(null); } },
                            { label: 'Delete', danger: true, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>, action: () => { remove(item.id); setMenuId(null); } },
                          ].map(opt => (
                            <button key={opt.label} onClick={opt.action}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'none', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: (opt as any).danger ? 'var(--color-danger-text)' : 'var(--color-text-primary)', textAlign: 'left', transition: 'background 100ms' }}
                              onMouseEnter={e => { e.currentTarget.style.background = (opt as any).danger ? 'var(--color-danger-bg)' : 'var(--color-bg-surface)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                              <span style={{ color: (opt as any).danger ? 'var(--color-danger-text)' : 'var(--color-text-tertiary)', display: 'flex' }}>{opt.icon}</span>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
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

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--color-bg)' }}>
      {/* Left — Full-width infographic */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-3) var(--space-6)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexShrink: 0 }}>
          <button onClick={() => setEditingId(null)} className="btn btn-ghost" style={{ padding: 'var(--space-1) var(--space-2)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          </button>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', flex: 1 }}>Infographics</span>
          <button onClick={undo} disabled={!editing?.history?.length} className="btn btn-sm btn-ghost" aria-label="Undo" title={editing?.history?.length ? `Undo: ${editing.history[editing.history.length - 1].label}` : 'Nothing to undo'} style={{ opacity: editing?.history?.length ? 1 : 0.4 }}>↩ Undo</button>
          <button onClick={redo} disabled={!editing?.redoStack?.length} className="btn btn-sm btn-ghost" aria-label="Redo" title={editing?.redoStack?.length ? `Redo: ${editing.redoStack[editing.redoStack.length - 1].label}` : 'Nothing to redo'} style={{ opacity: editing?.redoStack?.length ? 1 : 0.4 }}>↪ Redo</button>
          <div ref={historyRef} style={{ position: 'relative' }}>
            <button onClick={() => setHistoryOpen(v => !v)} disabled={!editing?.history?.length} className="btn btn-sm btn-ghost" aria-label="History" style={{ opacity: editing?.history?.length ? 1 : 0.4 }}>History</button>
            {historyOpen && editing?.history?.length ? (
              <div style={{ position: 'absolute', top: 32, right: 0, zIndex: 50, background: 'var(--color-bg-popover)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', padding: 'var(--space-2)', minWidth: 220, maxHeight: 320, overflow: 'auto' }}>
                {[...editing.history].slice(-5).reverse().map((h, revIdx) => {
                  const absoluteIndex = (editing.history!.length - 1) - revIdx;
                  return (
                    <button key={absoluteIndex + '-' + h.ts} onClick={() => { restoreHistory(editing.id, absoluteIndex); setEditVersion(v => v + 1); setHistoryOpen(false); setMessages(m => [...m, { role: 'assistant', text: `Restored to: ${h.label}` }]); }}
                      style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: 'var(--space-2) var(--space-3)', background: 'none', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', textAlign: 'left', transition: 'background 100ms' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                      <span>{h.label}</span>
                      <span style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-disabled)', fontFamily: 'var(--font-mono)' }}>{new Date(h.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
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
          {svg && <div id="ig-editor-preview" key={editVersion} dangerouslySetInnerHTML={{ __html: svg }} style={{ width: '100%', maxWidth: 800, lineHeight: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }} />}
        </div>
      </div>

      {/* Right — Chat */}
      <div style={{ width: 360, flexShrink: 0, borderLeft: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-card)', display: 'flex', flexDirection: 'column' }}>
        {/* Header with mini preview */}
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          {svg && <div key={editVersion} dangerouslySetInnerHTML={{ __html: svg }} style={{ width: 48, height: 28, borderRadius: 4, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--color-border-subtle)' }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(() => { const d = editing ? parseInfographicData(editing.json) : null; return d?.title || 'Untitled'; })()}</div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>{(() => { const d = editing ? parseInfographicData(editing.json) : null; return d?.points?.length || 0; })()} data points</div>
          </div>
          <div style={{ width: 6, height: 6, borderRadius: 'var(--radius-full)', background: 'var(--color-success-text, #22c55e)', flexShrink: 0 }} />
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* API key warning */}
          {!hasApiKey && (
            <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-warning-text)', lineHeight: 'var(--leading-relaxed)' }}>
              Add an API key in <button onClick={() => { window.location.hash = 'settings'; }} style={{ background: 'none', border: 'none', textDecoration: 'underline', color: 'inherit', cursor: 'pointer', font: 'inherit', padding: 0 }}>Settings</button> to enable AI editing.
            </div>
          )}

          {/* Empty state */}
          {messages.length === 0 && (
            <>
              <div style={{ padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-surface)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)', lineHeight: 'var(--leading-relaxed)' }}>
                Describe any change — I'll update the infographic instantly.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                {SUGGESTION_CHIPS.map(chip => (
                  <button key={chip} onClick={() => send(chip)}
                    style={{ textAlign: 'left', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-default)', background: 'var(--color-bg-card)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)', cursor: 'pointer', transition: 'border-color 120ms, background 120ms', width: '100%' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; e.currentTarget.style.background = 'var(--color-bg-card)'; }}
                  >→ {chip}</button>
                ))}
              </div>
            </>
          )}

          {/* Conversation — no differentiation, no avatars */}
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '85%', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-surface)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', lineHeight: 'var(--leading-relaxed)', whiteSpace: 'pre-wrap' }}>{msg.text}</div>
            </div>
          ))}

          {/* Loading */}
          {loading && (
            <div style={{ padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-surface)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M12 2v4"/><path d="M22 12h-4"/><path d="M12 18v4"/><path d="M2 12h4"/></svg>
              Updating infographic…
            </div>
          )}

          {/* Quick actions after conversation starts */}
          {!loading && messages.length > 0 && !pending && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['Add point', 'Shorten labels', 'Edit title'].map(chip => (
                <button key={chip} onClick={() => send(chip)}
                  style={{ padding: '4px 12px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border-default)', background: 'transparent', fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', cursor: 'pointer', transition: 'border-color 120ms' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; }}
                >{chip}</button>
              ))}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Large-diff confirm bar */}
        {pending && (
          <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)' }}>Large change — confirm</div>
            <div style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', lineHeight: 'var(--leading-normal)' }}>{pending.labels.join(', ')}</div>
            {pendingJsonOpen && (
              <pre style={{ fontSize: 'var(--text-micro)', fontFamily: 'var(--font-mono)', background: 'var(--color-bg)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-2)', maxHeight: 160, overflow: 'auto', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{(() => { try { return JSON.stringify(JSON.parse(pending.json), null, 2); } catch { return pending.json; } })()}</pre>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button onClick={applyPending} className="btn btn-primary btn-sm">Apply</button>
              <button onClick={discardPending} className="btn btn-sm btn-ghost">Discard</button>
              <button onClick={() => setPendingJsonOpen(v => !v)} className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }}>{pendingJsonOpen ? 'Hide JSON' : 'Show JSON'}</button>
            </div>
          </div>
        )}

        {/* Input */}
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--color-border-subtle)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', background: 'var(--color-bg)', border: `1px solid ${input.trim() ? 'var(--color-accent)' : 'var(--color-border-default)'}`, borderRadius: 'var(--radius-lg)', padding: '2px 2px 2px var(--space-3)', transition: 'border-color 150ms' }}
            onMouseEnter={e => { if (!input.trim()) e.currentTarget.style.borderColor = 'var(--color-border-strong)'; }}
            onMouseLeave={e => { if (!input.trim()) e.currentTarget.style.borderColor = 'var(--color-border-default)'; }}>
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
