import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { HTTP_STATUS } from '../src/lib/api';
import {
  getMeetingFileRoute,
  getMeetingRoute,
  ROUTES,
} from '../src/lib/routes';
import {
  createTestMeeting,
  createTestUser,
  logIn,
  TEST_PASSWORD,
  uploadTestFile,
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

// The browser reports no type for an unknown extension and sends the part as
// application/octet-stream, which the API stores unchanged.
const UNTYPED_FILE: UploadedFile = {
  name: 'transcript.vtt-draft',
  mimeType: '',
  buffer: Buffer.from('00:00 Welcome'),
};
const UNTYPED_FILE_TYPE_LABEL = 'application/octet-stream';

const REPORT_FILE: UploadedFile = {
  name: 'Протокол встречи.pdf',
  mimeType: 'application/pdf',
  buffer: randomBytes(64 * 1024),
};
const MALFORMED_MEETING_ID = 'not-a-uuid';
const MALFORMED_FILE_ID = 'not-a-uuid';
const EMPTY_FILES_TEXT = 'No files yet.';
const NOT_FOUND_HEADING = /not found/i;

async function logInAndOpenMeeting(
  page: Page,
  email: string,
  meetingId: string,
): Promise<void> {
  await logIn(page, email, TEST_PASSWORD);
  await expect(page).toHaveURL(ROUTES.HOME);
  await page.goto(getMeetingRoute(meetingId));
}

function getFileRows(page: Page): Locator {
  return page.getByRole('region', { name: 'Files' }).getByRole('listitem');
}

function getDownloadLink(row: Locator): Locator {
  return row.getByRole('link', { name: /^Download/ });
}

async function signOut(page: Page): Promise<void> {
  await page.goto(ROUTES.HOME);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(ROUTES.LOGIN);
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

  await expect(page).toHaveURL(getMeetingRoute(meetingId));
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
  await page.goto(getMeetingRoute(randomUUID()));

  await expect(page).toHaveURL(ROUTES.LOGIN);
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

  await page.goto(ROUTES.HOME);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(ROUTES.LOGIN);
  await logInAndOpenMeeting(page, user.email, meetingId);
  await expect(getFileRows(page)).toHaveCount(1);
  await expect(getFileRows(page).first()).toContainText(NOTES_FILE.name);
});

test('a file without a type is listed as application/octet-stream', async ({
  page,
}) => {
  const user = await createTestUser();
  const meetingId = await createTestMeeting(user, MEETING);
  await logInAndOpenMeeting(page, user.email, meetingId);

  await uploadFile(page, UNTYPED_FILE);

  const rows = getFileRows(page);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(UNTYPED_FILE.name);
  await expect(rows.first()).toContainText(UNTYPED_FILE_TYPE_LABEL);
});

test('a downloaded file is byte-for-byte identical to the uploaded one', async ({
  page,
}) => {
  const user = await createTestUser();
  const meetingId = await createTestMeeting(user, MEETING);
  await logInAndOpenMeeting(page, user.email, meetingId);
  await uploadFile(page, REPORT_FILE);
  await expect(getFileRows(page)).toHaveCount(1);

  const downloadEvent = page.waitForEvent('download');
  await getDownloadLink(getFileRows(page).first()).click();
  const download = await downloadEvent;

  expect(download.suggestedFilename()).toBe(REPORT_FILE.name);
  const downloadedBytes = await readFile(await download.path());
  expect(Buffer.compare(downloadedBytes, REPORT_FILE.buffer)).toBe(0);
});

test('another user gets not found for the meeting page and its download address', async ({
  page,
}) => {
  const owner = await createTestUser();
  const otherUser = await createTestUser();
  const meetingId = await createTestMeeting(owner, MEETING);
  await uploadTestFile(owner, meetingId, NOTES_FILE);
  await logInAndOpenMeeting(page, owner.email, meetingId);
  const downloadHref = await getDownloadLink(
    getFileRows(page).first(),
  ).getAttribute('href');
  await signOut(page);

  await logInAndOpenMeeting(page, otherUser.email, meetingId);
  await expect(
    page.getByRole('heading', { name: NOT_FOUND_HEADING }),
  ).toBeVisible();
  await expect(page.getByText(MEETING.title)).toHaveCount(0);

  if (!downloadHref) {
    throw new Error('The owner view must link to the file download');
  }
  const downloadResponse = await page.request.get(downloadHref);
  expect(downloadResponse.status()).toBe(HTTP_STATUS.NOT_FOUND);
  expect((await downloadResponse.body()).length).toBe(0);
  // The API answers 400 for a malformed id; the visitor still sees 404.
  const malformedFileResponse = await page.request.get(
    getMeetingFileRoute(meetingId, MALFORMED_FILE_ID),
  );
  expect(malformedFileResponse.status()).toBe(HTTP_STATUS.NOT_FOUND);

  await page.goto(getMeetingRoute(MALFORMED_MEETING_ID));
  await expect(
    page.getByRole('heading', { name: NOT_FOUND_HEADING }),
  ).toBeVisible();
});

test('a meeting without files shows an empty state with an upload action', async ({
  page,
}) => {
  const user = await createTestUser();
  const meetingId = await createTestMeeting(user, MEETING);

  await logInAndOpenMeeting(page, user.email, meetingId);

  const filesRegion = page.getByRole('region', { name: 'Files' });
  const emptyState = filesRegion
    .locator('div')
    .filter({ has: page.getByText(EMPTY_FILES_TEXT) })
    .filter({ has: page.getByRole('button', { name: 'Upload' }) })
    .last();
  await expect(emptyState).toBeVisible();
  await expect(emptyState.getByLabel('File', { exact: true })).toBeVisible();
  await expect(getFileRows(page)).toHaveCount(0);

  await uploadFile(page, NOTES_FILE);
  await expect(getFileRows(page)).toHaveCount(1);
  await expect(filesRegion.getByText(EMPTY_FILES_TEXT)).toHaveCount(0);
});
