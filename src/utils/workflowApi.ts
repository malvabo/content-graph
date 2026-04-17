import type { ContentNode } from '../store/graphStore';
import type { Edge } from '@xyflow/react';
import { supabase } from '../lib/supabase';

export interface SavedWorkflow {
  id: string;
  name: string;
  nodes: ContentNode[];
  edges: Edge[];
  savedAt: string;
}

const API = '/api/workflows';

async function authHeaders(): Promise<HeadersInit> {
  if (!supabase) return { 'Content-Type': 'application/json' };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' };
}

export async function loadWorkflows(): Promise<SavedWorkflow[]> {
  try {
    const res = await fetch(API, { headers: await authHeaders() });
    if (!res.ok) throw new Error(res.statusText);
    return await res.json() as SavedWorkflow[];
  } catch { return []; }
}

export async function saveWorkflow(workflow: SavedWorkflow): Promise<void> {
  try {
    await fetch(API, { method: 'POST', headers: await authHeaders(), body: JSON.stringify(workflow) });
  } catch { /* silent */ }
}

export async function deleteWorkflow(id: string): Promise<void> {
  try {
    await fetch(`${API}?id=${id}`, { method: 'DELETE', headers: await authHeaders() });
  } catch { /* silent */ }
}
