import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { NodeStatus } from './graphStore';

interface ExecutionState {
  status: Record<string, NodeStatus>;
  errors: Record<string, string>;
  progress: Record<string, number>;
  tokenCounts: Record<string, { input: number; output: number }>;
  runAllActive: boolean;

  setStatus: (nodeId: string, status: NodeStatus) => void;
  setError: (nodeId: string, error: string) => void;
  setProgress: (nodeId: string, progress: number) => void;
  setTokenCounts: (nodeId: string, counts: { input: number; output: number }) => void;
  setRunAllActive: (active: boolean) => void;
  resetNode: (nodeId: string) => void;
  resetAll: () => void;
}

export const useExecutionStore = create<ExecutionState>()(
  persist(
    (set) => ({
      status: {},
      errors: {},
      progress: {},
      tokenCounts: {},
      runAllActive: false,

      setStatus: (nodeId, status) =>
        set((s) => ({ status: { ...s.status, [nodeId]: status } })),

      setError: (nodeId, error) =>
        set((s) => ({
          errors: { ...s.errors, [nodeId]: error },
          status: { ...s.status, [nodeId]: 'error' },
        })),

      setProgress: (nodeId, progress) =>
        set((s) => ({ progress: { ...s.progress, [nodeId]: progress } })),

      setTokenCounts: (nodeId, counts) =>
        set((s) => ({ tokenCounts: { ...s.tokenCounts, [nodeId]: counts } })),

      setRunAllActive: (active) => set({ runAllActive: active }),

      resetNode: (nodeId) =>
        set((s) => {
          const status = { ...s.status };
          const errors = { ...s.errors };
          const progress = { ...s.progress };
          delete status[nodeId];
          delete errors[nodeId];
          delete progress[nodeId];
          return { status, errors, progress };
        }),

      resetAll: () => set({ status: {}, errors: {}, progress: {}, tokenCounts: {}, runAllActive: false }),
    }),
    {
      name: 'content-graph-execution',
      partialize: (state) => ({ status: state.status }),
      onRehydrateStorage: () => (state) => {
        // Reset any stale 'running' states from previous session
        if (state?.status) {
          const fixed: Record<string, string> = {};
          for (const [k, v] of Object.entries(state.status)) {
            fixed[k] = v === 'running' ? 'idle' : v as string;
          }
          state.status = fixed as any;
        }
      },
    }
  )
);
