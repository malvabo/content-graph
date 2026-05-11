import { useGenerationsStore, type GenerationProject } from '../../store/generationsStore';

const BG = '#1A1513';

function formatDate(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ProjectRow({ project, onDelete }: { project: GenerationProject; onDelete: () => void }) {
  return (
    <div
      style={{
        position: 'relative',
        padding: 14,
        background: 'rgba(255,255,255,0.05)',
        border: '0.5px solid rgba(255,255,255,0.07)',
        borderRadius: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.55)',
            padding: '3px 8px',
            background: 'rgba(255,255,255,0.07)',
            borderRadius: 999,
          }}
        >
          {project.outputType}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)' }}>
          {formatDate(project.createdAt)}
        </span>
        <button
          onClick={onDelete}
          aria-label="Delete generation"
          style={{
            border: 'none',
            background: 'transparent',
            color: 'rgba(255,255,255,0.30)',
            cursor: 'pointer',
            padding: 4,
            marginLeft: 2,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.85)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: project.preview ? 4 : 0,
        }}
      >
        {project.title}
      </div>
      {project.preview && (
        <div
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.40)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {project.preview}
        </div>
      )}
    </div>
  );
}

export default function MobileLibrary() {
  const projects = useGenerationsStore((s) => s.projects);
  const removeProject = useGenerationsStore((s) => s.removeProject);

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

      {projects.length === 0 ? (
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
      ) : (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 16px calc(80px + env(safe-area-inset-bottom, 0px))',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {projects.map((p) => (
            <ProjectRow key={p.id} project={p} onDelete={() => removeProject(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
