import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  decisionAnalysisIdOf, decisionContextIdOf, compatibilityIdOf,
  counterfactualIdOf, dependencyAxisIdOf, leakageAxisIdOf, stabilityAxisIdOf,
  evidenceAxisIdOf, comparisonIdOf, tradeOffIdOf, tradeOffAxisIdOf,
  dominanceIdOf, rankingIdOf, recommendationIdOf, scenarioMatrixIdOf,
  decisionExplanationIdOf, decisionResearchContextIdOf, decisionFeedbackIdOf,
  divergenceIdOf, decisionAuditEventIdOf, contentFingerprintOf,
  decisionAnalysisFingerprintOf, learningHash, canonicalJson,
} from '../ids';

/**
 * SPRINT 039 — identity tests: every artifact id is content-derived,
 * prefix-tagged and canonical-key-order independent.
 */

test('analysis ids carry the dia prefix', () => {
  const id = decisionAnalysisIdOf({learning: 'l1', timestamp: 1});
  assert.ok(id.startsWith('dia_'));
  assert.equal(id.length, 4 + 24);
});

test('context ids carry the dctx prefix', () => {
  assert.ok(decisionContextIdOf({base: 'b'}).startsWith('dctx_'));
});

test('every prefix family produces distinct prefixed ids', () => {
  const input = {alternativeId: 'a1'};
  const ids = [compatibilityIdOf(input), counterfactualIdOf(input),
    dependencyAxisIdOf(input), leakageAxisIdOf(input), stabilityAxisIdOf(input),
    evidenceAxisIdOf(input), comparisonIdOf(input), tradeOffIdOf(input),
    tradeOffAxisIdOf(input), dominanceIdOf(input), rankingIdOf(input),
    recommendationIdOf(input), scenarioMatrixIdOf(input),
    decisionExplanationIdOf(input), decisionResearchContextIdOf(input),
    decisionFeedbackIdOf(input), divergenceIdOf(input),
    decisionAuditEventIdOf(input)];
  assert.equal(new Set(ids).size, ids.length);
  const prefixes = ['dcmp', 'dcfx', 'daxs', 'dlka', 'dsta', 'deva', 'dcmp2',
    'dtrd', 'dtra', 'ddom', 'drnk', 'drec', 'dscm', 'dexp', 'drcx', 'dfdb',
    'ddiv', 'dea'];
  for (let i = 0; i < ids.length; i++) {
    assert.ok(ids[i].startsWith(prefixes[i] + '_'),
      `${ids[i]} should start with ${prefixes[i]}_`);
  }
});

test('ids are deterministic for identical input', () => {
  const input = {a: 1, b: ['x', 'y']};
  assert.equal(decisionAnalysisIdOf(input), decisionAnalysisIdOf(input));
});

test('ids differ for different input', () => {
  assert.notEqual(decisionAnalysisIdOf({a: 1}), decisionAnalysisIdOf({a: 2}));
});

test('ids are canonical-key-order independent', () => {
  assert.equal(
    decisionAnalysisIdOf({a: 1, b: 2}),
    decisionAnalysisIdOf({b: 2, a: 1}));
});

test('content fingerprints are stable and content-derived', () => {
  assert.equal(contentFingerprintOf({x: 1}), contentFingerprintOf({x: 1}));
  assert.notEqual(contentFingerprintOf({x: 1}), contentFingerprintOf({x: 2}));
});

test('analysis fingerprints separate content from identity', () => {
  const a = decisionAnalysisFingerprintOf({analysisId: 'dia_x', alternatives: 2});
  const b = decisionAnalysisFingerprintOf({analysisId: 'dia_x', alternatives: 3});
  assert.notEqual(a, b);
  assert.ok(a.startsWith('dfp2_'));
});

test('the learning hash primitive is reused (uniform identity)', () => {
  assert.equal(typeof learningHash, 'function');
  assert.equal(learningHash({a: 1}).length, 64);
});

test('canonical JSON sorts object keys deterministically', () => {
  assert.equal(canonicalJson({b: 1, a: 2}), canonicalJson({a: 2, b: 1}));
  assert.notEqual(canonicalJson({a: 1}), canonicalJson({a: 2}));
});
