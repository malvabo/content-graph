import { ReactFlowProvider } from '@xyflow/react';
import GraphCanvas from './components/canvas/GraphCanvas';
import CanvasToolbar from './components/canvas/CanvasToolbar';
import NodePalette from './components/canvas/NodePalette';
import IconNav from './components/canvas/IconNav';
import VoicePanel from './components/canvas/VoicePanel';
import ScriptSensePanel from './components/canvas/ScriptSensePanel';
import { useGraphStore, type ContentNode } from './store/graphStore';
import { useCallback, useState } from 'react';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Component, type ReactNode } from 'react';
import type { NodeDef } from './utils/nodeDefs';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; btnHover: boolean }> {
  state = { error: null as Error | null, btnHover: false };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)' }}>
        <div style={{ fontSize: 'var(--text-md)', fontWeight: 500 }}>Something went wrong</div>
        <div style={{ fontSize: 'var(--text-sm)', maxWidth: 400, textAlign: 'center' }}>{this.state.error.message}</div>
        <button onMouseEnter={() => this.setState({ btnHover: true })} onMouseLeave={() => this.setState({ btnHover: false })} onClick={() => { localStorage.removeItem('content-graph-store'); window.location.reload(); }} style={{ marginTop: 'var(--space-2)', padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)', background: this.state.btnHover ? 'var(--color-bg-card-hover, #f5f5f4)' : 'var(--color-bg-card)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>Clear data &amp; reload</button>
      </div>
    );
    return this.props.children;
  }
}
import EmptyCanvasOverlay from './components/canvas/EmptyCanvasOverlay';
import Intro from './components/Intro';
import WorkflowLibraryView from './components/canvas/WorkflowLibrary';

const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

function MobileBlock() {
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: 'var(--space-8)' }}>
      up200 requires a desktop browser.
    </div>
  );
}

function AppInner() {
  const addNode = useGraphStore((s) => s.addNode);
  const [activeView, setActiveView] = useState('workflow');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  useKeyboardShortcuts();

  const handleTranscript = useCallback((text: string) => {
    setVoiceTranscript(text);
    setActiveView('scriptsense');
  }, []);

  const handleAddNode = useCallback((def: NodeDef) => {
    const node: ContentNode = {
      id: `${def.subtype}-${Date.now()}`,
      type: 'contentNode',
      position: { x: 200 + Math.random() * 200, y: 150 + Math.random() * 200 },
      deletable: true,
      data: { subtype: def.subtype, label: def.label, badge: def.badge, category: def.category, description: def.description, config: {} },
    };
    addNode(node);
  }, [addNode]);

  return (
    <div className="h-screen flex flex-col" style={{ colorScheme: 'light' }}>
      <div className="flex flex-1 overflow-hidden">
        {activeView !== 'intro' && <IconNav activeView={activeView} onViewChange={setActiveView} />}

        {activeView === 'intro' && (
          <div className="flex-1 overflow-auto">
            <Intro onComplete={() => {
              const s = useGraphStore.getState();
              s.setNodes([]);
              s.setEdges([]);
              s.setGraphName('');
              setActiveView('workflow');
            }} />
          </div>
        )}

        {activeView === 'workflow' && (
          <div className="flex-1 relative">
            <CanvasToolbar onBackToLibrary={() => setActiveView('library')} />
            <EmptyCanvasOverlay />
            <GraphCanvas />
            <NodePalette onAddNode={handleAddNode} />
          </div>
        )}

        {activeView === 'library' && <WorkflowLibraryView onOpen={() => setActiveView('workflow')} />}

        {activeView === 'voice' && <VoicePanel onTranscriptReady={handleTranscript} />}

        {activeView === 'scriptsense' && <ScriptSensePanel initialText={voiceTranscript} />}
      </div>
    </div>
  );
}

export default function App() {
  if (isMobile) return <MobileBlock />;
  return <ErrorBoundary><ReactFlowProvider><AppInner /></ReactFlowProvider></ErrorBoundary>;
}
