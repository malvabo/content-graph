import { type ReactNode, useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';

interface Props {
  activeView: string;
  onViewChange: (view: string) => void;
}

function NavItem({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const enter = () => { setHover(true); timerRef.current = setTimeout(() => setShowTip(true), 200); };
  const leave = () => { setHover(false); setShowTip(false); clearTimeout(timerRef.current); };
  return (
    <div className="relative flex justify-center md:w-full">
      {active && <div className="absolute bottom-0 left-1 right-1 h-[3px] rounded-t-full md:bottom-auto md:top-1 md:left-0 md:right-auto md:h-auto md:w-[3px] md:rounded-r-full md:rounded-t-none" style={{ background: 'var(--color-accent)' }} />}
      <button onClick={onClick} onMouseEnter={enter} onMouseLeave={leave}
        className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
        style={{ background: active ? 'var(--color-bg-surface)' : hover ? 'var(--color-bg-surface)' : 'transparent', color: active ? 'var(--color-accent-subtle)' : 'var(--color-text-tertiary)' }}>
        {icon}
      </button>
      {showTip && (
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md whitespace-nowrap pointer-events-none z-50"
          style={{ background: 'var(--color-text-primary)', color: 'var(--color-text-inverse)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', fontWeight: 500, boxShadow: 'var(--shadow-sm)', animation: 'fadeIn 100ms ease' }}>
          {label}
        </div>
      )}
    </div>
  );
}

const WorkflowIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 17h7"/><path d="M17.5 14v7"/></svg>;
const VoiceIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>;
const ScriptIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 12l-2 2 2 2"/><path d="M14 12l2 2-2 2"/></svg>;

const SunIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>;
const MoonIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>;
const SettingsIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;

function DarkModeToggle() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('dark-mode');
    return saved === 'true';
  });
  const [hover, setHover] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('dark-mode', String(dark));
  }, [dark]);
  return (
    <button onClick={() => setDark(!dark)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
      style={{ background: hover ? 'var(--color-bg-surface)' : 'transparent', color: 'var(--color-text-tertiary)' }}>
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function UserMenu() {
  const { user, signOut } = useAuthStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  if (!user) return null;
  const initial = (user.email?.[0] ?? '?').toUpperCase();
  return (
    <div ref={ref} className="relative flex justify-center">
      <button onClick={() => setOpen(!open)} className="w-8 h-8 rounded-full flex items-center justify-center"
        style={{ background: 'var(--color-border-strong)', color: 'var(--color-text-primary)', fontSize: 'var(--text-xs)', fontWeight: 500, fontFamily: 'var(--font-sans)', border: 'none', cursor: 'pointer' }}>
        {initial}
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 md:bottom-auto md:left-full md:ml-2 md:top-0 z-50 dropdown-fade"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', padding: 'var(--space-2)', minWidth: 160 }}>
          <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)', padding: 'var(--space-1) var(--space-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
          <button onClick={() => { signOut(); setOpen(false); }} className="w-full text-left"
            style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-sm)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 'var(--space-1)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function IconNav({ activeView, onViewChange }: Props) {
  return (
    <nav aria-label="Main navigation" className="
      w-full h-[52px] flex flex-row items-center px-2 gap-1 shrink-0 order-last
      md:w-[52px] md:h-auto md:flex-col md:py-3 md:px-0 md:order-first
    " style={{ background: 'var(--color-bg-card)' }}>
      <style>{`nav[aria-label="Main navigation"] { border-top: 1px solid var(--color-border-subtle); } @media(min-width:768px) { nav[aria-label="Main navigation"] { border-top: none; border-right: 1px solid var(--color-border-subtle); } }`}</style>
      <div className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center mb-2" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', userSelect: 'none' }}>up</div>

      <NavItem icon={<WorkflowIcon />} label="Workflows" active={activeView === 'library' || activeView === 'workflow'} onClick={() => onViewChange('library')} />
      <NavItem icon={<VoiceIcon />} label="Voice" active={activeView === 'voice'} onClick={() => onViewChange('voice')} />
      <NavItem icon={<ScriptIcon />} label="Script" active={activeView === 'scriptsense'} onClick={() => onViewChange('scriptsense')} />

      <div className="flex-1" />
      <NavItem icon={<SettingsIcon />} label="Settings" active={activeView === 'settings'} onClick={() => onViewChange('settings')} />
      <DarkModeToggle />
      <UserMenu />
    </nav>
  );
}
