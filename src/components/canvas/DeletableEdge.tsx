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
          strokeWidth: animated ? 1.5 : style?.strokeWidth,
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
          strokeLinecap="round"
        >
          <animate attributeName="stroke-width" values="1.5;3;1.5" dur="2s" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1" repeatCount="indefinite" />
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
              color: 'var(--color-text-inverse)',
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
