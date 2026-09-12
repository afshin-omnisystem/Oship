import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateEvidenceGate, worstConfidenceOf,
  isLimitingConfidence} from '../evidence-gate';
import {DEFAULT_GOVERNANCE_CONFIG} from '../config';
import {
  afisDecisionResult, ablDecisionResult, ablThinDecisionResult,
  liqDominantDecisionResult, cleanDecisionResult, staleDecisionResult,
  notComparableDecisionResult, governanceClone,
} from '../test-fixtures';

/**
 * SPRINT 040 — evidence gate tests: PASS, PASS_WITH_LIMITATIONS, and every
 * BLOCK state, over real and crafted decision results.
 */

test('a clean decision result passes the evidence gate', () => {
  const gate = evaluateEvidenceGate(cleanDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'PASS');
  assert.equal(gate.code, null);
});

test('a WEAK-evidence decision passes with limitations', () => {
  const gate = evaluateEvidenceGate(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'PASS_WITH_LIMITATIONS');
  assert.match(gate.reasons.join(' '), /WEAK/);
});

test('a conflicted decision blocks with BLOCK_CONFLICTED', () => {
  const gate = evaluateEvidenceGate(afisDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'BLOCK_CONFLICTED');
  assert.equal(gate.code, 'CONFLICTED_EVIDENCE');
  assert.equal(gate.conflicted, true);
});

test('an insufficient decision blocks with BLOCK_INSUFFICIENT_EVIDENCE',
  () => {
    const gate = evaluateEvidenceGate(ablDecisionResult(),
      DEFAULT_GOVERNANCE_CONFIG);
    assert.equal(gate.state, 'BLOCK_INSUFFICIENT_EVIDENCE');
    assert.equal(gate.code, 'INSUFFICIENT_EVIDENCE');
  });

test('the thin-history ABL decision blocks as insufficient', () => {
  const gate = evaluateEvidenceGate(ablThinDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'BLOCK_INSUFFICIENT_EVIDENCE');
});

test('stale evidence blocks with BLOCK_STALE', () => {
  const gate = evaluateEvidenceGate(staleDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'BLOCK_STALE');
  assert.equal(gate.code, 'STALE_EVIDENCE');
  assert.equal(gate.staleEvidence, true);
});

test('stale evidence may pass with limitations under explicit policy', () => {
  const config = {
    ...DEFAULT_GOVERNANCE_CONFIG, allowStaleAnalyticalOnly: true};
  const gate = evaluateEvidenceGate(staleDecisionResult(), config);
  assert.equal(gate.state, 'PASS_WITH_LIMITATIONS');
  assert.match(gate.reasons.join(' '), /analytical-only/);
});

test('a not-comparable decision blocks with BLOCK_NOT_COMPARABLE', () => {
  const gate = evaluateEvidenceGate(notComparableDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'BLOCK_NOT_COMPARABLE');
  assert.equal(gate.code, 'NOT_COMPARABLE');
  assert.equal(gate.comparable, false);
});

test('NOT_COMPARABLE takes precedence over CONFLICTED', () => {
  const both = governanceClone(afisDecisionResult(), (draft) => {
    for (const alternative of draft.alternatives) {
      alternative.profile.evidence.comparability = 'NOT_COMPARABLE';
    }
  });
  const gate = evaluateEvidenceGate(both, DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'BLOCK_NOT_COMPARABLE');
});

test('CONFLICTED takes precedence over INSUFFICIENT', () => {
  const both = governanceClone(afisDecisionResult(), (draft) => {
    draft.recommendation.status = 'INSUFFICIENT_EVIDENCE';
  });
  const gate = evaluateEvidenceGate(both, DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'BLOCK_CONFLICTED');
});

test('the gate reports the worst confidence across alternatives', () => {
  const gate = evaluateEvidenceGate(afisDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.worstConfidence, 'CONFLICTED');
});

test('the gate reports the worst sample adequacy', () => {
  const gate = evaluateEvidenceGate(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.sampleAdequacy, 'SUFFICIENT');
  const thin = evaluateEvidenceGate(ablThinDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(thin.sampleAdequacy, 'INSUFFICIENT');
});

test('evidence gaps force PASS_WITH_LIMITATIONS', () => {
  const withGaps = governanceClone(cleanDecisionResult(), (draft) => {
    draft.alternatives[0].evidenceGaps = [
      {dimension: 'venue-history', detail: 'no venue history for venue-z'},
    ];
  });
  const gate = evaluateEvidenceGate(withGaps, DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'PASS_WITH_LIMITATIONS');
  assert.match(gate.reasons.join(' '), /evidence gaps/);
});

test('LIMITED sample adequacy forces PASS_WITH_LIMITATIONS', () => {
  const limited = governanceClone(cleanDecisionResult(), (draft) => {
    for (const alternative of draft.alternatives) {
      alternative.profile.evidence.sampleAdequacy = 'LIMITED';
    }
  });
  const gate = evaluateEvidenceGate(limited, DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'PASS_WITH_LIMITATIONS');
  assert.match(gate.reasons.join(' '), /LIMITED/);
});

test('every blocked gate carries explicit reasons', () => {
  for (const gate of [evaluateEvidenceGate(afisDecisionResult(),
      DEFAULT_GOVERNANCE_CONFIG),
    evaluateEvidenceGate(ablDecisionResult(), DEFAULT_GOVERNANCE_CONFIG),
    evaluateEvidenceGate(staleDecisionResult(), DEFAULT_GOVERNANCE_CONFIG)]) {
    assert.ok(gate.reasons.length > 0);
    assert.ok(gate.code !== null);
  }
});

test('the gate result is immutable', () => {
  const gate = evaluateEvidenceGate(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.ok(Object.isFrozen(gate));
  assert.ok(Object.isFrozen(gate.reasons));
});

test('the gate id is content-derived', () => {
  const gate = evaluateEvidenceGate(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.ok(gate.evidenceGateId.startsWith('gevg_'));
  assert.ok(gate.contentFingerprint.startsWith('gcfp_'));
});

test('identical decision results yield identical gate results', () => {
  const a = evaluateEvidenceGate(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  const b = evaluateEvidenceGate(liqDominantDecisionResult(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(a.evidenceGateId, b.evidenceGateId);
  assert.equal(a.contentFingerprint, b.contentFingerprint);
});

test('worstConfidenceOf aggregates deterministically', () => {
  assert.equal(worstConfidenceOf(['STRONG', 'MODERATE']), 'MODERATE');
  assert.equal(worstConfidenceOf(['WEAK', 'LIMITED']), 'LIMITED');
  assert.equal(worstConfidenceOf(['INSUFFICIENT', 'CONFLICTED']),
    'CONFLICTED');
  assert.equal(worstConfidenceOf(['STALE', 'NOT_COMPARABLE']),
    'NOT_COMPARABLE');
  assert.equal(worstConfidenceOf([]), null);
  assert.equal(worstConfidenceOf(['UNKNOWN']), 'UNKNOWN');
});

test('isLimitingConfidence identifies WEAK and LIMITED only', () => {
  assert.equal(isLimitingConfidence('WEAK'), true);
  assert.equal(isLimitingConfidence('LIMITED'), true);
  assert.equal(isLimitingConfidence('STRONG'), false);
  assert.equal(isLimitingConfidence('MODERATE'), false);
  assert.equal(isLimitingConfidence('SUFFICIENT'), false);
});

test('a single conflicted alternative poisons the whole decision', () => {
  const oneConflict = governanceClone(liqDominantDecisionResult(), (draft) => {
    draft.alternatives[1].confidenceState = 'CONFLICTED';
  });
  const gate = evaluateEvidenceGate(oneConflict, DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'BLOCK_CONFLICTED');
});

test('unresolved conflicts in the evidence axis block', () => {
  const withConflict = governanceClone(liqDominantDecisionResult(), (draft) => {
    draft.evidenceAnalysis.unresolvedConflicts = [
      'venue-a preservation contradicts venue-b preservation'];
  });
  const gate = evaluateEvidenceGate(withConflict, DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'BLOCK_CONFLICTED');
});
