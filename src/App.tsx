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

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: 'system-ui', color: '#57534e' }}>
        <div style={{ fontSize: 15, fontWeight: 500 }}>Something went wrong</div>
        <div style={{ fontSize: 13, maxWidth: 400, textAlign: 'center' }}>{this.state.error.message}</div>
        <button onClick={() => { this.setState({ error: null }); window.location.reload(); }} style={{ marginTop: 8, padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 14 }}>Reload</button>
      </div>
    );
    return this.props.children;
  }
}
import ConfigPanel from './components/canvas/ConfigPanel';
import EmptyCanvasOverlay from './components/canvas/EmptyCanvasOverlay';

const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

function MobileBlock() {
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', fontSize: '15px', color: '#6b7280', textAlign: 'center', padding: '32px' }}>
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
    // Create a text-source node on the canvas
    const node: ContentNode = {
      id: `text-source-${Date.now()}`,
      type: 'contentNode',
      position: { x: 100, y: 100 },
      deletable: true,
      data: { subtype: 'text-source', label: 'Text', badge: 'Tx', category: 'source', description: 'Raw content, transcript, notes', config: { text } },
    };
    addNode(node);
    // Also send to ScriptSense
    setVoiceTranscript(text);
    setActiveView('scriptsense');
  }, [addNode]);

  return (
    <div className="h-screen flex flex-col" style={{ colorScheme: 'light' }}>
      <CanvasToolbar activeView={activeView} />
      <div className="flex flex-1 overflow-hidden">
        <IconNav activeView={activeView} onViewChange={setActiveView} />

        {activeView === 'workflow' && (
          <>
            <NodePalette />
            <div className="flex-1 relative">
              <EmptyCanvasOverlay />
              <GraphCanvas />
            </div>
            <ConfigPanel />
          </>
        )}

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
