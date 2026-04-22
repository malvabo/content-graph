import { useCallback, useState, useRef } from 'react';
import { type Connection, type Edge } from '@xyflow/react';
import { useGraphStore, type ContentNode } from '../store/graphStore';
import { NODE_DEFS_BY_SUBTYPE } from '../utils/nodeDefs';

interface Tooltip { x: number; y: number; message: string }

function hasCycle(source: string, target: string, edges: Edge[]): boolean {
  const visited = new Set<string>();
  const stack = [target];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === source) return true;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const e of edges) if (e.source === cur) stack.push(e.target);
  }
  return false;
}

export function useConnectionValidation(_nodes: ContentNode[], _edges: Edge[]) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showTooltip = useCallback((msg: string) => {
    const el = document.querySelector('.react-flow__pane');
    const rect = el?.getBoundingClientRect();
    setTooltip({ x: (rect?.width ?? 400) / 2, y: 40, message: msg });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setTooltip(null), 2000);
  }, []);

  const isValidConnection = useCallback(
    (conn: Edge | Connection): boolean => {
      const { nodes, edges } = useGraphStore.getState();
      const source = conn.source;
      const target = conn.target;
      if (!source || !target) return false;
      if (source === target) { showTooltip('Cannot connect to self'); return false; }

      const srcNode = nodes.find((n) => n.id === source);
      const tgtNode = nodes.find((n) => n.id === target);
      if (!srcNode || !tgtNode) return false;

      const srcDef = NODE_DEFS_BY_SUBTYPE[srcNode.data.subtype];
      const tgtDef = NODE_DEFS_BY_SUBTYPE[tgtNode.data.subtype];
      if (!srcDef || !tgtDef) return false;

      if (!tgtDef.hasInput) { showTooltip('This node cannot receive connections'); return false; }
      if (!srcDef.hasOutput) { showTooltip('This node has no output to connect from'); return false; }

      const maxInputs = tgtDef.maxInputs ?? 1;
      const currentInputs = edges.filter((e) => e.target === target).length;
      if (currentInputs >= maxInputs) {
        showTooltip(maxInputs === 1 ? 'This node already has an input' : `Max ${maxInputs} inputs reached`);
        return false;
      }

      if (hasCycle(source, target, edges)) { showTooltip('Connection would create a cycle'); return false; }

      return true;
    },
    [showTooltip]
  );

  return { isValidConnection, tooltip };
}
