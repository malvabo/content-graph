import type { Edge } from '@xyflow/react';

export function topologicalSort(nodeIds: string[], edges: Edge[]): string[] {
  const adj = new Map<string, string[]>();
  const inDeg = new Map<string, number>();

  for (const id of nodeIds) {
    adj.set(id, []);
    inDeg.set(id, 0);
  }

  for (const e of edges) {
    if (adj.has(e.source) && adj.has(e.target)) {
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

  return order;
}
