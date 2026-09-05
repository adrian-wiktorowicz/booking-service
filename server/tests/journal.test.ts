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
  EntryNotFoundError,
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

  async findByDate(userId: string, entryDate: string): Promise<JournalEntryRecord | null> {
    const entry = this.entries.find((e) => e.userId === userId && e.entryDate === entryDate);
    return entry ? { ...entry } : null;
  }

  async findMany(
    userId: string,
    options: {
      offset: number;
      limit: number;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{ entries: JournalEntryRecord[]; total: number }> {
    let filtered = this.entries.filter((e) => e.userId === userId);
    if (options.startDate && options.startDate.trim() !== '') {
      filtered = filtered.filter((e) => e.entryDate >= options.startDate!);
    }
    if (options.endDate && options.endDate.trim() !== '') {
      filtered = filtered.filter((e) => e.entryDate <= options.endDate!);
    }
    filtered.sort((a, b) => b.entryDate.localeCompare(a.entryDate));
    const total = filtered.length;
    const entries = filtered
      .slice(options.offset, options.offset + options.limit)
      .map((e) => ({ ...e }));
    return { entries, total };
  }

  async deleteByDate(userId: string, entryDate: string): Promise<boolean> {
    const idx = this.entries.findIndex((e) => e.userId === userId && e.entryDate === entryDate);
    if (idx === -1) return false;
    this.entries.splice(idx, 1);
    return true;
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
    if (userId === 'empty-user') {
      return {
        id: 'empty-user',
        email: 'empty@example.com',
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

describe('Story 2.2: JournalService getEntryByDate and getEntries Unit Tests', () => {
  let journalRepo: InMemoryJournalRepository;
  let journalService: JournalService;

  beforeEach(() => {
    journalRepo = new InMemoryJournalRepository();
    journalService = new JournalService(journalRepo);
  });

  describe('getEntryByDate', () => {
    it('returns existing entry for valid date', async () => {
      await journalService.saveEntry('user-123', '2026-09-03', {
        notes: 'Testing entry lookup',
        mood: 'good',
        tags: ['focus'],
      });

      const entry = await journalService.getEntryByDate('user-123', '2026-09-03');
      expect(entry).toBeDefined();
      expect(entry.userId).toBe('user-123');
      expect(entry.entryDate).toBe('2026-09-03');
      expect(entry.notes).toBe('Testing entry lookup');
      expect(entry.mood).toBe('good');
      expect(entry.tags).toEqual(['focus']);
      expect(entry.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(entry.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('throws EntryNotFoundError when no entry exists for date', async () => {
      await expect(
        journalService.getEntryByDate('user-123', '2026-09-03')
      ).rejects.toThrow(EntryNotFoundError);
    });

    it('throws EntryNotFoundError when entry exists for different user (IDOR defense)', async () => {
      await journalService.saveEntry('user-456', '2026-09-03', {
        notes: 'User 456 private notes',
        mood: 'good',
      });

      await expect(
        journalService.getEntryByDate('user-123', '2026-09-03')
      ).rejects.toThrow(EntryNotFoundError);
    });

    it('throws InvalidDateError for invalid calendar dates', async () => {
      await expect(
        journalService.getEntryByDate('user-123', '2026-02-30')
      ).rejects.toThrow(InvalidDateError);
      await expect(
        journalService.getEntryByDate('user-123', 'invalid-date')
      ).rejects.toThrow(InvalidDateError);
    });
  });

  describe('getEntries', () => {
    beforeEach(async () => {
      // Seed entries for user-123 across multiple dates
      const dates = [
        '2026-08-01',
        '2026-08-15',
        '2026-08-20',
        '2026-08-31',
        '2026-09-01',
        '2026-09-03',
      ];
      for (const d of dates) {
        await journalService.saveEntry('user-123', d, {
          notes: `Notes for ${d}`,
          mood: 'good',
          tags: [d],
        });
      }
      // Seed entry for another user
      await journalService.saveEntry('user-456', '2026-09-02', {
        notes: 'Other user note',
        mood: 'neutral',
      });
    });

    it('returns entries with default pagination (page=1, limit=20) ordered entry_date DESC', async () => {
      const result = await journalService.getEntries('user-123');
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 6,
        hasMore: false,
      });
      expect(result.entries).toHaveLength(6);
      expect(result.entries[0].entryDate).toBe('2026-09-03');
      expect(result.entries[5].entryDate).toBe('2026-08-01');
      // Verify other user's entry is not included
      expect(result.entries.some((e) => e.userId === 'user-456')).toBe(false);
    });

    it('handles custom pagination page and limit with hasMore true/false', async () => {
      const page1 = await journalService.getEntries('user-123', { page: 1, limit: 2 });
      expect(page1.entries).toHaveLength(2);
      expect(page1.entries[0].entryDate).toBe('2026-09-03');
      expect(page1.entries[1].entryDate).toBe('2026-09-01');
      expect(page1.pagination).toEqual({
        page: 1,
        limit: 2,
        total: 6,
        hasMore: true,
      });

      const page3 = await journalService.getEntries('user-123', { page: 3, limit: 2 });
      expect(page3.entries).toHaveLength(2);
      expect(page3.entries[0].entryDate).toBe('2026-08-15');
      expect(page3.entries[1].entryDate).toBe('2026-08-01');
      expect(page3.pagination).toEqual({
        page: 3,
        limit: 2,
        total: 6,
        hasMore: false,
      });
    });

    it('filters entries by inclusive date range startDate and endDate', async () => {
      const result = await journalService.getEntries('user-123', {
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });
      expect(result.pagination.total).toBe(4);
      expect(result.entries).toHaveLength(4);
      expect(result.entries.map((e) => e.entryDate)).toEqual([
        '2026-08-31',
        '2026-08-20',
        '2026-08-15',
        '2026-08-01',
      ]);
    });

    it('filters entries with only startDate', async () => {
      const result = await journalService.getEntries('user-123', {
        startDate: '2026-09-01',
      });
      expect(result.pagination.total).toBe(2);
      expect(result.entries.map((e) => e.entryDate)).toEqual(['2026-09-03', '2026-09-01']);
    });

    it('filters entries with only endDate', async () => {
      const result = await journalService.getEntries('user-123', {
        endDate: '2026-08-15',
      });
      expect(result.pagination.total).toBe(2);
      expect(result.entries.map((e) => e.entryDate)).toEqual(['2026-08-15', '2026-08-01']);
    });

    it('throws PayloadValidationError when startDate > endDate', async () => {
      await expect(
        journalService.getEntries('user-123', {
          startDate: '2026-09-10',
          endDate: '2026-09-01',
        })
      ).rejects.toThrow(PayloadValidationError);
      await expect(
        journalService.getEntries('user-123', {
          startDate: '2026-09-10',
          endDate: '2026-09-01',
        })
      ).rejects.toMatchObject({ message: 'startDate must not be after endDate' });
    });

    it('throws InvalidDateError when startDate or endDate is invalid calendar date', async () => {
      await expect(
        journalService.getEntries('user-123', { startDate: '2026-02-30' })
      ).rejects.toThrow(InvalidDateError);
      await expect(
        journalService.getEntries('user-123', { endDate: 'invalid' })
      ).rejects.toThrow(InvalidDateError);
    });

    it('throws PayloadValidationError when page < 1 or limit < 1', async () => {
      await expect(
        journalService.getEntries('user-123', { page: 0 })
      ).rejects.toThrow(PayloadValidationError);
      await expect(
        journalService.getEntries('user-123', { limit: 0 })
      ).rejects.toThrow(PayloadValidationError);
      await expect(
        journalService.getEntries('user-123', { page: -1 })
      ).rejects.toThrow(PayloadValidationError);
      await expect(
        journalService.getEntries('user-123', { limit: -5 })
      ).rejects.toThrow(PayloadValidationError);
    });

    it('returns empty array and total 0 for user with no entries', async () => {
      const result = await journalService.getEntries('empty-user');
      expect(result.entries).toEqual([]);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        hasMore: false,
      });
    });
  });
});

describe('Story 2.2: GET /api/journal/entries/:date Route Integration Tests', () => {
  let journalRepo: InMemoryJournalRepository;
  let journalService: JournalService;
  let validToken: string;

  beforeEach(async () => {
    journalRepo = new InMemoryJournalRepository();
    journalService = new JournalService(journalRepo);
    validToken = signJwt({ userId: 'user-123' }, JWT_SECRET, 86400);

    await journalRepo.upsert('user-123', '2026-09-03', {
      notes: 'Existing entry notes',
      mood: 'good',
      tags: ['coding'],
    });

    await journalRepo.upsert('user-456', '2026-09-03', {
      notes: 'User 456 notes',
      mood: 'neutral',
      tags: ['other'],
    });
  });

  it('AC1: returns 200 with entry details for existing date belonging to user', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/journal/entries/2026-09-03',
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({
      userId: 'user-123',
      entryDate: '2026-09-03',
      notes: 'Existing entry notes',
      mood: 'good',
      tags: ['coding'],
    });
    expect(body.id).toBeDefined();
    expect(body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(body.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    await app.close();
  });

  it('AC2: returns 404 with ENTRY_NOT_FOUND when no entry exists for user on date', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/journal/entries/2026-09-04',
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({
      error: {
        code: 'ENTRY_NOT_FOUND',
        message: 'No entry found for this date',
      },
    });

    await app.close();
  });

  it('AC2/IDOR: returns 404 when entry exists for another user on that date', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    // user-123 queries 2026-09-05 (only user-456 has entry)
    await journalRepo.upsert('user-456', '2026-09-05', {
      notes: 'Private',
      mood: 'bad',
      tags: [],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/journal/entries/2026-09-05',
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({
      error: {
        code: 'ENTRY_NOT_FOUND',
        message: 'No entry found for this date',
      },
    });

    await app.close();
  });

  it('AC4: returns 422 INVALID_DATE for nonexistent calendar date 2026-02-30', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/journal/entries/2026-02-30',
      headers: { authorization: `Bearer ${validToken}` },
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

  it('AC5: returns 401 UNAUTHORIZED when no token is provided', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/journal/entries/2026-09-03',
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });

    await app.close();
  });
});

describe('Story 2.2: GET /api/journal/entries Route Integration Tests', () => {
  let journalRepo: InMemoryJournalRepository;
  let journalService: JournalService;
  let validToken: string;

  beforeEach(async () => {
    journalRepo = new InMemoryJournalRepository();
    journalService = new JournalService(journalRepo);
    validToken = signJwt({ userId: 'user-123' }, JWT_SECRET, 86400);

    const dates = [
      '2026-08-01',
      '2026-08-15',
      '2026-08-20',
      '2026-08-31',
      '2026-09-01',
      '2026-09-03',
    ];
    for (const d of dates) {
      await journalRepo.upsert('user-123', d, {
        notes: `Note ${d}`,
        mood: 'good',
        tags: [d],
      });
    }

    await journalRepo.upsert('user-456', '2026-09-02', {
      notes: 'User 456 note',
      mood: 'neutral',
      tags: [],
    });
  });

  it('AC3: returns 200 with default paginated list sorted entry_date DESC', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/journal/entries',
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 6,
      hasMore: false,
    });
    expect(body.entries).toHaveLength(6);
    expect(body.entries[0].entryDate).toBe('2026-09-03');
    expect(body.entries[5].entryDate).toBe('2026-08-01');
    expect(body.entries.every((e: any) => e.userId === 'user-123')).toBe(true);
    expect(body.entries[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(body.entries[0].updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    await app.close();
  });

  it('AC3: supports page and limit query params', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/journal/entries?page=2&limit=2',
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.pagination).toEqual({
      page: 2,
      limit: 2,
      total: 6,
      hasMore: true,
    });
    expect(body.entries).toHaveLength(2);
    expect(body.entries[0].entryDate).toBe('2026-08-31');
    expect(body.entries[1].entryDate).toBe('2026-08-20');

    await app.close();
  });

  it('AC4: supports inclusive date range filtering startDate and endDate', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/journal/entries?startDate=2026-08-01&endDate=2026-08-31',
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.pagination.total).toBe(4);
    expect(body.entries).toHaveLength(4);
    expect(body.entries.map((e: any) => e.entryDate)).toEqual([
      '2026-08-31',
      '2026-08-20',
      '2026-08-15',
      '2026-08-01',
    ]);

    await app.close();
  });

  it('AC4: supports single filter boundary startDate', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/journal/entries?startDate=2026-09-01',
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.pagination.total).toBe(2);
    expect(body.entries.map((e: any) => e.entryDate)).toEqual(['2026-09-03', '2026-09-01']);

    await app.close();
  });

  it('AC5: returns 422 VALIDATION_ERROR when startDate > endDate', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/journal/entries?startDate=2026-09-10&endDate=2026-09-01',
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body)).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'startDate must not be after endDate',
      },
    });

    await app.close();
  });

  it('AC6: returns 422 INVALID_DATE when filter date is invalid calendar date', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/journal/entries?startDate=2026-02-30',
      headers: { authorization: `Bearer ${validToken}` },
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

  it('AC7: returns 422 VALIDATION_ERROR when limit exceeds 50', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/journal/entries?limit=51',
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body)).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
      },
    });

    await app.close();
  });

  it('returns 422 VALIDATION_ERROR when page is less than 1', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/journal/entries?page=0',
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body)).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
      },
    });

    await app.close();
  });

  it('returns 422 VALIDATION_ERROR when limit is less than 1', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/journal/entries?limit=0',
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body)).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
      },
    });

    await app.close();
  });

  it('AC8: returns 200 with empty list for user with 0 entries', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const otherToken = signJwt({ userId: 'empty-user' }, JWT_SECRET, 86400);
    const res = await app.inject({
      method: 'GET',
      url: '/api/journal/entries',
      headers: { authorization: `Bearer ${otherToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toEqual({
      entries: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        hasMore: false,
      },
    });

    await app.close();
  });

  it('AC9: returns 401 UNAUTHORIZED when no token provided', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/journal/entries',
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });

    await app.close();
  });
});

describe('Story 2.3: Delete Journal Entry (Unit & Integration)', () => {
  let journalRepo: InMemoryJournalRepository;
  let journalService: JournalService;
  let validToken: string;

  beforeEach(() => {
    journalRepo = new InMemoryJournalRepository();
    journalService = new JournalService(journalRepo);
    validToken = signJwt({ userId: 'user-123' }, JWT_SECRET, 86400);
  });

  it('deletes existing entry successfully in service', async () => {
    await journalRepo.upsert('user-123', '2026-09-03', {
      notes: 'To be deleted',
      mood: 'good',
      tags: ['test'],
    });

    const res = await journalService.deleteEntry('user-123', '2026-09-03');
    expect(res).toEqual({ status: 'deleted' });

    const found = await journalRepo.findByDate('user-123', '2026-09-03');
    expect(found).toBeNull();
  });

  it('throws EntryNotFoundError when deleting non-existent date', async () => {
    await expect(journalService.deleteEntry('user-123', '2026-09-03')).rejects.toThrow(
      EntryNotFoundError
    );
  });

  it('throws EntryNotFoundError when attempting IDOR delete', async () => {
    await journalRepo.upsert('user-456', '2026-09-03', {
      notes: 'Other user',
      mood: 'neutral',
      tags: [],
    });

    await expect(journalService.deleteEntry('user-123', '2026-09-03')).rejects.toThrow(
      EntryNotFoundError
    );
    const stillExists = await journalRepo.findByDate('user-456', '2026-09-03');
    expect(stillExists).not.toBeNull();
  });

  it('throws InvalidDateError when date parameter is invalid', async () => {
    await expect(journalService.deleteEntry('user-123', '2026-02-30')).rejects.toThrow(
      InvalidDateError
    );
  });

  it('HTTP DELETE /api/journal/entries/:date deletes entry successfully (200)', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    await journalRepo.upsert('user-123', '2026-09-03', {
      notes: 'Goodbye entry',
      mood: 'good',
      tags: ['bye'],
    });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/journal/entries/2026-09-03',
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: 'deleted' });

    const checkGet = await app.inject({
      method: 'GET',
      url: '/api/journal/entries/2026-09-03',
      headers: { authorization: `Bearer ${validToken}` },
    });
    expect(checkGet.statusCode).toBe(404);

    await app.close();
  });

  it('HTTP DELETE /api/journal/entries/:date returns 404 for non-existent entry', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/journal/entries/2026-09-03',
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({
      error: {
        code: 'ENTRY_NOT_FOUND',
        message: 'No entry found for this date',
      },
    });

    await app.close();
  });

  it('HTTP DELETE /api/journal/entries/:date returns 404 on IDOR attempt and leaves entry intact', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    await journalRepo.upsert('user-456', '2026-09-03', {
      notes: 'User 456 secret',
      mood: 'bad',
      tags: [],
    });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/journal/entries/2026-09-03',
      headers: { authorization: `Bearer ${validToken}` }, // token is user-123
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({
      error: {
        code: 'ENTRY_NOT_FOUND',
        message: 'No entry found for this date',
      },
    });

    const entryStillThere = await journalRepo.findByDate('user-456', '2026-09-03');
    expect(entryStillThere).not.toBeNull();

    await app.close();
  });

  it('HTTP DELETE /api/journal/entries/:date returns 422 for invalid date', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/journal/entries/2026-02-30',
      headers: { authorization: `Bearer ${validToken}` },
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

  it('HTTP DELETE /api/journal/entries/:date returns 401 when unauthorized', async () => {
    const app = await buildApp({
      logger: false,
      autoCloseDb: false,
      authService: mockAuthService,
      journalService,
      jwtSecret: JWT_SECRET,
    });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/journal/entries/2026-09-03',
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });

    await app.close();
  });
});
