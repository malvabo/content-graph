import { ReactFlowProvider } from '@xyflow/react';
import GraphCanvas from './components/canvas/GraphCanvas';
import CanvasToolbar from './components/canvas/CanvasToolbar';
import NodePalette from './components/canvas/NodePalette';
import { useGraphStore, type ContentNode } from './store/graphStore';
import { useCallback, useRef } from 'react';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import ConfigPanel from './components/canvas/ConfigPanel';
import EmptyCanvasOverlay from './components/canvas/EmptyCanvasOverlay';
import type { NodeDef } from './utils/nodeDefs';

// Platform lock — must be outside component to avoid hook ordering issues
const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

function MobileBlock() {
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', fontSize: '15px', color: '#6b7280', textAlign: 'center', padding: '32px' }}>
      ContentGraph requires a desktop browser.
    </div>
  );
}

function AppInner() {
  const addNode = useGraphStore((s) => s.addNode);
  const wrapperRef = useRef<HTMLDivElement>(null);
  useKeyboardShortcuts();

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/content-graph-node');
    if (!raw) return;
    const def: NodeDef = JSON.parse(raw);
    const bounds = wrapperRef.current?.getBoundingClientRect();
    const node: ContentNode = {
      id: `${def.subtype}-${Date.now()}`,
      type: 'contentNode',
      position: { x: e.clientX - (bounds?.left ?? 0) - 120, y: e.clientY - (bounds?.top ?? 0) - 40 },
      deletable: true,
      data: { subtype: def.subtype, label: def.label, badge: def.badge, category: def.category, description: def.description, config: {} },
    };
    addNode(node);
  }, [addNode]);

  return (
    <ReactFlowProvider>
      <div className="h-screen flex flex-col" style={{ colorScheme: 'light' }}>
        <CanvasToolbar />
        <div className="flex flex-1 overflow-hidden">
          <NodePalette />
          <div ref={wrapperRef} className="flex-1 relative" onDragOver={onDragOver} onDrop={onDrop}>
            <EmptyCanvasOverlay />
            <GraphCanvas />
          </div>
          <ConfigPanel />
        </div>
      </div>
    </ReactFlowProvider>
  );
}

export default function App() {
  if (isMobile) return <MobileBlock />;
  return <AppInner />;
}
