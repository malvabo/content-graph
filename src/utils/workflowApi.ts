import type { ContentNode } from '../store/graphStore';
import type { Edge } from '@xyflow/react';

export interface SavedWorkflow {
  id: string;
  name: string;
  nodes: ContentNode[];
  edges: Edge[];
  savedAt: string;
}

const STORAGE_KEY = 'workflow-library';
const API = '/api/workflows';

/* localStorage helpers */
function localLoad(): SavedWorkflow[] {
  try { const p = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(p) ? p : []; }
  catch { return []; }
}
function localPersist(items: SavedWorkflow[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }

/* Try API, fall back to localStorage on any failure */
export async function loadWorkflows(): Promise<SavedWorkflow[]> {
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error(res.statusText);
    const remote = await res.json() as SavedWorkflow[];
    localPersist(remote); // sync local cache
    return remote;
  } catch {
    return localLoad();
  }
}

export async function saveWorkflow(workflow: SavedWorkflow): Promise<void> {
  localPersist([workflow, ...localLoad().filter(w => w.id !== workflow.id)]);
  try {
    const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(workflow) });
    if (!res.ok) throw new Error(res.statusText);
  } catch { /* localStorage already updated */ }
}

export async function deleteWorkflow(id: string): Promise<void> {
  localPersist(localLoad().filter(w => w.id !== id));
  try {
    const res = await fetch(`${API}?id=${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(res.statusText);
  } catch { /* localStorage already updated */ }
}
