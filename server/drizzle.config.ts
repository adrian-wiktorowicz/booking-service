import { defineConfig } from 'drizzle-kit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  dialect: 'postgresql',
  schema: path.join(__dirname, 'src/db/schema.ts').replace(/\\/g, '/'),
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/booking_service',
  },
});
