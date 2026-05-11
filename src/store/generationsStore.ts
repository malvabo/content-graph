import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface GenerationResult {
  header: string;
  content: string;
}

export interface GenerationProject {
  id: string;
  title: string;
  outputType: string;
  preview: string;
  results: GenerationResult[];
  createdAt: string;
}

interface GenerationsState {
  projects: GenerationProject[];
  addProject: (project: GenerationProject) => void;
  removeProject: (id: string) => void;
  clearAll: () => void;
}

export const useGenerationsStore = create<GenerationsState>()(
  persist(
    (set) => ({
      projects: [],
      addProject: (project) => set((s) => ({ projects: [project, ...s.projects] })),
      removeProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
      clearAll: () => set({ projects: [] }),
    }),
    { name: 'content-graph-generations' }
  )
);
