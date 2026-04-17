import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OutputAsset {
  type: 'text' | 'image' | 'file';
  content: string;
  filename?: string;
  mimeType?: string;
}

interface OutputState {
  outputs: Record<string, { text?: string; imageBase64?: string; imgWidth?: number; imgHeight?: number; assets?: OutputAsset[] }>;
  hashes: Record<string, string>;

  setOutput: (nodeId: string, output: { text?: string; imageBase64?: string; imgWidth?: number; imgHeight?: number; assets?: OutputAsset[] }) => void;
  setHash: (nodeId: string, hash: string) => void;
  clearNode: (nodeId: string) => void;
  clearAll: () => void;
}

export const useOutputStore = create<OutputState>()(
  persist(
    (set) => ({
      outputs: {},
      hashes: {},

      setOutput: (nodeId, output) =>
        set((s) => ({ outputs: { ...s.outputs, [nodeId]: { ...s.outputs[nodeId], ...output } } })),

      setHash: (nodeId, hash) =>
        set((s) => ({ hashes: { ...s.hashes, [nodeId]: hash } })),

      clearNode: (nodeId) =>
        set((s) => {
          const outputs = { ...s.outputs };
          const hashes = { ...s.hashes };
          delete outputs[nodeId];
          delete hashes[nodeId];
          return { outputs, hashes };
        }),

      clearAll: () => set({ outputs: {}, hashes: {} }),
    }),
    {
      name: 'content-graph-outputs',
      // Persist text outputs only — skip imageBase64 to avoid localStorage size limits
      partialize: (state) => ({
        outputs: Object.fromEntries(
          Object.entries(state.outputs).map(([k, v]) => [k, { text: v.text }])
        ),
        hashes: state.hashes,
      }),
    }
  )
);
