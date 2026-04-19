import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useGraphStore, type ContentNode } from '../../store/graphStore';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { useNodeExecution } from '../../hooks/useNodeExecution';
import { aiExecute } from '../../utils/aiExecutor';
import { NODE_DEFS_BY_SUBTYPE, BADGE_COLORS } from '../../utils/nodeDefs';
import { NODE_ICONS } from '../../utils/nodeIcons';
import ContentModal from '../modals/ContentModal';
import MobileNodePicker from './MobileNodePicker';
import type { NodeDef } from '../../utils/nodeDefs';

/* ── Detail sheet for nodes without output ── */
function MobileNodeDetail({ node, onClose }: { node: ContentNode; onClose: () => void }) {
  const config = useGraphStore(s => s.nodes.find(n => n.id === node.id)?.data.config ?? {});
  const updateConfig = useGraphStore(s => s.updateNodeConfig);
  const status = useExecutionStore(s => s.status[node.id] ?? 'idle');
  const colors = BADGE_COLORS[node.data.category];
  const def = NODE_DEFS_BY_SUBTYPE[node.data.subtype];
  const set = (k: string, v: unknown) => updateConfig(node.id, { [k]: v });

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--color-overlay-backdrop)' }} />
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" style={{
        position: 'relative', background: 'var(--color-bg-card)',
        borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
        maxHeight: '92vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-3) 0 var(--space-2)' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-border-default)' }} />
        </div>
        <div style={{ padding: '0 var(--space-4) var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: colors.bg, color: colors.text, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {NODE_ICONS[node.data.subtype]?.() ?? node.data.badge}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: 'var(--text-md)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>{node.data.label}</div>
            <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>{def?.description ?? node.data.category}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', borderRadius: 'var(--radius-md)', color: 'var(--color-text-tertiary)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-3) var(--space-4) var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {node.data.subtype === 'text-source' && (
            <>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Input text</div>
              <textarea placeholder="Paste your article, transcript, or notes…" value={(config.text as string) ?? ''} onChange={e => { set('text', e.target.value); useOutputStore.getState().setOutput(node.id, { text: e.target.value }); }}
                className="form-textarea" style={{ minHeight: 280, flex: 1, fontSize: 16 }} />
            </>
          )}
          {status === 'idle' && node.data.category === 'generate' && (
            <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)' }}>
              No output yet — run the workflow to generate content.
            </div>
          )}
          {status === 'running' && (
            <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)' }}>
              Generating…
            </div>
          )}
          {Object.entries(config).filter(([k, v]) => k !== 'text' && typeof v === 'string' && v.length < 60).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)' }}>
              <span style={{ color: 'var(--color-text-tertiary)', textTransform: 'capitalize' }}>{k.replace(/([A-Z])/g, ' $1')}</span>
              <span style={{ color: 'var(--color-text-primary)' }}>{v as string}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

function ConfigSummary({ config }: { config: Record<string, unknown> }) {
  const vals = Object.values(config).filter(v => typeof v === 'string' && v.length < 30) as string[];
  if (!vals.length) return null;
  return (
    <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', marginTop: 'var(--space-2)' }}>
      {vals.slice(0, 3).map((v, i) => (
        <span key={i} style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)', background: 'var(--color-bg-surface)', padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-full)' }}>{v}</span>
      ))}
    </div>
  );
}

function MobileNodeCard({ node, onExpand, onDelete }: { node: ContentNode; onExpand: () => void; onDelete: () => void }) {
  const status = useExecutionStore(s => s.status[node.id] ?? 'idle');
  const error = useExecutionStore(s => s.errors[node.id]);
  const output = useOutputStore(s => s.outputs[node.id]?.text);
  const colors = BADGE_COLORS[node.data.category];
  const [swipeX, setSwipeX] = useState(0);
  const [startX, setStartX] = useState(0);

  const onTouchStart = (e: React.TouchEvent) => setStartX(e.touches[0].clientX);
  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startX;
    setSwipeX(Math.min(0, Math.max(-80, dx)));
  };
  const onTouchEnd = () => {
    if (swipeX < -40) setSwipeX(-80);
    else setSwipeX(0);
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
      {/* Delete reveal */}
      <div onClick={onDelete} style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 80,
        background: 'var(--color-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--color-text-inverse)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500,
        borderRadius: '0 var(--radius-lg) var(--radius-lg) 0',
      }}>Delete</div>

      {/* Card */}
      <div
        onClick={() => swipeX === 0 && onExpand()}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        style={{
          position: 'relative', zIndex: 1,
          transform: `translateX(${swipeX}px)`, transition: swipeX === 0 || swipeX === -80 ? 'transform 200ms ease' : 'none',
          background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)',
          minHeight: 44,
        }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-md)', background: colors.bg, color: colors.text, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {NODE_ICONS[node.data.subtype]?.() ?? node.data.badge}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.data.label}</div>
          </div>
          {status === 'running' && <div className="skeleton-bar" style={{ width: 16, height: 16, borderRadius: '50%' }} />}
          {status === 'complete' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>}
          {status === 'error' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>}
          {status === 'warning' && <span style={{ fontSize: 14 }}>⚠</span>}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-disabled)" strokeWidth="1.5" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>

        {/* Config chips */}
        <ConfigSummary config={node.data.config} />

        {/* Error message */}
        {status === 'error' && error && (
          <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', lineHeight: 1.4, fontFamily: 'var(--font-sans)', color: 'var(--color-danger-text)', background: 'var(--color-danger-bg)', padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}>
            {error}
          </div>
        )}
        {status === 'warning' && (
          <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', lineHeight: 1.4, fontFamily: 'var(--font-sans)', color: 'var(--color-warning-text)', background: 'var(--color-warning-bg)', padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}>
            No input — connect a source node above
          </div>
        )}

        {/* Output preview */}
        {output && (
          <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', lineHeight: 'var(--leading-snug)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {output}
          </div>
        )}
      </div>
    </div>
  );
}

function ConnectionLine({ fromId, toId }: { fromId: string; toId: string }) {
  const running = useExecutionStore(s => s.status[fromId] === 'running' || s.status[toId] === 'running');
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0' }}>
      <div style={{
        width: 2, height: 24, borderRadius: 1, overflow: 'hidden',
        background: running ? 'transparent' : 'var(--color-border-default)',
      }}>
        {running && (
          <div style={{
            width: '100%', height: '200%',
            background: 'linear-gradient(to bottom, transparent 0%, var(--color-accent) 30%, var(--color-accent) 50%, transparent 100%)',
            animation: 'flow-down 0.8s ease-in-out infinite',
          }} />
        )}
      </div>
    </div>
  );
}

export default function MobileWorkflow({ onBackToLibrary }: { onBackToLibrary: () => void }) {
  const { nodes, graphName, setGraphName, addNode, removeNode } = useGraphStore();
  const { runAll } = useNodeExecution();
  const isRunning = useExecutionStore(s => Object.values(s.status).some(v => v === 'running'));
  const [expandId, setExpandId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);

  const handleRunAll = useCallback(() => {
    runAll(async (input, config, subtype) => {
      return aiExecute(input, config, subtype);
    });
  }, [runAll]);

  const handleAddNode = useCallback((def: NodeDef) => {
    const node: ContentNode = {
      id: `${def.subtype}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'contentNode',
      position: { x: 0, y: 0 },
      deletable: true,
      data: { subtype: def.subtype, label: def.label, badge: def.badge, category: def.category, description: def.description, config: {} },
    };
    addNode(node);
    // Auto-connect to the last node in the list
    const { nodes: current, edges: currentEdges } = useGraphStore.getState();
    const prev = current[current.length - 2]; // node before the one we just added
    if (prev) {
      const edge = { id: `e-${prev.id}-${node.id}`, source: prev.id, target: node.id, type: 'deletable' };
      useGraphStore.getState().setEdges([...currentEdges, edge]);
    }
    setPickerOpen(false);
  }, [addNode]);

  const handleDelete = useCallback((id: string) => {
    removeNode(id);
    useExecutionStore.getState().resetNode(id);
    useOutputStore.getState().clearNode(id);
  }, [removeNode]);

  const expandNode = nodes.find(n => n.id === expandId);
  const expandOutput = useOutputStore(s => expandId ? s.outputs[expandId]?.text : undefined);

  // Sort: sources → transforms → generates → outputs
  const order: Record<string, number> = { source: 0, transform: 1, generate: 2, output: 3 };
  const sorted = [...nodes].sort((a, b) => (order[a.data.category] ?? 9) - (order[b.data.category] ?? 9));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
      {/* Sticky header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border-subtle)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={onBackToLibrary} aria-label="Back to library" style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: 'var(--color-text-tertiary)', borderRadius: 'var(--radius-md)', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        {editingName ? (
          <input autoFocus value={graphName} onChange={e => setGraphName(e.target.value)} onBlur={() => setEditingName(false)} onKeyDown={e => { if (e.key === 'Enter') setEditingName(false); }}
            style={{ flex: 1, fontWeight: 500, fontSize: 16, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', background: 'none', border: 'none', outline: 'none', padding: 0 }} />
        ) : (
          <div onClick={() => setEditingName(true)} style={{ flex: 1, fontWeight: 500, fontSize: 'var(--text-md)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{graphName || 'Untitled'}</div>
        )}
        <button disabled={isRunning || nodes.length === 0} onClick={handleRunAll}
          style={{ height: 44, padding: '0 var(--space-4)', borderRadius: 'var(--radius-lg)', background: 'var(--color-interactive-default)', border: '1px solid var(--color-border-default)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)', flexShrink: 0, opacity: nodes.length === 0 ? 0.4 : 1 }}>
          {isRunning ? '⏳' : '▶'} Run
        </button>
      </div>

      {/* Node list */}
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-4)', WebkitOverflowScrolling: 'touch' }}>
        {sorted.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 'var(--space-3)' }}>
            <div style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>No nodes yet</div>
            <button onClick={() => setPickerOpen(true)} style={{ height: 44, padding: '0 var(--space-5)', borderRadius: 'var(--radius-lg)', background: 'var(--color-interactive-default)', border: '1px solid var(--color-border-default)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)' }}>
              + Add first node
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sorted.map((node, i) => (
              <div key={node.id}>
                {i > 0 && <ConnectionLine fromId={sorted[i - 1].id} toId={node.id} />}
                <MobileNodeCard node={node} onExpand={() => setExpandId(node.id)} onDelete={() => handleDelete(node.id)} />
              </div>
            ))}

            {/* Add node button */}
            <div style={{ marginTop: 'var(--space-3)' }}>
              <button onClick={() => setPickerOpen(true)}
                style={{ width: '100%', height: 48, borderRadius: 'var(--radius-lg)', border: '1px dashed var(--color-border-default)', background: 'none', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-1)' }}>
                + Add node
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Expand modal */}
      {expandNode && expandOutput && (
        <ContentModal
          subtype={expandNode.data.subtype}
          title={expandNode.data.label}
          text={expandOutput}
          onClose={() => setExpandId(null)}
        />
      )}
      {expandNode && !expandOutput && (
        <MobileNodeDetail node={expandNode} onClose={() => setExpandId(null)} />
      )}

      {/* Node picker bottom sheet */}
      {pickerOpen && <MobileNodePicker onAdd={handleAddNode} onClose={() => setPickerOpen(false)} />}
    </div>
  );
}
