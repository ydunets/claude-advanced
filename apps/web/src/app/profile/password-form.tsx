'use client';

import {
  Alert,
  Button,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  Spinner,
  TextField,
} from '@heroui/react';
import { useActionState } from 'react';
import { MIN_PASSWORD_LENGTH } from '@/lib/api';
import { changePassword, type PasswordState } from './actions';
import { useEditedSinceSubmit } from './use-edited-since-submit';

const INITIAL_STATE: PasswordState = {
  fieldErrors: {},
  formError: null,
  isSaved: false,
};

// The new password has no client length rule, so the API's message shows for
// a short password just as it does for an unchanged one.
export function PasswordForm(): React.JSX.Element {
  const [state, formAction, isPending] = useActionState(
    changePassword,
    INITIAL_STATE,
  );
  const [isEditedSinceSubmit, markEdited] = useEditedSinceSubmit(state);

  return (
    <Form
      action={formAction}
      validationErrors={isEditedSinceSubmit ? {} : state.fieldErrors}
      className="flex flex-col gap-5"
    >
      {state.formError && (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Your password was not changed</Alert.Title>
            <Alert.Description>{state.formError}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      {state.isSaved && !isEditedSinceSubmit && (
        <Alert status="success" aria-live="polite">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Your password was changed.</Alert.Title>
            <Alert.Description>
              Other devices are signed out; this one stays signed in.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <TextField
        isRequired
        fullWidth
        name="currentPassword"
        type="password"
        autoComplete="current-password"
      >
        <Label>Current password</Label>
        {/* The native input event fires only on typing; React Aria's onChange
            also fires on React's post-action form reset and hid the errors. */}
        <Input onInput={markEdited} />
        <FieldError />
      </TextField>

      <TextField
        isRequired
        fullWidth
        name="newPassword"
        type="password"
        autoComplete="new-password"
      >
        <Label>New password</Label>
        <Input onInput={markEdited} />
        <Description>At least {MIN_PASSWORD_LENGTH} characters.</Description>
        <FieldError />
      </TextField>

      <TextField
        isRequired
        fullWidth
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
      >
        <Label>Confirm new password</Label>
        <Input onInput={markEdited} />
        <FieldError />
      </TextField>

      <Button
        type="submit"
        size="lg"
        className="self-start"
        isPending={isPending}
      >
        {({ isPending: isSubmitting }) => (
          <>
            {isSubmitting && <Spinner color="current" size="sm" />}
            {isSubmitting ? 'Changing…' : 'Change password'}
          </>
        )}
      </Button>
    </Form>
  );
}
