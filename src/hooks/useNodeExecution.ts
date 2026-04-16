import { useCallback } from 'react';
import { useGraphStore } from '../store/graphStore';
import { useExecutionStore } from '../store/executionStore';
import { useOutputStore } from '../store/outputStore';
import { topologicalSort } from '../utils/topologicalSort';
import type { Edge } from '@xyflow/react';

function getUpstreamText(nodeId: string, edges: Edge[], outputs: Record<string, { text?: string }>) {
  const nodes = useGraphStore.getState().nodes;
  const upstream = edges.filter((e) => e.target === nodeId).map((e) => e.source);
  return upstream.map((id) => {
    if (outputs[id]?.text) return outputs[id].text;
    const node = nodes.find((n) => n.id === id);
    if (node?.data.category === 'source') return (node.data.config.text as string) || '';
    return '';
  }).filter(Boolean).join('\n\n---\n\n');
}

export function useNodeExecution() {
  const runNode = useCallback(
    async (nodeId: string, executor: (input: string, config: Record<string, unknown>) => Promise<string>) => {
      const { nodes, edges } = useGraphStore.getState();
      const { outputs } = useOutputStore.getState();
      const { setStatus, setError } = useExecutionStore.getState();
      const { setOutput, setHash } = useOutputStore.getState();

      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const isSource = node.data.category === 'source';
      const input = isSource
        ? (outputs[nodeId]?.text || (node.data.config.text as string) || '')
        : getUpstreamText(nodeId, edges, outputs);

      if (!isSource && !input) {
        setStatus(nodeId, 'warning');
        return;
      }

      setHash(nodeId, '');
      setStatus(nodeId, 'running');
      try {
        const result = await executor(input, node.data.config as Record<string, unknown>);

        setOutput(nodeId, { text: result });

        setHash(nodeId, '');
        setStatus(nodeId, 'complete');
      } catch (err) {
        setError(nodeId, err instanceof Error ? err.message : 'Unknown error');
      }
    },
    []
  );

  const runAll = useCallback(
    async (executor: (input: string, config: Record<string, unknown>, subtype: string) => Promise<string>) => {
      const statuses = Object.values(useExecutionStore.getState().status);
      if (statuses.some((s) => s === 'running')) return;

      const { nodes, edges } = useGraphStore.getState();
      useExecutionStore.getState().resetAll();
      useExecutionStore.getState().setRunAllActive(true);
      useOutputStore.getState().clearAll();

      const nodeIds = nodes.map((n) => n.id);
      const order = topologicalSort(nodeIds, edges);

      try {
        for (const id of order) {
          const node = nodes.find((n) => n.id === id);
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

          await runNode(id, (input, config) => executor(input, config, node.data.subtype));
        }
      } finally {
        useExecutionStore.getState().setRunAllActive(false);
      }
    },
    [runNode]
  );

  return { runNode, runAll };
}
