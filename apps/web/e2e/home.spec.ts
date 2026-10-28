import { expect, test } from '@playwright/test';
import {
  createTestMeeting,
  createTestUser,
  logIn,
  TEST_PASSWORD,
} from './test-users';

test('the home page sends a signed-out visitor to the login page', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page).toHaveURL('/login');
});

test('a user without meetings sees their email and an empty state', async ({
  page,
}) => {
  const user = await createTestUser();

  await logIn(page, user.email, TEST_PASSWORD);

  await expect(page.getByText(user.email)).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Your meetings' }),
  ).toBeVisible();
  await expect(page.getByText('No meetings yet.')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Latest meetings' }),
  ).toHaveCount(0);
});

test('the home page counts every meeting and lists the three latest', async ({
  page,
}) => {
  const user = await createTestUser();
  // Created out of date order: the page must sort by date, not by creation.
  const meetings = [
    { title: 'Kick-off', date: '2026-11-03T09:00:00.000Z' },
    { title: 'Retrospective', date: '2026-11-28T15:00:00.000Z' },
    { title: 'Design review', date: '2026-11-10T11:00:00.000Z' },
    { title: 'Planning', date: '2026-11-20T10:00:00.000Z' },
    { title: 'Budget sync', date: '2026-11-05T14:00:00.000Z' },
  ];
  for (const meeting of meetings) {
    await createTestMeeting(user, meeting);
  }

  await logIn(page, user.email, TEST_PASSWORD);

  await expect(page.getByText('5 meetings')).toBeVisible();
  const latest = page
    .getByRole('region', { name: 'Latest meetings' })
    .getByRole('listitem');
  await expect(latest).toHaveCount(3);
  await expect(latest.nth(0)).toContainText('Retrospective');
  await expect(latest.nth(1)).toContainText('Planning');
  await expect(latest.nth(2)).toContainText('Design review');
});

test('signing out clears the session', async ({ page, context }) => {
  const user = await createTestUser();
  await logIn(page, user.email, TEST_PASSWORD);
  await expect(page).toHaveURL('/');

  await page.getByRole('button', { name: 'Sign out' }).click();

  await expect(page).toHaveURL('/login');
  expect(await context.cookies()).toHaveLength(0);
  await page.goto('/');
  await expect(page).toHaveURL('/login');
});
