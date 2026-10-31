// Ralph Loop: when the loop's root session stops, run one headless Claude
// session per open issue of the milestone, then open the pull request.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const CONFIG_PATH = path.join(import.meta.dirname, '..', 'ralph-config.json');
const PLACEHOLDERS = {
  MILESTONE: '{milestone}',
  BRANCH: '{branch}',
  ISSUE: '{issue}',
};
// Opt-in: every Claude session in this project fires the Stop hook, so only a
// session started with RALPH_LOOP=1 runs the loop. Spawned sessions do not
// inherit it, so the root hook drives every session and nothing nests.
const LOOP_ENV = 'RALPH_LOOP';
const LOOP_ENABLED = '1';
const LOCK_FILE = 'ralph-loop.lock';
const GIT_REMOTE = 'origin';
const ISSUE_STATE = { OPEN: 'open', CLOSED: 'closed' };
const ISSUE_OPEN_STATE = 'OPEN';
const COMPLETED_REASON = 'COMPLETED';
// gh lists 30 issues by default, newest first.
const ISSUE_LIST_LIMIT = '1000';
const ALREADY_EXISTS_CODE = 'EEXIST';
// Claude Code parses the hook's stdout as a decision; a spawned session's
// output goes to stderr so its text can never block or steer the root session.
const STDERR_FD = 2;
const CONFIG_FIELDS = ['milestone', 'branch', 'prompt'];
const BUDGET_FIELD = 'maxBudgetUsd';

function readStopEvent() {
  const input = readFileSync(0, 'utf8');
  return input ? JSON.parse(input) : {};
}

function readConfig() {
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  const invalidField = CONFIG_FIELDS.find(
    (field) => typeof config[field] !== 'string' || !config[field],
  );
  if (invalidField) {
    throw new Error(
      `${CONFIG_PATH}: "${invalidField}" must be a non-empty string`,
    );
  }
  const missingPlaceholder = Object.values(PLACEHOLDERS).find(
    (placeholder) => !config.prompt.includes(placeholder),
  );
  if (missingPlaceholder) {
    throw new Error(
      `${CONFIG_PATH}: "prompt" must contain ${missingPlaceholder}`,
    );
  }
  const maxBudgetUsd = config[BUDGET_FIELD];
  if (!Number.isFinite(maxBudgetUsd) || maxBudgetUsd <= 0) {
    throw new Error(
      `${CONFIG_PATH}: "${BUDGET_FIELD}" must be a positive number`,
    );
  }
  return config;
}

function runCommand(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
}

function runJsonCommand(command, args) {
  return JSON.parse(runCommand(command, args));
}

function listMilestoneIssues(milestone, state) {
  return runJsonCommand('gh', [
    'issue',
    'list',
    `--milestone=${milestone}`,
    `--state=${state}`,
    `--limit=${ISSUE_LIST_LIMIT}`,
    '--json=number,title,stateReason',
  ]).toSorted((first, second) => first.number - second.number);
}

function isIssueOpen(issueNumber) {
  const issue = runJsonCommand('gh', [
    'issue',
    'view',
    String(issueNumber),
    '--json=state',
  ]);
  return issue.state === ISSUE_OPEN_STATE;
}

function isOnBranch(branch) {
  return runCommand('git', ['branch', '--show-current']) === branch;
}

// Untracked files are ignored: they never reach a commit unless added.
function isWorkingTreeClean() {
  return (
    runCommand('git', ['status', '--porcelain', '--untracked-files=no']) === ''
  );
}

// Any pull request, merged or closed included, means the milestone shipped.
function hasPullRequest(branch) {
  return (
    runJsonCommand('gh', [
      'pr',
      'list',
      `--head=${branch}`,
      '--state=all',
      '--json=number',
    ]).length > 0
  );
}

function getLockPath() {
  return runCommand('git', [
    'rev-parse',
    '--path-format=absolute',
    '--git-path',
    LOCK_FILE,
  ]);
}

// The exclusive create is atomic, so two loops never both acquire the lock.
function acquireLock(lockPath) {
  try {
    writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
    return true;
  } catch (error) {
    if (error.code === ALREADY_EXISTS_CODE) {
      return false;
    }
    throw error;
  }
}

function buildSessionPrompt({ prompt, milestone, branch }, issueNumber) {
  return prompt
    .replaceAll(PLACEHOLDERS.MILESTONE, milestone)
    .replaceAll(PLACEHOLDERS.BRANCH, branch)
    .replaceAll(PLACEHOLDERS.ISSUE, String(issueNumber));
}

function runIssueSession(issue, config) {
  console.error(
    `Ralph Loop: starting a session for #${issue.number} ${issue.title}`,
  );
  const { [LOOP_ENV]: _loopFlag, ...sessionEnv } = process.env;
  const session = spawnSync(
    'claude',
    // A session that hits the cap ends with its issue open, which stops the loop.
    [
      '-p',
      buildSessionPrompt(config, issue.number),
      '--max-budget-usd',
      String(config.maxBudgetUsd),
    ],
    { stdio: ['ignore', STDERR_FD, STDERR_FD], env: sessionEnv },
  );
  if (session.error) {
    throw session.error;
  }
  if (session.status !== 0) {
    console.error(
      `Ralph Loop: the session for #${issue.number} exited with ${session.status}.`,
    );
  }
}

// Issue titles stay out of the body: a title such as "closes #12" would close
// an unrelated issue on merge.
function buildPullRequestBody(milestone, issues) {
  return [
    `All issues of the milestone "${milestone}" are closed.`,
    '',
    ...issues.map((issue) => `Closes #${issue.number}`),
  ].join('\n');
}

function openPullRequest({ milestone, branch }) {
  if (hasPullRequest(branch)) {
    console.error(`Ralph Loop: ${branch} already has a pull request.`);
    return;
  }
  const completedIssues = listMilestoneIssues(
    milestone,
    ISSUE_STATE.CLOSED,
  ).filter((issue) => issue.stateReason === COMPLETED_REASON);
  runCommand('git', ['push', '--set-upstream', GIT_REMOTE, branch]);
  const pullRequestUrl = runCommand('gh', [
    'pr',
    'create',
    `--head=${branch}`,
    `--title=${milestone}`,
    `--body=${buildPullRequestBody(milestone, completedIssues)}`,
  ]);
  console.error(`Ralph Loop: opened ${pullRequestUrl}`);
}

// Each pass re-checks the branch and the tree, because a session may have
// switched branches or left changes that the next session would commit.
function runLoop(config) {
  for (;;) {
    if (!isOnBranch(config.branch)) {
      console.error(`Ralph Loop: not on ${config.branch}; stopping.`);
      return;
    }
    if (!isWorkingTreeClean()) {
      console.error(
        'Ralph Loop: tracked files have uncommitted changes; stopping.',
      );
      return;
    }
    const [nextIssue] = listMilestoneIssues(config.milestone, ISSUE_STATE.OPEN);
    if (!nextIssue) {
      openPullRequest(config);
      return;
    }
    runIssueSession(nextIssue, config);
    if (isIssueOpen(nextIssue.number)) {
      console.error(
        `Ralph Loop: #${nextIssue.number} is still open after its session; stopping.`,
      );
      return;
    }
  }
}

function runStopHook() {
  if (
    process.env[LOOP_ENV] !== LOOP_ENABLED ||
    readStopEvent().stop_hook_active
  ) {
    return;
  }
  const config = readConfig();
  const lockPath = getLockPath();
  if (!acquireLock(lockPath)) {
    console.error(
      `Ralph Loop: another loop holds ${lockPath}; delete it if no loop is running.`,
    );
    return;
  }
  try {
    runLoop(config);
  } finally {
    unlinkSync(lockPath);
  }
}

runStopHook();
