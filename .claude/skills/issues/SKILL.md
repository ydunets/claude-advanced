---
name: issues
description: GitHub issues and milestones from a plan file. Creates one milestone per phase and one issue per task with the GitHub CLI, then links them back into the plan. Use when a plan in documents/plans/ is ready and its phases should become a GitHub backlog that the team can assign, track and close from pull requests.
argument-hint: "<plan path or feature name> [--assignee <login>] [--project <title>] [--dry-run]"
---

# Issues

Turn the phases of a plan into a GitHub backlog: one milestone per phase, one issue per task. A Markdown plan is visible only in a local checkout and cannot show progress, owners or the pull requests that delivered a task; the backlog can. The chain becomes PRD, plan, issues, implementation, pull request, review, merge, and a pull request that names an issue with a closing keyword closes it.

## Usage

```
/issues $ARGUMENTS
```

`$ARGUMENTS` is a plan path or a feature name, optionally followed by `--assignee <login>`, `--project <title>` and `--dry-run`. A feature name resolves to `documents/plans/<feature-name-in-kebab-case>.md`. If no plan matches, list the files in `documents/plans/` and ask which one to use.

`--assignee <login>` assigns every issue this run creates to that GitHub user; `@me` means the account `gh` is logged in as. Issues that already exist keep their assignees. Without the flag, issues are created unassigned and the team assigns them on GitHub.

`--project <title>` adds every issue this run creates to that GitHub project, for example `--project "Video Meetings"` (`https://github.com/users/ydunets/projects/1`, linked to `ydunets/claude-advanced`). It needs the `project` token scope: when `gh auth status` does not list it, stop and ask the user to run `gh auth refresh -s project`, because granting a scope needs their browser approval.

`--dry-run` builds and shows everything, then stops: it calls no `gh` command that changes GitHub and leaves the plan file untouched.

## Workflow

### 1. Read the plan

Read the whole plan. Collect the feature name (the `# <Feature name>: Implementation Plan` heading), and for each phase its number, name, Status, Goal, Touches, Depends on, Tests first and Done when, plus every task with its text, Files and Proved by. A plan written by the `plan` skill has exactly these fields; if one is missing, note it in the preview rather than inventing it.

Skip a phase whose Status is `done`: its work is already delivered.

### 2. Resolve the repository

Run `gh repo view --json nameWithOwner,defaultBranchRef`. Without a GitHub remote it fails: stop with that message unless `--dry-run` is set, in which case use `<owner>/<repo>` placeholders and continue.

The issues link to the plan on the default branch, so check that it is there: run `git fetch origin <default branch>`, then `git cat-file -e origin/<default branch>:<plan path>`. A plan that is untracked, uncommitted or pushed only on a feature branch fails this check, and its links would return 404. Say so in the preview and let the user choose: push or merge the plan first, or link the current pushed branch instead, knowing those links break when the branch is deleted.

### 3. Build the backlog

Build every item before creating any of them.

**Milestone per phase.** Title: `<Feature name>, Phase <N>: <phase name>`, without the "(Tracer Bullet)" suffix. The feature prefix keeps titles unique, because milestone titles are unique per repository and every plan has a Phase 1. Description: the Goal, the Depends on line, and a link to the plan.

**Issue per task.** Title: `P<phase>.<task> <short imperative summary>`, at most 72 characters, for example `P1.2 Upload and list meeting files through the API`. The `P1.2` prefix is the task's stable ID. The plan's task sentence goes into the body unchanged. Body, in this order:

```markdown
<task text from the plan, unchanged>

**Files:** <Files line>
**Proved by:** <Proved by line>

## Phase context

**Phase:** [Phase <N>: <name>](<plan blob URL>) (milestone `<milestone title>`)
**Goal:** <phase Goal>
**Tests first:** <phase Tests first, unchanged>

Work test first, as the plan's "Test-First Workflow" section describes: write the tests named above, record them red in the phase's "Red run", then implement. The phase is complete when its "Done when" list in the plan holds.

Close this issue from the pull request that delivers it: write `Closes #` followed by this issue's number in the pull request description.
```

The plan blob URL is `https://github.com/<owner>/<repo>/blob/<default branch>/<plan path>`; in the Phase line, append the phase heading's GitHub anchor (lowercase, punctuation dropped, spaces as hyphens, for example `#phase-1-upload-and-list-a-file-on-the-meeting-page-tracer-bullet`). A phase session reads the plan for Read first and Done when, so the body links to them instead of copying them.

**Labels per issue.** A documentation task (its text starts with `Documentation:`) takes `documentation` only. Any other task takes a layer label for each path in its Files line, where the first matching row wins, keeping only layers the phase's Touches field lists:

| Path | Label |
| --- | --- |
| any `*.md` file | `documentation` |
| `apps/api/drizzle/`, `apps/api/src/database/` | `database` |
| any other `apps/api/` path | `backend` |
| `apps/web/` | `frontend` |

A task whose Files name no matching path (a bare file name, a root config file) takes the phase's Touches layers other than `documentation`.

### 4. Show the preview

Show the repository, the assignee (or "unassigned") and the project (or "no project"), then each milestone title with its issue titles and labels beneath, the labels that will be created, any warning from step 2, and one complete issue body as a sample. Write every body to a file in the scratchpad directory (`issue-P1.2.md`) so the user can open any of them.

With `--dry-run`, stop here and report the scratchpad path.

Otherwise ask the user once to confirm creation, naming the number of milestones and issues. Deleting an issue requires admin rights on the repository, so a wrong backlog is expensive to undo.

### 5. Create the backlog

Work phase by phase, in plan order, so issue numbers follow the plan.

1. **Labels.** Read `gh label list --json name --limit 200` and create only the missing layer labels with `gh label create <name> --description "<layer> work"`. Existing labels keep their colour and description.
2. **Milestone.** Reuse it when the phase has a `**Milestone:**` line, or when a milestone with the same title appears in `gh api 'repos/{owner}/{repo}/milestones?state=all' --paginate`. Keep that URL quoted and without `-f`/`-F` flags, because a parameter flag turns `gh api` into a POST that creates a milestone. Otherwise create it with `gh api 'repos/{owner}/{repo}/milestones' -f title='<title>' -F description=@<description file> --jq '.number, .html_url'`.
3. **Issues.** A task with an `Issue:` line already has its issue; skip it. That line is the only reliable key, because the `P1.2` prefix is a position and changes when a revision inserts a task. For a task without the line, check `gh issue list --milestone '<milestone title>' --state all --json number,title --limit 200` for an issue left by a run that stopped halfway: reuse one only when both its ID prefix and its summary match the task, and ask the user when only the prefix matches. Otherwise create the issue with `gh issue create --title '<title>' --body-file <body file> --milestone '<milestone title>' --label <labels>`, adding `--assignee <login>` and `--project '<title>'` when those flags were given; the command prints the issue URL, whose last segment is the number.
4. **Write back** each number as soon as its milestone or issue exists, so a run that stops halfway leaves the plan in step with GitHub.

Pass every body and description through a file. Plan text is full of backticks, and inside a double-quoted argument the shell runs them as commands. Titles go in single quotes, so write an apostrophe inside one as `'\''` (`'another user'\''s meeting'`).

### 6. Write back to the plan

Use exactly this format, because the next run reads it to skip existing items:

- After the phase's `**Status:**` line: `**Milestone:** [<milestone title>](<milestone URL>)`
- After each task's `Proved by:` line, at the same indentation: `Issue: [#<number>](<issue URL>)`

Change nothing else in the plan.

### 7. Report

Report the milestone URLs, the number of issues created and reused, the assignee of the new issues, the project they were added to, the labels created, and that the plan now links to them. Remind the user to commit the updated plan, and that a phase session can now start from its milestone: "Implement Phase 1 of `documents/plans/<file>.md`".

## Rules

- **The plan stays the source of truth.** Issues carry a task and its phase context; they never redefine scope. When the plan changes, update the plan and rerun the skill, which creates only what is missing. A revision keeps every `**Milestone:**` and `Issue:` line and appends new tasks at the end of their phase, so existing tasks keep their numbers and links.
- **One issue per task.** Tests first is a phase field, so it appears in every task issue of the phase instead of becoming an issue of its own. Documentation tasks get issues like any other task.
- **Done means every phase that is not `done` has a milestone, every one of its tasks has an issue, and the plan holds a link for each.**
