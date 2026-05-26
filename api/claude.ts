import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'node:crypto';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

function verifySessionToken(token: string): boolean {
  const secret = process.env.JWT_SECRET;
  if (!secret) return false;

  const dotIdx = token.lastIndexOf('.');
  if (dotIdx === -1) return false;

  const payloadB64 = token.slice(0, dotIdx);
  const sigB64 = token.slice(dotIdx + 1);

  const expected = createHmac('sha256', secret).update(payloadB64).digest('base64url');

  try {
    const a = Buffer.from(sigB64, 'base64url');
    const b = Buffer.from(expected, 'base64url');
    if (a.length !== b.length) return false;
    if (!timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as { exp?: number };
    return typeof payload.exp === 'number' && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  if (!verifySessionToken(auth.slice(7))) return res.status(401).json({ error: 'Invalid or expired session' });

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

  let upstream: Response;
  try {
    upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens, system, messages, stream }),
    });
  } catch (e) {
    const err = e as { message?: string };
    return res.status(502).json({ error: err?.message ?? 'Upstream fetch failed' });
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
