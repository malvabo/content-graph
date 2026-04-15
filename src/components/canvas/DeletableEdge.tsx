import { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { useGraphStore } from '../../store/graphStore';

export default function DeletableEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  return (
    <>
      {/* Invisible wider path for easier hover target */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: hovered ? '#F0D8A0' : style?.stroke,
          strokeWidth: hovered ? 2.5 : style?.strokeWidth,
          strokeDasharray: hovered ? 'none' : style?.strokeDasharray,
        }}
      />
      {hovered && (
        <EdgeLabelRenderer>
          <button
            className="nodrag nopan"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={() => useGraphStore.getState().setEdges(useGraphStore.getState().edges.filter((e) => e.id !== id))}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              width: 24, height: 24, borderRadius: '50%',
              background: '#F5C542', border: '2px solid #F5C542',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', pointerEvents: 'all', zIndex: 10,
              boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
