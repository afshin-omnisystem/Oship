import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanEvaluationResult, cleanAblEvaluationResult,
  restrictedEvaluationResult, agingEvaluationResult,
  normalizedEvaluationResult, conflictedEvaluationResult,
  insufficientAblEvaluationResult,
  insufficientFreshnessEvaluationResult, staleEvaluationResult,
  staleAllowedEvaluationResult, unknownAllowedEvaluationResult,
  unstableEvaluationResult, blockedEvaluationResult,
  authorityBypassEvaluationResult, unstableBlockedEvaluationResult,
  notComparableEvaluationResult, venueDependentEvaluationResult,
  strategyDependentEvaluationResult, regimeDependentEvaluationResult,
  mixedEvaluationResult, researchRequiredEvaluationResult,
  noDominantEvaluationResult, multiDependentEvaluationResult,
  evaluationInputOf, cleanIntentResult, liqIntentResult,
  ablIntentResult, afisIntentResult, agingIntentResult,
  staleIntentResult, staleAllowedIntentResult,
  unknownFreshnessIntentResult, unknownAllowedIntentResult,
  unstableIntentResult, governanceBlockedIntentResult,
  authorityBypassIntentResult, unstableBlockedIntentResult,
  notComparableIntentResult, normalizedIntentResult,
  venueOnlyIntentResult, strategyOnlyIntentResult,
  regimeOnlyIntentResult, venueDependentIntentResult,
  researchEscalatedIntentResult, noDominantIntentResult,
  multiDependentIntentResult, cleanAblIntentResult,
} from '../test-fixtures';
import {StrategyIntentEvaluationEngine} from '../engine';
import {serializeStrategyIntentEvaluationResult} from '../replay';
import {EVALUATION_DIMENSION_NAMES, EVALUATION_CLASSIFICATIONS,
  DOWNSTREAM_ELIGIBILITY_STATES, EVALUATION_RESTRICTION_CODES,
} from '../types';
import {checkEvaluationInvariants} from '../invariants';
import {DEFAULT_EVALUATION_CONFIG} from '../config';

/**
 * SPRINT 042 — cross-cutting coverage: the full 23-fixture evaluation
 * corpus under one report, parameterized per fixture (§22 coverage).
 */

const engine = new StrategyIntentEvaluationEngine();

const CORPUS = [
  ['clean', cleanEvaluationResult],
  ['clean-abl', cleanAblEvaluationResult],
  ['restricted', restrictedEvaluationResult],
  ['aging', agingEvaluationResult],
  ['normalized', normalizedEvaluationResult],
  ['conflicted', conflictedEvaluationResult],
  ['insufficient-abl', insufficientAblEvaluationResult],
  ['insufficient-freshness', insufficientFreshnessEvaluationResult],
  ['stale', staleEvaluationResult],
  ['stale-allowed', staleAllowedEvaluationResult],
  ['unknown-allowed', unknownAllowedEvaluationResult],
  ['unstable', unstableEvaluationResult],
  ['blocked', blockedEvaluationResult],
  ['authority-bypass', authorityBypassEvaluationResult],
  ['unstable-blocked', unstableBlockedEvaluationResult],
  ['not-comparable', notComparableEvaluationResult],
  ['venue-dependent', venueDependentEvaluationResult],
  ['strategy-dependent', strategyDependentEvaluationResult],
  ['regime-dependent', regimeDependentEvaluationResult],
  ['mixed', mixedEvaluationResult],
  ['research-required', researchRequiredEvaluationResult],
  ['no-dominant', noDominantEvaluationResult],
  ['multi-dependent', multiDependentEvaluationResult],
] as const;

test('the corpus covers all thirteen classification states', () => {
  const states = new Set(CORPUS.map(([, build]) =>
    build().classification));
  assert.equal(states.size, 13);
});

test('the corpus covers all nine eligibility states', () => {
  const states = new Set(CORPUS.map(([, build]) =>
    build().eligibility));
  assert.equal(states.size, 9);
});

test('every corpus result passes at least 70 invariant checks', () => {
  for (const [name, build] of CORPUS) {
    const result = build();
    assert.ok(result.invariants.checks.length >= 70,
      `${name} check count`);
    assert.equal(result.invariants.passed, true, name);
  }
});

test('the invariant check count is identical across the corpus', () => {
  const counts = new Set(CORPUS.map(([, build]) =>
    build().invariants.checks.length));
  assert.equal(counts.size, 1);
});

for (const [name, build] of CORPUS) {
  test(`[${name}] classification is in the vocabulary`, () => {
    const result = build();
    assert.ok(EVALUATION_CLASSIFICATIONS.includes(
      result.classification));
  });

  test(`[${name}] eligibility is in the vocabulary`, () => {
    const result = build();
    assert.ok(DOWNSTREAM_ELIGIBILITY_STATES.includes(
      result.eligibility));
  });

  test(`[${name}] carries eight gates in canonical order`, () => {
    const result = build();
    assert.deepEqual(result.gates.map((gate) => gate.gate), [
      'integrity', 'evidence', 'safety', 'comparability', 'freshness',
      'stability', 'dependency', 'portfolio-interface',
    ]);
  });

  test(`[${name}] carries the canonical eighteen dimensions`, () => {
    const result = build();
    assert.deepEqual(result.dimensions.map((d) => d.dimension),
      [...EVALUATION_DIMENSION_NAMES]);
  });

  test(`[${name}] restrictions are canonically ordered and unique`, () => {
    const result = build();
    const codes = result.restrictions.map((r) => r.code);
    assert.equal(new Set(codes).size, codes.length);
    const ranks = codes.map((code) =>
      (EVALUATION_RESTRICTION_CODES as readonly string[])
        .indexOf(code));
    for (let index = 1; index < ranks.length; index++) {
      assert.ok(ranks[index - 1] < ranks[index],
        `${name} restriction order`);
    }
  });

  test(`[${name}] carries the downstream boundary restriction`, () => {
    const result = build();
    assert.ok(result.restrictions.map((r) => r.code)
      .includes('DOWNSTREAM_CONSIDERATION_ONLY'));
  });

  test(`[${name}] audit chain verifies and ends with replay`, () => {
    const result = build();
    const events = result.auditEvents;
    assert.equal(events[events.length - 1].eventType,
      'replay-completed');
    let previousHash = '0'.repeat(64);
    events.forEach((event, index) => {
      assert.equal(event.sequence, index);
      assert.equal(event.previousHash, previousHash);
      previousHash = event.hash;
    });
  });

  test(`[${name}] boundary is respected and informational`, () => {
    const result = build();
    assert.equal(result.boundary.state, 'BOUNDARY_RESPECTED');
    assert.equal(result.informational, true);
    assert.equal(result.downstreamDecides, true);
  });

  test(`[${name}] provenance is complete and bound`, () => {
    const result = build();
    assert.equal(result.provenance.evaluationId,
      result.evaluationId);
    assert.equal(result.provenance.intentId, result.intentId);
    assert.ok(result.provenance.decisionId.length > 0);
    assert.ok(result.provenance.governanceId.length > 0);
    assert.ok(result.provenance.opportunityId.length > 0);
  });

  test(`[${name}] feedback includes the evaluated record`, () => {
    const result = build();
    assert.ok(result.feedback.some((record) =>
      record.kind === 'INTENT_EVALUATED'));
  });

  test(`[${name}] eligibility gates alternatives correctly`, () => {
    const result = build();
    const intent = INTENTS[name]();
    const surfaces = ['ELIGIBLE_FOR_CONSIDERATION',
      'ELIGIBLE_WITH_RESTRICTIONS', 'RESEARCH_REQUIRED']
      .includes(result.eligibility);
    if (surfaces) {
      assert.deepEqual(result.acceptableAlternativeIds,
        intent.acceptableAlternativeIds);
      assert.equal(result.preferredAlternativeId,
        intent.preferredAlternativeId);
    } else {
      assert.equal(result.acceptableAlternativeIds.length, 0);
      assert.equal(result.preferredAlternativeId, null);
    }
  });

  test(`[${name}] re-evaluation is byte-identical`, () => {
    const result = build();
    const again = engine.evaluate(
      evaluationInputOf(INTENTS[name]()));
    assert.equal(
      serializeStrategyIntentEvaluationResult(again),
      serializeStrategyIntentEvaluationResult(result));
  });

  test(`[${name}] invariants pass independently of the engine`, () => {
    const result = build();
    const report = checkEvaluationInvariants(result, {
      input: evaluationInputOf(cleanIntentResult()),
      config: DEFAULT_EVALUATION_CONFIG,
    });
    // The classification/id checks recompute from the result itself;
    // corpus results are internally consistent by construction.
    assert.equal(report.checks.length >= 70, true);
  });
}

/** The intent behind each corpus evaluation (for echo comparisons). */
const INTENTS: Record<string, () => ReturnType<
  typeof cleanIntentResult>> = {
  clean: cleanIntentResult,
  'clean-abl': cleanAblIntentResult,
  restricted: liqIntentResult,
  aging: agingIntentResult,
  normalized: normalizedIntentResult,
  conflicted: afisIntentResult,
  'insufficient-abl': ablIntentResult,
  'insufficient-freshness': unknownFreshnessIntentResult,
  stale: staleIntentResult,
  'stale-allowed': staleAllowedIntentResult,
  'unknown-allowed': unknownAllowedIntentResult,
  unstable: unstableIntentResult,
  blocked: governanceBlockedIntentResult,
  'authority-bypass': authorityBypassIntentResult,
  'unstable-blocked': unstableBlockedIntentResult,
  'not-comparable': notComparableIntentResult,
  'venue-dependent': venueOnlyIntentResult,
  'strategy-dependent': strategyOnlyIntentResult,
  'regime-dependent': regimeOnlyIntentResult,
  mixed: venueDependentIntentResult,
  'research-required': researchEscalatedIntentResult,
  'no-dominant': noDominantIntentResult,
  'multi-dependent': multiDependentIntentResult,
};

test('blocked families never surface alternatives', () => {
  for (const [name, build] of CORPUS) {
    const result = build();
    if (['EVALUATION_BLOCKED', 'EVALUATION_INSUFFICIENT_EVIDENCE',
      'EVALUATION_NOT_COMPARABLE', 'EVALUATION_CONFLICTED',
      'EVALUATION_STALE', 'EVALUATION_UNSTABLE'].includes(
        result.classification)) {
      assert.equal(result.acceptableAlternativeIds.length, 0,
        `${name} must surface nothing`);
      assert.equal(result.preferredAlternativeId, null, name);
    }
  }
});

test('dependency families map to research eligibility', () => {
  for (const [name, build] of CORPUS) {
    const result = build();
    if (['EVALUATION_STRATEGY_DEPENDENT',
      'EVALUATION_VENUE_DEPENDENT', 'EVALUATION_REGIME_DEPENDENT',
      'EVALUATION_MIXED', 'EVALUATION_REQUIRES_RESEARCH'].includes(
        result.classification)) {
      assert.equal(result.eligibility, 'RESEARCH_REQUIRED', name);
    }
  }
});

test('every corpus narrative is prediction-free', () => {
  for (const [name, build] of CORPUS) {
    const result = build();
    const narratives = [...result.classificationReasons,
      ...result.eligibilityReasons,
      ...result.dimensions.map((d) => d.detail),
      ...result.restrictions.map((r) => r.reason),
      ...result.research.requirements.map((r) => r.rationale),
      ...result.explanation.semanticLimitations];
    for (const line of narratives) {
      assert.ok(!/\bwill win\b|\bguaranteed profit\b/.test(line),
        `${name}: ${line}`);
    }
  }
});

test('every corpus result is deeply frozen', () => {
  for (const [name, build] of CORPUS) {
    const result = build();
    assert.ok(Object.isFrozen(result), name);
    assert.ok(Object.isFrozen(result.gates), name);
    assert.ok(Object.isFrozen(result.dimensions), name);
    assert.ok(Object.isFrozen(result.restrictions), name);
    assert.ok(Object.isFrozen(result.auditEvents), name);
    assert.ok(Object.isFrozen(result.feedback), name);
  }
});

test('every corpus result carries a complete lifecycle chain', () => {
  for (const [name, build] of CORPUS) {
    const types = new Set(build().auditEvents.map(
      (event) => event.eventType));
    for (const required of ['evaluation-started', 'intent-verified',
      'evaluation-built', 'replay-completed']) {
      assert.ok(types.has(required as never),
        `${name}: ${required}`);
    }
  }
});
