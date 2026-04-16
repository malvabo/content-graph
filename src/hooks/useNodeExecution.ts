import { useCallback, useRef } from 'react';
import { useGraphStore } from '../store/graphStore';
import { useExecutionStore } from '../store/executionStore';
import { useOutputStore } from '../store/outputStore';
import { topologicalSort } from '../utils/topologicalSort';

function getUpstreamText(nodeId: string) {
  const { nodes, edges } = useGraphStore.getState();
  const outputs = useOutputStore.getState().outputs;
  const upstream = edges.filter((e) => e.target === nodeId).map((e) => e.source);
  return upstream.map((id) => {
    if (outputs[id]?.text) return outputs[id].text;
    const node = nodes.find((n) => n.id === id);
    if (node?.data.category === 'source') return (node.data.config.text as string) || '';
    return '';
  }).filter(Boolean).join('\n\n---\n\n');
}

export function useNodeExecution() {
  const abortRef = useRef<AbortController | null>(null);

  const runNode = useCallback(
    async (nodeId: string, executor: (input: string, config: Record<string, unknown>) => Promise<string>, signal?: AbortSignal) => {
      const { nodes } = useGraphStore.getState();
      const { setStatus, setError } = useExecutionStore.getState();
      const { setOutput } = useOutputStore.getState();

      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      if (signal?.aborted) return;

      const isSource = node.data.category === 'source';
      const input = isSource
        ? (useOutputStore.getState().outputs[nodeId]?.text || (node.data.config.text as string) || '')
        : getUpstreamText(nodeId);

      if (!isSource && !input) {
        setStatus(nodeId, 'warning');
        return;
      }

      // Clear previous errors before re-running
      const { errors } = useExecutionStore.getState();
      if (errors[nodeId]) {
        useExecutionStore.getState().setStatus(nodeId, 'idle');
      }

      setStatus(nodeId, 'running');
      try {
        if (signal?.aborted) return;
        const result = await executor(input, node.data.config as Record<string, unknown>);
        if (signal?.aborted) return;
        setOutput(nodeId, { text: result });
        setStatus(nodeId, 'complete');
      } catch (err) {
        if (signal?.aborted) return;
        setError(nodeId, err instanceof Error ? err.message : 'Unknown error');
      }
    },
    []
  );

  const runAll = useCallback(
    async (executor: (input: string, config: Record<string, unknown>, subtype: string) => Promise<string>) => {
      // Race guard — abort any existing run
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      // Read fresh state
      const { nodes, edges } = useGraphStore.getState();
      useExecutionStore.getState().resetAll();
      useExecutionStore.getState().setRunAllActive(true);
      useOutputStore.getState().clearAll();

      const nodeIds = nodes.map((n) => n.id);
      const order = topologicalSort(nodeIds, edges);

      try {
        for (const id of order) {
          if (ctrl.signal.aborted) break;

          // Read fresh node state each iteration
          const node = useGraphStore.getState().nodes.find((n) => n.id === id);
          if (!node) continue;

          if (node.data.category === 'source') {
            const prepare = node.data.config.prepare as string | undefined;
            if (!prepare?.trim()) {
              const sourceText = (node.data.config.text as string) ?? '';
              if (sourceText) {
                useOutputStore.getState().setOutput(id, { text: sourceText });
              }
              useExecutionStore.getState().setStatus(id, 'complete');
              continue;
            }
          }

          // Check if upstream failed — skip this node
          const upstreamIds = edges.filter(e => e.target === id).map(e => e.source);
          const upstreamFailed = upstreamIds.some(uid => useExecutionStore.getState().status[uid] === 'error');
          if (upstreamFailed) {
            useExecutionStore.getState().setStatus(id, 'error');
            useExecutionStore.getState().setError(id, 'Upstream node failed');
            continue;
          }

          await runNode(id, (input, config) => executor(input, config, node.data.subtype), ctrl.signal);
        }
      } finally {
        if (!ctrl.signal.aborted) {
          useExecutionStore.getState().setRunAllActive(false);
        }
      }
    },
    [runNode]
  );

  const cancelAll = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    useExecutionStore.getState().setRunAllActive(false);
  }, []);

  return { runNode, runAll, cancelAll };
}
