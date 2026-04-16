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

export interface Template { name: string; description: string; build: () => { nodes: ContentNode[]; edges: Edge[] } }

export const TEMPLATES: Template[] = [
  {
    name: 'Article → Everywhere',
    description: 'One article repurposed to LinkedIn, newsletter, and Twitter',
    build: () => {
      const src = makeNode('text-source', 0, 0, { prepare: 'Extract the 5 strongest arguments' });
      const li = makeNode('linkedin-post', 300, -120, { quantity: 2 });
      const nl = makeNode('newsletter', 300, 0);
      const tw = makeNode('twitter-thread', 300, 120);
      const ex = makeNode('export', 600, 60);
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
    name: 'Transcript → Social Pack',
    description: 'Transcript simplified then split into thread, post, and quote',
    build: () => {
      const src = makeNode('text-source', 0, 0, { prepare: 'Simplify to plain English, remove all jargon' });
      const qc = makeNode('quote-card', 300, -80);
      const tw = makeNode('twitter-thread', 300, 40, { quantity: 2 });
      const li = makeNode('linkedin-post', 300, 160);
      const ex = makeNode('export', 600, 0);
      return {
        nodes: [src, qc, tw, li, ex],
        edges: [
          makeEdge(src.id, qc.id), makeEdge(src.id, tw.id), makeEdge(src.id, li.id),
          makeEdge(qc.id, ex.id),
        ],
      };
    },
  },
  {
    name: 'Research → Visual',
    description: 'Extract data points, generate infographic and AI image',
    build: () => {
      const src = makeNode('text-source', 0, 0, { prepare: 'Extract all statistics and data points' });
      const inf = makeNode('infographic', 300, -40);
      const ip = makeNode('image-prompt', 300, 80);
      const ex = makeNode('export', 600, -40);
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
