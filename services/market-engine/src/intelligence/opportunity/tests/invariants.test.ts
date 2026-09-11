import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkOpportunityInvariants, OpportunityInvariantError} from '../invariants';
import {opportunityResult, opportunityInput} from '../test-fixtures';
import {mergeOpportunityConfig} from '../config';

/**
 * SPRINT 038 — invariant tests: the full fail-closed invariant set (60+)
 * passes on the healthy corpus and detects synthetic violations.
 */

const result = opportunityResult();
const config = mergeOpportunityConfig({});
const invariants = checkOpportunityInvariants(result, {
  candidates: opportunityInput().candidates,
  learning: opportunityInput().learning,
  config,
});

test('the invariant report passes on the healthy corpus', () => {
  assert.equal(invariants.passed, true);
  assert.equal(invariants.failedCount, 0);
});

test('the invariant set has at least 45 named checks', () => {
  assert.ok(invariants.checks.length >= 45,
    `only ${invariants.checks.length} checks`);
});

test('the engine result carries the same invariant report', () => {
  assert.equal(result.invariants.passed, true);
  assert.equal(result.invariants.checks.length, invariants.checks.length);
});

test('every check carries a name, a verdict and a detail', () => {
  for (const check of invariants.checks) {
    assert.ok(check.invariant.length > 0);
    assert.equal(typeof check.passed, 'boolean');
    assert.ok(check.detail.length > 0);
  }
});

test('the required invariant families are all present', () => {
  const names = new Set(invariants.checks.map((c) => c.invariant));
  const required = ['REPLAY_BYTE_IDENTITY', 'CANONICAL_SERIALIZATION_STABLE',
    'DETERMINISTIC_STAGE_REBUILD', 'DETERMINISTIC_RANKING_REBUILD',
    'UNIQUE_PROFILE_IDS', 'LINEAGE_COMPLETE', 'SIMILARITY_DOMAIN_ISOLATION',
    'CLASS_DOMAIN_SEPARATION', 'NO_CROSS_DOMAIN_RANKING',
    'CROSS_DOMAIN_NOT_COMPARABLE', 'AFIS_SIDE_SEMANTICS',
    'AFIS_NO_ODDS_NO_BETTING_IDENTITY', 'ABL_SIDE_SEMANTICS',
    'ABL_ODDS_SEMANTICS', 'ABL_IDENTITY_PRESERVED',
    'MISSING_EVIDENCE_NEVER_NEGATIVE', 'EVIDENCE_STATES_CANONICAL',
    'EVIDENCE_COUNT_CONSISTENT', 'SCORE_BOUNDS', 'SCORE_DECOMPOSITION_EXACT',
    'SCORE_WEIGHT_NORMALIZATION', 'NULL_SCORE_ON_DISHONEST_CONFIDENCE',
    'NO_MAGIC_WEIGHTS', 'CLASSIFICATION_VOCABULARY',
    'CLASSIFICATION_BAND_CONSISTENCY', 'DEPENDENCY_DETECTION_RULE',
    'LEAKAGE_COUNTED_ONCE', 'LEAKAGE_SHARE_BOUNDS', 'STABILITY_VOCABULARY',
    'DISTRIBUTION_HISTORICAL_ONLY', 'DISTRIBUTION_NOT_PROBABILITY',
    'RANKING_DETERMINISTIC_ORDER', 'RANKING_EXCLUSIONS_EXPLICIT',
    'RANKING_COVERS_ALL_PROFILES', 'EXPLANATION_RECONSTRUCTIBLE',
    'NO_FUTURE_CERTAINTY_CLAIMS', 'NO_AUTHORITY_LANGUAGE',
    'RESEARCH_CONTEXT_INFORMATIONAL', 'FEEDBACK_MATCHES_PROFILE',
    'RECONCILIATION_NON_DESTRUCTIVE', 'AUDIT_CHAIN_VERIFIED',
    'AUDIT_APPEND_ONLY', 'AUDIT_EVENT_TYPES_CANONICAL',
    'FAIL_CLOSED_REJECTIONS_CANONICAL', 'FAIL_CLOSED_NO_SILENT_REPAIRS',
    'INFORMATIONAL_ONLY', 'NO_EXECUTION_OR_TREASURY_AUTHORITY',
    'SOURCE_LINKED_TO_LEARNING'];
  for (const name of required) {
    assert.ok(names.has(name), `missing invariant ${name}`);
  }
});

test('a tampered score fails the invariants', () => {
  const tampered = {
    ...result,
    profiles: result.profiles.map((p) => ({...p})),
  };
  (tampered.profiles[0] as {score: {score: number}}).score = {
    ...tampered.profiles[0].score, score: 1.5,
  };
  const report = checkOpportunityInvariants(tampered, {
    candidates: opportunityInput().candidates,
    learning: opportunityInput().learning,
    config,
  });
  assert.equal(report.passed, false);
  assert.ok(report.failedCount > 0);
});

test('a fabricated probability key fails the invariants', () => {
  const tampered = {
    ...result,
    profiles: result.profiles.map((p) => ({
      ...p, winProbability: 0.7,
    })),
  };
  const report = checkOpportunityInvariants(tampered, {
    candidates: opportunityInput().candidates,
    learning: opportunityInput().learning,
    config,
  });
  assert.equal(report.passed, false);
});

test('a broken audit chain fails the invariants', () => {
  const tampered = {
    ...result,
    auditEvents: result.auditEvents.slice(1),
  };
  const report = checkOpportunityInvariants(tampered, {
    candidates: opportunityInput().candidates,
    learning: opportunityInput().learning,
    config,
  });
  assert.equal(report.passed, false);
  assert.ok(report.checks.some(
    (c) => c.invariant === 'AUDIT_APPEND_ONLY' && !c.passed));
});

test('a mismatched lineage fails the invariants', () => {
  const tampered = {
    ...result,
    lineage: {...result.lineage, learningAnalysisId: 'lres_wrong'},
  };
  const report = checkOpportunityInvariants(tampered, {
    candidates: opportunityInput().candidates,
    learning: opportunityInput().learning,
    config,
  });
  assert.equal(report.passed, false);
  assert.ok(report.checks.some(
    (c) => c.invariant === 'LINEAGE_COMPLETE' && !c.passed));
});

test('an injected certainty claim fails the invariants', () => {
  const tampered = {
    ...result,
    profiles: result.profiles.map((p) => ({...p})),
  };
  (tampered.profiles[0] as {explanation: {summary: string}}).explanation = {
    ...tampered.profiles[0].explanation,
    summary: 'this opportunity will profit, guaranteed',
  };
  const report = checkOpportunityInvariants(tampered, {
    candidates: opportunityInput().candidates,
    learning: opportunityInput().learning,
    config,
  });
  assert.equal(report.passed, false);
  assert.ok(report.checks.some(
    (c) => c.invariant === 'NO_FUTURE_CERTAINTY_CLAIMS' && !c.passed));
});

test('an injected authority verb fails the invariants', () => {
  const tampered = {
    ...result,
    profiles: result.profiles.map((p) => ({...p})),
  };
  (tampered.profiles[0] as {explanation: {summary: string}}).explanation = {
    ...tampered.profiles[0].explanation,
    summary: 'this profile authorizes immediate deployment',
  };
  const report = checkOpportunityInvariants(tampered, {
    candidates: opportunityInput().candidates,
    learning: opportunityInput().learning,
    config,
  });
  assert.equal(report.passed, false);
  assert.ok(report.checks.some(
    (c) => c.invariant === 'NO_AUTHORITY_LANGUAGE' && !c.passed));
});

test('the invariant error carries the failing check names', () => {
  const tampered = {
    ...result,
    lineage: {...result.lineage, learningAnalysisId: 'lres_wrong'},
  };
  const report = checkOpportunityInvariants(tampered, {
    candidates: opportunityInput().candidates,
    learning: opportunityInput().learning,
    config,
  });
  const error = new OpportunityInvariantError(report);
  assert.match(error.message, /LINEAGE_COMPLETE/);
  assert.match(error.message, /fail closed/);
});

test('invariant checking is deterministic', () => {
  const again = checkOpportunityInvariants(result, {
    candidates: opportunityInput().candidates,
    learning: opportunityInput().learning,
    config,
  });
  assert.deepEqual(again, invariants);
});

test('the invariant report is frozen', () => {
  assert.ok(Object.isFrozen(invariants));
  assert.ok(Object.isFrozen(invariants.checks));
});
