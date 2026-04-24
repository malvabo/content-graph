import { useEffect, useRef, useState, type MouseEvent as RMouseEvent } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { useGraphLayout } from '../../hooks/useGraphLayout';
import { useNodeExecution } from '../../hooks/useNodeExecution';
import { useExecutionStore } from '../../store/executionStore';
import { useBrandsStore } from '../../store/brandsStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useAutoSaveWorkflow } from '../../hooks/useAutoSaveWorkflow';
import { aiExecute } from '../../utils/aiExecutor';
import BrandSetupModal from '../modals/BrandSetupModal';
import { Menu, MenuItem, MenuSeparator } from '../ui/Menu';
import { saveWorkflow, deleteWorkflow } from '../../utils/workflowApi';

const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="m15 18-6-6 6-6"/>
  </svg>
);

const GearIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const LayoutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
    <rect x="3" y="5" width="7" height="5" rx="1"/><rect x="14" y="5" width="7" height="5" rx="1"/>
    <rect x="3" y="14" width="7" height="5" rx="1"/><rect x="14" y="14" width="7" height="5" rx="1"/>
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
  const brandRowRef = useRef<HTMLDivElement>(null);
  const brandSubRef = useRef<HTMLDivElement>(null);
  const brandCloseTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const openBrandSub = () => { clearTimeout(brandCloseTimer.current); setBrandSubOpen(true); };
  const closeBrandSub = () => { brandCloseTimer.current = setTimeout(() => setBrandSubOpen(false), 200); };
  const onBrandRowLeave = (e: RMouseEvent) => {
    const to = e.relatedTarget as Node | null;
    if (to && brandSubRef.current?.contains(to)) return;
    closeBrandSub();
  };
  const onBrandSubLeave = (e: RMouseEvent) => {
    const to = e.relatedTarget as Node | null;
    if (to && brandRowRef.current?.contains(to)) return;
    closeBrandSub();
  };

  useAutoSaveWorkflow();

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => {
      if (gearRef.current && !gearRef.current.contains(e.target as Node)) {
        setMenuOpen(false); setBrandSubOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  const handleRunAll = () => {
    runAll(async (input, config, subtype, meta) => aiExecute(input, config, subtype, meta));
  };

  const duplicateFlow = async () => {
    const newId = `wf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newName = `${graphName || 'Untitled'} (copy)`;
    try { await saveWorkflow({ id: newId, name: newName, nodes: nodes as any, edges: edges as any, savedAt: new Date().toISOString(), brandId }); } catch { /* ignore */ }
    setMenuOpen(false); onBackToLibrary();
  };

  const deleteFlow = async () => {
    const s = useGraphStore.getState();
    if (!confirm(`Delete "${s.graphName || 'Untitled'}"? This cannot be undone.`)) return;
    if (s.workflowId) { try { await deleteWorkflow(s.workflowId); } catch { /* ignore */ } }
    clearGraph(); setMenuOpen(false); onBackToLibrary();
  };

  const activeBrandLabel = brands.find(b => b.id === brandId)?.kitName || 'Default';
  const Chevron = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 6 6 6-6 6"/></svg>;
  const Dot = ({ on }: { on: boolean }) => <span style={{ width: 8, height: 8, borderRadius: '50%', background: on ? 'var(--color-accent)' : 'var(--color-border-default)' }} />;

  return (
    <>
      {/* Three-column toolbar strip */}
      <div
        className="absolute z-10"
        style={{
          top: 0, left: 0, right: 0, height: 48,
          display: 'flex', alignItems: 'center',
          padding: '0 var(--space-3)',
          background: 'var(--color-bg)',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}
      >
        {/* Left: back */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button
            onClick={onBackToLibrary}
            style={{
              width: 30, height: 30, borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: '1px solid var(--color-border-default)',
              color: 'var(--color-text-tertiary)', cursor: 'pointer',
              transition: 'background 100ms, border-color 100ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; e.currentTarget.style.borderColor = 'var(--color-border-strong)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--color-border-default)'; }}
            aria-label="Back to library"
          >
            <BackIcon />
          </button>
        </div>

        {/* Center: graph name + auto-layout */}
        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, maxWidth: 420, minWidth: 120 }}>
          <input
            aria-label="Graph name"
            className="graph-name-input outline-none"
            style={{
              fontWeight: 500, fontSize: 15, lineHeight: '22px',
              fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)',
              letterSpacing: '-0.01em', background: 'none', border: 'none',
              borderBottom: '1px solid transparent', borderRadius: 0,
              padding: '2px 4px', maxWidth: 280, textAlign: 'center',
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}
            value={graphName}
            placeholder="Untitled"
            onChange={(e) => setGraphName(e.target.value)}
            onFocus={(e) => { e.currentTarget.style.borderBottomColor = 'var(--color-accent)'; }}
            onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
          />
          <button
            className="btn-ghost btn-sm hidden md:inline-flex"
            style={{ gap: 6, border: 'none' }}
            onClick={autoLayout}
          >
            <LayoutIcon />
            Auto-layout
          </button>
        </div>

        {/* Right: actions */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-1)' }}>

          <button
            onClick={handleRunAll}
            disabled={isRunning}
            className={`btn btn-sm btn-run${isRunning ? ' loading' : ''}`}
            style={{ opacity: isRunning ? 0.6 : 1 }}
          >
            ▶ Run
          </button>

          {/* Settings gear */}
          <div ref={gearRef} style={{ position: 'relative' }}>
            <button
              aria-label="Flow settings"
              onClick={() => { setMenuOpen(o => !o); setBrandSubOpen(false); }}
              style={{
                width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--color-text-primary)',
                transition: 'background 100ms, border-color 100ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; e.currentTarget.style.borderColor = 'var(--color-border-strong)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--color-border-default)'; }}
            >
              <GearIcon />
            </button>

            {menuOpen && (
              <Menu style={{ position: 'absolute', top: 36, right: 0, zIndex: 50, minWidth: 220 }}>
                <MenuItem
                  onClick={() => setShowMinimap(!showMinimap)}
                  right={
                    <span style={{ width: 28, height: 16, borderRadius: 9999, background: showMinimap ? 'var(--color-accent)' : 'var(--color-border-default)', position: 'relative', transition: 'background 120ms' }}>
                      <span style={{ position: 'absolute', top: 2, left: showMinimap ? 14 : 2, width: 12, height: 12, borderRadius: '50%', background: 'var(--color-bg-card)', transition: 'left 120ms' }} />
                    </span>
                  }>
                  Show minimap
                </MenuItem>

                {/* Brand submenu */}
                <div ref={brandRowRef} style={{ position: 'relative', width: '100%' }}
                  onMouseEnter={openBrandSub}
                  onMouseLeave={onBrandRowLeave}>
                  <MenuItem
                    right={<>{activeBrandLabel}<Chevron /></>}>
                    Brand
                  </MenuItem>
                  {brandSubOpen && (
                    <Menu ref={brandSubRef} style={{ position: 'absolute', top: 0, right: 'calc(100% + 6px)', zIndex: 51, minWidth: 200 }}
                      onMouseEnter={openBrandSub}
                      onMouseLeave={onBrandSubLeave}>
                      <MenuItem icon={<Dot on={!brandId} />}
                        onClick={() => { setBrandId(null); setBrandSubOpen(false); setMenuOpen(false); }}>
                        Default
                      </MenuItem>
                      {brands.map(b => (
                        <MenuItem key={b.id} icon={<Dot on={brandId === b.id} />}
                          onClick={() => { setBrandId(b.id); setBrandSubOpen(false); setMenuOpen(false); }}>
                          {b.kitName || 'Untitled kit'}
                        </MenuItem>
                      ))}
                      <MenuSeparator />
                      <MenuItem
                        onClick={() => {
                          const id = addBrand({ kitName: `Brand ${brands.length + 1}` });
                          setBrandId(id); setNewBrandId(id);
                          setBrandSubOpen(false); setMenuOpen(false);
                        }}>
                        + New brand…
                      </MenuItem>
                    </Menu>
                  )}
                </div>

                <MenuSeparator />
                <MenuItem onClick={duplicateFlow}>Duplicate flow</MenuItem>
                <MenuItem danger onClick={deleteFlow}>Delete</MenuItem>
              </Menu>
            )}
          </div>
        </div>
      </div>

      {newBrandId && <BrandSetupModal brandId={newBrandId} onClose={() => setNewBrandId(null)} />}
    </>
  );
}
