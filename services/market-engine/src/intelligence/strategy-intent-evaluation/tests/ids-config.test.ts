import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalJson, hashOf, evaluationIdOf, evaluationContextIdOf,
  evaluationDimensionIdOf, evaluationRestrictionIdOf,
  evaluationResearchIdOf, evaluationFeedbackIdOf,
  evaluationProvenanceIdOf, evaluationExplanationIdOf,
  evaluationBoundaryIdOf, evaluationAuditEventIdOf,
  evaluationFingerprintOf, evaluationConfigFingerprint,
} from '../ids';
import {
  validateEvaluationConfig, mergeEvaluationConfig,
  DEFAULT_EVALUATION_CONFIG, EVALUATION_CONFIG_KEYS,
} from '../config';
import {EvaluationRejectionError} from '../types';
import {cleanEvaluationResult} from '../test-fixtures';

/** SPRINT 042 — id derivation and configuration tests (§19/§22 core). */

test('canonical JSON sorts keys deterministically', () => {
  assert.equal(canonicalJson({b: 1, a: 2}),
    canonicalJson({a: 2, b: 1}));
  assert.equal(canonicalJson({b: 1, a: 2}), '{"a":2,"b":1}');
});

test('canonical JSON is stable for nested structures', () => {
  const value = {z: {y: [3, 1, 2], x: 's'}, a: null};
  assert.equal(canonicalJson(value), canonicalJson(
    JSON.parse(canonicalJson(value))));
});

test('canonical JSON handles arrays without reordering them', () => {
  assert.equal(canonicalJson({list: [3, 1, 2]}),
    '{"list":[3,1,2]}');
});

test('the hash function produces 64-char hex digests', () => {
  const digest = hashOf({probe: true});
  assert.equal(digest.length, 64);
  assert.ok(/^[0-9a-f]{64}$/.test(digest));
});

test('hashing is deterministic and content-sensitive', () => {
  assert.equal(hashOf({a: 1}), hashOf({a: 1}));
  assert.notEqual(hashOf({a: 1}), hashOf({a: 2}));
});

test('the evaluation id uses the eval_ prefix', () => {
  const id = evaluationIdOf({probe: true});
  assert.ok(id.startsWith('eval_'));
});

test('every id helper uses its canonical prefix', () => {
  assert.ok(evaluationContextIdOf({probe: 1}).startsWith('evctx_'));
  assert.ok(evaluationDimensionIdOf({probe: 1}).startsWith('evdim_'));
  assert.ok(evaluationRestrictionIdOf({probe: 1}).startsWith('evres_'));
  assert.ok(evaluationResearchIdOf({probe: 1}).startsWith('evrsc_'));
  assert.ok(evaluationFeedbackIdOf({probe: 1}).startsWith('evfdb_'));
  assert.ok(evaluationProvenanceIdOf({probe: 1}).startsWith('evprv_'));
  assert.ok(evaluationExplanationIdOf({probe: 1}).startsWith('evexp_'));
  assert.ok(evaluationBoundaryIdOf({probe: 1}).startsWith('evbnd_'));
  assert.ok(evaluationAuditEventIdOf({probe: 1}).startsWith('evea_'));
  assert.ok(evaluationFingerprintOf({probe: 1}).startsWith('evfp_'));
  assert.ok(evaluationConfigFingerprint({probe: 1})
    .startsWith('evcfg_'));
});

test('id derivation is deterministic', () => {
  for (const derive of [evaluationIdOf, evaluationContextIdOf,
    evaluationDimensionIdOf, evaluationRestrictionIdOf,
    evaluationResearchIdOf, evaluationFeedbackIdOf,
    evaluationProvenanceIdOf, evaluationExplanationIdOf,
    evaluationBoundaryIdOf, evaluationAuditEventIdOf,
    evaluationFingerprintOf, evaluationConfigFingerprint]) {
    assert.equal(derive({probe: 1}), derive({probe: 1}));
    assert.notEqual(derive({probe: 1}), derive({probe: 2}));
  }
});

test('id derivation is key-order independent', () => {
  assert.equal(evaluationIdOf({a: 1, b: 2}),
    evaluationIdOf({b: 2, a: 1}));
});

test('the result ids all follow their prefixes', () => {
  const result = cleanEvaluationResult();
  assert.ok(result.evaluationId.startsWith('eval_'));
  assert.ok(result.evaluationContext.contextId.startsWith('evctx_'));
  assert.ok(result.restrictions[0].restrictionId.startsWith('evres_'));
  assert.ok(result.research.researchContextId.startsWith('evrsc_'));
  assert.ok(result.feedback[0].feedbackId.startsWith('evfdb_'));
  assert.ok(result.provenance.provenanceId.startsWith('evprv_'));
  assert.ok(result.explanation.explanationId.startsWith('evexp_'));
  assert.ok(result.boundary.boundaryId.startsWith('evbnd_'));
  for (const dimension of result.dimensions) {
    assert.ok(dimension.dimensionId.startsWith('evdim_'));
  }
  for (const event of result.auditEvents) {
    assert.ok(event.eventId.startsWith('evea_'));
  }
});

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

test('the default configuration is canonical and frozen', () => {
  assert.equal(DEFAULT_EVALUATION_CONFIG.schemaVersion,
    'strategy-intent-evaluation.config.v1');
  assert.equal(DEFAULT_EVALUATION_CONFIG.maxAnnotations, 16);
  assert.equal(DEFAULT_EVALUATION_CONFIG.historicalSupportThreshold, 5);
  assert.equal(DEFAULT_EVALUATION_CONFIG.heavyRestrictionThreshold, 4);
  assert.equal(DEFAULT_EVALUATION_CONFIG.escalateEvaluationResearch,
    true);
  assert.equal(DEFAULT_EVALUATION_CONFIG.preserveAllIntentRestrictions,
    true);
  assert.ok(Object.isFrozen(DEFAULT_EVALUATION_CONFIG));
});

test('the configuration exposes exactly its five knobs', () => {
  assert.equal(EVALUATION_CONFIG_KEYS.length, 5);
});

test('merging preserves defaults for omitted values', () => {
  const merged = mergeEvaluationConfig({});
  assert.deepEqual({...merged}, {...DEFAULT_EVALUATION_CONFIG});
});

test('merging applies explicit overrides', () => {
  const merged = mergeEvaluationConfig({maxAnnotations: 8});
  assert.equal(merged.maxAnnotations, 8);
  assert.equal(merged.historicalSupportThreshold, 5);
});

test('a null configuration is treated as absent input', () => {
  const merged = mergeEvaluationConfig(undefined);
  assert.deepEqual({...merged}, {...DEFAULT_EVALUATION_CONFIG});
});

test('maxAnnotations must be an integer in range', () => {
  assert.throws(() => mergeEvaluationConfig({maxAnnotations: 0}),
    EvaluationRejectionError);
  assert.throws(() => mergeEvaluationConfig({maxAnnotations: 65}),
    EvaluationRejectionError);
  assert.throws(() =>
    mergeEvaluationConfig({maxAnnotations: 4.5}),
  EvaluationRejectionError);
});

test('historicalSupportThreshold must be an integer in range', () => {
  assert.throws(() =>
    mergeEvaluationConfig({historicalSupportThreshold: 0}),
  EvaluationRejectionError);
  assert.throws(() =>
    mergeEvaluationConfig({historicalSupportThreshold: 101}),
  EvaluationRejectionError);
});

test('heavyRestrictionThreshold must be an integer in range', () => {
  assert.throws(() =>
    mergeEvaluationConfig({heavyRestrictionThreshold: 0}),
  EvaluationRejectionError);
  assert.throws(() =>
    mergeEvaluationConfig({heavyRestrictionThreshold: 33}),
  EvaluationRejectionError);
});

test('boolean knobs must be booleans', () => {
  assert.throws(() => mergeEvaluationConfig(
    {escalateEvaluationResearch: 'yes' as never}),
  EvaluationRejectionError);
  assert.throws(() => mergeEvaluationConfig(
    {preserveAllIntentRestrictions: 1 as never}),
  EvaluationRejectionError);
});

test('the merged configuration is frozen with a canonical schema', () => {
  const merged = mergeEvaluationConfig({maxAnnotations: 8});
  assert.equal(merged.schemaVersion,
    'strategy-intent-evaluation.config.v1');
  assert.ok(Object.isFrozen(merged));
});

test('validateEvaluationConfig accepts the default config', () => {
  assert.doesNotThrow(() =>
    validateEvaluationConfig(DEFAULT_EVALUATION_CONFIG));
});

test('validateEvaluationConfig rejects a null config', () => {
  assert.throws(() => validateEvaluationConfig(null as never),
    EvaluationRejectionError);
});

test('validateEvaluationConfig rejects a wrong schema version', () => {
  assert.throws(() => validateEvaluationConfig(
    {...DEFAULT_EVALUATION_CONFIG, schemaVersion: 'evil.v1'}),
  EvaluationRejectionError);
});

test('configuration fingerprints differentiate knobs', () => {
  const first = evaluationConfigFingerprint(
    mergeEvaluationConfig({maxAnnotations: 8}));
  const second = evaluationConfigFingerprint(
    mergeEvaluationConfig({maxAnnotations: 9}));
  assert.notEqual(first, second);
  assert.equal(evaluationConfigFingerprint(DEFAULT_EVALUATION_CONFIG),
    evaluationConfigFingerprint(mergeEvaluationConfig({})));
});
