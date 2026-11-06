'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  API_ENDPOINTS,
  deleteFromApi,
  GENERIC_ERROR,
  HTTP_STATUS,
  readValidationMessage,
  sendJsonToApi,
  UNREACHABLE_ERROR,
} from '@/lib/api';
import { getFormText } from '@/lib/form-data';
import type { Profile } from '@/lib/profile';
import { ROUTES } from '@/lib/routes';
import { findAccessToken, storeIssuedAccessToken } from '@/lib/session';

export type NameState = {
  name: string;
  fieldErrors: Record<string, string>;
  formError: string | null;
  isSaved: boolean;
};

export async function updateName(
  _previousState: NameState,
  formData: FormData,
): Promise<NameState> {
  const accessToken = await findAccessToken();
  if (!accessToken) {
    redirect(ROUTES.LOGIN);
  }
  const name = getFormText(formData, 'name');
  const unsaved = { name, fieldErrors: {}, formError: null, isSaved: false };

  let response: Response;
  try {
    response = await sendJsonToApi(
      accessToken,
      API_ENDPOINTS.PROFILE,
      'PATCH',
      { name },
    );
  } catch {
    return { ...unsaved, formError: UNREACHABLE_ERROR };
  }

  if (response.status === HTTP_STATUS.UNAUTHORIZED) {
    redirect(ROUTES.LOGIN);
  }
  if (response.status === HTTP_STATUS.BAD_REQUEST) {
    const message = await readValidationMessage(response);
    return { ...unsaved, fieldErrors: { name: message } };
  }
  if (!response.ok) {
    return { ...unsaved, formError: GENERIC_ERROR };
  }

  const profile = (await response.json()) as Profile;
  refresh();
  return { ...unsaved, name: profile.name, isSaved: true };
}

export type PasswordState = {
  fieldErrors: Record<string, string>;
  formError: string | null;
  isSaved: boolean;
};

const WRONG_CURRENT_PASSWORD_ERROR = 'The current password is incorrect.';
const PASSWORD_MISMATCH_ERROR = 'The new password entries do not match.';
const CONCURRENT_CHANGE_ERROR =
  'Another request changed your password at the same moment. Reload the page before trying again.';
const TOO_MANY_ATTEMPTS_ERROR = 'Too many attempts. Please try again later.';

// 409 and 429 leave the cookie alone: the token stays valid after a 429, and
// after a 409 only the reload tells whether this browser is still signed in.
export async function changePassword(
  _previousState: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const accessToken = await findAccessToken();
  if (!accessToken) {
    redirect(ROUTES.LOGIN);
  }
  const currentPassword = getFormText(formData, 'currentPassword');
  const newPassword = getFormText(formData, 'newPassword');
  const unsaved = { fieldErrors: {}, formError: null, isSaved: false };

  // The API never sees the confirmation, so the mismatch is refused here.
  if (newPassword !== getFormText(formData, 'confirmPassword')) {
    return {
      ...unsaved,
      fieldErrors: { confirmPassword: PASSWORD_MISMATCH_ERROR },
    };
  }

  let response: Response;
  try {
    response = await sendJsonToApi(
      accessToken,
      API_ENDPOINTS.CHANGE_PASSWORD,
      'POST',
      { currentPassword, newPassword },
    );
  } catch {
    return { ...unsaved, formError: UNREACHABLE_ERROR };
  }

  if (response.status === HTTP_STATUS.UNAUTHORIZED) {
    redirect(ROUTES.LOGIN);
  }
  if (response.status === HTTP_STATUS.FORBIDDEN) {
    return {
      ...unsaved,
      fieldErrors: { currentPassword: WRONG_CURRENT_PASSWORD_ERROR },
    };
  }
  if (response.status === HTTP_STATUS.BAD_REQUEST) {
    const message = await readValidationMessage(response);
    return { ...unsaved, fieldErrors: { newPassword: message } };
  }
  if (response.status === HTTP_STATUS.CONFLICT) {
    return { ...unsaved, formError: CONCURRENT_CHANGE_ERROR };
  }
  if (response.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
    return { ...unsaved, formError: TOO_MANY_ATTEMPTS_ERROR };
  }
  if (!response.ok) {
    return { ...unsaved, formError: GENERIC_ERROR };
  }

  // The change revoked every earlier token, this browser's included.
  await storeIssuedAccessToken(response);
  return { ...unsaved, isSaved: true };
}

export type AvatarRemovalState = { formError: string | null };

export async function removeAvatar(): Promise<AvatarRemovalState> {
  const accessToken = await findAccessToken();
  if (!accessToken) {
    redirect(ROUTES.LOGIN);
  }

  let response: Response;
  try {
    response = await deleteFromApi(accessToken, API_ENDPOINTS.PROFILE_AVATAR);
  } catch {
    return { formError: UNREACHABLE_ERROR };
  }

  if (response.status === HTTP_STATUS.UNAUTHORIZED) {
    redirect(ROUTES.LOGIN);
  }
  if (!response.ok) {
    return { formError: GENERIC_ERROR };
  }
  refresh();
  return { formError: null };
}
