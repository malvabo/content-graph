import { ReactFlowProvider } from '@xyflow/react';
import GraphCanvas from './components/canvas/GraphCanvas';
import CanvasToolbar from './components/canvas/CanvasToolbar';
import NodePalette from './components/canvas/NodePalette';
import IconNav from './components/canvas/IconNav';
import VoicePanel from './components/canvas/VoicePanel';
import { useGraphStore, type ContentNode } from './store/graphStore';
import { useCallback, useState } from 'react';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
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
  useKeyboardShortcuts();

  const handleTranscript = useCallback((text: string) => {
    const node: ContentNode = {
      id: `text-source-${Date.now()}`,
      type: 'contentNode',
      position: { x: 100, y: 100 },
      deletable: true,
      data: { subtype: 'text-source', label: 'Text', badge: 'Tx', category: 'source', description: 'Raw content, transcript, notes', config: { text } },
    };
    addNode(node);
    setActiveView('workflow');
  }, [addNode]);

  return (
    <div className="h-screen flex flex-col" style={{ colorScheme: 'light' }}>
      <CanvasToolbar />
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

        {activeView === 'chat' && (
          <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--cg-canvas)' }}>
            <span style={{ font: '400 14px/20px var(--font-sans)', color: 'var(--cg-ink-3)' }}>Chat — coming soon</span>
          </div>
        )}

        {activeView === 'recents' && (
          <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--cg-canvas)' }}>
            <span style={{ font: '400 14px/20px var(--font-sans)', color: 'var(--cg-ink-3)' }}>Recents — coming soon</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  if (isMobile) return <MobileBlock />;
  return <ReactFlowProvider><AppInner /></ReactFlowProvider>;
}
