/* ── TemplateCard — DS component matching Figma node 8-298 ── */
import { useState, useRef } from 'react';
import GraphSchematic from './GraphSchematic';

interface GraphNode { id: string; position: { x: number; y: number }; data: { category: string; label: string; description?: string } }
interface GraphEdge { source: string; target: string }

const PenIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
  </svg>
);

interface TemplateCardProps {
  title: string;
  meta: string;
  description?: string;
  pills: string[];
  extraCount?: number;
  onClick?: () => void;
  graphData?: { nodes: GraphNode[]; edges: GraphEdge[] };
  icon?: string;
  previewVideo?: string;
}

export default function TemplateCard({ title, meta, description, pills, extraCount, onClick, graphData, icon, previewVideo = '/nodes4.mp4' }: TemplateCardProps) {
  const HP = 20;
  const [hovered, setHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    setHovered(true);
    e.currentTarget.style.borderColor = 'var(--color-border-strong)';
    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
    e.currentTarget.style.transform = 'translateY(-1px)';
    videoRef.current?.play().catch(() => {});
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    setHovered(false);
    e.currentTarget.style.borderColor = 'var(--color-border-default)';
    e.currentTarget.style.boxShadow = 'none';
    e.currentTarget.style.transform = 'translateY(0)';
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
  };

  return (
    <button onClick={onClick} style={{
      display: 'flex', width: '100%', flexDirection: 'column',
      alignItems: 'stretch',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--color-border-default)',
      background: 'var(--color-bg-card)',
      cursor: 'pointer', textAlign: 'left', overflow: 'hidden',
      transition: 'border-color 150ms ease-out, box-shadow 150ms ease-out, transform 150ms ease-out',
    }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {graphData && graphData.nodes.length > 0 && (
        <div style={{ position: 'relative' }}>
          <GraphSchematic nodes={graphData.nodes} edges={graphData.edges} />

          {/* video overlay on hover */}
          <video
            ref={videoRef}
            src={previewVideo}
            muted
            loop
            playsInline
            preload="none"
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover',
              borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
              opacity: hovered ? 1 : 0,
              transition: 'opacity 200ms ease',
              pointerEvents: 'none',
            }}
          />

          {/* stroke ring — above video */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
            boxShadow: `inset 0 0 0 2px var(--color-accent)`,
            opacity: hovered ? 1 : 0,
            transition: 'opacity 150ms ease',
            zIndex: 2,
          }} />
        </div>
      )}

      {/* Title + meta + optional description */}
      <div style={{
        padding: `14px ${HP}px`,
        borderBottom: pills.length > 0 && !graphData ? '1px solid var(--color-border-subtle)' : 'none',
        display: 'flex', flexDirection: 'column', gap: 3,
      }}>
        <div style={{
          fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)',
          color: 'var(--color-text-primary)', lineHeight: 1.4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {icon === 'pen' && <PenIcon />}
          {title}
        </div>
        <div style={{
          fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-normal)',
          color: 'var(--color-text-tertiary)', lineHeight: 1.4,
        }}>{meta}</div>
        {description && (
          <div style={{
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-normal)',
            color: 'var(--color-text-secondary)', lineHeight: 1.5, marginTop: 4,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>{description}</div>
        )}
      </div>

      {/* Pill bar — shown only when no graphData thumbnail */}
      {!graphData && pills.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: `12px ${HP}px`,
          gap: 8,
          overflow: 'hidden',
        }}>
          {pills.map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {i > 0 && (
                <span style={{
                  fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-tertiary)', lineHeight: 1,
                }}>→</span>
              )}
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '5px 10px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-subtle)',
                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-normal)', color: 'var(--color-text-secondary)',
                lineHeight: 1.25, whiteSpace: 'nowrap',
              }}>{label}</span>
            </div>
          ))}
          {extraCount && extraCount > 0 && (
            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
              color: 'var(--color-text-tertiary)',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>+{extraCount}</span>
          )}
        </div>
      )}
    </button>
  );
}
