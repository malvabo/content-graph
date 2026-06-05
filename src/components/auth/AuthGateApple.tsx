import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { isIosApp } from '../../utils/platform';
import TypewriterLogo from '../TypewriterLogo';

// Login variant that adds "Continue with Apple".
//
// • Inside the iOS app (WKWebView): a minimal "simple flow, no log in" screen —
//   the Apple button just drops the user into the app (guest entry), no real auth.
// • On the web (reached via ?auth=apple): the full form with a real Apple OAuth
//   button alongside Google/email.
export default function AuthGateApple() {
  const { signIn, signUp, signInWithGoogle, signInWithApple, continueAsGuest } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(() => {
    const p = new URLSearchParams(window.location.search);
    const h = new URLSearchParams(window.location.hash.replace('#', '?'));
    const desc = p.get('error_description') || h.get('error_description');
    if (desc) window.history.replaceState({}, '', window.location.pathname + window.location.search);
    try { return desc ? decodeURIComponent(desc) : null; } catch { return desc; }
  });
  const [loading, setLoading] = useState(false);
  const iosApp = isIosApp();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (mode === 'login') {
      const err = await signIn(email, password);
      setLoading(false);
      if (err) setError(err);
    } else {
      const { error: err } = await signUp(email, password);
      setLoading(false);
      if (err) setError(err);
    }
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '12px 14px', borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: '#fff',
    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body)',
    outline: 'none',
    transition: 'border-color 220ms, background 220ms, box-shadow 220ms',
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-caption)', fontWeight: 500,
    color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: 6, letterSpacing: '0.02em',
  };
  const onFieldFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(144,97,249,0.55)';
    e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
    e.currentTarget.style.boxShadow = '0 0 0 4px rgba(144,97,249,0.10)';
  };
  const onFieldBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
    e.currentTarget.style.boxShadow = 'none';
  };

  // Shared dark-glass pill style for the OAuth buttons.
  const oauthButtonStyle: React.CSSProperties = {
    width: '100%', minHeight: 48, padding: '12px 20px', borderRadius: 999,
    background: 'linear-gradient(155deg, #1a1c26 0%, #0d0e16 100%)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: 'rgba(255,255,255,0.92)',
    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body)', fontWeight: 500,
    cursor: loading ? 'progress' : 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    boxShadow: '0 10px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)',
  };

  const AppleIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.417 2.2-1.116 2.96-.84.91-2.2 1.61-3.32 1.52-.14-1.12.41-2.3 1.07-3.02.74-.82 2.04-1.43 3.06-1.46.04.17.06.34.06.5zM20.5 17.06c-.56 1.29-.83 1.86-1.55 3-.99 1.58-2.39 3.55-4.12 3.56-1.54.02-1.94-.99-4.03-.98-2.09.01-2.53.99-4.07.97-1.73-.01-3.06-1.8-4.05-3.38-2.77-4.4-3.06-9.56-1.35-12.3 1.21-1.95 3.12-3.09 4.92-3.09 1.83 0 2.98 1.01 4.5 1.01 1.47 0 2.37-1.01 4.49-1.01 1.6 0 3.3.87 4.51 2.38-3.96 2.17-3.32 7.83.74 9.4z"/>
    </svg>
  );

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(180deg, #0a0b14 0%, #060710 60%, #04050c 100%)',
      padding: 'var(--space-4)',
      color: 'rgba(255,255,255,0.92)',
    }}>
      {/* Ambient breathing orbs — same vocabulary as the rest of the app */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        {[
          { color: '144,97,249', top: '8%',  left: '-12%', size: 360, dur: 12.5, delay: -2.1 },
          { color: '29,155,240', top: '36%', left: '70%',  size: 300, dur: 10.2, delay: -5.6 },
          { color: '13,191,90',  top: '70%', left: '-8%',  size: 320, dur: 14.8, delay: -8.3 },
          { color: '255,150,18', top: '60%', left: '60%',  size: 260, dur: 11.4, delay: -1.4 },
        ].map((o, i) => (
          <div key={i} className="widget-glow" style={{
            position: 'absolute', top: o.top, left: o.left, width: o.size, height: o.size, borderRadius: '50%',
            background: `radial-gradient(circle, rgba(${o.color},0.30) 0%, rgba(${o.color},0.10) 38%, rgba(${o.color},0) 70%)`,
            filter: 'blur(20px)',
            animationName: 'widget-breathe',
            animationDuration: `${o.dur}s`,
            animationDelay: `${o.delay}s`,
            animationTimingFunction: 'cubic-bezier(0.45, 0.05, 0.55, 0.95)',
            animationIterationCount: 'infinite',
            willChange: 'transform, opacity',
          }} />
        ))}
      </div>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 380 }}>
        {/* Logo + heading */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <div style={{ margin: '0 auto var(--space-4)' }}>
            <TypewriterLogo />
          </div>
          <h1 style={{
            fontWeight: 700, fontSize: 'var(--text-title)', lineHeight: 1.2,
            fontFamily: 'var(--font-sans)', color: '#fff',
            letterSpacing: '-0.02em', margin: 0,
          }}>
            {iosApp ? 'Welcome' : (mode === 'login' ? 'Welcome back' : 'Create account')}
          </h1>
          <p style={{
            margin: '8px 0 0', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body)',
            color: 'rgba(255,255,255,0.55)', lineHeight: 1.4,
          }}>
            {iosApp
              ? 'Tap to get started.'
              : (mode === 'login' ? 'Sign in to keep your notes in sync.' : 'Start capturing thoughts and shipping posts.')}
          </p>
        </div>

        {iosApp ? (
          /* iOS app — simple flow, no log in: tap Apple to enter the app. */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <button
              type="button"
              onClick={() => continueAsGuest()}
              style={oauthButtonStyle}
            >
              {AppleIcon}
              Continue with Apple
            </button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {/* Glass card containing the form fields */}
            <div style={{
              position: 'relative',
              background: 'linear-gradient(155deg, #1a1c26 0%, #0d0e16 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 22,
              padding: 'var(--space-5)',
              display: 'flex', flexDirection: 'column', gap: 'var(--space-4)',
              boxShadow: '0 18px 48px rgba(0,0,0,0.40), 0 2px 6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}>
              <div>
                <label htmlFor="auth-email" style={labelStyle}>Email</label>
                <input
                  id="auth-email" type="email" required autoFocus
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={fieldStyle} onFocus={onFieldFocus} onBlur={onFieldBlur}
                />
              </div>
              <div>
                <label htmlFor="auth-password" style={labelStyle}>Password</label>
                <input
                  id="auth-password" type="password" required minLength={6}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={fieldStyle} onFocus={onFieldFocus} onBlur={onFieldBlur}
                />
              </div>
              {error && (
                <div role="alert" aria-live="polite" style={{
                  fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)', lineHeight: 1.45,
                  color: 'rgba(255,168,168,0.95)',
                  background: 'linear-gradient(155deg, rgba(201,48,48,0.18) 0%, #1a1c26 75%, #0d0e16 100%)',
                  border: '1px solid rgba(255,107,107,0.25)',
                  borderRadius: 14, padding: '10px 14px', wordBreak: 'break-word',
                }}>
                  {error}
                </div>
              )}
              <button
                type="submit" disabled={loading}
                style={{
                  width: '100%', minHeight: 48, padding: '12px 24px', borderRadius: 999,
                  background: 'linear-gradient(135deg, rgba(144,97,249,0.95) 0%, rgba(110,80,220,0.95) 100%)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  color: '#fff',
                  fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-lg)', fontWeight: 600, letterSpacing: '-0.01em',
                  cursor: loading ? 'progress' : 'pointer',
                  boxShadow: '0 14px 36px rgba(144,97,249,0.45), inset 0 1px 0 rgba(255,255,255,0.14)',
                  opacity: loading ? 0.85 : 1,
                  transition: 'opacity 200ms',
                }}
              >
                {loading ? (mode === 'login' ? 'Signing in…' : 'Creating account…') : (mode === 'login' ? 'Sign in' : 'Sign up')}
              </button>
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.10)' }} />
              <span style={{ fontSize: 'var(--text-caption)', fontFamily: 'var(--font-sans)', color: 'rgba(255,255,255,0.45)' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.10)' }} />
            </div>

            {/* Google sign-in — dark glass pill */}
            <button
              type="button" disabled={loading}
              onClick={async () => { setLoading(true); const err = await signInWithGoogle(); setLoading(false); if (err) setError(err); }}
              style={oauthButtonStyle}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continue with Google
            </button>

            {/* Apple sign-in — dark glass pill */}
            <button
              type="button" disabled={loading}
              onClick={async () => { setLoading(true); const err = await signInWithApple(); setLoading(false); if (err) setError(err); }}
              style={oauthButtonStyle}
            >
              {AppleIcon}
              Continue with Apple
            </button>

            {/* Mode switch */}
            <div style={{
              textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)',
              color: 'rgba(255,255,255,0.55)', marginTop: 4,
            }}>
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)', fontWeight: 600,
                  color: '#a78bfa', textDecoration: 'underline', textUnderlineOffset: 3,
                  padding: 0,
                }}
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </div>

            {/* Guest */}
            <button
              type="button" onClick={continueAsGuest}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)',
                color: 'rgba(255,255,255,0.45)',
                padding: '8px 12px', textAlign: 'center', alignSelf: 'center',
              }}
            >
              Continue as guest
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
