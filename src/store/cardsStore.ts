import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Card {
  id: string;
  headline: string;
  body: string;
}

export interface CardSet {
  id: string;
  name: string;
  cards: Card[];
  createdAt: string;
}

interface CardsState {
  sets: CardSet[];
  add: (set: CardSet) => void;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
  updateCards: (id: string, cards: Card[]) => void;
}

export const useCardsStore = create<CardsState>()(
  persist(
    (set) => ({
      sets: [],
      add: (s) => set((st) => ({ sets: [s, ...st.sets] })),
      remove: (id) => set((st) => ({ sets: st.sets.filter(s => s.id !== id) })),
      rename: (id, name) => set((st) => ({ sets: st.sets.map(s => s.id === id ? { ...s, name } : s) })),
      updateCards: (id, cards) => set((st) => ({ sets: st.sets.map(s => s.id === id ? { ...s, cards } : s) })),
    }),
    { name: 'content-graph-cards' }
  )
);
