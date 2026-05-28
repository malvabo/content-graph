import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getAllowedOrigin } from '../_cors';

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
    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as { sub?: string; exp?: number };
    if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

function issueSessionToken(sub: string): { token: string; expiresAt: number } | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  const expiresAt = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;
  const payloadB64 = Buffer.from(JSON.stringify({ sub, exp: expiresAt })).toString('base64url');
  const sig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return { token: `${payloadB64}.${sig}`, expiresAt };
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
  if (!sub) return res.status(401).json({ error: 'Invalid or expired session token' });

  const issued = issueSessionToken(sub);
  if (!issued) return res.status(500).json({ error: 'Token signing not configured' });

  return res.status(200).json({
    sessionToken: issued.token,
    sessionTokenExpiresAt: issued.expiresAt,
  });
}
