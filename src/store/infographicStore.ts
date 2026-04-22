import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const HISTORY_CAP = 20;

export interface HistoryEntry {
  label: string;
  json: string;
  ts: number;
}

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
  history?: HistoryEntry[];
  redoStack?: HistoryEntry[];
}

interface InfographicState {
  items: InfographicItem[];
  add: (item: InfographicItem) => void;
  update: (id: string, json: string) => void;
  remove: (id: string) => void;
  pushHistory: (id: string, label: string, previousJson: string) => void;
  undo: (id: string) => HistoryEntry | null;
  redo: (id: string) => HistoryEntry | null;
  restoreHistory: (id: string, index: number) => void;
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

function capHistory(history: HistoryEntry[]): HistoryEntry[] {
  return history.length > HISTORY_CAP ? history.slice(history.length - HISTORY_CAP) : history;
}

export const useInfographicStore = create<InfographicState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) => set((s) => ({ items: s.items.some(i => i.id === item.id) ? s.items : [...s.items, migrateItem({ history: [], redoStack: [], ...item })] })),
      update: (id, json) => set((s) => ({ items: s.items.map(i => i.id === id ? migrateItem({ ...i, json }) : i) })),
      remove: (id) => set((s) => ({ items: s.items.filter(i => i.id !== id) })),

      pushHistory: (id, label, previousJson) => set((s) => ({
        items: s.items.map(i => i.id === id ? { ...i, history: capHistory([...(i.history || []), { label, json: previousJson, ts: Date.now() }]), redoStack: [] } : i),
      })),

      undo: (id) => {
        const item = get().items.find(i => i.id === id);
        if (!item || !item.history?.length) return null;
        const last = item.history[item.history.length - 1];
        set((s) => ({
          items: s.items.map(i => {
            if (i.id !== id) return i;
            const history = (i.history || []).slice(0, -1);
            const redoStack = [...(i.redoStack || []), { label: last.label, json: i.json, ts: Date.now() }];
            return { ...i, json: last.json, history, redoStack };
          }),
        }));
        return last;
      },

      redo: (id) => {
        const item = get().items.find(i => i.id === id);
        if (!item || !item.redoStack?.length) return null;
        const last = item.redoStack[item.redoStack.length - 1];
        set((s) => ({
          items: s.items.map(i => {
            if (i.id !== id) return i;
            const redoStack = (i.redoStack || []).slice(0, -1);
            const history = capHistory([...(i.history || []), { label: last.label, json: i.json, ts: Date.now() }]);
            return { ...i, json: last.json, history, redoStack };
          }),
        }));
        return last;
      },

      restoreHistory: (id, index) => set((s) => ({
        items: s.items.map(i => {
          if (i.id !== id) return i;
          const history = i.history || [];
          if (index < 0 || index >= history.length) return i;
          const target = history[index];
          const newHistory = history.slice(0, index);
          const redoStack = capHistory([
            ...(i.redoStack || []),
            ...history.slice(index).map(h => ({ label: h.label, json: h.json, ts: Date.now() })).reverse(),
            { label: 'restored', json: i.json, ts: Date.now() },
          ]);
          return { ...i, json: target.json, history: newHistory, redoStack };
        }),
      })),
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
