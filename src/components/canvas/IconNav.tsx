import { type ReactNode, useState, useEffect } from 'react';

interface Props {
  activeView: string;
  onViewChange: (view: string) => void;
}

function NavItem({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div className="relative w-full flex justify-center">
      {active && <div className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full" style={{ background: 'var(--color-accent)' }} />}
      <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
        style={{ background: active ? 'var(--color-bg-surface)' : hover ? 'var(--color-bg-surface)' : 'transparent', color: active ? 'var(--color-accent-subtle)' : 'var(--color-text-tertiary)' }}>
        {icon}
      </button>
      {hover && (
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md whitespace-nowrap pointer-events-none z-50"
          style={{ background: 'var(--color-text-primary)', color: 'var(--p-white)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', fontWeight: 500, boxShadow: 'var(--shadow-sm)' }}>
          {label}
        </div>
      )}
    </div>
  );
}

const LibraryIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>;
const WorkflowIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 17h7"/><path d="M17.5 14v7"/></svg>;
const VoiceIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>;
const ScriptIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 12l-2 2 2 2"/><path d="M14 12l2 2-2 2"/></svg>;

const SunIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>;
const MoonIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>;

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

export default function IconNav({ activeView, onViewChange }: Props) {
  return (
    <nav aria-label="Main navigation" className="w-[52px] shrink-0 flex flex-col items-center py-3 gap-1" style={{ background: 'var(--color-bg-card)', boxShadow: '1px 0 0 0 var(--color-border-subtle)' }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', userSelect: 'none' }}>up</div>

      <NavItem icon={<LibraryIcon />} label="Library" active={activeView === 'library'} onClick={() => onViewChange('library')} />
      <NavItem icon={<WorkflowIcon />} label="Workflow" active={activeView === 'workflow'} onClick={() => onViewChange('workflow')} />
      <NavItem icon={<VoiceIcon />} label="Voice" active={activeView === 'voice'} onClick={() => onViewChange('voice')} />
      <NavItem icon={<ScriptIcon />} label="Script" active={activeView === 'scriptsense'} onClick={() => onViewChange('scriptsense')} />

      <div className="flex-1" />
      <DarkModeToggle />
    </nav>
  );
}
