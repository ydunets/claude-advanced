# User Profile

**Date:** 2026-10-31
**Status:** draft

## Goal

A signed-in user manages their own identity in one place (their name, their avatar and their password), so that the app greets them by name and picture and they can replace a password they no longer trust.

## User Scenarios

1. **User:** a visitor creating an account
   **Action:** registers with a name, an email and a password
   **Result:** the account is created with that name, and the home page shows the name next to an initials placeholder

2. **User:** a signed-in user
   **Action:** opens their profile from the home page
   **Result:** sees their name, their email, their avatar (or the initials placeholder) and the password change form

3. **User:** a signed-in user
   **Action:** changes their name on the profile page and saves it
   **Result:** the profile and the home page show the new name, without signing in again

4. **User:** a signed-in user
   **Action:** uploads a JPEG, PNG or WebP image of up to 5 MB as their avatar
   **Result:** the image replaces the previous avatar or the placeholder on the profile page and next to their name on the home page

5. **User:** a signed-in user with an avatar
   **Action:** removes the avatar
   **Result:** the initials placeholder is shown again on the profile page and on the home page

6. **User:** a signed-in user
   **Action:** tries to upload an avatar in another format or larger than 5 MB
   **Result:** the upload is rejected with a message that states the allowed formats and the 5 MB limit, and the current avatar is unchanged

7. **User:** a signed-in user
   **Action:** enters their current password and a new password, and submits the form
   **Result:** the password is changed; this browser stays signed in, sessions on other devices are signed out, and the next sign-in requires the new password

8. **User:** a signed-in user
   **Action:** submits the password form with a wrong current password, or with a new password that breaks the password rules
   **Result:** sees an error that names the problem; the password is unchanged and the user stays signed in

9. **User:** a signed-in user
   **Action:** clears the name field and saves it
   **Result:** sees an error that the name is required, and the saved name is unchanged

10. **User:** a user who registered before names existed
    **Action:** signs in
    **Result:** the home page shows the part of their email before "@" as their name, which they can edit on the profile page

11. **User:** a visitor who is not signed in
    **Action:** opens the profile page address
    **Result:** is redirected to the sign-in page

## Scope

### In scope

- **Must:** a required name on every account: collected at registration, editable on the profile page, never empty, at most 100 characters, with leading and trailing spaces trimmed.
- **Must:** existing accounts receive the part of their email before "@" as their name.
- **Must:** a protected profile page, reachable from the home page, that shows the name, the email and the avatar.
- **Must:** uploading an avatar in JPEG, PNG or WebP of up to 5 MB, which replaces the previous one.
- **Must:** removing the avatar, after which the initials placeholder is shown.
- **Must:** an initials placeholder (the uppercase first letters of the first two words of the name) wherever an avatar would appear and none is set.
- **Must:** the avatar (or placeholder) and the name shown next to each other on the home page, in place of the email.
- **Must:** changing the password only after the current password is confirmed, under the same rules as registration; the new password is entered twice and must match, and it must differ from the current one.
- **Must:** an avatar image is served only to the signed-in user it belongs to; anyone else gets "not found".
- **Must:** after a password change, the current browser stays signed in and every other session is signed out.
- **Must:** clear errors for a wrong current password, an invalid or mismatched new password, an empty or too long name, and a disallowed or oversized avatar.
- **Should:** a preview of the selected image before the avatar is saved.

### Out of scope

- Changing the email address: not requested, and it would need address verification.
- Password reset by email for a forgotten password: the change here requires the current password; recovery is a separate feature.
- Cropping, rotating or resizing the avatar in the browser: the image is stored as uploaded.
- Showing names or avatars on the meeting page or to meeting participants: the request names the profile and the home page only, and participants have no access to the app yet.
- Deleting the account: not requested.

## Technical Constraints

- Sessions are signed tokens that the API does not track, and they carry only the user id and the email. Signing out other devices after a password change therefore needs the API to reject tokens issued before the change, and a new name must reach the home page without a new token.
- Registration currently asks only for an email and a password with a minimum length of 8 characters; the name field is added to that form, and the new password follows the same minimum.
- The browser never calls the API directly; every request goes through the web app's server. Server Actions cap a request body at 1 MB, which is below the 5 MB avatar limit.
- Uploaded files are stored on the API server's disk; no external storage service is used.

## Acceptance Criteria

- **Given** the registration page **when** a visitor submits it without a name **then** the account is not created and the name field shows a required error.
- **Given** the registration page **when** a visitor registers with a name, an email and a valid password **then** the home page shows that name next to an initials placeholder, and the email is not shown there.
- **Given** an account created before this feature **when** its owner signs in **then** the home page shows the part of the email before "@" as the name.
- **Given** a visitor who is not signed in **when** they open the profile page address **then** they are redirected to the sign-in page.
- **Given** a signed-in user on the home page **when** they follow the link to their profile **then** the profile page shows their name, their email and their avatar or initials placeholder.
- **Given** a signed-in user on the profile page **when** they save a new name **then** the profile page and the home page show the new name after a reload, without signing in again.
- **Given** a signed-in user on the profile page **when** they save an empty name, or one of spaces only **then** an error states that the name is required and the saved name is unchanged.
- **Given** a signed-in user on the profile page **when** they save a name of 101 characters **then** an error states the 100 character limit and the saved name is unchanged.
- **Given** a signed-in user on the profile page **when** they save " Anna Maria Lee " **then** the name is shown as "Anna Maria Lee" and, without an avatar, the placeholder shows "AM".
- **Given** a signed-in user **when** they upload a PNG of 4 MB as their avatar **then** the image is shown on the profile page and next to their name on the home page, and it is still shown after they sign out and sign in again.
- **Given** a signed-in user with an avatar **when** they upload another JPEG or WebP image **then** the new image is shown in both places and the previous one is not.
- **Given** a signed-in user with an avatar **when** they upload a GIF, or a JPEG larger than 5 MB **then** the upload is rejected with a message that names JPEG, PNG and WebP and the 5 MB limit, and the previous avatar is still shown.
- **Given** a signed-in user with an avatar **when** they remove it **then** the profile page and the home page show the initials placeholder.
- **Given** a signed-in user **when** they change the password with the correct current password and a valid new password **then** they stay signed in in this browser, a sign-in with the old password fails, and a sign-in with the new password succeeds.
- **Given** a user signed in in two browsers **when** they change the password in one of them **then** the next page they open in the other browser sends them to the sign-in page.
- **Given** a signed-in user **when** they submit the password form with a wrong current password **then** an error states that the current password is incorrect, the old password still signs in, and the user stays signed in.
- **Given** a signed-in user **when** they submit a new password shorter than 8 characters **then** an error states the minimum length and the password is unchanged.
- **Given** a signed-in user **when** the two new password entries differ **then** an error states that they do not match and the password is unchanged.
- **Given** a signed-in user **when** the new password equals the current one **then** an error states that the new password must differ and the password is unchanged.
- **Given** a user with an avatar **when** another signed-in user, or a visitor who is not signed in, requests that avatar's image address **then** they receive "not found" or are sent to sign in, and the image is not returned.
- [ ] No user can see or change another user's name, avatar or password through the profile page.

## Open Questions

None.
