import { useState, useEffect, useRef } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { BADGE_COLORS, NODE_DEFS_BY_SUBTYPE, MODEL_OPTIONS, IMAGE_MODEL_OPTIONS, IMAGE_RESOLUTION_OPTIONS, DEFAULT_MODELS } from '../../utils/nodeDefs';
import { useNodeExecution } from '../../hooks/useNodeExecution';
import { NODE_ICONS } from '../../utils/nodeIcons';
import { aiExecute } from '../../utils/aiExecutor';

import { FormInput, FormTextarea } from '../ui/FormField';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-2"><label className="text-field-label">{label}</label>{children}</div>;
}
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: readonly string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button className="w-full h-8 text-sm text-left rounded-[10px] px-2.5 flex items-center"
        style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-primary)', justifyContent: 'space-between', border: `1px solid ${open ? 'var(--color-border-strong)' : 'var(--color-border-default)'}`, boxShadow: open ? 'var(--shadow-sm)' : 'none', transition: 'border-color 150ms, box-shadow 150ms' }}
        onClick={() => setOpen(!open)}>
        <span className="truncate">{value}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.4, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg z-50" style={{ background: 'var(--color-bg-card)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--color-border-subtle)', maxHeight: 220, overflowY: 'auto', scrollbarWidth: 'thin', padding: 'var(--space-1) 0' }}>
          {options.map((o, i) => (
            <button key={o} className="w-full text-left px-3 py-2 text-sm"
              style={{ background: o === value ? 'var(--color-bg-surface)' : 'transparent', color: o === value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: o === value ? 500 : 400, borderBottom: i < options.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}
              onMouseEnter={(e) => { if (o !== value) e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
              onMouseLeave={(e) => { if (o !== value) e.currentTarget.style.background = 'transparent'; }}
              onClick={() => { onChange(o); setOpen(false); }}>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function NumberInput({ value, onChange, min, max, step = 1 }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
  return <input type="number" className="form-input" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} />;
}
function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return <div className="flex items-center justify-between"><span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{label}</span><button role="switch" aria-checked={value} className={`rounded-full transition relative`} style={{ width: 32, height: 18, background: value ? 'var(--color-interactive-focus)' : 'var(--color-text-tertiary)' }} onClick={() => onChange(!value)}><div className={`rounded-full bg-[var(--color-bg-card)] absolute transition-all`} style={{ width: 14, height: 14, top: 2, left: value ? 16 : 2 }} /></button></div>;
}
function Stepper({ value, onChange, min, max, label }: { value: number; onChange: (v: number) => void; min: number; max: number; label: string }) {
  const btnBase = "w-7 h-7 text-sm rounded-lg flex items-center justify-center bg-[var(--color-bg-card)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface)] hover:border-[var(--color-border-subtle)]";
  return <div className="flex items-center gap-2"><button className={`${btnBase} ${value <= min ? 'opacity-40' : ''}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button><span className="text-sm font-medium w-6 text-center" style={{ color: 'var(--color-text-primary)' }}>{value}</span><button className={`${btnBase} ${value >= max ? 'opacity-40' : ''}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>+</button><span className="text-xs" style={{ color: 'var(--color-text-placeholder)' }}>{label}</span></div>;
}

function ModelSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <>
    <div className="border-t border-[var(--color-border-default)] my-2" />
    <Field label="Model">
      <Select value={value} onChange={onChange} options={MODEL_OPTIONS} />
      <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-placeholder)' }}>Faster ↔ Smarter</div>
    </Field>
  </>;
}

const GENERATE_NODES_WITH_QUANTITY = ['linkedin-post', 'twitter-thread', 'twitter-single', 'newsletter', 'infographic', 'quote-card'];

const CONFIGS: Record<string, (c: Record<string, unknown>, s: (k: string, v: unknown) => void) => React.ReactNode> = {
  'text-source': (c, s) => <>
    <FormTextarea label="Prepare (optional)" className="min-h-[80px]" placeholder="e.g. Extract key arguments only. Remove all anecdotes." value={c.prepare as string ?? ''} onChange={(e) => s('prepare', e.target.value)} />
    {(c.prepare as string)?.trim() ? <ModelSelector value={c.model as string ?? DEFAULT_MODELS['text-source']} onChange={(v) => s('model', v)} /> : <div className="text-xs italic mt-1" style={{ color: 'var(--color-text-placeholder)' }}>Add a Prepare instruction to enable model selection</div>}
  </>,
  'file-source': (c, s) => <>
    <FormTextarea label="Prepare (optional)" className="min-h-[80px]" placeholder="e.g. Summarize the key points." value={c.prepare as string ?? ''} onChange={(e) => s('prepare', e.target.value)} />
    {(c.prepare as string)?.trim() ? <ModelSelector value={c.model as string ?? DEFAULT_MODELS['file-source']} onChange={(v) => s('model', v)} /> : <div className="text-xs italic mt-1" style={{ color: 'var(--color-text-placeholder)' }}>Add a Prepare instruction to enable model selection</div>}
  </>,
  'linkedin-post': (c, s) => <>
    <Field label="Goal"><Select value={c.goal as string ?? 'Thought leadership'} onChange={(v) => s('goal', v)} options={['Thought leadership', 'Personal story', 'Industry insight', 'Announcement', 'Call to action']} /></Field>
    <Field label="Tone"><Select value={c.tone as string ?? 'Authoritative'} onChange={(v) => s('tone', v)} options={['Authoritative', 'Conversational', 'Vulnerable', 'Data-driven', 'Contrarian']} /></Field>
    <Field label="Length"><Select value={c.length as string ?? 'Medium ~280w'} onChange={(v) => s('length', v)} options={['Short ~150w', 'Medium ~280w', 'Long ~450w']} /></Field>
    <Field label="Hook style"><Select value={c.hook as string ?? 'Bold statement'} onChange={(v) => s('hook', v)} options={['Bold statement', 'Surprising stat', 'Personal micro-story', 'Counter-intuitive claim', 'Question']} /></Field>
    <Toggle value={!!c.hashtags} onChange={(v) => s('hashtags', v)} label="Include hashtags" />
    <Toggle value={!!c.emoji} onChange={(v) => s('emoji', v)} label="Include emoji" />
  </>,
  'twitter-thread': (c, s) => <>
    <Field label="Tweets"><NumberInput value={c.tweets as number ?? 7} onChange={(v) => s('tweets', v)} min={5} max={20} /></Field>
    <Field label="Style"><Select value={c.style as string ?? 'Numbered 1/ 2/ 3/'} onChange={(v) => s('style', v)} options={['Numbered 1/ 2/ 3/', 'Hook + thread', 'Narrative']} /></Field>
    <Field label="Tone"><Select value={c.tone as string ?? 'Analytical'} onChange={(v) => s('tone', v)} options={['Analytical', 'Personal', 'Educational', 'Provocative']} /></Field>
  </>,
  'twitter-single': (c, s) => <Field label="Angle"><Select value={c.angle as string ?? 'Most quotable insight'} onChange={(v) => s('angle', v)} options={['Most quotable insight', 'Strongest stat', 'Contrarian take', 'Call to action']} /></Field>,
  'newsletter': (c, s) => <>
    <Field label="Section type"><Select value={c.type as string ?? 'Full issue'} onChange={(v) => s('type', v)} options={['Full issue', 'Feature section', 'TL;DR', 'Deep dive', 'Roundup intro']} /></Field>
    <FormInput label="Audience" value={c.audience as string ?? ''} onChange={(e) => s('audience', e.target.value)} placeholder="e.g. B2B SaaS founders" />
    <Field label="Word count"><NumberInput value={c.words as number ?? 350} onChange={(v) => s('words', v)} min={100} max={1000} /></Field>
  </>,
  'infographic': (c, s) => <>
    <Field label="Type"><Select value={c.type as string ?? 'Process'} onChange={(v) => s('type', v)} options={['Process', 'Statistical', 'Comparison', 'Timeline', 'Listicle', 'Anatomy']} /></Field>
    <Field label="Max sections"><NumberInput value={c.sections as number ?? 6} onChange={(v) => s('sections', v)} min={3} max={8} /></Field>
    <Field label="Style"><Select value={c.style as string ?? 'Clean Corporate'} onChange={(v) => s('style', v)} options={['Clean Corporate', 'Bold Editorial', 'Illustrated', 'Dark Premium', 'Minimalist']} /></Field>
  </>,
  'quote-card': (c, s) => <Field label="Format"><Select value={c.format as string ?? 'Single quote'} onChange={(v) => s('format', v)} options={['Single quote', 'Multiple options']} /></Field>,
  'image-prompt': (c, s) => <>
    <Field label="Purpose"><Select value={c.purpose as string ?? 'Blog hero'} onChange={(v) => s('purpose', v)} options={['Blog hero', 'LinkedIn post', 'Newsletter header', 'Instagram slide', 'Social concept']} /></Field>
    <Field label="Style"><Select value={c.style as string ?? 'Photography'} onChange={(v) => s('style', v)} options={['Photography', 'Flat illustration', '3D render', 'Abstract', 'Editorial graphic']} /></Field>
    <Field label="Aspect ratio"><Select value={c.aspect as string ?? '16:9'} onChange={(v) => s('aspect', v)} options={['1:1', '4:5', '16:9', '9:16', '1.91:1']} /></Field>
    <ModelSelector value={c.model as string ?? DEFAULT_MODELS['image-prompt']} onChange={(v) => s('model', v)} />
    <Field label="Image model"><Select value={c.imageModel as string ?? 'FLUX.1 schnell'} onChange={(v) => s('imageModel', v)} options={IMAGE_MODEL_OPTIONS} /></Field>
    <Field label="Resolution"><Select value={c.resolution as string ?? '1024x1024'} onChange={(v) => s('resolution', v)} options={IMAGE_RESOLUTION_OPTIONS} /></Field>
  </>,
  'refine': () => <></>,
  'export': (c, s) => <>
    <Field label="Formats">
      <div className="flex flex-wrap gap-1">
        {['.txt', '.md', '.docx', '.pdf', '.json', '.zip'].map((f) => {
          const formats = (c.formats as string[]) ?? ['.zip'];
          const active = formats.includes(f);
          return <button key={f} className={`text-xs px-2.5 py-1 rounded ${active ? 'bg-[var(--color-interactive-focus)] text-white' : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)]'}`}
            onClick={() => s('formats', active ? formats.filter((x: string) => x !== f) : [...formats, f])}>{f}</button>;
        })}
      </div>
    </Field>
    <FormInput label="File prefix" value={c.prefix as string ?? 'content-export'} onChange={(e) => s('prefix', e.target.value)} />
    <Toggle value={!!c.metadata} onChange={(v) => s('metadata', v)} label="Include metadata" />
  </>,
};

export default function ConfigPanel() {
  const selectedId = useGraphStore((s) => s.selectedNodeId);
  const node = useGraphStore((s) => s.nodes.find((n) => n.id === selectedId));
  const updateConfig = useGraphStore((s) => s.updateNodeConfig);
  const { runNode } = useNodeExecution();
  const [local, setLocal] = useState<Record<string, unknown>>({});

  useEffect(() => { setLocal(node?.data.config ?? {}); }, [selectedId, node?.data.config]);

  if (!node) return null;

  const def = NODE_DEFS_BY_SUBTYPE[node.data.subtype];
  const colors = BADGE_COLORS[node.data.category];
  const configRenderer = CONFIGS[node.data.subtype];
  const set = (key: string, value: unknown) => { setLocal((p) => ({ ...p, [key]: value })); updateConfig(node.id, { [key]: value }); };
  const hasQuantity = GENERATE_NODES_WITH_QUANTITY.includes(node.data.subtype);
  const hasModel = !!DEFAULT_MODELS[node.data.subtype] && node.data.subtype !== 'text-source' && node.data.subtype !== 'image-prompt';

  return (
    <div className="absolute top-14 right-3 z-20 w-[280px] max-h-[calc(100%-72px)] overflow-y-auto"
      style={{ background: 'var(--color-bg-popover)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--color-border-subtle)', scrollbarWidth: 'thin' }}>
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-[30px] h-[30px] rounded-lg flex items-center justify-center" style={{ backgroundColor: colors.bg, color: colors.text }}>{NODE_ICONS[node.data.subtype]?.() ?? def?.badge}</div>
          <div className="flex-1" style={{ fontWeight: 500, fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-fixed)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>{node.data.label}</div>
          <button className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--color-bg-surface)] transition" title="Delete node" aria-label="Delete node"
            onClick={() => { if (confirm('Delete this node?')) { useGraphStore.getState().removeNode(node.id); useExecutionStore.getState().resetNode(node.id); useOutputStore.getState().clearNode(node.id); } }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-placeholder)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      </div>

      {/* Settings */}
      <div className="px-5 pb-4 flex flex-col gap-3">
        {hasQuantity && (
          <Field label="Number of outputs">
            <Stepper value={local.quantity as number ?? 1} onChange={(v) => set('quantity', v)} min={1} max={5} label="outputs" />
          </Field>
        )}
        {configRenderer ? configRenderer(local, set) : <span className="text-[14px]" style={{ color: 'var(--color-text-placeholder)' }}>No configuration options</span>}
        {hasModel && <ModelSelector value={local.model as string ?? DEFAULT_MODELS[node.data.subtype]} onChange={(v) => set('model', v)} />}
      </div>

      {/* Run button */}
      <div className="px-5 pb-5">
        <button className="btn btn-primary w-full" onClick={() => {
          if (!node) return;
          runNode(node.id, async (input, config) => {
            return aiExecute(input, config, node.data.subtype);
          });
        }}>▶ Run</button>
      </div>
    </div>
  );
}
