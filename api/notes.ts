import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

type NoteRow = {
  id: string;
  user_id: string;
  body: string;
  updated_at: string;
  is_pinned: boolean;
  tags: string[];
  kind: string;
};

type ClientNote = {
  id?: unknown;
  body?: unknown;
  updatedAt?: unknown;
  isPinned?: unknown;
  tags?: unknown;
  kind?: unknown;
};

function getSupabase(token: string) {
  return createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
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

function toClient(row: NoteRow) {
  return {
    id: row.id,
    body: row.body,
    updatedAt: row.updated_at,
    isPinned: row.is_pinned,
    tags: row.tags,
    kind: row.kind,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req);
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const sb = getSupabase(token);
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return res.status(401).json({ error: 'Invalid token' });

  try {
    if (req.method === 'GET') {
      const { data, error } = await sb
        .from('ios_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return res.json((data ?? []).map(r => toClient(r as NoteRow)));
    }

    if (req.method === 'POST') {
      const clientNotes = req.body?.notes;
      if (!Array.isArray(clientNotes)) {
        return res.status(400).json({ error: 'notes array required' });
      }

      if (clientNotes.length > 0) {
        // Fetch current server timestamps once for conflict resolution.
        const { data: existing } = await sb
          .from('ios_notes')
          .select('id, updated_at')
          .eq('user_id', user.id);

        const serverUpdatedAt = new Map(
          (existing ?? []).map((r) => [r.id as string, r.updated_at as string])
        );

        // Only upsert notes where the client version is at least as new as the
        // server version — prevents an offline device from overwriting edits
        // made on another device.
        const toUpsert = (clientNotes as ClientNote[])
          .filter((n) => {
            if (typeof n.id !== 'string') return false;
            const serverTs = serverUpdatedAt.get(n.id);
            if (!serverTs) return true;
            return new Date(n.updatedAt as string) >= new Date(serverTs);
          })
          .map((n) => ({
            id: n.id as string,
            user_id: user.id,
            body: typeof n.body === 'string' ? n.body : '',
            updated_at: typeof n.updatedAt === 'string' ? n.updatedAt : new Date().toISOString(),
            is_pinned: Boolean(n.isPinned),
            tags: Array.isArray(n.tags) ? (n.tags as string[]) : [],
            kind: typeof n.kind === 'string' ? n.kind : 'text',
          }));

        if (toUpsert.length > 0) {
          const { error } = await sb
            .from('ios_notes')
            .upsert(toUpsert, { onConflict: 'id' });
          if (error) throw error;
        }
      }

      // Return the full current server state so the client can merge.
      const { data: all, error: fetchErr } = await sb
        .from('ios_notes')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (fetchErr) throw fetchErr;
      return res.json({ notes: (all ?? []).map(r => toClient(r as NoteRow)) });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    const err = e as { message?: string; code?: string };
    console.error('notes handler:', err);
    return res.status(500).json({ error: err?.message ?? 'Server error', code: err?.code });
  }
}
