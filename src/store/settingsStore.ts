import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  anthropicKey: string;
  setAnthropicKey: (key: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      anthropicKey: '',
      setAnthropicKey: (key) => set({ anthropicKey: key }),
    }),
    { name: 'content-graph-settings' }
  )
);
