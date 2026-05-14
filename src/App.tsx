import { ReactFlowProvider } from '@xyflow/react';
import GraphCanvas from './components/canvas/GraphCanvas';
import CanvasToolbar from './components/canvas/CanvasToolbar';
import IconNav from './components/canvas/IconNav';
import VoiceLibrary from './components/canvas/VoiceLibrary';
import ScriptSensePanel from './components/canvas/ScriptSensePanel';
import ScriptLibrary from './components/canvas/ScriptLibrary';
import { useScriptStore } from './store/scriptStore';
import { useCallback, useState, useEffect } from 'react';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Component, type ReactNode } from 'react';
import MobileWorkflow from './components/canvas/MobileWorkflow';
import { useAuthStore } from './store/authStore';
import { useSettingsStore } from './store/settingsStore';
import { useBrandsStore } from './store/brandsStore';
import { useGraphStore, type ContentNode } from './store/graphStore';
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
import OnboardingScreen from './components/OnboardingScreen';
import WorkflowLibraryView from './components/canvas/WorkflowLibrary';
import SettingsPanel from './components/canvas/SettingsPanel';
import CardsPanel from './components/canvas/CardsPanel';
import CardsLibrary from './components/canvas/CardsLibrary';
import InfographicsPanel from './components/canvas/InfographicsPanel';
import MobileBottomBar from './components/mobile/MobileBottomBar';
import MobileLibrary from './components/mobile/MobileLibrary';
import CreateHome from './components/home/CreateHome';
import NotesEmptyScreen from './components/home/NotesEmptyScreen';
import { useIsMobile } from './hooks/useIsMobile';
import TypewriterLogo from './components/TypewriterLogo';
import QuickMode from './components/canvas/QuickMode';

export default function App() {
  return <ErrorBoundary><ReactFlowProvider><AppInner /></ReactFlowProvider></ErrorBoundary>;
}

function AppInner() {
  const { user, loading: authLoading, init, guest } = useAuthStore();
  const isMobile = useIsMobile();
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem('onboarding_complete')
  );
  const [showOnboardingOverlay, setShowOnboardingOverlay] = useState(false);
  const [showPostOnboardingNotes, setShowPostOnboardingNotes] = useState(false);

  const validViews = ['workflow', 'library', 'voice', 'scriptlist', 'scriptsense', 'cardslibrary', 'cards', 'infographics', 'settings', 'intro', 'create', 'capture'];
  const getViewFromHash = () => { const h = window.location.hash.slice(1).split(':')[0]; return validViews.includes(h) ? h : 'create'; };
  const getHashParam = () => { const h = window.location.hash.slice(1); const i = h.indexOf(':'); return i === -1 ? undefined : h.slice(i + 1) || undefined; };
  const [activeView, setActiveViewRaw] = useState(getViewFromHash);
  const [hashParam, setHashParam] = useState(getHashParam);
  const setActiveView = useCallback((v: string) => {
    window.location.hash = v;
    const i = v.indexOf(':');
    setActiveViewRaw(i === -1 ? v : v.slice(0, i));
    setHashParam(i === -1 ? undefined : v.slice(i + 1) || undefined);
  }, []);
  useEffect(() => { const h = () => { setActiveViewRaw(getViewFromHash()); setHashParam(getHashParam()); }; window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [activeScriptId, setActiveScriptId] = useState<string | undefined>(undefined);
  // Track first entry into ScriptSense so we can keep its iframe mounted for
  // the rest of the session (otherwise unmounting on nav blows away draft state,
  // accepted insights, undo stack, etc.).
  const [scriptSenseEverOpened, setScriptSenseEverOpened] = useState(false);
  const [canvasMode, setCanvasMode] = useState<'canvas' | 'quick'>('canvas');
  useEffect(() => { if (activeView === 'scriptsense') setScriptSenseEverOpened(true); }, [activeView]);
  useKeyboardShortcuts();

  useEffect(() => { init(); }, [init]);
  useEffect(() => { if (user) useSettingsStore.getState().load(); }, [user]);

  // 'create' / 'capture' are mobile-only views. If a desktop user lands on
  // those hashes (e.g. shared link), normalize to the workflow library.
  useEffect(() => {
    if (!isMobile && (activeView === 'create' || activeView === 'capture')) {
      setActiveView('library');
    }
  }, [isMobile, activeView, setActiveView]);

  // Mobile is a dark-mode-only experience — force the class on mount/change,
  // and restore the user's stored preference when switching back to desktop.
  useEffect(() => {
    if (isMobile) {
      document.documentElement.classList.add('dark');
    } else {
      const stored = localStorage.getItem('theme-mode');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldDark = stored === 'dark' || ((!stored || stored === 'default') && prefersDark);
      document.documentElement.classList.toggle('dark', shouldDark);
    }
  }, [isMobile]);
  // Register user-uploaded @font-face rules globally — gather every custom
  // font from the legacy settings brand plus every saved library brand so
  // switching brand kits on a flow doesn't unload its fonts.
  const settingsFonts = useSettingsStore(s => s.brand?.customFonts);
  const libraryBrands = useBrandsStore(s => s.brands);
  useEffect(() => {
    const combined: { name: string; dataUrl: string }[] = [];
    const seen = new Set<string>();
    const push = (f?: { name: string; dataUrl: string }) => {
      if (!f?.name || !f.dataUrl || seen.has(f.name)) return;
      seen.add(f.name); combined.push(f);
    };
    (settingsFonts || []).forEach(push);
    libraryBrands.forEach(b => (b.customFonts || []).forEach(push));
    injectCustomFonts(combined);
  }, [settingsFonts, libraryBrands]);
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (session?.user) useSettingsStore.getState().load();
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const TAG_MAP: Record<string, { subtype: string; label: string; badge: string; description: string }> = {
      'Newsletter':     { subtype: 'newsletter',    label: 'Newsletter',    badge: 'Nl', description: '300–500 word digest' },
      'LinkedIn Post':  { subtype: 'linkedin-post', label: 'LinkedIn Post', badge: 'Li', description: '150–300 word hook post' },
      'Twitter Thread': { subtype: 'twitter-thread',label: 'Twitter Thread',badge: 'Tw', description: '5–10 tweet thread' },
      'Twitter Single': { subtype: 'twitter-single',label: 'Twitter Single',badge: 'Ts', description: 'Most quotable insight' },
      'Quote Card':     { subtype: 'quote-card',    label: 'Quote Card',   badge: 'Qc', description: 'Strongest quote' },
      'Infographic':    { subtype: 'infographic',   label: 'Infographic',  badge: 'If', description: 'Structured visual spec' },
      'Video':          { subtype: 'video',         label: 'Video',        badge: 'Vd', description: 'AI video generation' },
    };

    function handleBuildWorkflow(e: MessageEvent) {
      if (!e.data || e.data.type !== 'buildWorkflow') return;
      const { sourceText, prompt, tags } = e.data as { sourceText: string; prompt: string; tags: string[] };
      if (!sourceText && !prompt && (!tags || tags.length === 0)) return;

      const store = useGraphStore.getState();
      store.clearGraph();

      const makeId = (s: string) => `${s}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const nodes: ContentNode[] = [];
      let y = 100;

      if (sourceText) {
        nodes.push({
          id: makeId('text-source'), type: 'contentNode',
          position: { x: 200, y }, deletable: true,
          data: { subtype: 'text-source', label: 'Text', badge: 'Tx', category: 'source',
                  description: 'Paste text, transcript, notes', config: { text: sourceText } },
        });
        y += 320;
      }

      if (prompt) {
        nodes.push({
          id: makeId('prompt'), type: 'contentNode',
          position: { x: 200, y }, deletable: true,
          data: { subtype: 'prompt', label: 'Prompt', badge: 'Pm', category: 'transform',
                  description: 'Topic or focus filter', config: { text: prompt } },
        });
        y += 320;
      }

      const matched = (tags || []).filter(t => TAG_MAP[t]);
      const generateTags = matched.length > 0 ? matched : ['LinkedIn Post'];
      for (const tag of generateTags) {
        const def = TAG_MAP[tag];
        nodes.push({
          id: makeId(def.subtype), type: 'contentNode',
          position: { x: 200, y }, deletable: true,
          data: { subtype: def.subtype, label: def.label, badge: def.badge,
                  category: 'generate', description: def.description, config: {} },
        });
        y += 320;
      }

      store.setNodes(nodes);
      store.setEdges(nodes.slice(1).map((n, i) => ({
        id: `e-${nodes[i].id}-${n.id}`, source: nodes[i].id, target: n.id, type: 'deletable',
      })));
      window.location.hash = 'workflow';
    }

    window.addEventListener('message', handleBuildWorkflow);
    return () => window.removeEventListener('message', handleBuildWorkflow);
  }, []);


  if (showOnboarding) return (
    <OnboardingScreen onFinish={() => {
      localStorage.setItem('onboarding_complete', '1');
      setShowOnboarding(false);
    }} />
  );

  if (authLoading) return (
    <div role="status" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
      <TypewriterLogo />
    </div>
  );

  if (!user && !guest) return <AuthGate />;

  const isNativeWrapper = !!(window as any).webkit?.messageHandlers?.nativeBridge;

  if (isMobile && !isNativeWrapper) {
    return (
      <div className="flex flex-col" style={{ height: '100dvh' }}>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {activeView === 'library' ? (
            <MobileLibrary />
          ) : activeView === 'settings' ? (
            <SettingsPanel />
          ) : (
            <CreateHome onShowOnboarding={() => setShowOnboardingOverlay(true)} />
          )}
          {showOnboardingOverlay && (
            <OnboardingScreen
              onFinish={() => { setShowOnboardingOverlay(false); setShowPostOnboardingNotes(true); }}
              onClose={() => setShowOnboardingOverlay(false)}
            />
          )}
          {showPostOnboardingNotes && (
            <NotesEmptyScreen onClose={() => setShowPostOnboardingNotes(false)} />
          )}
        </div>
        <MobileBottomBar active={activeView} onChange={setActiveView} />
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: '100dvh' }}>
      {guest && !user && (
        <div style={{ background: 'var(--color-warning-bg)', borderBottom: '1px solid var(--color-warning-border)', padding: '6px 16px', fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--color-warning-text)', textAlign: 'center' }}>
          Guest mode — your work won't be saved. <button style={{ background: 'none', border: 'none', textDecoration: 'underline', color: 'inherit', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 }} onClick={() => { useAuthStore.setState({ guest: false }); }}>Sign up to save</button>
        </div>
      )}
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* Hide the left nav in full-screen / detail modes; those views carry their own top back bar. */}
        {activeView !== 'intro' && activeView !== 'workflow' && activeView !== 'cards' && !(activeView === 'infographics' && hashParam) && (
          <IconNav activeView={activeView} onViewChange={setActiveView} />
        )}

        {/* Floating main-content card: rounded, elevated, separated from the
            flush sidebar on the left. */}
        <div className="flex-1 flex flex-col min-h-0" style={{ margin: 8, borderRadius: 8, background: 'var(--color-bg-card)', boxShadow: 'var(--shadow-panel)', border: '1px solid var(--color-border-subtle)', overflow: 'hidden' }}>

        {activeView === 'intro' && (
          <div className="flex-1 overflow-auto">
            <Intro onComplete={() => { setActiveView('library'); }} />
          </div>
        )}

        {activeView === 'workflow' && (
          <>
            <div className="hidden md:flex flex-1 relative flex-col">
              <CanvasToolbar
                onBackToLibrary={() => setActiveView('library')}
                mode={canvasMode}
                onModeChange={setCanvasMode}
              />
              <div className="flex-1 relative" style={{ marginTop: 48 }}>
                {canvasMode === 'quick' ? (
                  <QuickMode />
                ) : (
                  <>
                    <EmptyCanvasOverlay />
                    <GraphCanvas />
                  </>
                )}
              </div>
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

        {activeView === 'scriptlist' && <ScriptLibrary onOpenScript={(id, content) => {
          setActiveScriptId(id);
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
                scriptId={activeScriptId}
                initialText={voiceTranscript}
                onBack={() => setActiveView('scriptlist')}
                onOpenInCards={(id) => setActiveView(id ? 'cards:' + id : 'cardslibrary')}
                onSendToWorkflow={() => setActiveView('workflow')}
                onDelete={() => { if (activeScriptId) useScriptStore.getState().removeScript(activeScriptId); setActiveScriptId(undefined); setActiveView('scriptlist'); }}
              />
            </ViewErrorBoundary>
          </div>
        )}


        {activeView === 'settings' && <SettingsPanel />}

        {activeView === 'cardslibrary' && <CardsLibrary onOpen={(id: string) => { setActiveView('cards:' + id); }} />}

        {activeView === 'cards' && <CardsPanel key={hashParam} setId={hashParam} onBack={() => setActiveView('cardslibrary')} />}

        {activeView === 'infographics' && (
          <InfographicsPanel
            key={hashParam}
            initialEditId={hashParam}
            // On exit from the editor, clear the :id hash fragment so the library
            // view re-renders and the left nav reappears.
            onExitEditor={() => setActiveView('infographics')}
          />
        )}
        </div>
      </div>
    </div>
  );
}
