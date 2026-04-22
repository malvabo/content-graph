import { useState, useRef, useEffect, useCallback } from 'react';
import { useInfographicStore } from '../../store/infographicStore';
import { useSettingsStore } from '../../store/settingsStore';
import { renderSVG, parseInfographicData, type InfographicData } from '../nodes/InfographicNode';

interface ChatMsg { role: 'user' | 'assistant'; text: string }

type Point = InfographicData['points'][number];

interface StructuredEditorProps {
  data: InfographicData;
  onTextChange: (field: 'title' | 'subtitle' | 'footer', value: string) => void;
  onPointsChange: (mutator: (points: Point[]) => Point[]) => void;
}

function StructuredEditor({ data, onTextChange, onPointsChange }: StructuredEditorProps) {
  // Local mirror so the inputs stay responsive while the debounced save runs.
  const [title, setTitle] = useState(data.title);
  const [subtitle, setSubtitle] = useState(data.subtitle || '');
  const [footer, setFooter] = useState(data.footer || '');
  useEffect(() => { setTitle(data.title); setSubtitle(data.subtitle || ''); setFooter(data.footer || ''); }, [data]);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 10px', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)',
    color: 'var(--color-text-primary)', background: 'var(--color-bg-card)',
    border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', fontWeight: 500,
    color: 'var(--color-text-tertiary)', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em',
  };

  const addPoint = () => onPointsChange(p => [...p, { stat: '0', label: 'New point' }]);
  const removePoint = (i: number) => onPointsChange(p => p.filter((_, idx) => idx !== i));
  const movePoint = (i: number, dir: -1 | 1) => onPointsChange(p => {
    const j = i + dir;
    if (j < 0 || j >= p.length) return p;
    const next = [...p];
    const [a, b] = [next[i], next[j]];
    next[i] = b; next[j] = a;
    return next;
  });
  const patchPoint = (i: number, patch: Partial<Point>) => onPointsChange(p =>
    p.map((pt, idx) => idx === i ? { ...pt, ...patch } : pt)
  );

  return (
    <div style={{ width: '100%', maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Text fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Title</label>
          <input style={inputStyle} value={title}
            onChange={e => { setTitle(e.target.value); onTextChange('title', e.target.value); }} />
        </div>
        <div>
          <label style={labelStyle}>Subtitle</label>
          <input style={inputStyle} value={subtitle} placeholder="Optional"
            onChange={e => { setSubtitle(e.target.value); onTextChange('subtitle', e.target.value); }} />
        </div>
        <div>
          <label style={labelStyle}>Footer</label>
          <input style={inputStyle} value={footer} placeholder="Optional"
            onChange={e => { setFooter(e.target.value); onTextChange('footer', e.target.value); }} />
        </div>
      </div>

      {/* Points editor */}
      <div style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <label style={labelStyle}>Data points</label>
          <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)' }}>{data.points.length}</span>
        </div>

        {data.points.map((p, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 1fr auto', gap: 'var(--space-2)', alignItems: 'center' }}>
            <input style={{ ...inputStyle, fontWeight: 600 }} value={p.stat} placeholder="Stat" aria-label={`Point ${i + 1} stat`}
              onChange={e => patchPoint(i, { stat: e.target.value })} />
            <input style={inputStyle} value={p.label} placeholder="Label" aria-label={`Point ${i + 1} label`}
              onChange={e => patchPoint(i, { label: e.target.value })} />
            <div style={{ display: 'flex', gap: 4 }}>
              <button aria-label="Move up" disabled={i === 0} onClick={() => movePoint(i, -1)}
                style={{ width: 28, height: 28, border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-card)', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? 'var(--color-text-disabled)' : 'var(--color-text-secondary)', fontSize: 12 }}>↑</button>
              <button aria-label="Move down" disabled={i === data.points.length - 1} onClick={() => movePoint(i, 1)}
                style={{ width: 28, height: 28, border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-card)', cursor: i === data.points.length - 1 ? 'default' : 'pointer', color: i === data.points.length - 1 ? 'var(--color-text-disabled)' : 'var(--color-text-secondary)', fontSize: 12 }}>↓</button>
              <button aria-label="Delete point" onClick={() => removePoint(i)}
                style={{ width: 28, height: 28, border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-card)', cursor: 'pointer', color: 'var(--color-danger-text)', fontSize: 14 }}>×</button>
            </div>
          </div>
        ))}

        <button onClick={addPoint} className="btn btn-ghost" style={{ alignSelf: 'flex-start', fontSize: 'var(--text-sm)', marginTop: 4 }}>
          + Add point
        </button>
      </div>
    </div>
  );
}

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
  const { items, add, update, remove, pushHistory, popHistory } = useInfographicStore();
  const [editingId, setEditingId] = useState<string | null>(initialEditId || null);
  useEffect(() => { if (initialEditId) setEditingId(initialEditId); }, [initialEditId]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMsg[]>(messages);
  messagesRef.current = messages;
  const [, setFontTick] = useState(0);
  const [editVersion, setEditVersion] = useState(0);

  const editing = items.find(i => i.id === editingId) || null;
  const settings = useSettingsStore.getState();
  const hasApiKey = !!(settings.anthropicKey || settings.groqKey);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { setMessages([]); }, [editingId]);
  useEffect(() => { return () => { abortRef.current?.abort(); }; }, []);
  useEffect(() => {
    if (!menuId) return;
    const h = (e: Event) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuId]);

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
      // Try JSON.parse directly first, then extract
      let parsed = parseInfographicData(cleaned);
      if (!parsed) {
        // Extract JSON from surrounding text — handle strings with braces via JSON.parse attempts
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
      if (parsed && parsed.points) {
        pushHistory(editing.id, freshItem.json);
        const jsonStr = JSON.stringify(parsed);
        update(editing.id, jsonStr);
        setEditVersion(v => v + 1);
        setMessages(m => [...m, { role: 'assistant', text: 'Done! I\'ve updated the infographic. Anything else?' }]);
      } else {
        setMessages(m => [...m, { role: 'assistant', text: reply }]);
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') setMessages(m => [...m, { role: 'assistant', text: `Error: ${e.message}` }]);
    } finally { setLoading(false); }
  }, [input, loading, editing, update, pushHistory]);

  const undo = useCallback(() => {
    if (!editing) return;
    const prev = popHistory(editing.id);
    if (!prev) return;
    update(editing.id, prev);
    setEditVersion(v => v + 1);
    setMessages(m => [...m, { role: 'assistant', text: 'Reverted to previous version.' }]);
  }, [editing, update, popHistory]);

  // Direct (non-LLM) mutations used by the structured editor. Every edit
  // snapshots the prior JSON onto history so Undo covers direct edits too.
  const applyDirectEdit = useCallback((mutator: (d: InfographicData) => void) => {
    if (!editing) return;
    const current = parseInfographicData(editing.json);
    if (!current) return;
    const next: InfographicData = JSON.parse(JSON.stringify(current));
    mutator(next);
    pushHistory(editing.id, editing.json);
    update(editing.id, JSON.stringify(next));
    setEditVersion(v => v + 1);
  }, [editing, update, pushHistory]);

  // Debounced text-field saves avoid flooding history during typing.
  const debounceRef = useRef<number | null>(null);
  const scheduleTextEdit = useCallback((field: 'title' | 'subtitle' | 'footer', value: string) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      applyDirectEdit(d => {
        if (field === 'title') d.title = value;
        else if (value) d[field] = value; else delete d[field];
      });
    }, 350);
  }, [applyDirectEdit]);
  useEffect(() => () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); }, []);

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
  const currentData = editing ? parseInfographicData(editing.json) : null;
  const currentType = currentData?.type || 'cards';
  const hasHistory = !!(editing?.history && editing.history.length > 0);

  const setType = (t: 'cards' | 'bar' | 'pie') => {
    if (!currentData || currentType === t) return;
    applyDirectEdit(d => { d.type = t; });
  };

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--color-bg)' }}>
      {/* Left — preview + structured editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-3) var(--space-6)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexShrink: 0 }}>
          <button onClick={() => setEditingId(null)} className="btn btn-ghost" style={{ padding: 'var(--space-1) var(--space-2)' }} aria-label="Back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          </button>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Infographics</span>

          {/* Chart-type segmented control */}
          <div role="tablist" aria-label="Chart type"
            style={{ display: 'inline-flex', padding: 2, borderRadius: 'var(--radius-md)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
            {(['cards', 'bar', 'pie'] as const).map(t => (
              <button key={t} role="tab" aria-selected={currentType === t}
                onClick={() => setType(t)}
                style={{
                  padding: '4px 12px', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', fontWeight: 500,
                  border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  background: currentType === t ? 'var(--color-bg-card)' : 'transparent',
                  color: currentType === t ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                  boxShadow: currentType === t ? 'var(--shadow-sm)' : 'none',
                  textTransform: 'capitalize',
                }}>
                {t}
              </button>
            ))}
          </div>

          <span style={{ flex: 1 }} />
          {hasHistory && <button onClick={undo} className="btn btn-sm btn-ghost">↩ Undo</button>}
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

        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-6)' }}>
          {svg && <div id="ig-editor-preview" key={editVersion} dangerouslySetInnerHTML={{ __html: svg }} style={{ width: '100%', maxWidth: 800, lineHeight: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }} />}

          {currentData && editing && (
            <StructuredEditor
              key={editing.id}
              data={currentData}
              onTextChange={scheduleTextEdit}
              onPointsChange={(mutator) => applyDirectEdit(d => { d.points = mutator(d.points); })}
            />
          )}
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
          {!loading && messages.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['Add point', 'Change colors', 'Edit title'].map(chip => (
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
