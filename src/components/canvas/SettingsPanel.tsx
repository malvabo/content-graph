import React, { useState, useRef, useEffect } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { useBrandsStore } from '../../store/brandsStore';
import { useDarkMode } from '../../hooks/useDarkMode';
import BrandSetupModal from '../modals/BrandSetupModal';

const PaletteIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/><circle cx="6.5" cy="12" r="0.5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>;
const KeyIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>;
const ThemeIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>;

type SectionId = 'brand-kits' | 'appearance' | 'api-keys';
const SECTIONS: { id: SectionId; label: string; icon: () => React.ReactNode }[] = [
  { id: 'brand-kits', label: 'Brand Kits', icon: PaletteIcon },
  { id: 'appearance', label: 'Appearance', icon: ThemeIcon },
  { id: 'api-keys', label: 'API Keys', icon: KeyIcon },
];

const PROVIDERS = [
  { key: 'anthropicKey' as const, setter: 'setAnthropicKey' as const, label: 'Anthropic', placeholder: 'sk-ant-...', icon: 'A', validateUrl: 'https://api.anthropic.com/v1/messages', validateHeaders: (k: string) => ({ 'x-api-key': k, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', 'Content-Type': 'application/json' }), validateBody: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }) },
  { key: 'openaiKey' as const, setter: 'setOpenaiKey' as const, label: 'OpenAI', placeholder: 'sk-...', icon: 'O', validateUrl: 'https://api.openai.com/v1/models', validateHeaders: (k: string) => ({ Authorization: `Bearer ${k}` }), validateBody: null },
  { key: 'googleKey' as const, setter: 'setGoogleKey' as const, label: 'Google Gemini', placeholder: 'AIza...', icon: 'G', validateUrl: null, validateHeaders: () => ({}), validateBody: null },
  { key: 'groqKey' as const, setter: 'setGroqKey' as const, label: 'Groq (Llama)', placeholder: 'gsk_...', icon: 'L', validateUrl: 'https://api.groq.com/openai/v1/models', validateHeaders: (k: string) => ({ Authorization: `Bearer ${k}` }), validateBody: null },
  { key: 'togetherKey' as const, setter: 'setTogetherKey' as const, label: 'Together (Images)', placeholder: '', icon: 'T', validateUrl: 'https://api.together.xyz/v1/models', validateHeaders: (k: string) => ({ Authorization: `Bearer ${k}` }), validateBody: null },
  { key: 'hfKey' as const, setter: 'setHfKey' as const, label: 'Hugging Face (Images)', placeholder: 'hf_...', icon: 'H', validateUrl: 'https://huggingface.co/api/whoami-v2', validateHeaders: (k: string) => ({ Authorization: `Bearer ${k}` }), validateBody: null },
] as const;

const CARD: React.CSSProperties = { background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)' };
const HDESC: React.CSSProperties = { fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', margin: 'var(--space-1) 0 0', lineHeight: 'var(--leading-normal)' };

function BrandKitsSection() {
  const brands = useBrandsStore(s => s.brands);
  const addBrand = useBrandsStore(s => s.addBrand);
  const removeBrand = useBrandsStore(s => s.removeBrand);
  const duplicateBrand = useBrandsStore(s => s.duplicateBrand);
  const setActiveBrand = useBrandsStore(s => s.setActiveBrand);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuId) return;
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuId]);

  const handleNew = () => { const id = addBrand({ kitName: `Brand ${brands.length + 1}` }); setEditingId(id); };

  const TH: React.CSSProperties = { padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', textAlign: 'left', background: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border-subtle)' };
  const TD: React.CSSProperties = { padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border-subtle)', verticalAlign: 'middle' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
        <div>
          <h2 style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-md)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0 }}>Brand Kits</h2>
          <p style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', margin: 'var(--space-1) 0 0' }}>Save named kits (colors, fonts, voice) and apply them to specific workflows.</p>
        </div>
        <button className="btn btn-primary" onClick={handleNew}>+ New brand kit</button>
      </div>

      {brands.length === 0 ? (
        <div style={{ ...CARD, textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)' }}>
          No brand kits yet. Click "+ New brand kit" to create your first.
        </div>
      ) : (
        <div style={{ ...CARD, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr>
                <th style={TH}>Name</th>
                <th style={TH}>Colors</th>
                <th style={TH}>Font</th>
                <th style={TH}>Type</th>
                <th style={{ ...TH, width: 48 }}></th>
              </tr>
            </thead>
            <tbody>
              {brands.map((b, i) => {
                const isLast = i === brands.length - 1;
                const cellBase: React.CSSProperties = { ...TD, borderBottom: isLast ? 'none' : TD.borderBottom };
                return (
                  <tr key={b.id} onClick={() => setEditingId(b.id)}
                    style={{ cursor: 'pointer', transition: 'background 120ms' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                    <td style={{ ...cellBase, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <span style={{ fontWeight: 'var(--weight-medium)' }}>{b.kitName || 'Untitled kit'}</span>
                        {b.name && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{b.name}</span>}
                      </div>
                    </td>
                    <td style={cellBase}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {(['primary', 'secondary', 'accent'] as const).map(k => (
                          <span key={k}
                            title={`${k}: ${b.colors[k]}`}
                            style={{ width: 18, height: 18, borderRadius: '50%', background: b.colors[k], border: '1px solid var(--color-border-subtle)', display: 'inline-block' }} />
                        ))}
                      </div>
                    </td>
                    <td style={{ ...cellBase, color: (b.fonts?.title || b.fonts?.body) ? 'var(--color-text-primary)' : 'var(--color-text-disabled)' }}>
                      {b.fonts?.title || b.fonts?.body || '—'}
                    </td>
                    <td style={{ ...cellBase, color: b.typeLabel ? 'var(--color-text-secondary)' : 'var(--color-text-disabled)' }}>
                      {b.typeLabel || ''}
                    </td>
                    <td style={{ ...cellBase, textAlign: 'center', position: 'relative' }}
                      onClick={e => e.stopPropagation()}>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <button aria-label="Brand kit options"
                          onClick={e => { e.stopPropagation(); setMenuId(menuId === b.id ? null : b.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 'var(--space-1)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-disabled)', display: 'flex' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                        </button>
                        {menuId === b.id && (
                          <div ref={menuRef}
                            style={{ position: 'absolute', top: 28, right: 0, zIndex: 50, background: 'var(--color-bg-popover)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', padding: 'var(--space-2)', minWidth: 160 }}>
                            {[
                              { label: 'Set as default', action: () => { setActiveBrand(b.id); setMenuId(null); } },
                              { label: 'Duplicate', action: () => { duplicateBrand(b.id); setMenuId(null); } },
                              { label: 'Delete', danger: true, action: () => {
                                if (confirm(`Delete brand kit "${b.kitName || 'Untitled kit'}"?`)) removeBrand(b.id);
                                setMenuId(null);
                              } },
                            ].map(opt => (
                              <button key={opt.label} onClick={opt.action}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: 'var(--space-2) var(--space-3)', background: 'none', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: (opt as any).danger ? 'var(--color-danger-text)' : 'var(--color-text-primary)' }}
                                onMouseEnter={e => { e.currentTarget.style.background = (opt as any).danger ? 'var(--color-danger-bg)' : 'var(--color-bg-surface)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                                {opt.label}
                              </button>
                            ))}
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
      )}

      {editingId && <BrandSetupModal brandId={editingId} onClose={() => setEditingId(null)} />}
    </div>
  );
}

function AppearanceSection() {
  const [dark, setDark] = useDarkMode();

  const Option = ({ value, label, description }: { value: boolean; label: string; description: string }) => {
    const on = dark === value;
    return (
      <button onClick={() => setDark(value)}
        style={{ flex: 1, textAlign: 'left', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', border: `1px solid ${on ? 'var(--color-accent)' : 'var(--color-border-default)'}`, background: 'var(--color-bg-card)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ height: 72, borderRadius: 'var(--radius-md)', background: value ? '#1a1a18' : '#f4f5f7', border: '1px solid var(--color-border-subtle)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 10, left: 10, right: 10, height: 10, borderRadius: 4, background: value ? '#2a2a26' : '#ffffff' }} />
          <div style={{ position: 'absolute', top: 28, left: 10, width: '40%', height: 6, borderRadius: 3, background: value ? '#3a3a36' : '#e0e2e6' }} />
          <div style={{ position: 'absolute', top: 40, left: 10, width: '60%', height: 6, borderRadius: 3, background: value ? '#3a3a36' : '#e0e2e6' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)' }}>{label}</span>
          {on && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent)', fontWeight: 'var(--weight-medium)' }}>Active</span>}
        </div>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', lineHeight: 1.4 }}>{description}</span>
      </button>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <h2 style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-md)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0 }}>Appearance</h2>
        <p style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', margin: 'var(--space-1) 0 0' }}>Switch between light and dark themes.</p>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <Option value={false} label="Light" description="Default theme for bright environments." />
        <Option value={true} label="Dark" description="Easier on the eyes in low light." />
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
    // Strip whitespace and surrounding quotes — a very common paste artifact that
    // otherwise produces a confusing "Invalid API Key" 401 from providers.
    const cleaned = editValue.trim().replace(/^['"`]+|['"`]+$/g, '');
    (store as any)[PROVIDERS.find(p => p.key === key)!.setter](cleaned);
    setEditKey(null);
    await useSettingsStore.getState().save();
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  };

  const handleDelete = async (key: string) => {
    (store as any)[PROVIDERS.find(p => p.key === key)!.setter]('');
    setMenuOpen(null);
    await useSettingsStore.getState().save();
  };

  const TH: React.CSSProperties = { padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', textAlign: 'left', background: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border-subtle)' };
  const TD: React.CSSProperties = { padding: 'var(--space-4)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border-subtle)', verticalAlign: 'middle' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
        <div>
          <h2 style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-md)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0 }}>API Keys</h2>
          <p style={HDESC}>Manage provider keys for AI generation.</p>
        </div>
        {saved && <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>✓ Saved</span>}
      </div>
      <div style={{ ...CARD, padding: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <div style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-tertiary)', flexShrink: 0 }}>{p.icon}</div>
                      <span style={{ fontWeight: 'var(--weight-medium)' }}>{p.label}</span>
                      {value && !isEditing && <span style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-0) var(--space-2)', borderRadius: 'var(--radius-full)', background: 'var(--color-bg-subtle)', color: 'var(--color-accent)', fontWeight: 'var(--weight-medium)' }}>Active</span>}
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
                      <span style={{ letterSpacing: 'var(--tracking-wide)' }}>••••••••••••••••••••</span>
                    ) : (
                      <span style={{ color: 'var(--color-text-disabled)', fontStyle: 'italic' }}>Not set</span>
                    )}
                  </td>
                  <td style={{ ...TD, borderBottom: isLast ? 'none' : TD.borderBottom, textAlign: 'center', position: 'relative' }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <button onClick={() => setMenuOpen(menuOpen === p.key ? null : p.key)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 'var(--space-1)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-disabled)', display: 'flex' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                      </button>
                      {menuOpen === p.key && (
                        <div ref={menuRef} style={{ position: 'absolute', top: 28, right: 0, zIndex: 50, background: 'var(--color-bg-popover)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', padding: 'var(--space-2)', minWidth: 150 }}>
                          <button onClick={() => { setEditValue(value); setEditKey(p.key); setMenuOpen(null); }}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', padding: 'var(--space-2) var(--space-3)', background: 'none', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                            Edit
                          </button>
                          <button onClick={() => handleDelete(p.key)} disabled={!value}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', padding: 'var(--space-2) var(--space-3)', background: 'none', border: 'none', borderRadius: 'var(--radius-md)', cursor: value ? 'pointer' : 'default', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: value ? 'var(--color-danger-text)' : 'var(--color-text-disabled)', opacity: value ? 1 : 0.5 }}
                            onMouseEnter={e => { if (value) e.currentTarget.style.background = 'var(--color-danger-bg)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
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
  const [active, setActive] = useState<SectionId>('brand-kits');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--color-bg)', overflow: 'hidden' }}>
      {/* Page title */}
      <div style={{ padding: 'var(--space-5) var(--space-6) var(--space-3)', flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>Settings</h1>
      </div>

      {/* Horizontal tab bar */}
      <div role="tablist" aria-label="Settings sections"
        style={{ display: 'flex', gap: 'var(--space-4)', padding: '0 var(--space-6)', borderBottom: '1px solid var(--color-border-subtle)', flexShrink: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {SECTIONS.map(s => {
          const on = active === s.id;
          return (
            <button key={s.id} role="tab" aria-selected={on} onClick={() => setActive(s.id)}
              style={{
                padding: '10px 2px',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${on ? 'var(--color-accent)' : 'transparent'}`,
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-medium)',
                color: on ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                marginBottom: -1,
              }}>
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1" style={{ overflowY: 'auto', padding: 'var(--space-6)' }}>
        <div style={{ width: '100%', maxWidth: 960, marginInline: 'auto' }}>
          {active === 'brand-kits' && <BrandKitsSection />}
          {active === 'appearance' && <AppearanceSection />}
          {active === 'api-keys' && <APIKeysSection />}
        </div>
      </div>
    </div>
  );
}
