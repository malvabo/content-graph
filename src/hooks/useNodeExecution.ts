import { useCallback } from 'react';
import { useGraphStore } from '../store/graphStore';
import { useExecutionStore } from '../store/executionStore';
import { useOutputStore } from '../store/outputStore';
import { topologicalSort } from '../utils/topologicalSort';
import type { Edge } from '@xyflow/react';

// Generate image from prompt via Pollinations.ai (free, no API key needed)
async function generateImage(prompt: string): Promise<string> {
  const encoded = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true`;

  const response = await fetch(url);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getUpstreamText(nodeId: string, edges: Edge[], outputs: Record<string, { text?: string }>) {
  const nodes = useGraphStore.getState().nodes;
  const upstream = edges.filter((e) => e.target === nodeId).map((e) => e.source);
  return upstream.map((id) => {
    if (outputs[id]?.text) return outputs[id].text;
    // Fallback: read config.text from source nodes
    const node = nodes.find((n) => n.id === id);
    if (node?.data.category === 'source') return (node.data.config.text as string) || '';
    return '';
  }).filter(Boolean).join('\n\n---\n\n');
}

export function useNodeExecution() {
  const runNode = useCallback(
    async (nodeId: string, executor: (input: string, config: Record<string, unknown>) => Promise<string>) => {
      // Read LIVE state at call time — not from closure
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

      // Always re-execute on manual run — clear cached hash
      setHash(nodeId, '');

      setStatus(nodeId, 'running');
      try {
        const result = await executor(input, node.data.config as Record<string, unknown>);

        // image-prompt: two-phase — generate prompt text, then generate image
        if (node.data.subtype === 'image-prompt') {
          setOutput(nodeId, { text: result });
          // Phase 2: generate image from prompt
          const { setProgress } = useExecutionStore.getState();
          setProgress(nodeId, 50);
          const imageBase64 = await generateImage(result);
          setOutput(nodeId, { text: result, imageBase64 });
          setProgress(nodeId, 100);
        } else {
          setOutput(nodeId, { text: result });
        }

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
      const { nodes, edges } = useGraphStore.getState();
      useExecutionStore.getState().resetAll();
      useOutputStore.getState().clearAll();

      const nodeIds = nodes.map((n) => n.id);
      const order = topologicalSort(nodeIds, edges);
      console.log('[RunAll] nodes:', nodeIds.length, 'order:', order.length, order);

      for (const id of order) {
        const node = nodes.find((n) => n.id === id);
        if (!node) continue;

        if (node.data.category === 'source') {
          const prepare = node.data.config.prepare as string | undefined;
          if (!prepare?.trim()) {
            // Copy source content to outputStore so downstream nodes can read it
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
    },
    [runNode]
  );

  return { runNode, runAll };
}
