'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  API_ENDPOINTS,
  GENERIC_ERROR,
  HTTP_STATUS,
  readValidationMessage,
  sendJsonToApi,
  UNREACHABLE_ERROR,
} from '@/lib/api';
import { getFormText } from '@/lib/form-data';
import type { Profile } from '@/lib/profile';
import { ROUTES } from '@/lib/routes';
import { findAccessToken } from '@/lib/session';

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
