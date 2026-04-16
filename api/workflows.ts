import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

const KEY = 'workflows';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const items = await kv.get<unknown[]>(KEY) ?? [];
      return res.json(items);
    }

    if (req.method === 'POST') {
      const workflow = req.body;
      if (!workflow?.id || !workflow?.name) return res.status(400).json({ error: 'id and name required' });
      const items = await kv.get<unknown[]>(KEY) ?? [];
      const updated = [workflow, ...items.filter((w: any) => w.id !== workflow.id)];
      await kv.set(KEY, updated);
      return res.json(workflow);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id required' });
      const items = await kv.get<unknown[]>(KEY) ?? [];
      const updated = items.filter((w: any) => w.id !== id);
      await kv.set(KEY, updated);
      return res.status(204).end();
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e: any) {
    // KV not configured — return 503 so frontend falls back to localStorage
    res.status(503).json({ error: 'Storage unavailable', detail: e.message });
  }
}
