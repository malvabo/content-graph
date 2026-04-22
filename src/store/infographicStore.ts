import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { normalizeInfographicData } from '../components/nodes/InfographicNode';

export interface InfographicItem {
  id: string;
  nodeId: string;
  label: string;
  json: string;
}

interface InfographicState {
  items: InfographicItem[];
  migratedFrom?: number;
  clearMigrationNotice: () => void;
  add: (item: InfographicItem) => void;
  update: (id: string, json: string) => void;
  remove: (id: string) => void;
}

function stripLegacyFields(json: string): string {
  try {
    const raw = JSON.parse(json);
    const normalized = normalizeInfographicData(raw);
    return normalized ? JSON.stringify(normalized) : json;
  } catch {
    return json;
  }
}

export const useInfographicStore = create<InfographicState>()(
  persist(
    (set) => ({
      items: [],
      clearMigrationNotice: () => set({ migratedFrom: undefined }),
      add: (item) => set((s) => ({ items: s.items.some(i => i.id === item.id) ? s.items : [...s.items, item] })),
      update: (id, json) => set((s) => ({ items: s.items.map(i => i.id === id ? { ...i, json } : i) })),
      remove: (id) => set((s) => ({ items: s.items.filter(i => i.id !== id) })),
    }),
    {
      name: 'content-graph-infographics',
      version: 1,
      migrate: (persisted: any, fromVersion) => {
        if (!persisted) return persisted;
        if (fromVersion < 1 && Array.isArray(persisted.items)) {
          const touched = persisted.items.some((i: InfographicItem) => /"theme"|"fontWeight"|"fontStyle"|"gradient"/.test(i.json || ''));
          persisted.items = persisted.items.map((i: InfographicItem) => ({ ...i, json: stripLegacyFields(i.json) }));
          if (touched) persisted.migratedFrom = 0;
        }
        return persisted;
      },
    }
  )
);
