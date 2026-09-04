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

export interface IJournalRepository {
  upsert(
    userId: string,
    entryDate: string,
    data: { notes: string; mood: Mood; tags: string[] }
  ): Promise<JournalEntryRecord>;
}

export interface IJournalService {
  saveEntry(
    userId: string,
    dateStr: string,
    input: UpsertJournalEntryInput
  ): Promise<JournalEntryResponse>;
}
