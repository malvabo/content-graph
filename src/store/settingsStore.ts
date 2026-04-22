import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

export interface CustomFont {
  name: string;
  /** data: URL of the uploaded font file (kept client-side only). */
  dataUrl: string;
}

export interface BrandKit {
  name: string;
  colors: { primary: string; secondary: string; accent: string };
  fonts: { title: string; body: string };
  customFonts: CustomFont[];
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
  customFonts: [],
  voice: { personality: '', audience: '', avoidWords: [], examplePost: '' },
  referenceImages: [],
  imageStyleNote: '',
};

/** Popular font presets offered in the Settings picker. Any Google Font
 *  string also works — these are just the quick choices. */
export const FONT_PRESETS = [
  'Inter',
  'Roboto',
  'Space Grotesk',
  'Playfair Display',
  'Lora',
  'Merriweather',
  'Work Sans',
  'DM Sans',
  'IBM Plex Sans',
  'Manrope',
] as const;

interface SettingsState {
  anthropicKey: string;
  openaiKey: string;
  googleKey: string;
  groqKey: string;
  togetherKey: string;
  hfKey: string;
  brand: BrandKit;
  showMinimap: boolean;
  setShowMinimap: (v: boolean) => void;
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
      showMinimap: true,
      setShowMinimap: (v) => set({ showMinimap: v }),
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
            customFonts: partial.customFonts ?? (b.customFonts || EMPTY_BRAND.customFonts),
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
            // Prefer non-empty remote values; never let an empty string from the
            // user_settings row clobber a key the user just pasted locally. The
            // trim/strip keeps any legacy keys stored with whitespace usable.
            const clean = (v: unknown) => {
              if (typeof v !== 'string') return '';
              return v.trim().replace(/^['"`]+|['"`]+$/g, '');
            };
            const pick = (remote: unknown, local: string) => {
              const r = clean(remote);
              return r || local;
            };
            set({
              anthropicKey: pick(data.anthropic_key, current.anthropicKey),
              openaiKey: pick(data.openai_key, current.openaiKey),
              googleKey: pick(data.google_key, current.googleKey),
              groqKey: pick(data.groq_key, current.groqKey),
              togetherKey: pick(data.together_key, current.togetherKey),
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
      partialize: (state) => ({ anthropicKey: state.anthropicKey, openaiKey: state.openaiKey, googleKey: state.googleKey, groqKey: state.groqKey, togetherKey: state.togetherKey, hfKey: state.hfKey, brand: state.brand, showMinimap: state.showMinimap }),
      merge: (persisted: any, current: any) => ({ ...current, ...persisted, brand: { ...EMPTY_BRAND, ...(persisted as any)?.brand } }),
    }
  )
);
