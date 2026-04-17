import type { Meta, StoryObj } from '@storybook/react';
import { useState, useRef, type ReactNode } from 'react';
import '../index.css';

/**
 * Mirrors NavItem + IconNav from components/canvas/IconNav.tsx.
 * 40×40 rounded-lg buttons, accent indicator bar, delayed tooltip, dark mode toggle.
 */

function NavItem({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const enter = () => { setHover(true); timerRef.current = setTimeout(() => setShowTip(true), 200); };
  const leave = () => { setHover(false); setShowTip(false); clearTimeout(timerRef.current); };
  return (
    <div className="relative flex justify-center w-full">
      {active && <div className="absolute top-1 left-0 w-[3px] rounded-r-full" style={{ background: 'var(--color-accent)', height: 'calc(100% - 8px)' }} />}
      <button onClick={onClick} onMouseEnter={enter} onMouseLeave={leave}
        className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
        style={{ background: active ? 'var(--color-bg-surface)' : hover ? 'var(--color-bg-surface)' : 'transparent', color: active ? 'var(--color-accent-subtle)' : 'var(--color-text-tertiary)' }}>
        {icon}
      </button>
      {showTip && (
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md whitespace-nowrap pointer-events-none z-50"
          style={{ background: 'var(--color-text-primary)', color: 'var(--color-text-inverse)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', fontWeight: 500, boxShadow: 'var(--shadow-sm)' }}>
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
const SettingsIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;
const MoonIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>;

function IconNavDemo({ activeView = 'workflow' }: { activeView?: string }) {
  const [view, setView] = useState(activeView);
  return (
    <nav aria-label="Main navigation" className="w-[52px] flex flex-col items-center py-3 gap-1"
      style={{ background: 'var(--color-bg-card)', borderRight: '1px solid var(--color-border-subtle)', height: 420 }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
        style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', userSelect: 'none' }}>up</div>
      <NavItem icon={<LibraryIcon />} label="Library" active={view === 'library'} onClick={() => setView('library')} />
      <NavItem icon={<WorkflowIcon />} label="Workflow" active={view === 'workflow'} onClick={() => setView('workflow')} />
      <NavItem icon={<VoiceIcon />} label="Voice" active={view === 'voice'} onClick={() => setView('voice')} />
      <NavItem icon={<ScriptIcon />} label="Script" active={view === 'scriptsense'} onClick={() => setView('scriptsense')} />
      <div className="flex-1" />
      <NavItem icon={<SettingsIcon />} label="Settings" active={view === 'settings'} onClick={() => setView('settings')} />
      <button className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors" style={{ color: 'var(--color-text-tertiary)' }}><MoonIcon /></button>
    </nav>
  );
}

const meta: Meta<typeof IconNavDemo> = {
  title: 'Components/Navigation/Icon Nav',
  component: IconNavDemo,
  tags: ['autodocs'],
  argTypes: { activeView: { control: 'select', options: ['library', 'workflow', 'voice', 'scriptsense', 'settings'] } },
  parameters: { layout: 'centered' },
};
export default meta;

export const Default: StoryObj<typeof IconNavDemo> = { args: { activeView: 'workflow' } };
export const LibraryActive: StoryObj<typeof IconNavDemo> = { name: 'Library Active', args: { activeView: 'library' } };
export const SettingsActive: StoryObj<typeof IconNavDemo> = { name: 'Settings Active', args: { activeView: 'settings' } };
