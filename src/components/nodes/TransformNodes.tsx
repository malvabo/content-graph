import { useGraphStore } from '../../store/graphStore';
import { useOutputStore } from '../../store/outputStore';
import { useExecutionStore } from '../../store/executionStore';
import { useState } from 'react';
import PromptTemplateModal from '../modals/PromptTemplateModal';

export function RefineInline({ id }: { id: string }) {
  const config = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.data.config);
  const updateConfig = useGraphStore((s) => s.updateNodeConfig);
  const status = useExecutionStore((s) => s.status[id] ?? 'idle');
  const output = useOutputStore((s) => s.outputs[id]?.text);
  const directive = (config?.directive as string) ?? '';
  const format = (config?.output_format as string) ?? 'Paragraph';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
      <textarea
        className="form-textarea" style={{ flex: 1, minHeight: 0 }}
        placeholder="e.g. Extract the 5 strongest arguments. Simplify to plain English."
        value={directive}
        onChange={(e) => updateConfig(id, { directive: e.target.value })}
        aria-label="Refine directive"
      />
      <div className="flex gap-1">
        {['List', 'Paragraph', 'JSON'].map((f) => (
          <button key={f}
            aria-pressed={format === f}
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

export function PromptInline({ id }: { id: string }) {
  const config = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.data.config);
  const updateConfig = useGraphStore((s) => s.updateNodeConfig);
  const prompt = (config?.prompt as string) ?? '';
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
      <textarea
        className="form-textarea" style={{ flex: 1, minHeight: 0 }}
        placeholder="Write a prompt filter, or choose a template below…"
        value={prompt}
        onChange={(e) => updateConfig(id, { prompt: e.target.value })}
        aria-label="Prompt filter"
      />
      <button
        className="btn btn-outline"
        onMouseDown={e => e.stopPropagation()}
        onClick={() => setModalOpen(true)}
        aria-label="Choose a prompt template"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 6h16M4 12h10M4 18h7"/></svg>
        Choose a template
      </button>

      {modalOpen && (
        <PromptTemplateModal
          onClose={() => setModalOpen(false)}
          onPick={text => { updateConfig(id, { prompt: text }); setModalOpen(false); }}
          onScratch={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
