import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { FormInput } from '../ui/FormField';

export default function AuthGate() {
  const { signIn, signUp } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
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
            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <FormInput label="Email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
              <FormInput label="Password" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
              {error && <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-danger-text)', background: 'var(--color-danger-bg)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
              <button className={`btn btn-primary w-full ${loading ? 'loading' : ''}`} type="submit" disabled={loading}>
                {mode === 'login' ? 'Sign in' : 'Sign up'}
              </button>
            </div>
            <div style={{ textAlign: 'center', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--color-accent-subtle)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', textDecoration: 'underline', textUnderlineOffset: 3, padding: 0 }}>
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
