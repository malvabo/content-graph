import React, { useState, useRef, useEffect } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { useBrandsStore } from '../../store/brandsStore';
import { useDarkMode, type Theme } from '../../hooks/useDarkMode';
import BrandSetupModal from '../modals/BrandSetupModal';
import { Menu, MenuItem } from '../ui/Menu';
import DesignSystemPanel from './DesignSystemPanel';

// ─── Icons ────────────────────────────────────────────────────────────────────

const ChevronRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-disabled)', flexShrink: 0 }}>
    <path d="M9 18l6-6-6-6"/>
  </svg>
);

const ChevronUpDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-disabled)', flexShrink: 0 }}>
    <path d="M7 15l5 5 5-5M7 9l5-5 5 5"/>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-disabled)', flexShrink: 0 }}>
    <path d="M7 17L17 7M17 7H7M17 7v10"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
);

// ─── Layout primitives ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 500,
      fontFamily: 'var(--font-sans)',
      color: 'var(--color-text-disabled)',
      textTransform: 'uppercase',
      letterSpacing: '0.07em',
      marginBottom: 8,
      paddingLeft: 4,
    }}>
      {children}
    </div>
  );
}

function SettingsGroup({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      {label && <SectionLabel>{label}</SectionLabel>}
      <div style={{
        background: 'var(--color-bg-card)',
        borderRadius: 12,
        border: '0.5px solid var(--color-border-subtle)',
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  );
}

// Hairline separator between rows — inset from the left so it looks iOS-native
function RowDivider({ indent = 16 }: { indent?: number }) {
  return (
    <div style={{
      height: '0.5px',
      background: 'var(--color-border-subtle)',
      marginLeft: indent,
    }} />
  );
}

interface RowProps {
  label: string;
  value?: React.ReactNode;
  chevron?: 'right' | 'updown' | 'external' | 'none';
  danger?: boolean;
  onClick?: () => void;
  leftSlot?: React.ReactNode;
  rightExtra?: React.ReactNode;
}

function Row({ label, value, chevron = 'right', danger, onClick, leftSlot, rightExtra }: RowProps) {
  const showChevron = onClick && chevron !== 'none';
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '13px 16px',
        gap: 12,
        cursor: onClick ? 'pointer' : 'default',
        minHeight: 46,
        transition: 'background 100ms',
      }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-surface)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
        {leftSlot}
        <span style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--weight-regular)',
          color: danger ? '#ff453a' : 'var(--color-text-primary)',
          lineHeight: 1.4,
        }}>
          {label}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        {rightExtra}
        {value !== undefined && (
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-tertiary)',
          }}>
            {value}
          </span>
        )}
        {showChevron && chevron === 'right'    && <ChevronRightIcon />}
        {showChevron && chevron === 'updown'   && <ChevronUpDownIcon />}
        {showChevron && chevron === 'external' && <ExternalLinkIcon />}
      </div>
    </div>
  );
}

// ─── Provider definitions ─────────────────────────────────────────────────────

const PROVIDERS = [
  { key: 'anthropicKey' as const, setter: 'setAnthropicKey' as const, label: 'Anthropic',             placeholder: 'sk-ant-...', icon: 'A' },
  { key: 'openaiKey'   as const, setter: 'setOpenaiKey'   as const, label: 'OpenAI',                  placeholder: 'sk-...',     icon: 'O' },
  { key: 'googleKey'   as const, setter: 'setGoogleKey'   as const, label: 'Google Gemini',            placeholder: 'AIza...',    icon: 'G' },
  { key: 'groqKey'     as const, setter: 'setGroqKey'     as const, label: 'Groq (Llama)',             placeholder: 'gsk_...',    icon: 'L' },
  { key: 'togetherKey' as const, setter: 'setTogetherKey' as const, label: 'Together (Images)',        placeholder: '',           icon: 'T' },
  { key: 'hfKey'       as const, setter: 'setHfKey'       as const, label: 'Hugging Face (Images)',    placeholder: 'hf_...',     icon: 'H' },
] as const;

// ─── Theme section ─────────────────────────────────────────────────────────────

const THEME_LABELS: Record<Theme, string> = { default: 'System', light: 'Light', dark: 'Dark' };

function ThemeGroup() {
  const [theme, setTheme] = useDarkMode();
  const [open, setOpen] = useState(false);

  return (
    <SettingsGroup label="Appearance">
      <Row
        label="Theme"
        value={THEME_LABELS[theme]}
        chevron="updown"
        onClick={() => setOpen(o => !o)}
      />
      {open && (
        <>
          {(['default', 'light', 'dark'] as Theme[]).map((t, i, arr) => (
            <React.Fragment key={t}>
              <RowDivider indent={44} />
              <div
                onClick={() => { setTheme(t); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '11px 16px 11px 44px',
                  cursor: 'pointer',
                  transition: 'background 100ms',
                  background: theme === t ? 'var(--color-bg-surface)' : 'transparent',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-surface)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = theme === t ? 'var(--color-bg-surface)' : 'transparent'; }}
              >
                <span style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-secondary)',
                }}>
                  {THEME_LABELS[t]}
                </span>
                {theme === t && <CheckIcon />}
              </div>
            </React.Fragment>
          ))}
        </>
      )}
    </SettingsGroup>
  );
}

// ─── API Keys section ─────────────────────────────────────────────────────────

function APIKeysGroup() {
  const store = useSettingsStore();
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  const handleSave = async (key: string) => {
    const cleaned = editValue.trim().replace(/^['"`]+|['"`]+$/g, '');
    (store as any)[PROVIDERS.find(p => p.key === key)!.setter](cleaned);
    setEditKey(null);
    await useSettingsStore.getState().save();
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setSaved(true);
    savedTimerRef.current = setTimeout(() => setSaved(false), 1500);
  };

  const handleDelete = async (key: string) => {
    (store as any)[PROVIDERS.find(p => p.key === key)!.setter]('');
    setMenuOpen(null);
    await useSettingsStore.getState().save();
  };

  return (
    <SettingsGroup label="API Keys">
      {PROVIDERS.map((p, i) => {
        const value = store[p.key];
        const isEditing = editKey === p.key;

        return (
          <React.Fragment key={p.key}>
            {i > 0 && <RowDivider indent={52} />}

            {isEditing ? (
              <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ProviderIcon icon={p.icon} />
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 'var(--weight-medium)' }}>
                    {p.label}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="form-input"
                    autoFocus
                    type="password"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    placeholder={p.placeholder || 'Enter API key…'}
                    style={{ flex: 1, fontSize: 'var(--text-sm)' }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSave(p.key);
                      if (e.key === 'Escape') setEditKey(null);
                    }}
                  />
                  <button className="btn btn-primary btn-sm" onClick={() => handleSave(p.key)}>Save</button>
                  <button className="btn btn-sm" style={{ background: 'transparent', border: '1px solid var(--color-border-default)', color: 'var(--color-text-secondary)', borderRadius: 'var(--radius-md)', padding: '0 10px', cursor: 'pointer', fontSize: 'var(--text-xs)' }} onClick={() => setEditKey(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '13px 16px', gap: 12, minHeight: 46,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <ProviderIcon icon={p.icon} />
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
                    {p.label}
                  </span>
                  {value && (
                    <span style={{
                      fontSize: 11, padding: '2px 7px', borderRadius: 99,
                      background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
                      color: 'var(--color-accent)',
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}>
                      Active
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  {value ? (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-text-disabled)', letterSpacing: 2 }}>
                      ••••••
                    </span>
                  ) : (
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-disabled)', fontStyle: 'italic' }}>
                      Not set
                    </span>
                  )}
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setMenuOpen(prev => prev === p.key ? null : p.key)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: '4px 6px', borderRadius: 'var(--radius-sm)',
                        color: 'var(--color-text-disabled)', display: 'flex',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
                      </svg>
                    </button>
                    {menuOpen === p.key && (
                      <Menu ref={menuRef} style={{ position: 'absolute', top: 28, right: 0, zIndex: 50 }}>
                        <MenuItem onClick={() => { setEditValue(value); setEditKey(p.key); setMenuOpen(null); }}>Edit</MenuItem>
                        <MenuItem danger disabled={!value} onClick={() => handleDelete(p.key)}>Delete</MenuItem>
                      </Menu>
                    )}
                  </div>
                </div>
              </div>
            )}
          </React.Fragment>
        );
      })}

      {saved && (
        <div style={{
          padding: '8px 16px',
          borderTop: '0.5px solid var(--color-border-subtle)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-tertiary)',
          fontFamily: 'var(--font-sans)',
        }}>
          ✓ Saved
        </div>
      )}
    </SettingsGroup>
  );
}

function ProviderIcon({ icon }: { icon: string }) {
  return (
    <div style={{
      width: 26, height: 26, borderRadius: 6,
      background: 'var(--color-bg-surface)',
      border: '0.5px solid var(--color-border-default)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 600,
      fontFamily: 'var(--font-sans)',
      color: 'var(--color-text-tertiary)',
      flexShrink: 0,
    }}>
      {icon}
    </div>
  );
}

// ─── Brand Kits section ────────────────────────────────────────────────────────

function BrandKitsGroup() {
  const brands = useBrandsStore(s => s.brands);
  const addBrand = useBrandsStore(s => s.addBrand);
  const removeBrand = useBrandsStore(s => s.removeBrand);
  const duplicateBrand = useBrandsStore(s => s.duplicateBrand);
  const setActiveBrand = useBrandsStore(s => s.setActiveBrand);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuId) return;
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuId]);

  const handleNew = () => {
    const id = addBrand({ kitName: `Brand ${brands.length + 1}` });
    setEditingId(id);
  };

  return (
    <>
      <SettingsGroup label="Brand Kits">
        {brands.length === 0 ? (
          <div style={{
            padding: '16px 16px',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-disabled)',
            fontStyle: 'italic',
          }}>
            No brand kits yet
          </div>
        ) : (
          brands.map((b, i) => (
            <React.Fragment key={b.id}>
              {i > 0 && <RowDivider indent={52} />}
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '13px 16px', gap: 12, minHeight: 46,
                  cursor: 'pointer', transition: 'background 100ms',
                }}
                onClick={() => setEditingId(b.id)}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-surface)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  {/* Color swatches as the left icon */}
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    {(['primary', 'secondary', 'accent'] as const).map(k => (
                      <span key={k} style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: b.colors[k],
                        border: '0.5px solid var(--color-border-subtle)',
                        display: 'inline-block',
                      }} />
                    ))}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.kitName || 'Untitled kit'}
                    </div>
                    {b.fonts?.title && (
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-disabled)', marginTop: 1 }}>
                        {b.fonts.title}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                    <button
                      aria-label="Brand kit options"
                      onClick={e => { e.stopPropagation(); setMenuId(prev => prev === b.id ? null : b.id); }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: '4px 6px', borderRadius: 'var(--radius-sm)',
                        color: 'var(--color-text-disabled)', display: 'flex',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
                      </svg>
                    </button>
                    {menuId === b.id && (
                      <Menu ref={menuRef} style={{ position: 'absolute', top: 28, right: 0, zIndex: 50 }}>
                        <MenuItem onClick={() => { setActiveBrand(b.id); setMenuId(null); }}>Set as default</MenuItem>
                        <MenuItem onClick={() => { duplicateBrand(b.id); setMenuId(null); }}>Duplicate</MenuItem>
                        <MenuItem danger onClick={() => {
                          if (confirm(`Delete brand kit "${b.kitName || 'Untitled kit'}"?`)) removeBrand(b.id);
                          setMenuId(null);
                        }}>Delete</MenuItem>
                      </Menu>
                    )}
                  </div>
                  <ChevronRightIcon />
                </div>
              </div>
            </React.Fragment>
          ))
        )}

        {/* Add new kit row */}
        {brands.length > 0 && <RowDivider indent={16} />}
        <div
          onClick={handleNew}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '13px 16px', cursor: 'pointer', minHeight: 46,
            transition: 'background 100ms',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-surface)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <div style={{
            width: 26, height: 26, borderRadius: 6,
            background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-accent)',
          }}>
            <PlusIcon />
          </div>
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-accent)',
            fontWeight: 'var(--weight-medium)',
          }}>
            New brand kit
          </span>
        </div>
      </SettingsGroup>

      {editingId && <BrandSetupModal brandId={editingId} onClose={() => setEditingId(null)} />}
    </>
  );
}

// ─── More section ─────────────────────────────────────────────────────────────

function MoreGroup({ onOpenSystem }: { onOpenSystem: () => void }) {
  return (
    <SettingsGroup label="More">
      <Row
        label="Design System"
        chevron="external"
        onClick={onOpenSystem}
      />
    </SettingsGroup>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function SettingsPanel() {
  const [showSystem, setShowSystem] = useState(false);

  if (showSystem) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--color-bg)', overflow: 'hidden' }}>
        <div style={{
          padding: 'var(--space-4) var(--space-5)',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: '0.5px solid var(--color-border-subtle)',
        }}>
          <button
            onClick={() => setShowSystem(false)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-tertiary)',
              display: 'flex', alignItems: 'center', gap: 4,
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
              padding: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
            Settings
          </button>
        </div>
        <DesignSystemPanel />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--color-bg)', overflow: 'hidden' }}>
      {/* Page title */}
      <div style={{
        padding: 'var(--space-5) var(--space-5) var(--space-4)',
        flexShrink: 0,
        borderBottom: '0.5px solid var(--color-border-subtle)',
      }}>
        <h1 style={{
          margin: 0,
          fontFamily: 'var(--font-sans)',
          fontSize: 22,
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
        }}>
          Settings
        </h1>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5)' }}>
        <ThemeGroup />
        <APIKeysGroup />
        <BrandKitsGroup />
        <MoreGroup onOpenSystem={() => setShowSystem(true)} />
      </div>
    </div>
  );
}
