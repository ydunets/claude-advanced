import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { HTTP_STATUS, MIN_PASSWORD_LENGTH } from '../src/lib/api';
import { ROUTES } from '../src/lib/routes';
import {
  createTestUser,
  logIn,
  TEST_NAME,
  TEST_NAME_INITIALS,
  TEST_PASSWORD,
  type TestUser,
} from './test-users';
import { createNoisePng } from './test-images';

const MAX_NAME_LENGTH = 100;
const NEW_NAME = 'Grace Hopper';
const TRIMMED_NAME = 'Anna Maria Lee';
const SAVED_MESSAGE = 'Your name was saved.';

async function openProfileAsNewUser(page: Page): Promise<TestUser> {
  const user = await createTestUser();
  await logIn(page, user.email, TEST_PASSWORD);
  await expect(page).toHaveURL(ROUTES.HOME);
  await page.goto(ROUTES.PROFILE);
  return user;
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

const NEW_PASSWORD = 'new-password-456';
const PASSWORD_SAVED_MESSAGE = 'Your password was changed.';
const WRONG_PASSWORD = 'wrong-password-789';
const SHORT_PASSWORD_LENGTH = MIN_PASSWORD_LENGTH - 1;
const SHORT_PASSWORD = 'a'.repeat(SHORT_PASSWORD_LENGTH);
const INCORRECT_CREDENTIALS_MESSAGE = 'Incorrect email or password.';
// Long enough for one submit's response, short enough to retry quickly.
const SUBMIT_RESPONSE_TIMEOUT_MS = 1000;

type PasswordEntries = {
  currentPassword: string;
  newPassword: string;
  confirmation: string;
};

async function submitPassword(
  page: Page,
  { currentPassword, newPassword, confirmation }: PasswordEntries,
): Promise<void> {
  await page.getByLabel('Current password').fill(currentPassword);
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm new password').fill(confirmation);
  await page.getByRole('button', { name: 'Change password' }).click();
}

async function submitNewPassword(
  page: Page,
  newPassword: string,
): Promise<void> {
  await submitPassword(page, {
    currentPassword: TEST_PASSWORD,
    newPassword,
    confirmation: newPassword,
  });
}

async function expectStillSignedIn(page: Page): Promise<void> {
  await page.reload();
  await expect(page).toHaveURL(ROUTES.PROFILE);
  await expect(
    page.getByRole('main').getByRole('heading', { level: 1, name: TEST_NAME }),
  ).toBeVisible();
}

// Signs in from a fresh browser context, so this page's cookie is untouched.
async function signInFromNewBrowser(
  browser: Browser,
  email: string,
  password: string,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await logIn(page, email, password);
  return { context, page };
}

async function expectSignInAccepted(
  browser: Browser,
  email: string,
  password: string,
): Promise<void> {
  const { context, page } = await signInFromNewBrowser(
    browser,
    email,
    password,
  );
  await expect(page).toHaveURL(ROUTES.HOME);
  await context.close();
}

async function expectSignInRefused(
  browser: Browser,
  email: string,
  password: string,
): Promise<void> {
  const { context, page } = await signInFromNewBrowser(
    browser,
    email,
    password,
  );
  await expect(page.getByText(INCORRECT_CREDENTIALS_MESSAGE)).toBeVisible();
  await expect(page).toHaveURL(ROUTES.LOGIN);
  await context.close();
}

test('a password change keeps this browser signed in and only the new password signs in', async ({
  browser,
  page,
}) => {
  const user = await openProfileAsNewUser(page);

  await submitNewPassword(page, NEW_PASSWORD);
  await expect(page.getByText(PASSWORD_SAVED_MESSAGE)).toBeVisible();

  await expectStillSignedIn(page);
  await expectSignInRefused(browser, user.email, TEST_PASSWORD);
  await expectSignInAccepted(browser, user.email, NEW_PASSWORD);
});

test('a password change sends another browser to the login page', async ({
  browser,
  page,
}) => {
  const user = await openProfileAsNewUser(page);
  const { context: otherContext, page: otherPage } = await signInFromNewBrowser(
    browser,
    user.email,
    TEST_PASSWORD,
  );
  await expect(otherPage).toHaveURL(ROUTES.HOME);

  await submitNewPassword(page, NEW_PASSWORD);
  await expect(page.getByText(PASSWORD_SAVED_MESSAGE)).toBeVisible();

  await otherPage.goto(ROUTES.PROFILE);
  await expect(otherPage).toHaveURL(ROUTES.LOGIN);
  await otherContext.close();
});

test('a wrong current password shows an error and the old password still works', async ({
  browser,
  page,
}) => {
  const user = await openProfileAsNewUser(page);

  await submitPassword(page, {
    currentPassword: WRONG_PASSWORD,
    newPassword: NEW_PASSWORD,
    confirmation: NEW_PASSWORD,
  });

  await expect(page.getByLabel('Current password')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(
    page.getByText('The current password is incorrect.'),
  ).toBeVisible();
  await expectSignInAccepted(browser, user.email, TEST_PASSWORD);
});

test('a new password under 8 characters is refused', async ({ page }) => {
  await openProfileAsNewUser(page);

  await submitNewPassword(page, SHORT_PASSWORD);

  await expect(
    page.getByLabel('New password', { exact: true }),
  ).toHaveAttribute('aria-invalid', 'true');
  await expect(
    page.getByText(`longer than or equal to ${MIN_PASSWORD_LENGTH} characters`),
  ).toBeVisible();
  await expectStillSignedIn(page);
});

test('different new password entries are refused', async ({ page }) => {
  await openProfileAsNewUser(page);

  await submitPassword(page, {
    currentPassword: TEST_PASSWORD,
    newPassword: NEW_PASSWORD,
    confirmation: `${NEW_PASSWORD}-typo`,
  });

  await expect(page.getByLabel('Confirm new password')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(
    page.getByText('The new password entries do not match.'),
  ).toBeVisible();
  await expect(page.getByText(PASSWORD_SAVED_MESSAGE)).toHaveCount(0);
});

test('a new password equal to the current one is refused', async ({ page }) => {
  await openProfileAsNewUser(page);

  await submitNewPassword(page, TEST_PASSWORD);

  await expect(
    page.getByLabel('New password', { exact: true }),
  ).toHaveAttribute('aria-invalid', 'true');
  await expect(
    page.getByText('New password must differ from the current one'),
  ).toBeVisible();
});

test('repeated wrong current passwords show the try-later message and keep this browser signed in', async ({
  page,
}) => {
  await openProfileAsNewUser(page);
  const tryLaterMessage = page.getByText('Too many attempts.', {
    exact: false,
  });

  // Submits until the limit is reached, whatever AUTH_ATTEMPT_LIMIT is.
  await expect(async () => {
    await submitPassword(page, {
      currentPassword: WRONG_PASSWORD,
      newPassword: NEW_PASSWORD,
      confirmation: NEW_PASSWORD,
    });
    await expect(tryLaterMessage).toBeVisible({
      timeout: SUBMIT_RESPONSE_TIMEOUT_MS,
    });
  }).toPass();

  await expectStillSignedIn(page);
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

// Kept here, not imported from src/lib, so the tests check the public
// addresses and the API's field name independently.
const AVATAR_ROUTE = '/profile/avatar';
const AVATAR_FIELD = 'avatar';
const PNG_MIME_TYPE = 'image/png';
const SMALL_IMAGE_SIDE = 64;

type ImageFile = { name: string; mimeType: string; buffer: Buffer };

function createSmallPng(): ImageFile {
  return {
    name: 'avatar.png',
    mimeType: PNG_MIME_TYPE,
    buffer: createNoisePng(SMALL_IMAGE_SIDE, SMALL_IMAGE_SIDE),
  };
}

test('another user or a signed-out visitor never receives the avatar image', async ({
  page,
  browser,
}) => {
  await openProfileAsNewUser(page);
  const avatar = createSmallPng();
  const upload = await page.request.put(AVATAR_ROUTE, {
    multipart: { [AVATAR_FIELD]: avatar },
  });
  expect(upload.status()).toBe(HTTP_STATUS.OK);
  const { avatarId } = (await upload.json()) as { avatarId: string };
  const ownerImage = await page.request.get(AVATAR_ROUTE);
  expect(ownerImage.status()).toBe(HTTP_STATUS.OK);
  expect(ownerImage.headers()['content-type']).toBe(PNG_MIME_TYPE);
  expect((await ownerImage.body()).equals(avatar.buffer)).toBe(true);

  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  await openProfileAsNewUser(otherPage);
  const otherImage = await otherPage.request.get(
    `${AVATAR_ROUTE}?v=${avatarId}`,
  );
  expect(otherImage.status()).toBe(HTTP_STATUS.NOT_FOUND);
  expect((await otherImage.body()).equals(avatar.buffer)).toBe(false);
  await otherContext.close();

  const signedOutContext = await browser.newContext();
  const signedOutImage = await signedOutContext.request.get(
    `${AVATAR_ROUTE}?v=${avatarId}`,
  );
  expect(signedOutImage.status()).toBe(HTTP_STATUS.NOT_FOUND);
  expect((await signedOutImage.body()).equals(avatar.buffer)).toBe(false);
  await signedOutContext.close();
});
