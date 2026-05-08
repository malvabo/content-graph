import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SourceType = 'text' | 'url' | 'file' | 'voice';

interface QuickModeState {
  selectedSources: SourceType[];
  textValue: string;
  urlValue: string;
  urlFetchedText: string;
  fileText: string;
  fileName: string;
  fileSize: number;
  voiceTranscript: string;
  templateKey: string | null;
  promptValue: string;
  selectedOutputs: string[];

  setSources: (s: SourceType[]) => void;
  setTextValue: (v: string) => void;
  setUrlValue: (v: string) => void;
  setUrlFetched: (text: string) => void;
  clearUrl: () => void;
  setFile: (text: string, name: string, size: number) => void;
  clearFile: () => void;
  setVoice: (t: string) => void;
  setTemplate: (k: string | null) => void;
  setPrompt: (v: string) => void;
  setOutputs: (o: string[]) => void;
}

export const useQuickModeStore = create<QuickModeState>()(
  persist(
    (set) => ({
      selectedSources: ['text'],
      textValue: '',
      urlValue: '',
      urlFetchedText: '',
      fileText: '',
      fileName: '',
      fileSize: 0,
      voiceTranscript: '',
      templateKey: null,
      promptValue: '',
      selectedOutputs: ['linkedin-post'],

      setSources: (s) => set({ selectedSources: s }),
      setTextValue: (v) => set({ textValue: v }),
      setUrlValue: (v) => set({ urlValue: v }),
      setUrlFetched: (text) => set({ urlFetchedText: text }),
      clearUrl: () => set({ urlValue: '', urlFetchedText: '' }),
      setFile: (text, name, size) => set({ fileText: text, fileName: name, fileSize: size }),
      clearFile: () => set({ fileText: '', fileName: '', fileSize: 0 }),
      setVoice: (t) => set({ voiceTranscript: t }),
      setTemplate: (k) => set({ templateKey: k }),
      setPrompt: (v) => set({ promptValue: v }),
      setOutputs: (o) => set({ selectedOutputs: o }),
    }),
    {
      name: 'quick-mode-store',
      partialize: (s) => ({
        selectedSources: s.selectedSources,
        textValue: s.textValue,
        urlValue: s.urlValue,
        urlFetchedText: s.urlFetchedText,
        fileText: s.fileText,
        fileName: s.fileName,
        fileSize: s.fileSize,
        voiceTranscript: s.voiceTranscript,
        templateKey: s.templateKey,
        promptValue: s.promptValue,
        selectedOutputs: s.selectedOutputs,
      }),
    }
  )
);
