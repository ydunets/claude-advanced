import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { ACCESS_TOKEN_COOKIE } from '../src/lib/session';
import { getApiUrl, API_ENDPOINTS } from '../src/lib/api';
import {
  createTestUser,
  TEST_NAME,
  TEST_NAME_INITIALS,
  TEST_PASSWORD,
} from './test-users';

function createUniqueEmail(): string {
  return `e2e-${randomUUID()}@example.com`;
}

async function submitRegistration(
  page: Page,
  email: string,
  name: string,
): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('Name', { exact: true }).fill(name);
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
  const email = createUniqueEmail();

  await submitRegistration(page, email, TEST_NAME);

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('link', { name: TEST_NAME })).toBeVisible();
  await expect(
    page.getByText(TEST_NAME_INITIALS, { exact: true }),
  ).toBeVisible();
  const cookies = await context.cookies();
  expect(cookies.map(({ name }) => name)).toEqual([ACCESS_TOKEN_COOKIE]);
});

test('registration without a name shows a required error and creates no account', async ({
  page,
}) => {
  const email = createUniqueEmail();

  await submitRegistration(page, email, '');

  await expect(page.getByLabel('Name', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(page).toHaveURL('/register');
  // The email is still free, so the refused form stored nothing.
  const response = await fetch(`${getApiUrl()}${API_ENDPOINTS.REGISTER}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD, name: TEST_NAME }),
  });
  expect(response.ok).toBe(true);
});

test('a registered email shows a field error and stays on the page', async ({
  page,
}) => {
  const user = await createTestUser();

  await submitRegistration(page, user.email, user.name);

  await expect(
    page.getByText('An account with this email already exists.'),
  ).toBeVisible();
  await expect(page).toHaveURL('/register');
  await expect(page.getByLabel('Email')).toHaveValue(user.email);
});
