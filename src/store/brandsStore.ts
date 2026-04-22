import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { EMPTY_BRAND, useSettingsStore, type BrandKit } from './settingsStore';
import { useGraphStore } from './graphStore';

export interface SavedBrand extends BrandKit {
  id: string;
  /** Human label for the kit (distinct from BrandKit.name, the brand's marketing name). */
  kitName: string;
}

interface BrandsState {
  brands: SavedBrand[];
  /** The brand applied by default when a workflow has no per-flow override. */
  activeBrandId: string | null;
  addBrand: (initial?: Partial<BrandKit> & { kitName?: string }) => string;
  updateBrand: (id: string, patch: Partial<BrandKit> & { kitName?: string }) => void;
  removeBrand: (id: string) => void;
  duplicateBrand: (id: string) => string;
  setActiveBrand: (id: string | null) => void;
}

function makeId() {
  return `brand-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export const useBrandsStore = create<BrandsState>()(
  persist(
    (set, get) => ({
      brands: [],
      activeBrandId: null,

      addBrand: (initial) => {
        const id = makeId();
        const base: SavedBrand = {
          id,
          kitName: initial?.kitName || 'New brand kit',
          ...EMPTY_BRAND,
          ...(initial || {}),
          colors: { ...EMPTY_BRAND.colors, ...(initial?.colors || {}) },
          fonts: { ...EMPTY_BRAND.fonts, ...(initial?.fonts || {}) },
          voice: { ...EMPTY_BRAND.voice, ...(initial?.voice || {}) },
          customFonts: initial?.customFonts ?? [],
        };
        set((s) => ({
          brands: [...s.brands, base],
          activeBrandId: s.activeBrandId ?? id,
        }));
        return id;
      },

      updateBrand: (id, patch) => set((s) => ({
        brands: s.brands.map((b) => b.id !== id ? b : {
          ...b,
          ...patch,
          colors: { ...b.colors, ...(patch.colors || {}) },
          fonts: { ...b.fonts, ...(patch.fonts || {}) },
          voice: { ...b.voice, ...(patch.voice || {}) },
          customFonts: patch.customFonts ?? b.customFonts,
          kitName: patch.kitName ?? b.kitName,
        }),
      })),

      removeBrand: (id) => set((s) => {
        const brands = s.brands.filter((b) => b.id !== id);
        const activeBrandId = s.activeBrandId === id ? (brands[0]?.id ?? null) : s.activeBrandId;
        return { brands, activeBrandId };
      }),

      duplicateBrand: (id) => {
        const src = get().brands.find((b) => b.id === id);
        if (!src) return '';
        const newId = makeId();
        const dup: SavedBrand = { ...src, id: newId, kitName: `${src.kitName} (copy)` };
        set((s) => ({ brands: [...s.brands, dup] }));
        return newId;
      },

      setActiveBrand: (id) => set({ activeBrandId: id }),
    }),
    {
      name: 'content-graph-brands',
      onRehydrateStorage: () => (state) => {
        // First-run migration: if there are no kits yet but the legacy
        // settingsStore.brand has been filled in, promote it to "Default".
        if (!state || state.brands.length > 0) return;
        // Delay one tick so the settingsStore has had a chance to hydrate.
        setTimeout(() => {
          const cur = useBrandsStore.getState();
          if (cur.brands.length > 0) return;
          const legacy = useSettingsStore.getState().brand;
          if (!legacy) return;
          const hasContent = !!(legacy.name || legacy.voice?.personality || legacy.voice?.audience || legacy.referenceImages?.length);
          if (!hasContent) return;
          cur.addBrand({ ...legacy, kitName: 'Default' });
        }, 0);
      },
    }
  )
);

/**
 * Resolve the currently-active BrandKit for rendering / AI prompts.
 * Priority: per-flow override → global active → legacy settings.brand → EMPTY_BRAND.
 */
export function getActiveBrand(): BrandKit {
  const flowBrandId = useGraphStore.getState().brandId;
  const { brands, activeBrandId } = useBrandsStore.getState();
  if (flowBrandId) {
    const match = brands.find((b) => b.id === flowBrandId);
    if (match) return match;
  }
  if (activeBrandId) {
    const match = brands.find((b) => b.id === activeBrandId);
    if (match) return match;
  }
  return useSettingsStore.getState().brand || EMPTY_BRAND;
}
