import { useCallback } from 'react';
import { useGraphStore } from '../store/graphStore';
import { useExecutionStore } from '../store/executionStore';
import { useOutputStore } from '../store/outputStore';
import { topologicalSort } from '../utils/topologicalSort';
import { hashContent } from '../utils/hashContent';
import type { Edge } from '@xyflow/react';

function getUpstreamText(nodeId: string, edges: Edge[], outputs: Record<string, { text?: string }>) {
  const upstream = edges.filter((e) => e.target === nodeId).map((e) => e.source);
  return upstream.map((id) => outputs[id]?.text ?? '').filter(Boolean).join('\n\n---\n\n');
}

export function useNodeExecution() {
  const { nodes, edges } = useGraphStore();
  const { setStatus, setError, resetAll } = useExecutionStore();
  const { outputs, hashes, setOutput, setHash } = useOutputStore();

  const runNode = useCallback(
    async (nodeId: string, executor: (input: string, config: Record<string, unknown>) => Promise<string>) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const isSource = node.data.category === 'source';
      const input = isSource ? (outputs[nodeId]?.text ?? '') : getUpstreamText(nodeId, edges, outputs);

      if (!isSource && !input) {
        setStatus(nodeId, 'warning');
        return;
      }

      const cacheKey = JSON.stringify({ nodeId, config: node.data.config, input });
      const hash = await hashContent(cacheKey);
      if (hashes[nodeId] === hash && outputs[nodeId]?.text) {
        setStatus(nodeId, 'complete');
        return;
      }

      setStatus(nodeId, 'running');
      try {
        const result = await executor(input, node.data.config as Record<string, unknown>);
        setOutput(nodeId, { text: result });
        setHash(nodeId, hash);
        setStatus(nodeId, 'complete');
      } catch (err) {
        setError(nodeId, err instanceof Error ? err.message : 'Unknown error');
      }
    },
    [nodes, edges, outputs, hashes, setStatus, setError, setOutput, setHash]
  );

  const runAll = useCallback(
    async (executor: (input: string, config: Record<string, unknown>, subtype: string) => Promise<string>) => {
      resetAll();
      const nodeIds = nodes.map((n) => n.id);
      const order = topologicalSort(nodeIds, edges);

      for (const id of order) {
        const node = nodes.find((n) => n.id === id);
        if (!node) continue;

        // Source nodes: auto-complete if no Prepare, otherwise run executor
        if (node.data.category === 'source') {
          const prepare = node.data.config.prepare as string | undefined;
          if (!prepare?.trim()) {
            setStatus(id, 'complete');
            continue;
          }
        }

        await runNode(id, (input, config) => executor(input, config, node.data.subtype));
      }
    },
    [nodes, edges, resetAll, setStatus, runNode]
  );

  return { runNode, runAll };
}
