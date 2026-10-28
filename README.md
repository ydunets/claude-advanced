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

## Database

`compose.yaml` runs Postgres 17 on port 5432 with a named volume
(`postgres-data`). It requires Docker with Compose v2. Override the defaults by
copying `.env.example` to `.env`.

The API accesses Postgres through Drizzle ORM. To prepare a fresh database:

1. Copy `apps/api/.env.example` to `apps/api/.env` and set `JWT_SECRET`.
2. Run `pnpm db:up`, then `pnpm --filter api db:migrate`.
3. Run `pnpm --filter api test:e2e` to exercise the auth endpoints.
