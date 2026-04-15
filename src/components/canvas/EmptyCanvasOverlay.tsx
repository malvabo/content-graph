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
          <button className="btn btn-outline" onClick={() => setGraphName('Untitled Graph')}>Start from scratch</button>
          <div className="relative group py-[10px] -my-[10px]">
            <button className="btn btn-outline">Load template</button>
            <div className="hidden group-hover:block absolute top-full left-0 pt-[10px] min-w-[220px] z-10">
              <div className="rounded-xl shadow-lg py-1" style={{ background: 'var(--color-bg-popover)', border: '1px solid var(--color-border-subtle)' }}>
              {TEMPLATES.map((t, i) => (
                <button key={t.name} className="w-full text-left px-3 py-2 transition" style={{ background: 'transparent' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => loadTemplate(i)}>
                  <div style={{ font: '500 14px/20px var(--font-sans)', color: 'var(--color-text-primary)' }}>{t.name}</div>
                  <div style={{ font: '400 14px/1.5 var(--font-sans)', color: 'var(--color-text-tertiary)' }}>{t.description}</div>
                </button>
              ))}
              </div>
            </div>
          </div>
          <button className="btn btn-outline" onClick={() => fileRef.current?.click()}>Import JSON</button>
          <input ref={fileRef} type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
        </div>
      </div>
    </div>
  );
}
