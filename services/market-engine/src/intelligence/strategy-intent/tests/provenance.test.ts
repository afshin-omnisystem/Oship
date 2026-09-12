import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  liqIntentResult, afisIntentResult, ablIntentResult,
  cleanIntentResult, staleIntentResult, notComparableIntentResult,
  normalizedIntentResult, venueDependentIntentResult,
  governanceBlockedIntentResult, liqGovernanceResult,
  afisGovernanceResult, ablGovernanceResult,
  liqDominantDecisionResult,
} from '../test-fixtures';

/** SPRINT 041 — provenance chain tests (§18). */

test('the chain records the opportunity identity', () => {
  assert.equal(liqIntentResult().intent.provenance.opportunityId,
    'dec-afis-liq-base');
});

test('the chain records the decision identity', () => {
  const provenance = liqIntentResult().intent.provenance;
  assert.equal(provenance.decisionId,
    liqDominantDecisionResult().analysisId);
});

test('the chain records the governance identity', () => {
  assert.equal(liqIntentResult().intent.provenance.governanceId,
    liqGovernanceResult().governanceId);
});

test('the chain records the handoff package identity', () => {
  const provenance = liqIntentResult().intent.provenance;
  assert.equal(provenance.handoffId,
    liqGovernanceResult().handoffPackage.handoffId);
});

test('the chain records the strategy-input view identity', () => {
  const provenance = liqIntentResult().intent.provenance;
  assert.equal(provenance.strategyInputId,
    liqGovernanceResult().strategyInput.strategyInputId);
});

test('the chain ends at the intent id itself', () => {
  const result = liqIntentResult();
  assert.equal(result.intent.provenance.intentId, result.intentId);
});

test('source versions pin every upstream engine', () => {
  const versions = liqIntentResult().intent.provenance.sourceVersions;
  assert.equal(versions.decisionIntelligenceVersion,
    'oship.decision-intelligence.engine.v1');
  assert.equal(versions.governanceVersion,
    'oship.decision-governance.engine.v1');
  assert.equal(versions.governancePolicyVersion,
    'decision-governance.policy.v1');
  assert.equal(versions.intentVersion,
    'oship.strategy-intent.engine.v1');
});

test('source versions carry the upstream analysis ids', () => {
  const versions = liqIntentResult().intent.provenance.sourceVersions;
  assert.equal(versions.decisionAnalysisId,
    liqDominantDecisionResult().analysisId);
  assert.equal(versions.governanceId,
    liqGovernanceResult().governanceId);
});

test('no orphan intent: every corpus intent traces to its governance', () => {
  for (const [result, governance] of [
    [liqIntentResult(), liqGovernanceResult()],
    [afisIntentResult(), afisGovernanceResult()],
    [ablIntentResult(), ablGovernanceResult()],
  ] as const) {
    assert.equal(result.intent.provenance.governanceId,
      governance.governanceId);
    assert.equal(result.intent.provenance.decisionId,
      governance.context.decisionId);
  }
});

test('the opportunity identity matches the governance context', () => {
  assert.equal(liqIntentResult().intent.provenance.opportunityId,
    liqGovernanceResult().context.opportunityId);
});

test('provenance is informational only', () => {
  assert.equal(liqIntentResult().intent.provenance.informational, true);
});

test('provenance ids are deterministic across corpora runs', () => {
  const a = liqIntentResult().intent.provenance.provenanceId;
  const b = liqIntentResult().intent.provenance.provenanceId;
  assert.equal(a, b);
  assert.ok(a.startsWith('sprv_'));
});

test('every classification state carries full provenance', () => {
  for (const result of [cleanIntentResult(), staleIntentResult(),
    notComparableIntentResult(), normalizedIntentResult(),
    venueDependentIntentResult(), governanceBlockedIntentResult()]) {
    const provenance = result.intent.provenance;
    assert.ok(provenance.opportunityId.length > 0);
    assert.ok(provenance.decisionId.length > 0);
    assert.ok(provenance.governanceId.length > 0);
    assert.ok(provenance.handoffId.length > 0);
    assert.ok(provenance.strategyInputId.length > 0);
  }
});

test('the decision context id chains from Decision Intelligence', () => {
  assert.equal(
    liqIntentResult().intent.provenance.decisionContextId,
    liqDominantDecisionResult().context.contextId);
});

test('the governance context id chains from Governance', () => {
  assert.equal(
    liqIntentResult().intent.provenance.governanceContextId,
    liqGovernanceResult().context.contextId);
});
