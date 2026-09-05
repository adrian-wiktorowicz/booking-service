import {
  IJournalRepository,
  IJournalService,
  JournalEntryRecord,
  JournalEntryResponse,
  JournalFilterOptions,
  PaginatedJournalEntriesResponse,
  Mood,
  UpsertJournalEntryInput,
  VALID_MOODS,
  InvalidDateError,
  InvalidMoodError,
  PayloadValidationError,
  EntryNotFoundError,
} from './journal.types.js';

export function isValidCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function toJournalEntryResponse(record: JournalEntryRecord): JournalEntryResponse {
  return {
    id: record.id,
    userId: record.userId,
    entryDate: record.entryDate,
    notes: record.notes,
    mood: record.mood as Mood,
    tags: [...record.tags],
    createdAt:
      record.createdAt instanceof Date ? record.createdAt.toISOString() : String(record.createdAt),
    updatedAt:
      record.updatedAt instanceof Date ? record.updatedAt.toISOString() : String(record.updatedAt),
  };
}

export class JournalService implements IJournalService {
  constructor(private readonly journalRepo: IJournalRepository) {}

  async saveEntry(
    userId: string,
    dateStr: string,
    input: UpsertJournalEntryInput
  ): Promise<JournalEntryResponse> {
    if (!isValidCalendarDate(dateStr)) {
      throw new InvalidDateError();
    }

    if (!input || !VALID_MOODS.includes(input.mood as Mood)) {
      throw new InvalidMoodError();
    }

    if (input.notes !== undefined && typeof input.notes !== 'string') {
      throw new PayloadValidationError('Notes must be a string');
    }
    const notes = input.notes ?? '';
    if (notes.length > 50000) {
      throw new PayloadValidationError('Notes must not exceed 50000 characters');
    }

    if (
      input.tags !== undefined &&
      (!Array.isArray(input.tags) || input.tags.some((t) => typeof t !== 'string'))
    ) {
      throw new PayloadValidationError('Tags must be an array of strings');
    }
    const tags = input.tags ?? [];
    if (tags.length > 10) {
      throw new PayloadValidationError('Tags must not exceed 10 items');
    }

    const record = await this.journalRepo.upsert(userId, dateStr, {
      notes,
      mood: input.mood as Mood,
      tags,
    });

    return toJournalEntryResponse(record);
  }

  async getEntryByDate(userId: string, dateStr: string): Promise<JournalEntryResponse> {
    if (!isValidCalendarDate(dateStr)) {
      throw new InvalidDateError();
    }

    const record = await this.journalRepo.findByDate(userId, dateStr);
    if (!record) {
      throw new EntryNotFoundError();
    }

    return toJournalEntryResponse(record);
  }

  async getEntries(
    userId: string,
    options?: JournalFilterOptions
  ): Promise<PaginatedJournalEntriesResponse> {
    const page = options?.page !== undefined ? Number(options.page) : 1;
    const limit = options?.limit !== undefined ? Number(options.limit) : 20;

    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new PayloadValidationError('Validation failed');
    }

    if (options?.startDate !== undefined) {
      if (!isValidCalendarDate(options.startDate)) {
        throw new InvalidDateError();
      }
    }

    if (options?.endDate !== undefined) {
      if (!isValidCalendarDate(options.endDate)) {
        throw new InvalidDateError();
      }
    }

    if (
      options?.startDate !== undefined &&
      options?.endDate !== undefined &&
      options.startDate > options.endDate
    ) {
      throw new PayloadValidationError('startDate must not be after endDate');
    }

    const offset = (page - 1) * limit;
    const { entries, total } = await this.journalRepo.findMany(userId, {
      offset,
      limit,
      startDate: options?.startDate,
      endDate: options?.endDate,
    });

    const hasMore = offset + entries.length < total;

    return {
      entries: entries.map(toJournalEntryResponse),
      pagination: {
        page,
        limit,
        total,
        hasMore,
      },
    };
  }
}
