import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface SettingsState {
  anthropicKey: string;
  openaiKey: string;
  googleKey: string;
  loaded: boolean;
  setAnthropicKey: (key: string) => void;
  setOpenaiKey: (key: string) => void;
  setGoogleKey: (key: string) => void;
  load: () => Promise<void>;
  save: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  anthropicKey: '',
  openaiKey: '',
  googleKey: '',
  loaded: false,

  setAnthropicKey: (key) => set({ anthropicKey: key }),
  setOpenaiKey: (key) => set({ openaiKey: key }),
  setGoogleKey: (key) => set({ googleKey: key }),

  load: async () => {
    if (!supabase) { set({ loaded: true }); return; }
    const { data: { user } } = await supabase!.auth.getUser();
    if (!user) return;
    const { data } = await supabase!.from('user_settings').select('anthropic_key, openai_key, google_key').eq('user_id', user.id).single();
    if (data) set({ anthropicKey: data.anthropic_key ?? '', openaiKey: data.openai_key ?? '', googleKey: data.google_key ?? '', loaded: true });
    else set({ loaded: true });
  },

  save: async () => {
    if (!supabase) return;
    const { data: { user } } = await supabase!.auth.getUser();
    if (!user) return;
    const { anthropicKey, openaiKey, googleKey } = get();
    await supabase!.from('user_settings').upsert({ user_id: user.id, anthropic_key: anthropicKey, openai_key: openaiKey, google_key: googleKey }, { onConflict: 'user_id' });
  },
}));
