import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

export interface BrandKit {
  id: string;
  name: string;
  colors: { primary: string; secondary: string; accent: string };
  voice: {
    personality: string;
    audience: string;
    avoidWords: string[];
    examplePost: string;
  };
  referenceImages: string[];
  imageStyleNote: string;
}

const DEFAULT_BRAND_ID = 'default';

export const EMPTY_BRAND: BrandKit = {
  id: DEFAULT_BRAND_ID,
  name: '',
  colors: { primary: '#0DBF5A', secondary: '#1A2420', accent: '#F2EFE9' },
  voice: { personality: '', audience: '', avoidWords: [], examplePost: '' },
  referenceImages: [],
  imageStyleNote: '',
};

function newBrandId(): string {
  return `brand-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeEmptyBrand(id: string = newBrandId(), name = ''): BrandKit {
  return { ...EMPTY_BRAND, id, name, colors: { ...EMPTY_BRAND.colors }, voice: { ...EMPTY_BRAND.voice, avoidWords: [] }, referenceImages: [] };
}

interface SettingsState {
  anthropicKey: string;
  openaiKey: string;
  googleKey: string;
  groqKey: string;
  togetherKey: string;
  hfKey: string;
  brands: BrandKit[];
  activeBrandId: string;
  brand: BrandKit;
  loaded: boolean;
  setAnthropicKey: (key: string) => void;
  setOpenaiKey: (key: string) => void;
  setGoogleKey: (key: string) => void;
  setGroqKey: (key: string) => void;
  setTogetherKey: (key: string) => void;
  setHfKey: (key: string) => void;
  setBrand: (brand: Partial<BrandKit>) => void;
  addBrand: (name?: string) => string;
  renameBrand: (id: string, name: string) => void;
  deleteBrand: (id: string) => void;
  setActiveBrandId: (id: string) => void;
  load: () => Promise<void>;
  save: () => Promise<void>;
}

function pickActive(brands: BrandKit[], activeId: string): BrandKit {
  return brands.find((b) => b.id === activeId) ?? brands[0] ?? EMPTY_BRAND;
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
      brands: [{ ...EMPTY_BRAND }],
      activeBrandId: DEFAULT_BRAND_ID,
      brand: { ...EMPTY_BRAND },
      loaded: false,

      setAnthropicKey: (key) => set({ anthropicKey: key }),
      setOpenaiKey: (key) => set({ openaiKey: key }),
      setGoogleKey: (key) => set({ googleKey: key }),
      setGroqKey: (key) => set({ groqKey: key }),
      setTogetherKey: (key) => set({ togetherKey: key }),
      setHfKey: (key) => set({ hfKey: key }),

      setBrand: (partial) => set((s) => {
        const activeId = s.activeBrandId;
        const brands = s.brands.map((b) => {
          if (b.id !== activeId) return b;
          return {
            ...b,
            ...partial,
            id: b.id,
            colors: { ...b.colors, ...(partial.colors || {}) },
            voice: { ...b.voice, ...(partial.voice || {}) },
          };
        });
        return { brands, brand: pickActive(brands, activeId) };
      }),

      addBrand: (name = '') => {
        const id = newBrandId();
        set((s) => {
          const brands = [...s.brands, makeEmptyBrand(id, name)];
          return { brands, activeBrandId: id, brand: pickActive(brands, id) };
        });
        return id;
      },

      renameBrand: (id, name) => set((s) => {
        const brands = s.brands.map((b) => (b.id === id ? { ...b, name } : b));
        return { brands, brand: pickActive(brands, s.activeBrandId) };
      }),

      deleteBrand: (id) => set((s) => {
        if (s.brands.length <= 1) return s;
        const brands = s.brands.filter((b) => b.id !== id);
        const activeBrandId = s.activeBrandId === id ? brands[0].id : s.activeBrandId;
        return { brands, activeBrandId, brand: pickActive(brands, activeBrandId) };
      }),

      setActiveBrandId: (id) => set((s) => {
        if (!s.brands.some((b) => b.id === id)) return s;
        return { activeBrandId: id, brand: pickActive(s.brands, id) };
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
      partialize: (state) => ({
        anthropicKey: state.anthropicKey,
        openaiKey: state.openaiKey,
        googleKey: state.googleKey,
        groqKey: state.groqKey,
        togetherKey: state.togetherKey,
        hfKey: state.hfKey,
        brands: state.brands,
        activeBrandId: state.activeBrandId,
      }),
      merge: ((persisted: unknown, current: SettingsState): SettingsState => {
        const p = (persisted ?? {}) as any;
        const base = { ...current, ...p };
        // Legacy migration: persisted.brand (single) → brands[] with one entry
        let brands: BrandKit[] | undefined = Array.isArray(p.brands) ? (p.brands as BrandKit[]) : undefined;
        let activeBrandId: string | undefined = typeof p.activeBrandId === 'string' ? p.activeBrandId : undefined;
        if (!brands || brands.length === 0) {
          const legacy = p.brand;
          const seed: BrandKit = legacy
            ? { ...EMPTY_BRAND, ...legacy, id: DEFAULT_BRAND_ID, colors: { ...EMPTY_BRAND.colors, ...(legacy.colors || {}) }, voice: { ...EMPTY_BRAND.voice, ...(legacy.voice || {}) } }
            : { ...EMPTY_BRAND };
          brands = [seed];
          activeBrandId = seed.id;
        }
        // Normalize each brand to ensure required fields exist and every brand has an id
        brands = brands.map((b: any, i: number) => ({
          ...EMPTY_BRAND,
          ...b,
          id: b?.id ?? (i === 0 ? DEFAULT_BRAND_ID : newBrandId()),
          colors: { ...EMPTY_BRAND.colors, ...(b?.colors || {}) },
          voice: { ...EMPTY_BRAND.voice, ...(b?.voice || {}) },
        }));
        if (!activeBrandId || !brands.some((b) => b.id === activeBrandId)) {
          activeBrandId = brands[0].id;
        }
        return { ...base, brands, activeBrandId, brand: pickActive(brands, activeBrandId) };
      }) as any,
    }
  )
);
