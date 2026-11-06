import { Card } from '@heroui/react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { findProfile } from '@/lib/profile';
import { ROUTES } from '@/lib/routes';
import { findAccessToken } from '@/lib/session';
import { MeetingPageShell } from '../meetings/[id]/meeting-page-shell';
import { UserAvatar } from '../user-avatar';
import { NameForm } from './name-form';
import { PasswordForm } from './password-form';

export const metadata: Metadata = {
  title: 'Your profile · Video Meetings',
};

export default function ProfilePage(): React.JSX.Element {
  return (
    <MeetingPageShell>
      <Suspense
        fallback={<p className="mt-12 text-muted">Loading your profile…</p>}
      >
        <ProfileContent />
      </Suspense>
    </MeetingPageShell>
  );
}

async function ProfileContent(): Promise<React.JSX.Element> {
  const accessToken = await findAccessToken();
  if (!accessToken) {
    redirect(ROUTES.LOGIN);
  }
  const profile = await findProfile(accessToken);
  if (!profile) {
    redirect(ROUTES.LOGIN);
  }

  return (
    <main className="mt-12 flex flex-col gap-10">
      <div className="flex items-center gap-4">
        <UserAvatar name={profile.name} size="lg" />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold break-words">{profile.name}</h1>
          <p className="break-all text-muted">{profile.email}</p>
        </div>
      </div>

      <section aria-labelledby="edit-name" className="flex flex-col gap-4">
        <h2 id="edit-name" className="text-base font-semibold">
          Edit your name
        </h2>
        <Card className="p-5 shadow-none">
          <NameForm name={profile.name} />
        </Card>
      </section>

      <section
        aria-labelledby="change-password"
        className="flex flex-col gap-4"
      >
        <h2 id="change-password" className="text-base font-semibold">
          Change your password
        </h2>
        <Card className="p-5 shadow-none">
          <PasswordForm />
        </Card>
      </section>
    </main>
  );
}
