import type { Edge } from '@xyflow/react';

let cachedEdgeKey = '';
let cachedOrder: string[] = [];

export function topologicalSort(nodeIds: string[], edges: Edge[], excludeDownstreamOf?: string): string[] {
  const edgeKey = edges.map((e) => `${e.source}-${e.target}`).sort().join('|');
  const fullKey = edgeKey + (excludeDownstreamOf ?? '');
  if (fullKey === cachedEdgeKey) return cachedOrder;

  const adj = new Map<string, string[]>();
  const inDeg = new Map<string, number>();
  const allowed = new Set(nodeIds);

  // If excluding downstream of a node, remove those from the set
  if (excludeDownstreamOf) {
    const downstream = new Set<string>();
    const queue = [excludeDownstreamOf];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const e of edges) {
        if (e.source === cur && !downstream.has(e.target)) {
          downstream.add(e.target);
          queue.push(e.target);
        }
      }
    }
    downstream.forEach((id) => allowed.delete(id));
  }

  for (const id of allowed) {
    adj.set(id, []);
    inDeg.set(id, 0);
  }

  for (const e of edges) {
    if (allowed.has(e.source) && allowed.has(e.target)) {
      adj.get(e.source)!.push(e.target);
      inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDeg) {
    if (deg === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    order.push(cur);
    for (const next of adj.get(cur) ?? []) {
      const d = inDeg.get(next)! - 1;
      inDeg.set(next, d);
      if (d === 0) queue.push(next);
    }
  }

  cachedEdgeKey = fullKey;
  cachedOrder = order;
  return order;
}

export function invalidateTopoCache() {
  cachedEdgeKey = '';
  cachedOrder = [];
}
