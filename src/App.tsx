import { ReactFlowProvider } from '@xyflow/react';
import GraphCanvas from './components/canvas/GraphCanvas';
import CanvasToolbar from './components/canvas/CanvasToolbar';
import IconNav from './components/canvas/IconNav';
import VoiceLibrary from './components/canvas/VoiceLibrary';
import ScriptSensePanel from './components/canvas/ScriptSensePanel';
import ScriptLibrary from './components/canvas/ScriptLibrary';
import { useCallback, useState, useEffect } from 'react';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Component, type ReactNode } from 'react';
import MobileWorkflow from './components/canvas/MobileWorkflow';
import { useAuthStore } from './store/authStore';
import { useSettingsStore } from './store/settingsStore';
import { supabase } from './lib/supabase';
import { injectCustomFonts } from './utils/customFonts';
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

class ViewErrorBoundary extends Component<{ children: ReactNode; label: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', fontFamily: 'var(--font-sans)', padding: 'var(--space-6)' }}>
        <div style={{ fontSize: 'var(--text-md)', fontWeight: 500, color: 'var(--color-text-primary)' }}>{this.props.label} failed to load</div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', maxWidth: 400, textAlign: 'center' }}>{this.state.error.message}</div>
        <button onClick={() => this.setState({ error: null })} className="btn btn-primary" style={{ marginTop: 'var(--space-2)' }}>Retry</button>
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
import CardsLibrary from './components/canvas/CardsLibrary';
import InfographicsPanel from './components/canvas/InfographicsPanel';

export default function App() {
  return <ErrorBoundary><ReactFlowProvider><AppInner /></ReactFlowProvider></ErrorBoundary>;
}

function AppInner() {
  const { user, loading: authLoading, init, guest } = useAuthStore();
  
  const validViews = ['workflow', 'library', 'voice', 'scriptlist', 'scriptsense', 'cardslibrary', 'cards', 'infographics', 'settings', 'intro'];
  const getViewFromHash = () => { const h = window.location.hash.slice(1).split(':')[0]; return validViews.includes(h) ? h : 'library'; };
  const getHashParam = () => window.location.hash.slice(1).split(':')[1] || undefined;
  const [activeView, setActiveViewRaw] = useState(getViewFromHash);
  const [hashParam, setHashParam] = useState(getHashParam);
  const setActiveView = useCallback((v: string) => { window.location.hash = v; setActiveViewRaw(v.split(':')[0]); setHashParam(v.split(':')[1]); }, []);
  useEffect(() => { const h = () => { setActiveViewRaw(getViewFromHash()); setHashParam(getHashParam()); }; window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  // Track first entry into ScriptSense so we can keep its iframe mounted for
  // the rest of the session (otherwise unmounting on nav blows away draft state,
  // accepted insights, undo stack, etc.).
  const [scriptSenseEverOpened, setScriptSenseEverOpened] = useState(false);
  useEffect(() => { if (activeView === 'scriptsense') setScriptSenseEverOpened(true); }, [activeView]);
  useKeyboardShortcuts();

  useEffect(() => { init(); }, [init]);
  useEffect(() => { if (user) useSettingsStore.getState().load(); }, [user]);
  // Register user-uploaded @font-face rules globally so they work
  // everywhere the brand fonts are referenced (infographics, SVG previews, etc).
  const customFonts = useSettingsStore(s => s.brand?.customFonts);
  useEffect(() => { injectCustomFonts(customFonts || []); }, [customFonts]);
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

        {activeView === 'voice' && <VoiceLibrary onUseInWorkflow={() => setActiveView('workflow')} onSendToScript={(t) => {
          // ScriptSensePanel buffers non-empty initialText into a ref and blanks
          // it after flushing to the iframe, so clearing here is safe and
          // prevents this transcript from re-firing on later unrelated renders.
          setVoiceTranscript(t);
          setActiveView('scriptsense');
          setVoiceTranscript('');
        }} />}

        {activeView === 'scriptlist' && <ScriptLibrary onOpenScript={(content) => {
          setVoiceTranscript(content);
          setActiveView('scriptsense');
          setVoiceTranscript('');
        }} />}

        {/* ScriptSense stays mounted once opened so iframe state (draft, insights,
            accepted changes) survives navigation. Hidden via display:none when
            the user is on a different view. */}
        {scriptSenseEverOpened && (
          <div style={{ flex: activeView === 'scriptsense' ? 1 : '0 0 0', minHeight: 0, display: activeView === 'scriptsense' ? 'flex' : 'none' }}>
            <ViewErrorBoundary label="ScriptSense">
              <ScriptSensePanel
                initialText={voiceTranscript}
                onOpenInCards={() => setActiveView('cardslibrary')}
                onSendToWorkflow={() => setActiveView('workflow')}
                onDelete={() => setActiveView('scriptlist')}
              />
            </ViewErrorBoundary>
          </div>
        )}


        {activeView === 'settings' && <SettingsPanel />}

        {activeView === 'cardslibrary' && <CardsLibrary onOpen={(id: string) => { setActiveView('cards:' + id); }} />}

        {activeView === 'cards' && <CardsPanel key={hashParam} setId={hashParam} />}

        {activeView === 'infographics' && <InfographicsPanel key={hashParam} initialEditId={hashParam} />}
      </div>
    </div>
  );
}
