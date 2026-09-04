import {
  IJournalRepository,
  IJournalService,
  JournalEntryResponse,
  Mood,
  UpsertJournalEntryInput,
  VALID_MOODS,
  InvalidDateError,
  InvalidMoodError,
  PayloadValidationError,
} from './journal.types.js';

export function isValidCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return false;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
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

    return {
      id: record.id,
      userId: record.userId,
      entryDate: record.entryDate,
      notes: record.notes,
      mood: record.mood as Mood,
      tags: record.tags,
      createdAt:
        record.createdAt instanceof Date ? record.createdAt.toISOString() : String(record.createdAt),
      updatedAt:
        record.updatedAt instanceof Date ? record.updatedAt.toISOString() : String(record.updatedAt),
    };
  }
}
