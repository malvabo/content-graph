import {
  ReactFlow, Background, BackgroundVariant, Controls,
  type OnConnect, type OnNodesChange, type OnEdgesChange, type Node,
  applyNodeChanges, applyEdgeChanges, addEdge, type Connection, useReactFlow,
} from '@xyflow/react';
import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { useGraphStore, type ContentNode } from '../../store/graphStore';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import BaseNode from '../nodes/BaseNode';
import NodeSpotlight from './NodeSpotlight';
import RunWaveOverlay from './RunWaveOverlay';
import { useConnectionValidation } from '../../hooks/useConnectionValidation';
import type { NodeDef } from '../../utils/nodeDefs';

const nodeTypes = { contentNode: BaseNode };
const defaultEdgeOptions = { type: 'default', style: { stroke: '#D5D0C8', strokeWidth: 1.5, strokeDasharray: '5 4' } };

export default function GraphCanvas() {
  const { nodes, edges, setNodes, setEdges, setSelectedNodeId, addNode } = useGraphStore();
  const { screenToFlowPosition } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const [spotlight, setSpotlight] = useState<{ x: number; y: number; flowX: number; flowY: number } | null>(null);
  const { isValidConnection, tooltip } = useConnectionValidation(nodes, edges);
  const executionStatus = useExecutionStore((s) => s.status);

  const styledEdges = useMemo(() => edges.map((e) => ({
    ...e,
    animated: executionStatus[e.target] === 'running',
  })), [edges, executionStatus]);

  useEffect(() => { wrapperRef.current?.focus(); }, []);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes(applyNodeChanges(changes, nodes) as ContentNode[]),
    [nodes, setNodes]
  );
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges(applyEdgeChanges(changes, edges)),
    [edges, setEdges]
  );
  const onConnect: OnConnect = useCallback(
    (conn: Connection) => {
      if (!isValidConnection(conn)) return;
      setEdges(addEdge({ ...conn, id: `e-${conn.source}-${conn.target}-${Date.now()}` }, edges));
    },
    [edges, setEdges, isValidConnection]
  );
  const onNodesDelete = useCallback(
    (deleted: Node[]) => { deleted.forEach((n) => { useExecutionStore.getState().resetNode(n.id); useOutputStore.getState().clearNode(n.id); }); },
    []
  );

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/content-graph-node');
    if (!raw) return;
    const def: NodeDef = JSON.parse(raw);
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const node: ContentNode = {
      id: `${def.subtype}-${Date.now()}`,
      type: 'contentNode',
      position: { x: position.x - 120, y: position.y - 40 },
      deletable: true,
      data: { subtype: def.subtype, label: def.label, badge: def.badge, category: def.category, description: def.description, config: {} },
    };
    addNode(node);
  }, [addNode, screenToFlowPosition]);

  return (
    <div ref={wrapperRef} className="flex-1 h-full outline-none relative" tabIndex={0}
      onDragOver={onDragOver} onDrop={onDrop}
      onMouseMove={(e) => {
        if (spotlightRef.current) {
          const rect = wrapperRef.current!.getBoundingClientRect();
          spotlightRef.current.style.transform = `translate(${e.clientX - rect.left - 80}px, ${e.clientY - rect.top - 80}px)`;
          spotlightRef.current.style.opacity = '1';
        }
      }}
      onMouseLeave={() => { if (spotlightRef.current) spotlightRef.current.style.opacity = '0'; }}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('.react-flow__node')) return;
        const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const bounds = wrapperRef.current?.getBoundingClientRect();
        if (!bounds) return;
        setSpotlight({ x: e.clientX - bounds.left, y: e.clientY - bounds.top, flowX: pos.x, flowY: pos.y });
      }}>
      <ReactFlow
        nodes={nodes} edges={styledEdges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onConnect={onConnect} onNodesDelete={onNodesDelete}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes} defaultEdgeOptions={defaultEdgeOptions}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => { setSelectedNodeId(null); setSpotlight(null); }}
        deleteKeyCode={['Backspace', 'Delete']}
        fitView={false} panOnScroll={false} selectionOnDrag={false}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'var(--cg-canvas)' }}>
        <Background variant={BackgroundVariant.Dots} gap={14} size={1.5} color="#D5D0C8" />
        <RunWaveOverlay />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>

      {tooltip && (
        <div className="absolute z-50 px-3 py-1.5 rounded-lg shadow-lg pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translateX(-50%)', background: 'var(--cg-dark)', color: 'var(--cg-dark-text)', font: '400 14px/1.5 var(--font-sans)' }}>
          {tooltip.message}
        </div>
      )}

      {spotlight && <NodeSpotlight x={spotlight.x} y={spotlight.y} flowX={spotlight.flowX} flowY={spotlight.flowY} onClose={() => setSpotlight(null)} onSelect={() => setSpotlight(null)} />}

      <div ref={spotlightRef} className="absolute pointer-events-none rounded-full"
        style={{ width: 160, height: 160, background: 'radial-gradient(circle, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.12) 50%, transparent 100%)', mixBlendMode: 'color-burn', opacity: 0, transition: 'opacity 150ms', zIndex: 1 }} />
    </div>
  );
}
