import { create } from 'zustand';

export interface InfographicItem {
  id: string;
  nodeId: string;
  label: string;
  json: string; // raw JSON text of InfographicData
}

interface InfographicState {
  items: InfographicItem[];
  add: (item: InfographicItem) => void;
  update: (id: string, json: string) => void;
  remove: (id: string) => void;
}

export const useInfographicStore = create<InfographicState>((set) => ({
  items: [],
  add: (item) => set((s) => ({ items: s.items.some(i => i.id === item.id) ? s.items : [...s.items, item] })),
  update: (id, json) => set((s) => ({ items: s.items.map(i => i.id === id ? { ...i, json } : i) })),
  remove: (id) => set((s) => ({ items: s.items.filter(i => i.id !== id) })),
}));
