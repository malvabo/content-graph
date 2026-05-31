import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createPublicKey, verify, createHash, createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { getAllowedOrigin } from '../_cors.js';

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
  nonce?: string;
  nonce_supported?: boolean;
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
  nonce?: unknown;
};

type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let cachedAppleKeys: { keys: AppleJWK[]; expiresAt: number } | null = null;

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

// Resolves the email to use for the Supabase user. On first sign-in Apple
// provides the email; on subsequent sign-ins it is absent. We fall back to
// the email stored in apple_auth_users, then to a deterministic synthetic
// address so the Supabase user always has something in the email field.
function resolveEmail(
  payload: AppleTokenPayload,
  body: AppleAuthBody,
  storedEmail: string | null
): string {
  return (
    payload.email ??
    asOptionalString(body.email) ??
    storedEmail ??
    `${payload.sub}@privaterelay.appleid.com`
  );
}

// Creates or returns the existing Supabase auth user for this Apple sub, then
// issues a fresh session via the admin generateLink + verifyOtp path. This
// does not rely on Supabase's Apple provider being configured.
async function getOrCreateSession(
  payload: AppleTokenPayload,
  body: AppleAuthBody
): Promise<{ session: SupabaseSession; supabaseUserId: string } | null> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey || !anonKey) return null;

  const adminSb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Look up existing record for a previously linked Supabase user + stored email.
  const { data: existingRecord, error: lookupError } = await adminSb
    .from('apple_auth_users')
    .select('supabase_user_id, email')
    .eq('apple_sub', payload.sub)
    .maybeSingle();
  if (lookupError) {
    console.error('apple auth: apple_auth_users lookup failed', lookupError);
  }

  const storedEmail = (existingRecord?.email as string | null) ?? null;
  const email = resolveEmail(payload, body, storedEmail);
  let supabaseUserId = (existingRecord?.supabase_user_id as string | null) ?? null;

  if (!supabaseUserId) {
    // First-time link: create a Supabase auth user for this Apple account.
    const { data: created, error: createError } = await adminSb.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        apple_sub: payload.sub,
        full_name: asOptionalString(body.fullName),
      },
    });

    if (createError) {
      // Email already claimed by a prior partial run — find that user.
      const { data: list } = await adminSb.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const match = list?.users.find((u) => u.email === email);
      if (match) {
        supabaseUserId = match.id;
      } else {
        console.error('apple auth: could not create Supabase user', createError);
        return null;
      }
    } else {
      supabaseUserId = created.user.id;
    }
  }

  // Generate a one-time OTP and immediately exchange it for a session.
  // This avoids any email being sent and produces a real Supabase JWT pair.
  const { data: linkData, error: linkError } = await adminSb.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (linkError || !linkData?.properties?.email_otp) {
    console.error('apple auth: could not generate magic link', linkError);
    return null;
  }

  const anonSb = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: sessionData, error: sessionError } = await anonSb.auth.verifyOtp({
    email,
    token: linkData.properties.email_otp,
    type: 'email',
  });

  if (sessionError || !sessionData?.session) {
    console.error('apple auth: could not verify OTP for session', sessionError);
    return null;
  }

  return {
    session: {
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      expires_at: sessionData.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
    },
    supabaseUserId,
  };
}

function issueSessionToken(sub: string): string | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  const exp = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;
  const payloadB64 = Buffer.from(JSON.stringify({ sub, exp })).toString('base64url');
  const sig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

async function persistAppleUser(
  payload: AppleTokenPayload,
  body: AppleAuthBody,
  supabaseUserId: string | null
): Promise<boolean> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return false;
  }

  const sb = createClient(supabaseUrl, serviceRoleKey);
  const email = payload.email ?? asOptionalString(body.email);
  const fullName = asOptionalString(body.fullName);

  const record: Record<string, unknown> = {
    apple_sub: payload.sub,
    email,
    full_name: fullName,
    last_seen_at: new Date().toISOString(),
  };
  if (supabaseUserId) {
    record.supabase_user_id = supabaseUserId;
  }

  const { error } = await sb
    .from('apple_auth_users')
    .upsert(record, { onConflict: 'apple_sub' });

  if (error) {
    console.error('apple auth: apple_auth_users upsert failed', error);
    throw new HttpError(500, 'Sign-in succeeded but user record could not be saved. Please try again.');
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

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return res.status(503).json({ error: 'Auth service not configured' });
  }

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

    // Validate nonce if the client sent one. Apple embeds SHA256(rawNonce)
    // in the JWT nonce claim; we recompute it to confirm the token was
    // issued for this exact request and wasn't replayed.
    const rawNonce = asOptionalString(body.nonce);
    if (rawNonce) {
      if (!/^[0-9a-f]+$/i.test(rawNonce)) {
        throw new HttpError(401, 'Invalid nonce format');
      }
      // iOS generates 32 random bytes, hex-encodes them as the "raw nonce", and
      // hashes the raw bytes (not the hex string) for the Apple request nonce.
      // Decode hex → bytes here before hashing so the comparison matches.
      const expectedNonceHash = createHash('sha256').update(Buffer.from(rawNonce, 'hex')).digest('hex');
      if (payload.nonce !== expectedNonceHash) {
        throw new HttpError(401, 'Nonce mismatch');
      }
    } else if (payload.nonce) {
      // JWT has a nonce but client didn't send one — reject to prevent
      // a downgrade where an attacker strips the nonce from the request.
      throw new HttpError(401, 'Nonce required');
    }

    // Create or retrieve the Supabase account and session for this Apple user.
    const sessionResult = await getOrCreateSession(payload, body);

    if (!sessionResult) {
      return res.status(500).json({ error: 'Sign-in verified but session could not be created. Please try again.' });
    }

    const backendStored = await persistAppleUser(payload, body, sessionResult.supabaseUserId);

    const sessionToken = issueSessionToken(payload.sub);
    const sessionTokenExpiresAt = sessionToken
      ? Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60
      : null;

    return res.status(200).json({
      user: {
        id: payload.sub,
        supabaseId: sessionResult.supabaseUserId,
        email: payload.email ?? asOptionalString(body.email),
        fullName: asOptionalString(body.fullName),
        emailVerified: payload.email_verified ?? null,
        privateEmail: payload.is_private_email ?? null,
      },
      session: sessionResult.session,
      sessionToken,
      sessionTokenExpiresAt,
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
