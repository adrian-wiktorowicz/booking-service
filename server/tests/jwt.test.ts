import { describe, it, expect } from 'vitest';
import { signJwt, verifyJwt, InvalidTokenError, TokenExpiredError } from '../src/modules/auth/jwt.js';

describe('JWT Utility (Native node:crypto)', () => {
  const testSecret = '01234567890123456789012345678901'; // 32 chars minimum
  const sampleUserId = 'c28c89bf-1f4a-4a2f-9dfb-0ea6c0dcb2b1';

  it('signs a token and returns a valid 3-part JWT string', () => {
    const token = signJwt({ userId: sampleUserId }, testSecret, 86400);
    const parts = token.split('.');
    expect(parts).toHaveLength(3);

    const [headerB64, payloadB64] = parts;
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(payload.userId).toBe(sampleUserId);
    expect(payload.sub).toBe(sampleUserId);
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
    expect(payload.exp - payload.iat).toBe(86400);
  });

  it('verifies and decodes a valid token successfully', () => {
    const token = signJwt({ userId: sampleUserId }, testSecret, 3600);
    const decoded = verifyJwt(token, testSecret);

    expect(decoded.userId).toBe(sampleUserId);
    expect(decoded.sub).toBe(sampleUserId);
    expect(typeof decoded.exp).toBe('number');
  });

  it('throws InvalidTokenError when secret is incorrect', () => {
    const token = signJwt({ userId: sampleUserId }, testSecret);
    const wrongSecret = 'different_secret_key_at_least_32_bytes_long';

    expect(() => verifyJwt(token, wrongSecret)).toThrow(InvalidTokenError);
  });

  it('throws InvalidTokenError when payload is tampered', () => {
    const token = signJwt({ userId: sampleUserId }, testSecret);
    const [header, payload, signature] = token.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ userId: 'hacked-id' })).toString('base64url');
    const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

    expect(() => verifyJwt(tamperedToken, testSecret)).toThrow(InvalidTokenError);
  });

  it('throws InvalidTokenError on malformed token strings', () => {
    expect(() => verifyJwt('not.a.valid.jwt.token', testSecret)).toThrow(InvalidTokenError);
    expect(() => verifyJwt('single-string', testSecret)).toThrow(InvalidTokenError);
  });

  it('throws TokenExpiredError when token is expired', () => {
    const expiredToken = signJwt({ userId: sampleUserId }, testSecret, -10); // Expired 10s ago

    expect(() => verifyJwt(expiredToken, testSecret)).toThrow(TokenExpiredError);
  });

  it('rejects tokens with alg: none or non-HS256 algorithms', () => {
    const fakeHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ userId: sampleUserId, exp: Math.floor(Date.now() / 1000) + 1000 })).toString('base64url');
    const noneToken = `${fakeHeader}.${payload}.`;

    expect(() => verifyJwt(noneToken, testSecret)).toThrow(InvalidTokenError);
  });

  it('throws error when secret is shorter than 32 characters', () => {
    expect(() => signJwt({ userId: sampleUserId }, 'short-secret')).toThrow('JWT secret must be at least 32 characters');
    expect(() => verifyJwt('dummy.token.here', 'short-secret')).toThrow('JWT secret must be at least 32 characters');
  });
});
