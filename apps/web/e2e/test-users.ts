import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import {
  API_ENDPOINTS,
  buildBearerAuthorization,
  getApiUrl,
  getMeetingFilesEndpoint,
  MEETING_FILE_FIELD,
} from '../src/lib/api';
import { ROUTES } from '../src/lib/routes';

export const TEST_PASSWORD = 'test-password-123';
export const TEST_NAME = 'Ada Lovelace';
export const TEST_NAME_INITIALS = 'AL';

type TestUser = { name: string; email: string; accessToken: string };
type TestMeeting = { title: string; date: string };
type TestFile = { name: string; mimeType: string; buffer: Buffer };

// Every test registers its own user, so the suite needs no database cleanup
// and can run repeatedly against the same Postgres instance.
export async function createTestUser(): Promise<TestUser> {
  const email = `e2e-${randomUUID()}@example.com`;
  const response = await fetch(`${getApiUrl()}${API_ENDPOINTS.REGISTER}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD, name: TEST_NAME }),
  });
  if (!response.ok) {
    throw new Error(`Registering ${email} failed with ${response.status}`);
  }
  const { accessToken } = (await response.json()) as { accessToken: string };
  return { name: TEST_NAME, email, accessToken };
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

export async function uploadTestFile(
  user: TestUser,
  meetingId: string,
  file: TestFile,
): Promise<void> {
  const formData = new FormData();
  formData.append(
    MEETING_FILE_FIELD,
    new Blob([new Uint8Array(file.buffer)], { type: file.mimeType }),
    file.name,
  );
  const response = await fetch(
    `${getApiUrl()}${getMeetingFilesEndpoint(meetingId)}`,
    {
      method: 'POST',
      headers: { Authorization: buildBearerAuthorization(user.accessToken) },
      body: formData,
    },
  );
  if (!response.ok) {
    throw new Error(`Uploading "${file.name}" failed: ${response.status}`);
  }
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
