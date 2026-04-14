import { useGraphStore } from '../../store/graphStore';
import { useGraphLayout } from '../../hooks/useGraphLayout';
import { useNodeExecution } from '../../hooks/useNodeExecution';
import { exportGraph } from '../../utils/templates';

export default function CanvasToolbar() {
  const { graphName, setGraphName, clearGraph, nodes, edges } = useGraphStore();
  const { autoLayout } = useGraphLayout();
  const { runAll } = useNodeExecution();

  const handleRunAll = () => {
    runAll(async (input, config, subtype) => {
      // If VITE_ANTHROPIC_API_KEY is set, real streaming would happen via useClaudeStream.
      // For now, simulate a delay + mock output so the UI flow is visible.
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));
      return `[${subtype}] Generated output for: "${input.slice(0, 80)}..."`;
    });
  };

  return (
    <div className="h-11 shrink-0 flex items-center px-4 gap-3" style={{ background: 'var(--cg-card)', borderBottom: '1px solid var(--cg-border)' }}>
      <input
        style={{ font: '500 14px/20px var(--font-sans)', color: 'var(--cg-ink)', letterSpacing: '-.01em' }}
        className="bg-transparent border-none outline-none w-48"
        value={graphName}
        onChange={(e) => setGraphName(e.target.value)}
      />
      <div className="h-4 w-px" style={{ background: 'var(--cg-border)' }} />
      <button className="btn-ghost btn-sm" onClick={autoLayout}>Auto-layout</button>
      <button className="btn-ghost btn-sm" onClick={clearGraph}>Clear</button>
      <button className="btn-ghost btn-sm" onClick={() => exportGraph(nodes, edges, graphName)}>Export</button>
      <div className="flex-1" />
      <button className="btn btn-primary" onClick={handleRunAll}>▶ Run All</button>
    </div>
  );
}
