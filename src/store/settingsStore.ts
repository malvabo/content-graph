import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

interface SettingsState {
  anthropicKey: string;
  openaiKey: string;
  googleKey: string;
  groqKey: string;
  loaded: boolean;
  setAnthropicKey: (key: string) => void;
  setOpenaiKey: (key: string) => void;
  setGoogleKey: (key: string) => void;
  setGroqKey: (key: string) => void;
  load: () => Promise<void>;
  save: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      anthropicKey: '',
      openaiKey: '',
      googleKey: '',
      groqKey: '',
      loaded: false,

      setAnthropicKey: (key) => set({ anthropicKey: key }),
      setOpenaiKey: (key) => set({ openaiKey: key }),
      setGoogleKey: (key) => set({ googleKey: key }),
      setGroqKey: (key) => set({ groqKey: key }),

      load: async () => {
        if (!supabase) { set({ loaded: true }); return; }
        try {
          const { data: { user } } = await supabase!.auth.getUser();
          if (!user) { set({ loaded: true }); return; }
          const { data } = await supabase!.from('user_settings').select('anthropic_key, openai_key, google_key, groq_key').eq('user_id', user.id).single();
          if (data) set({ anthropicKey: data.anthropic_key ?? '', openaiKey: data.openai_key ?? '', googleKey: data.google_key ?? '', groqKey: data.groq_key ?? '', loaded: true });
          else set({ loaded: true });
        } catch {
          set({ loaded: true });
        }
      },

      save: async () => {
        if (!supabase) return;
        const { data: { user } } = await supabase!.auth.getUser();
        if (!user) return;
        const { anthropicKey, openaiKey, googleKey, groqKey } = get();
        await supabase!.from('user_settings').upsert({ user_id: user.id, anthropic_key: anthropicKey, openai_key: openaiKey, google_key: googleKey, groq_key: groqKey }, { onConflict: 'user_id' });
      },
    }),
    {
      name: 'content-graph-settings',
      partialize: (state) => ({ anthropicKey: state.anthropicKey, openaiKey: state.openaiKey, googleKey: state.googleKey, groqKey: state.groqKey }),
    }
  )
);
