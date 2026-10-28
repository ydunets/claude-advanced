import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

const ENV_FILE = '.env';

if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

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
