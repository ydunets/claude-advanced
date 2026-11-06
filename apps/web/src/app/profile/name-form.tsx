'use client';

import {
  Alert,
  Button,
  FieldError,
  Form,
  Input,
  Label,
  Spinner,
  TextField,
} from '@heroui/react';
import { useActionState } from 'react';
import { updateName, type NameState } from './actions';
import { useEditedSinceSubmit } from './use-edited-since-submit';

type NameFormProps = {
  name: string;
};

// The API owns the name rule (trimmed, 1 to 100 characters), so the field has
// no client rules and shows the API's message for every violation.
export function NameForm({ name }: NameFormProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState(updateName, {
    name,
    fieldErrors: {},
    formError: null,
    isSaved: false,
  } satisfies NameState);
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
            <Alert.Title>Your name was not saved</Alert.Title>
            <Alert.Description>{state.formError}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      {state.isSaved && !isEditedSinceSubmit && (
        <Alert status="success" aria-live="polite">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Your name was saved.</Alert.Title>
          </Alert.Content>
        </Alert>
      )}

      {/* The key remounts the field so React's post-action form reset keeps the name. */}
      <TextField
        key={state.name}
        defaultValue={state.name}
        fullWidth
        name="name"
        autoComplete="name"
        onChange={markEdited}
      >
        <Label>Name</Label>
        <Input />
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
            {isSubmitting ? 'Saving…' : 'Save name'}
          </>
        )}
      </Button>
    </Form>
  );
}
