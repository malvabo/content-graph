import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

export interface BrandKit {
  name: string;
  colors: { primary: string; secondary: string; accent: string };
  fonts: { title: string; body: string };
  voice: {
    personality: string;
    audience: string;
    avoidWords: string[];
    examplePost: string;
  };
  referenceImages: string[];
  imageStyleNote: string;
}

export const EMPTY_BRAND: BrandKit = {
  name: '',
  colors: { primary: '#0DBF5A', secondary: '#1A2420', accent: '#F2EFE9' },
  fonts: { title: '', body: '' },
  voice: { personality: '', audience: '', avoidWords: [], examplePost: '' },
  referenceImages: [],
  imageStyleNote: '',
};

interface SettingsState {
  anthropicKey: string;
  openaiKey: string;
  googleKey: string;
  groqKey: string;
  togetherKey: string;
  hfKey: string;
  brand: BrandKit;
  loaded: boolean;
  setAnthropicKey: (key: string) => void;
  setOpenaiKey: (key: string) => void;
  setGoogleKey: (key: string) => void;
  setGroqKey: (key: string) => void;
  setTogetherKey: (key: string) => void;
  setHfKey: (key: string) => void;
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
      togetherKey: '',
      hfKey: '',
      brand: { ...EMPTY_BRAND },
      loaded: false,

      setAnthropicKey: (key) => set({ anthropicKey: key }),
      setOpenaiKey: (key) => set({ openaiKey: key }),
      setGoogleKey: (key) => set({ googleKey: key }),
      setGroqKey: (key) => set({ groqKey: key }),
      setTogetherKey: (key) => set({ togetherKey: key }),
      setHfKey: (key) => set({ hfKey: key }),
      setBrand: (partial) => set((s: any) => {
        const b = s.brand || EMPTY_BRAND;
        return {
          brand: {
            ...b,
            ...partial,
            colors: { ...b.colors, ...(partial.colors || {}) },
            fonts: { ...(b.fonts || EMPTY_BRAND.fonts), ...(partial.fonts || {}) },
            voice: { ...b.voice, ...(partial.voice || {}) },
          },
        };
      }),

      load: async () => {
        if (!supabase) { set({ loaded: true }); return; }
        try {
          const { data: { user } } = await supabase!.auth.getUser();
          if (!user) { set({ loaded: true }); return; }
          const { data } = await supabase!.from('user_settings').select('anthropic_key, openai_key, google_key, groq_key, together_key').eq('user_id', user.id).single();
          if (data) {
            const current = get();
            set({
              anthropicKey: data.anthropic_key ?? current.anthropicKey,
              openaiKey: data.openai_key ?? current.openaiKey,
              googleKey: data.google_key ?? current.googleKey,
              groqKey: data.groq_key ?? current.groqKey,
              togetherKey: data.together_key ?? current.togetherKey,
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
        const { anthropicKey, openaiKey, googleKey, groqKey, togetherKey } = get();
        const { error } = await supabase!.from('user_settings').upsert({ user_id: user.id, anthropic_key: anthropicKey, openai_key: openaiKey, google_key: googleKey, groq_key: groqKey, together_key: togetherKey }, { onConflict: 'user_id' });
        if (error) console.error('Failed to save settings:', error.message);
      },
    }),
    {
      name: 'content-graph-settings',
      partialize: (state) => ({ anthropicKey: state.anthropicKey, openaiKey: state.openaiKey, googleKey: state.googleKey, groqKey: state.groqKey, togetherKey: state.togetherKey, hfKey: state.hfKey, brand: state.brand }),
      merge: (persisted: any, current: any) => ({ ...current, ...persisted, brand: { ...EMPTY_BRAND, ...(persisted as any)?.brand } }),
    }
  )
);
