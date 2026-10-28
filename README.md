# video-meetings

pnpm workspace with two applications.

| App        | Stack   | Default port |
| ---------- | ------- | ------------ |
| `apps/web` | Next.js | 3000         |
| `apps/api` | NestJS  | 4000         |

The API exposes `POST /auth/register` and `POST /auth/login`; both take
`{ email, password }` and return `{ accessToken }` (a JWT). With
`Authorization: Bearer <accessToken>`, `POST /meetings`, `GET /meetings` and
`GET /meetings/:id` manage the current user's meetings. The API follows CQRS
(`@nestjs/cqrs`); see `apps/api/CLAUDE.md`.

The web app has `/register` and `/login` pages, which call the API from
Next.js Server Actions (the API has no CORS), keep the token in an httpOnly
`accessToken` cookie and redirect to `/`. The home page `/` is only for
signed-in users: it shows their email, the number of meetings, the three
latest meetings and a Sign out button.

## Commands

Run from the repository root after `pnpm install`.

| Command          | Purpose                                      |
| ---------------- | -------------------------------------------- |
| `pnpm dev`       | Start both apps in watch mode                |
| `pnpm dev:web`   | Start the Next.js app only                   |
| `pnpm dev:api`   | Start the NestJS app only                    |
| `pnpm build`     | Build every app                              |
| `pnpm lint`      | Run Oxlint with type-aware rules             |
| `pnpm lint:fix`  | Apply Oxlint autofixes                       |
| `pnpm typecheck` | Run the TypeScript compiler without emitting |
| `pnpm test`      | Run the unit tests (Vitest)                  |
| `pnpm format`    | Format the repository with Oxfmt             |
| `pnpm db:up`     | Start Postgres in Docker and wait for health |
| `pnpm db:down`   | Stop Postgres (data stays in the volume)     |

Oxlint is configured in the root `.oxlintrc.json`; each app extends it.

A Husky `pre-commit` hook (`.husky/pre-commit`) runs `pnpm lint`,
`pnpm typecheck`, `pnpm test` and both end-to-end suites before every commit,
so a commit needs the stack described in [Tests](#tests): migrated Postgres,
`pnpm dev` and Chromium. A `pre-push` hook (`.husky/pre-push`) runs `pnpm lint`.
`pnpm install` installs both hooks through the `prepare` script.

## Configuration

All configuration lives in git-ignored env files; neither the code nor
`compose.yaml` carries default values, and a missing variable stops startup.

| File            | Read by                                                 | Variables                                                            |
| --------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| `.env`          | Docker Compose                                          | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` |
| `apps/api/.env` | The API (`@nestjs/config`) and `drizzle-kit` (`dotenv`) | `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN_SECONDS`       |
| `apps/web/.env` | Next.js Server Actions and the Playwright suite         | `API_URL`, `E2E_BASE_URL`                                            |

Create each from its `.env.example` and keep `DATABASE_URL` consistent with
the Postgres values.

## Database

`compose.yaml` runs Postgres 17 with a named volume (`postgres-data`). It
requires Docker with Compose v2. The API accesses Postgres through Drizzle ORM.
To prepare a fresh database:

1. Copy `.env.example` to `.env` and `apps/api/.env.example` to
   `apps/api/.env`, then set `JWT_SECRET`.
2. Run `pnpm db:up`, then `pnpm --filter api db:migrate`.
3. Run `pnpm --filter api test:e2e` to exercise the API end to end.

## Tests

The repository has three suites. Each later one needs more of the stack
running than the one before it.

| Suite                       | Command                      | Needs                                                                         | Location                    |
| --------------------------- | ---------------------------- | ----------------------------------------------------------------------------- | --------------------------- |
| Unit (Vitest)               | `pnpm test`                  | Nothing                                                                       | `apps/api/src/**/*.spec.ts` |
| API end to end (Vitest)     | `pnpm --filter api test:e2e` | Postgres running and migrated, `apps/api/.env`                                | `apps/api/test/`            |
| Web end to end (Playwright) | `pnpm --filter web test:e2e` | Postgres, the running web app and API (`pnpm dev`), `apps/web/.env`, Chromium | `apps/web/e2e/`             |

- **Unit tests** cover pure logic such as password hashing. They need no
  database or server.
- **API end-to-end tests** boot `AppModule` inside the test process and send
  HTTP requests with Supertest, so the API server does not need to run. They
  use the real database from `apps/api/.env` and cover registration, login,
  validation and the meetings routes.
- **Web end-to-end tests** open Chromium against the app at `E2E_BASE_URL` and
  create their users through the API at `API_URL`. They cover registration,
  login, the protected home page and signing out. They start no server
  themselves.

### First run

1. Prepare the database as described in [Database](#database).
2. Copy `apps/web/.env.example` to `apps/web/.env`.
3. Install the browser once: `pnpm --filter web exec playwright install chromium`.
4. Start both apps with `pnpm dev` before running the web suite.

### Running part of a suite

| Goal                                 | Command                                        |
| ------------------------------------ | ---------------------------------------------- |
| Unit tests whose file name matches   | `pnpm --filter api test password`              |
| Unit tests in watch mode             | `pnpm --filter api test:watch`                 |
| API test files whose name matches    | `pnpm --filter api test:e2e auth`              |
| One Playwright file                  | `pnpm --filter web test:e2e e2e/login.spec.ts` |
| Playwright tests whose title matches | `pnpm --filter web test:e2e -g "signing out"`  |

### Good to know

- Every test registers its own user with a random email, so the suites need
  no cleanup and can run repeatedly. Those users stay in the database.
- When a Playwright test fails, its trace is saved under
  `apps/web/test-results/`. Open it with
  `pnpm --filter web exec playwright show-trace <path to trace.zip>`.
- After installing or removing a dependency, restart `pnpm dev` before
  running the web suite; a dev server started earlier can keep stale module
  paths and fail.
- Before reporting a change as complete, run `pnpm lint`, `pnpm typecheck`
  and `pnpm test`, plus the end-to-end suite of each app you changed.
