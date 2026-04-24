import { useState, useRef, useEffect, type ReactNode } from 'react';

export interface PaletteEntry {
  id: string;
  icon: ReactNode;
  label: string;
  description?: string;
  onSelect: () => void;
}

interface SearchPaletteProps {
  entries: PaletteEntry[];
  placeholder?: string;
  emptyMessage?: string;
  /** Sync query to parent so the inline list can also be filtered. */
  onQueryChange?: (q: string) => void;
}

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
  </svg>
);

export default function SearchPalette({
  entries,
  placeholder = 'Search...',
  emptyMessage = 'Nothing found',
  onQueryChange,
}: SearchPaletteProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
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
      {/* Input row */}
      <div
        onClick={() => inputRef.current?.focus()}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-strong)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-default)'; }}
        onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-strong)'; }}
        onBlurCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-default)'; }}
        style={{
          display: 'flex', alignItems: 'center', height: 36,
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

      {/* Popover — only when query is non-empty */}
      {open && q.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: 'var(--color-bg-popover)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 50,
          animation: 'paletteIn 120ms ease',
          maxHeight: 320, overflowY: 'auto', scrollbarWidth: 'thin',
          padding: 'var(--space-1) 0',
        }}>
          {filtered.length === 0 ? (
            <div style={{
              padding: 'var(--space-4) var(--space-3)', textAlign: 'center',
              fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-sans)',
            }}>
              {emptyMessage}
            </div>
          ) : filtered.map((entry, i) => (
            <button
              key={entry.id}
              onClick={() => handleSelect(entry)}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', border: 'none', textAlign: 'left',
                background: i === activeIdx ? 'var(--color-bg-hover)' : 'transparent',
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
                transition: 'background 80ms',
              }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--color-bg-surface)', color: 'var(--color-text-tertiary)',
              }}>
                {entry.icon}
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{
                  display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500,
                  color: 'var(--color-text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {entry.label || 'Untitled'}
                </span>
                {entry.description && (
                  <span style={{
                    display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2,
                  }}>
                    {entry.description}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
