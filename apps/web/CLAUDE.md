# apps/web

Next.js 16 frontend using the App Router, the `src/` directory, Tailwind CSS and the React Compiler. The import alias `@/*` maps to `src/*`.

@AGENTS.md

## Commands

Run from the repository root with `pnpm --filter web <script>`, or from this directory.

- `dev`: start the dev server on port 3000.
- `build` and `start`: production build and server.
- `lint`: Oxlint with the React, Next.js and accessibility plugins (`.oxlintrc.json` extends the root config).
- `typecheck`: runs `next typegen` first, because globals such as `LayoutProps` and `PageProps` only exist after route types are generated.

## Conventions

- Pages and layouts live in `src/app`. Prefer Server Components; add `"use client"` only where interactivity requires it.
- Next.js documentation for the pinned version is in `node_modules/next/dist/docs/`. Read it before using an API that may have changed.
- Cache Components is enabled in `next.config.ts`; follow its caching model instead of legacy `fetch` caching options.
- Keep the API base URL in an environment variable (for example `NEXT_PUBLIC_API_URL`) and document it in `.env.example`. The API listens on port 4000 by default.
- Do not add ESLint or its configuration files; linting is handled by Oxlint at the root.
- When a change alters this app's architecture (routing structure, data fetching, API integration, scripts or environment variables), update this file and the root `README.md` and `CLAUDE.md` as described in the root "Documentation maintenance" section.
