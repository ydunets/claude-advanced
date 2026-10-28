import { expect, test } from '@playwright/test';
import { ACCESS_TOKEN_COOKIE } from '../src/lib/session';
import { createTestUser, logIn, TEST_PASSWORD } from './test-users';

test('the login page offers a link to registration', async ({ page }) => {
  await page.goto('/login');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Sign in' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Create an account' }).click();

  await expect(page).toHaveURL('/register');
});

test('valid credentials store the token and open the home page', async ({
  page,
  context,
}) => {
  const user = await createTestUser();

  await logIn(page, user.email, TEST_PASSWORD);

  await expect(page).toHaveURL('/');
  await expect(page.getByText(user.email)).toBeVisible();
  const cookies = await context.cookies();
  const token = cookies.find(({ name }) => name === ACCESS_TOKEN_COOKIE);
  expect(token?.httpOnly).toBe(true);
  expect(token?.value.split('.')).toHaveLength(3);
});

test('a wrong password shows an error and keeps the email', async ({
  page,
  context,
}) => {
  const user = await createTestUser();

  await logIn(page, user.email, 'wrong-password');

  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Incorrect email or password.',
  );
  await expect(page).toHaveURL('/login');
  await expect(page.getByLabel('Email')).toHaveValue(user.email);
  expect(await context.cookies()).toHaveLength(0);
});

test('an unknown email gets the same error as a wrong password', async ({
  page,
}) => {
  await logIn(page, 'nobody-here@example.com', TEST_PASSWORD);

  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Incorrect email or password.',
  );
});
