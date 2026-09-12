import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GOVERNANCE_DISCLAIMER} from '../types';
import {canonicalJson} from '../ids';
import {FORBIDDEN_PACKAGE_KEYS} from '../authority-check';
import {
  liqGovernanceResult, afisGovernanceResult, ablGovernanceResult,
  governanceInputOf, runGovernance, validNormalization,
  cleanDecisionResult, governanceClone,
} from '../test-fixtures';

/**
 * SPRINT 040 — strategy handoff package tests: structure, content,
 * immutability, strategy boundary, disclaimer, audit identity.
 */

test('the package carries opportunity identity', () => {
  const result = liqGovernanceResult();
  assert.equal(result.handoffPackage.decisionId,
    result.context.decisionId);
  assert.equal(result.handoffPackage.opportunityId,
    result.context.opportunityId);
});

test('the package carries domain and class', () => {
  const result = liqGovernanceResult();
  assert.equal(result.handoffPackage.domain, 'AFIS');
  assert.equal(result.handoffPackage.opportunityClass,
    'liquidity-imbalance');
});

test('the package carries the Sprint 039 recommendation read-only', () => {
  const result = liqGovernanceResult();
  assert.equal(result.handoffPackage.recommendation.status,
    'PREFERRED_BY_EVIDENCE');
  assert.equal(result.handoffPackage.recommendation.selectedAlternativeId,
    'alt-venue-a');
  assert.equal(result.handoffPackage.recommendation.informational, true);
});

test('the package carries the alternative ranking', () => {
  const result = liqGovernanceResult();
  assert.ok(result.handoffPackage.alternativeRanking.length > 0);
  for (const entry of result.handoffPackage.alternativeRanking) {
    assert.ok(typeof entry.rank === 'number');
    assert.ok(typeof entry.alternativeId === 'string');
    assert.ok(entry.score === null || typeof entry.score === 'number');
  }
});

test('the package carries the evidence summary', () => {
  const summary = liqGovernanceResult().handoffPackage.evidenceSummary;
  assert.ok(summary.worstConfidence !== undefined);
  assert.ok(typeof summary.historicalEvidenceCount === 'number');
  assert.ok(typeof summary.freshness === 'string');
  assert.ok(typeof summary.stability === 'string');
  assert.ok(typeof summary.comparability === 'string');
});

test('the package carries the trade-offs per alternative', () => {
  const result = liqGovernanceResult();
  assert.ok(result.handoffPackage.tradeOffs.length > 0);
  for (const tradeOff of result.handoffPackage.tradeOffs) {
    assert.ok(typeof tradeOff.contributingDimensions === 'number');
  }
});

test('the package carries the dominance state', () => {
  const result = liqGovernanceResult();
  assert.equal(result.handoffPackage.dominanceState,
    'DOMINANT_BY_EVIDENCE');
});

test('the package carries evidence limitations', () => {
  const result = liqGovernanceResult();
  assert.ok(result.handoffPackage.evidenceLimitations.length > 0);
});

test('the package carries the dependency state', () => {
  const result = afisGovernanceResult();
  assert.equal(result.handoffPackage.dependencies.state, 'MULTI_DEPENDENT');
});

test('the package carries the leakage status with counted-once', () => {
  const status = liqGovernanceResult().handoffPackage.leakageStatus;
  assert.equal(status.countedOnce, true);
  assert.ok(status.maxLeakageShare !== null);
});

test('the package carries stability, freshness and comparability status',
  () => {
    const pkg = liqGovernanceResult().handoffPackage;
    assert.equal(pkg.stabilityStatus, 'MODERATELY_STABLE');
    assert.equal(pkg.freshnessStatus, 'FRESH');
    assert.equal(pkg.comparabilityStatus, 'COMPARABLE');
  });

test('the package carries research requirements', () => {
  const pkg = afisGovernanceResult().handoffPackage;
  assert.ok(Array.isArray(pkg.researchRequirements));
});

test('the package carries the governance result with reasons', () => {
  const pkg = liqGovernanceResult().handoffPackage;
  assert.equal(pkg.governanceResult.classification,
    'HANDOFF_ALLOWED_WITH_LIMITATIONS');
  assert.ok(pkg.governanceResult.reasons.length > 0);
});

test('the package carries the governance restrictions', () => {
  const pkg = liqGovernanceResult().handoffPackage;
  assert.ok(pkg.governanceRestrictions.includes('ANALYTICAL_ONLY'));
  assert.ok(pkg.governanceRestrictions.includes('NO_EXECUTION'));
});

test('the package carries the source versions', () => {
  const versions = liqGovernanceResult().handoffPackage.sourceVersions;
  assert.ok(versions.decisionIntelligenceVersion.length > 0);
  assert.ok(versions.decisionAnalysisId.startsWith('dia_'));
  assert.ok(versions.learningAnalysisId.length > 0);
  assert.ok(versions.policyVersion.length > 0);
  assert.ok(versions.governanceVersion.length > 0);
});

test('the package carries the exact canonical disclaimer', () => {
  const pkg = liqGovernanceResult().handoffPackage;
  assert.equal(pkg.disclaimer, GOVERNANCE_DISCLAIMER);
});

test('the package carries the audit identity', () => {
  const result = liqGovernanceResult();
  const identity = result.handoffPackage.auditIdentity;
  assert.equal(identity.schemaVersion, 'oship.decision-governance.v1');
  assert.equal(identity.governanceId, result.governanceId);
  assert.ok(identity.eventCount > 0);
  assert.match(identity.headHash, /^[0-9a-f]{64}$/);
});

test('the package is informational only', () => {
  assert.equal(liqGovernanceResult().handoffPackage.informational, true);
});

test('the package schema version is canonical', () => {
  assert.equal(liqGovernanceResult().handoffPackage.schemaVersion,
    'decision-governance.handoff.v1');
});

test('the package is immutable', () => {
  const pkg = liqGovernanceResult().handoffPackage;
  assert.ok(Object.isFrozen(pkg));
  assert.throws(() => {
    (pkg as unknown as Record<string, unknown>).domain = 'ABL';
  });
});

test('the package contains no forbidden keys (strategy boundary)', () => {
  const pkg = liqGovernanceResult().handoffPackage;
  assert.ok(!FORBIDDEN_PACKAGE_KEYS.test(canonicalJson(pkg)));
});

test('the package contains no executable order or sizing content', () => {
  const serialized = canonicalJson(liqGovernanceResult().handoffPackage);
  for (const forbidden of ['"order"', '"qty"', '"amountToCommit"',
    '"instruction"', '"command"', '"authorization"', '"apiKey"']) {
    assert.ok(!serialized.includes(forbidden),
      `${forbidden} found in the package`);
  }
});

test('the package id is content-derived and deterministic', () => {
  const a = liqGovernanceResult().handoffPackage;
  const b = runGovernance(governanceInputOf(
    require('../test-fixtures').liqDominantDecisionResult()));
  assert.equal(a.handoffId, b.handoffPackage.handoffId);
  assert.ok(a.handoffId.startsWith('ghof_'));
});

test('identical inputs produce identical packages', () => {
  const a = runGovernance(governanceInputOf(cleanDecisionResult()));
  const b = runGovernance(governanceInputOf(cleanDecisionResult()));
  assert.equal(canonicalJson(a.handoffPackage),
    canonicalJson(b.handoffPackage));
});

test('a normalization changes the package comparability status', () => {
  const normalized = runGovernance(governanceInputOf(
    cleanDecisionResult(), [], validNormalization()));
  assert.equal(normalized.handoffPackage.comparabilityStatus,
    'COMPARABLE_VIA_NORMALIZATION');
});

test('the package fingerprints its content', () => {
  const pkg = liqGovernanceResult().handoffPackage;
  assert.ok(pkg.contentFingerprint.startsWith('gcfp_'));
});

test('the blocked package still carries full evidence framing', () => {
  const blocked = ablGovernanceResult();
  assert.equal(blocked.classification, 'HANDOFF_INSUFFICIENT_EVIDENCE');
  assert.ok(blocked.handoffPackage.evidenceSummary.worstConfidence !== null);
  assert.ok(blocked.handoffPackage.governanceResult.reasons.length > 0);
});

test('the package carries per-alternative evidence gaps as limitations',
  () => {
    const result = runGovernance(governanceInputOf(
      governanceClone(cleanDecisionResult(), (draft) => {
        draft.alternatives[0].evidenceGaps = [
          {dimension: 'venue-history', detail: 'no history'}];
      })));
    assert.ok(result.handoffPackage.evidenceLimitations.some((l) =>
      l.includes('venue-history')));
  });
