import { useGraphStore } from '../../store/graphStore';
import { useOutputStore } from '../../store/outputStore';
import { useExecutionStore } from '../../store/executionStore';

export function RefineInline({ id }: { id: string }) {
  const config = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.data.config);
  const updateConfig = useGraphStore((s) => s.updateNodeConfig);
  const status = useExecutionStore((s) => s.status[id] ?? 'idle');
  const output = useOutputStore((s) => s.outputs[id]?.text);
  const directive = (config?.directive as string) ?? '';
  const format = (config?.output_format as string) ?? 'Paragraph';

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <textarea
        className="form-textarea min-h-[140px]"
        placeholder="e.g. Extract the 5 strongest arguments. Simplify to plain English."
        value={directive}
        onChange={(e) => updateConfig(id, { directive: e.target.value })}
      />
      <div className="flex gap-1">
        {['List', 'Paragraph', 'JSON'].map((f) => (
          <button key={f}
            className={`text-sm px-2.5 py-1 rounded ${format === f ? 'bg-[var(--color-accent-subtle)] text-[var(--color-bg-card)]' : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)]'}`}
            onClick={() => updateConfig(id, { output_format: f })}>{f}</button>
        ))}
      </div>
      {status === 'complete' && output && (
        <div className="nowheel border-t border-[var(--color-border-default)] pt-1.5 mt-1 max-h-[120px] overflow-y-auto text-sm text-[var(--color-text-secondary)] leading-relaxed" style={{ scrollbarWidth: 'thin' }}>
          {output}
        </div>
      )}
    </div>
  );
}
