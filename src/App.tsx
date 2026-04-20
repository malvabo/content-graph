import { ReactFlowProvider } from '@xyflow/react';
import GraphCanvas from './components/canvas/GraphCanvas';
import CanvasToolbar from './components/canvas/CanvasToolbar';
import IconNav from './components/canvas/IconNav';
import VoiceLibrary from './components/canvas/VoiceLibrary';
import ScriptSensePanel from './components/canvas/ScriptSensePanel';
import ScriptLibrary from './components/canvas/ScriptLibrary';
import ScriptEditor from './components/canvas/ScriptEditor';
import { useCallback, useState, useEffect } from 'react';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Component, type ReactNode } from 'react';
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
        <button onMouseEnter={() => this.setState({ btnHover: true })} onMouseLeave={() => this.setState({ btnHover: false })} onClick={() => { localStorage.removeItem('content-graph-store'); window.location.reload(); }} style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)', background: this.state.btnHover ? 'var(--color-bg-card-hover, #f5f5f4)' : 'var(--color-bg-card)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>Clear data &amp; reload</button>
      </div>
    );
    return this.props.children;
  }
}
import EmptyCanvasOverlay from './components/canvas/EmptyCanvasOverlay';
import Intro from './components/Intro';
import WorkflowLibraryView from './components/canvas/WorkflowLibrary';
import SettingsPanel from './components/canvas/SettingsPanel';
import CardsPanel from './components/canvas/CardsPanel';
import InfographicsPanel from './components/canvas/InfographicsPanel';

export default function App() {
  return <ErrorBoundary><ReactFlowProvider><AppInner /></ReactFlowProvider></ErrorBoundary>;
}

function AppInner() {
  const { user, loading: authLoading, init, guest } = useAuthStore();
  
  const validViews = ['workflow', 'library', 'voice', 'scriptsense', 'scriptview', 'scripteditor', 'cards', 'infographics', 'settings', 'intro'];
  const getViewFromHash = () => { const h = window.location.hash.slice(1); return validViews.includes(h) ? h : 'library'; };
  const [activeView, setActiveViewRaw] = useState(getViewFromHash);
  const setActiveView = useCallback((v: string) => { window.location.hash = v; setActiveViewRaw(v); }, []);
  useEffect(() => { const h = () => setActiveViewRaw(getViewFromHash()); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [editScriptId, setEditScriptId] = useState('');
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


  if (authLoading) return (
    <div role="status" aria-label="Loading" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
      <div className="skeleton-bar" style={{ width: 48, height: 48, borderRadius: 'var(--radius-lg)' }} />
    </div>
  );

  if (!user && !guest) return <AuthGate />;

  return (
    <div className="flex flex-col" style={{ height: '100dvh' }}>
      {guest && !user && (
        <div style={{ background: 'var(--color-warning-bg)', borderBottom: '1px solid var(--color-warning-border)', padding: '6px 16px', fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--color-warning-text)', textAlign: 'center' }}>
          Guest mode — your work won't be saved. <button style={{ background: 'none', border: 'none', textDecoration: 'underline', color: 'inherit', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 }} onClick={() => { useAuthStore.setState({ guest: false }); }}>Sign up to save</button>
        </div>
      )}
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
            </div>
            <div className="flex md:hidden flex-1 min-h-0">
              <MobileWorkflow onBackToLibrary={() => setActiveView('library')} />
            </div>
          </>
        )}

        {activeView === 'library' && <WorkflowLibraryView onOpen={() => setActiveView('workflow')} />}

        {activeView === 'voice' && <VoiceLibrary onUseInWorkflow={() => setActiveView('workflow')} onSendToScript={(t) => { setVoiceTranscript(t); setActiveView('scriptsense'); }} />}

        {activeView === 'scriptsense' && <ScriptSensePanel initialText={voiceTranscript} />}

        {activeView === 'scriptview' && <ScriptLibrary onOpenScript={(id) => { setEditScriptId(id); setActiveView('scripteditor'); }} />}

        {activeView === 'scripteditor' && editScriptId && <ScriptEditor scriptId={editScriptId} onBack={() => setActiveView('scriptview')} />}

        {activeView === 'settings' && <SettingsPanel />}

        {activeView === 'cards' && <CardsPanel />}

        {activeView === 'infographics' && <InfographicsPanel />}
      </div>
    </div>
  );
}
