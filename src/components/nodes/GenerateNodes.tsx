import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { useGraphStore } from '../../store/graphStore';
import { aiExecute } from '../../utils/aiExecutor';
import { getUpstreamText } from '../../hooks/useNodeExecution';
import ContentModal from '../modals/ContentModal';
import { DEFAULT_MODELS, MODEL_OPTIONS } from '../../utils/nodeDefs';

const SKELETON_LINES: Record<string, number[]> = {
  'linkedin-post': [100, 95, 88, 100, 92, 78, 100, 85, 95, 60],
  'twitter-thread': [100, 90, 95, 85, 100, 88, 92, 75],
  'twitter-single': [100, 95, 70],
  'newsletter': [100, 95, 88, 100, 92, 85, 100, 78, 95, 88, 60],
  'quote-card': [100, 95, 88, 70],
  'infographic': [100, 90, 95, 85, 100, 88, 92, 80],
  'image-prompt': [100, 95, 88, 100, 92, 75],
  'video': [100, 95, 88, 100, 92, 85, 78],
  'refine': [100, 95, 88, 100, 92, 85, 60],
};

function Skeleton({ subtype }: { subtype: string }) {
  const lines = SKELETON_LINES[subtype] ?? [100, 95, 88, 100, 92, 85, 78];
  return (
    <div className="flex flex-col gap-2 mt-2" role="status" aria-label="Loading">
      {lines.map((w, i) => <div key={i} className="h-2.5 rounded-sm skeleton-bar" style={{ width: `${w}%`, animationDelay: `${i * 0.1}s` }} />)}
    </div>
  );
}

function OutputPreview({ id, subtype, expandOpen, onExpand, onExpandClose }: { id: string; subtype: string; expandOpen?: boolean; onExpand?: () => void; onExpandClose?: () => void }) {
  const text = useOutputStore((s) => s.outputs[id]?.text);
  const label = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.data.label ?? subtype);
  const rerun = () => {
    const node = useGraphStore.getState().nodes.find(n => n.id === id);
    if (!node) return;
    const { text: input, inputCount } = getUpstreamText(id);
    useExecutionStore.getState().setStatus(id, 'running');
    aiExecute(input, node.data.config as Record<string, unknown>, subtype, { inputCount })
      .then(result => { useOutputStore.getState().setOutput(id, { text: result }); useExecutionStore.getState().setStatus(id, 'complete'); })
      .catch(err => { useExecutionStore.getState().setError(id, err instanceof Error ? err.message : 'Regeneration failed'); });
  };
  if (!text) return null;

  const isThread = subtype === 'twitter-thread';
  const tweets = isThread ? text.split(/\n\n+/).filter((s: string) => s.trim()).map((s: string) => s.replace(/^\d+\/\s*/, '')) : [];

  const openModal = () => onExpand?.();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, marginTop: 'var(--space-2)' }}>
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', cursor: 'pointer' }} onMouseDown={e => e.stopPropagation()} onClick={openModal}>
        {isThread ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {tweets.slice(0, 2).map((t, i) => (
              <div key={i} style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px' }}>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)', flex: 1 }}>Tweet {i + 1}</span>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-disabled)' }}>{t.length}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--color-border-subtle)', padding: '4px 8px' }}>
                  <span style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-snug)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>{t}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontWeight: 'var(--weight-normal)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-normal)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>
            {text}
          </div>
        )}
        <div onMouseDown={e => e.stopPropagation()} onClick={openModal}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 48, background: 'linear-gradient(transparent, var(--color-bg-card))', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 2, cursor: 'pointer' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', letterSpacing: '0.01em' }}>···</span>
        </div>
      </div>
      {expandOpen && <ContentModal subtype={subtype} title={label} text={text} onClose={() => onExpandClose?.()} onRegenerate={rerun} onSave={(t: string) => useOutputStore.getState().setOutput(id, { text: t })} />}
    </div>
  );
}

export function GenerateNodeInline({ id, subtype, expandOpen, onExpand, onExpandClose }: { id: string; subtype: string; expandOpen?: boolean; onExpand?: () => void; onExpandClose?: () => void }) {
  const status = useExecutionStore((s) => s.status[id] ?? 'idle');

  if (status === 'idle' || status === 'stale') return null;
  if (status === 'running') return <Skeleton subtype={subtype} />;
  if (status === 'complete') return <OutputPreview id={id} subtype={subtype} expandOpen={expandOpen} onExpand={onExpand} onExpandClose={onExpandClose} />;
  if (status === 'warning') return <div style={{ fontWeight: 'var(--weight-normal)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-snug)', fontFamily: 'var(--font-sans)', color: 'var(--color-warning-text)', background: 'var(--color-warning-bg)', padding: 'var(--space-2) var(--space-2)', borderRadius: 'var(--radius-sm)' }} className="mt-2">⚠ No input</div>;
  return null;
}

/* Compact label + native select */
function IS({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 10, color: 'var(--color-text-disabled)', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</span>
      <select
        className="nowheel"
        value={value}
        onChange={e => onChange(e.target.value)}
        onMouseDown={e => e.stopPropagation()}
        style={{ flex: 1, fontSize: 11, height: 22, border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', padding: '0 4px', cursor: 'pointer', minWidth: 0 }}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

const CONFIG_DEFS: Record<string, { key: string; label: string; options: readonly string[] }[]> = {
  'linkedin-post': [
    { key: 'goal',   label: 'Goal',   options: ['Thought leadership', 'Promote product', 'Personal story', 'Case study', 'Hiring'] },
    { key: 'tone',   label: 'Tone',   options: ['Authoritative', 'Conversational', 'Vulnerable', 'Data-driven', 'Contrarian'] },
    { key: 'length', label: 'Length', options: ['Short ~150w', 'Medium ~280w', 'Long ~450w'] },
    { key: 'hook',   label: 'Hook',   options: ['Bold claim', 'Question', 'Statistic', 'Story', 'Contrarian'] },
  ],
  'twitter-thread': [
    { key: 'style', label: 'Style', options: ['Educational', 'Storytelling', 'Hot take', 'Data-driven', 'How-to'] },
    { key: 'tone',  label: 'Tone',  options: ['Analytical', 'Personal', 'Educational', 'Provocative'] },
  ],
  'twitter-single': [
    { key: 'angle', label: 'Angle', options: ['Most quotable insight', 'Strongest stat', 'Contrarian take', 'Call to action'] },
  ],
  'newsletter': [
    { key: 'type',     label: 'Type',     options: ['Full issue', 'Feature section', 'TL;DR', 'Deep dive', 'Roundup intro'] },
    { key: 'audience', label: 'Audience', options: ['General', 'Developers', 'Executives', 'Marketers', 'Investors'] },
  ],
  'infographic': [
    { key: 'type',  label: 'Type',  options: ['Process', 'Statistical', 'Comparison', 'Timeline', 'Listicle', 'Anatomy'] },
    { key: 'style', label: 'Style', options: ['Corporate', 'Playful', 'Minimal', 'Bold'] },
  ],
  'quote-card': [
    { key: 'format', label: 'Format', options: ['Single quote', 'Multiple options'] },
  ],
  'brand-voice': [
    { key: 'strength', label: 'Strength', options: ['Light touch', 'Moderate', 'Full rewrite'] },
  ],
};

const MODEL_NODES = new Set(['linkedin-post', 'twitter-thread', 'twitter-single', 'newsletter', 'infographic', 'quote-card', 'brand-voice', 'refine', 'prompt']);

export function NodeInlineConfig({ id, subtype }: { id: string; subtype: string }) {
  const config = useGraphStore(s => s.nodes.find(n => n.id === id)?.data.config);
  const updateConfig = useGraphStore(s => s.updateNodeConfig);

  const defs = CONFIG_DEFS[subtype] ?? [];
  const showModel = MODEL_NODES.has(subtype);
  if (!defs.length && !showModel) return null;

  const model = (config?.model as string) ?? DEFAULT_MODELS[subtype] ?? 'claude-opus-4';
  const useGrid = defs.length >= 3;

  return (
    <div className="nowheel" style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid var(--color-border-subtle)', marginTop: 8 }}
      onMouseDown={e => e.stopPropagation()}>
      {defs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: useGrid ? '1fr 1fr' : `repeat(${Math.min(defs.length, 2)}, 1fr)`, gap: 4 }}>
          {defs.map(({ key, label, options }) => (
            <IS key={key} label={label} value={(config?.[key] as string) ?? options[0]} options={options} onChange={v => updateConfig(id, { [key]: v })} />
          ))}
        </div>
      )}
      {showModel && (
        <IS label="Model" value={model} options={MODEL_OPTIONS} onChange={v => updateConfig(id, { model: v })} />
      )}
    </div>
  );
}
