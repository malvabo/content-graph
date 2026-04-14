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
  { subtype: 'text-source', label: 'Text', badge: 'Tx', category: 'source', description: 'Raw content, transcript, notes', hasInput: false, hasOutput: true },
  { subtype: 'image-source', label: 'Image', badge: 'Im', category: 'source', description: 'Product photo, diagram', hasInput: false, hasOutput: true },
  // Generate
  { subtype: 'linkedin-post', label: 'LinkedIn Post', badge: 'Li', category: 'generate', description: '150–300 word hook post', hasInput: true, hasOutput: true },
  { subtype: 'twitter-thread', label: 'Twitter Thread', badge: 'Tw', category: 'generate', description: '5–10 tweet thread', hasInput: true, hasOutput: true },
  { subtype: 'twitter-single', label: 'Twitter Single', badge: 'Ts', category: 'generate', description: 'Most quotable insight', hasInput: true, hasOutput: true },
  { subtype: 'ig-carousel', label: 'IG Carousel', badge: 'Ig', category: 'generate', description: '5–10 slides, 30 words each', hasInput: true, hasOutput: true },
  { subtype: 'blog-article', label: 'Blog Article', badge: 'Bl', category: 'generate', description: '800–1500 word post', hasInput: true, hasOutput: true },
  { subtype: 'newsletter', label: 'Newsletter', badge: 'Nl', category: 'generate', description: '300–500 word digest', hasInput: true, hasOutput: true },
  { subtype: 'infographic', label: 'Infographic', badge: 'If', category: 'generate', description: 'Structured visual spec', hasInput: true, hasOutput: true },
  { subtype: 'quote-card', label: 'Quote Card', badge: 'Qc', category: 'generate', description: 'Strongest quote', hasInput: true, hasOutput: true },
  { subtype: 'image-prompt', label: 'Image Prompt', badge: 'Ip', category: 'generate', description: 'AI image generation prompt', hasInput: true, hasOutput: false },
  // Output
  { subtype: 'export', label: 'Export', badge: 'Ex', category: 'output', description: 'Platform-ready package', hasInput: true, hasOutput: false, maxInputs: 8 },
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

export const BADGE_COLORS: Record<NodeCategory, { bg: string; text: string; className: string }> = {
  source: { bg: '#EBEEF0', text: '#3A5060', className: 'badge-src' },
  transform: { bg: '#F0EBEE', text: '#503040', className: 'badge-adv' },
  generate: { bg: '#EBF5EE', text: '#1A5C30', className: 'badge-gen' },
  output: { bg: '#EEF0EB', text: '#3A4A28', className: 'badge-out' },
};

export const HANDLE_COLOR = '#94a3b8';

export const MODEL_OPTIONS = ['claude-haiku-4', 'claude-sonnet-4', 'claude-opus-4'] as const;
export const IMAGE_MODEL_OPTIONS = ['FLUX.1 schnell', 'FLUX.1 dev'] as const;

export const DEFAULT_MODELS: Record<string, string> = {
  'refine': 'claude-haiku-4',
  'linkedin-post': 'claude-haiku-4',
  'twitter-thread': 'claude-haiku-4',
  'twitter-single': 'claude-haiku-4',
  'ig-carousel': 'claude-haiku-4',
  'blog-article': 'claude-sonnet-4',
  'newsletter': 'claude-haiku-4',
  'infographic': 'claude-haiku-4',
  'quote-card': 'claude-haiku-4',
  'image-prompt': 'claude-haiku-4',
  'text-source': 'claude-haiku-4',
};
