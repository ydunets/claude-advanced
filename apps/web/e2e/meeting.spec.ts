import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, truncate, writeFile } from 'node:fs/promises';
import {
  expect,
  test,
  type Locator,
  type Page,
  type Route,
} from '@playwright/test';
import { HTTP_STATUS } from '../src/lib/api';
import {
  getMeetingFileRoute,
  getMeetingFilesRoute,
  getMeetingRoute,
  ROUTES,
} from '../src/lib/routes';
import { getMaxUploadSizeBytes } from '../src/lib/upload-limits';
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

// A browser that cannot type a file sends the part as application/octet-stream,
// which the API stores unchanged. Playwright infers a type from every allowed
// extension, so the fixture sends that fallback type explicitly.
const OCTET_STREAM_TYPE = 'application/octet-stream';
const OCTET_STREAM_FILE: UploadedFile = {
  name: 'transcript.md',
  mimeType: OCTET_STREAM_TYPE,
  buffer: Buffer.from('00:00 Welcome'),
};

const REPORT_FILE: UploadedFile = {
  name: 'Протокол встречи.pdf',
  mimeType: 'application/pdf',
  buffer: randomBytes(64 * 1024),
};
const EXECUTABLE_FILE: UploadedFile = {
  name: 'setup.exe',
  mimeType: 'application/x-msdownload',
  buffer: Buffer.from('MZ'),
};
// The PRD's list, kept here so the test checks the message independently.
const ALLOWED_FORMATS = [
  'mp4',
  'webm',
  'mov',
  'mp3',
  'm4a',
  'wav',
  'ogg',
  'pdf',
  'docx',
  'pptx',
  'xlsx',
  'txt',
  'md',
];
// The PRD states the limit in this form; the form must show it verbatim.
const UPLOAD_LIMIT_LABEL = '100 MB';
const OVERSIZED_FILE_NAME = 'oversized.mp4';
const CONNECTION_LOST_TEXT = /connection/i;
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

function getFilesRegion(page: Page): Locator {
  return page.getByRole('region', { name: 'Files' });
}

function getFileRows(page: Page): Locator {
  return getFilesRegion(page).getByRole('listitem');
}

function getDownloadLink(row: Locator): Locator {
  return row.getByRole('link', { name: /^Download/ });
}

async function signOut(page: Page): Promise<void> {
  await page.goto(ROUTES.HOME);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(ROUTES.LOGIN);
}

function getUploadAlert(page: Page): Locator {
  return getFilesRegion(page).getByRole('alert');
}

async function interceptUploads(
  page: Page,
  meetingId: string,
  handler: (route: Route) => Promise<void>,
): Promise<void> {
  await page.route(`**${getMeetingFilesRoute(meetingId)}`, handler);
}

async function uploadFile(
  page: Page,
  file: UploadedFile | string,
): Promise<void> {
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
  await expect(getFilesRegion(page)).toBeVisible();
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

  await uploadFile(page, OCTET_STREAM_FILE);

  const rows = getFileRows(page);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(OCTET_STREAM_FILE.name);
  await expect(rows.first()).toContainText(OCTET_STREAM_TYPE);
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

  const filesRegion = getFilesRegion(page);
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

test('an upload shows progress until the file is listed', async ({ page }) => {
  const user = await createTestUser();
  const meetingId = await createTestMeeting(user, MEETING);
  await logInAndOpenMeeting(page, user.email, meetingId);
  // Holding the request keeps the upload in flight long enough to observe.
  const { promise: uploadReleased, resolve: releaseUpload } =
    Promise.withResolvers<void>();
  await interceptUploads(page, meetingId, async (route) => {
    await uploadReleased;
    await route.continue();
  });

  await uploadFile(page, NOTES_FILE);

  const progress = page.getByRole('progressbar', { name: 'Upload progress' });
  await expect(progress).toBeVisible();
  releaseUpload();
  await expect(progress).toBeHidden();
  // Read once, without retrying: the bar must stay until the file is listed.
  expect(await getFileRows(page).count()).toBe(1);
});

test('a file over 100 MB is rejected with the limit and the list is unchanged', async ({
  page,
}, testInfo) => {
  const user = await createTestUser();
  const meetingId = await createTestMeeting(user, MEETING);
  await uploadTestFile(user, meetingId, NOTES_FILE);
  const maxUploadSizeBytes = getMaxUploadSizeBytes();
  // A sparse file: one byte over the limit without writing 100 MB to disk.
  const oversizedFilePath = testInfo.outputPath(OVERSIZED_FILE_NAME);
  await writeFile(oversizedFilePath, '');
  await truncate(oversizedFilePath, maxUploadSizeBytes + 1);
  const sentUploads: string[] = [];
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === getMeetingFilesRoute(meetingId)
    ) {
      sentUploads.push(request.url());
    }
  });
  await logInAndOpenMeeting(page, user.email, meetingId);

  await uploadFile(page, oversizedFilePath);

  await expect(getUploadAlert(page)).toContainText(UPLOAD_LIMIT_LABEL);
  expect(sentUploads).toEqual([]);
  await page.reload();
  await expect(getFileRows(page)).toHaveCount(1);
});

test('a disallowed format is rejected with the allowed formats and the list is unchanged', async ({
  page,
}) => {
  const user = await createTestUser();
  const meetingId = await createTestMeeting(user, MEETING);
  await uploadTestFile(user, meetingId, NOTES_FILE);
  await logInAndOpenMeeting(page, user.email, meetingId);

  await uploadFile(page, EXECUTABLE_FILE);

  const alert = getUploadAlert(page);
  await expect(alert).toBeVisible();
  for (const format of ALLOWED_FORMATS) {
    await expect(alert).toContainText(format);
  }
  await page.reload();
  await expect(getFileRows(page)).toHaveCount(1);
});

test('a lost connection shows an error and lists no incomplete file', async ({
  page,
}) => {
  const user = await createTestUser();
  const meetingId = await createTestMeeting(user, MEETING);
  await uploadTestFile(user, meetingId, NOTES_FILE);
  await logInAndOpenMeeting(page, user.email, meetingId);
  await interceptUploads(page, meetingId, (route) =>
    route.abort('connectionreset'),
  );

  await uploadFile(page, RECORDING_FILE);

  await expect(getUploadAlert(page)).toContainText(CONNECTION_LOST_TEXT);
  await page.reload();
  await expect(getFileRows(page)).toHaveCount(1);
});
