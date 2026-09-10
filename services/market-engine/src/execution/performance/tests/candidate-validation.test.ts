import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateCandidate} from '../candidate-validation';
import {createPolicyCandidate, withGateResults} from '../candidate';
import {buildParameterSet, DEFAULT_PARAMETER_SPACE} from '../parameter-space';
import {baselineParameterSet} from '../optimizer';
import {DEFAULT_EXECUTION_CONTROL_CONFIG} from '../../control/config';
import type {ParameterSet} from '../types';

/**
 * SPRINT 034 — candidate validation tests: structural, protected paths,
 * lineage integrity, fail closed.
 */

const space = DEFAULT_PARAMETER_SPACE;
const parentLineage = Object.freeze([{policyId: 'policy-execution', version: 'v1', kind: 'ROOT' as const}]);

function candidateWith(parameters: ParameterSet, overrides: Record<string, unknown> = {}) {
  return createPolicyCandidate({
    parentPolicyId: 'policy-execution',
    parentPolicyVersion: 'v1',
    candidateIndex: 1,
    domain: 'CROSS_DOMAIN',
    parameters,
    objectiveScore: 0.5,
    baselineScore: 0.4,
    observedSampleSize: 3,
    createdAt: 1_704_067_200_000,
    parentLineage,
    ...overrides,
  } as never);
}

test('CV1 an on-grid candidate over declared paths is VALID', () => {
  const params = buildParameterSet([{path: 'adaptive.thresholds.rerouteThreshold', value: 0.25}]);
  const v = validateCandidate(candidateWith(params), space);
  assert.equal(v.valid, true);
  assert.deepEqual(v.violations, []);
});

test('CV2 a candidate touching a protected safety path is INVALID', () => {
  const params = buildParameterSet([
    {path: 'adaptive.thresholds.rerouteThreshold', value: 0.25},
    {path: 'limits.maxSlippageBps', value: 5_000},
  ]);
  const v = validateCandidate(candidateWith(params), space);
  assert.equal(v.valid, false);
  assert.ok(v.violations.some((x) => x.includes('protected')), JSON.stringify(v.violations));
});

test('CV3 every protected path is rejected individually', () => {
  for (const path of ['limits.maxSlippageBps', 'limits.maxImpactNotional', 'limits.maxLatencyMs',
    'abortOnAllVenuesStale', 'oscillation.onDetection', 'oscillation.detectionWindow']) {
    const params = buildParameterSet([{path, value: 1}]);
    const v = validateCandidate(candidateWith(params), space);
    assert.equal(v.valid, false, `${path} must be rejected`);
  }
});

test('CV4 off-grid values are INVALID', () => {
  const params = buildParameterSet([{path: 'adaptive.thresholds.repriceThresholdBps', value: 12}]);
  const v = validateCandidate(candidateWith(params), space);
  assert.equal(v.valid, false);
  assert.ok(v.violations.some((x) => x.includes('grid')));
});

test('CV5 out-of-bounds values are INVALID', () => {
  const params = buildParameterSet([{path: 'budgets.maxReprices', value: 99}]);
  const v = validateCandidate(candidateWith(params), space);
  assert.equal(v.valid, false);
  assert.ok(v.violations.some((x) => x.includes('bounds')));
});

test('CV6 unknown paths are INVALID', () => {
  const params = buildParameterSet([{path: 'treasury.something', value: 1}]);
  const v = validateCandidate(candidateWith(params), space);
  assert.equal(v.valid, false);
  assert.ok(v.violations.some((x) => x.includes('not part of the declared parameter space')));
});

test('CV7 a broken lineage is INVALID', () => {
  const params = buildParameterSet([{path: 'budgets.maxReprices', value: 4}]);
  const brokenLineage = Object.freeze([{policyId: 'policy-execution', version: 'v2', kind: 'ROOT' as const}]);
  const c = candidateWith(params, {parentLineage: brokenLineage});
  const v = validateCandidate(c, space);
  assert.equal(v.valid, false);
  assert.ok(v.violations.some((x) => x.includes('lineage')));
});

test('CV8 non-monotonic lineage versions are INVALID', () => {
  const params = buildParameterSet([{path: 'budgets.maxReprices', value: 4}]);
  const weird = Object.freeze([
    {policyId: 'policy-execution', version: 'v1', kind: 'ROOT' as const},
    {policyId: 'policy-execution', version: 'v1.1', kind: 'CANDIDATE' as const},
    {policyId: 'policy-execution', version: 'v1.0', kind: 'CANDIDATE' as const},
  ]);
  const c = candidateWith(params, {parentLineage: weird});
  const v = validateCandidate(c, space);
  assert.equal(v.valid, false);
});

test('CV9 non-finite scores are INVALID', () => {
  const params = buildParameterSet([{path: 'budgets.maxReprices', value: 4}]);
  const c = candidateWith(params, {objectiveScore: Number.NaN});
  const v = validateCandidate(c, space);
  assert.equal(v.valid, false);
  assert.ok(v.violations.some((x) => x.includes('finite')));
});

test('CV10 the full baseline set (all 11 defaults, one lever moved) is VALID', () => {
  const base = baselineParameterSet(DEFAULT_EXECUTION_CONTROL_CONFIG, space);
  const entries = base.entries.map((e) =>
    e.path === 'adaptive.thresholds.rerouteThreshold' ? {path: e.path, value: 0.2} : {path: e.path, value: e.value});
  const params = buildParameterSet(entries);
  assert.equal(params.entries.length, space.length);
  const v = validateCandidate(candidateWith(params), space);
  assert.equal(v.valid, true, JSON.stringify(v.violations));
});

test('CV11 validation is deterministic', () => {
  const params = buildParameterSet([{path: 'hysteresis.sameActionCooldownCycles', value: 1}]);
  const a = validateCandidate(candidateWith(params), space);
  const b = validateCandidate(candidateWith(params), space);
  assert.deepEqual(a, b);
});

test('CV12 gate-updated candidates validate identically (state does not leak)', () => {
  const params = buildParameterSet([{path: 'hysteresis.sameActionCooldownCycles', value: 1}]);
  const c = withGateResults(candidateWith(params), {promotionState: 'ELIGIBLE'});
  const v = validateCandidate(c, space);
  assert.equal(v.valid, true);
});
