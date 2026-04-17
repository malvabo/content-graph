import { ReactFlowProvider } from '@xyflow/react';
import GraphCanvas from './components/canvas/GraphCanvas';
import CanvasToolbar from './components/canvas/CanvasToolbar';
import NodePalette from './components/canvas/NodePalette';
import IconNav from './components/canvas/IconNav';
import VoiceLibrary from './components/canvas/VoiceLibrary';
import ScriptSensePanel from './components/canvas/ScriptSensePanel';
import { useGraphStore, type ContentNode } from './store/graphStore';
import { useCallback, useState, useEffect } from 'react';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Component, type ReactNode } from 'react';
import type { NodeDef } from './utils/nodeDefs';
import MobileWorkflow from './components/canvas/MobileWorkflow';
import { useAuthStore } from './store/authStore';
import { useSettingsStore } from './store/settingsStore';
import { supabase } from './lib/supabase';
import AuthGate from './components/auth/AuthGate';

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
import SettingsPanel from './components/canvas/SettingsPanel';

export default function App() {
  return <ErrorBoundary><ReactFlowProvider><AppInner /></ReactFlowProvider></ErrorBoundary>;
}

function AppInner() {
  const { user, loading: authLoading, init, guest } = useAuthStore();
  const addNode = useGraphStore((s) => s.addNode);
  const [activeView, setActiveView] = useState('workflow');
  const [voiceTranscript] = useState('');
  useKeyboardShortcuts();

  useEffect(() => { init(); }, [init]);
  useEffect(() => { if (user) useSettingsStore.getState().load(); }, [user]);
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (session?.user) useSettingsStore.getState().load();
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleAddNode = useCallback((def: NodeDef) => {
    const node: ContentNode = {
      id: `${def.subtype}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      type: 'contentNode',
      position: { x: 200 + Math.random() * 200, y: 150 + Math.random() * 200 },
      deletable: true,
      data: { subtype: def.subtype, label: def.label, badge: def.badge, category: def.category, description: def.description, config: {} },
    };
    addNode(node);
  }, [addNode]);

  if (authLoading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
      <div className="skeleton-bar" style={{ width: 48, height: 48, borderRadius: 'var(--radius-lg)' }} />
    </div>
  );

  if (!user && !guest) return <AuthGate />;

  return (
    <div className="flex flex-col" style={{ height: '100dvh' }}>
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {activeView !== 'intro' && <IconNav activeView={activeView} onViewChange={setActiveView} />}

        {activeView === 'intro' && (
          <div className="flex-1 overflow-auto">
            <Intro onComplete={() => { setActiveView('library'); }} />
          </div>
        )}

        {activeView === 'workflow' && (
          <>
            <div className="hidden md:flex flex-1 relative">
              <CanvasToolbar onBackToLibrary={() => setActiveView('library')} />
              <EmptyCanvasOverlay />
              <GraphCanvas />
              <NodePalette onAddNode={handleAddNode} />
            </div>
            <div className="flex md:hidden flex-1 min-h-0">
              <MobileWorkflow onBackToLibrary={() => setActiveView('library')} />
            </div>
          </>
        )}

        {activeView === 'library' && <WorkflowLibraryView onOpen={() => setActiveView('workflow')} />}

        {activeView === 'voice' && <VoiceLibrary onUseInWorkflow={() => setActiveView('workflow')} />}

        {activeView === 'scriptsense' && <ScriptSensePanel initialText={voiceTranscript} />}

        {activeView === 'settings' && <SettingsPanel />}
      </div>
    </div>
  );
}
