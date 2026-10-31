import { expect, test } from '@playwright/test';
import {
  createTestUser,
  logIn,
  TEST_NAME_INITIALS,
  TEST_PASSWORD,
} from './test-users';

test('the profile page sends a signed-out visitor to the login page', async ({
  page,
}) => {
  await page.goto('/profile');

  await expect(page).toHaveURL('/login');
});

test('the home page links to a profile with the name, the email and the initials', async ({
  page,
}) => {
  const user = await createTestUser();
  await logIn(page, user.email, TEST_PASSWORD);

  await page.getByRole('link', { name: user.name }).click();

  await expect(page).toHaveURL('/profile');
  // Scoped to the visible landmark: after a client navigation Next.js keeps
  // the home page mounted but hidden, with its own initials.
  const profile = page.getByRole('main');
  await expect(
    profile.getByRole('heading', { level: 1, name: user.name }),
  ).toBeVisible();
  await expect(profile.getByText(user.email)).toBeVisible();
  await expect(
    profile.getByText(TEST_NAME_INITIALS, { exact: true }),
  ).toBeVisible();
});
