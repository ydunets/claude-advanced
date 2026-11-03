import path from 'node:path';

// Resolved from this file, so constants.ts must stay in .claude/hooks/.
export const CONFIG_PATH = path.join(
  import.meta.dirname,
  '..',
  'ralph-config.json',
);
export const LOG_PREFIX = 'Ralph Loop:';

export const PLACEHOLDERS = {
  MILESTONE: '{milestone}',
  BRANCH: '{branch}',
  ISSUE: '{issue}',
} as const;
export type Placeholder = (typeof PLACEHOLDERS)[keyof typeof PLACEHOLDERS];
// Kept out of PLACEHOLDERS: it belongs to "reviewPrompt", not to "prompt".
export const PULL_REQUEST_PLACEHOLDER = '{pullRequest}';
// Each issue session reviews its own commit; the milestone review weighs every
// issue together, so it runs on the strongest model.
export const REVIEW_MODEL = 'opus';

// `pnpm ralph --prompt <text> --max-turns <n>`: a flag wins over its config
// field, so a one-off run needs no edit to the tracked config.
export const CLI_OPTIONS = {
  PROMPT: 'prompt',
  MAX_TURNS: 'max-turns',
} as const;

export const COMMANDS = {
  CLAUDE: 'claude',
  GH: 'gh',
  GIT: 'git',
} as const;

// Opt-in: every Claude session in this project fires the Stop hook, so only a
// session started with RALPH_LOOP=1 runs the loop. Spawned sessions do not
// inherit it, so the root hook drives every session and nothing nests.
export const LOOP_ENV = 'RALPH_LOOP';
export const LOOP_ENABLED = '1';

export const LOCK_FILE = 'ralph-loop.lock';
// Counts issue sessions across runs; deleting it is the human's go-ahead to
// continue once the limit is reached.
export const ITERATION_FILE = 'ralph-iteration.json';
export const INITIAL_ITERATION = 0;
// One issue session is one iteration.
export const ITERATION_STEP = 1;

export const GIT_REMOTE = 'origin';

export const ISSUE_STATE = { OPEN: 'open', CLOSED: 'closed' } as const;
export type IssueState = (typeof ISSUE_STATE)[keyof typeof ISSUE_STATE];
export const ISSUE_OPEN_STATE = 'OPEN';
export const COMPLETED_REASON = 'COMPLETED';
// gh lists 30 issues by default, newest first.
export const ISSUE_LIST_LIMIT = '1000';

export const ERROR_CODES = {
  ALREADY_EXISTS: 'EEXIST',
  NOT_FOUND: 'ENOENT',
} as const;

// Claude Code parses the hook's stdout as a decision; a spawned session's
// output goes to stderr so its text can never block or steer the root session.
export const STDERR_FD = 2;
export const SUCCESS_EXIT_CODE = 0;
