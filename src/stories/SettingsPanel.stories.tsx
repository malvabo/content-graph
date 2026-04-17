import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import '../index.css';

/**
 * Mirrors SettingsPanel from components/canvas/SettingsPanel.tsx.
 * API key input with show/hide toggle, save button, helper text.
 * Decoupled from settingsStore for isolation.
 */

function SettingsPanel({ saved = false }: { saved?: boolean }) {
  const [show, setShow] = useState(false);
  const [value, setValue] = useState('');
  const [isSaved, setIsSaved] = useState(saved);

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>
      <div className="p-4 md:px-8 md:py-6" style={{ maxWidth: 520 }}>
        <h1 style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: '0 0 var(--space-6)' }}>Settings</h1>
        <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
          <label className="text-field-label">Anthropic API Key</label>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input className="form-input" type={show ? 'text' : 'password'} value={value} onChange={(e) => setValue(e.target.value)} placeholder="sk-ant-..." style={{ width: '100%', paddingRight: 40 }} />
              <button onClick={() => setShow(!show)}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-disabled)', cursor: 'pointer', padding: 4 }}>
                {show ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="m1 1 22 22"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)', marginTop: 'var(--space-2)' }}>
            Encrypted and stored with your account.
          </div>
        </div>
        <div style={{ marginTop: 'var(--space-4)' }}>
          <button className="btn btn-primary" onClick={() => { setIsSaved(true); setTimeout(() => setIsSaved(false), 1500); }}>
            {isSaved ? '✓ Saved' : 'Save'}
          </button>
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
