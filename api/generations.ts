import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getAllowedOrigin } from './_cors';

type GenRow = {
  id: string;
  user_id: string;
  note_id: string;
  source_note_ids: string[];
  source_labels: string[];
  output_type: string;
  content: string;
  date: string;
};

type ClientGen = {
  id?: unknown;
  noteId?: unknown;
  sourceNoteIds?: unknown;
  sourceLabels?: unknown;
  outputType?: unknown;
  content?: unknown;
  date?: unknown;
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


function toClient(row: GenRow) {
  return {
    id: row.id,
    noteId: row.note_id,
    sourceNoteIds: row.source_note_ids,
    sourceLabels: row.source_labels,
    outputType: row.output_type,
    content: row.content,
    date: row.date,
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
        .from('ios_generations')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });
      if (error) throw error;
      return res.json((data ?? []).map(r => toClient(r as GenRow)));
    }

    if (req.method === 'POST') {
      const clientGens = req.body?.generations;
      if (!Array.isArray(clientGens)) {
        return res.status(400).json({ error: 'generations array required' });
      }

      if (clientGens.length > 0) {
        const toUpsert = (clientGens as ClientGen[])
          .filter((g) => typeof g.id === 'string')
          .map((g) => ({
            id: g.id as string,
            user_id: user.id,
            note_id: typeof g.noteId === 'string' ? g.noteId : '',
            source_note_ids: Array.isArray(g.sourceNoteIds) ? (g.sourceNoteIds as string[]) : [],
            source_labels: Array.isArray(g.sourceLabels) ? (g.sourceLabels as string[]) : [],
            output_type: typeof g.outputType === 'string' ? g.outputType : '',
            content: typeof g.content === 'string' ? g.content : '',
            date: typeof g.date === 'string' ? g.date : new Date().toISOString(),
          }));

        if (toUpsert.length > 0) {
          const { error } = await sb
            .from('ios_generations')
            .upsert(toUpsert, { onConflict: 'id' });
          if (error) throw error;
        }
      }

      const { data: all, error: fetchErr } = await sb
        .from('ios_generations')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });
      if (fetchErr) throw fetchErr;
      return res.json({ generations: (all ?? []).map(r => toClient(r as GenRow)) });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    const err = e as { message?: string; code?: string };
    console.error('generations handler:', err);
    return res.status(500).json({ error: err?.message ?? 'Server error', code: err?.code });
  }
}
