import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Menu, MenuItem } from '../ui/Menu';

interface Props {
  activeView: string;
  onViewChange: (view: string) => void;
}

/* ── Logo: source → branch → two outputs (one green) ── */
function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      {/* Source node */}
      <circle cx="3.5" cy="11" r="2.5" stroke="var(--color-text-tertiary)" strokeWidth="1.25"/>
      {/* Edge from source to junction */}
      <line x1="6" y1="11" x2="10.5" y2="11" stroke="var(--color-text-tertiary)" strokeWidth="1.25" strokeLinecap="round"/>
      {/* Junction dot */}
      <circle cx="11" cy="11" r="1" fill="var(--color-text-tertiary)" opacity="0.5"/>
      {/* Edge to top output */}
      <line x1="12" y1="10.3" x2="16" y2="6.5" stroke="var(--color-text-tertiary)" strokeWidth="1.25" strokeLinecap="round"/>
      {/* Edge to bottom output */}
      <line x1="12" y1="11.7" x2="16" y2="15.5" stroke="var(--color-accent)" strokeWidth="1.25" strokeLinecap="round"/>
      {/* Top output node */}
      <circle cx="18" cy="5.5" r="2" stroke="var(--color-text-tertiary)" strokeWidth="1.25"/>
      {/* Bottom output node — green filled */}
      <circle cx="18" cy="16.5" r="2.5" fill="var(--color-accent)"/>
    </svg>
  );
}

function NavItem({
  icon, label, active, onClick, ariaLabel, ariaPressed, expanded,
}: {
  icon: ReactNode; label: string; active?: boolean; onClick: () => void;
  ariaLabel?: string; ariaPressed?: boolean; expanded: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      aria-pressed={ariaPressed}
      className="nav-item"
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '7px 10px', borderRadius: 18,
        background: active ? 'var(--color-nav-item-active)' : 'transparent',
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
        boxShadow: active ? '0 1px 2px 0 rgba(0,0,0,0.04)' : 'none',
        justifyContent: 'flex-start', border: 'none', cursor: 'pointer',
        fontFamily: 'var(--font-sans)', overflow: 'hidden',
        transition: 'background 100ms, color 100ms',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, flexShrink: 0 }}>
        {icon}
      </span>
      <span
        className="nav-label"
        style={{
          fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap',
          opacity: expanded ? 1 : 0,
          transition: 'opacity 120ms ease',
          pointerEvents: 'none',
        }}
      >
        {label}
      </span>
    </button>
  );
}

const WorkflowIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 17h7"/><path d="M17.5 14v7"/></svg>;
const VoiceIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>;
const ScriptIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 12l-2 2 2 2"/><path d="M14 12l2 2-2 2"/></svg>;
const CardsIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="8" height="8" rx="1.5"/><rect x="14" y="3" width="8" height="8" rx="1.5"/><rect x="2" y="13" width="8" height="8" rx="1.5"/><rect x="14" y="13" width="8" height="8" rx="1.5"/></svg>;
const InfographicsIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 5 4-9"/></svg>;
const SunIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>;
const MoonIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>;
const SettingsIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;
const AccountIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const DesignIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="15.5" r="2.5"/><circle cx="6.5" cy="15.5" r="2.5"/><path d="M13.5 9v3.5l-4 2.5"/><path d="M13.5 9v3.5l4 2.5"/></svg>;

function UserMenu({ expanded }: { expanded: boolean }) {
  const { user, signOut } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('dark-mode', String(dark)); }, [dark]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  if (!user) return null;
  return (
    <div ref={ref} className="relative">
      <NavItem icon={<AccountIcon />} label="Account" active={open} expanded={true} ariaLabel="Account menu" ariaPressed={open} onClick={() => setOpen(!open)} />
      {open && (
        <Menu className="absolute z-50 dropdown-fade" style={{ bottom: '100%', marginBottom: 8, left: 10, right: 10, minWidth: 180 }}>
          <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)', padding: '4px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.email}
          </div>
          <MenuItem icon={dark ? <SunIcon /> : <MoonIcon />} onClick={() => setDark(!dark)}>
            {dark ? 'Light mode' : 'Dark mode'}
          </MenuItem>
          <MenuItem onClick={() => { signOut(); setOpen(false); }}>Sign out</MenuItem>
        </Menu>
      )}
    </div>
  );
}

export default function IconNav({ activeView, onViewChange }: Props) {
  return (
    <>
      <style>{`
        @media (max-width: 767px) {
          .icon-nav { width: 100% !important; height: 52px !important; flex-direction: row !important; padding: 0 8px !important; margin: 0 !important; gap: 0 !important; order: 99 !important; border-radius: 0 !important; box-shadow: none !important; border-top: 1px solid var(--color-border-subtle) !important; }
          .icon-nav .nav-item { width: auto !important; padding: 6px 10px !important; flex-direction: column !important; gap: 2px !important; flex: 1; justify-content: center !important; }
          .icon-nav .nav-label { font-size: 9px !important; opacity: 1 !important; }
          .icon-nav .nav-spacer, .icon-nav .nav-logo, .icon-nav .nav-bottom-utils { display: none !important; }
        }
        @media (max-width: 767px) {
          .mobile-safe-scroll { padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px)) !important; }
        }
      `}</style>
      <nav
        aria-label="Main navigation"
        className="icon-nav"
        style={{
          width: 170,
          height: 'calc(100% - 16px)',
          margin: '8px 0 8px 8px',
          display: 'flex', flexDirection: 'column', alignItems: 'stretch',
          padding: '12px 4px', gap: 2, flexShrink: 0,
          background: 'var(--color-nav-bg)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 16,
          boxShadow: '0px 2px 10px 0px rgba(0, 0, 0, 0.1)',
          position: 'relative', zIndex: 2,
          overflow: 'hidden',
        }}
      >
        {/* Logo */}
        <div
          className="nav-logo"
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '4px 11px', marginBottom: 10,
            overflow: 'hidden', flexShrink: 0,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <Logo />
          </span>
          <span
            style={{
              fontWeight: 500, fontSize: 11, fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-primary)', userSelect: 'none', whiteSpace: 'nowrap',
              letterSpacing: '0.18em', textTransform: 'uppercase',
              opacity: 1,
            }}
          >
            UP150
          </span>
        </div>

        <NavItem icon={<WorkflowIcon />} label="Workflows" expanded={true} active={activeView === 'library' || activeView === 'workflow'} onClick={() => onViewChange('library')} />
        <NavItem icon={<VoiceIcon />} label="Voice" expanded={true} active={activeView === 'voice'} onClick={() => onViewChange('voice')} />
        <NavItem icon={<ScriptIcon />} label="Script" expanded={true} active={activeView === 'scriptlist' || activeView === 'scriptsense'} onClick={() => onViewChange('scriptlist')} />
        <NavItem icon={<CardsIcon />} label="Cards" expanded={true} active={activeView === 'cardslibrary' || activeView === 'cards'} onClick={() => onViewChange('cardslibrary')} />
        <NavItem icon={<InfographicsIcon />} label="Charts" expanded={true} active={activeView === 'infographics'} onClick={() => onViewChange('infographics')} />

        <div className="nav-spacer" style={{ flex: 1 }} />
        <NavItem icon={<DesignIcon />} label="Design System" expanded={true} active={activeView === 'design'} onClick={() => onViewChange('design')} />
        <NavItem icon={<SettingsIcon />} label="Settings" expanded={true} active={activeView === 'settings'} onClick={() => onViewChange('settings')} />
        <div className="nav-bottom-utils" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <UserMenu expanded={true} />
        </div>
      </nav>
    </>
  );
}
