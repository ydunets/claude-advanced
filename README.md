# video-meetings

pnpm workspace with two applications.

| App        | Stack   | Default port |
| ---------- | ------- | ------------ |
| `apps/web` | Next.js | 3000         |
| `apps/api` | NestJS  | 4000         |

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

Oxlint is configured in the root `.oxlintrc.json`; each app extends it.
