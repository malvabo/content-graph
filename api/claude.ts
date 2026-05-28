import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { getAllowedOrigin } from './_cors';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const FREE_LIMIT = parseInt(process.env.FREE_GENERATION_LIMIT ?? '3', 10);
const MAX_TOKENS_CAP = 8192;
const ALLOWED_MODELS = new Set([
  'claude-haiku-4-5',
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-5',
  'claude-sonnet-4-5-20251001',
  'claude-sonnet-4-6',
  'claude-opus-4-5',
  'claude-opus-4-8',
]);

function verifySessionToken(token: string): string | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  const dotIdx = token.lastIndexOf('.');
  if (dotIdx === -1) return null;

  const payloadB64 = token.slice(0, dotIdx);
  const sigB64 = token.slice(dotIdx + 1);

  const expected = createHmac('sha256', secret).update(payloadB64).digest('base64url');

  try {
    const a = Buffer.from(sigB64, 'base64url');
    const b = Buffer.from(expected, 'base64url');
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as { sub?: string; exp?: number };
    if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function checkLimit(sub: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false; // fail closed — don't allow if rate-limit DB is unavailable

  const { data } = await sb
    .from('ai_generation_counts')
    .select('count')
    .eq('user_sub', sub)
    .maybeSingle();

  const count = (data as { count: number } | null)?.count ?? 0;
  return count < FREE_LIMIT;
}

async function incrementUsage(sub: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.rpc('increment_ai_usage', { p_sub: sub });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req);
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  const sub = verifySessionToken(auth.slice(7));
  if (!sub) return res.status(401).json({ error: 'Invalid or expired session' });

  const allowed = await checkLimit(sub);
  if (!allowed) {
    return res.status(402).json({
      type: 'error',
      error: {
        type: 'limit_exceeded',
        message: `You've used all ${FREE_LIMIT} free generations.`,
      },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server misconfigured' });

  const { model, max_tokens, system, messages, stream } = req.body as {
    model?: string;
    max_tokens?: number;
    system?: string;
    messages?: unknown[];
    stream?: boolean;
  };

  if (!model || !max_tokens || !messages) {
    return res.status(400).json({ error: 'model, max_tokens, and messages are required' });
  }
  if (!ALLOWED_MODELS.has(model)) {
    return res.status(400).json({ error: 'Unsupported model' });
  }
  if (typeof max_tokens !== 'number' || max_tokens < 1 || max_tokens > MAX_TOKENS_CAP) {
    return res.status(400).json({ error: `max_tokens must be between 1 and ${MAX_TOKENS_CAP}` });
  }

  let upstream: Response;
  try {
    upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({ model, max_tokens, system, messages, stream }),
    });
  } catch (e) {
    const err = e as { message?: string };
    return res.status(502).json({ error: err?.message ?? 'Upstream fetch failed' });
  }

  if (upstream.status === 200) {
    await incrementUsage(sub);
  }

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(upstream.status);

    if (!upstream.body) return res.end();

    const reader = upstream.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } finally {
      res.end();
    }
  } else {
    const data = await upstream.json() as unknown;
    return res.status(upstream.status).json(data);
  }
}
