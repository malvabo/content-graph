import { useCallback } from 'react';
import Dagre from '@dagrejs/dagre';
import { useGraphStore, type ContentNode } from '../store/graphStore';

export function useGraphLayout() {
  const autoLayout = useCallback(() => {
    const { nodes, edges, setNodes } = useGraphStore.getState();
    const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'LR', nodesep: 80, ranksep: 120 });
    nodes.forEach((n) => g.setNode(n.id, { width: 480, height: 200 }));
    edges.forEach((e) => g.setEdge(e.source, e.target));
    Dagre.layout(g);

    const laid = nodes.map((n) => {
      const pos = g.node(n.id);
      return { ...n, position: { x: pos.x - 240, y: pos.y - 100 } } as ContentNode;
    });
    setNodes(laid);
  }, []);

  return { autoLayout };
}
