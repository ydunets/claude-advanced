// Run by `pnpm test` through node:test; it never calls git or gh.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { assertConfig, findCurrentPhase } from './helpers.ts';
import type { Phase } from './helpers.ts';

const API_PHASE: Phase = {
  milestone: 'Phase 4: Avatar API',
  branch: 'feat/phase-4',
};
const WEB_PHASE: Phase = {
  milestone: 'Phase 5: Avatar pages',
  branch: 'feat/phase-5',
  base: 'feat/phase-4',
};

function buildConfig(phases: unknown): Record<string, unknown> {
  return {
    phases,
    prompt: 'Issue #{issue} of "{milestone}" on "{branch}".',
    maxIteration: 4,
    maxTurns: 50,
  };
}

function validateConfig(phases: unknown): void {
  assertConfig(buildConfig(phases), {});
}

await test('accepts a phase whose base is an earlier phase branch', () => {
  assert.doesNotThrow(() => validateConfig([API_PHASE, WEB_PHASE]));
});

await test('refuses a base that names a later phase branch', () => {
  assert.throws(
    () => validateConfig([WEB_PHASE, API_PHASE]),
    /"phases\[0\]\.base" must be absent or an earlier phase's branch/,
  );
});

await test('refuses a base that names its own branch', () => {
  const selfBasedPhase: Phase = { ...API_PHASE, base: API_PHASE.branch };
  assert.throws(
    () => validateConfig([selfBasedPhase]),
    /"phases\[0\]\.base" must be absent/,
  );
});

await test('refuses two phases on the same branch', () => {
  assert.throws(
    () => validateConfig([API_PHASE, { ...API_PHASE, milestone: 'Other' }]),
    /"phases\[1\]\.branch" must differ/,
  );
});

await test('refuses an empty phase list', () => {
  assert.throws(() => validateConfig([]), /"phases" must be a non-empty array/);
});

await test('refuses a phase without a milestone', () => {
  assert.throws(
    () => validateConfig([{ branch: 'feat/phase-4' }]),
    /"phases\[0\]\.milestone" must be a non-empty string/,
  );
});

await test('picks the first phase whose branch has no pull request', () => {
  const branchesWithPullRequest = new Set([API_PHASE.branch]);
  const currentPhase = findCurrentPhase([API_PHASE, WEB_PHASE], (branch) =>
    branchesWithPullRequest.has(branch),
  );
  assert.equal(currentPhase, WEB_PHASE);
});

await test('finds no phase once every branch has a pull request', () => {
  const currentPhase = findCurrentPhase([API_PHASE, WEB_PHASE], () => true);
  assert.equal(currentPhase, undefined);
});
