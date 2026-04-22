import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface InfographicItem {
  id: string;
  nodeId: string;
  label: string;
  json: string;
  /**
   * Theme block that used to live inside `json`. Stripped on hydration and
   * preserved here for one release so we can verify migration and recover
   * user-authored palettes if needed. Drop in the release after 2026-05.
   */
  legacyTheme?: unknown;
}

interface InfographicState {
  items: InfographicItem[];
  add: (item: InfographicItem) => void;
  update: (id: string, json: string) => void;
  remove: (id: string) => void;
}

// Rewrites persisted JSON that still carries a `theme` block or per-point
// style fields (`color`, `size`, `fontWeight`, `fontStyle`). Keeps content
// identical otherwise. Non-destructive: the stripped theme is preserved on
// the item as `legacyTheme`.
function migrateItem(item: InfographicItem): InfographicItem {
  let parsed: any;
  try { parsed = JSON.parse(item.json); } catch { return item; }
  if (!parsed || typeof parsed !== 'object') return item;

  const hasTheme = parsed.theme && typeof parsed.theme === 'object';
  const hasPerPointStyle = Array.isArray(parsed.points) && parsed.points.some((p: any) =>
    p && typeof p === 'object' && ('color' in p || 'size' in p || 'fontWeight' in p || 'fontStyle' in p)
  );
  if (!hasTheme && !hasPerPointStyle) return item;

  const { theme, ...rest } = parsed;
  if (Array.isArray(rest.points)) {
    rest.points = rest.points.map((p: any) => {
      if (!p || typeof p !== 'object') return p;
      const { color: _c, size: _s, fontWeight: _w, fontStyle: _st, ...pr } = p;
      void _c; void _s; void _w; void _st;
      return pr;
    });
  }
  return { ...item, json: JSON.stringify(rest), legacyTheme: theme ?? item.legacyTheme };
}

export const useInfographicStore = create<InfographicState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) => set((s) => ({ items: s.items.some(i => i.id === item.id) ? s.items : [...s.items, migrateItem(item)] })),
      update: (id, json) => set((s) => ({ items: s.items.map(i => i.id === id ? migrateItem({ ...i, json }) : i) })),
      remove: (id) => set((s) => ({ items: s.items.filter(i => i.id !== id) })),
    }),
    {
      name: 'content-graph-infographics',
      onRehydrateStorage: () => (state) => {
        if (!state || !Array.isArray(state.items)) return;
        const migrated = state.items.map(migrateItem);
        const changed = migrated.some((it, i) => it !== state.items[i]);
        if (changed) useInfographicStore.setState({ items: migrated });
      },
    }
  )
);
