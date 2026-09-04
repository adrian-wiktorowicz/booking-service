import { eq, and } from 'drizzle-orm';
import { db } from '../../db/connection.js';
import { journalEntries } from '../../db/schema.js';
import { IJournalRepository, JournalEntryRecord, Mood } from './journal.types.js';

export class DrizzleJournalRepository implements IJournalRepository {
  constructor(private readonly database = db) {}

  async upsert(
    userId: string,
    entryDate: string,
    data: { notes: string; mood: Mood; tags: string[] }
  ): Promise<JournalEntryRecord> {
    const [entry] = await this.database
      .insert(journalEntries)
      .values({
        userId,
        entryDate,
        notes: data.notes,
        mood: data.mood,
        tags: data.tags,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [journalEntries.userId, journalEntries.entryDate],
        set: {
          notes: data.notes,
          mood: data.mood,
          tags: data.tags,
          updatedAt: new Date(),
        },
      })
      .returning();

    return entry;
  }

  async findByUserAndDate(userId: string, entryDate: string): Promise<JournalEntryRecord | null> {
    const [entry] = await this.database
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.userId, userId),
          eq(journalEntries.entryDate, entryDate)
        )
      )
      .limit(1);

    return entry ?? null;
  }
}
