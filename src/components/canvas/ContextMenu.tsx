import { useState, useCallback, useEffect } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { useOutputStore } from '../../store/outputStore';
import { useExecutionStore } from '../../store/executionStore';

interface MenuPos { x: number; y: number; nodeId: string }

export function useContextMenu() {
  const [menu, setMenu] = useState<MenuPos | null>(null);
  const onNodeContextMenu = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, nodeId });
  }, []);
  const close = useCallback(() => setMenu(null), []);
  useEffect(() => { document.addEventListener('click', close); return () => document.removeEventListener('click', close); }, [close]);
  return { menu, onNodeContextMenu, close };
}

export default function ContextMenu({ x, y, nodeId, onClose }: { x: number; y: number; nodeId: string; onClose: () => void }) {
  const { removeNode, duplicateNode, disconnectAllEdges } = useGraphStore();
  const output = useOutputStore((s) => s.outputs[nodeId]?.text);

  const items = [
    { label: 'Duplicate', action: () => duplicateNode(nodeId) },
    { label: 'Delete', action: () => { removeNode(nodeId); useExecutionStore.getState().resetNode(nodeId); useOutputStore.getState().clearNode(nodeId); } },
    { label: 'Disconnect all', action: () => disconnectAllEdges(nodeId) },
    ...(output ? [{ label: 'Copy output', action: () => navigator.clipboard.writeText(output) }] : []),
  ];

  const isDanger = (label: string) => label.toLowerCase().includes('delete');

  return (
    <div className="ctx-menu-fade fixed z-50 bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] rounded-lg shadow-lg py-1 min-w-[160px]" style={{ left: x, top: y }}>
      {items.map((item) => (
        <button key={item.label} className={`w-full text-left px-3 py-1.5 text-sm transition ${isDanger(item.label) ? 'text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]' : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'}`}
          onClick={() => { item.action(); onClose(); }}>
          {item.label}
        </button>
      ))}
    </div>
  );
}
