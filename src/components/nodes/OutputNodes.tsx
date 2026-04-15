import { useGraphStore } from '../../store/graphStore';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';

export function ExportInline({ id }: { id: string }) {
  const edges = useGraphStore((s) => s.edges);
  const nodes = useGraphStore((s) => s.nodes);
  const status = useExecutionStore((s) => s.status);
  const outputs = useOutputStore((s) => s.outputs);

  const upstream = edges.filter((e) => e.target === id).map((e) => {
    const n = nodes.find((n) => n.id === e.source);
    const st = n ? (status as Record<string, string>)[n.id] : undefined;
    return n ? { id: n.id, label: n.data.label, done: st === 'complete' } : null;
  }).filter(Boolean);

  // Scan for completed image-prompt nodes (auto-included regardless of edges)
  const imagePromptNodes = nodes.filter((n) => n.data.subtype === 'image-prompt' && outputs[n.id]?.imageBase64);

  return (
    <div className="mt-2">
      {upstream.length === 0 && imagePromptNodes.length === 0 ? (
        <div className="text-sm text-[var(--color-text-placeholder)]">Connect nodes to export</div>
      ) : (
        <div className="flex flex-col gap-1">
          {upstream.map((u) => (
            <div key={u!.id} className="text-sm text-[var(--color-text-secondary)] flex items-center gap-1">
              <span style={{ color: u!.done ? 'var(--color-accent)' : 'var(--color-text-disabled)' }}>{u!.done ? '✓' : '○'}</span> {u!.label}
            </div>
          ))}
          {imagePromptNodes.map((n) => (
            <div key={n.id} className="text-sm text-[var(--color-text-secondary)] flex items-center gap-1">
              <span className="text-[var(--p-amber-600)]">✓</span> {n.data.label} (image)
            </div>
          ))}
        </div>
      )}
      {status[id] === 'complete' && (
        <button className="w-full h-8 mt-2 text-sm font-medium bg-[var(--color-accent)] text-[var(--p-white)] rounded-lg hover:bg-[var(--color-accent-hover)] transition"
          onClick={() => {
            const allText = upstream.filter(u => u?.done).map(u => outputs[u!.id]?.text || '').filter(Boolean).join('\n\n---\n\n');
            if (!allText) return;
            const blob = new Blob([allText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'content-export.txt'; a.click();
            URL.revokeObjectURL(url);
          }}>
          ↓ Download content-export.txt
        </button>
      )}
    </div>
  );
}
