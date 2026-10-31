import { Button, Card } from '@heroui/react';
import { linkVariants } from '@heroui/styles';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { formatCount, formatDateTime } from '@/lib/format';
import { findMeetings, type Meeting } from '@/lib/meetings';
import { findProfile } from '@/lib/profile';
import { getMeetingRoute, ROUTES } from '@/lib/routes';
import { findAccessToken } from '@/lib/session';
import { signOut } from './(auth)/actions';
import { BrandMark } from './brand-mark';
import { UserAvatar } from './user-avatar';

const LATEST_MEETINGS_COUNT = 3;

export const metadata: Metadata = {
  title: 'Your meetings · Video Meetings',
};

// The API lists meetings in ascending date order, so the latest come last.
function getLatestMeetings(meetings: Meeting[]): Meeting[] {
  return meetings.slice(-LATEST_MEETINGS_COUNT).reverse();
}

export default function HomePage(): React.JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-10">
      <Suspense fallback={<p className="text-muted">Loading your meetings…</p>}>
        <HomeContent />
      </Suspense>
    </div>
  );
}

async function HomeContent(): Promise<React.JSX.Element> {
  const accessToken = await findAccessToken();
  if (!accessToken) {
    redirect(ROUTES.LOGIN);
  }
  const [meetings, profile] = await Promise.all([
    findMeetings(accessToken),
    findProfile(accessToken),
  ]);
  if (!meetings || !profile) {
    redirect(ROUTES.LOGIN);
  }
  const latestMeetings = getLatestMeetings(meetings);

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <BrandMark />
        <div className="flex items-center gap-3">
          <Link
            href={ROUTES.PROFILE}
            className={linkVariants().base({
              className: 'flex min-w-0 items-center gap-2 text-sm font-medium',
            })}
          >
            <UserAvatar name={profile.name} size="sm" />
            <span className="break-words">{profile.name}</span>
          </Link>
          <form action={signOut}>
            <Button type="submit" variant="secondary" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <main className="mt-12 flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Your meetings</h1>
          <p className="text-muted">
            {meetings.length === 0
              ? 'No meetings yet.'
              : formatCount(meetings.length, 'meeting')}
          </p>
        </div>

        {latestMeetings.length > 0 && (
          <section
            aria-labelledby="latest-meetings"
            className="flex flex-col gap-3"
          >
            <h2 id="latest-meetings" className="text-base font-semibold">
              Latest meetings
            </h2>
            <Card className="p-0 shadow-none">
              <ul className="divide-y divide-border">
                {latestMeetings.map((meeting) => (
                  <li
                    key={meeting.id}
                    className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <Link
                      href={getMeetingRoute(meeting.id)}
                      className={linkVariants().base({
                        className:
                          'font-medium break-words underline underline-offset-4',
                      })}
                    >
                      {meeting.title}
                    </Link>
                    <span className="text-sm text-muted">
                      <time dateTime={meeting.date}>
                        {formatDateTime(meeting.date)}
                      </time>
                      {' · '}
                      {formatCount(meeting.participants.length, 'participant')}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        )}
      </main>
    </>
  );
}
