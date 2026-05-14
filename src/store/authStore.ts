import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

let authSub: { unsubscribe: () => void } | null = null;

// Read a non-expired Supabase session from localStorage synchronously so we
// can skip the auth loading gate for returning users. This avoids the black
// screen that lasted up to 5 s while getSession() resolved over the network.
function peekCachedUser(): User | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const expiresAt = parsed?.expires_at as number | undefined;
      if (expiresAt && expiresAt > Math.floor(Date.now() / 1000) + 60) {
        return (parsed.user as User) ?? null;
      }
    }
  } catch {}
  return null;
}

const cachedUser = peekCachedUser();

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  guest: boolean;
  init: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  // Start with the synchronously-peeked user so the app renders immediately
  // for returning users without waiting for getSession() to complete.
  user: cachedUser,
  session: null,
  loading: false,
  guest: false,

  init: async () => {
    if (!supabase) { set({ loading: false }); return; }
    // Safety net: if getSession() hangs (edge network issues, blocked domain),
    // release the loading gate after 2 s (was 5 s).
    const timeout = new Promise<{ data: { session: null } }>(resolve =>
      setTimeout(() => resolve({ data: { session: null } }), 2000)
    );
    try {
      const { data } = await Promise.race([supabase.auth.getSession(), timeout]);
      set({ session: data.session, user: data.session?.user ?? null, loading: false });
    } catch {
      set({ loading: false });
    }
    authSub?.unsubscribe();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
    });
    authSub = subscription;
  },

  signUp: async (email, password) => {
    if (!supabase) return { error: 'Auth not configured' };
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (data.session) set({ session: data.session, user: data.session.user });
    return { error: null };
  },

  signIn: async (email, password) => {
    if (!supabase) return 'Auth not configured';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  },

  signOut: async () => {
    if (supabase) await supabase.auth.signOut();
    set({ user: null, session: null, guest: false });
  },

  signInWithGoogle: async () => {
    if (!supabase) return 'Auth not configured';
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    return error?.message ?? null;
  },

  continueAsGuest: () => set({ guest: true }),
}));
