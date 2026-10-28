import type { Metadata } from 'next';
import { ROUTES } from '@/lib/routes';
import { logInUser } from '../actions';
import { AuthCard } from '../auth-card';
import { CredentialsForm } from '../credentials-form';

export const metadata: Metadata = {
  title: 'Sign in · Video Meetings',
};

export default function LoginPage(): React.JSX.Element {
  return (
    <AuthCard
      title="Sign in"
      description="Welcome back. Enter your email and password."
      footerText="Don't have an account?"
      footerLinkLabel="Create an account"
      footerHref={ROUTES.REGISTER}
    >
      <CredentialsForm
        action={logInUser}
        submitLabel="Sign in"
        pendingLabel="Signing in…"
        errorTitle="Could not sign you in"
        passwordAutoComplete="current-password"
      />
    </AuthCard>
  );
}
