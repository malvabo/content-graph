import { useRef, useState, useEffect } from 'react';
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

const PROMPT_TEMPLATES = [
  { label: 'Thought leader',     prompt: 'Write from the perspective of an industry expert sharing a contrarian insight. Be bold and confident.' },
  { label: 'Data-driven',        prompt: 'Lead with the strongest statistic. Focus on concrete outcomes, numbers, and evidence.' },
  { label: 'Storytelling',       prompt: "Open with a specific moment or personal story. Make it relatable. Show, don't tell." },
  { label: 'Problem → Solution', prompt: 'Start with the pain point your audience feels. Then deliver the solution directly and clearly.' },
  { label: 'Contrarian take',    prompt: 'Challenge the conventional wisdom on this topic. Make a bold, defensible claim and back it up.' },
  { label: 'Educational',        prompt: 'Break this down step by step. Teach the concept clearly. Use plain language.' },
  { label: 'ROI focused',        prompt: 'Emphasize return on investment and business impact. Speak to decision-makers.' },
  { label: 'Emotional hook',     prompt: "Open with what's at stake for the reader. Create urgency. Make them feel something." },
];

export function PromptInline({ id }: { id: string }) {
  const config = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.data.config);
  const updateConfig = useGraphStore((s) => s.updateNodeConfig);
  const prompt = (config?.prompt as string) ?? '';
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', h, true);
    return () => document.removeEventListener('pointerdown', h, true);
  }, [open]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
      <textarea
        className="form-textarea nowheel" style={{ flex: 1, minHeight: 0 }}
        placeholder="Write a prompt from scratch…"
        value={prompt}
        onChange={(e) => updateConfig(id, { prompt: e.target.value })}
        aria-label="Prompt"
      />
      <div ref={wrapRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            padding: '5px 10px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-default)',
            background: open ? 'var(--color-bg-surface)' : 'transparent',
            color: 'var(--color-text-tertiary)', cursor: 'pointer',
            fontSize: 11, fontFamily: 'var(--font-sans)', fontWeight: 500,
            transition: 'background 100ms, color 100ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
          onMouseLeave={e => { if (!open) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-tertiary)'; } }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          Choose a template
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d={open ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6'}/></svg>
        </button>
        {open && (
          <div
            className="nowheel"
            style={{
              position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0,
              background: 'var(--color-bg-popover)', border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)',
              padding: '6px', zIndex: 50,
              display: 'flex', flexDirection: 'column', gap: 2,
              maxHeight: 260, overflowY: 'auto',
            }}
          >
            {PROMPT_TEMPLATES.map(t => (
              <button
                key={t.label}
                type="button"
                onClick={() => { updateConfig(id, { prompt: t.prompt }); setOpen(false); }}
                style={{
                  width: '100%', textAlign: 'left', padding: '7px 10px',
                  borderRadius: 'var(--radius-md)', border: 'none',
                  background: 'transparent', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: 2,
                  transition: 'background 80ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', lineHeight: 1.2 }}>{t.label}</span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.prompt}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
