# User Profile: Implementation Plan

**PRD:** [User Profile](../prds/user-profile.md)
**Date:** 2026-10-31

## Global Constraints

- Sessions are signed tokens that the API does not track, and they carry only the user id and the email. Signing out other devices after a password change therefore needs the API to reject tokens issued before the change, and a new name must reach the home page without a new token.
- Registration currently asks only for an email and a password with a minimum length of 8 characters; the name field is added to that form, and the new password follows the same minimum.
- The browser never calls the API directly; every request goes through the web app's server. Server Actions cap a request body at 1 MB, which is below the 5 MB avatar limit.
- Uploaded files are stored on the API server's disk; no external storage service is used.
- A name is required, at most 100 characters, with leading and trailing spaces trimmed.
- An avatar is a JPEG, PNG or WebP image of at most 5 MB, served only to its owner.
- The new password is entered twice and must match, and it must differ from the current one.
- The initials are the uppercase first letters of the first two words of the name.

## Plan Decisions

These follow from the constraints and the current code; every phase relies on them.

- **Modules.** `users/` stays free of HTTP and owns every write to `users` (name, password hash, token version, avatar columns) as commands and queries on the bus. A new `profile/` module owns the HTTP surface for the profile and the avatar; it imports `AuthModule` for `JwtAuthGuard`, as `meetings/` does. The password change lives in `auth/`, because auth owns hashing: `POST /auth/password` behind `JwtAuthGuard`, dispatching `ChangePasswordCommand`.
- **Name migration.** `drizzle-kit generate` emits `ADD COLUMN name text NOT NULL`, which fails on a database that already holds users. The generated SQL is edited before it is applied: add the column as nullable, fill it with `split_part(email, '@', 1)`, then set it `NOT NULL`. No HTTP test can create a user without a name, so the "account created before this feature" criterion is proved by a recorded SQL check on the migrated dev database, which holds rows from before the feature.
- **Session revocation.** `users` gets an integer `token_version` (default 0), which is signed into the JWT as `tokenVersion`. A password change increments it and returns a new `{ accessToken }`, which the web app stores in the cookie. `JwtAuthGuard` loads the user through the query bus on every request and answers 401 when the user is gone or the versions differ; a token without the claim counts as version 0, so sessions issued before this feature stay valid. A timestamp comparison is not used, because `iat` has whole-second precision.
- **Status codes.** A wrong current password answers 403, not 401, because the web app treats 401 as signed out. A new password equal to the current one answers 400. The "entered twice and must match" rule is checked by the web form only, because the API receives one new password.
- **Avatar storage.** Avatars use the existing `FILES_STORAGE_DIR` under random names, and `users` gets nullable avatar columns (storage name, MIME type). The format is checked by file name extension (`jpg`, `jpeg`, `png`, `webp`), case-insensitively, as meeting files are, and the stored MIME type is derived from the extension, not from the browser. Replacing or removing an avatar deletes the previous file from disk.
- **Avatar address.** The web app serves the image from the Route Handler `GET /profile/avatar`, which streams the API response with the session's bearer token, so each user can only ever receive their own image. The profile response carries `avatarId` (changed on every upload, `null` without an avatar), and the page requests `/profile/avatar?v=<avatarId>`, so a replaced image is never served from the browser cache. The image is a plain `<img>`, not `next/image`: its default loader does not forward headers when it fetches the `src` image (`apps/web/node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md`), so an owner-only image would fail.
- **Proxy.** The matcher gains the exact entry `/profile`, never a wildcard, so the avatar Route Handlers stay outside it, as the meeting file handlers do (the proxy buffers request bodies and truncates them at 10 MB).

## Criteria Coverage

| PRD acceptance criterion (short form)                                                 | Phase |
| ------------------------------------------------------------------------------------- | ----- |
| Registration without a name is refused with a required error on the name field        | 1     |
| Registration with a name shows the name and an initials placeholder on home, no email | 1     |
| An account created before this feature shows the email part before "@" as its name    | 1     |
| A signed-out visitor opening the profile page is redirected to sign in                | 1     |
| The home page links to the profile, which shows name, email and avatar or placeholder | 1     |
| No user can see or change another user's name, avatar or password                     | 4     |
| A saved new name shows on the profile and home pages after a reload, without sign-in  | 3     |
| An empty or spaces-only name is refused and the saved name is unchanged               | 3     |
| A 101 character name is refused with the 100 character limit                          | 3     |
| " Anna Maria Lee " is saved as "Anna Maria Lee" and the placeholder shows "AM"        | 3     |
| A password change keeps this browser signed in; old password fails, new one succeeds  | 3     |
| A password change in one browser sends the other browser to sign in                   | 3     |
| A wrong current password shows an error; the old password still works                 | 3     |
| A new password under 8 characters is refused with the minimum length                  | 3     |
| Two different new password entries are refused as not matching                        | 3     |
| A new password equal to the current one is refused                                    | 3     |
| A 4 MB PNG avatar shows on profile and home, also after a new sign-in                 | 5     |
| A replacement JPEG or WebP shows in both places and the previous image does not       | 5     |
| A GIF or a JPEG over 5 MB is refused with formats and limit; the old avatar stays     | 5     |
| Removing the avatar brings back the initials placeholder in both places               | 5     |
| Another user or a signed-out visitor never receives the avatar image                  | 5     |

## Test-First Workflow

Every phase follows red, green, refactor. Its session works in this order:

1. **Red.** Before any production code, write every test named in the phase's "Proved by" lines and run the commands under "Tests first". Each new test must fail on an assertion for the reason given there (a missing route, a 404, a missing element), not on a setup error such as a stopped server or a missing env value. Record the result under the phase's "Red run": the date, the commands, and each new test with its failure reason.
2. **Green.** Implement the tasks until every new test passes and every existing test still passes.
3. **Refactor.** Clean up with the suites green, then run the phase's "Done when" checks.

Rules for every phase:

- A new test that already passes in the red run proves nothing yet. Record it as "green before implementation" with the reason (usually that an earlier phase already delivers the behaviour), make it fail once by reverting the behaviour it covers locally, record that failure, and restore the code.
- Tests drive the apps through HTTP and the browser only, so they import no production code that does not exist yet. A unit test of a new module is the exception, and its expected red is the missing module.
- Red tests are not committed on their own: the pre-commit hook runs both e2e suites and blocks a failing commit. The phase is committed once green, and its "Red run" record is the evidence that each test failed first.
- A web red run needs the same stack as a green run: a migrated database and a running `pnpm dev`.

---

## Phase 1: Name at registration, shown on home and profile (Tracer Bullet)

**Status:** done
**Milestone:** [User Profile, Phase 1: Name at registration, shown on home and profile](https://github.com/ydunets/claude-advanced/milestone/6)
**Goal:** a visitor registers with a name, sees that name next to an initials placeholder on the home page, and follows a link to a profile page that shows the name and the email; existing accounts show the part of their email before "@".
**Touches:** database, backend, frontend, documentation
**Read first:** `apps/api/src/database/schema.ts`, `apps/api/drizzle/0002_create_meeting_files.sql`, `apps/api/src/users/` (all files), `apps/api/src/auth/` (`auth.controller.ts`, `dto/credentials.dto.ts`, `commands/register.handler.ts`, `auth-token.service.ts`), `apps/api/src/meetings/meetings.module.ts` and `meetings.controller.ts` (module that imports `AuthModule` for the guard), `apps/api/test/auth.e2e-spec.ts`, `apps/api/test/test-users.ts`, `apps/web/src/app/(auth)/` (all files), `apps/web/src/app/page.tsx`, `apps/web/src/app/meetings/[id]/meeting-page-shell.tsx`, `apps/web/src/lib/meetings.ts`, `apps/web/src/lib/session.ts`, `apps/web/src/proxy.ts`, `apps/web/e2e/home.spec.ts`, `apps/web/e2e/register.spec.ts`, `apps/web/e2e/test-users.ts`, the HeroUI `Avatar` docs through the `heroui-react` skill.
**Tests first:** `pnpm --filter api test:e2e auth profile` and `pnpm --filter web test:e2e home register profile`. Expected red: the API accepts a registration without a name (201 instead of 400, because `whitelist` strips the unknown field and nothing requires it) and answers 404 for the missing `GET /profile`; the web home page shows the email and no name or initials, the registration page has no "Name" field, and `/profile` renders the Next.js 404 instead of redirecting a signed-out visitor to `/login`.
**Red run:** 2026-10-31, against the running `pnpm dev` and the dev database before migration `0003`. Every new test failed on an assertion:

- `pnpm --filter api test:e2e auth profile` (4 failed, 14 passed):
  - `auth.e2e-spec.ts` "rejects a registration without a name": expected 400, got 201.
  - `auth.e2e-spec.ts` "rejects an empty name" (added case of the `it.each` table): expected 400, got 201.
  - `profile.e2e-spec.ts` "returns the signed-in user's name and email": expected 200, got 404.
  - `profile.e2e-spec.ts` "rejects a request without a token": expected 401, got 404.
- `pnpm --filter web test:e2e home register profile login` (7 failed, 7 passed):
  - `register.spec.ts` "registration without a name shows a required error and creates no account": no `Name` field (`locator.fill` timeout).
  - `register.spec.ts` "a new account is signed in and lands on the home page" (extended with the name): no `Name` field.
  - `register.spec.ts` "a registered email shows a field error and stays on the page" (existing, now fills the name): no `Name` field.
  - `home.spec.ts` "a new user sees their name and initials and no email": no link named after the user.
  - `profile.spec.ts` "the home page links to a profile with the name, the email and the initials": no link named after the user (`locator.click` timeout).
  - `profile.spec.ts` "the profile page sends a signed-out visitor to the login page": the URL stayed `/profile` (Next.js 404) instead of `/login`.
  - `login.spec.ts` "valid credentials store the token and open the home page" (existing, now asserts the name instead of the email, which the home page no longer shows): no link named after the user.

**SQL check:** 2026-10-31, on the dev database right after `pnpm --filter api db:migrate` applied `0003_add_user_name.sql` and before any green test run: `select count(*), count(*) filter (where name is distinct from split_part(email, '@', 1)) from users` returned `2483|0` (2483 rows created before this feature, none without the email prefix as its name), and `information_schema.columns` reports `users.name` as not nullable.

**Tasks:**

1. The `users.name` column with the hand-edited migration that fills existing rows from the email, and `FindUserByIdQuery` in `users/`; `CreateUserCommand` takes the name.
   Files: modify `apps/api/src/database/schema.ts`, `apps/api/src/users/commands/create-user.{command,handler}.ts`, `apps/api/src/users/users.module.ts`; create `apps/api/drizzle/<generated>.sql`, `apps/api/src/users/queries/find-user-by-id.{query,handler}.ts`.
   Proved by: `pnpm --filter api db:migrate` applies cleanly, and a recorded SQL check on the dev database right after the migration finds no row whose `name` differs from `split_part(email, '@', 1)`.
   Issue: [#27](https://github.com/ydunets/claude-advanced/issues/27)
2. `POST /auth/register` requires a non-empty `name` (400 without it) and stores it; the API and web test helpers (`registerUserAndGetToken`, `createTestUser`) send a name. A new `profile/` module serves `GET /profile` behind `JwtAuthGuard` with `ProfileResponse` `{ name, email }`.
   Files: modify `apps/api/src/auth/dto/credentials.dto.ts`, `auth.controller.ts`, `commands/register.{command,handler}.ts`, `apps/api/src/app.module.ts`, `apps/api/test/test-users.ts`, `apps/web/e2e/test-users.ts`; create `apps/api/src/profile/profile.module.ts`, `profile.controller.ts`, `profile-response.ts`, `queries/get-profile.{query,handler}.ts`, `apps/api/test/profile.e2e-spec.ts`.
   Proved by: `apps/api/test/auth.e2e-spec.ts`, "rejects a registration without a name"; `apps/api/test/profile.e2e-spec.ts`, "returns the signed-in user's name and email" and "rejects a request without a token".
   Issue: [#28](https://github.com/ydunets/claude-advanced/issues/28)
3. The registration form has a required "Name" field, sent to the API with the email and password.
   Files: modify `apps/web/src/app/(auth)/credentials-form.tsx`, `credentials.ts`, `actions.ts`, `register/page.tsx`.
   Proved by: `apps/web/e2e/register.spec.ts`, "registration without a name shows a required error and creates no account", and the existing "a new account is signed in and lands on the home page" extended to fill the name.
   Issue: [#29](https://github.com/ydunets/claude-advanced/issues/29)
4. The home page reads the profile from the API (`findProfile`) and shows the name next to a `UserAvatar` initials placeholder, linked to `/profile`, in place of the email; `getTokenEmail` is deleted. The protected page `/profile` shows the name, the email and the placeholder; the proxy matcher gains `/profile`.
   Files: create `apps/web/src/lib/profile.ts`, `apps/web/src/app/profile/page.tsx`, `apps/web/src/app/user-avatar.tsx`, `apps/web/e2e/profile.spec.ts`; modify `apps/web/src/app/page.tsx`, `apps/web/src/lib/api.ts`, `apps/web/src/lib/routes.ts`, `apps/web/src/lib/session.ts`, `apps/web/src/proxy.ts`, `apps/web/e2e/home.spec.ts`.
   Proved by: `apps/web/e2e/home.spec.ts`, "a new user sees their name and initials and no email" (replaces "a user without meetings sees their email and an empty state", keeping its empty-state assertions); `apps/web/e2e/profile.spec.ts`, "the home page links to a profile with the name, the email and the initials" and "the profile page sends a signed-out visitor to the login page".
   Issue: [#30](https://github.com/ydunets/claude-advanced/issues/30)
5. Documentation: the `name` column and its backfill, `FindUserByIdQuery`, the `profile/` module and `GET /profile` in `apps/api/CLAUDE.md`; the name field, the home header and `/profile` in `apps/web/CLAUDE.md`; the feature summary in the root `CLAUDE.md` and `README.md`.
   Files: modify the four documents.
   Proved by: review against the root "Documentation maintenance" rules.
   Issue: [#31](https://github.com/ydunets/claude-advanced/issues/31)

**Produces:** column `users.name`; `CreateUserCommand(email, passwordHash, name)`; `FindUserByIdQuery`; module `profile/`; `GET /profile`; `ProfileResponse` `{ name, email }`; `GetProfileQuery`; web route `/profile` (`ROUTES.PROFILE`); web function `findProfile`; component `UserAvatar`; e2e files `apps/api/test/profile.e2e-spec.ts`, `apps/web/e2e/profile.spec.ts`.

**Done when:**

- Registration without a name is refused with a required error on the name field.
- Registration with a name shows the name and an initials placeholder on home, and no email.
- An account created before this feature shows the email part before "@" as its name (the recorded SQL check).
- A signed-out visitor opening the profile page is redirected to sign in.
- The home page links to the profile, which shows the name, the email and the placeholder.
- The "Red run" lists every new test as red, or as green before implementation with its recorded forced failure.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm --filter api test:e2e` and `pnpm --filter web test:e2e` pass, and the existing login, meeting and home tests still pass.
- The visual check and design review from `apps/web/CLAUDE.md` pass for `/register`, `/` and `/profile`.

## Phase 2: Name update and password change (API)

**Status:** pending
**Milestone:** [User Profile, Phase 2: Name update and password change (API)](https://github.com/ydunets/claude-advanced/milestone/7)
**Goal:** the API updates a user's name under the name rules, changes the password only after the current password is confirmed, and rejects every session issued before the change except the new one it returns.
**Touches:** database, backend, documentation
**Depends on:** Phase 1 (`users.name`, `FindUserByIdQuery`, `profile/`, `GET /profile`, `ProfileResponse`, `apps/api/test/profile.e2e-spec.ts`)
**Read first:** `apps/api/src/auth/jwt-auth.guard.ts`, `auth-token.service.ts`, `password.ts`, `queries/login.handler.ts`, `dto/credentials.dto.ts` (why `LoginDto` has no length rule), `apps/api/src/users/`, `apps/api/src/profile/`, `apps/api/test/auth.e2e-spec.ts`, `apps/api/test/profile.e2e-spec.ts`
**Tests first:** `pnpm --filter api test:e2e auth profile`. Expected red: `PATCH /profile` and `POST /auth/password` answer 404 as missing routes; registration accepts a 101 character name (201 instead of 400). "another user's token never changes this user's profile" is expected green before implementation only if it asserts nothing but the other user's unchanged name, because a missing route changes nothing; it must first assert that the owner's own `PATCH` succeeds, so a missing route turns it red.
**Red run:** not yet run.

**Tasks:**

1. `PATCH /profile` (`UpdateProfileCommand`, dispatching `UpdateUserNameCommand` in `users/`) trims the name, requires 1 to 100 characters (400 otherwise) and returns `ProfileResponse`; registration applies the same name rule.
   Files: create `apps/api/src/profile/dto/update-profile.dto.ts`, `apps/api/src/profile/commands/update-profile.{command,handler}.ts`, `apps/api/src/users/commands/update-user-name.{command,handler}.ts`, a shared name rule module; modify `profile.controller.ts`, `profile.module.ts`, `users.module.ts`, `apps/api/src/auth/dto/credentials.dto.ts`.
   Proved by: `apps/api/test/profile.e2e-spec.ts`, "updates the name and trims surrounding spaces", "rejects an empty or spaces-only name", "rejects a name over 100 characters", "another user's token never changes this user's profile"; `apps/api/test/auth.e2e-spec.ts`, "rejects a registration with a name over 100 characters".
   Issue: [#32](https://github.com/ydunets/claude-advanced/issues/32)
2. `POST /auth/password` (`ChangePasswordCommand`) behind `JwtAuthGuard` takes `{ currentPassword, newPassword }`: 403 for a wrong current password, 400 for a new password under 8 characters or equal to the current one; on success it stores the new hash through `UpdateUserPasswordCommand` and returns a new `{ accessToken }`.
   Files: create `apps/api/src/auth/dto/change-password.dto.ts`, `apps/api/src/auth/commands/change-password.{command,handler}.ts`, `apps/api/src/users/commands/update-user-password.{command,handler}.ts`; modify `auth.controller.ts`, `auth.module.ts`, `users.module.ts`.
   Proved by: `apps/api/test/auth.e2e-spec.ts`, "changes the password so only the new one signs in", "refuses a wrong current password and keeps the old one", "refuses a new password under 8 characters", "refuses a new password equal to the current one".
   Issue: [#33](https://github.com/ydunets/claude-advanced/issues/33)
3. Token versioning: the `users.token_version` column and migration, the `tokenVersion` claim, the increment in `UpdateUserPasswordCommand`, and `JwtAuthGuard` rejecting a token whose version differs (a missing claim counts as 0).
   Files: modify `apps/api/src/database/schema.ts`, `auth-token.service.ts`, `jwt-auth.guard.ts`, `update-user-password.handler.ts`; create `apps/api/drizzle/<generated>.sql`.
   Proved by: `apps/api/test/auth.e2e-spec.ts`, "a password change rejects earlier tokens and accepts the returned one" (an earlier token gets 401 on `GET /profile` and `GET /meetings`; the returned token gets 200).
   Issue: [#34](https://github.com/ydunets/claude-advanced/issues/34)
4. Documentation: `PATCH /profile`, the name rule, `POST /auth/password` with its statuses, token versioning and the guard's database lookup in `apps/api/CLAUDE.md`; the feature summary in the root `CLAUDE.md` and `README.md`.
   Files: modify the three documents.
   Proved by: review.
   Issue: [#35](https://github.com/ydunets/claude-advanced/issues/35)

**Produces:** `PATCH /profile` (`{ name }`, 200 `ProfileResponse`, 400 for an invalid name); `UpdateProfileCommand`, `UpdateUserNameCommand`; `POST /auth/password` (`{ currentPassword, newPassword }`, 200 `{ accessToken }`, 403 wrong current password, 400 invalid or unchanged new password); `ChangePasswordCommand`, `UpdateUserPasswordCommand`; column `users.token_version`, claim `tokenVersion`.

**Done when:**

- Foundation for the isolation criterion that Phase 4 completes: every profile and password route acts only on the token's user and takes no user id, proved by "another user's token never changes this user's profile".
- The "Red run" lists every new test as red, or as green before implementation with its recorded forced failure.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm --filter api test:e2e` pass, and the existing meetings and meeting files suites still pass with the guard's new lookup.

## Phase 3: Name edit and password change on the profile page

**Status:** pending
**Milestone:** [User Profile, Phase 3: Name edit and password change on the profile page](https://github.com/ydunets/claude-advanced/milestone/8)
**Goal:** a user edits their name and changes their password on the profile page, sees a clear error for each rule, stays signed in in this browser and is signed out on other devices.
**Touches:** frontend, documentation
**Depends on:** Phase 1 (`/profile`, `findProfile`, `UserAvatar`, `apps/web/e2e/profile.spec.ts`), Phase 2 (`PATCH /profile`, `POST /auth/password`)
**Read first:** `apps/web/src/app/(auth)/credentials-form.tsx`, `credentials.ts`, `actions.ts` (Server Action and field error pattern), `apps/web/src/lib/session.ts` (`setAccessToken`), `apps/web/src/app/profile/page.tsx`, `apps/web/e2e/profile.spec.ts`, `apps/web/e2e/test-users.ts`
**Tests first:** `pnpm --filter web test:e2e profile`. Expected red: the profile page has no editable "Name" field and no password form, so each test fails on a missing element.
**Red run:** not yet run.

**Tasks:**

1. A name form on `/profile` (Server Action calling `PATCH /profile`) saves the name and shows the API's error on the field for an empty, spaces-only or too long name.
   Files: create `apps/web/src/app/profile/name-form.tsx`, `apps/web/src/app/profile/actions.ts`; modify `apps/web/src/app/profile/page.tsx`, `apps/web/src/lib/api.ts`.
   Proved by: `apps/web/e2e/profile.spec.ts`, "a saved name shows on the profile and home pages after a reload", "an empty or spaces-only name is refused and the saved name is unchanged", "a name over 100 characters is refused with the limit", "surrounding spaces are trimmed and the initials show AM".
   Issue: [#36](https://github.com/ydunets/claude-advanced/issues/36)
2. A password form on `/profile` with current password, new password and confirmation: a mismatch is refused in the form; the Server Action calls `POST /auth/password`, shows the 403 and 400 messages, and stores the returned token in the cookie on success.
   Files: create `apps/web/src/app/profile/password-form.tsx`; modify `apps/web/src/app/profile/actions.ts`, `apps/web/src/app/profile/page.tsx`.
   Proved by: `apps/web/e2e/profile.spec.ts`, "a password change keeps this browser signed in and only the new password signs in", "a password change sends another browser to the login page" (two browser contexts), "a wrong current password shows an error and the old password still works", "a new password under 8 characters is refused", "different new password entries are refused", "a new password equal to the current one is refused".
   Issue: [#37](https://github.com/ydunets/claude-advanced/issues/37)
3. Documentation: the profile forms and the token replacement after a password change in `apps/web/CLAUDE.md`.
   Files: modify `apps/web/CLAUDE.md`.
   Proved by: review.
   Issue: [#38](https://github.com/ydunets/claude-advanced/issues/38)

**Produces:** `NameForm`, `PasswordForm`; Server Actions `updateName`, `changePassword` in `apps/web/src/app/profile/actions.ts`.

**Done when:**

- A saved new name shows on the profile and home pages after a reload, without signing in again.
- An empty or spaces-only name, and a 101 character name, are refused and the saved name is unchanged.
- " Anna Maria Lee " is saved as "Anna Maria Lee" and the placeholder shows "AM".
- A password change keeps this browser signed in, the old password fails and the new one succeeds; another browser is sent to sign in.
- A wrong current password, a short new password, different entries and an unchanged password are each refused with their error.
- The "Red run" lists every new test as red, or as green before implementation with its recorded forced failure.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm --filter web test:e2e` pass.
- The visual check and design review from `apps/web/CLAUDE.md` pass for `/profile`, including each error state.

## Phase 4: Avatar upload, removal and owner-only serving (API)

**Status:** pending
**Milestone:** [User Profile, Phase 4: Avatar upload, removal and owner-only serving (API)](https://github.com/ydunets/claude-advanced/milestone/9)
**Goal:** the API stores, replaces, removes and serves a user's avatar under the format and size rules, only to its owner, and leaves no orphaned file on disk.
**Touches:** database, backend, documentation
**Depends on:** Phase 1 (`profile/`, `GET /profile`, `ProfileResponse`, `FindUserByIdQuery`, `apps/api/test/profile.e2e-spec.ts`)
**Read first:** `apps/api/src/meetings/meetings.module.ts` (`MulterModule.registerAsync`, `fileFilter`), `allowed-file-formats.ts`, `file-size-limit.ts`, `file-size-limit.interceptor.ts`, `commands/upload-meeting-file.handler.ts` (stored file cleanup), `queries/get-meeting-file.handler.ts` (streaming), `apps/api/test/meeting-files.e2e-spec.ts` (stored file counts, size limit test)
**Tests first:** `pnpm --filter api test:e2e profile`. Expected red: `PUT /profile/avatar`, `DELETE /profile/avatar` and `GET /profile/avatar` answer 404 as missing routes, and `GET /profile` has no `avatarId`. "returns 404 when the user has no avatar" is expected green before implementation, because the missing route already answers 404; apply the forced-failure rule.
**Red run:** not yet run.

**Tasks:**

1. The nullable avatar columns on `users` with their migration, and `SetUserAvatarCommand` and `RemoveUserAvatarCommand` in `users/`, each returning the previous storage name so the caller deletes that file; `GET /profile` adds `avatarId`.
   Files: modify `apps/api/src/database/schema.ts`, `users.module.ts`, `apps/api/src/profile/profile-response.ts`, `queries/get-profile.handler.ts`; create `apps/api/drizzle/<generated>.sql`, `apps/api/src/users/commands/set-user-avatar.{command,handler}.ts`, `remove-user-avatar.{command,handler}.ts`.
   Proved by: `apps/api/test/profile.e2e-spec.ts`, "an uploaded avatar sets avatarId and a replacement changes it".
   Issue: [#39](https://github.com/ydunets/claude-advanced/issues/39)
2. `PUT /profile/avatar` (multipart field `avatar`, `UploadAvatarCommand`) accepts `jpg`, `jpeg`, `png` and `webp` up to `MAX_AVATAR_SIZE_BYTES` (`5242880`): 415 with a message naming JPEG, PNG and WebP, 413 with a message stating 5 MB, 400 without a file; a replacement deletes the previous file. The 413 message is built from `MAX_AVATAR_SIZE_BYTES`, not from `MAX_FILE_SIZE_BYTES`, so `FileSizeLimitInterceptor` takes its limit per route (or the avatar route gets its own) instead of being applied unchanged. The extension check is shared with meeting files; only the format list differs.
   Files: create `apps/api/src/profile/allowed-avatar-formats.ts`, `commands/upload-avatar.{command,handler}.ts`; modify `profile.module.ts`, `profile.controller.ts`, `apps/api/src/meetings/file-size-limit.ts` and `file-size-limit.interceptor.ts` if the builder moves, `apps/api/.env.example`.
   Proved by: `apps/api/test/profile.e2e-spec.ts`, "rejects a GIF with the allowed formats", "rejects an image over 5 MB with the limit" (asserts the literal `5 MB`), "a replacement leaves one stored file".
   Issue: [#40](https://github.com/ydunets/claude-advanced/issues/40)
3. `DELETE /profile/avatar` (`RemoveAvatarCommand`, 204) clears the avatar and deletes its file; `GET /profile/avatar` (`GetAvatarQuery`) streams the token user's image with the stored `Content-Type` and `X-Content-Type-Options: nosniff`, and answers 404 without an avatar.
   Files: create `commands/remove-avatar.{command,handler}.ts`, `queries/get-avatar.{query,handler}.ts`; modify `profile.controller.ts`, `profile.module.ts`.
   Proved by: `apps/api/test/profile.e2e-spec.ts`, "serves the exact bytes of the owner's avatar", "removing the avatar deletes its file and answers 404 afterwards", "returns 404 when the user has no avatar", "another user's token never receives this user's avatar".
   Issue: [#41](https://github.com/ydunets/claude-advanced/issues/41)
4. Documentation: the avatar routes, limits, columns, `MAX_AVATAR_SIZE_BYTES` and the shared storage directory in `apps/api/CLAUDE.md`; the configuration table in `README.md`; the feature summary in the root `CLAUDE.md`. Each developer adds `MAX_AVATAR_SIZE_BYTES` to the local `apps/api/.env`.
   Files: modify the three documents.
   Proved by: review.
   Issue: [#42](https://github.com/ydunets/claude-advanced/issues/42)

**Produces:** avatar columns on `users`; `SetUserAvatarCommand`, `RemoveUserAvatarCommand`; `MAX_AVATAR_SIZE_BYTES`; `PUT /profile/avatar` (multipart field `avatar`, 200 `ProfileResponse`, 413, 415, 400); `DELETE /profile/avatar` (204); `GET /profile/avatar` (image stream, 404 without an avatar); `ProfileResponse.avatarId` (`string | null`); `UploadAvatarCommand`, `RemoveAvatarCommand`, `GetAvatarQuery`.

**Done when:**

- No user can see or change another user's name, avatar or password: every profile, password and avatar route acts only on the token's user and takes no user id.
- Replacing or removing an avatar leaves no previous file on disk (stored file counts).
- The "Red run" lists every new test as red, or as green before implementation with its recorded forced failure.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm --filter api test:e2e` pass.

## Phase 5: Avatar on the profile and home pages

**Status:** pending
**Milestone:** [User Profile, Phase 5: Avatar on the profile and home pages](https://github.com/ydunets/claude-advanced/milestone/10)
**Goal:** a user uploads, previews, replaces and removes their avatar on the profile page and sees it next to their name on the home page; nobody else ever receives the image.
**Touches:** frontend, documentation
**Depends on:** Phase 1 (`/profile`, `findProfile`, `UserAvatar`, `apps/web/e2e/profile.spec.ts`), Phase 4 (`PUT /profile/avatar`, `DELETE /profile/avatar`, `GET /profile/avatar`, `ProfileResponse.avatarId`)
**Read first:** `apps/web/src/app/meetings/[id]/files/route.ts` and `files/[fileId]/route.ts` (streaming Route Handlers), `apps/web/src/app/meetings/[id]/upload-file-form.tsx` (client upload and API error message), `apps/web/src/app/user-avatar.tsx`, `apps/web/src/app/profile/`, `apps/web/src/proxy.ts`, `apps/web/e2e/meeting.spec.ts` (sparse oversized file, upload helpers), `apps/web/e2e/profile.spec.ts`
**Tests first:** `pnpm --filter web test:e2e profile home`. Expected red: the profile page has no "Avatar" input or remove action, the home page shows only the initials, and `/profile/avatar` renders the Next.js 404 page for everyone, so the "never receives" test is expected green before implementation; it must first assert that the owner receives the image, so a missing route turns it red.
**Red run:** not yet run.

**Tasks:**

1. Route Handlers `PUT /profile/avatar` (streams the upload to the API and relays its status and body) and `GET /profile/avatar` (streams the token user's image; 404 without a cookie or for an API 401 or 404); a Server Action removes the avatar through `DELETE /profile/avatar`.
   Files: create `apps/web/src/app/profile/avatar/route.ts`; modify `apps/web/src/app/profile/actions.ts`, `apps/web/src/lib/api.ts`, `apps/web/src/lib/routes.ts`.
   Proved by: `apps/web/e2e/profile.spec.ts`, "another user or a signed-out visitor never receives the avatar image".
   Issue: [#43](https://github.com/ydunets/claude-advanced/issues/43)
2. An avatar form on `/profile` previews the selected image before saving (the PRD's Should item), uploads it to the Route Handler, shows the API's message for a refused file, and offers removal when an avatar is set.
   Files: create `apps/web/src/app/profile/avatar-form.tsx`; modify `apps/web/src/app/profile/page.tsx`.
   Proved by: `apps/web/e2e/profile.spec.ts`, "a GIF or a JPEG over 5 MB is refused with the formats and the limit and the old avatar stays", "removing the avatar brings back the initials on the profile and home pages".
   Issue: [#44](https://github.com/ydunets/claude-advanced/issues/44)
3. `UserAvatar` shows the image from `/profile/avatar?v=<avatarId>` as a plain `<img>` when `avatarId` is set, on the profile page and on the home page.
   Files: modify `apps/web/src/app/user-avatar.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/app/profile/page.tsx`.
   Proved by: `apps/web/e2e/profile.spec.ts`, "a 4 MB PNG avatar shows on the profile and home pages, also after a new sign-in", "a replacement image shows in both places and the previous one does not".
   Issue: [#45](https://github.com/ydunets/claude-advanced/issues/45)
4. Documentation: the avatar Route Handler, the versioned image address and the proxy rule in `apps/web/CLAUDE.md`; the feature summary in the root `CLAUDE.md` and `README.md`.
   Files: modify the three documents.
   Proved by: review.
   Issue: [#46](https://github.com/ydunets/claude-advanced/issues/46)

**Produces:** Route Handler `PUT` and `GET /profile/avatar`; `AvatarForm`; Server Action `removeAvatar`.

**Done when:**

- A 4 MB PNG avatar shows on the profile and home pages, also after a new sign-in.
- A replacement JPEG or WebP shows in both places and the previous image does not.
- A GIF or a JPEG over 5 MB is refused with the formats and the limit, and the old avatar stays.
- Removing the avatar brings back the initials placeholder in both places.
- Another user or a signed-out visitor never receives the avatar image.
- The "Red run" lists every new test as red, or as green before implementation with its recorded forced failure.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm --filter web test:e2e` pass.
- The visual check and design review from `apps/web/CLAUDE.md` pass for `/profile` (placeholder, preview, avatar, error) and `/`.
