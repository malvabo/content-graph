import type { ContentNode } from '../store/graphStore';
import type { Edge } from '@xyflow/react';
import { NODE_DEFS_BY_SUBTYPE } from './nodeDefs';

function makeNode(subtype: string, x: number, y: number, configOverrides?: Record<string, unknown>): ContentNode {
  const def = NODE_DEFS_BY_SUBTYPE[subtype];
  return {
    id: `${subtype}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'contentNode',
    position: { x, y },
    deletable: true,
    data: { subtype, label: def.label, badge: def.badge, category: def.category, description: def.description, config: configOverrides ?? {} },
  };
}

function makeEdge(source: string, target: string): Edge {
  return { id: `e-${source}-${target}`, source, target };
}

export type TemplateCategory = 'Social' | 'Long-form' | 'Analysis' | 'Visual';
export interface Template { name: string; description: string; category: TemplateCategory; icon?: string; build: () => { nodes: ContentNode[]; edges: Edge[] } }

export const TEMPLATES: Template[] = [
  {
    name: 'Slack Announcement',
    description: 'Turn any update into a punchy Slack-ready announcement and a quote card for sharing',
    category: 'Social',
    build: () => {
      const src = makeNode('text-source', 0, 0);
      const ts = makeNode('twitter-single', 300, -60);
      const qc = makeNode('quote-card', 300, 80);
      const ex = makeNode('export', 580, 0);
      return {
        nodes: [src, ts, qc, ex],
        edges: [makeEdge(src.id, ts.id), makeEdge(src.id, qc.id), makeEdge(ts.id, ex.id), makeEdge(qc.id, ex.id)],
      };
    },
  },
  {
    name: 'Slack Review',
    description: 'Summarise a document or meeting into a short Slack thread and a key-message post',
    category: 'Social',
    build: () => {
      const src = makeNode('text-source', 0, 0, { prepare: 'Extract the key decisions and action items' });
      const ts = makeNode('twitter-single', 300, -60);
      const li = makeNode('linkedin-post', 300, 80);
      const ex = makeNode('export', 580, 0);
      return {
        nodes: [src, ts, li, ex],
        edges: [makeEdge(src.id, ts.id), makeEdge(src.id, li.id), makeEdge(ts.id, ex.id), makeEdge(li.id, ex.id)],
      };
    },
  },
  {
    name: 'Newsletter',
    description: 'Convert your content into a polished newsletter digest ready to send',
    category: 'Long-form',
    build: () => {
      const src = makeNode('text-source', 0, 0, { prepare: 'Organise into sections with a clear intro and takeaways' });
      const nl = makeNode('newsletter', 300, 0);
      const ex = makeNode('export', 580, 0);
      return {
        nodes: [src, nl, ex],
        edges: [makeEdge(src.id, nl.id), makeEdge(nl.id, ex.id)],
      };
    },
  },
  {
    name: 'Article',
    description: 'Repurpose any source into a LinkedIn post, newsletter, and Twitter thread',
    category: 'Long-form',
    build: () => {
      const src = makeNode('text-source', 0, 0, { prepare: 'Extract the 5 strongest arguments' });
      const li = makeNode('linkedin-post', 300, -120);
      const nl = makeNode('newsletter', 300, 0);
      const tw = makeNode('twitter-thread', 300, 120);
      const ex = makeNode('export', 580, 0);
      return {
        nodes: [src, li, nl, tw, ex],
        edges: [
          makeEdge(src.id, li.id), makeEdge(src.id, nl.id), makeEdge(src.id, tw.id),
          makeEdge(li.id, ex.id), makeEdge(nl.id, ex.id), makeEdge(tw.id, ex.id),
        ],
      };
    },
  },
  {
    name: 'Market Review',
    description: 'Transform research or data into a newsletter, LinkedIn post, and an infographic',
    category: 'Analysis',
    build: () => {
      const src = makeNode('text-source', 0, 0, { prepare: 'Extract all statistics, trends, and key findings' });
      const nl = makeNode('newsletter', 300, -100);
      const li = makeNode('linkedin-post', 300, 40);
      const inf = makeNode('infographic', 300, 180);
      const ex = makeNode('export', 580, -30);
      return {
        nodes: [src, nl, li, inf, ex],
        edges: [
          makeEdge(src.id, nl.id), makeEdge(src.id, li.id), makeEdge(src.id, inf.id),
          makeEdge(nl.id, ex.id), makeEdge(li.id, ex.id),
        ],
      };
    },
  },
  {
    name: 'Slide',
    description: 'Extract key points and generate a structured infographic and a supporting image prompt',
    category: 'Visual',
    build: () => {
      const src = makeNode('text-source', 0, 0, { prepare: 'Extract all key points as a structured list' });
      const inf = makeNode('infographic', 300, -60);
      const ip = makeNode('image-prompt', 300, 100);
      const ex = makeNode('export', 580, -60);
      return {
        nodes: [src, inf, ip, ex],
        edges: [makeEdge(src.id, inf.id), makeEdge(src.id, ip.id), makeEdge(inf.id, ex.id)],
      };
    },
  },
];

export function exportGraph(nodes: ContentNode[], edges: Edge[], name: string) {
  const data = JSON.stringify({ name, nodes, edges }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/\s+/g, '-').toLowerCase()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function importGraph(file: File): Promise<{ name: string; nodes: ContentNode[]; edges: Edge[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (!parsed.nodes || !Array.isArray(parsed.nodes)) throw new Error('Missing nodes array');
        if (!parsed.edges || !Array.isArray(parsed.edges)) throw new Error('Missing edges array');
        resolve({ name: parsed.name || 'Imported Graph', nodes: parsed.nodes, edges: parsed.edges });
      } catch (e) { reject(e instanceof Error ? e : new Error('Invalid JSON')); }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
