import { forwardRef, useRef, type InputHTMLAttributes } from 'react';

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.3-4.3"/>
  </svg>
);

interface SearchBarProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onValueChange?: (value: string) => void;
}

const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  function SearchBar({ onValueChange, onChange, placeholder = 'Search...', ...rest }, forwardedRef) {
    const localRef = useRef<HTMLInputElement>(null);

    const mergeRef = (el: HTMLInputElement | null) => {
      (localRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
      if (typeof forwardedRef === 'function') forwardedRef(el);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
    };

    return (
      <div
        onClick={() => localRef.current?.focus()}
        style={{
          display: 'flex',
          alignItems: 'stretch',
          height: 34,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
          transition: 'border-color var(--duration-medium)',
          cursor: 'text',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-strong)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-default)'; }}
        onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-strong)'; }}
        onBlurCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-default)'; }}
      >
        <span style={{
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 38,
          color: 'var(--color-text-disabled)',
          background: 'var(--color-bg-surface)',
        }}>
          <SearchIcon />
        </span>
        <input
          ref={mergeRef}
          type="search"
          placeholder={placeholder}
          onChange={e => { onChange?.(e); onValueChange?.(e.target.value); }}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-sans)',
            color: 'var(--color-text-primary)',
            padding: '0 14px 0 8px',
          }}
          {...rest}
        />
      </div>
    );
  }
);

export default SearchBar;
