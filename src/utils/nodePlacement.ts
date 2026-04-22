import { useGraphStore } from '../store/graphStore';

export function computeSafePosition(): { x: number; y: number } {
  const nodes = useGraphStore.getState().nodes;
  if (!nodes.length) return { x: 200, y: 150 };
  const maxX = Math.max(...nodes.map((n) => n.position.x));
  const maxY = Math.max(...nodes.map((n) => n.position.y));
  return { x: maxX + 220, y: maxY };
}
