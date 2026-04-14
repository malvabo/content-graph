import { create } from 'zustand';
import type { NodeStatus } from './graphStore';

interface ExecutionState {
  status: Record<string, NodeStatus>;
  errors: Record<string, string>;
  progress: Record<string, number>;
  tokenCounts: Record<string, { input: number; output: number }>;

  setStatus: (nodeId: string, status: NodeStatus) => void;
  setError: (nodeId: string, error: string) => void;
  setProgress: (nodeId: string, progress: number) => void;
  setTokenCounts: (nodeId: string, counts: { input: number; output: number }) => void;
  resetNode: (nodeId: string) => void;
  resetAll: () => void;
}

export const useExecutionStore = create<ExecutionState>()((set) => ({
  status: {},
  errors: {},
  progress: {},
  tokenCounts: {},

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

  resetAll: () => set({ status: {}, errors: {}, progress: {}, tokenCounts: {} }),
}));
