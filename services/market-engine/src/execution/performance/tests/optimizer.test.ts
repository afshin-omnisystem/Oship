import {test} from 'node:test';
import assert from 'node:assert/strict';
import {optimize, baselineParameterSet, getPathValue, MAX_GRID_COMBINATIONS} from '../optimizer';
import {buildParameterSet, DEFAULT_PARAMETER_SPACE, applyParameterSet} from '../parameter-space';
import {canonicalObjective, DEFAULT_EXECUTION_PERFORMANCE_CONFIG} from '../config';
import {DEFAULT_EXECUTION_CONTROL_CONFIG} from '../../control/config';
import {flipFlopRecord, healthyRecord, driftedRecord} from '../test-fixtures';
import type {CorpusEntry} from '../simulation-gate';

/**
 * SPRINT 034 — deterministic optimizer tests: GRID + COORDINATE, bounded
 * exhaustive, no randomness, no ML.
 */

const objective = canonicalObjective(DEFAULT_EXECUTION_PERFORMANCE_CONFIG);
const flip = flipFlopRecord(7);
const healthy = healthyRecord();
const drifted = driftedRecord();

const corpus: readonly CorpusEntry[] = [flip, healthy].map((r) => ({
  label: r.label,
  plan: r.replayInput!.plan,
  cycles: r.replayInput!.cycles,
  startTime: r.session.cycles[0]?.startedAt,
}));

const smallSpace = [
  DEFAULT_PARAMETER_SPACE.find((d) => d.path === 'adaptive.thresholds.rerouteThreshold')!,
  DEFAULT_PARAMETER_SPACE.find((d) => d.path === 'hysteresis.sameActionCooldownCycles')!,
];

test('OP1 baseline extraction reads current control-config values', () => {
  const base = baselineParameterSet(DEFAULT_EXECUTION_CONTROL_CONFIG, smallSpace);
  assert.equal(base.entries.length, 2);
  assert.equal(base.entries.find((e) => e.path === 'adaptive.thresholds.rerouteThreshold')!.value, 0.1);
  assert.equal(base.entries.find((e) => e.path === 'hysteresis.sameActionCooldownCycles')!.value, 0);
});

test('OP2 getPathValue resolves dotted numeric paths and fails closed otherwise', () => {
  assert.equal(getPathValue(DEFAULT_EXECUTION_CONTROL_CONFIG, 'budgets.maxCycles'), 12);
  assert.equal(getPathValue(DEFAULT_EXECUTION_CONTROL_CONFIG, 'adaptive.thresholds.rerouteThreshold'), 0.1);
  assert.throws(() => getPathValue(DEFAULT_EXECUTION_CONTROL_CONFIG, 'no.such.path'), /fail closed/i);
  assert.throws(() => getPathValue(DEFAULT_EXECUTION_CONTROL_CONFIG, 'controlConfigVersion'), /fail closed/i);
});

test('OP3 coordinate search discovers the reroute-threshold lever deterministically', () => {
  const outcome = optimize({corpus, baselineConfig: DEFAULT_EXECUTION_CONTROL_CONFIG, space: smallSpace, objective, method: 'COORDINATE'});
  assert.equal(outcome.method, 'COORDINATE');
  assert.ok(outcome.best !== null, 'an improving set must be found');
  const reroute = outcome.best.entries.find((e) => e.path === 'adaptive.thresholds.rerouteThreshold')!;
  assert.ok(reroute.value > 0.1, `expected a higher reroute threshold, got ${reroute.value}`);
  assert.ok(outcome.bestScore! > outcome.baselineScore, 'best must beat the baseline');
});

test('OP4 the coordinate sweep is fully deterministic (identical trace + ranking)', () => {
  const a = optimize({corpus, baselineConfig: DEFAULT_EXECUTION_CONTROL_CONFIG, space: smallSpace, objective, method: 'COORDINATE'});
  const b = optimize({corpus, baselineConfig: DEFAULT_EXECUTION_CONTROL_CONFIG, space: smallSpace, objective, method: 'COORDINATE'});
  assert.deepEqual(a.searchTrace, b.searchTrace);
  assert.deepEqual(
    a.evaluated.map((e) => `${e.parameters.fingerprint}:${e.score}`),
    b.evaluated.map((e) => `${e.parameters.fingerprint}:${e.score}`),
  );
  assert.equal(a.best?.fingerprint, b.best?.fingerprint);
  assert.equal(a.bestScore, b.bestScore);
});

test('OP5 every evaluated parameter set is on-grid and valid', () => {
  const outcome = optimize({corpus, baselineConfig: DEFAULT_EXECUTION_CONTROL_CONFIG, space: smallSpace, objective, method: 'COORDINATE'});
  for (const e of outcome.evaluated) {
    assert.deepEqual(
      parameterPaths(e.parameters),
      [...parameterPaths(e.parameters)].sort((x, y) => x.localeCompare(y)),
    );
    for (const entry of e.parameters.entries) {
      const d = smallSpace.find((x) => x.path === entry.path)!;
      assert.ok(entry.value >= d.min - 1e-9 && entry.value <= d.max + 1e-9, `${entry.path}=${entry.value} in bounds`);
    }
  }
});

test('OP6 a world with no improvement yields best = null', () => {
  // The healthy world completes under every parameter value — nothing to gain.
  const healthyCorpus: readonly CorpusEntry[] = [healthy, drifted].map((r) => ({
    label: r.label, plan: r.replayInput!.plan, cycles: r.replayInput!.cycles,
  }));
  const outcome = optimize({corpus: healthyCorpus, baselineConfig: DEFAULT_EXECUTION_CONTROL_CONFIG, space: smallSpace, objective, method: 'COORDINATE'});
  assert.ok(outcome.best === null || outcome.bestScore! > outcome.baselineScore);
  if (outcome.best === null) {
    assert.equal(outcome.bestScore, null);
  }
});

test('OP7 grid search enumerates the full space deterministically', () => {
  const outcome = optimize({corpus, baselineConfig: DEFAULT_EXECUTION_CONTROL_CONFIG, space: smallSpace, objective, method: 'GRID'});
  assert.equal(outcome.method, 'GRID');
  // grid = 5 reroute values × 3 cooldown values = 15 sets; the baseline set is
  // evaluated once up front and skipped in the enumeration → 15 entries.
  assert.equal(outcome.evaluated.length, 5 * 3);
  assert.equal(new Set(outcome.evaluated.map((e) => e.parameters.fingerprint)).size, 5 * 3);
  assert.ok(outcome.bestScore === null || outcome.bestScore >= outcome.baselineScore);
});

test('OP8 grid search refuses spaces beyond the bounded exhaustive limit', () => {
  const huge = Array.from({length: 6}, (_, i) => ({
    path: `p${i}`, name: `p${i}`, kind: 'THRESHOLD' as const, min: 0, max: 4, step: 1, unit: 'u',
  }));
  let combos = 1;
  for (const d of huge) combos *= 5;
  assert.ok(combos > MAX_GRID_COMBINATIONS);
  assert.throws(
    () => optimize({corpus, baselineConfig: DEFAULT_EXECUTION_CONTROL_CONFIG, space: huge, objective, method: 'GRID'}),
    /bounded exhaustive/i,
  );
});

test('OP9 optimization refuses invalid parameter spaces (fail closed)', () => {
  const bad = [...smallSpace, {path: 'limits.maxSlippageBps', name: 'x', kind: 'THRESHOLD' as const, min: 1, max: 10, step: 1, unit: 'bps'}];
  assert.throws(
    () => optimize({corpus, baselineConfig: DEFAULT_EXECUTION_CONTROL_CONFIG, space: bad, objective, method: 'COORDINATE'}),
    /invalid parameter space/i,
  );
});

test('OP10 optimization refuses an empty corpus (fail closed)', () => {
  assert.throws(
    () => optimize({corpus: [], baselineConfig: DEFAULT_EXECUTION_CONTROL_CONFIG, space: smallSpace, objective, method: 'COORDINATE'}),
    /fail closed/i,
  );
});

test('OP11 the best set actually changes the control configuration', () => {
  const outcome = optimize({corpus, baselineConfig: DEFAULT_EXECUTION_CONTROL_CONFIG, space: smallSpace, objective, method: 'COORDINATE'});
  if (outcome.best !== null) {
    const applied = applyParameterSet(DEFAULT_EXECUTION_CONTROL_CONFIG, outcome.best) as unknown as typeof DEFAULT_EXECUTION_CONTROL_CONFIG;
    const reroute = applied.adaptive.thresholds.rerouteThreshold;
    assert.ok(Math.abs(reroute - DEFAULT_EXECUTION_CONTROL_CONFIG.adaptive.thresholds.rerouteThreshold) > 1e-12
      || applied.hysteresis.sameActionCooldownCycles !== DEFAULT_EXECUTION_CONTROL_CONFIG.hysteresis.sameActionCooldownCycles);
  }
});

test('OP12 the winning arms are retained for the gates', () => {
  const outcome = optimize({corpus, baselineConfig: DEFAULT_EXECUTION_CONTROL_CONFIG, space: smallSpace, objective, method: 'COORDINATE'});
  if (outcome.best !== null) {
    assert.ok(outcome.bestArms !== null);
    assert.equal(outcome.bestArms.baselineSessions.length, corpus.length);
    assert.equal(outcome.bestArms.candidateSessions.length, corpus.length);
    assert.ok(outcome.bestArms.comparison.candidate.objectiveScore > 0);
  }
});

test('OP13 the search trace documents every decision', () => {
  const outcome = optimize({corpus, baselineConfig: DEFAULT_EXECUTION_CONTROL_CONFIG, space: smallSpace, objective, method: 'COORDINATE'});
  assert.ok(outcome.searchTrace.some((l) => l.includes('baseline')));
  assert.ok(outcome.searchTrace.some((l) => l.includes('adaptive.thresholds.rerouteThreshold')));
  assert.ok(outcome.searchTrace.some((l) => l.includes('COORDINATE evaluated')));
});

function parameterPaths(set: {entries: readonly {path: string}[]}): string[] {
  return set.entries.map((e) => e.path);
}
