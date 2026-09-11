import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePromotionGate, isApprovable, describePromotion} from '../promotion-gate';
import {createPolicyCandidate, withGateResults} from '../candidate';
import {buildParameterSet} from '../parameter-space';
import {DEFAULT_EXECUTION_PERFORMANCE_CONFIG, mergeExecutionPerformanceConfig} from '../config';
import {runSimulationGate} from '../simulation-gate';
import {evaluateRegressionGate} from '../regression-gate';
import {applyParameterSet} from '../parameter-space';
import {DEFAULT_EXECUTION_CONTROL_CONFIG} from '../../control/config';
import {canonicalObjective} from '../config';
import {flipFlopRecord, healthyRecord, perfProbes} from '../test-fixtures';

/**
 * SPRINT 034 — promotion gate tests: the full state machine
 * INSUFFICIENT_DATA → REJECTED → SIMULATION_FAILED → REGRESSION_FAILED
 * → IMPROVEMENT_INSUFFICIENT → ELIGIBLE → APPROVED_CANDIDATE (explicit only).
 */

const objective = canonicalObjective(DEFAULT_EXECUTION_PERFORMANCE_CONFIG);
const params = buildParameterSet([{path: 'adaptive.thresholds.rerouteThreshold', value: 0.2}]);
const parentLineage = Object.freeze([{policyId: 'policy-execution', version: 'v1', kind: 'ROOT' as const}]);

function candidate(overrides: {observedSampleSize?: number; objectiveScore?: number; baselineScore?: number; promotionState?: ReturnType<typeof withGateResults>['promotionState']} = {}) {
  return withGateResults(createPolicyCandidate({
    parentPolicyId: 'policy-execution',
    parentPolicyVersion: 'v1',
    candidateIndex: 1,
    domain: 'CROSS_DOMAIN',
    parameters: params,
    objectiveScore: overrides.objectiveScore ?? 0.5,
    baselineScore: overrides.baselineScore ?? 0.3,
    observedSampleSize: overrides.observedSampleSize ?? 5,
    createdAt: 1_704_067_200_000,
    parentLineage,
  }), overrides.promotionState ? {promotionState: overrides.promotionState} : {});
}

function validResult() {
  return {valid: true as const, violations: [] as string[]};
}

test('PG1 insufficient observations → INSUFFICIENT_DATA', () => {
  const g = evaluatePromotionGate({
    candidate: candidate({observedSampleSize: 1}),
    validation: validResult(),
    comparison: null,
    regression: null,
    config: DEFAULT_EXECUTION_PERFORMANCE_CONFIG,
  });
  assert.equal(g.state, 'INSUFFICIENT_DATA');
  assert.equal(g.eligible, false);
  assert.ok(g.reasons.some((r) => r.includes('sample size')));
});

test('PG2 invalid candidate → REJECTED', () => {
  const g = evaluatePromotionGate({
    candidate: candidate(),
    validation: {valid: false, violations: ['limits.maxSlippageBps is protected']},
    comparison: null,
    regression: null,
    config: DEFAULT_EXECUTION_PERFORMANCE_CONFIG,
  });
  assert.equal(g.state, 'REJECTED');
  assert.ok(g.reasons.some((r) => r.includes('protected')));
});

test('PG3 missing simulation → SIMULATION_FAILED', () => {
  const g = evaluatePromotionGate({
    candidate: candidate(),
    validation: validResult(),
    comparison: null,
    regression: null,
    config: DEFAULT_EXECUTION_PERFORMANCE_CONFIG,
  });
  assert.equal(g.state, 'SIMULATION_FAILED');
});

test('PG4 failed regression → REGRESSION_FAILED (safety before performance)', () => {
  const g = evaluatePromotionGate({
    candidate: candidate({objectiveScore: 0.9, baselineScore: 0.1}),
    validation: validResult(),
    comparison: {delta: {objectiveDelta: 0.8}} as never,
    regression: {passed: false, violations: ['FAIL_CLOSED_BEHAVIOR: all-stale market COMPLETED'], checks: [], fingerprint: 'x'},
    config: DEFAULT_EXECUTION_PERFORMANCE_CONFIG,
  });
  assert.equal(g.state, 'REGRESSION_FAILED');
  assert.ok(g.reasons.some((r) => r.includes('FAIL_CLOSED_BEHAVIOR')));
});

test('PG5 improvement below the threshold → IMPROVEMENT_INSUFFICIENT', () => {
  const g = evaluatePromotionGate({
    candidate: candidate({objectiveScore: 0.31, baselineScore: 0.3}),
    validation: validResult(),
    comparison: {delta: {objectiveDelta: 0.01}} as never,
    regression: {passed: true, violations: [], checks: [], fingerprint: 'x'},
    config: DEFAULT_EXECUTION_PERFORMANCE_CONFIG,
  });
  assert.equal(g.state, 'IMPROVEMENT_INSUFFICIENT');
  assert.equal(g.eligible, false);
});

test('PG6 a genuinely better, safe candidate → ELIGIBLE', () => {
  const g = evaluatePromotionGate({
    candidate: candidate({objectiveScore: 0.5, baselineScore: 0.3}),
    validation: validResult(),
    comparison: {delta: {objectiveDelta: 0.2}} as never,
    regression: {passed: true, violations: [], checks: [], fingerprint: 'x'},
    config: DEFAULT_EXECUTION_PERFORMANCE_CONFIG,
  });
  assert.equal(g.state, 'ELIGIBLE');
  assert.equal(g.eligible, true);
});

test('PG7 improvement thresholds are configurable', () => {
  const strict = mergeExecutionPerformanceConfig({minImprovement: 0.9});
  const g = evaluatePromotionGate({
    candidate: candidate({objectiveScore: 0.5, baselineScore: 0.3}),
    validation: validResult(),
    comparison: {delta: {objectiveDelta: 0.2}} as never,
    regression: {passed: true, violations: [], checks: [], fingerprint: 'x'},
    config: strict,
  });
  assert.equal(g.state, 'IMPROVEMENT_INSUFFICIENT');
});

test('PG8 ELIGIBLE requires BOTH relative and absolute improvement', () => {
  // Large relative improvement but tiny absolute delta.
  const g = evaluatePromotionGate({
    candidate: candidate({objectiveScore: 0.0105, baselineScore: 0.01}),
    validation: validResult(),
    comparison: {delta: {objectiveDelta: 0.0005}} as never,
    regression: {passed: true, violations: [], checks: [], fingerprint: 'x'},
    config: DEFAULT_EXECUTION_PERFORMANCE_CONFIG,
  });
  assert.equal(g.state, 'IMPROVEMENT_INSUFFICIENT');
});

test('PG9 the gate is deterministic', () => {
  const input = () => ({
    candidate: candidate({objectiveScore: 0.5, baselineScore: 0.3}),
    validation: validResult(),
    comparison: {delta: {objectiveDelta: 0.2}} as never,
    regression: {passed: true, violations: [], checks: [], fingerprint: 'x'},
    config: DEFAULT_EXECUTION_PERFORMANCE_CONFIG,
  });
  const a = evaluatePromotionGate(input());
  const b = evaluatePromotionGate(input());
  assert.equal(a.fingerprint, b.fingerprint);
  assert.deepEqual(a.reasons, b.reasons);
});

test('PG10 isApprovable only for ELIGIBLE candidates', () => {
  assert.equal(isApprovable(candidate()), false);
  assert.equal(isApprovable(candidate({promotionState: 'ELIGIBLE'})), true);
  assert.equal(isApprovable(candidate({promotionState: 'APPROVED_CANDIDATE'})), false);
  assert.equal(isApprovable(candidate({promotionState: 'REJECTED'})), false);
});

test('PG11 describePromotion renders a deterministic summary', () => {
  const g = evaluatePromotionGate({
    candidate: candidate({observedSampleSize: 1}),
    validation: validResult(),
    comparison: null,
    regression: null,
    config: DEFAULT_EXECUTION_PERFORMANCE_CONFIG,
  });
  const text = describePromotion(g);
  assert.ok(text.includes('INSUFFICIENT_DATA'));
  assert.equal(text, describePromotion(g));
});

test('PG12 end-to-end: the real lever candidate reaches ELIGIBLE', () => {
  const flip = flipFlopRecord(7);
  const healthy = healthyRecord();
  const corpus = [flip, healthy].map((r) => ({
    label: r.label, plan: r.replayInput!.plan, cycles: r.replayInput!.cycles,
    startTime: r.session.cycles[0]?.startedAt,
  }));
  const arms = runSimulationGate({
    corpus,
    baselineConfig: DEFAULT_EXECUTION_CONTROL_CONFIG,
    candidateConfig: applyParameterSet(DEFAULT_EXECUTION_CONTROL_CONFIG, params),
    candidateLabel: 'pg-e2e',
    objective,
  });
  const regression = evaluateRegressionGate({
    candidateParameters: params,
    candidateSessions: arms.candidateSessions,
    initialPlans: arms.candidateSessions.map((s, i) => ({plan: corpus[i]!.plan, session: s})),
    probes: {
      emergencyStop: perfProbes().emergencyStop,
      staleMarket: perfProbes().staleMarket,
      replay: {plan: corpus[0]!.plan, cycles: corpus[0]!.cycles},
    },
    candidateConfig: applyParameterSet(DEFAULT_EXECUTION_CONTROL_CONFIG, params),
  });
  const c = withGateResults(createPolicyCandidate({
    parentPolicyId: 'policy-execution', parentPolicyVersion: 'v1', candidateIndex: 1,
    domain: 'CROSS_DOMAIN', parameters: params,
    objectiveScore: arms.comparison.candidate.objectiveScore,
    baselineScore: arms.comparison.baseline.objectiveScore,
    observedSampleSize: 2, createdAt: 1_704_067_200_000, parentLineage,
  }), {validationStatus: 'VALID', simulationStatus: 'PASSED', regressionStatus: regression.passed ? 'PASSED' : 'FAILED'});
  const g = evaluatePromotionGate({candidate: c, validation: validResult(), comparison: arms.comparison, regression, config: DEFAULT_EXECUTION_PERFORMANCE_CONFIG});
  assert.equal(regression.passed, true);
  assert.equal(g.state, 'ELIGIBLE');
  assert.ok(arms.comparison.delta.objectiveDelta >= DEFAULT_EXECUTION_PERFORMANCE_CONFIG.minAbsoluteImprovement);
});
