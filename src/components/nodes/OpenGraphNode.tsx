import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';

export interface OGData {
  title: string;
  description: string;
  type?: 'article' | 'website' | 'product' | 'blog';
  twitterCard?: 'summary' | 'summary_large_image';
  keywords?: string[];
  imageAlt?: string;
}

export function parseOGData(text: string): OGData | null {
  try {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch { return null; }
}

function generateMetaTags(data: OGData, domain?: string): string {
  const lines = [
    '<!-- Primary Meta Tags -->',
    `<title>${data.title}</title>`,
    `<meta name="title" content="${data.title}" />`,
    `<meta name="description" content="${data.description}" />`,
    data.keywords?.length ? `<meta name="keywords" content="${data.keywords.join(', ')}" />` : null,
    '',
    '<!-- Open Graph / Facebook -->',
    `<meta property="og:type" content="${data.type || 'website'}" />`,
    domain ? `<meta property="og:url" content="https://${domain}/" />` : null,
    `<meta property="og:title" content="${data.title}" />`,
    `<meta property="og:description" content="${data.description}" />`,
    data.imageAlt ? `<meta property="og:image:alt" content="${data.imageAlt}" />` : null,
    '',
    '<!-- Twitter -->',
    `<meta property="twitter:card" content="${data.twitterCard || 'summary_large_image'}" />`,
    domain ? `<meta property="twitter:url" content="https://${domain}/" />` : null,
    `<meta property="twitter:title" content="${data.title}" />`,
    `<meta property="twitter:description" content="${data.description}" />`,
    data.imageAlt ? `<meta property="twitter:image:alt" content="${data.imageAlt}" />` : null,
  ].filter((l): l is string => l !== null);

  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

export function OpenGraphInline({ id }: { id: string }) {
  const status = useExecutionStore((s) => s.status[id] ?? 'idle');
  const text = useOutputStore((s) => s.outputs[id]?.text);
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (status === 'idle' || status === 'stale') return null;
  if (status === 'running') return (
    <div className="flex flex-col gap-2 mt-2" role="status" aria-label="Loading">
      {[100, 90, 70, 100, 85].map((w, i) => (
        <div key={i} className="h-2.5 rounded-sm skeleton-bar" style={{ width: `${w}%`, animationDelay: `${i * 0.1}s` }} />
      ))}
    </div>
  );
  if (status === 'warning') return (
    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-warning-text)', background: 'var(--color-warning-bg)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', marginTop: 'var(--space-2)' }}>
      ⚠ No input
    </div>
  );

  if (!text) return null;
  const data = parseOGData(text);
  if (!data?.title) return (
    <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)', background: 'var(--color-danger-bg)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)' }}>
      <div style={{ fontWeight: 500 }}>Failed to parse OG data</div>
      <div style={{ opacity: 0.7, marginTop: 2 }}>{text.slice(0, 120)}</div>
    </div>
  );

  const copyTags = () => {
    navigator.clipboard.writeText(generateMetaTags(data)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      {/* Link preview card */}
      <div
        onMouseDown={e => e.stopPropagation()}
        onClick={() => setModalOpen(true)}
        style={{
          marginTop: 'var(--space-2)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border-default)',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'box-shadow 150ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
      >
        {/* Image placeholder */}
        <div style={{ height: 56, background: 'var(--color-bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-disabled)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
          </svg>
        </div>
        {/* Card body */}
        <div style={{ padding: '7px 10px 9px', background: 'var(--color-bg-card)' }}>
          <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {data.type || 'website'}
          </div>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', lineHeight: 1.3, marginBottom: 3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
            {data.title}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
            {data.description}
          </div>
        </div>
      </div>

      {modalOpen && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-overlay-backdrop)', backdropFilter: 'blur(2px)' }}
          onClick={() => setModalOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--color-bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-default)', boxShadow: 'var(--shadow-lg)', width: 500, maxHeight: '90vh', overflow: 'auto', display: 'flex', flexDirection: 'column' }}
          >
            {/* Header */}
            <div style={{ padding: 'var(--space-4) var(--space-6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <span style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-md)', color: 'var(--color-text-primary)' }}>Open Graph Tags</span>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', display: 'flex', padding: 'var(--space-1)', borderRadius: 'var(--radius-sm)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>

            {/* Social preview */}
            <div style={{ padding: 'var(--space-4) var(--space-6)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Social preview</div>
              <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)', overflow: 'hidden' }}>
                <div style={{ height: 110, background: 'linear-gradient(135deg, var(--color-bg-surface) 0%, var(--color-bg-canvas) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-disabled)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                  </svg>
                </div>
                <div style={{ padding: '10px 14px 12px', background: 'var(--color-bg-card)' }}>
                  <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{data.type || 'website'}</div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text-primary)', lineHeight: 1.3, marginBottom: 5 }}>{data.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{data.description}</div>
                </div>
              </div>
            </div>

            {/* Fields */}
            <div style={{ padding: '0 var(--space-6) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>
                  og:title{' '}
                  <span style={{ color: data.title.length > 60 ? 'var(--color-danger)' : 'var(--color-text-disabled)' }}>
                    {data.title.length}/60
                  </span>
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', padding: '6px 10px', border: '1px solid var(--color-border-subtle)' }}>
                  {data.title}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>
                  og:description{' '}
                  <span style={{ color: data.description.length > 160 ? 'var(--color-danger)' : 'var(--color-text-disabled)' }}>
                    {data.description.length}/160
                  </span>
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', padding: '6px 10px', border: '1px solid var(--color-border-subtle)', lineHeight: 1.5 }}>
                  {data.description}
                </div>
              </div>
              {data.keywords?.length ? (
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>Keywords</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {data.keywords.map((kw, i) => (
                      <span key={i} style={{ fontSize: 11, color: 'var(--color-text-secondary)', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-full)', padding: '2px 8px', border: '1px solid var(--color-border-subtle)' }}>
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: 'var(--space-6)' }}>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', marginBottom: 2 }}>og:type</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>{data.type || 'website'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', marginBottom: 2 }}>twitter:card</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>{data.twitterCard || 'summary_large_image'}</div>
                </div>
              </div>
              {data.imageAlt ? (
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>og:image:alt</div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>{data.imageAlt}</div>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={copyTags}
                style={{ minWidth: 130 }}
              >
                {copied ? '✓ Copied!' : '⧉ Copy meta tags'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
