import crypto from 'node:crypto';

export interface JwtPayload {
  userId: string;
  sub?: string;
  iat?: number;
  exp: number;
  [key: string]: unknown;
}

export class InvalidTokenError extends Error {
  readonly code = 'INVALID_TOKEN';
  constructor(message = 'Invalid token') {
    super(message);
    this.name = 'InvalidTokenError';
  }
}

export class TokenExpiredError extends Error {
  readonly code = 'TOKEN_EXPIRED';
  constructor(message = 'Token expired') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

function assertSecret(secret: string): void {
  if (!secret || secret.length < 32) {
    throw new Error('JWT secret must be at least 32 characters');
  }
}

export function signJwt(payload: { userId: string; [key: string]: unknown }, secret: string, expiresInSeconds: number = 86400): string {
  assertSecret(secret);
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    sub: payload.userId,
    iat: now,
    exp: now + expiresInSeconds,
    ...payload,
  };

  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signatureB64 = crypto.createHmac('sha256', secret).update(`${headerB64}.${payloadB64}`).digest('base64url');

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload {
  assertSecret(secret);
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new InvalidTokenError('Invalid token format');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  try {
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    if (header.alg !== 'HS256') {
      throw new InvalidTokenError('Unsupported algorithm');
    }
  } catch (err) {
    if (err instanceof InvalidTokenError) throw err;
    throw new InvalidTokenError('Invalid token header');
  }

  const expectedSignatureB64 = crypto.createHmac('sha256', secret).update(`${headerB64}.${payloadB64}`).digest('base64url');
  const sigA = crypto.createHash('sha256').update(signatureB64).digest();
  const sigB = crypto.createHash('sha256').update(expectedSignatureB64).digest();

  if (!crypto.timingSafeEqual(sigA, sigB)) {
    throw new InvalidTokenError('Invalid token signature');
  }

  try {
    const payload: JwtPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp < now) {
      throw new TokenExpiredError();
    }
    return payload;
  } catch (err) {
    if (err instanceof TokenExpiredError) throw err;
    throw new InvalidTokenError('Invalid token payload');
  }
}
