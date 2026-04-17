import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import '../index.css';

/**
 * Mirrors SettingsPanel from components/canvas/SettingsPanel.tsx.
 * Grouped card with provider rows, validate per-key, single save action.
 */

function SettingsPanel({ saved = false }: { saved?: boolean }) {
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({ anthropic: '', openai: '', google: '' });
  const [isSaved, setIsSaved] = useState(saved);
  const [statuses, setStatuses] = useState<Record<string, 'valid' | 'invalid' | null>>({});

  const providers = [
    { id: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-...', icon: 'A' },
    { id: 'openai', label: 'OpenAI', placeholder: 'sk-...', icon: 'O' },
    { id: 'google', label: 'Google Gemini', placeholder: 'AIza...', icon: 'G' },
  ];

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>
      <div className="p-4 md:px-8 md:py-6" style={{ maxWidth: 560 }}>
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h1 style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0 }}>Settings</h1>
          <p style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', margin: 'var(--space-1) 0 0', lineHeight: 'var(--leading-loose)' }}>
            Manage API keys and preferences.
          </p>
        </div>

        <div style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <span className="text-label">API Keys</span>
          </div>

          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
            {providers.map((p, i) => {
              const isLast = i === providers.length - 1;
              const st = statuses[p.id];
              return (
                <div key={p.id} style={{ padding: 'var(--space-5)', borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-md)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xs)', fontWeight: 600, fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)' }}>{p.icon}</div>
                    <div style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>{p.label}</div>
                    {st && <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: st === 'valid' ? 'var(--color-accent)' : 'var(--color-danger-text)' }}>{st === 'valid' ? '✓ Valid' : '✗ Invalid'}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input className="form-input" type={show[p.id] ? 'text' : 'password'} value={values[p.id]} onChange={e => setValues(v => ({ ...v, [p.id]: e.target.value }))} placeholder={p.placeholder} style={{ width: '100%', paddingRight: 36 }} />
                      <button onClick={() => setShow(s => ({ ...s, [p.id]: !s[p.id] }))} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-disabled)', cursor: 'pointer', padding: 2 }}>
                        {show[p.id]
                          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="m1 1 22 22"/></svg>
                          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                      </button>
                    </div>
                    <button className="btn-sm btn-ghost" disabled={!values[p.id]}
                      onClick={() => setStatuses(s => ({ ...s, [p.id]: Math.random() > 0.3 ? 'valid' : 'invalid' }))}
                      style={{ borderRadius: 'var(--radius-md)', whiteSpace: 'nowrap', fontSize: 'var(--text-xs)', minWidth: 64 }}>
                      Validate
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
            <button className="btn btn-primary" onClick={() => { setIsSaved(true); setTimeout(() => setIsSaved(false), 1500); }} style={{ minWidth: 100 }}>
              {isSaved ? '✓ Saved' : 'Save keys'}
            </button>
            <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)' }}>
              Encrypted and stored with your account.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const meta: Meta<typeof SettingsPanel> = {
  title: 'Components/Surfaces/Settings Panel',
  component: SettingsPanel,
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj<typeof SettingsPanel> = { args: {} };
export const SavedState: StoryObj<typeof SettingsPanel> = { name: 'Saved State', args: { saved: true } };
