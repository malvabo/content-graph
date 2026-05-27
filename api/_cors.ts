import type { VercelRequest } from '@vercel/node';

const PRODUCTION_ORIGIN = 'https://content-graph-five.vercel.app';

export function getAllowedOrigin(req: VercelRequest): string {
  const origin = req.headers.origin ?? '';
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  if (origin === PRODUCTION_ORIGIN) return origin;
  return '';
}
