# apps/api

NestJS 12 backend written as native ES modules (`"type": "module"`, `module: nodenext`). Tests run on Vitest.

@AGENTS.md

## Commands

Run from the repository root with `pnpm --filter api <script>`, or from this directory.

- `start:dev`: start in watch mode on port 4000 (override with `PORT`).
- `build` and `start:prod`: compile to `dist/` and run the output.
- `lint`: Oxlint, type-aware (`.oxlintrc.json` extends the root config).
- `typecheck`: `tsc --noEmit`.
- `test`: unit tests (`src/**/*.spec.ts`). `test:e2e` runs the end-to-end suite in `test/` against the real database.
- `db:generate`: create a SQL migration in `drizzle/` from `src/database/schema.ts`. `db:migrate`: apply pending migrations.

## Database

Postgres runs through the root `compose.yaml` (`pnpm db:up`). Drizzle ORM (`drizzle-orm/node-postgres`) is the data access layer; `drizzle.config.ts` configures `drizzle-kit`.

- `src/database/schema.ts` is the single schema source. Change it, then run `db:generate` and commit the generated migration. Never edit applied migrations.
- `DatabaseModule` provides the Drizzle client under the `DATABASE` token and closes the pool on shutdown. Only command and query handlers, and services that own a table (`UsersService`), inject it; controllers never do.

## CQRS

Feature modules follow CQRS through `@nestjs/cqrs`. `CqrsModule.forRoot()` is registered once in `AppModule`; each feature module only lists its handlers as providers.

- A **command** changes state (`commands/<name>.command.ts`), and a **query** only reads (`queries/<name>.query.ts`). Classify by effect, not by HTTP verb: `POST /auth/login` is a query because it writes nothing.
- Each command or query extends `Command<TResult>` or `Query<TResult>`, so `commandBus.execute()` and `queryBus.execute()` return a typed promise without casts.
- Each has exactly one handler in the same folder (`<name>.handler.ts`, decorated with `@CommandHandler` or `@QueryHandler`). A handler owns one use case end to end: it runs the Drizzle query (or calls a table owning service from another module), maps rows to the response shape, and throws Nest HTTP exceptions (`NotFoundException`, `ConflictException`, `UnauthorizedException`) for expected failures.
- Commands may return a result when the HTTP response needs it (the created meeting, the issued token). This is a deliberate relaxation of strict CQRS.
- Controllers stay thin: validate the body with a DTO, read the user with `@CurrentUser()`, build the command or query, and dispatch it. No business logic and no database access.
- Logic shared by several handlers lives in a plain injectable service (`AuthTokenService`), not in another handler.

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

- `database/`: Drizzle client and schema (`users`, `meetings`).
- `users/`: `UsersService` owns the `users` table (lookup by email, creation). Emails are stored lowercased; a unique index on `lower(email)` enforces uniqueness. It knows nothing about HTTP, hashing or tokens.
- `auth/`: `POST /auth/register` (201, `RegisterCommand`) and `POST /auth/login` (200, `LoginQuery`), both returning `{ accessToken }`. Passwords are hashed with Node `scrypt` (`password.ts`). Unknown email and wrong password both return 401. `AuthTokenService` signs and verifies JWTs and is exported. `JwtAuthGuard` requires a valid `Authorization: Bearer` token (401 otherwise) and sets `request.user`; `@CurrentUser()` reads it.
- `meetings/`: every route is behind `JwtAuthGuard` and scoped to the current user. `POST /meetings` (`CreateMeetingCommand`) takes `{ title, date (ISO 8601), participants (emails) }`; `GET /meetings` (`ListMeetingsQuery`) lists the user's meetings ordered by date; `GET /meetings/:id` (`GetMeetingQuery`) returns 400 for a non UUID id and 404 when the meeting is missing or owned by someone else. Responses are `{ id, title, date, participants }` (`meeting-response.ts`).

Validation runs through a global `ValidationPipe` registered as `APP_PIPE` in `AppModule`, so end-to-end tests see the same behaviour as the server.

## Environment variables

`.env.example` lists `DATABASE_URL`, `JWT_SECRET` and `JWT_EXPIRES_IN_SECONDS`. `ConfigModule` loads `.env` from this directory, and the app fails at startup when one is missing.

## Conventions

- Relative imports must include the `.js` extension (for example `./app.module.js`), as required by `nodenext`.
- Organize code by feature module, each in its own folder under `src/`, following the CQRS layout above.
- Keep HTTP concerns in controllers and use case logic in handlers. Validate input at the controller boundary.
- Protect user data with `@UseGuards(JwtAuthGuard)` and filter every query by the current user's id.
- Read configuration from environment variables and document each one in `.env.example`.
- `typescript/no-floating-promises` is an error: every promise must be awaited or handled explicitly.
- Do not add Oxfmt, Oxlint or TypeScript to this package; they are provided by the root.
- When a change alters this app's architecture (modules, persistence, external services, scripts, ports or environment variables), update this file and the root `README.md` and `CLAUDE.md` as described in the root "Documentation maintenance" section.
