import {
  ReactFlow, Controls, MiniMap,
  type OnConnect, type OnNodesChange, type OnEdgesChange, type Node,
  applyNodeChanges, applyEdgeChanges, addEdge, type Connection, useReactFlow,
} from '@xyflow/react';
import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { useGraphStore, type ContentNode } from '../../store/graphStore';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import BaseNode from '../nodes/BaseNode';
import DeletableEdge from './DeletableEdge';
import NodeSpotlight from './NodeSpotlight';
import DotSpotlight from './DotSpotlight';
import RunWaveOverlay from './RunWaveOverlay';
import { useConnectionValidation } from '../../hooks/useConnectionValidation';
import ContextMenu, { useContextMenu } from './ContextMenu';
import { useNodeExecution } from '../../hooks/useNodeExecution';
import { aiExecute } from '../../utils/aiExecutor';
import type { NodeDef } from '../../utils/nodeDefs';

const nodeTypes = { contentNode: BaseNode };
const edgeTypes = { deletable: DeletableEdge };
const defaultEdgeOptions = { type: 'deletable', style: { stroke: 'var(--color-edge)', strokeWidth: 1.5, strokeDasharray: '5 4' } };

export default function GraphCanvas() {
  const { nodes, edges, setNodes, setEdges, setSelectedNodeId, setConnectingNodeId, addNode } = useGraphStore();
  const { screenToFlowPosition } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [spotlight, setSpotlight] = useState<{ x: number; y: number; flowX: number; flowY: number } | null>(null);
  const { isValidConnection, tooltip } = useConnectionValidation(nodes, edges);
  const { menu, onNodeContextMenu, close: closeMenu } = useContextMenu();
  const executionStatus = useExecutionStore((s) => s.status);

  // First-run tooltip: show once when nodes appear for the first time
  const [showFirstRun, setShowFirstRun] = useState(false);
  useEffect(() => {
    if (nodes.length > 0 && !localStorage.getItem('cg-first-run-seen')) {
      setShowFirstRun(true);
    }
  }, [nodes.length]);
  const dismissFirstRun = useCallback(() => {
    setShowFirstRun(false);
    localStorage.setItem('cg-first-run-seen', '1');
  }, []);

  const styledEdges = useMemo(() => edges.map((e) => ({
    ...e,
    animated: executionStatus[e.source] === 'running' || executionStatus[e.target] === 'running',
  })), [edges, executionStatus]);

  useEffect(() => { wrapperRef.current?.focus(); }, []);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const current = useGraphStore.getState().nodes;
      setNodes(applyNodeChanges(changes, current) as ContentNode[]);
    },
    [setNodes]
  );
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const current = useGraphStore.getState().edges;
      setEdges(applyEdgeChanges(changes, current));
    },
    [setEdges]
  );
  const onConnect: OnConnect = useCallback(
    (conn: Connection) => {
      if (!isValidConnection(conn)) return;
      const current = useGraphStore.getState().edges;
      setEdges(addEdge({ ...conn, id: `e-${conn.source}-${conn.target}-${Date.now()}-${Math.random().toString(36).slice(2,7)}` }, current));
    },
    [setEdges, isValidConnection]
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
    try {
      const def: NodeDef = JSON.parse(raw);
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const node: ContentNode = {
        id: `${def.subtype}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        type: 'contentNode',
        position: { x: position.x - 120, y: position.y - 40 },
        deletable: true,
        data: { subtype: def.subtype, label: def.label, badge: def.badge, category: def.category, description: def.description, config: {} },
      };
      addNode(node);
    } catch { return; }
  }, [addNode, screenToFlowPosition]);

  const selectedNodes = useMemo(() => nodes.filter(n => n.selected), [nodes]);
  const { runAll } = useNodeExecution();

  const handleRunSelected = useCallback(() => {
    const ids = new Set(selectedNodes.map(n => n.id));
    runAll(async (input, config, subtype) => aiExecute(input, config, subtype), ids);
  }, [selectedNodes, runAll]);

  return (
    <div ref={wrapperRef} className="flex-1 h-full outline-none relative" tabIndex={0}
      onDragOver={onDragOver} onDrop={onDrop}
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
        onConnectStart={(_, { nodeId }) => setConnectingNodeId(nodeId ?? null)}
        onConnectEnd={() => setConnectingNodeId(null)}
        isValidConnection={isValidConnection}
        connectionRadius={80}
        nodeTypes={nodeTypes} edgeTypes={edgeTypes} defaultEdgeOptions={defaultEdgeOptions}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onNodeContextMenu={(e, node) => onNodeContextMenu(e, node.id)}
        onPaneClick={() => { setSelectedNodeId(null); setSpotlight(null); dismissFirstRun(); closeMenu(); }}
        deleteKeyCode={['Backspace', 'Delete']}
        fitView={false} panOnScroll selectionOnDrag={false}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'var(--color-bg)' }}>
        <DotSpotlight />
        <RunWaveOverlay />
        <Controls showInteractive={false} position="bottom-right" />
        <MiniMap position="bottom-right" pannable zoomable nodeColor="var(--color-border-strong)" maskColor="var(--color-overlay-backdrop)" style={{ width: 120, height: 80, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)', right: 60, background: 'var(--color-bg-surface)' }} />
      </ReactFlow>

      {tooltip && (
        <div className="absolute z-50 px-3 py-1.5 rounded-lg shadow-lg pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translateX(-50%)', background: 'var(--color-bg-tooltip)', color: 'var(--color-text-inverse)', fontWeight: 400, fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-snug)', fontFamily: 'var(--font-sans)' }}>
          {tooltip.message}
        </div>
      )}

      {spotlight && <NodeSpotlight x={spotlight.x} y={spotlight.y} flowX={spotlight.flowX} flowY={spotlight.flowY} onClose={() => setSpotlight(null)} onSelect={() => setSpotlight(null)} />}

      {showFirstRun && (
        <div onClick={dismissFirstRun} style={{
          position: 'absolute', bottom: 64, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--color-text-primary)', color: 'var(--color-text-inverse)', borderRadius: 'var(--radius-md)',
          padding: 'var(--space-2) var(--space-4)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
          boxShadow: 'var(--shadow-md)', cursor: 'pointer', zIndex: 50, whiteSpace: 'nowrap',
        }}>
          {nodes.some(n => n.data.category === 'generate') ? 'Hit ▶ Run All to generate everything' : 'Add nodes with the + button below'}
        </div>
      )}

      {menu && <ContextMenu x={menu.x} y={menu.y} nodeId={menu.nodeId} onClose={closeMenu} />}

      {selectedNodes.length > 1 && (
        <div style={{
          position: 'absolute', top: 'var(--space-4)', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)',
          background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)', zIndex: 100, fontFamily: 'var(--font-sans)',
          animation: 'fadeIn 150ms ease',
        }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-secondary)', padding: '0 var(--space-1)', whiteSpace: 'nowrap' }}>
            {selectedNodes.length} selected
          </span>
          <div style={{ width: 1, height: 20, background: 'var(--color-border-default)' }} />
          <button className="btn btn-run btn-sm" onClick={handleRunSelected}>▶ Run</button>
        </div>
      )}
    </div>
  );
}
