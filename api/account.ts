import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getAllowedOrigin } from './_cors';

function getToken(req: VercelRequest): string | null {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req);
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return res.status(503).json({ error: 'Service not configured' });
  }

  // Verify the caller is who they claim to be.
  const userSb = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user } } = await userSb.auth.getUser();
  if (!user) return res.status(401).json({ error: 'Invalid or expired token' });

  const adminSb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Remove the apple_auth_users row — its FK is ON DELETE SET NULL, so it
    // would otherwise become an orphan when auth.users is deleted below.
    await adminSb
      .from('apple_auth_users')
      .delete()
      .eq('supabase_user_id', user.id);

    // Deleting the auth user cascades to:
    //   ios_notes, ios_generations, workflows, user_settings
    // (all have user_id → auth.users ON DELETE CASCADE)
    const { error } = await adminSb.auth.admin.deleteUser(user.id);
    if (error) {
      console.error('account delete: admin.deleteUser failed', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(204).end();
  } catch (e) {
    const err = e as { message?: string };
    console.error('account delete handler:', err);
    return res.status(500).json({ error: err.message ?? 'Server error' });
  }
}
