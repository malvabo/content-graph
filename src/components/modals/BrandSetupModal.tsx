import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBrandsStore } from '../../store/brandsStore';
import { EMPTY_BRAND, FONT_PRESETS, type CustomFont } from '../../store/settingsStore';

const LBL: React.CSSProperties = { fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 'var(--space-2)' };
const UPLOAD_SENTINEL = '__upload__';

export default function BrandSetupModal({ brandId, onClose }: { brandId: string; onClose: () => void }) {
  const brand = useBrandsStore(s => s.brands.find(b => b.id === brandId));
  const updateBrand = useBrandsStore(s => s.updateBrand);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'visual' | 'voice'>('visual');
  const [fontError, setFontError] = useState<string | null>(null);

  if (!brand) return null;
  const customFonts: CustomFont[] = brand.customFonts || [];

  const uploadFont = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setFontError('Font file is too large (4MB max).'); return; }
    const baseName = file.name.replace(/\.[^.]+$/, '').trim() || 'Custom Font';
    const name = customFonts.some(f => f.name === baseName)
      ? `${baseName} (${customFonts.filter(f => f.name.startsWith(baseName)).length + 1})`
      : baseName;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      updateBrand(brand.id, { customFonts: [...customFonts, { name, dataUrl }] });
    };
    reader.onerror = () => setFontError('Could not read that file.');
    reader.readAsDataURL(file);
  };

  const fontOptions = (value: string, onChange: (v: string) => void, label: string) => (
    <div>
      <label style={{ ...LBL, fontSize: 'var(--text-xs)' }}>{label}</label>
      <select className="form-input" value={value || ''}
        onChange={e => {
          const v = e.target.value;
          if (v === UPLOAD_SENTINEL) { setFontError(null); fileRef.current?.click(); return; }
          onChange(v);
        }}
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

  return createPortal(
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-overlay-backdrop)', backdropFilter: 'blur(2px)' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '92%', maxWidth: 720, height: 'min(720px, 92vh)', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-default)', boxShadow: 'var(--shadow-lg)', fontFamily: 'var(--font-sans)' }}>
        {/* Header */}
        <div style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <input value={brand.kitName} onChange={e => updateBrand(brand.id, { kitName: e.target.value })}
            placeholder="Brand kit name"
            style={{ flex: 1, fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-md)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', background: 'none', border: 'none', borderBottom: '1px solid transparent', borderRadius: 0, padding: '2px 0', outline: 'none' }}
            onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--color-accent)'; }}
            onBlur={e => { e.currentTarget.style.borderBottomColor = 'transparent'; }} />
          <button aria-label="Close" onClick={onClose}
            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-md)', color: 'var(--color-text-tertiary)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 'var(--space-1)', padding: 'var(--space-2) var(--space-4)', borderBottom: '1px solid var(--color-border-subtle)' }}>
          {(['visual', 'voice'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: 'var(--space-2) var(--space-3)', background: tab === t ? 'var(--color-bg-surface)' : 'transparent', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', fontWeight: 'var(--weight-medium)', color: tab === t ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', cursor: 'pointer', textTransform: 'capitalize' }}>
              Brand {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5) var(--space-6)' }}>
          {tab === 'visual' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              <div>
                <label style={LBL}>Brand name</label>
                <input className="form-input" value={brand.name} placeholder="Acme Corp" style={{ width: '100%' }}
                  onChange={e => updateBrand(brand.id, { name: e.target.value })} />
              </div>

              <div>
                <label style={LBL}>Brand colors</label>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {(['primary', 'secondary', 'accent'] as const).map(k => (
                    <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      <label style={{ position: 'relative', width: 72, height: 72, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-default)', background: brand.colors[k], cursor: 'pointer', display: 'block', overflow: 'hidden' }}>
                        <input type="color" value={brand.colors[k]}
                          onChange={e => updateBrand(brand.id, { colors: { ...brand.colors, [k]: e.target.value } })}
                          style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>{k}</span>
                        <span style={{ fontSize: 'var(--text-micro)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-disabled)' }}>{brand.colors[k].toUpperCase()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={LBL}>Brand fonts</label>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-disabled)', margin: '0 0 var(--space-3)' }}>
                  Pick a popular Google Font or upload your own (.woff2, .woff, .otf, .ttf).
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  {fontOptions(brand.fonts?.title || '', v => updateBrand(brand.id, { fonts: { ...brand.fonts, title: v } }), 'Title font')}
                  {fontOptions(brand.fonts?.body || '', v => updateBrand(brand.id, { fonts: { ...brand.fonts, body: v } }), 'Body font')}
                </div>
                <input ref={fileRef} type="file" accept=".woff2,.woff,.otf,.ttf,font/woff2,font/woff,font/otf,font/ttf" hidden
                  onChange={e => { uploadFont(e.target.files?.[0]); e.target.value = ''; }} />
                {customFonts.length > 0 && (
                  <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {customFonts.map(f => (
                      <div key={f.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span style={{ fontSize: 'var(--text-sm)', fontFamily: `"${f.name}", system-ui, sans-serif`, color: 'var(--color-text-primary)' }}>{f.name}</span>
                          <span style={{ fontSize: 'var(--text-micro)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-disabled)' }}>Aa Bb Cc 123</span>
                        </div>
                        <button aria-label={`Remove ${f.name}`}
                          onClick={() => {
                            const next = customFonts.filter(x => x.name !== f.name);
                            const fonts = {
                              title: brand.fonts?.title === f.name ? '' : (brand.fonts?.title || ''),
                              body: brand.fonts?.body === f.name ? '' : (brand.fonts?.body || ''),
                            };
                            updateBrand(brand.id, { customFonts: next, fonts });
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-disabled)', fontSize: 'var(--text-sm)', padding: 'var(--space-1) var(--space-2)' }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                {fontError && <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)' }}>{fontError}</div>}
              </div>

              <div>
                <label style={LBL}>Image style description</label>
                <textarea className="form-textarea" value={brand.imageStyleNote || ''}
                  placeholder="Clean editorial photography, soft natural lighting, muted earth tones"
                  style={{ minHeight: 60, width: '100%' }}
                  onChange={e => updateBrand(brand.id, { imageStyleNote: e.target.value })} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              <div>
                <label style={LBL}>Personality</label>
                <textarea className="form-textarea" value={brand.voice.personality}
                  placeholder="Warm but authoritative."
                  style={{ minHeight: 80, width: '100%' }}
                  onChange={e => updateBrand(brand.id, { voice: { ...brand.voice, personality: e.target.value } })} />
              </div>
              <div>
                <label style={LBL}>Target audience</label>
                <input className="form-input" value={brand.voice.audience}
                  placeholder="Engineering managers at Series B startups"
                  style={{ width: '100%' }}
                  onChange={e => updateBrand(brand.id, { voice: { ...brand.voice, audience: e.target.value } })} />
              </div>
              <div>
                <label style={LBL}>Example post</label>
                <textarea className="form-textarea" value={brand.voice.examplePost}
                  placeholder="Paste a real post that captures the voice."
                  style={{ minHeight: 120, width: '100%' }}
                  onChange={e => updateBrand(brand.id, { voice: { ...brand.voice, examplePost: e.target.value } })} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: 'var(--space-3) var(--space-6)', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-disabled)' }}>
            {(brand.voice?.personality || brand.name || (brand.colors.primary && brand.colors.primary !== EMPTY_BRAND.colors.primary)) ? 'Changes save automatically' : 'Fill out the kit, then assign it to a workflow'}
          </span>
          <button className="btn btn-primary btn-sm" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
