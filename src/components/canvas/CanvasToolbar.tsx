import { useState } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { useGraphLayout } from '../../hooks/useGraphLayout';
import { useNodeExecution } from '../../hooks/useNodeExecution';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { aiExecute } from '../../utils/aiExecutor';

import { saveWorkflow } from '../../utils/workflowApi';

export default function CanvasToolbar({ onBackToLibrary }: { onBackToLibrary: () => void }) {
  const { graphName, setGraphName, clearGraph, nodes } = useGraphStore();
  const { autoLayout } = useGraphLayout();
  const { runAll } = useNodeExecution();
  const isRunning = useExecutionStore((s) => Object.values(s.status).some((v) => v === 'running'));
  const [confirmClear, setConfirmClear] = useState(false);
  const [published, setPublished] = useState(false);

  const handleRunAll = () => {
    runAll(async (input, config, subtype) => {
      return aiExecute(input, config, subtype);
    });
  };

  return (
    <>
      {/* Top-left: back + inline name */}
      <div className="absolute top-2 left-2 md:top-3 md:left-3 z-10 flex items-center gap-2">
        <button onClick={onBackToLibrary} className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--color-bg-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-tertiary)', transition: 'background 150ms' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-interactive-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-bg-card)'; }}
          aria-label="Back to library">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <input
          aria-label="Graph name"
          className="graph-name-input outline-none"
          style={{ fontWeight: 500, fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-fixed)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', letterSpacing: '-.01em', background: 'none', border: 'none', borderBottom: '1px solid transparent', borderRadius: 0, padding: '2px 0' }}
          value={graphName}
          placeholder="Untitled"
          onChange={(e) => setGraphName(e.target.value)}
        />
      </div>

      {/* Top-right: floating action buttons */}
      <div className="absolute top-2 right-2 md:top-3 md:right-3 z-10 flex items-center gap-1 md:gap-1.5">
        <button className="btn-ghost btn-sm hidden md:inline-flex" style={{ borderRadius: 'var(--radius-md)' }} onClick={autoLayout}>Auto-layout</button>
          {confirmClear ? (
            <span className="hidden md:contents">
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>Clear all?</span>
              <button className="btn-ghost btn-sm" style={{ borderRadius: 'var(--radius-md)', color: 'var(--color-danger)' }} onClick={() => { clearGraph(); useExecutionStore.getState().resetAll(); useOutputStore.getState().clearAll(); setConfirmClear(false); }}>Yes</button>
              <button className="btn-ghost btn-sm" style={{ borderRadius: 'var(--radius-md)' }} onClick={() => setConfirmClear(false)}>No</button>
            </span>
          ) : (
            <button className="btn-ghost btn-sm hidden md:inline-flex" style={{ borderRadius: 'var(--radius-md)' }} onClick={() => { if (nodes.length === 0) { clearGraph(); } else { setConfirmClear(true); } }}>Clear</button>
          )}
        <button className={`btn btn-run ${isRunning ? 'loading' : ''}`} disabled={isRunning} onClick={handleRunAll}>▶ Run All</button>
        <button className="btn btn-outline" disabled={nodes.length === 0 || published} onClick={async () => {
          const s = useGraphStore.getState();
          const id = s.workflowId || `wf-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
          s.setWorkflowId(id);
          try { await saveWorkflow({ id, name: s.graphName || 'Untitled', nodes: s.nodes as any, edges: s.edges as any, savedAt: new Date().toISOString() }); } catch { /* handled */ }
          setPublished(true); setTimeout(() => setPublished(false), 2000);
        }}>{published ? '✓ Published' : 'Publish'}</button>
      </div>

      {/* Publish notification */}
      {published && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          background: 'var(--color-bg-card)', border: '1px solid var(--color-accent)',
          borderRadius: 'var(--radius-lg)', padding: 'var(--space-3) var(--space-5)',
          boxShadow: 'var(--shadow-lg)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
          color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          animation: 'fadeIn 150ms ease',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
          Workflow published successfully
        </div>
      )}
    </>
  );
}
