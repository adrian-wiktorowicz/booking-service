export const VALID_MOODS = ['bad', 'neutral', 'good', 'very_good'] as const;
export type Mood = (typeof VALID_MOODS)[number];

export interface JournalEntryRecord {
  id: string;
  userId: string;
  entryDate: string;
  notes: string;
  mood: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface JournalEntryResponse {
  id: string;
  userId: string;
  entryDate: string;
  notes: string;
  mood: Mood;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UpsertJournalEntryInput {
  notes?: string;
  mood: Mood | string;
  tags?: string[];
}

export class InvalidDateError extends Error {
  readonly code = 'INVALID_DATE';
  readonly statusCode = 422;
  constructor(message: string = 'Invalid calendar date') {
    super(message);
    this.name = 'InvalidDateError';
  }
}

export class PayloadValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 422;
  constructor(message: string) {
    super(message);
    this.name = 'PayloadValidationError';
  }
}

export class InvalidMoodError extends PayloadValidationError {
  constructor() {
    super('Mood must be one of: bad, neutral, good, very_good');
    this.name = 'InvalidMoodError';
  }
}

export class EntryNotFoundError extends Error {
  readonly code = 'ENTRY_NOT_FOUND';
  readonly statusCode = 404;
  constructor(message: string = 'No entry found for this date') {
    super(message);
    this.name = 'EntryNotFoundError';
  }
}

export interface JournalFilterOptions {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface PaginatedJournalEntriesResponse {
  entries: JournalEntryResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export interface IJournalRepository {
  upsert(
    userId: string,
    entryDate: string,
    data: { notes: string; mood: Mood; tags: string[] }
  ): Promise<JournalEntryRecord>;
  findByDate(userId: string, entryDate: string): Promise<JournalEntryRecord | null>;
  findMany(
    userId: string,
    options: {
      offset: number;
      limit: number;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{ entries: JournalEntryRecord[]; total: number }>;
  deleteByDate(userId: string, entryDate: string): Promise<boolean>;
}

export interface IJournalService {
  saveEntry(
    userId: string,
    dateStr: string,
    input: UpsertJournalEntryInput
  ): Promise<JournalEntryResponse>;
  getEntryByDate(userId: string, dateStr: string): Promise<JournalEntryResponse>;
  getEntries(
    userId: string,
    options?: JournalFilterOptions
  ): Promise<PaginatedJournalEntriesResponse>;
  deleteEntry(userId: string, dateStr: string): Promise<{ status: string }>;
}
