import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  createTestMeeting,
  createTestUser,
  logIn,
  TEST_PASSWORD,
} from './test-users';

const MEETING = {
  title: 'Design review',
  date: '2026-11-10T11:00:00.000Z',
};
const PARTICIPANT_EMAIL = 'guest@example.com';

type UploadedFile = { name: string; mimeType: string; buffer: Buffer };

const NOTES_FILE: UploadedFile = {
  name: 'notes.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from('Agenda: ship the file upload.'),
};
const NOTES_FILE_SIZE_LABEL = '29 B';

// Larger than the proxy's 10 MB body buffer: if the proxy matcher ever covers
// the upload Route Handler, this file reaches the API truncated and fails.
const RECORDING_SIZE_MB = 11;
const RECORDING_FILE: UploadedFile = {
  name: 'recording.mp4',
  mimeType: 'video/mp4',
  buffer: Buffer.alloc(RECORDING_SIZE_MB * 1024 * 1024),
};
const RECORDING_SIZE_LABEL = `${RECORDING_SIZE_MB} MB`;

function getMeetingPath(meetingId: string): string {
  return `/meetings/${meetingId}`;
}

async function logInAndOpenMeeting(
  page: Page,
  email: string,
  meetingId: string,
): Promise<void> {
  await logIn(page, email, TEST_PASSWORD);
  await expect(page).toHaveURL('/');
  await page.goto(getMeetingPath(meetingId));
}

function getFileRows(page: Page): Locator {
  return page.getByRole('region', { name: 'Files' }).getByRole('listitem');
}

async function uploadFile(page: Page, file: UploadedFile): Promise<void> {
  await page.getByLabel('File', { exact: true }).setInputFiles(file);
  await page.getByRole('button', { name: 'Upload' }).click();
}

test('an owner opens a meeting from the home page and sees its details', async ({
  page,
}) => {
  const user = await createTestUser();
  const meetingId = await createTestMeeting(user, MEETING);
  await logIn(page, user.email, TEST_PASSWORD);

  await page.getByRole('link', { name: MEETING.title }).click();

  await expect(page).toHaveURL(getMeetingPath(meetingId));
  await expect(
    page.getByRole('heading', { level: 1, name: MEETING.title }),
  ).toBeVisible();
  // Scoped to the visible main landmark: after a client navigation Next.js
  // keeps the previous page in the DOM, hidden.
  await expect(
    page.getByRole('main').locator(`time[datetime="${MEETING.date}"]`),
  ).toBeVisible();
  await expect(page.getByText(PARTICIPANT_EMAIL)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Files' })).toBeVisible();
});

test('the meeting page sends a signed-out visitor to the login page', async ({
  page,
}) => {
  await page.goto(getMeetingPath(randomUUID()));

  await expect(page).toHaveURL('/login');
});

test('an uploaded file is listed', async ({ page }) => {
  const user = await createTestUser();
  const meetingId = await createTestMeeting(user, MEETING);
  await logInAndOpenMeeting(page, user.email, meetingId);

  await uploadFile(page, NOTES_FILE);

  const rows = getFileRows(page);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(NOTES_FILE.name);
  await expect(rows.first()).toContainText(NOTES_FILE.mimeType);
  await expect(rows.first()).toContainText(NOTES_FILE_SIZE_LABEL);
  await expect(rows.first().locator('time')).toBeVisible();
});

test('a second upload lists both files', async ({ page }) => {
  const user = await createTestUser();
  const meetingId = await createTestMeeting(user, MEETING);
  await logInAndOpenMeeting(page, user.email, meetingId);

  await uploadFile(page, NOTES_FILE);
  await expect(getFileRows(page)).toHaveCount(1);
  await uploadFile(page, RECORDING_FILE);

  const rows = getFileRows(page);
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText(NOTES_FILE.name);
  await expect(rows.nth(1)).toContainText(RECORDING_FILE.name);
  await expect(rows.nth(1)).toContainText(RECORDING_FILE.mimeType);
  await expect(rows.nth(1)).toContainText(RECORDING_SIZE_LABEL);
});

test('an uploaded file survives a reload and a new sign-in', async ({
  page,
}) => {
  const user = await createTestUser();
  const meetingId = await createTestMeeting(user, MEETING);
  await logInAndOpenMeeting(page, user.email, meetingId);
  await uploadFile(page, NOTES_FILE);
  await expect(getFileRows(page)).toHaveCount(1);

  await page.reload();
  await expect(getFileRows(page)).toHaveCount(1);
  await expect(getFileRows(page).first()).toContainText(NOTES_FILE.name);

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/login');
  await logInAndOpenMeeting(page, user.email, meetingId);
  await expect(getFileRows(page)).toHaveCount(1);
  await expect(getFileRows(page).first()).toContainText(NOTES_FILE.name);
});
