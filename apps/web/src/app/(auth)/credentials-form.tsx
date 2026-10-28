'use client';

import {
  Alert,
  Button,
  Description,
  FieldError,
  Form,
  Input,
  InputGroup,
  Label,
  Spinner,
  TextField,
} from '@heroui/react';
import { useActionState, useEffect, useRef, useState } from 'react';
import type { CredentialsState } from './credentials';

type CredentialsFormProps = {
  action: (
    previousState: CredentialsState,
    formData: FormData,
  ) => Promise<CredentialsState>;
  submitLabel: string;
  pendingLabel: string;
  errorTitle: string;
  passwordAutoComplete: 'new-password' | 'current-password';
  // Registration only: login must accept any existing password, see LoginDto.
  passwordMinLength?: number;
};

const INITIAL_STATE: CredentialsState = {
  email: '',
  fieldErrors: {},
  formError: null,
};

export function CredentialsForm({
  action,
  submitLabel,
  pendingLabel,
  errorTitle,
  passwordAutoComplete,
  passwordMinLength,
}: CredentialsFormProps): React.JSX.Element {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // A server-side email error leaves focus on the submit button; move it to the field.
  useEffect(() => {
    if (state.fieldErrors.email) {
      emailInputRef.current?.focus();
    }
  }, [state]);

  return (
    <Form
      action={formAction}
      validationErrors={state.fieldErrors}
      className="flex flex-col gap-5"
    >
      {state.formError && (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{errorTitle}</Alert.Title>
            <Alert.Description>{state.formError}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {/* The key remounts the field so React's post-action form reset keeps the email. */}
      <TextField
        key={state.email}
        defaultValue={state.email}
        isRequired
        fullWidth
        name="email"
        type="email"
        autoComplete="email"
      >
        <Label>Email</Label>
        <Input ref={emailInputRef} placeholder="you@company.com" />
        <FieldError />
      </TextField>

      <TextField
        isRequired
        fullWidth
        minLength={passwordMinLength}
        name="password"
        type={isPasswordVisible ? 'text' : 'password'}
        autoComplete={passwordAutoComplete}
      >
        <Label>Password</Label>
        <InputGroup fullWidth>
          {/* min-w-0 lets the input shrink; otherwise the toggle overflows at 320px. */}
          <InputGroup.Input className="min-w-0" />
          <InputGroup.Suffix>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Show password"
              aria-pressed={isPasswordVisible}
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            >
              {isPasswordVisible ? 'Hide' : 'Show'}
            </Button>
          </InputGroup.Suffix>
        </InputGroup>
        {passwordMinLength !== undefined && (
          <Description>At least {passwordMinLength} characters.</Description>
        )}
        <FieldError />
      </TextField>

      <Button type="submit" size="lg" fullWidth isPending={isPending}>
        {({ isPending: isSubmitting }) => (
          <>
            {isSubmitting && <Spinner color="current" size="sm" />}
            {isSubmitting ? pendingLabel : submitLabel}
          </>
        )}
      </Button>
    </Form>
  );
}
