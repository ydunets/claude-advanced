import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { API_ENDPOINTS, getApiUrl } from '../src/lib/api';
import { ROUTES } from '../src/lib/routes';

export const TEST_PASSWORD = 'test-password-123';

type TestUser = { email: string; accessToken: string };
type TestMeeting = { title: string; date: string };

// Every test registers its own user, so the suite needs no database cleanup
// and can run repeatedly against the same Postgres instance.
export async function createTestUser(): Promise<TestUser> {
  const email = `e2e-${randomUUID()}@example.com`;
  const response = await fetch(`${getApiUrl()}${API_ENDPOINTS.REGISTER}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });
  if (!response.ok) {
    throw new Error(`Registering ${email} failed with ${response.status}`);
  }
  const { accessToken } = (await response.json()) as { accessToken: string };
  return { email, accessToken };
}

export async function createTestMeeting(
  user: TestUser,
  meeting: TestMeeting,
): Promise<string> {
  const response = await fetch(`${getApiUrl()}${API_ENDPOINTS.MEETINGS}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.accessToken}`,
    },
    body: JSON.stringify({ ...meeting, participants: ['guest@example.com'] }),
  });
  if (!response.ok) {
    throw new Error(`Creating "${meeting.title}" failed: ${response.status}`);
  }
  const { id } = (await response.json()) as { id: string };
  return id;
}

export async function logIn(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto(ROUTES.LOGIN);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}
