import { useRef } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { useGraphLayout } from '../../hooks/useGraphLayout';
import { useNodeExecution } from '../../hooks/useNodeExecution';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { mockExecute } from '../../utils/mockExecutor';
import WorkflowLibrary from './WorkflowLibrary';

export default function CanvasToolbar({ activeView }: { activeView: string }) {
  const { graphName, setGraphName, clearGraph, nodes, edges, setNodes, setEdges } = useGraphStore();
  const { autoLayout } = useGraphLayout();
  const { runAll } = useNodeExecution();
  const isRunning = useExecutionStore((s) => Object.values(s.status).some((v) => v === 'running'));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRunAll = () => {
    runAll(async (input, _config, subtype) => {
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 600));
      return mockExecute(input, subtype);
    });
  };

  const handleExport = () => {
    const data = JSON.stringify({ nodes, edges, graphName }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${graphName.replace(/\s+/g, '-').toLowerCase() || 'workflow'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { nodes: n, edges: ed, graphName: gn } = JSON.parse(reader.result as string);
        if (n) setNodes(n);
        if (ed) setEdges(ed);
        if (gn) setGraphName(gn);
      } catch { alert('Invalid workflow JSON file.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="absolute top-0 left-0 right-0 h-11 flex items-center px-4 gap-2 z-10" style={{ background: 'var(--color-overlay-light)', backdropFilter: 'blur(12px)' }}>
      <input
        aria-label="Graph name"
        style={{ fontWeight: 500, fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-fixed)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', letterSpacing: '-.01em' }}
        className="bg-transparent border-none outline-none min-w-0 flex-1 max-w-[200px]"
        value={graphName}
        onChange={(e) => setGraphName(e.target.value)}
      />
      <div className="flex-1" />
      {activeView === 'workflow' && (
        <div className="flex items-center gap-1.5">
          <button className="btn-ghost btn-sm" style={{ borderRadius: 10 }} onClick={handleExport}>Export</button>
          <button className="btn-ghost btn-sm" style={{ borderRadius: 10 }} onClick={() => fileInputRef.current?.click()}>Import</button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          <WorkflowLibrary />
          <button className="btn-ghost btn-sm" style={{ borderRadius: 10 }} onClick={autoLayout}>Auto-layout</button>
          <button className="btn-ghost btn-sm" style={{ borderRadius: 10 }} onClick={() => { if (nodes.length === 0 || confirm('Clear all nodes?')) { clearGraph(); useExecutionStore.getState().resetAll(); useOutputStore.getState().clearAll(); } }}>Clear</button>
          <button className={`btn btn-run ${isRunning ? 'loading' : ''}`} disabled={isRunning} onClick={handleRunAll}>▶ Run All</button>
        </div>
      )}
    </div>
  );
}
