import { useGraphStore } from '../../store/graphStore';
import { useOutputStore } from '../../store/outputStore';
import { useExecutionStore } from '../../store/executionStore';
import { useState, useRef, useEffect } from 'react';

const PROMPT_TEMPLATES = [
  { label: 'Thought leadership', text: 'Position as an industry authority. Highlight forward-thinking trends and bold perspectives.' },
  { label: 'ROI focused', text: 'Emphasize business value and ROI. Quantify impact where possible. Speak to decision-makers.' },
  { label: 'Beginner friendly', text: 'Write for a general audience. Avoid jargon and explain key concepts clearly.' },
  { label: 'Data-driven', text: 'Back every claim with data or research. Lead with statistics and hard evidence.' },
  { label: 'Storytelling', text: 'Lead with a narrative hook. Use a personal or relatable story to engage readers.' },
  { label: 'Problem → Solution', text: 'Frame around a core problem the audience faces, then reveal the solution.' },
  { label: 'Call to action', text: 'Build to a compelling call to action. Create urgency and highlight the direct benefit.' },
  { label: 'Bold & opinionated', text: 'Take a strong stance. Use confident, assertive language. Challenge conventional thinking.' },
];

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
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, position: 'relative' }}>
      <textarea
        className="form-textarea" style={{ flex: 1, minHeight: 0 }}
        placeholder="Write a prompt filter, or choose a template below…"
        value={prompt}
        onChange={(e) => updateConfig(id, { prompt: e.target.value })}
        aria-label="Prompt filter"
      />
      <button
        ref={btnRef}
        onMouseDown={e => e.stopPropagation()}
        onClick={() => setShowPicker(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          height: 24, padding: '0 8px', borderRadius: 'var(--radius-md)',
          background: showPicker ? 'var(--color-bg-surface)' : 'transparent',
          border: '1px solid var(--color-border-default)',
          color: 'var(--color-text-tertiary)', cursor: 'pointer',
          fontSize: 11, fontFamily: 'var(--font-sans)', fontWeight: 500,
          transition: 'background 100ms, border-color 100ms',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; e.currentTarget.style.borderColor = 'var(--color-border-strong)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = showPicker ? 'var(--color-bg-surface)' : 'transparent'; e.currentTarget.style.borderColor = 'var(--color-border-default)'; e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
        aria-label="Choose a prompt template"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 6h16M4 12h10M4 18h7"/></svg>
        Choose a template
      </button>

      {showPicker && (
        <div
          ref={pickerRef}
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'absolute', bottom: 'calc(100% - 22px)', left: 0, right: 0,
            background: 'var(--color-bg-popover)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-lg)',
            padding: 6,
            zIndex: 50,
            display: 'flex', flexDirection: 'column', gap: 1,
          }}
        >
          {PROMPT_TEMPLATES.map(tpl => (
            <button
              key={tpl.label}
              onClick={() => { updateConfig(id, { prompt: tpl.text }); setShowPicker(false); }}
              style={{
                width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                padding: '6px 8px', background: 'none', border: 'none',
                borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left',
                transition: 'background 80ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', lineHeight: 1.3 }}>{tpl.label}</span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', lineHeight: 1.4, marginTop: 1 }}>{tpl.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
