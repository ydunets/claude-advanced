// Ralph Loop: when the loop's root session stops, run one headless Claude
// session per open issue of the milestone, then open the pull request and run
// one headless review of the whole milestone on it.
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

import {
  COMMANDS,
  GIT_REMOTE,
  ISSUE_STATE,
  ITERATION_FILE,
  ITERATION_STEP,
  LOCK_FILE,
  LOOP_ENABLED,
  LOOP_ENV,
  REVIEW_MODEL,
  STDERR_FD,
  SUCCESS_EXIT_CODE,
} from './constants.ts';
import {
  buildPullRequestBody,
  buildReviewPrompt,
  buildSessionPrompt,
  getGitStatePath,
  hasPullRequest,
  isIssueCompleted,
  isIssueOpen,
  isOnBranch,
  isReviewEnabled,
  isWorkingTreeClean,
  listMilestoneIssues,
  logRalph,
  readConfig,
  readIteration,
  readStopEvent,
  runGh,
  runGit,
  withLock,
  writeIteration,
} from './helpers.ts';
import type { Issue, RalphConfig, ReviewConfig } from './helpers.ts';

// Each pass of the loop ends in exactly one of these outcomes.
type LoopStep =
  | { kind: 'next' }
  | { kind: 'done' }
  | { kind: 'stop'; reason: string };

// A guard returns the reason to stop, or undefined to let the pass go on.
type Guard = (config: RalphConfig) => string | undefined;

// Each pass re-checks the branch and the tree, because a session may have
// switched branches or left changes that the next session would commit.
const PASS_GUARDS: Guard[] = [
  ({ branch }) =>
    isOnBranch(branch) ? undefined : `not on ${branch}; stopping.`,
  () =>
    isWorkingTreeClean()
      ? undefined
      : 'tracked files have uncommitted changes; stopping.',
];

function findStopReason(
  guards: Guard[],
  config: RalphConfig,
): string | undefined {
  for (const guard of guards) {
    const reason = guard(config);
    if (reason) {
      return reason;
    }
  }
  return undefined;
}

function runHeadlessSession(subject: string, args: string[]): void {
  const { [LOOP_ENV]: _loopFlag, ...sessionEnv } = process.env;
  const session = spawnSync(COMMANDS.CLAUDE, args, {
    stdio: ['ignore', STDERR_FD, STDERR_FD],
    env: sessionEnv,
  });
  if (session.error) {
    throw session.error;
  }
  if (session.status !== SUCCESS_EXIT_CODE) {
    logRalph(`the session for ${subject} exited with ${session.status}.`);
  }
}

function runIssueSession(issue: Issue, config: RalphConfig): void {
  logRalph(`starting a session for #${issue.number} ${issue.title}`);
  // A session that hits the cap ends with its issue open, which stops the loop.
  runHeadlessSession(`#${issue.number}`, [
    '-p',
    buildSessionPrompt(config, issue.number),
    '--max-turns',
    String(config.maxTurns),
  ]);
}

function runReviewSession(pullRequestUrl: string, config: ReviewConfig): void {
  logRalph(`starting the ${REVIEW_MODEL} review of ${pullRequestUrl}`);
  runHeadlessSession(pullRequestUrl, [
    '-p',
    buildReviewPrompt(config, pullRequestUrl),
    '--model',
    REVIEW_MODEL,
    '--max-turns',
    String(config.maxTurns),
  ]);
}

// Returns the new pull request's URL, or undefined when one already exists.
function openPullRequest({
  milestone,
  branch,
}: RalphConfig): string | undefined {
  if (hasPullRequest(branch)) {
    logRalph(`${branch} already has a pull request.`);
    return undefined;
  }
  const completedIssues = listMilestoneIssues(
    milestone,
    ISSUE_STATE.CLOSED,
  ).filter(isIssueCompleted);
  runGit('push', '--set-upstream', GIT_REMOTE, branch);
  const pullRequestUrl = runGh(
    'pr',
    'create',
    `--head=${branch}`,
    `--title=${milestone}`,
    `--body=${buildPullRequestBody(milestone, completedIssues)}`,
  );
  logRalph(`opened ${pullRequestUrl}`);
  return pullRequestUrl;
}

function runLoopPass(config: RalphConfig, iterationPath: string): LoopStep {
  const guardReason = findStopReason(PASS_GUARDS, config);
  if (guardReason) {
    return { kind: 'stop', reason: guardReason };
  }
  const [nextIssue] = listMilestoneIssues(config.milestone, ISSUE_STATE.OPEN);
  // The PR comes before the iteration limit, so the run that closes the last
  // issue still opens it.
  if (!nextIssue) {
    const pullRequestUrl = openPullRequest(config);
    rmSync(iterationPath, { force: true });
    // Only a pull request opened in this run is reviewed, so each is reviewed once.
    if (pullRequestUrl && isReviewEnabled(config)) {
      runReviewSession(pullRequestUrl, config);
    }
    return { kind: 'done' };
  }
  const iteration = readIteration(iterationPath);
  if (iteration >= config.maxIteration) {
    return {
      kind: 'stop',
      reason: `reached maxIteration (${config.maxIteration}); delete ${iterationPath} to continue.`,
    };
  }
  runIssueSession(nextIssue, config);
  // Counted whether or not the issue closed: the session spent tokens either way.
  const nextIteration = iteration + ITERATION_STEP;
  writeIteration(iterationPath, nextIteration);
  if (isIssueOpen(nextIssue.number)) {
    return {
      kind: 'stop',
      reason: `#${nextIssue.number} is still open after its session; stopping.`,
    };
  }
  return { kind: 'next' };
}

function runLoop(config: RalphConfig): void {
  const iterationPath = getGitStatePath(ITERATION_FILE);
  for (;;) {
    const step = runLoopPass(config, iterationPath);
    if (step.kind === 'next') {
      continue;
    }
    if (step.kind === 'stop') {
      logRalph(step.reason);
    }
    return;
  }
}

function runStopHook(): void {
  if (
    process.env[LOOP_ENV] !== LOOP_ENABLED ||
    readStopEvent().stop_hook_active
  ) {
    return;
  }
  const config = readConfig();
  const lockPath = getGitStatePath(LOCK_FILE);
  if (!withLock(lockPath, () => runLoop(config))) {
    logRalph(
      `another loop holds ${lockPath}; delete it if no loop is running.`,
    );
  }
}

runStopHook();
