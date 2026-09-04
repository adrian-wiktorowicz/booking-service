import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { signJwt } from '../src/modules/auth/jwt.js';
import {
  IJournalRepository,
  JournalEntryRecord,
  Mood,
  InvalidDateError,
  InvalidMoodError,
  PayloadValidationError,
} from '../src/modules/journal/journal.types.js';
import { IAuthService, UserRecord } from '../src/modules/auth/auth.types.js';
import { JournalService, isValidCalendarDate } from '../src/modules/journal/journal.service.js';

export class InMemoryJournalRepository implements IJournalRepository {
  entries: JournalEntryRecord[] = [];

  async upsert(
    userId: string,
    entryDate: string,
    data: { notes: string; mood: Mood; tags: string[] }
  ): Promise<JournalEntryRecord> {
    const existingIndex = this.entries.findIndex(
      (e) => e.userId === userId && e.entryDate === entryDate
    );

    const now = new Date();
    if (existingIndex >= 0) {
      const existing = this.entries[existingIndex];
      const updated: JournalEntryRecord = {
        ...existing,
        notes: data.notes,
        mood: data.mood,
        tags: [...data.tags],
        updatedAt: now,
      };
      this.entries[existingIndex] = updated;
      return updated;
    }

    const newEntry: JournalEntryRecord = {
      id: crypto.randomUUID(),
      userId,
      entryDate,
      notes: data.notes,
      mood: data.mood,
      tags: [...data.tags],
      createdAt: now,
      updatedAt: now,
    };
    this.entries.push(newEntry);
    return newEntry;
  }
}

const mockAuthService: IAuthService = {
  async register() {
    throw new Error('Not implemented');
  },
  async login() {
    throw new Error('Not implemented');
  },
  async getUserById(userId: string): Promise<UserRecord | null> {
    if (userId === 'user-123') {
      return {
        id: 'user-123',
        email: 'user@example.com',
        passwordHash: 'hash',
        createdAt: new Date(),
      };
    }
    if (userId === 'user-456') {
      return {
        id: 'user-456',
        email: 'other@example.com',
        passwordHash: 'hash',
        createdAt: new Date(),
      };
    }
    return null;
  },
  async deleteAccount() {
    return { status: 'deleted' };
  },
};

const JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long';

describe('Date validation (isValidCalendarDate)', () => {
  it('validates standard valid calendar dates', () => {
    expect(isValidCalendarDate('2026-09-03')).toBe(true);
    expect(isValidCalendarDate('2026-01-01')).toBe(true);
    expect(isValidCalendarDate('2026-12-31')).toBe(true);
  });

  it('detects nonexistent calendar dates like 2026-02-30', () => {
    expect(isValidCalendarDate('2026-02-30')).toBe(false);
    expect(isValidCalendarDate('2026-04-31')).toBe(false);
    expect(isValidCalendarDate('2026-06-31')).toBe(false);
    expect(isValidCalendarDate('2026-11-31')).toBe(false);
  });

  it('correctly handles leap years', () => {
    // 2024 is a leap year -> Feb 29 exists
    expect(isValidCalendarDate('2024-02-29')).toBe(true);
    // 2026 is not a leap year -> Feb 29 does not exist
    expect(isValidCalendarDate('2026-02-29')).toBe(false);
    // 2000 was a leap year (divisible by 400)
    expect(isValidCalendarDate('2000-02-29')).toBe(true);
    // 1900 was not a leap year (divisible by 100 but not 400)
    expect(isValidCalendarDate('1900-02-29')).toBe(false);
  });

  it('rejects malformed date strings and invalid month/day ranges', () => {
    expect(isValidCalendarDate('invalid-date')).toBe(false);
    expect(isValidCalendarDate('2026-13-01')).toBe(false);
    expect(isValidCalendarDate('2026-00-10')).toBe(false);
    expect(isValidCalendarDate('2026-05-00')).toBe(false);
    expect(isValidCalendarDate('2026-05-32')).toBe(false);
    expect(isValidCalendarDate('')).toBe(false);
    expect(isValidCalendarDate('2026/09/03')).toBe(false);
  });
});

describe('JournalService Unit Tests', () => {
  let journalRepo: InMemoryJournalRepository;
  let journalService: JournalService;

  beforeEach(() => {
    journalRepo = new InMemoryJournalRepository();
    journalService = new JournalService(journalRepo);
  });

  it('creates a new journal entry successfully', async () => {
    const entry = await journalService.saveEntry('user-123', '2026-09-03', {
      notes: 'Had a productive day pair programming with AI.',
      mood: 'good',
      tags: ['coding', 'walk'],
    });

    expect(entry.id).toBeDefined();
    expect(entry.userId).toBe('user-123');
    expect(entry.entryDate).toBe('2026-09-03');
    expect(entry.notes).toBe('Had a productive day pair programming with AI.');
    expect(entry.mood).toBe('good');
    expect(entry.tags).toEqual(['coding', 'walk']);
    expect(entry.createdAt).toBeDefined();
    expect(entry.updatedAt).toBeDefined();
  });

  it('upserts an existing journal entry for the same user and date', async () => {
    const first = await journalService.saveEntry('user-123', '2026-09-03', {
      notes: 'Initial notes',
      mood: 'neutral',
      tags: ['start'],
    });

    const second = await journalService.saveEntry('user-123', '2026-09-03', {
      notes: 'Updated notes',
      mood: 'very_good',
      tags: ['coding', 'focus'],
    });

    expect(second.id).toBe(first.id);
    expect(second.userId).toBe('user-123');
    expect(second.entryDate).toBe('2026-09-03');
    expect(second.notes).toBe('Updated notes');
    expect(second.mood).toBe('very_good');
    expect(second.tags).toEqual(['coding', 'focus']);
    expect(journalRepo.entries).toHaveLength(1);
  });

  it('throws InvalidDateError for invalid calendar dates', async () => {
    await expect(
      journalService.saveEntry('user-123', '2026-02-30', {
        notes: 'Impossible date',
        mood: 'bad',
      })
    ).rejects.toThrow(InvalidDateError);
  });

  it('throws InvalidMoodError for unallowed mood strings', async () => {
    await expect(
      journalService.saveEntry('user-123', '2026-09-03', {
        notes: 'Feeling ecstatic',
        mood: 'ecstatic' as any,
      })
    ).rejects.toThrow(InvalidMoodError);
  });

  it('throws PayloadValidationError when notes exceed 50,000 characters', async () => {
    const hugeNotes = 'a'.repeat(50001);
    await expect(
      journalService.saveEntry('user-123', '2026-09-03', {
        notes: hugeNotes,
        mood: 'neutral',
      })
    ).rejects.toThrow(PayloadValidationError);
  });

  it('throws PayloadValidationError when tags exceed 10 items', async () => {
    const elevenTags = Array.from({ length: 11 }, (_, i) => `tag${i}`);
    await expect(
      journalService.saveEntry('user-123', '2026-09-03', {
        notes: 'Too many tags',
        mood: 'neutral',
        tags: elevenTags,
      })
    ).rejects.toThrow(PayloadValidationError);
  });

  it('applies defaults when notes or tags are omitted', async () => {
    const entry = await journalService.saveEntry('user-123', '2026-09-03', {
      mood: 'good',
    });

    expect(entry.notes).toBe('');
    expect(entry.tags).toEqual([]);
  });
});

describe('PUT /api/journal/entries/:date HTTP Integration Tests', () => {
  let journalRepo: InMemoryJournalRepository;
  let journalService: JournalService;
  let validToken: string;

  beforeEach(() => {
    journalRepo = new InMemoryJournalRepository();
    journalService = new JournalService(journalRepo);
    validToken = signJwt({ userId: 'user-123' }, JWT_SECRET, 86400);
  });

  it('AC1: saves a new entry and returns 200 with the full entry object', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const response = await app.inject({
      method: 'PUT',
      url: '/api/journal/entries/2026-09-03',
      headers: {
        authorization: `Bearer ${validToken}`,
        'content-type': 'application/json',
      },
      payload: {
        notes: 'Had a productive day pair programming with AI.',
        mood: 'good',
        tags: ['coding', 'walk'],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toMatchObject({
      userId: 'user-123',
      entryDate: '2026-09-03',
      notes: 'Had a productive day pair programming with AI.',
      mood: 'good',
      tags: ['coding', 'walk'],
    });
    expect(body.id).toBeDefined();
    expect(body.createdAt).toBeDefined();
    expect(body.updatedAt).toBeDefined();

    await app.close();
  });

  it('AC1: performs idempotent upsert when sending PUT again on the same date', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const firstRes = await app.inject({
      method: 'PUT',
      url: '/api/journal/entries/2026-09-03',
      headers: {
        authorization: `Bearer ${validToken}`,
        'content-type': 'application/json',
      },
      payload: {
        notes: 'First version',
        mood: 'bad',
        tags: ['rough'],
      },
    });
    expect(firstRes.statusCode).toBe(200);
    const firstBody = JSON.parse(firstRes.body);

    const secondRes = await app.inject({
      method: 'PUT',
      url: '/api/journal/entries/2026-09-03',
      headers: {
        authorization: `Bearer ${validToken}`,
        'content-type': 'application/json',
      },
      payload: {
        notes: 'Second updated version',
        mood: 'very_good',
        tags: ['recovered', 'zen'],
      },
    });
    expect(secondRes.statusCode).toBe(200);
    const secondBody = JSON.parse(secondRes.body);

    expect(secondBody.id).toBe(firstBody.id);
    expect(secondBody.notes).toBe('Second updated version');
    expect(secondBody.mood).toBe('very_good');
    expect(secondBody.tags).toEqual(['recovered', 'zen']);
    expect(journalRepo.entries).toHaveLength(1);

    await app.close();
  });

  it('AC2: returns 422 INVALID_DATE for nonexistent calendar date 2026-02-30', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const response = await app.inject({
      method: 'PUT',
      url: '/api/journal/entries/2026-02-30',
      headers: {
        authorization: `Bearer ${validToken}`,
        'content-type': 'application/json',
      },
      payload: {
        notes: 'Notes on invalid day',
        mood: 'good',
      },
    });

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body).toEqual({
      error: {
        code: 'INVALID_DATE',
        message: 'Invalid calendar date',
      },
    });

    await app.close();
  });

  it('AC2: returns 422 INVALID_DATE for non-leap year 2026-02-29 and 200 for leap year 2024-02-29', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    // 2026 is non-leap -> 422
    const nonLeapRes = await app.inject({
      method: 'PUT',
      url: '/api/journal/entries/2026-02-29',
      headers: {
        authorization: `Bearer ${validToken}`,
        'content-type': 'application/json',
      },
      payload: { mood: 'neutral' },
    });
    expect(nonLeapRes.statusCode).toBe(422);
    expect(JSON.parse(nonLeapRes.body).error.code).toBe('INVALID_DATE');

    // 2024 is leap -> 200
    const leapRes = await app.inject({
      method: 'PUT',
      url: '/api/journal/entries/2024-02-29',
      headers: {
        authorization: `Bearer ${validToken}`,
        'content-type': 'application/json',
      },
      payload: { mood: 'good' },
    });
    expect(leapRes.statusCode).toBe(200);

    await app.close();
  });

  it('AC2: returns 422 INVALID_DATE for malformed date strings', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const res = await app.inject({
      method: 'PUT',
      url: '/api/journal/entries/invalid-date-format',
      headers: {
        authorization: `Bearer ${validToken}`,
        'content-type': 'application/json',
      },
      payload: { mood: 'good' },
    });

    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body)).toEqual({
      error: {
        code: 'INVALID_DATE',
        message: 'Invalid calendar date',
      },
    });

    await app.close();
  });

  it('AC3: returns 422 VALIDATION_ERROR when mood is outside allowed values', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const res = await app.inject({
      method: 'PUT',
      url: '/api/journal/entries/2026-09-03',
      headers: {
        authorization: `Bearer ${validToken}`,
        'content-type': 'application/json',
      },
      payload: {
        mood: 'super_happy',
      },
    });

    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body)).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Mood must be one of: bad, neutral, good, very_good',
      },
    });

    await app.close();
  });

  it('AC4: returns 422 Unprocessable Entity when notes exceed 50,000 characters', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const res = await app.inject({
      method: 'PUT',
      url: '/api/journal/entries/2026-09-03',
      headers: {
        authorization: `Bearer ${validToken}`,
        'content-type': 'application/json',
      },
      payload: {
        notes: 'X'.repeat(50001),
        mood: 'good',
      },
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('VALIDATION_ERROR');

    await app.close();
  });

  it('AC4: returns 422 Unprocessable Entity when tags exceed 10 items', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const res = await app.inject({
      method: 'PUT',
      url: '/api/journal/entries/2026-09-03',
      headers: {
        authorization: `Bearer ${validToken}`,
        'content-type': 'application/json',
      },
      payload: {
        tags: Array.from({ length: 11 }, (_, i) => `tag-${i}`),
        mood: 'good',
      },
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('VALIDATION_ERROR');

    await app.close();
  });

  it('returns 401 UNAUTHORIZED when Authorization header is missing or invalid', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const resNoAuth = await app.inject({
      method: 'PUT',
      url: '/api/journal/entries/2026-09-03',
      payload: { mood: 'good' },
    });
    expect(resNoAuth.statusCode).toBe(401);
    expect(JSON.parse(resNoAuth.body)).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });

    const resBadToken = await app.inject({
      method: 'PUT',
      url: '/api/journal/entries/2026-09-03',
      headers: {
        authorization: 'Bearer bad.token.here',
      },
      payload: { mood: 'good' },
    });
    expect(resBadToken.statusCode).toBe(401);

    await app.close();
  });

  it('supports tenant isolation: two users have independent entries on the same date', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const user1Token = signJwt({ userId: 'user-123' }, JWT_SECRET, 86400);
    const user2Token = signJwt({ userId: 'user-456' }, JWT_SECRET, 86400);

    const res1 = await app.inject({
      method: 'PUT',
      url: '/api/journal/entries/2026-09-03',
      headers: { authorization: `Bearer ${user1Token}` },
      payload: { mood: 'bad', notes: 'User 1 note' },
    });
    expect(res1.statusCode).toBe(200);

    const res2 = await app.inject({
      method: 'PUT',
      url: '/api/journal/entries/2026-09-03',
      headers: { authorization: `Bearer ${user2Token}` },
      payload: { mood: 'very_good', notes: 'User 2 note' },
    });
    expect(res2.statusCode).toBe(200);

    expect(journalRepo.entries).toHaveLength(2);
    expect(journalRepo.entries[0].userId).toBe('user-123');
    expect(journalRepo.entries[0].notes).toBe('User 1 note');
    expect(journalRepo.entries[1].userId).toBe('user-456');
    expect(journalRepo.entries[1].notes).toBe('User 2 note');

    await app.close();
  });
});
