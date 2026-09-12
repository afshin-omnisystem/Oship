import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StrategyIntentEngine} from '../engine';
import {
  IntentRejectionError, STRATEGY_INTENT_ENGINE_VERSION,
  STRATEGY_INTENT_POLICY_VERSION,
} from '../types';
import {
  afisIntentInput, ablIntentInput, liqIntentInput, cleanIntentInput,
  liqIntentResult,
  staleIntentInput, agingIntentInput, unknownFreshnessIntentInput,
  unknownAllowedIntentInput, unstableIntentInput,
  unstableBlockedIntentInput, notComparableIntentInput,
  normalizedIntentInput, multiDependentIntentInput,
  venueDependentIntentInput, noDominantIntentInput,
  governanceBlockedIntentInput, authorityBypassIntentInput,
  intentRejectionGallery, intentRejectionGalleryOf, intentClone,
} from '../test-fixtures';

/** SPRINT 041 — engine orchestration tests. */

const engine = new StrategyIntentEngine();

test('the engine version is canonical', () => {
  assert.equal(STRATEGY_INTENT_ENGINE_VERSION,
    'oship.strategy-intent.engine.v1');
  assert.equal(STRATEGY_INTENT_POLICY_VERSION,
    'strategy-intent.policy.v1');
});

test('the engine rejects null input fail closed', () => {
  assert.throws(() => engine.synthesize(null as never),
    rejection('INVALID_INTENT_CONTEXT'));
});

test('the engine rejects an unfrozen governance result', () => {
  assert.throws(() => engine.synthesize(intentClone(afisIntentInput(),
    (draft) => {
      draft.governanceResult = intentClone(
        draft.governanceResult) as never;
    })),
  rejection('INVALID_GOVERNANCE_INPUT'));
});

test('the engine rejects a mismatched decision/governance pair', () => {
  const {liqGovernanceResult} =
    require('../test-fixtures') as typeof import('../test-fixtures');
  assert.throws(() => engine.synthesize(
    {...afisIntentInput(), governanceResult: liqGovernanceResult()}),
  rejection('INVALID_PROVENANCE'));
});

test('the LIQ corpus synthesizes a limited-ready intent', () => {
  const result = engine.synthesize(liqIntentInput());
  assert.equal(result.classification,
    'STRATEGIC_INTENT_READY_WITH_LIMITATIONS');
  assert.equal(result.priority, 'LIMITED_STRATEGY_INPUT');
  assert.equal(result.preferredAlternativeId, 'alt-venue-a');
});

test('the clean corpus synthesizes a ready intent', () => {
  const result = engine.synthesize(cleanIntentInput());
  assert.equal(result.classification, 'STRATEGIC_INTENT_READY');
  assert.equal(result.priority, 'NORMAL_STRATEGY_INPUT');
});

test('the AFIS corpus synthesizes a conflicted intent', () => {
  const result = engine.synthesize(afisIntentInput());
  assert.equal(result.classification, 'STRATEGIC_INTENT_CONFLICTED');
  assert.equal(result.preferredAlternativeId, null);
  assert.deepEqual(result.acceptableAlternativeIds, []);
});

test('the ABL corpus synthesizes an insufficient intent', () => {
  const result = engine.synthesize(ablIntentInput());
  assert.equal(result.classification,
    'STRATEGIC_INTENT_INSUFFICIENT_EVIDENCE');
  assert.equal(result.priority, 'RESEARCH_ONLY');
});

test('the stale corpus synthesizes a stale intent', () => {
  const result = engine.synthesize(staleIntentInput());
  assert.equal(result.classification, 'STRATEGIC_INTENT_STALE');
  assert.equal(result.priority, 'RESEARCH_ONLY');
});

test('the aging corpus synthesizes a limited intent', () => {
  const result = engine.synthesize(agingIntentInput());
  assert.equal(result.classification,
    'STRATEGIC_INTENT_READY_WITH_LIMITATIONS');
});

test('the unknown-freshness corpus synthesizes an insufficient intent',
  () => {
    const result = engine.synthesize(unknownFreshnessIntentInput());
    assert.equal(result.classification,
      'STRATEGIC_INTENT_INSUFFICIENT_EVIDENCE');
  });

test('the allowed-unknown corpus stays limited but ready', () => {
  const result = engine.synthesize(unknownAllowedIntentInput());
  assert.equal(result.classification,
    'STRATEGIC_INTENT_READY_WITH_LIMITATIONS');
});

test('the unstable corpus synthesizes a limited intent', () => {
  const result = engine.synthesize(unstableIntentInput());
  assert.equal(result.classification,
    'STRATEGIC_INTENT_READY_WITH_LIMITATIONS');
});

test('the blocked-unstable corpus synthesizes a blocked intent', () => {
  const result = engine.synthesize(unstableBlockedIntentInput());
  assert.equal(result.classification, 'STRATEGIC_INTENT_BLOCKED');
  assert.equal(result.priority, 'BLOCKED');
  assert.equal(result.preferredAlternativeId, null);
});

test('the not-comparable corpus synthesizes a not-comparable intent',
  () => {
    const result = engine.synthesize(notComparableIntentInput());
    assert.equal(result.classification,
      'STRATEGIC_INTENT_NOT_COMPARABLE');
  });

test('the normalized corpus synthesizes a limited intent', () => {
  const result = engine.synthesize(normalizedIntentInput());
  assert.equal(result.classification,
    'STRATEGIC_INTENT_READY_WITH_LIMITATIONS');
  assert.ok(result.restrictions.some((r) =>
    r.code === 'NORMALIZED_COMPARISON_ONLY'));
});

test('the multi-dependent corpus synthesizes a conflicted intent', () => {
  const result = engine.synthesize(multiDependentIntentInput());
  assert.equal(result.classification, 'STRATEGIC_INTENT_CONFLICTED');
  assert.equal(result.dependencies.state, 'MULTI_DEPENDENT');
});

test('the venue-dependent corpus requires research', () => {
  const result = engine.synthesize(venueDependentIntentInput());
  assert.equal(result.classification,
    'STRATEGIC_INTENT_RESEARCH_REQUIRED');
  assert.equal(result.priority, 'HIGH_RESEARCH_PRIORITY');
});

test('the no-dominant corpus synthesizes a limited intent', () => {
  const result = engine.synthesize(noDominantIntentInput());
  assert.equal(result.classification,
    'STRATEGIC_INTENT_READY_WITH_LIMITATIONS');
  assert.equal(result.preferredAlternativeId, null);
  assert.ok(result.acceptableAlternativeIds.length > 0);
});

test('a governance-blocked handoff produces a blocked intent', () => {
  const result = engine.synthesize(governanceBlockedIntentInput());
  assert.equal(result.classification, 'STRATEGIC_INTENT_BLOCKED');
  assert.equal(result.objective.objectiveClass, 'NO_ACTIONABLE_INTENT');
});

test('an authority-bypass attempt produces a blocked intent', () => {
  const result = engine.synthesize(authorityBypassIntentInput());
  assert.equal(result.classification, 'STRATEGIC_INTENT_BLOCKED');
  assert.equal(result.priority, 'BLOCKED');
});

test('every synthesized result is deeply frozen', () => {
  const result = engine.synthesize(liqIntentInput());
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.intent));
  assert.ok(Object.isFrozen(result.alternatives));
  assert.ok(Object.isFrozen(result.restrictions));
  assert.ok(Object.isFrozen(result.auditEvents));
});

test('every synthesized result carries 93 invariant checks', () => {
  const result = engine.synthesize(liqIntentInput());
  assert.equal(result.invariants.checks.length, 93);
  assert.equal(result.invariants.passed, true);
});

test('every synthesized result carries the disclaimer verbatim', () => {
  const result = engine.synthesize(liqIntentInput());
  assert.equal(result.intent.disclaimer,
    'This is an evidence-bound strategic intent, not a probability, '
    + 'forecast, expected return, guarantee, or execution instruction.');
});

test('every synthesized result carries replay evidence', () => {
  const result = engine.synthesize(liqIntentInput());
  assert.equal(result.replay.identical, true);
  assert.equal(result.replay.fingerprint, result.intentFingerprint);
});

test('every synthesized result carries full provenance', () => {
  const provenance = engine.synthesize(liqIntentInput())
    .intent.provenance;
  assert.ok(provenance.provenanceId.startsWith('sprv_'));
  assert.ok(provenance.decisionContextId.startsWith('dctx_'));
  assert.ok(provenance.decisionId.startsWith('dia_'));
  assert.ok(provenance.governanceContextId.startsWith('gctx_'));
  assert.ok(provenance.governanceId.startsWith('gov_'));
  assert.ok(provenance.handoffId.startsWith('ghof_'));
  assert.ok(provenance.strategyInputId.startsWith('gstr_'));
  assert.equal(provenance.intentId, liqIntentResult().intentId);
  assert.equal(provenance.sourceVersions.intentVersion,
    'oship.strategy-intent.engine.v1');
});

test('the rejection gallery rejects every entry with its exact code', () => {
  const gallery = intentRejectionGalleryOf();
  assert.ok(gallery.length >= 45);
  for (const entry of gallery) {
    assert.throws(() => engine.synthesize(entry.input),
      (e: unknown) => e instanceof IntentRejectionError
        && e.code === entry.code,
      `${entry.label} must reject with ${entry.code}`);
  }
});

test('the gallery exercises at least 18 distinct rejection codes', () => {
  const codes = new Set(intentRejectionGallery()
    .map((entry) => entry.code));
  assert.ok(codes.size >= 18);
});

test('repeated synthesis is byte-identical', () => {
  const a = engine.synthesize(afisIntentInput());
  const b = engine.synthesize(afisIntentInput());
  assert.deepEqual(a, b);
});

test('the engine fingerprint is exposed for audit', () => {
  assert.equal(typeof engine.configurationFingerprint, 'string');
  assert.ok(engine.configurationFingerprint.length > 0);
});

test('the engine constructor rejects invalid configuration', () => {
  assert.throws(() => new StrategyIntentEngine(
    {maxAnnotations: 999}),
  /maxAnnotations/);
});

test('the engine output is a StrategyInputView-compatible artifact', () => {
  const result = engine.synthesize(liqIntentInput());
  assert.equal(result.intent.strategyDecides, true);
  assert.equal(result.intent.informational, true);
});

function rejection(code: string): (e: unknown) => boolean {
  return (e: unknown) => e instanceof IntentRejectionError
    && e.code === code;
}
