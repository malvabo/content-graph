import { useEffect, useRef } from 'react';
import { useGraphStore } from '../store/graphStore';
import { saveWorkflow } from '../utils/workflowApi';

/**
 * Debounced auto-save for the active workflow. Fires ~1s after the user stops
 * editing nodes/edges/name/brand. If no workflowId exists yet, assigns one so
 * the flow is discoverable from the library the next time it's opened.
 *
 * No-ops when there are no nodes on the canvas (nothing to save).
 */
export function useAutoSaveWorkflow() {
  const nodes = useGraphStore(s => s.nodes);
  const edges = useGraphStore(s => s.edges);
  const graphName = useGraphStore(s => s.graphName);
  const brandId = useGraphStore(s => s.brandId);
  const timerRef = useRef<number | null>(null);
  const firstRunRef = useRef(true);

  useEffect(() => {
    // Skip the initial mount save so we don't thrash the backend right after
    // a flow is loaded.
    if (firstRunRef.current) { firstRunRef.current = false; return; }
    if (nodes.length === 0) return;

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      const s = useGraphStore.getState();
      const id = s.workflowId || `wf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      if (!s.workflowId) s.setWorkflowId(id);
      try {
        await saveWorkflow({
          id,
          name: s.graphName || 'Untitled',
          nodes: s.nodes as any,
          edges: s.edges as any,
          savedAt: new Date().toISOString(),
          brandId: s.brandId,
        });
      } catch { /* ignored — next edit will retry */ }
    }, 1000);

    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [nodes, edges, graphName, brandId]);
}
