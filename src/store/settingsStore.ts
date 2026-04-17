import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface SettingsState {
  anthropicKey: string;
  loaded: boolean;
  setAnthropicKey: (key: string) => void;
  load: () => Promise<void>;
  save: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  anthropicKey: '',
  loaded: false,

  setAnthropicKey: (key) => set({ anthropicKey: key }),

  load: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('user_settings').select('anthropic_key').eq('user_id', user.id).single();
    if (data) set({ anthropicKey: data.anthropic_key ?? '', loaded: true });
    else set({ loaded: true });
  },

  save: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_settings').upsert({ user_id: user.id, anthropic_key: get().anthropicKey }, { onConflict: 'user_id' });
  },
}));
