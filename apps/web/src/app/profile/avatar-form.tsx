'use client';

import { Alert, Avatar, Button, Spinner } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import {
  AVATAR_FILE_FIELD,
  HTTP_STATUS,
  readValidationMessage,
  UNREACHABLE_ERROR,
} from '@/lib/api';
import { ROUTES } from '@/lib/routes';
import { FileInput } from '../file-input';
import { removeAvatar, type AvatarRemovalState } from './actions';

type AvatarFormProps = {
  avatarId: string | null;
};

const UPLOAD_OUTCOME = {
  SAVED: 'saved',
  REFUSED: 'refused',
  SIGNED_OUT: 'signed-out',
} as const;

type UploadOutcome =
  | { kind: typeof UPLOAD_OUTCOME.SAVED; avatarId: string }
  | { kind: typeof UPLOAD_OUTCOME.REFUSED; errorMessage: string }
  | { kind: typeof UPLOAD_OUTCOME.SIGNED_OUT };

const AVATAR_INPUT_ID = 'avatar-file';
const AVATAR_HINT_ID = 'avatar-file-hint';
const AVATAR_ERROR_ID = 'avatar-file-error';
// Narrows the file picker only; the API decides which files it accepts.
const ACCEPTED_AVATAR_FILES = '.jpg,.jpeg,.png,.webp';
const PREVIEW_ALT = 'Preview of the selected image';

// Uploads go through the Route Handler, because a Server Action caps the
// body at 1 MB; the API's message explains a refused format or size.
async function uploadAvatar(formData: FormData): Promise<UploadOutcome> {
  let response: Response;
  try {
    response = await fetch(ROUTES.PROFILE_AVATAR, {
      method: 'PUT',
      body: formData,
    });
  } catch {
    return { kind: UPLOAD_OUTCOME.REFUSED, errorMessage: UNREACHABLE_ERROR };
  }
  if (response.status === HTTP_STATUS.UNAUTHORIZED) {
    return { kind: UPLOAD_OUTCOME.SIGNED_OUT };
  }
  if (!response.ok) {
    return {
      kind: UPLOAD_OUTCOME.REFUSED,
      errorMessage: await readValidationMessage(response),
    };
  }
  const { avatarId } = (await response.json()) as { avatarId: string };
  return { kind: UPLOAD_OUTCOME.SAVED, avatarId };
}

export function AvatarForm({ avatarId }: AvatarFormProps): React.JSX.Element {
  const router = useRouter();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedAvatarId, setSavedAvatarId] = useState<string | null>(null);
  const [removalState, removeFormAction, isRemoving] = useActionState(
    removeAvatar,
    { formError: null } satisfies AvatarRemovalState,
  );
  // The confirmation belongs to the avatar it saved, so it disappears once
  // that avatar is replaced or removed.
  const isSaved = savedAvatarId !== null && savedAvatarId === avatarId;

  useEffect(() => {
    if (!previewUrl) {
      return undefined;
    }
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.currentTarget.files?.[0];
    setErrorMessage(null);
    setSavedAvatarId(null);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    setErrorMessage(null);
    setIsUploading(true);
    const outcome = await uploadAvatar(new FormData(form));
    setIsUploading(false);
    if (outcome.kind === UPLOAD_OUTCOME.SIGNED_OUT) {
      router.push(ROUTES.LOGIN);
      return;
    }
    if (outcome.kind === UPLOAD_OUTCOME.REFUSED) {
      setErrorMessage(outcome.errorMessage);
      return;
    }
    form.reset();
    setPreviewUrl(null);
    setSavedAvatarId(outcome.avatarId);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      {isSaved && (
        <Alert status="success" aria-live="polite">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Your avatar was saved.</Alert.Title>
          </Alert.Content>
        </Alert>
      )}
      {removalState.formError && (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Your avatar was not removed</Alert.Title>
            <Alert.Description>{removalState.formError}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex items-end gap-4">
          {previewUrl && (
            <Avatar size="lg" className="shrink-0">
              <Avatar.Image src={previewUrl} alt={PREVIEW_ALT} />
            </Avatar>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor={AVATAR_INPUT_ID} className="text-sm font-medium">
              Avatar
            </label>
            <FileInput
              id={AVATAR_INPUT_ID}
              name={AVATAR_FILE_FIELD}
              accept={ACCEPTED_AVATAR_FILES}
              required
              disabled={isUploading}
              aria-invalid={errorMessage !== null}
              aria-describedby={
                errorMessage !== null
                  ? `${AVATAR_HINT_ID} ${AVATAR_ERROR_ID}`
                  : AVATAR_HINT_ID
              }
              onChange={handleFileChange}
            />
            <p id={AVATAR_HINT_ID} className="text-sm text-muted">
              A JPEG, PNG or WebP image.
            </p>
          </div>
        </div>

        {errorMessage !== null && (
          <Alert id={AVATAR_ERROR_ID} status="danger" role="alert">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Your avatar was not saved</Alert.Title>
              <Alert.Description>{errorMessage}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        <Button
          type="submit"
          size="lg"
          className="self-start"
          isPending={isUploading}
        >
          {({ isPending }) => (
            <>
              {isPending && <Spinner color="current" size="sm" />}
              {isPending ? 'Saving…' : 'Save avatar'}
            </>
          )}
        </Button>
      </form>

      {avatarId !== null && (
        <form action={removeFormAction}>
          <Button
            type="submit"
            variant="danger-soft"
            size="lg"
            isPending={isRemoving}
          >
            {({ isPending }) => (
              <>
                {isPending && <Spinner color="current" size="sm" />}
                {isPending ? 'Removing…' : 'Remove avatar'}
              </>
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
