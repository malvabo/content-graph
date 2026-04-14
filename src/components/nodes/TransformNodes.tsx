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
        className="w-full min-h-[80px] text-sm leading-relaxed border border-[#e5e7eb] rounded-lg p-2 outline-none focus:border-[#6366f1] resize-y"
        placeholder="e.g. Extract the 5 strongest arguments. Simplify to plain English."
        value={directive}
        onChange={(e) => updateConfig(id, { directive: e.target.value })}
      />
      <div className="flex gap-1">
        {['List', 'Paragraph', 'JSON'].map((f) => (
          <button key={f}
            className={`text-[14px] px-2 py-0.5 rounded ${format === f ? 'bg-[#4f46e5] text-white' : 'bg-[#f4f4f5] text-[#57534e]'}`}
            onClick={() => updateConfig(id, { output_format: f })}>{f}</button>
        ))}
      </div>
      {status === 'complete' && output && (
        <div className="border-t border-[#e5e7eb] pt-1.5 mt-1 max-h-[120px] overflow-y-auto text-[14px] text-[#57534e] leading-relaxed" style={{ scrollbarWidth: 'thin' }}>
          {output}
        </div>
      )}
    </div>
  );
}
