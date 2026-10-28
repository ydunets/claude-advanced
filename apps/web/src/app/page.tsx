import { Button, Card } from '@heroui/react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { findMeetings, type Meeting } from '@/lib/meetings';
import { ROUTES } from '@/lib/routes';
import { findAccessToken, getTokenEmail } from '@/lib/session';
import { signOut } from './(auth)/actions';
import { BrandMark } from './brand-mark';

const LATEST_MEETINGS_COUNT = 3;

const MEETING_DATE_FORMAT = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export const metadata: Metadata = {
  title: 'Your meetings · Video Meetings',
};

function formatCount(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

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
  const meetings = await findMeetings(accessToken);
  if (!meetings) {
    redirect(ROUTES.LOGIN);
  }
  const latestMeetings = getLatestMeetings(meetings);

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <BrandMark />
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted">
            Signed in as{' '}
            <span className="font-medium break-all text-foreground">
              {getTokenEmail(accessToken)}
            </span>
          </p>
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
                    <span className="font-medium">{meeting.title}</span>
                    <span className="text-sm text-muted">
                      <time dateTime={meeting.date}>
                        {MEETING_DATE_FORMAT.format(new Date(meeting.date))}
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
