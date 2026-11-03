import { expect, test, type Locator, type Page } from '@playwright/test';
import { ROUTES } from '../src/lib/routes';
import {
  createTestUser,
  logIn,
  TEST_NAME,
  TEST_NAME_INITIALS,
  TEST_PASSWORD,
} from './test-users';

const MAX_NAME_LENGTH = 100;
const NEW_NAME = 'Grace Hopper';
const TRIMMED_NAME = 'Anna Maria Lee';
const SAVED_MESSAGE = 'Your name was saved.';

async function openProfileAsNewUser(page: Page): Promise<void> {
  const user = await createTestUser();
  await logIn(page, user.email, TEST_PASSWORD);
  await expect(page).toHaveURL(ROUTES.HOME);
  await page.goto(ROUTES.PROFILE);
}

// Exact, because the "Edit your name" section is also labelled.
function getNameField(page: Page): Locator {
  return page.getByLabel('Name', { exact: true });
}

async function submitName(page: Page, name: string): Promise<void> {
  await getNameField(page).fill(name);
  await page.getByRole('button', { name: 'Save name' }).click();
}

async function expectSavedName(page: Page, name: string): Promise<void> {
  await page.reload();
  await expect(
    page.getByRole('main').getByRole('heading', { level: 1, name }),
  ).toBeVisible();
}

test('a saved name shows on the profile and home pages after a reload', async ({
  page,
}) => {
  await openProfileAsNewUser(page);

  await submitName(page, NEW_NAME);
  await expect(page.getByText(SAVED_MESSAGE)).toBeVisible();

  await expectSavedName(page, NEW_NAME);
  await page.goto(ROUTES.HOME);
  await expect(page.getByRole('link', { name: NEW_NAME })).toBeVisible();
});

for (const [label, name] of [
  ['an empty', ''],
  ['a spaces-only', '   '],
]) {
  test(`an empty or spaces-only name is refused and the saved name is unchanged (${label} name)`, async ({
    page,
  }) => {
    await openProfileAsNewUser(page);

    await submitName(page, name);

    await expect(getNameField(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('name should not be empty')).toBeVisible();
    await expectSavedName(page, TEST_NAME);
  });
}

test('a name over 100 characters is refused with the limit', async ({
  page,
}) => {
  await openProfileAsNewUser(page);

  const tooLongName = 'a'.repeat(MAX_NAME_LENGTH + 1);
  await submitName(page, tooLongName);

  await expect(getNameField(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(
    page.getByText(`shorter than or equal to ${MAX_NAME_LENGTH} characters`),
  ).toBeVisible();
  await expectSavedName(page, TEST_NAME);
});

test('the first corrected submit after a refused name saves it', async ({
  page,
}) => {
  await openProfileAsNewUser(page);
  await submitName(page, '   ');
  await expect(getNameField(page)).toHaveAttribute('aria-invalid', 'true');

  await submitName(page, NEW_NAME);

  await expect(page.getByText(SAVED_MESSAGE)).toBeVisible();
});

test('surrounding spaces are trimmed and the initials show AM', async ({
  page,
}) => {
  await openProfileAsNewUser(page);

  await submitName(page, `  ${TRIMMED_NAME}  `);
  await expect(page.getByText(SAVED_MESSAGE)).toBeVisible();

  await expectSavedName(page, TRIMMED_NAME);
  await expect(getNameField(page)).toHaveValue(TRIMMED_NAME);
  await expect(
    page.getByRole('main').getByText('AM', { exact: true }),
  ).toBeVisible();
});

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
