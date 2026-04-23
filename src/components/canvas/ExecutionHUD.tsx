import { Panel } from '@xyflow/react';
import { useExecutionStore } from '../../store/executionStore';
import { useGraphStore } from '../../store/graphStore';
import { useNodeExecution } from '../../hooks/useNodeExecution';
import { aiExecute } from '../../utils/aiExecutor';

export default function ExecutionHUD() {
  const status = useExecutionStore(s => s.status);
  const runAllActive = useExecutionStore(s => s.runAllActive);
  const nodes = useGraphStore(s => s.nodes);
  const { runAll, cancelAll } = useNodeExecution();

  const generateNodes = nodes.filter(n => n.data.category !== 'source');
  if (generateNodes.length === 0) return null;

  const total = generateNodes.length;
  const done = generateNodes.filter(n => status[n.id] === 'complete').length;
  const errors = generateNodes.filter(n => status[n.id] === 'error').length;
  const running = generateNodes.filter(n => status[n.id] === 'running').length;
  const stale = generateNodes.filter(n => status[n.id] === 'stale').length;

  const isActive = runAllActive || running > 0;
  const allDone = done === total && total > 0;
  const hasErrors = errors > 0;

  if (!isActive && !allDone && !hasErrors && stale === 0) return null;

  const label = isActive
    ? `Running ${running > 0 ? running : '…'} node${running !== 1 ? 's' : ''}`
    : hasErrors
    ? `${errors} error${errors !== 1 ? 's' : ''}`
    : allDone
    ? 'Complete'
    : stale > 0
    ? `${stale} stale`
    : null;

  if (!label) return null;

  const accent = hasErrors ? 'var(--color-danger)' : isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)';

  return (
    <Panel position="top-center" style={{ pointerEvents: 'none' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--color-bg-card)',
          border: `1px solid ${hasErrors ? 'var(--color-danger-border)' : 'var(--color-border-default)'}`,
          borderRadius: 'var(--radius-full)',
          padding: '5px 12px 5px 10px',
          boxShadow: 'var(--shadow-sm)',
          pointerEvents: 'auto',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Segmented bar */}
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {generateNodes.map(n => {
            const s = status[n.id] ?? 'idle';
            const color = s === 'complete'
              ? 'var(--color-accent)'
              : s === 'error'
              ? 'var(--color-danger)'
              : s === 'running'
              ? 'var(--color-accent)'
              : s === 'stale'
              ? 'var(--color-warning-border)'
              : 'var(--color-border-default)';
            return (
              <div key={n.id} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: color,
                opacity: s === 'running' ? undefined : s === 'idle' ? 0.4 : 1,
                transition: 'background 300ms',
                animation: s === 'running' ? 'hudPulse 1.2s ease-in-out infinite' : 'none',
              }} />
            );
          })}
        </div>

        {/* Status text */}
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: accent, whiteSpace: 'nowrap' }}>
          {label}
        </span>

        {/* Stop button when running */}
        {isActive && (
          <button
            onClick={() => cancelAll()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 18, height: 18, borderRadius: 'var(--radius-sm)',
              background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="var(--color-text-secondary)"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
          </button>
        )}

        {/* Re-run button when done or has errors */}
        {!isActive && (allDone || hasErrors) && (
          <button
            onClick={() => runAll(async (input, config, subtype, meta) => aiExecute(input, config, subtype, meta))}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 18, height: 18, borderRadius: 'var(--radius-sm)',
              background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="var(--color-text-secondary)"><path d="M5 3l14 9-14 9V3z"/></svg>
          </button>
        )}
      </div>

      <style>{`
        @keyframes hudPulse {
          0%, 100% { opacity: 0.5; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </Panel>
  );
}
