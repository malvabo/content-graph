import { useEffect, useRef, useState } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { useGraphLayout } from '../../hooks/useGraphLayout';
import { useNodeExecution } from '../../hooks/useNodeExecution';
import { useExecutionStore } from '../../store/executionStore';
import { useBrandsStore } from '../../store/brandsStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useAutoSaveWorkflow } from '../../hooks/useAutoSaveWorkflow';
import { aiExecute } from '../../utils/aiExecutor';
import BrandSetupModal from '../modals/BrandSetupModal';

import { saveWorkflow, deleteWorkflow } from '../../utils/workflowApi';

const GearIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

export default function CanvasToolbar({ onBackToLibrary }: { onBackToLibrary: () => void }) {
  const { graphName, setGraphName, clearGraph, nodes, edges } = useGraphStore();
  const brandId = useGraphStore(s => s.brandId);
  const setBrandId = useGraphStore(s => s.setBrandId);
  const brands = useBrandsStore(s => s.brands);
  const addBrand = useBrandsStore(s => s.addBrand);
  const showMinimap = useSettingsStore(s => s.showMinimap);
  const setShowMinimap = useSettingsStore(s => s.setShowMinimap);
  const { autoLayout } = useGraphLayout();
  const { runAll } = useNodeExecution();
  const isRunning = useExecutionStore((s) => Object.values(s.status).some((v) => v === 'running'));
  const [newBrandId, setNewBrandId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [brandSubOpen, setBrandSubOpen] = useState(false);
  const gearRef = useRef<HTMLDivElement>(null);

  // Auto-save the flow on every meaningful change — no manual Publish step.
  useAutoSaveWorkflow();

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => { if (gearRef.current && !gearRef.current.contains(e.target as Node)) { setMenuOpen(false); setBrandSubOpen(false); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  const handleRunAll = () => {
    runAll(async (input, config, subtype, meta) => {
      return aiExecute(input, config, subtype, meta);
    });
  };

  const duplicateFlow = async () => {
    const newId = `wf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newName = `${graphName || 'Untitled'} (copy)`;
    try {
      await saveWorkflow({ id: newId, name: newName, nodes: nodes as any, edges: edges as any, savedAt: new Date().toISOString(), brandId });
    } catch { /* ignore */ }
    setMenuOpen(false);
    onBackToLibrary();
  };

  const deleteFlow = async () => {
    const s = useGraphStore.getState();
    if (!confirm(`Delete "${s.graphName || 'Untitled'}"? This cannot be undone.`)) return;
    if (s.workflowId) { try { await deleteWorkflow(s.workflowId); } catch { /* ignore */ } }
    clearGraph();
    setMenuOpen(false);
    onBackToLibrary();
  };

  const menuItemStyle: React.CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', background: 'none', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', textAlign: 'left' };
  const activeBrandLabel = brands.find(b => b.id === brandId)?.kitName || 'Default';

  return (
    <>
      {/* Top-left: back + inline name */}
      <div className="absolute top-2 left-2 md:top-3 md:left-3 z-10 flex items-center gap-2">
        <button onClick={onBackToLibrary} className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--color-bg-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-tertiary)', transition: 'background 150ms' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-interactive-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-bg-card)'; }}
          aria-label="Back to library">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <input
          aria-label="Graph name"
          className="graph-name-input outline-none"
          style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-fixed)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', letterSpacing: '-.01em', background: 'none', border: 'none', borderBottom: '1px solid transparent', borderRadius: 0, padding: '2px 0', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}
          value={graphName}
          placeholder="Untitled"
          onChange={(e) => setGraphName(e.target.value)}
          onFocus={(e) => { e.currentTarget.style.borderBottomColor = 'var(--color-accent)'; }}
          onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
        />
      </div>

      {/* Top-right: Auto-layout + Run + Settings */}
      <div className="absolute top-2 right-2 md:top-3 md:right-3 z-10 flex items-center gap-1 md:gap-1.5">
        <button className="btn-ghost btn-sm hidden md:inline-flex" style={{ borderRadius: 'var(--radius-md)' }} onClick={autoLayout}>Auto-layout</button>

        {/* Run — primary button with stroke */}
        <button
          onClick={handleRunAll}
          disabled={isRunning}
          className={isRunning ? 'loading' : ''}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', height: 32,
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-accent)',
            color: 'var(--color-text-inverse)',
            border: '1px solid var(--color-accent)',
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)',
            cursor: isRunning ? 'default' : 'pointer',
            opacity: isRunning ? 0.7 : 1,
          }}>
          ▶ Run nodes
        </button>

        {/* Settings gear popover */}
        <div ref={gearRef} style={{ position: 'relative' }}>
          <button aria-label="Flow settings"
            onClick={() => { setMenuOpen(o => !o); setBrandSubOpen(false); }}
            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--color-text-primary)' }}>
            <GearIcon />
          </button>

          {menuOpen && (
            <div style={{ position: 'absolute', top: 36, right: 0, zIndex: 50, background: 'var(--color-bg-popover)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', padding: 'var(--space-2)', minWidth: 220 }}>
              {/* Minimap toggle */}
              <button style={menuItemStyle}
                onClick={() => setShowMinimap(!showMinimap)}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                <span>Show minimap</span>
                <span style={{ width: 28, height: 16, borderRadius: 9999, background: showMinimap ? 'var(--color-accent)' : 'var(--color-border-default)', position: 'relative', transition: 'background 120ms' }}>
                  <span style={{ position: 'absolute', top: 2, left: showMinimap ? 14 : 2, width: 12, height: 12, borderRadius: '50%', background: 'var(--color-bg-card)', transition: 'left 120ms' }} />
                </span>
              </button>

              {/* Brand submenu — opens to the left */}
              <div style={{ position: 'relative' }}
                onMouseEnter={() => setBrandSubOpen(true)}
                onMouseLeave={() => setBrandSubOpen(false)}>
                <button style={menuItemStyle}
                  onClick={() => setBrandSubOpen(o => !o)}>
                  <span>Brand</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>
                    {activeBrandLabel}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
                  </span>
                </button>
                {brandSubOpen && (
                  <div style={{ position: 'absolute', top: 0, right: 'calc(100% + 6px)', zIndex: 51, background: 'var(--color-bg-popover)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', padding: 'var(--space-2)', minWidth: 200 }}>
                    <button style={{ ...menuItemStyle, justifyContent: 'flex-start', gap: 'var(--space-2)' }}
                      onClick={() => { setBrandId(null); setBrandSubOpen(false); setMenuOpen(false); }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: !brandId ? 'var(--color-accent)' : 'var(--color-border-default)' }} />
                      Default
                    </button>
                    {brands.map(b => (
                      <button key={b.id} style={{ ...menuItemStyle, justifyContent: 'flex-start', gap: 'var(--space-2)' }}
                        onClick={() => { setBrandId(b.id); setBrandSubOpen(false); setMenuOpen(false); }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: brandId === b.id ? 'var(--color-accent)' : 'var(--color-border-default)' }} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.kitName || 'Untitled kit'}</span>
                      </button>
                    ))}
                    <div style={{ height: 1, background: 'var(--color-border-subtle)', margin: 'var(--space-1) 0' }} />
                    <button style={{ ...menuItemStyle, justifyContent: 'flex-start', gap: 'var(--space-2)', color: 'var(--color-text-secondary)' }}
                      onClick={() => {
                        const id = addBrand({ kitName: `Brand ${brands.length + 1}` });
                        setBrandId(id);
                        setNewBrandId(id);
                        setBrandSubOpen(false);
                        setMenuOpen(false);
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                      + New brand…
                    </button>
                  </div>
                )}
              </div>

              <div style={{ height: 1, background: 'var(--color-border-subtle)', margin: 'var(--space-1) 0' }} />

              <button style={menuItemStyle}
                onClick={duplicateFlow}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                Duplicate flow
              </button>

              <button style={{ ...menuItemStyle, color: 'var(--color-danger-text)' }}
                onClick={deleteFlow}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-danger-bg)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {newBrandId && <BrandSetupModal brandId={newBrandId} onClose={() => setNewBrandId(null)} />}
    </>
  );
}
