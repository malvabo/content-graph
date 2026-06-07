import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAllowedOrigin } from './_cors.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_TOKENS_CAP = 16384;

const MODEL_ALIASES: Record<string, string> = {
  'claude-haiku-4': 'claude-haiku-4-5-20251001',
  'claude-sonnet-4': 'claude-sonnet-4-6',
  'claude-opus-4': 'claude-opus-4-8',
  'claude-sonnet-4-20250514': 'claude-sonnet-4-6',
  'claude-haiku-4-20250414': 'claude-haiku-4-5-20251001',
  'claude-opus-4-20250514': 'claude-opus-4-8',
};
// Derived allowlist: every alias key + every resolved model name.
const ALLOWED_MODELS = new Set([
  ...Object.keys(MODEL_ALIASES),
  ...Object.values(MODEL_ALIASES),
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req);
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Device-ID');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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

  const resolvedModel = MODEL_ALIASES[model] ?? model;

  let upstream: Response;
  try {
    upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({ model: resolvedModel, max_tokens, system, messages, stream }),
    });
  } catch (e) {
    const err = e as { message?: string };
    return res.status(502).json({ error: err?.message ?? 'Upstream fetch failed' });
  }

  if (stream) {
    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => 'Upstream error');
      return res.status(upstream.status).json({ error: errText });
    }

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
