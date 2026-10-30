# Meeting File Upload: Implementation Plan

**PRD:** [Meeting File Upload](../prds/meeting-file-upload.md)
**Date:** 2026-10-29

## Global Constraints

- A single file is at most 100 MB.
- Files are stored on the API server's disk; no external storage service is added.
- The browser never calls the API directly, because the API has no CORS; every upload and download passes through the web server, which must therefore accept a 100 MB request.
- Every configurable value, including the storage location and the size limit, lives in an environment file, never as a default in code.
- One file per upload action; several files per meeting.
- Allowed formats: video `mp4`, `webm`, `mov`; audio `mp3`, `m4a`, `wav`, `ogg`; documents `pdf`, `docx`, `pptx`, `xlsx`; notes `txt`, `md`.
- Two files with the same name in one meeting are both kept and listed under their original names.

## Plan Decisions

These follow from the constraints and the current code; every phase relies on them.

- **Module.** Files belong to the existing `meetings/` module, which owns the new `meeting_files` table. Every file query filters by the meeting's owner, as `GetMeetingHandler` does, so another owner's file is indistinguishable from a missing one (404).
- **Disk layout.** A file is stored under a generated name, never its original name, so duplicate names cannot collide. The database row is inserted only after the file is completely on disk, so an interrupted upload never produces a listed file.
- **Multipart.** The API parses uploads with the `FileInterceptor` from `@nestjs/platform-express` (it bundles `multer` 2.4.0), configured through `MulterModule.registerAsync` from `ConfigService`.
- **Web transport.** Server Actions cannot carry the upload: their default body limit is 1 MB and they report no progress (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md`). The browser therefore sends the file with `XMLHttpRequest` to a Next.js Route Handler, which streams the body to the API without buffering it. Downloads use a second Route Handler that streams the API response.
- **Proxy.** `src/proxy.ts` buffers request bodies up to `proxyClientMaxBodySize` (10 MB by default, same docs folder). Its matcher adds the meeting page only; the Route Handlers stay outside it and forward the `accessToken` cookie as the bearer token themselves.
- **Home page.** The PRD's "meetings list" is the existing "Latest meetings" list on `/`; its rows become links to the meeting page. No full meetings list is added.

## Test-First Workflow

Every phase follows red, green, refactor. Its session works in this order:

1. **Red.** Before any production code, write every test named in the phase's "Proved by" lines and run the commands under "Tests first". Each new test must fail on an assertion for the reason given there (a missing route, a 404, a missing element), not on a setup error such as a stopped server or a missing env value. Record the result under the phase's "Red run": the date, the commands, and each new test with its failure reason.
2. **Green.** Implement the tasks until every new test passes and every existing test still passes.
3. **Refactor.** Clean up with the suites green, then run the phase's "Done when" checks.

Rules for every phase:

- A new test that already passes in the red run proves nothing yet. Record it as "green before implementation" with the reason (usually that an earlier phase already delivers the behaviour), make it fail once by reverting the behaviour it covers locally, record that failure, and restore the code.
- Tests drive the apps through HTTP and the browser only, so they import no production code that does not exist yet. The one exception is the Phase 4 unit test, whose expected red is the missing module.
- Red tests are not committed on their own: the pre-commit hook runs both e2e suites and blocks a failing commit. The phase is committed once green, and its "Red run" record is the evidence that each test failed first.
- A web red run needs the same stack as a green run: a migrated database and a running `pnpm dev`.

## Criteria Coverage

| PRD acceptance criterion (short form)                                                     | Phase |
| ----------------------------------------------------------------------------------------- | ----- |
| Owner opens a meeting from the home page and sees title, date, participants and file list | 1     |
| A meeting without files shows an empty state with an upload action                        | 3     |
| An allowed file of up to 100 MB appears with name, type, size and upload date             | 1     |
| A second upload lists both files                                                          | 1     |
| A file is still listed after reload or signing out and back in                            | 1     |
| A downloaded file is byte-for-byte identical to the original                              | 3     |
| A file over 100 MB is rejected with a message stating the limit; list unchanged           | 5     |
| A disallowed type is rejected with a message naming the allowed types; list unchanged     | 5     |
| A lost connection shows an error and leaves no incomplete file                            | 5     |
| A non-owner gets "not found" for the meeting page and the download address                | 3     |
| A signed-out visitor opening a meeting page is redirected to sign in                      | 1     |
| Files of one owner never appear in another owner's meetings                               | 2     |

---

## Phase 1: Upload and list a file on the meeting page (Tracer Bullet)

**Status:** done
**Milestone:** [Meeting File Upload, Phase 1: Upload and list a file on the meeting page](https://github.com/ydunets/claude-advanced/milestone/1)
**Goal:** an owner opens a meeting from the home page, uploads one allowed file, and sees it listed with its name, type, size and upload date, also after a reload or a new sign-in.
**Touches:** database, backend, frontend, documentation
**Read first:** `apps/api/src/database/schema.ts`, `apps/api/src/meetings/` (controller, `get-meeting.handler.ts`, `meeting-response.ts`, module), `apps/api/test/meetings.e2e-spec.ts`, `apps/web/src/app/page.tsx`, `apps/web/src/lib/meetings.ts`, `apps/web/src/lib/api.ts`, `apps/web/src/lib/routes.ts`, `apps/web/src/proxy.ts`, `apps/web/e2e/home.spec.ts`, `apps/web/e2e/test-users.ts`, the Next.js docs in `apps/web/node_modules/next/dist/docs/` on Route Handlers, dynamic route `params` and Cache Components (enabled in `next.config.ts`; `/meetings/[id]` is the app's first dynamic route and must pass `pnpm build`)
**Tests first:** `pnpm --filter api test:e2e meeting-files` and `pnpm --filter web test:e2e meeting`. Expected red: the API tests receive 404 from the missing files routes; the web tests find no meeting link on `/`, no `/meetings/[id]` page and no redirect to `/login`.
**Red run:** 2026-10-30, with a migrated database and a running `pnpm dev`.

- `pnpm --filter api test:e2e meeting-files`
  - "uploads a file and lists it with name, type, size and upload date": red, `POST /meetings/:id/files` answered 404 instead of 201.
  - "lists two files uploaded under the same name": red, the first upload answered 404 instead of 201.
- `pnpm --filter web test:e2e meeting`
  - "an owner opens a meeting from the home page and sees its details": red, no link named after the meeting on `/`.
  - "the meeting page sends a signed-out visitor to the login page": red, `/meetings/<id>` stayed on its URL instead of redirecting to `/login`.
  - "an uploaded file is listed", "a second upload lists both files", "an uploaded file survives a reload and a new sign-in": red, the meeting page has no "File" input.

**Tasks:**

1. The `meeting_files` table (meeting reference with cascade delete, original name, MIME type, size in bytes, storage name, upload timestamp) and its generated migration; the `FILES_STORAGE_DIR` variable in `apps/api/.env.example`, and the storage directory ignored by git.
   Files: modify `apps/api/src/database/schema.ts`, create `apps/api/drizzle/<generated>.sql`, modify `apps/api/.env.example`, `.gitignore`.
   Proved by: `pnpm --filter api db:migrate` applies cleanly; the e2e tests of task 2 write and read rows. Each developer adds `FILES_STORAGE_DIR` to the local `apps/api/.env`, because `getOrThrow` stops the API without it.
   Issue: [#1](https://github.com/ydunets/claude-advanced/issues/1)
2. `POST /meetings/:id/files` (multipart field `file`, `UploadMeetingFileCommand`) stores the file on disk and returns 201 with a `MeetingFileResponse`; when the browser sends an empty MIME type, the API stores `application/octet-stream`; `GET /meetings/:id/files` (`ListMeetingFilesQuery`) returns the meeting's files ordered by upload date. Both filter by the current owner.
   Files: create `apps/api/src/meetings/commands/upload-meeting-file.{command,handler}.ts`, `apps/api/src/meetings/queries/list-meeting-files.{query,handler}.ts`, `apps/api/src/meetings/meeting-file-response.ts`; modify `meetings.controller.ts`, `meetings.module.ts`.
   Proved by: `apps/api/test/meeting-files.e2e-spec.ts`, "uploads a file and lists it with name, type, size and upload date" and "lists two files uploaded under the same name".
   Issue: [#2](https://github.com/ydunets/claude-advanced/issues/2)
3. The meeting page `/meetings/[id]` shows the title, date, participants and the file list (name, type, size, upload date); it redirects to `/login` without a valid token, and the proxy matcher covers it. The rows of "Latest meetings" on `/` link to it.
   Files: create `apps/web/src/app/meetings/[id]/page.tsx`; modify `apps/web/src/lib/meetings.ts`, `apps/web/src/lib/api.ts`, `apps/web/src/lib/routes.ts`, `apps/web/src/proxy.ts`, `apps/web/src/app/page.tsx`.
   Proved by: `apps/web/e2e/meeting.spec.ts`, "an owner opens a meeting from the home page and sees its details" and "the meeting page sends a signed-out visitor to the login page".
   Issue: [#3](https://github.com/ydunets/claude-advanced/issues/3)
4. Upload from the meeting page: a client form sends one file with `XMLHttpRequest` to the Route Handler `POST /meetings/[id]/files`, which streams it to the API with the bearer token; the list refreshes after success.
   Files: create `apps/web/src/app/meetings/[id]/files/route.ts`, `apps/web/src/app/meetings/[id]/upload-file-form.tsx`; modify `apps/web/src/app/meetings/[id]/page.tsx`.
   Proved by: `apps/web/e2e/meeting.spec.ts`, "an uploaded file is listed", "a second upload lists both files", "an uploaded file survives a reload and a new sign-in".
   Issue: [#4](https://github.com/ydunets/claude-advanced/issues/4)
5. Documentation: the files routes, the `meeting_files` table, the disk store and `FILES_STORAGE_DIR` in `apps/api/CLAUDE.md`; the meeting page, the Route Handlers and the proxy matcher in `apps/web/CLAUDE.md`; the feature summary and configuration table in the root `CLAUDE.md` and `README.md`.
   Files: modify the four documents.
   Proved by: review against the root "Documentation maintenance" rules.
   Issue: [#5](https://github.com/ydunets/claude-advanced/issues/5)

**Produces:** table `meeting_files` (Drizzle `meetingFiles`, type `MeetingFile`); `FILES_STORAGE_DIR`; `POST /meetings/:id/files` (multipart field `file`, 201); `GET /meetings/:id/files`; `MeetingFileResponse` `{ id, name, mimeType, size, uploadedAt }`; `UploadMeetingFileCommand`, `ListMeetingFilesQuery`; web route `/meetings/[id]`; Route Handler `POST /meetings/[id]/files`; `UploadFileForm`; web functions `findMeeting`, `findMeetingFiles`; e2e files `apps/api/test/meeting-files.e2e-spec.ts`, `apps/web/e2e/meeting.spec.ts`.

**Done when:**

- Owner opens a meeting from the home page and sees title, date, participants and file list.
- An allowed file appears with name, type, size and upload date; a second upload lists both files.
- A file is still listed after reload or signing out and back in.
- A signed-out visitor opening a meeting page is redirected to sign in.
- The "Red run" lists every new test as red, or as green before implementation with its recorded forced failure.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm --filter api test:e2e` and `pnpm --filter web test:e2e` pass, and the existing home, login and register tests still pass.
- The visual check and design review from `apps/web/CLAUDE.md` pass for `/meetings/[id]` and `/`.

## Phase 2: Download endpoint and owner isolation (API)

**Status:** done
**Milestone:** [Meeting File Upload, Phase 2: Download endpoint and owner isolation (API)](https://github.com/ydunets/claude-advanced/milestone/2)
**Goal:** the API returns the original bytes of a file to its owner and answers 404 to everyone else on every files route.
**Touches:** backend, documentation
**Depends on:** Phase 1 (`meeting_files`, `POST /meetings/:id/files`, `GET /meetings/:id/files`, `MeetingFileResponse`, `apps/api/test/meeting-files.e2e-spec.ts`)
**Read first:** `apps/api/src/meetings/queries/get-meeting.handler.ts`, `apps/api/src/meetings/queries/list-meeting-files.handler.ts`, `apps/api/test/meeting-files.e2e-spec.ts`, `apps/api/test/meetings.e2e-spec.ts` ("returns 404 for another user's meeting")
**Tests first:** `pnpm --filter api test:e2e meeting-files`. Expected red: the download tests receive 404 from the missing route instead of 200 with the file. The 404 tests are expected green before implementation, because a missing route and the Phase 1 owner filter already answer 404; apply the rule for such tests.
**Red run:** 2026-10-30, `pnpm --filter api test:e2e meeting-files`, with a migrated database.

- "downloads the exact bytes that were uploaded": red, `GET /meetings/:id/files/:fileId` answered 404 instead of 200.
- "returns 404 for an unknown file id", "returns 404 to another user on upload, list and download", "does not serve a file through a different meeting id": red, not green as the plan expected. Each test first asserts that the owner downloads the file with 200, so a missing route cannot pass it; that assertion received 404.
- "rejects a file id that is not a UUID" (the 400 rule of task 1): red, 404 instead of 400.
- Forced failures after green, each reverted locally and restored: dropping the meeting id from the download lookup failed "does not serve a file through a different meeting id"; removing the stored-file cleanup from the upload handler failed "returns 404 to another user on upload, list and download" (88 stored files instead of 87).
- Review follow-up, 2026-10-30. "returns 404 when the stored file is gone from disk" was added test first and was red (400 "Bad Request" from `StreamableFile` instead of 404); the handler now opens the stored file before the response starts. The 404 checks that had failed only on their 200 guard were then forced to fail on the 404 itself: a lookup that ignores the file id failed "returns 404 for an unknown file id"; a list without the owner check and a download without the owner check each failed "returns 404 to another user on upload, list and download" (200 instead of 404).

**Tasks:**

1. `GET /meetings/:id/files/:fileId` (`GetMeetingFileQuery`) streams the stored file with its `Content-Type` and an attachment `Content-Disposition` carrying the original name; 400 for a non UUID id, 404 when the file is missing or the meeting belongs to someone else.
   Files: create `apps/api/src/meetings/queries/get-meeting-file.{query,handler}.ts`; modify `meetings.controller.ts`, `meetings.module.ts`.
   Proved by: `apps/api/test/meeting-files.e2e-spec.ts`, "downloads the exact bytes that were uploaded" and "returns 404 for an unknown file id".
   Issue: [#6](https://github.com/ydunets/claude-advanced/issues/6)
2. Owner isolation on every files route: another user's upload, list and download of a meeting answer 404, a rejected upload leaves no file on disk, and a file id from one meeting cannot be read through another meeting.
   Files: modify `upload-meeting-file.handler.ts` if a test fails; extend `apps/api/test/meeting-files.e2e-spec.ts`.
   Proved by: `apps/api/test/meeting-files.e2e-spec.ts`, "returns 404 to another user on upload, list and download" and "does not serve a file through a different meeting id".
   Issue: [#7](https://github.com/ydunets/claude-advanced/issues/7)
3. Documentation: the download route and its 404 rule in `apps/api/CLAUDE.md`.
   Files: modify `apps/api/CLAUDE.md`.
   Proved by: review.
   Issue: [#8](https://github.com/ydunets/claude-advanced/issues/8)

**Produces:** `GET /meetings/:id/files/:fileId` (200 stream with `Content-Type` and `Content-Disposition`, 404 otherwise); `GetMeetingFileQuery`.

**Done when:**

- Files of one owner never appear in another owner's meetings.
- The "Red run" lists every new test as red, or as green before implementation with its recorded forced failure.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm --filter api test:e2e` pass.

## Phase 3: Download, empty state and "not found" on the meeting page

**Status:** done
**Milestone:** [Meeting File Upload, Phase 3: Download, empty state and "not found" on the meeting page](https://github.com/ydunets/claude-advanced/milestone/3)
**Goal:** an owner downloads the original file from the list, a meeting without files invites an upload, and a non-owner sees "not found" for the page and the download address.
**Touches:** frontend, documentation
**Depends on:** Phase 1 (`/meetings/[id]`, `UploadFileForm`, `findMeeting`, `findMeetingFiles`, `apps/web/e2e/meeting.spec.ts`), Phase 2 (`GET /meetings/:id/files/:fileId`)
**Read first:** `apps/web/src/app/meetings/[id]/page.tsx`, `apps/web/src/app/meetings/[id]/files/route.ts`, `apps/web/src/lib/meetings.ts`, `apps/web/e2e/meeting.spec.ts`, Next.js `notFound` docs in `apps/web/node_modules/next/dist/docs/`. Confirm from the docs whether `notFound()` inside an already streaming Suspense boundary returns HTTP 404 or 200 with the not-found UI; the page test asserts the visible not-found content rather than assuming a status.
**Tests first:** `pnpm --filter web test:e2e meeting`. Expected red: the list has no download link, a meeting without files shows no empty state with an upload action, and another user's meeting address shows an error page instead of the not-found content.
**Red run:** 2026-10-30, `pnpm --filter web test:e2e meeting`, with a migrated database and a running `pnpm dev`.

- "a downloaded file is byte-for-byte identical to the uploaded one": red, the file row had no download link.
- "a meeting without files shows an empty state with an upload action": red, no element held both "No files yet." and the Upload button.
- "another user gets not found for the meeting page and its download address": first red on its setup (no download link to read); after task 1 it was red on its own assertion, with no "not found" heading for another user's meeting, and turned green with task 2.
- The docs confirm that `notFound()` inside the streaming Suspense boundary keeps HTTP 200 and renders the not-found UI, so the page test asserts the visible heading; the download Route Handler answers a real 404.
- Review follow-up, 2026-10-30. The download half of "another user gets not found for the meeting page and its download address" had passed through the handler's generic error branch and was never seen red. The test now also requests a malformed file id, and three forced failures were recorded, each reverted locally and restored: streaming the API error body failed the empty-body check (68 bytes instead of 0); passing the API 400 through failed the malformed file id check (400 instead of 404); treating only 404 as not found on the page failed the malformed meeting id check (no "not found" heading).
- Visual check and design review, 2026-10-30: `/meetings/[id]` with files, without files (empty state) and for a foreign meeting (not found) at 375, 768 and 1280 px through the Playwright MCP, with no application errors in the console (one hydration warning came from Playwright injecting `caret-color` during a screenshot taken mid-hydration and did not recur after hydration). The `ui-ux-pro-max` empty-state guideline ("helpful message and action") holds; download links carry the file name in their accessible name and are 36 px tall; the not-found page keeps the "All meetings" link.

**Tasks:**

1. A Route Handler `GET /meetings/[id]/files/[fileId]` streams the API response with its headers; each list row has a download link to it.
   Files: create `apps/web/src/app/meetings/[id]/files/[fileId]/route.ts`; modify `apps/web/src/app/meetings/[id]/page.tsx`, `apps/web/src/lib/routes.ts`.
   Proved by: `apps/web/e2e/meeting.spec.ts`, "a downloaded file is byte-for-byte identical to the uploaded one".
   Issue: [#9](https://github.com/ydunets/claude-advanced/issues/9)
2. A non-owner, or an unknown meeting id, gets the Next.js "not found" page on `/meetings/[id]` and a 404 without content from the download Route Handler.
   Files: modify `apps/web/src/app/meetings/[id]/page.tsx`, `apps/web/src/lib/meetings.ts`, `apps/web/src/lib/api.ts`, the download Route Handler.
   Proved by: `apps/web/e2e/meeting.spec.ts`, "another user gets not found for the meeting page and its download address".
   Issue: [#10](https://github.com/ydunets/claude-advanced/issues/10)
3. A meeting without files shows an empty state that contains the upload action.
   Files: modify `apps/web/src/app/meetings/[id]/page.tsx`.
   Proved by: `apps/web/e2e/meeting.spec.ts`, "a meeting without files shows an empty state with an upload action".
   Issue: [#11](https://github.com/ydunets/claude-advanced/issues/11)
4. Documentation: the download Route Handler and the 404 behaviour in `apps/web/CLAUDE.md`.
   Files: modify `apps/web/CLAUDE.md`.
   Proved by: review.
   Issue: [#12](https://github.com/ydunets/claude-advanced/issues/12)

**Produces:** Route Handler `GET /meetings/[id]/files/[fileId]`.

**Done when:**

- A downloaded file is byte-for-byte identical to the original.
- A meeting without files shows an empty state with an upload action.
- A non-owner gets "not found" for the meeting page and the download address.
- The "Red run" lists every new test as red, or as green before implementation with its recorded forced failure.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm --filter web test:e2e` pass.
- The visual check and design review from `apps/web/CLAUDE.md` pass for `/meetings/[id]`, including the empty state and the "not found" page.

## Phase 4: Upload limits and interrupted uploads (API)

**Status:** done
**Milestone:** [Meeting File Upload, Phase 4: Upload limits and interrupted uploads (API)](https://github.com/ydunets/claude-advanced/milestone/4)
**Goal:** the API rejects files over the configured limit and files of disallowed formats with messages the web app can show, and an interrupted upload leaves neither a row nor a file on disk.
**Touches:** backend, documentation
**Depends on:** Phase 1 (`POST /meetings/:id/files`, `GET /meetings/:id/files`, `FILES_STORAGE_DIR`, `apps/api/test/meeting-files.e2e-spec.ts`)
**Read first:** `apps/api/src/meetings/meetings.module.ts` (the `MulterModule` registration), `apps/api/src/meetings/commands/upload-meeting-file.handler.ts`, `apps/api/src/auth/password.spec.ts` (unit test style), `apps/api/node_modules/@nestjs/platform-express/multer/`
**Tests first:** `pnpm --filter api test allowed-file-formats` and `pnpm --filter api test:e2e meeting-files`. Expected red: the unit test fails because `allowed-file-formats.ts` does not exist; the oversized and disallowed uploads receive 201 instead of 413 and 415. The aborted-upload test may be green before implementation, because Phase 1 inserts the row only after the file is on disk; apply the rule for such tests.
**Red run:** 2026-10-30, `pnpm --filter api test allowed-file-formats` and `pnpm --filter api test:e2e meeting-files`, with a migrated database and `MAX_FILE_SIZE_BYTES` in `apps/api/.env`.

- "accepts every allowed extension in any case and rejects others": red, `allowed-file-formats.ts` did not exist.
- "rejects a file over the size limit and keeps the list unchanged": red, 201 instead of 413.
- "rejects a disallowed format and names the allowed ones": red, 201 instead of 415.
- "an aborted upload leaves no listed file and no file on disk": green before implementation, because multer 2.4.0 removes the partial file when the request aborts and the row is inserted only after the file is complete. The test first waits until multer has created the partial file, so it aborts a real write. Forced failure: a storage engine whose `_removeFile` does nothing left the partial file behind ("expected 297 to be 296"); the module was restored and the test passed again.
- The Phase 1 web fixture `transcript.vtt-draft` has a disallowed extension and would now receive 415. It became `transcript.md` sent as `application/octet-stream`, because Playwright infers a type from every allowed extension. The test now proves only that the API stores that fallback type unchanged; the browser's own fallback for an untyped file is no longer exercised.

**Tasks:**

1. A size limit read from the new `MAX_FILE_SIZE_BYTES` (`104857600` in `.env.example`): a larger file returns 413 with a message that states the limit in MB, and no row or file remains.
   Files: modify `meetings.module.ts`, `apps/api/.env.example`.
   Proved by: `apps/api/test/meeting-files.e2e-spec.ts`, "rejects a file over the size limit and keeps the list unchanged".
   Issue: [#13](https://github.com/ydunets/claude-advanced/issues/13)
2. A format check against the allowed extension list (compared case-insensitively): a disallowed file returns 415 with a message that names every allowed format, before it is written to disk.
   Files: create `apps/api/src/meetings/allowed-file-formats.ts` and its `.spec.ts`; modify `meetings.module.ts`.
   Proved by: `allowed-file-formats.spec.ts`, "accepts every allowed extension in any case and rejects others"; `meeting-files.e2e-spec.ts`, "rejects a disallowed format and names the allowed ones".
   Issue: [#14](https://github.com/ydunets/claude-advanced/issues/14)
3. An upload aborted mid-stream leaves no row and no partial file in `FILES_STORAGE_DIR`.
   Files: modify `upload-meeting-file.handler.ts` or the interceptor setup if the test fails; extend `meeting-files.e2e-spec.ts`.
   Proved by: `meeting-files.e2e-spec.ts`, "an aborted upload leaves no listed file and no file on disk".
   Issue: [#15](https://github.com/ydunets/claude-advanced/issues/15)
4. Documentation: `MAX_FILE_SIZE_BYTES`, the allowed formats and the 413 and 415 responses in `apps/api/CLAUDE.md`; the configuration table in the root `README.md`.
   Files: modify `apps/api/CLAUDE.md`, `README.md`.
   Proved by: review.
   Issue: [#16](https://github.com/ydunets/claude-advanced/issues/16)

**Produces:** `MAX_FILE_SIZE_BYTES`; `POST /meetings/:id/files` errors 413 (message states the limit) and 415 (message names the allowed formats), both in the Nest error body `{ statusCode, message, error }`.

**Done when:**

- The three e2e tests and the unit test above pass; they are the API foundation for the oversized, disallowed and interrupted criteria, which Phase 5 completes in the UI.
- The "Red run" lists every new test as red, or as green before implementation with its recorded forced failure.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm --filter api test:e2e` pass.

## Phase 5: Upload progress and error messages on the meeting page

**Status:** pending
**Milestone:** [Meeting File Upload, Phase 5: Upload progress and error messages on the meeting page](https://github.com/ydunets/claude-advanced/milestone/5)
**Goal:** the owner sees upload progress, and a clear message for an oversized file, a disallowed format and a lost connection, while the file list stays unchanged.
**Touches:** frontend, documentation
**Depends on:** Phase 1 (`UploadFileForm`, Route Handler `POST /meetings/[id]/files`, `apps/web/e2e/meeting.spec.ts`), Phase 4 (`POST /meetings/:id/files` errors 413 and 415)
**Read first:** `apps/web/src/app/meetings/[id]/upload-file-form.tsx`, `apps/web/src/app/meetings/[id]/files/route.ts`, `apps/web/src/app/(auth)/credentials-form.tsx` (form error display), `apps/web/e2e/meeting.spec.ts`, the `heroui-react` skill for progress and alert components
**Tests first:** `pnpm --filter web test:e2e meeting`. Expected red: no progress indicator appears during an upload, and no message appears for an oversized file, a disallowed format or an aborted request.
**Red run:** not yet run.

**Tasks:**

1. A progress indicator driven by the `XMLHttpRequest` upload progress events, shown while a file uploads.
   Files: modify `upload-file-form.tsx`.
   Proved by: `apps/web/e2e/meeting.spec.ts`, "an upload shows progress until the file is listed".
   Issue: [#17](https://github.com/ydunets/claude-advanced/issues/17)
2. A file over the limit is refused in the browser before sending, with a message that states the limit; the limit comes from the new server-side `MAX_UPLOAD_SIZE_BYTES` in `apps/web/.env.example`, passed to the form by the page. The Route Handler relays the API's 413 message for any request that reaches it.
   Files: modify `upload-file-form.tsx`, `apps/web/src/app/meetings/[id]/page.tsx`, the upload Route Handler, `apps/web/.env.example`.
   Proved by: `apps/web/e2e/meeting.spec.ts`, "a file over 100 MB is rejected with the limit and the list is unchanged".
   Issue: [#18](https://github.com/ydunets/claude-advanced/issues/18)
3. A disallowed format shows the API's 415 message naming the allowed formats.
   Files: modify `upload-file-form.tsx`.
   Proved by: `apps/web/e2e/meeting.spec.ts`, "a disallowed format is rejected with the allowed formats and the list is unchanged".
   Issue: [#19](https://github.com/ydunets/claude-advanced/issues/19)
4. A lost connection during upload shows an error, and the list does not change.
   Files: modify `upload-file-form.tsx`.
   Proved by: `apps/web/e2e/meeting.spec.ts`, "a lost connection shows an error and lists no incomplete file" (the test aborts the upload request through `page.route`).
   Issue: [#20](https://github.com/ydunets/claude-advanced/issues/20)
5. Documentation: `MAX_UPLOAD_SIZE_BYTES` in `apps/web/CLAUDE.md` and in the root `README.md` configuration table.
   Files: modify `apps/web/CLAUDE.md`, `README.md`.
   Proved by: review.
   Issue: [#21](https://github.com/ydunets/claude-advanced/issues/21)

**Produces:** `MAX_UPLOAD_SIZE_BYTES`.

**Done when:**

- A file over 100 MB is rejected with a message stating the limit; the list is unchanged.
- A disallowed type is rejected with a message naming the allowed types; the list is unchanged.
- A lost connection shows an error and leaves no incomplete file. The browser test aborts the request before it reaches the server, so it proves the message only; Phase 4's API abort test proves that no incomplete file is stored.
- The "Red run" lists every new test as red, or as green before implementation with its recorded forced failure.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm --filter web test:e2e` pass.
- The visual check and design review from `apps/web/CLAUDE.md` pass for `/meetings/[id]` in the progress, oversized, disallowed and interrupted states.
