import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { buildApp } from '../src/app.js';
import { AuthService, pepperPassword, HibpPasswordChecker } from '../src/modules/auth/auth.service.js';
import {
  IUserRepository,
  UserRecord,
  EmailExistsError,
  IPasswordChecker,
  PasswordCompromisedError,
  InvalidCredentialsError,
} from '../src/modules/auth/auth.types.js';
import { verifyJwt } from '../src/modules/auth/jwt.js';


class InMemoryUserRepository implements IUserRepository {
  users: UserRecord[] = [];

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async deleteById(id: string): Promise<void> {
    this.users = this.users.filter((u) => u.id !== id);
  }

  async create(data: { email: string; passwordHash: string }): Promise<UserRecord> {
    const record: UserRecord = {
      id: crypto.randomUUID(),
      email: data.email,
      passwordHash: data.passwordHash,
      createdAt: new Date(),
    };
    this.users.push(record);
    return record;
  }
}

const safePasswordChecker: IPasswordChecker = {
  isCompromised: async () => false,
};

describe('AuthService Unit Tests', () => {
  let userRepo: InMemoryUserRepository;
  let authService: AuthService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    authService = new AuthService(userRepo, 12, 'test-pepper-secret', safePasswordChecker, 'test-jwt-secret-at-least-32-chars-long');
  });

  it('registers a user with bcrypt work factor >= 12 and returns user response without password hash', async () => {
    const res = await authService.register({
      email: 'user@example.com',
      password: 'SecurePassword123',
    });

    expect(res.userId).toBeDefined();
    expect(res.email).toBe('user@example.com');
    expect((res as any).password).toBeUndefined();
    expect((res as any).passwordHash).toBeUndefined();

    const stored = await userRepo.findByEmail('user@example.com');
    expect(stored).not.toBeNull();
    expect(stored?.passwordHash).not.toBe('SecurePassword123');
    expect(bcrypt.getRounds(stored!.passwordHash)).toBeGreaterThanOrEqual(12);

    // Raw password without pepper fails to verify (DB dump protection)
    expect(await bcrypt.compare('SecurePassword123', stored!.passwordHash)).toBe(false);
    // Correct pepper verification succeeds
    expect(await bcrypt.compare(pepperPassword('SecurePassword123', 'test-pepper-secret'), stored!.passwordHash)).toBe(true);
    // Incorrect pepper fails to verify
    expect(await bcrypt.compare(pepperPassword('SecurePassword123', 'wrong-pepper'), stored!.passwordHash)).toBe(false);
  });

  it('throws EmailExistsError when registering an existing email', async () => {
    await authService.register({
      email: 'duplicate@example.com',
      password: 'SecurePassword123',
    });

    await expect(
      authService.register({
        email: 'duplicate@example.com',
        password: 'AnotherPassword123',
      })
    ).rejects.toThrow(EmailExistsError);
  });

  it('throws PasswordCompromisedError when password is found in data breaches', async () => {
    const compromisedChecker: IPasswordChecker = {
      isCompromised: async () => true,
    };
    const compromisedAuthService = new AuthService(userRepo, 12, 'test-pepper-secret', compromisedChecker);

    await expect(
      compromisedAuthService.register({
        email: 'user@example.com',
        password: 'BreachedPassword123',
      })
    ).rejects.toThrow(PasswordCompromisedError);

    expect(userRepo.users).toHaveLength(0);
  });

  it('authenticates valid credentials and returns JWT token and expiresIn 86400', async () => {
    const registered = await authService.register({
      email: 'login@example.com',
      password: 'SecurePassword123',
    });

    const res = await authService.login({
      email: 'login@example.com',
      password: 'SecurePassword123',
    });

    expect(res.token).toBeDefined();
    expect(res.expiresIn).toBe(86400);

    const payload = verifyJwt(res.token, 'test-jwt-secret-at-least-32-chars-long');
    expect(payload.userId).toBe(registered.userId);
  });

  it('throws InvalidCredentialsError when password is incorrect', async () => {
    await authService.register({
      email: 'login@example.com',
      password: 'SecurePassword123',
    });

    await expect(
      authService.login({
        email: 'login@example.com',
        password: 'WrongPassword456',
      })
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('throws InvalidCredentialsError when email does not exist, executing dummy bcrypt compare', async () => {
    const compareSpy = vi.spyOn(bcrypt, 'compare');
    try {
      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'Password123',
        })
      ).rejects.toThrow(InvalidCredentialsError);

      expect(compareSpy).toHaveBeenCalled();
    } finally {
      compareSpy.mockRestore();
    }
  });

  it('normalizes email casing and whitespace during login', async () => {
    const registered = await authService.register({
      email: 'user@example.com',
      password: 'SecurePassword123',
    });

    const res = await authService.login({
      email: '  User@Example.Com  ',
      password: 'SecurePassword123',
    });

    expect(res.token).toBeDefined();
    const payload = verifyJwt(res.token, 'test-jwt-secret-at-least-32-chars-long');
    expect(payload.userId).toBe(registered.userId);
  });

  it('throws InvalidCredentialsError when email contains null byte', async () => {
    await expect(
      authService.login({
        email: 'user\0@example.com',
        password: 'Password123',
      })
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('retrieves user record by id via getUserById', async () => {
    const registered = await authService.register({
      email: 'profile@example.com',
      password: 'SecurePassword123',
    });

    const user = await (authService as any).getUserById(registered.userId);
    expect(user).not.toBeNull();
    expect(user?.id).toBe(registered.userId);
    expect(user?.email).toBe('profile@example.com');
  });

  it('deletes user account atomically via deleteAccount', async () => {
    const registered = await authService.register({
      email: 'delete-me@example.com',
      password: 'SecurePassword123',
    });

    const deleteRes = await (authService as any).deleteAccount(registered.userId);
    expect(deleteRes).toEqual({ status: 'deleted' });

    const postDeleteUser = await (authService as any).getUserById(registered.userId);
    expect(postDeleteUser).toBeNull();
  });
});


describe('POST /api/auth/register Integration Tests', () => {
  let userRepo: InMemoryUserRepository;
  let authService: AuthService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    authService = new AuthService(userRepo, 12, 'test-pepper-secret', safePasswordChecker);
  });


  it('returns 201 with userId and email on valid registration', async () => {
    const app = await buildApp({ logger: false, autoCloseDb: false, authService });
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'user@example.com',
        password: 'SecurePassword123',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.userId).toBeDefined();
    expect(body.email).toBe('user@example.com');
    expect(body.password).toBeUndefined();
    expect(body.passwordHash).toBeUndefined();

    const stored = await userRepo.findByEmail('user@example.com');
    expect(stored).not.toBeNull();
    expect(bcrypt.getRounds(stored!.passwordHash)).toBeGreaterThanOrEqual(12);
    await app.close();
  });

  it('returns 409 uniform error envelope on duplicate email', async () => {
    const app = await buildApp({ logger: false, autoCloseDb: false, authService });
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'user@example.com',
        password: 'SecurePassword123',
      },
    });

    const duplicateResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'user@example.com',
        password: 'SecurePassword123',
      },
    });

    expect(duplicateResponse.statusCode).toBe(409);
    expect(duplicateResponse.json()).toEqual({
      error: {
        code: 'EMAIL_EXISTS',
        message: 'Email already registered',
      },
    });
    expect(userRepo.users).toHaveLength(1);
    await app.close();
  });

  it('returns 422 uniform error envelope on malformed email', async () => {
    const app = await buildApp({ logger: false, autoCloseDb: false, authService });
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'not-an-email',
        password: 'SecurePassword123',
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
      },
    });
    await app.close();
  });

  it('returns 422 uniform error envelope on short password (< 8 chars)', async () => {
    const app = await buildApp({ logger: false, autoCloseDb: false, authService });
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'user@example.com',
        password: 'short',
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
      },
    });
    await app.close();
  });

  it('returns 422 uniform error envelope on missing email or password', async () => {
    const app = await buildApp({ logger: false, autoCloseDb: false, authService });
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'user@example.com',
      },
    });
    expect(res1.statusCode).toBe(422);
    expect(res1.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
      },
    });

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {},
    });
    expect(res2.statusCode).toBe(422);
    expect(res2.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
      },
    });
    await app.close();
  });

  it('returns 422 uniform error envelope on extra unexpected properties', async () => {
    const app = await buildApp({ logger: false, autoCloseDb: false, authService });
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'user@example.com',
        password: 'password123',
        role: 'admin',
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
      },
    });
    await app.close();
  });

  it('normalizes email casing and whitespace on registration and duplicate checks', async () => {
    const app = await buildApp({ logger: false, autoCloseDb: false, authService });
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'MixedCase@Example.com',
        password: 'SecurePassword123',
      },
    });

    expect(res1.statusCode).toBe(201);
    expect(res1.json().email).toBe('mixedcase@example.com');

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'mixedcase@example.com',
        password: 'SecurePassword123',
      },
    });

    expect(res2.statusCode).toBe(409);
    expect(res2.json()).toEqual({
      error: {
        code: 'EMAIL_EXISTS',
        message: 'Email already registered',
      },
    });
    await app.close();
  });

  it('returns 422 when password exceeds 72 characters', async () => {
    const app = await buildApp({ logger: false, autoCloseDb: false, authService });
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'user@example.com',
        password: 'A'.repeat(73),
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
      },
    });
    await app.close();
  });

  it('translates database unique constraint race conditions (23505) into 409 EMAIL_EXISTS', async () => {
    const racingRepo: IUserRepository = {
      async findByEmail() {
        return null; // Passes initial check
      },
      async findById() {
        return null;
      },
      async deleteById() {},
      async create() {
        const error: any = new Error('duplicate key value violates unique constraint');
        error.code = '23505';
        throw error;
      },
    };
    const racingAuthService = new AuthService(racingRepo, 12, 'test-pepper-secret', safePasswordChecker);
    const app = await buildApp({ logger: false, autoCloseDb: false, authService: racingAuthService });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'race@example.com',
        password: 'SecurePassword123',
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        code: 'EMAIL_EXISTS',
        message: 'Email already registered',
      },
    });
    await app.close();
  });

  it('returns 422 uniform error envelope when password is compromised in data breaches', async () => {
    const compromisedChecker: IPasswordChecker = {
      isCompromised: async () => true,
    };
    const testAuthService = new AuthService(userRepo, 12, 'test-pepper-secret', compromisedChecker);
    const app = await buildApp({ logger: false, autoCloseDb: false, authService: testAuthService });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'user@example.com',
        password: 'PwnedPassword123',
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: 'PASSWORD_COMPROMISED',
        message: 'Password has been compromised in a data breach. Please choose a different password.',
      },
    });
    expect(userRepo.users).toHaveLength(0);
    await app.close();
  });

  it('formats unhandled server errors into uniform 500 error envelope', async () => {
    const errorRepo: IUserRepository = {
      async findByEmail() {
        throw new Error('Database connection lost');
      },
      async findById() {
        throw new Error('Database connection lost');
      },
      async deleteById() {
        throw new Error('Database connection lost');
      },
      async create() {
        throw new Error('Database connection lost');
      },
    };
    const errorAuthService = new AuthService(errorRepo, 12, 'test-pepper-secret', safePasswordChecker);
    const app = await buildApp({ logger: false, autoCloseDb: false, authService: errorAuthService });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'error@example.com',
        password: 'SecurePassword123',
      },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      },
    });
    await app.close();
  });
});

describe('POST /api/auth/login Integration Tests', () => {
  let userRepo: InMemoryUserRepository;
  let authService: AuthService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    authService = new AuthService(userRepo, 12, 'test-pepper-secret', safePasswordChecker, 'test-jwt-secret-at-least-32-chars-long');
  });

  it('returns 200 with JWT token, expiresIn, and Cache-Control headers on valid login', async () => {
    const app = await buildApp({ logger: false, autoCloseDb: false, authService });
    const registered = await authService.register({
      email: 'user@example.com',
      password: 'SecurePassword123',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'user@example.com',
        password: 'SecurePassword123',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.token).toBeDefined();
    expect(body.expiresIn).toBe(86400);
    expect(response.headers['cache-control']).toBe('no-store, no-cache, must-revalidate');

    const payload = verifyJwt(body.token, 'test-jwt-secret-at-least-32-chars-long');
    expect(payload.userId).toBe(registered.userId);
    await app.close();
  });

  it('returns 401 uniform error envelope on incorrect password', async () => {
    const app = await buildApp({ logger: false, autoCloseDb: false, authService });
    await authService.register({
      email: 'user@example.com',
      password: 'SecurePassword123',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'user@example.com',
        password: 'WrongPassword456',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      },
    });
    await app.close();
  });

  it('returns 401 uniform error envelope on nonexistent email', async () => {
    const app = await buildApp({ logger: false, autoCloseDb: false, authService });
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'nonexistent@example.com',
        password: 'SecurePassword123',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      },
    });
    await app.close();
  });

  it('returns 422 uniform error envelope on malformed email', async () => {
    const app = await buildApp({ logger: false, autoCloseDb: false, authService });
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'not-an-email',
        password: 'SecurePassword123',
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
      },
    });
    await app.close();
  });

  it('returns 422 uniform error envelope on missing email or password', async () => {
    const app = await buildApp({ logger: false, autoCloseDb: false, authService });
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'user@example.com' },
    });
    expect(res1.statusCode).toBe(422);

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: 'SecurePassword123' },
    });
    expect(res2.statusCode).toBe(422);
    await app.close();
  });

  it('returns 422 uniform error envelope on password exceeding 72 characters', async () => {
    const app = await buildApp({ logger: false, autoCloseDb: false, authService });
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'user@example.com',
        password: 'P'.repeat(73),
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
      },
    });
    await app.close();
  });

  it('returns 422 uniform error envelope on unexpected properties', async () => {
    const app = await buildApp({ logger: false, autoCloseDb: false, authService });
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'user@example.com',
        password: 'SecurePassword123',
        extra: 'field',
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
      },
    });
    await app.close();
  });

  it('enforces rate limiting of 5 requests per minute per IP returning 429 and Retry-After header', async () => {
    const app = await buildApp({ logger: false, autoCloseDb: false, authService });
    await authService.register({
      email: 'user@example.com',
      password: 'SecurePassword123',
    });

    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'user@example.com',
          password: 'WrongPassword',
        },
      });
      expect(res.statusCode).toBe(401);
    }

    const limitedRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'user@example.com',
        password: 'SecurePassword123',
      },
    });

    expect(limitedRes.statusCode).toBe(429);
    expect(limitedRes.json()).toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many login attempts. Please retry later.',
      },
    });
    expect(limitedRes.headers['retry-after']).toBeDefined();
    await app.close();
  });
});

describe('HibpPasswordChecker Unit Tests', () => {
  it('identifies compromised passwords via k-anonymity API response', async () => {
    const checker = new HibpPasswordChecker(1000);
    const originalFetch = globalThis.fetch;
    try {
      // password: 'password123' -> SHA-1: CBFDAC6008F9CAB4083784CBD1874F76618D2A97
      // prefix: 'CBFDA', suffix: 'C6008F9CAB4083784CBD1874F76618D2A97'
      globalThis.fetch = (async (url: any) => {
        expect(String(url)).toContain('/range/CBFDA');
        return {
          ok: true,
          text: async () => '0018A45C4D17F:1\r\nC6008F9CAB4083784CBD1874F76618D2A97:184562\r\n00D64411:3\r\n',
        } as any;
      }) as any;

      const isCompromised = await checker.isCompromised('password123');
      expect(isCompromised).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('identifies safe passwords not present in HIBP response', async () => {
    const checker = new HibpPasswordChecker(1000);
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async () => {
        return {
          ok: true,
          text: async () => '0018A45C4D17F:1\r\nFFFFFC6008F9CAB4083784CBD1874F76618D2A97:10\r\n',
        } as any;
      }) as any;

      const isCompromised = await checker.isCompromised('UniqueSuperSecretPass#2026!');
      expect(isCompromised).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('fails open (returns false) if HIBP API returns error status or throws network error', async () => {
    const checker = new HibpPasswordChecker(1000);
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async () => {
        throw new Error('Network timeout');
      }) as any;

      const isCompromised = await checker.isCompromised('AnyPassword123');
      expect(isCompromised).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Story 1.4: Tenant Isolation Guard & Account Cascade Deletion', () => {
  const jwtSecret = 'test-jwt-secret-at-least-32-chars-long';
  let userRepo: InMemoryUserRepository;
  let authService: AuthService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    authService = new AuthService(userRepo, 12, 'test-pepper-secret', safePasswordChecker, jwtSecret);
  });

  it('AC1: returns 200 with userId and email on GET /api/auth/me with valid Bearer token', async () => {
    const app = await buildApp({ logger: false, autoCloseDb: false, authService });
    const reg = await authService.register({
      email: 'tenant@example.com',
      password: 'SecurePassword123',
    });
    const loginRes = await authService.login({
      email: 'tenant@example.com',
      password: 'SecurePassword123',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${loginRes.token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      userId: reg.userId,
      email: 'tenant@example.com',
    });
    await app.close();
  });

  it('AC2: returns 401 UNAUTHORIZED when Authorization header is missing on GET /api/auth/me', async () => {
    const app = await buildApp({ logger: false, autoCloseDb: false, authService });
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
    await app.close();
  });

  it('AC2: returns 401 UNAUTHORIZED when Authorization header is not a Bearer scheme', async () => {
    const app = await buildApp({ logger: false, autoCloseDb: false, authService });
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: 'Basic invalid-token',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
    await app.close();
  });

  it('AC2: returns 401 UNAUTHORIZED when token signature is tampered', async () => {
    const app = await buildApp({ logger: false, autoCloseDb: false, authService });
    await authService.register({
      email: 'tenant@example.com',
      password: 'SecurePassword123',
    });
    const loginRes = await authService.login({
      email: 'tenant@example.com',
      password: 'SecurePassword123',
    });

    const tampered = loginRes.token.slice(0, -4) + 'abcd';
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${tampered}`,
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
    await app.close();
  });

  it('AC2: returns 401 UNAUTHORIZED when token is expired', async () => {
    const { signJwt } = await import('../src/modules/auth/jwt.js');
    const app = await buildApp({ logger: false, autoCloseDb: false, authService });
    const reg = await authService.register({
      email: 'tenant@example.com',
      password: 'SecurePassword123',
    });

    const expiredToken = signJwt({ userId: reg.userId }, jwtSecret, -60);
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${expiredToken}`,
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
    await app.close();
  });

  it('AC2: returns 401 UNAUTHORIZED when token has valid signature but user does not exist', async () => {
    const { signJwt } = await import('../src/modules/auth/jwt.js');
    const app = await buildApp({ logger: false, autoCloseDb: false, authService });
    const nonExistentUserId = crypto.randomUUID();
    const token = signJwt({ userId: nonExistentUserId }, jwtSecret, 3600);

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
    await app.close();
  });

  it('AC3: deletes account atomically via DELETE /api/auth/account and invalidates future requests', async () => {
    const app = await buildApp({ logger: false, autoCloseDb: false, authService });
    const reg = await authService.register({
      email: 'to-delete@example.com',
      password: 'SecurePassword123',
    });
    const loginRes = await authService.login({
      email: 'to-delete@example.com',
      password: 'SecurePassword123',
    });

    // Valid authenticated account deletion
    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: '/api/auth/account',
      headers: {
        authorization: `Bearer ${loginRes.token}`,
      },
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json()).toEqual({ status: 'deleted' });

    // Verify user was removed from persistence
    const userInDb = await userRepo.findById(reg.userId);
    expect(userInDb).toBeNull();

    // Subsequent access with the token returns 401 UNAUTHORIZED
    const postDeleteResponse = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${loginRes.token}`,
      },
    });

    expect(postDeleteResponse.statusCode).toBe(401);
    expect(postDeleteResponse.json()).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
    await app.close();
  });

  it('AC3: returns 401 UNAUTHORIZED when calling DELETE /api/auth/account unauthenticated', async () => {
    const app = await buildApp({ logger: false, autoCloseDb: false, authService });
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/auth/account',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
    await app.close();
  });
});


