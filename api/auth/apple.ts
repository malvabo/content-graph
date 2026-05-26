import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createPublicKey, verify, createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
const DEFAULT_IOS_BUNDLE_ID = 'com.up200.app';

type AppleJWK = {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
};

type AppleJWKS = {
  keys: AppleJWK[];
};

type AppleTokenHeader = {
  alg: string;
  kid: string;
};

type AppleTokenPayload = {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string;
  email?: string;
  email_verified?: string | boolean;
  is_private_email?: string | boolean;
};

type AppleAuthBody = {
  identityToken?: unknown;
  authorizationCode?: unknown;
  user?: unknown;
  email?: unknown;
  fullName?: unknown;
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let cachedAppleKeys: { keys: AppleJWK[]; expiresAt: number } | null = null;

function getAllowedOrigin(req: VercelRequest): string {
  const origin = req.headers.origin ?? '';
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  if (/\.vercel\.app$/.test(origin)) return origin;
  return '';
}

function base64UrlToBuffer(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return Buffer.from(padded, 'base64');
}

function base64UrlJson<T>(value: string): T {
  return JSON.parse(base64UrlToBuffer(value).toString('utf8')) as T;
}

async function getAppleKeys(): Promise<AppleJWK[]> {
  if (cachedAppleKeys && cachedAppleKeys.expiresAt > Date.now()) {
    return cachedAppleKeys.keys;
  }

  const response = await fetch(APPLE_KEYS_URL);
  if (!response.ok) {
    throw new HttpError(502, 'Could not fetch Apple sign-in keys');
  }

  const data = await response.json() as AppleJWKS;
  cachedAppleKeys = {
    keys: data.keys,
    expiresAt: Date.now() + 60 * 60 * 1000,
  };

  return data.keys;
}

function getExpectedAudience(): string {
  return process.env.APPLE_CLIENT_ID || process.env.IOS_BUNDLE_ID || DEFAULT_IOS_BUNDLE_ID;
}

async function verifyAppleIdentityToken(identityToken: string): Promise<AppleTokenPayload> {
  const parts = identityToken.split('.');
  if (parts.length !== 3) {
    throw new HttpError(400, 'Invalid Apple identity token');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = base64UrlJson<AppleTokenHeader>(encodedHeader);
  const payload = base64UrlJson<AppleTokenPayload>(encodedPayload);

  if (header.alg !== 'RS256') {
    throw new HttpError(401, 'Unsupported Apple identity token algorithm');
  }

  const keys = await getAppleKeys();
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) {
    throw new HttpError(401, 'Unknown Apple identity token key');
  }

  const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
  const signatureValid = verify(
    'RSA-SHA256',
    new Uint8Array(Buffer.from(`${encodedHeader}.${encodedPayload}`)),
    publicKey,
    new Uint8Array(base64UrlToBuffer(encodedSignature))
  );

  if (!signatureValid) {
    throw new HttpError(401, 'Invalid Apple identity token signature');
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== 'https://appleid.apple.com') {
    throw new HttpError(401, 'Invalid Apple identity token issuer');
  }
  if (payload.aud !== getExpectedAudience()) {
    throw new HttpError(401, 'Invalid Apple identity token audience');
  }
  if (payload.exp <= now) {
    throw new HttpError(401, 'Expired Apple identity token');
  }
  if (!payload.sub) {
    throw new HttpError(401, 'Apple identity token is missing a subject');
  }

  return payload;
}

function asOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function issueSessionToken(sub: string): string | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  const exp = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60; // 90 days
  const payloadB64 = Buffer.from(JSON.stringify({ sub, exp })).toString('base64url');
  const sig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

async function persistAppleUser(payload: AppleTokenPayload, body: AppleAuthBody): Promise<boolean> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return false;
  }

  const sb = createClient(supabaseUrl, serviceRoleKey);
  const email = payload.email ?? asOptionalString(body.email);
  const fullName = asOptionalString(body.fullName);

  const { error } = await sb
    .from('apple_auth_users')
    .upsert(
      {
        apple_sub: payload.sub,
        email,
        full_name: fullName,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'apple_sub' }
    );

  if (error) {
    throw new HttpError(500, error.message);
  }

  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req);
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = (req.body ?? {}) as AppleAuthBody;
    const identityToken = asOptionalString(body.identityToken);
    if (!identityToken) {
      return res.status(400).json({ error: 'identityToken required' });
    }

    const payload = await verifyAppleIdentityToken(identityToken);
    const clientAppleUser = asOptionalString(body.user);
    if (clientAppleUser && clientAppleUser !== payload.sub) {
      throw new HttpError(401, 'Apple user does not match identity token');
    }

    const backendStored = await persistAppleUser(payload, body);
    const sessionToken = issueSessionToken(payload.sub);

    return res.status(200).json({
      user: {
        id: payload.sub,
        email: payload.email ?? asOptionalString(body.email),
        fullName: asOptionalString(body.fullName),
        emailVerified: payload.email_verified ?? null,
        privateEmail: payload.is_private_email ?? null,
      },
      sessionToken,
      backendStored,
      authorizationCodeReceived: Boolean(asOptionalString(body.authorizationCode)),
    });
  } catch (e) {
    const err = e as { message?: string; status?: number; code?: string };
    const status = err.status ?? 500;
    console.error('apple auth handler:', err);
    return res.status(status).json({
      error: err.message || 'Server error',
      code: err.code,
    });
  }
}
