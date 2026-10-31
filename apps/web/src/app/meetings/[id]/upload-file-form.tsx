'use client';

import { Alert, Button, Label, ProgressBar, Spinner } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { startTransition, useState } from 'react';
import { HTTP_STATUS, MEETING_FILE_FIELD } from '@/lib/api';
import { getMeetingFilesRoute } from '@/lib/routes';
import { buildFileTooLargeMessage } from '@/lib/upload-limits';

type UploadFileFormProps = {
  meetingId: string;
  maxUploadSizeBytes: number;
};

const FILE_INPUT_ID = 'meeting-file';
const UPLOAD_ERROR_ID = 'meeting-file-error';
const PERCENT = 100;
// XMLHttpRequest reports status 0 when no response arrived at all.
const NO_RESPONSE_STATUS = 0;
const CONNECTION_LOST_MESSAGE =
  'The connection was lost, so the file was not uploaded. Check your connection and try again.';
const UPLOAD_FAILED_MESSAGE = 'The file could not be uploaded. Try again.';

// The API's Nest error body carries the reason in `message`.
function getUploadErrorMessage(request: XMLHttpRequest): string {
  if (request.status === NO_RESPONSE_STATUS) {
    return CONNECTION_LOST_MESSAGE;
  }
  const body = request.response as { message?: unknown } | null;
  return typeof body?.message === 'string'
    ? body.message
    : UPLOAD_FAILED_MESSAGE;
}

export function UploadFileForm({
  meetingId,
  maxUploadSizeBytes,
}: UploadFileFormProps): React.JSX.Element {
  const router = useRouter();
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isUploading = uploadProgress !== null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get(MEETING_FILE_FIELD);
    if (file instanceof File && file.size > maxUploadSizeBytes) {
      setErrorMessage(buildFileTooLargeMessage(maxUploadSizeBytes));
      return;
    }
    const request = new XMLHttpRequest();
    request.open('POST', getMeetingFilesRoute(meetingId));
    request.responseType = 'json';
    request.upload.addEventListener('progress', (progressEvent) => {
      if (progressEvent.lengthComputable) {
        setUploadProgress(
          Math.round((progressEvent.loaded / progressEvent.total) * PERCENT),
        );
      }
    });
    request.addEventListener('loadend', () => {
      if (request.status === HTTP_STATUS.CREATED) {
        form.reset();
        // In one transition, the progress clears only when the refreshed
        // file list commits, so the bar never disappears before the file.
        startTransition(() => {
          router.refresh();
          setUploadProgress(null);
        });
        return;
      }
      setUploadProgress(null);
      setErrorMessage(getUploadErrorMessage(request));
    });
    setErrorMessage(null);
    setUploadProgress(0);
    request.send(formData);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
            aria-invalid={errorMessage !== null}
            aria-describedby={
              errorMessage !== null ? UPLOAD_ERROR_ID : undefined
            }
            onChange={() => setErrorMessage(null)}
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
      </div>

      {isUploading && (
        <ProgressBar value={uploadProgress} size="sm">
          <Label>Upload progress</Label>
          <ProgressBar.Output />
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
      )}

      {errorMessage !== null && (
        <Alert id={UPLOAD_ERROR_ID} status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Upload failed</Alert.Title>
            <Alert.Description>{errorMessage}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
    </form>
  );
}
