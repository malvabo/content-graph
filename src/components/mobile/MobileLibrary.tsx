const BG = '#1A1513';

export default function MobileLibrary() {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: BG,
        color: '#fff',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        style={{
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 17h7" />
          <path d="M17.5 14v7" />
        </svg>
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>Library</h1>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
          textAlign: 'center',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
          No projects yet
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', maxWidth: 280, lineHeight: 1.5 }}>
          Your generated projects will appear here.
        </div>
      </div>
    </div>
  );
}
