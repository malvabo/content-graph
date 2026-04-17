import { useState } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

const PROVIDERS = [
  { key: 'anthropicKey' as const, setter: 'setAnthropicKey' as const, label: 'Anthropic', placeholder: 'sk-ant-...', validateUrl: 'https://api.anthropic.com/v1/messages', validateHeaders: (k: string) => ({ 'x-api-key': k, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', 'Content-Type': 'application/json' }), validateBody: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }) },
  { key: 'openaiKey' as const, setter: 'setOpenaiKey' as const, label: 'OpenAI', placeholder: 'sk-...', validateUrl: 'https://api.openai.com/v1/models', validateHeaders: (k: string) => ({ Authorization: `Bearer ${k}` }), validateBody: null },
  { key: 'googleKey' as const, setter: 'setGoogleKey' as const, label: 'Google Gemini', placeholder: 'AIza...', validateUrl: null, validateHeaders: () => ({}), validateBody: null },
] as const;

export default function SettingsPanel() {
  const store = useSettingsStore();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [validating, setValidating] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, 'valid' | 'invalid' | null>>({});
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
    try {
      if (!provider.validateUrl) {
        // Google Gemini — test with list models
        const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${key}`);
        setStatus(s => ({ ...s, [provider.key]: res.ok ? 'valid' : 'invalid' }));
      } else {
        const opts: RequestInit = { headers: provider.validateHeaders(key) };
        if (provider.validateBody) { opts.method = 'POST'; opts.body = provider.validateBody; }
        const res = await fetch(provider.validateUrl, opts);
        setStatus(s => ({ ...s, [provider.key]: res.ok || res.status === 400 ? 'valid' : 'invalid' }));
      }
    } catch { setStatus(s => ({ ...s, [provider.key]: 'invalid' })); }
    setValidating(null);
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>
      <div className="p-4 md:px-8 md:py-6" style={{ maxWidth: 520 }}>
        <h1 style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: '0 0 var(--space-6)' }}>Settings</h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {PROVIDERS.map(p => {
            const value = store[p.key];
            const show = showKeys[p.key] ?? false;
            const st = status[p.key];
            return (
              <div key={p.key} style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
                <label className="text-field-label">{p.label} API Key</label>
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input className="form-input" type={show ? 'text' : 'password'} value={value}
                      onChange={e => (store as any)[p.setter](e.target.value)}
                      placeholder={p.placeholder} style={{ width: '100%', paddingRight: 40 }} />
                    <button onClick={() => setShowKeys(s => ({ ...s, [p.key]: !show }))}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-disabled)', cursor: 'pointer', padding: 4 }}>
                      {show ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="m1 1 22 22"/></svg>
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                    </button>
                  </div>
                  <button className="btn-ghost btn-sm" disabled={!value || validating === p.key}
                    onClick={() => validate(p)}
                    style={{ borderRadius: 'var(--radius-md)', whiteSpace: 'nowrap', fontSize: 'var(--text-xs)' }}>
                    {validating === p.key ? '...' : 'Validate'}
                  </button>
                </div>
                {st && (
                  <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', marginTop: 'var(--space-2)', color: st === 'valid' ? 'var(--color-accent)' : 'var(--color-danger-text)' }}>
                    {st === 'valid' ? '✓ Key is valid' : '✗ Invalid key'}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button className="btn btn-primary" onClick={handleSave}>
            {saved ? '✓ Saved' : 'Save all keys'}
          </button>
          <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)' }}>
            Stored with your account.
          </span>
        </div>
      </div>
    </div>
  );
}
