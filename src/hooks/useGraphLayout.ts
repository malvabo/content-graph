import { useCallback } from 'react';
import Dagre from '@dagrejs/dagre';
import { useGraphStore, type ContentNode } from '../store/graphStore';

const NODE_WIDTH = 480;
const DEFAULT_HEIGHT = 200;
const NODE_SEP = 60;
const RANK_SEP = 140;

export function useGraphLayout() {
  const autoLayout = useCallback(() => {
    const { nodes, edges, setNodes } = useGraphStore.getState();
    const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'LR', nodesep: NODE_SEP, ranksep: RANK_SEP });

    nodes.forEach((n) => {
      const el = document.querySelector(`[data-id="${n.id}"]`) as HTMLElement | null;
      const h = el ? el.getBoundingClientRect().height : DEFAULT_HEIGHT;
      g.setNode(n.id, { width: NODE_WIDTH, height: h });
    });
    edges.forEach((e) => g.setEdge(e.source, e.target));
    Dagre.layout(g);

    const laid = nodes.map((n) => {
      const pos = g.node(n.id);
      const el = document.querySelector(`[data-id="${n.id}"]`) as HTMLElement | null;
      const h = el ? el.getBoundingClientRect().height : DEFAULT_HEIGHT;
      return { ...n, position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - h / 2 } } as ContentNode;
    });
    setNodes(laid);
  }, []);

  return { autoLayout };
}
