import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { useGraphStore } from '../../store/graphStore';

function DeletableEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  return (
    <g className="edge-group">
      {/* Invisible wider path for easier hover target */}
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={20} />
      <BaseEdge id={id} path={edgePath} style={style} className="edge-line" />
      <EdgeLabelRenderer>
        <button
          className="edge-delete-btn nodrag nopan"
          aria-label="Delete connection"
          onClick={() => useGraphStore.getState().setEdges(useGraphStore.getState().edges.filter((e) => e.id !== id))}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-primary)" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </EdgeLabelRenderer>
    </g>
  );
}

export default memo(DeletableEdge);
