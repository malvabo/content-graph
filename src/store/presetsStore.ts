import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FormatPreset {
  id: string;
  name: string;
  formatIDs: string[];
  createdAt: string;
}

interface PresetsState {
  presets: FormatPreset[];
  addPreset: (preset: FormatPreset) => void;
  removePreset: (id: string) => void;
}

export const usePresetsStore = create<PresetsState>()(
  persist(
    (set) => ({
      presets: [],
      addPreset: (preset) => set((s) => ({ presets: [preset, ...s.presets] })),
      removePreset: (id) => set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),
    }),
    { name: 'content-graph-presets' }
  )
);
