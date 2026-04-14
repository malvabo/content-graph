import { useState, useCallback, useEffect } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { useOutputStore } from '../../store/outputStore';

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
    { label: 'Delete', action: () => removeNode(nodeId) },
    { label: 'Disconnect all', action: () => disconnectAllEdges(nodeId) },
    ...(output ? [{ label: 'Copy output', action: () => navigator.clipboard.writeText(output) }] : []),
  ];

  return (
    <div className="fixed z-50 bg-white border border-[#e5e7eb] rounded-lg shadow-lg py-1 min-w-[160px]" style={{ left: x, top: y }}>
      {items.map((item) => (
        <button key={item.label} className="w-full text-left px-3 py-1.5 text-xs text-[#18181b] hover:bg-[#f4f4f5] transition"
          onClick={() => { item.action(); onClose(); }}>
          {item.label}
        </button>
      ))}
    </div>
  );
}
