import type { Metadata } from 'next';
import { ROUTES } from '@/lib/routes';
import { registerUser } from '../actions';
import { AuthCard } from '../auth-card';
import { CredentialsForm } from '../credentials-form';

// Mirrors MIN_PASSWORD_LENGTH in apps/api/src/auth/dto/credentials.dto.ts.
const MIN_PASSWORD_LENGTH = 8;

export const metadata: Metadata = {
  title: 'Create account · Video Meetings',
};

export default function RegisterPage(): React.JSX.Element {
  return (
    <AuthCard
      title="Create your account"
      description="Schedule and join video meetings in seconds."
      footerText="Already have an account?"
      footerLinkLabel="Sign in"
      footerHref={ROUTES.LOGIN}
    >
      <CredentialsForm
        action={registerUser}
        submitLabel="Create account"
        pendingLabel="Creating account…"
        errorTitle="Could not create your account"
        passwordAutoComplete="new-password"
        passwordMinLength={MIN_PASSWORD_LENGTH}
      />
    </AuthCard>
  );
}
