---
name: prd
description: Creates a PRD (product requirements document) for a feature using the project's standard structure. Use when the requirements of a new feature must be described before implementation starts.
argument-hint: "<feature name or description>"
---

# PRD

Turn a feature name or description into a product requirements document that states what the feature must do and why, before anyone implements it.

## Usage

```
/prd $ARGUMENTS
```

`$ARGUMENTS` is the feature name or a free-form description of it.

## Workflow

### 1. Learn the context from the codebase

Before asking the user anything, read the root `README.md` and `CLAUDE.md`, the `CLAUDE.md` of each app the feature touches, and the modules it extends. Answer from them every question the code can answer: which users and roles exist, which features already exist, how authentication works, where data is stored. Ask the user only about what the code cannot tell you.

### 2. Check that the description is complete

Decide whether the description, together with what you learned from the code, answers each of these questions:

- Who is the user, and what do they need?
- What does the user do, and what result do they get?
- What belongs to this iteration, and what explicitly does not?
- Which technical constraints are already known?
- How will we check that the feature is done?

Sort every gap into one of two kinds:

- **Blocking**: the answer changes the scope, a scenario or an acceptance criterion. Ask the user these questions **before creating the file**, the most important first and a few at a time. Do not write the document until they are answered.
- **Non-blocking**: the answer refines a detail but does not change what is built. Do not delay the draft for these; record them under Open Questions.

Never fill a gap with an invented requirement.

If the feature is too large for one iteration, propose splitting it into phases, agree on the split with the user, and write the PRD for the first phase only. List the later phases under Out of scope.

### 3. Write the document

Follow the structure below in this order. Include Success Metrics only when the user provided a measurable outcome; otherwise omit the section entirely. Add no other sections.

### 4. Save the file

- Save the PRD in `documents/prds/` at the repository root. Create the directory if it does not exist.
- Name the file after the feature, translated into English and written in kebab-case, for example `documents/prds/file-upload.md` for «Загрузка файлов».
- When the PRD is revised later, update the same file instead of creating a new one.
- After saving, give the user the file path.

## PRD Structure

```markdown
# <Feature name>

**Date:** <today's date, YYYY-MM-DD>
**Status:** draft

## Goal

<1–2 sentences: what the user needs and why.>

## User Scenarios

1. **User:** <who acts>
   **Action:** <what they do>
   **Result:** <what happens as a result>

## Scope

### In scope

- **Must:** <a concrete item without which the feature does not solve the problem>
- **Should:** <a concrete item that improves the feature but can be cut if time runs out>

### Out of scope

- <a concrete item not delivered in this iteration, with a short reason>

## Technical Constraints

- <a known constraint the implementation must respect>

## Acceptance Criteria

- **Given** <precondition> **when** <user action> **then** <observable outcome>
- [ ] <a concrete statement that can be confirmed or refuted>

## Success Metrics

- <metric, target value, how and when it is measured>

## Open Questions

- <a non-blocking question> (owner: <who answers it>)
```

### Section guidance

**Title and metadata.** Use the feature name as the title, today's date, and the status `draft`. A new PRD always starts as a draft.

**Goal.** One or two sentences that describe the value for the user, not the way it is built. "Users can attach a file to a meeting so that participants see the materials in one place" is a goal; "add an upload endpoint" is not.

**User Scenarios.** Write each scenario as User, Action, Result. Name a specific user type, describe what they do in product terms, and state the observable outcome. Example: a user opens the file upload section, selects a file, and the file is uploaded and shown in the interface. Cover the main path first, then error and edge cases (an invalid file, an empty state, a missing permission) as separate scenarios.

**Scope.** Both lists are mandatory, and each must be concrete. Mark every in-scope item **Must** or **Should**. An item is Must if, without it, the feature no longer solves the problem stated in the Goal; challenge every Must, because a short Must list ships sooner. "Out of scope" protects the feature from uncontrolled growth, so list the adjacent work that someone could reasonably expect but that this iteration does not deliver, with the reason. Example: we do not build our own storage service; files are stored on disk.

**Technical Constraints.** List only the constraints that are already known and that limit the solution, for example deployment on a server with limited resources, a maximum file size, or a dependency on a feature that is not built yet. Write "None known" when there are none; do not invent constraints.

**Acceptance Criteria.** Each criterion is a single statement that a reviewer can confirm or refute by checking the product. Every Must item and every scenario needs at least one criterion. Use Given/When/Then for behaviour that follows a user action, because it maps directly onto an end-to-end test; use a checklist item for a static fact. Include negative criteria (what must not happen) where they matter.

- Checkable: "**Given** a signed-in user **when** they upload a file larger than 10 MB **then** the upload is rejected with an error message that states the limit."
- Not checkable: "Upload is fast and reliable under load."

**Success Metrics.** Optional. Include a metric only when the user named a measurable outcome, and state the target, the measurement method and when it is evaluated, for example "80% of meetings created in the first month have at least one attached file, measured from the database at 30 days". Never invent a target.

**Open Questions.** Only non-blocking questions, each with the person or role who answers it. Do not list a question the codebase or the user's description already answers. Write "None" when there are none.

## Rules

- **Be concrete, no filler.** Every sentence must carry a requirement, a fact or a decision. Remove introductions, restatements and generic statements that would fit any feature.
- **Describe what and why, never how.** Do not name endpoints, tables, components, libraries or algorithms. A technical fact belongs only in Technical Constraints, and only when it limits the solution.
- **Keep acceptance criteria checkable.** Replace vague words such as "fast", "convenient" or "reliable" with a measurable condition, or ask the user for one.
- **Ask before writing, but only what the code cannot answer.** Resolve blocking gaps with the user before creating the file; record non-blocking ones under Open Questions.
- **Keep one iteration per document.** Split a large feature into phases and specify only the first.
