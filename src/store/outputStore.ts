import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OutputAsset {
  type: 'text' | 'image' | 'file';
  content: string;
  filename?: string;
  mimeType?: string;
}

interface OutputState {
  outputs: Record<string, { text?: string; imageBase64?: string; assets?: OutputAsset[] }>;
  hashes: Record<string, string>;
  imageAccessOrder: string[]; // LRU tracking

  setOutput: (nodeId: string, output: { text?: string; imageBase64?: string; assets?: OutputAsset[] }) => void;
  setHash: (nodeId: string, hash: string) => void;
  clearNode: (nodeId: string) => void;
  clearAll: () => void;
}

const MAX_IMAGES = 3;

export const useOutputStore = create<OutputState>()(
  persist(
    (set) => ({
      outputs: {},
      hashes: {},
      imageAccessOrder: [],

      setOutput: (nodeId, output) =>
        set((s) => {
          let order = [...s.imageAccessOrder];
          const newOutputs = { ...s.outputs, [nodeId]: output };

          if (output.imageBase64) {
            order = order.filter((id) => id !== nodeId);
            order.push(nodeId);
            while (order.length > MAX_IMAGES) {
              const evict = order.shift()!;
              if (newOutputs[evict]) {
                newOutputs[evict] = { ...newOutputs[evict], imageBase64: undefined };
              }
            }
          }
          return { outputs: newOutputs, imageAccessOrder: order };
        }),

      setHash: (nodeId, hash) =>
        set((s) => ({ hashes: { ...s.hashes, [nodeId]: hash } })),

      clearNode: (nodeId) =>
        set((s) => {
          const { [nodeId]: _, ...outputs } = s.outputs;
          const { [nodeId]: __, ...hashes } = s.hashes;
          return { outputs, hashes, imageAccessOrder: s.imageAccessOrder.filter((id) => id !== nodeId) };
        }),

      clearAll: () => set({ outputs: {}, hashes: {}, imageAccessOrder: [] }),
    }),
    { name: 'content-graph-outputs' }
  )
);
