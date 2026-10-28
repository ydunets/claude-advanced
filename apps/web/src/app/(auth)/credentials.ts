import { redirect } from 'next/navigation';
import { getApiUrl, HTTP_STATUS } from '@/lib/api';
import { ROUTES } from '@/lib/routes';
import { setAccessToken } from '@/lib/session';

export type CredentialsState = {
  email: string;
  fieldErrors: Record<string, string>;
  formError: string | null;
};

type Failure = Pick<CredentialsState, 'fieldErrors' | 'formError'>;

const GENERIC_ERROR = 'Something went wrong. Please try again later.';

function getFormText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

// Nest's ValidationPipe returns `message` as a list of rule violations.
function toValidationMessage(body: unknown): string {
  const message = (body as { message?: unknown } | null)?.message;
  return Array.isArray(message) ? message.join('. ') : GENERIC_ERROR;
}

// Posts { email, password } to an auth endpoint. On the expected status it
// stores the issued token and redirects home; otherwise it returns the state
// the form renders, with `failures` mapping endpoint-specific statuses.
export async function submitCredentials(
  endpoint: string,
  formData: FormData,
  successStatus: number,
  failures: Record<number, Failure>,
): Promise<CredentialsState> {
  const email = getFormText(formData, 'email');
  const password = getFormText(formData, 'password');
  const failure = { email, fieldErrors: {}, formError: null };
  const url = `${getApiUrl()}${endpoint}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return {
      ...failure,
      formError: 'The server is unreachable right now. Please try again.',
    };
  }

  if (response.status in failures) {
    return { ...failure, ...failures[response.status] };
  }
  if (response.status === HTTP_STATUS.BAD_REQUEST) {
    const body: unknown = await response.json().catch(() => null);
    return { ...failure, formError: toValidationMessage(body) };
  }
  if (response.status !== successStatus) {
    return { ...failure, formError: GENERIC_ERROR };
  }

  const { accessToken } = (await response.json()) as { accessToken: string };
  await setAccessToken(accessToken);
  // Outside any try block: redirect() works by throwing.
  redirect(ROUTES.HOME);
}
