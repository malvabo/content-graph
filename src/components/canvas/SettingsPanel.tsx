import { useState } from 'react';
import { useSettingsStore, EMPTY_BRAND } from '../../store/settingsStore';

const PROVIDERS = [
  { key: 'anthropicKey' as const, setter: 'setAnthropicKey' as const, label: 'Anthropic', placeholder: 'sk-ant-...', icon: 'A', validateUrl: 'https://api.anthropic.com/v1/messages', validateHeaders: (k: string) => ({ 'x-api-key': k, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', 'Content-Type': 'application/json' }), validateBody: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }) },
  { key: 'openaiKey' as const, setter: 'setOpenaiKey' as const, label: 'OpenAI', placeholder: 'sk-...', icon: 'O', validateUrl: 'https://api.openai.com/v1/models', validateHeaders: (k: string) => ({ Authorization: `Bearer ${k}` }), validateBody: null },
  { key: 'googleKey' as const, setter: 'setGoogleKey' as const, label: 'Google Gemini', placeholder: 'AIza...', icon: 'G', validateUrl: null, validateHeaders: () => ({}), validateBody: null },
  { key: 'groqKey' as const, setter: 'setGroqKey' as const, label: 'Groq (Llama)', placeholder: 'gsk_...', icon: 'L', validateUrl: 'https://api.groq.com/openai/v1/models', validateHeaders: (k: string) => ({ Authorization: `Bearer ${k}` }), validateBody: null },
] as const;

const EyeOpen = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const EyeClosed = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="m1 1 22 22"/></svg>;
const CheckIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>;
const XIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>;

function ColorSwatch({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  return (
    <label style={{ position: 'relative', width: 'var(--size-swatch)', height: 'var(--size-swatch)', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border-default)', background: color, cursor: 'pointer', flexShrink: 0 }}>
      <input type="color" value={color} onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
    </label>
  );
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [val, setVal] = useState('');
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginBottom: tags.length ? 'var(--space-2)' : 0 }}>
        {tags.map(t => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-full)', padding: '2px 10px 2px 10px', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)' }}>
            {t}
            <button onClick={() => onChange(tags.filter(x => x !== t))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--color-text-disabled)', fontSize: 10, lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
      <input className="form-input" value={val} onChange={e => setVal(e.target.value)} placeholder="Type and press Enter"
        style={{ width: '100%' }}
        onKeyDown={e => { if (e.key === 'Enter' && val.trim()) { e.preventDefault(); onChange([...tags, val.trim()]); setVal(''); } }} />
    </div>
  );
}

function BrandKitSection() {
  const { brand, setBrand } = useSettingsStore();
  const [tab, setTab] = useState<'visual' | 'voice'>('visual');
  const b = brand || EMPTY_BRAND;

  return (
    <div style={{ marginBottom: 'var(--space-8)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <span className="text-label">Brand Kit</span>
        <div style={{ display: 'flex', gap: 0, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border-default)' }}>
          {(['visual', 'voice'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '4px 12px', fontSize: 'var(--text-xs)', fontWeight: 500, fontFamily: 'var(--font-sans)',
              background: tab === t ? 'var(--color-bg-card)' : 'transparent', color: tab === t ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
              border: 'none', cursor: 'pointer', textTransform: 'capitalize',
            }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {tab === 'visual' ? (
          <>
            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Brand name</label>
              <input className="form-input" value={b.name} onChange={e => setBrand({ name: e.target.value })} placeholder="Acme Corp" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 'var(--space-2)' }}>Colors</label>
              <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                {(['primary', 'secondary', 'accent'] as const).map(k => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <ColorSwatch color={b.colors[k]} onChange={c => setBrand({ colors: { ...b.colors, [k]: c } })} />
                    <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)', textTransform: 'capitalize' }}>{k}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Personality</label>
              <textarea className="form-input" rows={2} value={b.voice.personality} onChange={e => setBrand({ voice: { ...b.voice, personality: e.target.value } })}
                placeholder="Warm but authoritative. We explain complex topics simply." style={{ width: '100%', resize: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Target audience</label>
              <input className="form-input" value={b.voice.audience} onChange={e => setBrand({ voice: { ...b.voice, audience: e.target.value } })}
                placeholder="Engineering managers at Series B startups" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Words to avoid</label>
              <TagInput tags={b.voice.avoidWords} onChange={t => setBrand({ voice: { ...b.voice, avoidWords: t } })} />
            </div>
            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Example post</label>
              <textarea className="form-input" rows={4} value={b.voice.examplePost} onChange={e => setBrand({ voice: { ...b.voice, examplePost: e.target.value } })}
                placeholder="Paste a real post that captures your brand voice perfectly." style={{ width: '100%', resize: 'none' }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function SettingsPanel() {
  const store = useSettingsStore();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [validating, setValidating] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, 'valid' | 'invalid' | null>>({});
  const [errorMsg, setErrorMsg] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await useSettingsStore.getState().save();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const validate = async (provider: typeof PROVIDERS[number]) => {
    const key = store[provider.key];
    if (!key) return;
    setValidating(provider.key);
    setStatus(s => ({ ...s, [provider.key]: null }));
    setErrorMsg(s => ({ ...s, [provider.key]: '' }));
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

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>
      <div className="p-4 md:px-8 md:py-6" style={{ maxWidth: 560 }}>

        {/* Header */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h1 style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0 }}>Settings</h1>
          <p style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', margin: 'var(--space-1) 0 0', lineHeight: 'var(--leading-loose)' }}>
            Manage API keys and preferences.
          </p>
        </div>

        {/* Section: API Keys */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <span className="text-label">API Keys</span>
          </div>

          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
            {PROVIDERS.map((p, i) => {
              const value = store[p.key];
              const show = showKeys[p.key] ?? false;
              const st = status[p.key];
              const isLast = i === PROVIDERS.length - 1;
              return (
                <div key={p.key} style={{ padding: 'var(--space-5)', borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle)' }}>
                  {/* Provider row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 'var(--radius-md)',
                      background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 'var(--text-xs)', fontWeight: 600, fontFamily: 'var(--font-sans)',
                      color: 'var(--color-text-secondary)', flexShrink: 0
                    }}>{p.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>{p.label}</div>
                    </div>
                    {st && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)',
                        color: st === 'valid' ? 'var(--color-accent)' : 'var(--color-danger-text)'
                      }}>
                        {st === 'valid' ? <CheckIcon /> : <XIcon />}
                        {st === 'valid' ? 'Valid' : `Invalid${errorMsg[p.key] ? ': ' + errorMsg[p.key] : ''}`}
                      </div>
                    )}
                  </div>

                  {/* Input row */}
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input className="form-input" type={show ? 'text' : 'password'} value={value}
                        onChange={e => (store as any)[p.setter](e.target.value)}
                        placeholder={p.placeholder} style={{ width: '100%', paddingRight: 36 }} />
                      <button onClick={() => setShowKeys(s => ({ ...s, [p.key]: !show }))}
                        title={show ? 'Hide key' : 'Show key'}
                        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-disabled)', cursor: 'pointer', padding: 2, borderRadius: 'var(--radius-sm)', transition: 'color 100ms' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-disabled)'; }}>
                        {show ? <EyeClosed /> : <EyeOpen />}
                      </button>
                    </div>
                    <button className="btn-sm btn-ghost" disabled={!value || validating === p.key}
                      onClick={() => validate(p)}
                      style={{ borderRadius: 'var(--radius-md)', whiteSpace: 'nowrap', fontSize: 'var(--text-xs)', minWidth: 64 }}>
                      {validating === p.key ? (
                        <span style={{ display: 'inline-block', width: 12, height: 12, border: '1.5px solid var(--color-text-disabled)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'btn-spin 600ms linear infinite' }} />
                      ) : 'Validate'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Save bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
            <button className="btn btn-primary" disabled={!hasAnyKey} onClick={handleSave}
              style={{ minWidth: 100, transition: 'background 100ms, opacity 100ms' }}>
              {saved ? '✓ Saved' : 'Save keys'}
            </button>
            <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)', lineHeight: 'var(--leading-tight)' }}>
              Encrypted and stored with your account.
            </span>
          </div>
        </div>

        {/* Section: Brand Kit */}
        <BrandKitSection />

      </div>
    </div>
  );
}
