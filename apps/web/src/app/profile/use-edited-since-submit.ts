import { useState } from 'react';

// React Aria clears a server error on blur, which removes the message and
// moves the button up between mouse down and mouse up, so the first
// corrected submit missed it. A form hides its server feedback once a field
// is edited after the submit that produced `state`, which settles the layout
// before the button is clicked.
export function useEditedSinceSubmit<State>(
  state: State,
): [isEditedSinceSubmit: boolean, markEdited: () => void] {
  const [stateAtLastEdit, setStateAtLastEdit] = useState<State | null>(null);
  return [stateAtLastEdit === state, () => setStateAtLastEdit(state)];
}
