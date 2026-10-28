'use server';

import { redirect } from 'next/navigation';
import { API_ENDPOINTS, HTTP_STATUS } from '@/lib/api';
import { ROUTES } from '@/lib/routes';
import { deleteAccessToken } from '@/lib/session';
import { submitCredentials, type CredentialsState } from './credentials';

export async function registerUser(
  _previousState: CredentialsState,
  formData: FormData,
): Promise<CredentialsState> {
  return submitCredentials(
    API_ENDPOINTS.REGISTER,
    formData,
    HTTP_STATUS.CREATED,
    {
      [HTTP_STATUS.CONFLICT]: {
        fieldErrors: { email: 'An account with this email already exists.' },
        formError: null,
      },
    },
  );
}

// The API answers 401 for an unknown email and a wrong password alike, so the
// form shows one message rather than revealing which accounts exist.
export async function logInUser(
  _previousState: CredentialsState,
  formData: FormData,
): Promise<CredentialsState> {
  return submitCredentials(API_ENDPOINTS.LOGIN, formData, HTTP_STATUS.OK, {
    [HTTP_STATUS.UNAUTHORIZED]: {
      fieldErrors: {},
      formError: 'Incorrect email or password.',
    },
  });
}

export async function signOut(): Promise<void> {
  await deleteAccessToken();
  redirect(ROUTES.LOGIN);
}
