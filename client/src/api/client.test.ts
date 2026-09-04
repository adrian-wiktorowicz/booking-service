import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiClient, ApiError } from './client';

describe('ApiClient', () => {
  let client: ApiClient;

  beforeEach(() => {
    localStorage.clear();
    client = new ApiClient();
    vi.restoreAllMocks();
  });

  it('stores and retrieves token in localStorage', () => {
    expect(client.getToken()).toBeNull();
    client.setToken('test-token-123');
    expect(client.getToken()).toBe('test-token-123');
    expect(localStorage.getItem('auth_token')).toBe('test-token-123');
    client.clearToken();
    expect(client.getToken()).toBeNull();
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('attaches Authorization header when token is present', async () => {
    client.setToken('jwt-abc');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    global.fetch = mockFetch;

    await client.request('/api/auth/me');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer jwt-abc',
        }),
      })
    );
  });

  it('throws ApiError with code from error envelope for 409 EMAIL_EXISTS', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: {
          code: 'EMAIL_EXISTS',
          message: 'An account with this email already exists.',
        },
      }),
    });

    await expect(client.register({ email: 'taken@example.com', password: 'password123' })).rejects.toThrow(ApiError);
    try {
      await client.register({ email: 'taken@example.com', password: 'password123' });
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(409);
      expect(apiErr.code).toBe('EMAIL_EXISTS');
      expect(apiErr.message).toContain('already exists');
    }
  });

  it('throws ApiError with code for 422 PASSWORD_COMPROMISED and 429 RATE_LIMITED', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        error: {
          code: 'PASSWORD_COMPROMISED',
          message: 'This password has appeared in data breaches.',
        },
      }),
    });

    await expect(client.register({ email: 'test@example.com', password: 'password123' })).rejects.toMatchObject({
      status: 422,
      code: 'PASSWORD_COMPROMISED',
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many attempts. Please retry later.',
        },
      }),
    });

    await expect(client.login({ email: 'test@example.com', password: 'password123' })).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
    });
  });
});
