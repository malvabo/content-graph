import { useState, useRef, useEffect } from 'react';
import { NODE_DEFS, BADGE_COLORS, type NodeDef } from '../../utils/nodeDefs';
import { useGraphStore, type ContentNode } from '../../store/graphStore';

interface Props { x: number; y: number; onClose: () => void; onSelect: (def: NodeDef) => void }

export default function NodeSpotlight({ x, y, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const addNode = useGraphStore((s) => s.addNode);

  const filtered = NODE_DEFS.filter((d) =>
    d.label.toLowerCase().includes(query.toLowerCase()) ||
    d.description.toLowerCase().includes(query.toLowerCase()) ||
    d.category.includes(query.toLowerCase())
  );

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setIdx(0); }, [query]);

  const place = (def: NodeDef) => {
    const node: ContentNode = {
      id: `${def.subtype}-${Date.now()}`,
      type: 'contentNode',
      position: { x: x - 120, y: y - 40 },
      deletable: true,
      data: { subtype: def.subtype, label: def.label, badge: def.badge, category: def.category, description: def.description, config: {} },
    };
    addNode(node);
    onSelect(def);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && filtered[idx]) { place(filtered[idx]); }
    if (e.key === 'Escape') { onClose(); }
  };

  return (
    <div className="absolute z-50" style={{ left: x - 130, top: y - 20 }} onClick={(e) => e.stopPropagation()}>
      <div className="w-[260px] bg-white border border-[#e5e7eb] rounded-xl shadow-lg overflow-hidden">
        <input
          ref={inputRef}
          className="w-full px-3 py-2.5 text-xs outline-none border-b border-[#e5e7eb] placeholder:text-[#a1a1aa]"
          placeholder="Search nodes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="max-h-[280px] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-[11px] text-[#a1a1aa]">No nodes found</div>
          )}
          {filtered.map((def, i) => {
            const colors = BADGE_COLORS[def.category];
            return (
              <button
                key={def.subtype}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition ${i === idx ? 'bg-[#f4f4f5]' : 'hover:bg-[#fafafa]'}`}
                onClick={() => place(def)}
                onMouseEnter={() => setIdx(i)}
              >
                <div className="w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center shrink-0"
                  style={{ backgroundColor: colors.bg, color: colors.text }}>{def.badge}</div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[#18181b] truncate">{def.label}</div>
                  <div className="text-[10px] text-[#a1a1aa] truncate">{def.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
