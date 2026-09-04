import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { buildApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { IUserRepository, UserRecord, EmailExistsError } from '../src/modules/auth/auth.types.js';

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

describe('AuthService Unit Tests', () => {
  let userRepo: InMemoryUserRepository;
  let authService: AuthService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    authService = new AuthService(userRepo);
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
    expect(await bcrypt.compare('SecurePassword123', stored!.passwordHash)).toBe(true);
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
});

describe('POST /api/auth/register Integration Tests', () => {
  let userRepo: InMemoryUserRepository;
  let authService: AuthService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    authService = new AuthService(userRepo);
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
    const racingAuthService = new AuthService(racingRepo);
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

  it('formats unhandled server errors into uniform 500 error envelope', async () => {
    const errorRepo: IUserRepository = {
      async findByEmail() {
        throw new Error('Database connection lost');
      },
      async create() {
        throw new Error('Database connection lost');
      },
    };
    const errorAuthService = new AuthService(errorRepo);
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
