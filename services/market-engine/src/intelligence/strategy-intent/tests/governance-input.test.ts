import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractGovernanceFacts, blockedFamilyOf}
  from '../governance-input';
import {IntentRejectionError} from '../types';
import {
  afisGovernanceResult, ablGovernanceResult, liqGovernanceResult,
  venueDependentGovernanceResult, intentClone,
} from '../test-fixtures';

/** SPRINT 041 — governance-input extraction tests. */

test('the facts mirror the governance identity and classification', () => {
  const facts = extractGovernanceFacts(liqGovernanceResult());
  assert.ok(facts.governanceId.startsWith('gov_'));
  assert.equal(facts.classification,
    'HANDOFF_ALLOWED_WITH_LIMITATIONS');
  assert.ok(facts.classificationReasons.length > 0);
});

test('the facts mirror the governance restrictions', () => {
  const facts = extractGovernanceFacts(liqGovernanceResult());
  assert.deepEqual(facts.restrictionCodes,
    ['ANALYTICAL_ONLY', 'LEAKAGE_WARNING', 'LIMITED_TO_DOMAIN',
      'NO_EXECUTION', 'STABILITY_WARNING']);
  assert.equal(facts.restrictions.length, 5);
});

test('the facts mirror the recommended alternative', () => {
  assert.equal(extractGovernanceFacts(liqGovernanceResult())
    .recommendedAlternativeId, 'alt-venue-a');
  assert.equal(extractGovernanceFacts(afisGovernanceResult())
    .recommendedAlternativeId, null);
});

test('the facts mirror the dependency state', () => {
  assert.equal(extractGovernanceFacts(liqGovernanceResult())
    .dependencyState, 'INDEPENDENT');
  assert.equal(extractGovernanceFacts(afisGovernanceResult())
    .dependencyState, 'MULTI_DEPENDENT');
});

test('the facts mirror the governed statuses', () => {
  const facts = extractGovernanceFacts(liqGovernanceResult());
  assert.equal(facts.stabilityState, 'MODERATELY_STABLE');
  assert.equal(facts.freshnessState, 'FRESH');
  assert.equal(facts.comparabilityStatus, 'COMPARABLE');
});

test('the facts mirror the research escalations', () => {
  const facts = extractGovernanceFacts(liqGovernanceResult());
  assert.deepEqual(facts.researchEscalations.map((e) => e.kind),
    ['LEAKAGE_INVESTIGATION_REQUIRED']);
});

test('the facts carry the handoff and strategy-input identities', () => {
  const facts = extractGovernanceFacts(liqGovernanceResult());
  assert.ok(facts.handoffId.startsWith('ghof_'));
  assert.ok(facts.strategyInputId.startsWith('gstr_'));
  assert.ok(facts.governanceContextId.startsWith('gctx_'));
});

test('the facts carry the evidence limitations', () => {
  const facts = extractGovernanceFacts(liqGovernanceResult());
  assert.ok(facts.evidenceLimitations.length > 0);
});

test('an unknown classification rejects fail closed', () => {
  assert.throws(() => extractGovernanceFacts(
    intentClone(afisGovernanceResult(), (draft) => {
      (draft as {classification: string}).classification = 'HANDOFF_EVIL';
    })),
  (e: unknown) => e instanceof IntentRejectionError
    && e.code === 'INVALID_GOVERNANCE_INPUT');
});

test('an unknown research kind rejects with INVALID_RESEARCH_CONTEXT',
  () => {
    assert.throws(() => extractGovernanceFacts(
      intentClone(afisGovernanceResult(), (draft) => {
        draft.research.escalations[0].kind = 'EVIL_RESEARCH' as never;
      })),
    (e: unknown) => e instanceof IntentRejectionError
      && e.code === 'INVALID_RESEARCH_CONTEXT');
  });

test('a malformed research escalation rejects', () => {
  assert.throws(() => extractGovernanceFacts(
    intentClone(afisGovernanceResult(), (draft) => {
      draft.research.escalations[0].rationale = '';
    })),
  (e: unknown) => e instanceof IntentRejectionError
    && e.code === 'INVALID_RESEARCH_CONTEXT');
});

test('the facts are deterministic', () => {
  assert.deepEqual(extractGovernanceFacts(afisGovernanceResult()),
    extractGovernanceFacts(afisGovernanceResult()));
});

test('the venue-dependent facts escalate three coverage kinds', () => {
  const facts = extractGovernanceFacts(
    venueDependentGovernanceResult());
  const kinds = facts.researchEscalations.map((e) => e.kind);
  assert.ok(kinds.includes('REGIME_COVERAGE_REQUIRED'));
  assert.ok(kinds.includes('STRATEGY_COVERAGE_REQUIRED'));
  assert.ok(kinds.includes('VENUE_COVERAGE_REQUIRED'));
});

test('the blocked family maps conflict classifications', () => {
  assert.deepEqual(blockedFamilyOf('HANDOFF_CONFLICTED'),
    ['CONFLICTED_EVIDENCE']);
  assert.deepEqual(blockedFamilyOf('HANDOFF_STALE'), ['STALE_EVIDENCE']);
  assert.deepEqual(blockedFamilyOf('HANDOFF_NOT_COMPARABLE'),
    ['NOT_COMPARABLE']);
  assert.deepEqual(blockedFamilyOf('HANDOFF_ALLOWED'), []);
});

test('the ABL facts mirror the insufficient family', () => {
  const facts = extractGovernanceFacts(ablGovernanceResult());
  assert.equal(facts.classification, 'HANDOFF_INSUFFICIENT_EVIDENCE');
  assert.equal(facts.recommendedAlternativeId, null);
});
