import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function getSupabase(token: string) {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } });
}

function getToken(req: VercelRequest): string | null {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : null;
}

function getAllowedOrigin(req: VercelRequest): string {
  const origin = req.headers.origin ?? '';
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  if (/\.vercel\.app$/.test(origin)) return origin;
  return '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req);
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const sb = getSupabase(token);
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return res.status(401).json({ error: 'Invalid token' });

  try {
    if (req.method === 'GET') {
      const { data, error } = await sb.from('workflows').select('*').eq('user_id', user.id).order('saved_at', { ascending: false });
      if (error) throw error;
      return res.json((data ?? []).map(r => ({ id: r.id, name: r.name, nodes: r.nodes, edges: r.edges, savedAt: r.saved_at })));
    }

    if (req.method === 'POST') {
      const { id, name, nodes, edges, savedAt } = req.body;
      if (!id || !name) return res.status(400).json({ error: 'id and name required' });
      // Use compound conflict to prevent cross-user overwrites
      const { error } = await sb.from('workflows').upsert(
        { id, user_id: user.id, name, nodes, edges, saved_at: savedAt || new Date().toISOString() },
        { onConflict: 'id,user_id' }
      );
      if (error) throw error;
      return res.json({ id, name, nodes, edges, savedAt });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id required' });
      const { error } = await sb.from('workflows').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
      return res.status(204).end();
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}
