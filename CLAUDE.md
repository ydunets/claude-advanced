# video-meetings

A pnpm workspace containing two applications. The API implements email and password registration and login that issue JWTs, and a JWT protected meetings module (create, list, get by id; upload, list and download a meeting's files, stored on the API server's disk under `FILES_STORAGE_DIR`). It follows CQRS through `@nestjs/cqrs`, as described in `apps/api/CLAUDE.md`. The web app has `/register`, `/login`, a protected home page `/` and a protected meeting page `/meetings/[id]`; it calls the API from Server Actions, Server Components and Route Handlers (server to server, so the API needs no CORS) using `API_URL` from `apps/web/.env`. File uploads and downloads go through the Route Handlers `POST /meetings/[id]/files` and `GET /meetings/[id]/files/[fileId]`, which stream them to and from the API.

| Path       | Stack                                              | Default port |
| ---------- | -------------------------------------------------- | ------------ |
| `apps/web` | Next.js 16 (App Router), Tailwind CSS 4, HeroUI v3 | 3000         |
| `apps/api` | NestJS 12, Drizzle ORM, Vitest                     | 4000         |

## Commands

Run every command from the repository root.

- `pnpm install`: install dependencies for the whole workspace (a single root lockfile).
- `pnpm dev`, `pnpm dev:web`, `pnpm dev:api`: start both apps, or one of them.
- `pnpm build`: build both apps.
- `pnpm lint`: run Oxlint once over the repository (type-aware). `pnpm lint:fix` applies autofixes.
- `pnpm typecheck`: run the TypeScript compiler in each app.
- `pnpm test`: run the unit tests.
- `pnpm format` and `pnpm format:check`: Oxfmt.
- `pnpm db:up` and `pnpm db:down`: start (and wait for health) or stop the Postgres 17 container defined in `compose.yaml` (port 5432, volume `postgres-data`). Docker with Compose v2 is required. Container settings come from the root `.env` (template: `.env.example`); `compose.yaml` has no defaults and refuses to start without them.
- `pnpm --filter api db:migrate`: apply the Drizzle migrations in `apps/api/drizzle/`. `db:generate` creates a new migration after a schema change.
- `pnpm --filter api test:e2e`: run the API end-to-end suite. It needs a running, migrated database and `apps/api/.env`.
- `pnpm --filter web test:e2e`: run the web app's Playwright suite. It needs the running web app and API (`pnpm dev`), a migrated database, `apps/web/.env` and Chromium (`pnpm --filter web exec playwright install chromium`, once).
- Arguments after a test script filter it: `pnpm --filter api test:e2e auth` runs matching files, `pnpm --filter web test:e2e -g "signing out"` runs matching test titles. The root `README.md` "Tests" section describes each suite.

## Conventions

- Shared tooling (Oxlint, Oxfmt, TypeScript) is installed only at the root. Do not add these packages to an app.
- Oxlint is configured in the root `.oxlintrc.json`; each app extends it with its own `.oxlintrc.json`. ESLint is not used.
- Oxfmt settings live in the root `.oxfmtrc.json` (single quotes, trailing commas, 80 columns). Prettier is not used.
- A Husky `pre-commit` hook (`.husky/pre-commit`, installed by the root `prepare` script) runs `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm --filter api test:e2e` and `pnpm --filter web test:e2e`; a failing check blocks the commit, so committing needs a migrated database and a running `pnpm dev`; when Postgres is unreachable, the hook stops before the e2e suites and asks for `pnpm db:up`. A `pre-push` hook (`.husky/pre-push`) runs `pnpm lint`.
- A Claude Code `PostToolUse` hook in `.claude/settings.json` runs Oxfmt on every file Claude edits or writes.
- Add a dependency to the app that needs it with `pnpm --filter <web|api> add <package>`.
- Build outputs (`dist`, `.next`) and `.env*` files are ignored by git. Every configurable value lives in an env file, never as a default in code or `compose.yaml`; add each new variable to the matching `.env.example`.
- The two apps do not share code yet. Introduce a `packages/` workspace only when real shared code exists.

## Documentation maintenance

Documentation must be updated in the same change as the architecture it describes. The documents are the root `README.md`, this file, and the `CLAUDE.md` of the affected app.

Update them whenever a change:

- adds, removes or renames an app or a `packages/` workspace;
- changes a framework, a major dependency, or a shared tool (Oxlint, Oxfmt, TypeScript);
- alters a root or app script, a port, or an environment variable;
- introduces a new module boundary, data store, external service, or communication path between apps;
- modifies a convention recorded in these files.

Keep each statement accurate rather than exhaustive: correct or delete outdated lines instead of appending notes. State in the final report which documents were changed, or that none required a change.

## Verification

Before reporting a change as complete, run `pnpm lint`, `pnpm typecheck` and `pnpm test`, plus `pnpm build` when configuration or dependencies changed, and the `test:e2e` suite of each app the change touches.
