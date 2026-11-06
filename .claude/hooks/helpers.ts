import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import {
  CLI_OPTIONS,
  COMMANDS,
  COMPLETED_REASON,
  CONFIG_PATH,
  ERROR_CODES,
  GIT_REMOTE,
  INITIAL_ITERATION,
  ISSUE_LIST_LIMIT,
  ISSUE_OPEN_STATE,
  LOG_PREFIX,
  MAIN_BRANCH,
  PLACEHOLDERS,
  PULL_REQUEST_PLACEHOLDER,
} from './constants.ts';
import type { IssueState, Placeholder } from './constants.ts';

export interface Phase {
  milestone: string;
  branch: string;
  // Optional: an earlier phase's branch that this phase builds on; without it
  // the phase starts from main.
  base?: string;
}

export interface RalphConfig {
  phases: Phase[];
  prompt: string;
  maxIteration: number;
  maxTurns: number;
  // Optional: without it the hook skips the milestone review.
  reviewPrompt?: string;
}

export type ReviewConfig = RalphConfig & { reviewPrompt: string };

export type CliOverrides = Partial<Pick<RalphConfig, 'prompt' | 'maxTurns'>>;

export interface StopEvent {
  stop_hook_active?: boolean;
}

export interface Issue {
  number: number;
  title: string;
  stateReason: string;
}

interface IterationState {
  iteration: number;
}

interface FieldRule {
  isValid: (value: unknown) => boolean;
  requirement: string;
}

const NON_EMPTY_STRING: FieldRule = {
  isValid: (value) => typeof value === 'string' && value !== '',
  requirement: 'a non-empty string',
};
const POSITIVE_INTEGER: FieldRule = {
  isValid: (value) => Number.isInteger(value) && (value as number) > 0,
  requirement: 'a positive integer',
};
const NON_EMPTY_ARRAY: FieldRule = {
  isValid: (value) => Array.isArray(value) && value.length > 0,
  requirement: 'a non-empty array',
};
const OPTIONAL_REVIEW_PROMPT: FieldRule = {
  isValid: (value) =>
    value === undefined ||
    (typeof value === 'string' && value.includes(PULL_REQUEST_PLACEHOLDER)),
  requirement: `absent or a string containing ${PULL_REQUEST_PLACEHOLDER}`,
};

// A declarative schema: each config field names the rule it must satisfy.
const CONFIG_SCHEMA = {
  phases: NON_EMPTY_ARRAY,
  prompt: NON_EMPTY_STRING,
  maxIteration: POSITIVE_INTEGER,
  maxTurns: POSITIVE_INTEGER,
  reviewPrompt: OPTIONAL_REVIEW_PROMPT,
} satisfies Record<keyof RalphConfig, FieldRule>;

// "base" is checked against the earlier phases, so it has no rule here.
const PHASE_SCHEMA = {
  milestone: NON_EMPTY_STRING,
  branch: NON_EMPTY_STRING,
} satisfies Record<Exclude<keyof Phase, 'base'>, FieldRule>;

const OVERRIDE_FLAGS: Record<keyof CliOverrides, string> = {
  prompt: `--${CLI_OPTIONS.PROMPT}`,
  maxTurns: `--${CLI_OPTIONS.MAX_TURNS}`,
};

// Everything the hook prints goes to stderr; stdout is Claude Code's channel.
export function logRalph(message: string): void {
  console.error(`${LOG_PREFIX} ${message}`);
}

export function isErrnoException(
  error: unknown,
): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

export function readStopEvent(): StopEvent {
  const input = readFileSync(0, 'utf8');
  return input ? (JSON.parse(input) as StopEvent) : {};
}

// An overridden field names its flag, so a bad flag value never blames the
// config file.
function getFieldSource(field: string, overrides: CliOverrides): string {
  return Object.hasOwn(overrides, field)
    ? OVERRIDE_FLAGS[field as keyof CliOverrides]
    : CONFIG_PATH;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function findInvalidField(
  fields: Record<string, unknown>,
  schema: Record<string, FieldRule>,
): [string, FieldRule] | undefined {
  return Object.entries(schema).find(
    ([field, rule]) => !rule.isValid(fields[field]),
  );
}

// A base must name an earlier phase's branch: that phase has its pull request,
// and so its pushed branch, before this phase starts.
function assertPhases(phases: unknown[]): asserts phases is Phase[] {
  const branches = new Set<string>();
  for (const [index, phase] of phases.entries()) {
    const label = `phases[${index}]`;
    if (!isObject(phase)) {
      throw new Error(`${CONFIG_PATH}: "${label}" must be an object`);
    }
    const invalidField = findInvalidField(phase, PHASE_SCHEMA);
    if (invalidField) {
      const [field, rule] = invalidField;
      throw new Error(
        `${CONFIG_PATH}: "${label}.${field}" must be ${rule.requirement}`,
      );
    }
    const branch = phase.branch as string;
    if (branches.has(branch)) {
      throw new Error(
        `${CONFIG_PATH}: "${label}.branch" must differ from every earlier phase's branch`,
      );
    }
    if (phase.base !== undefined && !branches.has(phase.base as string)) {
      throw new Error(
        `${CONFIG_PATH}: "${label}.base" must be absent or an earlier phase's branch`,
      );
    }
    branches.add(branch);
  }
}

export function assertConfig(
  raw: unknown,
  overrides: CliOverrides,
): asserts raw is RalphConfig {
  if (!isObject(raw)) {
    throw new Error(`${CONFIG_PATH}: must contain a JSON object`);
  }
  const invalidField = findInvalidField(raw, CONFIG_SCHEMA);
  if (invalidField) {
    const [field, rule] = invalidField;
    const source = getFieldSource(field, overrides);
    throw new Error(`${source}: "${field}" must be ${rule.requirement}`);
  }
  assertPhases(raw.phases as unknown[]);
  const missingPlaceholder = Object.values(PLACEHOLDERS).find(
    (placeholder) => !(raw.prompt as string).includes(placeholder),
  );
  if (missingPlaceholder) {
    const source = getFieldSource('prompt', overrides);
    throw new Error(`${source}: "prompt" must contain ${missingPlaceholder}`);
  }
}

// Unknown flags throw, so a typo never silently falls back to the config.
export function readCliOverrides(): CliOverrides {
  const { values } = parseArgs({
    options: {
      [CLI_OPTIONS.PROMPT]: { type: 'string' },
      [CLI_OPTIONS.MAX_TURNS]: { type: 'string' },
    },
  });
  const prompt = values[CLI_OPTIONS.PROMPT];
  const maxTurns = values[CLI_OPTIONS.MAX_TURNS];
  return {
    ...(prompt !== undefined && { prompt }),
    ...(maxTurns !== undefined && { maxTurns: Number(maxTurns) }),
  };
}

// Parse, don't validate: the rest of the hook only ever sees a RalphConfig.
// Overrides are merged before validation, so they obey the same schema.
export function readConfig(overrides: CliOverrides): RalphConfig {
  const raw: unknown = {
    ...JSON.parse(readFileSync(CONFIG_PATH, 'utf8')),
    ...overrides,
  };
  assertConfig(raw, overrides);
  return raw;
}

export function runCommand(command: string, args: string[]): string {
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
}

function runJsonCommand<T>(command: string, args: string[]): T {
  return JSON.parse(runCommand(command, args)) as T;
}

export const runGh = (...args: string[]): string =>
  runCommand(COMMANDS.GH, args);
export const runGit = (...args: string[]): string =>
  runCommand(COMMANDS.GIT, args);

export function listMilestoneIssues(
  milestone: string,
  state: IssueState,
): Issue[] {
  return runJsonCommand<Issue[]>(COMMANDS.GH, [
    'issue',
    'list',
    `--milestone=${milestone}`,
    `--state=${state}`,
    `--limit=${ISSUE_LIST_LIMIT}`,
    '--json=number,title,stateReason',
  ]).toSorted((first, second) => first.number - second.number);
}

export function isIssueCompleted(issue: Issue): boolean {
  return issue.stateReason === COMPLETED_REASON;
}

export function isIssueOpen(issueNumber: number): boolean {
  const issue = runJsonCommand<{ state: string }>(COMMANDS.GH, [
    'issue',
    'view',
    String(issueNumber),
    '--json=state',
  ]);
  return issue.state === ISSUE_OPEN_STATE;
}

export function getBaseBranch(phase: Phase): string {
  return phase.base ?? MAIN_BRANCH;
}

// The first phase without a pull request is the current one, so a rerun
// resumes where the last run stopped without stored state.
export function findCurrentPhase(
  phases: Phase[],
  hasBranchPullRequest: (branch: string) => boolean,
): Phase | undefined {
  return phases.find((phase) => !hasBranchPullRequest(phase.branch));
}

export function hasLocalBranch(branch: string): boolean {
  return runGit('branch', '--list', branch) !== '';
}

export function hasCommitsAhead(base: string): boolean {
  return runGit('rev-list', '--count', `${GIT_REMOTE}/${base}..HEAD`) !== '0';
}

export function isOnBranch(branch: string): boolean {
  return runGit('branch', '--show-current') === branch;
}

// Untracked files are ignored: they never reach a commit unless added.
export function isWorkingTreeClean(): boolean {
  return runGit('status', '--porcelain', '--untracked-files=no') === '';
}

// Every state counts: a merged or closed pull request also keeps the hook
// from opening a second one for the branch.
export function hasPullRequest(branch: string): boolean {
  return (
    runJsonCommand<unknown[]>(COMMANDS.GH, [
      'pr',
      'list',
      `--head=${branch}`,
      '--state=all',
      '--json=number',
    ]).length > 0
  );
}

export function getGitStatePath(fileName: string): string {
  return runGit('rev-parse', '--path-format=absolute', '--git-path', fileName);
}

// The exclusive create is atomic, so two loops never both acquire the lock.
function acquireLock(lockPath: string): boolean {
  try {
    writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
    return true;
  } catch (error) {
    if (isErrnoException(error) && error.code === ERROR_CODES.ALREADY_EXISTS) {
      return false;
    }
    throw error;
  }
}

// Execute Around: the lock is released whether the work returns or throws; a
// killed process leaves it behind.
export function withLock(lockPath: string, work: () => void): boolean {
  if (!acquireLock(lockPath)) {
    return false;
  }
  try {
    work();
  } finally {
    unlinkSync(lockPath);
  }
  return true;
}

export function readIteration(iterationPath: string): number {
  try {
    const state = JSON.parse(
      readFileSync(iterationPath, 'utf8'),
    ) as IterationState;
    return state.iteration;
  } catch (error) {
    if (isErrnoException(error) && error.code === ERROR_CODES.NOT_FOUND) {
      return INITIAL_ITERATION;
    }
    throw error;
  }
}

export function writeIteration(iterationPath: string, iteration: number): void {
  const state: IterationState = { iteration };
  writeFileSync(iterationPath, JSON.stringify(state));
}

export function isReviewEnabled(config: RalphConfig): config is ReviewConfig {
  return config.reviewPrompt !== undefined;
}

function fillPlaceholders(
  template: string,
  values: Record<string, string>,
): string {
  return Object.entries(values).reduce(
    (text, [placeholder, value]) => text.replaceAll(placeholder, value),
    template,
  );
}

export function buildSessionPrompt(
  { prompt }: RalphConfig,
  { milestone, branch }: Phase,
  issueNumber: number,
): string {
  const values: Record<Placeholder, string> = {
    [PLACEHOLDERS.MILESTONE]: milestone,
    [PLACEHOLDERS.BRANCH]: branch,
    [PLACEHOLDERS.ISSUE]: String(issueNumber),
  };
  return fillPlaceholders(prompt, values);
}

export function buildReviewPrompt(
  { reviewPrompt }: ReviewConfig,
  { milestone, branch }: Phase,
  pullRequestUrl: string,
): string {
  return fillPlaceholders(reviewPrompt, {
    [PLACEHOLDERS.MILESTONE]: milestone,
    [PLACEHOLDERS.BRANCH]: branch,
    [PULL_REQUEST_PLACEHOLDER]: pullRequestUrl,
  });
}

// Issue titles stay out of the body: a title such as "closes #12" would close
// an unrelated issue on merge.
export function buildPullRequestBody(
  milestone: string,
  issues: Issue[],
): string {
  return [
    `All issues of the milestone "${milestone}" are closed.`,
    '',
    ...issues.map((issue) => `Closes #${issue.number}`),
  ].join('\n');
}
