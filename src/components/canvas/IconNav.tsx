import { type ReactNode, useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';

interface Props {
  activeView: string;
  onViewChange: (view: string) => void;
}

/* ── Mobile: icon-only bottom bar. Desktop: 200px sidebar with labels ── */

function NavItem({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} aria-label={label}
      className="nav-item"
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '8px 12px', borderRadius: 8, background: active ? 'var(--color-bg-surface)' : hover ? 'var(--color-bg-surface)' : 'transparent', color: active ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', transition: 'background 100ms', justifyContent: 'flex-start', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, flexShrink: 0 }}>{icon}</span>
      <span className="nav-label" style={{ fontSize: 14, fontWeight: active ? 500 : 400, whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}

const WorkflowIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 17h7"/><path d="M17.5 14v7"/></svg>;
const VoiceIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>;
const ScriptIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 12l-2 2 2 2"/><path d="M14 12l2 2-2 2"/></svg>;
const CardsIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="8" height="8" rx="1.5"/><rect x="14" y="3" width="8" height="8" rx="1.5"/><rect x="2" y="13" width="8" height="8" rx="1.5"/><rect x="14" y="13" width="8" height="8" rx="1.5"/></svg>;
const InfographicsIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 5 4-9"/></svg>;
const SunIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>;
const MoonIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>;
const SettingsIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;

function DarkModeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem('dark-mode') === 'true');
  const [hover, setHover] = useState(false);
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('dark-mode', String(dark)); }, [dark]);
  return (
    <button onClick={() => setDark(!dark)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      aria-label={dark ? 'Light mode' : 'Dark mode'}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 8, background: hover ? 'var(--color-bg-surface)' : 'transparent', color: 'var(--color-text-tertiary)', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function UserMenu() {
  const { user, signOut } = useAuthStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, [open]);
  if (!user) return null;
  const initial = (user.email?.[0] ?? '?').toUpperCase();
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-border-strong)', color: 'var(--color-text-primary)', fontSize: 'var(--text-xs)', fontWeight: 500, fontFamily: 'var(--font-sans)', border: 'none', cursor: 'pointer' }}>{initial}</button>
      {open && (
        <div className="absolute z-50 dropdown-fade" style={{ bottom: '100%', marginBottom: 8, left: 0, background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', padding: 'var(--space-2)', minWidth: 160 }}>
          <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)', padding: 'var(--space-1) var(--space-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
          <button onClick={() => { signOut(); setOpen(false); }} style={{ width: '100%', textAlign: 'left', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-sm)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 'var(--space-1)' }}>Sign out</button>
        </div>
      )}
    </div>
  );
}

export default function IconNav({ activeView, onViewChange }: Props) {
  return (
    <>
      <style>{`
        @media (max-width: 767px) {
          .icon-nav { width: 100% !important; height: 52px !important; flex-direction: row !important; padding: 0 8px !important; gap: 0 !important; order: 99 !important; border-right: none !important; border-top: 1px solid var(--color-border-subtle) !important; }
          .icon-nav .nav-item { width: auto !important; padding: 6px 10px !important; flex-direction: column !important; gap: 2px !important; flex: 1; justify-content: center !important; }
          .icon-nav .nav-label { font-size: 9px !important; }
          .icon-nav .nav-spacer, .icon-nav .nav-logo, .icon-nav .nav-bottom-utils { display: none !important; }
        }
        @media (max-width: 767px) {
          .mobile-safe-scroll { padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px)) !important; }
        }
      `}</style>
      <nav aria-label="Main navigation" className="icon-nav"
        style={{ width: 200, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', padding: '16px 8px', gap: 2, flexShrink: 0, background: 'var(--color-bg-card)', borderRight: '1px solid var(--color-border-subtle)' }}>
        <div className="nav-logo" style={{ color: 'var(--color-text-primary)', fontWeight: 500, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', userSelect: 'none', padding: '4px 12px', marginBottom: 12 }}>up</div>

        <NavItem icon={<WorkflowIcon />} label="Workflows" active={activeView === 'library' || activeView === 'workflow'} onClick={() => onViewChange('library')} />
        <NavItem icon={<VoiceIcon />} label="Voice" active={activeView === 'voice'} onClick={() => onViewChange('voice')} />
        <NavItem icon={<ScriptIcon />} label="Script" active={activeView === 'scriptlist' || activeView === 'scriptsense'} onClick={() => onViewChange('scriptlist')} />
        <NavItem icon={<CardsIcon />} label="Cards" active={activeView === 'cardslibrary' || activeView === 'cards'} onClick={() => onViewChange('cardslibrary')} />
        <NavItem icon={<InfographicsIcon />} label="Charts" active={activeView === 'infographics'} onClick={() => onViewChange('infographics')} />

        <div className="nav-spacer" style={{ flex: 1 }} />
        <NavItem icon={<SettingsIcon />} label="Settings" active={activeView === 'settings'} onClick={() => onViewChange('settings')} />
        <div className="nav-bottom-utils" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px' }}>
          <DarkModeToggle />
          <UserMenu />
        </div>
      </nav>
    </>
  );
}
