import {
  ReactFlow, Background, BackgroundVariant, Controls,
  type OnConnect, type OnNodesChange, type OnEdgesChange, type Node,
  applyNodeChanges, applyEdgeChanges, addEdge, type Connection,
} from '@xyflow/react';
import { useCallback, useRef, useEffect, useState } from 'react';
import { useGraphStore, type ContentNode } from '../../store/graphStore';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import BaseNode from '../nodes/BaseNode';
import NodeSpotlight from './NodeSpotlight';
import { useConnectionValidation } from '../../hooks/useConnectionValidation';

const nodeTypes = { contentNode: BaseNode };
const defaultEdgeOptions = { type: 'default', style: { stroke: '#C8D4CC', strokeWidth: 1.5, strokeDasharray: '5 4' } };

export default function GraphCanvas() {
  const { nodes, edges, setNodes, setEdges, setSelectedNodeId } = useGraphStore();
  const resetNode = useExecutionStore((s) => s.resetNode);
  const clearNodeOutput = useOutputStore((s) => s.clearNode);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [spotlight, setSpotlight] = useState<{ x: number; y: number } | null>(null);
  const { isValidConnection, tooltip } = useConnectionValidation(nodes, edges);

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
    (conn: Connection) => setEdges(addEdge({ ...conn, id: `e-${conn.source}-${conn.target}` }, edges)),
    [edges, setEdges]
  );
  const onNodesDelete = useCallback(
    (deleted: Node[]) => { deleted.forEach((n) => { resetNode(n.id); clearNodeOutput(n.id); }); },
    [resetNode, clearNodeOutput]
  );

  return (
    <div ref={wrapperRef} className="flex-1 h-full outline-none" tabIndex={0}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('.react-flow__node')) return;
        const bounds = wrapperRef.current?.getBoundingClientRect();
        if (!bounds) return;
        setSpotlight({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
      }}>
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onConnect={onConnect} onNodesDelete={onNodesDelete}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes} defaultEdgeOptions={defaultEdgeOptions}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => { setSelectedNodeId(null); setSpotlight(null); }}
        deleteKeyCode={['Backspace', 'Delete']}
        fitView={false} panOnScroll={false} selectionOnDrag={false}
        proOptions={{ hideAttribution: true }}>
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#B8D8BE" />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>

      {tooltip && (
        <div className="absolute z-50 px-3 py-1.5 bg-[#18181b] text-white text-[11px] rounded-lg shadow-lg pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translateX(-50%)' }}>{tooltip.message}</div>
      )}

      {spotlight && <NodeSpotlight x={spotlight.x} y={spotlight.y} onClose={() => setSpotlight(null)} onSelect={() => setSpotlight(null)} />}
    </div>
  );
}
