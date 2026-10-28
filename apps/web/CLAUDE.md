# apps/web

Next.js 16 frontend using the App Router, the `src/` directory, Tailwind CSS 4, HeroUI v3 (`@heroui/react`, `@heroui/styles`) and the React Compiler. The import alias `@/*` maps to `src/*`.

@AGENTS.md

## Commands

Run from the repository root with `pnpm --filter web <script>`, or from this directory.

- `dev`: start the dev server on port 3000.
- `build` and `start`: production build and server.
- `lint`: Oxlint with the React, Next.js and accessibility plugins (`.oxlintrc.json` extends the root config).
- `typecheck`: runs `next typegen` first, because globals such as `LayoutProps` and `PageProps` only exist after route types are generated.
- `test:e2e`: Playwright suite in `e2e/` (`playwright.config.ts`). It drives the already running app at `E2E_BASE_URL` and creates its own users through the API at `API_URL`, both read from `.env`; it starts no server. Run `pnpm --filter web exec playwright install chromium` once after installing.

## Conventions

- Pages and layouts live in `src/app`. Prefer Server Components; add `"use client"` only where interactivity requires it.
- Next.js documentation for the pinned version is in `node_modules/next/dist/docs/`. Read it before using an API that may have changed.
- Cache Components is enabled in `next.config.ts`; follow its caching model instead of legacy `fetch` caching options.
- The API base URL comes from `API_URL` in `apps/web/.env` (template: `.env.example`, which `.gitignore` re-includes). The browser never calls the API directly, because the API does not enable CORS: Server Actions call it from the server, so the variable has no `NEXT_PUBLIC_` prefix.
- `src/app/(auth)/` holds `/register` and `/login`. Both render `CredentialsForm` inside `AuthCard`, and their Server Actions (`registerUser`, `logInUser`) go through `submitCredentials`, which posts to the API, stores the JWT in the httpOnly `accessToken` cookie (`src/lib/session.ts`) and redirects to `/`. A 409 on register is an email field error; a 401 on login is one form alert for both unknown email and wrong password.
- `/` (`src/app/page.tsx`) is protected twice: `src/proxy.ts` redirects to `/login` when the cookie is missing, and the page redirects when the API rejects the token. It reads the email from the token payload (display only) and the meetings from `GET /meetings`. `signOut` deletes the cookie.
- Route paths, API endpoints and HTTP statuses live in `src/lib/routes.ts` and `src/lib/api.ts`. The proxy `matcher` is the one exception: Next.js reads it statically and ignores variables.
- After changing a page, run `pnpm --filter web test:e2e` and look at Playwright screenshots of the page at phone, tablet and desktop widths before reporting it as done.
- After installing or removing a dependency, restart `pnpm dev`: pnpm may move `next` to a new directory, and a running dev server then fails with "Could not find the module ... in the React Client Manifest".
- Do not add ESLint or its configuration files; linting is handled by Oxlint at the root.
- Build UI from HeroUI v3 components. v3 needs no provider and uses compound components (`<Card><Card.Header>`), semantic variants (`primary`, `secondary`, `danger`) and `onPress` instead of `onClick`. Do not apply HeroUI v2 patterns (`HeroUIProvider`, `framer-motion`, `@heroui/theme`). Fetch the component docs with the `heroui-react` skill before using a component.
- `src/app/globals.css` must import `tailwindcss` before `@heroui/styles`. Tailwind runs through the `@tailwindcss/turbopack` loader configured in `next.config.ts`.
- After every UI change, complete both steps below. Do not report a UI change as complete until both pass.
  1. Visual check through the Playwright MCP: run the dev server, open each affected page with `browser_navigate`, capture it with `browser_take_screenshot` at mobile and desktop widths (`browser_resize`), exercise its interaction states (validation errors, loading, focus), and confirm `browser_console_messages` shows no errors.
  2. Design review: review the screenshots with the `ui-ux-pro-max` skill (layout, responsiveness, accessibility, interaction states) and resolve every issue it finds.
- After installing or upgrading a package that ships CSS, delete `.next` and restart the dev server: Turbopack's cache can keep serving the previous stylesheet.
- When a change alters this app's architecture (routing structure, data fetching, API integration, scripts or environment variables), update this file and the root `README.md` and `CLAUDE.md` as described in the root "Documentation maintenance" section.
