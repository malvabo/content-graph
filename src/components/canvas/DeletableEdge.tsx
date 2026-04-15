import { memo, useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { useGraphStore } from '../../store/graphStore';

function DeletableEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'pointer' }}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: hovered ? 'var(--p-amber-500)' : style?.stroke,
          strokeWidth: hovered ? 2.5 : style?.strokeWidth,
          strokeDasharray: hovered ? 'none' : style?.strokeDasharray,
          transition: 'stroke 150ms, stroke-width 150ms',
        }}
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
            onClick={() => useGraphStore.getState().setEdges(useGraphStore.getState().edges.filter((e) => e.id !== id))}
            style={{
              width: 24, height: 24, borderRadius: '50%',
              background: 'var(--color-warning-border)', border: '2px solid var(--color-warning-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-primary)" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(DeletableEdge);
