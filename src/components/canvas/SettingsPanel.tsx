import React, { useState, useRef, useEffect } from 'react';
import { useSettingsStore, EMPTY_BRAND, FONT_PRESETS, type CustomFont } from '../../store/settingsStore';
import { useBrandsStore } from '../../store/brandsStore';
import BrandSetupModal from '../modals/BrandSetupModal';

const PaletteIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/><circle cx="6.5" cy="12" r="0.5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>;
const MicIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>;
const KeyIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>;

type SectionId = 'brand-kits' | 'brand-visual' | 'brand-voice' | 'api-keys';
const SECTIONS: { id: SectionId; label: string; icon: () => React.ReactNode; group: string }[] = [
  { id: 'brand-kits', label: 'Brand Kits', icon: PaletteIcon, group: 'Brand' },
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
  { key: 'hfKey' as const, setter: 'setHfKey' as const, label: 'Hugging Face (Images)', placeholder: 'hf_...', icon: 'H', validateUrl: 'https://huggingface.co/api/whoami-v2', validateHeaders: (k: string) => ({ Authorization: `Bearer ${k}` }), validateBody: null },
] as const;

const LBL: React.CSSProperties = { fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 'var(--space-2)' };
const CARD: React.CSSProperties = { background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)' };
const HDESC: React.CSSProperties = { fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', margin: 'var(--space-1) 0 0', lineHeight: 'var(--leading-normal)' };

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ marginBottom: 'var(--space-5)' }}>
      <h2 style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-md)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0 }}>{title}</h2>
      <p style={HDESC}>{desc}</p>
    </div>
  );
}

const UPLOAD_SENTINEL = '__upload__';

function FontPicker({ label, value, customFonts, onChange, onUpload }: {
  label: string;
  value: string;
  customFonts: CustomFont[];
  onChange: (v: string) => void;
  onUpload: () => void;
}) {
  const handleChange = (v: string) => {
    if (v === UPLOAD_SENTINEL) { onUpload(); return; }
    onChange(v);
  };
  return (
    <div>
      <label style={{ ...LBL, fontSize: 'var(--text-xs)' }}>{label}</label>
      <select className="form-input" value={value || ''} onChange={e => handleChange(e.target.value)}
        style={{ width: '100%', fontFamily: value ? `"${value}", system-ui, sans-serif` : undefined }}>
        <option value="">System default</option>
        <optgroup label="Popular">
          {FONT_PRESETS.map(f => <option key={f} value={f}>{f}</option>)}
        </optgroup>
        {customFonts.length > 0 && (
          <optgroup label="Uploaded">
            {customFonts.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
          </optgroup>
        )}
        <option value={UPLOAD_SENTINEL}>Upload custom font…</option>
      </select>
    </div>
  );
}

function ColorSwatch({ color, label, onChange }: { color: string; label: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <label style={{ position: 'relative', width: 72, height: 72, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-default)', background: color, cursor: 'pointer', display: 'block', overflow: 'hidden' }}>
        <input type="color" value={color} onChange={e => onChange(e.target.value)}
          style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>{label}</span>
        <span style={{ fontSize: 'var(--text-micro)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-disabled)' }}>{color.toUpperCase()}</span>
      </div>
    </div>
  );
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [val, setVal] = useState('');
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: tags.length ? 'var(--space-2)' : 0 }}>
        {tags.map(t => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-full)', padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)' }}>
            {t}
            <button onClick={() => onChange(tags.filter(x => x !== t))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--color-text-disabled)', fontSize: 'var(--text-micro)', lineHeight: 'var(--leading-none)' }}>×</button>
          </span>
        ))}
      </div>
      <input className="form-input" value={val} onChange={e => setVal(e.target.value)} placeholder="Type and press Enter" style={{ width: '100%' }}
        onKeyDown={e => { if (e.key === 'Enter' && val.trim()) { e.preventDefault(); onChange([...tags, val.trim()]); setVal(''); } }} />
    </div>
  );
}

function BrandKitsSection() {
  const brands = useBrandsStore(s => s.brands);
  const activeBrandId = useBrandsStore(s => s.activeBrandId);
  const addBrand = useBrandsStore(s => s.addBrand);
  const removeBrand = useBrandsStore(s => s.removeBrand);
  const duplicateBrand = useBrandsStore(s => s.duplicateBrand);
  const setActiveBrand = useBrandsStore(s => s.setActiveBrand);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleNew = () => { const id = addBrand({ kitName: `Brand ${brands.length + 1}` }); setEditingId(id); };

  return (
    <div>
      <SectionHeader title="Brand Kits" desc="Save named brand kits (colors, fonts, voice) and apply them to workflows." />
      <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {brands.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', maxWidth: 320, lineHeight: 1.5 }}>
              No brand kits yet. Create one to apply a consistent look and voice to a specific workflow.
            </div>
            <button className="btn btn-primary" onClick={handleNew}>+ New brand kit</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-3)' }}>
              {brands.map(b => {
                const isActive = b.id === activeBrandId;
                return (
                  <div key={b.id}
                    style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)', border: `1px solid ${isActive ? 'var(--color-accent)' : 'var(--color-border-default)'}`, background: 'var(--color-bg-surface)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      {(['primary', 'secondary', 'accent'] as const).map(k => (
                        <div key={k} style={{ width: 16, height: 16, borderRadius: 'var(--radius-sm)', background: b.colors[k], border: '1px solid var(--color-border-subtle)' }} title={`${k}: ${b.colors[k]}`} />
                      ))}
                      <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.kitName || 'Untitled kit'}
                      </span>
                      {isActive && <span style={{ fontSize: 'var(--text-micro)', fontFamily: 'var(--font-sans)', color: 'var(--color-accent)', fontWeight: 'var(--weight-medium)' }}>Default</span>}
                    </div>
                    {(b.name || b.voice?.personality) && (
                      <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any }}>
                        {[b.name, b.voice?.personality].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => setEditingId(b.id)}>Edit</button>
                      {!isActive && <button className="btn btn-sm btn-ghost" onClick={() => setActiveBrand(b.id)}>Set default</button>}
                      <button className="btn btn-sm btn-ghost" onClick={() => duplicateBrand(b.id)}>Duplicate</button>
                      <button className="btn btn-sm btn-ghost" style={{ color: 'var(--color-danger-text)' }}
                        onClick={() => {
                          if (!confirm(`Delete brand kit "${b.kitName || 'Untitled kit'}"?`)) return;
                          removeBrand(b.id);
                        }}>Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={handleNew}>+ New brand kit</button>
          </>
        )}
      </div>

      {editingId && <BrandSetupModal brandId={editingId} onClose={() => setEditingId(null)} />}
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
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {(['primary', 'secondary', 'accent'] as const).map(k => (
              <ColorSwatch key={k} label={k} color={b.colors[k]} onChange={c => setBrand({ colors: { ...b.colors, [k]: c } })} />
            ))}
          </div>
        </div>
        <BrandFontsBlock />

        {/* Reference images for image style */}
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-4)' }}>
          <label style={LBL}>Reference images</label>
          <p style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)', margin: '0 0 var(--space-3)', lineHeight: 'var(--leading-snug)' }}>
            Upload images that define your visual style. All generated images will reference this aesthetic.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {(b.referenceImages || []).map((img, i) => (
              <div key={i} style={{ position: 'relative', width: 72, height: 72, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border-default)' }}>
                <img src={img} alt={`Reference ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button aria-label="Remove image" onClick={() => setBrand({ referenceImages: b.referenceImages.filter((_, j) => j !== i) })}
                  style={{ position: 'absolute', top: 2, right: 2, width: 24, height: 24, borderRadius: '50%', background: 'var(--color-overlay-dark)', border: 'none', color: 'var(--color-text-inverse)', fontSize: 'var(--text-micro)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
            ))}
            {(b.referenceImages || []).length < 4 && (
              <label aria-label="Upload reference image" style={{ width: 72, height: 72, borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-disabled)', transition: 'border-color 150ms' }}>
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

function BrandFontsBlock() {
  const { brand, setBrand } = useSettingsStore();
  const b = brand || EMPTY_BRAND;
  const customFonts: CustomFont[] = b.customFonts || [];
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const triggerUpload = () => { setError(null); fileRef.current?.click(); };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    // Cap at ~4MB so the data URL fits comfortably in localStorage (Safari ~5MB).
    if (file.size > 4 * 1024 * 1024) { setError('Font file is too large (4MB max).'); return; }
    const baseName = file.name.replace(/\.[^.]+$/, '').trim() || 'Custom Font';
    const name = customFonts.some(f => f.name === baseName)
      ? `${baseName} (${customFonts.filter(f => f.name.startsWith(baseName)).length + 1})`
      : baseName;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setBrand({ customFonts: [...customFonts, { name, dataUrl }] });
    };
    reader.onerror = () => setError('Could not read that file.');
    reader.readAsDataURL(file);
  };

  const removeCustom = (name: string) => {
    const next = customFonts.filter(f => f.name !== name);
    const fonts = {
      title: b.fonts?.title === name ? '' : (b.fonts?.title || ''),
      body: b.fonts?.body === name ? '' : (b.fonts?.body || ''),
    };
    setBrand({ customFonts: next, fonts });
  };

  return (
    <div>
      <label style={LBL}>Brand fonts</label>
      <p style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)', margin: '0 0 var(--space-3)', lineHeight: 'var(--leading-snug)' }}>
        Pick a popular Google Font or upload your own (.woff2, .woff, .otf, .ttf). Uploaded fonts stay on this device.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <FontPicker label="Title font" value={b.fonts?.title ?? ''} customFonts={customFonts}
          onChange={v => setBrand({ fonts: { ...(b.fonts || EMPTY_BRAND.fonts), title: v } })}
          onUpload={triggerUpload} />
        <FontPicker label="Body font" value={b.fonts?.body ?? ''} customFonts={customFonts}
          onChange={v => setBrand({ fonts: { ...(b.fonts || EMPTY_BRAND.fonts), body: v } })}
          onUpload={triggerUpload} />
      </div>

      <input ref={fileRef} type="file" accept=".woff2,.woff,.otf,.ttf,font/woff2,font/woff,font/otf,font/ttf,application/font-woff,application/font-woff2" hidden
        onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />

      {customFonts.length > 0 && (
        <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {customFonts.map(f => (
            <div key={f.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: 'var(--text-sm)', fontFamily: `"${f.name}", system-ui, sans-serif`, color: 'var(--color-text-primary)' }}>{f.name}</span>
                <span style={{ fontSize: 'var(--text-micro)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-disabled)' }}>Aa Bb Cc 123</span>
              </div>
              <button onClick={() => removeCustom(f.name)} aria-label={`Remove ${f.name}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-disabled)', fontSize: 'var(--text-sm)', padding: 'var(--space-1) var(--space-2)' }}>×</button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-danger-text)' }}>{error}</div>
      )}
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
  const groups: Record<string, typeof SECTIONS> = {};
  SECTIONS.forEach(s => { (groups[s.group] ??= []).push(s); });

  return (
    <div style={{ flex: 1, display: 'flex', background: 'var(--color-bg)', overflow: 'hidden' }}>
      {/* Sidebar nav */}
      <nav className="hidden md:flex" style={{ width: 160, flexShrink: 0, borderRight: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-card)', padding: 'var(--space-5) var(--space-4)', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-5)' }}>Settings</div>
          {Object.entries(groups).map(([group, items], gi) => (
            <div key={group} style={{ marginTop: gi > 0 ? 'var(--space-6)' : 0 }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-2)', textTransform: 'uppercase' as const, letterSpacing: 'var(--tracking-wide)' }}>{group}</div>
              {items.map(s => {
                const on = active === s.id;
                return (
                  <button key={s.id} onClick={() => setActive(s.id)} style={{ width: '100%', display: 'block', margin: 0, padding: 'var(--space-2) var(--space-3)', background: on ? 'var(--color-bg-surface)' : 'transparent', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: on ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', transition: 'background 120ms, color 120ms', textAlign: 'left' }}>
                    {s.label}
                  </button>
                );
              })}
            </div>
          ))}
      </nav>

      {/* Mobile tab bar */}
      <div className="flex md:hidden" style={{ position: 'sticky', top: 0, left: 0, right: 0, zIndex: 10, background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border-subtle)', padding: 'var(--space-2) var(--space-3)', gap: 'var(--space-1)', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {SECTIONS.map(s => {
          const on = active === s.id;
          return (
            <button key={s.id} onClick={() => setActive(s.id)} style={{ padding: 'var(--space-2) var(--space-3)', background: on ? 'var(--color-bg-surface)' : 'transparent', border: 'none', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: on ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 120ms, color 120ms' }}>
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 md:p-6" style={{ overflowY: 'auto' }}>
        <div style={{ width: '100%' }}>
          {active === 'brand-kits' && <BrandKitsSection />}
          {active === 'brand-visual' && <BrandVisualSection />}
          {active === 'brand-voice' && <BrandVoiceSection />}
          {active === 'api-keys' && <APIKeysSection />}
        </div>
      </div>
    </div>
  );
}
