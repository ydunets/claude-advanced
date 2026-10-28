import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// The suite drives the running app (`pnpm dev`) and the real API, so it reads
// the same env file as the app instead of carrying default URLs in code.
process.loadEnvFile(path.join(__dirname, '.env'));

export default defineConfig({
  testDir: './e2e',
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
