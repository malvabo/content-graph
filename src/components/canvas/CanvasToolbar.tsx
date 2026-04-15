import { useState } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { useGraphLayout } from '../../hooks/useGraphLayout';
import { useNodeExecution } from '../../hooks/useNodeExecution';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { mockExecute } from '../../utils/mockExecutor';

export default function CanvasToolbar({ onBackToLibrary }: { onBackToLibrary: () => void }) {
  const { graphName, setGraphName, clearGraph, nodes } = useGraphStore();
  const { autoLayout } = useGraphLayout();
  const { runAll } = useNodeExecution();
  const isRunning = useExecutionStore((s) => Object.values(s.status).some((v) => v === 'running'));
  const [confirmClear, setConfirmClear] = useState(false);

  const handleRunAll = () => {
    runAll(async (input, _config, subtype) => {
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 600));
      return mockExecute(input, subtype);
    });
  };

  return (
    <>
      {/* Top-left: back + inline name */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <button onClick={onBackToLibrary} className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.06)', color: 'var(--color-text-tertiary)', transition: 'background 150ms' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.9)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.7)'; }}
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
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        <button className="btn-ghost btn-sm" style={{ borderRadius: 10, background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)' }} onClick={autoLayout}>Auto-layout</button>
          {confirmClear ? (
            <>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>Clear all?</span>
              <button className="btn-ghost btn-sm" style={{ borderRadius: 10, color: 'var(--color-danger)' }} onClick={() => { clearGraph(); useExecutionStore.getState().resetAll(); useOutputStore.getState().clearAll(); setConfirmClear(false); }}>Yes</button>
              <button className="btn-ghost btn-sm" style={{ borderRadius: 10 }} onClick={() => setConfirmClear(false)}>No</button>
            </>
          ) : (
            <button className="btn-ghost btn-sm" style={{ borderRadius: 10, background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)' }} onClick={() => { if (nodes.length === 0) { clearGraph(); } else { setConfirmClear(true); } }}>Clear</button>
          )}
        <button className={`btn btn-run ${isRunning ? 'loading' : ''}`} disabled={isRunning} onClick={handleRunAll}>▶ Run All</button>
      </div>
    </>
  );
}
