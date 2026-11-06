// Ralph Loop: when the loop's root session stops, work through the configured
// phases in order. For each one, run one headless Claude session per open issue
// of its milestone, then open the pull request and run one headless review of
// the whole milestone on it.
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
  findCurrentPhase,
  getBaseBranch,
  getGitStatePath,
  hasCommitsAhead,
  hasLocalBranch,
  hasPullRequest,
  isIssueCompleted,
  isIssueOpen,
  isOnBranch,
  isReviewEnabled,
  isWorkingTreeClean,
  listMilestoneIssues,
  logRalph,
  readCliOverrides,
  readConfig,
  readIteration,
  readStopEvent,
  runGh,
  runGit,
  withLock,
  writeIteration,
} from './helpers.ts';
import type { Issue, Phase, RalphConfig, ReviewConfig } from './helpers.ts';

// Each pass of the loop ends in exactly one of these outcomes; after a
// finished phase, the next pass picks the next phase.
type LoopStep = { kind: 'next' } | { kind: 'stop'; reason: string };

// A guard returns the reason to stop, or undefined to let the pass go on.
type Guard = (phase: Phase) => string | undefined;

const CLEAN_TREE_GUARD: Guard = () =>
  isWorkingTreeClean()
    ? undefined
    : 'tracked files have uncommitted changes; stopping.';

// Each pass re-checks the branch and the tree, because a session may have
// switched branches or left changes that the next session would commit.
const PASS_GUARDS: Guard[] = [
  ({ branch }) =>
    isOnBranch(branch) ? undefined : `not on ${branch}; stopping.`,
  CLEAN_TREE_GUARD,
];

function findStopReason(guards: Guard[], phase: Phase): string | undefined {
  for (const guard of guards) {
    const reason = guard(phase);
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

function runIssueSession(
  issue: Issue,
  config: RalphConfig,
  phase: Phase,
): void {
  logRalph(`starting a session for #${issue.number} ${issue.title}`);
  // A session that hits the cap ends with its issue open, which stops the loop.
  runHeadlessSession(`#${issue.number}`, [
    '-p',
    buildSessionPrompt(config, phase, issue.number),
    '--max-turns',
    String(config.maxTurns),
  ]);
}

function runReviewSession(
  pullRequestUrl: string,
  config: ReviewConfig,
  phase: Phase,
): void {
  logRalph(`starting the ${REVIEW_MODEL} review of ${pullRequestUrl}`);
  runHeadlessSession(pullRequestUrl, [
    '-p',
    buildReviewPrompt(config, phase, pullRequestUrl),
    '--model',
    REVIEW_MODEL,
    '--max-turns',
    String(config.maxTurns),
  ]);
}

// Returns the new pull request's URL, or undefined when one already exists.
// A dependent phase's pull request targets its base, so it shows only its own
// commits; GitHub retargets it to main once the base branch is merged and
// deleted.
function openPullRequest(phase: Phase): string | undefined {
  const { milestone, branch } = phase;
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
    `--base=${getBaseBranch(phase)}`,
    `--title=${milestone}`,
    `--body=${buildPullRequestBody(milestone, completedIssues)}`,
  );
  logRalph(`opened ${pullRequestUrl}`);
  return pullRequestUrl;
}

// The hook switches branches only when a phase starts, so a later pass on
// another branch still means a session switched away, which stops the loop.
function switchToPhaseBranch(phase: Phase): void {
  const { milestone, branch } = phase;
  logRalph(`starting the phase "${milestone}" on ${branch}`);
  runGit('fetch', GIT_REMOTE);
  if (hasLocalBranch(branch)) {
    runGit('switch', branch);
    return;
  }
  // No tracking: the branch gets its own upstream when the hook pushes it.
  const startPoint = `${GIT_REMOTE}/${getBaseBranch(phase)}`;
  runGit('switch', '--no-track', '--create', branch, startPoint);
}

function runLoopPass(
  config: RalphConfig,
  phase: Phase,
  iterationPath: string,
): LoopStep {
  const guardReason = findStopReason(PASS_GUARDS, phase);
  if (guardReason) {
    return { kind: 'stop', reason: guardReason };
  }
  const [nextIssue] = listMilestoneIssues(phase.milestone, ISSUE_STATE.OPEN);
  // The PR comes before the iteration limit, so the run that closes the last
  // issue still opens it.
  if (!nextIssue) {
    // gh refuses a pull request with no commits, such as a milestone that had
    // no open issues when its branch was created.
    const base = getBaseBranch(phase);
    if (!hasCommitsAhead(base)) {
      return {
        kind: 'stop',
        reason: `${phase.branch} has no commits ahead of ${base}; stopping.`,
      };
    }
    const pullRequestUrl = openPullRequest(phase);
    rmSync(iterationPath, { force: true });
    // Only a pull request opened in this run is reviewed, so each is reviewed once.
    if (pullRequestUrl && isReviewEnabled(config)) {
      runReviewSession(pullRequestUrl, config, phase);
    }
    return { kind: 'next' };
  }
  const iteration = readIteration(iterationPath);
  if (iteration >= config.maxIteration) {
    return {
      kind: 'stop',
      reason: `reached maxIteration (${config.maxIteration}); delete ${iterationPath} to continue.`,
    };
  }
  runIssueSession(nextIssue, config, phase);
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
  let startedBranch: string | undefined;
  for (;;) {
    const phase = findCurrentPhase(config.phases, hasPullRequest);
    if (!phase) {
      logRalph('every phase has a pull request.');
      return;
    }
    if (phase.branch !== startedBranch) {
      // Checked before the switch, so no change is carried to another branch.
      const dirtyReason = findStopReason([CLEAN_TREE_GUARD], phase);
      if (dirtyReason) {
        logRalph(dirtyReason);
        return;
      }
      switchToPhaseBranch(phase);
      startedBranch = phase.branch;
    }
    const step = runLoopPass(config, phase, iterationPath);
    if (step.kind === 'stop') {
      logRalph(step.reason);
      return;
    }
  }
}

function runStopHook(): void {
  if (
    process.env[LOOP_ENV] !== LOOP_ENABLED ||
    readStopEvent().stop_hook_active
  ) {
    return;
  }
  const config = readConfig(readCliOverrides());
  const lockPath = getGitStatePath(LOCK_FILE);
  if (!withLock(lockPath, () => runLoop(config))) {
    logRalph(
      `another loop holds ${lockPath}; delete it if no loop is running.`,
    );
  }
}

runStopHook();
