import { useCallback } from 'react';
import Dagre from '@dagrejs/dagre';
import { useGraphStore, type ContentNode } from '../store/graphStore';
import { useReactFlow } from '@xyflow/react';

const NODE_WIDTH = 480;
const DEFAULT_HEIGHT = 220;
const NODE_SEP = 80;
const RANK_SEP = 160;

export function useGraphLayout() {
  const { getZoom } = useReactFlow();

  const autoLayout = useCallback(() => {
    const { nodes, edges, setNodes } = useGraphStore.getState();
    const zoom = getZoom() || 1;
    const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'LR', nodesep: NODE_SEP, ranksep: RANK_SEP });

    nodes.forEach((n) => {
      const el = document.querySelector(`[data-id="${n.id}"]`) as HTMLElement | null;
      const h = el ? el.getBoundingClientRect().height / zoom : DEFAULT_HEIGHT;
      g.setNode(n.id, { width: NODE_WIDTH, height: h });
    });
    edges.forEach((e) => g.setEdge(e.source, e.target));
    Dagre.layout(g);

    const laid = nodes.map((n) => {
      const pos = g.node(n.id);
      const el = document.querySelector(`[data-id="${n.id}"]`) as HTMLElement | null;
      const h = el ? el.getBoundingClientRect().height / zoom : DEFAULT_HEIGHT;
      return { ...n, position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - h / 2 } } as ContentNode;
    });
    setNodes(laid);
  }, [getZoom]);

  return { autoLayout };
}
