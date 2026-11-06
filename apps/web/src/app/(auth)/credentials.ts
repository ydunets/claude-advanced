import { redirect } from 'next/navigation';
import {
  GENERIC_ERROR,
  getApiUrl,
  HTTP_STATUS,
  readValidationMessage,
  UNREACHABLE_ERROR,
} from '@/lib/api';
import { getFormText } from '@/lib/form-data';
import { ROUTES } from '@/lib/routes';
import { storeIssuedAccessToken } from '@/lib/session';

export type CredentialsState = {
  name: string;
  email: string;
  fieldErrors: Record<string, string>;
  formError: string | null;
};

type Failure = Pick<CredentialsState, 'fieldErrors' | 'formError'>;

// Posts { email, password } to an auth endpoint, plus { name } when the form
// has a name field (registration only). On the expected status it
// stores the issued token and redirects home; otherwise it returns the state
// the form renders, with `failures` mapping endpoint-specific statuses.
export async function submitCredentials(
  endpoint: string,
  formData: FormData,
  successStatus: number,
  failures: Record<number, Failure>,
): Promise<CredentialsState> {
  const name = formData.has('name') ? getFormText(formData, 'name') : undefined;
  const email = getFormText(formData, 'email');
  const password = getFormText(formData, 'password');
  const failure = { name: name ?? '', email, fieldErrors: {}, formError: null };
  const url = `${getApiUrl()}${endpoint}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
  } catch {
    return { ...failure, formError: UNREACHABLE_ERROR };
  }

  if (response.status in failures) {
    return { ...failure, ...failures[response.status] };
  }
  if (response.status === HTTP_STATUS.BAD_REQUEST) {
    return { ...failure, formError: await readValidationMessage(response) };
  }
  if (response.status !== successStatus) {
    return { ...failure, formError: GENERIC_ERROR };
  }

  await storeIssuedAccessToken(response);
  // Outside any try block: redirect() works by throwing.
  redirect(ROUTES.HOME);
}
