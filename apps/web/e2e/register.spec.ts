import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { ACCESS_TOKEN_COOKIE } from '../src/lib/session';
import { createTestUser, TEST_PASSWORD } from './test-users';

async function submitRegistration(page: Page, email: string): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
}

test('the registration page links to sign in', async ({ page }) => {
  await page.goto('/register');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Create your account' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Sign in' }).click();

  await expect(page).toHaveURL('/login');
});

test('a new account is signed in and lands on the home page', async ({
  page,
  context,
}) => {
  const email = `e2e-${randomUUID()}@example.com`;

  await submitRegistration(page, email);

  await expect(page).toHaveURL('/');
  await expect(page.getByText(email)).toBeVisible();
  const cookies = await context.cookies();
  expect(cookies.map(({ name }) => name)).toEqual([ACCESS_TOKEN_COOKIE]);
});

test('a registered email shows a field error and stays on the page', async ({
  page,
}) => {
  const user = await createTestUser();

  await submitRegistration(page, user.email);

  await expect(
    page.getByText('An account with this email already exists.'),
  ).toBeVisible();
  await expect(page).toHaveURL('/register');
  await expect(page.getByLabel('Email')).toHaveValue(user.email);
});
