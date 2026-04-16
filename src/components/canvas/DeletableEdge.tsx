import { memo, useState, useCallback } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { useGraphStore } from '../../store/graphStore';

function DeletableEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, animated,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  const onDelete = useCallback(() => {
    useGraphStore.getState().setEdges(useGraphStore.getState().edges.filter((e) => e.id !== id));
  }, [id]);

  const gradId = `pulse-${id}`;

  return (
    <>
      {/* Glow layer when running */}
      {animated && (
        <path d={edgePath} fill="none" stroke="var(--color-accent)" strokeWidth={6} strokeLinecap="round" style={{ opacity: 0.15, filter: 'blur(3px)' }} />
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: animated ? `url(#${gradId})` : hovered ? 'var(--color-border-strong)' : style?.stroke,
          strokeWidth: animated ? 2 : style?.strokeWidth,
          strokeDasharray: animated ? 'none' : style?.strokeDasharray,
          transition: 'stroke 150ms',
        }}
        interactionWidth={24}
      />
      {/* Traveling dot when running */}
      {animated && (
        <>
          <defs>
            <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={sourceX} y1={sourceY} x2={targetX} y2={targetY}>
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.3" />
              <stop offset="50%" stopColor="var(--color-accent)" stopOpacity="1" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.3" />
              <animateTransform attributeName="gradientTransform" type="translate" from="-1 0" to="1 0" dur="1.5s" repeatCount="indefinite" />
            </linearGradient>
          </defs>
          <circle r="3" fill="var(--color-accent)" style={{ filter: 'drop-shadow(0 0 3px var(--color-accent))' }}>
            <animateMotion dur="1.8s" repeatCount="indefinite" path={edgePath} />
          </circle>
          <circle r="1.5" fill="white" opacity="0.9">
            <animateMotion dur="1.8s" repeatCount="indefinite" path={edgePath} />
          </circle>
        </>
      )}
      {/* Hit area on top of everything */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        style={{ pointerEvents: 'stroke', cursor: 'default' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            opacity: hovered ? 1 : 0,
            transition: 'opacity 150ms',
            pointerEvents: hovered ? 'all' : 'none',
          }}
        >
          <button
            aria-label="Delete connection"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: 24, height: 24, borderRadius: '50%',
              background: 'var(--color-danger)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
              color: 'white',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(DeletableEdge);
