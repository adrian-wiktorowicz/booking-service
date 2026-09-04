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

