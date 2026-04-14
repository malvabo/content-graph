import { useState, useEffect } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { BADGE_COLORS, NODE_DEFS_BY_SUBTYPE, MODEL_OPTIONS, IMAGE_MODEL_OPTIONS, DEFAULT_MODELS } from '../../utils/nodeDefs';
import { useNodeExecution } from '../../hooks/useNodeExecution';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><label className="text-[10px] font-medium text-[#a1a1aa] uppercase tracking-wider">{label}</label>{children}</div>;
}
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return <select className="w-full h-8 text-xs border border-[#e5e7eb] rounded-lg px-2 bg-white outline-none focus:border-[#6366f1]" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o}>{o}</option>)}</select>;
}
function NumberInput({ value, onChange, min, max, step = 1 }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
  return <input type="number" className="w-full h-8 text-xs border border-[#e5e7eb] rounded-lg px-2 bg-white outline-none focus:border-[#6366f1]" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} />;
}
function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return <div className="flex items-center justify-between"><span className="text-xs text-[#71717a]">{label}</span><button className={`w-8 h-4.5 rounded-full transition ${value ? 'bg-[#4f46e5]' : 'bg-[#d1d5db]'} relative`} onClick={() => onChange(!value)}><div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all ${value ? 'left-4' : 'left-0.5'}`} /></button></div>;
}
function Stepper({ value, onChange, min, max, label }: { value: number; onChange: (v: number) => void; min: number; max: number; label: string }) {
  return <div className="flex items-center gap-2"><button className="w-6 h-6 text-xs border border-[#e5e7eb] rounded flex items-center justify-center hover:bg-[#f4f4f5]" onClick={() => onChange(Math.max(min, value - 1))}>−</button><span className="text-xs font-medium w-6 text-center">{value}</span><button className="w-6 h-6 text-xs border border-[#e5e7eb] rounded flex items-center justify-center hover:bg-[#f4f4f5]" onClick={() => onChange(Math.min(max, value + 1))}>+</button><span className="text-[10px] text-[#a1a1aa]">{label}</span></div>;
}

function ModelSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <>
    <div className="border-t border-[#e5e7eb] my-2" />
    <Field label="Model">
      <Select value={value} onChange={onChange} options={MODEL_OPTIONS} />
      <div className="text-[10px] text-[#a1a1aa] mt-0.5">Faster ↔ Smarter</div>
    </Field>
  </>;
}

const GENERATE_NODES_WITH_QUANTITY = ['linkedin-post', 'twitter-thread', 'twitter-single', 'ig-carousel', 'blog-article', 'newsletter', 'infographic', 'quote-card'];

const CONFIGS: Record<string, (c: Record<string, unknown>, s: (k: string, v: unknown) => void) => React.ReactNode> = {
  'text-source': (c, s) => <>
    <Field label="Prepare (optional)">
      <textarea className="w-full min-h-[80px] text-xs border border-[#e5e7eb] rounded-lg p-2 outline-none focus:border-[#6366f1] resize-y" placeholder="e.g. Extract key arguments only. Remove all anecdotes." value={c.prepare as string ?? ''} onChange={(e) => s('prepare', e.target.value)} />
    </Field>
    {(c.prepare as string)?.trim() ? <ModelSelector value={c.model as string ?? DEFAULT_MODELS['text-source']} onChange={(v) => s('model', v)} /> : <div className="text-[10px] text-[#a1a1aa] italic mt-1">Add a Prepare instruction to enable model selection</div>}
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
  'ig-carousel': (c, s) => <>
    <Field label="Slides"><NumberInput value={c.slides as number ?? 7} onChange={(v) => s('slides', v)} min={5} max={10} /></Field>
    <Field label="Format"><Select value={c.format as string ?? 'Headline + bullets'} onChange={(v) => s('format', v)} options={['Headline + bullets', 'Single bold statement', 'Numbered list', 'Story arc']} /></Field>
    <Field label="Platform"><Select value={c.platform as string ?? 'Instagram'} onChange={(v) => s('platform', v)} options={['Instagram', 'LinkedIn', 'TikTok']} /></Field>
  </>,
  'blog-article': (c, s) => <>
    <Field label="Type"><Select value={c.type as string ?? 'How-to'} onChange={(v) => s('type', v)} options={['How-to', 'Opinion', 'Listicle', 'Deep dive', 'Case study', 'Explainer']} /></Field>
    <Field label="Length"><Select value={c.length as string ?? 'Medium 1000–1500w'} onChange={(v) => s('length', v)} options={['Short 600–800w', 'Medium 1000–1500w', 'Long 2000–2500w']} /></Field>
    <Field label="SEO keyword"><input className="w-full h-8 text-xs border border-[#e5e7eb] rounded-lg px-2 outline-none focus:border-[#6366f1]" value={c.keyword as string ?? ''} onChange={(e) => s('keyword', e.target.value)} placeholder="Optional" /></Field>
    <Field label="Audience"><Select value={c.audience as string ?? 'Intermediate'} onChange={(v) => s('audience', v)} options={['Beginner', 'Intermediate', 'Expert']} /></Field>
  </>,
  'newsletter': (c, s) => <>
    <Field label="Section type"><Select value={c.type as string ?? 'Full issue'} onChange={(v) => s('type', v)} options={['Full issue', 'Feature section', 'TL;DR', 'Deep dive', 'Roundup intro']} /></Field>
    <Field label="Audience"><input className="w-full h-8 text-xs border border-[#e5e7eb] rounded-lg px-2 outline-none focus:border-[#6366f1]" value={c.audience as string ?? ''} onChange={(e) => s('audience', e.target.value)} placeholder="e.g. B2B SaaS founders" /></Field>
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
  </>,
  'refine': () => <></>,
  'export': (c, s) => <>
    <Field label="Formats">
      <div className="flex flex-wrap gap-1">
        {['.txt', '.md', '.docx', '.pdf', '.json', '.zip'].map((f) => {
          const formats = (c.formats as string[]) ?? ['.zip'];
          const active = formats.includes(f);
          return <button key={f} className={`text-[10px] px-2 py-0.5 rounded ${active ? 'bg-[#4f46e5] text-white' : 'bg-[#f4f4f5] text-[#71717a]'}`}
            onClick={() => s('formats', active ? formats.filter((x: string) => x !== f) : [...formats, f])}>{f}</button>;
        })}
      </div>
    </Field>
    <Field label="File prefix"><input className="w-full h-8 text-xs border border-[#e5e7eb] rounded-lg px-2 outline-none focus:border-[#6366f1]" value={c.prefix as string ?? 'content-export'} onChange={(e) => s('prefix', e.target.value)} /></Field>
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

  if (!node) return <aside className="w-[240px] shrink-0 flex items-center justify-center" style={{ background: 'var(--cg-card)', borderLeft: '1px solid var(--cg-border)' }}><span style={{ font: '400 14px/20px var(--font-sans)', color: 'var(--cg-ink-3)' }}>Select a node to configure</span></aside>;

  const def = NODE_DEFS_BY_SUBTYPE[node.data.subtype];
  const colors = BADGE_COLORS[node.data.category];
  const configRenderer = CONFIGS[node.data.subtype];
  const set = (key: string, value: unknown) => { setLocal((p) => ({ ...p, [key]: value })); updateConfig(node.id, { [key]: value }); };
  const hasQuantity = GENERATE_NODES_WITH_QUANTITY.includes(node.data.subtype);
  const hasModel = !!DEFAULT_MODELS[node.data.subtype] && node.data.subtype !== 'text-source' && node.data.subtype !== 'image-prompt';

  return (
    <aside className="w-[240px] shrink-0 overflow-y-auto" style={{ background: 'var(--cg-card)', borderLeft: '1px solid var(--cg-border)' }}>
      <div className="p-4" style={{ borderBottom: '1px solid var(--cg-border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-[26px] h-[26px] rounded-md flex items-center justify-center" style={{ fontSize: 11, fontWeight: 500, fontFamily: 'var(--font-mono)', backgroundColor: colors.bg, color: colors.text }}>{def?.badge}</div>
          <div><div style={{ font: '500 14px/20px var(--font-sans)', color: 'var(--cg-ink)' }}>{node.data.label}</div></div>
        </div>
      </div>
      <div className="p-4 flex flex-col gap-3">
        {hasQuantity && (
          <Field label="Number of outputs">
            <Stepper value={local.quantity as number ?? 1} onChange={(v) => set('quantity', v)} min={1} max={5} label="outputs" />
          </Field>
        )}
        {configRenderer ? configRenderer(local, set) : <span className="text-[11px] text-[#a1a1aa]">No configuration options</span>}
        {hasModel && <ModelSelector value={local.model as string ?? DEFAULT_MODELS[node.data.subtype]} onChange={(v) => set('model', v)} />}
      </div>
      <div className="p-4" style={{ borderTop: '1px solid var(--cg-border)' }}>
        <button className="btn btn-primary w-full" onClick={() => {
          if (!node) return;
          const subtype = node.data.subtype;
          runNode(node.id, async (input, _config) => {
            await new Promise((r) => setTimeout(r, 600 + Math.random() * 600));
            const firstSentence = input.split(/[.!?]\s/)[0]?.trim() || input.slice(0, 100);
            const short = input.slice(0, 150).trim();
            if (subtype === 'refine' || subtype === 'text-source') return input;
            if (subtype === 'twitter-single') return firstSentence.length <= 280 ? firstSentence : firstSentence.slice(0, 277) + '...';
            if (subtype === 'quote-card') {
              const best = input.split(/[.!?]\s/).reduce((a, b) => b.length > a.length ? b : a, '');
              return `QUOTE: "${best.trim()}"\nATTRIBUTION: Source material`;
            }
            const sentences = input.split(/[.!?]\s/).filter(Boolean);
            if (subtype === 'linkedin-post') return `${firstSentence}.\n\nThis is what nobody talks about.\n\n${sentences.slice(1, 4).join('. ') || short}.\n\nWhat's your take? 👇`;
            if (subtype === 'twitter-thread') return sentences.slice(0, 7).map((s, i) => `${i + 1}/ ${s.trim()}`).join('\n\n');
            if (subtype === 'newsletter') return `Subject: ${firstSentence.slice(0, 60)}\n\n${sentences.slice(0, 5).join('. ')}.`;
            if (subtype === 'blog-article') return `# ${firstSentence}\n\n${sentences.slice(1).join('. ')}.`;
            if (subtype === 'image-prompt') return `A cinematic wide-angle photograph of ${firstSentence.toLowerCase()}, golden hour lighting, shallow depth of field, rich color palette, editorial style, 8k resolution`;
            return `[${subtype}]\n\n${short}`;
          });
        }}>▶ Run</button>
      </div>
    </aside>
  );
}
