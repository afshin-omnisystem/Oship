import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateNormalization, rawDomainsComparable}
  from '../comparability-gate';
import {GovernanceRejectionError} from '../types';
import {DEFAULT_GOVERNANCE_CONFIG} from '../config';
import {GOVERNANCE_NORMALIZATION_VERSION} from '../types';
import {
  afisGovernanceResult, ablGovernanceResult, governanceInputOf,
  runGovernance, validNormalization, versionMismatchNormalization,
  backEqualsBuyNormalization, cleanDecisionResult,
  crossDomainDecisionResult, governanceClone, liqDominantDecisionResult,
} from '../test-fixtures';

/**
 * SPRINT 040 — cross-domain tests: raw AFIS↔ABL = NOT_COMPARABLE, explicit
 * normalization, normalization mismatch, semantic loss declaration.
 */

test('raw AFIS↔ABL comparison is never comparable', () => {
  assert.equal(rawDomainsComparable('AFIS', 'ABL'), false);
  assert.equal(rawDomainsComparable('ABL', 'AFIS'), false);
});

test('an alternative set spanning domains rejects fail closed', () => {
  // The context builder rejects domain-spanning alternative sets before any
  // gate runs — cross-domain sets are NEVER governed, never compared.
  assert.throws(() => runGovernance(
    governanceInputOf(crossDomainDecisionResult())),
    (e: unknown) => e instanceof GovernanceRejectionError
      && e.code === 'UNSUPPORTED_DOMAIN');
});

test('AFIS and ABL governance results stay fully isolated', () => {
  const afis = afisGovernanceResult();
  const abl = ablGovernanceResult();
  assert.equal(afis.context.domain, 'AFIS');
  assert.equal(abl.context.domain, 'ABL');
  assert.notEqual(afis.governanceId, abl.governanceId);
  assert.notEqual(afis.handoffPackage.handoffId,
    abl.handoffPackage.handoffId);
});

test('an AFIS decision with an ABL-domain alternative rejects', () => {
  assert.throws(() => runGovernance(
    governanceInputOf(crossDomainDecisionResult())),
    (e: unknown) => e instanceof GovernanceRejectionError);
});

test('an explicit normalization enables normalized comparison', () => {
  const result = runGovernance(governanceInputOf(cleanDecisionResult(), [],
    validNormalization()));
  assert.equal(result.comparabilityGate.state,
    'COMPARABLE_VIA_NORMALIZATION');
  assert.equal(result.comparabilityGate.normalization?.version,
    GOVERNANCE_NORMALIZATION_VERSION);
});

test('normalized comparison carries the NORMALIZED_COMPARISON_ONLY '
  + 'restriction', () => {
  const result = runGovernance(governanceInputOf(cleanDecisionResult(), [],
    validNormalization()));
  assert.ok(result.restrictions.some(
    (r) => r.code === 'NORMALIZED_COMPARISON_ONLY'));
});

test('a version mismatch rejects the normalization', () => {
  assert.throws(() => validateNormalization(versionMismatchNormalization(),
    DEFAULT_GOVERNANCE_CONFIG), /does not match the required/);
});

test('a normalization equating BACK with BUY rejects', () => {
  assert.throws(() => validateNormalization(backEqualsBuyNormalization(),
    DEFAULT_GOVERNANCE_CONFIG), /BACK==BUY/);
});

test('a normalization equating LAY with SELL rejects', () => {
  const layEqualsSell = {...validNormalization(),
    sideMapping: {'AFIS:BUY': 'N:LONG', 'AFIS:SELL': 'N:SHORT',
      'ABL:BACK': 'N:LONG', 'ABL:LAY': 'SELL'}};
  assert.throws(() => validateNormalization(layEqualsSell,
    DEFAULT_GOVERNANCE_CONFIG), /side equation/);
});

test('semantic loss must be declared', () => {
  const lossless = {...validNormalization(), semanticLoss: []};
  try {
    validateNormalization(lossless, DEFAULT_GOVERNANCE_CONFIG);
    assert.fail('lossless normalization accepted');
  } catch (e) {
    assert.ok(e instanceof GovernanceRejectionError);
    assert.match((e as Error).message, /semantic loss/);
  }
});

test('the declared semantic loss is preserved in the result', () => {
  const result = runGovernance(governanceInputOf(cleanDecisionResult(), [],
    validNormalization()));
  const normalization = result.comparabilityGate.normalization;
  assert.ok(normalization !== null);
  assert.equal(normalization.semanticLoss.length, 3);
  assert.match(normalization.semanticLoss[0], /microstructure/);
});

test('the normalization maps onto a neutral namespace, not BUY/SELL', () => {
  const normalization = validateNormalization(validNormalization(),
    DEFAULT_GOVERNANCE_CONFIG);
  assert.ok(normalization !== null);
  for (const value of Object.values(normalization.sideMapping)) {
    assert.ok(!['BUY', 'SELL', 'BACK', 'LAY'].includes(value));
  }
});

test('a normalization must cover exactly both domains', () => {
  const afisOnly = {...validNormalization(), domains: ['AFIS'] as never};
  assert.throws(() => validateNormalization(afisOnly,
    DEFAULT_GOVERNANCE_CONFIG), /exactly AFIS and ABL/);
  const triple = {...validNormalization(),
    domains: ['AFIS', 'ABL', 'FOREX'] as never};
  assert.throws(() => validateNormalization(triple,
    DEFAULT_GOVERNANCE_CONFIG), /exactly AFIS and ABL/);
});

test('policy attestation is mandatory for normalized comparison', () => {
  const unattested = {...validNormalization(),
    policyAllowsComparison: false as never};
  assert.throws(() => validateNormalization(unattested,
    DEFAULT_GOVERNANCE_CONFIG), /policy allows/);
});

test('a domain-spanning input never reaches classification', () => {
  assert.throws(() => runGovernance(
    governanceInputOf(crossDomainDecisionResult())),
    /UNSUPPORTED_DOMAIN|fail closed/);
  // The NOT_COMPARABLE classification itself is produced by the
  // not-comparable evidence path, covered below.
});

test('a not-comparable decision escalates COMPARABILITY_REQUIRED', () => {
  const notComparable = governanceClone(liqDominantDecisionResult(),
    (draft) => {
      draft.recommendation.status = 'NOT_COMPARABLE';
      for (const alternative of draft.alternatives) {
        alternative.profile.evidence.comparability = 'NOT_COMPARABLE';
      }
    });
  const result = runGovernance(governanceInputOf(notComparable));
  assert.equal(result.classification, 'HANDOFF_NOT_COMPARABLE');
  assert.ok(result.research.escalations.some((e) =>
    e.kind === 'COMPARABILITY_REQUIRED'));
});

test('normalized comparison never changes the raw isolation invariant', () => {
  const result = runGovernance(governanceInputOf(cleanDecisionResult(), [],
    validNormalization()));
  assert.equal(result.invariants.passed, true);
  const rawCheck = result.invariants.checks.find(
    (c) => c.invariant === 'RAW_CROSS_DOMAIN_REJECTED');
  assert.ok(rawCheck?.passed);
});

test('AFIS legs stay BUY/SELL even with a normalization declared', () => {
  const result = runGovernance(governanceInputOf(cleanDecisionResult(), [],
    validNormalization()));
  assert.equal(result.comparabilityGate.afisSemanticsVerified, true);
});
