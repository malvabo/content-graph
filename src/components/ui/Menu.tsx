import type { ReactNode, CSSProperties, MouseEvent } from 'react';
import { forwardRef } from 'react';

/**
 * Popover-style dropdown shell matching the app-wide design:
 * - Container: 1px subtle border, 10px radius, soft shadow, 4px inner padding.
 * - Items: 14px / 20px line-height, 6px 8px padding, 10px gap icon→label.
 * - Icons render inside a fixed 16×16 slot so ragged SVG bounding boxes
 *   don't make labels drift.
 */

const menuStyle: CSSProperties = {
  background: 'var(--color-bg-popover)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 10,
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
  padding: 4,
  minWidth: 200,
  fontFamily: 'var(--font-sans)',
};

export const Menu = forwardRef<HTMLDivElement, {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
  role?: string;
}>(function Menu({ children, style, className, onClick, role = 'menu' }, ref) {
  return (
    <div ref={ref} role={role} className={className} onClick={onClick}
      style={{ ...menuStyle, ...style }}>
      {children}
    </div>
  );
});

export interface MenuItemProps {
  icon?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  /** Red destructive styling. */
  danger?: boolean;
  disabled?: boolean;
  /** Sticky highlight (e.g., currently-selected value). */
  selected?: boolean;
  /** Right-aligned trailing content (e.g. keyboard hint, current value). */
  right?: ReactNode;
  ariaLabel?: string;
}

export function MenuItem({ icon, children, onClick, danger, disabled, selected, right, ariaLabel }: MenuItemProps) {
  const color = disabled
    ? 'var(--color-text-disabled)'
    : danger ? 'var(--color-danger-text)' : 'var(--color-text-primary)';
  const iconColor = disabled
    ? 'var(--color-text-disabled)'
    : danger ? 'var(--color-danger-text)' : 'var(--color-text-tertiary)';
  const hoverBg = danger ? 'var(--color-danger-bg)' : 'var(--color-bg-surface)';
  const baseBg = selected ? 'var(--color-bg-surface)' : 'transparent';
  return (
    <button
      role="menuitem"
      aria-label={ariaLabel}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 8px',
        borderRadius: 6,
        background: baseBg,
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        color,
        fontSize: 14,
        lineHeight: '20px',
        fontWeight: 500,
        fontFamily: 'inherit',
        textAlign: 'left',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = hoverBg; }}
      onMouseLeave={e => { e.currentTarget.style.background = baseBg; }}
    >
      {icon !== undefined && (
        <span style={{ width: 16, height: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor }}>
          {icon}
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {children}
      </span>
      {right && (
        <span style={{ flexShrink: 0, fontSize: 12, color: 'var(--color-text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {right}
        </span>
      )}
    </button>
  );
}

export function MenuSeparator() {
  return <div aria-hidden style={{ height: 1, background: 'var(--color-border-subtle)', margin: '4px -4px' }} />;
}
