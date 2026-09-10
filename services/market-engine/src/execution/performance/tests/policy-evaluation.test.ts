import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupByPolicy, evaluatePolicy, evaluatePolicies, comparePolicies} from '../policy-evaluation';
import {canonicalObjective, DEFAULT_EXECUTION_PERFORMANCE_CONFIG} from '../config';
import {
  healthyRecord, driftedRecord, partialRecord, degradedRecord, emergencyRecord,
  staleRecord, ablRecord, perfRecord, perfPlan, healthyCycle,
} from '../test-fixtures';

/**
 * SPRINT 034 — policy evaluation tests: grouping, deterministic score,
 * sample sufficiency, comparison.
 */

const config = DEFAULT_EXECUTION_PERFORMANCE_CONFIG;
const objective = canonicalObjective(config);
const healthy = healthyRecord();
const drifted = driftedRecord();
const partial = partialRecord();

test('PE1 policies group by id+version', () => {
  const groups = groupByPolicy([healthy, drifted, partial]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]!.policyId, 'policy-execution');
  assert.equal(groups[0]!.version, 'v1');
  assert.equal(groups[0]!.records.length, 3);
});

test('PE2 different policy versions form separate groups', () => {
  const v1 = perfRecord({label: 'v1', plan: perfPlan({planId: 'xplan_pe1'}), cycles: [healthyCycle('c0', perfPlan({planId: 'xplan_pe1'}))], policyVersion: 'v1'});
  const v2 = perfRecord({label: 'v2', plan: perfPlan({planId: 'xplan_pe2'}), cycles: [healthyCycle('c0', perfPlan({planId: 'xplan_pe2'}))], policyVersion: 'v2'});
  const groups = groupByPolicy([v1, v2]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((g) => g.version).sort(), ['v1', 'v2']);
});

test('PE3 evaluatePolicy produces all declared fields', () => {
  const group = groupByPolicy([healthy, drifted, partial])[0]!;
  const pe = evaluatePolicy(group, config, objective);
  assert.ok(pe.observationCount >= 3);
  assert.equal(pe.sessionCount, 3);
  assert.ok(Number.isFinite(pe.successRate));
  assert.ok(Number.isFinite(pe.executionQuality));
  assert.ok(Number.isFinite(pe.totalCost));
  assert.ok(Number.isFinite(pe.averageSlippageBps));
  assert.ok(Number.isFinite(pe.averageLatencyMs));
  assert.ok(Number.isFinite(pe.adaptationCount));
  assert.ok(Number.isFinite(pe.failureCount));
  assert.ok(Number.isFinite(pe.recoveryRate));
  assert.ok(Number.isFinite(pe.benchmarkDeltaBps));
  assert.ok(Number.isFinite(pe.score));
  assert.ok(typeof pe.sufficientSamples === 'boolean');
  assert.ok(pe.fingerprint.length >= 8);
});

test('PE4 sample sufficiency follows minPolicySessions', () => {
  const one = groupByPolicy([healthy])[0]!;
  const pe1 = evaluatePolicy(one, config, objective);
  assert.equal(pe1.sufficientSamples, false);

  const enough = groupByPolicy([healthy, drifted, partial, degradedRecord()])[0]!;
  const pe2 = evaluatePolicy(enough, config, objective);
  assert.equal(pe2.sufficientSamples, true);
});

test('PE5 failures lower the policy score', () => {
  const clean = evaluatePolicy(groupByPolicy([healthy, drifted])[0]!, config, objective);
  const dirty = evaluatePolicy(groupByPolicy([healthy, staleRecord(), emergencyRecord('es4')])[0]!, config, objective);
  assert.ok(dirty.score < clean.score, `${dirty.score} !< ${clean.score}`);
});

test('PE6 evaluatePolicies covers every group', () => {
  const v1 = perfRecord({label: 'a', plan: perfPlan({planId: 'xplan_pe6a'}), cycles: [healthyCycle('c0', perfPlan({planId: 'xplan_pe6a'}))], policyVersion: 'v1'});
  const v2 = perfRecord({label: 'b', plan: perfPlan({planId: 'xplan_pe6b'}), cycles: [healthyCycle('c0', perfPlan({planId: 'xplan_pe6b'}))], policyVersion: 'v2'});
  const list = evaluatePolicies([v1, v2, healthy], config, objective);
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((p) => p.version).sort(), ['v1', 'v2']);
});

test('PE7 policy evaluation is deterministic', () => {
  const a = evaluatePolicies([healthy, drifted, partial], config, objective);
  const b = evaluatePolicies([healthy, drifted, partial], config, objective);
  assert.deepEqual(a.map((p) => p.fingerprint), b.map((p) => p.fingerprint));
});

test('PE8 policy evaluation is immutable', () => {
  const list = evaluatePolicies([healthy, drifted], config, objective);
  assert.ok(Object.isFrozen(list));
  for (const p of list) assert.ok(Object.isFrozen(p));
});

test('PE9 comparePolicies prefers the higher score deterministically', () => {
  const v1 = perfRecord({label: 'a', plan: perfPlan({planId: 'xplan_pe9a'}), cycles: [healthyCycle('c0', perfPlan({planId: 'xplan_pe9a'}))], policyVersion: 'v1'});
  const v2 = perfRecord({label: 'b', plan: perfPlan({planId: 'xplan_pe9b'}), cycles: [healthyCycle('c0', perfPlan({planId: 'xplan_pe9b'}))], policyId: 'policy-alt', policyVersion: 'v1'});
  const [a, b] = evaluatePolicies([v1, v2], config, objective);
  const cmp = comparePolicies(a!, b!);
  assert.ok(cmp.better === null || cmp.better === a!.policyId || cmp.better === b!.policyId);
  assert.ok(cmp.detail.length > 0);
  assert.deepEqual(cmp, comparePolicies(a!, b!));
});

test('PE10 ABL sessions evaluate under the same policy machinery', () => {
  const pe = evaluatePolicy(groupByPolicy([ablRecord(), healthy])[0]!, config, objective);
  assert.equal(pe.sessionCount, 2);
  assert.ok(Number.isFinite(pe.score));
});

test('PE11 adaptation counts aggregate the action budgets', () => {
  const pe = evaluatePolicy(groupByPolicy([healthy, partial])[0]!, config, objective);
  const expected = [healthy, partial].reduce((s, r) =>
    s + r.session.actionBudget.repriceCount + r.session.actionBudget.resliceCount
    + r.session.actionBudget.rerouteCount + r.session.actionBudget.replanCount, 0);
  assert.equal(pe.adaptationCount, expected);
});

test('PE12 a policy with only aborting sessions cannot outscore healthy ones', () => {
  const aborted = evaluatePolicy(groupByPolicy([staleRecord(), emergencyRecord('es5')])[0]!, config, objective);
  const good = evaluatePolicy(groupByPolicy([healthy, drifted, partial])[0]!, config, objective);
  assert.ok(aborted.score < good.score);
});
