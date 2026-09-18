import {test} from 'node:test';
import assert from 'node:assert/strict';
import {governanceIdOf, governanceContextIdOf, policyEvaluationIdOf,
  evidenceGateIdOf, safetyGateIdOf, comparabilityGateIdOf,
  freshnessGateIdOf, stabilityGateIdOf, dependencyGateIdOf,
  authorityCheckIdOf, classificationIdOf, restrictionIdOf,
  researchEscalationIdOf, governanceResearchContextIdOf,
  governanceFeedbackIdOf, handoffPackageIdOf, strategyInputIdOf,
  normalizationFingerprintOf, governanceAuditEventIdOf,
  contentFingerprintOf, governanceResultFingerprintOf, learningHash,
  canonicalJson} from '../ids';

/**
 * SPRINT 040 — governance identity tests: content-derived ids, canonical
 * serialization, determinism.
 */

test('governance ids are prefixed and content-derived', () => {
  assert.ok(governanceIdOf({a: 1}).startsWith('gov_'));
  assert.ok(governanceContextIdOf({a: 1}).startsWith('gctx_'));
  assert.ok(policyEvaluationIdOf({a: 1}).startsWith('gpol_'));
  assert.ok(evidenceGateIdOf({a: 1}).startsWith('gevg_'));
  assert.ok(safetyGateIdOf({a: 1}).startsWith('gsfg_'));
  assert.ok(comparabilityGateIdOf({a: 1}).startsWith('gcmp_'));
  assert.ok(freshnessGateIdOf({a: 1}).startsWith('gfsh_'));
  assert.ok(stabilityGateIdOf({a: 1}).startsWith('gstb_'));
  assert.ok(dependencyGateIdOf({a: 1}).startsWith('gdep_'));
  assert.ok(authorityCheckIdOf({a: 1}).startsWith('gaut_'));
  assert.ok(classificationIdOf({a: 1}).startsWith('gcls_'));
  assert.ok(restrictionIdOf({a: 1}).startsWith('gres_'));
  assert.ok(researchEscalationIdOf({a: 1}).startsWith('grsc_'));
  assert.ok(governanceResearchContextIdOf({a: 1}).startsWith('grcx_'));
  assert.ok(governanceFeedbackIdOf({a: 1}).startsWith('gfdb_'));
  assert.ok(handoffPackageIdOf({a: 1}).startsWith('ghof_'));
  assert.ok(strategyInputIdOf({a: 1}).startsWith('gstr_'));
  assert.ok(normalizationFingerprintOf({a: 1}).startsWith('gnrm_'));
  assert.ok(governanceAuditEventIdOf({a: 1}).startsWith('gea_'));
  assert.ok(contentFingerprintOf({a: 1}).startsWith('gcfp_'));
  assert.ok(governanceResultFingerprintOf({a: 1}).startsWith('gfp2_'));
});

test('identical content yields identical ids', () => {
  assert.equal(governanceIdOf({x: 1, y: 2}), governanceIdOf({x: 1, y: 2}));
});

test('different content yields different ids', () => {
  assert.notEqual(governanceIdOf({x: 1}), governanceIdOf({x: 2}));
});

test('key order does not affect ids (canonical serialization)', () => {
  assert.equal(governanceIdOf({a: 1, b: 2}), governanceIdOf({b: 2, a: 1}));
});

test('array order DOES affect ids (arrays are semantic order)', () => {
  assert.notEqual(governanceIdOf({list: [1, 2]}),
    governanceIdOf({list: [2, 1]}));
});

test('canonicalJson sorts object keys', () => {
  assert.equal(canonicalJson({b: 1, a: 2}), '{"a":2,"b":1}');
});

test('canonicalJson is stable under parse/serialize round trips', () => {
  const value = {z: [3, {y: 1, x: 2}], a: {c: 1, b: 2}};
  assert.equal(canonicalJson(JSON.parse(canonicalJson(value))),
    canonicalJson(value));
  assert.equal(
    canonicalJson(JSON.parse(canonicalJson(JSON.parse(canonicalJson(value))))),
    canonicalJson(value));
});

test('learningHash is deterministic sha256 hex', () => {
  const hash = learningHash({a: 1});
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hash, learningHash({a: 1}));
});

test('id prefixes are distinct across artifact kinds', () => {
  const ids = [governanceIdOf({v: 1}), governanceContextIdOf({v: 1}),
    handoffPackageIdOf({v: 1}), strategyInputIdOf({v: 1})];
  assert.equal(new Set(ids).size, ids.length);
});

test('nested key permutation does not affect ids', () => {
  assert.equal(governanceIdOf({outer: {b: 1, a: 2}}),
    governanceIdOf({outer: {a: 2, b: 1}}));
});

test('content fingerprints are stable across repeated calls', () => {
  const input = {deep: {deeper: [1, 2, 3]}, s: 'text'};
  const first = contentFingerprintOf(input);
  for (let i = 0; i < 5; i++) {
    assert.equal(contentFingerprintOf(input), first);
  }
});
