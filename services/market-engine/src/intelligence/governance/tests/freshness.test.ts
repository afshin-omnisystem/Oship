import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateFreshnessGate, freshnessOf, aggregateFreshness}
  from '../freshness-gate';
import {DEFAULT_GOVERNANCE_CONFIG, mergeGovernanceConfig} from '../config';
import {
  liqDominantDecisionResult, staleDecisionResult, agingDecisionResult,
  unknownFreshnessDecisionResult, governanceClone,
} from '../test-fixtures';

/**
 * SPRINT 040 — freshness gate tests: FRESH, AGING, STALE, UNKNOWN; policy
 * overrides; never-silent-FRESH guarantees.
 */

const DAY = 24 * 60 * 60 * 1000;

test('a real fresh decision result is FRESH', () => {
  const gate = evaluateFreshnessGate(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'FRESH');
  assert.equal(gate.outcome, 'PASS');
});

test('the corpus evidence age is one day (within FRESH)', () => {
  const gate = evaluateFreshnessGate(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.oldestEvidenceAge, DAY);
});

test('aged evidence maps to AGING with limitations', () => {
  const gate = evaluateFreshnessGate(agingDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'AGING');
  assert.equal(gate.outcome, 'PASS_WITH_LIMITATIONS');
});

test('stale evidence maps to STALE and blocks', () => {
  const gate = evaluateFreshnessGate(staleDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'STALE');
  assert.equal(gate.outcome, 'BLOCK');
  assert.equal(gate.code, 'STALE_EVIDENCE');
});

test('stale evidence passes analytical-only under explicit policy', () => {
  const config = mergeGovernanceConfig({allowStaleAnalyticalOnly: true});
  const gate = evaluateFreshnessGate(staleDecisionResult(), config);
  assert.equal(gate.state, 'STALE');
  assert.equal(gate.outcome, 'PASS_WITH_LIMITATIONS');
  assert.match(gate.reasons.join(' '), /analytical-only/);
});

test('unknown freshness maps to UNKNOWN and blocks', () => {
  const gate = evaluateFreshnessGate(unknownFreshnessDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'UNKNOWN');
  assert.equal(gate.outcome, 'BLOCK');
  assert.match(gate.reasons.join(' '), /never silently/);
});

test('unknown freshness passes analytical-only under explicit policy', () => {
  const config = mergeGovernanceConfig(
    {allowUnknownFreshnessAnalyticalOnly: true});
  const gate = evaluateFreshnessGate(unknownFreshnessDecisionResult(),
    config);
  assert.equal(gate.state, 'UNKNOWN');
  assert.equal(gate.outcome, 'PASS_WITH_LIMITATIONS');
});

test('freshnessOf derives FRESH below the aging threshold', () => {
  assert.equal(freshnessOf(DAY, 'FRESH', 'MODERATE',
    DEFAULT_GOVERNANCE_CONFIG), 'FRESH');
});

test('freshnessOf derives AGING between the thresholds', () => {
  assert.equal(freshnessOf(4 * DAY, 'FRESH', 'MODERATE',
    DEFAULT_GOVERNANCE_CONFIG), 'AGING');
});

test('freshnessOf derives STALE above the stale threshold', () => {
  assert.equal(freshnessOf(8 * DAY, 'FRESH', 'MODERATE',
    DEFAULT_GOVERNANCE_CONFIG), 'STALE');
});

test('a reported STALE evidence profile maps to STALE', () => {
  assert.equal(freshnessOf(0, 'STALE', 'MODERATE',
    DEFAULT_GOVERNANCE_CONFIG), 'STALE');
});

test('a STALE confidence state maps to STALE', () => {
  assert.equal(freshnessOf(0, 'FRESH', 'STALE',
    DEFAULT_GOVERNANCE_CONFIG), 'STALE');
});

test('an UNKNOWN confidence state maps to UNKNOWN', () => {
  assert.equal(freshnessOf(0, 'FRESH', 'UNKNOWN',
    DEFAULT_GOVERNANCE_CONFIG), 'UNKNOWN');
});

test('an unmeasurable age maps to UNKNOWN even when reported FRESH', () => {
  assert.equal(freshnessOf(-1, 'FRESH', 'MODERATE',
    DEFAULT_GOVERNANCE_CONFIG), 'UNKNOWN');
  assert.equal(freshnessOf(null, 'FRESH', 'MODERATE',
    DEFAULT_GOVERNANCE_CONFIG), 'UNKNOWN');
  assert.equal(freshnessOf(Number.NaN, 'FRESH', 'MODERATE',
    DEFAULT_GOVERNANCE_CONFIG), 'UNKNOWN');
});

test('a non-FRESH non-STALE report maps to UNKNOWN', () => {
  assert.equal(freshnessOf(DAY, undefined, 'MODERATE',
    DEFAULT_GOVERNANCE_CONFIG), 'UNKNOWN');
});

test('aggregateFreshness takes the worst state', () => {
  const config = DEFAULT_GOVERNANCE_CONFIG;
  assert.equal(aggregateFreshness([DAY, DAY], ['FRESH', 'FRESH'],
    ['MODERATE', 'MODERATE'], config), 'FRESH');
  assert.equal(aggregateFreshness([DAY, 4 * DAY], ['FRESH', 'FRESH'],
    ['MODERATE', 'MODERATE'], config), 'AGING');
  assert.equal(aggregateFreshness([DAY, DAY], ['FRESH', 'STALE'],
    ['MODERATE', 'MODERATE'], config), 'STALE');
  assert.equal(aggregateFreshness([DAY, -1], ['FRESH', 'FRESH'],
    ['MODERATE', 'MODERATE'], config), 'UNKNOWN');
  assert.equal(aggregateFreshness([], [], [], config), 'UNKNOWN');
});

test('a single STALE alternative makes the aggregate STALE', () => {
  const mixed = governanceClone(liqDominantDecisionResult(), (draft) => {
    draft.alternatives[1].profile.evidence.freshness = 'STALE';
    draft.alternatives[1].profile.evidence.oldestEvidenceAge = 9 * DAY;
  });
  const gate = evaluateFreshnessGate(mixed, DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'STALE');
  assert.ok(gate.perAlternative.some((p) => p.freshness === 'STALE'));
});

test('per-alternative freshness is reported for every alternative', () => {
  const decision = liqDominantDecisionResult();
  const gate = evaluateFreshnessGate(decision, DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.perAlternative.length, decision.alternatives.length);
  for (const entry of gate.perAlternative) {
    assert.equal(entry.freshness, 'FRESH');
  }
});

test('UNKNOWN never silently becomes FRESH in the aggregate', () => {
  const mixed = governanceClone(liqDominantDecisionResult(), (draft) => {
    draft.alternatives[1].profile.evidence.oldestEvidenceAge = -1;
  });
  const gate = evaluateFreshnessGate(mixed, DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'UNKNOWN');
  assert.notEqual(gate.state, 'FRESH');
});

test('custom thresholds change the classification boundaries', () => {
  const config = mergeGovernanceConfig({freshnessAgingThresholdMs: 1000,
    freshnessStaleThresholdMs: 2000});
  assert.equal(freshnessOf(DAY, 'FRESH', 'MODERATE', config), 'STALE');
});

test('the gate result is immutable with content-derived ids', () => {
  const gate = evaluateFreshnessGate(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.ok(Object.isFrozen(gate));
  assert.ok(gate.freshnessGateId.startsWith('gfsh_'));
  assert.ok(gate.contentFingerprint.startsWith('gcfp_'));
});

test('identical decision results yield identical freshness gates', () => {
  const a = evaluateFreshnessGate(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  const b = evaluateFreshnessGate(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(a.freshnessGateId, b.freshnessGateId);
});
