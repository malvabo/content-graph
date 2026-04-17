import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

export interface BrandKit {
  name: string;
  colors: { primary: string; secondary: string; accent: string };
  voice: {
    personality: string;
    audience: string;
    avoidWords: string[];
    examplePost: string;
  };
}

export const EMPTY_BRAND: BrandKit = {
  name: '',
  colors: { primary: '#0DBF5A', secondary: '#1A2420', accent: '#F2EFE9' },
  voice: { personality: '', audience: '', avoidWords: [], examplePost: '' },
};

interface SettingsState {
  anthropicKey: string;
  openaiKey: string;
  googleKey: string;
  groqKey: string;
  brand: BrandKit;
  loaded: boolean;
  setAnthropicKey: (key: string) => void;
  setOpenaiKey: (key: string) => void;
  setGoogleKey: (key: string) => void;
  setGroqKey: (key: string) => void;
  setBrand: (brand: Partial<BrandKit>) => void;
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
      brand: { ...EMPTY_BRAND },
      loaded: false,

      setAnthropicKey: (key) => set({ anthropicKey: key }),
      setOpenaiKey: (key) => set({ openaiKey: key }),
      setGoogleKey: (key) => set({ googleKey: key }),
      setGroqKey: (key) => set({ groqKey: key }),
      setBrand: (partial) => set((s) => ({ brand: { ...s.brand, ...partial, colors: { ...s.brand.colors, ...(partial.colors || {}) }, voice: { ...s.brand.voice, ...(partial.voice || {}) } } })),

      load: async () => {
        if (!supabase) { set({ loaded: true }); return; }
        try {
          const { data: { user } } = await supabase!.auth.getUser();
          if (!user) { set({ loaded: true }); return; }
          const { data } = await supabase!.from('user_settings').select('anthropic_key, openai_key, google_key, groq_key').eq('user_id', user.id).single();
          if (data) {
            const current = get();
            set({
              anthropicKey: data.anthropic_key ?? current.anthropicKey,
              openaiKey: data.openai_key ?? current.openaiKey,
              googleKey: data.google_key ?? current.googleKey,
              groqKey: data.groq_key ?? current.groqKey,
              loaded: true,
            });
          } else set({ loaded: true });
        } catch {
          set({ loaded: true });
        }
      },

      save: async () => {
        if (!supabase) return;
        const { data: { user } } = await supabase!.auth.getUser();
        if (!user) return;
        const { anthropicKey, openaiKey, googleKey, groqKey } = get();
        const { error } = await supabase!.from('user_settings').upsert({ user_id: user.id, anthropic_key: anthropicKey, openai_key: openaiKey, google_key: googleKey, groq_key: groqKey }, { onConflict: 'user_id' });
        if (error) console.error('Failed to save settings:', error.message);
      },
    }),
    {
      name: 'content-graph-settings',
      partialize: (state) => ({ anthropicKey: state.anthropicKey, openaiKey: state.openaiKey, googleKey: state.googleKey, groqKey: state.groqKey, brand: state.brand }),
    }
  )
);
