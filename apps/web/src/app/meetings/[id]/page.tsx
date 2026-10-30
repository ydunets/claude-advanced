import { Card } from '@heroui/react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { formatDateTime, formatFileSize } from '@/lib/format';
import {
  findMeeting,
  findMeetingFiles,
  type MeetingFile,
} from '@/lib/meetings';
import { getMeetingFileRoute, ROUTES } from '@/lib/routes';
import { findAccessToken } from '@/lib/session';
import {
  COMPACT_LINK_CLASS_NAME,
  MeetingPageShell,
} from './meeting-page-shell';
import { UploadFileForm } from './upload-file-form';

export const metadata: Metadata = {
  title: 'Meeting · Video Meetings',
};

const SECTION_IDS = {
  PARTICIPANTS: 'participants',
  FILES: 'files',
} as const;

const DETAIL_SEPARATOR = ' · ';

type MeetingContentProps = {
  meetingId: string;
};

type EmptyFilesProps = {
  meetingId: string;
};

type FileListProps = {
  meetingId: string;
  files: MeetingFile[];
};

export default function MeetingPage({
  params,
}: PageProps<'/meetings/[id]'>): React.JSX.Element {
  return (
    <MeetingPageShell>
      <Suspense
        fallback={<p className="mt-12 text-muted">Loading the meeting…</p>}
      >
        {params.then(({ id }) => (
          <MeetingContent meetingId={id} />
        ))}
      </Suspense>
    </MeetingPageShell>
  );
}

async function MeetingContent({
  meetingId,
}: MeetingContentProps): Promise<React.JSX.Element> {
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

      <section
        aria-labelledby={SECTION_IDS.PARTICIPANTS}
        className="flex flex-col gap-3"
      >
        <h2 id={SECTION_IDS.PARTICIPANTS} className="text-base font-semibold">
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

      <section
        aria-labelledby={SECTION_IDS.FILES}
        className="flex flex-col gap-4"
      >
        <h2 id={SECTION_IDS.FILES} className="text-base font-semibold">
          Files
        </h2>
        {files.length === 0 ? (
          <EmptyFiles meetingId={meeting.id} />
        ) : (
          <>
            <UploadFileForm meetingId={meeting.id} />
            <FileList meetingId={meeting.id} files={files} />
          </>
        )}
      </section>
    </main>
  );
}

function EmptyFiles({ meetingId }: EmptyFilesProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-border p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <p className="font-medium">No files yet.</p>
        <p className="text-sm text-muted">
          Upload a recording, a document or notes for this meeting.
        </p>
      </div>
      <UploadFileForm meetingId={meetingId} />
    </div>
  );
}

function FileList({ meetingId, files }: FileListProps): React.JSX.Element {
  return (
    <Card className="p-0 shadow-none">
      <ul className="divide-y divide-border">
        {files.map((file) => (
          <li
            key={file.id}
            className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <span className="font-medium break-all">{file.name}</span>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 sm:shrink-0 sm:justify-end">
              <span className="text-sm text-muted">
                {file.mimeType}
                {DETAIL_SEPARATOR}
                {formatFileSize(file.size)}
                {DETAIL_SEPARATOR}
                <time dateTime={file.uploadedAt}>
                  {formatDateTime(file.uploadedAt)}
                </time>
              </span>
              <a
                href={getMeetingFileRoute(meetingId, file.id)}
                download
                aria-label={`Download ${file.name}`}
                className={COMPACT_LINK_CLASS_NAME}
              >
                Download
              </a>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
