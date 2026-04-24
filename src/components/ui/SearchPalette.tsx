import { useState, useRef, useEffect, type ReactNode } from 'react';

export interface PaletteEntry {
  id: string;
  /** Icon element rendered inside the 24×24 badge square. */
  icon: ReactNode;
  /** Badge background colour — e.g. var(--color-badge-source-bg). */
  iconBg?: string;
  /** Badge icon colour — e.g. var(--color-badge-source-text). */
  iconColor?: string;
  label: string;
  description?: string;
  onSelect: () => void;
}

interface SearchPaletteProps {
  entries: PaletteEntry[];
  placeholder?: string;
  emptyMessage?: string;
  /** Pre-fill query and open the popover — useful for Storybook demos. */
  defaultQuery?: string;
  /** Notify parent of query changes so an inline list can also be filtered. */
  onQueryChange?: (q: string) => void;
}

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
  </svg>
);

function PaletteRow({ entry, active, onHover, onSelect }: {
  entry: PaletteEntry; active: boolean;
  onHover: () => void; onSelect: () => void;
}) {
  return (
    <div
      role="option"
      aria-selected={active}
      onClick={onSelect}
      onMouseEnter={onHover}
      className="palette-item flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer"
      style={{ background: active ? 'var(--color-bg-hover)' : 'transparent', transition: 'background 80ms' }}
    >
      {/* 24×24 badge — exact match to NodePalette PaletteItem */}
      <div
        className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
        style={{
          backgroundColor: entry.iconBg ?? 'var(--color-bg-surface)',
          color: entry.iconColor ?? 'var(--color-text-tertiary)',
        }}
      >
        {entry.icon}
      </div>

      <div className="min-w-0">
        <div style={{
          fontWeight: 500, fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-fixed)',
          fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {entry.label || 'Untitled'}
        </div>
        {entry.description && (
          <div style={{
            fontSize: 'var(--text-xs)', lineHeight: '16px',
            fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)',
            marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {entry.description}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPalette({
  entries,
  placeholder = 'Search...',
  emptyMessage = 'Nothing found',
  defaultQuery = '',
  onQueryChange,
}: SearchPaletteProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [open, setOpen] = useState(defaultQuery.length > 0);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = query.toLowerCase().trim();
  const filtered = q
    ? entries.filter(e =>
        e.label.toLowerCase().includes(q) ||
        (e.description?.toLowerCase().includes(q) ?? false)
      )
    : [];

  useEffect(() => { setActiveIdx(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', h, true);
    return () => document.removeEventListener('pointerdown', h, true);
  }, [open]);

  const handleChange = (val: string) => {
    setQuery(val);
    onQueryChange?.(val);
    setOpen(true);
  };

  const handleSelect = (entry: PaletteEntry) => {
    entry.onSelect();
    setQuery('');
    onQueryChange?.('');
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !filtered.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && filtered[activeIdx]) { handleSelect(filtered[activeIdx]); }
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', minWidth: 280 }}>
      {/* Input — height 34 and border-radius full matches SearchBar used in NodePalette */}
      <div
        onClick={() => inputRef.current?.focus()}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-strong)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-default)'; }}
        onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-strong)'; }}
        onBlurCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-default)'; }}
        style={{
          display: 'flex', alignItems: 'stretch', height: 34,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden', cursor: 'text',
          transition: 'border-color 150ms',
        }}
      >
        <span style={{
          flexShrink: 0, display: 'inline-flex', alignItems: 'center',
          justifyContent: 'center', width: 38, color: 'var(--color-text-disabled)',
        }}>
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="search-bar-input"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            boxShadow: 'none', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)',
            color: 'var(--color-text-primary)', padding: '0 14px 0 0',
          }}
        />
      </div>

      {/* Popover — same dimensions as NodePalette (280px wide, max-h 420px) */}
      {open && q.length > 0 && (
        <div
          role="listbox"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
            background: 'var(--color-bg-popover)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 50,
            animation: 'paletteIn 150ms ease',
            maxHeight: 420, overflowY: 'auto', scrollbarWidth: 'thin',
            padding: '0 var(--space-2) var(--space-3)',
          }}
        >
          {filtered.length === 0 ? (
            <div style={{
              padding: 'var(--space-6) var(--space-3)', textAlign: 'center',
              fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-sans)',
            }}>
              {emptyMessage}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5" style={{ paddingTop: 'var(--space-2)' }}>
              {filtered.map((entry, i) => (
                <PaletteRow
                  key={entry.id}
                  entry={entry}
                  active={i === activeIdx}
                  onHover={() => setActiveIdx(i)}
                  onSelect={() => handleSelect(entry)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
