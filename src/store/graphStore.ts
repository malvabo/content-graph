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

  setGraphName: (name: string) => void;
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
}

export const useGraphStore = create<GraphState>()(
  temporal(
    persist(
      (set, get) => ({
        nodes: [],
        edges: [],
        graphName: 'Untitled Graph',
        selectedNodeId: null,

        setGraphName: (name) => set({ graphName: name }),
        setSelectedNodeId: (id) => set({ selectedNodeId: id }),

        addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),

        removeNode: (id) => {
          // Clean up execution and output stores
          const { resetNode } = useExecutionStore.getState();
          const { clearNode } = useOutputStore.getState();
          resetNode(id);
          clearNode(id);
          set((s) => ({
            nodes: s.nodes.filter((n) => n.id !== id),
            edges: s.edges.filter((e) => e.source !== id && e.target !== id),
            selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
          }));
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
          const newId = `${node.data.subtype}-${Date.now()}`;
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

        clearGraph: () => set({ nodes: [], edges: [], selectedNodeId: null }),
      }),
      { name: 'content-graph-store',
        partialize: (state) => ({
          nodes: state.nodes.map(n => ({ id: n.id, type: n.type, position: n.position, deletable: n.deletable, data: n.data })),
          edges: state.edges,
          graphName: state.graphName,
        }),
      }
    ),
    { limit: 50 }
  )
);
