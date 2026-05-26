import { type RefObject, useRef } from 'react';

interface ChatMsg { role: 'user' | 'assistant'; text: string }

interface FloatingChatProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  messages: ChatMsg[];
  input: string;
  loading: boolean;
  onInputChange: (v: string) => void;
  onSend: (text?: string) => void;
  suggestions?: string[];
  apiKeyWarning?: React.ReactNode;
  chatEndRef: RefObject<HTMLDivElement | null>;
  placeholder?: string;
}

const Star = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0 L9.4 6.6 L16 8 L9.4 9.4 L8 16 L6.6 9.4 L0 8 L6.6 6.6 Z" />
  </svg>
);

const ChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const UpArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19V5" /><path d="m5 12 7-7 7 7" />
  </svg>
);

export default function FloatingChat({
  open, onOpenChange, title, messages, input, loading,
  onInputChange, onSend, suggestions, apiKeyWarning, chatEndRef,
  placeholder,
}: FloatingChatProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const userCount = messages.filter(m => m.role === 'user').length;
  const hasHistory = messages.length > 0;
  const canSend = input.trim() && !loading;

  const handleSuggestion = (text: string) => {
    onInputChange(text);
    onSend(text);
  };

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      width: 400, maxWidth: 'calc(100vw - 48px)', zIndex: 200,
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{
        borderRadius: 18,
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border-default)',
        boxShadow: open
          ? '0 16px 56px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.08)'
          : '0 4px 20px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.05)',
        overflow: 'hidden',
        transition: 'box-shadow 250ms',
      }}>

        {/* ── Header (expanded only) ── */}
        {open && (
          <div style={{
            padding: '11px 14px 11px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
            borderBottom: '1px solid var(--color-border-subtle)',
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 7,
              background: 'var(--color-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, color: '#fff',
            }}>
              <Star size={11} />
            </div>
            <span style={{
              flex: 1, fontSize: 'var(--text-sm)', fontWeight: 600,
              color: 'var(--color-text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{title}</span>
            {hasHistory && (
              <span style={{
                fontSize: 11, color: 'var(--color-text-disabled)',
                fontWeight: 500, letterSpacing: '0.01em', flexShrink: 0,
              }}>
                {userCount} message{userCount !== 1 ? 's' : ''}
              </span>
            )}
            <button
              onClick={() => onOpenChange(false)}
              aria-label="Minimize chat"
              style={{
                width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'var(--color-bg-surface)', color: 'var(--color-text-tertiary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 120ms, color 120ms', flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-interactive-hover)'; e.currentTarget.style.color = 'var(--color-text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
            >
              <ChevronDown />
            </button>
          </div>
        )}

        {/* ── Messages / Empty state (expanded only) ── */}
        {open && (
          <div style={{
            maxHeight: 320, overflowY: 'auto',
            padding: '14px 18px',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            {/* API key warning */}
            {apiKeyWarning && (
              <div style={{
                padding: '9px 12px', borderRadius: 10, marginBottom: 6,
                background: 'var(--color-warning-bg)',
                border: '1px solid var(--color-warning-border)',
                fontSize: 12, color: 'var(--color-warning-text)', lineHeight: 1.5,
              }}>
                {apiKeyWarning}
              </div>
            )}

            {/* Empty state: suggestion chips */}
            {messages.length === 0 && suggestions && suggestions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingBottom: 6 }}>
                {suggestions.map(s => (
                  <button key={s} onClick={() => handleSuggestion(s)}
                    style={{
                      padding: '5px 12px', borderRadius: 20,
                      border: '1px solid var(--color-border-default)',
                      background: 'transparent',
                      fontSize: 12, fontFamily: 'var(--font-sans)',
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer', transition: 'background 100ms, border-color 100ms',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; e.currentTarget.style.borderColor = 'var(--color-border-strong)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--color-border-default)'; }}
                  >{s}</button>
                ))}
              </div>
            )}

            {/* Message thread */}
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                alignItems: 'flex-start', gap: 8,
                marginTop: i > 0 && messages[i - 1]?.role !== msg.role ? 8 : 2,
              }}>
                {msg.role === 'assistant' && (
                  <div style={{
                    width: 20, height: 20, borderRadius: 6,
                    background: 'var(--color-accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 3, color: '#fff',
                  }}>
                    <Star size={9} />
                  </div>
                )}
                <div style={{
                  maxWidth: '78%',
                  padding: msg.role === 'user' ? '8px 13px' : '4px 0',
                  borderRadius: msg.role === 'user' ? '14px 14px 3px 14px' : 0,
                  background: msg.role === 'user' ? 'var(--color-bg-surface)' : 'transparent',
                  border: msg.role === 'user' ? '1px solid var(--color-border-default)' : 'none',
                  fontSize: 'var(--text-sm)',
                  color: msg.role === 'user' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  lineHeight: 'var(--leading-relaxed)', whiteSpace: 'pre-wrap',
                }}>{msg.text}</div>
              </div>
            ))}

            {/* Loading */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 6,
                  background: 'var(--color-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, color: '#fff',
                }}>
                  <Star size={9} />
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: 'var(--color-text-disabled)',
                      animation: `pulse 1.2s ease-in-out ${i * 0.18}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}

            {/* Quick-action chips after first exchange */}
            {!loading && hasHistory && suggestions && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                {suggestions.slice(0, 3).map(s => (
                  <button key={s} onClick={() => handleSuggestion(s)}
                    style={{
                      padding: '3px 10px', borderRadius: 20,
                      border: '1px solid var(--color-border-default)',
                      background: 'transparent',
                      fontSize: 11, fontFamily: 'var(--font-sans)',
                      color: 'var(--color-text-disabled)',
                      cursor: 'pointer', transition: 'background 100ms',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >{s}</button>
                ))}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        )}

        {/* ── Input bar ── */}
        <div style={{
          padding: '11px 12px 11px 16px',
          display: 'flex', alignItems: 'center', gap: 8,
          borderTop: open ? '1px solid var(--color-border-subtle)' : 'none',
        }}
          onClick={() => { if (!open) { onOpenChange(true); inputRef.current?.focus(); } }}
        >
          {/* Star icon — collapsed indicator / label */}
          {!open && (
            <div style={{ color: 'var(--color-accent)', flexShrink: 0, display: 'flex', lineHeight: 0 }}>
              <Star size={14} />
            </div>
          )}

          <input
            ref={inputRef}
            value={input}
            onChange={e => onInputChange(e.target.value)}
            onFocus={() => onOpenChange(true)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            placeholder={open && hasHistory ? 'What else?' : (placeholder ?? 'What do you want to do?')}
            disabled={loading}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)',
              color: 'var(--color-text-primary)', cursor: 'text',
            }}
          />

          {/* History badge in collapsed state */}
          {!open && hasHistory && (
            <div style={{
              minWidth: 20, height: 20, borderRadius: 10, padding: '0 5px',
              background: 'var(--color-accent)', color: '#fff',
              fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, letterSpacing: '0.02em',
            }}>
              {userCount}
            </div>
          )}

          <button
            onClick={e => { e.stopPropagation(); onSend(); }}
            disabled={!canSend}
            aria-label="Send"
            style={{
              width: 34, height: 34, borderRadius: '50%', border: 'none', flexShrink: 0,
              background: canSend ? 'var(--color-accent)' : 'var(--color-bg-surface)',
              color: canSend ? '#fff' : 'var(--color-text-disabled)',
              cursor: canSend ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 150ms, transform 80ms',
            }}
            onMouseDown={e => { if (canSend) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.92)'; }}
            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
          >
            <UpArrow />
          </button>
        </div>

      </div>
    </div>
  );
}
