import { useGraphStore } from '../../store/graphStore';
import { useGraphLayout } from '../../hooks/useGraphLayout';
import { useNodeExecution } from '../../hooks/useNodeExecution';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { exportGraph } from '../../utils/templates';
import { mockExecute } from '../../utils/mockExecutor';

export default function CanvasToolbar({ activeView }: { activeView: string }) {
  const { graphName, setGraphName, clearGraph, nodes, edges } = useGraphStore();
  const { autoLayout } = useGraphLayout();
  const { runAll } = useNodeExecution();
  const isRunning = useExecutionStore((s) => Object.values(s.status).some((v) => v === 'running'));

  const handleRunAll = () => {
    runAll(async (input, _config, subtype) => {
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 600));
      return mockExecute(input, subtype);
    });
  };

  return (
    <div className="h-11 shrink-0 flex items-center px-4 gap-3" style={{ background: 'var(--cg-card)', borderBottom: '1px solid var(--cg-border)' }}>
      <span style={{ font: '500 15px/20px var(--font-mono)', color: 'var(--cg-green)', letterSpacing: '-.02em', userSelect: 'none' }}>up200</span>
      <div className="h-4 w-px" style={{ background: 'var(--cg-border)' }} />
      <input
        style={{ font: '500 14px/20px var(--font-sans)', color: 'var(--cg-ink)', letterSpacing: '-.01em' }}
        className="bg-transparent border-none outline-none w-48"
        value={graphName}
        onChange={(e) => setGraphName(e.target.value)}
      />
      <div className="h-4 w-px" style={{ background: 'var(--cg-border)' }} />
      {activeView === 'workflow' && <>
        <button className="btn-ghost btn-sm" onClick={autoLayout}>Auto-layout</button>
        <button className="btn-ghost btn-sm" onClick={() => { if (nodes.length === 0 || confirm('Clear all nodes?')) { clearGraph(); useExecutionStore.getState().resetAll(); useOutputStore.getState().clearAll(); } }}>Clear</button>
        <button className="btn-ghost btn-sm" onClick={() => exportGraph(nodes, edges, graphName)}>Export</button>
      </>}
      <div className="flex-1" />
      {activeView === 'workflow' && <button className={`btn btn-primary ${isRunning ? 'loading' : ''}`} disabled={isRunning} onClick={handleRunAll}>▶ Run All</button>}
    </div>
  );
}
