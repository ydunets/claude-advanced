import { Card } from '@heroui/react';
import { linkVariants } from '@heroui/styles';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { formatDateTime, formatFileSize } from '@/lib/format';
import {
  findMeeting,
  findMeetingFiles,
  type MeetingFile,
} from '@/lib/meetings';
import { ROUTES } from '@/lib/routes';
import { findAccessToken } from '@/lib/session';
import { BrandMark } from '../../brand-mark';
import { UploadFileForm } from './upload-file-form';

export const metadata: Metadata = {
  title: 'Meeting · Video Meetings',
};

export default function MeetingPage({
  params,
}: PageProps<'/meetings/[id]'>): React.JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <BrandMark />
        <Link
          href={ROUTES.HOME}
          className={linkVariants().base({
            className:
              'inline-flex min-h-9 items-center text-sm underline underline-offset-4',
          })}
        >
          All meetings
        </Link>
      </header>
      <Suspense
        fallback={<p className="mt-12 text-muted">Loading the meeting…</p>}
      >
        {params.then(({ id }) => (
          <MeetingContent meetingId={id} />
        ))}
      </Suspense>
    </div>
  );
}

async function MeetingContent({
  meetingId,
}: {
  meetingId: string;
}): Promise<React.JSX.Element> {
  const accessToken = await findAccessToken();
  if (!accessToken) {
    redirect(ROUTES.LOGIN);
  }
  const [meeting, files] = await Promise.all([
    findMeeting(accessToken, meetingId),
    findMeetingFiles(accessToken, meetingId),
  ]);
  if (!meeting || !files) {
    redirect(ROUTES.LOGIN);
  }

  return (
    <main className="mt-12 flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold break-words">{meeting.title}</h1>
        <p className="text-muted">
          <time dateTime={meeting.date}>{formatDateTime(meeting.date)}</time>
        </p>
      </div>

      <section aria-labelledby="participants" className="flex flex-col gap-3">
        <h2 id="participants" className="text-base font-semibold">
          Participants
        </h2>
        {meeting.participants.length === 0 ? (
          <p className="text-muted">No participants.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {meeting.participants.map((email) => (
              <li key={email} className="break-all">
                {email}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="files" className="flex flex-col gap-4">
        <h2 id="files" className="text-base font-semibold">
          Files
        </h2>
        <UploadFileForm meetingId={meeting.id} />
        {files.length > 0 && <FileList files={files} />}
      </section>
    </main>
  );
}

function FileList({ files }: { files: MeetingFile[] }): React.JSX.Element {
  return (
    <Card className="p-0 shadow-none">
      <ul className="divide-y divide-border">
        {files.map((file) => (
          <li
            key={file.id}
            className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <span className="font-medium break-all">{file.name}</span>
            <span className="text-sm text-muted sm:shrink-0">
              {file.mimeType}
              {' · '}
              {formatFileSize(file.size)}
              {' · '}
              <time dateTime={file.uploadedAt}>
                {formatDateTime(file.uploadedAt)}
              </time>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
