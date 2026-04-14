import { type ReactNode } from 'react';

interface Props {
  activeView: string;
  onViewChange: (view: string) => void;
}

function NavItem({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 w-full py-2 rounded-lg transition-colors"
      style={{
        background: active ? 'var(--cg-green-lt)' : 'transparent',
        color: active ? '#0A5C2A' : 'var(--cg-ink-3)',
      }}
    >
      <div className="w-6 h-6 flex items-center justify-center">{icon}</div>
      <span style={{ font: '500 10px/1 var(--font-sans)', letterSpacing: '.02em' }}>{label}</span>
    </button>
  );
}

const WorkflowIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 17h7"/><path d="M17.5 14v7"/></svg>;
const VoiceIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>;
const ChatIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 12l-2 2 2 2"/><path d="M14 12l2 2-2 2"/></svg>;
const RecentsIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const HomeIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>;

export default function IconNav({ activeView, onViewChange }: Props) {
  return (
    <nav className="w-[64px] shrink-0 flex flex-col items-center py-3 px-1 gap-1" style={{ background: 'var(--cg-card)', borderRight: '1px solid var(--cg-border)' }}>
      <NavItem icon={<WorkflowIcon />} label="Workflow" active={activeView === 'workflow'} onClick={() => onViewChange('workflow')} />
      <NavItem icon={<VoiceIcon />} label="Voice" active={activeView === 'voice'} onClick={() => onViewChange('voice')} />
      <NavItem icon={<ChatIcon />} label="Script" active={activeView === 'scriptsense'} onClick={() => onViewChange('scriptsense')} />
      <NavItem icon={<RecentsIcon />} label="Recents" active={activeView === 'recents'} onClick={() => onViewChange('recents')} />
      <div className="flex-1" />
      <div style={{ height: 1, width: '80%', background: 'var(--cg-border)' }} className="my-1" />
      <NavItem icon={<HomeIcon />} label="Home" active={false} onClick={() => onViewChange('workflow')} />
    </nav>
  );
}
