import { useEffect } from 'react';
import { useGraphStore } from '../store/graphStore';
import type { ContentNode } from '../store/graphStore';

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (meta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        try { useGraphStore.temporal.getState().undo(); } catch { /* empty */ }
      }
      if (meta && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        try { useGraphStore.temporal.getState().redo(); } catch { /* empty */ }
      }
      if (meta && e.key === 'd') {
        const id = useGraphStore.getState().selectedNodeId;
        if (id) { e.preventDefault(); useGraphStore.getState().duplicateNode(id); }
      }
      if (meta && e.key === 'a') {
        e.preventDefault();
        const { nodes, setNodes } = useGraphStore.getState();
        setNodes(nodes.map((n) => ({ ...n, selected: true }) as ContentNode));
      }
      if (e.key === 'Escape') { useGraphStore.getState().setSelectedNodeId(null); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
}
