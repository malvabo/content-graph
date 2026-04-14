import { useGraphStore } from '../../store/graphStore';
import { TEMPLATES } from '../../utils/templates';
import { importGraph } from '../../utils/templates';
import { useRef } from 'react';

export default function EmptyCanvasOverlay() {
  const { nodes, setNodes, setEdges, setGraphName } = useGraphStore();
  const fileRef = useRef<HTMLInputElement>(null);
  if (nodes.length > 0) return null;

  const loadTemplate = (idx: number) => {
    const { nodes, edges } = TEMPLATES[idx].build();
    setNodes(nodes);
    setEdges(edges);
    setGraphName(TEMPLATES[idx].name);
  };

  const onImport = async (file: File) => {
    const data = await importGraph(file);
    setNodes(data.nodes);
    setEdges(data.edges);
    setGraphName(data.name);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
      <div className="pointer-events-auto flex flex-col items-center gap-5">
        <div className="text-eyebrow mb-1">Get started</div>
        <div className="flex gap-3">
          <button className="btn btn-outline" onClick={() => {}}>Start from scratch</button>
          <div className="relative group">
            <button className="btn btn-outline">Load template</button>
            <div className="hidden group-hover:block absolute top-full left-0 mt-1 rounded-xl shadow-lg py-1 min-w-[220px] z-10" style={{ background: 'var(--cg-card)', border: '1px solid var(--cg-border)' }}>
              {TEMPLATES.map((t, i) => (
                <button key={t.name} className="w-full text-left px-3 py-2 transition" style={{ background: 'transparent' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cg-surface)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => loadTemplate(i)}>
                  <div style={{ font: '500 14px/20px var(--font-sans)', color: 'var(--cg-ink)' }}>{t.name}</div>
                  <div style={{ font: '400 14px/1.5 var(--font-sans)', color: 'var(--cg-ink-3)' }}>{t.description}</div>
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn-outline" onClick={() => fileRef.current?.click()}>Import JSON</button>
          <input ref={fileRef} type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
        </div>
      </div>
    </div>
  );
}
