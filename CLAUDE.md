# video-meetings

A pnpm workspace containing two applications. At this stage only the project structure exists; no product features have been implemented.

| Path       | Stack                                 | Default port |
| ---------- | ------------------------------------- | ------------ |
| `apps/web` | Next.js 16 (App Router), Tailwind CSS | 3000         |
| `apps/api` | NestJS 12, Vitest                     | 4000         |

## Commands

Run every command from the repository root.

- `pnpm install`: install dependencies for the whole workspace (a single root lockfile).
- `pnpm dev`, `pnpm dev:web`, `pnpm dev:api`: start both apps, or one of them.
- `pnpm build`: build both apps.
- `pnpm lint`: run Oxlint once over the repository (type-aware). `pnpm lint:fix` applies autofixes.
- `pnpm typecheck`: run the TypeScript compiler in each app.
- `pnpm test`: run the unit tests.
- `pnpm format` and `pnpm format:check`: Oxfmt.

## Conventions

- Shared tooling (Oxlint, Oxfmt, TypeScript) is installed only at the root. Do not add these packages to an app.
- Oxlint is configured in the root `.oxlintrc.json`; each app extends it with its own `.oxlintrc.json`. ESLint is not used.
- Oxfmt settings live in the root `.oxfmtrc.json` (single quotes, trailing commas, 80 columns). Prettier is not used.
- A Claude Code `PostToolUse` hook in `.claude/settings.json` runs Oxfmt on every file Claude edits or writes.
- Add a dependency to the app that needs it with `pnpm --filter <web|api> add <package>`.
- Build outputs (`dist`, `.next`) and `.env*` files are ignored by git. Provide `.env.example` for any new variable.
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

Before reporting a change as complete, run `pnpm lint`, `pnpm typecheck` and `pnpm test`, plus `pnpm build` when configuration or dependencies changed.
