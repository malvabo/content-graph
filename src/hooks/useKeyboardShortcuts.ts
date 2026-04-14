import { useEffect } from 'react';
import { useGraphStore } from '../store/graphStore';

export function useKeyboardShortcuts() {
  const { selectedNodeId, duplicateNode, setSelectedNodeId, nodes, setNodes } = useGraphStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (meta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        try { useGraphStore.temporal.getState().undo(); } catch {}
      }
      if (meta && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        try { useGraphStore.temporal.getState().redo(); } catch {}
      }
      if (meta && e.key === 'd' && selectedNodeId) { e.preventDefault(); duplicateNode(selectedNodeId); }
      if (meta && e.key === 'a') { e.preventDefault(); setNodes(nodes.map((n) => ({ ...n, selected: true }))); }
      if (e.key === 'Escape') { setSelectedNodeId(null); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selectedNodeId, duplicateNode, setSelectedNodeId, nodes, setNodes]);
}
