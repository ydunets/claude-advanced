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

## Configuration

All configuration lives in two git-ignored env files; neither the code nor
`compose.yaml` carries default values, and a missing variable stops startup.

| File            | Read by                                                 | Variables                                                            |
| --------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| `.env`          | Docker Compose                                          | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` |
| `apps/api/.env` | The API (`@nestjs/config`) and `drizzle-kit` (`dotenv`) | `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN_SECONDS`       |

Create both from their `.env.example` and keep `DATABASE_URL` consistent with
the Postgres values.

## Database

`compose.yaml` runs Postgres 17 with a named volume (`postgres-data`). It
requires Docker with Compose v2. The API accesses Postgres through Drizzle ORM.
To prepare a fresh database:

1. Copy `.env.example` to `.env` and `apps/api/.env.example` to
   `apps/api/.env`, then set `JWT_SECRET`.
2. Run `pnpm db:up`, then `pnpm --filter api db:migrate`.
3. Run `pnpm --filter api test:e2e` to exercise the API end to end.
