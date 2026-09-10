import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PARAMETER_SPACE, PROTECTED_PARAMETER_PATHS, gridValues, enumerateGrid,
  buildParameterSet, parameterSetIsValid, validateParameterSpace, applyParameterSet,
} from '../parameter-space';
import {DEFAULT_EXECUTION_CONTROL_CONFIG} from '../../control/config';
import {baselineParameterSet, getPathValue} from '../optimizer';
import {runControl} from '../../control/test-fixtures';
import {perfPlan, healthyCycle} from '../test-fixtures';

/**
 * SPRINT 034 — parameter space tests: bounded grids, protected paths,
 * mechanical application, validation.
 */

test('PS1 the default space declares 11 bounded descriptors', () => {
  assert.equal(DEFAULT_PARAMETER_SPACE.length, 11);
  for (const d of DEFAULT_PARAMETER_SPACE) {
    assert.ok(d.path.length > 0);
    assert.ok(d.min <= d.max);
    assert.ok(d.step > 0);
    assert.ok(['THRESHOLD', 'HYSTERESIS', 'BUDGET'].includes(d.kind));
    assert.ok(typeof d.name === 'string' && d.name.length > 0);
  }
});

test('PS2 the space covers the canonical lever families', () => {
  const paths = DEFAULT_PARAMETER_SPACE.map((d) => d.path);
  for (const family of ['adaptive.thresholds.repriceThresholdBps', 'adaptive.thresholds.rerouteThreshold',
    'adaptive.thresholds.resliceThreshold', 'hysteresis.sameActionCooldownCycles',
    'budgets.maxReprices', 'budgets.maxReslices', 'budgets.maxCycles']) {
    assert.ok(paths.includes(family), `missing ${family}`);
  }
});

test('PS3 protected safety paths can never be optimized', () => {
  for (const p of ['limits.maxSlippageBps', 'limits.maxImpactNotional', 'limits.maxLatencyMs',
    'abortOnAllVenuesStale', 'oscillation.onDetection', 'oscillation.detectionWindow']) {
    assert.ok(PROTECTED_PARAMETER_PATHS.includes(p), `missing protected ${p}`);
  }
  const errs = validateParameterSpace([...DEFAULT_PARAMETER_SPACE, {path: 'limits.maxSlippageBps', name: 'x', kind: 'THRESHOLD', min: 1, max: 10, step: 1, unit: 'bps'}]);
  assert.ok(errs.some((e) => e.includes('protected')));
});

test('PS4 gridValues enumerates the deterministic ascending grid', () => {
  const d = DEFAULT_PARAMETER_SPACE.find((x) => x.path === 'adaptive.thresholds.repriceThresholdBps')!;
  assert.deepEqual(gridValues(d), [5, 10, 15, 20, 25, 30]);
  const cooldown = DEFAULT_PARAMETER_SPACE.find((x) => x.path === 'hysteresis.sameActionCooldownCycles')!;
  assert.deepEqual(gridValues(cooldown), [0, 1, 2]);
});

test('PS5 every control default is on-grid and in bounds', () => {
  for (const d of DEFAULT_PARAMETER_SPACE) {
    const value = getPathValue(DEFAULT_EXECUTION_CONTROL_CONFIG, d.path);
    assert.ok(value >= d.min - 1e-9 && value <= d.max + 1e-9, `${d.path} default ${value} outside [${d.min}, ${d.max}]`);
    assert.ok(gridValues(d).some((v) => Math.abs(v - value) < 1e-9), `${d.path} default ${value} off grid`);
  }
});

test('PS6 buildParameterSet is canonical: sorted, unique, fingerprinted', () => {
  const a = buildParameterSet([{path: 'b.x', value: 2}, {path: 'a.y', value: 1}]);
  const b = buildParameterSet([{path: 'a.y', value: 1}, {path: 'b.x', value: 2}]);
  assert.deepEqual(a.entries.map((e) => e.path), ['a.y', 'b.x']);
  assert.equal(a.fingerprint, b.fingerprint);
  const dup = buildParameterSet([{path: 'a.y', value: 1}, {path: 'a.y', value: 5}]);
  assert.equal(dup.entries.length, 1);
  assert.equal(dup.entries[0]!.value, 5, 'last value wins deterministically');
});

test('PS7 parameterSetIsValid rejects off-grid and out-of-bounds values', () => {
  const space = DEFAULT_PARAMETER_SPACE;
  const good = buildParameterSet([{path: 'adaptive.thresholds.repriceThresholdBps', value: 15}]);
  assert.equal(parameterSetIsValid(space, good).valid, true);
  const offGrid = buildParameterSet([{path: 'adaptive.thresholds.repriceThresholdBps', value: 12}]);
  assert.equal(parameterSetIsValid(space, offGrid).valid, false);
  const outOfBounds = buildParameterSet([{path: 'budgets.maxReprices', value: 99}]);
  assert.equal(parameterSetIsValid(space, outOfBounds).valid, false);
});

test('PS8 parameterSetIsValid rejects unknown and protected paths', () => {
  const unknown = buildParameterSet([{path: 'not.a.real.path', value: 1}]);
  assert.equal(parameterSetIsValid(DEFAULT_PARAMETER_SPACE, unknown).valid, false);
  const protectedPath = buildParameterSet([{path: 'limits.maxSlippageBps', value: 500}]);
  const v = parameterSetIsValid(DEFAULT_PARAMETER_SPACE, protectedPath);
  assert.equal(v.valid, false);
  assert.ok(v.violations.some((x) => x.includes('protected')));
});

test('PS9 enumerateGrid produces the full cartesian grid deterministically', () => {
  const small = [
    {path: 'a', name: 'a', kind: 'THRESHOLD' as const, min: 0, max: 1, step: 1, unit: 'x'},
    {path: 'b', name: 'b', kind: 'BUDGET' as const, min: 0, max: 2, step: 1, unit: 'y'},
  ];
  const grid = enumerateGrid(small);
  assert.equal(grid.length, 2 * 3);
  assert.equal(new Set(grid.map((g) => g.fingerprint)).size, 6);
  const again = enumerateGrid(small);
  assert.deepEqual(grid.map((g) => g.fingerprint), again.map((g) => g.fingerprint));
});

test('PS10 validateParameterSpace rejects malformed descriptors', () => {
  const u = 'u';
  assert.ok(validateParameterSpace([{path: 'x', name: 'x', kind: 'THRESHOLD', min: 10, max: 1, step: 1, unit: u}]).length > 0);
  assert.ok(validateParameterSpace([{path: 'x', name: 'x', kind: 'THRESHOLD', min: 0, max: 10, step: 0, unit: u}]).length > 0);
  assert.ok(validateParameterSpace([{path: 'x', name: 'x', kind: 'THRESHOLD', min: 0, max: 1, step: 1, unit: u}, {path: 'x', name: 'x', kind: 'THRESHOLD', min: 0, max: 1, step: 1, unit: u}]).length > 0);
  assert.equal(validateParameterSpace(DEFAULT_PARAMETER_SPACE).length, 0);
});

test('PS11 applyParameterSet is mechanical: it sets paths on a cloned config', () => {
  const set = buildParameterSet([{path: 'adaptive.thresholds.repriceThresholdBps', value: 25}]);
  const applied = applyParameterSet(DEFAULT_EXECUTION_CONTROL_CONFIG, set);
  const engine = applied as unknown as typeof DEFAULT_EXECUTION_CONTROL_CONFIG;
  assert.equal(engine.adaptive.thresholds.repriceThresholdBps, 25);
  // The base config object is untouched (deep clone, no mutation).
  assert.equal(DEFAULT_EXECUTION_CONTROL_CONFIG.adaptive.thresholds.repriceThresholdBps, 10);
});

test('PS12 applyParameterSet preserves the whole adaptive section (wholesale-safe)', () => {
  const set = buildParameterSet([{path: 'adaptive.thresholds.rerouteThreshold', value: 0.25}]);
  const applied = applyParameterSet(DEFAULT_EXECUTION_CONTROL_CONFIG, set) as unknown as typeof DEFAULT_EXECUTION_CONTROL_CONFIG;
  // The known mergeControlConfig pitfall: `adaptive` is replaced wholesale by
  // partial inputs. applyParameterSet clones the FULL spec, so weights survive.
  assert.ok(applied.adaptive.qualityWeights !== undefined, 'qualityWeights survive');
  assert.ok(applied.adaptive.venueHealthWeights !== undefined, 'venueHealthWeights survive');
  assert.equal(applied.adaptive.thresholds.replanThreshold, DEFAULT_EXECUTION_CONTROL_CONFIG.adaptive.thresholds.replanThreshold);
  assert.equal(applied.adaptive.thresholds.rerouteThreshold, 0.25);
});

test('PS13 an applied parameter set actually changes engine behavior', () => {
  const plan = perfPlan({planId: 'xplan_ps13'});
  const base = runControl(plan, [healthyCycle('c0', plan)], {});
  const set = buildParameterSet([{path: 'budgets.maxCycles', value: 4}]);
  const changed = runControl(plan, [healthyCycle('c0', plan)], {config: applyParameterSet(DEFAULT_EXECUTION_CONTROL_CONFIG, set)});
  assert.notEqual(base.configurationFingerprint, changed.configurationFingerprint);
});

test('PS14 baselineParameterSet extracts current values for every descriptor', () => {
  const base = baselineParameterSet(DEFAULT_EXECUTION_CONTROL_CONFIG, DEFAULT_PARAMETER_SPACE);
  assert.equal(base.entries.length, DEFAULT_PARAMETER_SPACE.length);
  for (const e of base.entries) {
    assert.equal(e.value, getPathValue(DEFAULT_EXECUTION_CONTROL_CONFIG, e.path));
  }
  assert.equal(parameterSetIsValid(DEFAULT_PARAMETER_SPACE, base).valid, true, 'baseline set must be on-grid');
});

test('PS15 parameter sets are immutable', () => {
  const set = buildParameterSet([{path: 'a', value: 1}]);
  assert.ok(Object.isFrozen(set));
  assert.ok(Object.isFrozen(set.entries));
  for (const e of set.entries) assert.ok(Object.isFrozen(e));
});
