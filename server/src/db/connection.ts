import 'dotenv/config';
import { Pool, PoolConfig } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/booking_service',
  max: 20,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 10000,
  statement_timeout: 3000,
};

export const pool = new Pool(poolConfig);
export const db = drizzle({ client: pool });

export const checkDatabaseHealth = async (dbPool: Pool = pool): Promise<boolean> => {
  try {
    const client = await dbPool.connect();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  } catch {
    return false;
  }
};

export const closeDatabase = async (dbPool: Pool = pool): Promise<void> => {
  try {
    if (!(dbPool as any).ended) {
      await dbPool.end();
    }
  } catch {
    // Safe fallback if already closed
  }
};
