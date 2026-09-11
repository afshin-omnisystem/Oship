import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkDecisionInvariants, DecisionInvariantError} from '../invariants';
import {afisDecisionResult, ablDecisionResult, ablThinDecisionResult,
  afisDecisionInput, opportunityLearning} from '../test-fixtures';
import {DecisionIntelligenceEngine} from '../engine';
import {DEFAULT_DECISION_CONFIG} from '../config';

/**
 * SPRINT 039 — invariant tests: ≥50 hard fail-closed checks over every
 * analysis; the suite runs repeatedly (three fixture results, each verified
 * on every engine run).
 */

test('the invariant report carries at least 50 named checks', () => {
  assert.ok(afisDecisionResult().invariants.checks.length >= 50,
    `got ${afisDecisionResult().invariants.checks.length}`);
});

test('every fixture result passes all invariants', () => {
  for (const result of [afisDecisionResult(), ablDecisionResult(),
    ablThinDecisionResult()]) {
    assert.equal(result.invariants.passed, true);
    assert.equal(result.invariants.failedCount, 0);
  }
});

test('every check carries a name, a verdict and a detail', () => {
  for (const check of afisDecisionResult().invariants.checks) {
    assert.ok(check.invariant.length > 0);
    assert.equal(typeof check.passed, 'boolean');
    assert.ok(check.detail.length > 0);
  }
});

test('the required invariant families are all present', () => {
  const names = new Set(afisDecisionResult().invariants.checks.map(
    (c) => c.invariant));
  const required = ['DETERMINISTIC_ANALYSIS_ID', 'CANONICAL_SERIALIZATION',
    'REPLAY_BYTE_IDENTITY', 'DOMAIN_ISOLATION', 'NO_CROSS_DOMAIN_RANKING',
    'AFIS_NO_BETTING_SEMANTICS', 'ABL_SIDE_SEMANTICS_PRESERVED',
    'BASELINE_PRESENT', 'ALL_ACCEPTED_COMPATIBLE', 'EVIDENCE_COUNTS_CONSISTENT',
    'MISSING_EVIDENCE_BLOCKS_SCORING', 'NULL_SCORE_ON_DISHONEST_CONFIDENCE',
    'TRADE_OFF_BOUNDS', 'TRADE_OFF_DECOMPOSITION_EXACT',
    'TRADE_OFF_WEIGHT_NORMALIZATION', 'NO_MAGIC_WEIGHTS', 'DOMINANCE_STATE_LEGAL',
    'RECOMMENDATION_STATUS_LEGAL', 'RECOMMENDATION_DISCLAIMER_EXACT',
    'CONFLICT_PRESERVATION', 'REGIME_DEPENDENCY_PRESERVED',
    'STRATEGY_DEPENDENCY_PRESERVED', 'VENUE_DEPENDENCY_PRESERVED',
    'LEAKAGE_COUNTED_EXACTLY_ONCE', 'STABILITY_INTERPRETATIONS_LEGAL',
    'RANKING_DETERMINISTIC_ORDER', 'EXPLANATION_COMPLETE', 'REPLAY_BYTE_IDENTITY',
    'AUDIT_CHAIN_VALID', 'NO_FUTURE_CERTAINTY_CLAIMS', 'NO_AUTHORITY_LANGUAGE',
    'NO_EXECUTION_AUTHORITY', 'BACK_LAY_NEVER_COLLAPSED'];
  for (const name of required) {
    assert.ok(names.has(name), `${name} must be an invariant`);
  }
});

test('the invariant suite runs repeatedly and stays green', () => {
  for (let i = 0; i < 3; i++) {
    const result = checkDecisionInvariants(afisDecisionResult(), {
      baseCandidate: afisDecisionInput().baseCandidate,
      alternativeSpecs: afisDecisionInput().alternatives,
      learning: opportunityLearning(),
      config: DEFAULT_DECISION_CONFIG,
    });
    assert.equal(result.passed, true);
  }
});

test('a tampered result fails the invariants', () => {
  const result = afisDecisionResult();
  const tampered = {
    ...result,
    recommendation: {...result.recommendation, informational: false as never},
  };
  const report = checkDecisionInvariants(tampered, {
    baseCandidate: afisDecisionInput().baseCandidate,
    alternativeSpecs: afisDecisionInput().alternatives,
    learning: opportunityLearning(),
    config: DEFAULT_DECISION_CONFIG,
  });
  assert.equal(report.passed, false);
  assert.ok(report.failedCount > 0);
});

test('the invariant error carries the failed check names', () => {
  const result = afisDecisionResult();
  const tampered = {
    ...result,
    dominance: {...result.dominance, state: 'MAGIC' as never},
  };
  const report = checkDecisionInvariants(tampered, {
    baseCandidate: afisDecisionInput().baseCandidate,
    alternativeSpecs: afisDecisionInput().alternatives,
    learning: opportunityLearning(),
    config: DEFAULT_DECISION_CONFIG,
  });
  assert.throws(() => {
    if (!report.passed) throw new DecisionInvariantError(report);
  }, /DOMINANCE_STATE_LEGAL/);
});

test('fresh engine runs re-verify invariants internally', () => {
  const engine = new DecisionIntelligenceEngine({});
  const fresh = engine.analyze(afisDecisionInput());
  assert.equal(fresh.invariants.passed, true);
  assert.ok(fresh.invariants.checks.length >= 50);
});

test('invariant reports are deterministic', () => {
  const a = checkDecisionInvariants(afisDecisionResult(), {
    baseCandidate: afisDecisionInput().baseCandidate,
    alternativeSpecs: afisDecisionInput().alternatives,
    learning: opportunityLearning(),
    config: DEFAULT_DECISION_CONFIG,
  });
  const b = checkDecisionInvariants(afisDecisionResult(), {
    baseCandidate: afisDecisionInput().baseCandidate,
    alternativeSpecs: afisDecisionInput().alternatives,
    learning: opportunityLearning(),
    config: DEFAULT_DECISION_CONFIG,
  });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('the invariant count is exactly the engine-verified count', () => {
  const engine = new DecisionIntelligenceEngine({});
  const fresh = engine.analyze(afisDecisionInput());
  assert.equal(fresh.invariants.checks.length,
    afisDecisionResult().invariants.checks.length);
});

test('failed invariant counts reconcile with the failed checks', () => {
  const result = afisDecisionResult();
  const failed = result.invariants.checks.filter((c) => !c.passed).length;
  assert.equal(result.invariants.failedCount, failed);
  assert.equal(failed, 0);
});

test('the no-certainty invariant scans every narrative statement', () => {
  const check = afisDecisionResult().invariants.checks.find(
    (c) => c.invariant === 'NO_FUTURE_CERTAINTY_CLAIMS');
  assert.ok(check);
  assert.ok(check.detail.includes('narrative statements'));
});

test('the no-execution-authority invariant denies credential surfaces', () => {
  const check = afisDecisionResult().invariants.checks.find(
    (c) => c.invariant === 'NO_EXECUTION_AUTHORITY');
  assert.ok(check);
  assert.ok(check.passed);
});

test('the audit-coverage invariant requires the lifecycle events', () => {
  const check = afisDecisionResult().invariants.checks.find(
    (c) => c.invariant === 'AUDIT_COVERS_LIFECYCLE');
  assert.ok(check);
  assert.ok(check.passed);
});

test('spec coverage invariants reconcile accepted and rejected', () => {
  const check = afisDecisionResult().invariants.checks.find(
    (c) => c.invariant === 'SPEC_COVERAGE');
  assert.ok(check);
  assert.ok(check.passed);
});

test('the ABL result passes the same invariant families', () => {
  const names = new Set(ablDecisionResult().invariants.checks.map(
    (c) => c.invariant));
  assert.ok(names.has('ABL_SIDE_SEMANTICS_PRESERVED'));
  assert.ok(names.has('AFIS_NO_BETTING_SEMANTICS'));
});
