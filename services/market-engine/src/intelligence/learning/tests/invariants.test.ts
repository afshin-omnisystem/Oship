import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkLearningInvariants, LearningInvariantError} from '../invariants';
import {mergeLearningConfig} from '../config';
import {learningCorpus, learningInput} from '../test-fixtures';
import {LearningEngine} from '../engine';

/**
 * SPRINT 037 — invariant tests (§24): 47 hard fail-closed invariants enforced
 * on every analysis (≥40 required).
 */

const config = mergeLearningConfig();
const engineResult = new LearningEngine({}).analyze(learningInput());

const ALL_INVARIANTS = [
  'DETERMINISTIC_FEATURES', 'FEATURE_PROVENANCE', 'IMMUTABLE_OBSERVATIONS',
  'DETERMINISTIC_COHORTS', 'COMPARABILITY_ENFORCED', 'BASELINE_VALIDITY',
  'MINIMUM_SAMPLE_ENFORCED', 'NO_FABRICATED_CONFIDENCE', 'NO_FABRICATED_PROBABILITY',
  'NO_FABRICATED_EXPECTED_RETURN', 'EVIDENCE_PRESERVATION', 'CONTRADICTION_HANDLING',
  'STRATEGY_LEARNING_DETERMINISM', 'VENUE_LEARNING_DETERMINISM',
  'OPPORTUNITY_LEARNING_DETERMINISM', 'POLICY_LEARNING_DETERMINISM',
  'REGIME_DETERMINISM', 'DRIFT_DETERMINISM', 'STABILITY_DETERMINISM',
  'CAUSAL_SAFETY_ENFORCED', 'ASSOCIATIONAL_ONLY_DEFAULT', 'SIGNAL_IMMUTABILITY',
  'SIGNAL_LINEAGE', 'SIGNAL_EVIDENCE_REFERENCES', 'PRIORITY_DETERMINISM',
  'PRIORITY_INFORMATIONAL_ONLY', 'AFIS_SEMANTICS_PRESERVED',
  'ABL_BACK_LAY_SEMANTICS_PRESERVED', 'CROSS_DOMAIN_COMPARABILITY',
  'REPLAY_BYTE_IDENTITY', 'AUDIT_HASH_INTEGRITY', 'AUDIT_REORDER_DETECTION',
  'AUDIT_TRUNCATION_DETECTION', 'AUDIT_TAMPER_DETECTION', 'NO_TREASURY_MUTATION',
  'NO_PORTFOLIO_MUTATION', 'NO_RISK_MUTATION', 'NO_AEGIS_MUTATION',
  'NO_EXECUTION_MUTATION', 'NO_STRATEGY_REGISTRY_MUTATION', 'NO_ACTIVE_POLICY_MUTATION',
  'FAIL_CLOSED_ON_MALFORMED_HISTORY', 'FAIL_CLOSED_ON_INSUFFICIENT_EVIDENCE',
  'COMPLETION_NEVER_EQUALS_PRESERVATION', 'SIGNAL_INFORMATIONAL_ONLY',
  'FEEDBACK_INFORMATIONAL_ONLY', 'POLICY_CANDIDATE_NEVER_ACTIVE',
];

test('at least 40 invariants are enforced (47 present)', () => {
  assert.ok(engineResult.invariants.checks.length >= 40);
  assert.equal(engineResult.invariants.checks.length, 47);
});

test('every invariant passes on the fixture corpus', () => {
  assert.equal(engineResult.invariants.passed, true);
  assert.equal(engineResult.invariants.failedCount, 0);
  for (const check of engineResult.invariants.checks) {
    assert.equal(check.passed, true, `${check.invariant}: ${check.detail}`);
    assert.ok(check.detail.length > 0, check.invariant);
  }
});

test('the invariant set matches the required vocabulary exactly', () => {
  assert.deepEqual(
    engineResult.invariants.checks.map((c) => c.invariant).sort(),
    [...ALL_INVARIANTS].sort());
});

test('invariants can be re-checked independently and agree', () => {
  const report = checkLearningInvariants(engineResult,
    {research: learningCorpus(), config});
  assert.equal(report.passed, true);
  assert.equal(report.checks.length, 47);
  assert.deepEqual(report.checks.map((c) => c.invariant),
    engineResult.invariants.checks.map((c) => c.invariant));
});

test('LearningInvariantError lists every failed invariant', () => {
  const report = {
    passed: false, failedCount: 1,
    checks: [
      {invariant: 'DETERMINISTIC_FEATURES', passed: false, detail: 'vectors differ'},
      {invariant: 'SIGNAL_IMMUTABILITY', passed: true, detail: 'ok'},
    ],
  };
  const error = new LearningInvariantError(report as never);
  assert.match(error.message, /fail closed/);
  assert.match(error.message, /DETERMINISTIC_FEATURES: vectors differ/);
  assert.ok(!error.message.includes('SIGNAL_IMMUTABILITY: ok'));
});

test('determinism invariants cover every analytical stage', () => {
  const names = new Set(engineResult.invariants.checks.map((c) => c.invariant));
  for (const stage of ['DETERMINISTIC_FEATURES', 'DETERMINISTIC_COHORTS',
    'STRATEGY_LEARNING_DETERMINISM', 'VENUE_LEARNING_DETERMINISM',
    'OPPORTUNITY_LEARNING_DETERMINISM', 'POLICY_LEARNING_DETERMINISM',
    'REGIME_DETERMINISM', 'DRIFT_DETERMINISM', 'STABILITY_DETERMINISM',
    'PRIORITY_DETERMINISM', 'REPLAY_BYTE_IDENTITY']) {
    assert.ok(names.has(stage as never), stage);
  }
});

test('fabrication invariants forbid manufactured numbers', () => {
  const names = new Set(engineResult.invariants.checks.map((c) => c.invariant));
  for (const name of ['NO_FABRICATED_CONFIDENCE', 'NO_FABRICATED_PROBABILITY',
    'NO_FABRICATED_EXPECTED_RETURN']) {
    assert.ok(names.has(name as never), name);
  }
});

test('authority-mutation invariants cover all seven authorities', () => {
  const names = new Set(engineResult.invariants.checks.map((c) => c.invariant));
  for (const name of ['NO_TREASURY_MUTATION', 'NO_PORTFOLIO_MUTATION', 'NO_RISK_MUTATION',
    'NO_AEGIS_MUTATION', 'NO_EXECUTION_MUTATION', 'NO_STRATEGY_REGISTRY_MUTATION',
    'NO_ACTIVE_POLICY_MUTATION']) {
    assert.ok(names.has(name as never), name);
  }
});

test('the result JSON contains no fabricated probability or expected-return keys', () => {
  const json = JSON.stringify(engineResult);
  assert.ok(!/"probability"/.test(json));
  assert.ok(!/"expectedReturn"/.test(json));
  assert.ok(!/"expectedValue"/.test(json));
});

test('fail-closed invariants are present and passing', () => {
  const names = new Set(engineResult.invariants.checks.map((c) => c.invariant));
  for (const name of ['FAIL_CLOSED_ON_MALFORMED_HISTORY',
    'FAIL_CLOSED_ON_INSUFFICIENT_EVIDENCE', 'COMPLETION_NEVER_EQUALS_PRESERVATION',
    'POLICY_CANDIDATE_NEVER_ACTIVE', 'SIGNAL_INFORMATIONAL_ONLY',
    'FEEDBACK_INFORMATIONAL_ONLY']) {
    assert.ok(names.has(name as never), name);
  }
});

test('audit invariants are present and passing', () => {
  const names = new Set(engineResult.invariants.checks.map((c) => c.invariant));
  for (const name of ['AUDIT_HASH_INTEGRITY', 'AUDIT_REORDER_DETECTION',
    'AUDIT_TRUNCATION_DETECTION', 'AUDIT_TAMPER_DETECTION']) {
    assert.ok(names.has(name as never), name);
  }
});

test('domain-semantics invariants are present and passing', () => {
  const names = new Set(engineResult.invariants.checks.map((c) => c.invariant));
  for (const name of ['AFIS_SEMANTICS_PRESERVED', 'ABL_BACK_LAY_SEMANTICS_PRESERVED',
    'CROSS_DOMAIN_COMPARABILITY']) {
    assert.ok(names.has(name as never), name);
  }
});

test('signal integrity invariants are present and passing', () => {
  const names = new Set(engineResult.invariants.checks.map((c) => c.invariant));
  for (const name of ['SIGNAL_IMMUTABILITY', 'SIGNAL_LINEAGE',
    'SIGNAL_EVIDENCE_REFERENCES', 'CAUSAL_SAFETY_ENFORCED',
    'ASSOCIATIONAL_ONLY_DEFAULT']) {
    assert.ok(names.has(name as never), name);
  }
});

test('evidence integrity invariants are present and passing', () => {
  const names = new Set(engineResult.invariants.checks.map((c) => c.invariant));
  for (const name of ['EVIDENCE_PRESERVATION', 'CONTRADICTION_HANDLING',
    'IMMUTABLE_OBSERVATIONS', 'FEATURE_PROVENANCE', 'BASELINE_VALIDITY',
    'MINIMUM_SAMPLE_ENFORCED', 'COMPARABILITY_ENFORCED']) {
    assert.ok(names.has(name as never), name);
  }
});
