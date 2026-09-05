import { and, count, desc, eq, gte, lte } from 'drizzle-orm';
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

  async findByDate(userId: string, entryDate: string): Promise<JournalEntryRecord | null> {
    const [entry] = await this.database
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.userId, userId), eq(journalEntries.entryDate, entryDate)));

    return entry ?? null;
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
    const conditions = [eq(journalEntries.userId, userId)];
    if (options.startDate && options.startDate.trim() !== '') {
      conditions.push(gte(journalEntries.entryDate, options.startDate));
    }
    if (options.endDate && options.endDate.trim() !== '') {
      conditions.push(lte(journalEntries.entryDate, options.endDate));
    }
    const whereClause = and(...conditions);

    const [entries, totalResult] = await Promise.all([
      this.database
        .select()
        .from(journalEntries)
        .where(whereClause)
        .orderBy(desc(journalEntries.entryDate))
        .limit(options.limit)
        .offset(options.offset),
      this.database
        .select({ count: count() })
        .from(journalEntries)
        .where(whereClause),
    ]);

    return {
      entries,
      total: Number(totalResult[0]?.count ?? 0),
    };
  }

  async deleteByDate(userId: string, entryDate: string): Promise<boolean> {
    const deleted = await this.database
      .delete(journalEntries)
      .where(and(eq(journalEntries.userId, userId), eq(journalEntries.entryDate, entryDate)))
      .returning({ id: journalEntries.id });

    return deleted.length > 0;
  }
}
