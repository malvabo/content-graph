import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { FormInput } from '../ui/FormField';

export default function AuthGate() {
  const { signIn, signUp, signInWithGoogle, continueAsGuest } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(() => {
    const p = new URLSearchParams(window.location.search);
    const desc = p.get('error_description');
    // Only wipe the URL when there is an error and no PKCE code in flight.
    // If ?code= is present, Supabase's _initialize() is mid-exchange — leave the URL intact.
    if (desc && !p.get('code')) window.history.replaceState({}, '', window.location.pathname);
    try { return desc ? decodeURIComponent(desc) : null; } catch { return desc; }
  });
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const err = mode === 'login' ? await signIn(email, password) : await signUp(email, password);
    setLoading(false);
    if (err) setError(err);
    else if (mode === 'signup') setSignupDone(true);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: 'var(--space-4)' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-surface)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>up</div>
          <h1 style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-lg)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', margin: 0 }}>
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h1>
        </div>

        {signupDone ? (
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>Check your email</div>
            <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>Click the link we sent to {email} to confirm your account.</div>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', boxShadow: 'var(--shadow-lg)' }}>
              <FormInput label="Email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
              <FormInput label="Password" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
              {error && <div aria-live="polite" style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-danger-text)', background: 'var(--color-danger-bg)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
              <button className={`btn btn-primary w-full ${loading ? 'loading' : ''}`} type="submit" disabled={loading}>
                {mode === 'login' ? 'Sign in' : 'Sign up'}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border-default)' }} />
              <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border-default)' }} />
            </div>
            <button type="button" disabled={loading} onClick={async () => { setLoading(true); const err = await signInWithGoogle(); setLoading(false); if (err) setError(err); }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; e.currentTarget.style.background = 'var(--color-bg-card)'; }}
              style={{ width: '100%', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)', background: 'var(--color-bg-card)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', transition: 'border-color .15s, background .15s' }}>
              <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Continue with Google
            </button>
            <div style={{ textAlign: 'center', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--color-accent-subtle)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', textDecoration: 'underline', textUnderlineOffset: 3, padding: 0 }}>
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </div>
            <button type="button" onClick={continueAsGuest}
              style={{ background: 'none', border: 'none', color: 'var(--color-text-tertiary)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', textDecoration: 'underline', textUnderlineOffset: 3, padding: 'var(--space-2) var(--space-3)', textAlign: 'center' }}>
              Continue as guest
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
