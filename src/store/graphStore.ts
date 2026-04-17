import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';
import { type Node, type Edge } from '@xyflow/react';
import { useExecutionStore } from './executionStore';
import { useOutputStore } from './outputStore';

export type NodeCategory = 'source' | 'transform' | 'generate' | 'output';
export type NodeStatus = 'idle' | 'running' | 'complete' | 'error' | 'warning' | 'stale';

export interface NodeConfig {
  [key: string]: unknown;
}

export interface ContentNode extends Node {
  data: {
    subtype: string;
    label: string;
    badge: string;
    category: NodeCategory;
    description: string;
    config: NodeConfig;
  };
}

export interface GraphState {
  nodes: ContentNode[];
  edges: Edge[];
  graphName: string;
  selectedNodeId: string | null;
  connectingNodeId: string | null;

  setGraphName: (name: string) => void;
  setConnectingNodeId: (id: string | null) => void;
  setSelectedNodeId: (id: string | null) => void;
  addNode: (node: ContentNode) => void;
  removeNode: (id: string) => void;
  updateNodeConfig: (id: string, config: Partial<NodeConfig>) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  addEdge: (edge: Edge) => void;
  removeEdge: (id: string) => void;
  duplicateNode: (id: string) => void;
  disconnectAllEdges: (nodeId: string) => void;
  setNodes: (nodes: ContentNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  clearGraph: () => void;
  workflowId: string | null;
  setWorkflowId: (id: string) => void;
  _hydrated: boolean;
}

export const useGraphStore = create<GraphState>()(
  temporal(
    persist(
      (set, get) => ({
        nodes: [],
        edges: [],
        graphName: 'Untitled Graph',
        selectedNodeId: null,
        connectingNodeId: null,
        workflowId: null,
        _hydrated: false,

        setGraphName: (name) => set({ graphName: name }),
        setWorkflowId: (id) => set({ workflowId: id }),
        setConnectingNodeId: (id) => set({ connectingNodeId: id }),
        setSelectedNodeId: (id) => set({ selectedNodeId: id }),

        addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),

        removeNode: (id) => {
          set((s) => ({
            nodes: s.nodes.filter((n) => n.id !== id),
            edges: s.edges.filter((e) => e.source !== id && e.target !== id),
            selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
          }));
          useExecutionStore.getState().resetNode(id);
          useOutputStore.getState().clearNode(id);
        },

        updateNodeConfig: (id, config) => set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, config: { ...n.data.config, ...config } } } : n
          ),
        })),

        updateNodePosition: (id, position) => set((s) => ({
          nodes: s.nodes.map((n) => (n.id === id ? { ...n, position } : n)),
        })),

        addEdge: (edge) => set((s) => ({ edges: [...s.edges, edge] })),

        removeEdge: (id) => set((s) => ({
          edges: s.edges.filter((e) => e.id !== id),
        })),

        duplicateNode: (id) => {
          const node = get().nodes.find((n) => n.id === id);
          if (!node) return;
          const newId = `${node.data.subtype}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
          const dup: ContentNode = {
            ...node,
            id: newId,
            deletable: true,
            position: { x: node.position.x + 40, y: node.position.y + 40 },
            data: { ...node.data, config: { ...node.data.config } },
          };
          set((s) => ({ nodes: [...s.nodes, dup] }));
        },

        disconnectAllEdges: (nodeId) => set((s) => ({
          edges: s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
        })),

        setNodes: (nodes) => set({ nodes }),
        setEdges: (edges) => set({ edges }),

        clearGraph: () => {
          set({ nodes: [], edges: [], selectedNodeId: null, workflowId: null });
          useExecutionStore.getState().resetAll();
          useOutputStore.getState().clearAll();
        },
      }),
      { name: 'content-graph-store',
        partialize: (state) => ({
          nodes: state.nodes.map(n => ({ id: n.id, type: n.type, position: n.position, deletable: n.deletable, data: n.data })),
          edges: state.edges,
          graphName: state.graphName,
        }),
        onRehydrateStorage: () => (_state, error) => {
          if (error) { localStorage.removeItem('content-graph-store'); }
          useGraphStore.setState({ _hydrated: true } as any);
        },
      }
    ),
    { limit: 50, partialize: (state) => ({ nodes: state.nodes, edges: state.edges, graphName: state.graphName }) }
  )
);
