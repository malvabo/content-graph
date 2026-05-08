import { useCallback, useRef } from 'react';
import { useGraphStore } from '../store/graphStore';
import { useExecutionStore } from '../store/executionStore';
import { useOutputStore } from '../store/outputStore';
import { topologicalSort } from '../utils/topologicalSort';

export interface ExecutorMeta {
  inputCount: number;
  promptFilters?: string[];
}

// Resolves the text for a node: checks output store, falls back to source config,
// and for Prompt nodes traces upstream recursively so single-node runs work without
// a prior runAll having populated the Prompt's output.
function resolveText(
  nodeId: string,
  outputs: Record<string, { text?: string }>,
  nodes: ReturnType<typeof useGraphStore.getState>['nodes'],
  edges: ReturnType<typeof useGraphStore.getState>['edges']
): string {
  const cached = outputs[nodeId]?.text;
  if (cached) return cached;

  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return '';

  if (node.data.category === 'source') return (node.data.config.text as string) || '';

  if (node.data.subtype === 'prompt') {
    const upIds = edges.filter((e) => e.target === nodeId).map((e) => e.source);
    for (const uid of upIds) {
      const t = resolveText(uid, outputs, nodes, edges);
      if (t) return t;
    }
  }

  return '';
}

export function getUpstreamText(nodeId: string): { text: string; inputCount: number; promptFilters: string[] } {
  const { nodes, edges } = useGraphStore.getState();
  const outputs = useOutputStore.getState().outputs;
  const upstreamIds = edges.filter((e) => e.target === nodeId).map((e) => e.source);

  // Collect prompt filters; exclude Prompt nodes from content chunks
  const promptFilters: string[] = [];
  const contentIds: string[] = [];
  for (const id of upstreamIds) {
    const node = nodes.find((n) => n.id === id);
    if (node?.data.subtype === 'prompt') {
      const f = (node.data.config.prompt as string)?.trim();
      if (f) promptFilters.push(f);
      // Still include Prompt in content so its pass-through reaches Generate
      contentIds.push(id);
    } else {
      contentIds.push(id);
    }
  }

  const chunks = contentIds.map((id) => {
    const node = nodes.find((n) => n.id === id);
    const text = resolveText(id, outputs, nodes, edges);
    return node && text ? { node, text } : null;
  }).filter((c): c is { node: NonNullable<typeof c>['node']; text: string } => c !== null);

  // Canvas-order fan-in: top-to-bottom, ties broken by left-to-right.
  chunks.sort((a, b) => (a.node.position.y - b.node.position.y) || (a.node.position.x - b.node.position.x));

  if (chunks.length <= 1) {
    return { text: chunks[0]?.text ?? '', inputCount: chunks.length, promptFilters };
  }

  const labeled = chunks
    .map((c, i) => `## Input ${i + 1} — ${c.node.data.label} (${c.node.data.subtype})\n${c.text}`)
    .join('\n\n');
  return { text: labeled, inputCount: chunks.length, promptFilters };
}

export function useNodeExecution() {
  const abortRef = useRef<AbortController | null>(null);

  const runNode = useCallback(
    async (nodeId: string, executor: (input: string, config: Record<string, unknown>, meta: ExecutorMeta) => Promise<string>, signal?: AbortSignal) => {
      const { nodes } = useGraphStore.getState();
      const { setStatus, setError } = useExecutionStore.getState();
      const { setOutput } = useOutputStore.getState();

      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      if (signal?.aborted) return;

      const isSource = node.data.category === 'source';
      let input: string;
      let inputCount: number;
      let promptFilters: string[] | undefined;
      if (isSource) {
        input = useOutputStore.getState().outputs[nodeId]?.text || (node.data.config.text as string) || '';
        inputCount = input ? 1 : 0;
      } else {
        const upstream = getUpstreamText(nodeId);
        input = upstream.text;
        inputCount = upstream.inputCount;
        promptFilters = upstream.promptFilters.length > 0 ? upstream.promptFilters : undefined;
      }

      if (!isSource && !input) {
        setStatus(nodeId, 'warning');
        return;
      }

      // Clear previous errors before re-running
      useExecutionStore.getState().resetNode(nodeId);

      setStatus(nodeId, 'running');
      try {
        if (signal?.aborted) { setStatus(nodeId, 'idle'); return; }
        const result = await executor(input, node.data.config as Record<string, unknown>, { inputCount, promptFilters });
        if (signal?.aborted) { setStatus(nodeId, 'idle'); return; }
        setOutput(nodeId, { text: result });
        setStatus(nodeId, 'complete');
      } catch (err) {
        if (signal?.aborted) { setStatus(nodeId, 'idle'); return; }
        setError(nodeId, err instanceof Error ? err.message : 'Unknown error');
      }
    },
    []
  );

  const runAll = useCallback(
    async (executor: (input: string, config: Record<string, unknown>, subtype: string, meta: ExecutorMeta) => Promise<string>, filterIds?: Set<string>) => {
      // Race guard — abort any existing run
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      // Read fresh state
      const { nodes, edges } = useGraphStore.getState();
      useExecutionStore.getState().resetAll();
      useExecutionStore.getState().setRunAllActive(true);
      // Clear only non-source outputs to preserve image/voice source data
      const sourceIds = new Set(nodes.filter(n => n.data.category === 'source').map(n => n.id));
      const outputState = useOutputStore.getState();
      Object.keys(outputState.outputs).forEach(id => { if (!sourceIds.has(id)) outputState.setOutput(id, {}); });

      const nodeIds = nodes.map((n) => n.id);
      const order = topologicalSort(nodeIds, edges).filter(id => !filterIds || filterIds.has(id));

      try {
        for (const id of order) {
          if (ctrl.signal.aborted) break;

          // Read fresh node state each iteration
          const node = useGraphStore.getState().nodes.find((n) => n.id === id);
          if (!node) continue;

          // Prompt nodes are pass-through — copy upstream content, inject filter downstream, no AI call
          if (node.data.subtype === 'prompt') {
            const { text } = getUpstreamText(id);
            if (text) useOutputStore.getState().setOutput(id, { text });
            useExecutionStore.getState().setStatus(id, 'complete');
            continue;
          }

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

          await runNode(id, (input, config, meta) => executor(input, config, node.data.subtype, meta), ctrl.signal);
        }
      } finally {
        useExecutionStore.getState().setRunAllActive(false);
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
