import { useState } from 'react';
import { useSettingsStore, EMPTY_BRAND } from '../../store/settingsStore';

const EyeOpen = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const EyeClosed = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="m1 1 22 22"/></svg>;
const CheckIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>;
const XIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>;
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
] as const;

const LBL: React.CSSProperties = { fontSize: 'var(--text-xs)', fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 6 };
const CARD: React.CSSProperties = { background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' };

function ColorSwatch({ color, label, onChange }: { color: string; label: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <label style={{ position: 'relative', width: 36, height: 36, borderRadius: 'var(--radius-full)', border: '2px solid var(--color-border-default)', background: color, cursor: 'pointer' }}>
        <input type="color" value={color} onChange={e => onChange(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
      </label>
      <span style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
    </div>
  );
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [val, setVal] = useState('');
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: tags.length ? 8 : 0 }}>
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
      <h2 style={{ fontWeight: 500, fontSize: 'var(--text-md)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0 }}>Brand Visual</h2>
      <p style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', margin: '2px 0 0', lineHeight: 'var(--leading-normal)' }}>Define your brand's visual identity. Colors are applied to visual content nodes.</p>
      <div style={{ ...CARD, marginTop: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label style={LBL}>Brand name</label>
          <input className="form-input" value={b.name} onChange={e => setBrand({ name: e.target.value })} placeholder="Acme Corp" style={{ width: '100%' }} />
        </div>
        <div>
          <label style={LBL}>Brand colors</label>
          <div style={{ display: 'flex', gap: 20 }}>
            {(['primary', 'secondary', 'accent'] as const).map(k => (
              <ColorSwatch key={k} label={k} color={b.colors[k]} onChange={c => setBrand({ colors: { ...b.colors, [k]: c } })} />
            ))}
          </div>
        </div>
        {b.name && (
          <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 16 }}>
            <label style={LBL}>Preview</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-surface)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: b.colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>{b.name.charAt(0).toUpperCase()}</div>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-sans)', color: b.colors.secondary }}>{b.name}</div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-disabled)', marginTop: 1 }}>{b.colors.primary} · {b.colors.secondary} · {b.colors.accent}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BrandVoiceSection() {
  const { brand, setBrand } = useSettingsStore();
  const b = brand || EMPTY_BRAND;
  return (
    <div>
      <h2 style={{ fontWeight: 500, fontSize: 'var(--text-md)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0 }}>Brand Voice</h2>
      <p style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', margin: '2px 0 0', lineHeight: 'var(--leading-normal)' }}>Teach the AI how your brand sounds. Injected into every content generation prompt.</p>
      <div style={{ ...CARD, marginTop: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label style={LBL}>Personality</label>
          <textarea className="form-input" rows={3} value={b.voice.personality} onChange={e => setBrand({ voice: { ...b.voice, personality: e.target.value } })}
            placeholder="Warm but authoritative. We explain complex topics simply without dumbing them down." style={{ width: '100%', resize: 'none' }} />
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
          <textarea className="form-input" rows={5} value={b.voice.examplePost} onChange={e => setBrand({ voice: { ...b.voice, examplePost: e.target.value } })}
            placeholder="Paste a real post that perfectly captures your brand voice." style={{ width: '100%', resize: 'none' }} />
        </div>
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
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
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [validating, setValidating] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, 'valid' | 'invalid' | null>>({});
  const [errorMsg, setErrorMsg] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const handleSave = async () => { await useSettingsStore.getState().save(); setSaved(true); setTimeout(() => setSaved(false), 1500); };
  const validate = async (provider: typeof PROVIDERS[number]) => {
    const key = store[provider.key]; if (!key) return;
    setValidating(provider.key); setStatus(s => ({ ...s, [provider.key]: null })); setErrorMsg(s => ({ ...s, [provider.key]: '' }));
    try {
      if (!provider.validateUrl) {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${key}`);
        if (!res.ok) { const e = await res.json().catch(() => ({})); setErrorMsg(s => ({ ...s, [provider.key]: e.error?.message || `HTTP ${res.status}` })); }
        setStatus(s => ({ ...s, [provider.key]: res.ok ? 'valid' : 'invalid' }));
      } else {
        const opts: RequestInit = { headers: provider.validateHeaders(key) };
        if (provider.validateBody) { opts.method = 'POST'; opts.body = provider.validateBody; }
        const res = await fetch(provider.validateUrl, opts);
        if (!res.ok && res.status !== 400) { const e = await res.json().catch(() => ({})); setErrorMsg(s => ({ ...s, [provider.key]: e.error?.message || `HTTP ${res.status}` })); }
        setStatus(s => ({ ...s, [provider.key]: res.ok || res.status === 400 ? 'valid' : 'invalid' }));
      }
    } catch (err: any) { setErrorMsg(s => ({ ...s, [provider.key]: err.message || 'Network error' })); setStatus(s => ({ ...s, [provider.key]: 'invalid' })); }
    setValidating(null);
  };
  const hasAnyKey = PROVIDERS.some(p => !!store[p.key]);
  const connectedCount = PROVIDERS.filter(p => !!store[p.key]).length;
  return (
    <div>
      <h2 style={{ fontWeight: 500, fontSize: 'var(--text-md)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0 }}>API Keys</h2>
      <p style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', margin: '2px 0 0', lineHeight: 'var(--leading-normal)' }}>{connectedCount} of {PROVIDERS.length} providers connected. Keys are encrypted with your account.</p>
      <div style={{ ...CARD, marginTop: 20, padding: 0, overflow: 'hidden' }}>
        {PROVIDERS.map((p, i) => {
          const value = store[p.key]; const show = showKeys[p.key] ?? false; const st = status[p.key];
          return (
            <div key={p.key} style={{ padding: 'var(--space-5)', borderBottom: i < PROVIDERS.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-md)', background: value ? 'var(--color-accent)' : 'var(--color-bg-surface)', border: value ? 'none' : '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xs)', fontWeight: 600, fontFamily: 'var(--font-sans)', color: value ? '#fff' : 'var(--color-text-disabled)', flexShrink: 0, transition: 'background 150ms' }}>{p.icon}</div>
                <div style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>{p.label}</div>
                {st && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: st === 'valid' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: st === 'valid' ? 'var(--color-accent)' : 'var(--color-danger-text)' }}>{st === 'valid' ? <CheckIcon /> : <XIcon />}{st === 'valid' ? 'Valid' : 'Invalid'}</div>}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input className="form-input" type={show ? 'text' : 'password'} value={value} onChange={e => (store as any)[p.setter](e.target.value)} placeholder={p.placeholder} style={{ width: '100%', paddingRight: 36 }} />
                  <button onClick={() => setShowKeys(s => ({ ...s, [p.key]: !show }))} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-disabled)', cursor: 'pointer', padding: 2, borderRadius: 'var(--radius-sm)' }}>{show ? <EyeClosed /> : <EyeOpen />}</button>
                </div>
                <button className="btn-sm btn-ghost" disabled={!value || validating === p.key} onClick={() => validate(p)} style={{ borderRadius: 'var(--radius-md)', whiteSpace: 'nowrap', fontSize: 'var(--text-xs)', minWidth: 64 }}>
                  {validating === p.key ? <span style={{ display: 'inline-block', width: 12, height: 12, border: '1.5px solid var(--color-text-disabled)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'btn-spin 600ms linear infinite' }} /> : 'Validate'}
                </button>
              </div>
              {st === 'invalid' && errorMsg[p.key] && <div style={{ marginTop: 6, fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)', fontFamily: 'var(--font-sans)' }}>{errorMsg[p.key]}</div>}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 16 }}>
        <button className="btn btn-primary" disabled={!hasAnyKey} onClick={handleSave} style={{ minWidth: 100 }}>{saved ? '✓ Saved' : 'Save keys'}</button>
      </div>
    </div>
  );
}

export default function SettingsPanel() {
  const [active, setActive] = useState<SectionId>('brand-visual');
  const groups: Record<string, typeof SECTIONS> = {};
  SECTIONS.forEach(s => { (groups[s.group] ??= []).push(s); });

  return (
    <div style={{ flex: 1, display: 'flex', background: 'var(--color-bg)', overflow: 'hidden' }}>
      <nav style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--color-border-default)', background: 'var(--color-bg-card)', padding: '24px 0', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <h1 style={{ fontWeight: 500, fontSize: 'var(--text-md)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0 }}>Settings</h1>
        </div>
        <div style={{ padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <div style={{ padding: '12px 8px 6px', fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-text-disabled)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{group}</div>
              {items.map(s => {
                const on = active === s.id;
                return (
                  <button key={s.id} onClick={() => setActive(s.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--radius-md)', background: on ? 'var(--color-bg-surface)' : 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: on ? 500 : 400, color: on ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', transition: 'background 100ms' }}>
                    <span style={{ color: on ? 'var(--color-accent-subtle)' : 'var(--color-text-disabled)', display: 'flex' }}><s.icon /></span>
                    {s.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </nav>
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
        <div style={{ maxWidth: 520 }}>
          {active === 'brand-visual' && <BrandVisualSection />}
          {active === 'brand-voice' && <BrandVoiceSection />}
          {active === 'api-keys' && <APIKeysSection />}
        </div>
      </div>
    </div>
  );
}
