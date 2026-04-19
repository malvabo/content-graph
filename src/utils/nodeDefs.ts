import type { NodeCategory } from '../store/graphStore';

export interface NodeDef {
  subtype: string;
  label: string;
  badge: string;
  category: NodeCategory;
  description: string;
  hasInput: boolean;
  hasOutput: boolean;
  maxInputs?: number;
}

export const NODE_DEFS: NodeDef[] = [
  // Source
  { subtype: 'text-source', label: 'Text', badge: 'Tx', category: 'source', description: 'Paste text, transcript, notes', hasInput: false, hasOutput: true },
  { subtype: 'file-source', label: 'File', badge: 'Fl', category: 'source', description: 'Upload .txt .md .docx', hasInput: false, hasOutput: true },
  { subtype: 'image-source', label: 'Image', badge: 'Im', category: 'source', description: 'Product photo, diagram', hasInput: false, hasOutput: true },
  { subtype: 'voice-source', label: 'Voice Note', badge: 'Vc', category: 'source', description: 'Select a saved voice note', hasInput: false, hasOutput: true },
  // Generate
  { subtype: 'linkedin-post', label: 'LinkedIn Post', badge: 'Li', category: 'generate', description: '150–300 word hook post', hasInput: true, hasOutput: true },
  { subtype: 'twitter-thread', label: 'Twitter Thread', badge: 'Tw', category: 'generate', description: '5–10 tweet thread', hasInput: true, hasOutput: true },
  { subtype: 'twitter-single', label: 'Twitter Single', badge: 'Ts', category: 'generate', description: 'Most quotable insight', hasInput: true, hasOutput: true },
  { subtype: 'newsletter', label: 'Newsletter', badge: 'Nl', category: 'generate', description: '300–500 word digest', hasInput: true, hasOutput: true },
  { subtype: 'infographic', label: 'Infographic', badge: 'If', category: 'generate', description: 'Structured visual spec', hasInput: true, hasOutput: true },
  { subtype: 'quote-card', label: 'Quote Card', badge: 'Qc', category: 'generate', description: 'Strongest quote', hasInput: true, hasOutput: true },
  { subtype: 'image-prompt', label: 'Image Prompt', badge: 'Ip', category: 'generate', description: 'AI image generation prompt', hasInput: true, hasOutput: false },
  { subtype: 'video', label: 'Video', badge: 'Vd', category: 'generate', description: 'AI video generation', hasInput: true, hasOutput: false },
  // Output
  { subtype: 'export', label: 'Export', badge: 'Ex', category: 'output', description: 'Platform-ready package', hasInput: true, hasOutput: false, maxInputs: 8 },
  { subtype: 'brand-voice', label: 'Brand Voice', badge: 'Bv', category: 'output', description: 'Rewrite in your brand voice', hasInput: true, hasOutput: true },
  // Advanced (collapsed in palette)
  { subtype: 'refine', label: 'Refine', badge: 'Rf', category: 'transform', description: 'Directive for what to extract or change', hasInput: true, hasOutput: true },
];

export const NODE_DEFS_BY_SUBTYPE = Object.fromEntries(NODE_DEFS.map((d) => [d.subtype, d]));

export const CATEGORY_LABELS: Record<NodeCategory, string> = {
  source: 'Source',
  transform: 'Advanced',
  generate: 'Generate',
  output: 'Output',
};

export const BADGE_COLORS: Record<NodeCategory, { bg: string; text: string }> = {
  source: { bg: 'var(--color-badge-source-bg)', text: 'var(--color-badge-source-text)' },
  transform: { bg: 'var(--color-badge-transform-bg)', text: 'var(--color-badge-transform-text)' },
  generate: { bg: 'var(--color-badge-generate-bg)', text: 'var(--color-badge-generate-text)' },
  output: { bg: 'var(--color-badge-output-bg)', text: 'var(--color-badge-output-text)' },
};

export const MODEL_OPTIONS = [
  'claude-haiku-4', 'claude-sonnet-4', 'claude-opus-4',
  'gpt-4o-mini', 'gpt-4o', 'o4-mini',
  'gemini-2.0-flash', 'gemini-2.5-flash',
  'llama-3.3-70b', 'llama-4-scout',
] as const;
export const IMAGE_MODEL_OPTIONS = ['FLUX.1 schnell', 'FLUX.1 dev', 'DALL·E 3', 'Imagen 3', 'Stable Diffusion 3.5'] as const;
export const IMAGE_RESOLUTION_OPTIONS = ['512x512', '1024x1024', '1024x1536', '1536x1024', '1792x1024'] as const;

export const DEFAULT_MODELS: Record<string, string> = {
  'refine': 'claude-opus-4',
  'linkedin-post': 'claude-opus-4',
  'twitter-thread': 'claude-opus-4',
  'twitter-single': 'claude-opus-4',
  'newsletter': 'claude-opus-4',
  'infographic': 'claude-opus-4',
  'quote-card': 'claude-opus-4',
  'image-prompt': 'claude-sonnet-4',
  'text-source': 'claude-opus-4',
  'file-source': 'claude-opus-4',
  'brand-voice': 'claude-opus-4',
};
