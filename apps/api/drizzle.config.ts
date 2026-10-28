import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit runs outside Nest, so ConfigModule has not loaded .env here.
config({ quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set; copy .env.example to .env');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema.ts',
  out: './drizzle',
  dbCredentials: { url: databaseUrl },
});
