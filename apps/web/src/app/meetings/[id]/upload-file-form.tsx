'use client';

import { Button, Spinner } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { HTTP_STATUS, MEETING_FILE_FIELD } from '@/lib/api';
import { getMeetingFilesRoute } from '@/lib/routes';

type UploadFileFormProps = {
  meetingId: string;
};

const FILE_INPUT_ID = 'meeting-file';

export function UploadFileForm({
  meetingId,
}: UploadFileFormProps): React.JSX.Element {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = event.currentTarget;
    const request = new XMLHttpRequest();
    request.open('POST', getMeetingFilesRoute(meetingId));
    request.addEventListener('loadend', () => {
      setIsUploading(false);
      if (request.status === HTTP_STATUS.CREATED) {
        form.reset();
        router.refresh();
      }
    });
    setIsUploading(true);
    request.send(new FormData(form));
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label htmlFor={FILE_INPUT_ID} className="text-sm font-medium">
          File
        </label>
        <input
          id={FILE_INPUT_ID}
          name={MEETING_FILE_FIELD}
          type="file"
          required
          disabled={isUploading}
          className="h-11 w-full rounded-xl border border-border bg-surface p-1.5 text-sm file:mr-3 file:h-full file:rounded-lg file:border-0 file:bg-default file:px-3 file:text-sm file:font-medium file:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:h-10"
        />
      </div>
      <Button
        type="submit"
        size="lg"
        className="w-full sm:w-auto"
        isPending={isUploading}
      >
        {({ isPending }) => (
          <>
            {isPending && <Spinner color="current" size="sm" />}
            {isPending ? 'Uploading…' : 'Upload'}
          </>
        )}
      </Button>
    </form>
  );
}
