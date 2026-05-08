import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Script {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  analysed: boolean;
}

interface ScriptStore {
  scripts: Script[];
  addScript: (content: string) => string;
  updateScript: (id: string, updates: Partial<Script>) => void;
  removeScript: (id: string) => void;
}

export const useScriptStore = create<ScriptStore>()(
  persist(
    (set) => ({
      scripts: [],
      addScript: (content) => {
        const id = `sc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const script: Script = { id, title: '', content, createdAt: new Date().toISOString(), analysed: false };
        set(s => ({ scripts: [script, ...s.scripts] }));
        return id;
      },
      updateScript: (id, updates) => set(s => ({ scripts: s.scripts.map(sc => sc.id === id ? { ...sc, ...updates } : sc) })),
      removeScript: (id) => set(s => ({ scripts: s.scripts.filter(sc => sc.id !== id) })),
    }),
    { name: 'content-graph-scripts' }
  )
);
