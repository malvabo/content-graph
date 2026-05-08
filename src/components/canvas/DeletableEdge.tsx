import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { useGraphStore } from '../../store/graphStore';

const APPROACH_MS = 200;
const SHAKE_END_MS = 550;
const TOTAL_MS = 700;
const SHAKE_AMP = 4;
const SHAKE_CYCLES = 3;
const TIP_GAP = 6;

function easeOut(t: number) { return 1 - (1 - t) * (1 - t); }
function easeIn(t: number) { return t * t; }

function DeletableEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, animated, data,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const gradId = `edge-grad-${id}`;

  const sourceCategory = (data as Record<string, unknown> | undefined)?.sourceCategory as string | undefined;
  const targetCategory = (data as Record<string, unknown> | undefined)?.targetCategory as string | undefined;
  const isAnimating = !!(data as Record<string, unknown> | undefined)?.animating;

  const hasGrad = !animated && !hovered && !!sourceCategory && !!targetCategory && !isAnimating;

  const strokeColor = animated
    ? 'var(--color-accent)'
    : hovered
    ? 'var(--color-border-strong)'
    : hasGrad
    ? `url(#${gradId})`
    : 'var(--color-edge)';

  const onDelete = useCallback(() => {
    useGraphStore.getState().setEdges(useGraphStore.getState().edges.filter((e) => e.id !== id));
  }, [id]);

  const pathARef = useRef<SVGPathElement>(null);
  const pathBRef = useRef<SVGPathElement>(null);
  const rafRef = useRef<number | null>(null);

  // Handshake animation — runs once when the edge is first created (animating flag)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isAnimating) return;

    const midX = (sourceX + targetX) / 2;
    const midY = (sourceY + targetY) / 2;

    const dxA = midX - sourceX;
    const dyA = midY - sourceY;
    const lenA = Math.sqrt(dxA * dxA + dyA * dyA) || 1;

    const dxB = midX - targetX;
    const dyB = midY - targetY;
    const lenB = Math.sqrt(dxB * dxB + dyB * dyB) || 1;

    // Tips stop TIP_GAP px short of midpoint (the "gap before clasp")
    const tipAFinalX = midX - (dxA / lenA) * TIP_GAP;
    const tipAFinalY = midY - (dyA / lenA) * TIP_GAP;
    const tipBFinalX = midX - (dxB / lenB) * TIP_GAP;
    const tipBFinalY = midY - (dyB / lenB) * TIP_GAP;

    // Extract bezier control points from the precomputed edgePath string for Phase 3 morph.
    // Format produced by getBezierPath: "M sx,sy C cp1x,cp1y cp2x,cp2y tx,ty"
    const cpMatch = edgePath.match(/M\s+([\d.-]+)[,\s]+([\d.-]+)\s+C\s+([\d.-]+)[,\s]+([\d.-]+)\s+([\d.-]+)[,\s]+([\d.-]+)/);
    const cp1x = cpMatch ? parseFloat(cpMatch[3]) : midX;
    const cp1y = cpMatch ? parseFloat(cpMatch[4]) : midY;
    const cp2x = cpMatch ? parseFloat(cpMatch[5]) : midX;
    const cp2y = cpMatch ? parseFloat(cpMatch[6]) : midY;

    const startTime = performance.now();

    function frame(now: number) {
      const elapsed = now - startTime;
      const pA = pathARef.current;
      const pB = pathBRef.current;
      if (!pA || !pB) return;

      if (elapsed < APPROACH_MS) {
        // Phase 1: both segments extend from their handle positions toward the midpoint
        const t = easeOut(elapsed / APPROACH_MS);
        const ax = sourceX + (tipAFinalX - sourceX) * t;
        const ay = sourceY + (tipAFinalY - sourceY) * t;
        const bx = targetX + (tipBFinalX - targetX) * t;
        const by = targetY + (tipBFinalY - targetY) * t;
        pA.setAttribute('d', `M ${sourceX},${sourceY} L ${ax},${ay}`);
        pB.setAttribute('d', `M ${targetX},${targetY} L ${bx},${by}`);
        pA.removeAttribute('display');
        pB.removeAttribute('display');
      } else if (elapsed < SHAKE_END_MS) {
        // Phase 2: handle-ends fixed, free tips oscillate vertically (simulates handshake grip)
        const t = (elapsed - APPROACH_MS) / (SHAKE_END_MS - APPROACH_MS);
        const offsetY = Math.sin(t * Math.PI * 2 * SHAKE_CYCLES) * SHAKE_AMP;
        pA.setAttribute('d', `M ${sourceX},${sourceY} L ${tipAFinalX},${tipAFinalY + offsetY}`);
        pB.setAttribute('d', `M ${targetX},${targetY} L ${tipBFinalX},${tipBFinalY + offsetY}`);
      } else if (elapsed < TOTAL_MS) {
        // Phase 3: morph both segments into the final bezier by interpolating control points.
        // At t=0 both cp land on midpoint (approximates two straight lines meeting there);
        // at t=1 they reach their natural bezier positions.
        const t = easeIn((elapsed - SHAKE_END_MS) / (TOTAL_MS - SHAKE_END_MS));
        const icp1x = midX + (cp1x - midX) * t;
        const icp1y = midY + (cp1y - midY) * t;
        const icp2x = midX + (cp2x - midX) * t;
        const icp2y = midY + (cp2y - midY) * t;
        pA.setAttribute('d', `M ${sourceX},${sourceY} C ${icp1x},${icp1y} ${icp2x},${icp2y} ${targetX},${targetY}`);
        pB.setAttribute('display', 'none');
      }

      if (elapsed < TOTAL_MS) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        // Clear the transient flag so the normal edge takes over
        const { edges, setEdges } = useGraphStore.getState();
        setEdges(edges.map(e => e.id === id ? { ...e, data: { ...e.data, animating: false } } : e));
      }
    }

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isAnimating]); // captured coords are stable for the 700ms lifetime of this flag

  return (
    <>
      {hasGrad && (
        <defs>
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse"
            x1={sourceX} y1={sourceY} x2={targetX} y2={targetY}>
            <stop offset="0%" style={{ stopColor: `var(--color-edge-${sourceCategory})` }} />
            <stop offset="100%" style={{ stopColor: `var(--color-edge-${targetCategory})` }} />
          </linearGradient>
        </defs>
      )}

      {/* Handshake animation — two arms driven by rAF, visible for 700ms on new connections */}
      {isAnimating && (
        <>
          <path ref={pathARef} fill="none" stroke="var(--color-edge)" strokeWidth={2} strokeLinecap="round" />
          <path ref={pathBRef} fill="none" stroke="var(--color-edge)" strokeWidth={2} strokeLinecap="round" />
        </>
      )}

      {/* Normal edge — suppressed during animation */}
      {!isAnimating && (
        <>
          <path
            id={id}
            d={edgePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth={animated ? 2 : 1.5}
            strokeLinecap="round"
            style={{ transition: 'stroke 150ms', ...(style ?? {}) }}
          />

          {animated && (
            <path d={edgePath} fill="none" stroke="var(--color-accent)" strokeLinecap="round">
              <animate attributeName="stroke-width" values="2;4;2" dur="2s" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1" repeatCount="indefinite" />
            </path>
          )}

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
      )}
    </>
  );
}

export default memo(DeletableEdge);
