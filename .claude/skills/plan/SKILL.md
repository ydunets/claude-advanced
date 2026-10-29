---
name: plan
description: Breaks a PRD into independent implementation phases with checkable done criteria. Use when a PRD is ready and a development plan is needed, before any code is written.
argument-hint: "<PRD path or feature name>"
---

# Plan

Read a PRD and turn it into a plan of independent phases. Each phase runs in its own session with a clean context and ends with working, verified code, so the work can stop after any phase without losing what is done.

## Usage

```
/plan $ARGUMENTS
```

`$ARGUMENTS` is a path to a PRD or a feature name. A feature name resolves to `documents/prds/<feature-name-in-kebab-case>.md`. If no PRD matches, list the files in `documents/prds/` and ask which one to plan.

## Why phases

One large plan does not fit in the context window, cannot be rolled back in parts, makes the agent lose focus halfway through, and hides what is already done. Phases fix all four: each phase is small enough for one clean session, has a stopping point with working code, and records its own status.

## Workflow

### 1. Read the PRD carefully

Read the whole PRD, not only its scope. Note every Must and Should item, every user scenario, every technical constraint, every acceptance criterion and every open question.

### 2. Learn the codebase

Read the root `CLAUDE.md`, the `CLAUDE.md` of each app the feature touches, and the modules it extends. For every task you will write, find the existing code it should follow or reuse (a module with the same layout, a helper, a test suite). The plan names these files so each phase session reads them first instead of reinventing them.

### 3. Ask before writing if the PRD is incomplete

The PRD is incomplete when a task cannot be written without a decision it does not contain: a missing value (a limit, a list of allowed formats), an ambiguous scenario, or a criterion that cannot be checked. An open question in the PRD is blocking for the plan when a task depends on its answer.

Ask the user these questions before creating the plan, the most important first. Record the answers in the PRD itself (move the question out of Open Questions into the section it belongs to) so the PRD stays the source of truth, then plan. Never invent the answer.

### 4. Split the work into phases

Apply the planning rules below. Start from the Tracer Bullet, then add phases that each deepen one layer.

### 5. Write the plan and self-review it

Follow the plan structure below, then run the self-review checklist and fix every finding in place.

### 6. Save the file

- Save the plan in `documents/plans/` at the repository root, creating the directory if it does not exist.
- Use the PRD's file name, so the plan and its PRD pair by name: `documents/prds/meeting-file-upload.md` becomes `documents/plans/meeting-file-upload.md`.
- When the plan is revised later, update the same file. Keep every `**Milestone:**` and `Issue:` line the `issues` skill wrote, and append new tasks at the end of their phase instead of renumbering, so the GitHub backlog stays linked.
- After saving, give the user the file path, suggest `/issues <plan path>` to turn the phases into a GitHub backlog, and tell them to run each phase in a fresh session, for example: "Implement Phase 1 of `documents/plans/meeting-file-upload.md`".

## Planning Rules

- **Every phase leaves working code.** A phase is not finished while anything is broken: the build, an existing test, or a page that worked before.
- **Phases are independent.** The work can stop after any phase and keep everything delivered so far. A later phase builds on an earlier one but never breaks it.
- **Phase 1 is a Tracer Bullet.** It is the thinnest path through every layer the feature touches, for example button, file to the server, stored record, status shown to the user. It handles only the main scenario, with no validation, edge cases or polish. Later phases add those: format validation, UI states, progress, error paths.
- **Backend and frontend go in separate phases, API first.** The Tracer Bullet is the one exception: it crosses all layers in one phase, because its purpose is to prove the path end to end. From Phase 2 on, a phase touches either the backend or the frontend, and an API change lands one phase before the UI that uses it.
- **Tests come first (TDD).** Every phase starts red: its session writes the tests named in its tasks' "Proved by" lines, watches each one fail, and records that red run in the plan before writing production code. The plan carries the full procedure in its Test-First Workflow section (see the template), and each phase names its red run commands and the failure each new test is expected to show.
- **At most five tasks per phase.** If a phase needs more, split it. Writing the tests first is a phase field, not a task, so it does not count toward the five.
- **Cover every PRD acceptance criterion.** Each criterion is assigned to exactly one phase, the phase that makes it pass.
- **Add nothing the PRD does not require.** A task must serve a PRD requirement. Work the project's conventions demand for that requirement is allowed and expected: a database migration, a new environment variable with its `.env.example` entry, the documentation updates listed in the root `CLAUDE.md` "Documentation maintenance" section. New features, refactors of unrelated code and "while we are here" improvements are not.

## Plan Structure

````markdown
# <Feature name>: Implementation Plan

**PRD:** [<PRD title>](../prds/<file-name>.md)
**Date:** <today's date, YYYY-MM-DD>

## Global Constraints

- <each PRD technical constraint, copied with its exact values>

## Criteria Coverage

| PRD acceptance criterion (short form) | Phase |
| --- | --- |
| <criterion> | <N> |

## Test-First Workflow

Every phase follows red, green, refactor. Its session works in this order:

1. **Red.** Before any production code, write every test named in the phase's "Proved by" lines and run the commands under "Tests first". Each new test must fail on an assertion for the reason given there (a missing route, a 404, a missing element), not on a setup error such as a stopped server or a missing env value. Record the result under the phase's "Red run": the date, the commands, and each new test with its failure reason.
2. **Green.** Implement the tasks until every new test passes and every existing test still passes.
3. **Refactor.** Clean up with the suites green, then run the phase's "Done when" checks.

Rules for every phase:

- A new test that already passes in the red run proves nothing yet. Record it as "green before implementation" with the reason (usually that an earlier phase already delivers the behaviour), make it fail once by reverting the behaviour it covers locally, record that failure, and restore the code.
- Tests drive the apps through HTTP and the browser only, so they import no production code that does not exist yet. A unit test of a new module is the exception, and its expected red is the missing module.
- Red tests are not committed on their own: the pre-commit hook runs both e2e suites and blocks a failing commit. The phase is committed once green, and its "Red run" record is the evidence that each test failed first.
- A web red run needs the same stack as a green run: a migrated database and a running `pnpm dev`.

---

## Phase 1: <name> (Tracer Bullet)

**Status:** pending
**Goal:** <what works after this phase, stated as an observable result>
**Touches:** <backend / frontend / database / documentation>
**Read first:** `<existing file to follow or reuse>`, `<...>`
**Tests first:** `<filtered test command per suite>`. Expected red: <the failure each new test shows before implementation; tests expected green before implementation, with the reason>.
**Red run:** not yet run.

**Tasks:**

1. <What the task delivers.>
   Files: create `<path>`, modify `<path>`.
   Proved by: `<test file>`, "<test name or assertion>".
2. <...>

**Produces:** <names later phases rely on: endpoint and its response shape, exported function, route, table; names only, no code>

**Done when:**

- <the PRD acceptance criteria this phase makes pass, quoted in short form>
- The Red run lists every new test as red, or as green before implementation with its recorded forced failure.
- <the verification commands for the layers this phase touches pass>

## Phase 2: <name>

**Status:** pending
**Goal:** <...>
**Touches:** <...>
**Depends on:** Phase 1 (<the produced names it uses>)
**Read first:** <...>
**Tests first:** <...>
**Red run:** not yet run.

...
````

### Section guidance

**Global Constraints.** Copy the PRD's technical constraints with their exact values. Every phase must respect them, so a phase session reads them before its own tasks.

**Criteria Coverage.** One row per PRD acceptance criterion. A criterion without a phase is a gap in the plan; a phase whose Done when cites no criterion and adds no foundation another phase needs probably should not exist.

**Status.** `pending`, `in progress` or `done`. The session that implements a phase updates its status, so anyone can see what is finished.

**Goal.** What the phase gives, as a result someone can observe, for example "an owner can upload a file from the meeting page and see it listed". Not a list of files.

**Read first.** Existing files the phase session must read before writing code: the module whose layout it copies, the helper it reuses, the test suite it extends.

**Test-First Workflow.** Copy the section from the template into every plan unchanged, because a phase session reads only the plan. Adjust a rule only when the project differs, for example a project without e2e suites in its pre-commit hook.

**Tests first.** Give the filtered command of each suite that runs the tests named in the phase's "Proved by" lines (`pnpm --filter api test:e2e <file>`, `pnpm --filter web test:e2e <file>`, `pnpm --filter api test <file>`) and the failure each new test should show before implementation, derived from the code as it will stand after the previous phase. When a test will already pass, because an earlier phase or a missing route already produces the asserted behaviour (a 404 is the usual case), say so and name the reason, so the session applies the forced-failure rule instead of treating it as a surprise. Documentation tasks need no test.

**Red run.** Always `not yet run` in a new plan. The phase session replaces it with the date, the commands and each new test with its failure reason, before it writes production code. A later reviewer compares it with the green run to confirm that each test was written first and now passes.

**Tasks.** Each task is a unit a reviewer could accept or reject on its own. Name what it delivers, the files it creates or modifies, and the test that proves it. Fold setup, configuration and documentation into the task whose deliverable needs them. Do not write code bodies, step-by-step instructions or test code: the phase session makes those decisions while reading the code. Write a signature or a value only when the PRD fixes it or a later phase depends on it.

**Produces and Depends on.** Each phase runs in a clean session that knows only the plan. Produces lists the names later phases use; Depends on repeats those names in the phase that uses them. The names must match exactly across phases.

**Done when.** Only conditions that can be confirmed or refuted. Always include the PRD criteria the phase makes pass, the "Red run" condition from the template, and the checks from the root `CLAUDE.md` "Verification" section for the layers it touches: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and the `test:e2e` suite of each app the phase changes. A phase that changes a page also needs the visual check and design review that `apps/web/CLAUDE.md` requires. If the phase ends with a commit, the pre-commit hook runs these checks itself and needs a migrated database and a running `pnpm dev`.

## Self-Review

After writing the plan, reread the PRD and check the plan against it. Fix each finding in place.

1. **Coverage.** Every PRD acceptance criterion appears in the coverage table and in one phase's Done when.
2. **Nothing extra.** Every task traces to a PRD requirement or to a project convention that requirement triggers.
3. **Tracer Bullet.** Phase 1 reaches every layer the feature touches and handles only the main scenario.
4. **Layer split.** From Phase 2 on, no phase touches both backend and frontend.
5. **Size.** No phase has more than five tasks.
6. **Working state.** After each phase, the build, the existing tests and the existing pages still work.
7. **Names.** Every name in Depends on matches a name in an earlier phase's Produces.
8. **Test first.** The plan contains the Test-First Workflow section, every phase has Tests first and Red run fields, every "Proved by" test is run by the Tests first commands, and Done when requires the recorded Red run.
9. **Proportion.** The plan is shorter than the code it describes. If code blocks or step-by-step instructions appear, replace them with what the task delivers and the test that proves it.
