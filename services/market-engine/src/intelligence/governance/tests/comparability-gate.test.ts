import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateComparabilityGate, validateNormalization,
  rawDomainsComparable} from '../comparability-gate';
import {GovernanceRejectionError} from '../types';
import {DEFAULT_GOVERNANCE_CONFIG} from '../config';
import {
  afisDecisionResult, ablDecisionResult, liqDominantDecisionResult,
  afisBackLegDecisionResult, ablBuyLegDecisionResult,
  ablBadOddsDecisionResult, ablNoIdentityDecisionResult,
  crossDomainDecisionResult, validNormalization,
  versionMismatchNormalization, backEqualsBuyNormalization,
  missingLossNormalization, missingPolicyNormalization,
} from '../test-fixtures';

/**
 * SPRINT 040 — comparability gate tests: AFIS BUY/SELL, ABL BACK/LAY,
 * cross-domain rejection, explicit normalization.
 */

test('an AFIS decision result is COMPARABLE', () => {
  const gate = evaluateComparabilityGate(afisDecisionResult(), null,
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'COMPARABLE');
  assert.equal(gate.afisSemanticsVerified, true);
});

test('an ABL decision result is COMPARABLE', () => {
  const gate = evaluateComparabilityGate(ablDecisionResult(), null,
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'COMPARABLE');
  assert.equal(gate.ablSemanticsVerified, true);
});

test('AFIS semantics verification checks BUY/SELL only', () => {
  const gate = evaluateComparabilityGate(afisDecisionResult(), null,
    DEFAULT_GOVERNANCE_CONFIG);
  const afisCheck = gate.checks.find((c) => c.check === 'afis-side-semantics');
  assert.ok(afisCheck?.passed);
  assert.match(afisCheck.detail, /BUY\/SELL/);
});

test('ABL semantics verification checks BACK/LAY + odds + identity', () => {
  const gate = evaluateComparabilityGate(ablDecisionResult(), null,
    DEFAULT_GOVERNANCE_CONFIG);
  const ablCheck = gate.checks.find(
    (c) => c.check === 'abl-back-lay-semantics');
  assert.ok(ablCheck?.passed);
  assert.match(ablCheck.detail, /BACK\/LAY/);
  assert.match(ablCheck.detail, /decimal odds > 1/);
  assert.match(ablCheck.detail, /market\/selection identity/);
});

test('an AFIS result with BACK legs is NOT_COMPARABLE', () => {
  const gate = evaluateComparabilityGate(afisBackLegDecisionResult(), null,
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'NOT_COMPARABLE');
  assert.equal(gate.code, 'INVALID_AFIS_SEMANTICS');
});

test('an ABL result with BUY legs is NOT_COMPARABLE', () => {
  const gate = evaluateComparabilityGate(ablBuyLegDecisionResult(), null,
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'NOT_COMPARABLE');
  assert.equal(gate.code, 'INVALID_BACK_LAY_SEMANTICS');
});

test('an ABL result with odds ≤ 1 is NOT_COMPARABLE', () => {
  const gate = evaluateComparabilityGate(ablBadOddsDecisionResult(), null,
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'NOT_COMPARABLE');
  assert.equal(gate.code, 'INVALID_ABL_SEMANTICS');
});

test('an ABL result without market identity is NOT_COMPARABLE', () => {
  const gate = evaluateComparabilityGate(ablNoIdentityDecisionResult(), null,
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'NOT_COMPARABLE');
  assert.equal(gate.code, 'INVALID_ABL_SEMANTICS');
});

test('a cross-domain alternative set is NOT_COMPARABLE', () => {
  const gate = evaluateComparabilityGate(crossDomainDecisionResult(), null,
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'NOT_COMPARABLE');
  assert.match(gate.reasons.join(' '), /structurally NOT_COMPARABLE/);
});

test('raw AFIS↔ABL comparison is never comparable', () => {
  assert.equal(rawDomainsComparable('AFIS', 'ABL'), false);
  assert.equal(rawDomainsComparable('ABL', 'AFIS'), false);
  assert.equal(rawDomainsComparable('AFIS', 'AFIS'), false);
});

test('cross-domain rejections from Sprint 039 are preserved', () => {
  const gate = evaluateComparabilityGate(afisDecisionResult(), null,
    DEFAULT_GOVERNANCE_CONFIG);
  assert.ok(Array.isArray(gate.crossDomainRejectionsPreserved));
});

// ---------------------------------------------------------------------------
// Normalization — explicit, versioned, declared-loss
// ---------------------------------------------------------------------------

test('a valid normalization enables COMPARABLE_VIA_NORMALIZATION', () => {
  const gate = evaluateComparabilityGate(liqDominantDecisionResult(),
    validNormalization(), DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'COMPARABLE_VIA_NORMALIZATION');
  assert.ok(gate.normalization !== null);
  assert.equal(gate.normalization.normalizationId, 'norm-afis-abl-v1');
});

test('no normalization leaves the state plain COMPARABLE', () => {
  const gate = evaluateComparabilityGate(liqDominantDecisionResult(), null,
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'COMPARABLE');
  assert.equal(gate.normalization, null);
});

test('a version-mismatched normalization rejects fail-closed', () => {
  assert.throws(() => evaluateComparabilityGate(liqDominantDecisionResult(),
    versionMismatchNormalization(), DEFAULT_GOVERNANCE_CONFIG),
    (e: unknown) => e instanceof GovernanceRejectionError
      && e.code === 'INVALID_GOVERNANCE_CONTEXT');
});

test('a normalization equating BACK with BUY rejects', () => {
  assert.throws(() => evaluateComparabilityGate(liqDominantDecisionResult(),
    backEqualsBuyNormalization(), DEFAULT_GOVERNANCE_CONFIG),
    (e: unknown) => e instanceof GovernanceRejectionError
      && e.code === 'INVALID_BACK_LAY_SEMANTICS');
  assert.throws(() => validateNormalization(backEqualsBuyNormalization(),
    DEFAULT_GOVERNANCE_CONFIG), /BACK==BUY/);
});

test('a normalization without declared semantic loss rejects', () => {
  assert.throws(() => validateNormalization(missingLossNormalization(),
    DEFAULT_GOVERNANCE_CONFIG),
    (e: unknown) => e instanceof GovernanceRejectionError
      && e.code === 'INVALID_GOVERNANCE_CONTEXT');
});

test('a normalization without policy attestation rejects', () => {
  assert.throws(() => validateNormalization(missingPolicyNormalization(),
    DEFAULT_GOVERNANCE_CONFIG), /policy allows/);
});

test('a normalization must cover exactly AFIS and ABL', () => {
  const one = {...validNormalization(), domains: ['AFIS' as const]};
  assert.throws(() => validateNormalization(one, DEFAULT_GOVERNANCE_CONFIG),
    /exactly AFIS and ABL/);
});

test('a normalization must carry an explicit identity', () => {
  const anonymous = {...validNormalization(), normalizationId: ''};
  assert.throws(() => validateNormalization(anonymous,
    DEFAULT_GOVERNANCE_CONFIG), /identity/);
});

test('a normalization side mapping must be total', () => {
  const partial = {...validNormalization(),
    sideMapping: {'AFIS:BUY': 'N:LONG'}};
  assert.throws(() => validateNormalization(partial,
    DEFAULT_GOVERNANCE_CONFIG), /must cover/);
});

test('null normalization is accepted as no normalization', () => {
  assert.equal(validateNormalization(null, DEFAULT_GOVERNANCE_CONFIG), null);
  assert.equal(validateNormalization(undefined, DEFAULT_GOVERNANCE_CONFIG),
    null);
});

test('the validated normalization is immutable and sorted', () => {
  const normalization = validateNormalization(validNormalization(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.ok(normalization !== null);
  assert.ok(Object.isFrozen(normalization));
  assert.deepEqual(normalization.domains, ['ABL', 'AFIS']);
  assert.ok(normalization.normalizationFingerprint.startsWith('gnrm_'));
});

test('the normalization maps onto a neutral namespace', () => {
  const normalization = validateNormalization(validNormalization(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.ok(normalization !== null);
  assert.equal(normalization.sideMapping['ABL:BACK'], 'N:LONG');
  assert.equal(normalization.sideMapping['AFIS:BUY'], 'N:LONG');
  assert.equal(normalization.sideMapping['ABL:LAY'], 'N:SHORT');
  assert.equal(normalization.sideMapping['AFIS:SELL'], 'N:SHORT');
});

test('the gate result is immutable and id-tagged', () => {
  const gate = evaluateComparabilityGate(afisDecisionResult(), null,
    DEFAULT_GOVERNANCE_CONFIG);
  assert.ok(Object.isFrozen(gate));
  assert.ok(gate.comparabilityGateId.startsWith('gcmp_'));
  assert.ok(gate.contentFingerprint.startsWith('gcfp_'));
});

test('identical inputs produce identical gate results', () => {
  const a = evaluateComparabilityGate(afisDecisionResult(), null,
    DEFAULT_GOVERNANCE_CONFIG);
  const b = evaluateComparabilityGate(afisDecisionResult(), null,
    DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(a.comparabilityGateId, b.comparabilityGateId);
});

test('normalization does not make raw cross-domain comparison legal', () => {
  // Even with a valid normalization, a cross-domain alternative set stays
  // NOT_COMPARABLE — normalization enables downstream analytical
  // comparison, never raw mixing.
  const gate = evaluateComparabilityGate(crossDomainDecisionResult(),
    validNormalization(), DEFAULT_GOVERNANCE_CONFIG);
  assert.equal(gate.state, 'NOT_COMPARABLE');
});
