import React, { useState, useRef, useEffect } from 'react';
import { useSettingsStore, EMPTY_BRAND } from '../../store/settingsStore';

const PaletteIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/><circle cx="6.5" cy="12" r="0.5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>;
const MicIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>;
const KeyIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>;

type SectionId = 'brand-visual' | 'brand-voice' | 'api-keys';
const SECTIONS: { id: SectionId; label: string; icon: () => React.ReactNode; group: string }[] = [
  { id: 'brand-visual', label: 'Brand Visual', icon: PaletteIcon, group: 'Brand' },
  { id: 'brand-voice', label: 'Brand Voice', icon: MicIcon, group: 'Brand' },
  { id: 'api-keys', label: 'API Keys', icon: KeyIcon, group: 'Connections' },
];

const PROVIDERS = [
  { key: 'anthropicKey' as const, setter: 'setAnthropicKey' as const, label: 'Anthropic', placeholder: 'sk-ant-...', icon: 'A', validateUrl: 'https://api.anthropic.com/v1/messages', validateHeaders: (k: string) => ({ 'x-api-key': k, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', 'Content-Type': 'application/json' }), validateBody: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }) },
  { key: 'openaiKey' as const, setter: 'setOpenaiKey' as const, label: 'OpenAI', placeholder: 'sk-...', icon: 'O', validateUrl: 'https://api.openai.com/v1/models', validateHeaders: (k: string) => ({ Authorization: `Bearer ${k}` }), validateBody: null },
  { key: 'googleKey' as const, setter: 'setGoogleKey' as const, label: 'Google Gemini', placeholder: 'AIza...', icon: 'G', validateUrl: null, validateHeaders: () => ({}), validateBody: null },
  { key: 'groqKey' as const, setter: 'setGroqKey' as const, label: 'Groq (Llama)', placeholder: 'gsk_...', icon: 'L', validateUrl: 'https://api.groq.com/openai/v1/models', validateHeaders: (k: string) => ({ Authorization: `Bearer ${k}` }), validateBody: null },
  { key: 'togetherKey' as const, setter: 'setTogetherKey' as const, label: 'Together (Images)', placeholder: '', icon: 'T', validateUrl: 'https://api.together.xyz/v1/models', validateHeaders: (k: string) => ({ Authorization: `Bearer ${k}` }), validateBody: null },
] as const;

const LBL: React.CSSProperties = { fontSize: 'var(--text-xs)', fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 'var(--space-2)' };
const CARD: React.CSSProperties = { background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)' };
const HDESC: React.CSSProperties = { fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', margin: 'var(--space-1) 0 0', lineHeight: 'var(--leading-normal)' };

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ marginBottom: 'var(--space-5)' }}>
      <h2 style={{ fontWeight: 500, fontSize: 'var(--text-md)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0 }}>{title}</h2>
      <p style={HDESC}>{desc}</p>
    </div>
  );
}

function ColorSwatch({ color, label, onChange }: { color: string; label: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
      <label style={{ position: 'relative', width: 36, height: 36, borderRadius: 'var(--radius-full)', border: '2px solid var(--color-border-default)', background: color, cursor: 'pointer' }}>
        <input type="color" value={color} onChange={e => onChange(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
      </label>
      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-disabled)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
    </div>
  );
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [val, setVal] = useState('');
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: tags.length ? 'var(--space-2)' : 0 }}>
        {tags.map(t => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-full)', padding: '3px 10px', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)' }}>
            {t}
            <button onClick={() => onChange(tags.filter(x => x !== t))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--color-text-disabled)', fontSize: 10, lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
      <input className="form-input" value={val} onChange={e => setVal(e.target.value)} placeholder="Type and press Enter" style={{ width: '100%' }}
        onKeyDown={e => { if (e.key === 'Enter' && val.trim()) { e.preventDefault(); onChange([...tags, val.trim()]); setVal(''); } }} />
    </div>
  );
}

function BrandVisualSection() {
  const { brand, setBrand } = useSettingsStore();
  const b = brand || EMPTY_BRAND;
  return (
    <div>
      <SectionHeader title="Brand Visual" desc="Define your brand's visual identity. Colors are applied to visual content nodes." />
      <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <div>
          <label style={LBL}>Brand name</label>
          <input className="form-input" value={b.name} onChange={e => setBrand({ name: e.target.value })} placeholder="Acme Corp" style={{ width: '100%' }} />
        </div>
        <div>
          <label style={LBL}>Brand colors</label>
          <div style={{ display: 'flex', gap: 'var(--space-5)' }}>
            {(['primary', 'secondary', 'accent'] as const).map(k => (
              <ColorSwatch key={k} label={k} color={b.colors[k]} onChange={c => setBrand({ colors: { ...b.colors, [k]: c } })} />
            ))}
          </div>
        </div>
        {b.name && (
          <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-4)' }}>
            <label style={LBL}>Preview</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-surface)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: b.colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>{b.name.charAt(0).toUpperCase()}</div>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-sans)', color: b.colors.secondary }}>{b.name}</div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-disabled)', marginTop: 2 }}>{b.colors.primary} · {b.colors.secondary} · {b.colors.accent}</div>
              </div>
            </div>
          </div>
        )}

        {/* Reference images for image style */}
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-4)' }}>
          <label style={LBL}>Reference images</label>
          <p style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)', margin: '0 0 var(--space-3)', lineHeight: 1.5 }}>
            Upload images that define your visual style. All generated images will reference this aesthetic.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {(b.referenceImages || []).map((img, i) => (
              <div key={i} style={{ position: 'relative', width: 72, height: 72, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border-default)' }}>
                <img src={img} alt={`Reference ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button onClick={() => setBrand({ referenceImages: b.referenceImages.filter((_, j) => j !== i) })}
                  style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
            ))}
            {(b.referenceImages || []).length < 4 && (
              <label style={{ width: 72, height: 72, borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-disabled)', transition: 'border-color 150ms' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                <input type="file" accept="image/*" hidden onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => { setBrand({ referenceImages: [...(b.referenceImages || []), reader.result as string] }); };
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }} />
              </label>
            )}
          </div>
        </div>

        {/* Style note */}
        <div>
          <label style={LBL}>Image style description</label>
          <textarea className="form-textarea" value={b.imageStyleNote || ''} onChange={e => setBrand({ imageStyleNote: e.target.value })}
            placeholder="e.g. Clean editorial photography, soft natural lighting, muted earth tones, shallow depth of field"
            style={{ minHeight: 60 }} />
        </div>
      </div>
    </div>
  );
}

function BrandVoiceSection() {
  const { brand, setBrand } = useSettingsStore();
  const b = brand || EMPTY_BRAND;
  return (
    <div>
      <SectionHeader title="Brand Voice" desc="Teach the AI how your brand sounds. Injected into every content generation prompt." />
      <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <div>
          <label style={LBL}>Personality</label>
          <textarea className="form-textarea" value={b.voice.personality} onChange={e => setBrand({ voice: { ...b.voice, personality: e.target.value } })}
            placeholder="Warm but authoritative. We explain complex topics simply without dumbing them down." style={{ width: '100%', minHeight: 80 }} />
        </div>
        <div>
          <label style={LBL}>Target audience</label>
          <input className="form-input" value={b.voice.audience} onChange={e => setBrand({ voice: { ...b.voice, audience: e.target.value } })}
            placeholder="Engineering managers at Series B startups" style={{ width: '100%' }} />
        </div>
        <div>
          <label style={LBL}>Words to avoid</label>
          <TagInput tags={b.voice.avoidWords} onChange={t => setBrand({ voice: { ...b.voice, avoidWords: t } })} />
        </div>
        <div>
          <label style={LBL}>Example post</label>
          <textarea className="form-textarea" value={b.voice.examplePost} onChange={e => setBrand({ voice: { ...b.voice, examplePost: e.target.value } })}
            placeholder="Paste a real post that perfectly captures your brand voice." style={{ width: '100%', minHeight: 120 }} />
        </div>
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: b.voice.personality ? 'var(--color-accent)' : 'var(--color-border-default)' }} />
          <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: b.voice.personality ? 'var(--color-accent-subtle)' : 'var(--color-text-disabled)' }}>
            {b.voice.personality ? 'Brand voice active — applied to all generate nodes' : 'No voice configured yet'}
          </span>
        </div>
      </div>
    </div>
  );
}

function APIKeysSection() {
  const store = useSettingsStore();
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  const handleSave = async (key: string) => {
    (store as any)[PROVIDERS.find(p => p.key === key)!.setter](editValue);
    setEditKey(null);
    await useSettingsStore.getState().save();
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  };

  const handleDelete = async (key: string) => {
    (store as any)[PROVIDERS.find(p => p.key === key)!.setter]('');
    setMenuOpen(null);
    await useSettingsStore.getState().save();
  };

  const TH: React.CSSProperties = { padding: '10px 16px', fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', textAlign: 'left', background: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border-subtle)' };
  const TD: React.CSSProperties = { padding: '14px 16px', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border-subtle)', verticalAlign: 'middle' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
        <div>
          <h2 style={{ fontWeight: 500, fontSize: 'var(--text-md)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0 }}>API Keys</h2>
          <p style={HDESC}>Manage provider keys for AI generation.</p>
        </div>
        {saved && <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-accent)' }}>✓ Saved</span>}
      </div>
      <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>Name</th>
              <th style={TH}>Key Value</th>
              <th style={{ ...TH, width: 48 }}></th>
            </tr>
          </thead>
          <tbody>
            {PROVIDERS.map((p, i) => {
              const value = store[p.key];
              const isLast = i === PROVIDERS.length - 1;
              const isEditing = editKey === p.key;
              return (
                <tr key={p.key}>
                  <td style={{ ...TD, borderBottom: isLast ? 'none' : TD.borderBottom, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', flexShrink: 0 }}>{p.icon}</div>
                      <span style={{ fontWeight: 500 }}>{p.label}</span>
                      {value && !isEditing && <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 'var(--radius-full)', background: 'var(--color-accent-bg, rgba(13,191,90,0.1))', color: 'var(--color-accent)', fontWeight: 500 }}>Active</span>}
                    </div>
                  </td>
                  <td style={{ ...TD, borderBottom: isLast ? 'none' : TD.borderBottom, color: 'var(--color-text-tertiary)' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <input className="form-input" autoFocus type="password" value={editValue} onChange={e => setEditValue(e.target.value)} placeholder={p.placeholder} style={{ flex: 1 }}
                          onKeyDown={e => { if (e.key === 'Enter') handleSave(p.key); if (e.key === 'Escape') setEditKey(null); }} />
                        <button className="btn btn-primary btn-sm" onClick={() => handleSave(p.key)}>Save</button>
                        <button className="btn-sm btn-ghost" onClick={() => setEditKey(null)}>Cancel</button>
                      </div>
                    ) : value ? (
                      <span style={{ letterSpacing: 2 }}>••••••••••••••••••••</span>
                    ) : (
                      <span style={{ color: 'var(--color-text-disabled)', fontStyle: 'italic' }}>Not set</span>
                    )}
                  </td>
                  <td style={{ ...TD, borderBottom: isLast ? 'none' : TD.borderBottom, textAlign: 'center', position: 'relative' }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <button onClick={() => setMenuOpen(menuOpen === p.key ? null : p.key)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 'var(--radius-sm)', color: 'var(--color-text-disabled)', display: 'flex' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                      </button>
                      {menuOpen === p.key && (
                        <div ref={menuRef} style={{ position: 'absolute', top: 28, right: 0, zIndex: 50, background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', padding: 'var(--space-1)', minWidth: 130, animation: 'fadeIn 100ms ease' }}>
                          <button onClick={() => { setEditValue(value); setEditKey(p.key); setMenuOpen(null); }}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                            Edit
                          </button>
                          <button onClick={() => handleDelete(p.key)} disabled={!value}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', cursor: value ? 'pointer' : 'default', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: value ? 'var(--color-danger-text)' : 'var(--color-text-disabled)', opacity: value ? 1 : 0.5 }}
                            onMouseEnter={e => { if (value) e.currentTarget.style.background = 'var(--color-danger-bg)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SettingsPanel() {
  const [active, setActive] = useState<SectionId>('api-keys');
  const groups: Record<string, typeof SECTIONS> = {};
  SECTIONS.forEach(s => { (groups[s.group] ??= []).push(s); });

  return (
    <div style={{ flex: 1, display: 'flex', background: 'var(--color-bg)', overflow: 'hidden' }}>
      {/* Sidebar nav */}
      <nav className="hidden md:flex" style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-card)', padding: '24px 12px 24px 0', flexDirection: 'column', overflowY: 'auto' }}>
          {Object.entries(groups).map(([group, items], gi) => (
            <div key={group} style={{ marginTop: gi > 0 ? 24 : 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', marginBottom: 8, paddingLeft: 16 }}>{group}</div>
              {items.map(s => {
                const on = active === s.id;
                return (
                  <button key={s.id} onClick={() => setActive(s.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px 8px 16px', background: on ? 'var(--color-bg-surface)' : 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: on ? 500 : 400, color: on ? 'var(--color-accent)' : 'var(--color-text-primary)', transition: 'color 100ms, background 100ms', textAlign: 'left', borderRadius: '0 var(--radius-md) var(--radius-md) 0' }}>
                    <span style={{ width: 18, display: 'flex', flexShrink: 0, color: on ? 'var(--color-accent)' : 'var(--color-text-disabled)' }}><s.icon /></span>
                    {s.label}
                  </button>
                );
              })}
            </div>
          ))}
      </nav>

      {/* Mobile tab bar */}
      <div className="flex md:hidden" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border-subtle)', padding: '0 var(--space-3)', gap: 2, overflowX: 'auto' }}>
        {SECTIONS.map(s => {
          const on = active === s.id;
          return (
            <button key={s.id} onClick={() => setActive(s.id)} style={{ padding: '12px 14px', background: 'none', border: 'none', borderBottom: on ? '2px solid var(--color-accent)' : '2px solid transparent', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: on ? 500 : 400, color: on ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1" style={{ overflowY: 'auto', padding: 'var(--space-6) var(--space-6)' }}>
        <div className="md:hidden" style={{ height: 44 }} /> {/* spacer for mobile tabs */}
        <div style={{ maxWidth: active === 'api-keys' ? '100%' : 520 }}>
          {active === 'brand-visual' && <BrandVisualSection />}
          {active === 'brand-voice' && <BrandVoiceSection />}
          {active === 'api-keys' && <APIKeysSection />}
        </div>
      </div>
    </div>
  );
}
