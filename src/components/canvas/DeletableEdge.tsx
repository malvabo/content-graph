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

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: animated ? 'var(--color-accent)' : hovered ? 'var(--color-border-strong)' : style?.stroke,
          strokeWidth: animated ? 2 : style?.strokeWidth,
          strokeDasharray: animated ? 'none' : style?.strokeDasharray,
          transition: 'stroke 150ms',
        }}
        interactionWidth={24}
      />
      {animated && (
        <path
          d={edgePath}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray="8 6"
        >
          <animate attributeName="stroke-dashoffset" from="14" to="0" dur="0.6s" repeatCount="indefinite" />
        </path>
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
