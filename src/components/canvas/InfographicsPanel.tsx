import { useState, useRef, useEffect, useCallback } from 'react';
import { Menu, MenuItem } from '../ui/Menu';
import { useInfographicStore } from '../../store/infographicStore';
import SearchBar from '../ui/SearchBar';
import { useSettingsStore } from '../../store/settingsStore';
import { useBrandsStore } from '../../store/brandsStore';
import { renderSVG, parseInfographicData, computeLayout, getInfographicPalette, INFOGRAPHIC_WIDTH, type InfographicData, type TextField } from '../nodes/InfographicNode';

interface ChatMsg { role: 'user' | 'assistant'; text: string }

type Point = InfographicData['points'][number];

interface SettingsSectionProps {
  data: InfographicData;
  onTextChange: (field: 'title' | 'subtitle' | 'footer', value: string) => void;
}

interface InlineInfographicProps {
  data: InfographicData;
  editVersion: number;
  onPointsChange: (mutator: (points: Point[]) => Point[]) => void;
  onTextChange: (field: 'title' | 'subtitle' | 'footer', value: string) => void;
  onFontLoad?: () => void;
}

// Renders the SVG with its text blanked out, then overlays editable inputs
// styled to match the SVG's font/color/size. No stroke, no background —
// typing just reflows the characters in place of the preview text.
function InlineInfographic({ data, editVersion, onPointsChange, onTextChange, onFontLoad }: InlineInfographicProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const layout = computeLayout(data);
  const palette = getInfographicPalette(onFontLoad);

  // Render SVG with every editable text field blanked, so only the HTML inputs
  // above show text. This keeps the visible text in exactly one place (the
  // input) and guarantees the caret sits exactly where the character renders.
  const blankedSvg = renderSVG({
    ...data,
    title: '',
    subtitle: data.subtitle !== undefined ? '' : undefined,
    footer: data.footer !== undefined ? '' : undefined,
    points: data.points.map(p => ({ ...p, stat: '', label: '', detail: p.detail !== undefined ? '' : undefined })),
  }, onFontLoad);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width || el.clientWidth;
      setScale(w / INFOGRAPHIC_WIDTH);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // mutedText mirrors the renderSVG math: 50% mix of text and bg for subtitle/footer,
  // 40% mix for card detail. We approximate with currentColor opacity since the
  // palette already exposes text + bg as hex.
  const muted50 = palette.text;  // subtitle/footer use this in SVG with mutedText; close enough visually
  // To keep parity with the SVG math without re-exporting mix(), we blend in CSS
  // by wrapping the input text in the same hex. Good-enough match: the visual
  // diff on the canvas is driven by weight + size, not the muted tint.

  const inputStyle = (f: TextField, color: string, family: string): React.CSSProperties => ({
    position: 'absolute',
    left: f.anchor === 'middle' ? (f.x - f.w / 2) * scale : f.x * scale,
    top: f.y * scale,
    width: f.w * scale,
    height: (f.h + 8) * scale,
    fontSize: f.fontSize * scale,
    fontWeight: f.fontWeight,
    textAlign: f.anchor === 'middle' ? 'center' : 'left',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    padding: 0,
    margin: 0,
    color,
    fontFamily: family,
    caretColor: color,
    cursor: 'text',
    boxSizing: 'border-box',
  });

  const mutatePoint = (i: number, patch: Partial<InfographicData['points'][number]>) =>
    onPointsChange(points => points.map((p, idx) => idx === i ? { ...p, ...patch } : p));

  return (
    <div ref={wrapRef} style={{ width: '100%', maxWidth: 800, position: 'relative', lineHeight: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <div key={editVersion} dangerouslySetInnerHTML={{ __html: blankedSvg }} />

      {/* Title — matches SVG: text color, title font */}
      <input
        aria-label="Infographic title"
        value={data.title}
        onChange={e => onTextChange('title', e.target.value)}
        style={inputStyle(layout.title, palette.text, palette.titleFontFamily)}
      />

      {/* Subtitle — muted tint, title font */}
      {layout.subtitle && (
        <input
          aria-label="Infographic subtitle"
          value={data.subtitle ?? ''}
          onChange={e => onTextChange('subtitle', e.target.value)}
          style={inputStyle(layout.subtitle, muted50, palette.titleFontFamily)}
        />
      )}

      {/* Footer — muted tint, body font */}
      {layout.footer && (
        <input
          aria-label="Infographic footer"
          value={data.footer ?? ''}
          onChange={e => onTextChange('footer', e.target.value)}
          style={inputStyle(layout.footer, muted50, palette.bodyFontFamily)}
        />
      )}

      {/* Per-point stat (accent color) / label (text color) / detail (muted) */}
      {layout.points.map((pf, i) => (
        <span key={i}>
          <input
            aria-label={`Point ${i + 1} stat`}
            value={data.points[i]?.stat ?? ''}
            onChange={e => mutatePoint(i, { stat: e.target.value })}
            style={inputStyle(pf.stat, palette.accent, palette.bodyFontFamily)}
          />
          <input
            aria-label={`Point ${i + 1} label`}
            value={data.points[i]?.label ?? ''}
            onChange={e => mutatePoint(i, { label: e.target.value })}
            style={inputStyle(pf.label, palette.text, palette.bodyFontFamily)}
          />
          {pf.detail && (
            <input
              aria-label={`Point ${i + 1} detail`}
              value={data.points[i]?.detail ?? ''}
              onChange={e => mutatePoint(i, { detail: e.target.value })}
              style={inputStyle(pf.detail, muted50, palette.bodyFontFamily)}
            />
          )}
        </span>
      ))}
    </div>
  );
}

// Collapsible per-infographic settings: title, subtitle, footer. Points are
// edited inline on the infographic itself.
function SettingsSection({ data, onTextChange }: SettingsSectionProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(data.title);
  const [subtitle, setSubtitle] = useState(data.subtitle || '');
  const [footer, setFooter] = useState(data.footer || '');
  useEffect(() => { setTitle(data.title); }, [data.title]);
  useEffect(() => { setSubtitle(data.subtitle || ''); }, [data.subtitle]);
  useEffect(() => { setFooter(data.footer || ''); }, [data.footer]);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 10px', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)',
    color: 'var(--color-text-primary)', background: 'var(--color-bg-card)',
    border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', fontWeight: 500,
    color: 'var(--color-text-tertiary)', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em',
  };

  return (
    <div style={{ width: '100%', maxWidth: 800, borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)' }}>
        <span>Settings</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 150ms', color: 'var(--color-text-tertiary)' }}><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {open && (
        <div style={{ padding: '0 var(--space-4) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div>
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
      )}
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

const DEFAULT_JSON = JSON.stringify({ title: 'New Infographic', subtitle: 'Edit fields directly or chat for AI changes', points: [{ stat: '0', label: 'Your first data point' }] });

export default function InfographicsPanel({ initialEditId, onExitEditor }: { initialEditId?: string; onExitEditor?: () => void }) {
  const { items, add, update, remove, pushHistory, popHistory } = useInfographicStore();
  const [editingId, setEditingId] = useState<string | null>(initialEditId || null);
  useEffect(() => { if (initialEditId) setEditingId(initialEditId); }, [initialEditId]);
  // Reflect editor state in the URL hash so App.tsx can detect the editor
  // (via hashParam) and hide the left nav.
  useEffect(() => {
    const base = 'infographics';
    const target = editingId ? `${base}:${editingId}` : base;
    if (window.location.hash !== `#${target}`) window.location.hash = target;
  }, [editingId]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMsg[]>(messages);
  messagesRef.current = messages;
  const [, setFontTick] = useState(0);
  const [editVersion, setEditVersion] = useState(0);

  const editing = items.find(i => i.id === editingId) || null;
  const anthropicKey = useSettingsStore(s => s.anthropicKey);
  const groqKey = useSettingsStore(s => s.groqKey);
  // Subscribe to brand so SVG previews re-render when colors/fonts change in
  // Settings or when the active library brand (global or per-flow) changes.
  // renderSVG reads via getState(), which isn't reactive on its own.
  useSettingsStore(s => s.brand);
  useBrandsStore(s => s.activeBrandId);
  useBrandsStore(s => s.brands);
  const hasApiKey = !!(anthropicKey || groqKey);

  // If the item being edited is deleted (e.g. via the library grid 3-dot menu),
  // drop back to the home view instead of showing an editor with null data.
  useEffect(() => { if (editingId && !editing) setEditingId(null); }, [editingId, editing]);

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

  // Direct (non-LLM) mutations used by the structured editor. Coalesce
  // rapid consecutive edits (typing in a point field) into a single undo
  // boundary so a 20-entry history cap isn't exhausted by one word.
  const coalesceRef = useRef<{ time: number; id: string | null }>({ time: 0, id: null });
  const applyDirectEdit = useCallback((mutator: (d: InfographicData) => void) => {
    if (!editing) return;
    const current = parseInfographicData(editing.json);
    if (!current) return;
    const next: InfographicData = JSON.parse(JSON.stringify(current));
    mutator(next);
    const now = Date.now();
    const c = coalesceRef.current;
    if (c.id !== editing.id || now - c.time > 600) {
      pushHistory(editing.id, editing.json);
    }
    coalesceRef.current = { time: now, id: editing.id };
    update(editing.id, JSON.stringify(next));
    setEditVersion(v => v + 1);
  }, [editing, update, pushHistory]);

  // Debounced text-field saves. One timer per field so editing subtitle
  // never cancels a pending title save. Each flush reads fresh store state
  // so overlapping flushes don't overwrite each other with stale snapshots.
  const debounceRefs = useRef<{ title: number | null; subtitle: number | null; footer: number | null }>({ title: null, subtitle: null, footer: null });
  const editingIdRef = useRef<string | null>(null);
  useEffect(() => { editingIdRef.current = editingId; }, [editingId]);
  const scheduleTextEdit = useCallback((field: 'title' | 'subtitle' | 'footer', value: string) => {
    const refs = debounceRefs.current;
    if (refs[field]) window.clearTimeout(refs[field]!);
    refs[field] = window.setTimeout(() => {
      const id = editingIdRef.current;
      if (!id) return;
      const fresh = useInfographicStore.getState().items.find(i => i.id === id);
      if (!fresh) return;
      const parsed = parseInfographicData(fresh.json);
      if (!parsed) return;
      const next: InfographicData = JSON.parse(JSON.stringify(parsed));
      if (field === 'title') next.title = value;
      else if (value) next[field] = value; else delete next[field];
      pushHistory(id, fresh.json);
      update(id, JSON.stringify(next));
      setEditVersion(v => v + 1);
      refs[field] = null;
    }, 350);
  }, [update, pushHistory]);
  useEffect(() => () => {
    // On unmount, clear any pending timers so they don't fire after the component is gone.
    const refs = debounceRefs.current;
    (['title', 'subtitle', 'footer'] as const).forEach(k => { if (refs[k]) window.clearTimeout(refs[k]!); });
  }, []);

  const fontRerender = useCallback(() => setFontTick(t => t + 1), []);
  const svg = editing ? (() => { const d = parseInfographicData(editing.json); return d ? renderSVG(d, fontRerender) : null; })() : null;

  // ─── HOME VIEW ───
  if (!editingId) {
    return (
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>
        {/* Top toolbar */}
        <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 5 4-9"/></svg>
            <h1 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>Infographics</h1>
          </div>
          <button className="btn btn-primary" onClick={createNew} style={{ borderRadius: 'var(--radius-full)' }}>+ New infographic</button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

          {/* Search */}
          {items.length > 0 && (
            <div style={{ marginBottom: 'var(--space-5)', width: 200 }}>
              <SearchBar value={query} onValueChange={setQuery} placeholder="Search…" aria-label="Search infographics" />
            </div>
          )}

          {items.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'var(--space-8)' }}>
              <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-xl)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-5)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 5 4-9"/></svg>
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>No infographics yet</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', maxWidth: 300, lineHeight: 1.5, marginBottom: 'var(--space-6)' }}>Create one from scratch or generate from a workflow.</div>
              <button className="btn btn-primary" onClick={createNew}>+ Create infographic</button>
            </div>
          ) : (() => {
            const filtered = items.filter(i => !query.trim() || (i.label || '').toLowerCase().includes(query.toLowerCase()) || (parseInfographicData(i.json)?.title || '').toLowerCase().includes(query.toLowerCase()));
            return (
              <>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
                  {filtered.length} infographic{filtered.length !== 1 ? 's' : ''}
                </div>
                {filtered.length === 0 ? (
                  <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                    No infographics match your search.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--space-4)' }}>
                    {filtered.map(item => {
                const data = parseInfographicData(item.json);
                const title = data?.title || item.label || 'Untitled';
                const canRender = data && Array.isArray(data.points) && data.points.length > 0;
                let svg: string | null = null;
                if (canRender) try { svg = renderSVG(data); } catch { svg = null; }
                return (
                  <div key={item.id} style={{ position: 'relative', zIndex: menuId === item.id ? 60 : 'auto', borderRadius: 'var(--radius-lg)', overflow: menuId === item.id ? 'visible' : 'hidden', border: '1px solid var(--color-border-default)', background: 'var(--color-bg-card)', cursor: 'pointer', transition: 'background .15s' }}
                    onMouseEnter={e => { setHoverId(item.id); e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
                    onMouseLeave={e => { setHoverId(null); e.currentTarget.style.background = 'var(--color-bg-card)'; }}
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
                        <Menu ref={menuRef} onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 28, left: 0, zIndex: 50 }}>
                          <MenuItem onClick={() => { const name = prompt('Rename', title); if (name?.trim()) { const d = parseInfographicData(item.json); if (d) { d.title = name.trim(); update(item.id, JSON.stringify(d)); } } setMenuId(null); }}>
                            Rename
                          </MenuItem>
                          <MenuItem danger onClick={() => { remove(item.id); setMenuId(null); }}>Delete</MenuItem>
                        </Menu>
                      )}
                    </div>
                  </div>
                    );
                  })}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    );
  }

  // ─── EDITOR VIEW ───
  const currentData = editing ? parseInfographicData(editing.json) : null;
  const hasHistory = !!(editing?.history && editing.history.length > 0);

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--color-bg)' }}>
      {/* Left — preview + structured editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-3) var(--space-6)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexShrink: 0 }}>
          <button onClick={() => { setEditingId(null); onExitEditor?.(); }} className="btn btn-ghost" style={{ padding: 'var(--space-1) var(--space-2)' }} aria-label="Back to infographics">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          </button>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Infographics</span>

          <span style={{ flex: 1 }} />
          {hasHistory && <button onClick={undo} className="btn btn-sm btn-ghost">↩ Undo</button>}
          <button onClick={async () => {
            const el = document.getElementById('ig-editor-preview');
            if (!el) return;
            const { toPng } = await import('html-to-image');
            const url = await toPng(el, { pixelRatio: 3 });
            const a = document.createElement('a'); a.href = url; a.download = 'infographic.png'; a.click();
          }} className="btn btn-sm btn-ghost">Export PNG</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-6)' }}>
          {currentData && (
            <InlineInfographic
              data={currentData}
              editVersion={editVersion}
              onPointsChange={(mutator) => applyDirectEdit(d => { d.points = mutator(d.points); })}
              onTextChange={scheduleTextEdit}
              onFontLoad={fontRerender}
            />
          )}

          {currentData && editing && (
            <SettingsSection
              key={editing.id}
              data={currentData}
              onTextChange={scheduleTextEdit}
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
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-bg-card)'; }}
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
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >{chip}</button>
              ))}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--color-border-subtle)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', background: 'var(--color-bg-card)', border: `1px solid ${input.trim() ? 'var(--color-accent)' : 'var(--color-border-default)'}`, borderRadius: 'var(--radius-lg)', padding: '2px 2px 2px var(--space-3)', transition: 'border-color 150ms' }}
>
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
