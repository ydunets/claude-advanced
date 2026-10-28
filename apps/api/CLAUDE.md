# apps/api

NestJS 12 backend written as native ES modules (`"type": "module"`, `module: nodenext`). Tests run on Vitest.

@AGENTS.md

## Commands

Run from the repository root with `pnpm --filter api <script>`, or from this directory.

- `start:dev`: start in watch mode on port 4000 (override with `PORT`).
- `build` and `start:prod`: compile to `dist/` and run the output.
- `lint`: Oxlint, type-aware (`.oxlintrc.json` extends the root config).
- `typecheck`: `tsc --noEmit`.
- `test`: unit tests (`src/**/*.spec.ts`). `test:e2e` runs the end-to-end suite in `test/`.

## Conventions

- Relative imports must include the `.js` extension (for example `./app.module.js`), as required by `nodenext`.
- Organize code by feature module (module, controller, service), each in its own folder under `src/`.
- Keep HTTP concerns in controllers and business logic in services. Validate input at the controller boundary.
- Read configuration from environment variables and document each one in `.env.example`.
- `typescript/no-floating-promises` is an error: every promise must be awaited or handled explicitly.
- Do not add Oxfmt, Oxlint or TypeScript to this package; they are provided by the root.
- When a change alters this app's architecture (modules, persistence, external services, scripts, ports or environment variables), update this file and the root `README.md` and `CLAUDE.md` as described in the root "Documentation maintenance" section.
