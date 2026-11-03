# apps/api

NestJS 12 backend written as native ES modules (`"type": "module"`, `module: nodenext`). Tests run on Vitest.

@AGENTS.md

## Commands

Run from the repository root with `pnpm --filter api <script>`, or from this directory.

- `dev`: start in watch mode on `PORT` from `.env` (4000 in `.env.example`).
- `build` and `start:prod`: compile to `dist/` and run the output.
- `lint`: Oxlint, type-aware (`.oxlintrc.json` extends the root config).
- `typecheck`: `tsc --noEmit`.
- `test`: unit tests (`src/**/*.spec.ts`); `test:watch` reruns them on change. `test:e2e` runs the end-to-end suite in `test/` against the real database: it boots `AppModule` in the test process with Supertest, so no API server needs to run, but Postgres must be up and migrated. Each test registers a user with a random email, so no cleanup is needed.
- `db:generate`: create a SQL migration in `drizzle/` from `src/database/schema.ts`. `db:migrate`: apply pending migrations.

## Database

Postgres runs through the root `compose.yaml` (`pnpm db:up`). Drizzle ORM (`drizzle-orm/node-postgres`) is the data access layer; `drizzle.config.ts` configures `drizzle-kit`.

- `src/database/schema.ts` is the single schema source. Change it, then run `db:generate` and commit the generated migration. Never edit applied migrations.
- `DatabaseModule` provides the Drizzle client under the `DATABASE` token and closes the pool on shutdown. Only command and query handlers inject it; controllers and services never do.

## CQRS

Feature modules follow CQRS through `@nestjs/cqrs`. `CqrsModule.forRoot()` is registered once in `AppModule`; each feature module only lists its handlers as providers.

- A **command** changes state (`commands/<name>.command.ts`), and a **query** only reads (`queries/<name>.query.ts`). Classify by effect, not by HTTP verb: `POST /auth/login` is a query because it writes nothing.
- Each command or query extends `Command<TResult>` or `Query<TResult>`, so `commandBus.execute()` and `queryBus.execute()` return a typed promise without casts.
- Each has exactly one handler in the same folder (`<name>.handler.ts`, decorated with `@CommandHandler` or `@QueryHandler`). A handler owns one use case end to end: it runs the Drizzle query for a table its own module owns, maps rows to the response shape, and throws Nest HTTP exceptions (`NotFoundException`, `ConflictException`, `UnauthorizedException`) for expected failures.
- Commands may return a result when the HTTP response needs it (the created meeting, the issued token). This is a deliberate relaxation of strict CQRS.
- Controllers stay thin: validate the body with a DTO, read the user with `@CurrentUser()`, build the command or query, and dispatch it. No business logic and no database access.
- Logic shared by several handlers lives in a plain injectable service (`AuthTokenService`) or a plain function module (`users/email.ts`), not in another handler.
- Modules talk to each other only through the buses: a handler dispatches another module's command or query (`RegisterHandler` sends `CreateUserCommand`, `LoginHandler` sends `FindUserByEmailQuery`) and never injects that module's handlers or services. A module that only serves the buses exports nothing and is imported once, in `AppModule`. Errors crossing the bus are plain domain errors (`EmailAlreadyRegisteredError`); the calling handler maps them to HTTP exceptions.

New feature module layout:

```
src/<feature>/
├── <feature>.module.ts       imports, controller, handler providers
├── <feature>.controller.ts   dispatches to CommandBus / QueryBus
├── dto/                      class-validator request bodies
├── commands/                 <name>.command.ts + <name>.handler.ts
└── queries/                  <name>.query.ts + <name>.handler.ts
```

## Modules

- `app.module.ts`: the composition root. It registers `ConfigModule`, `CqrsModule.forRoot()`, the global `ValidationPipe` and the feature modules (`UsersModule`, `AuthModule`, `MeetingsModule`, `ProfileModule`). It has no controller and no providers of its own, so `GET /` returns 404.
- `config/`: `getPositiveIntegerConfig` reads a required env value and fails at startup unless it is a positive integer.
- `database/`: Drizzle client and schema (`users`, `meetings`, `meeting_files`).
- `users/`: owns the `users` table. `CreateUserCommand` inserts a user from an email, an already hashed password and a name, and rejects a taken email with `EmailAlreadyRegisteredError`; `UpdateUserNameCommand` and `UpdateUserPasswordCommand` set a user's name or an already hashed password and resolve the updated user or `undefined` (the password update also increments `token_version`, which starts at 0, migration `0004_add_user_token_version.sql`; it updates only while `token_version` still equals the caller's expected version, so a concurrent change resolves `undefined`); `FindUserByEmailQuery` and `FindUserByIdQuery` resolve the user or `undefined`. The `name` column is required; migration `0003_add_user_name.sql` is hand-edited to fill existing rows with the part of the email before "@" before it sets `NOT NULL`. Emails are stored lowercased (`email.ts`); a unique index on `lower(email)` enforces uniqueness. It has no controller and knows nothing about HTTP or hashing, and it neither signs nor verifies tokens.
- `auth/`: `POST /auth/register` (201, `RegisterCommand`, body `{ name, email, password }`, 400 for an invalid name) and `POST /auth/login` (200, `LoginQuery`), both returning `{ accessToken }`. The name rule (`dto/user-name.ts`, `@IsUserName()`, shared with `PATCH /profile`) trims surrounding spaces and then requires 1 to 100 characters. Auth holds only the credential logic: it hashes and checks passwords with Node `scrypt` (`password.ts`) and issues tokens, and it reaches users through the buses. Unknown email and wrong password both return 401. `POST /auth/password` (200, `ChangePasswordCommand`, behind `JwtAuthGuard`, body `{ currentPassword, newPassword }`) answers 403 for a wrong current password (not 401, which clients treat as signed out), 400 for a new password under 8 characters or equal to the current one, 401 when the token's user no longer exists, and 409 when a concurrent change already moved the token's version (not 401, so a double submit never signs out the browser that won); on success it stores the new hash through `UpdateUserPasswordCommand`, compared against the token's version, and returns a new `{ accessToken }`. `POST /auth/login` and `POST /auth/password` run `ThrottlerGuard` from `@nestjs/throttler` (registered in `auth.module.ts`): `AUTH_ATTEMPT_LIMIT` attempts per account within `AUTH_ATTEMPT_WINDOW_SECONDS`, then 429. `auth-attempt-tracker.ts` keys the login by the normalized submitted email and the password change by the user id (so `JwtAuthGuard` runs first), never by IP, because the web app calls the API server to server. The counters live in the API process's memory. `AuthTokenService` signs and verifies JWTs and is exported; each token carries the user's `tokenVersion` claim, and a token without the claim counts as version 0. `JwtAuthGuard` requires a valid `Authorization: Bearer` token, then loads the user through `FindUserByIdQuery` on every request and answers 401 when the user no longer exists or its `token_version` differs from the claim; a password change therefore revokes every earlier token, and only the token it returns stays valid. On success the guard sets `request.user` to `{ id, email, name, tokenVersion }` (never `passwordHash`); `@CurrentUser()` reads it, so `GET /profile` needs no second read; `POST /auth/password` still reads the user once, for `passwordHash`.
- `meetings/`: every route is behind `JwtAuthGuard` and scoped to the current user. It imports `AuthModule` for that guard and `AuthTokenService`, the one direct module dependency: request authentication is a cross-cutting concern, not a use case sent over the buses. `POST /meetings` (`CreateMeetingCommand`) takes `{ title, date (ISO 8601), participants (emails) }`; `GET /meetings` (`ListMeetingsQuery`) lists the user's meetings ordered by date; `GET /meetings/:id` (`GetMeetingQuery`) returns 400 for a non UUID id and 404 when the meeting is missing or owned by someone else. Responses are `{ id, title, date, participants }` (`meeting-response.ts`). The module also owns `meeting_files` (cascade deleted with the meeting): `POST /meetings/:id/files` (`UploadMeetingFileCommand`, multipart field `file`, 201, 400 without a file, 413 over the size limit, 415 for a disallowed format) and `GET /meetings/:id/files` (`ListMeetingFilesQuery`, ordered by upload date) return `{ id, name, mimeType, size, uploadedAt }` (`meeting-file-response.ts`). `GET /meetings/:id/files/:fileId` (`GetMeetingFileQuery`) streams the stored file as a `StreamableFile` with the stored `Content-Type`, `Content-Length`, an attachment `Content-Disposition` set through `res.attachment()` (RFC 6266 encoding, so non-ASCII names survive) and `X-Content-Type-Options: nosniff`; it returns 400 for a non UUID id. Every handler resolves the meeting through `getOwnedMeeting` (`owned-meeting.ts`), and the download also matches the file to that meeting, so another owner's meeting, an unknown file id, or a file id from a different meeting all answer 404 and reveal nothing. The handler opens the stored file before the response starts, so a row whose disk file is lost also answers 404 instead of the 400 that `StreamableFile` sends for a failed stream.
- `profile/`: the HTTP surface of the signed-in user's own profile; it imports `AuthModule` for `JwtAuthGuard`, as `meetings/` does, and owns no table. `GET /profile` (`GetProfileQuery`) returns `{ name, email }` (`profile-response.ts`) for the token's user, built from the user that `JwtAuthGuard` loaded. `PATCH /profile` (`UpdateProfileCommand`, body `{ name }`) applies the name rule (400 otherwise), stores the name through `UpdateUserNameCommand` and returns the same response. Both routes answer 401 without a valid token or when the token's user no longer exists, and neither takes a user id.

Validation runs through a global `ValidationPipe` registered as `APP_PIPE` in `AppModule`, so end-to-end tests see the same behaviour as the server.

### File storage

`MulterModule.registerAsync` in `meetings.module.ts` configures the `FileInterceptor` from `@nestjs/platform-express`: multer writes each upload to `FILES_STORAGE_DIR` under a random hex name (the `storage_name` column), so duplicate original names never collide, and it decodes file names as UTF-8. The row is inserted only after the file is on disk; when the owner check or the insert fails, the upload handler deletes the stored file. The stored MIME type is the one the browser sent for the part; browsers send `application/octet-stream` for a file they cannot type, and busboy reads a part without any Content-Type as `text/plain`. Files live on the API server's disk only; no external storage service is used.

Upload limits are enforced by multer, before the handler runs, and both errors use the Nest error body `{ statusCode, message, error }`:

- **Size.** `limits.fileSize` comes from `MAX_FILE_SIZE_BYTES`. Multer stops the stream at the limit, removes the partial file and answers 413 "File too large"; `FileSizeLimitInterceptor` (listed before `FileInterceptor` on the route) replaces that message with one that states the limit in MB (`file-size-limit.ts`).
- **Format.** The `fileFilter` checks the file name's extension, case-insensitively, against `ALLOWED_FILE_FORMATS` in `allowed-file-formats.ts` (video `mp4`, `webm`, `mov`; audio `mp3`, `m4a`, `wav`, `ogg`; documents `pdf`, `docx`, `pptx`, `xlsx`; notes `txt`, `md`). A rejected file answers 415 with a message that names every allowed format and is never written to disk. The browser-sent MIME type is not checked.
- **Aborted uploads.** When the client drops the connection, multer 2.4 removes the partial file, and no row exists yet, so nothing is listed.

## Environment variables

`.env.example` lists `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN_SECONDS`, `FILES_STORAGE_DIR` (relative to this directory; the root `.gitignore` ignores `apps/api/storage`) `MAX_FILE_SIZE_BYTES` (the largest accepted upload, `104857600` for 100 MB), `AUTH_ATTEMPT_LIMIT` and `AUTH_ATTEMPT_WINDOW_SECONDS` (sign-in and password change attempts per account, `5` within `900` seconds); `getPositiveIntegerConfig` rejects anything but a positive integer for these and `JWT_EXPIRES_IN_SECONDS` at startup; copy it to `.env`. Inside Nest, `ConfigModule` loads `.env` from this directory (it uses `dotenv` internally) and every value is read with `ConfigService.getOrThrow`, so the app fails at startup when one is missing. Outside Nest, `drizzle.config.ts` loads the same file with `dotenv`. Code holds no fallback values.

## Conventions

- Relative imports must include the `.js` extension (for example `./app.module.js`), as required by `nodenext`.
- Organize code by feature module, each in its own folder under `src/`, following the CQRS layout above.
- Keep HTTP concerns in controllers and use case logic in handlers. Validate input at the controller boundary.
- Protect user data with `@UseGuards(JwtAuthGuard)` and filter every query by the current user's id.
- Read configuration from environment variables and document each one in `.env.example`.
- `typescript/no-floating-promises` is an error: every promise must be awaited or handled explicitly.
- Do not add Oxfmt, Oxlint or TypeScript to this package; they are provided by the root.
- When a change alters this app's architecture (modules, persistence, external services, scripts, ports or environment variables), update this file and the root `README.md` and `CLAUDE.md` as described in the root "Documentation maintenance" section.
