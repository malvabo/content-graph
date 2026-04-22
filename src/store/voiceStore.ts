import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type GeneratedAssetKind = 'linkedin-post' | 'twitter-thread' | 'twitter-single';

export interface GeneratedAsset {
  kind: GeneratedAssetKind;
  text: string;
  createdAt: string;
}

export interface VoiceNote {
  id: string;
  title: string;
  durationMs: number;
  transcript: string;
  status: 'recording' | 'transcribing' | 'ready' | 'error';
  errorReason?: string;
  createdAt: string;
  /** Last successful generation — persisted so the user doesn't lose an asset
   *  they just crafted on mobile if they scroll the card out of view or reload. */
  lastGeneration?: GeneratedAsset;
}

interface VoiceState {
  notes: VoiceNote[];
  addNote: (note: VoiceNote) => void;
  updateNote: (id: string, updates: Partial<VoiceNote>) => void;
  removeNote: (id: string) => void;
}

export const useVoiceStore = create<VoiceState>()(
  persist(
    (set) => ({
      notes: [],
      addNote: (note) => set((s) => ({ notes: [...s.notes, note] })),
      updateNote: (id, updates) => set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, ...updates } : n)) })),
      removeNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
    }),
    { name: 'content-graph-voice' }
  )
);
