import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GovernanceEngine} from '../engine';
import {GovernanceRejectionError} from '../types';
import {
  governanceRejectionGallery, governanceInputOf,
  liqDominantDecisionResult, liqGovernanceResult,
  afisGovernanceResult, ablGovernanceResult, UNSAFE_ANNOTATIONS,
  AUTHORITY_BYPASS_ANNOTATIONS, CLEAN_ANNOTATIONS, validNormalization,
  backEqualsBuyNormalization, versionMismatchNormalization,
  missingLossNormalization, missingPolicyNormalization,
  staleDecisionResult, unknownFreshnessDecisionResult,
  unstableDecisionResult, notComparableDecisionResult, cleanDecisionResult,
} from '../test-fixtures';

/**
 * SPRINT 040 — fail-closed tests: the full rejection gallery (every code
 * throws with an explicit reason) plus the in-band blocked paths and
 * no-silent-fallback guarantees. ≥30 explicit rejection paths.
 */

test('every gallery rejection throws with its exact code', () => {
  const gallery = governanceRejectionGallery();
  assert.ok(gallery.length >= 20);
  for (const fixture of gallery) {
    assert.throws(() => {
      new GovernanceEngine().govern(
        fixture.input as Parameters<GovernanceEngine['govern']>[0]);
    }, (e: unknown) => {
      assert.ok(e instanceof GovernanceRejectionError,
        `${fixture.label} threw ${(e as Error).message}`);
      assert.equal((e as GovernanceRejectionError).code, fixture.code,
        `${fixture.label} threw ${(e as GovernanceRejectionError).code} `
        + `instead of ${fixture.code}`);
      return true;
    }, `${fixture.label} did not throw`);
  }
});

test('the gallery covers at least 12 distinct rejection codes', () => {
  const codes = new Set(governanceRejectionGallery().map((g) => g.code));
  assert.ok(codes.size >= 12, `only ${codes.size} codes covered`);
});

test('the gallery covers the required code families', () => {
  const codes = new Set(governanceRejectionGallery().map((g) => g.code));
  for (const required of ['INVALID_GOVERNANCE_CONTEXT',
    'INVALID_DECISION_RESULT', 'MISSING_DECISION_ID',
    'MISSING_OPPORTUNITY_ID', 'MISSING_DOMAIN', 'UNSUPPORTED_DOMAIN',
    'INVALID_AFIS_SEMANTICS', 'INVALID_ABL_SEMANTICS',
    'INVALID_BACK_LAY_SEMANTICS', 'LEAKAGE_INCONSISTENCY',
    'STABILITY_INCONSISTENCY', 'NONDETERMINISTIC_INPUT']) {
    assert.ok(codes.has(required), `${required} not covered`);
  }
});

test('every rejection error message names its code and says fail closed',
  () => {
    for (const fixture of governanceRejectionGallery()) {
      try {
        new GovernanceEngine().govern(
          fixture.input as Parameters<GovernanceEngine['govern']>[0]);
        assert.fail(`${fixture.label} did not throw`);
      } catch (e) {
        assert.ok(e instanceof GovernanceRejectionError);
        assert.ok((e as Error).message.includes(fixture.code));
        assert.ok((e as Error).message.includes('fail closed'));
      }
    }
  });

// ---------------------------------------------------------------------------
// In-band blocks (explicit classifications, not throws, not silent)
// ---------------------------------------------------------------------------

test('every unsafe annotation blocks with UNSAFE_SEMANTICS', () => {
  for (const annotation of UNSAFE_ANNOTATIONS) {
    const result = new GovernanceEngine().govern(
      governanceInputOf(liqDominantDecisionResult(), [annotation]));
    assert.equal(result.classification, 'HANDOFF_BLOCKED',
      `annotation "${annotation}" did not block`);
    assert.equal(result.safetyGate.code, 'UNSAFE_SEMANTICS');
  }
});

test('every authority-bypass annotation blocks with AUTHORITY_BYPASS', () => {
  for (const annotation of AUTHORITY_BYPASS_ANNOTATIONS) {
    const result = new GovernanceEngine().govern(
      governanceInputOf(liqDominantDecisionResult(), [annotation]));
    assert.equal(result.classification, 'HANDOFF_BLOCKED',
      `annotation "${annotation}" did not block`);
    assert.equal(result.authorityCheck.code, 'AUTHORITY_BYPASS');
  }
});

test('clean annotations never block', () => {
  const result = new GovernanceEngine().govern(
    governanceInputOf(liqDominantDecisionResult(), CLEAN_ANNOTATIONS));
  assert.equal(result.classification, 'HANDOFF_ALLOWED_WITH_LIMITATIONS');
});

test('stale evidence blocks with HANDOFF_STALE and an explicit reason',
  () => {
    const result = new GovernanceEngine().govern(
      governanceInputOf(staleDecisionResult()));
    assert.equal(result.classification, 'HANDOFF_STALE');
    assert.ok(result.classificationReasons.length > 0);
    assert.equal(result.strategyInput.recommendedAlternativeId, null);
  });

test('unknown freshness blocks with an explicit reason', () => {
  const result = new GovernanceEngine().govern(
    governanceInputOf(unknownFreshnessDecisionResult()));
  assert.equal(result.classification, 'HANDOFF_INSUFFICIENT_EVIDENCE');
  assert.match(result.classificationReasons.join(' '), /UNKNOWN|unknown/);
});

test('unstable evidence with a blocking policy blocks explicitly', () => {
  const result = new GovernanceEngine({unstableBlocksHandoff: true}).govern(
    governanceInputOf(unstableDecisionResult()));
  assert.equal(result.classification, 'HANDOFF_BLOCKED');
});

test('not-comparable evidence blocks with HANDOFF_NOT_COMPARABLE', () => {
  const result = new GovernanceEngine().govern(
    governanceInputOf(notComparableDecisionResult()));
  assert.equal(result.classification, 'HANDOFF_NOT_COMPARABLE');
});

// ---------------------------------------------------------------------------
// Normalization rejections
// ---------------------------------------------------------------------------

test('a BACK==BUY normalization rejects with INVALID_BACK_LAY_SEMANTICS',
  () => {
    assert.throws(() => new GovernanceEngine().govern(
      governanceInputOf(cleanDecisionResult(), [],
        backEqualsBuyNormalization())),
      (e: unknown) => e instanceof GovernanceRejectionError
        && e.code === 'INVALID_BACK_LAY_SEMANTICS');
  });

test('a version-mismatched normalization rejects fail closed', () => {
  assert.throws(() => new GovernanceEngine().govern(
    governanceInputOf(cleanDecisionResult(), [],
      versionMismatchNormalization())),
    (e: unknown) => e instanceof GovernanceRejectionError
      && e.code === 'INVALID_GOVERNANCE_CONTEXT');
});

test('a loss-less normalization rejects fail closed', () => {
  assert.throws(() => new GovernanceEngine().govern(
    governanceInputOf(cleanDecisionResult(), [],
      missingLossNormalization())),
    (e: unknown) => e instanceof GovernanceRejectionError
      && e.code === 'INVALID_GOVERNANCE_CONTEXT');
});

test('a normalization without policy attestation rejects fail closed',
  () => {
    assert.throws(() => new GovernanceEngine().govern(
      governanceInputOf(cleanDecisionResult(), [],
        missingPolicyNormalization())),
      (e: unknown) => e instanceof GovernanceRejectionError
        && e.code === 'INVALID_GOVERNANCE_CONTEXT');
  });

test('a valid normalization never blocks', () => {
  const result = new GovernanceEngine().govern(
    governanceInputOf(cleanDecisionResult(), [], validNormalization()));
  assert.equal(result.classification, 'HANDOFF_ALLOWED_WITH_LIMITATIONS');
  assert.ok(result.restrictions.some(
    (r) => r.code === 'NORMALIZED_COMPARISON_ONLY'));
});

// ---------------------------------------------------------------------------
// No silent fallbacks
// ---------------------------------------------------------------------------

test('blocked results are never converted into recommendations', () => {
  for (const decision of [staleDecisionResult(),
    notComparableDecisionResult()]) {
    const result = new GovernanceEngine().govern(
      governanceInputOf(decision));
    assert.notEqual(result.classification, 'HANDOFF_ALLOWED');
    assert.equal(result.strategyInput.recommendedAlternativeId, null);
  }
});

test('no rejection path returns a generic not-recommended message', () => {
  const results = [liqGovernanceResult(), afisGovernanceResult(),
    ablGovernanceResult()];
  for (const result of results) {
    for (const reason of result.classificationReasons) {
      assert.ok(!/^\s*not recommended\s*$/i.test(reason));
    }
  }
});

test('fail-closed input validation runs before any gate', () => {
  // A decision result that would pass gates is still rejected when the
  // input envelope itself is malformed.
  assert.throws(() => new GovernanceEngine().govern({
    decisionResult: liqDominantDecisionResult(),
    annotations: [], timestamp: Number.NaN,
    correlationId: 'c', traceId: 't',
  }), (e: unknown) => e instanceof GovernanceRejectionError
    && e.code === 'NONDETERMINISTIC_INPUT');
});

test('upstream invariant failures are rejected, never re-governed', () => {
  const bad = JSON.parse(JSON.stringify(liqDominantDecisionResult()));
  bad.invariants.passed = false;
  assert.throws(() => new GovernanceEngine().govern(
    governanceInputOf(bad)),
    (e: unknown) => e instanceof GovernanceRejectionError
      && e.code === 'INVALID_DECISION_RESULT');
});

test('upstream non-replay results are rejected as nondeterministic', () => {
  const bad = JSON.parse(JSON.stringify(liqDominantDecisionResult()));
  bad.replay.identical = false;
  assert.throws(() => new GovernanceEngine().govern(
    governanceInputOf(bad)),
    (e: unknown) => e instanceof GovernanceRejectionError
      && e.code === 'NONDETERMINISTIC_INPUT');
});

test('NaN payloads inside the decision result reject fail closed', () => {
  const bad = JSON.parse(JSON.stringify(liqDominantDecisionResult()));
  bad.context.historicalEvidenceCount = Number.NaN;
  assert.throws(() => new GovernanceEngine().govern(
    governanceInputOf(bad)),
    (e: unknown) => e instanceof GovernanceRejectionError
      && e.code === 'NONDETERMINISTIC_INPUT');
});

test('the rejection gallery is frozen and deterministic', () => {
  const a = governanceRejectionGallery();
  const b = governanceRejectionGallery();
  assert.equal(a.length, b.length);
  assert.deepEqual(a.map((g) => g.code), b.map((g) => g.code));
});

test('rejections never leak partial governance results', () => {
  // Every throw happens before any result object escapes the engine.
  for (const fixture of governanceRejectionGallery()) {
    try {
      new GovernanceEngine().govern(
        fixture.input as Parameters<GovernanceEngine['govern']>[0]);
      assert.fail(`${fixture.label} did not throw`);
    } catch (e) {
      assert.ok(e instanceof GovernanceRejectionError);
      assert.equal((e as GovernanceRejectionError).code, fixture.code);
    }
  }
});
