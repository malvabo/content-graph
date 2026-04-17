import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  init: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  session: null,
  loading: false,

  init: async () => {
    if (!supabase) { set({ loading: false }); return; }
    const { data } = await supabase.auth.getSession();
    set({ session: data.session, user: data.session?.user ?? null, loading: false });
    supabase.auth.onAuthStateChange((_event: any, session: any) => {
      set({ session, user: session?.user ?? null });
    });
  },

  signUp: async (email, password) => {
    if (!supabase) return 'Auth not configured';
    const { error } = await supabase.auth.signUp({ email, password });
    return error?.message ?? null;
  },

  signIn: async (email, password) => {
    if (!supabase) return 'Auth not configured';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  },

  signOut: async () => {
    if (supabase) await supabase.auth.signOut();
    set({ user: null, session: null });
  },
}));
